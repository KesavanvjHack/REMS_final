import React, { useContext } from 'react';
import { ScreenShareContext } from '../../context/ScreenShareContext';
import { AuthContext } from '../../context/AuthContext';
import './LiveBadge.css';

const LiveBadge = () => {
    const { isSharing, stream } = useContext(ScreenShareContext);
    const { status } = useContext(AuthContext);

    // Only show if:
    // 1. Backend session is active (isSharing)
    // 2. Video stream is actually flowing (stream)
    // 3. User is in a valid attendance state (working/idle)
    if (!isSharing || !stream || !['working', 'idle'].includes(status)) return null;

    return (
        <div className="live-badge-container group">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-rose-500/10 border border-rose-500/20 px-2 sm:px-3 py-1 rounded-full backdrop-blur-sm transition-all group-hover:bg-rose-500/20">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-rose-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-rose-400 uppercase tracking-widest">
                    <span className="hidden sm:inline">Live Monitoring Active</span>
                    <span className="inline sm:hidden">Live</span>
                </span>
            </div>
        </div>
    );
};

export default LiveBadge;
