import mongoose, { Schema } from 'mongoose';
import { SubmissionStatus } from '@lms/shared';
import { baseSchemaOptions } from './baseSchema.js';

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, required: true },
    selectedOption: Number,
    text: String,
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.NOT_STARTED,
    },
    answers: { type: [answerSchema], default: [] },
    score: Number,
    passed: Boolean,
    feedback: { type: Schema.Types.Mixed },
    submittedAt: Date,
  },
  baseSchemaOptions,
);

submissionSchema.index({ assessment: 1, student: 1 }, { unique: true });

export const Submission = mongoose.model('Submission', submissionSchema);
