import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
      {/* Background Decorative elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]"></div>

      <div className="relative z-10">
        <h1 className="text-[12rem] font-black text-white leading-none opacity-5 tracking-tighter select-none">404</h1>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h2 className="text-4xl font-bold text-white mb-2">Page Not Found</h2>
          <p className="text-slate-400 max-w-md mb-8">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Link
              to="/"
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
            >
              Go to Home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-8 py-3 text-slate-300 hover:text-white font-semibold transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>

      <div className="mt-12 text-slate-600 text-xs uppercase tracking-[0.4em] font-bold">
        Remote Engagement & Monitoring System
      </div>
    </div>
  );
};

export default NotFound;
