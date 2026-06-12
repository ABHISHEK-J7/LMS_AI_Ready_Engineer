import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AttendanceStatus } from '@lms/shared';
import { Button, Card, CardHeader, FullPageSpinner, Input, Select } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useClassRoster, useSaveAttendance } from '@/lib/attendance';
import { ATT_OPTIONS } from './attendanceUi';
import { formatDate } from '@/lib/format';

/** Per-session attendance entry: one row per enrolled student. */
export function RosterEditor({ classId, onSaved }) {
  const { data, isLoading, isError, error } = useClassRoster(classId);
  const save = useSaveAttendance();
  const [rows, setRows] = useState([]);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    // Default unmarked students to Present so a trainer can save fast.
    setRows(
      data.roster.map((r) => ({
        student: r.student.id,
        name: r.student.name,
        email: r.student.email,
        status: r.status ?? AttendanceStatus.PRESENT,
        remarks: r.remarks ?? '',
      })),
    );
    setSaved(false);
  }, [data]);

  function setRow(id, patch) {
    setRows((rs) => rs.map((r) => (r.student === id ? { ...r, ...patch } : r)));
  }
  function setAll(status) {
    setRows((rs) => rs.map((r) => ({ ...r, status })));
  }

  async function submit() {
    setSaveError('');
    try {
      await save.mutateAsync({
        classId,
        records: rows.map((r) => ({ student: r.student, status: r.status, remarks: r.remarks || undefined })),
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
            {ATT_OPTIONS.map((o) => (
              <Button key={o.value} size="sm" variant="outline" onClick={() => setAll(o.value)}>
                All {o.label}
              </Button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th style={{ width: 160 }}>Status</th>
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
                      <Select value={r.status} onChange={(e) => setRow(r.student, { status: e.target.value })} options={ATT_OPTIONS} />
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
