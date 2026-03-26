import { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { AuthContext } from '../../context/AuthContext';
import { format } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  UsersIcon, ClockIcon, CheckBadgeIcon, ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaysLeaves, setTodaysLeaves] = useState([]);
  const { policy } = useContext(AuthContext);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [sumRes, dailyRes, leavesRes] = await Promise.all([
        api.get('/reports/?type=summary'),
        api.get('/reports/?type=daily&days=7'),
        api.get('/attendance/todays_absences/')
      ]);
      setSummary(sumRes.data);
      setDailyData(dailyRes.data);
      setTodaysLeaves(Array.isArray(leavesRes.data) ? leavesRes.data : (leavesRes.data.results || []));
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="space-y-6 page-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-6">Organization Overview</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 p-6 rounded-2xl h-96 skeleton-pulse"></div>
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl h-96 skeleton-pulse"></div>
        </div>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const pieData = summary ? [
    { name: 'Present', value: summary.present },
    { name: 'Half Day', value: summary.half_day },
    { name: 'On Leave', value: summary.on_leave },
    { name: 'Absent', value: summary.absent },
  ] : [];

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white line-clamp-1">Organization Overview</h1>
        <button 
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-sm font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
        <StatCard 
          title="Attendance Calculating" 
          value={summary?.calculating || 0} 
          icon={ClockIcon} 
          colorClass="bg-blue-500" 
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

      {/* Today's Leaves Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Today's Leaves (Employees & Managers)</h2>
          </div>
          <div className="text-sm text-slate-400 font-medium">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold text-center">Role</th>
                <th className="px-6 py-4 font-semibold">Leave Type</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {todaysLeaves.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">No leaves or absences found.</td></tr>
              ) : (
                todaysLeaves.map((leave) => {
                  const now = new Date();
                  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                  const istDate = new Date(istString);
                  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
                  const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
                  const shiftEndMinutes = endHour * 60 + endMin;
                  const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;

                  const isCalculating = isBeforeShiftEnd && (leave.status || '').toLowerCase() === 'absent';
                  const displayStatus = isCalculating ? 'CALCULATING...' : (leave.status || 'N/A').toUpperCase();

                  return (
                    <tr key={leave.id} className="hover:bg-slate-700/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-100">{leave.user_name || leave.employee_name}</div>
                        <div className="text-xs text-slate-500">{leave.user_email || leave.employee_email}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          (leave.user_role || leave.employee_role) === 'manager' 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : 'bg-slate-700/50 text-slate-400 border-slate-600'
                        }`}>
                          {leave.user_role || leave.employee_role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{leave.leave_type === '-' ? '-' : (leave.leave_type || 'General')}</td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-slate-400" title={leave.reason}>{leave.reason}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider border ${
                          isCalculating ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          (leave.status || '').toLowerCase() === 'on_leave' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          (leave.status || '').toLowerCase() === 'absent' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
