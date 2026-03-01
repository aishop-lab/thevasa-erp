/**
 * Date formatting and range utilities using date-fns.
 */

import {
  format as dateFnsFormat,
  formatDistanceToNow,
  parseISO,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  isValid,
} from "date-fns";

export type DatePeriod = "today" | "week" | "month" | "quarter" | "year";

/**
 * Safely coerce a string or Date into a Date object.
 */
function toDate(date: string | Date): Date {
  if (date instanceof Date) {
    return date;
  }
  const parsed = parseISO(date);
  if (!isValid(parsed)) {
    throw new Error(`Invalid date string: ${date}`);
  }
  return parsed;
}

/**
 * Format a date using a date-fns format string.
 *
 * @param date - ISO string or Date object.
 * @param formatStr - A date-fns format pattern (defaults to "dd MMM yyyy").
 * @returns Formatted date string, e.g. "25 Feb 2026".
 */
export function formatDate(
  date: string | Date,
  formatStr: string = "dd MMM yyyy"
): string {
  return dateFnsFormat(toDate(date), formatStr);
}

/**
 * Format a date as a human-readable relative string.
 *
 * @param date - ISO string or Date object.
 * @returns Relative time string, e.g. "2 hours ago", "3 days ago".
 */
export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

/**
 * Get the start and end dates for a named period, relative to now.
 *
 * @param period - One of "today", "week", "month", "quarter", "year".
 * @returns Object with `start` and `end` Date values.
 */
export function getDateRange(period: DatePeriod): {
  start: Date;
  end: Date;
} {
  const now = new Date();

  switch (period) {
    case "today":
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case "quarter":
      return {
        start: startOfQuarter(now),
        end: endOfQuarter(now),
      };
    case "year":
      return {
        start: startOfYear(now),
        end: endOfYear(now),
      };
    default: {
      // Exhaustive check
      const _exhaustive: never = period;
      throw new Error(`Unknown period: ${_exhaustive}`);
    }
  }
}
