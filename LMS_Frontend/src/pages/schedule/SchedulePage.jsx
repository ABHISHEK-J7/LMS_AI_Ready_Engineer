import { useState } from 'react';
import { UserRole } from '@/shared';
import { CalendarClock } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBatches } from '@/lib/batches';
import { useClasses, useDeleteClass, useJoinClass, useUpdateClass } from '@/lib/classes';
import { useClassRatingsPending, ratingEligible } from '@/lib/classRatings';
import { useModules } from '@/lib/modules';
import { useTrainers } from '@/lib/users';
import { ClassModal } from './ClassModal';
import { ClassRatingModal } from './ClassRatingModal';
import { MonthCalendar } from './MonthCalendar';
import { STATUS_LABEL, STATUS_TONE, PROVIDER_LABEL, classHasEnded, groupByDay, todayISO } from './scheduleUi';
import { downloadIcs } from '@/lib/ics';
import './schedule.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function SchedulePage() {
  const user = useAuth((s) => s.user);
  const role = user?.role;
  const canManage = role === UserRole.ADMIN || role === UserRole.TRAINER;
  const isAdmin = role === UserRole.ADMIN;

  const [tab, setTab] = useState('upcoming'); // 'upcoming' | 'calendar' | 'all'
  const [month, setMonth] = useState(() => new Date());
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const filters =
    tab === 'upcoming'
      ? { from: todayISO() }
      : tab === 'calendar'
        ? { from: ymd(monthStart), to: ymd(monthEnd) }
        : {};
  const { data: classes, isLoading, isError, error, refetch } = useClasses(filters);
  const shiftMonth = (delta) => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  // Options for the schedule modal (only fetched when the user can manage).
  const { data: batches } = useBatches();
  const { data: modules } = useModules();
  const { data: trainers } = useTrainers({ enabled: isAdmin });

  const [modal, setModal] = useState({ open: false, mode: 'create', initial: null });
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const joinClass = useJoinClass();

  const isStudent = role === UserRole.STUDENT;
  // Classes the student attended but hasn't rated yet. Only those they were
  // eligible for (attended ≥¾, class is over) block joining the next class.
  const { data: pendingRatings } = useClassRatingsPending(isStudent);
  const eligiblePending = (pendingRatings ?? []).filter(ratingEligible);
  const mustRate = eligiblePending.length > 0;
  const [rateTarget, setRateTarget] = useState(null);

  // Student Join: if an eligible class is unrated, block and open the rating
  // modal; otherwise record entry time and open the meeting in a new tab.
  function handleStudentJoin(c) {
    if (mustRate) {
      setRateTarget(eligiblePending[0]);
      return;
    }
    joinClass.mutate(c.id);
    window.open(c.meetingLink, '_blank', 'noopener,noreferrer');
  }

  const groups = groupByDay(classes ?? []);

  function ownerCanManage(c) {
    return isAdmin || c.trainer?.id === user?.id;
  }

  return (
    <>
      <PageHeader
        title="Class Schedule"
        subtitle={
          role === UserRole.STUDENT
            ? 'Your live class timetable.'
            : 'Trainer-led sessions across your batches.'
        }
      />

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

      <div className="toolbar">
        <div className="sched-tabs">
          {['upcoming', 'calendar', 'all'].map((t) => (
            <button key={t} className={`sched-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" disabled={!classes || classes.length === 0} onClick={() => downloadIcs('ai-ready-timetable', classes ?? [])}>
            Export .ics
          </Button>
          {canManage && (
            <Button onClick={() => setModal({ open: true, mode: 'create', initial: null })}>
              + Schedule Class
            </Button>
          )}
        </div>
      </div>

      {tab === 'calendar' && (
        <div className="toolbar" style={{ marginBottom: 'var(--space-3)' }}>
          <Button size="sm" variant="outline" onClick={() => shiftMonth(-1)}>← Prev</Button>
          <strong>{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
          <Button size="sm" variant="outline" onClick={() => shiftMonth(1)}>Next →</Button>
        </div>
      )}

      {isError && <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />}

      {isLoading && !classes ? (
        <SkeletonCards count={4} height="5rem" />
      ) : tab === 'calendar' ? (
        <MonthCalendar
          month={month}
          classes={classes ?? []}
          onSelect={(c) => ownerCanManage(c) && setModal({ open: true, mode: 'edit', initial: c })}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={26} />}
          title={tab === 'upcoming' ? 'No upcoming classes' : 'No classes found'}
          description={tab === 'upcoming' ? 'No upcoming classes scheduled.' : 'No classes found.'}
        />
      ) : (
        groups.map((g) => (
          <div className="day-group" key={g.key}>
            <div className="day-header">
              <span>{g.label}</span>
              <span className="day-header__count">{g.items.length} class{g.items.length > 1 ? 'es' : ''}</span>
            </div>
            {g.items.map((c) => {
              // Auto-close: once the end time passes, a scheduled/in-progress
              // class is treated as completed — no "Join", shows as Completed.
              const ended = classHasEnded(c) && c.status !== 'cancelled';
              const displayStatus = ended && (c.status === 'scheduled' || c.status === 'in_progress')
                ? 'completed'
                : c.status;
              return (
              <Card key={c.id} className="class-row">
                <div className="class-time">
                  {c.startTime}
                  <div className="class-time__end">{c.endTime}</div>
                </div>
                <div className="class-main">
                  <div className="class-title">{c.title}</div>
                  <div className="class-meta">
                    <Badge tone={STATUS_TONE[displayStatus]}>{STATUS_LABEL[displayStatus]}</Badge>
                    <span>{c.module?.name}</span>
                    <span>·</span>
                    <span>{c.batch?.name}</span>
                    <span>·</span>
                    <span>{c.trainer?.name}</span>
                    <span>·</span>
                    <span>{PROVIDER_LABEL[c.provider]}</span>
                  </div>
                </div>
                <div className="class-actions">
                  {c.meetingLink && c.status !== 'cancelled' && !ended ? (
                    isStudent ? (
                      <Button size="sm" onClick={() => handleStudentJoin(c)}>
                        {mustRate ? 'Rate to join' : 'Join'}
                      </Button>
                    ) : (
                      <a href={c.meetingLink} target="_blank" rel="noreferrer">
                        <Button size="sm">Join</Button>
                      </a>
                    )
                  ) : ended && c.status !== 'cancelled' ? (
                    <Button size="sm" variant="outline" disabled>Class ended</Button>
                  ) : null}
                  {c.recordingLink && (
                    <a href={c.recordingLink} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">Recording</Button>
                    </a>
                  )}
                  {ownerCanManage(c) && c.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={updateClass.isPending}
                      onClick={() => updateClass.mutate({ id: c.id, status: 'completed' })}
                    >
                      Mark done
                    </Button>
                  )}
                  {ownerCanManage(c) && (
                    <Button size="sm" variant="outline" onClick={() => setModal({ open: true, mode: 'edit', initial: c })}>
                      Edit
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        window.confirm('Delete this class permanently?') && deleteClass.mutate(c.id)
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        ))
      )}

      {canManage && (
        <ClassModal
          open={modal.open}
          mode={modal.mode}
          initial={modal.initial}
          onClose={() => setModal({ open: false, mode: 'create', initial: null })}
          isAdmin={isAdmin}
          batches={batches ?? []}
          modules={modules ?? []}
          trainers={trainers ?? []}
        />
      )}

      <ClassRatingModal
        pending={rateTarget}
        onClose={() => setRateTarget(null)}
        onRated={() => setRateTarget(null)}
      />
    </>
  );
}
