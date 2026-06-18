import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, SkeletonTable } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuditLog } from '@/lib/audit';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

const ACTION_TONE = {
  'assessment.unlock': 'success',
  'assessment.lock': 'neutral',
  'submission.regrade': 'warning',
  'settings.update': 'warning',
  'user.archive': 'error',
  'user.approve': 'success',
  'user.create': 'primary',
};

const FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'assessment.unlock', label: 'Exam unlocked' },
  { value: 'assessment.lock', label: 'Exam locked' },
  { value: 'submission.regrade', label: 'Grade override' },
  { value: 'settings.update', label: 'Settings changed' },
  { value: 'user.create', label: 'User created' },
  { value: 'user.approve', label: 'User approved' },
  { value: 'user.archive', label: 'User archived' },
];

export function AuditPage() {
  const [action, setAction] = useState('');
  const { data, isLoading, isError, error, refetch } = useAuditLog(action);

  return (
    <>
      <PageHeader title="Audit Log" subtitle="A record of sensitive actions — who did what, and when." />
      <div className="toolbar">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`sched-tab${action === f.value ? ' active' : ''}`}
              onClick={() => setAction(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !data ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<ScrollText size={26} />} title="No audit entries yet." />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.createdAt)}</td>
                    <td>{e.actor?.name ?? e.actorName ?? '—'}<div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{e.actorRole}</div></td>
                    <td><Badge tone={ACTION_TONE[e.action] ?? 'neutral'}>{e.action}</Badge></td>
                    <td className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{e.targetType}{e.targetId ? ` · ${e.targetId.slice(-6)}` : ''}</td>
                    <td className="lms-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: '20rem' }}>{e.meta ? JSON.stringify(e.meta) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
