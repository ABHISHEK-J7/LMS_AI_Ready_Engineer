import {
  LayoutDashboard,
  Compass,
  CalendarDays,
  FileText,
  ClipboardCheck,
  Megaphone,
  HelpCircle,
  Award,
  BookOpen,
  UsersRound,
  CalendarClock,
  Unlock,
  BarChart3,
  BadgeCheck,
  Database,
  UserCircle,
} from 'lucide-react';
import { UserRole } from '@/shared';

/**
 * Role-based navigation. The sidebar structure is identical across roles
 * (same component, same patterns) — only the item set differs. Icons are
 * Lucide components (matching the Admin portal).
 */
export const NAV_BY_ROLE = {
  [UserRole.STUDENT]: [
    { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
    { label: 'My Curriculum', to: '/app/curriculum', Icon: Compass },
    { label: 'Class Schedule', to: '/app/schedule', Icon: CalendarDays },
    { label: 'Assessments', to: '/app/assessments', Icon: FileText },
    { label: 'Attendance', to: '/app/attendance', Icon: ClipboardCheck },
    { label: 'Announcements', to: '/app/announcements', Icon: Megaphone },
    { label: 'Doubts', to: '/app/doubts', Icon: HelpCircle },
    { label: 'Certificates', to: '/app/certificates', Icon: Award },
    { label: 'Profile', to: '/app/profile', Icon: UserCircle },
  ],
  [UserRole.TRAINER]: [
    { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
    { label: 'My Modules', to: '/app/modules', Icon: BookOpen },
    { label: 'My Batches', to: '/app/batches', Icon: UsersRound },
    { label: 'Class Schedule', to: '/app/schedule', Icon: CalendarDays },
    { label: 'Attendance Entry', to: '/app/attendance', Icon: CalendarClock },
    { label: 'Question Bank', to: '/app/question-bank', Icon: Database },
    { label: 'Assessments', to: '/app/assessments', Icon: Unlock },
    { label: 'Announcements', to: '/app/announcements', Icon: Megaphone },
    { label: 'Doubts', to: '/app/doubts', Icon: HelpCircle },
    { label: 'Approvals', to: '/app/approvals', Icon: BadgeCheck },
    { label: 'Analytics', to: '/app/analytics', Icon: BarChart3 },
    { label: 'Profile', to: '/app/profile', Icon: UserCircle },
  ],
};

export const ROLE_LABEL = {
  [UserRole.STUDENT]: 'Student',
  [UserRole.TRAINER]: 'Trainer',
};
