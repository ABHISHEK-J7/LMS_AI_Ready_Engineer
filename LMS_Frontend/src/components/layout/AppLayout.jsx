import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { NotificationsBell } from '@/components/NotificationsBell';
import { useAuth } from '@/lib/auth';
import { PageTransition, useSidebarMotion } from '@/lib/anim';
import { fileSrc } from '@/lib/api';
import { useNavBadges } from '@/lib/navBadges';
import { NAV_BY_ROLE, ROLE_LABEL } from './navConfig';
import './layout.css';

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { navRef, indicatorRef } = useSidebarMotion(location.pathname);
  const badges = useNavBadges();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  if (!user) return null;

  const nav = NAV_BY_ROLE[user.role];
  const current = nav.find((n) => n.to === location.pathname) ?? nav[0];

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
            <NotificationsBell />
            <ThemeSwitcher />
            <Link to="/app/profile" className="user-chip" title="View your profile" aria-label="View your profile">
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
            </Link>
            <Button variant="outline" size="sm" className="topbar__signout" onClick={logout}>
              <LogOut size={15} strokeWidth={2} />
              <span className="topbar__signout-label">Sign out</span>
            </Button>
          </div>
        </header>

        <main className="content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
