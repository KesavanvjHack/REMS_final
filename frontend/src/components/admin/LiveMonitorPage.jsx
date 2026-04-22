import React, { useState, useEffect } from 'react';
import monitoringAPI from '../../services/monitoringAPI';
import MonitorWindow from './MonitorWindow';
import { ComputerDesktopIcon, UsersIcon, SignalIcon } from '@heroicons/react/24/outline';

const LiveMonitorPage = () => {
    const [activeSessions, setActiveSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [watchedSessions, setWatchedSessions] = useState([]);
    const [refreshKeys, setRefreshKeys] = useState({});
    const [maximizedSessionId, setMaximizedSessionId] = useState(null);

    const handleRefresh = (id) => {
        setRefreshKeys(prev => ({
            ...prev,
            [id]: (prev[id] || 0) + 1
        }));
    };

    const fetchSessions = async () => {
        try {
            const resp = await monitoringAPI.getActiveEmployees();
            setActiveSessions(resp.data);
            // Auto-watch new sessions if they are not already in watchedSessions
            const sessionIds = resp.data.map(s => s.id);
            setWatchedSessions(prev => {
                const existingIds = prev.map(s => s.id);
                const newSessions = resp.data.filter(s => !existingIds.includes(s.id));
                return [...prev.filter(ps => sessionIds.includes(ps.id)), ...newSessions];
            });
        } catch (err) {
            console.error("Failed to fetch active sessions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleFocus = () => fetchSessions();
        window.addEventListener('focus', handleFocus);
        
        fetchSessions();
        const interval = setInterval(() => {
            if (!document.hidden) fetchSessions();
        }, 10000); 

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    const removeWatchedSession = (id) => {
        setWatchedSessions(prev => prev.filter(s => s.id !== id));
    };

    if (loading && activeSessions.length === 0) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <h2 className="text-slate-400 font-medium">Scanning for active streams...</h2>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <SignalIcon className="w-8 h-8 text-rose-500 animate-pulse" />
                        Live Monitoring Center
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">
                        Real-time oversight of active work sessions across your team.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <UsersIcon className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-bold text-slate-200">
                        {activeSessions.length} Active Employees
                    </span>
                </div>
            </div>

            {/* Grid display */}
            {activeSessions.length === 0 ? (
                <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                    <div className="bg-slate-800 p-4 rounded-2xl mb-4">
                        <ComputerDesktopIcon className="w-12 h-12 text-slate-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-300">No active streams found</h3>
                    <p className="text-slate-500 mt-2 max-w-sm">
                        As soon as employees start their work session, their live screen feeds will appear here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {watchedSessions.map(session => (
                        <MonitorWindow 
                            key={`${session.id}-${refreshKeys[session.id] || 0}`} 
                            session={session} 
                            onClose={removeWatchedSession} 
                            onRefresh={() => handleRefresh(session.id)}
                            isMaximized={maximizedSessionId === session.id}
                            onMaximize={(val) => setMaximizedSessionId(val ? session.id : null)}
                        />
                    ))}
                </div>
            )}

            {/* Inactive employee list / stats could go here */}
        </div>
    );
};

export default LiveMonitorPage;
