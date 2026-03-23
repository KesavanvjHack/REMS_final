import { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { CalendarIcon, TrashIcon, ArrowDownTrayIcon, UsersIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const HolidayManagement = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', is_optional: false });
  const { policy } = useContext(AuthContext);

  // Today's Leaves State
  const [todaysLeaves, setTodaysLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

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
    fetchHolidays();
    fetchTodaysLeaves();
    fetchUsers();
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/holidays/');
      setHolidays(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodaysLeaves = async () => {
    try {
      const res = await api.get('/attendance/todays_absences/');
      const data = res.data.results || res.data;
      const mapped = data.map(att => ({
        id: att.id,
        employee_name: att.user_name,
        employee_email: att.user_email,
        employee_role: att.user_role,
        leave_type: att.leave_type,
        reason: att.reason,
        status: att.status
      }));
      setTodaysLeaves(mapped);
    } catch (error) {
      toast.error("Failed to load today's absences");
    } finally {
      setLoadingLeaves(false);
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

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.post('/holidays/', newHoliday);
      toast.success('Holiday added successfully');
      setNewHoliday({ name: '', date: '', is_optional: false });
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.date?.[0] || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}/`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (error) {
      toast.error('Failed to delete holiday');
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
        type: 'leave',
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
      link.setAttribute('download', `leave_export_${format(new Date(), 'yyyyMMdd')}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Leaves exported successfully');
    } catch (error) {
      toast.error('Failed to export leave data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-10 page-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <CalendarIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Leave & Holiday Management</h1>
      </div>

      {/* Export Section (MOVED TO TOP) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <ArrowDownTrayIcon className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Export Leave Data</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <select
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
              value={exportCategory}
              onChange={(e) => setExportCategory(e.target.value)}
            >
              <option value="all">All (Everyone)</option>
              <option value="employees">Employees Only</option>
              <option value="managers">Managers Only</option>
              <option value="particular_employee">Particular Employee</option>
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
              {isExporting ? 'Exporting...' : 'Export Leaves'}
            </button>
          </div>
        </div>
      </div>

      {/* Today's Leaves Section (MOVED TO MIDDLE) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Today's Leaves (Employees & Managers)</h2>
          </div>
          <div className="text-sm text-slate-400 font-medium">
            {format(new Date(), 'EEEE, MMMM do, yyyy')}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Leave Type</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loadingLeaves ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="h-16 skeleton-pulse">
                    <td colSpan="5"></td>
                  </tr>
                ))
              ) : todaysLeaves.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No leaves logged for today.</td></tr>
              ) : (
                todaysLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{leave.employee_name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{leave.employee_email || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`capitalize px-2 py-1 rounded text-xs border ${
                        leave.employee_role === 'manager' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}>
                        {leave.employee_role || 'Employee'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{leave.leave_type === '-' ? '-' : (leave.leave_type || 'General')}</td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={leave.reason}>{leave.reason}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const now = new Date();
                        const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                        const istDate = new Date(istString);
                        const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
                        const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
                        const shiftEndMinutes = endHour * 60 + endMin;
                        const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;

                        const isCalculating = isBeforeShiftEnd && 
                                            leave.status === 'absent';
                        
                        const displayStatus = isCalculating ? 'CALCULATING...' : leave.status.toUpperCase();

                        return (
                          <span className={`px-2 py-1 rounded text-xs border ${
                            isCalculating ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            leave.status === 'on_leave' || leave.status === 'approved' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            leave.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            leave.status === 'cancelled' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holiday Management Section (MOVED TO BOTTOM) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-white mb-6">Add New Holiday</h2>
          <form onSubmit={handleAddHoliday} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Holiday Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
              <input
                type="date"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="is_optional"
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500/50 focus:ring-offset-slate-900"
                checked={newHoliday.is_optional}
                onChange={(e) => setNewHoliday({ ...newHoliday, is_optional: e.target.checked })}
              />
              <label htmlFor="is_optional" className="text-sm font-medium text-slate-300">
                Optional / Restricted Holiday
              </label>
            </div>
            <button
              type="submit"
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
            >
              Add Holiday
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Upcoming Holidays</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Holiday Name</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="h-16 skeleton-pulse">
                      <td colSpan="4"></td>
                    </tr>
                  ))
                ) : holidays.length === 0 ? (
                  <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-500">No holidays configured</td></tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-200">{format(new Date(h.date), 'MMM dd, yyyy')}</td>
                      <td className="px-6 py-4">{h.name}</td>
                      <td className="px-6 py-4">
                        {h.is_optional ? (
                          <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">Optional</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Mandatory</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidayManagement;
