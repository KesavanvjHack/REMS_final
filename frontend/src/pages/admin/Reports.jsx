import { useState, useEffect } from 'react';
import api from '../../api/axios';
import ResponsiveTable from '../../components/ResponsiveTable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ChartBarSquareIcon } from '@heroicons/react/24/outline';

const AdminReports = () => {
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports/?type=team');
      setTeamData(res.data);
    } catch (error) {
      console.error('Failed to load reports', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Reports...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <ChartBarSquareIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Employee Productivity Analytics</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-white mb-6">Average Daily Work & Idle Hours by Employee</h2>
        <div className="h-96 w-full min-w-0" style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
            <BarChart data={teamData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="user_name" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#10b981" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="avg_work_hours" name="Avg Work (h)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_idle_hours" name="Avg Idle (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ResponsiveTable title="Detailed Attendance Rates">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold text-center">Rate</th>
              <th className="px-6 py-4 font-semibold text-center">Present</th>
              <th className="px-6 py-4 font-semibold text-center">Absent</th>
              <th className="px-6 py-4 font-semibold text-center">Half Days</th>
              <th className="px-6 py-4 font-semibold text-center">On Leave</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {teamData.map((emp) => (
              <tr key={emp.user_id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">{emp.user_name}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded bg-slate-900 border font-medium
                    ${emp.attendance_rate >= 90 ? 'text-emerald-400 border-emerald-500/30' : 
                      emp.attendance_rate >= 75 ? 'text-amber-400 border-amber-500/30' : 
                      'text-rose-400 border-rose-500/30'}
                  `}>
                    {emp.attendance_rate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-center text-emerald-400">{emp.present}</td>
                <td className="px-6 py-4 text-center text-rose-400">{emp.absent}</td>
                <td className="px-6 py-4 text-center text-amber-400">{emp.half_day}</td>
                <td className="px-6 py-4 text-center text-cyan-400">{emp.on_leave}</td>
              </tr>
            ))}
            {teamData.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No data available</td>
              </tr>
            )}
          </tbody>
        </table>
      </ResponsiveTable>
    </div>
  );
};

export default AdminReports;
