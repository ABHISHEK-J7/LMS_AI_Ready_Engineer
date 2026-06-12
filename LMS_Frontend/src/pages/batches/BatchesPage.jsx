import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@lms/shared';
import { Badge, Button, Card, FullPageSpinner, Input, Modal } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useArchiveBatch, useBatches, useCreateBatch } from '@/lib/batches';
import { formatDateRange } from '@/lib/format';
import '../modules/modules.css';

const EMPTY = { name: '', code: '', startDate: '', endDate: '' };

function batchStatus(b) {
  const now = Date.now();
  const start = new Date(b.startDate).getTime();
  const end = new Date(b.endDate).getTime();
  if (b.archived) return { label: 'Archived', tone: 'neutral' };
  if (now < start) return { label: 'Upcoming', tone: 'primary' };
  if (now > end) return { label: 'Completed', tone: 'neutral' };
  return { label: 'Active', tone: 'success' };
}

export function BatchesPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;
  const navigate = useNavigate();

  const [showArchived, setShowArchived] = useState(false);
  const { data: batches, isLoading, isError, error } = useBatches({ archived: showArchived });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const createBatch = useCreateBatch();
  const archiveBatch = useArchiveBatch();

  const subtitle = {
    [UserRole.ADMIN]: 'Create and manage cohorts running through the curriculum.',
    [UserRole.TRAINER]: 'Batches you train.',
    [UserRole.STUDENT]: 'Your batch.',
  }[role];

  async function submitCreate(e) {
    e.preventDefault();
    setFormError('');
    try {
      const created = await createBatch.mutateAsync({ ...form, code: form.code.toUpperCase() });
      setCreating(false);
      setForm(EMPTY);
      navigate(`/app/batches/${created.id}`);
    } catch (err) {
      setFormError(apiErrorMessage(err));
    }
  }

  async function onArchive(e, id) {
    e.stopPropagation();
    if (!window.confirm('Archive this batch?')) return;
    await archiveBatch.mutateAsync(id);
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <PageHeader title={isAdmin ? 'Batches' : 'My Batches'} subtitle={subtitle} />

      <div className="toolbar">
        {isAdmin && (
          <label className="lms-secondary-text" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        )}
        <span />
        {isAdmin && <Button onClick={() => setCreating(true)}>+ New Batch</Button>}
      </div>

      {isError && (
        <Card>
          <p className="field__error">{apiErrorMessage(error)}</p>
        </Card>
      )}

      {batches && batches.length === 0 ? (
        <Card>
          <p className="lms-muted">
            {isAdmin ? 'No batches yet. Create your first cohort.' : 'No batches assigned to you yet.'}
          </p>
        </Card>
      ) : (
        <div className="module-grid">
          {batches?.map((b) => {
            const status = batchStatus(b);
            return (
              <Card key={b.id} hover className="module-card" onClick={() => navigate(`/app/batches/${b.id}`)}>
                <div className="module-card__top">
                  <div>
                    <div className="module-card__name">{b.name}</div>
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {b.code}
                    </div>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <div className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {formatDateRange(b.startDate, b.endDate)}
                </div>
                <div className="module-card__meta">
                  <Badge tone="neutral">{b.students?.length ?? 0} students</Badge>
                  <Badge tone="neutral">{b.trainers?.length ?? 0} trainers</Badge>
                  <Badge tone="neutral">{b.modules?.length ?? 0} modules</Badge>
                </div>
                {isAdmin && !b.archived && (
                  <div className="list-actions">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/app/batches/${b.id}`); }}>
                      Manage
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => onArchive(e, b.id)}>
                      Archive
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        title="New Batch"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button form="create-batch-form" type="submit" loading={createBatch.isPending}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-batch-form" onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Batch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Prompt Engineering Batch A" required />
          <Input label="Batch code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PE-A" required />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <Input label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
          </div>
          {formError && <span className="field__error">{formError}</span>}
        </form>
      </Modal>
    </>
  );
}
