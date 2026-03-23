import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { UserGroupIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { formatDuration, formatLastLogout, formatDecimalHours } from '../../utils/format';
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

/**
 * TeamAttendance (Manager Dashboard component)
 *
 * API call: GET /api/sessions/team-timesheet/
 *
 * The backend (TeamTimesheetView) filters Attendance records by
 *   user__manager = request.user
 * so managers only ever see their own direct reports.
 * Each record is enriched with `live_status` from StatusService.get_user_status().
 *
 * Real-time feel: the component polls every 30 seconds with setInterval
 * so managers see status changes without a page refresh.
 */
const TeamAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { policy } = useContext(AuthContext);

  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');
  const [exportEmployee, setExportEmployee] = useState('all');

  const fetchTeamAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ← This is the key call: uses employee__manager = request.user filter
      const res = await api.get('/sessions/team-timesheet/');
      setAttendance(res.data.results || res.data);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error('Failed to load team timesheet');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamAttendance();

    // Poll every 30 seconds for real-time feel
    const interval = setInterval(() => fetchTeamAttendance(true), 30000);
    return () => clearInterval(interval);
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
    
    // If the user picked dates, filter the exported data
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

    const headers = ['Date', 'Employee Name', 'Email', 'Login Time', 'Last Logout', 'Attendance Status', 'Work Hours', 'Break (Hours)', 'Idle (Hours)', 'Anomalies', 'Remarks / Reason'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(rec => [
         format(new Date(rec.date), 'yyyy-MM-dd'),
         rec.user_name,
         rec.user_email,
         formatLastLogout(rec.first_login),
         formatLastLogout(rec.last_logout),
         rec.status,
         formatDecimalHours(rec.effective_work_seconds),
         formatDecimalHours(rec.total_break_seconds),
         formatDecimalHours(rec.total_idle_seconds),
         rec.is_flagged ? `Yes - ${rec.flag_reason}` : 'No',
         rec.manager_remark || rec.flag_reason || '-'
      ].map(v => `"${v}"`).join(','))
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

  // Extract unique employees from attendance data
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
            <p className="text-xs text-slate-500 mt-0.5">
              Showing your direct reports • Live status • Refreshes every 30s
            </p>
          </div>
        </div>
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4">
          {/* Export Controls */}
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
            <div className="flex gap-2 flex-wrap">
              <select
                value={exportEmployee}
                onChange={(e) => setExportEmployee(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Employees</option>
                {uniqueEmployees.map(empName => (
                  <option key={empName} value={empName}>{empName}</option>
                ))}
              </select>

              <select 
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
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setExportType('custom'); }}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
              />
              <span className="text-slate-500">to</span>
              <input 
                type="date" 
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

          <div className="flex items-center gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 self-end xl:self-auto">
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Updated {format(lastUpdated, 'hh:mm:ss a')}
              </span>
            )}
            <button
              onClick={() => fetchTeamAttendance()}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-3 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-3 py-4 font-semibold tracking-wider">Employee</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center">Login Time</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center hidden lg:table-cell">Last Logout</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center">Attendance</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right">Work (h)</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right">Break (h)</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-right">Idle (h)</th>
                <th className="px-3 py-4 font-semibold tracking-wider text-center">Anomalies</th>
                <th className="px-3 py-4 font-semibold tracking-wider">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((_, j) => (
                      <td key={j} className="px-3 py-4">
                        <div className="h-4 w-full skeleton-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                attendance
                  .filter(record => new Date(record.date) <= new Date())
                  .map((record) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const now = new Date();
                  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                  const istDate = new Date(istString);
                  const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
                  const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
                  const shiftEndMinutes = endHour * 60 + endMin;
                  const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;

                  const isCalculating = record.date === todayStr && 
                                      isBeforeShiftEnd &&
                                      record.status !== 'present' && 
                                      record.status !== 'on_leave' && 
                                      record.status !== 'holiday';
                  const displayStatus = isCalculating ? 'calculating...' : record.status;
                  
                  return (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-4 font-medium text-slate-200 text-xs">
                    {format(new Date(record.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-3 py-4">
                    <div>
                      <p className="font-semibold text-slate-200 text-xs">{record.user_name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{record.user_email}</p>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className="text-slate-300 font-mono text-[10px] whitespace-nowrap">
                      {formatLastLogout(record.first_login)}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center hidden lg:table-cell">
                    <span className="text-slate-300 font-mono text-[10px] whitespace-nowrap">
                      {formatLastLogout(record.last_logout)}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${isCalculating ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : (ATTENDANCE_COLORS[record.status] || 'bg-slate-500/10 text-slate-400')}`}>
                      {displayStatus?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-right text-emerald-400 font-mono text-[11px] whitespace-nowrap">{formatDuration(record.effective_work_seconds)}</td>
                  <td className="px-3 py-4 text-right text-cyan-400 font-mono text-[11px] whitespace-nowrap">{formatDuration(record.total_break_seconds)}</td>
                  <td className="px-3 py-4 text-right text-amber-400 font-mono text-[11px] whitespace-nowrap">{formatDuration(record.total_idle_seconds)}</td>
                  <td className="px-3 py-4 text-center">
                    {record.is_flagged ? (
                      <span className="text-rose-400 font-bold text-[10px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-tighter" title={record.flag_reason}>
                        Flagged
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {record.manager_remark ? (
                      <div className="flex flex-col">
                        <span className="text-indigo-400 text-[10px] font-medium italic underline underline-offset-4 decoration-indigo-500/30 uppercase tracking-wider">Note:</span>
                        <p className="text-slate-300 text-[10px] mt-1 leading-relaxed truncate max-w-[150px]" title={record.manager_remark}>{record.manager_remark}</p>
                      </div>
                    ) : record.flag_reason ? (
                      <p className="text-slate-400 text-[10px] italic leading-relaxed truncate max-w-[150px]" title={record.flag_reason}>{record.flag_reason}</p>
                    ) : (
                      <span className="text-slate-600 font-mono text-[10px]">-</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
          {!loading && attendance.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-slate-500 italic">
                    No timesheet records found for your team.
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

export default TeamAttendance;
