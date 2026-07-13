import { DEFAULT_CURRICULUM } from '#shared';
import { Module } from '../models/index.js';

/**
 * Seed a fresh organization with its OWN copy of the default AI-Ready-Engineer
 * curriculum (each org's modules are independent and separately editable).
 * Idempotent: skips if the org already has modules.
 */
export async function seedCurriculumForOrg(organizationId) {
  const existing = await Module.countDocuments({ organization: organizationId });
  if (existing > 0) return { seeded: 0 };

  const docs = DEFAULT_CURRICULUM.map((m) => ({
    organization: organizationId,
    order: m.order,
    code: m.code,
    name: m.name,
    level: m.level,
    topics: m.topics.map((title, i) => ({ title, order: i, completed: false })),
  }));
  const created = await Module.insertMany(docs);
  return { seeded: created.length };
}
