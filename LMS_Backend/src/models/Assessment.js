import mongoose, { Schema } from 'mongoose';
import {
  AssessmentAvailability,
  AssessmentType,
  DEFAULT_PASSING_SCORE,
  ProctoringMode,
  QuestionType,
} from '#shared';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

const questionSchema = new Schema(
  {
    type: { type: String, enum: Object.values(QuestionType), required: true },
    prompt: { type: String, required: true },
    options: [String],
    correctOption: Number,
    // Trainer-authored model answer / grading rubric for AI-graded questions
    // (scenario / prompt / repo). Fed to the evaluator to anchor its scoring, and
    // NEVER exposed to students. Empty for MCQ.
    referenceAnswer: { type: String, default: '' },
    points: { type: Number, default: 1 },
    // The question-bank item this was snapshot from (for de-duping re-adds).
    sourceId: { type: Schema.Types.ObjectId },
  },
  subSchemaOptions,
);

const assessmentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    type: { type: String, enum: Object.values(AssessmentType), required: true },
    // Optional topic scoping (practice tests can target one module topic);
    // preparation/final cover the whole module so topic stays null.
    topic: { type: Schema.Types.ObjectId, default: null },
    topicTitle: { type: String, trim: true, default: '' },
    availability: {
      type: String,
      enum: Object.values(AssessmentAvailability),
      default: AssessmentAvailability.LOCKED, // locked until a trainer unlocks it
      index: true,
    },
    // Exam window: availableFrom = window opens, deadline = window closes.
    availableFrom: Date,
    deadline: Date,
    // Proctored, timed exam (preparation + final). `durationMinutes` is the per-
    // student time limit once they start; effective end = min(start+duration, deadline).
    // Invigilation mode chosen by the trainer/admin (none / app / seb).
    proctoring: { type: String, enum: Object.values(ProctoringMode), default: ProctoringMode.NONE },
    // Derived from `proctoring` for the exam flow: proctored = mode !== none,
    // requireSeb = mode === seb. Kept in sync on save so existing logic is unchanged.
    proctored: { type: Boolean, default: false },
    durationMinutes: { type: Number, min: 1 },
    requireSeb: { type: Boolean, default: false },
    passingScore: { type: Number, default: DEFAULT_PASSING_SCORE },
    questions: { type: [questionSchema], default: [] },
    unlockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

// Hot path: progression + gating filter by (module, type) repeatedly.
assessmentSchema.index({ module: 1, type: 1 });

export const Assessment = mongoose.model('Assessment', assessmentSchema);
