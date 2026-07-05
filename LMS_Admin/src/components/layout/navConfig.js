import {
  LayoutDashboard,
  Users,
  BookOpen,
  UsersRound,
  ClipboardCheck,
  FileText,
  Megaphone,
  Award,
  BadgeCheck,
  BarChart3,
  Settings,
  Database,
  ScrollText,
} from 'lucide-react';
import { UserRole } from '@/shared';

/** Admin portal navigation. Only administrators use this app. Icons are Lucide components. */
export const NAV_BY_ROLE = {
  [UserRole.ADMIN]: [
    { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
    { label: 'Users', to: '/app/users', Icon: Users },
    { label: 'Modules', to: '/app/modules', Icon: BookOpen },
    { label: 'Batches', to: '/app/batches', Icon: UsersRound },
    { label: 'Attendance', to: '/app/attendance', Icon: ClipboardCheck },
    { label: 'Question Bank', to: '/app/question-bank', Icon: Database },
    { label: 'Assessments', to: '/app/assessments', Icon: FileText },
    { label: 'Announcements', to: '/app/announcements', Icon: Megaphone },
    { label: 'Certificates', to: '/app/certificates', Icon: Award },
    { label: 'Approvals', to: '/app/approvals', Icon: BadgeCheck },
    { label: 'Analytics', to: '/app/analytics', Icon: BarChart3 },
    { label: 'Audit Log', to: '/app/audit', Icon: ScrollText },
    { label: 'Settings', to: '/app/settings', Icon: Settings },
  ],
};

export const ROLE_LABEL = {
  [UserRole.ADMIN]: 'Administrator',
};
