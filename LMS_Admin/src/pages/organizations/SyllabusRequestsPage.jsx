import { useState } from 'react';
import { BookOpen, Building2, CheckCircle2, ChevronRight, Inbox, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SkeletonCards, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useDecideSyllabusRequest, useSyllabusRequests } from '@/lib/modules';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'error' };
const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Super admin: org admins' requests to import the master syllabus for a module.
 * Each shows exactly what the master would contribute; Approve applies it to the
 * requesting org's module.
 */
export function SyllabusRequestsPage() {
  const { data, isLoading, isError, error, refetch } = useSyllabusRequests();
  const decide = useDecideSyllabusRequest();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  async function act(r, decision) {
    setBusyId(r.id);
    try {
      await decide.mutateAsync({ id: r.id, decision });
      toast.success(decision === 'approve' ? 'Approved — master syllabus imported into the org.' : 'Request rejected.');
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = (data ?? []).filter((r) => r.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Syllabus Requests"
        subtitle="Organization admins requesting the master syllabus for a module. Approve to import it into their org."
      />

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !data ? (
        <SkeletonCards count={3} height="10rem" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} />}
          title="No requests yet"
          description="When an organization admin requests the master syllabus for a module, it shows up here for your approval."
        />
      ) : (
        <>
          {pendingCount > 0 && (
            <p className="lms-secondary-text" style={{ marginTop: 0 }}>
              <strong>{pendingCount}</strong> request{pendingCount === 1 ? '' : 's'} awaiting your approval.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {data.map((r) => (
              <Card key={r.id}>
                <div className="panel-head">
                  <CardHeader
                    title={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <BookOpen size={16} /> {r.moduleName || r.moduleCode} <Badge tone="neutral">{r.moduleCode}</Badge>
                      </span>
                    }
                    subtitle={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Building2 size={13} /> {r.organization?.name ?? 'Organization'} · requested by {r.requestedBy?.name ?? 'an admin'} · {formatDate(r.createdAt)}
                      </span>
                    }
                  />
                  <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{titleCase(r.status)}</Badge>
                </div>

                {r.note && (
                  <p className="lms-secondary-text" style={{ margin: '0 0 var(--space-3)' }}>“{r.note}”</p>
                )}

                {r.master ? (
                  <>
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                      Master syllabus: <strong>{r.master.topicCount}</strong> topic{r.master.topicCount === 1 ? '' : 's'} · <strong>{r.master.subtopicCount}</strong> subtopic{r.master.subtopicCount === 1 ? '' : 's'}
                    </div>
                    {r.master.topics.length > 0 && (
                      <div className="syllabus-preview">
                        {r.master.topics.map((t, i) => (
                          <div key={i} className="syllabus-preview__topic">
                            <div className="syllabus-preview__topic-title">
                              <BookOpen size={15} /> <strong>{i + 1}. {t.title}</strong>
                              {t.subtopics.length > 0 && (
                                <span className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>· {t.subtopics.length} subtopic{t.subtopics.length === 1 ? '' : 's'}</span>
                              )}
                            </div>
                            {t.subtopics.length > 0 && (
                              <ul className="syllabus-preview__subs">
                                {t.subtopics.map((s, j) => (
                                  <li key={j}><ChevronRight size={13} style={{ color: 'var(--color-primary)', flex: 'none' }} /> <span>{s.title}</span></li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="lms-muted">This module is no longer part of the master curriculum, so it can't be imported.</p>
                )}

                {r.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                    <Button loading={busyId === r.id && decide.isPending} disabled={!r.master || busyId === r.id} onClick={() => act(r, 'approve')}>
                      <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Approve &amp; import
                    </Button>
                    <Button variant="danger" disabled={busyId === r.id} onClick={() => act(r, 'reject')}>
                      <XCircle size={15} style={{ marginRight: 6 }} /> Reject
                    </Button>
                  </div>
                ) : (
                  <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                    {titleCase(r.status)}{r.decidedAt ? ` on ${formatDate(r.decidedAt)}` : ''}{r.decisionNote ? ` — “${r.decisionNote}”` : ''}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
