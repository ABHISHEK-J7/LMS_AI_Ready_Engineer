import mongoose, { Schema } from 'mongoose';
import {
  DEFAULT_ALLOW_SELF_REGISTRATION,
  DEFAULT_MIN_ATTENDANCE,
  DEFAULT_PASSING_SCORE,
  DEFAULT_THEME,
} from '#shared';
import { baseSchemaOptions } from './baseSchema.js';

const settingsSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true },
    passingScore: { type: Number, default: DEFAULT_PASSING_SCORE },
    minAttendance: { type: Number, default: DEFAULT_MIN_ATTENDANCE },
    allowSelfRegistration: { type: Boolean, default: DEFAULT_ALLOW_SELF_REGISTRATION },
    activeTheme: { type: String, default: DEFAULT_THEME },
    // Safe Exam Browser: one global Config Key (the entire secret behind the SEB
    // gate — never returned by the API, like the other keys) + the .seb config URL.
    sebConfigKey: { type: String, select: false, default: '' },
    sebConfigUrl: { type: String, default: '' },
    // Admin-configurable Claude API key for AI grading. Stored server-side only;
    // NEVER returned by the API (the controller exposes a boolean instead) and
    // hidden from default queries. The env var takes precedence over this.
    aiApiKey: { type: String, select: false, default: '' },
    // Zoom S2S OAuth credentials — same handling as the AI key (never returned).
    zoomAccountId: { type: String, select: false, default: '' },
    zoomClientId: { type: String, select: false, default: '' },
    zoomClientSecret: { type: String, select: false, default: '' },
  },
  baseSchemaOptions,
);

const SettingsModel = mongoose.model('Settings', settingsSchema);

/** Fetch the singleton settings doc, creating it with defaults on first call. */
export async function getSettings() {
  const existing = await SettingsModel.findOne({ key: 'global' });
  if (existing) return existing;
  return SettingsModel.create({ key: 'global' });
}

/** Read the stored AI key (explicitly, since it is `select: false`). */
export async function getStoredAiApiKey() {
  const doc = await SettingsModel.findOne({ key: 'global' }).select('+aiApiKey');
  return doc?.aiApiKey || '';
}

/** Read the stored SEB Config Key (explicitly, since it is `select: false`). */
export async function getStoredSebConfigKey() {
  const doc = await SettingsModel.findOne({ key: 'global' }).select('+sebConfigKey');
  return doc?.sebConfigKey || '';
}

/** Read the stored Zoom credentials (explicitly, since they are `select: false`). */
export async function getStoredZoomCreds() {
  const doc = await SettingsModel.findOne({ key: 'global' }).select(
    '+zoomAccountId +zoomClientId +zoomClientSecret',
  );
  return {
    zoomAccountId: doc?.zoomAccountId || '',
    zoomClientId: doc?.zoomClientId || '',
    zoomClientSecret: doc?.zoomClientSecret || '',
  };
}

export const Settings = SettingsModel;
