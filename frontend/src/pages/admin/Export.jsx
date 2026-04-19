import { useState } from 'react';
import api from '../../api/axios';
import { ArrowDownTrayIcon, DocumentTextIcon, TableCellsIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Export = () => {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState('csv'); // csv, excel
  const [reportType, setReportType] = useState('attendance'); // attendance, leaves, audit

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create a blob from the response to trigger file download
      const response = await api.get(`/export/?type=${reportType}&export_format=${format}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const extension = format === 'excel' ? 'xlsx' : 'csv';
      const disposition = response.headers['content-disposition'];
      let filename = `rems_export_${reportType}_${new Date().getTime()}.${extension}`;
      if (disposition && disposition.includes('filename=')) {
          filename = disposition.split('filename=')[1].replace(/"/g, '');
      }
      
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('File exported successfully');
    } catch (error) {
      console.error('Export failed', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
          <ArrowDownTrayIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Data Exporter</h1>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
        <p className="text-slate-400 mb-8">
          Download system records for offline analysis, payroll processing, or internal compliance reviews.
        </p>

        <form onSubmit={handleExport} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Data to Export</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className={`
                flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all text-center
                ${reportType === 'attendance' 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}>
                <input 
                  type="radio" 
                  id="reportAttendance"
                  name="reportType" 
                  value="attendance" 
                  checked={reportType === 'attendance'} 
                  onChange={() => setReportType('attendance')} 
                  className="sr-only" 
                />
                <TableCellsIcon className="h-6 w-6" />
                <span className="font-medium text-sm">Attendance Logs</span>
              </label>

              <label className={`
                flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all text-center
                ${reportType === 'leave' 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}>
                <input 
                  type="radio" 
                  id="reportLeave"
                  name="reportType" 
                  value="leave" 
                  checked={reportType === 'leave'} 
                  onChange={() => setReportType('leave')} 
                  className="sr-only" 
                />
                <DocumentTextIcon className="h-6 w-6" />
                <span className="font-medium text-sm">Leave Requests</span>
              </label>

              <label className={`
                flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all text-center
                ${reportType === 'audit' 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}>
                <input 
                  type="radio" 
                  id="reportAudit"
                  name="reportType" 
                  value="audit" 
                  checked={reportType === 'audit'} 
                  onChange={() => setReportType('audit')} 
                  className="sr-only" 
                />
                <DocumentTextIcon className="h-6 w-6" />
                <span className="font-medium text-sm">System Audit Trails</span>
              </label>

              <label className={`
                flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all text-center
                ${reportType === 'payroll' 
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}
              `}>
                <input 
                  type="radio" 
                  id="reportPayroll"
                  name="reportType" 
                  value="payroll" 
                  checked={reportType === 'payroll'} 
                  onChange={() => setReportType('payroll')} 
                  className="sr-only" 
                />
                <CurrencyDollarIcon className="h-6 w-6" />
                <span className="font-medium text-sm">Payroll Data</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">File Format</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  id="formatCSV"
                  name="format" 
                  value="csv" 
                  checked={format === 'csv'} 
                  onChange={() => setFormat('csv')} 
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900" 
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Comma Separated (.csv)</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  id="formatExcel"
                  name="format" 
                  value="excel" 
                  checked={format === 'excel'} 
                  onChange={() => setFormat('excel')} 
                  className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900" 
                />
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Excel Worksheet (.xlsx)</span>
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {loading ? 'Generating File...' : 'Download Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Export;
