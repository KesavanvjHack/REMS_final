import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ChartBarSquareIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const MyReports = () => {
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/reports/?type=daily&days=30');
      setDailyData(res.data);
    } catch (error) {
      toast.error('Failed to load my reports');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Report Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <ChartBarSquareIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">My Productivity Analytics (Last 30 Days)</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-white mb-6">Work vs Idle Trend</h2>
        <div className="h-[400px] w-full">
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
              <Bar yAxisId="left" dataKey="productive_hours" name="Productive (h)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="break_hours" name="Break (h)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="idle_hours" name="Idle (h)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MyReports;
