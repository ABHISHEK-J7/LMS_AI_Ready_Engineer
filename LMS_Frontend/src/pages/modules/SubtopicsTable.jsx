import { useEffect, useRef, useState } from 'react';
import { ListChecks, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';

const toInput = (v) => (v ? String(v).slice(0, 10) : ''); // ISO → yyyy-mm-dd
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** A textarea that grows to fit its content, so all the text is visible while typing. */
function AutoTextarea({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const fit = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(() => { fit(ref.current); }, [value]);
  return (
    <textarea
      ref={ref}
      className="input subtopic-grow"
      rows={1}
      placeholder={placeholder}
      value={value}
      onChange={(e) => { onChange(e); fit(e.target); }}
    />
  );
}

/** Inclusive day span between two yyyy-mm-dd dates (or null). */
function daySpan(from, to) {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

const asRows = (subs) => subs.map((s) => ({ title: s.title ?? '', fromDate: toInput(s.fromDate), toDate: toInput(s.toDate) }));

// Migration: if the topic has no shared deliverables yet, seed it from any old
// per-subtopic descriptions so nothing that was already typed is lost.
const seedDeliverables = (contentDeliverables, subs) =>
  (contentDeliverables && contentDeliverables.trim())
    ? contentDeliverables
    : subs.map((s) => s.description).filter(Boolean).join('\n');

/**
 * A topic's concept breakdown: a NUMBERED list of subtopics (each with its own
 * From/To dates) plus ONE shared "Content deliverables" note for the whole topic.
 *  - Staff (canEdit): editable rows + add/remove, a shared deliverables box, Save.
 *  - Students (read-only): a clean numbered schedule + the deliverables note.
 */
export function SubtopicsTable({ subtopics = [], contentDeliverables = '', canEdit = false, onSave, saving = false }) {
  const [rows, setRows] = useState(() => asRows(subtopics));
  const [deliverables, setDeliverables] = useState(() => seedDeliverables(contentDeliverables, subtopics));

  useEffect(() => {
    setRows(asRows(subtopics));
    setDeliverables(seedDeliverables(contentDeliverables, subtopics));
  }, [subtopics, contentDeliverables]);

  const baseRows = asRows(subtopics);
  const baseDeliverables = seedDeliverables(contentDeliverables, subtopics);
  const dirty = JSON.stringify(rows) !== JSON.stringify(baseRows) || deliverables !== baseDeliverables;

  const setAt = (i, patch) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { title: '', fromDate: '', toDate: '' }]);
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  const save = () =>
    onSave?.({
      subtopics: rows
        .map((r) => ({ title: r.title.trim(), fromDate: r.fromDate || null, toDate: r.toDate || null }))
        .filter((r) => r.title),
      contentDeliverables: deliverables.trim(),
    });

  // ── Read-only (student) view ────────────────────────────────────────────────
  if (!canEdit) {
    return (
      <>
        {subtopics.length === 0 ? (
          <p className="lms-muted" style={{ margin: 0 }}>No concepts listed for this topic yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table subtopics-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th className="col-sub">Subtopics</th>
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
                      <td className="lms-muted">{fmtDate(s.fromDate) || '—'}</td>
                      <td className="lms-muted">{fmtDate(s.toDate) || '—'}</td>
                      <td>{span ? <span className="day-pill">{span} day{span === 1 ? '' : 's'}</span> : <span className="lms-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {baseDeliverables.trim() && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <div className="lms-secondary-text" style={{ fontWeight: 'var(--font-weight-semibold)', marginBottom: 4 }}>Content deliverables</div>
            <p className="lms-secondary-text" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{baseDeliverables}</p>
          </div>
        )}
      </>
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
              <th className="col-date">From</th>
              <th className="col-date">To</th>
              <th className="col-act" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="lms-muted" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No subtopics yet — add the first one.</td></tr>
            ) : (
              rows.map((r, i) => {
                const span = daySpan(r.fromDate, r.toDate);
                return (
                  <tr key={i}>
                    <td className="lms-muted">{i + 1}</td>
                    <td><AutoTextarea placeholder="e.g. Firefly" value={r.title} onChange={(e) => setAt(i, { title: e.target.value })} /></td>
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

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Textarea
          label="Content deliverables — one shared note for the whole topic"
          rows={4}
          placeholder="What the trainer delivers for this topic (applies to all the subtopics above)…"
          value={deliverables}
          onChange={(e) => setDeliverables(e.target.value)}
        />
      </div>

      <div className="subtopics-edit__actions">
        <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus size={15} /> Add subtopic</Button>
        <Button type="button" size="sm" onClick={save} loading={saving} disabled={!dirty}><Save size={15} /> Save</Button>
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
