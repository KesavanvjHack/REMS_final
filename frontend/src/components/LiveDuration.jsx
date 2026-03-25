import React, { useState, useEffect } from 'react';

const LiveDuration = ({ initialSeconds, status, type, isToday, className = '' }) => {
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    setTicks(Math.floor((initialSeconds || 0) * 10));
  }, [initialSeconds]);

  useEffect(() => {
    if (!isToday) return;

    let isActive = false;
    const s = status?.toLowerCase();
    if (type === 'work' && s === 'working') isActive = true;
    if (type === 'break' && s === 'on_break') isActive = true;
    if (type === 'idle' && s === 'idle') isActive = true;

    if (!isActive) return;

    const interval = setInterval(() => {
      setTicks(prev => prev + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [status, type, isToday]);

  const totalS = Math.floor(ticks / 10);
  
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);

  const format2 = (num) => num.toString().padStart(2, '0');

  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {format2(h)}:{format2(m)}:{format2(s)}
    </span>
  );
};

export default LiveDuration;
