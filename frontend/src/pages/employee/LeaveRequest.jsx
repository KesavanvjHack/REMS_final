import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { CalendarIcon, PaperAirplaneIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const LeaveRequest = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    leave_type: 'sick',
    from_date: '',
    to_date: '',
    reason: ''
  });

  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const fetchMyLeaves = async () => {
    try {
      // Employees only see their own requests by default in the API
      const res = await api.get('/leave/');
      setLeaves(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

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
    let rawData = leaves;
    
    // If the user picked dates, filter the exported data
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      rawData = leaves.filter(rec => {
        // A leave might cross dates; usually we check if from_date or to_date overlaps
        // But for simplicity, we check if the start date of the leave falls in the range
        const d = new Date(rec.from_date);
        return d >= start && d <= end;
      });
    }

    if (rawData.length === 0) {
      toast.error('No leave records found for the selected dates');
      return;
    }

    const headers = ['Type', 'From Date', 'To Date', 'Duration (Days)', 'Reason', 'Status', 'Reviewed By'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(rec => [
         rec.leave_type,
         format(new Date(rec.from_date), 'yyyy-MM-dd'),
         format(new Date(rec.to_date), 'yyyy-MM-dd'),
         rec.duration_days,
         rec.reason.replace(/,/g, ' '), // sanitize commas
         rec.status,
         rec.reviewed_by_name || 'N/A'
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Leave_History_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/leave/', formData);
      toast.success('Leave request submitted successfully');
      setFormData({ leave_type: 'sick', from_date: '', to_date: '', reason: '' });
      
      // Instantly inject the new record at the top of the history table!
      if (res.data) {
        setLeaves(prev => [res.data, ...prev]);
      }
      
      // Still run sync in background just in case
      fetchMyLeaves();
    } catch (error) {
      const errs = error.response?.data;
      if (errs && typeof errs === 'object') {
        const firstError = Object.values(errs)[0];
        toast.error(Array.isArray(firstError) ? firstError[0] : 'Failed to submit request');
      } else {
        toast.error('Failed to submit request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      const res = await api.post(`/leave/${id}/cancel/`);
      toast.success('Leave cancelled successfully');
      // Update the local state to show 'cancelled' instead of completely removing it
      setLeaves(leaves.map(l => l.id === id ? res.data : l));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel leave request');
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-96 skeleton-pulse"></div>
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl h-96 skeleton-pulse"></div>
        </div>
      </div>
    );
  }

  // Filter leaves for display: Only show CURRENT WEEK records
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  const weeklyLeaves = leaves.filter((leave) => {
    const leaveStart = new Date(leave.from_date);
    return isWithinInterval(leaveStart, { start: weekStart, end: weekEnd });
  });

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Leave Management</h1>
        </div>

        {/* Export Controls for Leaves */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
          <div className="flex gap-2">
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
            <input 
              type="date" 
              id="exportStartDate"
              name="export-start-date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
            <span className="text-slate-500">to</span>
            <input 
              type="date" 
              id="exportEndDate"
              name="export-end-date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium whitespace-nowrap w-full sm:w-auto"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span className="text-xs">{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leave application form */}
        <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-white mb-6">Apply for Leave</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="leaveType" className="block text-sm font-medium text-slate-300 mb-2">Leave Type</label>
              <select
                required
                id="leaveType"
                name="leave_type"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 appearance-none"
                value={formData.leave_type}
                onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
              >
                <option value="sick">Sick Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="annual">Annual Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="fromDate" className="block text-sm font-medium text-slate-300 mb-2">From Date</label>
                <input
                   type="date"
                   required
                   id="fromDate"
                   name="from_date"
                   className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={formData.from_date}
                  onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="toDate" className="block text-sm font-medium text-slate-300 mb-2">To Date</label>
                <input
                  type="date"
                  required
                  id="toDate"
                  name="to_date"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={formData.to_date}
                  onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
              <textarea
                required
                id="reason"
                name="reason"
                rows="3"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Briefly describe the reason for leave..."
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Leave history table */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">This Week's Leave History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Type</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Duration</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Reason</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-semibold tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {weeklyLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200 capitalize tracking-wide">{leave.leave_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                      {format(new Date(leave.from_date), 'MMM dd')} - {format(new Date(leave.to_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 truncate max-w-[200px]" title={leave.reason}>{leave.reason}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${leave.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                          leave.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          leave.status === 'cancelled' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'}
                      `}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {leave.status === 'pending' ? (
                        <button
                          onClick={() => handleDelete(leave.id)}
                          className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Cancel Request"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {weeklyLeaves.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No leave requests this week</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequest;
