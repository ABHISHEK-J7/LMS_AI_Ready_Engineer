import { ClipboardList, CircleCheck } from 'lucide-react';
import { UserRole } from '@/shared';
import { Badge, Card, CardHeader, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';
import { PageHeader, Stat } from '@/components/PageHeader';
import { BarChart } from '@/components/charts/BarChart';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAdminAnalytics, useTrainerAnalytics } from '@/lib/analytics';

export function AnalyticsPage() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.ADMIN ? <AdminAnalytics /> : <TrainerAnalytics />;
}

function AdminAnalytics() {
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics();

  if (isError && !data) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Institution-wide overview." />
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      </>
    );
  }
  if (isLoading && !data) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Institution-wide overview." />
        <SkeletonCards count={5} height="7rem" />
      </>
    );
  }

  const { counts, lowAttendance, batchSizes, moduleCompletion } = data;
  return (
    <>
      <PageHeader title="Analytics" subtitle="Institution-wide overview." />

      <div className="stat-grid">
        <Stat label="Students" value={counts.students} accent />
        <Stat label="Trainers" value={counts.trainers} />
        <Stat label="Active Batches" value={counts.batches} />
        <Stat label="Modules" value={counts.modules} />
        <Stat label="Certificates Issued" value={counts.certificates} />
      </div>

      <div className="dash-grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Module Completion" subtitle="Students who have completed each module" />
          <BarChart data={moduleCompletion.map((m) => ({ label: m.module, value: m.completed }))} />
        </Card>
        <Card>
          <CardHeader title="Batch Sizes" subtitle="Enrolled students per active batch" />
          <BarChart data={batchSizes.map((b) => ({ label: b.batch, value: b.students }))} multicolor />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Low Attendance Alerts"
          subtitle={`${lowAttendance.count} student(s) below the ${lowAttendance.threshold}% minimum`}
        />
        {lowAttendance.students.length === 0 ? (
          <p className="lms-muted" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CircleCheck size={16} style={{ color: 'var(--color-success)' }} />
            All students are meeting the attendance requirement.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Student</th><th>Batch</th><th>Attendance</th></tr></thead>
              <tbody>
                {lowAttendance.students.map((s, i) => (
                  <tr key={i}>
                    <td>{s.student}</td>
                    <td>{s.batch}</td>
                    <td><Badge tone="error">{s.percentage}%</Badge></td>
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

function TrainerAnalytics() {
  const { data, isLoading, isError, error, refetch } = useTrainerAnalytics();

  if (isError && !data) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Performance across your batches and modules." />
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      </>
    );
  }
  if (isLoading && !data) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Performance across your batches and modules." />
        <SkeletonCards count={4} height="7rem" />
      </>
    );
  }

  const { counts, batches, assessments } = data;
  return (
    <>
      <PageHeader title="Analytics" subtitle="Performance across your batches and modules." />

      <div className="stat-grid">
        <Stat label="Assigned Modules" value={counts.modules} accent />
        <Stat label="Assigned Batches" value={counts.batches} />
        <Stat label="Students" value={counts.students} />
        <Stat label="Upcoming Classes" value={counts.upcomingClasses} />
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardHeader title="Average Attendance by Batch" />
        <BarChart
          data={batches.map((b) => ({ label: b.batch, value: b.avgAttendance }))}
          max={100}
          suffix="%"
        />
      </Card>

      <Card>
        <CardHeader title="Assessment Performance" subtitle="Submissions, pass rate & average score" />
        {assessments.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="No assessments in your modules yet."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Assessment</th><th>Module</th><th>Submissions</th><th>Pass rate</th><th>Avg score</th></tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => (
                  <tr key={i}>
                    <td>{a.title}</td>
                    <td>{a.module}</td>
                    <td>{a.submissions}</td>
                    <td>
                      <Badge tone={a.submissions === 0 ? 'neutral' : a.passRate >= 70 ? 'success' : 'warning'}>
                        {a.submissions ? `${a.passRate}%` : '—'}
                      </Badge>
                    </td>
                    <td>{a.submissions ? `${a.avgScore}%` : '—'}</td>
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
