import mongoose, { Schema } from 'mongoose';
import { SkillLevel } from '#shared';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

const topicSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    order: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, default: false },
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
