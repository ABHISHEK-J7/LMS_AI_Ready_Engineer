import { useState } from 'react';
import { FileText, Film, Link2, Plus, PencilLine, Presentation, Trash2 } from 'lucide-react';
import { ResourceType } from '@/shared';
import { Button, Input, Select } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
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
export function TopicResources({ module, topic, canEdit }) {
  const { data: all, isLoading } = useResources(module.id);
  const add = useAddResource();
  const del = useDeleteResource();
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState('');

  const resources = (all ?? []).filter((r) => (r.topic ?? null) === topic.id);
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
      <p className="lms-muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
        Resources added here are shown to learners under <strong>{topic.title}</strong> only.
      </p>

      {isLoading ? (
        <p className="lms-muted">Loading…</p>
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
