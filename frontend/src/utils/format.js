/**
 * Standard utility for formatting attendance durations across all roles.
 * Returns a human-readable string like "8h 30m" or "0h 45m".
 */
export const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return '0h 0m';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

/**
 * Standard utility for formatting work hours as a decimal (e.g., 8.50).
 */
export const formatDecimalHours = (seconds) => {
  if (!seconds || seconds < 0) return '0.00';
  return (seconds / 3600).toFixed(2);
};

/**
 * Safe date formatter for last logout.
 */
export const formatLastLogout = (isoString) => {
  if (!isoString) return '--:--:--';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '--:--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  } catch (e) {
    return '--:--:--';
  }
};
