import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useViewerWebRTC from '../../hooks/useViewerWebRTC';
import { 
    ArrowsPointingOutIcon, 
    ArrowsPointingInIcon, 
    MinusIcon, 
    XMarkIcon,
    ArrowPathIcon
} from '@heroicons/react/24/solid';

const MonitorWindow = ({ session, onClose, onRefresh, isMaximized, onMaximize }) => {
    const [minimized, setMinimized] = useState(false);
    const videoRef = useRef(null);
    const { stream } = useViewerWebRTC(session.room_id);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    const toggleMaximized = () => {
        onMaximize(!isMaximized);
        setMinimized(false);
    };

    const toggleMinimized = () => {
        setMinimized(!minimized);
        onMaximize(false);
    };

    const containerClasses = `
        ${isMaximized ? 'w-full h-full max-w-7xl bg-slate-900 border-slate-700/50 overflow-hidden' : 
          minimized ? 'h-[56px] w-[300px] overflow-hidden bg-slate-900 border-slate-700' : 
          'w-full aspect-video md:aspect-auto md:h-[320px] bg-slate-900 border-slate-800'}
        border rounded-2xl shadow-2xl transition-all duration-300 relative group
    `;

    const content = (
        <div className={isMaximized ? "fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8" : ""}>
            <div className={containerClasses}>
                {/* Header */}
                <div className="h-[56px] px-4 flex items-center justify-between bg-slate-800/40 border-b border-slate-700/50 flex-nowrap overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse flex-shrink-0"></span>
                            <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest whitespace-nowrap">
                                LIVE:
                            </span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide truncate">
                            {session.employee_details?.full_name}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button onClick={onRefresh} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Refresh Stream">
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                        <button onClick={toggleMinimized} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <MinusIcon className="w-4 h-4" />
                        </button>
                        <button onClick={toggleMaximized} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
                            {isMaximized ? <ArrowsPointingInIcon className="w-4 h-4" /> : <ArrowsPointingOutIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => onClose(session.id)} className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Video Body */}
                {!minimized && (
                    <div className={`relative w-full ${isMaximized ? 'h-[calc(100%-56px)] bg-black' : 'h-[calc(100%-56px)] bg-black/40'}`}>
                        {stream ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                <span className="text-sm text-slate-500 font-medium tracking-wide">Connecting to stream...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    if (isMaximized) {
        return createPortal(content, document.body);
    }
    return content;
};

export default MonitorWindow;
