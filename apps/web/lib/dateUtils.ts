/**
 * Date and Time Utilities
 *
 * Centralized date/time handling for the entire application.
 * All dates are displayed in Pacific Time (America/Los_Angeles).
 */

import { format, parseISO, startOfDay, subDays, startOfMonth } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

// Pacific Time Zone (handles PST/PDT automatically)
export const TIMEZONE = 'America/Los_Angeles';

/**
 * Format a date for display in Pacific Time
 * @param date - Date string, Date object, or null
 * @param formatString - date-fns format string (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted date string in Pacific Time, or '-' if date is null/undefined
 */
export function formatDatePT(
  date: string | Date | null | undefined,
  formatString: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '-';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, TIMEZONE, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
}

/**
 * Format a date for display (date only, no time) in Pacific Time
 * @param date - Date string, Date object, or null
 * @returns Formatted date string in Pacific Time (e.g., "Oct 17, 2025")
 */
export function formatDateOnlyPT(date: string | Date | null | undefined): string {
  return formatDatePT(date, 'MMM d, yyyy');
}

/**
 * Format a date for display (full date and time) in Pacific Time
 * @param date - Date string, Date object, or null
 * @returns Formatted date string in Pacific Time (e.g., "Oct 17, 2025 3:45 PM")
 */
export function formatDateTimePT(date: string | Date | null | undefined): string {
  return formatDatePT(date, 'MMM d, yyyy h:mm a');
}

/**
 * Get the current date/time in Pacific Time
 * @returns Date object representing current time in Pacific Time
 */
export function nowPT(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Get today's date at midnight in Pacific Time
 * @returns Date object for start of today in Pacific Time
 */
export function todayPT(): Date {
  return startOfDay(toZonedTime(new Date(), TIMEZONE));
}

/**
 * Convert a date input (YYYY-MM-DD string) to start of day in Pacific Time, then to ISO string
 * Used for API queries to ensure consistent timezone handling
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string representing start of day in Pacific Time
 */
export function dateInputToStartOfDayISO(dateString: string): string {
  // Create a date object from the string, treating it as Pacific Time
  // We need to interpret "2025-10-17" as "2025-10-17 00:00:00 Pacific Time"
  const dateTimeString = `${dateString}T00:00:00`;
  // fromZonedTime takes a local time and timezone, returns UTC Date
  const utcDate = fromZonedTime(dateTimeString, TIMEZONE);
  return utcDate.toISOString();
}

/**
 * Convert a date input (YYYY-MM-DD string) to end of day in Pacific Time, then to ISO string
 * Used for API queries to ensure consistent timezone handling
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns ISO string representing end of day in Pacific Time
 */
export function dateInputToEndOfDayISO(dateString: string): string {
  // Create a date object from the string, treating it as Pacific Time
  // We need to interpret "2025-10-17" as "2025-10-17 23:59:59.999 Pacific Time"
  const dateTimeString = `${dateString}T23:59:59.999`;
  // fromZonedTime takes a local time and timezone, returns UTC Date
  const utcDate = fromZonedTime(dateTimeString, TIMEZONE);
  return utcDate.toISOString();
}

/**
 * Get date range for "today" in Pacific Time
 * @returns Object with startDate and endDate in YYYY-MM-DD format (Pacific Time)
 */
export function getTodayRangePT(): { startDate: string; endDate: string } {
  const today = toZonedTime(new Date(), TIMEZONE);
  const formatted = format(today, 'yyyy-MM-dd');
  return { startDate: formatted, endDate: formatted };
}

/**
 * Get date range for "last 7 days" in Pacific Time
 * @returns Object with startDate and endDate in YYYY-MM-DD format (Pacific Time)
 */
export function getLastSevenDaysRangePT(): { startDate: string; endDate: string } {
  const today = toZonedTime(new Date(), TIMEZONE);
  const sevenDaysAgo = subDays(today, 6); // 6 days ago + today = 7 days
  return {
    startDate: format(sevenDaysAgo, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };
}

/**
 * Get date range for "this month" in Pacific Time
 * @returns Object with startDate and endDate in YYYY-MM-DD format (Pacific Time)
 */
export function getThisMonthRangePT(): { startDate: string; endDate: string } {
  const today = toZonedTime(new Date(), TIMEZONE);
  const firstDayOfMonth = startOfMonth(today);
  return {
    startDate: format(firstDayOfMonth, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };
}

/**
 * Get the current date in YYYY-MM-DD format (Pacific Time)
 * @returns Date string in YYYY-MM-DD format
 */
export function getCurrentDatePT(): string {
  return format(toZonedTime(new Date(), TIMEZONE), 'yyyy-MM-dd');
}

/**
 * Format a date for HTML date input (YYYY-MM-DD) in Pacific Time
 * @param date - Date string, Date object, or null
 * @returns Date string in YYYY-MM-DD format for HTML date inputs
 */
export function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const ptDate = toZonedTime(dateObj, TIMEZONE);
    return format(ptDate, 'yyyy-MM-dd');
  } catch (error) {
    console.error('Error converting to date input value:', error);
    return '';
  }
}
