import { deadlineEpoch, parseDate } from '../../src/lib/aoe';
import { formatInZone } from '../../src/lib/format';
import { serveShell } from '../_lib/shell';

export const onRequest: PagesFunction<{ ASSETS: Fetcher }, 'date'> = (ctx) => {
  const date = String(ctx.params.date);
  const url = new URL(ctx.request.url);
  const time = url.searchParams.get('t');
  const name = url.searchParams.get('name')?.slice(0, 80);
  const epoch = deadlineEpoch(date, time);
  if (!parseDate(date) || epoch === null) return ctx.env.ASSETS.fetch(new URL('/d/', url.origin));
  const label = name || 'Deadline';
  const when = `${date} ${time || '23:59'} AoE`;
  return serveShell(ctx, '/d/', {
    title: `${label}: ${when}`,
    description: `Countdown to ${label}: ${when} (${formatInZone(epoch, 'UTC', 'en-GB')} UTC). See it in your own timezone.`,
    image: `${url.origin}/og/${date}.png${url.search}`,
  });
};
