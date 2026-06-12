import mongoose, { Schema } from 'mongoose';
import { ClassStatus, MeetingProvider } from '@lms/shared';
import { baseSchemaOptions } from './baseSchema.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const classScheduleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    trainer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true, match: timePattern },
    endTime: { type: String, required: true, match: timePattern },
    provider: {
      type: String,
      enum: Object.values(MeetingProvider),
      default: MeetingProvider.OTHER,
    },
    meetingLink: String,
    recordingLink: String,
    status: { type: String, enum: Object.values(ClassStatus), default: ClassStatus.SCHEDULED },
    attendanceMarked: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

export const ClassSchedule = mongoose.model('ClassSchedule', classScheduleSchema);
