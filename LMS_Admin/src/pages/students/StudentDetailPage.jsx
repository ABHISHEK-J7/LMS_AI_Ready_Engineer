import { Link, useParams } from 'react-router-dom';
import { Check, Users, X } from 'lucide-react';
import { Badge, Card, CardHeader, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useStudentProgress } from '@/lib/progress';
import { useStudentAttendance } from '@/lib/attendance';
import { useStudentCertificates } from '@/lib/certificates';
import { levelTone, titleCase } from '@/pages/modules/moduleUi';
import { ATT_LABEL, ATT_TONE } from '@/pages/attendance/attendanceUi';
import { formatDate } from '@/lib/format';
import '@/pages/modules/modules.css';

const STATUS = {
  completed: { tone: 'success', label: 'Completed' },
  in_progress: { tone: 'primary', label: 'In progress' },
  locked: { tone: 'neutral', label: 'Locked' },
};

/** Admin/trainer drill-down: one student's progression, attendance, certificates. */
export function StudentDetailPage() {
  const { id } = useParams();
  const progress = useStudentProgress(id);
  const attendance = useStudentAttendance(id);
  const certs = useStudentCertificates(id);

  if (progress.isLoading && !progress.data) {
    return (
      <>
        <PageHeader title="Student" subtitle={<Link to="/app/users" className="lms-muted">← All users</Link>} />
        <SkeletonCards count={4} height="5rem" />
      </>
    );
  }
  if (progress.isError) {
    return (
      <>
        <PageHeader title="Student" subtitle={<Link to="/app/users" className="lms-muted">← All users</Link>} />
        <ErrorState message={apiErrorMessage(progress.error)} onRetry={progress.refetch} />
      </>
    );
  }

  const p = progress.data;
  const student = p.student;
  const att = attendance.data?.summary;
  const certificates = certs.data?.certificates ?? [];

  return (
    <>
      <PageHeader
        title={student?.name ?? 'Student'}
        subtitle={<Link to="/app/users" className="lms-muted">← All users</Link>}
      />

      <div className="stat-grid">
        <Stat label="Attendance" value={att ? `${att.percentage}%` : '—'} accent />
        <Stat label="Modules Completed" value={p.hasBatch ? `${p.completedCount} / ${p.total}` : '—'} />
        <Stat label="Certificates" value={certificates.length} />
        <Stat label="Program" value={p.eligibleForCertificate ? 'Complete' : 'In progress'} />
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader title="Curriculum progression" subtitle={p.hasBatch ? `Pass ≥ ${p.passingScore}% · attendance ≥ ${p.minAttendance}%` : undefined} />
        {!p.hasBatch ? (
          <EmptyState
            icon={<Users size={26} />}
            title="Not enrolled in a batch"
            description="This student is not enrolled in a batch."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Module</th><th>Status</th><th>Attendance</th><th>Final</th><th>Practice</th></tr>
              </thead>
              <tbody>
                {p.modules.map((m) => {
                  const s = STATUS[m.status] ?? STATUS.locked;
                  return (
                    <tr key={m.module.id}>
                      <td>{m.module.order}</td>
                      <td>{m.module.name} <Badge tone={levelTone(m.module.level)}>{titleCase(m.module.level)}</Badge></td>
                      <td><Badge tone={s.tone}>{s.label}</Badge></td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{m.attendancePercentage}% {m.attendanceMet ? <Check size={14} strokeWidth={3} style={{ color: 'var(--color-success)' }} /> : null}</span></td>
                      <td>
                        {m.finalScore !== undefined ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {m.finalScore}% {m.finalPassed ? <Check size={14} strokeWidth={3} style={{ color: 'var(--color-success)' }} /> : <X size={14} strokeWidth={3} style={{ color: 'var(--color-error)' }} />}
                          </span>
                        ) : m.hasFinal ? '—' : 'no final'}
                      </td>
                      <td>{m.practiceTestsCompleted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Attendance breakdown" />
          {!att ? (
            <p className="lms-muted">No attendance recorded.</p>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {Object.entries(att.byStatus).map(([k, v]) => (
                <Badge key={k} tone={ATT_TONE[k]}>{ATT_LABEL[k]}: {v}</Badge>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Certificates" />
          {certificates.length === 0 ? (
            <p className="lms-muted">None issued yet.</p>
          ) : (
            certificates.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span>{c.isProgramCertificate ? 'AI Ready Engineer Program' : c.module?.name}</span>
                <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{formatDate(c.issuedAt)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
