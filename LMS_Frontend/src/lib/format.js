/** Format an ISO date string as e.g. "01 Jan 2025". Empty string for falsy input. */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "01 Jan 2025 – 31 Jan 2025" */
export function formatDateRange(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** For <input type="date"> value (YYYY-MM-DD) from an ISO string. */
export function toDateInput(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}
