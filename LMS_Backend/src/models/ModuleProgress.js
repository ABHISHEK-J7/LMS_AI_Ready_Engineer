import mongoose, { Schema } from 'mongoose';
import { ModuleProgressStatus } from '@lms/shared';
import { baseSchemaOptions } from './baseSchema.js';

const moduleProgressSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(ModuleProgressStatus),
      default: ModuleProgressStatus.LOCKED,
    },
    attendancePercentage: { type: Number, default: 0 },
    practiceTestsCompleted: { type: Number, default: 0 },
    finalScore: Number,
    completedAt: Date,
  },
  baseSchemaOptions,
);

moduleProgressSchema.index({ student: 1, module: 1 }, { unique: true });

export const ModuleProgress = mongoose.model('ModuleProgress', moduleProgressSchema);
