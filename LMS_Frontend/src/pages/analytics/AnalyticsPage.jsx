import { BarChart3 } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, ErrorState, SkeletonCards } from "@/components/ui";
import { PageHeader, Stat } from "@/components/PageHeader";
import { BarChart } from "@/components/charts/BarChart";
import { apiErrorMessage } from "@/lib/api";
import { useTrainerAnalytics } from "@/lib/analytics";

/** Trainer analytics (the admin analytics live in the separate Admin portal). */
export function AnalyticsPage() {
  return <TrainerAnalytics />;
}

function TrainerAnalytics() {
  const { data, isLoading, isError, error, refetch } = useTrainerAnalytics();

  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />;
  if (isLoading && !data) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Performance across your batches and modules." />
        <SkeletonCards count={4} height="7rem" />
      </>
    );
  }

  const { counts, batches, assessments } = data;

  // Roll per-assessment stats up to MODULE level (submission-weighted).
  const byModule = new Map();
  for (const a of assessments) {
    const key = a.module || '—';
    if (!byModule.has(key)) byModule.set(key, { module: key, tests: 0, submissions: 0, passed: 0, scoreSum: 0 });
    const m = byModule.get(key);
    m.tests += 1;
    m.submissions += a.submissions;
    m.passed += Math.round((a.passRate / 100) * a.submissions);
    m.scoreSum += a.avgScore * a.submissions;
  }
  const modulePerf = [...byModule.values()].map((m) => ({
    ...m,
    passRate: m.submissions ? Math.round((m.passed / m.submissions) * 100) : 0,
    avgScore: m.submissions ? Math.round(m.scoreSum / m.submissions) : 0,
  }));
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
        <CardHeader title="Assessment Performance by Module" subtitle="Pass rate & average score aggregated per module" />
        {assessments.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={26} />}
            title="No assessments yet"
            description="No assessments in your modules yet."
          />
        ) : (
          <>
            <BarChart
              data={modulePerf.map((m) => ({ label: m.module, value: m.passRate }))}
              max={100}
              suffix="%"
              multicolor
              emptyText="No graded submissions yet."
            />
            <div className="table-wrap" style={{ marginTop: 'var(--space-4)' }}>
              <table className="table">
                <thead>
                  <tr><th>Module</th><th>Tests</th><th>Submissions</th><th>Pass rate</th><th>Avg score</th></tr>
                </thead>
                <tbody>
                  {modulePerf.map((m, i) => (
                    <tr key={i}>
                      <td>{m.module}</td>
                      <td>{m.tests}</td>
                      <td>{m.submissions}</td>
                      <td>
                        <Badge tone={m.submissions === 0 ? 'neutral' : m.passRate >= 70 ? 'success' : 'warning'}>
                          {m.submissions ? `${m.passRate}%` : '—'}
                        </Badge>
                      </td>
                      <td>{m.submissions ? `${m.avgScore}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
