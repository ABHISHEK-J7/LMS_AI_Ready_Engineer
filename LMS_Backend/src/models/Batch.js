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

// Serialize like every model (id, no __v/passwordHash) but ALSO drop any member
// ref that populate couldn't resolve (e.g. an anonymized/removed account). Left in,
// a null trainer both breaks the UI and gets re-submitted, which the API rejects
// (trainerIds.0: Expected string, received null).
batchSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    if (Array.isArray(ret.trainers)) ret.trainers = ret.trainers.filter(Boolean);
    if (Array.isArray(ret.students)) ret.students = ret.students.filter(Boolean);
    if (Array.isArray(ret.moduleTrainers)) {
      for (const mt of ret.moduleTrainers) {
        if (mt && Array.isArray(mt.trainers)) mt.trainers = mt.trainers.filter(Boolean);
      }
    }
    return ret;
  },
});

export const Batch = mongoose.model('Batch', batchSchema);
