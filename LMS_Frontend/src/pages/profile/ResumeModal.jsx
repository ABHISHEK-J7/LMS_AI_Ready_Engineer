import { Printer } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/shared';
import { Button, Modal, Spinner } from '@/components/ui';
import { useMyProjects } from '@/lib/projects';
import { useMyCertificates } from '@/lib/certificates';
import { useMyProgress } from '@/lib/progress';
import { formatDate } from '@/lib/format';
import './resume.css';

const prettyUrl = (u = '') => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * Auto-generated, printable resume built from the student's profile, platform
 * links, approved projects, certifications, and completed modules. Rendered as a
 * clean light "sheet" (theme-independent) inside a modal, with print/PDF support.
 */
export function ResumeModal({ open, user, onClose }) {
  const { data: projects, isLoading: lp } = useMyProjects();
  const { data: certs, isLoading: lc } = useMyCertificates({ enabled: open });
  const { data: progress, isLoading: lg } = useMyProgress({ enabled: open });

  const loading = lp || lc || lg;
  const links = SOCIAL_PLATFORMS
    .map((p) => ({ label: p.label, url: user.links?.[p.key] }))
    .filter((l) => l.url)
    .concat((user.customLinks ?? []).filter((l) => l.url).map((l) => ({ label: l.label, url: l.url })));
  const approvedProjects = (projects ?? []).filter((p) => p.status === 'approved');
  const completedModules = (progress?.modules ?? []).filter((m) => m.completed || m.passed);
  const certificates = certs ?? [];

  return (
    <Modal open={open} title="My Resume" size="lg" onClose={onClose}
      headerAction={
        <button type="button" className="modal__action" title="Print / Save as PDF" aria-label="Print resume" onClick={() => window.print()}>
          <Printer size={16} />
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}><Spinner size={28} /></div>
      ) : (
        <div className="resume-print-area">
          <article className="resume">
            {/* Header */}
            <header className="resume__head">
              <h1 className="resume__name">{user.name}</h1>
              <div className="resume__contact">
                {user.email && <span>{user.email}</span>}
                {user.phone && <span>· {user.phone}</span>}
              </div>
              {links.length > 0 && (
                <div className="resume__links">
                  {links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer">{l.label}: {prettyUrl(l.url)}</a>
                  ))}
                </div>
              )}
            </header>

            {user.bio && (
              <section className="resume__section">
                <h2>Profile</h2>
                <p className="resume__bio">{user.bio}</p>
              </section>
            )}

            {(certificates.length > 0 || completedModules.length > 0) && (
              <section className="resume__section">
                <h2>Learning &amp; Certifications</h2>
                <ul className="resume__list">
                  {certificates.map((c) => (
                    <li key={c.id ?? c.certificateId}>
                      <strong>{c.isProgramCertificate ? 'Program Certificate' : (c.module?.name ?? c.moduleName ?? 'Module Certificate')}</strong>
                      <span className="resume__meta"> — AI Ready Engineer{c.issuedAt || c.createdAt ? ` · ${formatDate(c.issuedAt ?? c.createdAt)}` : ''}</span>
                    </li>
                  ))}
                  {completedModules
                    .filter((m) => !certificates.some((c) => (c.module?.name ?? c.moduleName) === m.name))
                    .map((m, i) => (
                      <li key={`m-${i}`}><strong>{m.name}</strong><span className="resume__meta"> — completed</span></li>
                    ))}
                </ul>
              </section>
            )}

            {approvedProjects.length > 0 && (
              <section className="resume__section">
                <h2>Projects</h2>
                {approvedProjects.map((p) => (
                  <div key={p.id} className="resume__project">
                    <div className="resume__project-head">
                      <strong>{p.title}</strong>
                      {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer">{prettyUrl(p.repoUrl)}</a>}
                    </div>
                    {p.description && <p className="resume__project-desc">{p.description}</p>}
                  </div>
                ))}
              </section>
            )}

            {links.length > 0 && (
              <section className="resume__section">
                <h2>Coding &amp; Professional Profiles</h2>
                <ul className="resume__list">
                  {links.map((l, i) => (
                    <li key={i}><strong>{l.label}:</strong> <a href={l.url} target="_blank" rel="noreferrer">{prettyUrl(l.url)}</a></li>
                  ))}
                </ul>
              </section>
            )}

            {certificates.length === 0 && approvedProjects.length === 0 && links.length === 0 && !user.bio && (
              <p className="resume__empty">Add a bio, your coding-profile links, and submit projects to build a richer resume.</p>
            )}
          </article>
        </div>
      )}
    </Modal>
  );
}
