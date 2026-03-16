import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit-logs/');
      setLogs(res.data.results || res.data);
    } catch (error) {
      console.error('Failed to load audit logs', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Audit Logs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Audit Trails</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Timestamp</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Action</th>
                <th className="px-6 py-4 font-semibold tracking-wider">User</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Description</th>
                <th className="px-6 py-4 font-semibold tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-xs">
                    {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${log.action_type === 'login' || log.action_type === 'logout' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 
                        log.action_type === 'create' || log.action_type === 'approve' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        log.action_type === 'delete' || log.action_type === 'reject' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        log.action_type === 'policy_change' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}
                    `}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-200">{log.user_email || 'System'}</td>
                  <td className="px-6 py-4 truncate max-w-sm" title={log.description}>{log.description}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{log.ip_address || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No audit logs recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
