import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { RectangleGroupIcon, BriefcaseIcon, PlusIcon, XMarkIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const TaskProjectHub = () => {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentProject, setCurrentProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    client_code: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projRes, taskRes] = await Promise.all([
        api.get('/projects/'),
        api.get('/tasks/')
      ]);
      setProjects(projRes.data.results || projRes.data);
      setTasks(taskRes.data.results || taskRes.data);
    } catch (err) {
      toast.error('Failed to load projects and tasks');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (mode, project = null) => {
    setModalMode(mode);
    if (mode === 'edit' && project) {
      setCurrentProject(project);
      setFormData({
        name: project.name || '',
        client_code: project.client_code || '',
        description: project.description || '',
        is_active: project.is_active !== undefined ? project.is_active : true
      });
    } else {
      setCurrentProject(null);
      setFormData({
        name: '',
        client_code: '',
        description: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProject(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await api.post('/projects/', formData);
        toast.success('Project created successfully');
      } else {
        await api.patch(`/projects/${currentProject.id}/`, formData);
        toast.success('Project updated successfully');
      }
      closeModal();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save project');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.delete(`/projects/${id}/`);
      toast.success('Project deleted successfully');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <RectangleGroupIcon className="h-6 w-6 text-indigo-400" />
            Task & Project Hub
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Manage all organization projects and track task distributions.</p>
        </div>
        <button 
          onClick={() => openModal('create')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors whitespace-nowrap w-full sm:w-auto font-medium shadow-lg shadow-indigo-500/20"
        >
          <PlusIcon className="h-5 w-5" />
          <span>New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <BriefcaseIcon className="h-5 w-5 text-emerald-400" />
            Active Projects ({projects.length})
          </h3>
          {loading ? (
            <div className="animate-pulse flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-700/50 rounded-lg"></div>)}
            </div>
          ) : projects.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No projects found.</p>
          ) : (
            <div className="space-y-3">
              {projects.map(p => (
                <div key={p.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-slate-200">{p.name}</h4>
                      {p.client_code && <p className="text-indigo-400 text-xs mt-0.5 uppercase tracking-wider">Client: {p.client_code}</p>}
                      <p className="text-slate-400 text-sm mt-1">{p.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-full ${p.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                        {p.is_active ? 'Active' : 'Archived'}
                      </span>
                      <div className="flex gap-1">
                         <button onClick={() => openModal('edit', p)} className="p-1 hover:text-indigo-400 text-slate-500 transition-colors" title="Edit">
                           <PencilSquareIcon className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDelete(p.id)} className="p-1 hover:text-rose-400 text-slate-500 transition-colors" title="Delete">
                           <TrashIcon className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <RectangleGroupIcon className="h-5 w-5 text-indigo-400" />
            Recent Tasks ({tasks.length})
          </h3>
          {loading ? (
             <div className="animate-pulse flex flex-col gap-3">
             {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-700/50 rounded-lg"></div>)}
           </div>
          ) : tasks.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No tasks assigned globally.</p>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 flex justify-between">
                  <div>
                    <h4 className="font-medium text-slate-200">{t.title}</h4>
                    <p className="text-slate-400 text-sm mt-1">Project: {projects.find(p => p.id === t.project)?.name || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-indigo-400 text-[10px] uppercase font-bold tracking-wider mb-1">{t.status.replace('_', ' ')}</span>
                    <span className="text-slate-500 text-xs">Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-slate-100">
                {modalMode === 'create' ? 'Create Project' : 'Edit Project'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-slate-300 mb-1">Project Name *</label>
                <input 
                  type="text" 
                  id="projectName"
                  name="name" 
                  required
                  value={formData.name} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="E.g. Website Redesign"
                />
              </div>

              <div>
                <label htmlFor="clientCode" className="block text-sm font-medium text-slate-300 mb-1">Client Code</label>
                <input 
                  type="text" 
                  id="clientCode"
                  name="client_code" 
                  value={formData.client_code} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="Optional code..."
                />
              </div>

              <div>
                <label htmlFor="projectDescription" className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea 
                  id="projectDescription"
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange}
                  rows="3"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="Project details..."
                ></textarea>
              </div>

              <div>
                <label htmlFor="projectActive" className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                <div className="flex items-center h-10 mt-1">
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" id="projectActive" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                     <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                     <span className="ml-3 text-sm font-medium text-slate-300">{formData.is_active ? 'Active' : 'Archived'}</span>
                   </label>
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
                  {modalMode === 'create' ? 'Create Project' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskProjectHub;
