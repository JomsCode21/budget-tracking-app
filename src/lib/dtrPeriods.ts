import { MONTH_NAMES } from './dates';

export type DtrPeriod = {
  start: string;
  end: string;
};

function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthDay(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function dtrPeriodForDate(date: string): DtrPeriod {
  const { year, month, day } = monthDay(date);
  if (day >= 4 && day <= 18) {
    return { start: isoDate(year, month, 4), end: isoDate(year, month, 18) };
  }
  if (day >= 19) {
    return { start: isoDate(year, month, 19), end: isoDate(year, month + 1, 3) };
  }
  return { start: isoDate(year, month - 1, 19), end: isoDate(year, month, 3) };
}

export function shiftDtrPeriod(period: DtrPeriod, direction: -1 | 1): DtrPeriod {
  const { year, month, day } = monthDay(period.start);
  if (day === 4) {
    return direction > 0
      ? { start: isoDate(year, month, 19), end: isoDate(year, month + 1, 3) }
      : { start: isoDate(year, month - 1, 19), end: isoDate(year, month, 3) };
  }
  return direction > 0
    ? { start: isoDate(year, month + 1, 4), end: isoDate(year, month + 1, 18) }
    : { start: isoDate(year, month, 4), end: isoDate(year, month, 18) };
}

export function formatDtrPeriod(period: DtrPeriod): string {
  const start = monthDay(period.start);
  const end = monthDay(period.end);
  const startLabel = `${MONTH_NAMES[start.month - 1].slice(0, 3)} ${start.day}`;
  const endLabel = `${MONTH_NAMES[end.month - 1].slice(0, 3)} ${end.day}`;
  return start.year === end.year
    ? `${startLabel} – ${endLabel}, ${end.year}`
    : `${startLabel}, ${start.year} – ${endLabel}, ${end.year}`;
}
