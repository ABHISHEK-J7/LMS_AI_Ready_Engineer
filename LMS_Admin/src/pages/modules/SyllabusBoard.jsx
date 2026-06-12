import { useState } from 'react';
import { BookOpen, Check, Layers, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, Input, Modal, Textarea } from '@/components/ui';
import {
  useAddTopic,
  useDeleteTopic,
  useSetTopicCompletion,
  useUpdateTopic,
} from '@/lib/modules';
import { useResources } from '@/lib/resources';
import { TopicResources } from './TopicResources';

/**
 * Syllabus as a board of topic cards. Each card opens that topic's learning
 * resources (videos/docs/presentations/assignments/links) in a modal — so
 * resources are added per topic, not per whole module.
 */
export function SyllabusBoard({ module, canEdit }) {
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(null); // { topicId, title, description }
  const [openTopic, setOpenTopic] = useState(null);
  const addTopic = useAddTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const setCompletion = useSetTopicCompletion();
  const { data: resources } = useResources(module.id);

  const countFor = (topicId) => (resources ?? []).filter((r) => (r.topic ?? null) === topicId).length;

  async function add(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await addTopic.mutateAsync({ id: module.id, title: newTitle.trim() });
    setNewTitle('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    await updateTopic.mutateAsync({
      id: module.id,
      topicId: editing.topicId,
      title: editing.title,
      description: editing.description,
    });
    setEditing(null);
  }

  return (
    <Card>
      <div className="panel-head">
        <CardHeader
          title="Syllabus"
          subtitle="Click a topic to add its videos, documents, presentations, assignments & links"
        />
        {canEdit && (
          <form className="add-inline add-inline--right" onSubmit={add}>
            <Input placeholder="New topic…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <Button type="submit" loading={addTopic.isPending}>Add topic</Button>
          </form>
        )}
      </div>

      {module.topics.length === 0 ? (
        <p className="lms-muted">No topics yet. Add your first syllabus topic to start attaching resources.</p>
      ) : (
        <div className="topic-board">
          {module.topics.map((t) => {
            const count = countFor(t.id);
            return (
              <div
                className={`topic-card${t.completed ? ' topic-card--done' : ''}`}
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenTopic(t)}
                onKeyDown={(e) => { if (e.key === 'Enter') setOpenTopic(t); }}
              >
                <div className="topic-card__top">
                  <span className="topic-card__icon"><BookOpen size={16} strokeWidth={2} /></span>
                  {t.completed && (
                    <span className="topic-card__done"><Check size={12} strokeWidth={3} /> Taught</span>
                  )}
                </div>
                <div className="topic-card__title">{t.title}</div>
                {t.description && <div className="topic-card__desc">{t.description}</div>}
                <div className="topic-card__foot">
                  <span className="topic-card__count">
                    <Layers size={13} /> {count} resource{count === 1 ? '' : 's'}
                  </span>
                  {canEdit && (
                    <span className="topic-card__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`icon-btn${t.completed ? ' icon-btn--on' : ''}`}
                        title={t.completed ? 'Mark not taught' : 'Mark taught'}
                        onClick={() => setCompletion.mutate({ id: module.id, topicId: t.id, completed: !t.completed })}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Edit topic"
                        onClick={() => setEditing({ topicId: t.id, title: t.title, description: t.description ?? '' })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        title="Delete topic"
                        onClick={() => window.confirm('Delete this topic?') && deleteTopic.mutate({ id: module.id, topicId: t.id })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-topic resources */}
      <Modal
        open={Boolean(openTopic)}
        title={openTopic ? `${openTopic.title} — Learning resources` : ''}
        onClose={() => setOpenTopic(null)}
      >
        {openTopic && <TopicResources module={module} topic={openTopic} canEdit={canEdit} />}
      </Modal>

      {/* Edit topic */}
      <Modal
        open={Boolean(editing)}
        title="Edit Topic"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button form="edit-topic-form" type="submit" loading={updateTopic.isPending}>Save</Button>
          </>
        }
      >
        {editing && (
          <form id="edit-topic-form" onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input label="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required />
            <Textarea label="Description (optional)" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </form>
        )}
      </Modal>
    </Card>
  );
}
