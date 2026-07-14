import { useState } from 'react';
import { BookOpen, FileSpreadsheet, Layers, Library, ListChecks, Pencil, Trash2 } from 'lucide-react';
import { Button, Card, CardHeader, Input, Modal, Textarea, useConfirm, useToast } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import {
  useAddTopic,
  useDeleteTopic,
  useImportSyllabusFromMaster,
  useUpdateTopic,
} from '@/lib/modules';
import { useResources } from '@/lib/resources';
import { TopicResources } from './TopicResources';
import { SubtopicsTable, SubtopicsHeader } from './SubtopicsTable';
import { AddSyllabusModal } from './AddSyllabusModal';

/**
 * Syllabus as a board of topic cards. Each card opens that topic's concepts
 * (subtopics + descriptions) and learning resources in a modal. Staff can bulk
 * import the whole syllabus from an Excel sheet ("Add syllabus").
 */
export function SyllabusBoard({ module, canEdit, canImportFromMaster = false }) {
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(null); // { topicId, title, description }
  const [openTopicId, setOpenTopicId] = useState(null);
  const [addSyllabusOpen, setAddSyllabusOpen] = useState(false);
  const addTopic = useAddTopic();
  const updateTopic = useUpdateTopic();
  const deleteTopic = useDeleteTopic();
  const importSyllabus = useImportSyllabusFromMaster();
  const confirm = useConfirm();
  const toast = useToast();
  const { data: resources } = useResources(module.id);

  async function onImportFromMaster() {
    const okToGo = await confirm({
      title: 'Import syllabus from the master?',
      message: 'This replaces this module’s topics, subtopics and descriptions with the master curriculum’s. This can’t be undone.',
      confirmLabel: 'Import & replace',
      tone: 'danger',
    });
    if (!okToGo) return;
    try {
      await importSyllabus.mutateAsync(module.id);
      toast.success('Master syllabus imported.');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function onDeleteTopic(topicId) {
    if (await confirm({ title: 'Delete this topic?', message: 'Its concepts and resource links will be removed.', confirmLabel: 'Delete', tone: 'danger' })) {
      deleteTopic.mutate({ id: module.id, topicId });
    }
  }

  // Derive the open topic from the live module so it stays fresh after edits.
  const openTopic = module.topics.find((t) => t.id === openTopicId) ?? null;
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

  const saveSubtopics = (subtopics) =>
    updateTopic.mutateAsync({ id: module.id, topicId: openTopicId, subtopics });

  return (
    <Card>
      <div className="panel-head">
        <CardHeader
          title="Syllabus"
          subtitle="Click a topic to add its concepts, videos, documents, presentations & links"
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          {canImportFromMaster && (
            <Button variant="outline" onClick={onImportFromMaster} loading={importSyllabus.isPending}>
              <Library size={15} style={{ marginRight: 6 }} /> Import from Master
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setAddSyllabusOpen(true)}>
              <FileSpreadsheet size={15} style={{ marginRight: 6 }} /> Add syllabus
            </Button>
          )}
        </div>
      </div>

      {canEdit && (
        <form className="add-inline" onSubmit={add} style={{ marginBottom: 'var(--space-5)', justifyContent: 'flex-start', flex: '0 0 auto' }}>
          <Input placeholder="New topic…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Button type="submit" variant="outline" loading={addTopic.isPending}>Add topic</Button>
        </form>
      )}

      {module.topics.length === 0 ? (
        <p className="lms-muted">No topics yet. Add a topic, or import the whole syllabus from Excel with “Add syllabus”.</p>
      ) : (
        <div className="topic-board">
          {module.topics.map((t) => {
            const count = countFor(t.id);
            const subs = t.subtopics?.length ?? 0;
            return (
              <div
                className="topic-card"
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenTopicId(t.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') setOpenTopicId(t.id); }}
              >
                {/* Row 1 — book icon + topic name (wraps to max 2 lines) */}
                <div className="topic-card__head">
                  <span className="topic-card__icon"><BookOpen size={16} strokeWidth={2} /></span>
                  <div className="topic-card__title">{t.title}</div>
                </div>
                {/* Row 2 — concepts count */}
                <div className="topic-card__row">
                  <span className="topic-card__count">
                    <ListChecks size={13} /> {subs} concept{subs === 1 ? '' : 's'}
                  </span>
                </div>
                {/* Row 3 — materials count + actions */}
                <div className="topic-card__row topic-card__row--last">
                  <span className="topic-card__count">
                    <Layers size={13} /> {count} material{count === 1 ? '' : 's'}
                  </span>
                  {canEdit && (
                    <span className="topic-card__actions" onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => onDeleteTopic(t.id)}
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

      {/* Per-topic concepts + resources */}
      <Modal
        open={Boolean(openTopic)}
        title={openTopic ? openTopic.title : ''}
        size="xl"
        onClose={() => setOpenTopicId(null)}
      >
        {openTopic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <section>
              <SubtopicsHeader count={openTopic.subtopics?.length ?? 0} />
              <SubtopicsTable
                subtopics={openTopic.subtopics ?? []}
                canEdit={canEdit}
                onSave={saveSubtopics}
                saving={updateTopic.isPending}
              />
            </section>
            <section>
              <TopicResources module={module} topic={openTopic} canEdit={canEdit} />
            </section>
          </div>
        )}
      </Modal>

      {/* Bulk syllabus import (Excel) */}
      <Modal open={addSyllabusOpen} title="Add syllabus from Excel" size="lg" onClose={() => setAddSyllabusOpen(false)}>
        <AddSyllabusModal module={module} onClose={() => setAddSyllabusOpen(false)} />
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
