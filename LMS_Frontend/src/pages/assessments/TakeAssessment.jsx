import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Check, CheckCircle2, Github, Lock, ShieldAlert, Trophy, X } from 'lucide-react';
import { QuestionType } from '@/shared';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, SkeletonText, Spinner, Textarea, useConfirm } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { assessmentKeys, useAssessment, useLeaderboard, useMySubmission, useSubmitAssessment } from '@/lib/assessments';
import { assessmentLabel, isGithubRepoUrl, QUESTION_TYPE_HINT } from './assessmentsUi';
import { ProctoredFlow } from './ProctoredExam';
import '../modules/modules.css';
import './exam.css';

const DONE = ['submitted', 'evaluating', 'graded'];

export function TakeAssessment() {
  const { id } = useParams();
  const { data: a, isLoading, isError, error, refetch } = useAssessment(id);
  const { data: submission, isLoading: subLoading } = useMySubmission(id);

  if ((isLoading || subLoading) && !a) {
    return (
      <>
        <PageHeader
          title={<Skeleton width="16rem" height="1.75rem" />}
          subtitle={<Link to="/app/assessments" className="lms-muted">← All assessments</Link>}
        />
        <Card>
          <SkeletonText lines={4} />
        </Card>
      </>
    );
  }
  if (isError || !a) {
    return <ErrorState message={apiErrorMessage(error) || 'This assessment is not available.'} onRetry={refetch} />;
  }

  const done = submission && DONE.includes(submission.status);
  if (a.proctored) {
    return done ? <Result a={a} submission={submission} /> : <ProctoredFlow a={a} />;
  }
  const submitted = submission && submission.status !== 'not_started';
  return submitted ? <Result a={a} submission={submission} /> : <Quiz a={a} />;
}

function Result({ a, submission }) {
  const header = (
    <PageHeader title={assessmentLabel(a)} subtitle={<Link to="/app/assessments" className="lms-muted">← All assessments</Link>} />
  );

  if (submission.status === 'evaluating') {
    return (
      <>
        {header}
        <Card style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)' }}>
            <Spinner size={32} />
          </div>
          <h2>Evaluating…</h2>
          <p className="lms-muted" style={{ marginTop: 'var(--space-2)' }}>
            The AI evaluation engine is grading your submission. This page will update automatically.
          </p>
        </Card>
      </>
    );
  }

  if (submission.status === 'submitted') {
    return (
      <>
        {header}
        <Card style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Submitted <CheckCircle2 size={22} style={{ color: 'var(--color-success)' }} />
          </h2>
          <p className="lms-muted" style={{ marginTop: 'var(--space-2)' }}>
            Your response is awaiting evaluation by your trainer.
          </p>
        </Card>
      </>
    );
  }

  if (submission.disqualified) {
    return (
      <>
        {header}
        <Card style={{ textAlign: 'center', padding: 'var(--space-10)', borderColor: 'var(--color-error)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
            <ShieldAlert size={44} style={{ color: 'var(--color-error)' }} />
          </div>
          <h2 style={{ margin: 0 }}>Disqualified</h2>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Badge tone="error">Caught cheating · 0%</Badge>
          </div>
          <p className="lms-muted" style={{ marginTop: 'var(--space-4)' }}>
            {submission.disqualifiedReason || 'You left the exam.'} The test was stopped automatically. Contact your
            trainer if you believe this was a mistake.
          </p>
        </Card>
      </>
    );
  }

  const passed = submission.passed;
  const fb = submission.feedback;
  return (
    <>
      {header}
      <div className="result-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Card style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-bold)', color: passed ? 'var(--color-success)' : 'var(--color-error)' }}>
              {submission.score}%
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Badge tone={passed ? 'success' : 'error'}>
                {passed ? 'Passed' : 'Did not pass'} · need {a.passingScore}%
              </Badge>
            </div>
            <p className="lms-muted" style={{ marginTop: 'var(--space-4)' }}>
              {passed ? 'Great work — this section is complete.' : 'Review the material and ask your trainer about a re-attempt.'}
            </p>
          </Card>

          {a.answersLockedUntil
            ? <LockedAnswersCard a={a} />
            : a.questions?.length > 0 && <ReviewCard a={a} submission={submission} />}

          {fb && (fb.summary || (fb.suggestions && fb.suggestions.length > 0)) && (
            <Card>
              <CardHeader title="AI Feedback" />
              {fb.summary && <p className="lms-secondary-text">{fb.summary}</p>}
              {fb.breakdown && Object.keys(fb.breakdown).length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', margin: 'var(--space-4) 0' }}>
                  {Object.entries(fb.breakdown).map(([k, v]) => (
                    <Badge key={k} tone="neutral">{k}: {v}</Badge>
                  ))}
                </div>
              )}
              {fb.suggestions && fb.suggestions.length > 0 && (
                <>
                  <div className="lms-secondary-text" style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-2)' }}>
                    Suggestions
                  </div>
                  <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {fb.suggestions.map((s, i) => (
                      <li key={i} className="lms-secondary-text">{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}
        </div>

        <Leaderboard id={a.id} />
      </div>
    </>
  );
}

const fmtLeft = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};

/** Holds the answer review until the exam window closes (anti-leak), with a live
 *  countdown; auto-refetches the assessment when the window ends so answers appear. */
function LockedAnswersCard({ a }) {
  const qc = useQueryClient();
  const [left, setLeft] = useState(() => new Date(a.answersLockedUntil).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const ms = new Date(a.answersLockedUntil).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(t);
        qc.invalidateQueries({ queryKey: assessmentKeys.detail(a.id) });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [a.answersLockedUntil, a.id, qc]);

  return (
    <Card style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
        <Lock size={32} style={{ color: 'var(--color-primary)' }} />
      </div>
      <h3 style={{ margin: 0 }}>Answers locked</h3>
      <p className="lms-muted" style={{ marginTop: 'var(--space-2)' }}>
        Your score is recorded. The questions and correct answers unlock when the exam window closes — so no one can
        share them while others are still taking the test.
      </p>
      <div className="exam-timer" style={{ marginTop: 'var(--space-3)' }}>
        <Lock size={16} /> {fmtLeft(left)}
      </div>
      <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>
        Unlocks at {new Date(a.answersLockedUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
    </Card>
  );
}

function ReviewCard({ a, submission }) {
  const map = {};
  (submission.answers ?? []).forEach((an) => { map[an.question] = an; });

  return (
    <Card>
      <CardHeader title="Your answers" subtitle="What you got right and wrong" />
      <div className="q-review">
        {a.questions.map((q, i) => {
          const ans = map[q.id];
          const picked = ans?.selectedOption;
          const isMcq = q.type === QuestionType.MCQ;
          const correct = isMcq && picked === q.correctOption;
          return (
            <div key={q.id} className="q-review__item">
              <div className="q-review__head">
                <span className="q-review__num">{i + 1}</span>
                <span style={{ flex: 1 }}>{q.prompt}</span>
                {isMcq && (
                  <Badge tone={correct ? 'success' : picked === undefined ? 'neutral' : 'error'}>
                    {correct ? 'Correct' : picked === undefined ? 'Skipped' : 'Wrong'}
                  </Badge>
                )}
              </div>
              {isMcq ? (
                <ul className="q-review__opts">
                  {q.options?.map((opt, oi) => {
                    const isCorrect = oi === q.correctOption;
                    const isPicked = oi === picked;
                    return (
                      <li key={oi} className={isCorrect ? 'is-correct' : isPicked ? 'is-wrong' : ''}>
                        <span>{opt}</span>
                        {isCorrect && <Check size={14} strokeWidth={3} />}
                        {isPicked && !isCorrect && <X size={14} strokeWidth={3} />}
                        {isPicked && <span className="q-review__you">your answer</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="q-review__text">
                  <strong>Your answer:</strong> {ans?.text ? ans.text : <em className="lms-muted">Not answered</em>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Leaderboard({ id }) {
  const { data, isLoading } = useLeaderboard(id);
  const entries = data?.entries ?? [];

  return (
    <Card>
      <CardHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={17} style={{ color: 'var(--color-primary)' }} /> Batch Leaderboard
          </span>
        }
        subtitle={isLoading ? 'Loading…' : `${data?.participants ?? 0} participant${(data?.participants ?? 0) === 1 ? '' : 's'} in your batch`}
      />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}><Spinner /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={<Trophy size={26} />} title="No results yet" description="No graded results in your batch yet." />
      ) : (
        <div className="lb-list">
          {entries.slice(0, 10).map((e) => (
            <div className={`lb-row${e.isMe ? ' lb-row--me' : ''}`} key={e.rank}>
              <span className={`lb-rank lb-rank--${e.rank <= 3 ? e.rank : 'n'}`}>{e.rank}</span>
              <span className="lb-name">{e.name}{e.isMe ? ' (you)' : ''}</span>
              <span className="lb-score" style={{ color: e.passed ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{e.score}%</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Repo Evaluation answer input: a single-line GitHub URL field with live validity. */
export function RepoInput({ value, onChange }) {
  const trimmed = (value ?? '').trim();
  const valid = isGithubRepoUrl(trimmed);
  return (
    <div>
      <div className={`repo-input${trimmed && !valid ? ' repo-input--invalid' : ''}`}>
        <Github size={16} className="repo-input__icon" />
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://github.com/you/project"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
        {trimmed && (valid ? <Check size={15} className="repo-input__ok" /> : <X size={15} className="repo-input__bad" />)}
      </div>
      <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 4 }}>
        {trimmed && !valid
          ? 'Enter a public GitHub repo URL like https://github.com/you/project'
          : 'Paste the link to your public GitHub repository — the AI reviews its code.'}
      </div>
    </div>
  );
}

function Quiz({ a }) {
  const confirm = useConfirm();
  const [answers, setAnswers] = useState({}); // questionId -> { selectedOption | text }
  const [err, setErr] = useState('');
  const submit = useSubmitAssessment();

  function setAnswer(qid, patch) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }

  const answeredCount = a.questions.filter((q) => {
    const ans = answers[q.id];
    return ans && (ans.selectedOption !== undefined || (ans.text && ans.text.trim()));
  }).length;

  async function onSubmit() {
    setErr('');
    // Repo Evaluation answers must be a valid GitHub URL, or the AI grader can't clone them.
    const badRepo = a.questions.find((q) => {
      const t = answers[q.id]?.text?.trim();
      return q.type === QuestionType.CODING && t && !isGithubRepoUrl(t);
    });
    if (badRepo) {
      setErr('One Repo Evaluation answer is not a valid GitHub URL (https://github.com/you/project). Fix it before submitting.');
      return;
    }
    if (answeredCount < a.questions.length) {
      const ok = await confirm({
        title: 'Submit incomplete attempt?',
        message: `You've answered ${answeredCount}/${a.questions.length}. Submit anyway?`,
        confirmLabel: 'Submit',
      });
      if (!ok) return;
    }
    const payload = a.questions
      .map((q) => {
        const ans = answers[q.id];
        if (!ans) return null;
        return q.type === QuestionType.MCQ
          ? { question: q.id, selectedOption: ans.selectedOption }
          : { question: q.id, text: ans.text };
      })
      .filter((x) => x && (x.selectedOption !== undefined || x.text));
    if (payload.length === 0) {
      setErr('Answer at least one question before submitting.');
      return;
    }
    try {
      await submit.mutateAsync({ id: a.id, answers: payload });
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title={assessmentLabel(a)} subtitle={`${a.module?.name} · pass ≥ ${a.passingScore}%`} />

      {a.questions.map((q, i) => (
        <Card key={q.id} style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--space-3)' }}>
            {i + 1}. {q.prompt}
          </div>
          {q.type === QuestionType.MCQ ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {q.options?.map((opt, oi) => (
                <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id]?.selectedOption === oi}
                    onChange={() => setAnswer(q.id, { selectedOption: oi })}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : q.type === QuestionType.CODING ? (
            <RepoInput value={answers[q.id]?.text ?? ''} onChange={(v) => setAnswer(q.id, { text: v })} />
          ) : (
            <Textarea
              placeholder={QUESTION_TYPE_HINT[q.type] || 'Type your answer…'}
              value={answers[q.id]?.text ?? ''}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })}
            />
          )}
        </Card>
      ))}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <span className="lms-secondary-text">{answeredCount} / {a.questions.length} answered</span>
          <Button onClick={onSubmit} loading={submit.isPending}>Submit assessment</Button>
        </div>
        {err && <span className="field__error" style={{ display: 'block', marginTop: 'var(--space-2)' }}>{err}</span>}
      </Card>
    </>
  );
}
