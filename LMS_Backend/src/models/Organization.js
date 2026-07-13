import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * A tenant. The super admin creates organizations; each org has its own admins,
 * trainers, students, batches, and curriculum (modules/syllabus/question bank).
 * Every tenant-scoped document carries an `organization` ref back to one of these.
 */
const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short unique code (e.g. "ACME") — handy for display + support.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    // The single reserved "Master Template" org the super admin edits. Its modules
    // seed every NEW organization. Hidden from the tenant list.
    isTemplate: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  baseSchemaOptions,
);

export const Organization = mongoose.model('Organization', organizationSchema);
