import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const OrganizationManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const deptsRes = await api.get('/departments/');
      setDepartments(deptsRes.data.results || deptsRes.data);
    } catch (error) {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDepartment(null);
    setFormData({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this department?")) {
      try {
        await api.delete(`/departments/${id}/`);
        toast.success("Department deleted successfully");
        fetchData();
      } catch (err) {
        toast.error("Failed to delete department");
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await api.patch(`/departments/${editingDepartment.id}/`, formData);
        toast.success('Department updated successfully');
      } else {
        await api.post('/departments/', formData);
        toast.success('Department created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
       toast.error(error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Failed to save department');
    }
  };

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Organization Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Organization Management</h1>
        <button 
           onClick={openAddModal}
           className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 sm:py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 whitespace-nowrap w-auto">
          <span className="text-lg">+</span> <span className="hidden sm:inline">Add Department</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Department Name</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Description</th>
                <th className="px-6 py-4 text-right font-semibold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{dept.name}</td>
                  <td className="px-6 py-4">{dept.description || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                       onClick={() => openEditModal(dept)}
                       className="text-indigo-400 hover:text-indigo-300 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors">
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button 
                       onClick={() => handleDelete(dept.id)}
                       className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors ml-2">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No departments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dept Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-slate-200 mb-4">{editingDepartment ? 'Edit Department' : 'Add Department'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label htmlFor="deptName" className="block text-sm font-medium text-slate-400 mb-1">Department Name *</label>
                <input required type="text" id="deptName" name="name" value={formData.name} onChange={handleChange}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>

              <div>
                <label htmlFor="deptDescription" className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                <textarea id="deptDescription" name="description" value={formData.description} onChange={handleChange} rows={3}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white px-6 py-2 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                  {editingDepartment ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationManagement;
