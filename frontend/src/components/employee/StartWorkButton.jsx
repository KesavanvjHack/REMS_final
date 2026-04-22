import React from 'react';
import useWebRTC from '../../hooks/useWebRTC';

const StartWorkButton = () => {
    const { startSharing, stopSharing, isSharing } = useWebRTC();

    return (
        <div className="flex items-center gap-4">
            {!isSharing ? (
                <button
                    onClick={startSharing}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                    Start Work & Monitoring
                </button>
            ) : (
                <button
                    onClick={stopSharing}
                    className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                    Stop Work
                </button>
            )}
        </div>
    );
};

export default StartWorkButton;
