import { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ArrowRightOnRectangleIcon, BellIcon, UsersIcon } from '@heroicons/react/24/outline';
import api from '../api/axios';
import StatusBadge from './StatusBadge';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * LiveStatusPanel — clickable dropdown showing all team members' live status.
 * Click the pill to open/close a panel listing every individual (employees & managers).
 * Fetches from GET /status/team/ and refreshes every 15 s while open.
 */
const STATUS_META = {
  working:  { label: 'Working',  dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400' },
  on_break: { label: 'On Break', dot: 'bg-cyan-400',    text: 'text-cyan-400'  },
  idle:     { label: 'Idle',     dot: 'bg-amber-400',   text: 'text-amber-400' },
  offline:  { label: 'Offline',  dot: 'bg-slate-500',   text: 'text-slate-500' },
};

const LiveStatusPanel = ({ liveStatuses }) => {
  const [open, setOpen]           = useState(false);
  const [members, setMembers]     = useState([]);
  const [loadingList, setLoading] = useState(false);
  const panelRef                  = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch individual list
  const fetchMembers = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/status/team/');
      setMembers(res.data.results || res.data);
    } catch { /* silent */ } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Initial silent fetch to populate pill counts even before opening panel
  useEffect(() => {
    fetchMembers(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => fetchMembers(true), 15000);
    return () => clearInterval(interval);
  }, [open]);

  // Merge websocket statuses into members array for the most accurate counting
  const mergedMembers = useMemo(() => {
    return members.map(m => {
      const wsStatus = liveStatuses[m.user_id] || liveStatuses[m.id];
      return {
        ...m,
        status: wsStatus || m.status
      };
    });
  }, [members, liveStatuses]);

  // Calculate counts off the merged members array ensuring we don't miss Admins 
  // or people who haven't had a WS event yet.
  const counts = useMemo(() => {
    return {
      working:  mergedMembers.filter(m => m.status === 'working').length,
      on_break: mergedMembers.filter(m => m.status === 'on_break').length,
      idle:     mergedMembers.filter(m => m.status === 'idle').length,
      total:    mergedMembers.length,
    };
  }, [mergedMembers]);

  // Always render for Managers and Admins (handled by parent visibility check)
  // const hasActive = counts.working > 0 || counts.on_break > 0 || counts.idle > 0;
  // if (!hasActive) return null;

  // Group helpers
  const byRole = (role) => mergedMembers.filter(m => m.role === role || m.user_role === role);
  const admins    = byRole('admin');
  const managers  = byRole('manager');
  const employees = byRole('employee');

  return (
    <div ref={panelRef} className="relative">
      {/* Pill button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all
          ${open
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            : 'bg-slate-800/80 border-slate-700/50 text-slate-300 hover:border-slate-600'
          }`}
      >
        <UsersIcon className="h-3.5 w-3.5" />
        {counts.working > 0 && (
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {counts.working} working
          </span>
        )}
        {counts.on_break > 0 && (
          <span className="flex items-center gap-1 text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {counts.on_break} break
          </span>
        )}
        {counts.idle > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {counts.idle} idle
          </span>
        )}
        <span className="text-slate-500 ml-0.5">{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden origin-top-right">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
            <p className="text-sm font-semibold text-slate-200">Live Team Status</p>
            <button onClick={fetchMembers} className="text-slate-500 hover:text-indigo-400 transition-colors text-xs">↻ Refresh</button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {loadingList && members.length === 0 ? (
              <p className="px-4 py-6 text-center text-slate-500 text-sm">Loading…</p>
            ) : (
              <>
                {/* Admins section */}
                {admins.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">Admins</p>
                    {admins.map(m => {
                      const st = STATUS_META[m.status] || STATUS_META.offline;
                      return (
                        <div key={m.user_id || m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center text-rose-300 font-bold text-xs flex-shrink-0">
                            {(m.user_name || m.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{m.user_name || m.name}</p>
                            <p className="text-xs text-slate-500 truncate">{m.email}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-semibold ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Managers section */}
                {managers.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400">Managers</p>
                    {managers.map(m => {
                      const st = STATUS_META[m.status] || STATUS_META.offline;
                      return (
                        <div key={m.user_id || m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-xs flex-shrink-0">
                            {(m.user_name || m.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{m.user_name || m.name}</p>
                            <p className="text-xs text-slate-500 truncate">{m.email}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-semibold ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Employees section */}
                {employees.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Employees</p>
                    {employees.map(m => {
                      const st = STATUS_META[m.status] || STATUS_META.offline;
                      return (
                        <div key={m.user_id || m.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/20 flex items-center justify-center text-cyan-300 font-bold text-xs flex-shrink-0">
                            {(m.user_name || m.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{m.user_name || m.name}</p>
                            <p className="text-xs text-slate-500 truncate">{m.email}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-semibold ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {members.length === 0 && !loadingList && (
                  <p className="px-4 py-6 text-center text-slate-500 text-sm italic">No team data available</p>
                )}
              </>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700/50 text-[10px] text-slate-600 text-center">
            Auto-refreshes every 15s • Powered by WebSocket
          </div>
        </div>
      )}
    </div>
  );
};

const TopBar = () => {
  const { user, logout, liveStatuses } = useContext(AuthContext);
  const [currentStatus, setCurrentStatus] = useState('offline');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const wsRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    fetchNotifications();
    const interval = setInterval(fetchStatus, 5000); // Polling every 5s

    // Connect WebSocket if logged in
    if (user) {
      connectWebSocket();
    }

    // Set up ticking clock
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Listen to manual triggers from WorkSession
    const handleStatusChange = (e) => {
      if (e.detail) {
        setCurrentStatus(e.detail);
      } else {
        fetchStatus();
      }
    };
    window.addEventListener('statusChange', handleStatusChange);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
      window.removeEventListener('statusChange', handleStatusChange);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  const connectWebSocket = () => {
    if (wsRef.current) return; // Prevent double connection

    // Determine WS protocol based on window.location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Ideally use env var for WS URL, falling back to localhost for dev
    const wsUrl = `${protocol}//localhost:8000/ws/notifications/`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket Connected');
    };

    wsRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'notification' && data.recipient_id === user?.id) {
        setNotifications((prev) => {
          // De-duplicate: Ensure we don't add the same notification ID twice
          if (prev.some(n => n.id === data.notification_id)) {
            return prev;
          }

          const newNotif = {
            id: data.notification_id,
            title: data.title,
            message: data.message,
            type: data.notif_type,
            sender_name: data.sender_name,
            is_read: false,
            created_at: new Date().toISOString()
          };

          // Trigger toast strictly on first receipt
          // Using strict ID so react-hot-toast auto-deduplicates if re-rendered
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-slate-100">{data.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{data.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-slate-700">
                <button 
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Close
                </button>
              </div>
            </div>
          ), { duration: 4000, id: data.notification_id });

          return [newNotif, ...prev];
        });
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket Disconnected');
    };
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      // ONLY fetch unread notifications
      const res = await api.get('/notifications/?is_read=false');
      const raw = res.data.results || res.data;
      
      // Defensively de-duplicate the initial fetch payload just in case older duplicates exist in DB
      const uniqueIds = new Set();
      const cleanNotifs = raw.filter(n => {
        if (!uniqueIds.has(n.id)) {
          uniqueIds.add(n.id);
          return true;
        }
        return false;
      });
      
      setNotifications(cleanNotifs);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark_read/`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setNotifications([]);
      setShowNotifications(false);
      toast.success('All notifications cleared');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      if (wsRef.current) wsRef.current.close();
      logout();
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.get('/status/me/');
      setCurrentStatus(res.data.status);
    } catch (err) {
      console.error('Failed to fetch status', err);
    }
  };

  return (
    <div className="h-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 text-slate-400">
        <h2 className="text-xl font-semibold tracking-wide capitalize text-slate-200">
          {window.location.pathname.split('/')[1] || 'Dashboard'}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Persistent live team status — only visible to admin or manager */}
        {user && (user.role === 'admin' || user.role === 'manager') && (
          <LiveStatusPanel liveStatuses={liveStatuses} />
        )}

        <StatusBadge status={currentStatus} />
        
        {user && (
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 transition-colors rounded-full ${showNotifications ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            >
              <BellIcon className="h-6 w-6" />
              {notifications.length > 0 && (
                <>
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping opacity-75"></span>
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-slate-900 pointer-events-none flex items-center justify-center text-[8px] font-bold text-white">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                </>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-800 border border-slate-700 shadow-2xl rounded-xl overflow-hidden z-50 transform origin-top-right transition-all">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
                  {notifications.length > 0 && (
                     <button 
                        onClick={handleMarkAllAsRead}
                        className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                     >
                        Mark all as read
                     </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm italic">
                      No new notifications
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700/50">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-4 hover:bg-slate-700/30 transition-colors group flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                             notif.type === 'status' ? 'bg-emerald-400' : 
                             notif.type === 'leave' ? 'bg-amber-400' : 
                             notif.type === 'task' ? 'bg-indigo-400' : 'bg-rose-400'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <p className="text-sm font-medium text-slate-200 truncate">{notif.title}</p>
                              <p className="text-[10px] text-slate-500 whitespace-nowrap">
                                {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{notif.message}</p>
                            {notif.sender_name && (
                               <p className="text-[10px] mt-2 font-medium text-slate-500 uppercase tracking-wider">From: {notif.sender_name}</p>
                            )}
                          </div>
                          <button 
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-indigo-400 transition-all rounded"
                            title="Mark as read"
                          >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                             </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pl-6 border-l border-slate-700 h-10">
          {user ? (
            <>
              <div className="text-right">
                <p className="text-base font-semibold text-slate-200 tracking-wide">{user?.full_name}</p>
                <p className="text-sm text-rose-500 font-bold uppercase tracking-widest font-mono">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold shadow-inner">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <button
                onClick={handleLogout}
                className="ml-4 p-2 text-rose-400/80 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="h-6 w-6" />
              </button>
            </>
          ) : (
             <div className="flex gap-4 items-center">
                <Link to="/login" className="px-5 py-2 text-sm font-semibold text-indigo-400 border border-indigo-500/30 rounded-lg shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)] hover:bg-indigo-500/10 transition-all">
                  Sign In
                </Link>
                <Link to="/signup" className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-[0_0_20px_-3px_rgba(99,102,241,0.6)] hover:bg-indigo-500 hover:scale-105 transition-all">
                  Sign Up
                </Link>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
