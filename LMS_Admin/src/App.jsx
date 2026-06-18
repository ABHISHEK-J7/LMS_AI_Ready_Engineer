import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageSpinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { LoginPage } from '@/pages/LoginPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { StudentDetailPage } from '@/pages/students/StudentDetailPage';
import { NotFound } from '@/pages/NotFound';
import { AdminDashboard } from '@/pages/dashboards/AdminDashboard';
import { ModulesPage } from '@/pages/modules/ModulesPage';
import { ModuleDetailPage } from '@/pages/modules/ModuleDetailPage';
import { BatchesPage } from '@/pages/batches/BatchesPage';
import { BatchDetailPage } from '@/pages/batches/BatchDetailPage';
import { SchedulePage } from '@/pages/schedule/SchedulePage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { AssessmentsPage } from '@/pages/assessments/AssessmentsPage';
import { AssessmentEditor } from '@/pages/assessments/AssessmentEditor';
import { AuditPage } from '@/pages/audit/AuditPage';
// Lazy — pulls in the heavy xlsx parser only when the page is opened.
const QuestionBankPage = lazy(() => import('@/pages/questionBank/QuestionBankPage').then((m) => ({ default: m.QuestionBankPage })));
import { CertificatesPage } from '@/pages/certificates/CertificatesPage';
import { ApprovalsPage } from '@/pages/approvals/ApprovalsPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';
import { AnnouncementsPage } from '@/pages/announcements/AnnouncementsPage';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

/** Standalone ADMIN portal — every route is admin-only (login also rejects non-admins). */
export default function App() {
  const { status, bootstrap } = useAuth();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="modules" element={<ModulesPage />} />
        <Route path="modules/:id" element={<ModuleDetailPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="batches/:id" element={<BatchDetailPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="assessments" element={<AssessmentsPage />} />
        <Route path="assessments/:id" element={<AssessmentEditor />} />
        <Route path="question-bank" element={<Suspense fallback={<FullPageSpinner />}><QuestionBankPage /></Suspense>} />
        <Route path="certificates" element={<CertificatesPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
