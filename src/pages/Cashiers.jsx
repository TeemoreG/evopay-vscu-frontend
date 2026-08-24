import { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosConfig';

const Cashiers = () => {
  const { user } = useAuth();
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCashier, setEditingCashier] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    user_name: '',
    full_name: '',
    password: '',
    role: 'cashier',
    use_yn: 'Y'
  });

  useEffect(() => {
    // Allow both manager and admin
    if (user?.role === 'manager' || user?.role === 'admin') {
      fetchCashiers();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchCashiers = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/users');
      setCashiers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch cashiers:', error);
      toast.error('Error loading cashiers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCashier(null);
    setFormData({ user_id: '', user_name: '', full_name: '', password: '', role: 'cashier', use_yn: 'Y' });
    setShowForm(true);
  };

  const handleEdit = (cashier) => {
    setEditingCashier(cashier);
    setFormData({
      user_id: cashier.user_id || '',
      user_name: cashier.user_name || '',
      full_name: cashier.full_name || cashier.user_name || '',
      password: '',
      role: cashier.role || 'cashier',
      use_yn: cashier.use_yn || 'Y'
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.user_id || !formData.user_name) {
      toast.error('User ID and Username are required');
      return;
    }

    if (!editingCashier && !formData.password) {
      toast.error('Password is required for new cashiers');
      return;
    }

    try {
      await axiosInstance.post('/api/users', formData);
      toast.success(editingCashier ? 'Cashier updated successfully' : 'Cashier added successfully');
      setShowForm(false);
      fetchCashiers();
    } catch (error) {
      console.error('Failed to save cashier:', error);
      toast.error(error.response?.data?.error || 'Error saving cashier');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm(`Delete cashier ${userId}?`)) return;

    try {
      await axiosInstance.delete(`/users/${userId}`);
      toast.success('Cashier deleted successfully');
      fetchCashiers();
    } catch (error) {
      console.error('Failed to delete cashier:', error);
      toast.error(error.response?.data?.error || 'Error deleting cashier');
    }
  };

  const getStatusBadge = (useYn) => {
    if (useYn === 'Y' || useYn === 'y') {
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>;
    }
    return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Inactive</span>;
  };

  // Allow both manager and admin
  if (user?.role !== 'manager' && user?.role !== 'admin') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          Access Denied. Only managers and admins can manage cashiers.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2a4a]">Cashier Management</h1>
          <p className="text-gray-500 text-sm">Manage system users and cashiers</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-[#f47b20] hover:bg-[#e06d1a] text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Cashier
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1a2a4a] mb-4">
            {editingCashier ? 'Edit Cashier' : 'Add New Cashier'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID *</label>
                <input
                  type="text"
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                  placeholder="e.g., cashier2"
                  required
                  disabled={editingCashier}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                  placeholder="e.g., Cashier Two"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                  placeholder="e.g., Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password {!editingCashier && '*'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                  placeholder={editingCashier ? 'Leave blank to keep current' : 'Enter password'}
                  required={!editingCashier}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.use_yn}
                  onChange={(e) => setFormData({ ...formData, use_yn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f47b20] focus:border-transparent"
                >
                  <option value="Y">Active</option>
                  <option value="N">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                className="bg-[#f47b20] hover:bg-[#e06d1a] text-white px-6 py-2 rounded-lg transition"
              >
                {editingCashier ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-[#f47b20] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                      No cashiers found. Click "Add Cashier" to create one.
                    </td>
                  </tr>
                ) : (
                  cashiers.map((cashier) => (
                    <tr key={cashier.user_id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{cashier.user_id}</td>
                      <td className="px-4 py-3 font-medium text-[#1a2a4a]">{cashier.user_name}</td>
                      <td className="px-4 py-3 text-gray-600">{cashier.full_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          cashier.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                          cashier.role === 'admin' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {cashier.role || 'cashier'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(cashier.use_yn)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleEdit(cashier)}
                          className="text-[#1a2a4a] hover:text-[#0f1a33] text-xs mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(cashier.user_id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cashiers;