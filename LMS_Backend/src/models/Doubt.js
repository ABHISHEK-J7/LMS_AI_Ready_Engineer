import mongoose, { Schema } from 'mongoose';
import { DoubtStatus, UserRole } from '@lms/shared';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

const messageSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: Object.values(UserRole), required: true },
    body: { type: String, required: true, trim: true },
  },
  // subdoc id + its own timestamps so each reply has createdAt.
  { ...subSchemaOptions, timestamps: true },
);

/**
 * A student doubt / Q&A thread. The first message is the question; trainers
 * (assigned to the doubt's module or batch) and admins reply, which marks it
 * answered. The owning student can follow up.
 */
const doubtSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: 'Module', index: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', index: true },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(DoubtStatus), default: DoubtStatus.OPEN, index: true },
    messages: { type: [messageSchema], default: [] },
  },
  baseSchemaOptions,
);

export const Doubt = mongoose.model('Doubt', doubtSchema);
