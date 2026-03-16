import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { PlayIcon, StopIcon, PauseIcon } from '@heroicons/react/24/solid';
import { ClockIcon } from '@heroicons/react/24/outline';

const WorkSession = () => {
  const [status, setStatus] = useState('offline'); // offline | working | on_break
  const [loading, setLoading] = useState(true);
  const [breakType, setBreakType] = useState('lunch');
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [activeWorkSeconds, setActiveWorkSeconds] = useState(0);

  useEffect(() => {
    fetchStatus();
    
    // Sync polling every 60 seconds for real-time timesheet updates
    const intervalId = setInterval(() => {
      fetchStatus();
    }, 60000);

    // Timer countdown loop
    const countdownId = setInterval(() => {
      setStatus(currentStatus => {
        // Increment work timer if working
        if (currentStatus === 'working') {
          setActiveWorkSeconds(prev => prev + 1);
        }
        return currentStatus;
      });

      const storedBreak = localStorage.getItem('rems_active_break');
      if (storedBreak) {
        const { endTime } = JSON.parse(storedBreak);
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setBreakTimeLeft(remaining);
      }
    }, 1000);

    return () => {
       clearInterval(intervalId);
       clearInterval(countdownId);
    };
  }, []);

  // Auto-resume work when break time expires
  useEffect(() => {
    if (status === 'on_break' && !loading) {
      const storedBreak = localStorage.getItem('rems_active_break');
      if (storedBreak) {
        const { endTime } = JSON.parse(storedBreak);
        if (Date.now() >= endTime) {
          handleBreakStop();
        }
      }
    }
  }, [breakTimeLeft, status, loading]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/status/me/');
      setStatus(res.data.status);
      
      // Sync the real active time from the server session if available
      if (res.data.session && ['working', 'on_break', 'idle'].includes(res.data.status)) {
        const sessionStart = new Date(res.data.session.start_time).getTime();
        const now = new Date().getTime();
        
        let breakSeconds = 0;
        let idleSeconds = 0;
        
        if (res.data.attendance) {
           breakSeconds = res.data.attendance.total_break_seconds || 0;
           idleSeconds = res.data.attendance.total_idle_seconds || 0;
        }

        if (res.data.status === 'on_break' && res.data.session.break_sessions) {
            const activeBreak = res.data.session.break_sessions.find(b => !b.end_time);
            if (activeBreak) {
                const breakStart = new Date(activeBreak.start_time).getTime();
                breakSeconds += Math.floor((now - breakStart) / 1000);
            }
        }

        if (res.data.status === 'idle' && res.data.session.idle_logs) {
            const activeIdle = res.data.session.idle_logs.find(i => !i.end_time);
            if (activeIdle) {
                const idleStart = new Date(activeIdle.start_time).getTime();
                idleSeconds += Math.floor((now - idleStart) / 1000);
            }
        }

        const totalElapsedSecs = Math.floor((now - sessionStart) / 1000);
        const effectiveSecs = Math.max(0, totalElapsedSecs - breakSeconds - idleSeconds);
        
        setActiveWorkSeconds(effectiveSecs);
      } else if (res.data.status === 'offline') {
        setActiveWorkSeconds(0);
      }
    } catch (err) {
      toast.error('Failed to fetch real-time status');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (endpoint, action) => {
    try {
      setLoading(true);
      const tempStatus = action === 'start' ? 'working' : 'offline';
      setStatus(tempStatus);
      window.dispatchEvent(new CustomEvent('statusChange', { detail: tempStatus }));

      await api.post(`/sessions/${endpoint}/`, { action });
      await fetchStatus();
      if (endpoint === 'work' && action === 'stop') {
         localStorage.removeItem('rems_active_break');
      }
      toast.success(`Action successfully recorded`);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to perform ${action} action`);
      fetchStatus(); // revert on fail
    } finally {
      setLoading(false);
    }
  };

  const handleBreakStart = async () => {
    try {
      setLoading(true);
      
      let durationMins = 60; // lunch default
      if (breakType === 'tea') durationMins = 15;
      if (breakType === 'other') durationMins = 30;
      
      const endTime = Date.now() + (durationMins * 60 * 1000);
      localStorage.setItem('rems_active_break', JSON.stringify({ type: breakType, endTime }));
      
      await api.post(`/sessions/break/`, { action: 'start' });
      
      setStatus('on_break');
      window.dispatchEvent(new CustomEvent('statusChange', { detail: 'on_break' }));
      await fetchStatus();
      toast.success(`${breakType.charAt(0).toUpperCase() + breakType.slice(1)} break started`);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to start break`);
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleBreakStop = async () => {
    try {
      setLoading(true);
      
      await api.post(`/sessions/break/`, { action: 'stop' });
      localStorage.removeItem('rems_active_break');
      
      setStatus('working');
      window.dispatchEvent(new CustomEvent('statusChange', { detail: 'working' }));
      await fetchStatus();
      toast.success('Break ended');
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to end break`);
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 mt-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Remote Work Terminal</h1>
        <p className="text-slate-400">Log your active hours and breaks for accurate attendance calculation.</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-10 flex flex-col items-center shadow-xl">
        <div className="mb-8 p-4 rounded-full bg-slate-900/80 border border-slate-700 shadow-inner">
          <ClockIcon className="h-16 w-16 text-indigo-400" />
        </div>
        
        <h2 className="text-xl font-semibold text-slate-200 mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center">
            Current State: 
            <span className={`ml-3 px-4 py-1.5 rounded-full text-base font-bold uppercase tracking-widest
              ${status === 'working' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 
                status === 'on_break' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 
                status === 'idle' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                'bg-slate-500/10 text-slate-400 border border-slate-500/20'}
            `}>
              {status.replace('_', ' ')}
            </span>
          </div>
          
          {(status === 'working' || activeWorkSeconds > 0) && (
            <div className="flex flex-col items-center mt-2 bg-slate-900/50 px-8 py-4 rounded-2xl border border-slate-700">
              <span className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Active Work Time</span>
              <span className="text-4xl font-mono font-black text-emerald-400 tracking-tight drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                {Math.floor(activeWorkSeconds / 3600).toString().padStart(2, '0')}:
                {Math.floor((activeWorkSeconds % 3600) / 60).toString().padStart(2, '0')}:
                {(activeWorkSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
          {(status === 'offline' || status === 'idle') && (
            <button
              onClick={() => handleAction('work', 'start')}
              disabled={loading}
              className="flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white py-4 px-6 rounded-2xl font-semibold tracking-wide shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50"
            >
              <PlayIcon className="h-6 w-6" />
              Start Work
            </button>
          )}

          {status === 'working' && (
            <>
              <div className="flex flex-col gap-3">
                <select 
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 uppercase tracking-widest text-sm font-semibold"
                >
                  <option value="lunch">Lunch Break (60m)</option>
                  <option value="tea">Tea Break (15m)</option>
                  <option value="other">Other Break (30m)</option>
                </select>
                <button
                  onClick={handleBreakStart}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 bg-cyan-600 hover:bg-cyan-500 text-white py-4 px-6 rounded-2xl font-semibold tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50"
                >
                  <PauseIcon className="h-6 w-6" />
                  Start Break
                </button>
              </div>
              
              <button
                onClick={() => handleAction('work', 'stop')}
                disabled={loading}
                className="flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-500 text-white py-4 px-6 rounded-2xl font-semibold tracking-wide shadow-[0_0_20px_rgba(225,29,72,0.3)] transition-all disabled:opacity-50 sm:col-span-2"
              >
                <StopIcon className="h-6 w-6" />
                End Work / Check Out
              </button>
            </>
          )}

          {status === 'on_break' && (
            <div className="sm:col-span-2 flex flex-col items-center gap-6 bg-slate-900/50 p-8 rounded-3xl border border-cyan-500/20 shadow-inner">
              <div className="text-center">
                <p className="text-cyan-400 text-sm font-bold uppercase tracking-widest mb-2">Time Remaining</p>
                <div className="text-5xl font-mono font-black text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] tracking-tighter">
                  {Math.floor(breakTimeLeft / 60).toString().padStart(2, '0')}:{(breakTimeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <button
                onClick={handleBreakStop}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white py-4 px-6 rounded-2xl font-bold tracking-wide shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all disabled:opacity-50"
              >
                <PlayIcon className="h-6 w-6" />
                End Break & Resume Work
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkSession;
