import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatuses, setLiveStatuses] = useState({});
  const [idleThreshold, setIdleThreshold] = useState(15); // Default 15 mins
  const [policy, setPolicy] = useState(null);
  const [status, setStatus] = useState('offline');
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);

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

  const connectWebSocket = useCallback((currentUser) => {
    if (wsRef.current || !currentUser) return;
    try {
      const ws = new WebSocket('ws://localhost:8000/ws/status/');
      ws.onopen = () => {
        console.log('Status WebSocket Connected');
        if (currentUser) {
          ws.send(JSON.stringify({ type: 'presence', user_id: currentUser.id }));
          heartbeatRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'presence', user_id: currentUser.id }));
            }
          }, 30000);
        }
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'status_update') {
          setLiveStatuses(prev => ({
            ...prev,
            [data.user_id]: data.status
          }));
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
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
  }, []);

  const checkUserStatus = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          const res = await api.get('/auth/me/');
          setUser(res.data);
          fetchInitialStatuses(res.data.role);
          connectWebSocket(res.data);
        }
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

  useEffect(() => {
    checkUserStatus();
    return () => disconnectWebSocket();
  }, [checkUserStatus, disconnectWebSocket]);

  // Periodic check for absolute session timeout based on policy
  useEffect(() => {
    if (!user || !policy?.session_timeout_hours) return;

    const checkTimeout = () => {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      try {
        const decoded = jwtDecode(token);
        const issuedAt = decoded.iat * 1000; // to ms
        const ageHours = (Date.now() - issuedAt) / (1000 * 60 * 60);

        if (ageHours >= policy.session_timeout_hours) {
          console.warn('Session timeout reached according to policy');
          toast.error(`Your ${policy.session_timeout_hours}-hour session has expired.`);
          logout();
        }
      } catch (err) {
        console.error('Timeout check failed', err);
      }
    };

    const interval = setInterval(checkTimeout, 60000); 
    return () => clearInterval(interval);
  }, [user, policy, logout]);

  const value = {
    user,
    loading,
    liveStatuses,
    idleThreshold,
    status,
    setStatus,
    policy,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
