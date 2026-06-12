import { useState } from 'react';
import { ExternalLink, FileText, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardHeader, FullPageSpinner, Input, Modal } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useMyCertificates } from '@/lib/certificates';
import {
  useAddExternalCertificate,
  useDeleteExternalCertificate,
  useMyExternalCertificates,
} from '@/lib/externalCertificates';
import { formatDate } from '@/lib/format';
import { Certificate } from './Certificate';
import './certificates.css';
import '../modules/modules.css';

export function CertificatesPage() {
  return <StudentCertificates />;
}

function certTitle(c) {
  return c.isProgramCertificate ? 'AI Ready Engineer Program' : c.module?.name ?? 'Module';
}

const isImage = (url = '') => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

function StudentCertificates() {
  const user = useAuth((s) => s.user);
  const { data: certs, isLoading } = useMyCertificates();
  const [view, setView] = useState(null);

  if (isLoading) return <FullPageSpinner />;

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle="Your AI Ready Engineer certificates, plus any you've earned elsewhere."
      />

      <div className="cert-columns">
        {/* ── AI Ready Engineer certificates (auto-earned) ── */}
        <Card>
          <CardHeader
            title="AI Ready Engineer Certificates"
            subtitle="Earned automatically as you complete each module in the program."
          />
          {certs && certs.length === 0 ? (
            <p className="lms-muted">
              No certificates yet. Complete a module — pass its final assessment and meet the
              attendance requirement — to earn one automatically.
            </p>
          ) : (
            <div className="cert-list">
              {certs?.map((c) => (
                <div key={c.id} className="cert-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {certTitle(c)}
                      {c.isProgramCertificate && <Badge tone="success">Program</Badge>}
                    </div>
                    <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {formatDate(c.issuedAt)} · {c.certificateId}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setView(c)}>View</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Other certificates (student-uploaded, external) ── */}
        <Card>
          <ExternalCertificates />
        </Card>
      </div>

      <Modal
        open={Boolean(view)}
        size="lg"
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

const BLANK = { title: '', issuer: '', url: '', file: null, mode: 'link' };

function ExternalCertificates() {
  const { data: items, isLoading } = useMyExternalCertificates();
  const add = useAddExternalCertificate();
  const del = useDeleteExternalCertificate();
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) return setErr('Enter a certificate title.');
    if (form.mode === 'link' && !form.url.trim()) return setErr('Paste the certificate link.');
    if (form.mode === 'file' && !form.file) return setErr('Choose a PDF or image to upload.');
    try {
      if (form.mode === 'file') {
        const fd = new FormData();
        fd.append('title', form.title.trim());
        if (form.issuer.trim()) fd.append('issuer', form.issuer.trim());
        fd.append('file', form.file);
        await add.mutateAsync(fd);
      } else {
        await add.mutateAsync({
          title: form.title.trim(),
          ...(form.issuer.trim() ? { issuer: form.issuer.trim() } : {}),
          url: form.url.trim(),
        });
      }
      setForm(BLANK);
    } catch (e2) {
      setErr(apiErrorMessage(e2));
    }
  }

  return (
    <>
      <CardHeader
        title="Other Certificates"
        subtitle="Add certificates you've earned outside the program — paste a link or upload a PDF/image."
      />

      {isLoading ? (
        <p className="lms-muted">Loading…</p>
      ) : !items || items.length === 0 ? (
        <p className="lms-muted">Nothing here yet. Add your first external certificate below.</p>
      ) : (
        <div className="ext-cert-grid">
          {items.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="ext-cert">
              <div className="ext-cert__thumb">
                {isImage(c.url) ? <img src={c.url} alt={c.title} /> : <FileText size={26} />}
              </div>
              <div className="ext-cert__body">
                <div className="ext-cert__title">{c.title}</div>
                {c.issuer && <div className="lms-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{c.issuer}</div>}
                <span className="ext-cert__open"><ExternalLink size={12} /> Open</span>
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--danger ext-cert__del"
                aria-label={`Delete ${c.title}`}
                onClick={(e) => { e.preventDefault(); window.confirm('Remove this certificate?') && del.mutate(c.id); }}
              >
                <Trash2 size={13} />
              </button>
            </a>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="ext-cert-add">
        <Input label="Certificate title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. AWS Certified AI Practitioner" />
        <Input label="Issuer (optional)" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="e.g. Amazon, Coursera" />

        <div className="ext-cert-add__toggle">
          <button type="button" className={form.mode === 'link' ? 'is-active' : ''} onClick={() => setForm({ ...form, mode: 'link' })}>Paste link</button>
          <button type="button" className={form.mode === 'file' ? 'is-active' : ''} onClick={() => setForm({ ...form, mode: 'file' })}>Upload file</button>
        </div>

        {form.mode === 'link' ? (
          <Input label="Certificate link" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
        ) : (
          <label className="field">
            <span className="field__label">PDF or image</span>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
          </label>
        )}

        {err && <span className="field__error">{err}</span>}
        <Button type="submit" loading={add.isPending} style={{ alignSelf: 'flex-start' }}>
          <Upload size={15} /> Add certificate
        </Button>
      </form>
    </>
  );
}
