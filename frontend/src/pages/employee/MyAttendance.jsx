import { useState, useEffect, useContext } from 'react';
import api from '../../api/axios';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { QueueListIcon, ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { formatDecimalHours } from '../../utils/format';
import LiveDuration from '../../components/LiveDuration';
import { AuthContext } from '../../context/AuthContext';

const MyAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { policy, status: globalStatus } = useContext(AuthContext);
  
  // Date filter state for export
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState('custom');

  useEffect(() => {
    fetchAttendance();
    fetchHolidays();

    // Auto-refresh every 30 seconds for a more 'Live' feel
    const intervalId = setInterval(() => {
      fetchAttendance(true); // silent refresh
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/holidays/');
      setHolidays(res.data.results || res.data);
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

  const fetchAttendance = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/attendance/');
      setAttendance(res.data.results || res.data);
      setLastUpdated(new Date());
    } catch (error) {
      // Suppress repeated toast if polling fails
    } finally {
      if (!silent) setLoading(false);
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
    let rawData = attendance;
    
    // If the user picked dates, filter the exported data
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const allDays = eachDayOfInterval({ start, end });
      
      rawData = allDays.map(day => {
        const existing = attendance.find(r => isSameDay(new Date(r.date), day));
        if (existing) return existing;
        
        return {
          id: `absent-${day.getTime()}`,
          date: format(day, 'yyyy-MM-dd'),
          status: 'absent',
          total_work_seconds: 0,
          total_break_seconds: 0,
          total_idle_seconds: 0,
          is_flagged: false,
          flag_reason: '',
          manager_remark: 'No record found / Absent'
        };
      });
    }

    if (rawData.length === 0) {
      toast.error('No attendance records found for the selected dates');
      return;
    }

    const headers = ['Date', 'Status', 'Work Hours', 'Break (Hours)', 'Idle (Hours)', 'Flags'];
    const csvData = rawData.map(rec => [
         format(new Date(rec.date), 'yyyy-MM-dd'),
         rec.status,
         formatDecimalHours(rec.total_work_seconds),
         formatDecimalHours(rec.total_break_seconds),
         formatDecimalHours(rec.total_idle_seconds),
         rec.is_flagged ? `Flagged: ${rec.flag_reason}` : (rec.manager_remark || 'None')
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(r => {
        const val = r === undefined || r === null ? '' : String(r);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Export_${startDate || 'All'}_to_${endDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully!');
  };

  // Loading skeletons for a premium feel
  if (loading) {
    return (
      <div className="space-y-6 page-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-64 bg-slate-700 rounded skeleton-pulse"></div>
          <div className="h-10 w-48 bg-slate-700 rounded skeleton-pulse"></div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
          <div className="p-4 bg-slate-900/50 h-10 skeleton-pulse"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-6 border-b border-slate-700/50 h-16 skeleton-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Filter attendance for display: Only show CURRENT WEEK records with placeholders
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  const allWeekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  // Filter to only show dates up to TODAY
  const filteredWeekDays = allWeekDays.filter(day => day <= now);
  
  const weeklyAttendance = filteredWeekDays.map(day => {
    const existing = attendance.find(r => isSameDay(new Date(r.date), day));
    if (existing) return existing;

    const holiday = holidays.find(h => isSameDay(new Date(h.date), day));
    
    let placeholderGap = 0;
    if (!holiday) {
      // Use present_hours from policy (fallback to 8h)
      placeholderGap = (policy?.present_hours || policy?.min_working_hours || 8) * 3600;
    }

    return {
      id: `placeholder-${day.getTime()}`,
      date: format(day, 'yyyy-MM-dd'),
      status: holiday ? 'holiday' : 'absent',
      total_work_seconds: 0,
      total_break_seconds: 0,
      total_idle_seconds: 0,
      missing_seconds: placeholderGap,
      is_flagged: false,
      flag_reason: '',
      live_status: 'Offline',
      manager_remark: holiday ? holiday.name : 'No record found / Absent'
    };
  });

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <QueueListIcon className="h-6 w-6 text-indigo-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">This Week's Attendance</h1>
          {lastUpdated && (
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
              Last synced: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchAttendance()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-all flex items-center gap-2"
            title="Manual Refresh"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs font-medium hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Export Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
          <div className="flex gap-2">
            <select 
              id="exportType"
              name="export-type"
              value={exportType}
              onChange={(e) => handleQuickSelect(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
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
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
            <span className="text-slate-500">to</span>
            <input 
              type="date" 
              id="exportEndDate"
              name="export-end-date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setExportType('custom'); }}
              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

          <button
            onClick={handleExport}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium whitespace-nowrap w-full sm:w-auto"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span className="text-xs">Export CSV</span>
          </button>
        </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold tracking-wider">Date</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center">Status</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center text-slate-400">Shift (Actual)</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center">Work</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center">Break</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center">Idle</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center text-slate-400">Gap</th>
                <th className="px-4 py-3 font-semibold tracking-wider text-center">Alerts</th>
                <th className="px-4 py-3 font-semibold tracking-wider">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {weeklyAttendance.map((record) => {
                const todayStr = new Date().toISOString().split('T')[0];
                const now = new Date();
                const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                const istDate = new Date(istString);
                const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
                const [endHour, endMin] = (policy?.shift_end_time || '17:30').split(':').map(Number);
                const shiftEndMinutes = endHour * 60 + endMin;
                const isBeforeShiftEnd = currentMinutes < shiftEndMinutes;

                const isCalculating = record.date === todayStr && 
                                    isBeforeShiftEnd &&
                                    record.status !== 'present' && 
                                    record.status !== 'on_leave' && 
                                    record.status !== 'holiday';
                                    
                const displayStatus = isCalculating ? 'calculating...' : record.status;
                
                return (
                <tr key={record.id} className="hover:bg-slate-700/20 transition-colors border-b border-slate-700/30 last:border-0 text-xs">
                  <td className="px-4 py-2.5 font-medium text-slate-200">
                    <span className="hidden lg:inline">{format(new Date(record.date), 'EEEE, MMM dd, yyyy')}</span>
                    <span className="lg:hidden">{format(new Date(record.date), 'dd/MM/yy')}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                      ${isCalculating ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        record.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        record.status === 'half_day' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        record.status === 'absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        record.status === 'on_leave' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'}
                    `}>
                      {displayStatus?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono leading-tight whitespace-nowrap">
                    <span className="block text-indigo-400 text-[10px] font-bold">
                      {record.first_login ? format(new Date(record.first_login), 'hh:mm:ss a') : '--:--:--'}
                    </span>
                    <span className="block text-slate-600 text-[9px] my-0.5">to</span>
                    <span className="block text-rose-400 text-[10px] font-bold">
                      {record.last_logout ? format(new Date(record.last_logout), 'hh:mm:ss a') : '--:--:--'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-emerald-400">
                    <LiveDuration
                      initialSeconds={record.total_work_seconds}
                      status={record.date === todayStr ? globalStatus : record.live_status}
                      type="work"
                      isToday={record.date === todayStr}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-cyan-400">
                    <LiveDuration
                      initialSeconds={record.total_break_seconds}
                      status={record.date === todayStr ? globalStatus : record.live_status}
                      type="break"
                      isToday={record.date === todayStr}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-amber-400">
                    <LiveDuration
                      initialSeconds={record.total_idle_seconds}
                      status={record.date === todayStr ? globalStatus : record.live_status}
                      type="idle"
                      isToday={record.date === todayStr}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-orange-400/90">
                    {record.missing_seconds > 0 ? (
                       <span>{Math.floor(record.missing_seconds / 3600).toString().padStart(2, '0')}:{Math.floor((record.missing_seconds % 3600) / 60).toString().padStart(2, '0')}:{(record.missing_seconds % 60).toString().padStart(2, '0')}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {record.is_flagged ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-[10px] text-rose-400 font-bold uppercase">Anomaly</span>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-mono text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-[11px] italic min-w-[150px]">
                    {record.manager_remark || '—'}
                  </td>
                </tr>
              )})}
              {weeklyAttendance.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500 font-medium italic">No attendance records found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyAttendance;
