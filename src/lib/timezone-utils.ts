/**
 * Timezone Utility Functions for Philippines (Asia/Manila)
 * Provides consistent local timezone formatting throughout the application
 */

export const PHILIPPINES_TIMEZONE = 'Asia/Manila';
export const PHILIPPINES_LOCALE = 'en-PH';

/**
 * Format a Date object or timestamp to Philippines local time
 */
export function formatPhilippinesTime(date: Date | number, options: Intl.DateTimeFormatOptions = {}): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: PHILIPPINES_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };

  const mergedOptions = { ...defaultOptions, ...options };
  
  if (typeof date === 'number') {
    return new Date(date).toLocaleString(PHILIPPINES_LOCALE, mergedOptions);
  }
  
  return date.toLocaleString(PHILIPPINES_LOCALE, mergedOptions);
}

/**
 * Format a timestamp to Philippines date only (YYYY-MM-DD)
 */
export function formatPhilippinesDate(date: Date | number): string {
  return formatPhilippinesTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  }).split(',')[0];
}

/**
 * Get current Philippines time as formatted string
 */
export function getCurrentPhilippinesTime(): string {
  return formatPhilippinesTime(new Date());
}

/**
 * Get current Philippines date in YYYY-MM-DD format (compatible with en-CA locale)
 */
export function getCurrentPhilippinesDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: PHILIPPINES_TIMEZONE });
}

/**
 * Convert UTC timestamp to Philippines local time
 */
export function utcToPhilippinesTime(utcTimestamp: string | number): string {
  const date = typeof utcTimestamp === 'string' ? new Date(utcTimestamp) : new Date(utcTimestamp);
  return formatPhilippinesTime(date);
} 