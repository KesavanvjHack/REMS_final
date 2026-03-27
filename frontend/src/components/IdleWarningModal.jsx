import React, { useState, useEffect } from 'react';

const IdleWarningModal = ({ isOpen, onResume, idleTime, idleStartTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isOpen || !idleStartTime) {
      setElapsed(0);
      return;
    }
    
    // Update elapsed time every second
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - idleStartTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, idleStartTime]);

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full shadow-2xl transform transition-all animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
            <svg 
              className="w-8 h-8 text-amber-500 animate-pulse" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">Idle Detected</h2>
          <div className="text-amber-400 font-mono text-xl mb-4 tabular-nums">
            {formatTime(elapsed)}
          </div>
          
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            You have been inactive for over <span className="text-white font-semibold">{idleTime}+ minutes</span>. 
            Your idle time is being recorded, and your manager/admin have been notified.
          </p>

          <button
            onClick={onResume}
            className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-[0_10px_20px_-10px_rgba(99,102,241,0.5)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            I'm Back, Resume Work
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdleWarningModal;
