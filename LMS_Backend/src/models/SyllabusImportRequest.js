import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/** Approval state of an org admin's request to pull the master syllabus. */
export const RequestStatus = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

/**
 * An org admin's request to import the MASTER template's syllabus onto one of their
 * modules. The super admin reviews these in their Approvals area and, on approve,
 * the master syllabus is applied to the requesting org's module.
 */
const syllabusImportRequestSchema = new Schema(
  {
    // The requesting organization (stamped by the tenant plugin on create).
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    // The org module the syllabus should land on + denormalised label for display.
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    moduleCode: { type: String, required: true },
    moduleName: { type: String, default: '' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, enum: Object.values(RequestStatus), default: RequestStatus.PENDING, index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
    decisionNote: { type: String, default: '' },
  },
  baseSchemaOptions,
);

// At most ONE pending request per (org, module) — a second is refused at the DB level.
syllabusImportRequestSchema.index(
  { organization: 1, module: 1 },
  { unique: true, partialFilterExpression: { status: RequestStatus.PENDING } },
);

export const SyllabusImportRequest = mongoose.model('SyllabusImportRequest', syllabusImportRequestSchema);
