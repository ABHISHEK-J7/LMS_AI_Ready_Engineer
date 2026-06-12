import mongoose, { Schema } from 'mongoose';
import {
  AssessmentAvailability,
  AssessmentType,
  DEFAULT_PASSING_SCORE,
  QuestionType,
} from '@lms/shared';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

const questionSchema = new Schema(
  {
    type: { type: String, enum: Object.values(QuestionType), required: true },
    prompt: { type: String, required: true },
    options: [String],
    correctOption: Number,
    points: { type: Number, default: 1 },
  },
  subSchemaOptions,
);

const assessmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    type: { type: String, enum: Object.values(AssessmentType), required: true },
    practiceIndex: { type: Number, min: 1, max: 5 },
    availability: {
      type: String,
      enum: Object.values(AssessmentAvailability),
      default: AssessmentAvailability.LOCKED, // locked until a trainer unlocks it
      index: true,
    },
    availableFrom: Date,
    deadline: Date,
    passingScore: { type: Number, default: DEFAULT_PASSING_SCORE },
    questions: { type: [questionSchema], default: [] },
    unlockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

export const Assessment = mongoose.model('Assessment', assessmentSchema);
