import { UserRole } from '@lms/shared';
import { useAuth } from '@/lib/auth';
import { StudentDashboard } from './StudentDashboard';
import { TrainerDashboard } from './TrainerDashboard';

/** Renders the dashboard matching the signed-in user's role (student or trainer). */
export function DashboardRouter() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.TRAINER ? <TrainerDashboard /> : <StudentDashboard />;
}
