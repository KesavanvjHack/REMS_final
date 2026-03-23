import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { ClipboardDocumentListIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');

  // Export State
  const [exportCategory, setExportCategory] = useState('all');
  const [exportUserId, setExportUserId] = useState('');
  const [exportTimeRange, setExportTimeRange] = useState('weekly');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [users, setUsers] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchUsers();
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

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data.results || res.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  // Handle Export Time Range Changes
  useEffect(() => {
    const today = new Date();
    if (exportTimeRange === 'weekly') {
      setExportFromDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setExportToDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (exportTimeRange === 'monthly') {
      setExportFromDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setExportToDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else {
      setExportFromDate('');
      setExportToDate('');
    }
  }, [exportTimeRange]);

  const handleExport = async () => {
    if (exportTimeRange === 'custom' && (!exportFromDate || !exportToDate)) {
      toast.error('Please select both from and to dates for custom range.');
      return;
    }

    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        type: 'audit',
        export_format: exportFormat
      });

      if (exportCategory !== 'all') {
        params.append('category', exportCategory);
      }
      if (exportCategory === 'particular_employee' && exportUserId) {
        params.append('user_id', exportUserId);
      }
      if (exportFromDate) params.append('from_date', exportFromDate);
      if (exportToDate) params.append('to_date', exportToDate);

      const response = await api.get(`/export/?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `system_audit_trails_${format(new Date(), 'yyyyMMdd')}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Audit Logs exported successfully');
    } catch (error) {
      toast.error('Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };


  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="space-y-6 page-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-64 bg-slate-700 rounded skeleton-pulse"></div>
          <div className="h-10 w-48 bg-slate-700 rounded skeleton-pulse"></div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-40 skeleton-pulse mb-6"></div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mt-6">
          <div className="p-4 bg-slate-900/50 h-10 skeleton-pulse"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-6 border-b border-slate-700/50 h-16 skeleton-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    const logDate = new Date(log.timestamp);
    const today = new Date();
    return logDate.getDate() === today.getDate() &&
           logDate.getMonth() === today.getMonth() &&
           logDate.getFullYear() === today.getFullYear();
  });

  return (
    <div className="space-y-6 pb-10 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Audit Trails</h1>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-700 w-fit">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'today' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Today's Logs
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Logs
          </button>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <ArrowDownTrayIcon className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Export Audit Logs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <select
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
              value={exportCategory}
              onChange={(e) => setExportCategory(e.target.value)}
            >
              <option value="all">All Logs</option>
              <option value="employees">Employees Only</option>
              <option value="managers">Managers Only</option>
              <option value="particular_employee">Particular User</option>
            </select>
          </div>

          {exportCategory === 'particular_employee' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select User</label>
              <select
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
                value={exportUserId}
                onChange={(e) => setExportUserId(e.target.value)}
              >
                <option value="">-- Select User --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                ))}
              </select>
            </div>
          )}

          <div className={exportCategory === 'particular_employee' ? '' : 'lg:col-span-1'}>
            <label className="block text-sm font-medium text-slate-300 mb-2">Time Range</label>
            <select
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
              value={exportTimeRange}
              onChange={(e) => setExportTimeRange(e.target.value)}
            >
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>

          {exportTimeRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">From Date</label>
                <input
                  type="date"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={exportFromDate}
                  onChange={(e) => setExportFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">To Date</label>
                <input
                  type="date"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={exportToDate}
                  onChange={(e) => setExportToDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Format</label>
            <select
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
          </div>

          <div className="lg:col-span-1">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {isExporting ? 'Exporting...' : 'Export Logs'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Audit Logs Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mt-6">
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
              {filteredLogs.map((log) => (
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
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    {filter === 'today' ? "No audit logs recorded for today" : "No audit logs recorded"}
                  </td>
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
