import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { PencilSquareIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportRole, setExportRole] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');

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
    let rawData = users;
    
    // Filter by role
    if (exportRole !== 'all') {
      rawData = Object.values(rawData).filter(u => u.role === exportRole);
    }
    
    // Filter by date (using date_joined or created_at logic if available, defaulting to true if none exists, else tracking their join date)
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      rawData = rawData.filter(u => {
        // Users might not have date_joined passed to frontend, but usually they do in Django
        // Fallback to true if field missing so we don't accidentally hide them, or enforce Date
        if (!u.date_joined) return true;
        const d = new Date(u.date_joined);
        return d >= start && d <= end;
      });
    }

    if (rawData.length === 0) {
      toast.error('No users found for the selected criteria');
      return;
    }

    const headers = ['Name', 'Email', 'Role', 'Department', 'Manager', 'Status', 'Date Joined'];
    const csvContent = [
      headers.join(','),
      ...rawData.map(u => [
         (u.full_name || '').replace(/,/g, ' '),
         u.email,
         u.role,
         (u.department_name || '').replace(/,/g, ' '),
         (u.manager_name || '').replace(/,/g, ' '),
         u.is_active ? 'Active' : 'Inactive',
         u.date_joined ? format(new Date(u.date_joined), 'yyyy-MM-dd') : 'N/A'
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Users_Export_${exportRole}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Users exported successfully!');
  };

  if (loading) return <div className="text-indigo-400 p-8 text-center animate-pulse">Loading Users...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">User Management</h1>
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3">
          <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
            <div className="flex gap-2 flex-wrap">
              <select
                id="exportRole"
                name="export-role"
                value={exportRole}
                onChange={(e) => setExportRole(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>

              <select 
                id="exportType"
                name="export-type"
                value={exportType}
                onChange={(e) => handleQuickSelect(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="custom">Custom Dates</option>
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
             onClick={openAddModal}
             className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg font-medium shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 whitespace-nowrap w-full xl:w-auto">
            <span className="text-lg">+</span> <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Role Summary Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <svg className="w-24 h-24 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">Total Employees</p>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black text-slate-200">{users.filter(u => u.role === 'employee').length}</p>
            <p className="text-xs text-slate-500 mb-1 tracking-wider">USERS</p>
          </div>
        </div>
        
        <div className="bg-slate-800/80 border border-sky-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <svg className="w-24 h-24 text-sky-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          <p className="text-sm font-medium text-sky-400 uppercase tracking-wider mb-2">Total Managers</p>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black text-white">{users.filter(u => u.role === 'manager').length}</p>
            <p className="text-xs text-sky-500/70 mb-1 tracking-wider">USERS</p>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-fuchsia-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
            <svg className="w-24 h-24 text-fuchsia-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
          </div>
          <p className="text-sm font-medium text-fuchsia-400 uppercase tracking-wider mb-2">Total Admins</p>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black text-white">{users.filter(u => u.role === 'admin').length}</p>
            <p className="text-xs text-fuchsia-500/70 mb-1 tracking-wider">USERS</p>
          </div>
        </div>
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
                  <td className="px-6 py-4 text-right whitespace-nowrap">
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
                  <label htmlFor="modalFirstName" className="block text-sm font-medium text-slate-400 mb-1">First Name *</label>
                  <input required type="text" id="modalFirstName" name="first_name" value={formData.first_name} onChange={handleChange}
                         className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label htmlFor="modalLastName" className="block text-sm font-medium text-slate-400 mb-1">Last Name *</label>
                  <input required type="text" id="modalLastName" name="last_name" value={formData.last_name} onChange={handleChange}
                         className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label htmlFor="modalEmail" className="block text-sm font-medium text-slate-400 mb-1">Email (Login ID) *</label>
                <input required type="email" id="modalEmail" name="email" value={formData.email} onChange={handleChange} disabled={!!editingUser}
                       className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50" />
              </div>

              {!editingUser && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="modalPassword" className="block text-sm font-medium text-slate-400 mb-1">Password *</label>
                    <input required type="password" id="modalPassword" name="password" value={formData.password} onChange={handleChange}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label htmlFor="modalConfirmPassword" className="block text-sm font-medium text-slate-400 mb-1">Confirm Password *</label>
                    <input required type="password" id="modalConfirmPassword" name="confirm_password" value={formData.confirm_password} onChange={handleChange}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modalRole" className="block text-sm font-medium text-slate-400 mb-1">Role</label>
                  <select id="modalRole" name="role" value={formData.role} onChange={handleChange}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                  <div className="flex items-center h-10 mt-1">
                     <label htmlFor="modalIsActive" className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" id="modalIsActive" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                       <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                       <span className="ml-3 text-sm font-medium text-slate-300">{formData.is_active ? 'Active' : 'Inactive'}</span>
                     </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modalDepartment" className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                  <select id="modalDepartment" name="department" value={formData.department} onChange={handleChange}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="">None</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                   <label htmlFor="modalManager" className="block text-sm font-medium text-slate-400 mb-1">Manager</label>
                   <select id="modalManager" name="manager" value={formData.manager} onChange={handleChange}
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
