import { Award, BookOpen, GraduationCap, TriangleAlert, UserCog, UsersRound } from 'lucide-react';
import { Badge, Card, CardHeader, ErrorState, SkeletonCards } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api';
import { PageHeader, Stat } from '@/components/PageHeader';
import { CountUp } from '@/lib/anim';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { GaugeRing } from '@/components/charts/GaugeRing';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { useAdminAnalytics } from '@/lib/analytics';


export function AdminDashboard() {
  const { data, isLoading, isError, error, refetch } = useAdminAnalytics();

  const counts = data?.counts ?? {};
  const low = data?.lowAttendance ?? { count: 0, threshold: 75, students: [] };
  const batchSizes = data?.batchSizes ?? [];
  const moduleCompletion = data?.moduleCompletion ?? [];

  const totalCompleted = moduleCompletion.reduce((s, m) => s + (m.completed || 0), 0);
  const totalInProgress = moduleCompletion.reduce((s, m) => s + (m.inProgress || 0), 0);

  const students = counts.students ?? 0;
  const onTrack = Math.max(0, students - low.count);
  const compliancePct = students > 0 ? Math.round((onTrack / students) * 100) : 100;
  const complianceTone = compliancePct >= 90 ? 'success' : compliancePct >= 70 ? 'warning' : 'error';

  return (
    <>
      <PageHeader
        title="Administrator Dashboard"
        subtitle="Institution-wide overview of users, batches, and academic progress."
      />

      {isError && !data ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !data ? (
        <SkeletonCards count={5} height="7rem" />
      ) : (
      <div className="dash-stack">
      {/* KPI tiles */}
      <div className="stat-grid">
        <Stat label="Total Students" value={<CountUp value={students} />} accent icon={<GraduationCap size={20} />} />
        <Stat label="Trainers" value={<CountUp value={counts.trainers ?? 0} />} icon={<UserCog size={20} />} />
        <Stat label="Active Batches" value={<CountUp value={counts.batches ?? 0} />} icon={<UsersRound size={20} />} />
        <Stat label="Modules" value={<CountUp value={counts.modules ?? 0} />} icon={<BookOpen size={20} />} />
        <Stat label="Certificates" value={<CountUp value={counts.certificates ?? 0} />} icon={<Award size={20} />} />
      </div>

      {/* Composition + health rings */}
      <div className="dash-grid-3">
        <Card>
          <CardHeader title="Community Composition" subtitle="Active students vs trainers" />
          <DonutChart
            data={[
              { label: 'Students', value: students },
              { label: 'Trainers', value: counts.trainers ?? 0 },
            ]}
            centerValue={students + (counts.trainers ?? 0)}
            centerLabel="People"
          />
        </Card>

        <Card>
          <CardHeader title="Attendance Compliance" subtitle={`On track vs below ${low.threshold}% minimum`} />
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2) 0' }}>
            <GaugeRing value={compliancePct} tone={complianceTone} label={`${onTrack} of ${students} students on track`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Module Status" subtitle="Enrollment progress across all modules" />
          <DonutChart
            data={[
              { label: 'Completed', value: totalCompleted },
              { label: 'In progress', value: totalInProgress },
            ]}
            centerValue={totalCompleted + totalInProgress}
            centerLabel="Enrolments"
          />
        </Card>
      </div>

      {/* Module progress (stacked) */}
      <Card>
        <CardHeader title="Progress by Module" subtitle="Completed and in-progress students per module" />
        <StackedBarChart
          rows={moduleCompletion.map((m) => ({
            label: m.module,
            segments: [{ value: m.completed || 0 }, { value: m.inProgress || 0 }],
          }))}
          series={[
            { key: 'completed', label: 'Completed', color: 'var(--color-primary)' },
            { key: 'inProgress', label: 'In progress', color: 'var(--color-secondary)' },
          ]}
          emptyText="No module progress recorded yet."
        />
      </Card>

      {/* Enrollment + at-risk */}
      <div className="dash-grid-2">
        <Card>
          <CardHeader title="Enrollment by Batch" subtitle="Students per active batch" />
          <BarChart
            data={batchSizes.map((b) => ({ label: b.batch, value: b.students }))}
            multicolor
            emptyText="No active batches yet."
          />
        </Card>

        <Card>
          <CardHeader title="Students at Risk" subtitle={`Below ${low.threshold}% attendance`} />
          {low.count === 0 ? (
            <p className="lms-muted">No students are below the attendance threshold.</p>
          ) : (
            <>
              <p style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <TriangleAlert size={16} style={{ color: 'var(--color-error)' }} />
                <Badge tone="error">{low.count} student(s) at risk</Badge>
              </p>
              {low.students.slice(0, 6).map((s, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}
                >
                  <span>{s.student} <span className="lms-muted">· {s.batch}</span></span>
                  <Badge tone="error">{s.percentage}%</Badge>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
      </div>
      )}
    </>
  );
}
