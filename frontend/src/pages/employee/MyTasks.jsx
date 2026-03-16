import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ClipboardDocumentListIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks/');
      // Filter out tasks not explicitly assigned to the user, if the API doesn't do it automatically 
      // (The API actually filters for employee role based on get_queryset, so it returns their tasks)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ClipboardDocumentListIcon className="h-6 w-6 text-indigo-400" />
          My Tasks
        </h2>
        <p className="text-slate-400 mt-1">View and update your assigned tasks.</p>
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
                        {t.priority}
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
