import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { UserRole } from '@lms/shared';
import { Badge, Button, Card, CardHeader, FullPageSpinner, Select } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBatchAttendance, useMyAttendance } from '@/lib/attendance';
import { useBatches } from '@/lib/batches';
import { useClasses } from '@/lib/classes';
import { formatDate } from '@/lib/format';
import { RosterEditor } from './RosterEditor';
import { ATT_LABEL, ATT_TONE, pctTone } from './attendanceUi';
import '../schedule/schedule.css';

export function AttendancePage() {
  const role = useAuth((s) => s.user?.role);
  if (role === UserRole.STUDENT) return <StudentAttendanceView />;
  return <StaffAttendanceView />;
}

// ── Student: my attendance ─────────────────────────────────────────────────────

function StudentAttendanceView() {
  const { data, isLoading, isError, error } = useMyAttendance();

  if (isLoading) return <FullPageSpinner />;
  if (isError) return <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>;

  const { summary, records } = data;
  return (
    <>
      <PageHeader title="My Attendance" subtitle="Your class attendance record." />
      <div className="stat-grid">
        <Stat label="Attendance" value={`${summary.percentage}%`} accent />
        <Stat label="Classes Attended" value={`${summary.attended} / ${summary.totalClasses}`} />
        <Stat label="Late" value={summary.byStatus.late} />
        <Stat label="Absent" value={summary.byStatus.absent} />
      </div>

      <Card>
        <CardHeader title="History" />
        {records.length === 0 ? (
          <p className="lms-muted">No attendance recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Class</th><th>Module</th><th>Status</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.classSession?.date ?? r.markedAt)}</td>
                    <td>{r.classSession?.title ?? '—'}</td>
                    <td>{r.module?.name ?? '—'}</td>
                    <td><Badge tone={ATT_TONE[r.status]}>{ATT_LABEL[r.status]}</Badge></td>
                    <td className="lms-muted">{r.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Trainer / Admin: entry + compliance ────────────────────────────────────────

function StaffAttendanceView() {
  const [tab, setTab] = useState('entry');
  return (
    <>
      <PageHeader title="Attendance" subtitle="Record attendance after each class and monitor compliance." />
      <div className="toolbar">
        <div className="sched-tabs">
          <button className={`sched-tab${tab === 'entry' ? ' active' : ''}`} onClick={() => setTab('entry')}>
            Mark Attendance
          </button>
          <button className={`sched-tab${tab === 'compliance' ? ' active' : ''}`} onClick={() => setTab('compliance')}>
            Compliance
          </button>
        </div>
      </div>
      {tab === 'entry' ? <EntryView /> : <ComplianceView />}
    </>
  );
}

function EntryView() {
  const { data: classes, isLoading } = useClasses();
  const [selected, setSelected] = useState(null);

  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader title="Select a class" subtitle="Choose a session to record attendance for." />
        {!classes || classes.length === 0 ? (
          <p className="lms-muted">No classes scheduled yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Class</th><th>Batch</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.title}</td>
                    <td>{c.batch?.name}</td>
                    <td>
                      {c.attendanceMarked ? <Badge tone="success">Marked</Badge> : <Badge tone="neutral">Pending</Badge>}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={selected === c.id ? 'primary' : 'outline'}
                        onClick={() => setSelected(c.id)}
                      >
                        {c.attendanceMarked ? 'Edit' : 'Mark'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <RosterEditor classId={selected} />}
    </>
  );
}

function ComplianceView() {
  const { data: batches } = useBatches();
  const [batchId, setBatchId] = useState('');
  const { data, isLoading } = useBatchAttendance(batchId);

  return (
    <>
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <Select
          label="Batch"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          options={[
            { value: '', label: 'Select a batch…' },
            ...(batches ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
          ]}
        />
      </Card>

      {batchId && isLoading && <FullPageSpinner />}

      {data && (
        <Card>
          <CardHeader
            title={`${data.batch.name} — Attendance Compliance`}
            subtitle={`Minimum required: ${data.minAttendance}% · ${
              data.students.filter((s) => s.belowMinimum).length
            } below minimum`}
          />
          {data.students.length === 0 ? (
            <p className="lms-muted">No students enrolled.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th><th>Attended</th><th>Present</th><th>Late</th>
                    <th>Absent</th><th>Excused</th><th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.student.id}>
                      <td>
                        {s.student.name}
                        <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{s.student.email}</div>
                      </td>
                      <td>{s.attended} / {s.totalClasses}</td>
                      <td>{s.byStatus.present}</td>
                      <td>{s.byStatus.late}</td>
                      <td>{s.byStatus.absent}</td>
                      <td>{s.byStatus.excused}</td>
                      <td>
                        <Badge tone={pctTone(s.percentage, data.minAttendance)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {s.percentage}%{s.belowMinimum ? <TriangleAlert size={12} strokeWidth={2.5} /> : null}
                          </span>
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
