import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { GraduationCap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { NotificationsBell } from '@/components/NotificationsBell';
import { useAuth } from '@/lib/auth';
import { PageTransition, useSidebarMotion } from '@/lib/anim';
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
  if (!user) return null;

  const nav = NAV_BY_ROLE[user.role];
  const current = nav.find((n) => n.to === location.pathname) ?? nav[0];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden>
            <GraduationCap size={20} strokeWidth={2.2} />
          </span>
          <span>
            <div className="sidebar__brand-text">AI Ready Engineer</div>
            <div className="sidebar__brand-sub">{ROLE_LABEL[user.role]} Portal</div>
          </span>
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
          <div className="topbar__title">{current.label}</div>
          <div className="topbar__right">
            <NotificationsBell />
            <ThemeSwitcher />
            <div className="user-chip">
              <div className="user-chip__avatar">{initials(user.name)}</div>
              <div>
                <div className="user-chip__name">{user.name}</div>
                <div className="user-chip__role">{ROLE_LABEL[user.role]}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut size={15} strokeWidth={2} style={{ marginRight: 6 }} />
              Sign out
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
