import React, { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ClipboardDocumentCheckIcon, PlusIcon, XMarkIcon, PencilSquareIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { AuthContext } from '../../context/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const AssignTasks = () => {
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentTask, setCurrentTask] = useState(null);
  
  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');
  const [exportAssignedTo, setExportAssignedTo] = useState('all');
  const [exportStatus, setExportStatus] = useState('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    project: '',
    status: 'todo',
    due_date: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, usersRes, projectsRes] = await Promise.all([
        api.get('/tasks/'),
        api.get('/users/'),
        api.get('/projects/')
      ]);
      setTasks(tasksRes.data.results || tasksRes.data);
      const allUsers = usersRes.data.results || usersRes.data;
      setUsers(allUsers.filter(u => u.role === 'employee'));
      setProjects(projectsRes.data.results || projectsRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (mode, task = null) => {
    setModalMode(mode);
    if (mode === 'edit' && task) {
      setCurrentTask(task);
      setFormData({
        title: task.title || '',
        description: task.description || '',
        assigned_to: task.assigned_to || '',
        project: task.project || '',
        status: task.status || 'todo',
        due_date: task.due_date || ''
      });
    } else {
      setCurrentTask(null);
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        project: '',
        status: 'todo',
        due_date: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentTask(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (payload.assigned_to === '') payload.assigned_to = null;
      if (payload.project === '') payload.project = null;

      if (modalMode === 'create') {
        // created_by should be managed by backend, but we can send if needed
        await api.post('/tasks/', payload);
        toast.success('Task created successfully');
      } else {
        await api.patch(`/tasks/${currentTask.id}/`, payload);
        toast.success('Task updated successfully');
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}/`);
      toast.success('Task deleted successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete task');
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
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      rawData = rawData.filter(t => {
        // Fallback to created_at if due_date is missing
        const dateStr = t.due_date || t.created_at || new Date().toISOString();
        const d = new Date(dateStr);
        return d >= start && d <= end;
      });
    }

    if (exportAssignedTo !== 'all') {
      if (exportAssignedTo === 'unassigned') {
        rawData = rawData.filter(t => !t.assigned_to);
      } else {
        rawData = rawData.filter(t => String(t.assigned_to) === String(exportAssignedTo));
      }
    }

    if (exportStatus !== 'all') {
      rawData = rawData.filter(t => t.status === exportStatus);
    }

    if (rawData.length === 0) {
      toast.error('No tasks found for the selected dates');
      return;
    }

    const headers = ['Title', 'Description', 'Assigned To', 'Project', 'Status', 'Deadline'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(t => [
         (t.title || '').replace(/,/g, ' '),
         (t.description || '').replace(/\n/g, ' ').replace(/,/g, ' '),
         t.assigned_to_email || 'Unassigned',
         t.project_name || 'No Project',
         t.status.replace('_', ' '),
         t.due_date ? format(new Date(t.due_date), 'yyyy-MM-dd') : 'No deadline'
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Assigned_Tasks_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Tasks exported successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-6 w-6 text-indigo-400" />
            Assign Tasks
          </h2>
          <p className="text-slate-400 mt-1">Manage and assign tasks to your team members.</p>
        </div>
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
          {/* Export Controls */}
          <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
            <div className="flex gap-2 flex-wrap">
              <select 
                id="exportAssignedTo"
                name="export-assigned-to"
                value={exportAssignedTo}
                onChange={(e) => setExportAssignedTo(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Employees</option>
                <option value="unassigned">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>

              <select 
                id="exportStatus"
                name="export-status"
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>

              <select 
                id="exportType"
                name="export-type"
                value={exportType}
                onChange={(e) => handleQuickSelect(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="custom">Custom</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                id="exportStartDate"
                name="export-start-date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setExportType('custom'); }}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
              />
              <span className="text-slate-500 text-sm">to</span>
              <input 
                type="date" 
                id="exportEndDate"
                name="export-end-date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
              />
            </div>

            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap w-full sm:w-auto"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>

          <button 
            onClick={() => openModal('create')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all whitespace-nowrap w-full xl:w-auto font-medium shadow-lg shadow-indigo-500/20"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Assign New Task</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-200 cursor-default">Task Queue</h3>
          <div className="flex gap-2">
             <input type="text" id="taskSearch" name="task-search" placeholder="Search tasks..." className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-1 text-sm text-slate-200 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic">No tasks currently assigned to your team.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Project</th>
                  <th className="px-6 py-4 font-medium">Assigned To</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Deadline</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">{t.title}</td>
                    <td className="px-6 py-4">{t.project_name || 'No Project'}</td>
                    <td className="px-6 py-4">{t.assigned_to_email || 'Unassigned'}</td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${t.status === 'todo' ? 'bg-slate-500/10 text-slate-400' : 
                          t.status === 'in_progress' ? 'bg-indigo-500/10 text-indigo-400' : 
                          'bg-emerald-500/10 text-emerald-400'}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => openModal('edit', t)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors" title="Edit">
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors" title="Delete">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-slate-100">
                {modalMode === 'create' ? 'Assign New Task' : 'Edit Task'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="modalTaskTitle" className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input 
                  type="text" 
                  id="modalTaskTitle"
                  name="title" 
                  required
                  value={formData.title} 
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="Task title"
                />
              </div>

              <div>
                <label htmlFor="modalTaskDescription" className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea 
                  id="modalTaskDescription"
                  name="description" 
                  value={formData.description} 
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="Task description..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modalAssignedTo" className="block text-sm font-medium text-slate-300 mb-1">Assigned To</label>
                  <select 
                    id="modalAssignedTo"
                    name="assigned_to" 
                    value={formData.assigned_to} 
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="modalProject" className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                  <select 
                    id="modalProject"
                    name="project" 
                    value={formData.project} 
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modalTaskStatus" className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                  <select 
                    id="modalTaskStatus"
                    name="status" 
                    value={formData.status} 
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="modalTaskDueDate" className="block text-sm font-medium text-slate-300 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    id="modalTaskDueDate"
                    name="due_date" 
                    value={formData.due_date} 
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-700">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {modalMode === 'create' ? 'Create Task' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignTasks;
