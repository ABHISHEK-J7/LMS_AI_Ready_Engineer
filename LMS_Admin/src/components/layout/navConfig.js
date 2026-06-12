import {
  LayoutDashboard,
  Users,
  BookOpen,
  UsersRound,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Megaphone,
  Award,
  BarChart3,
  Settings,
} from 'lucide-react';
import { UserRole } from '@lms/shared';

/** Admin portal navigation. Only administrators use this app. Icons are Lucide components. */
export const NAV_BY_ROLE = {
  [UserRole.ADMIN]: [
    { label: 'Dashboard', to: '/app', Icon: LayoutDashboard },
    { label: 'Users', to: '/app/users', Icon: Users },
    { label: 'Modules', to: '/app/modules', Icon: BookOpen },
    { label: 'Batches', to: '/app/batches', Icon: UsersRound },
    { label: 'Class Schedule', to: '/app/schedule', Icon: CalendarDays },
    { label: 'Attendance', to: '/app/attendance', Icon: ClipboardCheck },
    { label: 'Assessments', to: '/app/assessments', Icon: FileText },
    { label: 'Announcements', to: '/app/announcements', Icon: Megaphone },
    { label: 'Certificates', to: '/app/certificates', Icon: Award },
    { label: 'Analytics', to: '/app/analytics', Icon: BarChart3 },
    { label: 'Settings', to: '/app/settings', Icon: Settings },
  ],
};

export const ROLE_LABEL = {
  [UserRole.ADMIN]: 'Administrator',
};
