import { describe, expect, it } from 'vitest';
import {
  aoeParts,
  aoeDayProgress,
  deadlineEpoch,
  isStillAnywhere,
  parseDate,
  parseTime,
  remainingDuration,
  splitDuration,
  zonedToEpoch,
  formatOffset,
} from '../src/lib/aoe';
import { bestOffset, TimeSync } from '../src/lib/timesync';
import { buildIcs } from '../src/lib/ics';
import { countdownText, humanDuration } from '../src/lib/format';

describe('aoe', () => {
  it('is UTC−12', () => {
    const p = aoeParts(Date.UTC(2026, 0, 1, 11, 59, 59));
    expect(p).toMatchObject({ year: 2025, month: 12, day: 31, hour: 23, minute: 59, second: 59 });
    expect(aoeParts(Date.UTC(2026, 0, 1, 12)).day).toBe(1);
  });

  it('parses deadlines with the 23:59 default', () => {
    expect(deadlineEpoch('2026-11-15')).toBe(Date.UTC(2026, 10, 16, 11, 59));
    expect(deadlineEpoch('2026-11-15', '23:59:59')).toBe(Date.UTC(2026, 10, 16, 11, 59, 59));
    expect(deadlineEpoch('2026-12-31', '18:00')).toBe(Date.UTC(2027, 0, 1, 6));
  });

  it('rejects invalid input', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-2-3')).toBeNull();
    expect(parseDate('2028-02-29')).not.toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5, second: 0 });
    expect(deadlineEpoch('nope')).toBeNull();
  });

  it('answers "is it still <date> anywhere?" at the exact boundaries', () => {
    const d = parseDate('2026-11-15')!;
    const start = Date.UTC(2026, 10, 14, 10); // 00:00 in UTC+14
    const end = Date.UTC(2026, 10, 16, 12); // 24:00 in UTC−12
    expect(isStillAnywhere(d, start - 1).state).toBe('not-yet');
    expect(isStillAnywhere(d, start).state).toBe('yes');
    expect(isStillAnywhere(d, end - 1)).toEqual({ state: 'yes', remaining: 1 });
    expect(isStillAnywhere(d, end)).toEqual({ state: 'no', endedAgo: 0 });
  });

  it('computes day progress', () => {
    expect(aoeDayProgress(Date.UTC(2026, 5, 1, 12))).toBe(0);
    expect(aoeDayProgress(Date.UTC(2026, 5, 2, 0))).toBe(0.5);
  });

  it('splits durations and rounds countdowns up', () => {
    expect(splitDuration(90061_000)).toMatchObject({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(remainingDuration(400).seconds).toBe(1);
    expect(countdownText(0)).toBe('00:00:00');
    expect(countdownText(3 * 86400_000 + 5000)).toBe('3d 00:00:05');
    expect(humanDuration(5 * 3600_000 + 12 * 60_000)).toBe('5h 12m');
  });

  it('converts zoned wall time across DST', () => {
    // 2026-03-08 03:30 in New York is after the spring-forward (UTC−4)
    expect(zonedToEpoch({ year: 2026, month: 3, day: 8 }, { hour: 3, minute: 30, second: 0 }, 'America/New_York')).toBe(
      Date.UTC(2026, 2, 8, 7, 30),
    );
    expect(zonedToEpoch({ year: 2026, month: 1, day: 8 }, { hour: 12, minute: 0, second: 0 }, 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 0, 8, 6, 30),
    );
    expect(zonedToEpoch({ year: 2026, month: 1, day: 8 }, { hour: 12, minute: 0, second: 0 }, 'AoE')).toBe(
      Date.UTC(2026, 0, 9, 0),
    );
    expect(formatOffset(-12 * 3600_000)).toBe('UTC−12');
    expect(formatOffset(5.5 * 3600_000)).toBe('UTC+5:30');
  });
});

describe('timesync', () => {
  it('picks the lowest-RTT sample', () => {
    const r = bestOffset([
      { t0: 0, t1: 400, server: 5000 },
      { t0: 1000, t1: 1020, server: 6010 },
    ]);
    expect(r).toEqual({ offset: 5000, uncertainty: 10 });
  });

  it('syncs against a mocked endpoint', async () => {
    let device = 1_000_000;
    const fakeFetch = (async () => {
      device += 10; // 10 ms each way
      const body = { t: device + 3_000 }; // server is 3 s ahead
      device += 10;
      return new Response(JSON.stringify(body));
    }) as unknown as typeof fetch;
    const sync = new TimeSync('/api/time', 3, fakeFetch, () => device);
    const s = await sync.sync();
    expect(s.source).toBe('server');
    expect(s.offset).toBe(3000);
    expect(sync.now()).toBe(device + 3000);
  });

  it('falls back to the Date header', async () => {
    const fakeFetch = (async () =>
      new Response('nope', { status: 500, headers: { date: new Date(0).toUTCString() } })) as unknown as typeof fetch;
    const sync = new TimeSync('/api/time', 2, fakeFetch, () => 0);
    expect((await sync.sync()).source).toBe('date-header');
  });
});

describe('ics', () => {
  it('builds a VEVENT at the deadline', () => {
    const ics = buildIcs({ title: 'NeurIPS, abstracts', epoch: Date.UTC(2026, 10, 16, 11, 59) }, 0);
    expect(ics).toContain('DTSTART:20261116T115900Z');
    expect(ics).toContain('SUMMARY:NeurIPS\\, abstracts');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
