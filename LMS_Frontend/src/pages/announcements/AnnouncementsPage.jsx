import { useState } from 'react';
import { UserRole } from '@/shared';
import { Megaphone } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, Select, SkeletonCards, Textarea, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from '@/lib/announcements';
import { useBatches } from '@/lib/batches';
import { useModules } from '@/lib/modules';
import { formatDate } from '@/lib/format';

const BLANK = { title: '', body: '', batch: '', module: '', isGlobal: false };

export function AnnouncementsPage() {
  const user = useAuth((s) => s.user);
  const role = user?.role;
  const canPost = role === UserRole.ADMIN || role === UserRole.TRAINER;
  const isAdmin = role === UserRole.ADMIN;

  const { data: items, isLoading, isError, error, refetch } = useAnnouncements();
  const { data: batches } = useBatches({ enabled: canPost });
  const { data: modules } = useModules({ enabled: canPost });
  const create = useCreateAnnouncement();
  const del = useDeleteAnnouncement();
  const toast = useToast();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.isGlobal && !form.batch && !form.module) {
      return setErr('Choose a batch, a module, or post to everyone.');
    }
    try {
      await create.mutateAsync({
        title: form.title,
        body: form.body,
        batch: form.batch || undefined,
        module: form.module || undefined,
        isGlobal: isAdmin ? form.isGlobal : undefined,
      });
      setOpen(false);
      setForm(BLANK);
      toast.success('Announcement posted.');
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  async function remove(id) {
    if (!(await confirm({ title: 'Delete this announcement?', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await del.mutateAsync(id);
      toast.success('Announcement deleted.');
    } catch (e2) {
      toast.error(apiErrorMessage(e2));
    }
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={canPost ? 'Post updates to your batches and modules.' : 'Updates from your trainers.'}
      />

      <div className="toolbar">
        <span />
        {canPost && <Button onClick={() => setOpen(true)}>+ New Announcement</Button>}
      </div>

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !items ? (
        <SkeletonCards count={4} height="7rem" />
      ) : items && items.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={26} />}
          title="No announcements yet"
          description="No announcements yet."
          action={canPost ? <Button onClick={() => setOpen(true)}>+ New Announcement</Button> : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {items?.map((a) => (
            <Card key={a.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{a.title}</strong>
                    {a.isGlobal ? <Badge tone="warning">Everyone</Badge> : <Badge tone="neutral">{a.batch?.name ?? a.module?.name}</Badge>}
                  </div>
                  <p className="lms-secondary-text" style={{ marginTop: 'var(--space-2)', whiteSpace: 'pre-wrap' }}>{a.body}</p>
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>
                    {a.author?.name ?? 'Trainer'} · {formatDate(a.createdAt)}
                  </div>
                </div>
                {(isAdmin || a.author?.id === user?.id) && (
                  <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Delete</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title="New Announcement"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button form="ann-form" type="submit" loading={create.isPending}>Post</Button>
          </>
        }
      >
        <form id="ann-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Textarea label="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required style={{ minHeight: '7rem' }} />
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input type="checkbox" checked={form.isGlobal} onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })} />
              Post to everyone (global)
            </label>
          )}
          {!form.isGlobal && (
            <>
              <Select
                label="Batch"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                options={[{ value: '', label: '— none —' }, ...(batches ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))]}
              />
              <Select
                label="Module"
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                options={[{ value: '', label: '— none —' }, ...(modules ?? []).map((m) => ({ value: m.id, label: m.name }))]}
              />
            </>
          )}
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}
