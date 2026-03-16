import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { QueueListIcon, ClockIcon } from '@heroicons/react/24/outline';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/app-logs/');
      setLogs(res.data.results || res.data);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <QueueListIcon className="h-6 w-6 text-indigo-400" />
          Activity & App Usage Logs
        </h2>
        <p className="text-slate-400 mt-1">Review your tracked application usage and system events.</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic">No activity logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Application/Website</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">{log.app_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${log.category === 'productive' ? 'bg-emerald-500/10 text-emerald-400' : 
                          log.category === 'unproductive' ? 'bg-rose-500/10 text-rose-400' : 
                          'bg-slate-500/10 text-slate-400'}`}>
                        {log.category || 'Neutral'}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-slate-500" />
                      {Math.floor((log.duration_seconds || 0) / 60)} mins
                    </td>
                    <td className="px-6 py-4">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;
