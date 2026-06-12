import { z } from 'zod';
import { AttendanceStatus, UserRole } from '@lms/shared';
import { Attendance, Batch, ClassJoin, ClassSchedule, User, getSettings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';

const objectId = z.string().length(24);

export const classIdParam = z.object({ classId: objectId });
export const studentIdParam = z.object({ studentId: objectId });
export const batchIdParam = z.object({ batchId: objectId });

export const saveAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        student: objectId,
        status: z.nativeEnum(AttendanceStatus),
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1),
});

/**
 * Attendance summary for a set of records.
 * `attended` = present + late. Excused is excluded from the denominator so it
 * never penalizes a student. Percentage is over (total − excused).
 */
export function computeSummary(records) {
  const byStatus = {
    [AttendanceStatus.PRESENT]: 0,
    [AttendanceStatus.ABSENT]: 0,
    [AttendanceStatus.LATE]: 0,
    [AttendanceStatus.EXCUSED]: 0,
  };
  for (const r of records) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  const totalClasses = records.length;
  const attended = byStatus[AttendanceStatus.PRESENT] + byStatus[AttendanceStatus.LATE];
  const denominator = totalClasses - byStatus[AttendanceStatus.EXCUSED];
  const percentage = denominator > 0 ? Math.round((attended / denominator) * 100) : 0;
  return { totalClasses, attended, percentage, byStatus };
}

/** Admin always; otherwise the trainer who owns the class. */
async function loadClassForAttendance(req) {
  const cls = await ClassSchedule.findById(req.params.classId);
  if (!cls) throw ApiError.notFound('Class not found');
  if (req.auth.role !== UserRole.ADMIN && cls.trainer.toString() !== req.auth.userId) {
    throw ApiError.forbidden('You can only mark attendance for classes you teach');
  }
  return cls;
}

// ── Roster (entry screen) ──────────────────────────────────────────────────────

/** Batch roster for a class merged with any attendance already recorded. */
export async function getClassRoster(req, res) {
  const cls = await loadClassForAttendance(req);
  const batch = await Batch.findById(cls.batch).populate('students', 'name email status');
  const existing = await Attendance.find({ classSession: cls._id });
  const byStudent = new Map(existing.map((a) => [a.student.toString(), a]));

  // Entry times — when each student first clicked "Join" for this class.
  const joins = await ClassJoin.find({ classSession: cls._id });
  const joinByStudent = new Map(joins.map((j) => [j.student.toString(), j.joinedAt]));

  const roster = (batch?.students ?? []).map((s) => {
    const a = byStudent.get(s._id.toString());
    return {
      student: { id: s._id.toString(), name: s.name, email: s.email },
      joinedAt: joinByStudent.get(s._id.toString()) ?? null,
      status: a?.status ?? null,
      remarks: a?.remarks ?? '',
    };
  });

  ok(res, {
    class: {
      id: cls._id.toString(),
      title: cls.title,
      date: cls.date,
      attendanceMarked: cls.attendanceMarked,
    },
    roster,
  });
}

/** Bulk upsert attendance for a class; one record per (class, student). */
export async function saveAttendance(req, res) {
  const cls = await loadClassForAttendance(req);
  const batch = await Batch.findById(cls.batch);
  if (!batch) throw ApiError.badRequest('Batch not found for this class');

  const enrolled = new Set(batch.students.map((s) => s.toString()));
  for (const r of req.body.records) {
    if (!enrolled.has(r.student)) {
      throw ApiError.badRequest('One or more students are not enrolled in this batch');
    }
  }

  const now = new Date();
  await Attendance.bulkWrite(
    req.body.records.map((r) => ({
      updateOne: {
        filter: { classSession: cls._id, student: r.student },
        update: {
          $set: {
            status: r.status,
            remarks: r.remarks ?? '',
            batch: cls.batch,
            module: cls.module,
            markedBy: req.auth.userId,
            markedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );

  cls.attendanceMarked = true;
  await cls.save();

  const records = await Attendance.find({ classSession: cls._id });
  ok(res, { saved: records.length, summary: computeSummary(records) });
}

// ── Student views ────────────────────────────────────────────────────────────

async function studentAttendance(studentId) {
  const records = await Attendance.find({ student: studentId })
    .sort({ markedAt: -1 })
    .populate('module', 'name code')
    .populate('classSession', 'title date');
  return { summary: computeSummary(records), records: records.map((r) => r.toJSON()) };
}

/** Signed-in student's own attendance. */
export async function myAttendance(req, res) {
  ok(res, await studentAttendance(req.auth.userId));
}

/** Admin/trainer: a specific student's attendance. */
export async function getStudentAttendance(req, res) {
  const student = await User.findById(req.params.studentId);
  if (!student || student.role !== UserRole.STUDENT) throw ApiError.notFound('Student not found');
  ok(res, { student: student.toJSON(), ...(await studentAttendance(req.params.studentId)) });
}

// ── Batch compliance (admin/trainer) ──────────────────────────────────────────

/** Per-student attendance % for a batch, flagging those below the configured minimum. */
export async function getBatchAttendance(req, res) {
  const batch = await Batch.findById(req.params.batchId).populate('students', 'name email');
  if (!batch) throw ApiError.notFound('Batch not found');

  const settings = await getSettings();
  const minAttendance = settings.minAttendance;

  const all = await Attendance.find({ batch: batch._id });
  const byStudent = new Map();
  for (const a of all) {
    const key = a.student.toString();
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(a);
  }

  const students = batch.students.map((s) => {
    const summary = computeSummary(byStudent.get(s._id.toString()) ?? []);
    return {
      student: { id: s._id.toString(), name: s.name, email: s.email },
      ...summary,
      belowMinimum: summary.totalClasses > 0 && summary.percentage < minAttendance,
    };
  });

  ok(res, {
    batch: { id: batch._id.toString(), name: batch.name, code: batch.code },
    minAttendance,
    students,
  });
}
