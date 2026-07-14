import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Building2, CheckCircle2, CheckCheck, ChevronRight, Inbox, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, SkeletonCards, useConfirm, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useApproveAllSyllabusRequests, useDecideSyllabusRequest, useSyllabusRequests } from '@/lib/modules';
import { formatDate } from '@/lib/format';
import '../modules/modules.css';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'error' };
const STATUS_RANK = { pending: 0, approved: 1, rejected: 2 };
const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const orgIdOf = (r) => String(r.organization?._id ?? r.organization?.id ?? 'unknown');

/** One request → a self-contained card with the master preview and decision buttons. */
function RequestCard({ r, busy, onDecide }) {
  return (
    <Card className="req-card">
      <div className="panel-head">
        <CardHeader
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} /> {r.moduleName || r.moduleCode} <Badge tone="neutral">{r.moduleCode}</Badge>
            </span>
          }
          subtitle={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              Requested by {r.requestedBy?.name ?? 'an admin'} · {formatDate(r.createdAt)}
            </span>
          }
        />
        <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{titleCase(r.status)}</Badge>
      </div>

      {r.note && <p className="lms-secondary-text" style={{ margin: '0 0 var(--space-3)' }}>“{r.note}”</p>}

      {r.master ? (
        <>
          <div className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
            Master syllabus: <strong>{r.master.topicCount}</strong> topic{r.master.topicCount === 1 ? '' : 's'} ·{' '}
            <strong>{r.master.subtopicCount}</strong> subtopic{r.master.subtopicCount === 1 ? '' : 's'}
          </div>
          {r.master.topics.length > 0 && (
            <div className="syllabus-preview syllabus-preview--card">
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
        <div className="req-card__actions">
          <Button loading={busy} disabled={!r.master || busy} onClick={() => onDecide(r, 'approve')}>
            <CheckCircle2 size={15} style={{ marginRight: 6 }} /> Approve &amp; import
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => onDecide(r, 'reject')}>
            <XCircle size={15} style={{ marginRight: 6 }} /> Reject
          </Button>
        </div>
      ) : (
        <p className="lms-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
          {titleCase(r.status)}{r.decidedAt ? ` on ${formatDate(r.decidedAt)}` : ''}{r.decisionNote ? ` — “${r.decisionNote}”` : ''}
        </p>
      )}
    </Card>
  );
}

/**
 * Super admin: every master-syllabus request for ONE organization, as a two-column
 * grid of cards. Each card imports (approve) or rejects that module's request.
 */
export function SyllabusRequestsOrgPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useSyllabusRequests();
  const decide = useDecideSyllabusRequest();
  const approveAll = useApproveAllSyllabusRequests();
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);

  const requests = useMemo(
    () => (data ?? [])
      .filter((r) => orgIdOf(r) === String(orgId))
      // Pending first, then oldest-first (FIFO) so the earliest request leads.
      .sort((a, b) => (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (new Date(a.createdAt) - new Date(b.createdAt))),
    [data, orgId],
  );
  const org = requests[0]?.organization;
  const pending = requests.filter((r) => r.status === 'pending').length;

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

  async function handleApproveAll() {
    const ok = await confirm({
      title: `Approve all ${pending} request${pending === 1 ? '' : 's'}?`,
      message: `The master syllabus will be imported into ${org?.name ?? 'this organization'} for every pending request.`,
      confirmLabel: 'Approve all',
    });
    if (!ok) return;
    try {
      const res = await approveAll.mutateAsync(String(orgId));
      toast.success(
        `Approved ${res.approved} request${res.approved === 1 ? '' : 's'}.` +
        (res.skipped ? ` ${res.skipped} skipped (no longer in the master curriculum).` : ''),
      );
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate('/app/syllabus-requests')}>
        <ArrowLeft size={16} /> All organizations
      </button>

      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} /> {org?.name ?? 'Organization'}
            {org?.code && <Badge tone="neutral">{org.code}</Badge>}
          </span>
        }
        subtitle={pending > 0
          ? `${pending} request${pending === 1 ? '' : 's'} awaiting your approval.`
          : 'No requests awaiting approval.'}
        actions={pending > 0 ? (
          <Button onClick={handleApproveAll} loading={approveAll.isPending} disabled={approveAll.isPending}>
            <CheckCheck size={15} style={{ marginRight: 6 }} /> Approve all ({pending})
          </Button>
        ) : null}
      />

      {isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={refetch} />
      ) : isLoading && !data ? (
        <div className="dash-grid-2"><SkeletonCards count={4} height="14rem" /></div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} />}
          title="Nothing here"
          description="This organization has no master-syllabus requests."
        />
      ) : (
        <div className="dash-grid-2">
          {requests.map((r) => (
            <RequestCard key={r.id} r={r} busy={busyId === r.id && decide.isPending} onDecide={act} />
          ))}
        </div>
      )}
    </>
  );
}
