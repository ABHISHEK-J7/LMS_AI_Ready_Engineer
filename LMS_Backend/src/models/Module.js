import mongoose, { Schema } from 'mongoose';
import { SkillLevel } from '#shared';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

// A subtopic = one concept delivered under a topic (what's taught in class),
// optionally with the date window it was/will be covered over.
const subtopicSchema = new Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },
  },
  subSchemaOptions,
);

const topicSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    order: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, default: false },
    subtopics: { type: [subtopicSchema], default: [] },
  },
  subSchemaOptions,
);

const moduleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    order: { type: Number, required: true, default: 0, index: true },
    level: { type: String, enum: Object.values(SkillLevel), default: SkillLevel.BEGINNER },
    learningObjectives: { type: [String], default: [] },
    topics: { type: [topicSchema], default: [] },
    assignedTrainers: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    archived: { type: Boolean, default: false, index: true },
  },
  baseSchemaOptions,
);

export const Module = mongoose.model('Module', moduleSchema);
