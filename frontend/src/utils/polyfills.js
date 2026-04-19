if (typeof window !== 'undefined') {
  window.global = window;
  window.process = {
    env: { NODE_ENV: 'development' },
    platform: 'browser',
    nextTick: (callback) => setTimeout(callback, 0)
  };
}
export {};
