// /badge/2026-11-15.svg?t=23:59&label=NeurIPS → shields-style countdown badge.
// Rendered per request so it works in READMEs and emails where scripts can't run.
import { deadlineEpoch } from '../../src/lib/aoe';
import { humanDuration } from '../../src/lib/format';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Rough Verdana 11px advance widths; good enough for badge sizing.
const textWidth = (s: string) =>
  [...s].reduce((w, c) => w + (/[ilj.,:;'|!]/.test(c) ? 3.5 : /[mwMW@]/.test(c) ? 10 : /[A-Z0-9]/.test(c) ? 7.5 : 6.5), 0);

function badge(label: string, value: string, color: string): string {
  const lw = Math.round(textWidth(label) + 14);
  const vw = Math.round(textWidth(value) + 14);
  const w = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#0F2740"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/></g>
<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="14" fill="#EAF0F4">${esc(label)}</text>
<text x="${lw + vw / 2}" y="14" fill="#0F2740">${esc(value)}</text>
</g></svg>`;
}

export const onRequest: PagesFunction<unknown, 'name'> = (ctx) => {
  const url = new URL(ctx.request.url);
  const date = String(ctx.params.name).replace(/\.svg$/, '');
  const label = (url.searchParams.get('label') || 'deadline').slice(0, 40);
  const epoch = deadlineEpoch(date, url.searchParams.get('t'));

  let value: string;
  let color: string;
  if (epoch === null) {
    value = 'invalid date';
    color = '#8FA6BA';
  } else {
    const left = epoch - Date.now();
    if (left <= 0) {
      value = 'closed';
      color = '#E8806F';
    } else {
      value = `${humanDuration(left)} left`;
      color = left < 86400_000 ? '#F5C342' : left < 7 * 86400_000 ? '#F7DA8A' : '#B9CCDB';
    }
  }

  return new Response(badge(label, value, color), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'access-control-allow-origin': '*',
    },
  });
};
