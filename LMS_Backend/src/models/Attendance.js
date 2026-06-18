import mongoose, { Schema } from 'mongoose';
import { AttendanceStatus } from '#shared';
import { baseSchemaOptions } from './baseSchema.js';

const attendanceSchema = new Schema(
  {
    classSession: { type: Schema.Types.ObjectId, ref: 'ClassSchedule', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    status: { type: String, enum: Object.values(AttendanceStatus), required: true },
    remarks: String,
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    markedAt: { type: Date, default: () => new Date() },
  },
  baseSchemaOptions,
);

// One attendance record per student per class session.
attendanceSchema.index({ classSession: 1, student: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
