import { createEvaluator } from '@lms/ai-engine';
import { QuestionType, SubmissionStatus } from '@lms/shared';
import { Assessment, Submission, getStoredAiApiKey } from '../models/index.js';
import { env } from '../config/env.js';

let _evaluator = null;
let _evaluatorKey = null; // the key the cached evaluator was built with

/** The active Claude key — env var takes precedence over the admin-stored key. */
async function resolveApiKey() {
  return env.anthropicApiKey || (await getStoredAiApiKey());
}

/**
 * Build (or reuse) the Claude-backed evaluator from the active key. Returns null
 * if no key is configured. Rebuilds automatically when the admin changes the key.
 */
export async function getEvaluator() {
  const key = await resolveApiKey();
  if (!key) {
    _evaluator = null;
    _evaluatorKey = null;
    return null;
  }
  if (key !== _evaluatorKey) {
    _evaluator = createEvaluator({ apiKey: key, githubToken: env.githubToken });
    _evaluatorKey = key;
  }
  return _evaluator;
}

/** Source of the active key, for admin diagnostics (never returns the key itself). */
export async function aiKeySource() {
  if (env.anthropicApiKey) return 'environment';
  if (await getStoredAiApiKey()) return 'settings';
  return 'none';
}

/** True when at least one question needs AI grading (prompt/scenario/coding). */
export function needsAiGrading(assessment) {
  return assessment.questions.some((q) => q.type !== QuestionType.MCQ);
}

/**
 * Grade a submission across all question types and persist the result.
 * MCQ is graded deterministically; prompt/scenario/coding via the evaluator.
 * Final score is points-weighted across every question. Mutates + saves the doc.
 *
 * @param assessment  Assessment document
 * @param submission  Submission document (will be saved)
 * @param evaluator   AI evaluator — omit to use the configured one; inject for tests.
 *                    Pass `null` explicitly to force MCQ-only grading.
 */
export async function gradeSubmission(assessment, submission, evaluator = undefined) {
  if (evaluator === undefined) evaluator = await getEvaluator();
  const answers = new Map(submission.answers.map((a) => [a.question.toString(), a]));
  let totalPoints = 0;
  let earnedPoints = 0;
  const perQuestion = {};
  const summaries = [];
  const suggestions = [];

  for (const q of assessment.questions) {
    const points = q.points || 1;
    totalPoints += points;
    const answer = answers.get(q._id.toString());
    let fraction = 0; // 0..1 of this question's points

    if (q.type === QuestionType.MCQ) {
      fraction = answer && answer.selectedOption === q.correctOption ? 1 : 0;
    } else if (!answer || !answer.text || !answer.text.trim()) {
      fraction = 0;
      summaries.push(`Q (${q.type}): no answer submitted.`);
    } else if (!evaluator) {
      // No evaluator available — leave for manual review (handled by caller).
      throw new Error('AI evaluator not configured');
    } else {
      try {
        const result =
          q.type === QuestionType.CODING
            ? await evaluator.evaluateProject({
                repoUrl: answer.text.trim(),
                requirements: q.prompt,
                passingScore: assessment.passingScore,
              })
            : await evaluator.evaluatePrompt({
                task: q.prompt,
                prompt: answer.text,
                passingScore: assessment.passingScore,
              });
        fraction = (Number(result.score) || 0) / 100;
        if (result.summary) summaries.push(result.summary);
        if (Array.isArray(result.suggestions)) suggestions.push(...result.suggestions);
      } catch (err) {
        fraction = 0;
        summaries.push(`Could not evaluate one ${q.type} question: ${err.message}`);
      }
    }

    perQuestion[`Q${q._id.toString().slice(-4)}`] = Math.round(fraction * 100);
    earnedPoints += fraction * points;
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= assessment.passingScore;

  submission.score = score;
  submission.passed = passed;
  submission.status = SubmissionStatus.GRADED;
  submission.feedback = {
    score,
    passed,
    summary: summaries.join(' ') || 'Graded.',
    suggestions: suggestions.slice(0, 12),
    breakdown: perQuestion,
  };
  await submission.save();
  return submission;
}

/**
 * Background grading entry point used by the submit handler. Loads the docs,
 * grades, and on failure flips the submission back to SUBMITTED (pending review)
 * so it isn't stuck in EVALUATING forever. Never throws.
 */
export async function gradeInBackground(assessmentId, submissionId) {
  try {
    const [assessment, submission] = await Promise.all([
      Assessment.findById(assessmentId),
      Submission.findById(submissionId),
    ]);
    if (!assessment || !submission) return;
    await gradeSubmission(assessment, submission);
    // A passed final may complete a module → issue any earned certificates.
    const { issueEligibleCertificates } = await import('./certificates.js');
    await issueEligibleCertificates(submission.student).catch(() => {});
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[aiGrading] background grading failed:', err.message);
    await Submission.findByIdAndUpdate(submissionId, {
      status: SubmissionStatus.SUBMITTED,
    }).catch(() => {});
  }
}
