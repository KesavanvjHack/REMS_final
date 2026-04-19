import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XMarkIcon, 
  ArrowDownTrayIcon,
  ClockIcon,
  FunnelIcon,
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ManagerReview = () => {
  const [records, setRecords] = useState([]);
  const [team, setTeam] = useState([]); // All subordinates
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  
  // Filter States
  const [reviewStatus, setReviewStatus] = useState('pending'); // 'pending' or 'reviewed'
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('week'); // 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch Full Team List for Filter
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await api.get('/status/team-list/');
        setTeam(res.data.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      } catch (error) {
        console.error('Failed to fetch team list');
      }
    };
    fetchTeam();
  }, []);

  const fetchFlagged = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let fromDate = startDate;
      let toDate = endDate;

      if (dateRange === 'week' && !startDate) {
        fromDate = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        toDate = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (dateRange === 'month' && !startDate) {
        fromDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        toDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      }

      const params = {
        review_status: reviewStatus,
        user_id: employeeFilter,
        from_date: fromDate,
        to_date: toDate
      };

      const res = await api.get('/attendance/flagged/', { params });
      setRecords(res.data.results || res.data);
    } catch (error) {
      toast.error('Failed to load attendance records');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [reviewStatus, employeeFilter, dateRange, startDate, endDate]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  const handleReview = async (id, action) => {
    setProcessingId(id);
    try {
      await api.post(`/attendance/${id}/review/`, { action });
      toast.success(`Anomaly ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      fetchFlagged(true);
    } catch (error) {
      toast.error(`Failed to ${action} anomaly`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExport = () => {
    if (records.length === 0) {
      toast.error('No records to export');
      return;
    }

    const headers = ['Date', 'Employee', 'Email', 'Original Status', 'Review Status', 'Remark', 'Work Hours', 'Idle Time', 'Reason for Flag'];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        r.date,
        r.user_name,
        r.user_email,
        r.status,
        r.reviewed_by ? (r.status === 'half_day' ? 'Accepted' : 'Rejected') : 'Pending',
        r.manager_remark || '-',
        r.work_hours,
        (r.total_idle_seconds / 3600).toFixed(2) + 'h',
        r.flag_reason
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Anomaly_Report_${reviewStatus}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const acceptedRecords = records.filter(r => r.status === 'half_day');
  const rejectedRecords = records.filter(r => r.status === 'absent');

  const AnomalyCard = ({ record, isHistory }) => (
    <div className="group bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-500/30 p-5 rounded-2xl flex flex-col transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 font-bold text-sm ring-1 ring-indigo-500/20">
            {record.user_name?.charAt(0)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{record.user_name}</h3>
            <p className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">
              {format(new Date(record.date), 'EEE, MMM dd')}
            </p>
          </div>
        </div>
        {!isHistory && (
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
            Flagged
          </span>
        )}
      </div>
      
      <div className="bg-slate-900/40 rounded-xl p-3 mb-4 space-y-3">
        <div>
          <span className="text-[9px] font-black uppercase text-slate-600 block mb-0.5">Reason:</span>
          <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">"{record.flag_reason}"</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
            <span className="text-[8px] font-bold text-slate-500 block uppercase">Work</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{record.work_hours}</span>
          </div>
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
            <span className="text-[8px] font-bold text-slate-500 block uppercase">Idle</span>
            <span className="text-xs font-mono font-bold text-amber-400">{(record.total_idle_seconds / 3600).toFixed(2)}h</span>
          </div>
        </div>
        {record.manager_remark && (
          <div className="border-t border-slate-800 pt-2">
            <span className="text-[9px] font-black uppercase text-indigo-400 block mb-0.5">Remark:</span>
            <p className="text-[10px] text-slate-400 line-clamp-1 italic">{record.manager_remark}</p>
          </div>
        )}
      </div>

      {!isHistory && (
        <div className="flex gap-2 mt-auto">
          <button
            disabled={processingId === record.id}
            onClick={() => handleReview(record.id, 'approve')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-2 rounded-xl font-bold text-[11px] transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-500/10"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Accept
          </button>
          <button
            disabled={processingId === record.id}
            onClick={() => handleReview(record.id, 'reject')}
            className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all disabled:opacity-50 active:scale-95"
            title="Reject"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 page-fade-in pb-20">
      {/* HEADER SECTION */}
      <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-white/5 mb-8">
        <div className="flex flex-col gap-6">
          {/* Top Row: Title & Main Toggles */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${reviewStatus === 'pending' ? 'bg-rose-500/10' : 'bg-emerald-500/10'} shadow-inner`}>
                {reviewStatus === 'pending' ? (
                  <ExclamationTriangleIcon className="h-7 w-7 text-rose-500" />
                ) : (
                  <ClockIcon className="h-7 w-7 text-emerald-500" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {reviewStatus === 'pending' ? 'Pending Anomalies' : 'History Log'}
                </h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black opacity-80">
                  {reviewStatus === 'pending' ? 'Require Review' : 'Outcome Audit'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl">
                <button
                  onClick={() => setReviewStatus('pending')}
                  className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 ${
                    reviewStatus === 'pending' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => { setReviewStatus('reviewed'); setDateRange('week'); }}
                  className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 ${
                    reviewStatus === 'reviewed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Weekly History
                </button>
              </div>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-950 rounded-xl font-black text-xs hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-white/5"
              >
                <ArrowDownTrayIcon className="h-4.5 w-4.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Bottom Row: Detailed Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/50">
            <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 group focus-within:ring-2 ring-indigo-500/50 transition-all">
              <label htmlFor="employeeFilter" className="sr-only">Filter by Employee</label>
              <FunnelIcon className="h-4 w-4 text-slate-500" />
              <select
                id="employeeFilter"
                name="employee-filter"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="bg-transparent text-slate-300 text-[12px] font-bold focus:outline-none min-w-[160px] cursor-pointer"
              >
                <option value="all">All Employees</option>
                {team.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            <label htmlFor="dateRange" className="sr-only">Filter by Date Range</label>
            <select
              id="dateRange"
              name="date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl px-4 py-2 text-[12px] font-bold focus:ring-2 ring-indigo-500/50 cursor-pointer"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                <label htmlFor="startDate" className="sr-only">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-[12px] [color-scheme:dark] focus:ring-2 ring-indigo-500/50"
                />
                <span className="text-slate-700 font-bold">/</span>
                <label htmlFor="endDate" className="sr-only">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950/50 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 text-[12px] [color-scheme:dark] focus:ring-2 ring-indigo-500/50"
                />
              </div>
            )}

            <button
              onClick={() => fetchFlagged()}
              className="ml-auto p-2 bg-slate-800/80 rounded-xl text-slate-400 hover:text-white transition-all hover:bg-slate-700"
              title="Refresh Data"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT SECTION */}
      <div className="relative">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-slate-900/50 border border-slate-800 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-600 bg-slate-900/20 border-2 border-dashed border-slate-800/50 rounded-[3rem]">
            <div className="p-8 bg-slate-900/50 rounded-full mb-6">
              <CheckCircleIcon className="h-16 w-16 opacity-10" />
            </div>
            <p className="font-black text-xl text-slate-500 uppercase tracking-widest">No matching records</p>
            <p className="text-xs font-bold text-slate-700 mt-2">Adjust your filters or try a different date range</p>
          </div>
        ) : reviewStatus === 'pending' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {records.map(r => <AnomalyCard key={r.id} record={r} isHistory={false} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2px_1fr] gap-x-8 gap-y-12 items-start">
            {/* ACCEPTED COLUMN */}
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-[2rem] backdrop-blur-sm shadow-xl shadow-emerald-500/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl shadow-lg shadow-emerald-500/10">
                    <HandThumbUpIcon className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="font-black text-white text-sm uppercase tracking-wider">Accepted Anomalies</h2>
                    <p className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest">Marked as Half-Day</p>
                  </div>
                </div>
                <div className="bg-emerald-500 text-slate-950 px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-emerald-500/20">
                  {acceptedRecords.length}
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {acceptedRecords.map(r => <AnomalyCard key={r.id} record={r} isHistory={true} />)}
                {acceptedRecords.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem] text-slate-700 font-bold text-xs uppercase tracking-widest">
                    No approved records
                  </div>
                )}
              </div>
            </div>

            {/* VERTICAL DIVIDER */}
            <div className="hidden lg:block w-[2px] self-stretch bg-gradient-to-b from-transparent via-slate-800 to-transparent opacity-50"></div>

            {/* REJECTED COLUMN */}
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-rose-500/5 border border-rose-500/20 p-5 rounded-[2rem] backdrop-blur-sm shadow-xl shadow-rose-500/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-500/20 rounded-2xl shadow-lg shadow-rose-500/10">
                    <HandThumbDownIcon className="h-6 w-6 text-rose-500" />
                  </div>
                  <div>
                    <h2 className="font-black text-white text-sm uppercase tracking-wider">Rejected Anomalies</h2>
                    <p className="text-[10px] text-rose-500/60 font-black uppercase tracking-widest">Marked as Absent</p>
                  </div>
                </div>
                <div className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-rose-500/20">
                  {rejectedRecords.length}
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {rejectedRecords.map(r => <AnomalyCard key={r.id} record={r} isHistory={true} />)}
                {rejectedRecords.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-[2rem] text-slate-700 font-bold text-xs uppercase tracking-widest">
                    No rejected records
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerReview;

