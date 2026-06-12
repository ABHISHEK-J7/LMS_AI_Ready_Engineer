import { Badge, Card, CardHeader, FullPageSpinner } from "@/components/ui";
import { PageHeader, Stat } from "@/components/PageHeader";
import { BarChart } from "@/components/charts/BarChart";
import { apiErrorMessage } from "@/lib/api";
import { useTrainerAnalytics } from "@/lib/analytics";

/** Trainer analytics (the admin analytics live in the separate Admin portal). */
export function AnalyticsPage() {
  return <TrainerAnalytics />;
}

function TrainerAnalytics() {
  const { data, isLoading, isError, error } = useTrainerAnalytics();
  if (isLoading) return <FullPageSpinner />;
  if (isError) return <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>;

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
          <p className="lms-muted">No assessments in your modules yet.</p>
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
