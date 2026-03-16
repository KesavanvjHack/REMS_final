import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { CalendarIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';
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
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await api.delete(`/leave/${id}/`);
      toast.success('Leave deleted successfully');
      setLeaves(leaves.filter(l => l.id !== id));
    } catch (error) {
      toast.error('Failed to delete leave request');
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Leaves...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <CalendarIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Leave Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-white mb-6">Apply for Leave</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Leave Type</label>
              <select
                required
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
                <label className="block text-sm font-medium text-slate-300 mb-2">From Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={formData.from_date}
                  onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">To Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  value={formData.to_date}
                  onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
              <textarea
                required
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

        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">My Leave History</h2>
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
                {leaves.map((leave) => (
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
                      <button
                        onClick={() => handleDelete(leave.id)}
                        className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                        title="Delete Request"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No past leave requests</td>
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
