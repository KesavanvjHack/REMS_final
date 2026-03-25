import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const useIdleDetection = (idleTimeMinutes = 15) => {
  const { status, policy } = useContext(AuthContext);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef(null);
  const isIdleRef = useRef(false);

  // Helper to check if we are within the allowed work window
  const isWithinWorkWindow = useCallback(() => {
    if (!policy?.shift_start_time || !policy?.shift_end_time) return true;
    
    const now = new Date();
    const [startH, startM] = policy.shift_start_time.split(':').map(Number);
    const [endH, endM] = policy.shift_end_time.split(':').map(Number);
    
    const start = new Date();
    start.setHours(startH, startM, 0, 0);
    
    const end = new Date();
    end.setHours(endH, endM, 0, 0);
    
    return now >= start && now <= end;
  }, [policy]);

  const handleIdleStart = useCallback(async () => {
    if (isIdleRef.current) return; // already idle, don't double-fire
    isIdleRef.current = true;
    setIsIdle(true);
    try {
      await api.post('/sessions/idle/', { action: 'start' });
    } catch (err) {
      console.error('Failed to start idle log', err);
    }
  }, []);

  const handleIdleStop = useCallback(async () => {
    if (!isIdleRef.current) return; // not idle, nothing to stop
    isIdleRef.current = false;
    setIsIdle(false);
    try {
      await api.post('/sessions/idle/', { action: 'stop' });
    } catch (err) {
      console.error('Failed to stop idle log', err);
    }
  }, []);

  const resetTimer = useCallback(() => {
    // If currently idle, resume activity
    if (isIdleRef.current) {
      handleIdleStop();
    }
    
    clearTimeout(idleTimeoutRef.current);

    // ONLY detect idle if user is working AND within work window
    if (status === 'working' && isWithinWorkWindow()) {
      idleTimeoutRef.current = setTimeout(handleIdleStart, idleTimeMinutes * 60 * 1000);
    } else if (isIdleRef.current && !isWithinWorkWindow()) {
      // If idle but shift ended, force stop idle
      handleIdleStop();
    }
  }, [idleTimeMinutes, handleIdleStart, handleIdleStop, status, isWithinWorkWindow]);

  useEffect(() => {
    // 1. Sync initial state from backend
    api.get('/status/me/')
      .then(res => {
        if (res.data.status === 'idle') {
          isIdleRef.current = true;
          setIsIdle(true);
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

  return isIdle;
};

export default useIdleDetection;
