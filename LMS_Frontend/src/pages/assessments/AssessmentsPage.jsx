import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssessmentAvailability, AssessmentType, UserRole } from '@lms/shared';
import { Badge, Button, Card, FullPageSpinner, Input, Modal, Select } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAssessments, useCreateAssessment, useDeleteAssessment, useSetAvailability } from '@/lib/assessments';
import { useModules } from '@/lib/modules';
import { assessmentLabel, submissionBadge } from './assessmentsUi';
import '../modules/modules.css';

export function AssessmentsPage() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.STUDENT ? <StudentAssessments /> : <StaffAssessments />;
}

// ── Student ────────────────────────────────────────────────────────────────────

function StudentAssessments() {
  const navigate = useNavigate();
  const { data: items, isLoading, isError, error } = useAssessments();

  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <PageHeader title="Assessments" subtitle="Unlocked by your trainer as you complete each section." />
      {isError && <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>}
      {items && items.length === 0 ? (
        <Card>
          <p className="lms-muted">
            No assessments are available yet. Your trainer unlocks practice tests after completing
            each syllabus section.
          </p>
        </Card>
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
                  <Badge tone={a.type === AssessmentType.FINAL ? 'warning' : 'primary'}>
                    {a.type === AssessmentType.FINAL ? 'Final' : 'Practice'}
                  </Badge>
                </div>
                <div className="module-card__meta">
                  <Badge tone="neutral">{a.questionCount} questions</Badge>
                  <Badge tone="neutral">Pass ≥ {a.passingScore}%</Badge>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
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
                      Not available
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

const BLANK = { title: '', type: AssessmentType.PRACTICE, practiceIndex: 1, passingScore: '' };

function StaffAssessments() {
  const navigate = useNavigate();
  const { data: modules } = useModules();
  const [moduleId, setModuleId] = useState('');
  const { data: assessments, isLoading } = useAssessments(moduleId ? { module: moduleId } : {});

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
        ...(form.type === AssessmentType.PRACTICE ? { practiceIndex: Number(form.practiceIndex) } : {}),
        ...(form.passingScore ? { passingScore: Number(form.passingScore) } : {}),
      };
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
        <div style={{ minWidth: 280 }}>
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
        <Card><p className="lms-muted">Choose a module to manage its assessments.</p></Card>
      ) : isLoading ? (
        <FullPageSpinner />
      ) : assessments && assessments.length === 0 ? (
        <Card><p className="lms-muted">No assessments yet for this module. Create the first practice test.</p></Card>
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
              { value: AssessmentType.FINAL, label: 'Final Assessment' },
            ]}
          />
          {form.type === AssessmentType.PRACTICE && (
            <Select
              label="Practice test number"
              value={String(form.practiceIndex)}
              onChange={(e) => setForm({ ...form, practiceIndex: e.target.value })}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Practice Test ${n}` }))}
            />
          )}
          <Input label="Passing score % (optional)" type="number" min="0" max="100" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} placeholder="Defaults to platform setting (70)" />
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}
