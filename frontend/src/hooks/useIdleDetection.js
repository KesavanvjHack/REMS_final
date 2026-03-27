import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const useIdleDetection = (idleTimeMinutes = 15) => {
  const { status, policy, refreshActivity } = useContext(AuthContext);
  const [isIdle, setIsIdle] = useState(false);
  const [idleStartTime, setIdleStartTime] = useState(null);
  const idleTimeoutRef = useRef(null);
  const isIdleRef = useRef(false);

  // Helper to check if we are within the allowed work window
  const isWithinWorkWindow = useCallback(() => {
    if (!policy?.shift_start_time || !policy?.shift_end_time) return true;
    
    const now = new Date();
    const [startH, startM] = policy.shift_start_time.split(':').map(Number);
    const [endH, endM] = policy.shift_end_time.split(':').map(Number);
    
    // Create dates for today with shift times
    const start = new Date(now.getTime());
    start.setHours(startH, startM, 0, 0);
    
    const end = new Date(now.getTime());
    end.setHours(endH, endM, 0, 0);
    
    // Safety check: if end time is before start time (night shift), 
    // we might need more complex logic, but for standard shifts:
    return now >= start && now <= end;
  }, [policy]);

  const handleIdleStart = useCallback(async () => {
    if (isIdleRef.current) return; // already idle, don't double-fire
    isIdleRef.current = true;
    setIsIdle(true);
    setIdleStartTime(Date.now());
    try {
      await api.post('/sessions/idle/', { action: 'start' });
    } catch (err) {
      console.error('Failed to start idle log', err);
    }
  }, []);

  const resetTimer = useCallback(() => {
    // Refresh session activity timestamp in AuthContext (keeps session alive)
    refreshActivity();

    // ONLY clear/set idle timeout if NOT currently idle.
    // If the user is already idle, we strictly wait for the button click to stop it.
    if (!isIdleRef.current) {
      clearTimeout(idleTimeoutRef.current);

      // ONLY detect idle if user is working AND within work window
      if (status === 'working' && isWithinWorkWindow()) {
        idleTimeoutRef.current = setTimeout(handleIdleStart, idleTimeMinutes * 60 * 1000);
      }
    } else {
      // If we are currently idle and user is moving/typing, 
      // they remain idle in the system until they click the button.
      // We don't set a new timeout here because handleIdleStart is already fired.
    }
  }, [idleTimeMinutes, handleIdleStart, status, isWithinWorkWindow, refreshActivity]);

  const handleIdleStop = useCallback(async () => {
    if (!isIdleRef.current) return; // not idle, nothing to stop
    isIdleRef.current = false;
    setIsIdle(false);
    setIdleStartTime(null);
    try {
      await api.post('/sessions/idle/', { action: 'stop' });
      // Restart the idle timer now that we've resumed
      resetTimer();
    } catch (err) {
      console.error('Failed to stop idle log', err);
    }
  }, [resetTimer]);

  useEffect(() => {
    // 1. Sync initial state from backend
    api.get('/status/me/')
      .then(res => {
        if (res.data.status === 'idle') {
          isIdleRef.current = true;
          setIsIdle(true);
          // For initial sync, we don't have exact start time, so we'll approximate 
          // or just show it from now. Ideally backend should provide start_time.
          setIdleStartTime(Date.now()); 
        }
      })
      .catch(err => {
        console.error('Failed to sync initial idle state', err);
      });

    // 2. Setup event listeners
    const events = [
      'mousemove',
      'keydown',
      'wheel',
      'DOMMouseScroll',
      'mouseWheel',
      'mousedown',
      'touchstart',
      'touchmove',
      'MSPointerDown',
      'MSPointerMove',
    ];

    events.forEach((event) => {
      document.addEventListener(event, resetTimer, false);
    });

    // Kick off the initial countdown
    resetTimer();

    // Expose mock function for testing
    window.__idleTest = () => {
      clearTimeout(idleTimeoutRef.current);
      handleIdleStart();
    };

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer, false);
      });
      clearTimeout(idleTimeoutRef.current);
    };
  }, [resetTimer, handleIdleStart]); // stable refs — won't loop

  return { isIdle, idleStartTime, handleIdleStop };
};

export default useIdleDetection;
