import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnnouncementsSeenAt, markAnnouncementsSeen, useAnnouncements } from './announcements';
import { useCertReviews } from './externalCertificates';
import { useProjectReviews } from './projects';

/**
 * Unread counts for admin sidebar nav items, keyed by route. "Unread" =
 * announcements newer than the last visit to the Announcements tab.
 *
 * @returns {Record<string, number>}
 */
export function useNavBadges(enabled = true) {
  const location = useLocation();
  const { data: announcements } = useAnnouncements({ enabled });
  const { data: certReviews } = useCertReviews(enabled); // admins always review
  const { data: projectReviews } = useProjectReviews(enabled);
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

  const approvalsCount =
    (certReviews ?? []).filter((c) => c.status === 'pending').length +
    (projectReviews ?? []).filter((p) => p.status === 'pending').length;

  return { '/app/announcements': annCount, '/app/approvals': approvalsCount };
}
