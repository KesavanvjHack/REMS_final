import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { AdjustmentsHorizontalIcon, CheckIcon } from '@heroicons/react/24/outline';
const CustomTimePicker = ({ value, onChange }) => {
  const [hourStr, minStr] = (value || '09:00').split(':');
  const h24 = parseInt(hourStr, 10) || 0;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;

  const handleHour = (e) => {
    let newH = parseInt(e.target.value, 10);
    if (ampm === 'PM' && newH < 12) newH += 12;
    if (ampm === 'AM' && newH === 12) newH = 0;
    onChange(`${newH.toString().padStart(2, '0')}:${minStr}`);
  };

  const handleMin = (e) => {
    onChange(`${hourStr.padStart(2, '0')}:${e.target.value.padStart(2, '0')}`);
  };

  const handleAmPm = (e) => {
    const newAmPm = e.target.value;
    if (newAmPm === ampm) return;
    let newH = h24;
    if (newAmPm === 'PM') newH += 12;
    if (newAmPm === 'AM') newH -= 12;
    onChange(`${newH.toString().padStart(2, '0')}:${minStr}`);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins = ['00', '15', '30', '45'];

  return (
    <div className="flex items-center gap-2">
      <select 
        value={h12} 
        onChange={handleHour} 
        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
      >
        {hours.map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>)}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select 
        value={minStr} 
        onChange={handleMin} 
        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
      >
        {mins.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select 
        value={ampm} 
        onChange={handleAmPm} 
        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 font-bold"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

const PolicyConfig = () => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetDate, setResetDate] = useState(new Date().toISOString().split('T')[0]);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchPolicy();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/policy/');
      const policyData = res.data.results ? res.data.results : res.data;
      if (policyData.length > 0) {
        setPolicy(policyData[0]);
      } else {
        toast.error('No active policy found');
      }
    } catch (error) {
      toast.error('Failed to load policy configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/policy/${policy.id}/`, policy);
      toast.success('Attendance Policy updated successfully');
    } catch (error) {
      toast.error('Failed to update policy');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Are you sure you want to RESET all attendance sessions for ${resetDate}? This action cannot be undone.`)) {
      return;
    }
    
    setResetting(true);
    try {
      const res = await api.post('/policy/reset_day_sessions/', { date: resetDate });
      toast.success(res.data.message || 'Attendance sessions reset successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset sessions');
    } finally {
      setResetting(false);
    }
  };

  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="max-w-3xl space-y-6 page-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-slate-700 rounded-lg w-10 h-10 skeleton-pulse"></div>
          <div className="h-8 w-64 bg-slate-700 rounded skeleton-pulse"></div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 h-96 skeleton-pulse"></div>
      </div>
    );
  }
  if (!policy) return <div className="text-rose-400 page-fade-in">No Policy Available</div>;

  return (
    <div className="max-w-3xl space-y-6 page-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <AdjustmentsHorizontalIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Global Attendance Policy</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Policy Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.name}
                onChange={(e) => setPolicy({ ...policy, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Idle Threshold (Minutes)</label>
              <input
                type="number"
                required
                min="1"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.idle_threshold_minutes}
                onChange={(e) => setPolicy({ ...policy, idle_threshold_minutes: parseInt(e.target.value) })}
                title="Minutes of mouse/keyboard inactivity before state switches to Idle"
              />
              <p className="mt-2 text-xs text-slate-500">Auto-triggers Idle state after {policy.idle_threshold_minutes} min of inactivity.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Full-Day Hours</label>
              <input
                type="number"
                required
                step="0.5"
                min="0"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.min_working_hours}
                onChange={(e) => setPolicy({ ...policy, min_working_hours: parseFloat(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Present Hours</label>
              <input
                type="number"
                required
                step="0.5"
                min="0"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.present_hours}
                onChange={(e) => setPolicy({ ...policy, present_hours: parseFloat(e.target.value) })}
                title="Minimum hours to mark attendance as Present"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Half-Day Hours</label>
              <input
                type="number"
                required
                step="0.5"
                min="0"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.half_day_hours}
                onChange={(e) => setPolicy({ ...policy, half_day_hours: parseFloat(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Attendance Starting Time</label>
              <CustomTimePicker 
                value={policy.shift_start_time || '09:30'} 
                onChange={(val) => setPolicy({...policy, shift_start_time: val})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Auto-Calculating Last Time</label>
              <CustomTimePicker 
                value={policy.shift_end_time || '17:30'} 
                onChange={(val) => setPolicy({...policy, shift_end_time: val})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Session Timeout (Hours)</label>
              <input
                type="number"
                required
                step="0.5"
                min="0.5"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                value={policy.session_timeout_hours || 24}
                onChange={(e) => setPolicy({ ...policy, session_timeout_hours: parseFloat(e.target.value) })}
                title="Absolute maximum hours a login session can last before auto-logout"
              />
              <p className="mt-2 text-xs text-slate-500">Users will be automatically logged out after {policy.session_timeout_hours || 24} hours of continuous session.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700/50 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all disabled:opacity-50"
            >
              <CheckIcon className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Administrative Controls */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 border-t-4 border-t-rose-500/50 shadow-xl mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-rose-500/20 rounded-lg">
            <svg className="h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Administrative Tools</h2>
        </div>
        
        <p className="text-slate-400 text-sm mb-6 max-w-xl leading-relaxed">
          <span className="text-rose-400 font-bold uppercase text-[10px] tracking-widest block mb-1">Danger Zone</span>
          Resetting attendance will permanently delete all work sessions, breaks, and idle logs for all users on the selected date. This action is irreversible and should only be used for data correction.
        </p>

        <div className="flex flex-col sm:flex-row items-end gap-6">
          <div className="flex-1 w-full max-w-xs">
            <label className="block text-sm font-medium text-slate-300 mb-2">Target Date</label>
            <input
              type="date"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500/50 transition-all outline-none"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="w-full sm:w-auto h-[46px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-8 rounded-lg font-semibold shadow-[0_0_20px_rgba(244,63,94,0.25)] hover:shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {resetting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting...
              </span>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Reset All Sessions
              </>
            )}
          </button>
        </div>
      </div>
    </div>

  );
};

export default PolicyConfig;
