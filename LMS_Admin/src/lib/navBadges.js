import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnnouncementsSeenAt, markAnnouncementsSeen, useAnnouncements } from './announcements';

/**
 * Unread counts for admin sidebar nav items, keyed by route. "Unread" =
 * announcements newer than the last visit to the Announcements tab.
 *
 * @returns {Record<string, number>}
 */
export function useNavBadges() {
  const location = useLocation();
  const { data: announcements } = useAnnouncements();
  const [annSeen, setAnnSeen] = useState(getAnnouncementsSeenAt());

  useEffect(() => {
    if (location.pathname === '/app/announcements') {
      markAnnouncementsSeen();
      setAnnSeen(Date.now());
    }
  }, [location.pathname]);

  const annCount = (announcements ?? []).filter(
    (a) => new Date(a.createdAt).getTime() > annSeen,
  ).length;

  return { '/app/announcements': annCount };
}
