import { useState } from 'react';
import { CalendarCheck, CalendarX, Compass, GraduationCap, Percent } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMyAttendance } from '@/lib/attendance';
import { useClasses, useJoinClass } from '@/lib/classes';
import { useClassRatingsPending, ratingEligible } from '@/lib/classRatings';
import { useMyProgress } from '@/lib/progress';
import { classHasEnded, todayISO } from '@/pages/schedule/scheduleUi';
import { ClassRatingModal } from '@/pages/schedule/ClassRatingModal';
import { AttendanceHeatmap } from './AttendanceHeatmap';
import '@/pages/schedule/schedule.css';

export function StudentDashboard() {
  const user = useAuth((s) => s.user);
  const { data: attendance, isLoading: attLoading, isError: attError, error: attErr, refetch: refetchAtt } = useMyAttendance();
  const { data: upcoming } = useClasses({ from: todayISO() });
  const { data: progress } = useMyProgress();
  const joinClass = useJoinClass();
  const { data: pendingRatings } = useClassRatingsPending(true);
  const eligiblePending = (pendingRatings ?? []).filter(ratingEligible);
  const mustRate = eligiblePending.length > 0;
  const [rateTarget, setRateTarget] = useState(null);

  function handleJoin(c) {
    if (mustRate) {
      setRateTarget(eligiblePending[0]);
      return;
    }
    joinClass.mutate(c.id);
    window.open(c.meetingLink, '_blank', 'noopener,noreferrer');
  }

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

      {attError ? (
        <ErrorState message={apiErrorMessage(attErr)} onRetry={refetchAtt} />
      ) : attLoading && !attendance ? (
        <div className="dash-stack">
          <SkeletonCards count={4} height="5.5rem" />
          <SkeletonCards count={2} height="12rem" />
        </div>
      ) : (
      <>
      {mustRate && (
        <Card className="rate-gate">
          <div>
            <strong>Rate your previous class to continue.</strong>
            <div className="lms-muted">
              You have {eligiblePending.length} class{eligiblePending.length > 1 ? 'es' : ''} awaiting your
              rating. You can&apos;t join a new class until you do.
            </div>
          </div>
          <Button size="sm" onClick={() => setRateTarget(eligiblePending[0])}>Rate now</Button>
        </Card>
      )}

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
            <EmptyState icon={<CalendarX size={26} />} title="No upcoming classes" description="No upcoming classes scheduled." />
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
                  <button
                    type="button"
                    onClick={() => handleJoin(c)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <Badge tone="primary">{mustRate ? 'Rate to join' : 'Join'}</Badge>
                  </button>
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
      )}

      <ClassRatingModal
        pending={rateTarget}
        onClose={() => setRateTarget(null)}
        onRated={() => setRateTarget(null)}
      />
    </>
  );
}
