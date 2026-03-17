import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { ClipboardDocumentListIcon, CheckCircleIcon, ClockIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks/');
      setTasks(res.data.results || res.data);
    } catch (err) {
      toast.error('Failed to load my tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/`, { status: newStatus });
      toast.success('Task status updated');
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const handleQuickSelect = (type) => {
    setExportType(type);
    const now = new Date();
    if (type === 'weekly') {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (type === 'monthly') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleExport = () => {
    let rawData = tasks;
    
    // Filter by task creation date or deadline if requested
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      rawData = tasks.filter(t => {
        // Fallback to created_at if deadline is not set
        const dateStr = t.created_at || t.deadline || new Date().toISOString();
        const d = new Date(dateStr);
        return d >= start && d <= end;
      });
    }

    if (rawData.length === 0) {
      toast.error('No tasks found for the selected dates');
      return;
    }

    const headers = ['Title', 'Description', 'Priority', 'Status', 'Deadline', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(t => [
         (t.title || '').replace(/,/g, ' '),
         (t.description || '').replace(/\n/g, ' ').replace(/,/g, ' '),
         t.priority || 'Normal',
         t.status.replace('_', ' '),
         t.deadline ? format(new Date(t.deadline), 'yyyy-MM-dd') : 'No deadline',
         t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : 'Unknown'
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `My_Tasks_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Tasks exported successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-400" />
            My Tasks
          </h2>
          <p className="text-slate-400 mt-1">View and update your assigned tasks.</p>
        </div>

        {/* Export Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
          <div className="flex gap-2">
            <select 
              value={exportType}
              onChange={(e) => handleQuickSelect(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="custom">Custom Dates</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
            <span className="text-slate-500">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Columns for Kanban style */}
        {['todo', 'in_progress', 'done'].map(columnStatus => (
          <div key={columnStatus} className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-200 capitalize border-b border-slate-700 pb-2 mb-4">
              {columnStatus.replace('_', ' ')}
            </h3>
            
            <div className="space-y-3">
              {loading ? (
                <div className="animate-pulse flex flex-col gap-2">
                  <div className="h-20 bg-slate-700/50 rounded-lg"></div>
                  <div className="h-20 bg-slate-700/50 rounded-lg"></div>
                </div>
              ) : tasks.filter(t => t.status === columnStatus).length === 0 ? (
                <p className="text-slate-500 text-sm italic py-4 text-center">No tasks in this column.</p>
              ) : (
                tasks.filter(t => t.status === columnStatus).map(t => (
                  <div key={t.id} className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 group hover:border-indigo-500 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-slate-200 text-sm">{t.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase
                        ${t.priority === 'high' ? 'bg-rose-500/10 text-rose-400' : 
                          t.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' : 
                          'bg-emerald-500/10 text-emerald-400'}`}>
                        {t.priority || 'Normal'}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-3">{t.description}</p>
                    <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-3">
                      <div className="flex items-center gap-1 text-slate-500">
                        <ClockIcon className="h-4 w-4" />
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'No deadline'}
                      </div>
                      
                      {columnStatus !== 'done' && (
                        <button 
                          onClick={() => handleStatusChange(t.id, columnStatus === 'todo' ? 'in_progress' : 'done')}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          {columnStatus === 'todo' ? 'Start' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyTasks;
