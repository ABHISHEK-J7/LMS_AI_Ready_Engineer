import { CalendarCheck, Compass, GraduationCap, Percent } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth';
import { useMyAttendance } from '@/lib/attendance';
import { useClasses, useJoinClass } from '@/lib/classes';
import { useMyProgress } from '@/lib/progress';
import { classHasEnded, todayISO } from '@/pages/schedule/scheduleUi';
import { AttendanceHeatmap } from './AttendanceHeatmap';

export function StudentDashboard() {
  const user = useAuth((s) => s.user);
  const { data: attendance } = useMyAttendance();
  const { data: upcoming } = useClasses({ from: todayISO() });
  const { data: progress } = useMyProgress();
  const joinClass = useJoinClass();

  const pct = attendance ? `${attendance.summary.percentage}%` : '—%';
  const attended = attendance
    ? `${attendance.summary.attended} / ${attendance.summary.totalClasses}`
    : '—';
  const next = (upcoming ?? []).slice(0, 4);

  const modulesDone = progress ? `${progress.completedCount} / ${progress.total}` : '—';
  const currentModule =
    progress?.modules?.find((m) => m.status === 'in_progress')?.module.name ?? '—';

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] ?? 'Student'}`}
        subtitle="Track your AI engineering journey from Beginner to Expert."
      />

      <div className="dash-stack">
      <div className="stat-grid">
        <Stat label="Attendance" value={pct} accent icon={<Percent size={20} />} />
        <Stat label="Classes Attended" value={attended} icon={<CalendarCheck size={20} />} />
        <Stat label="Modules Completed" value={modulesDone} icon={<GraduationCap size={20} />} />
        <Stat label="Current Module" value={currentModule} icon={<Compass size={20} />} />
      </div>

      <AttendanceHeatmap records={attendance?.records} />

      <div className="dash-grid-2">
        <Card>
          <CardHeader title="Upcoming Classes" subtitle="Your scheduled live sessions" />
          {next.length === 0 ? (
            <p className="lms-muted">No upcoming classes scheduled.</p>
          ) : (
            next.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ flex: 1 }}>
                  {c.title}
                  <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · {c.startTime}–{c.endTime}
                  </div>
                </span>
                {c.meetingLink && !classHasEnded(c) ? (
                  <a href={c.meetingLink} target="_blank" rel="noreferrer" onClick={() => joinClass.mutate(c.id)}>
                    <Badge tone="primary">Join</Badge>
                  </a>
                ) : classHasEnded(c) ? (
                  <Badge tone="neutral">Ended</Badge>
                ) : null}
              </div>
            ))
          )}
        </Card>
        <Card>
          <CardHeader title="Unlocked Assessments" subtitle="Released by your trainer" />
          <p className="lms-muted">
            Assessments unlock after your trainer completes each syllabus section.{' '}
            <Badge tone="neutral">Trainer-controlled</Badge>
          </p>
        </Card>
      </div>
      </div>
    </>
  );
}
