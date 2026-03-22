import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { QueueListIcon, ClockIcon } from '@heroicons/react/24/outline';

const ActivityLogs = () => {
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today'); // 'today' or 'all'

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch all to ensure consistency across timezones for Today filter
      const [appRes, auditRes] = await Promise.all([
        api.get('/app-logs/'),
        api.get('/audit-logs/')
      ]);
      
      const appLogs = (appRes.data.results || appRes.data).map(log => ({
        ...log,
        type: 'app'
      }));

      // Filter and format audit logs so they don't look like internal API spam
      const friendlyActionMap = {
        'login': 'Logged In',
        'logout': 'Logged Out',
        'create': 'Created Resource',
        'update': 'Updated Resource',
        'delete': 'Deleted Resource',
        'approve': 'Approved Request',
        'reject': 'Rejected Request'
      };

      const auditLogs = (auditRes.data.results || auditRes.data).map(log => {
        let desc = log.description || '';
        if (desc.includes('/api/')) {
          desc = `System event logged for ${log.action_type.toLowerCase()}`;
        }
        
        return {
          id: `audit-${log.id}`,
          app_name: `System Event: ${friendlyActionMap[log.action_type] || log.action_type}`,
          category: 'system',
          duration_seconds: 0,
          timestamp: log.timestamp,
          description: desc,
          type: 'audit'
        };
      });
      
      const combined = [...appLogs, ...auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAllLogs(combined);
    } catch (err) {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const displayedLogs = React.useMemo(() => {
    if (filter === 'all') return allLogs;
    const today = new Date().toLocaleDateString('en-CA');
    return allLogs.filter(log => new Date(log.timestamp).toLocaleDateString('en-CA') === today);
  }, [allLogs, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <QueueListIcon className="h-6 w-6 text-indigo-400" />
            Activity & App Usage Logs
          </h2>
          <p className="text-slate-400 mt-1">Review your tracked application usage and system events.</p>
        </div>

        {/* Filter Toggle */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit h-fit">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === 'today' 
                ? 'bg-indigo-500 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === 'all' 
                ? 'bg-indigo-500 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading logs...</div>
        ) : displayedLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic">No activity logs recorded {filter === 'today' ? 'today' : 'yet'}.</div>
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
                {displayedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {log.url && log.type === 'app' ? (
                        <a href={log.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 underline decoration-indigo-500/30 underline-offset-4">
                          {log.app_name}
                        </a>
                      ) : (
                        log.app_name
                      )}
                      {log.type === 'audit' && <div className="text-xs text-slate-500 font-normal mt-0.5">{log.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${log.category === 'productive' ? 'bg-emerald-500/10 text-emerald-400' : 
                          log.category === 'unproductive' ? 'bg-rose-500/10 text-rose-400' : 
                          log.category === 'system' ? 'bg-indigo-500/10 text-indigo-400' :
                          'bg-slate-500/10 text-slate-400'}`}>
                        {log.category ? log.category.charAt(0).toUpperCase() + log.category.slice(1) : 'Neutral'}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-slate-500" />
                      {log.type === 'audit' ? 'Instant' : `${Math.floor((log.duration_seconds || 0) / 60)} mins`}
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
