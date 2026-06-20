import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Database, FileQuestion, Inbox, Trash2 } from 'lucide-react';
import { AssessmentAvailability, ProctoringMode, QuestionType } from '@/shared';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Modal, Select, Skeleton, SkeletonTable, SkeletonText, useConfirm } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage, fileSrc } from '@/lib/api';
import { useAssessment, useDeleteQuestion, useSetAvailability, useSubmissions, useUpdateAssessment } from '@/lib/assessments';
import {
  assessmentLabel,
  ASSESSMENT_TYPE_LABEL,
  ASSESSMENT_TYPE_TONE,
  PROCTORING_LABEL,
  PROCTORING_OPTIONS,
  PROCTORING_TONE,
  QUESTION_TYPE_LABEL,
} from './assessmentsUi';
import { combineDateTime, splitDateTime } from './examWindow';
import { BankPicker } from './BankPicker';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

export function AssessmentEditor() {
  const { id } = useParams();
  const confirm = useConfirm();
  const { data: a, isLoading, isError, error, refetch } = useAssessment(id);
  const setAvailability = useSetAvailability();
  const del = useDeleteQuestion();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isLoading && !a) {
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
    return <ErrorState message={apiErrorMessage(error) || 'Assessment not found'} onRetry={refetch} />;
  }

  const unlocked = a.availability === AssessmentAvailability.UNLOCKED;

  return (
    <>
      <PageHeader
        title={assessmentLabel(a)}
        subtitle={<Link to="/app/assessments" className="lms-muted">← All assessments</Link>}
      />

      <div className="module-card__meta" style={{ marginBottom: 'var(--space-6)' }}>
        <Badge tone="neutral">{a.module?.name}</Badge>
        <Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge>
        {a.topicTitle && <Badge tone="primary">{a.topicTitle}</Badge>}
        <Badge tone="neutral">Pass ≥ {a.passingScore}%</Badge>
        <Badge tone={PROCTORING_TONE[a.proctoring] ?? 'neutral'}>{PROCTORING_LABEL[a.proctoring] ?? 'No proctoring'}</Badge>
        <Badge tone={unlocked ? 'success' : 'neutral'}>{unlocked ? 'Unlocked' : 'Locked'}</Badge>
        <Button
          size="sm"
          variant={unlocked ? 'outline' : 'primary'}
          loading={setAvailability.isPending}
          disabled={!unlocked && a.questions.length === 0}
          title={!unlocked && a.questions.length === 0 ? 'Add questions before unlocking' : ''}
          onClick={() => setAvailability.mutate({ id: a.id, unlock: !unlocked })}
        >
          {unlocked ? 'Lock assessment' : 'Unlock for students'}
        </Button>
      </div>

      <ProctoringCard a={a} />

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div className="panel-head">
          <CardHeader
            title={`Questions (${a.questions.length})`}
            subtitle="Hand-picked from this module's question bank. MCQs are auto-graded."
          />
          <Button onClick={() => setPickerOpen(true)}>
            <Database size={15} style={{ marginRight: 6 }} /> Add from question bank
          </Button>
        </div>

        {a.questions.length === 0 ? (
          <EmptyState
            icon={<FileQuestion size={26} />}
            title="No questions yet"
            description="No questions yet. Add some from the question bank to build this test."
          />
        ) : (
          <div className="q-list">
            {a.questions.map((q, i) => (
              <div key={q.id} className="q-item">
                <span className="q-item__num">{i + 1}</span>
                <div className="q-item__body">
                  <div className="q-item__prompt">{q.prompt}</div>
                  <div className="q-item__meta">
                    <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                    <span className="lms-muted">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                  </div>
                  {q.type === QuestionType.MCQ && (
                    <ul className="q-item__options">
                      {q.options?.map((opt, oi) => (
                        <li key={oi} className={oi === q.correctOption ? 'is-correct' : ''}>
                          {opt} {oi === q.correctOption ? <Check size={14} strokeWidth={3} /> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Remove from this test"
                  onClick={async () => { if (await confirm({ title: 'Remove this question from the test?', tone: 'danger', confirmLabel: 'Remove' })) del.mutate({ id: a.id, questionId: q.id }); }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SubmissionsCard id={a.id} />

      <Modal open={pickerOpen} title="Add questions from the bank" size="lg" onClose={() => setPickerOpen(false)}>
        <BankPicker assessment={a} onClose={() => setPickerOpen(false)} />
      </Modal>
    </>
  );
}

function ProctoringCell({ s }) {
  const shots = s.proctorShots ?? [];
  const warnings = s.warnings ?? 0;
  if (!s.disqualified && warnings === 0 && shots.length === 0) return <span className="lms-muted">—</span>;
  const reasons = (s.warningLog ?? []).map((w) => w.reason).filter(Boolean).join('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {s.disqualified && (
        <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>
          ⚠ {s.disqualifiedReason || 'Left the exam'}
        </span>
      )}
      {warnings > 0 && (
        <span title={reasons} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 'var(--font-weight-semibold)' }}>
          ⚠ {warnings} warning{warnings === 1 ? '' : 's'}
        </span>
      )}
      {shots.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {shots.map((u, i) => (
            <a key={i} href={fileSrc(u)} target="_blank" rel="noreferrer" title="Open snapshot">
              <img src={fileSrc(u)} alt={`Snapshot ${i + 1}`} style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--color-border)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ProctoringCard({ a }) {
  const update = useUpdateAssessment();
  const init = splitDateTime(a.availableFrom);
  const end = splitDateTime(a.deadline);
  const [form, setForm] = useState({
    proctoring: a.proctoring ?? ProctoringMode.NONE,
    examDate: init.date || end.date,
    windowStart: init.time,
    windowEnd: end.time,
    durationMinutes: a.durationMinutes ?? '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const timed = form.proctoring !== ProctoringMode.NONE;

  async function save() {
    setErr('');
    setMsg('');
    const availableFrom = combineDateTime(form.examDate, form.windowStart);
    const deadline = combineDateTime(form.examDate, form.windowEnd);
    // Proctored (app/seb) tests must define a valid exam window + duration.
    if (timed) {
      if (!availableFrom || !deadline) {
        return setErr('Set the exam date and both window opens/closes times.');
      }
      if (new Date(deadline).getTime() <= new Date(availableFrom).getTime()) {
        return setErr('The window must close after it opens.');
      }
      if (!form.durationMinutes || Number(form.durationMinutes) <= 0) {
        return setErr('Set a duration (minutes) for proctored tests.');
      }
    }
    try {
      await update.mutateAsync({
        id: a.id,
        proctoring: form.proctoring,
        availableFrom: timed ? availableFrom ?? null : null,
        deadline: timed ? deadline ?? null : null,
        durationMinutes: timed && form.durationMinutes ? Number(form.durationMinutes) : null,
      });
      setMsg('Saved.');
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }

  return (
    <Card style={{ marginBottom: 'var(--space-6)' }}>
      <CardHeader title="Proctoring & exam window" subtitle="Choose how this test is invigilated. Built-in and SEB run a timed, full-screen exam." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        <div style={{ maxWidth: '24rem' }}>
          <Select label="Proctoring mode" value={form.proctoring} onChange={(e) => setForm({ ...form, proctoring: e.target.value })} options={PROCTORING_OPTIONS} />
        </div>
        {timed && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <Input label="Test date" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
            <Input label="Window opens" type="time" value={form.windowStart} onChange={(e) => setForm({ ...form, windowStart: e.target.value })} />
            <Input label="Window closes" type="time" value={form.windowEnd} onChange={(e) => setForm({ ...form, windowEnd: e.target.value })} />
            <Input label="Duration (min)" type="number" min="1" max="600" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} style={{ maxWidth: '8rem' }} />
          </div>
        )}
        {form.proctoring === ProctoringMode.SEB && (
          <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
            Set the global SEB Config Key in Settings and give students the .seb launch file.
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button onClick={save} loading={update.isPending}>Save proctoring</Button>
          {msg && <span className="lms-muted" style={{ color: 'var(--color-success)' }}>{msg}</span>}
        </div>
      </div>
      {err && <span className="field__error" style={{ display: 'block', marginTop: 'var(--space-2)' }}>{err}</span>}
    </Card>
  );
}

function SubmissionsCard({ id }) {
  const { data: subs, isLoading } = useSubmissions(id);
  return (
    <Card>
      <CardHeader title="Submissions" subtitle="Student attempts and scores" />
      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : !subs || subs.length === 0 ? (
        <EmptyState icon={<Inbox size={26} />} title="No submissions yet" description="No submissions yet." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Score</th><th>Result</th><th>Proctoring</th><th>Submitted</th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.student?.name}<div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{s.student?.email}</div></td>
                  <td>{s.score ?? '—'}%</td>
                  <td>
                    {s.disqualified ? (
                      <Badge tone="error">Disqualified</Badge>
                    ) : s.status === 'graded' ? (
                      <Badge tone={s.passed ? 'success' : 'error'}>{s.passed ? 'Passed' : 'Failed'}</Badge>
                    ) : s.status === 'evaluating' ? (
                      <Badge tone="primary">Evaluating</Badge>
                    ) : (
                      <Badge tone="warning">Pending review</Badge>
                    )}
                  </td>
                  <td><ProctoringCell s={s} /></td>
                  <td>{formatDate(s.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
