import { Navigate } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function ProtectedRoute({ children, roles }) {
  const { user, status } = useAuth();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'unauthenticated' || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
