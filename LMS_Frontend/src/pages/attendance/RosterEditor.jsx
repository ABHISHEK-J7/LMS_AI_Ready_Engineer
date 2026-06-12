import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { AttendanceStatus } from '@lms/shared';
import { Button, Card, CardHeader, FullPageSpinner, Input, Select } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useClassRoster, useSaveAttendance } from '@/lib/attendance';
import { formatDate } from '@/lib/format';

const entryTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

const ATTENDED_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
];
const PUNCTUAL_OPTIONS = [
  { value: 'ontime', label: 'On time' },
  { value: 'late', label: 'Late' },
];

// Saved enum status <-> the two UI dimensions (attended + punctuality).
function toUi(status) {
  if (status === AttendanceStatus.ABSENT || status === AttendanceStatus.EXCUSED)
    return { attended: 'absent', punctual: 'ontime' };
  if (status === AttendanceStatus.LATE) return { attended: 'present', punctual: 'late' };
  return { attended: 'present', punctual: 'ontime' }; // present / default
}
function toStatus(attended, punctual) {
  if (attended === 'absent') return AttendanceStatus.ABSENT;
  return punctual === 'late' ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
}

/** Per-session attendance entry: one row per enrolled student. */
export function RosterEditor({ classId, onSaved }) {
  const { data, isLoading, isError, error } = useClassRoster(classId);
  const save = useSaveAttendance();
  const [rows, setRows] = useState([]);
  const original = useRef([]); // previously-saved values, for the quick-set toggle
  const [bulk, setBulk] = useState(null); // which "All …" is currently applied
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    // Default unmarked students to Present so a trainer can save fast.
    const mapped = data.roster.map((r) => ({
      student: r.student.id,
      name: r.student.name,
      email: r.student.email,
      joinedAt: r.joinedAt ?? null,
      ...toUi(r.status ?? AttendanceStatus.PRESENT),
      remarks: r.remarks ?? '',
    }));
    setRows(mapped);
    original.current = mapped;
    setBulk(null);
    setSaved(false);
  }, [data]);

  function setRow(id, patch) {
    setRows((rs) => rs.map((r) => (r.student === id ? { ...r, ...patch } : r)));
    setBulk(null); // a manual edit ends the active "All …" toggle
  }

  // Quick-set toggle: first click sets everyone to that attendance; clicking the
  // SAME button again restores each student's previously-saved status.
  function quickSet(attended) {
    if (bulk === attended) {
      setRows(original.current);
      setBulk(null);
    } else {
      setRows((rs) => rs.map((r) => ({ ...r, attended })));
      setBulk(attended);
    }
  }

  async function submit() {
    setSaveError('');
    try {
      await save.mutateAsync({
        classId,
        records: rows.map((r) => ({
          student: r.student,
          status: toStatus(r.attended, r.punctual),
          remarks: r.remarks || undefined,
        })),
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setSaveError(apiErrorMessage(e));
    }
  }

  if (isLoading) return <FullPageSpinner />;
  if (isError) return <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>;

  return (
    <Card>
      <CardHeader
        title={`Attendance — ${data.class.title}`}
        subtitle={`${formatDate(data.class.date)} · ${rows.length} students${data.class.attendanceMarked ? ' · already marked' : ''}`}
      />

      {rows.length === 0 ? (
        <p className="lms-muted">No students enrolled in this batch yet.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)', alignSelf: 'center' }}>
              Quick set:
            </span>
            {ATTENDED_OPTIONS.map((o) => (
              <Button
                key={o.value}
                size="sm"
                variant={bulk === o.value ? 'primary' : 'outline'}
                onClick={() => quickSet(o.value)}
                title={bulk === o.value ? 'Click again to restore saved statuses' : ''}
              >
                All {o.label}
              </Button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th style={{ width: 110 }}>Entry Time</th>
                  <th style={{ width: 140 }}>Attended</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student}>
                    <td>
                      {r.name}
                      <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{r.email}</div>
                    </td>
                    <td>
                      {entryTime(r.joinedAt) ? (
                        <span style={{ fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                          {entryTime(r.joinedAt)}
                        </span>
                      ) : (
                        <span className="lms-muted" title="Has not joined the video yet">—</span>
                      )}
                    </td>
                    <td>
                      <Select
                        value={r.attended}
                        onChange={(e) => setRow(r.student, { attended: e.target.value })}
                        options={ATTENDED_OPTIONS}
                      />
                    </td>
                    <td>
                      <Select
                        value={r.punctual}
                        onChange={(e) => setRow(r.student, { punctual: e.target.value })}
                        options={PUNCTUAL_OPTIONS}
                        disabled={r.attended === 'absent'}
                      />
                    </td>
                    <td>
                      <Input
                        placeholder="Optional…"
                        value={r.remarks}
                        onChange={(e) => setRow(r.student, { remarks: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Button onClick={submit} loading={save.isPending}>
              Save attendance
            </Button>
            {saved && <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={15} strokeWidth={3} /> Saved</span>}
            {saveError && <span className="field__error">{saveError}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
