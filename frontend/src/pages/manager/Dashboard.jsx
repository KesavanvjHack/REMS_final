import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { UsersIcon, ExclamationTriangleIcon, AcademicCapIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';

const ManagerDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sumRes, teamRes] = await Promise.all([
        api.get('/reports/?type=summary'),
        api.get('/reports/?type=team')
      ]);
      setSummary(sumRes.data);
      setTeamStats(teamRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="space-y-6 page-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Manager Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
              <div className="p-4 rounded-xl bg-slate-700 w-16 h-16 skeleton-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-700 rounded skeleton-pulse"></div>
                <div className="h-8 w-16 bg-slate-700 rounded skeleton-pulse"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl h-96 mt-8 skeleton-pulse"></div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4">
      <div className={`p-4 rounded-xl ${colorClass}`}>
        <Icon className="h-8 w-8 text-white" />
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-3xl font-bold text-slate-100">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 page-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Manager Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard 
          title="Team Members Recorded" 
          value={summary?.total || 0} 
          icon={UsersIcon} 
          colorClass="bg-indigo-500" 
        />
        <StatCard 
          title="Avg Team Attendance Rate" 
          value={`${summary?.attendance_rate || 0}%`} 
          icon={AcademicCapIcon} 
          colorClass="bg-emerald-500" 
        />
        <StatCard 
          title="Avg Team Idle Time" 
          value={`${summary?.avg_idle_hours || 0}h`} 
          icon={ExclamationTriangleIcon} 
          colorClass="bg-amber-500" 
        />
        <StatCard 
          title="Leaves Currently" 
          value={summary?.on_leave || 0} 
          icon={MapPinIcon} 
          colorClass="bg-cyan-500" 
        />
        <StatCard 
          title="Team Attendance Calculating" 
          value={summary?.calculating || 0} 
          icon={ClockIcon} 
          colorClass="bg-blue-500" 
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mt-8">
        <h2 className="text-lg font-semibold text-white mb-6">Team Productivity Overview</h2>
        <div className="h-96 w-full">
          <ResponsiveContainer>
            <BarChart data={teamStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="user_name" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#10b981" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="avg_work_hours" name="Total Work (h)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_idle_hours" name="Avg Idle (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
