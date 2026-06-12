import { useState } from 'react';
import { UserRole } from '@lms/shared';
import { Badge, Button, Card, CardHeader, FullPageSpinner, Modal } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAllCertificates, useMyCertificates } from '@/lib/certificates';
import { formatDate } from '@/lib/format';
import { Certificate } from './Certificate';
import './certificates.css';
import '../modules/modules.css';

export function CertificatesPage() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.ADMIN ? <AdminCertificates /> : <StudentCertificates />;
}

function certTitle(c) {
  return c.isProgramCertificate ? 'AI Ready Engineer Program' : c.module?.name ?? 'Module';
}

// ── Student ────────────────────────────────────────────────────────────────────

function StudentCertificates() {
  const user = useAuth((s) => s.user);
  const { data: certs, isLoading, isError, error } = useMyCertificates();
  const [view, setView] = useState(null);

  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <PageHeader title="Certificates" subtitle="Earned automatically as you complete modules." />
      {isError && <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>}

      {certs && certs.length === 0 ? (
        <Card>
          <p className="lms-muted">
            No certificates yet. Complete a module — pass its final assessment and meet the
            attendance requirement — to earn one automatically.
          </p>
        </Card>
      ) : (
        <div className="module-grid">
          {certs?.map((c) => (
            <Card key={c.id} className="cert-card">
              <div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{certTitle(c)}</div>
                <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {formatDate(c.issuedAt)} · {c.certificateId}
                </div>
                {c.isProgramCertificate && <Badge tone="success">Program</Badge>}
              </div>
              <Button size="sm" onClick={() => setView(c)}>View</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(view)}
        title="Certificate"
        onClose={() => setView(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setView(null)}>Close</Button>
            <Button onClick={() => window.print()}>Print / Save PDF</Button>
          </>
        }
      >
        {view && (
          <div className="cert-print-area">
            <Certificate certificate={view} studentName={user?.name ?? 'Student'} />
          </div>
        )}
      </Modal>
    </>
  );
}

// ── Admin ────────────────────────────────────────────────────────────────────

function AdminCertificates() {
  const { data: certs, isLoading, isError, error } = useAllCertificates();
  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <PageHeader title="Certificates" subtitle="All certificates issued across the institution." />
      {isError && <Card><p className="field__error">{apiErrorMessage(error)}</p></Card>}
      {certs && certs.length === 0 ? (
        <Card><p className="lms-muted">No certificates have been issued yet.</p></Card>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Certificate</th><th>Type</th><th>Issued</th><th>ID</th></tr>
            </thead>
            <tbody>
              {certs?.map((c) => (
                <tr key={c.id}>
                  <td>{c.student?.name}<div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{c.student?.email}</div></td>
                  <td>{certTitle(c)}</td>
                  <td>{c.isProgramCertificate ? <Badge tone="success">Program</Badge> : <Badge tone="neutral">Module</Badge>}</td>
                  <td>{formatDate(c.issuedAt)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)' }}>{c.certificateId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
