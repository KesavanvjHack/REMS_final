import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ClockIcon, ChartBarIcon, CalendarDaysIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { formatDuration } from '../../utils/format';

const EmployeeDashboard = () => {
  const { user } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sumRes, dailyRes] = await Promise.all([
        api.get('/reports/?type=summary'),
        api.get('/reports/?type=daily&days=7')
      ]);
      setSummary(sumRes.data);
      setDailyData(dailyRes.data);
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
        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Welcome back...</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
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
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex items-center gap-4 overflow-hidden">
      <div className={`p-4 rounded-xl shrink-0 ${colorClass}`}>
        <Icon className="h-8 w-8 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-[13px] font-medium leading-snug break-words" title={title}>{title}</p>
        <p className="text-2xl font-bold text-slate-100 truncate mt-1" title={value}>{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 page-fade-in">
      <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Welcome back, {user?.full_name?.split(' ')[0]}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Attendance Rate" 
          value={`${summary?.attendance_rate || 0}%`} 
          icon={CheckBadgeIcon} 
          colorClass="bg-emerald-500" 
        />
        <StatCard 
          title="Avg Daily Hours" 
          value={formatDuration((summary?.avg_work_hours || 0) * 3600)} 
          icon={ClockIcon} 
          colorClass="bg-indigo-500" 
        />
        <StatCard 
          title="Days Present" 
          value={summary?.present || 0} 
          icon={CalendarDaysIcon} 
          colorClass="bg-cyan-500" 
        />
        <StatCard 
          title="Leave Days Taken" 
          value={summary?.on_leave || 0} 
          icon={ChartBarIcon} 
          colorClass="bg-amber-500" 
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl mt-8">
        <h2 className="text-lg font-semibold text-white mb-6">My Week at a Glance</h2>
        <div className="h-96 w-full">
          <ResponsiveContainer>
            <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#10b981" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="productive_hours" name="Total Work (h)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="break_hours" name="Break (h)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="idle_hours" name="Idle (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
