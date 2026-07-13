import mongoose, { Schema } from 'mongoose';
import { ResourceType } from '#shared';
import { baseSchemaOptions } from './baseSchema.js';

const resourceSchema = new Schema(
  {
    module: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    topic: { type: Schema.Types.ObjectId },
    type: { type: String, enum: Object.values(ResourceType), required: true },
    title: { type: String, required: true, trim: true },
    // For video/link resources: the file/external URL. Empty for articles.
    url: { type: String, default: '' },
    // For article resources: the markdown body (rendered for students). Empty otherwise.
    content: { type: String, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
  },
  baseSchemaOptions,
);

export const Resource = mongoose.model('Resource', resourceSchema);
