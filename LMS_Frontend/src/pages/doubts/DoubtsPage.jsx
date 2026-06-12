import { useEffect, useRef, useState } from 'react';
import { DoubtStatus, UserRole } from '@lms/shared';
import { Badge, Button, Card, FullPageSpinner, Input, Modal, Select, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  markDoubtRead,
  newMessageCount,
  useCreateDoubt,
  useDoubt,
  useDoubts,
  useReplyDoubt,
  useSetDoubtStatus,
} from '@/lib/doubts';
import { useModules } from '@/lib/modules';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

const STATUS_TONE = { open: 'warning', answered: 'success', closed: 'neutral' };
const titleCase = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

export function DoubtsPage() {
  const role = useAuth((s) => s.user?.role);
  const userId = useAuth((s) => s.user?.id);
  const isStudent = role === UserRole.STUDENT;

  const [statusFilter, setStatusFilter] = useState('');
  const { data: doubts, isLoading } = useDoubts({ status: statusFilter });
  const { data: modules } = useModules();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', module: '' });
  const [err, setErr] = useState('');
  const create = useCreateDoubt();

  const [openId, setOpenId] = useState(null);

  async function submitCreate(e) {
    e.preventDefault();
    setErr('');
    try {
      const created = await create.mutateAsync({
        title: form.title,
        body: form.body,
        module: form.module || undefined,
      });
      setCreating(false);
      setForm({ title: '', body: '', module: '' });
      setOpenId(created.id);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <>
      <PageHeader
        title={isStudent ? 'My Doubts' : 'Student Doubts'}
        subtitle={isStudent ? 'Ask your trainers questions and track answers.' : 'Answer questions from your students.'}
      />

      <div className="toolbar">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: DoubtStatus.OPEN, label: 'Open' },
            { value: DoubtStatus.ANSWERED, label: 'Answered' },
            { value: DoubtStatus.CLOSED, label: 'Closed' },
          ]}
        />
        {isStudent && <Button onClick={() => setCreating(true)}>+ Ask a Doubt</Button>}
      </div>

      {isLoading ? (
        <FullPageSpinner />
      ) : !doubts || doubts.length === 0 ? (
        <Card>
          <p className="lms-muted">
            {isStudent ? 'No doubts yet. Ask your first question.' : 'No student doubts in your modules/batches yet.'}
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {doubts.map((d) => {
            const unread = newMessageCount(d, userId);
            return (
              <Card
                key={d.id}
                hover
                onClick={() => { markDoubtRead(d.id); setOpenId(d.id); }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{d.title}</div>
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {!isStudent && `${d.student?.name} · `}
                    {d.module?.name ?? 'General'} · {d.messages?.length ?? 0} message(s) · updated {formatDate(d.updatedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 'none' }}>
                  {unread > 0 && (
                    <span className="doubt-unread" title={`${unread} new message${unread === 1 ? '' : 's'}`} aria-label={`${unread} new messages`}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                  <Badge tone={STATUS_TONE[d.status]}>{titleCase(d.status)}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ask modal */}
      <Modal
        open={creating}
        title="Ask a Doubt"
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button form="ask-form" type="submit" loading={create.isPending}>Post</Button>
          </>
        }
      >
        <form id="ask-form" onSubmit={submitCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short summary of your question" required />
          <Select
            label="Module (optional)"
            value={form.module}
            onChange={(e) => setForm({ ...form, module: e.target.value })}
            options={[{ value: '', label: 'General / not module-specific' }, ...(modules ?? []).map((m) => ({ value: m.id, label: m.name }))]}
          />
          <Textarea label="Your question" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required style={{ minHeight: '7rem' }} />
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>

      <DoubtThread id={openId} role={role} onClose={() => setOpenId(null)} />
    </>
  );
}

function DoubtThread({ id, role, onClose }) {
  const { data: doubt, isLoading } = useDoubt(id);
  const messagesRef = useRef(null);

  // While the thread is open, keep it marked read (incl. replies that arrive
  // live) and scroll to the most recent message.
  useEffect(() => {
    if (!doubt?.id) return;
    markDoubtRead(doubt.id);
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [doubt]);
  const reply = useReplyDoubt();
  const setStatus = useSetDoubtStatus();
  const [body, setBody] = useState('');
  const isStaff = role === UserRole.ADMIN || role === UserRole.TRAINER;

  async function send(e) {
    e?.preventDefault();
    if (!body.trim()) return;
    await reply.mutateAsync({ id, body: body.trim() });
    setBody('');
  }

  // Enter sends; Shift+Enter inserts a newline.
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Modal
      open={Boolean(id)}
      title={doubt?.title ?? 'Doubt'}
      onClose={() => { setBody(''); onClose(); }}
      footer={
        isStaff && doubt ? (
          <>
            {doubt.status !== DoubtStatus.CLOSED ? (
              <Button variant="outline" onClick={() => setStatus.mutate({ id, status: DoubtStatus.CLOSED })}>Close</Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus.mutate({ id, status: DoubtStatus.OPEN })}>Reopen</Button>
            )}
            <Button form="reply-form" type="submit" loading={reply.isPending}>Send reply</Button>
          </>
        ) : (
          <Button form="reply-form" type="submit" loading={reply.isPending}>Send reply</Button>
        )
      }
    >
      {isLoading || !doubt ? (
        <FullPageSpinner />
      ) : (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Badge tone={STATUS_TONE[doubt.status]}>{titleCase(doubt.status)}</Badge>{' '}
            {doubt.module && <Badge tone="neutral">{doubt.module.name}</Badge>}
          </div>
          <div ref={messagesRef} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxHeight: '40vh', overflow: 'auto', marginBottom: 'var(--space-4)' }}>
            {doubt.messages.map((m) => {
              const mine = m.authorRole === role;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    // Theme-adaptive via color-mix — readable in light & dark, green & orange.
                    background: mine
                      ? 'color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))'
                      : 'var(--color-background)',
                    border: `1px solid ${mine ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 2 }}>
                    {m.author?.name ?? 'User'} · {titleCase(m.authorRole)}{mine ? ' (you)' : ''} · {formatDate(m.createdAt)}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              );
            })}
          </div>
          {doubt.status === DoubtStatus.CLOSED ? (
            <p className="lms-muted">This doubt is closed.</p>
          ) : (
            <form id="reply-form" onSubmit={send}>
              <Textarea
                placeholder="Write a reply…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
