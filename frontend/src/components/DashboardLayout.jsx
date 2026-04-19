import { useContext, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { AuthContext } from '../context/AuthContext';

const DashboardLayout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  
  // Track last active page for session persistence across browser restarts
  useEffect(() => {
    if (user && location.pathname !== '/' && !location.pathname.includes('/login')) {
      localStorage.setItem('rems_last_active_page', location.pathname);
    }
  }, [location.pathname, user]);

  return (
    <div className="flex bg-slate-900 h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 lg:ml-64 flex flex-col h-screen max-w-full overflow-hidden">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto relative">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
