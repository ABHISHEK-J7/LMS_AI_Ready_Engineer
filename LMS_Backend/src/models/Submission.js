import mongoose, { Schema } from 'mongoose';
import { SubmissionStatus } from '#shared';
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
    startedAt: Date, // when a timed/proctored attempt began (the timer anchor)
    submittedAt: Date,
    // Proctoring: set when a student left the exam (tab switch / exited full screen).
    disqualified: { type: Boolean, default: false },
    disqualifiedReason: { type: String },
    // Webcam proctoring snapshots captured during the attempt (URLs under /api/uploads).
    proctorShots: { type: [String], default: [] },
    // Proctoring warnings (blocked shortcuts / leaving the exam). Counted for staff review.
    warnings: { type: Number, default: 0 },
    warningLog: { type: [{ _id: false, reason: String, at: Date }], default: [] },
  },
  baseSchemaOptions,
);

submissionSchema.index({ assessment: 1, student: 1 }, { unique: true });
// Leaderboard + analytics + gate filters query by (assessment, status) / (student, status).
submissionSchema.index({ assessment: 1, status: 1 });
submissionSchema.index({ student: 1, status: 1 });

export const Submission = mongoose.model('Submission', submissionSchema);
