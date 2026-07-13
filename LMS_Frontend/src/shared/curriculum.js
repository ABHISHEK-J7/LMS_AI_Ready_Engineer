import { SkillLevel } from './enums.js';

/**
 * The default "AI Ready Engineer" curriculum — the 21-module master template.
 * The super admin edits this set (adding topics/subtopics) and every new
 * organization clones it. This array is the canonical order and the fallback
 * used to seed a fresh installation.
 *
 * @typedef {Object} CurriculumModuleSeed
 * @property {number} order
 * @property {string} code
 * @property {string} name
 * @property {string} level
 * @property {string[]} topics
 */

/** @type {CurriculumModuleSeed[]} */
export const DEFAULT_CURRICULUM = [
  { order: 1, code: 'LLMFOUND', name: 'LLM Foundation', level: SkillLevel.BEGINNER, topics: [] },
  { order: 2, code: 'GENAI', name: 'Generative AI', level: SkillLevel.BEGINNER, topics: [] },
  { order: 3, code: 'AITOOLS', name: 'AI Tools', level: SkillLevel.BEGINNER, topics: [] },
  { order: 4, code: 'PE', name: 'Prompt Engineering', level: SkillLevel.BEGINNER, topics: [] },
  { order: 5, code: 'GITHUB', name: 'GitHub Account', level: SkillLevel.BEGINNER, topics: [] },
  { order: 6, code: 'VIBE', name: 'Vibe Coding', level: SkillLevel.INTERMEDIATE, topics: [] },
  { order: 7, code: 'VIBEPROJ', name: 'Vibe Coding Projects', level: SkillLevel.INTERMEDIATE, topics: [] },
  { order: 8, code: 'DB', name: 'Database', level: SkillLevel.INTERMEDIATE, topics: [] },
  { order: 9, code: 'AIAPI', name: 'AI API Integration', level: SkillLevel.INTERMEDIATE, topics: [] },
  { order: 10, code: 'AIAPIPROJ', name: 'AI API Integration Projects', level: SkillLevel.INTERMEDIATE, topics: [] },
  { order: 11, code: 'RAG', name: 'RAG Systems', level: SkillLevel.ADVANCED, topics: [] },
  { order: 12, code: 'AGENTS', name: 'AI Agents', level: SkillLevel.ADVANCED, topics: [] },
  { order: 13, code: 'AGENTSPROJ', name: 'AI Agents Projects', level: SkillLevel.ADVANCED, topics: [] },
  { order: 14, code: '3CS', name: "3 C's (Co-pilot, Codex, Claude Code)", level: SkillLevel.ADVANCED, topics: [] },
  { order: 15, code: 'AISEC', name: 'AI Security', level: SkillLevel.ADVANCED, topics: [] },
  { order: 16, code: 'AGENTIC', name: 'Agentic AI', level: SkillLevel.ADVANCED, topics: [] },
  { order: 17, code: 'DEPLOY', name: 'Deployment', level: SkillLevel.EXPERT, topics: [] },
  { order: 18, code: 'LLMCREATE', name: 'LLM Creation', level: SkillLevel.EXPERT, topics: [] },
  { order: 19, code: 'CLOUDAI', name: 'Cloud AI', level: SkillLevel.EXPERT, topics: [] },
  { order: 20, code: 'AIPROJ', name: 'AI Projects', level: SkillLevel.EXPERT, topics: [] },
  { order: 21, code: 'AICERT', name: 'AI Certifications', level: SkillLevel.EXPERT, topics: [] },
];
