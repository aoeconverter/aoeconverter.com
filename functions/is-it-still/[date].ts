import { parseDate } from '../../src/lib/aoe';
import { serveShell } from '../_lib/shell';

export const onRequest: PagesFunction<{ ASSETS: Fetcher }, 'date'> = (ctx) => {
  const date = String(ctx.params.date);
  if (!parseDate(date)) return ctx.env.ASSETS.fetch(new URL('/is-it-still/', ctx.request.url));
  return serveShell(ctx, '/is-it-still/', {
    title: `Is it still ${date} anywhere on Earth?`,
    description: `Live answer: how much of ${date} is left somewhere on Earth (AoE, UTC−12).`,
  });
};
