import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'employee',
    department: '',
    manager: '',
    is_active: true,
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        api.get('/users/'),
        api.get('/departments/')
      ]);
      const fetchedUsers = usersRes.data.results || usersRes.data;
      setUsers(fetchedUsers);
      setDepartments(deptsRes.data.results || deptsRes.data);
      setManagers(fetchedUsers.filter(u => u.role === 'manager' || u.role === 'admin'));
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      email: '', first_name: '', last_name: '', role: 'employee', 
      department: '', manager: '', is_active: true, password: '', confirm_password: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      department: user.department || '',
      manager: user.manager || '',
      is_active: user.is_active,
      password: '',
      confirm_password: ''
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (payload.department === '') payload.department = null;
      if (payload.manager === '') payload.manager = null;

      if (editingUser) {
        // Remove password fields for patch as it's typically handled separately or left blank if not changing
        delete payload.password;
        delete payload.confirm_password;
        delete payload.email; // Usually cannot change email after creation easily without verification
        await api.patch(`/users/${editingUser.id}/`, payload);
        toast.success('User updated successfully');
      } else {
        await api.post('/users/', payload);
        toast.success('User created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
       toast.error(error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Failed to save user');
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Are you sure you want to delete ${user.full_name}?`)) {
      try {
        await api.delete(`/users/${user.id}/`);
        toast.success('User deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete user');
      }
    }
  };

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Users...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">User Management</h1>
        <button 
           onClick={openAddModal}
           className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center gap-2">
          <span>+</span> Add User
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Name</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Email</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Role</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Department</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Manager</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                <th className="px-6 py-4 text-right font-semibold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">{user.full_name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider
                      ${user.role === 'admin' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' : 
                        user.role === 'manager' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
                    `}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">{user.department_name || '-'}</td>
                  <td className="px-6 py-4">{user.manager_name || '-'}</td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                       onClick={() => openEditModal(user)}
                       className="text-indigo-400 hover:text-indigo-300 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors">
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button 
                       onClick={() => handleDelete(user)}
                       className="text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors ml-2">
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <h2 className="text-xl font-bold text-slate-200 mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">First Name *</label>
                  <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange}
                         className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Last Name *</label>
                  <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange}
                         className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email (Login ID) *</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} disabled={!!editingUser}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50" />
              </div>

              {!editingUser && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Password *</label>
                    <input required type="password" name="password" value={formData.password} onChange={handleChange}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password *</label>
                    <input required type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
                  <select name="role" value={formData.role} onChange={handleChange}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                  <div className="flex items-center h-10 mt-1">
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                       <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                       <span className="ml-3 text-sm font-medium text-slate-300">{formData.is_active ? 'Active' : 'Inactive'}</span>
                     </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                  <select name="department" value={formData.department} onChange={handleChange}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="">None</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-1">Manager</label>
                   <select name="manager" value={formData.manager} onChange={handleChange}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                     <option value="">None</option>
                     {managers.map(m => (
                       <option key={m.id} value={m.id}>{m.full_name}</option>
                     ))}
                   </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-sm font-medium text-white px-6 py-2 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
