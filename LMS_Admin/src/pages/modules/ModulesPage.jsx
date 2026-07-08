import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@/shared';
import { BookOpen, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Select, SkeletonCards, Textarea, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useArchiveModule, useCreateModule, useDeleteModule, useModules, useReorderModules, useUpdateModule } from '@/lib/modules';
import { LEVEL_OPTIONS, levelTone, titleCase, topicProgress } from './moduleUi';
import './modules.css';

const EMPTY = { name: '', code: '', level: 'beginner', description: '' };

export function ModulesPage() {
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role === UserRole.ADMIN;
  const navigate = useNavigate();

  const [showArchived, setShowArchived] = useState(false);
  const { data: modules, isLoading, isError, error, refetch } = useModules({ archived: showArchived });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const createModule = useCreateModule();
  const archiveModule = useArchiveModule();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();
  const reorderModules = useReorderModules();
  const confirm = useConfirm();
  const toast = useToast();

  const subtitle = {
    [UserRole.ADMIN]: 'Create and manage the AI Ready Engineer curriculum.',
    [UserRole.TRAINER]: 'Modules assigned to you. Manage their syllabus and resources.',
    [UserRole.STUDENT]: 'Your structured learning path from Beginner to Expert.',
  }[role];

  async function submitCreate(e) {
    e.preventDefault();
    setFormError('');
    try {
      const created = await createModule.mutateAsync({
        ...form,
        code: form.code.toUpperCase(),
      });
      setCreating(false);
      setForm(EMPTY);
      navigate(`/app/modules/${created.id}`);
    } catch (err) {
      setFormError(apiErrorMessage(err));
    }
  }

  async function onArchive(e, id) {
    e.stopPropagation();
    if (!(await confirm({ title: 'Archive this module?', message: 'It will be hidden from active curriculum.' }))) return;
    await archiveModule.mutateAsync(id);
  }

  async function onUnarchive(e, id) {
    e.stopPropagation();
    await updateModule.mutateAsync({ id, archived: false });
  }

  // Reorder: swap a module with its neighbour and persist the whole new order.
  async function move(e, index, dir) {
    e.stopPropagation();
    const arr = [...(modules ?? [])];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    try {
      await reorderModules.mutateAsync(arr.map((m) => m.id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function onDelete(e, m) {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete “${m.name}” permanently?`,
      message: 'This removes the module and its question bank for good. It is refused if any batch, assessment, student progress, or certificate still uses it. This cannot be undone — use Archive to hide it instead.',
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteModule.mutateAsync(m.id);
      toast.success(`“${m.name}” deleted.`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title={isAdmin ? 'Modules' : 'My Modules'} subtitle={subtitle} />

      <div className="toolbar">
        {isAdmin && (
          <label className="lms-secondary-text" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        )}
        <span />
        {isAdmin && <Button onClick={() => setCreating(true)}>+ New Module</Button>}
      </div>

      {isError && <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />}

      {isLoading && !modules ? (
        <SkeletonCards count={6} height="13rem" />
      ) : modules && modules.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title={isAdmin ? 'No modules yet' : 'No modules assigned'}
          description={
            isAdmin
              ? 'No modules yet. Create one, or run the seed script to load the default 10-module curriculum.'
              : 'No modules are assigned to you yet.'
          }
          action={isAdmin ? <Button onClick={() => setCreating(true)}>+ New Module</Button> : undefined}
        />
      ) : (
        <div className="module-grid">
          {modules?.map((m, i) => {
            const { done, total, pct } = topicProgress(m.topics);
            const canReorder = isAdmin && !showArchived && !m.archived;
            return (
              <Card key={m.id} hover className="module-card" onClick={() => navigate(`/app/modules/${m.id}`)}>
                <div className="module-card__top">
                  <div className="module-card__order-ctl">
                    {canReorder && (
                      <button
                        type="button"
                        className="ord-btn"
                        title="Move up"
                        disabled={i === 0 || reorderModules.isPending}
                        onClick={(e) => move(e, i, -1)}
                      >
                        <ChevronUp size={14} />
                      </button>
                    )}
                    <span className="module-card__order">{m.order}</span>
                    {canReorder && (
                      <button
                        type="button"
                        className="ord-btn"
                        title="Move down"
                        disabled={i === (modules?.length ?? 0) - 1 || reorderModules.isPending}
                        onClick={(e) => move(e, i, 1)}
                      >
                        <ChevronDown size={14} />
                      </button>
                    )}
                  </div>
                  <div className="module-card__meta">
                    <Badge tone={levelTone(m.level)}>{titleCase(m.level)}</Badge>
                    {m.archived && <Badge tone="neutral">Archived</Badge>}
                  </div>
                </div>
                <div>
                  <div className="module-card__name">{m.name}</div>
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {m.code}
                  </div>
                </div>
                <div>
                  <div
                    className="lms-secondary-text"
                    style={{ fontSize: 'var(--font-size-xs)', marginBottom: 4 }}
                  >
                    Syllabus {done}/{total} sections complete
                  </div>
                  <div className="module-card__progress-track">
                    <div className="module-card__progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {isAdmin && (
                  <div className="list-actions">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/app/modules/${m.id}`); }}>
                      Manage
                    </Button>
                    {m.archived ? (
                      <Button size="sm" variant="ghost" onClick={(e) => onUnarchive(e, m.id)}>
                        Unarchive
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={(e) => onArchive(e, m.id)}>
                        Archive
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" title="Delete permanently" onClick={(e) => onDelete(e, m)}>
                      <Trash2 size={14} />
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
        title="New Module"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button form="create-module-form" type="submit" loading={createModule.isPending}>
              Create
            </Button>
          </>
        }
      >
        <form id="create-module-form" onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Module name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Prompt Engineering"
            required
          />
          <Input
            label="Module code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="e.g. PE"
            required
          />
          <Select
            label="Level"
            value={form.level}
            onChange={(e) => setForm({ ...form, level: e.target.value })}
            options={LEVEL_OPTIONS}
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What this module covers…"
          />
          {formError && <span className="field__error">{formError}</span>}
        </form>
      </Modal>
    </>
  );
}
