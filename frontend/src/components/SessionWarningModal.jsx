import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const SessionWarningModal = ({ isOpen, onStay, onLogout, timeLeft }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-cyan-500/10 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Session Expiring Soon</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Your session is about to expire due to inactivity. You will be automatically logged out in <span className="text-amber-500 font-mono font-bold">{timeLeft}</span>.
          </p>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={onStay}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl font-bold tracking-wide shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              Stay Logged In
            </button>
            <button
              onClick={onLogout}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-semibold transition-all active:scale-95"
            >
              Logout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;
