import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import toast from 'react-hot-toast';
import SessionWarningModal from '../components/SessionWarningModal';

export const AuthContext = createContext({ user: null, loading: true, logout: () => {}, login: () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatuses, setLiveStatuses] = useState({});
  const [idleThreshold, setIdleThreshold] = useState(15); // Default 15 mins
  const [policy, setPolicy] = useState(null);
  const [status, setStatus] = useState('offline');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [warningTimeLeft, setWarningTimeLeft] = useState('');
  const [isWithinShift, setIsWithinShift] = useState(true);
  
  const [notifications, setNotifications] = useState([]);
  
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  // Real-time Idle Logic: Derived from the Attendance Policy (minutes -> seconds)
  const getIdleThreshold = useCallback(() => {
    return (policy?.idle_threshold_minutes || 15) * 60;
  }, [policy]);

  const disconnectWebSocket = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const reconnectAttemptsRef = useRef(0);
  const connectWebSocket = useCallback((currentUser) => {
    if (wsRef.current || !currentUser) return;
    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
      const ws = new WebSocket(`${wsUrl}/ws/status/`);
      
      ws.onopen = () => {
        console.log('Status WebSocket Connected');
        reconnectAttemptsRef.current = 0; // Reset on success
        if (currentUser) {
          ws.send(JSON.stringify({ type: 'presence', user_id: currentUser.id }));
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'presence', user_id: currentUser.id }));
            }
          }, 30000);
        }
      };

      ws.onclose = () => {
        console.log('Status WebSocket Disconnected');
        disconnectWebSocket();
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < 5) {
            const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
            setTimeout(() => {
                reconnectAttemptsRef.current += 1;
                connectWebSocket(currentUser);
            }, delay);
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Debug Logging
        if (data.type !== 'presence_update') {
            console.log('[WebSocket] MSG:', data.type, data);
        }

        if (data.type === 'status_update') {
          setLiveStatuses(prev => ({
            ...prev,
            [data.user_id]: data.status
          }));
        } else if (data.type === 'policy_update') {
          console.log('Policy update received - triggering global sync');
          // Re-fetch everything to reflect new shift hours or session resets
          fetchInitialStatuses(currentUser.role);
          
          // Emit a custom event so specific pages (like WorkSession) can re-fetch their local status
          window.dispatchEvent(new CustomEvent('rems_sync_required'));
          
          toast.success('System policy updated', { icon: '🔄' });
        } else if (data.type === 'notification_alert') {
          const currentUserId = String(currentUser?.id || '').toLowerCase();
          const recipientId = String(data.recipient_id || '').toLowerCase();
          
          if (recipientId === currentUserId) {
            setNotifications((prev) => {
              if (prev.some(n => n.id === data.notification_id)) return prev;
              const newNotif = {
                id: data.notification_id,
                title: data.title,
                message: data.message,
                type: data.notif_type,
                sender_name: data.sender_name,
                is_read: false,
                created_at: new Date().toISOString()
              };
              
              toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-slate-700`}>
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <div className={`w-2 h-2 rounded-full ${
                          data.notif_type === 'status' ? 'bg-emerald-400' : 
                          data.notif_type === 'system' ? 'bg-rose-400' : 'bg-indigo-400'
                        }`} />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-slate-100">{data.title}</p>
                        <p className="mt-1 text-sm text-slate-400 whitespace-pre-line">{data.message}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-slate-700">
                    <button 
                      onClick={() => toast.dismiss(t.id)}
                      className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-400 hover:text-indigo-300 focus:outline-none"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ), { duration: 8000, id: data.notification_id });

              return [newNotif, ...prev];
            });
          }
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        console.log('Status WebSocket Disconnected');
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to connect to status websocket', err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      disconnectWebSocket();
      setLiveStatuses({});
      window.location.href = '/login';
    }
  }, [disconnectWebSocket]);

  const fetchInitialStatuses = useCallback(async (role) => {
    if (role === 'admin' || role === 'manager') {
      try {
        const res = await api.get('/status/team/');
        const team = res.data.results || res.data;
        const initial = {};
        team.forEach(member => {
          initial[member.user_id] = member.status;
        });
        setLiveStatuses(initial);
      } catch (err) {
        console.error('Failed to prepare initial live statuses', err);
      }
    }

    try {
      const policyRes = await api.get('/policy/');
      const policies = policyRes.data.results || policyRes.data;
      const activePolicy = policies.find(p => p.is_active) || policies[0];
      if (activePolicy) {
        setIdleThreshold(activePolicy.idle_threshold_minutes);
        setPolicy(activePolicy);
      }
    } catch (err) {
      console.error('Failed to fetch idle threshold', err);
    }

    // Fetch unread notifications
    try {
      const notifRes = await api.get('/notifications/?is_read=false');
      const raw = notifRes.data.results || notifRes.data;
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
  }, []);

  const checkUserStatus = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const res = await api.get('/auth/me/');
        setUser(res.data);
        fetchInitialStatuses(res.data.role);
        connectWebSocket(res.data);
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  }, [logout, fetchInitialStatuses, connectWebSocket]);

  const login = useCallback(async (email, password, otp) => {
    try {
      const res = await api.post('/auth/login/', { email, password, otp });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      setUser(res.data.user);
      
      const role = res.data.user.role;
      toast.success('Login Successful');
      fetchInitialStatuses(role);
      connectWebSocket(res.data.user);
      return role; 
    } catch (error) {
      const msg = error.response?.data?.detail || 'Invalid credentials';
      toast.error(msg);
      throw error;
    }
  }, [fetchInitialStatuses, connectWebSocket]);

  const refreshActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setLastActivity(Date.now());
    if (showWarning) setShowWarning(false);
  }, [showWarning]);

  // HANDLE GLOBAL STATUS TOGGLING (SILENT)
  const isTogglingIdleRef = useRef(false);
  const handleIdleDetection = useCallback(async (action) => {
    // Only proceed if not already in target state or already toggling
    if (isTogglingIdleRef.current) return;
    if (action === 'start' && status !== 'working') return;
    if (action === 'stop' && status !== 'idle') return;

    // GUARD: Prevent resuming to 'Working' if screen sharing is missing (set by WorkSession.jsx)
    if (action === 'stop' && window.rems_screen_missing) {
        console.log('[GlobalTracking] Resume blocked: Screen share required');
        return;
    }

    try {
      isTogglingIdleRef.current = true;
      const thresholdSeconds = getIdleThreshold();
      const nextStatus = action === 'start' ? 'idle' : 'working';
      
      setStatus(nextStatus);
      window.dispatchEvent(new CustomEvent('statusChange', { detail: nextStatus }));

      // Notify user of automatic status change
      if (nextStatus === 'idle') {
          toast('You are now Idle', { icon: '🌙', id: 'idle_status_change' });
      } else {
          toast.success('Resumed: Working', { id: 'idle_status_change' });
      }

      const payload = { action };
      if (action === 'start') {
          // Retroactively set start to (now - threshold)
          const start = new Date(Date.now() - (thresholdSeconds * 1000));
          payload.start_time = start.toISOString();
      }

      await api.post('/sessions/idle/', payload);
      
      // Sync local policy if we just resumed (to ensure latest thresholds)
      if (action === 'stop') {
          fetchInitialStatuses(user.role);
      }
    } catch (err) {
      console.error('[GlobalTracking] Idle toggle failed', err);
      // Revert status on failure if it was a manual-like toggle
      // setStatus(action === 'start' ? 'working' : 'idle'); 
    } finally {
      isTogglingIdleRef.current = false;
    }
  }, [status, fetchInitialStatuses, user, getIdleThreshold]);

  useEffect(() => {
    checkUserStatus();

    // GLOBAL ACTIVITY LISTENERS
    window.addEventListener('mousemove', refreshActivity);
    window.addEventListener('keydown', refreshActivity);
    window.addEventListener('mousedown', refreshActivity);
    window.addEventListener('scroll', refreshActivity);

    return () => {
        disconnectWebSocket();
        window.removeEventListener('mousemove', refreshActivity);
        window.removeEventListener('keydown', refreshActivity);
        window.removeEventListener('mousedown', refreshActivity);
        window.removeEventListener('scroll', refreshActivity);
    };
  }, [checkUserStatus, disconnectWebSocket, refreshActivity]);

  // Periodic check for inactivity timeout based on policy
  useEffect(() => {
    if (!user || !policy?.session_timeout_hours) return;

    const checkTimeout = () => {
      // REQUIREMENT: Working status must keep session active
      if (status === 'working') {
        setLastActivity(Date.now());
        if (showWarning) setShowWarning(false);
        return;
      }

      const timeoutMs = policy.session_timeout_hours * 60 * 60 * 1000;
      const warningMs = Math.max(0, timeoutMs - (5 * 60 * 1000)); // 5 mins before
      const idleMs = Date.now() - lastActivity;

      if (idleMs >= timeoutMs) {
        console.warn('Session timeout reached due to inactivity');
        logout();
      } else if (idleMs >= warningMs) {
        const remainingSeconds = Math.ceil((timeoutMs - idleMs) / 1000);
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        setWarningTimeLeft(`${mins}m ${secs}s`);
        setShowWarning(true);
      } else {
        if (showWarning) setShowWarning(false);
      }
    };

    const interval = setInterval(checkTimeout, 5000); 
    return () => clearInterval(interval);
  }, [user, policy, logout, status, lastActivity, showWarning]);

  // GLOBAL AUTO-IDLE DETECTOR (FOR EMPLOYEES)
  useEffect(() => {
    if (!user || user.role !== 'employee' || status === 'offline' || status === 'on_break') return;

    const watchIdle = () => {
        const thresholdSeconds = getIdleThreshold();
        const inactiveMs = Date.now() - lastActivityRef.current;
        if (status === 'working' && inactiveMs > thresholdSeconds * 1000) {
            handleIdleDetection('start');
        } else if (status === 'idle' && inactiveMs < 500) { // Resume instantly on activity
            handleIdleDetection('stop');
        }
    };

    const interval = setInterval(watchIdle, 1000);
    return () => clearInterval(interval);
  }, [user, status, handleIdleDetection]);

  // Global Shift Window Watcher
  useEffect(() => {
    if (!policy?.shift_start_time || !policy?.shift_end_time) {
        setIsWithinShift(true);
        return;
    }

    const checkShift = () => {
        const now = new Date();
        const [sH, sM] = policy.shift_start_time.split(':').map(Number);
        const [eH, eM] = policy.shift_end_time.split(':').map(Number);
        const start = new Date(now).setHours(sH, sM, 0, 0);
        const end = new Date(now).setHours(eH, eM, 0, 0);
        const within = now >= start && now <= end;
        if (within !== isWithinShift) {
            setIsWithinShift(within);
        }
    };

    checkShift();
    const interval = setInterval(checkShift, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [policy, isWithinShift]);

  const value = {
    user,
    loading,
    liveStatuses,
    idleThreshold,
    status,
    setStatus,
    policy,
    lastActivity,
    refreshActivity,
    login,
    logout,
    notifications,
    setNotifications,
    isWithinShift,
    sendJson: (data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
    markAsRead: async (id) => {
      try {
        await api.post(`/notifications/${id}/mark_read/`);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        toast.dismiss(id);
      } catch (err) {
        console.error(err);
      }
    },
    markAllAsRead: async () => {
      try {
        await api.post('/notifications/mark_all_read/');
        setNotifications([]);
        toast.dismiss(); // Clear all notification toasts
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      <SessionWarningModal 
        isOpen={showWarning}
        onStay={refreshActivity}
        onLogout={logout}
        timeLeft={warningTimeLeft}
      />
    </AuthContext.Provider>
  );
};
