import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const useIdleDetection = (idleTimeMinutes = 15) => {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef(null);

  const handleIdleStart = async () => {
    setIsIdle(true);
    try {
      await api.post('/sessions/idle/', { action: 'start' });
    } catch (err) {
      console.error('Failed to start idle log', err);
    }
  };

  const handleIdleStop = async () => {
    setIsIdle(false);
    try {
      await api.post('/sessions/idle/', { action: 'stop' });
    } catch (err) {
      console.error('Failed to stop idle log', err);
    }
  };

  const resetTimer = () => {
    if (isIdle) {
      handleIdleStop();
    }
    clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(
      handleIdleStart,
      idleTimeMinutes * 60 * 1000
    );
  };

  useEffect(() => {
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

    const handleEvent = () => resetTimer();

    // Attach event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleEvent, false);
    });

    // Initial start
    resetTimer();

    // Expose mock function for testing
    window.__idleTest = () => {
      clearTimeout(idleTimeoutRef.current);
      handleIdleStart();
    };

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleEvent, false);
      });
      clearTimeout(idleTimeoutRef.current);
    };
  }, [idleTimeMinutes, isIdle]);

  return isIdle;
};

export default useIdleDetection;
