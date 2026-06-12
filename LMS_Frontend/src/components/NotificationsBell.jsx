import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useToast } from '@/components/ui';
import {
  getAnnouncementsSeenAt,
  markAnnouncementsSeen,
  useAnnouncements,
} from '@/lib/announcements';
import { formatDate } from '@/lib/format';
import './notifications-bell.css';

export function NotificationsBell() {
  const { data: items } = useAnnouncements();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(getAnnouncementsSeenAt());
  const [panelItems, setPanelItems] = useState([]); // the "new" ones captured when opened
  const ref = useRef(null);
  const knownIds = useRef(null); // null until the first load (so we don't toast existing ones)
  const navigate = useNavigate();

  const list = items ?? [];
  const unreadList = list.filter((a) => new Date(a.createdAt).getTime() > seenAt);
  const unread = unreadList.length;

  // Pop a toast whenever NEW notifications arrive (after the initial load).
  useEffect(() => {
    if (!items) return;
    const ids = items.map((a) => a.id);
    if (knownIds.current === null) {
      knownIds.current = new Set(ids); // baseline — don't announce what's already here
      return;
    }
    const fresh = items.filter((a) => !knownIds.current.has(a.id));
    if (fresh.length === 1) {
      toast.info(`New notification: ${fresh[0].title}`);
    } else if (fresh.length > 1) {
      toast.info(`You have ${fresh.length} new notifications`);
    }
    fresh.forEach((a) => knownIds.current.add(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle() {
    const next = !open;
    if (next) {
      // Capture the currently-NEW announcements, THEN mark them seen — so the
      // panel keeps showing them even though the unread badge clears.
      setPanelItems(unreadList);
      if (unread > 0) {
        markAnnouncementsSeen();
        setSeenAt(Date.now());
      }
    }
    setOpen(next);
  }

  return (
    <div className="bell" ref={ref}>
      <button className="bell__btn" aria-label={`Notifications (${unread} new)`} onClick={toggle}>
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && <span className="bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell__panel">
          <div className="bell__header">
            <span>New notifications</span>
            <span className="bell__count">{panelItems.length}</span>
          </div>
          {panelItems.length === 0 ? (
            <div className="bell__empty">You&apos;re all caught up — no new notifications.</div>
          ) : (
            panelItems.slice(0, 8).map((a) => (
              <div key={a.id} className="bell__item">
                <div className="bell__title">{a.title}</div>
                <div className="bell__meta">
                  {a.author?.name ?? 'Trainer'} · {a.batch?.name ?? a.module?.name ?? 'Everyone'} · {formatDate(a.createdAt)}
                </div>
              </div>
            ))
          )}
          <button
            className="bell__all"
            onClick={() => {
              setOpen(false);
              navigate('/app/announcements');
            }}
          >
            View all announcements →
          </button>
        </div>
      )}
    </div>
  );
}
