import { useContext, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts & Auth
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const PolicyConfig = lazy(() => import('./pages/admin/PolicyConfig'));
const HolidayManagement = lazy(() => import('./pages/admin/HolidayManagement'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const Export = lazy(() => import('./pages/admin/Export'));
const TaskProjectHub = lazy(() => import('./pages/admin/TaskProjectHub'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const OrganizationManagement = lazy(() => import('./pages/admin/OrganizationManagement'));
const AttendanceHub = lazy(() => import('./pages/admin/AttendanceHub'));

// Manager Pages
const ManagerDashboard = lazy(() => import('./pages/manager/Dashboard'));
const TeamAttendance = lazy(() => import('./pages/manager/TeamAttendance'));
const ManagerReview = lazy(() => import('./pages/manager/ManagerReview'));
const LeaveApproval = lazy(() => import('./pages/manager/LeaveApproval'));
const TeamReports = lazy(() => import('./pages/manager/TeamReports'));
const AssignTasks = lazy(() => import('./pages/manager/AssignTasks'));

// Employee Pages
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const WorkSession = lazy(() => import('./pages/employee/WorkSession'));
const MyAttendance = lazy(() => import('./pages/employee/MyAttendance'));
const LeaveRequest = lazy(() => import('./pages/employee/LeaveRequest'));
const MyReports = lazy(() => import('./pages/employee/MyReports'));
const MyTasks = lazy(() => import('./pages/employee/MyTasks'));
const MyDocuments = lazy(() => import('./pages/employee/MyDocuments'));
const ActivityLogs = lazy(() => import('./pages/employee/ActivityLogs'));
const Expenses = lazy(() => import('./pages/employee/Expenses'));
const NotFound = lazy(() => import('./pages/NotFound'));

const GlobalLoading = ({ message = "Resuming Workplace Session" }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
    <div className="relative">
      <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
      <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-b-cyan-400 rounded-full animate-spin [animation-duration:1.5s]"></div>
    </div>
    <div className="mt-8 text-center animate-pulse">
      <h3 className="text-xl font-bold text-white tracking-widest uppercase">REMS</h3>
      <p className="text-slate-500 text-xs mt-2 uppercase tracking-[0.3em]">{message}</p>
    </div>
  </div>
);

const RootRedirect = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const loading = auth?.loading;
  
  if (loading) return <GlobalLoading message="Establishing Workspace" />;

  if (!user) return <Navigate to="/login" replace />;

  // Try to restore previous page, or fallback to role-based dashboard
  const lastPage = localStorage.getItem('rems_last_active_page');
  
  if (lastPage && lastPage !== '/') {
      return <Navigate to={lastPage} replace />;
  }

  // Final fallback
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'manager') return <Navigate to="/manager" replace />;
  return <Navigate to="/employee" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Suspense fallback={<GlobalLoading />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/org" element={<OrganizationManagement />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/attendance" element={<AttendanceHub />} />
              <Route path="/admin/policy" element={<PolicyConfig />} />
              <Route path="/admin/holidays" element={<HolidayManagement />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/audit" element={<AuditLogs />} />
              <Route path="/admin/export" element={<Export />} />
              <Route path="/admin/tasks" element={<TaskProjectHub />} />
              <Route path="/admin/settings" element={<SystemSettings />} />
              <Route path="/admin/work" element={<WorkSession />} />
            </Route>

            {/* Manager Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
              <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/manager/team-attendance" element={<TeamAttendance />} />
              <Route path="/manager/review" element={<ManagerReview />} />
              <Route path="/manager/leave" element={<LeaveApproval />} />
              <Route path="/manager/reports" element={<TeamReports />} />
              <Route path="/manager/tasks" element={<AssignTasks />} />
              <Route path="/manager/audit" element={<AuditLogs />} />
              <Route path="/manager/work" element={<WorkSession />} />
            </Route>

            {/* Employee Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'employee']} />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
              <Route path="/employee/work" element={<WorkSession />} />
              <Route path="/employee/attendance" element={<MyAttendance />} />
              <Route path="/employee/leave" element={<LeaveRequest />} />
              <Route path="/employee/reports" element={<MyReports />} />
              <Route path="/employee/tasks" element={<MyTasks />} />
              <Route path="/employee/documents" element={<MyDocuments />} />
              <Route path="/employee/logs" element={<ActivityLogs />} />
              <Route path="/employee/expenses" element={<Expenses />} />
            </Route>
            
            {/* 404 Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
