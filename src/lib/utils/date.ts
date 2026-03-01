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
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  differenceInDays,
  differenceInHours,
  addDays,
  addWeeks,
  addMonths,
  isValid,
  isSameDay,
} from "date-fns";

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type DatePeriod = "today" | "week" | "month" | "quarter" | "year";

export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days";

export type Granularity = "hourly" | "daily" | "weekly" | "monthly";

export interface DateRange {
  from: Date;
  to: Date;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

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

export function formatDate(
  date: string | Date,
  formatStr: string = "dd MMM yyyy"
): string {
  return dateFnsFormat(toDate(date), formatStr);
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(toDate(date), { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Legacy getDateRange (kept for backward compat)
// ---------------------------------------------------------------------------

export function getDateRange(period: DatePeriod): {
  start: Date;
  end: Date;
} {
  const now = new Date();

  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    default: {
      const _exhaustive: never = period;
      throw new Error(`Unknown period: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Preset date ranges
// ---------------------------------------------------------------------------

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
];

export function getPresetDateRange(preset: DatePreset): DateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this_week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfDay(now),
      };
    case "last_week": {
      const prev = subWeeks(now, 1);
      return {
        from: startOfWeek(prev, { weekStartsOn: 1 }),
        to: endOfWeek(prev, { weekStartsOn: 1 }),
      };
    }
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "last_month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "this_quarter":
      return { from: startOfQuarter(now), to: endOfDay(now) };
    case "last_quarter": {
      const prev = subQuarters(now, 1);
      return { from: startOfQuarter(prev), to: endOfQuarter(prev) };
    }
    case "this_year":
      return { from: startOfYear(now), to: endOfDay(now) };
    case "last_year": {
      const prev = subYears(now, 1);
      return { from: startOfYear(prev), to: endOfYear(prev) };
    }
    case "last_7_days":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last_30_days":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "last_90_days":
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    default: {
      const _exhaustive: never = preset;
      throw new Error(`Unknown preset: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Comparison period
// ---------------------------------------------------------------------------

export function getPreviousPeriod(from: Date, to: Date): DateRange {
  const days = differenceInDays(to, from) + 1;
  return {
    from: startOfDay(subDays(from, days)),
    to: endOfDay(subDays(from, 1)),
  };
}

// ---------------------------------------------------------------------------
// Auto granularity
// ---------------------------------------------------------------------------

export function autoGranularity(from: Date, to: Date): Granularity {
  const days = differenceInDays(to, from);
  if (days <= 1) return "hourly";
  if (days <= 90) return "daily";
  return "monthly";
}

// ---------------------------------------------------------------------------
// Bucket generation
// ---------------------------------------------------------------------------

export function bucketDates(
  from: Date,
  to: Date,
  granularity: Granularity
): Date[] {
  const buckets: Date[] = [];
  let current = startOfDay(from);
  const end = startOfDay(to);

  switch (granularity) {
    case "hourly": {
      const hours = differenceInHours(to, from) + 1;
      for (let i = 0; i < hours && i < 48; i++) {
        buckets.push(new Date(from.getTime() + i * 60 * 60 * 1000));
      }
      return buckets;
    }
    case "daily":
      while (current <= end) {
        buckets.push(new Date(current));
        current = addDays(current, 1);
      }
      return buckets;
    case "weekly":
      current = startOfWeek(from, { weekStartsOn: 1 });
      while (current <= end) {
        buckets.push(new Date(current));
        current = addWeeks(current, 1);
      }
      return buckets;
    case "monthly":
      current = startOfMonth(from);
      while (current <= end) {
        buckets.push(new Date(current));
        current = addMonths(current, 1);
      }
      return buckets;
  }
}

// ---------------------------------------------------------------------------
// Bucket label formatting
// ---------------------------------------------------------------------------

export function formatBucketLabel(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case "hourly":
      return dateFnsFormat(date, "ha");
    case "daily":
      return dateFnsFormat(date, "dd MMM");
    case "weekly":
      return `W${dateFnsFormat(date, "w")} ${dateFnsFormat(date, "dd MMM")}`;
    case "monthly":
      return dateFnsFormat(date, "MMM yyyy");
  }
}

// ---------------------------------------------------------------------------
// Date key for bucketing data
// ---------------------------------------------------------------------------

export function dateToBucketKey(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case "hourly":
      return dateFnsFormat(date, "yyyy-MM-dd-HH");
    case "daily":
      return dateFnsFormat(date, "yyyy-MM-dd");
    case "weekly":
      return dateFnsFormat(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "monthly":
      return dateFnsFormat(date, "yyyy-MM");
  }
}

// ---------------------------------------------------------------------------
// Format range for display
// ---------------------------------------------------------------------------

export function formatDateRange(from: Date, to: Date): string {
  if (isSameDay(from, to)) {
    return dateFnsFormat(from, "dd MMM yyyy");
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${dateFnsFormat(from, "dd MMM")} - ${dateFnsFormat(to, "dd MMM yyyy")}`;
  }
  return `${dateFnsFormat(from, "dd MMM yyyy")} - ${dateFnsFormat(to, "dd MMM yyyy")}`;
}
