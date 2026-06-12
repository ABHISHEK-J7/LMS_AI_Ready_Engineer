import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Trophy } from 'lucide-react';
import { QuestionType } from '@lms/shared';
import { Badge, Button, Card, CardHeader, FullPageSpinner, Spinner, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAssessment, useLeaderboard, useMySubmission, useSubmitAssessment } from '@/lib/assessments';
import { assessmentLabel } from './assessmentsUi';
import '../modules/modules.css';

export function TakeAssessment() {
  const { id } = useParams();
  const { data: a, isLoading, isError, error } = useAssessment(id);
  const { data: submission, isLoading: subLoading } = useMySubmission(id);

  if (isLoading || subLoading) return <FullPageSpinner />;
  if (isError || !a) {
    return (
      <Card>
        <p className="field__error">{apiErrorMessage(error) || 'This assessment is not available.'}</p>
        <Link to="/app/assessments">← Back to assessments</Link>
      </Card>
    );
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
        <p className="lms-muted">No graded results in your batch yet.</p>
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

function Quiz({ a }) {
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
    if (answeredCount < a.questions.length) {
      if (!window.confirm(`You've answered ${answeredCount}/${a.questions.length}. Submit anyway?`)) return;
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
          ) : (
            <Textarea
              placeholder={
                q.type === QuestionType.CODING
                  ? 'Paste your public GitHub repository URL (https://github.com/you/project)'
                  : 'Type your answer…'
              }
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
