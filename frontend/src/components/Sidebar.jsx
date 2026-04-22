import { NavLink, useLocation } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  HomeIcon, UsersIcon, ShieldCheckIcon, CalendarDaysIcon, 
  ChartBarIcon, DocumentTextIcon, ArrowDownTrayIcon,
  CheckBadgeIcon, ClockIcon, BuildingOfficeIcon,
  RectangleGroupIcon, Cog8ToothIcon, ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon, FolderIcon, QueueListIcon, CurrencyDollarIcon,
  XMarkIcon, SignalIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024 && isOpen) {
      onClose();
    }
  }, [location.pathname]);

  if (!user) return null;

  const adminLinks = [
    { name: '🔴 Live Monitor', to: '/live-monitor', icon: SignalIcon },
    { name: 'Dashboard (Company KPIs)', to: '/admin', icon: HomeIcon },
    { name: 'Organization', to: '/admin/org', icon: BuildingOfficeIcon },
    { name: 'User Management', to: '/admin/users', icon: UsersIcon },
    { name: 'Attendance Hub', to: '/admin/attendance', icon: ClipboardDocumentListIcon },
    { name: 'Shift & Policy Setup', to: '/admin/policy', icon: ShieldCheckIcon },
    { name: 'Leave & Holidays', to: '/admin/holidays', icon: CalendarDaysIcon },
    { name: 'Productivity Analytics', to: '/admin/reports', icon: ChartBarIcon },
    { name: 'Task & Project Hub', to: '/admin/tasks', icon: RectangleGroupIcon },
    { name: 'System Audit Logs', to: '/admin/audit', icon: DocumentTextIcon },
    { name: 'Export & Payroll Data', to: '/admin/export', icon: ArrowDownTrayIcon },
    { name: 'System Settings', to: '/admin/settings', icon: Cog8ToothIcon },
  ];

  const managerLinks = [
    { name: '🔴 Live Monitor', to: '/live-monitor', icon: SignalIcon },
    { name: 'Team Dashboard', to: '/manager', icon: HomeIcon },
    { name: 'My Team', to: '/manager/team-attendance', icon: UsersIcon },
    { name: 'My Timesheet', to: '/manager/work', icon: ClockIcon },
    { name: 'Approvals Inbox', to: '/manager/review', icon: CheckBadgeIcon },
    { name: 'Leave Approvals', to: '/manager/leave', icon: CalendarDaysIcon },
    { name: 'Team Productivity & Analytics', to: '/manager/reports', icon: ChartBarIcon },
    { name: 'Assign Tasks', to: '/manager/tasks', icon: ClipboardDocumentCheckIcon },
    { name: 'System Audit Logs', to: '/manager/audit', icon: DocumentTextIcon },
    { name: 'My Personal Dashboard', to: '/employee', icon: HomeIcon },
  ];

  const employeeLinks = [
    { name: 'My Dashboard', to: '/employee', icon: HomeIcon },
    { name: 'My Attendance', to: '/employee/attendance', icon: BuildingOfficeIcon },
    { name: 'My Timesheet', to: '/employee/work', icon: ClockIcon },
    { name: 'Apply for Leave', to: '/employee/leave', icon: CalendarDaysIcon },
    { name: 'My Tasks', to: '/employee/tasks', icon: ClipboardDocumentListIcon },
    { name: 'My Documents', to: '/employee/documents', icon: FolderIcon },
    { name: 'My Activity & Idle Logs', to: '/employee/logs', icon: QueueListIcon },
  ];

  let links = employeeLinks;
  if (user.role === 'admin') links = adminLinks;
  if (user.role === 'manager') links = managerLinks;

  return (
    <div className={`
      w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed inset-y-0 left-0 z-50 
      transition-transform duration-300 transform 
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="flex items-center justify-between px-6 h-20 border-b border-slate-800">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent transform transition hover:scale-105">
          REMS
        </h1>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-400 hover:text-white"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/manager' || link.to === '/employee'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group hardware-accelerated active:scale-[0.98] ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <link.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-medium tracking-wide text-sm">{link.name}</span>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
