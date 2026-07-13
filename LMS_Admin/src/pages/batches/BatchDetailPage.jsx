import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Trash2, UploadCloud, X } from 'lucide-react';
import { UserRole } from '@/shared';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  SkeletonText,
  useToast,
} from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { BulkUploadUsers } from '@/components/BulkUploadUsers';
import { UserSearchSelect } from '@/components/UserSearchSelect';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  useAssignModules,
  useAssignStudents,
  useBatch,
  useRemoveModule,
  useRemoveStudent,
  useSetModuleTrainers,
  useUpdateBatch,
} from '@/lib/batches';
import { formatDateRange, toDateInput } from '@/lib/format';
import { useTrainers } from '@/lib/users';
import { useModules } from '@/lib/modules';
import '../modules/modules.css';

export function BatchDetailPage() {
  const { id } = useParams();
  const isAdmin = useAuth((s) => s.user?.role) === UserRole.ADMIN;
  const { data: batch, isLoading, isError, error, refetch } = useBatch(id);

  if (isLoading && !batch) {
    return (
      <>
        <PageHeader
          title={<Skeleton width="14rem" height="1.6rem" />}
          subtitle={
            <Link to="/app/batches" className="lms-muted">
              ← All batches
            </Link>
          }
        />
        <div style={{ marginTop: 'var(--space-6)' }}>
          <SkeletonText lines={4} />
        </div>
      </>
    );
  }
  if (isError || !batch) {
    return (
      <>
        <PageHeader
          title="Batch"
          subtitle={
            <Link to="/app/batches" className="lms-muted">
              ← All batches
            </Link>
          }
        />
        <ErrorState message={apiErrorMessage(error) || 'Batch not found'} onRetry={refetch} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={batch.name}
        subtitle={
          <Link to="/app/batches" className="lms-muted">
            ← All batches
          </Link>
        }
      />

      <div className="module-card__meta" style={{ marginBottom: 'var(--space-6)' }}>
        <Badge tone="neutral">{batch.code}</Badge>
        <span className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)' }}>
          {formatDateRange(batch.startDate, batch.endDate)}
        </span>
        {batch.archived && <Badge tone="neutral">Archived</Badge>}
        {isAdmin && <EditBatch batch={batch} />}
      </div>

      <div className="batch-panels">
        <StudentsPanel batch={batch} isAdmin={isAdmin} />
        <ModuleTrainersPanel batch={batch} isAdmin={isAdmin} />
      </div>
    </>
  );
}

// ── Reusable assignment panel ──────────────────────────────────────────────────

function diff(all, assigned) {
  const ids = new Set(assigned.map((a) => a.id));
  return (all ?? []).filter((a) => !ids.has(a.id));
}

function StudentsPanel({ batch, isAdmin }) {
  const assign = useAssignStudents();
  const remove = useRemoveStudent();
  const qc = useQueryClient();
  const toast = useToast();
  const [bulk, setBulk] = useState(false);

  const enrolled = batch.students ?? [];
  const enrolledIds = enrolled.map((s) => s.id);

  async function addStudent(user) {
    try {
      await assign.mutateAsync({ id: batch.id, ids: [user.id] });
      toast.success(`${user.name} added to the batch.`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  return (
    <>
      <Card>
        <div className="panel-head">
          <CardHeader title={`Students (${enrolled.length})`} subtitle="Each student belongs to exactly one batch" />
          {isAdmin && (
            // A search box (by name or email) instead of a dropdown — scales to
            // thousands of students without an unusable, mile-long list.
            <div className="add-inline" style={{ flex: '1 1 18rem' }}>
              <UserSearchSelect
                role="student"
                excludeIds={enrolledIds}
                disabled={assign.isPending}
                placeholder="Search students by name or email…"
                onPick={addStudent}
              />
            </div>
          )}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setBulk(true)}>
              <UploadCloud size={15} style={{ marginRight: 6 }} /> Bulk upload
            </Button>
          )}
        </div>

        <div className="chip-list">
          {enrolled.length === 0 && <span className="lms-muted">No students enrolled yet.</span>}
          {enrolled.map((s) => (
            <span className="chip chip--lg" key={s.id}>
              {s.name}
              {isAdmin && (
                <button type="button" className="chip__x" aria-label={`Remove ${s.name}`} onClick={() => remove.mutateAsync({ id: batch.id, memberId: s.id })}>
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </span>
          ))}
        </div>
      </Card>

      <Modal open={bulk} title="Bulk upload students to this batch" onClose={() => setBulk(false)}>
        <BulkUploadUsers
          batchId={batch.id}
          lockRole
          onClose={() => setBulk(false)}
          onUploaded={() => qc.invalidateQueries({ queryKey: ['batches'] })}
        />
      </Modal>
    </>
  );
}

// ── Modules & Trainers mapping (who delivers each module in this batch) ────────

/** Trainers currently mapped to a given module in this batch. */
function trainersForModule(batch, moduleId) {
  const entry = (batch.moduleTrainers ?? []).find((mt) => (mt.module?.id ?? mt.module) === moduleId);
  return entry?.trainers ?? [];
}

function ModuleTrainersPanel({ batch, isAdmin }) {
  const { data: allModules, isLoading: modLoading } = useModules();
  const { data: allTrainers, isLoading: trLoading } = useTrainers();
  const assignModule = useAssignModules();
  const [pickModule, setPickModule] = useState('');

  const modules = (batch.modules ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const availableModules = diff(allModules, modules);
  const moduleNoneText = modLoading
    ? 'Loading…'
    : (allModules?.length ?? 0) === 0
      ? 'No modules yet — create them in Modules'
      : 'All modules already added';

  return (
    <Card>
      <div className="panel-head">
        <CardHeader title="Modules & Trainers" subtitle="Pick a module, then assign the trainers who deliver it" />
        {isAdmin && (
          <div className="add-inline add-inline--right">
            <Select
              value={pickModule}
              onChange={(e) => setPickModule(e.target.value)}
              options={[
                { value: '', label: availableModules.length ? 'Add a module to this batch…' : moduleNoneText },
                ...availableModules.map((m) => ({ value: m.id, label: `${m.order}. ${m.name} (${m.code})` })),
              ]}
            />
            <Button
              disabled={!pickModule}
              loading={assignModule.isPending}
              onClick={async () => {
                await assignModule.mutateAsync({ id: batch.id, ids: [pickModule] });
                setPickModule('');
              }}
            >
              Add module
            </Button>
          </div>
        )}
      </div>

      {modules.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={26} />}
          title="No modules in this batch yet"
          description={isAdmin ? 'Add a module above to start mapping trainers.' : 'No modules in this batch yet.'}
        />
      ) : (
        <div className="map-grid">
          {modules.map((m) => (
            <ModuleRow
              key={m.id}
              batch={batch}
              module={m}
              assignedTrainers={trainersForModule(batch, m.id)}
              allTrainers={allTrainers ?? []}
              trLoading={trLoading}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ModuleRow({ batch, module, assignedTrainers, allTrainers, trLoading, isAdmin }) {
  const [pick, setPick] = useState('');
  const setTrainers = useSetModuleTrainers();
  const removeModule = useRemoveModule();

  const currentIds = assignedTrainers.map((t) => t.id);
  const assignedSet = new Set(currentIds);
  const available = allTrainers.filter((t) => !assignedSet.has(t.id));

  const addTrainer = async (tid) => {
    await setTrainers.mutateAsync({ id: batch.id, moduleId: module.id, trainerIds: [...currentIds, tid] });
    setPick('');
  };
  const removeTrainer = (tid) =>
    setTrainers.mutateAsync({ id: batch.id, moduleId: module.id, trainerIds: currentIds.filter((x) => x !== tid) });

  const trainerNoneText = trLoading
    ? 'Loading…'
    : (allTrainers.length ?? 0) === 0
      ? 'No trainers yet — add them in Users'
      : 'All trainers assigned';

  return (
    <div className="map-row">
      {/* Module name (left) + Remove button (top-right corner) */}
      <div className="map-row__head">
        <div className="map-row__title">
          <strong>{module.order}. {module.name}</strong>
          <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{module.code}</span>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="tile-remove"
            title="Remove module"
            aria-label={`Remove ${module.name}`}
            onClick={() => removeModule.mutateAsync({ id: batch.id, memberId: module.id })}
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="map-row__add">
          <Select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            options={[
              { value: '', label: available.length ? 'Add a trainer…' : trainerNoneText },
              ...available.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <Button size="sm" disabled={!pick} loading={setTrainers.isPending} onClick={() => addTrainer(pick)}>
            Add
          </Button>
        </div>
      )}

      <div className="map-row__chips">
        {assignedTrainers.length === 0 && (
          <span className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>No trainers assigned yet.</span>
        )}
        {assignedTrainers.map((t) => (
          <span className="chip" key={t.id}>
            {t.name}
            {isAdmin && (
              <button type="button" className="chip__x" aria-label={`Remove ${t.name}`} onClick={() => removeTrainer(t.id)}>
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Edit batch (admin) ─────────────────────────────────────────────────────────

function EditBatch({ batch }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: batch.name,
    code: batch.code,
    startDate: toDateInput(batch.startDate),
    endDate: toDateInput(batch.endDate),
  });
  const [err, setErr] = useState('');
  const update = useUpdateBatch();

  useEffect(() => {
    setForm({
      name: batch.name,
      code: batch.code,
      startDate: toDateInput(batch.startDate),
      endDate: toDateInput(batch.endDate),
    });
  }, [batch]);

  async function save(e) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({ id: batch.id, ...form, code: form.code.toUpperCase() });
      setOpen(false);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit details
      </Button>
      <Modal
        open={open}
        title="Edit Batch"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="edit-batch-form" type="submit" loading={update.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form id="edit-batch-form" onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Batch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Batch code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <Input label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
          </div>
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}
