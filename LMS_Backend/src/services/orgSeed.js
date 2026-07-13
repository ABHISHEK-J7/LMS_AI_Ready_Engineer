import { DEFAULT_CURRICULUM } from '#shared';
import { Module, Organization } from '../models/index.js';

/** The reserved Master-Template organization (or null if not set up yet). */
export async function getTemplateOrg() {
  return Organization.findOne({ isTemplate: true });
}

/** Modules a new org should start with: a deep copy of the template's modules
 *  (with their full syllabus), or the hardcoded default if no template exists. */
async function templateModuleDocs(organizationId) {
  const template = await getTemplateOrg();
  if (template) {
    const src = await Module.find({ organization: template._id }).sort({ order: 1 }).lean();
    if (src.length) {
      return src.map((m) => ({
        organization: organizationId,
        order: m.order,
        code: m.code,
        name: m.name,
        level: m.level,
        description: m.description ?? '',
        learningObjectives: m.learningObjectives ?? [],
        // Deep-copy topics (+ subtopics) so later template edits never touch this org.
        topics: (m.topics ?? []).map((t, i) => ({
          title: t.title,
          description: t.description ?? '',
          order: t.order ?? i,
          completed: false,
          subtopics: (t.subtopics ?? []).map((s) => ({
            title: s.title ?? '',
            description: s.description ?? '',
            fromDate: s.fromDate ?? null,
            toDate: s.toDate ?? null,
          })),
        })),
        assignedTrainers: [], // trainers are per-org; assigned later
        archived: false,
      }));
    }
  }
  // Fallback: the built-in default curriculum.
  return DEFAULT_CURRICULUM.map((m) => ({
    organization: organizationId,
    order: m.order,
    code: m.code,
    name: m.name,
    level: m.level,
    topics: m.topics.map((title, i) => ({ title, order: i, completed: false })),
  }));
}

/**
 * Seed a fresh organization with its OWN copy of the master-template curriculum.
 * Idempotent: skips if the org already has modules.
 */
export async function seedCurriculumForOrg(organizationId) {
  const existing = await Module.countDocuments({ organization: organizationId });
  if (existing > 0) return { seeded: 0 };
  const docs = await templateModuleDocs(organizationId);
  const created = await Module.insertMany(docs);
  return { seeded: created.length };
}
