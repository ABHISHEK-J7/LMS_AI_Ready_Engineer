import { SkillLevel } from '@lms/shared';

/** Badge tone for each skill level — consistent across list + detail. */
export function levelTone(level) {
  switch (level) {
    case SkillLevel.BEGINNER:
      return 'success';
    case SkillLevel.INTERMEDIATE:
      return 'primary';
    case SkillLevel.ADVANCED:
      return 'warning';
    case SkillLevel.EXPERT:
      return 'error';
    default:
      return 'neutral';
  }
}

export function titleCase(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Syllabus completion as { done, total, pct }. */
export function topicProgress(topics = []) {
  const total = topics.length;
  const done = topics.filter((t) => t.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

export const LEVEL_OPTIONS = Object.values(SkillLevel).map((v) => ({
  value: v,
  label: titleCase(v),
}));
