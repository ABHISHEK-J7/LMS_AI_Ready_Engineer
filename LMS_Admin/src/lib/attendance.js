import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from './api';

export const attendanceKeys = {
  all: ['attendance'],
  me: ['attendance', 'me'],
  roster: (classId) => ['attendance', 'roster', classId],
  student: (studentId) => ['attendance', 'student', studentId],
  batch: (batchId) => ['attendance', 'batch', batchId],
};

/** Signed-in student's own attendance (summary + history). */
export function useMyAttendance({ enabled = true } = {}) {
  return useQuery({ queryKey: attendanceKeys.me, queryFn: () => unwrap(api.get('/attendance/me')), enabled });
}

/** Batch roster for a class merged with existing marks (trainer/admin entry screen). */
export function useClassRoster(classId) {
  return useQuery({
    queryKey: attendanceKeys.roster(classId),
    queryFn: () => unwrap(api.get(`/attendance/class/${classId}`)),
    enabled: Boolean(classId),
  });
}

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, records, bufferMinutes }) =>
      unwrap(api.post(`/attendance/class/${classId}`, { records, ...(bufferMinutes != null ? { bufferMinutes } : {}) })),
    onSuccess: (_data, { classId }) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.roster(classId) });
      qc.invalidateQueries({ queryKey: ['classes'] }); // attendanceMarked flag changed
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

/** Batch compliance report (per-student %, low-attendance flags). */
export function useBatchAttendance(batchId) {
  return useQuery({
    queryKey: attendanceKeys.batch(batchId),
    queryFn: () => unwrap(api.get(`/attendance/batch/${batchId}`)),
    enabled: Boolean(batchId),
  });
}

/** A specific student's attendance (admin/trainer). */
export function useStudentAttendance(studentId) {
  return useQuery({
    queryKey: attendanceKeys.student(studentId),
    queryFn: () => unwrap(api.get(`/attendance/student/${studentId}`)),
    enabled: Boolean(studentId),
  });
}
