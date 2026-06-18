/**
 * Minimal, dependency-free CSV builder. Quotes any field containing a comma,
 * quote, or newline per RFC 4180, and escapes embedded quotes by doubling them.
 */
function escapeField(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string from rows.
 * @param {Array<object>} rows
 * @param {Array<{header: string, value: string | ((row: object) => unknown)}>} columns
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeField(c.header)).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => escapeField(typeof c.value === 'function' ? c.value(row) : row[c.value]))
      .join(','),
  );
  // Lead with a UTF-8 BOM so Excel opens accented characters correctly.
  return `﻿${[header, ...lines].join('\r\n')}`;
}

/** Send a CSV payload as a downloadable file. */
export function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}
