import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { UsersIcon, ClockIcon, CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const AdminDashboard = () => {
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
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Dashboard...</div>;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const pieData = summary ? [
    { name: 'Present', value: summary.present },
    { name: 'Half Day', value: summary.half_day },
    { name: 'On Leave', value: summary.on_leave },
    { name: 'Absent', value: summary.absent },
  ] : [];

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Organization Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Attendance Recorded" 
          value={summary?.total || 0} 
          icon={UsersIcon} 
          colorClass="bg-indigo-500" 
        />
        <StatCard 
          title="Overall Attendance Rate" 
          value={`${summary?.attendance_rate || 0}%`} 
          icon={CheckBadgeIcon} 
          colorClass="bg-emerald-500" 
        />
        <StatCard 
          title="Avg Daily Work Hours" 
          value={`${summary?.avg_work_hours || 0}h`} 
          icon={ClockIcon} 
          colorClass="bg-cyan-500" 
        />
        <StatCard 
          title="Avg Daily Idle Hours" 
          value={`${summary?.avg_idle_hours || 0}h`} 
          icon={ExclamationTriangleIcon} 
          colorClass="bg-amber-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">7-Day Productivity Trend</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="productive_hours" name="Productive (h)" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="idle_hours" name="Idle (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="break_hours" name="Break (h)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Attendance Distribution</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
