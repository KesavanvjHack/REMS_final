import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { ExclamationTriangleIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ManagerReview = () => {
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchFlagged();
  }, []);

  const fetchFlagged = async () => {
    try {
      const res = await api.get('/attendance/flagged/');
      setFlagged(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load flagged attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, action) => {
    setProcessingId(id);
    try {
      await api.post(`/attendance/${id}/review/`, { action });
      toast.success(`Anomaly ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchFlagged();
    } catch (error) {
      toast.error(`Failed to ${action} anomaly`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Reviews...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-rose-500/20 rounded-lg">
          <ExclamationTriangleIcon className="h-6 w-6 text-rose-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Pending Anomalies</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {flagged.map((record) => (
          <div key={record.id} className="bg-slate-800/50 border border-slate-700 p-6 rounded-2xl flex flex-col hover:border-slate-600 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{record.user_name}</h3>
                <p className="text-sm font-medium text-slate-400">
                  {format(new Date(record.date), 'EEEE, MMM dd, yyyy')}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Flagged
              </span>
            </div>
            
            <div className="bg-slate-900/50 rounded-lg p-4 mb-6 flex-1">
              <p className="text-sm text-slate-300 mb-3"><span className="text-slate-500 font-medium">Reason:</span> {record.flag_reason}</p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">Total Work</span>
                  <span className="font-medium text-emerald-400">{record.work_hours}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Total Idle</span>
                  <span className="font-medium text-amber-400">{(record.total_idle_seconds / 3600).toFixed(2)}h</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={processingId === record.id}
                onClick={() => handleReview(record.id, 'approve')}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-lg font-medium border border-emerald-500/20 transition-all disabled:opacity-50"
              >
                <CheckCircleIcon className="h-5 w-5" />
                Approve as Half-Day
              </button>
              <button
                disabled={processingId === record.id}
                onClick={() => handleReview(record.id, 'reject')}
                className="flex-[0.5] flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2.5 rounded-lg border border-rose-500/20 transition-all disabled:opacity-50"
                title="Mark as Absent"
              >
                <XMarkIcon className="h-5 w-5" />
                Reject
              </button>
            </div>
          </div>
        ))}
        {flagged.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-slate-700 rounded-2xl">
            <div className="inline-block p-4 bg-emerald-500/10 rounded-full mb-4">
              <CheckCircleIcon className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-1">All clear!</h3>
            <p className="text-slate-500">No anomalies require your review at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerReview;
