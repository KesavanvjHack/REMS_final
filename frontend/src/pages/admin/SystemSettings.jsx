import React, { useState } from 'react';
import { Cog8ToothIcon, ShieldExclamationIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SystemSettings = () => {
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      toast.success('System settings updated successfully.');
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Cog8ToothIcon className="h-6 w-6 text-indigo-400" />
          System Settings
        </h2>
        <p className="text-slate-400 mt-1">Configure global application parameters and advanced security rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security Setttings */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-6">
            <ShieldExclamationIcon className="h-5 w-5 text-rose-400" />
            Security & Access
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="maxLoginAttempts" className="block text-sm font-medium text-slate-400 mb-1">Max Failed Login Attempts</label>
              <input type="number" id="maxLoginAttempts" name="max-login-attempts" defaultValue={5} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Strict IP Whitelisting Enforcement</span>
              <label htmlFor="ipEnforcement" className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="ipEnforcement" name="ip-enforcement" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Integration Settings */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 mb-6">
            <ServerStackIcon className="h-5 w-5 text-emerald-400" />
            Integrations & Endpoints
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="backupRegion" className="block text-sm font-medium text-slate-400 mb-1">Backup Storage Region</label>
              <select id="backupRegion" name="backup-region" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                <option>us-east-1</option>
                <option>eu-central-1</option>
                <option>ap-south-1</option>
              </select>
            </div>
            <div>
              <label htmlFor="dataRetention" className="block text-sm font-medium text-slate-400 mb-1">Data Retention (Days)</label>
              <input type="number" id="dataRetention" name="data-retention" defaultValue={365} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <button className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors">Reset Defaults</button>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
