import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ClipboardList, FolderOpen, Layers, Plus, Send, Users } from 'lucide-react';
import { AssessmentAvailability, AssessmentType, ProctoringMode, UserRole } from '@/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Select, SkeletonCards, SkeletonTable, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAssessments, useAssignTemplate, useCreateAssessment, useDeleteAssessment, useSetAvailability } from '@/lib/assessments';
import { useModules } from '@/lib/modules';
import { useBatches } from '@/lib/batches';
import { assessmentLabel, ASSESSMENT_TYPE_LABEL, ASSESSMENT_TYPE_TONE, PROCTORING_LABEL, PROCTORING_OPTIONS, submissionBadge } from './assessmentsUi';
import { combineDateTime, validateExamWindow } from './examWindow';
import '../modules/modules.css';

/** Only two categories now: practice + final. */
const TYPE_OPTIONS = [
  { value: AssessmentType.PRACTICE, label: 'Practice Test (10 questions)' },
  { value: AssessmentType.FINAL, label: 'Final Test' },
];

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
      <PageHeader title="Assessments" subtitle="Assigned to you by your trainer." />
      {isLoading && !items ? (
        <SkeletonCards count={4} height="9rem" />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : items && items.length === 0 ? (
        <EmptyState icon={<ClipboardList size={26} />} title="No assessments yet" description="Your trainer assigns tests as you progress." />
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
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{a.module?.name}</div>
                  </div>
                  <Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge>
                </div>
                {a.description && (
                  <div className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)' }}>{a.description}</div>
                )}
                <div className="module-card__meta">
                  <Badge tone="neutral">{a.questionCount} questions</Badge>
                  <Badge tone="neutral">Pass ≥ {a.passingScore}%</Badge>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <div className="list-actions">
                  {done ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/app/assessments/${a.id}`)}>View result</Button>
                  ) : a.availableNow ? (
                    <Button size="sm" onClick={() => navigate(`/app/assessments/${a.id}`)}>Take assessment</Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>Not available</Button>
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

// ── Staff shell: module cards → admin authoring or trainer assigning ─────────────

function StaffAssessments() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;
  const { data: modules, isLoading: modulesLoading } = useModules();
  const [moduleId, setModuleId] = useState('');
  const moduleObj = (modules ?? []).find((m) => m.id === moduleId);

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle={isAdmin ? 'Create ready-made tests. Trainers assign them to their students.' : 'Assign ready-made tests to your students.'}
      />
      {!moduleId ? (
        modulesLoading && !modules ? (
          <SkeletonCards count={6} height="7.5rem" />
        ) : (modules ?? []).length === 0 ? (
          <EmptyState icon={<FolderOpen size={26} />} title="No modules yet" description="You'll see a card for each module." />
        ) : (
          <div className="module-grid">
            {(modules ?? []).map((m) => (
              <Card key={m.id} className="module-card module-card--clickable" onClick={() => setModuleId(m.id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModuleId(m.id); } }}>
                <div className="module-card__top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="module-card__icon"><Layers size={20} /></span>
                    <div>
                      <div className="module-card__name">{m.name}</div>
                      <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{m.code}</div>
                    </div>
                  </div>
                </div>
                <div className="module-card__meta">
                  <Badge tone="neutral">{m.topics?.length ?? 0} topics</Badge>
                  <Badge tone="primary">{isAdmin ? 'Ready-made tests →' : 'Assign tests →'}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : isAdmin ? (
        <AdminModuleTemplates moduleId={moduleId} moduleObj={moduleObj} onBack={() => setModuleId('')} />
      ) : (
        <TrainerModuleTests moduleId={moduleId} moduleObj={moduleObj} onBack={() => setModuleId('')} />
      )}
    </>
  );
}

function ModuleBar({ moduleObj, onBack, children }) {
  return (
    <div className="toolbar">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={16} /> All modules</Button>
      <strong style={{ fontSize: 'var(--font-size-lg)' }}>{moduleObj?.name}</strong>
      <span style={{ marginLeft: 'auto' }} />
      {children}
    </div>
  );
}

// ── Admin: author ready-made test templates ─────────────────────────────────────

const BLANK_TEMPLATE = { title: '', description: '', type: AssessmentType.PRACTICE, proctoring: ProctoringMode.NONE, durationMinutes: '', passingScore: '' };

function AdminModuleTemplates({ moduleId, moduleObj, onBack }) {
  const navigate = useNavigate();
  const { data: templates, isLoading, isError, error, refetch } = useAssessments({ template: 'true', module: moduleId });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK_TEMPLATE);
  const [err, setErr] = useState('');
  const create = useCreateAssessment();
  const del = useDeleteAssessment();
  const confirm = useConfirm();
  const timed = form.proctoring !== ProctoringMode.NONE;

  async function submitCreate(e) {
    e.preventDefault();
    setErr('');
    if (timed && (!form.durationMinutes || Number(form.durationMinutes) <= 0)) {
      return setErr('Set a duration (minutes) for a proctored test.');
    }
    try {
      const created = await create.mutateAsync({
        title: form.title,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        module: moduleId,
        type: form.type,
        proctoring: form.proctoring,
        ...(timed && form.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
        ...(form.passingScore ? { passingScore: Number(form.passingScore) } : {}),
      });
      setCreating(false);
      setForm(BLANK_TEMPLATE);
      navigate(`/app/assessments/${created.id}`);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  async function onDelete(id) {
    if (await confirm({ title: 'Delete this ready-made test?', message: 'Trainers will no longer be able to assign it. Already-assigned copies are unaffected.', confirmLabel: 'Delete', tone: 'danger' })) {
      del.mutate(id);
    }
  }

  return (
    <>
      <ModuleBar moduleObj={moduleObj} onBack={onBack}>
        <Button onClick={() => setCreating(true)}><Plus size={15} style={{ marginRight: 6 }} /> New ready-made test</Button>
      </ModuleBar>

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !templates ? (
        <Card><SkeletonTable rows={4} cols={4} /></Card>
      ) : templates && templates.length === 0 ? (
        <EmptyState icon={<ClipboardList size={26} />} title="No ready-made tests yet" description="Create a practice or final test for this module." action={<Button onClick={() => setCreating(true)}><Plus size={15} style={{ marginRight: 6 }} /> New ready-made test</Button>} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Test</th><th>Type</th><th>Questions</th><th>Duration</th><th /></tr></thead>
            <tbody>
              {templates?.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.title}
                    {a.description && <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '26rem' }}>{a.description}</div>}
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{PROCTORING_LABEL[a.proctoring] ?? 'No proctoring'}</div>
                  </td>
                  <td><Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></td>
                  <td>
                    {a.questions.length}
                    {a.type === AssessmentType.PRACTICE && <span className="lms-muted"> / 10</span>}
                  </td>
                  <td>{a.durationMinutes ? `${a.durationMinutes} min` : '—'}</td>
                  <td>
                    <div className="list-actions">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/app/assessments/${a.id}`)}>Manage</Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} title="New ready-made test" onClose={() => setCreating(false)}
        footer={<><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button form="tmpl-form" type="submit" loading={create.isPending}>Create</Button></>}>
        <form id="tmpl-form" onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Test name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Prompt Patterns — Practice Test" required />
          <div className="field">
            <label className="field__label">Description <span className="lms-muted">— topics this test covers</span></label>
            <textarea
              className="input"
              style={{ minHeight: '5rem', resize: 'vertical' }}
              placeholder="e.g. Covers Prompt Patterns, Chain of Thought, and Structured Outputs."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TYPE_OPTIONS} />
          <Select label="Proctoring / format" value={form.proctoring} onChange={(e) => setForm({ ...form, proctoring: e.target.value })} options={PROCTORING_OPTIONS} />
          {timed && (
            <Input label="Duration (minutes per student)" type="number" min="1" max="600" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="e.g. 30" />
          )}
          <Input label="Passing score % (optional)" type="number" min="0" max="100" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} placeholder="Defaults to platform setting (70)" />
          <p className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
            After creating, add the questions from this module's question bank{form.type === AssessmentType.PRACTICE ? ' (exactly 10 for a practice test)' : ''}. Trainers assign this test — they can't change the questions or duration.
          </p>
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}

// ── Trainer: browse ready-made tests + assign to students ────────────────────────

function TrainerModuleTests({ moduleId, moduleObj, onBack }) {
  const navigate = useNavigate();
  const { data: templates, isLoading: tLoading } = useAssessments({ template: 'true', module: moduleId });
  const { data: assigned, isLoading: aLoading } = useAssessments({ module: moduleId });
  const [assignTarget, setAssignTarget] = useState(null); // a template being assigned

  return (
    <>
      <ModuleBar moduleObj={moduleObj} onBack={onBack} />

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <div className="panel-head">
          <div>
            <strong>Ready-made tests</strong>
            <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>Created by admin — assign them to your students.</div>
          </div>
        </div>
        {tLoading && !templates ? (
          <SkeletonTable rows={3} cols={3} />
        ) : templates && templates.length === 0 ? (
          <EmptyState icon={<ClipboardList size={26} />} title="No ready-made tests for this module yet" description="Ask your admin to create one." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Test</th><th>Type</th><th>Questions</th><th>Duration</th><th /></tr></thead>
              <tbody>
                {templates?.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.title}
                      {a.description && <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '26rem' }}>{a.description}</div>}
                    </td>
                    <td><Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></td>
                    <td>{a.questions.length}</td>
                    <td>{a.durationMinutes ? `${a.durationMinutes} min` : '—'}</td>
                    <td>
                      <Button size="sm" disabled={a.questions.length === 0} onClick={() => setAssignTarget(a)}>
                        <Send size={14} style={{ marginRight: 6 }} /> Assign
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="panel-head"><strong>Assigned to my students</strong></div>
        {aLoading && !assigned ? (
          <SkeletonTable rows={3} cols={4} />
        ) : assigned && assigned.length === 0 ? (
          <EmptyState icon={<CalendarClock size={26} />} title="Nothing assigned yet" description="Assign a ready-made test above." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Test</th><th>Type</th><th>Status</th><th /></tr></thead>
              <tbody>
                {assigned?.map((a) => {
                  const unlocked = a.availability === AssessmentAvailability.UNLOCKED;
                  return (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td><Badge tone={ASSESSMENT_TYPE_TONE[a.type]}>{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></td>
                      <td><Badge tone={unlocked ? 'success' : 'neutral'}>{unlocked ? 'Live' : 'Locked'}</Badge></td>
                      <td><Button size="sm" variant="outline" onClick={() => navigate(`/app/assessments/${a.id}`)}>Manage</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {assignTarget && <AssignModal template={assignTarget} moduleId={moduleId} onClose={() => setAssignTarget(null)} />}
    </>
  );
}

function AssignModal({ template, moduleId, onClose }) {
  const { data: batches } = useBatches();
  const assign = useAssignTemplate();
  const toast = useToast();
  const [form, setForm] = useState({ batch: '', examDate: '', windowStart: '', windowEnd: '' });
  const [selected, setSelected] = useState(() => new Set());
  const [err, setErr] = useState('');

  const myBatches = (batches ?? []).filter((b) => (b.modules ?? []).some((m) => (m.id ?? m) === moduleId));
  const batchObj = myBatches.find((b) => b.id === form.batch);
  const students = batchObj?.students ?? [];
  const timed = template.proctored;

  function pickBatch(id) {
    setForm({ ...form, batch: id });
    setSelected(new Set()); // reset restriction when batch changes
  }
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.batch) return setErr('Choose a batch.');
    const body = { id: template.id, batch: form.batch, studentIds: [...selected] };
    if (timed) {
      const windowErr = validateExamWindow({ ...form, durationMinutes: template.durationMinutes });
      if (windowErr) return setErr(windowErr);
      body.availableFrom = combineDateTime(form.examDate, form.windowStart);
      body.deadline = combineDateTime(form.examDate, form.windowEnd);
    }
    try {
      await assign.mutateAsync(body);
      toast.success(`Assigned “${template.title}”.`);
      onClose();
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <Modal open title={`Assign: ${template.title}`} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button form="assign-form" type="submit" loading={assign.isPending}>Assign</Button></>}>
      <form id="assign-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {template.description && (
          <div className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)' }}>{template.description}</div>
        )}
        <div className="module-card__meta">
          <Badge tone={ASSESSMENT_TYPE_TONE[template.type]}>{ASSESSMENT_TYPE_LABEL[template.type]}</Badge>
          <Badge tone="neutral">{template.questions.length} questions</Badge>
          {template.durationMinutes ? <Badge tone="neutral">{template.durationMinutes} min</Badge> : null}
          <Badge tone="neutral">{PROCTORING_LABEL[template.proctoring] ?? 'No proctoring'}</Badge>
        </div>

        <Select
          label="Batch"
          value={form.batch}
          onChange={(e) => pickBatch(e.target.value)}
          options={[{ value: '', label: myBatches.length ? 'Select a batch…' : 'No batch has this module yet' }, ...myBatches.map((b) => ({ value: b.id, label: `${b.name} (${b.code}) · ${b.students?.length ?? 0} students` }))]}
        />

        {form.batch && (
          <div>
            <label className="field__label" style={{ display: 'block', marginBottom: 6 }}>
              Who takes it <span className="lms-muted">({selected.size === 0 ? 'whole batch' : `${selected.size} selected`})</span>
            </label>
            {students.length === 0 ? (
              <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>This batch has no students yet.</p>
            ) : (
              <div className="allow-chips">
                {students.map((s) => (
                  <button type="button" key={s.id} className={`allow-chip${selected.has(s.id) ? ' allow-chip--on' : ''}`} onClick={() => toggle(s.id)} title={s.email}>
                    <span className="allow-chip__dot" /> {s.name}
                  </button>
                ))}
              </div>
            )}
            <p className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 6 }}>Leave all unselected to assign to the whole batch.</p>
          </div>
        )}

        {timed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <strong style={{ fontSize: 'var(--font-size-sm)' }}>Exam window (duration is fixed at {template.durationMinutes} min)</strong>
            <Input label="Test date" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Input label="Opens" type="time" value={form.windowStart} onChange={(e) => setForm({ ...form, windowStart: e.target.value })} />
              <Input label="Closes" type="time" value={form.windowEnd} onChange={(e) => setForm({ ...form, windowEnd: e.target.value })} />
            </div>
          </div>
        )}
        {err && <span className="field__error">{err}</span>}
      </form>
    </Modal>
  );
}
