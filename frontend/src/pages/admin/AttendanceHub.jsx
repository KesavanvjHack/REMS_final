import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { ChartBarIcon, ClockIcon, BuildingOfficeIcon, UserGroupIcon, ExclamationTriangleIcon, FlagIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const AttendanceHub = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  // Filter states
  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState('today');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, sumRes, usersRes] = await Promise.all([
        api.get('/attendance/'),
        api.get('/reports/?type=summary'),
        api.get('/users/')
      ]);
      const allAtt = attRes.data.results || attRes.data;
      const allUsers = usersRes.data.results || usersRes.data;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const usersWithRecordToday = new Set(allAtt.filter(a => a.date === todayStr).map(a => a.user));
      
      const missingUsers = allUsers.filter(u => 
        u.is_active !== false && u.role !== 'admin' && !usersWithRecordToday.has(u.id)
      );
      
      const dummyRecords = missingUsers.map(u => ({
        id: `dummy_${u.id}_${todayStr}`,
        user: u.id,
        user_name: u.full_name || 'N/A',
        user_email: u.email,
        user_role: u.role,
        date: todayStr,
        status: 'Absent',
        live_status: 'Offline',
        last_logout: '--:--',
        effective_work_seconds: 0,
        total_break_seconds: 0,
        total_idle_seconds: 0
      }));
      
      setAttendance([...allAtt, ...dummyRecords]);
      setSummary(sumRes.data);
    } catch (error) {
       toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (seconds) => {
    if (!seconds) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const getFilteredRecords = () => {
    let records = attendance.filter(record => record.user_role !== 'admin');
    
    if (roleFilter !== 'all') {
      records = records.filter(record => (record.user_role || 'employee').toLowerCase() === roleFilter);
    }

    if (employeeFilter !== 'all') {
      records = records.filter(record => record.user_name === employeeFilter);
    }
    
    if (dateFilter === 'today') {
      records = records.filter(record => record.date === today);
    } else if (dateFilter === 'this_week') {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      records = records.filter(record => {
        if (!record.date) return false;
        const d = parseISO(record.date);
        return d >= weekStart && d <= weekEnd;
      });
    } else if (dateFilter === 'this_month') {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      records = records.filter(record => {
        if (!record.date) return false;
        const d = parseISO(record.date);
        return d >= monthStart && d <= monthEnd;
      });
    } else if (dateFilter === 'custom' && startDate && endDate) {
      records = records.filter(record => {
         if (!record.date) return false;
         return record.date >= startDate && record.date <= endDate;
      });
    }
    
    // Sort descending by date (newest first)
    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleExport = () => {
    const records = getFilteredRecords();
    if (records.length === 0) {
      toast.error('No records found to export');
      return;
    }

    const headers = ['Date', 'Name', 'Role', 'Live Status', 'Last Logout', 'Daily Attendance', 'Work (h)', 'Break (h)', 'Idle (h)'];
    const csvData = records.map(record => [
      record.date,
      record.user_name,
      record.user_role || 'Employee',
      record.live_status || 'Offline',
      record.last_logout || '--:--',
      record.status,
      calculateDuration(record.effective_work_seconds),
      calculateDuration(record.total_break_seconds),
      calculateDuration(record.total_idle_seconds)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(r => `"${r}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_export_${dateFilter}_${Date.now()}.csv`;
    link.click();
    toast.success('Attendance exported successfully');
  };

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Attendance Hub...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Company Attendance Hub</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          {roleFilter === 'all' && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
            >
              <option value="all">All Personnel</option>
              {Array.from(new Set(attendance.filter(r => r.user_role !== 'admin').map(r => r.user_name))).sort().map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
          >
            <option value="all">All Roles</option>
            <option value="employee">Employees</option>
            <option value="manager">Managers</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-2.5"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Dates</option>
          </select>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg p-2.5"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg p-2.5"
              />
            </div>
          )}

          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 gap-2 transition-colors"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <UserGroupIcon className="h-6 w-6" />
            <h3 className="font-semibold">Present {dateFilter === 'today' ? 'Today' : ''}</h3>
          </div>
          <p className="text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'present').length}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-sky-400 mb-2">
            <ClockIcon className="h-6 w-6" />
            <h3 className="font-semibold">Half Day</h3>
          </div>
          <p className="text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'half_day' || r.status?.toLowerCase() === 'half day').length}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-rose-400 mb-2">
            <ExclamationTriangleIcon className="h-6 w-6" />
            <h3 className="font-semibold">Absent</h3>
          </div>
          <p className="text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'absent').length}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <div className="flex items-center gap-3 text-fuchsia-400 mb-2">
            <BuildingOfficeIcon className="h-6 w-6" />
            <h3 className="font-semibold">On Leave</h3>
          </div>
          <p className="text-3xl font-bold text-white">{getFilteredRecords().filter(r => r.status?.toLowerCase() === 'on_leave' || r.status?.toLowerCase() === 'on leave').length}</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/80">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-indigo-400" />
            Filtered Attendance
          </h2>
          <div className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg">
            {dateFilter === 'custom' ? `${startDate} to ${endDate}` : dateFilter.replace('_', ' ').toUpperCase()}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Name</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Role</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Live Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Last Logout</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Attendance</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Work (h)</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Break (h)</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Idle (h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {getFilteredRecords().map((record) => (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400 text-xs">{record.date}</td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                           {record.user_name?.charAt(0) || '?'}
                        </div>
                        <p className="font-medium text-slate-200">{record.user_name}</p>
                     </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-400 uppercase tracking-wider text-xs">
                     {record.user_role || 'Employee'}
                  </td>
                  <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 w-max
                        ${record.live_status === 'Working' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          record.live_status === 'On Break' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          record.live_status === 'Idle' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
                      `}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          record.live_status === 'Working' ? 'bg-emerald-400' :
                          record.live_status === 'On Break' ? 'bg-blue-400' :
                          record.live_status === 'Idle' ? 'bg-rose-400' : 'bg-slate-500'
                        }`}></div>
                        {record.live_status || 'Offline'}
                      </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{record.last_logout || '--:--'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 w-max
                      ${record.status === 'present' || record.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        record.status === 'absent' || record.status === 'Absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        record.status === 'half_day' || record.status === 'Half Day' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                        record.status === 'on_leave' || record.status === 'On Leave' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
                    `}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        record.status === 'present' || record.status === 'Present' ? 'bg-emerald-400' :
                        record.status === 'absent' || record.status === 'Absent' ? 'bg-rose-400' :
                        record.status === 'half_day' || record.status === 'Half Day' ? 'bg-sky-400' :
                        record.status === 'on_leave' || record.status === 'On Leave' ? 'bg-fuchsia-400' : 'bg-slate-400'
                      }`}></div>
                      {record.status === 'on_leave' ? 'On Leave' : record.status === 'half_day' ? 'Half Day' : record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-emerald-400 font-mono text-sm">{calculateDuration(record.effective_work_seconds)}</td>
                  <td className="px-6 py-4 text-amber-400 font-mono text-sm">{calculateDuration(record.total_break_seconds)}</td>
                  <td className="px-6 py-4 text-rose-400 font-mono text-sm">{calculateDuration(record.total_idle_seconds)}</td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No attendance records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHub;
