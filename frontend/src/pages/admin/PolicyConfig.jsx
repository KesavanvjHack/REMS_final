import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { AdjustmentsHorizontalIcon, CheckIcon } from '@heroicons/react/24/outline';

const PolicyConfig = () => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  if (loading) return <div className="text-indigo-400">Loading Configuration...</div>;
  if (!policy) return <div className="text-rose-400">No Policy Available</div>;

  return (
    <div className="max-w-3xl space-y-6">
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
    </div>
  );
};

export default PolicyConfig;
