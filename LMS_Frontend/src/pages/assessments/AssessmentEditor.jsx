import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Plus, UploadCloud, X } from 'lucide-react';
import { AssessmentAvailability, QuestionType } from '@lms/shared';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  FullPageSpinner,
  Input,
  Modal,
  Select,
} from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import {
  useAddQuestion,
  useAssessment,
  useDeleteQuestion,
  useSetAvailability,
  useSubmissions,
  useUpdateQuestion,
} from '@/lib/assessments';
import { assessmentLabel, QUESTION_TYPE_LABEL, QUESTION_TYPE_OPTIONS } from './assessmentsUi';
import { BulkImportQuestions } from './BulkImportQuestions';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

export function AssessmentEditor() {
  const { id } = useParams();
  const { data: a, isLoading, isError, error } = useAssessment(id);
  const setAvailability = useSetAvailability();
  const [qModal, setQModal] = useState({ open: false, question: null });
  const [bulkOpen, setBulkOpen] = useState(false);

  if (isLoading) return <FullPageSpinner />;
  if (isError || !a) {
    return (
      <Card>
        <p className="field__error">{apiErrorMessage(error) || 'Assessment not found'}</p>
        <Link to="/app/assessments">← Back</Link>
      </Card>
    );
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
        <Badge tone="neutral">Pass ≥ {a.passingScore}%</Badge>
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

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div className="panel-head">
          <CardHeader title={`Questions (${a.questions.length})`} subtitle="MCQ questions are auto-graded. Other types await the AI evaluation engine." />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <UploadCloud size={15} style={{ marginRight: 6 }} /> Bulk import
            </Button>
            <Button onClick={() => setQModal({ open: true, question: null })}>
              <Plus size={15} style={{ marginRight: 6 }} /> Add question
            </Button>
          </div>
        </div>

        {a.questions.length === 0 ? (
          <p className="lms-muted" style={{ marginTop: 'var(--space-3)' }}>No questions yet. Add one, or bulk-import from Excel.</p>
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
                <Button size="sm" variant="ghost" onClick={() => setQModal({ open: true, question: q })}>Edit</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SubmissionsCard id={a.id} />

      <QuestionModal
        open={qModal.open}
        assessmentId={a.id}
        question={qModal.question}
        onClose={() => setQModal({ open: false, question: null })}
      />

      <Modal open={bulkOpen} title="Bulk import questions" onClose={() => setBulkOpen(false)}>
        <BulkImportQuestions assessmentId={a.id} onClose={() => setBulkOpen(false)} />
      </Modal>
    </>
  );
}

function SubmissionsCard({ id }) {
  const { data: subs, isLoading } = useSubmissions(id);
  return (
    <Card>
      <CardHeader title="Submissions" subtitle="Student attempts and scores" />
      {isLoading ? (
        <FullPageSpinner />
      ) : !subs || subs.length === 0 ? (
        <p className="lms-muted">No submissions yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Score</th><th>Result</th><th>Submitted</th></tr></thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{s.student?.name}<div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{s.student?.email}</div></td>
                  <td>{s.score ?? '—'}%</td>
                  <td>
                    {s.status === 'graded' ? (
                      <Badge tone={s.passed ? 'success' : 'error'}>{s.passed ? 'Passed' : 'Failed'}</Badge>
                    ) : s.status === 'evaluating' ? (
                      <Badge tone="primary">Evaluating</Badge>
                    ) : (
                      <Badge tone="warning">Pending review</Badge>
                    )}
                  </td>
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

const BLANK_Q = { type: QuestionType.MCQ, prompt: '', options: ['', ''], correctOption: 0, points: 1 };

function QuestionModal({ open, assessmentId, question, onClose }) {
  const isEdit = Boolean(question);
  const [form, setForm] = useState(BLANK_Q);
  const [err, setErr] = useState('');
  const add = useAddQuestion();
  const update = useUpdateQuestion();
  const del = useDeleteQuestion();

  useEffect(() => {
    if (!open) return;
    setErr('');
    setForm(
      question
        ? {
            type: question.type,
            prompt: question.prompt,
            options: question.options?.length ? [...question.options] : ['', ''],
            correctOption: question.correctOption ?? 0,
            points: question.points ?? 1,
          }
        : BLANK_Q,
    );
  }, [open, question]);

  const isMcq = form.type === QuestionType.MCQ;

  function setOption(i, v) {
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => (idx === i ? v : o)) }));
  }
  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, ''] }));
  }
  function removeOption(i) {
    setForm((f) => {
      const options = f.options.filter((_, idx) => idx !== i);
      return { ...f, options, correctOption: Math.min(f.correctOption, options.length - 1) };
    });
  }

  async function save(e) {
    e.preventDefault();
    setErr('');
    const payload = {
      type: form.type,
      prompt: form.prompt,
      points: Number(form.points) || 1,
      ...(isMcq
        ? { options: form.options.map((o) => o.trim()).filter(Boolean), correctOption: form.correctOption }
        : {}),
    };
    try {
      if (isEdit) await update.mutateAsync({ id: assessmentId, questionId: question.id, ...payload });
      else await add.mutateAsync({ id: assessmentId, ...payload });
      onClose();
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Question' : 'Add Question'}
      onClose={onClose}
      footer={
        <>
          {isEdit && (
            <Button
              variant="ghost"
              onClick={() => window.confirm('Delete this question?') && del.mutateAsync({ id: assessmentId, questionId: question.id }).then(onClose)}
              style={{ marginRight: 'auto' }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button form="question-form" type="submit" loading={add.isPending || update.isPending}>Save</Button>
        </>
      }
    >
      <form id="question-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={QUESTION_TYPE_OPTIONS} />
        <Input label="Question prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} required />

        {isMcq && (
          <div className="field">
            <label className="field__label">Options (select the correct answer)</label>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <input type="radio" name="correct" checked={form.correctOption === i} onChange={() => setForm({ ...form, correctOption: i })} />
                <input className="input" value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                {form.options.length > 2 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeOption(i)}><X size={15} /></Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addOption}>+ Option</Button>
          </div>
        )}

        <Input label="Points" type="number" min="1" max="100" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
        {!isMcq && <p className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Non-MCQ questions are graded by the AI evaluation engine (coming soon).</p>}
        {err && <span className="field__error">{err}</span>}
      </form>
    </Modal>
  );
}
