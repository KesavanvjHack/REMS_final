import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ChartBarSquareIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const TeamReports = () => {
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
      toast.error('Failed to load team reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Team Analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <ChartBarSquareIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Team Productivity Analytics</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-white mb-6">Direct Reports - Average Daily Work vs Idle Time</h2>
        <div className="h-96 w-full">
          <ResponsiveContainer>
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
    </div>
  );
};

export default TeamReports;
