import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * Records the FIRST time a student clicked "Join" for a class — their entry
 * time into the video. Written once (first click) and surfaced in the trainer's
 * attendance sheet.
 */
const classJoinSchema = new Schema(
  {
    classSession: { type: Schema.Types.ObjectId, ref: 'ClassSchedule', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    joinedAt: { type: Date, required: true },
  },
  baseSchemaOptions,
);

// One entry-time record per student per class — guarantees only the first click sticks.
classJoinSchema.index({ classSession: 1, student: 1 }, { unique: true });

export const ClassJoin = mongoose.model('ClassJoin', classJoinSchema);
