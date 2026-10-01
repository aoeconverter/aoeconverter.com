// /og/2026-11-15.png?t=23:59&name=NeurIPS → 1200×630 preview image for link unfurls.
// /og/default.png → generic site image.
import { ImageResponse } from 'workers-og';
import { deadlineEpoch, parseDate, parseTime, pad } from '../../src/lib/aoe';
import { MONTHS } from '../../src/lib/format';

let font: Promise<ArrayBuffer> | null = null;

// Google Fonts serves TTF (which satori needs) to user agents that don't advertise woff2.
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wght@${weight}`, {
    headers: { 'user-agent': 'Mozilla/4.0' },
  }).then((r) => r.text());
  const src = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!src) throw new Error('font url not found');
  return fetch(src).then((r) => r.arrayBuffer());
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const onRequest: PagesFunction<unknown, 'name'> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(ctx.request);
  if (hit) return hit;

  const key = String(ctx.params.name).replace(/\.png$/, '');
  const date = parseDate(key);
  const time = parseTime(url.searchParams.get('t'));
  const name = (url.searchParams.get('name') || '').slice(0, 60);
  const epoch = date && time ? deadlineEpoch(key, url.searchParams.get('t')) : null;

  let title: string;
  let line: string;
  let sub: string;
  if (date && time && epoch !== null) {
    title = name || 'Deadline';
    line = `${date.day} ${MONTHS[date.month - 1]} ${date.year}, ${pad(time.hour)}:${pad(time.minute)} AoE`;
    const utc = new Date(epoch);
    sub = `${utc.getUTCDate()} ${MONTHS[utc.getUTCMonth()]}, ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())} UTC. Open the link for a live countdown in your time.`;
  } else {
    title = 'What time is it Anywhere on Earth?';
    line = 'AoE clock, UTC−12';
    sub = 'Deadline countdowns, timezone conversion, embeddable timers';
  }

  font ??= loadFont(800).catch((e) => {
    font = null;
    throw e;
  });

  const html = `
  <div style="display:flex;flex-direction:column;justify-content:space-between;width:1200px;height:630px;padding:64px 72px;background:#0F2740;color:#EAF0F4;font-family:Archivo">
    <div style="display:flex;font-size:30px;color:#A7BACB">aoeconverter.com</div>
    <div style="display:flex;flex-direction:column">
      <div style="display:flex;font-size:76px;line-height:1.05;letter-spacing:-1px">${esc(title)}</div>
      <div style="display:flex;font-size:52px;margin-top:20px;color:#F5C342">${esc(line)}</div>
    </div>
    <div style="display:flex;flex-direction:column">
      <div style="display:flex;font-size:30px;color:#A7BACB">${esc(sub)}</div>
    </div>
  </div>`;

  const res = new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Archivo', data: await font, weight: 800, style: 'normal' }],
  });
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'public, max-age=3600');
  ctx.waitUntil(cache.put(ctx.request, out.clone()));
  return out;
};
