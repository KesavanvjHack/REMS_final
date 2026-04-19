import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FolderIcon, DocumentArrowUpIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';

const MyDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: ''
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents/');
      setDocuments(res.data.results || res.data);
    } catch (err) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setFormData({ title: '' });
    setDocumentFile(null);
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
      setDocumentFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!documentFile) {
      toast.error('Please select a file to upload');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('file', documentFile);

      await api.post('/documents/', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Document uploaded successfully');
      closeModal();
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FolderIcon className="h-6 w-6 text-indigo-400" />
            My Documents
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Access policies, payslips, and upload HR documents.</p>
        </div>
        <button 
          onClick={openModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all whitespace-nowrap w-full sm:w-auto font-medium shadow-lg shadow-indigo-500/20"
        >
          <DocumentArrowUpIcon className="h-5 w-5" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl p-6">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-slate-700/50 rounded-lg"></div>
            <div className="h-12 bg-slate-700/50 rounded-lg"></div>
            <div className="h-12 bg-slate-700/50 rounded-lg"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FolderIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No documents available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(doc => (
               <div key={doc.id} className="p-4 bg-slate-900 border border-slate-700 rounded-lg flex items-start gap-4 hover:border-indigo-500 transition-colors group cursor-pointer">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <DocumentTextIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-200 text-sm">{doc.title}</h4>
                    <p className="text-slate-400 text-xs mt-1 capitalize">{new Date(doc.created_at).toLocaleDateString()}</p>
                    {doc.file && <a href={doc.file} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline text-xs mt-2 inline-block">View File</a>}
                  </div>
               </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-slate-100">Upload Document</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="docTitle" className="block text-sm font-medium text-slate-300 mb-1">Document Title *</label>
                <input 
                  type="text" 
                  id="docTitle"
                  name="title" 
                  required
                  value={formData.title} 
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                  placeholder="E.g. Relocation Expense Receipt"
                />
              </div>

              <div>
                <label htmlFor="docFile" className="block text-sm font-medium text-slate-300 mb-1">Select File *</label>
                <input 
                  type="file" 
                  id="docFile"
                  name="file"
                  required
                  accept=".pdf,.doc,.docx,.jpg,.png"
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
                  {isSubmitting ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyDocuments;
