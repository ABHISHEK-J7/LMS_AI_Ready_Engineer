import { useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { QuestionType } from '@/shared';
import { Badge, Button, EmptyState, SkeletonText } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useQuestionBank } from '@/lib/questionBank';
import { useAddQuestionsFromBank } from '@/lib/assessments';
import { QUESTION_TYPE_LABEL } from './assessmentsUi';

/**
 * Hand-pick questions from the module's bank to add to a test. Topic-scoped
 * practice tests only show that topic's questions; otherwise the whole bank.
 * Questions already in the test (by source id) are filtered out.
 */
export function BankPicker({ assessment, onClose }) {
  const moduleId = assessment.module?.id ?? assessment.module;
  const { data: items, isLoading } = useQuestionBank({ module: moduleId, topic: assessment.topic || undefined });
  const addFromBank = useAddQuestionsFromBank();
  const [selected, setSelected] = useState(() => new Set());
  const [err, setErr] = useState('');

  const alreadyAdded = new Set((assessment.questions ?? []).map((q) => q.sourceId).filter(Boolean));
  const available = (items ?? []).filter((q) => !alreadyAdded.has(q.id));

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function add() {
    setErr('');
    try {
      await addFromBank.mutateAsync({ id: assessment.id, questionIds: [...selected] });
      onClose();
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <SkeletonText lines={5} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p className="lms-muted" style={{ margin: 0 }}>
        {assessment.topic
          ? <>Bank questions for <strong>{assessment.topicTitle}</strong>.</>
          : 'All bank questions for this module.'}
      </p>
      {available.length === 0 ? (
        <EmptyState
          icon={<FileQuestion size={26} />}
          title="No bank questions available"
          description={`No more bank questions available${assessment.topic ? ' for this topic' : ''}. Add questions in the Question Bank first.`}
        />
      ) : (
        <div className="q-list" style={{ maxHeight: '26rem', overflowY: 'auto' }}>
          {available.map((q) => (
            <label key={q.id} className="q-item" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
              <div className="q-item__body">
                <div className="q-item__prompt">{q.prompt}</div>
                <div className="q-item__meta">
                  <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.type]}</Badge>
                  {q.topicTitle && <Badge tone="primary">{q.topicTitle}</Badge>}
                  <span className="lms-muted">{q.points} pt{q.points > 1 ? 's' : ''}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
      {err && <span className="field__error">{err}</span>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={add} loading={addFromBank.isPending} disabled={selected.size === 0}>
          Add {selected.size || ''} question{selected.size === 1 ? '' : 's'}
        </Button>
      </div>
    </div>
  );
}
