import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnnouncementsSeenAt, markAnnouncementsSeen, useAnnouncements } from './announcements';
import { useCertReviews } from './externalCertificates';
import { useProjectReviews } from './projects';
import { useSyllabusRequests } from './modules';

/**
 * Unread/pending counts for admin sidebar nav items, keyed by route.
 *  - Org admin: announcement + approval counts.
 *  - Managing super admin: pending master-syllabus requests awaiting approval.
 *
 * @param {{ superManaging?: boolean }} opts
 * @returns {Record<string, number>}
 */
export function useNavBadges({ superManaging = false } = {}) {
  const location = useLocation();
  const adminEnabled = !superManaging; // org-admin-only queries
  const { data: announcements } = useAnnouncements({ enabled: adminEnabled });
  const { data: certReviews } = useCertReviews(adminEnabled); // admins always review
  const { data: projectReviews } = useProjectReviews(adminEnabled);
  const { data: syllabusRequests } = useSyllabusRequests(superManaging);
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

  const syllabusPending = (syllabusRequests ?? []).filter((r) => r.status === 'pending').length;

  return {
    '/app/announcements': annCount,
    '/app/approvals': approvalsCount,
    '/app/syllabus-requests': syllabusPending,
  };
}
