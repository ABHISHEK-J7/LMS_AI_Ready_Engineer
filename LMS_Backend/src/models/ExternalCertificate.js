import mongoose, { Schema } from 'mongoose';
import { ExternalCertStatus } from '#shared';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * A certificate a student earned OUTSIDE the AI Ready Engineer program and
 * uploaded themselves (a link or an uploaded file). Separate from the
 * platform-issued `Certificate`. Must be approved by a trainer/admin before it
 * counts as verified on the student's certificates page.
 */
const externalCertificateSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    issuer: { type: String, trim: true },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ExternalCertStatus),
      default: ExternalCertStatus.PENDING,
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    note: { type: String, trim: true }, // optional reviewer note (e.g. rejection reason)
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  },
  baseSchemaOptions,
);

export const ExternalCertificate = mongoose.model('ExternalCertificate', externalCertificateSchema);
