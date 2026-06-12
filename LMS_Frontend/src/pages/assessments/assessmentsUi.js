import { AssessmentType, QuestionType } from '@lms/shared';

export function assessmentLabel(a) {
  if (a.type === AssessmentType.FINAL) return 'Final Assessment';
  return `Practice Test ${a.practiceIndex ?? ''}`.trim();
}

export const QUESTION_TYPE_LABEL = {
  [QuestionType.MCQ]: 'Multiple Choice',
  [QuestionType.SCENARIO]: 'Scenario',
  [QuestionType.PROMPT_WRITING]: 'Prompt Writing',
  [QuestionType.CODING]: 'Coding',
};

export const QUESTION_TYPE_OPTIONS = Object.values(QuestionType).map((v) => ({
  value: v,
  label: QUESTION_TYPE_LABEL[v],
}));

/** Only MCQ is auto-graded today; others await the AI evaluation engine. */
export function isAutoGraded(type) {
  return type === QuestionType.MCQ;
}

export function submissionBadge(sub) {
  if (!sub) return { tone: 'neutral', label: 'Not started' };
  if (sub.status === 'graded') {
    return sub.passed
      ? { tone: 'success', label: `Passed · ${sub.score}%` }
      : { tone: 'error', label: `Failed · ${sub.score}%` };
  }
  if (sub.status === 'submitted') return { tone: 'warning', label: 'Submitted · pending review' };
  return { tone: 'neutral', label: 'In progress' };
}
