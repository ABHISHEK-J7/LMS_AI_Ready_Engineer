import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions, subSchemaOptions } from './baseSchema.js';

// Per-module trainer assignment within a batch: who delivers each module.
const moduleTrainerSchema = new Schema(
  {
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    trainers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  subSchemaOptions,
);

// Which syllabus topics have been TAUGHT in this batch (per module). Topic ids
// reference Module.topics[]._id. Tracked per batch so progress is batch-specific.
const taughtTopicsSchema = new Schema(
  {
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    topics: [{ type: Schema.Types.ObjectId }],
  },
  subSchemaOptions,
);

const batchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    students: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    // Derived = union of all moduleTrainers[].trainers. Kept so class scheduling
    // ("trainer must belong to the batch") and trainer batch lists keep working.
    trainers: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    modules: [{ type: Schema.Types.ObjectId, ref: 'Module' }],
    // Which trainers deliver each module in this batch.
    moduleTrainers: [moduleTrainerSchema],
    // Which syllabus topics have been taught, per module, in this batch.
    taughtTopics: [taughtTopicsSchema],
    archived: { type: Boolean, default: false, index: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  },
  baseSchemaOptions,
);

// Batch code is unique WITHIN an organization.
batchSchema.index({ organization: 1, code: 1 }, { unique: true });

// Serialize members (trainers/students) straight from the source document so every
// one always carries an `id`. Mongoose reuses a single populated instance across
// paths (e.g. a trainer who delivers several modules is the SAME object in
// batch.trainers AND each module's trainers), and its default JSON transform can
// drop the id on the repeated references — which then reaches the client as
// undefined and, once re-submitted, as null (trainerIds.0: Expected string,
// received null). Unresolvable refs (an anonymized/removed account) are dropped.
const memberJSON = (u) => {
  if (!u) return null;
  if (u._id) return { id: String(u._id), name: u.name, email: u.email, status: u.status };
  const id = String(u); // an unpopulated ObjectId ref — keep the id so it's usable
  return /^[0-9a-fA-F]{24}$/.test(id) ? { id } : null;
};

batchSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    if (Array.isArray(doc.trainers)) ret.trainers = doc.trainers.map(memberJSON).filter(Boolean);
    if (Array.isArray(doc.students)) ret.students = doc.students.map(memberJSON).filter(Boolean);
    if (Array.isArray(doc.moduleTrainers)) {
      ret.moduleTrainers = doc.moduleTrainers.map((mt, i) => ({
        ...ret.moduleTrainers[i],
        trainers: Array.isArray(mt.trainers) ? mt.trainers.map(memberJSON).filter(Boolean) : [],
      }));
    }
    return ret;
  },
});

export const Batch = mongoose.model('Batch', batchSchema);
