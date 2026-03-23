import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { CalendarDaysIcon, CheckIcon, XMarkIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const LeaveApproval = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');
  const [exportEmployee, setExportEmployee] = useState('all');

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leave/');
      setLeaves(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    setProcessingId(id);
    try {
      await api.post(`/leave/${id}/review/`, { action });
      toast.success(`Leave request ${action}d`);
      fetchLeaves();
    } catch (error) {
      toast.error(`Failed to ${action} request`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this leave request?")) {
      setProcessingId(id);
      try {
        await api.delete(`/leave/${id}/`);
        toast.success('Leave request deleted');
        fetchLeaves();
      } catch (error) {
        toast.error('Failed to delete request');
        setProcessingId(null);
      }
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
      
      rawData = rawData.filter(rec => {
        const d = new Date(rec.from_date);
        return d >= start && d <= end;
      });
    }

    if (exportEmployee !== 'all') {
      rawData = rawData.filter(rec => rec.employee_name === exportEmployee);
    }

    if (rawData.length === 0) {
      toast.error('No leave records found for the selected dates and employee');
      return;
    }

    const headers = ['Employee', 'Leave Type', 'From Date', 'To Date', 'Duration (Days)', 'Reason', 'Status'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(rec => [
         rec.employee_name,
         rec.leave_type,
         format(new Date(rec.from_date), 'yyyy-MM-dd'),
         format(new Date(rec.to_date), 'yyyy-MM-dd'),
         rec.duration_days,
         rec.reason.replace(/,/g, ' '), // sanitize commas
         rec.status
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Team_Leaves_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Leaves exported successfully!');
  };

  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="space-y-6 page-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-64 bg-slate-700 rounded skeleton-pulse"></div>
          <div className="h-10 w-48 bg-slate-700 rounded skeleton-pulse"></div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-96 skeleton-pulse mt-6"></div>
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

  // Extract unique employees from leaves data
  const uniqueEmployees = Array.from(new Set(leaves.map(l => l.employee_name))).filter(Boolean).sort();

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <CalendarDaysIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Leave Approvals</h1>
        </div>

        {/* Export Controls */}
        <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
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
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
            <span className="text-slate-500">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">This Week's Leave Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Employee</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Type</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Duration</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Reason</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-right font-semibold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {weeklyLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{leave.employee_name}</td>
                  <td className="px-6 py-4 text-xs font-medium uppercase tracking-widest text-indigo-300">{leave.leave_type}</td>
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {format(new Date(leave.from_date), 'MMM dd')} - {format(new Date(leave.to_date), 'MMM dd, yy')}
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
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {leave.status === 'pending' && (
                      <>
                        <button
                          disabled={processingId === leave.id}
                          onClick={() => handleAction(leave.id, 'approve')}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/20 transition-all disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          disabled={processingId === leave.id}
                          onClick={() => handleAction(leave.id, 'reject')}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/20 transition-all disabled:opacity-50"
                          title="Reject"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <button
                      disabled={processingId === leave.id}
                      onClick={() => handleDelete(leave.id)}
                      className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 border border-slate-500/20 transition-all disabled:opacity-50 ml-2"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {weeklyLeaves.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No leave requests found for this week</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveApproval;
