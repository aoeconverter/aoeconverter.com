const stamp = (epoch: number) => new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export interface CalendarEvent {
  title: string;
  epoch: number; // deadline instant
  url?: string;
  description?: string;
}

/** A zero-length event at the deadline with 1-day and 1-hour reminders. */
export function buildIcs(ev: CalendarEvent, now = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//aoeconverter.com//Deadline//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.epoch}-${encodeURIComponent(ev.title).slice(0, 40)}@aoeconverter.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(ev.epoch)}`,
    `DTEND:${stamp(ev.epoch)}`,
    `SUMMARY:${escape(ev.title)}`,
    ev.description ? `DESCRIPTION:${escape(ev.description)}` : '',
    ev.url ? `URL:${ev.url}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Deadline in 1 day',
    'TRIGGER:-P1D',
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Deadline in 1 hour',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${stamp(ev.epoch)}/${stamp(ev.epoch)}`,
    details: [ev.description, ev.url].filter(Boolean).join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
