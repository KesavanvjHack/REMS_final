import { createContext, useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatuses, setLiveStatuses] = useState({});
  const wsRef = useRef(null);

  useEffect(() => {
    checkUserStatus();
    return () => disconnectWebSocket();
  }, []);

  const fetchInitialStatuses = async (role) => {
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
  };

  const checkUserStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Token expired?
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          // Fetch full user profile
          const res = await api.get('/auth/me/');
          setUser(res.data);
          fetchInitialStatuses(res.data.role);
          connectWebSocket();
        }
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  };

  const login = async (email, password, otp) => {
    try {
      const res = await api.post('/auth/login/', { email, password, otp });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      setUser(res.data.user);
      
      const role = res.data.user.role;
      toast.success('Login Successful');
      fetchInitialStatuses(role);
      connectWebSocket();
      
      // Return role to redirect appropriately
      return role; 
    } catch (error) {
      const msg = error.response?.data?.detail || 'Invalid credentials';
      toast.error(msg);
      throw error;
    }
  };

  const logout = async () => {
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
  };

  const connectWebSocket = () => {
    if (wsRef.current) return;
    try {
      // Connecting to the Django Channels WebSocket endpoint
      const ws = new WebSocket('ws://localhost:8000/ws/status/');
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
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const value = {
    user,
    loading,
    liveStatuses,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
