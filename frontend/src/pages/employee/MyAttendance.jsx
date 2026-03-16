import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { QueueListIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const MyAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();

    // Very fast polling every 2 seconds for real-time updates
    const intervalId = setInterval(() => {
      fetchAttendance();
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/attendance/');
      setAttendance(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Attendance...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <QueueListIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">My Attendance History</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Total Work</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Total Break</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Total Idle</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Anomalies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {attendance.map((record) => (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {format(new Date(record.date), 'EEEE, MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                      ${record.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        record.status === 'half_day' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        record.status === 'absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}
                    `}>
                      {record.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-emerald-400">{record.work_hours}</td>
                  <td className="px-6 py-4 text-center font-mono text-cyan-400">{(record.total_break_seconds / 3600).toFixed(2)}h</td>
                  <td className="px-6 py-4 text-center font-mono text-amber-400">{(record.total_idle_seconds / 3600).toFixed(2)}h</td>
                  <td className="px-6 py-4 text-center">
                    {record.is_flagged ? (
                      <span className="text-rose-400 text-xs font-semibold px-2 py-1 bg-rose-500/10 rounded border border-rose-500/20" title={record.flag_reason}>
                        Flagged
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">No attendance registered yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyAttendance;
