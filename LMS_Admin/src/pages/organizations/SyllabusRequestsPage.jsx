import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Inbox } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, SkeletonCards } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useSyllabusRequests } from '@/lib/modules';
import '../modules/modules.css';

const orgIdOf = (r) => String(r.organization?._id ?? r.organization?.id ?? 'unknown');

/**
 * Super admin: master-syllabus requests grouped by ORGANIZATION. Each card shows how
 * many requests an org has awaiting approval; opening it lists that org's requests.
 */
export function SyllabusRequestsPage() {
  const { data, isLoading, isError, error, refetch } = useSyllabusRequests();
  const navigate = useNavigate();

  // Group the flat request list into one card per organization.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of data ?? []) {
      const id = orgIdOf(r);
      if (!map.has(id)) {
        map.set(id, { id, name: r.organization?.name ?? 'Unknown organization', code: r.organization?.code, requests: [] });
      }
      map.get(id).requests.push(r);
    }
    return [...map.values()]
      .map((g) => ({ ...g, pending: g.requests.filter((r) => r.status === 'pending').length, total: g.requests.length }))
      .sort((a, b) => (b.pending - a.pending) || a.name.localeCompare(b.name));
  }, [data]);

  const totalPending = groups.reduce((s, g) => s + g.pending, 0);
  const orgsPending = groups.filter((g) => g.pending > 0).length;

  return (
    <>
      <PageHeader
        title="Syllabus Requests"
        subtitle="Organizations requesting the master syllabus. Open an organization to review and approve its requests."
      />

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !data ? (
        <div className="dash-grid-2"><SkeletonCards count={4} height="9rem" /></div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} />}
          title="No requests yet"
          description="When an organization admin requests the master syllabus for a module, it shows up here for your approval."
        />
      ) : (
        <>
          {totalPending > 0 && (
            <p className="lms-secondary-text" style={{ marginTop: 0 }}>
              <strong>{totalPending}</strong> request{totalPending === 1 ? '' : 's'} awaiting approval across{' '}
              <strong>{orgsPending}</strong> organization{orgsPending === 1 ? '' : 's'}.
            </p>
          )}
          <div className="dash-grid-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="org-req-card"
                onClick={() => navigate(`/app/syllabus-requests/${g.id}`)}
              >
                <Card className="org-req-card__inner">
                  <div className="org-req-card__head">
                    <span className="org-req-card__icon"><Building2 size={20} /></span>
                    <span className="org-req-card__titles">
                      <span className="org-req-card__name">{g.name}</span>
                      {g.code && <span className="org-req-card__code">{g.code}</span>}
                    </span>
                    <ChevronRight size={18} className="org-req-card__chevron" />
                  </div>
                  <div className="org-req-card__foot">
                    <span className="org-req-card__count">
                      <span className="org-req-card__count-num">{g.pending}</span>
                      <span className="org-req-card__count-label">awaiting approval</span>
                    </span>
                    {g.pending > 0 ? (
                      <Badge tone="warning">{g.pending} pending</Badge>
                    ) : (
                      <Badge tone="success">All clear</Badge>
                    )}
                    <span className="org-req-card__total">{g.total} total</span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
