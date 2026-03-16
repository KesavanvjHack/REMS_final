import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { CalendarDaysIcon, CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const LeaveApproval = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

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

  if (loading) return <div className="text-indigo-400">Loading Requests...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <CalendarDaysIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Leave Approvals</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
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
              {leaves.map((leave) => (
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
              {leaves.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No leave requests found</td>
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
