import mongoose, { Schema } from 'mongoose';
import { DoubtStatus, UserRole } from '#shared';
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
    // Mirrors `status !== closed`; powers the partial-unique "one open per module" index.
    open: { type: Boolean, default: true },
    messages: { type: [messageSchema], default: [] },
    // The trainer who answered — the one the student rates on close.
    answeredBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    // 1–5 star rating the student gives the trainer when they close the doubt.
    rating: { type: Number, min: 1, max: 5 },
  },
  baseSchemaOptions,
);

// At most ONE open doubt per (student, module) — enforced atomically at the DB level
// (race-proof, unlike a read-then-create check).
doubtSchema.index(
  { student: 1, module: 1 },
  { unique: true, partialFilterExpression: { open: true, module: { $exists: true } } },
);

export const Doubt = mongoose.model('Doubt', doubtSchema);
