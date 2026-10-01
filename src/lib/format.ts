import { pad, splitDuration, remainingDuration, type Duration } from './aoe';

/** "12d 04:33:10" or "04:33:10" */
export function clockDuration(d: Duration): string {
  const hms = `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
  return d.days ? `${d.days}d ${hms}` : hms;
}

/** "5h 12m", "3 days 4h", "42s" — coarse wording for sentences and badges. */
export function humanDuration(ms: number): string {
  const d = splitDuration(ms);
  if (d.days >= 2) return `${d.days} days${d.hours ? ` ${d.hours}h` : ''}`;
  if (d.days === 1) return `1 day${d.hours ? ` ${d.hours}h` : ''}`;
  if (d.hours) return `${d.hours}h${d.minutes ? ` ${d.minutes}m` : ''}`;
  if (d.minutes) return `${d.minutes}m${d.seconds ? ` ${d.seconds}s` : ''}`;
  return `${d.seconds}s`;
}

export function countdownText(remainingMs: number): string {
  return clockDuration(remainingDuration(remainingMs));
}

export function formatInZone(epoch: number, timeZone: string | undefined, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(epoch);
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DeadlineSpec {
  date: string;
  time?: string;
  name?: string;
}

export function deadlinePath({ date, time, name }: DeadlineSpec): string {
  const q = new URLSearchParams();
  if (time && time !== '23:59') q.set('t', time);
  if (name) q.set('name', name);
  const qs = q.toString();
  return `/d/${date}${qs ? '?' + qs : ''}`;
}

export function badgePath({ date, time, name }: DeadlineSpec): string {
  const q = new URLSearchParams();
  if (time && time !== '23:59') q.set('t', time);
  if (name) q.set('label', name);
  const qs = q.toString();
  return `/badge/${date}.svg${qs ? '?' + qs : ''}`;
}
