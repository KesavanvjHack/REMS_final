import { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { AuthContext } from '../context/AuthContext';
import useIdleDetection from '../hooks/useIdleDetection';

const DashboardLayout = ({ children }) => {
  const { user, idleThreshold } = useContext(AuthContext);
  
  // Only trigger idle detection for employees
  const isIdle = (user?.role === 'employee') ? useIdleDetection(idleThreshold) : false;

  return (
    <div className="flex bg-slate-900 min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-8 overflow-y-auto">
          {/* Global Idle Warning Banner */}
          {isIdle && (
            <div className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_20px_-4px_rgba(245,158,11,0.3)] animate-pulse">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-200 text-sm">You've been idle for {idleThreshold}+ minutes</p>
                <p className="text-xs text-amber-400/80 mt-0.5">Move your mouse or press any key to resume. Your manager has been notified.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">IDLE</span>
            </div>
          )}
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
