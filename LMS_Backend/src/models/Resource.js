import mongoose, { Schema } from 'mongoose';
import { ResourceType } from '@lms/shared';
import { baseSchemaOptions } from './baseSchema.js';

const resourceSchema = new Schema(
  {
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    topic: { type: Schema.Types.ObjectId },
    type: { type: String, enum: Object.values(ResourceType), required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

export const Resource = mongoose.model('Resource', resourceSchema);
