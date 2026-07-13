import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { UserRole } from '@/shared';
import { Button } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { NotificationsBell } from '@/components/NotificationsBell';
import { fileSrc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageTransition, useSidebarMotion } from '@/lib/anim';
import { useNavBadges } from '@/lib/navBadges';
import { NAV_BY_ROLE, ROLE_LABEL } from './navConfig';
import './layout.css';

function initials(name) {
  const result = (name ?? '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return result || '?';
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const orgView = useAuth((s) => s.orgView);
  const templateMissing = useAuth((s) => s.templateMissing);
  const clearOrgView = useAuth((s) => s.clearOrgView);
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { navRef, indicatorRef } = useSidebarMotion(location.pathname);
  // A super admin managing tenants (not drilled in) works against the master
  // template — it has no announcements/certs/projects/notifications, so skip those
  // queries entirely (avoids marking the template's notifications read, etc.).
  const superManaging = user?.role === UserRole.SUPER_ADMIN && !orgView;
  const badges = useNavBadges(!superManaging);
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  if (!user) return null;

  // A super admin managing tenants gets the org nav; once drilled into an org they
  // act as its admin (admin nav).
  const navRole = superManaging ? UserRole.SUPER_ADMIN : UserRole.ADMIN;
  const nav = NAV_BY_ROLE[navRole];

  function exitOrg() {
    clearOrgView();
    qc.clear();
    navigate('/app/organizations', { replace: true });
  }

  // Sign out, then send them to /login. Without the explicit navigate we'd stay on
  // the current URL — and super-admin-only routes (e.g. /app/organizations) don't
  // exist once logged out, so the router would fall through to a 404.
  async function handleSignOut() {
    await logout();
    qc.clear();
    navigate('/login', { replace: true });
  }
  // Longest-prefix match so detail routes (/app/users/:id, etc.) resolve to their
  // section title instead of falling back to the first ("Dashboard") entry.
  const current =
    nav
      .filter((n) => location.pathname === n.to || location.pathname.startsWith(`${n.to}/`))
      .sort((a, b) => a.to.length - b.to.length)
      .pop() ?? nav[0];

  return (
    <div className="layout">
      {navOpen && <div className="sidebar__overlay" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar${navOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden>
            <GraduationCap size={20} strokeWidth={2.2} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__brand-text">AI Ready Engineer</div>
            <div className="sidebar__brand-sub">{ROLE_LABEL[user.role]} Portal</div>
          </span>
          <button type="button" className="sidebar__close" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" ref={navRef}>
          <span className="sidebar__indicator" ref={indicatorRef} aria-hidden />
          {nav.map((item) => {
            const count = badges[item.to] ?? 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/app'}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}
              >
                <span className="sidebar__link-icon" aria-hidden>
                  <item.Icon size={18} strokeWidth={2} />
                </span>
                <span className="sidebar__link-label">{item.label}</span>
                {count > 0 && (
                  <span className="sidebar__badge" aria-label={`${count} new`}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__left">
            <button type="button" className="topbar__menu" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <Menu size={22} strokeWidth={2} />
            </button>
            <div className="topbar__title">{current.label}</div>
          </div>
          <div className="topbar__right">
            {/* Notifications are per-org; a managing super admin has no org context. */}
            {!superManaging && <NotificationsBell />}
            <ThemeSwitcher />
            <div className="user-chip">
              <div className="user-chip__avatar">
                {user.avatarUrl ? (
                  <img src={fileSrc(user.avatarUrl)} alt={user.name} className="user-chip__avatar-img" />
                ) : (
                  initials(user.name)
                )}
              </div>
              <div className="user-chip__text">
                <div className="user-chip__name">{user.name}</div>
                <div className="user-chip__role">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="topbar__signout" onClick={handleSignOut}>
              <LogOut size={15} strokeWidth={2} />
              <span className="topbar__signout-label">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="content">
          {orgView && (
            <div className="org-banner">
              <Building2 size={16} />
              <span>Viewing organization <strong>{orgView.name}</strong> — you're acting as its admin.</span>
              <button type="button" className="org-banner__exit" onClick={exitOrg}>Exit to organizations</button>
            </div>
          )}
          {superManaging && templateMissing && (
            <div className="org-banner org-banner--warn">
              <Building2 size={16} />
              <span>The master template isn't set up, so <strong>Master Curriculum</strong> and{' '}
              <strong>Question Bank</strong> can't be edited. Run the seed to create it.</span>
            </div>
          )}
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
