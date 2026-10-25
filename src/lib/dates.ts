export function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// m is 0-11
export function monthStart(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export function nextMonth(y: number, m: number) {
  return m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
}

export function prevMonth(y: number, m: number) {
  return m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Next due date after `date`. Monthly rules keep their original day
// (e.g. the 31st becomes the 30th or 28th in shorter months).
export function nextOccurrence(date: string, frequency: 'weekly' | 'monthly', anchorDay: number): string {
  const [y, m, d] = date.split('-').map(Number);
  if (frequency === 'weekly') {
    const t = new Date(Date.UTC(y, m - 1, d + 7));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const daysInMonth = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, daysInMonth))}`;
}