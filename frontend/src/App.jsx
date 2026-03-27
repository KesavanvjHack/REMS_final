import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts & Auth
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import PolicyConfig from './pages/admin/PolicyConfig';
import HolidayManagement from './pages/admin/HolidayManagement';
import AdminReports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';
import Export from './pages/admin/Export';
import TaskProjectHub from './pages/admin/TaskProjectHub';
import SystemSettings from './pages/admin/SystemSettings';
import OrganizationManagement from './pages/admin/OrganizationManagement';
import AttendanceHub from './pages/admin/AttendanceHub';

import ManagerDashboard from './pages/manager/Dashboard';
import TeamAttendance from './pages/manager/TeamAttendance';
import ManagerReview from './pages/manager/ManagerReview';
import LeaveApproval from './pages/manager/LeaveApproval';
import TeamReports from './pages/manager/TeamReports';
import AssignTasks from './pages/manager/AssignTasks';

import EmployeeDashboard from './pages/employee/Dashboard';
import WorkSession from './pages/employee/WorkSession';
import MyAttendance from './pages/employee/MyAttendance';
import LeaveRequest from './pages/employee/LeaveRequest';
import MyReports from './pages/employee/MyReports';
import MyTasks from './pages/employee/MyTasks';
import MyDocuments from './pages/employee/MyDocuments';
import ActivityLogs from './pages/employee/ActivityLogs';
import Expenses from './pages/employee/Expenses';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right">
          {(t) => (
            <ToastBar toast={t}>
              {({ icon, message }) => (
                <>
                  {icon}
                  {message}
                  {t.type !== 'loading' && (
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="ml-2 hover:bg-slate-700/50 p-1 rounded-full text-slate-400 hover:text-white transition-colors flex-shrink-0"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </ToastBar>
          )}
        </Toaster>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
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
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
