import mongoose from 'mongoose';
import { tenantPlugin } from './tenantPlugin.js';

// Register BEFORE any model is compiled so every tenant schema is auto-scoped.
// (No-ops on schemas without an `organization` path, e.g. Organization.)
mongoose.plugin(tenantPlugin);
