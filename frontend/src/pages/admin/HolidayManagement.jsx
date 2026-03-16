import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format } from 'date-fns';
import { CalendarIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const HolidayManagement = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', is_optional: false });

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/holidays/');
      setHolidays(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/holidays/', newHoliday);
      toast.success('Holiday added successfully');
      setNewHoliday({ name: '', date: '', is_optional: false });
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.date?.[0] || 'Failed to add holiday');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${id}/`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  if (loading) return <div className="text-indigo-400">Loading Holidays...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <CalendarIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Holiday Calendar</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 h-fit">
          <h2 className="text-lg font-semibold text-white mb-6">Add New Holiday</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Holiday Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
              <input
                type="date"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="is_optional"
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500/50"
                checked={newHoliday.is_optional}
                onChange={(e) => setNewHoliday({ ...newHoliday, is_optional: e.target.checked })}
              />
              <label htmlFor="is_optional" className="text-sm font-medium text-slate-300">
                Optional / Restricted Holiday
              </label>
            </div>
            <button
              type="submit"
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
            >
              Add Holiday
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Holiday Name</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {holidays.map((h) => (
                <tr key={h.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{format(new Date(h.date), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4">{h.name}</td>
                  <td className="px-6 py-4">
                    {h.is_optional ? (
                      <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">Optional</span>
                    ) : (
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">Mandatory</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(h.id)}
                      className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">No holidays configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HolidayManagement;
