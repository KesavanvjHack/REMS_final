import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { UserGroupIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { formatLastLogout, formatDecimalHours } from '../../utils/format';
import LiveDuration from '../../components/LiveDuration';
import { AuthContext } from '../../context/AuthContext';

const STATUS_COLORS = {
  working:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  on_break: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  idle:     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  offline:  'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

const ATTENDANCE_COLORS = {
  present:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  half_day: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  absent:   'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  on_leave: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  holiday:  'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
};

const TeamAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { policy } = useContext(AuthContext);
  const [liveSharers, setLiveSharers] = useState({}); // { employeeId: true/false }
  const [viewingEmployee, setViewingEmployee] = useState(null); // { id, name }

  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');
  const [exportEmployee, setExportEmployee] = useState('all');

  const fetchTeamAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/sessions/team-timesheet/');
      setAttendance(res.data.results || res.data);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error('Failed to load team timesheet');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewingEmployee(null);
  }, []);

  useEffect(() => {
    fetchTeamAttendance();

    // Auto-refresh every 1 minute
    const interval = setInterval(() => fetchTeamAttendance(true), 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchTeamAttendance]);

  const handleQuickSelect = (type) => {
    setExportType(type);
    const now = new Date();
    if (type === 'weekly') {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (type === 'monthly') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleExport = () => {
    let rawData = attendance;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      rawData = rawData.filter(rec => {
        const d = new Date(rec.date);
        return d >= start && d <= end;
      });
    }

    if (exportEmployee !== 'all') {
      rawData = rawData.filter(rec => rec.user_name === exportEmployee);
    }

    if (rawData.length === 0) {
      toast.error('No timesheet records found for the selected criteria');
      return;
    }

    const headers = ['Date', 'Employee Name', 'Email', 'Login Time', 'Last Logout', 'Attendance Status', 'Work Hours', 'Break (Hours)', 'Idle (Hours)', 'Gap/Late (Hours)', 'Anomalies', 'Remarks / Reason'];
    const csvData = rawData.map(rec => [
         format(new Date(rec.date), 'yyyy-MM-dd'),
         rec.user_name,
         rec.user_email,
         formatLastLogout(rec.first_login),
         formatLastLogout(rec.last_logout),
         rec.status,
         formatDecimalHours(rec.total_work_seconds),
         formatDecimalHours(rec.total_break_seconds),
         formatDecimalHours(rec.total_idle_seconds),
         formatDecimalHours(rec.missing_seconds),
         rec.is_flagged ? `Yes - ${rec.flag_reason}` : 'No',
         rec.manager_remark || rec.flag_reason || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(r => {
        const val = r === undefined || r === null ? '' : String(r);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Team_Timesheet_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Team timesheet export downloaded successfully!');
  };

  if (loading) return (
    <div className="flex items-center gap-3 text-indigo-400 mt-10">
      <ArrowPathIcon className="h-5 w-5 animate-spin" />
      Loading Team Timesheet...
    </div>
  );

  const uniqueEmployees = Array.from(new Set(attendance.map(a => a.user_name))).filter(Boolean).sort();
  
  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:items-start gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <UserGroupIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Team Timesheet</h1>
            {lastUpdated && (
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Last synced: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              Showing your direct reports • Live status • Updated every 1.0m
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchTeamAttendance()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-all flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs font-medium hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
          <div className="flex gap-2 flex-wrap">
            <label htmlFor="exportEmployee" className="sr-only">Filter by Employee</label>
            <select
              id="exportEmployee"
              name="export-employee"
              value={exportEmployee}
              onChange={(e) => setExportEmployee(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Personnel</option>
              {uniqueEmployees.map(empName => (
                <option key={empName} value={empName}>{empName}</option>
              ))}
            </select>

            <label htmlFor="exportType" className="sr-only">Select Export Time Range</label>
            <select 
              id="exportType"
              name="export-type"
              value={exportType}
              onChange={(e) => handleQuickSelect(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="custom">Custom Dates</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label htmlFor="exportStartDate" className="sr-only">Export Start Date</label>
            <input 
              type="date" 
              id="exportStartDate"
              name="export-start-date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
            <span className="text-slate-500 text-xs">to</span>
            <label htmlFor="exportEndDate" className="sr-only">Export End Date</label>
            <input 
              type="date" 
              id="exportEndDate"
              name="export-end-date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-3 py-4 font-semibold tracking-wider text-xs whitespace-nowrap">Date</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-xs text-left">Team Member</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center text-[10px] text-slate-400">Shift (Actual)</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center text-xs">Attendance</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right text-xs">Work</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right text-xs">Break</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right text-xs">Idle</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right text-xs text-slate-400">Gap</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center text-xs">Alerts</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-xs text-left text-slate-500 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-xs">
              {attendance
                .filter(record => new Date(record.date) <= new Date())
                .map((record) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  return (
                    <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-3 py-4 font-medium text-slate-200 text-xs whitespace-nowrap">
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-3 py-4">
                        <div>
                          <p className="font-semibold text-slate-200 text-xs truncate max-w-[120px]">{record.user_name}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{record.user_email}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center font-mono leading-tight whitespace-nowrap">
                        <span className="block text-indigo-400 text-[10px] font-bold">
                          {record.first_login ? format(new Date(record.first_login), 'hh:mm a') : '--:--'}
                        </span>
                        <span className="block text-slate-600 text-[9px] my-0.5">to</span>
                        <span className="block text-rose-400 text-[10px] font-bold">
                          {record.last_logout ? format(new Date(record.last_logout), 'hh:mm a') : '--:--'}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${ATTENDANCE_COLORS[record.status] || 'bg-slate-500/10 text-slate-400'}`}>
                          {record.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right text-emerald-400 font-mono text-[10px]">
                        <LiveDuration initialSeconds={record.total_work_seconds} status={record.live_status} type="work" isToday={record.date === todayStr} />
                      </td>
                      <td className="px-3 py-4 text-right text-cyan-400 font-mono text-[10px]">
                        <LiveDuration initialSeconds={record.total_break_seconds} status={record.live_status} type="break" isToday={record.date === todayStr} />
                      </td>
                      <td className="px-3 py-4 text-right text-amber-400 font-mono text-[10px]">
                        <LiveDuration initialSeconds={record.total_idle_seconds} status={record.live_status} type="idle" isToday={record.date === todayStr} />
                      </td>
                      <td className="px-3 py-4 text-right text-orange-400/90 font-mono text-[10px] whitespace-nowrap font-bold">
                        {record.missing_seconds > 0 ? (
                           <span>{Math.floor(record.missing_seconds / 3600).toString().padStart(2, '0')}:{Math.floor((record.missing_seconds % 3600) / 60).toString().padStart(2, '0')}:{(record.missing_seconds % 60).toString().padStart(2, '0')}</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-4 text-center">
                        {record.is_flagged ? <span className="text-rose-400 font-bold text-[9px] bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-tighter shadow-sm shadow-rose-900/20">Alert</span> : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-3 py-4 text-slate-400 text-[10px] italic truncate max-w-[120px]">
                        {record.manager_remark || record.flag_reason || '-'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default TeamAttendance;
