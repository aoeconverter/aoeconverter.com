// Embeddable AoE countdown. Usage:
//   <div data-aoe-deadline="2026-11-15" data-aoe-time="23:59" data-aoe-label="Abstracts"></div>
//   <script async src="https://aoeconverter.com/embed/v1.js"></script>
// Options (data-aoe-*): deadline (required), time, label, theme (auto|light|dark|plain),
// size (s|m|l), expired (text shown after the deadline), local ("true" shows viewer's time).
// No cookies, no tracking; the only request is to /api/time for clock correction.

import { deadlineEpoch, pad, remainingDuration } from '../lib/aoe';
import { TimeSync, everySecond } from '../lib/timesync';

const script = document.currentScript as HTMLScriptElement | null;
const ORIGIN = script?.src ? new URL(script.src).origin : 'https://aoeconverter.com';
const clock = new TimeSync(`${ORIGIN}/api/time`, 3);
let started = false;

const CSS = `
:host{display:inline-block;max-width:100%}
.w{font-family:Archivo,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.2;text-align:left;--fg:#0F2740;--bg:#F6F9FB;--mu:#4D6378;--ac:#F5C342;--bd:#C3D1DD;color:var(--fg);background:var(--bg);border:1px solid var(--bd);border-radius:6px;padding:.8em 1em .7em;font-variant-numeric:tabular-nums;box-sizing:border-box}
.w.dark{--fg:#E4EDF3;--bg:#0F2740;--mu:#A7BACB;--bd:#2C4A68}
@media (prefers-color-scheme:dark){.w.auto{--fg:#E4EDF3;--bg:#0F2740;--mu:#A7BACB;--bd:#2C4A68}}
.w.plain{--fg:inherit;--bg:transparent;--mu:inherit;--bd:transparent;padding:0;font-family:inherit}
.w.plain .m,.w.plain .u{opacity:.7}
.l{font-weight:700;font-size:.95em;margin:0 0 .3em}
.c{display:flex;gap:.5em;flex-wrap:wrap;align-items:flex-end}
.c span{display:flex;flex-direction:column;align-items:flex-start}.c span[hidden]{display:none}
.n{font-weight:800;font-size:2.2em;line-height:1;letter-spacing:-.01em;font-stretch:75%}
.u{font-size:.7em;color:var(--mu)}
.w.urgent .n{text-decoration:underline;text-decoration-color:var(--ac);text-decoration-thickness:.08em;text-underline-offset:.1em}
.x{font-weight:800;font-size:1.4em}
.m{font-size:.75em;color:var(--mu);margin:.45em 0 0;display:flex;gap:.25em .8em;flex-wrap:wrap}
.m a{color:inherit}
.s{font-size:12px}.m-{font-size:16px}.lg{font-size:22px}
`;

const units = ['days', 'hours', 'min', 'sec'] as const;

function mount(host: HTMLElement) {
  if ((host as any).__aoe) return;
  (host as any).__aoe = true;
  const ds = host.dataset;
  const date = ds.aoeDeadline || '';
  const time = ds.aoeTime || '23:59';
  const epoch = deadlineEpoch(date, time);
  const root = host.attachShadow({ mode: 'open' });
  const theme = ['light', 'dark', 'plain'].includes(ds.aoeTheme || '') ? ds.aoeTheme : 'auto';
  const size = ({ s: 's', l: 'lg' } as Record<string, string>)[ds.aoeSize || ''] || 'm-';

  const style = document.createElement('style');
  style.textContent = CSS;
  const w = document.createElement('div');
  w.className = `w ${theme} ${size}`;
  w.setAttribute('role', 'timer');
  root.append(style, w);

  if (epoch === null) {
    w.textContent = `AoE countdown: "${date}" isn’t a valid date. Use YYYY-MM-DD.`;
    return;
  }

  const label = ds.aoeLabel;
  if (label) {
    const l = document.createElement('p');
    l.className = 'l';
    l.textContent = label;
    w.append(l);
  }
  const c = document.createElement('div');
  c.className = 'c';
  const nums = units.map((u) => {
    const span = document.createElement('span');
    const n = document.createElement('b');
    n.className = 'n';
    const t = document.createElement('small');
    t.className = 'u';
    t.textContent = u;
    span.append(n, t);
    c.append(span);
    return { span, n };
  });
  w.append(c);

  const meta = document.createElement('p');
  meta.className = 'm';
  const when = document.createElement('span');
  when.textContent = `${date} ${time} AoE`;
  meta.append(when);
  if (ds.aoeLocal === 'true') {
    const loc = document.createElement('span');
    loc.textContent = `Your time: ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(epoch)}`;
    meta.append(loc);
  }
  const link = document.createElement('a');
  link.href = `${ORIGIN}/d/${date}?${new URLSearchParams({ t: time, ...(label ? { name: label } : {}) })}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'aoeconverter.com';
  meta.append(link);
  w.append(meta);

  let lastAria = '';
  const stop = everySecond(
    () => clock.now(),
    (now) => {
      if (!host.isConnected) return queueMicrotask(() => stop());
      const left = epoch - now;
      if (left <= 0) {
        c.innerHTML = '';
        const x = document.createElement('span');
        x.className = 'x';
        x.textContent = ds.aoeExpired || 'Deadline passed';
        c.append(x);
        w.classList.remove('urgent');
        w.setAttribute('aria-label', `${label ? label + ': ' : ''}${x.textContent}`);
        queueMicrotask(() => stop());
        return;
      }
      const r = remainingDuration(left);
      const vals = [r.days, r.hours, r.minutes, r.seconds];
      nums.forEach((x, i) => (x.n.textContent = i === 0 ? String(vals[i]) : pad(vals[i])));
      nums[0].span.hidden = r.days === 0;
      w.classList.toggle('urgent', left < 86400_000);
      const aria = `${label ? label + ': ' : ''}${r.days} days ${r.hours} hours ${r.minutes} minutes left`;
      if (aria !== lastAria) w.setAttribute('aria-label', (lastAria = aria));
    },
  );
}

function scan(node: ParentNode = document) {
  const found = node.querySelectorAll<HTMLElement>('[data-aoe-deadline]');
  if (found.length && !started) {
    started = true;
    clock.start();
  }
  found.forEach(mount);
}

scan();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan());
new MutationObserver(() => scan()).observe(document.documentElement, { childList: true, subtree: true });

// Lets pages (like our own embed generator) re-render a widget after changing its attributes.
(window as any).AoECountdown = { scan, mount };
