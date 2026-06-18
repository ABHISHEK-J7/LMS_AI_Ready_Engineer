import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, FolderOpen } from 'lucide-react';
import { AssessmentAvailability, AssessmentType, ProctoringMode, UserRole } from '@/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Select, SkeletonCards, SkeletonTable } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAssessments, useCreateAssessment, useDeleteAssessment, useSetAvailability } from '@/lib/assessments';
import { useModules } from '@/lib/modules';
import { assessmentLabel, ASSESSMENT_TYPE_LABEL, ASSESSMENT_TYPE_TONE, PROCTORING_OPTIONS, submissionBadge } from './assessmentsUi';
import { combineDateTime } from './examWindow';
import '../modules/modules.css';

export function AssessmentsPage() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.STUDENT ? <StudentAssessments /> : <StaffAssessments />;
}

// ── Student ────────────────────────────────────────────────────────────────────

function StudentAssessments() {
  const navigate = useNavigate();
  const { data: items, isLoading, isError, error, refetch } = useAssessments();

  return (
    <>
      <PageHeader title="Assessments" subtitle="Unlocked by your trainer as you complete each section." />
      {isLoading && !items ? (
        <SkeletonCards count={4} height="9rem" />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : items && items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={26} />}
          title="No assessments are available yet"
          description="Your trainer unlocks practice tests after completing each syllabus section."
        />
      ) : (
        <div className="module-grid">
          {items?.map((a) => {
            const badge = submissionBadge(a.submission);
            const done = a.submission && a.submission.status !== 'not_started';
            return (
              <Card key={a.id} className="module-card">
                <div className="module-card__top">
                  <div>
                    <div className="module-card__name">{assessmentLabel(a)}</div>
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {a.module?.name}
                    </div>
                  </div>
                  <Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge>
                </div>
                <div className="module-card__meta">
                  <Badge tone="neutral">{a.questionCount} questions</Badge>
                  <Badge tone="neutral">Pass ≥ {a.passingScore}%</Badge>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                {a.gated && (
                  <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                    🔒 {a.gateReason}
                  </p>
                )}
                <div className="list-actions">
                  {done ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/assessments/${a.id}`)}>
                      View result
                    </Button>
                  ) : a.availableNow ? (
                    <Button size="sm" onClick={() => navigate(`/app/assessments/${a.id}`)}>
                      Take assessment
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      {a.gated ? 'Locked' : 'Not available'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Trainer / Admin ─────────────────────────────────────────────────────────────

const BLANK = { title: '', type: AssessmentType.PRACTICE, practiceIndex: 1, prepIndex: 1, topic: '', passingScore: '', proctoring: ProctoringMode.NONE, examDate: '', windowStart: '', windowEnd: '', durationMinutes: '' };

/** Date + window start/end + duration for proctored (app/seb) tests. */
function ExamWindowFields({ form, setForm }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
      <strong style={{ fontSize: 'var(--font-size-sm)' }}>Exam window &amp; duration</strong>
      <Input label="Test date" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Input label="Window opens" type="time" value={form.windowStart} onChange={(e) => setForm({ ...form, windowStart: e.target.value })} />
        <Input label="Window closes" type="time" value={form.windowEnd} onChange={(e) => setForm({ ...form, windowEnd: e.target.value })} />
      </div>
      <Input label="Duration (minutes per student)" type="number" min="1" max="600" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="e.g. 60" />
      {form.proctoring === ProctoringMode.SEB && (
        <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
          Set the global SEB Config Key in Settings, and make sure students launch via the .seb config.
        </span>
      )}
      <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
        Students get the duration once they start, but must finish before the window closes (late joiners get the remaining window time).
      </span>
    </div>
  );
}

function StaffAssessments() {
  const navigate = useNavigate();
  const { data: modules } = useModules();
  const [moduleId, setModuleId] = useState('');
  const { data: assessments, isLoading, isError, error, refetch } = useAssessments(moduleId ? { module: moduleId } : {});
  const moduleObj = (modules ?? []).find((m) => m.id === moduleId);
  const topics = moduleObj?.topics ?? [];

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState('');
  const create = useCreateAssessment();
  const setAvailability = useSetAvailability();
  const del = useDeleteAssessment();

  async function submitCreate(e) {
    e.preventDefault();
    setErr('');
    try {
      const body = {
        title: form.title,
        module: moduleId,
        type: form.type,
        ...(form.type === AssessmentType.PRACTICE
          ? { practiceIndex: Number(form.practiceIndex), ...(form.topic ? { topic: form.topic } : {}) }
          : {}),
        ...(form.type === AssessmentType.PREPARATION ? { prepIndex: Number(form.prepIndex) } : {}),
        ...(form.passingScore ? { passingScore: Number(form.passingScore) } : {}),
        proctoring: form.proctoring,
      };
      if (form.proctoring !== ProctoringMode.NONE) {
        const availableFrom = combineDateTime(form.examDate, form.windowStart);
        const deadline = combineDateTime(form.examDate, form.windowEnd);
        if (availableFrom) body.availableFrom = availableFrom;
        if (deadline) body.deadline = deadline;
        if (form.durationMinutes) body.durationMinutes = Number(form.durationMinutes);
      }
      const created = await create.mutateAsync(body);
      setCreating(false);
      setForm(BLANK);
      navigate(`/app/assessments/${created.id}`);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <>
      <PageHeader title="Assessments" subtitle="Author practice tests & finals, then unlock them for students." />

      <div className="toolbar">
        <div style={{ flex: '1 1 16rem', minWidth: 0, maxWidth: '22rem' }}>
          <Select
            value={moduleId}
            onChange={(e) => setModuleId(e.target.value)}
            options={[
              { value: '', label: 'Select a module…' },
              ...(modules ?? []).map((m) => ({ value: m.id, label: `${m.name} (${m.code})` })),
            ]}
          />
        </div>
        {moduleId && <Button onClick={() => setCreating(true)}>+ New Assessment</Button>}
      </div>

      {!moduleId ? (
        <EmptyState
          icon={<FolderOpen size={26} />}
          title="Choose a module to manage its assessments"
        />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !assessments ? (
        <Card><SkeletonTable rows={5} cols={5} /></Card>
      ) : assessments && assessments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={26} />}
          title="No assessments yet for this module"
          description="Create the first practice test."
          action={<Button onClick={() => setCreating(true)}>+ New Assessment</Button>}
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Assessment</th><th>Questions</th><th>Pass</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {assessments?.map((a) => {
                const unlocked = a.availability === AssessmentAvailability.UNLOCKED;
                return (
                  <tr key={a.id}>
                    <td>{assessmentLabel(a)}<div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{a.title}</div></td>
                    <td>{a.questions.length}</td>
                    <td>{a.passingScore}%</td>
                    <td><Badge tone={unlocked ? 'success' : 'neutral'}>{unlocked ? 'Unlocked' : 'Locked'}</Badge></td>
                    <td>
                      <div className="list-actions">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/app/assessments/${a.id}`)}>Manage</Button>
                        <Button
                          size="sm"
                          variant={unlocked ? 'ghost' : 'primary'}
                          loading={setAvailability.isPending}
                          disabled={!unlocked && a.questions.length === 0}
                          title={!unlocked && a.questions.length === 0 ? 'Add questions before unlocking' : ''}
                          onClick={() => setAvailability.mutate({ id: a.id, unlock: !unlocked })}
                        >
                          {unlocked ? 'Lock' : 'Unlock'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.confirm('Delete this assessment?') && del.mutate(a.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={creating}
        title="New Assessment"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button form="create-assessment-form" type="submit" loading={create.isPending}>Create</Button>
          </>
        }
      >
        <form id="create-assessment-form" onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Prompt Patterns — Practice Test 1" required />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: AssessmentType.PRACTICE, label: 'Practice Test' },
              { value: AssessmentType.PREPARATION, label: 'Preparation Test (mandatory before final)' },
              { value: AssessmentType.FINAL, label: 'Final Assessment' },
            ]}
          />
          {form.type === AssessmentType.PRACTICE && (
            <>
              <Select
                label="Practice test number"
                value={String(form.practiceIndex)}
                onChange={(e) => setForm({ ...form, practiceIndex: e.target.value })}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Practice Test ${n}` }))}
              />
              <Select
                label="Topic (optional — leave blank for whole module)"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                options={[{ value: '', label: 'Whole module' }, ...topics.map((t) => ({ value: t.id, label: t.title }))]}
              />
            </>
          )}
          {form.type === AssessmentType.PREPARATION && (
            <Select
              label="Preparation test number"
              value={String(form.prepIndex)}
              onChange={(e) => setForm({ ...form, prepIndex: e.target.value })}
              options={[1, 2].map((n) => ({ value: String(n), label: `Preparation Test ${n}` }))}
            />
          )}
          <Select
            label="Proctoring mode"
            value={form.proctoring}
            onChange={(e) => setForm({ ...form, proctoring: e.target.value })}
            options={PROCTORING_OPTIONS}
          />
          {form.proctoring !== ProctoringMode.NONE && (
            <ExamWindowFields form={form} setForm={setForm} />
          )}
          <p className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
            After creating, add questions from the module's question bank.
            {form.proctoring !== ProctoringMode.NONE ? ' You can also change the mode/window later from Manage.' : ''}
          </p>
          <Input label="Passing score % (optional)" type="number" min="0" max="100" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} placeholder="Defaults to platform setting (70)" />
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}
