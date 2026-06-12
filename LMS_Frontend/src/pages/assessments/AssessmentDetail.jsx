import { UserRole } from '@lms/shared';
import { useAuth } from '@/lib/auth';
import { AssessmentEditor } from './AssessmentEditor';
import { TakeAssessment } from './TakeAssessment';

/** Students take/review the assessment; trainers & admins author it. */
export function AssessmentDetail() {
  const role = useAuth((s) => s.user?.role);
  return role === UserRole.STUDENT ? <TakeAssessment /> : <AssessmentEditor />;
}
