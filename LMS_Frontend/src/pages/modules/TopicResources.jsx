import { useState } from 'react';
import { FileText, Film, Link2, Lock, Plus, PencilLine, Presentation, Trash2 } from 'lucide-react';
import { ResourceType, UserRole } from '@lms/shared';
import { Button, Input, Select } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAddResource, useDeleteResource, useResources } from '@/lib/resources';

// Display metadata per resource type (kept in the order learners see them).
const TYPE_META = [
  { value: ResourceType.VIDEO, label: 'Videos', single: 'Video', Icon: Film },
  { value: ResourceType.DOCUMENT, label: 'Documents', single: 'Document', Icon: FileText },
  { value: ResourceType.PRESENTATION, label: 'Presentations', single: 'Presentation', Icon: Presentation },
  { value: ResourceType.ASSIGNMENT, label: 'Assignments', single: 'Assignment', Icon: PencilLine },
  { value: ResourceType.LINK, label: 'Links', single: 'Link', Icon: Link2 },
];
const TYPE_OPTIONS = TYPE_META.map((t) => ({ value: t.value, label: t.single }));
const BLANK = { type: ResourceType.VIDEO, title: '', source: 'file', url: '', file: null };

/**
 * Manage the learning resources for ONE syllabus topic — grouped by type
 * (videos / documents / presentations / assignments / links), with an add form.
 * Resources are scoped to the topic via `resource.topic`.
 */
export function TopicResources({ module, topic, canEdit, view = 'grid' }) {
  const { data: all, isLoading } = useResources(module.id);
  const role = useAuth((s) => s.user?.role);
  const isStudent = role === UserRole.STUDENT;
  const add = useAddResource();
  const del = useDeleteResource();
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState('');

  const resources = (all ?? []).filter((r) => (r.topic ?? null) === topic.id);
  // Matrix view: one column per type, resources stacked down each column.
  const byType = TYPE_META.map((t) => ({ ...t, items: resources.filter((r) => r.type === t.value) }));
  const maxRows = byType.reduce((m, t) => Math.max(m, t.items.length), 0);

  // For students, the backend only returns resources of topics the trainer has
  // marked taught in their batch. If none come back, the topic isn't released.
  if (isStudent && !isLoading && resources.length === 0) {
    return (
      <div className="topic-res" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-2)' }}>
        <Lock size={28} style={{ color: 'var(--color-text-muted)' }} />
        <p className="lms-muted" style={{ marginTop: 'var(--space-3)' }}>
          Your trainer hasn&apos;t covered this topic yet. Its resources will appear here once
          they mark it taught in class.
        </p>
      </div>
    );
  }
  const isLink = form.type === ResourceType.LINK;
  const useUrl = isLink || form.source === 'link';

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) return setErr('Enter a title.');
    if (useUrl && !form.url.trim()) return setErr('Enter a URL.');
    if (!useUrl && !form.file) return setErr('Choose a file to upload.');
    try {
      await add.mutateAsync({
        module: module.id,
        topic: topic.id,
        type: form.type,
        title: form.title.trim(),
        url: useUrl ? form.url.trim() : undefined,
        file: useUrl ? undefined : form.file,
      });
      setForm(BLANK);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <div className="topic-res">
      {canEdit && (
        <p className="lms-muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
          Resources added here are shown to learners under <strong>{topic.title}</strong> — but only
          after you mark this topic taught in a batch.
        </p>
      )}

      {isLoading ? (
        <p className="lms-muted">Loading…</p>
      ) : view === 'table' ? (
        <div className="res-matrix-wrap">
          <div className="res-matrix-scroll">
            <table className="res-matrix">
              <thead>
                <tr>
                  <th className="res-matrix__group" colSpan={byType.length}>TYPE</th>
                </tr>
                <tr>
                  {byType.map((t) => (
                    <th key={t.value}>
                      <span className="res-matrix__th">
                        <t.Icon size={14} strokeWidth={2} /> {t.label}
                        <span className="res-matrix__th-count">{t.items.length}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maxRows === 0 ? (
                  <tr>
                    <td colSpan={byType.length} className="res-matrix__empty lms-muted">
                      No resources for this topic yet.
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: maxRows }).map((_, i) => (
                    <tr key={i}>
                      {byType.map((t) => {
                        const r = t.items[i];
                        return (
                          <td key={t.value}>
                            {r && (
                              <span className="res-matrix__cell">
                                <a href={r.url} target="_blank" rel="noreferrer" className="res-matrix__link">{r.title}</a>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn--danger res-matrix__del"
                                    aria-label={`Delete ${r.title}`}
                                    onClick={() => window.confirm('Delete this resource?') && del.mutate({ id: r.id, module: module.id })}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="topic-res__groups">
          {TYPE_META.map(({ value, label, Icon }) => {
            const items = resources.filter((r) => r.type === value);
            return (
              <div className="res-group" key={value}>
                <div className="res-group__head">
                  <Icon size={15} strokeWidth={2} />
                  <span>{label}</span>
                  <span className="res-group__count">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <p className="res-group__empty">None yet.</p>
                ) : (
                  items.map((r) => (
                    <div className="res-item" key={r.id}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="res-item__title">{r.title}</a>
                      {canEdit && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          aria-label={`Delete ${r.title}`}
                          onClick={() => window.confirm('Delete this resource?') && del.mutate({ id: r.id, module: module.id })}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <form onSubmit={submit} className="res-add">
          <div className="res-add__row">
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={TYPE_OPTIONS} />
            {!isLink && (
              <Select
                label="Source"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                options={[{ value: 'file', label: 'Upload file' }, { value: 'link', label: 'External link' }]}
              />
            )}
          </div>
          <Input label="Title" placeholder="e.g. Intro to prompting (Part 1)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          {useUrl ? (
            <Input label="URL" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          ) : (
            <label className="field">
              <span className="field__label">File</span>
              <input type="file" className="input" style={{ paddingTop: 6 }} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
            </label>
          )}
          {err && <span className="field__error">{err}</span>}
          <div>
            <Button type="submit" loading={add.isPending}>
              <Plus size={15} style={{ marginRight: 6 }} /> Add to this topic
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
