/**
 * Random question selection for the bank picker, shared evenly across a test's
 * topics. Pure functions (no React) so they can be unit-tested.
 */

/** Fisher–Yates shuffle (returns a new array; input untouched). */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Split `n` into `k` parts as evenly as possible, e.g. (10,3) → [4,3,3]. */
export function distribute(n, k) {
  const base = Math.floor(n / k);
  let rem = n % k;
  return Array.from({ length: k }, () => base + (rem-- > 0 ? 1 : 0));
}

/**
 * Pick `n` question ids at random, shared evenly across `topics` (each `{topic}`),
 * sampling WITHOUT replacement — every question is picked at most once. If a topic
 * can't fill its share, the shortfall is drawn from the other topics' leftovers so
 * the total still reaches `n` whenever enough questions exist overall.
 *
 * @param {Array<{id:string, topic:string}>} available  candidate questions
 * @param {Array<{topic:string}>} topics                the test's topics
 * @param {number} n                                    how many to pick in total
 * @returns {string[]} the chosen question ids
 */
export function pickEvenlyByTopic(available, topics, n) {
  const per = distribute(n, topics.length);
  const picks = [];
  const leftovers = [];
  topics.forEach((t, i) => {
    const pool = shuffle(available.filter((q) => String(q.topic) === String(t.topic)));
    const take = Math.min(per[i], pool.length);
    picks.push(...pool.slice(0, take).map((q) => q.id));
    leftovers.push(...pool.slice(take).map((q) => q.id));
  });
  const shortfall = n - picks.length;
  if (shortfall > 0) picks.push(...shuffle(leftovers).slice(0, shortfall));
  return picks;
}
