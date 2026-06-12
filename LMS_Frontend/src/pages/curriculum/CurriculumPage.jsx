import { Link } from 'react-router-dom';
import { Check, ChevronRight, Lock, Trophy, X } from 'lucide-react';
import { Badge, Button, Card, CardHeader, FullPageSpinner } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useMyProgress } from '@/lib/progress';
import { levelTone, titleCase } from '@/pages/modules/moduleUi';
import '@/pages/modules/modules.css';

const STATUS = {
  completed: { tone: 'success', label: 'Completed', Icon: Check },
  in_progress: { tone: 'primary', label: 'In progress', Icon: ChevronRight },
  locked: { tone: 'neutral', label: 'Locked', Icon: Lock },
};

export function CurriculumPage() {
  const { data, isLoading, isError, error } = useMyProgress();

  if (isLoading) return <FullPageSpinner />;
  if (isError) return <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>;

  if (!data.hasBatch) {
    return (
      <>
        <PageHeader title="My Curriculum" subtitle="Your structured path from Beginner to Expert." />
        <Card><p className="lms-muted">You are not enrolled in a batch yet. Your administrator will assign you to one.</p></Card>
      </>
    );
  }

  const pct = data.total ? Math.round((data.completedCount / data.total) * 100) : 0;

  return (
    <>
      <PageHeader title="My Curriculum" subtitle="Complete each module to unlock the next — Beginner → Expert." />

      <div className="stat-grid">
        <Stat label="Modules Completed" value={`${data.completedCount} / ${data.total}`} accent />
        <Stat label="Path Progress" value={`${pct}%`} />
        <Stat label="Min Attendance" value={`${data.minAttendance}%`} />
        <Stat label="Pass Mark" value={`${data.passingScore}%`} />
      </div>

      {data.eligibleForCertificate && (
        <Card style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--color-success)' }}>
          <strong style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={16} /> Program complete!
          </strong>{' '}
          <span className="lms-secondary-text">
            You've completed every module — you're eligible for your program certificate.
          </span>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {data.modules.map((m) => {
          const s = STATUS[m.status] ?? STATUS.locked;
          return (
            <Card key={m.module.id} className={m.locked ? '' : 'card--hover'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', opacity: m.locked ? 0.7 : 1 }}>
                <span className="module-card__order">{m.module.order}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span className="module-card__name">{m.module.name}</span>
                    <Badge tone={levelTone(m.module.level)}>{titleCase(m.module.level)}</Badge>
                    <Badge tone={s.tone}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <s.Icon size={12} strokeWidth={2.5} /> {s.label}
                      </span>
                    </Badge>
                  </div>
                  <div className="class-meta" style={{ marginTop: 'var(--space-2)' }}>
                    <span title="Attendance" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      Attendance {m.attendancePercentage}%{' '}
                      {m.attendanceMet ? <Check size={13} strokeWidth={3} style={{ color: 'var(--color-success)' }} /> : `(need ${data.minAttendance}%)`}
                    </span>
                    <span>·</span>
                    <span title="Final assessment" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {m.hasFinal
                        ? m.finalScore !== undefined
                          ? (
                            <>
                              Final {m.finalScore}%{' '}
                              {m.finalPassed
                                ? <Check size={13} strokeWidth={3} style={{ color: 'var(--color-success)' }} />
                                : <X size={13} strokeWidth={3} style={{ color: 'var(--color-error)' }} />}
                            </>
                          )
                          : 'Final not attempted'
                        : 'No final yet'}
                    </span>
                    <span>·</span>
                    <span>{m.practiceTestsCompleted} practice passed</span>
                  </div>
                </div>
                <div className="list-actions">
                  {m.locked ? (
                    <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                      Complete the previous module to unlock
                    </span>
                  ) : (
                    <Link to={`/app/modules/${m.module.id}`}>
                      <Button size="sm" variant={m.completed ? 'outline' : 'primary'}>
                        {m.completed ? 'Review' : 'Continue'}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
