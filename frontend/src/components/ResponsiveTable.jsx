import React from 'react';

const ResponsiveTable = ({ children, title, className = "" }) => {
  return (
    <div className={`w-full min-w-0 bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-xl ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/30">
          <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto custom-scrollbar relative">
        {/* Shadow indicators for horizontal scroll */}
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-900/40 to-transparent pointer-events-none opacity-0 sm:group-hover:opacity-100 transition-opacity"></div>
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-900/40 to-transparent pointer-events-none opacity-0 sm:group-hover:opacity-100 transition-opacity"></div>
        
        <div className="inline-block min-w-full align-middle">
          {children}
        </div>
      </div>
      
      {/* Mobile-only Hint */}
      <div className="sm:hidden px-4 py-2 bg-slate-900/50 border-t border-slate-700/50 flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Swipe to view more</span>
      </div>
    </div>
  );
};

export default ResponsiveTable;
