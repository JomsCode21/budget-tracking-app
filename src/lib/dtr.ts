import { DtrEntry, DtrSettings } from '../types';

const pad = (value: number) => String(value).padStart(2, '0');

export function localTimestamp(date: string, time: string, dayOffset = 0): string | null {
  if (!isValidDate(date) || !isValidTime(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day + dayOffset, hour, minute).toISOString();
}

export function localTime(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function elapsedMinutes(entry: DtrEntry, settings?: DtrSettings, now = new Date()): number {
  const actualStart = new Date(entry.clock_in_at).getTime();
  const actualEnd = entry.clock_out_at
    ? new Date(entry.clock_out_at).getTime()
    : entry.break_started_at
      ? new Date(entry.break_started_at).getTime()
      : now.getTime();
  if (!Number.isFinite(actualStart) || !Number.isFinite(actualEnd) || actualEnd < actualStart) return 0;
  let start = actualStart;
  let end = actualEnd;
  if (settings?.standard_start) {
    const scheduledStart = localTimestamp(entry.work_date, settings.standard_start.slice(0, 5));
    if (scheduledStart) start = Math.max(start, new Date(scheduledStart).getTime());
  }
  if (settings?.overtime_end && settings.standard_start && settings.standard_end) {
    const cutoff = overtimeEndTimestamp(entry, settings);
    if (cutoff) end = Math.min(end, new Date(cutoff).getTime());
  }
  const scheduledBreak = settings ? scheduledBreakOverlap(entry, settings, start, end) : 0;
  return Math.max(0, Math.floor((end - start) / 60000) - Math.max(entry.break_minutes, scheduledBreak));
}

export function regularWorkMinutes(entry: DtrEntry, settings: DtrSettings, now = new Date()): number {
  if (!settings.standard_start || !settings.standard_end) return elapsedMinutes(entry, settings, now);
  const actualStart = new Date(entry.clock_in_at).getTime();
  const actualEnd = entry.clock_out_at
    ? new Date(entry.clock_out_at).getTime()
    : entry.break_started_at
      ? new Date(entry.break_started_at).getTime()
      : now.getTime();
  const scheduledStart = localTimestamp(entry.work_date, settings.standard_start.slice(0, 5));
  const scheduledEnd = scheduledEndTimestamp(entry, settings);
  if (!Number.isFinite(actualStart) || !Number.isFinite(actualEnd) || !scheduledStart || !scheduledEnd) return 0;
  const start = Math.max(actualStart, new Date(scheduledStart).getTime());
  const end = Math.min(actualEnd, new Date(scheduledEnd).getTime());
  if (end <= start) return 0;
  const scheduledBreak = scheduledBreakOverlap(entry, settings, start, end);
  return Math.max(0, Math.floor((end - start) / 60000) - Math.max(entry.break_minutes, scheduledBreak));
}

export function scheduledWorkMinutes(settings: DtrSettings): number | null {
  if (!settings.standard_start || !settings.standard_end) return null;
  const start = timeOfDay(settings.standard_start);
  const end = timeOfDay(settings.standard_end);
  if (start === null || end === null) return null;
  const shift = (end >= start ? end - start : end + 24 * 60 - start) -
    settings.scheduled_break_minutes;
  return shift > 0 ? shift : null;
}

export function overtimeMinutes(entry: DtrEntry, settings: DtrSettings, now = new Date()): number {
  if (!settings.standard_start || !settings.standard_end || !settings.overtime_end) return 0;
  const scheduledEnd = scheduledEndTimestamp(entry, settings);
  const overtimeEnd = overtimeEndTimestamp(entry, settings);
  if (!scheduledEnd || !overtimeEnd) return 0;
  const actualEnd = entry.clock_out_at
    ? new Date(entry.clock_out_at)
    : entry.break_started_at
      ? new Date(entry.break_started_at)
      : now;
  const cappedEnd = Math.min(actualEnd.getTime(), new Date(overtimeEnd).getTime());
  const minutesAfterShift = Math.floor(
    (cappedEnd - new Date(scheduledEnd).getTime()) / 60000,
  );
  return Math.max(0, minutesAfterShift);
}

export function creditedOvertimeMinutes(entry: DtrEntry, settings: DtrSettings, now = new Date()): number {
  return entry.overtime_minutes ?? overtimeMinutes(entry, settings, now);
}

export function maximumOvertimeMinutes(settings: DtrSettings): number | null {
  if (!settings.standard_end || !settings.overtime_end) return null;
  const shiftEnd = timeOfDay(settings.standard_end);
  const overtimeEnd = timeOfDay(settings.overtime_end);
  if (shiftEnd === null || overtimeEnd === null || overtimeEnd <= shiftEnd) return null;
  return overtimeEnd - shiftEnd;
}

export function lateMinutes(entry: DtrEntry, settings: DtrSettings): number {
  if (!settings.standard_start) return 0;
  const scheduled = timeOfDay(settings.standard_start);
  const actual = timeOfDay(localTime(entry.clock_in_at));
  if (scheduled === null || actual === null) return 0;
  return Math.max(0, actual - scheduled - settings.grace_period_minutes);
}

export function undertimeMinutes(entry: DtrEntry, settings: DtrSettings, now = new Date()): number {
  if (!entry.clock_out_at) return 0;
  const scheduled = scheduledWorkMinutes(settings);
  if (scheduled === null) return 0;
  return Math.max(0, scheduled - elapsedMinutes(entry, settings, now));
}

function scheduledEndTimestamp(entry: DtrEntry, settings: DtrSettings): string | null {
  if (!settings.standard_start || !settings.standard_end) return null;
  const start = timeOfDay(settings.standard_start);
  const end = timeOfDay(settings.standard_end);
  if (start === null || end === null) return null;
  return localTimestamp(entry.work_date, settings.standard_end.slice(0, 5), end <= start ? 1 : 0);
}

function overtimeEndTimestamp(entry: DtrEntry, settings: DtrSettings): string | null {
  if (!settings.standard_start || !settings.standard_end || !settings.overtime_end) return null;
  const start = timeOfDay(settings.standard_start);
  const end = timeOfDay(settings.standard_end);
  if (start === null || end === null) return null;
  return localTimestamp(entry.work_date, settings.overtime_end.slice(0, 5), end <= start ? 1 : 0);
}

function scheduledBreakOverlap(
  entry: DtrEntry,
  settings: DtrSettings,
  start: number,
  end: number,
): number {
  if (!settings.standard_start || !settings.scheduled_break_start || !settings.scheduled_break_end) return 0;
  const shiftStart = timeOfDay(settings.standard_start);
  const breakStart = timeOfDay(settings.scheduled_break_start);
  const breakEnd = timeOfDay(settings.scheduled_break_end);
  if (shiftStart === null || breakStart === null || breakEnd === null) return 0;
  const breakStartOffset = breakStart < shiftStart ? 1 : 0;
  const breakEndOffset = breakEnd <= breakStart ? breakStartOffset + 1 : breakStartOffset;
  const startAt = localTimestamp(entry.work_date, settings.scheduled_break_start.slice(0, 5), breakStartOffset);
  const endAt = localTimestamp(entry.work_date, settings.scheduled_break_end.slice(0, 5), breakEndOffset);
  if (!startAt || !endAt) return 0;
  const overlap = Math.min(end, new Date(endAt).getTime()) - Math.max(start, new Date(startAt).getTime());
  return Math.max(0, Math.floor(overlap / 60000));
}

function timeOfDay(value: string): number | null {
  if (!/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return null;
  const time = value.slice(0, 5);
  if (!isValidTime(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}
