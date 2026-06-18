import mongoose, { Schema } from 'mongoose';
import { baseSchemaOptions } from './baseSchema.js';

/**
 * A per-user in-app notification (results, approvals, replies, announcements…).
 * `link` is an in-app route the bell deep-links to; `type` groups them for icons.
 */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'info' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

// Bell feed + unread badge: newest-first per user, fast unread filter.
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
