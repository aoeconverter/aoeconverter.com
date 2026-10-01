// Anywhere on Earth (AoE) is a fixed UTC−12 offset with no daylight saving,
// so every AoE calculation here is plain arithmetic on epoch milliseconds.

export const AOE_OFFSET_MS = -12 * 3600_000;
const DAY_MS = 86_400_000;

export interface Parts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

export interface YMD {
  year: number;
  month: number;
  day: number;
}

export interface HMS {
  hour: number;
  minute: number;
  second: number;
}

export function aoeParts(epoch: number): Parts {
  const d = new Date(epoch + AOE_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
}

export function parseDate(input: string | null | undefined): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((input ?? '').trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Accepts "HH:MM" or "HH:MM:SS". Empty input means the 23:59 convention. */
export function parseTime(input: string | null | undefined): HMS | null {
  const raw = (input ?? '').trim();
  if (!raw) return { hour: 23, minute: 59, second: 0 };
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] ? Number(m[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

/** Wall-clock AoE date + time → epoch ms. */
export function aoeToEpoch(date: YMD, time: HMS): number {
  return Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second) - AOE_OFFSET_MS;
}

/** Parse a "YYYY-MM-DD" + optional "HH:MM[:SS]" AoE deadline into epoch ms. */
export function deadlineEpoch(date: string, time?: string | null): number | null {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  return aoeToEpoch(d, t);
}

/** The instant the given calendar date ends everywhere on Earth (00:00 the next day in AoE). */
export function endOfDateAnywhere(date: YMD): number {
  return aoeToEpoch(date, { hour: 0, minute: 0, second: 0 }) + DAY_MS;
}

/** The instant the given calendar date begins somewhere on Earth (00:00 in UTC+14, Line Islands). */
export function startOfDateAnywhere(date: YMD): number {
  return Date.UTC(date.year, date.month - 1, date.day) - 14 * 3600_000;
}

export type StillStatus =
  | { state: 'not-yet'; startsIn: number }
  | { state: 'yes'; remaining: number }
  | { state: 'no'; endedAgo: number };

export function isStillAnywhere(date: YMD, now: number): StillStatus {
  const start = startOfDateAnywhere(date);
  const end = endOfDateAnywhere(date);
  if (now < start) return { state: 'not-yet', startsIn: start - now };
  if (now < end) return { state: 'yes', remaining: end - now };
  return { state: 'no', endedAgo: now - end };
}

/** Fraction (0–1) of the current AoE day that has elapsed. */
export function aoeDayProgress(epoch: number): number {
  const shifted = epoch + AOE_OFFSET_MS;
  return (((shifted % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS;
}

export function todayAoE(epoch: number): YMD {
  const p = aoeParts(epoch);
  return { year: p.year, month: p.month, day: p.day };
}

export interface Duration {
  negative: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Split a millisecond span into whole units, flooring toward zero at the second. */
export function splitDuration(ms: number): Duration {
  const negative = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { negative, days, hours, minutes, seconds: s - minutes * 60 };
}

/** Like splitDuration, but rounds a remaining span up so a countdown hits 0 exactly at the deadline. */
export function remainingDuration(ms: number): Duration {
  return splitDuration(ms > 0 ? Math.ceil(ms / 1000) * 1000 : ms);
}

export const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function ymdString(d: YMD): string {
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

/** Offset of a named IANA zone from UTC at a given instant, in ms. */
export function zoneOffset(epoch: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(epoch)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - Math.floor(epoch / 1000) * 1000;
}

/** Wall-clock time in an IANA zone (or "AoE") → epoch ms. Handles DST by re-checking the offset. */
export function zonedToEpoch(date: YMD, time: HMS, timeZone: string): number {
  if (timeZone === 'AoE') return aoeToEpoch(date, time);
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
  let epoch = wall - zoneOffset(wall, timeZone);
  const second = wall - zoneOffset(epoch, timeZone);
  if (second !== epoch) epoch = second;
  return epoch;
}

export function formatOffset(ms: number): string {
  const sign = ms < 0 ? '−' : '+';
  const abs = Math.abs(ms) / 60_000;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? ':' + pad(m) : ''}`;
}
