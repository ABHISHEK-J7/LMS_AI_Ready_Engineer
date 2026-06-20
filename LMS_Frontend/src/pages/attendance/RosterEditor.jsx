import { useEffect, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Input, SkeletonTable, EmptyState, ErrorState } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { useClassRoster, useSaveAttendance } from '@/lib/attendance';
import { ATT_TONE, AUTO_LABEL, autoStatus, classStartMs } from './attendanceUi';
import { formatDate } from '@/lib/format';

const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const entryTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

/**
 * Automated per-session attendance. The trainer only sets a buffer window;
 * each student's status is derived from their entry time:
 *   joined by start+buffer → On time · later → Late · never joined → Absent.
 */
export function RosterEditor({ classId, onSaved }) {
  const { data, isLoading, isError, error, refetch } = useClassRoster(classId);
  const save = useSaveAttendance();
  const [rows, setRows] = useState([]);
  const [buffer, setBuffer] = useState(10);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRows(
      data.roster.map((r) => ({
        student: r.student.id,
        name: r.student.name,
        email: r.student.email,
        joinedAt: r.joinedAt ?? null,
        remarks: r.remarks ?? '',
      })),
    );
    setBuffer(data.class.bufferMinutes ?? 10);
    setSaved(false);
  }, [data]);

  function setRemark(id, remarks) {
    setRows((rs) => rs.map((r) => (r.student === id ? { ...r, remarks } : r)));
  }

  if (isLoading && !data) return <Card><SkeletonTable rows={5} cols={4} /></Card>;
  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;

  const cls = data.class;
  const cutoffMs = classStartMs(cls.date, cls.startTime) + (Number(buffer) || 0) * 60000;
  const statusOf = (r) => autoStatus(r.joinedAt, cls.date, cls.startTime, buffer);
  const counts = rows.reduce((acc, r) => {
    const s = statusOf(r);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  async function submit() {
    setSaveError('');
    try {
      await save.mutateAsync({
        classId,
        bufferMinutes: Number(buffer) || 0,
        records: rows.map((r) => ({
          student: r.student,
          status: statusOf(r),
          remarks: r.remarks || undefined,
        })),
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setSaveError(apiErrorMessage(e));
    }
  }

  return (
    <Card>
      <CardHeader
        title={`Attendance — ${cls.title}`}
        subtitle={`${formatDate(cls.date)} · starts ${cls.startTime} · ${rows.length} students${cls.attendanceMarked ? ' · already marked' : ''}`}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No students enrolled"
          description="No students enrolled in this batch yet."
        />
      ) : (
        <>
          {/* Buffer window — the only thing the trainer sets; status is automatic. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="field__label">Buffer time (minutes)</span>
              <Input
                type="number"
                min="0"
                max="240"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                style={{ width: '7rem' }}
              />
            </div>
            <p className="lms-muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)', flex: 1, minWidth: 0, lineHeight: 1.6 }}>
              Joined by <strong>{fmtTime(cutoffMs)}</strong> (start {cls.startTime} + {Number(buffer) || 0} min) counts as{' '}
              <strong>On time</strong>. Later → <strong>Late</strong>. No entry → <strong>Absent</strong>.
            </p>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Entry Time</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = statusOf(r);
                  return (
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
                          <span className="lms-muted" title="Did not join the video">—</span>
                        )}
                      </td>
                      <td><Badge tone={ATT_TONE[status]}>{AUTO_LABEL[status]}</Badge></td>
                      <td>
                        <Input
                          placeholder="Optional…"
                          value={r.remarks}
                          onChange={(e) => setRemark(r.student, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button onClick={submit} loading={save.isPending}>Save attendance</Button>
            <span className="lms-secondary-text" style={{ fontSize: 'var(--font-size-sm)' }}>
              {counts.present ?? 0} on time · {counts.late ?? 0} late · {counts.absent ?? 0} absent
            </span>
            {saved && (
              <span style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-sm)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={15} strokeWidth={3} /> Saved
              </span>
            )}
            {saveError && <span className="field__error">{saveError}</span>}
          </div>
        </>
      )}
    </Card>
  );
}
