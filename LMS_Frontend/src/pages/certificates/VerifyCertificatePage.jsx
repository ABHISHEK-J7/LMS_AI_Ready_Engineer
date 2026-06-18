import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Badge, Card, Skeleton, SkeletonText } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useVerifyCertificate } from '@/lib/certificates';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import './certificates.css';

/** Public, no-auth landing page that a certificate's QR code resolves to. */
export function VerifyCertificatePage() {
  const { certificateId } = useParams();
  const { data, isLoading, isError } = useVerifyCertificate(certificateId);

  return (
    <div className="verify-wrap">
      <div style={{ position: 'absolute', top: 'var(--space-5)', right: 'var(--space-6)' }}>
        <ThemeSwitcher />
      </div>
      <Card className="verify-card" style={{ padding: 'var(--space-10)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <span className="cert__logo">AI</span>
          <strong>AI Ready Engineer</strong>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
            <Skeleton width="3rem" height="3rem" radius="var(--radius-full)" />
            <Skeleton width="60%" height="1.75rem" />
            <SkeletonText lines={4} />
          </div>
        ) : isError || !data?.valid ? (
          <>
            <div style={{ fontSize: 'var(--font-size-4xl)' }}>❌</div>
            <h2 style={{ marginTop: 'var(--space-3)' }}>Certificate not found</h2>
            <p className="lms-muted" style={{ marginTop: 'var(--space-2)' }}>
              We couldn’t verify <code>{certificateId}</code>. It may be mistyped or invalid.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={48} style={{ color: 'var(--color-success)' }} /></div>
            <h2 style={{ marginTop: 'var(--space-3)', color: 'var(--color-success)' }}>Verified</h2>
            <p className="lms-muted" style={{ marginTop: 'var(--space-2)' }}>
              This is a genuine certificate issued by AI Ready Engineer.
            </p>
            <div style={{ marginTop: 'var(--space-6)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Row label="Awarded to" value={data.studentName} />
              <Row
                label="Achievement"
                value={data.isProgramCertificate ? 'AI Ready Engineer Program' : data.moduleName}
              />
              <Row label="Issued" value={formatDate(data.issuedAt)} />
              <Row label="Certificate ID" value={data.certificateId} mono />
              <div>{data.isProgramCertificate && <Badge tone="success">Program Certificate</Badge>}</div>
            </div>
          </>
        )}

        <div style={{ marginTop: 'var(--space-8)' }}>
          <Link to="/login" className="lms-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
            Go to portal →
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
      <span className="lms-muted">{label}</span>
      <span style={{ fontWeight: 'var(--font-weight-semibold)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}
