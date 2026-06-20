import { useEffect, useState } from 'react';
import { ListChecks, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';

const toInput = (v) => (v ? String(v).slice(0, 10) : ''); // ISO → yyyy-mm-dd
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Inclusive day span between two yyyy-mm-dd dates (or null). */
function daySpan(from, to) {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

const asRows = (subs) =>
  subs.map((s) => ({ title: s.title ?? '', description: s.description ?? '', fromDate: toInput(s.fromDate), toDate: toInput(s.toDate) }));

/**
 * The concept breakdown for one topic — a polished table of subtopics, each with
 * a name, the content delivered in class, and the From/To dates it was covered
 * over (and the resulting day span).
 *  - Staff (canEdit): inline-editable rows + add/remove + Save.
 *  - Students (read-only): a clean schedule of concepts to view.
 */
export function SubtopicsTable({ subtopics = [], canEdit = false, onSave, saving = false }) {
  const [rows, setRows] = useState(() => asRows(subtopics));

  useEffect(() => { setRows(asRows(subtopics)); }, [subtopics]);

  const dirty = JSON.stringify(rows) !== JSON.stringify(asRows(subtopics));
  const setAt = (i, patch) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { title: '', description: '', fromDate: '', toDate: '' }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const save = () =>
    onSave?.(
      rows
        .map((r) => ({ title: r.title.trim(), description: r.description.trim(), fromDate: r.fromDate || null, toDate: r.toDate || null }))
        .filter((r) => r.title || r.description),
    );

  // ── Read-only (student) view ────────────────────────────────────────────────
  if (!canEdit) {
    if (!subtopics.length) {
      return <p className="lms-muted" style={{ margin: 0 }}>No concepts listed for this topic yet.</p>;
    }
    return (
      <div className="table-wrap">
        <table className="table subtopics-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-sub">Subtopics</th>
              <th>Content deliverables</th>
              <th className="col-date">From</th>
              <th className="col-date">To</th>
              <th className="col-days">Days</th>
            </tr>
          </thead>
          <tbody>
            {subtopics.map((s, i) => {
              const span = daySpan(toInput(s.fromDate), toInput(s.toDate));
              return (
                <tr key={s.id ?? i}>
                  <td className="lms-muted">{i + 1}</td>
                  <td className="subtopics-table__name">{s.title || '—'}</td>
                  <td>{s.description || '—'}</td>
                  <td className="lms-muted">{fmtDate(s.fromDate) || '—'}</td>
                  <td className="lms-muted">{fmtDate(s.toDate) || '—'}</td>
                  <td>{span ? <span className="day-pill">{span} day{span === 1 ? '' : 's'}</span> : <span className="lms-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Editable (staff) view ───────────────────────────────────────────────────
  return (
    <div className="subtopics-edit">
      <div className="table-wrap">
        <table className="table subtopics-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-sub">Subtopics</th>
              <th>Content deliverables</th>
              <th className="col-date">From</th>
              <th className="col-date">To</th>
              <th className="col-act" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="lms-muted" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No concepts yet — add the first one.</td></tr>
            ) : (
              rows.map((r, i) => {
                const span = daySpan(r.fromDate, r.toDate);
                return (
                  <tr key={i}>
                    <td className="lms-muted">{i + 1}</td>
                    <td><Input placeholder="e.g. Embeddings" value={r.title} onChange={(e) => setAt(i, { title: e.target.value })} /></td>
                    <td><Textarea rows={2} placeholder="What the trainer delivers in class…" value={r.description} onChange={(e) => setAt(i, { description: e.target.value })} /></td>
                    <td><Input type="date" value={r.fromDate} onChange={(e) => setAt(i, { fromDate: e.target.value })} /></td>
                    <td>
                      <Input type="date" value={r.toDate} min={r.fromDate || undefined} onChange={(e) => setAt(i, { toDate: e.target.value })} />
                      {span && <div className="subtopics-table__span">{span} day{span === 1 ? '' : 's'}</div>}
                    </td>
                    <td>
                      <button type="button" className="icon-btn icon-btn--danger" title="Remove" onClick={() => removeRow(i)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="subtopics-edit__actions">
        <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus size={15} /> Add concept</Button>
        <Button type="button" size="sm" onClick={save} loading={saving} disabled={!dirty}><Save size={15} /> Save concepts</Button>
      </div>
    </div>
  );
}

/** Tiny inline header used above the table in the topic modal. */
export function SubtopicsHeader({ count }) {
  return (
    <div className="subtopics-head">
      <ListChecks size={16} strokeWidth={2} />
      <span>Concepts</span>
      <span className="res-group__count">{count}</span>
    </div>
  );
}
