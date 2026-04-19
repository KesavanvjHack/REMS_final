import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { CurrencyDollarIcon, PlusIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses/');
      setExpenses(res.data.results || res.data);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setFormData({ title: '', amount: '' });
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('amount', formData.amount);
      if (receiptFile) {
        data.append('receipt_image', receiptFile);
      }

      await api.post('/expenses/', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Expense submitted successfully');
      closeModal();
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CurrencyDollarIcon className="h-6 w-6 text-indigo-400" />
            My Expenses
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Submit and track WFH reimbursements and organization expenses.</p>
        </div>
        <button 
          onClick={openModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all whitespace-nowrap w-full sm:w-auto font-medium shadow-lg shadow-indigo-500/20"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Submit Expense</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Quick Stats Summary */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-slate-400 text-sm font-medium mb-1">Total Approved</p>
          <div className="text-2xl font-bold text-emerald-400">
            ${expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-slate-400 text-sm font-medium mb-1">Pending Review</p>
          <div className="text-2xl font-bold text-amber-400">
            ${expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-slate-400 text-sm font-medium mb-1">Rejected</p>
          <div className="text-2xl font-bold text-rose-400">
             ${expenses.filter(e => e.status === 'rejected').reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
           <div className="p-8 text-center text-slate-400 animate-pulse">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic">No expense reports submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date Submitted</th>
                  <th className="px-6 py-4 font-medium text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">{exp.title}</td>
                    <td className="px-6 py-4 text-slate-200 font-semibold">${parseFloat(exp.amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs font-semibold capitalize">
                       <span className={`px-2 py-1 rounded-full ${exp.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : exp.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                         {exp.status}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(exp.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                       {exp.receipt_image ? (
                          <a href={exp.receipt_image} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
                            <DocumentTextIcon className="h-4 w-4" /> View
                          </a>
                       ) : (
                         <span className="text-slate-600 italic">No receipt</span>
                       )}
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
              <h3 className="text-xl font-semibold text-slate-100">Submit New Expense</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="expenseTitle" className="block text-sm font-medium text-slate-300 mb-1">Expense Title *</label>
                <input 
                  type="text" 
                  id="expenseTitle"
                  name="title" 
                  required
                  value={formData.title} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="E.g. Home Internet Bill"
                />
              </div>

              <div>
                <label htmlFor="expenseAmount" className="block text-sm font-medium text-slate-300 mb-1">Amount ($) *</label>
                <input 
                  type="number" 
                  id="expenseAmount"
                  step="0.01"
                  name="amount" 
                  required
                  value={formData.amount} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="receiptFile" className="block text-sm font-medium text-slate-300 mb-1">Receipt Image (Optional)</label>
                <input 
                  type="file" 
                  id="receiptFile"
                  name="receipt_image"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 focus:outline-none" 
                />
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
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
