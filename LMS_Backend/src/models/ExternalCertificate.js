import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * A certificate a student earned OUTSIDE the AI Ready Engineer program and
 * uploaded themselves (a link or an uploaded file). Separate from the
 * platform-issued `Certificate`.
 */
const externalCertificateSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    issuer: { type: String, trim: true },
    url: { type: String, required: true },
  },
  baseSchemaOptions,
);

export const ExternalCertificate = mongoose.model('ExternalCertificate', externalCertificateSchema);
