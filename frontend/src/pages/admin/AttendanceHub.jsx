import { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import ResponsiveTable from '../../components/ResponsiveTable';
import { ChartBarIcon, ClockIcon, BuildingOfficeIcon, UserGroupIcon, ExclamationTriangleIcon, FlagIcon, ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';
import { formatLastLogout, formatDecimalHours } from '../../utils/format';
import LiveDuration from '../../components/LiveDuration';
import { AuthContext } from '../../context/AuthContext';

const AttendanceHub = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { policy, user } = useContext(AuthContext);

  // Filter states
  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState('today');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds for a more 'Live' feel
    const intervalId = setInterval(() => {
      fetchData(true); // silent refresh
    }, 30000);

    return () => clearInterval(intervalId);
  }, [dateFilter, startDate, endDate]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let params = {};
      if (dateFilter === 'today') {
        params.date = today;
      } else if (dateFilter === 'this_week') {
        const now = new Date();
        params.date__gte = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
        params.date__lte = endOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
      } else if (dateFilter === 'this_month') {
        const now = new Date();
        params.date__gte = startOfMonth(now).toISOString().split('T')[0];
        params.date__lte = endOfMonth(now).toISOString().split('T')[0];
      } else if (dateFilter === 'custom' && startDate && endDate) {
        params.date__gte = startDate;
        params.date__lte = endDate;
      }

      const [attRes, sumRes, usersRes] = await Promise.all([
        api.get('/attendance/', { params }),
        api.get('/reports/?type=summary', { params: dateFilter === 'today' ? { from_date: today, to_date: today } : {} }),
        api.get('/users/')
      ]);
      const allAtt = attRes.data.results || attRes.data;
      const allUsers = usersRes.data.results || usersRes.data;
      
      setLastUpdated(new Date());

      const todayStr = new Date().toISOString().split('T')[0];
      const usersWithRecordToday = new Set(allAtt.filter(a => a.date === todayStr).map(a => a.user));
      
      const missingUsers = allUsers.filter(u => 
        u.is_active !== false && !usersWithRecordToday.has(u.id)
      );
      
      const targetSeconds = (policy?.present_hours || 8) * 3600;

      const dummyRecords = missingUsers.map(u => ({
        id: `dummy_${u.id}_${todayStr}`,
        user: u.id,
        user_name: u.full_name || 'N/A',
        user_email: u.email,
        user_role: u.role,
        date: todayStr,
        status: 'Absent',
        live_status: 'Offline',
        first_login: null,
        last_logout: '--:--',
        total_work_seconds: 0,
        total_break_seconds: 0,
        total_idle_seconds: 0,
        missing_seconds: targetSeconds,
        is_flagged: false,
        flag_reason: '',
        manager_remark: 'No record found / Absent'
      }));
      
      setAttendance([...allAtt, ...dummyRecords]);
      setSummary(sumRes.data);
    } catch (error) {
       toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Local calculateDuration removed as we now use shared formatDuration utility

  const getFilteredRecords = () => {
    let records = attendance.filter(record => (record.user_role || 'employee').toLowerCase() !== 'admin');
    
    if (roleFilter !== 'all') {
      records = records.filter(record => (record.user_role || 'employee').toLowerCase() === roleFilter);
    }

    if (employeeFilter !== 'all') {
      records = records.filter(record => record.user_name === employeeFilter);
    }
    
    // Since we now filter on the server, we just need to return the records
    // Note: Missing users are only generated for 'today'
    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleExport = () => {
    const records = getFilteredRecords();
    if (records.length === 0) {
      toast.error('No records found to export');
      return;
    }

    const headers = ['Date', 'Name', 'Role', 'Login Time', 'Last Logout', 'Daily Attendance', 'Work (h)', 'Break (h)', 'Idle (h)', 'Gap (h)', 'Anomalies', 'Remarks / Reason'];
    const csvData = records.map(record => [
      record.date,
      record.user_name,
      record.user_role || 'Employee',
      formatLastLogout(record.first_login),
      formatLastLogout(record.last_logout),
      record.status,
      formatDecimalHours(record.total_work_seconds),
      formatDecimalHours(record.total_break_seconds),
      formatDecimalHours(record.total_idle_seconds),
      formatDecimalHours(record.missing_seconds),
      record.is_flagged ? `Yes - ${record.flag_reason}` : 'No',
      record.manager_remark || record.flag_reason || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(r => {
        const val = r === undefined || r === null ? '' : String(r);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_export_${dateFilter}_${Date.now()}.csv`;
    link.click();
    toast.success('Attendance exported successfully');
  };

  const handleOverride = async (record, status) => {
    try {
      if (!window.confirm(`Are you sure you want to change ${record.user_name}'s status to ${status.toUpperCase()}?`)) return;
      
      await api.post('/attendance/override_status/', {
        user_id: record.user,
        date: record.date,
        status: status,
        remark: 'Overridden by Admin via Hub'
      });
      toast.success('Status updated successfully');
      fetchData(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Attendance Hub...</div>;

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Attendance Hub</h1>
          <button
            onClick={handleExport}
            className="inline-flex lg:hidden items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 gap-2 transition-colors"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full">
          {roleFilter === 'all' && (
            <div className="flex-1 min-w-[150px]">
              <select
                id="employeeFilter"
                name="employee-filter"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
              >
                <option value="all">All Personnel</option>
                {Array.from(new Set(attendance.filter(r => r.user_role !== 'admin').map(r => r.user_name))).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 min-w-[120px]">
            <select
              id="roleFilter"
              name="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
            >
              <option value="all">All Roles</option>
              <option value="manager">Managers</option>
              <option value="employee">Employees</option>
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <select
              id="dateFilter"
              name="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Dates</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="date"
                id="startDate"
                name="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg p-2.5"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                id="endDate"
                name="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg p-2.5"
              />
            </div>
          )}

          <button
            onClick={handleExport}
            className="hidden lg:inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 gap-2 transition-colors ml-auto"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="text-sm sm:font-semibold">Present</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'present').length}</p>
        </div>
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-sky-400 mb-2">
            <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="text-sm sm:font-semibold">Half Day</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'half_day' || r.status?.toLowerCase() === 'half day').length}</p>
        </div>
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-rose-400 mb-2">
            <ExclamationTriangleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="text-sm sm:font-semibold">Absent</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">
            {getFilteredRecords().filter(r => {
              const status = (r.status || '').toLowerCase();
              if (status !== 'absent') return false;
              
              const now = new Date();
              const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
              const istDate = new Date(istString);
              const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
              const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
              const shiftEndMinutes = endHour * 60 + endMin;
              const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;
              
              const isToday = r.date === new Date().toISOString().split('T')[0];
              return !(isToday && isBeforeShiftEnd);
            }).length}
          </p>
        </div>
        <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-fuchsia-400 mb-2">
            <BuildingOfficeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="text-sm sm:font-semibold">On Leave</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'on_leave' || r.status?.toLowerCase() === 'on leave').length}</p>
        </div>
        {dateFilter === 'today' && (
          <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <ClockIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              <h3 className="text-sm sm:font-semibold">Calculating</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {getFilteredRecords().filter(r => {
                const now = new Date();
                const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                const istDate = new Date(istString);
                const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
                const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
                const shiftEndMinutes = endHour * 60 + endMin;
                const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;
                
                const status = (r.status || '').toLowerCase();
                const isToday = r.date === new Date().toISOString().split('T')[0];
                return isToday && isBeforeShiftEnd && status !== 'present' && status !== 'on_leave' && status !== 'holiday' && status !== 'halfday' && status !== 'half_day';
              }).length}
            </p>
          </div>
        )}
      </div>

      <ResponsiveTable title="Live Attendance Log">
        <div className="bg-slate-800/80 p-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-indigo-400" />
              Filtered Records
            </h2>
            {lastUpdated && (
              <span className="text-[10px] text-slate-500 font-mono mt-1 block px-7">
                Last synced: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button 
              onClick={() => fetchData()}
              className="p-2 bg-slate-900/50 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-all flex items-center gap-2"
              title="Manual Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-xs font-medium">Refresh</span>
            </button>
            <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg whitespace-nowrap">
              {dateFilter === 'custom' ? `${startDate} to ${endDate}` : dateFilter.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        </div>

        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs whitespace-nowrap">Date</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Team Member</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-[10px] text-slate-400">Shift</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Status</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Work</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Break</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs text-slate-400">Idle</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Gap</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Alerts</th>
              <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Remarks</th>
              {user?.role === 'admin' && (
                <th className="px-2 py-3 font-semibold tracking-wider text-center text-xs">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(10)].map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 w-full skeleton-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              getFilteredRecords().map((record) => {
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
                const normalizedStatus = record.status?.toLowerCase();
                
                return (
                  <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-2 py-3 font-mono text-slate-400 text-[10px] whitespace-nowrap text-center">
                      {record.date ? format(parseISO(record.date), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <p className="font-semibold text-slate-200 text-xs truncate max-w-[120px]">{record.user_name}</p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{record.user_email}</p>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center font-mono leading-tight whitespace-nowrap">
                      <span className="block text-indigo-400 text-xs font-bold">
                        {record.first_login ? format(parseISO(record.first_login), 'hh:mm a') : '--:--'}
                      </span>
                      <span className="block text-slate-600 text-[10px] my-0.5">to</span>
                      <span className="block text-rose-400 text-xs font-bold">
                        {record.last_logout && record.last_logout !== '--:--' ? format(parseISO(record.last_logout), 'hh:mm a') : '--:--'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 w-max mx-auto
                        ${isCalculating ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          normalizedStatus === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          normalizedStatus === 'absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          normalizedStatus === 'half_day' || normalizedStatus === 'half day' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                          normalizedStatus === 'on_leave' || normalizedStatus === 'on leave' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' :
                          'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
                      `}>
                        {displayStatus === 'on_leave' ? 'On Leave' : displayStatus === 'half_day' ? 'Half Day' : displayStatus}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-emerald-400 font-mono text-xs text-center">
                       <LiveDuration initialSeconds={record.total_work_seconds} status={record.live_status} type="work" isToday={record.date === todayStr} />
                    </td>
                    <td className="px-2 py-3 text-cyan-400 font-mono text-xs text-center">
                      <LiveDuration initialSeconds={record.total_break_seconds} status={record.live_status} type="break" isToday={record.date === todayStr} />
                    </td>
                    <td className="px-2 py-3 text-amber-400 font-mono text-xs text-center">
                      <LiveDuration initialSeconds={record.total_idle_seconds} status={record.live_status} type="idle" isToday={record.date === todayStr} />
                    </td>
                    <td className="px-2 py-3 text-orange-400/90 font-mono text-xs text-center font-bold whitespace-nowrap">
                       {record.missing_seconds > 0 ? (
                          <span>{Math.floor(record.missing_seconds / 3600).toString().padStart(2, '0')}:{Math.floor((record.missing_seconds % 3600) / 60).toString().padStart(2, '0')}:{(record.missing_seconds % 60).toString().padStart(2, '0')}</span>
                       ) : '—'}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {record.is_flagged ? (
                        <span className="text-rose-400 font-bold text-[10px] flex items-center justify-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-tighter" title={record.flag_reason}>
                          <FlagIcon className="h-3 w-3" /> Alert
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-sm text-center">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-400 text-[10px] italic truncate max-w-[150px] text-center">
                      {record.manager_remark || record.flag_reason || '—'}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-2 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleOverride(record, 'present')} className="w-6 h-6 flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded hover:bg-emerald-500/20" title="Mark Present">P</button>
                          <button onClick={() => handleOverride(record, 'half_day')} className="w-6 h-6 flex items-center justify-center bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold rounded hover:bg-sky-500/20" title="Mark Half Day">H</button>
                          <button onClick={() => handleOverride(record, 'absent')} className="w-6 h-6 flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded hover:bg-rose-500/20" title="Mark Absent">A</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
            {!loading && attendance.length === 0 && (
              <tr>
                <td colSpan="11" className="px-6 py-8 text-center text-slate-500">No records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </ResponsiveTable>
    </div>
  );
};

export default AttendanceHub;
