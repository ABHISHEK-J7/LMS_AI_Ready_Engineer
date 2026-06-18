import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * A student's rating + comment for a class they attended, directed at the
 * trainer who took it. One rating per (class, student). Eligibility (attended
 * ≥¾ of the class) is enforced before this is created.
 */
const classRatingSchema = new Schema(
  {
    classSession: { type: Schema.Types.ObjectId, ref: 'ClassSchedule', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trainer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  baseSchemaOptions,
);

classRatingSchema.index({ classSession: 1, student: 1 }, { unique: true });

export const ClassRating = mongoose.model('ClassRating', classRatingSchema);
