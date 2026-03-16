import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  working:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  on_break: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  idle:     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  offline:  'bg-slate-500/10 text-slate-400 border border-slate-500/20',
};

const ATTENDANCE_COLORS = {
  present:  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  half_day: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  absent:   'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  on_leave: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
};

/**
 * TeamAttendance (Manager Dashboard component)
 *
 * API call: GET /api/sessions/team-timesheet/
 *
 * The backend (TeamTimesheetView) filters Attendance records by
 *   user__manager = request.user
 * so managers only ever see their own direct reports.
 * Each record is enriched with `live_status` from StatusService.get_user_status().
 *
 * Real-time feel: the component polls every 30 seconds with setInterval
 * so managers see status changes without a page refresh.
 */
const TeamAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchTeamAttendance = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // ← This is the key call: uses employee__manager = request.user filter
      const res = await api.get('/sessions/team-timesheet/');
      setAttendance(res.data.results || res.data);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error('Failed to load team timesheet');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamAttendance();

    // Poll every 30 seconds for real-time feel
    const interval = setInterval(() => fetchTeamAttendance(true), 30000);
    return () => clearInterval(interval);
  }, [fetchTeamAttendance]);

  if (loading) return (
    <div className="flex items-center gap-3 text-indigo-400 mt-10">
      <ArrowPathIcon className="h-5 w-5 animate-spin" />
      Loading Team Timesheet...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <UserGroupIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Team Timesheet</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing your direct reports • Live status • Refreshes every 30s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated {format(lastUpdated, 'hh:mm:ss a')}
            </span>
          )}
          <button
            onClick={() => fetchTeamAttendance()}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Employee</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Live Status</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Attendance</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Work (h)</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Break (h)</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Idle (h)</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Flagged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {attendance.map((record) => (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {format(new Date(record.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-200">{record.user_name}</p>
                      <p className="text-xs text-slate-500">{record.user_email}</p>
                    </div>
                  </td>
                  {/* Live status — annotated by backend from StatusService */}
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[record.live_status] || STATUS_COLORS.offline}`}>
                      {(record.live_status || 'offline').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${ATTENDANCE_COLORS[record.status] || 'bg-slate-500/10 text-slate-400'}`}>
                      {record.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-emerald-400 font-mono">{record.work_hours}</td>
                  <td className="px-6 py-4 text-center text-cyan-400 font-mono">{(record.total_break_seconds / 3600).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-amber-400 font-mono">{(record.total_idle_seconds / 3600).toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    {record.is_flagged ? (
                      <span className="text-rose-400 font-bold" title={record.flag_reason}>⚑ Yes</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-slate-500 italic">
                    No timesheet records found for your team.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeamAttendance;
