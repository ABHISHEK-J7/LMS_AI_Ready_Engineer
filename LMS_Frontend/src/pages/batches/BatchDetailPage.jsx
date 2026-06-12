import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { Badge, Card, CardHeader, FullPageSpinner, Modal } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useBatch, useSetTopicTaught } from '@/lib/batches';
import { useModule } from '@/lib/modules';
import { formatDateRange } from '@/lib/format';
import { levelTone, titleCase } from '@/pages/modules/moduleUi';
import '../modules/modules.css';

/** Set of topic ids already marked taught for a module in this batch. */
function taughtSet(batch, moduleId) {
  const entry = (batch.taughtTopics ?? []).find((tt) => (tt.module?.id ?? tt.module) === moduleId);
  return new Set((entry?.topics ?? []).map(String));
}

/** Trainer's view of a batch they're assigned to — mark which topics they've taught. */
export function BatchDetailPage() {
  const { id } = useParams();
  const { data: batch, isLoading, isError, error } = useBatch(id);
  const [topicModule, setTopicModule] = useState(null); // module whose topics we're ticking

  if (isLoading) return <FullPageSpinner />;
  if (isError || !batch) {
    return (
      <Card>
        <p className="field__error">{apiErrorMessage(error) || 'Batch not found'}</p>
        <Link to="/app/batches">← Back to batches</Link>
      </Card>
    );
  }

  const students = batch.students ?? [];
  const trainers = batch.trainers ?? [];
  const modules = (batch.modules ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
      </div>

      {/* Students + Trainers side by side, equal cards */}
      <div className="batch-grid-two">
        <Card>
          <CardHeader title={`Students (${students.length})`} subtitle="Enrolled in this batch" />
          {students.length === 0 ? (
            <p className="lms-muted">No students enrolled yet.</p>
          ) : (
            <div className="chip-list">
              {students.map((s) => (
                <span className="chip chip--lg" key={s.id}>{s.name}</span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={`Trainers (${trainers.length})`} subtitle="Delivering this batch" />
          {trainers.length === 0 ? (
            <p className="lms-muted">No trainers assigned yet.</p>
          ) : (
            <div className="chip-list">
              {trainers.map((t) => (
                <span className="chip chip--lg" key={t.id}>{t.name}</span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modules — open one to mark the topics you've taught for THIS batch */}
      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardHeader title={`Modules (${modules.length})`} subtitle="Open a module to tick the topics you've taught this batch" />
        {modules.length === 0 ? (
          <p className="lms-muted">No modules assigned to this batch yet.</p>
        ) : (
          <div className="module-list">
            {modules.map((m) => {
              const taughtCount = taughtSet(batch, m.id).size;
              return (
                <button type="button" key={m.id} className="module-row-link" onClick={() => setTopicModule(m)}>
                  <span className="module-card__order">{m.order}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="module-card__name">{m.name}</div>
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{m.code}</div>
                  </div>
                  {taughtCount > 0 && (
                    <span className="chip" style={{ fontSize: 'var(--font-size-xs)' }}>{taughtCount} taught</span>
                  )}
                  {m.level && <Badge tone={levelTone(m.level)}>{titleCase(m.level)}</Badge>}
                  <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flex: 'none' }} />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(topicModule)}
        title={topicModule ? `${topicModule.name} — Topics taught` : ''}
        onClose={() => setTopicModule(null)}
      >
        {topicModule && <TopicTaughtPanel batch={batch} module={topicModule} />}
      </Modal>
    </>
  );
}

function TopicTaughtPanel({ batch, module }) {
  const { data: full, isLoading } = useModule(module.id);
  const setTaught = useSetTopicTaught();
  const taught = taughtSet(batch, module.id);
  const topics = (full?.topics ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (isLoading) return <FullPageSpinner />;
  if (topics.length === 0) {
    return <p className="lms-muted">This module has no syllabus topics yet.</p>;
  }

  return (
    <div>
      <p className="lms-muted" style={{ marginTop: 0, fontSize: 'var(--font-size-sm)' }}>
        Tick a topic once you&apos;ve taught it to <strong>{batch.name}</strong>. {taught.size}/{topics.length} taught.
      </p>
      {topics.map((t) => {
        const isTaught = taught.has(String(t.id));
        return (
          <div className="topic-row" key={t.id}>
            <button
              type="button"
              className={`topic-check${isTaught ? ' done' : ''}`}
              aria-label={isTaught ? 'Mark not taught' : 'Mark taught'}
              disabled={setTaught.isPending}
              onClick={() => setTaught.mutate({ id: batch.id, moduleId: module.id, topicId: t.id, taught: !isTaught })}
            >
              {isTaught ? <Check size={14} strokeWidth={3} /> : null}
            </button>
            <div className={`topic-row__title${isTaught ? ' done' : ''}`}>
              {t.order}. {t.title}
              {t.description && (
                <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{t.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
