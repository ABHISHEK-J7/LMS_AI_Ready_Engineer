import { formatDate } from '@/lib/format';
import './certificates.css';

/** The formal, printable certificate artifact. */
export function Certificate({ certificate, studentName }) {
  const isProgram = certificate.isProgramCertificate;
  const moduleName = certificate.module?.name;
  return (
    <div className="cert">
      <div className="cert__brand">
        <span className="cert__logo">AI</span>
        <strong>AI Ready Engineer</strong>
      </div>
      <div className="cert__kicker">Certificate of {isProgram ? 'Program Completion' : 'Completion'}</div>
      <div className="cert__title">{isProgram ? 'AI Ready Engineer' : 'Module Completion'}</div>

      <div className="cert__for">This certifies that</div>
      <div className="cert__name">{studentName}</div>
      <div className="cert__for">
        has successfully completed {isProgram ? 'the full' : 'the'}
      </div>
      <div className="cert__module">
        {isProgram ? 'AI Ready Engineer Program' : moduleName ?? 'Module'}
      </div>

      <div className="cert__footer">
        <div>
          <div className="cert__meta-label">Date</div>
          <div className="cert__meta-value">{formatDate(certificate.issuedAt)}</div>
          <div className="cert__meta-label" style={{ marginTop: 'var(--space-3)' }}>
            Certificate ID
          </div>
          <div className="cert__meta-value">{certificate.certificateId}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {certificate.qrDataUrl ? (
            <img className="cert__qr" src={certificate.qrDataUrl} alt="Verification QR code" />
          ) : null}
          <div className="cert__meta-label" style={{ marginTop: 'var(--space-1)' }}>
            Scan to verify
          </div>
        </div>
      </div>
    </div>
  );
}
