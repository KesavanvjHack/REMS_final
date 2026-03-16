import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { ChartBarIcon, ClockIcon, BuildingOfficeIcon, UserGroupIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AttendanceHub = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, sumRes] = await Promise.all([
        api.get('/attendance/'),
        api.get('/reports/?type=summary')
      ]);
      setAttendance(attRes.data.results || attRes.data);
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

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Attendance Hub...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Company Attendance Hub</h1>
      </div>

       {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <UserGroupIcon className="h-6 w-6" />
              <h3 className="font-semibold">Present Today</h3>
            </div>
            <p className="text-3xl font-bold text-white">{summary.present}</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 text-sky-400 mb-2">
              <ClockIcon className="h-6 w-6" />
              <h3 className="font-semibold">Half Day</h3>
            </div>
            <p className="text-3xl font-bold text-white">{summary.half_day}</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <ExclamationTriangleIcon className="h-6 w-6" />
              <h3 className="font-semibold">Absent</h3>
            </div>
            <p className="text-3xl font-bold text-white">{summary.absent}</p>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3 text-fuchsia-400 mb-2">
              <BuildingOfficeIcon className="h-6 w-6" />
              <h3 className="font-semibold">On Leave</h3>
            </div>
            <p className="text-3xl font-bold text-white">{summary.on_leave}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Employee</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Work Hours</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Break Hours</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Idle Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {attendance.map((record) => (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                           {record.user_name?.charAt(0) || '?'}
                        </div>
                        {record.user_name}
                     </div>
                  </td>
                  <td className="px-6 py-4">{record.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider
                      ${record.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        record.status === 'Absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        record.status === 'Half Day' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
                    `}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-emerald-400">{calculateDuration(record.total_work_seconds)}</td>
                  <td className="px-6 py-4 text-amber-400">{calculateDuration(record.total_break_seconds)}</td>
                  <td className="px-6 py-4 text-rose-400">{calculateDuration(record.total_idle_seconds)}</td>
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
