// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { distribute, pickEvenlyByTopic } from '@/pages/assessments/bankRandom';

// Build `count` fake questions for a topic id.
const qs = (topic, count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: `${topic}-${offset + i}`, topic }));

describe('distribute', () => {
  it('splits evenly when divisible', () => {
    expect(distribute(10, 2)).toEqual([5, 5]);
  });
  it('front-loads the remainder', () => {
    expect(distribute(10, 3)).toEqual([4, 3, 3]);
    expect(distribute(7, 2)).toEqual([4, 3]);
  });
  it('handles one bucket', () => {
    expect(distribute(10, 1)).toEqual([10]);
  });
});

describe('pickEvenlyByTopic', () => {
  const topics = [{ topic: 'A' }, { topic: 'B' }];

  it('takes an equal number from each topic (10 → 5 + 5)', () => {
    const available = [...qs('A', 10), ...qs('B', 10)];
    const picks = pickEvenlyByTopic(available, topics, 10);
    expect(picks).toHaveLength(10);
    const a = picks.filter((id) => id.startsWith('A-')).length;
    const b = picks.filter((id) => id.startsWith('B-')).length;
    expect(a).toBe(5);
    expect(b).toBe(5);
  });

  it('samples WITHOUT replacement (no duplicates)', () => {
    const available = [...qs('A', 10), ...qs('B', 10)];
    const picks = pickEvenlyByTopic(available, topics, 10);
    expect(new Set(picks).size).toBe(picks.length);
  });

  it('only picks from the provided (available) pool', () => {
    const available = [...qs('A', 10), ...qs('B', 10)];
    const ids = new Set(available.map((q) => q.id));
    const picks = pickEvenlyByTopic(available, topics, 10);
    for (const id of picks) expect(ids.has(id)).toBe(true);
  });

  it('redistributes when one topic is short, still reaching n', () => {
    const available = [...qs('A', 2), ...qs('B', 10)]; // A can only give 2
    const picks = pickEvenlyByTopic(available, topics, 10);
    expect(picks).toHaveLength(10);
    expect(picks.filter((id) => id.startsWith('A-')).length).toBe(2);
    expect(picks.filter((id) => id.startsWith('B-')).length).toBe(8);
    expect(new Set(picks).size).toBe(10); // still no duplicates
  });

  it('caps at what exists overall when the pool is too small', () => {
    const available = [...qs('A', 2), ...qs('B', 3)];
    const picks = pickEvenlyByTopic(available, topics, 10);
    expect(picks).toHaveLength(5);
    expect(new Set(picks).size).toBe(5);
  });

  it('splits across three topics (10 → 4 + 3 + 3)', () => {
    const three = [{ topic: 'A' }, { topic: 'B' }, { topic: 'C' }];
    const available = [...qs('A', 10), ...qs('B', 10), ...qs('C', 10)];
    const picks = pickEvenlyByTopic(available, three, 10);
    const counts = ['A', 'B', 'C'].map((t) => picks.filter((id) => id.startsWith(`${t}-`)).length).sort();
    expect(counts).toEqual([3, 3, 4]);
    expect(picks).toHaveLength(10);
  });
});
