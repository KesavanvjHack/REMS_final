import { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import DashboardLayout from './DashboardLayout';

const ProtectedRoute = ({ allowedRoles }) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const loading = auth?.loading;

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="relative">
        <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-b-cyan-400 rounded-full animate-spin [animation-duration:1.5s]"></div>
      </div>
      <div className="mt-8 text-center animate-pulse">
        <h3 className="text-xl font-bold text-white tracking-widest uppercase">REMS</h3>
        <p className="text-slate-500 text-xs mt-2 uppercase tracking-[0.3em]">Resuming Workplace Session</p>
      </div>
    </div>
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'manager') return <Navigate to="/manager" replace />;
    return <Navigate to="/employee" replace />;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};

export default ProtectedRoute;
