import { SkillLevel } from './enums.js';

/**
 * The default "AI Ready Engineer" curriculum. The curriculum is an engine —
 * admins can create/edit/reorder modules at runtime — but this is the
 * canonical Beginner → Expert path used to seed a fresh installation.
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
  {
    order: 1,
    code: 'PE',
    name: 'Prompt Engineering',
    level: SkillLevel.BEGINNER,
    topics: [
      'AI Basics',
      'Generative AI',
      'LLM Fundamentals',
      'Prompt Engineering',
      'Prompt Patterns',
      'Chain of Thought',
      'Structured Outputs',
      'AI Productivity',
    ],
  },
  {
    order: 2,
    code: 'TOOLS',
    name: 'AI Tools Mastery',
    level: SkillLevel.BEGINNER,
    topics: [
      'ChatGPT',
      'Claude',
      'Gemini',
      'Perplexity',
      'NotebookLM',
      'Cursor',
      'Windsurf',
      'Lovable',
      'Replit',
      'Bolt',
    ],
  },
  {
    order: 3,
    code: 'CODE',
    name: 'AI Coding',
    level: SkillLevel.INTERMEDIATE,
    topics: ['AI Assisted Development', 'Code Generation', 'Debugging', 'Refactoring', 'Testing'],
  },
  {
    order: 4,
    code: 'API',
    name: 'AI API Integration',
    level: SkillLevel.INTERMEDIATE,
    topics: [
      'OpenAI APIs',
      'Anthropic APIs',
      'Gemini APIs',
      'AI SDKs',
      'Function Calling',
      'Structured Outputs',
    ],
  },
  {
    order: 5,
    code: 'GENAI',
    name: 'Generative AI',
    level: SkillLevel.INTERMEDIATE,
    topics: ['Text Generation', 'Image Generation', 'Audio Generation', 'Video Generation'],
  },
  {
    order: 6,
    code: 'RAG',
    name: 'RAG Systems',
    level: SkillLevel.ADVANCED,
    topics: ['Embeddings', 'Vector Databases', 'Retrieval', 'Chunking', 'Hybrid Search'],
  },
  {
    order: 7,
    code: 'AGENTS',
    name: 'AI Agents',
    level: SkillLevel.ADVANCED,
    topics: ['Agent Architecture', 'Tools', 'Memory', 'Planning', 'Multi-Agent Systems'],
  },
  {
    order: 8,
    code: 'SEC',
    name: 'AI Security',
    level: SkillLevel.ADVANCED,
    topics: ['Prompt Injection', 'Data Leakage', 'Model Security', 'Agent Security'],
  },
  {
    order: 9,
    code: 'CLOUD',
    name: 'Cloud AI',
    level: SkillLevel.EXPERT,
    topics: ['AWS AI', 'Azure AI', 'GCP AI', 'Deployments'],
  },
  {
    order: 10,
    code: 'LLM',
    name: 'LLM Engineering',
    level: SkillLevel.EXPERT,
    topics: ['Transformers', 'Fine Tuning', 'RLHF', 'Model Evaluation', 'LLM Creation Concepts'],
  },
];
