import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Modal, Textarea } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useRateClass } from '@/lib/classRatings';

function Stars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, color: n <= value ? 'var(--color-rating-star)' : 'var(--color-border)' }}
        >
          <Star size={34} fill={n <= value ? 'var(--color-rating-star)' : 'none'} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

/** Rate a class + leave a comment. Mandatory before joining the next class. */
export function ClassRatingModal({ pending, onClose, onRated }) {
  const rate = useRateClass();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setRating(0);
    setComment('');
    setErr('');
  }, [pending?.id]);

  if (!pending) return null;

  async function submit() {
    setErr('');
    if (!rating) return setErr('Please pick a star rating.');
    if (comment.trim().length < 3) return setErr('Please add a short comment about the class.');
    try {
      await rate.mutateAsync({ id: pending.id, rating, comment: comment.trim() });
      onRated?.();
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
    return undefined;
  }

  return (
    <Modal
      open
      title="Rate your previous class"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Later</Button>
          <Button loading={rate.isPending} onClick={submit}>Submit rating</Button>
        </>
      }
    >
      <p className="lms-muted" style={{ marginTop: 0 }}>
        You attended <strong>{pending.title}</strong>
        {pending.trainer?.name ? <> with <strong>{pending.trainer.name}</strong></> : null}. Rate it to
        continue to your next class.
      </p>
      <div style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>
        <Stars value={rating} onChange={setRating} />
      </div>
      <Textarea
        label="Your comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="What did you think of this class?"
        style={{ minHeight: '6rem' }}
      />
      {err && <span className="field__error" style={{ display: 'block', marginTop: 'var(--space-2)' }}>{err}</span>}
    </Modal>
  );
}
