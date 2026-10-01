// NTP-style clock correction against our own /api/time endpoint.
// Each sample measures round-trip time; the server's timestamp is assumed to be
// taken halfway through, and the lowest-RTT sample wins because it has the least
// uncertainty. Falls back to the HTTP Date header, then to the device clock.

export type SyncSource = 'server' | 'date-header' | 'device';

export interface SyncState {
  source: SyncSource;
  offset: number; // add to Date.now() to get true time
  uncertainty: number; // ± ms (half the best RTT)
  syncedAt: number;
}

export interface Sample {
  t0: number;
  t1: number;
  server: number;
}

export function bestOffset(samples: Sample[]): { offset: number; uncertainty: number } | null {
  if (!samples.length) return null;
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return {
    offset: best.server - (best.t0 + best.t1) / 2,
    uncertainty: Math.max(1, Math.round((best.t1 - best.t0) / 2)),
  };
}

type Listener = (s: SyncState) => void;

export class TimeSync {
  state: SyncState = { source: 'device', offset: 0, uncertainty: Infinity, syncedAt: 0 };
  private listeners = new Set<Listener>();
  private inflight: Promise<SyncState> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private endpoint: string,
    private samples = 5,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
    private clock: () => number = () => Date.now(),
  ) {}

  now(): number {
    return this.clock() + this.state.offset;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Sync now, then every `intervalMs` and whenever the tab becomes visible again. */
  start(intervalMs = 10 * 60_000): Promise<SyncState> {
    if (!this.timer) {
      this.timer = setInterval(() => this.sync(), intervalMs);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.sync();
        });
      }
    }
    return this.sync();
  }

  sync(): Promise<SyncState> {
    if (!this.inflight) {
      this.inflight = this.run().finally(() => (this.inflight = null));
    }
    return this.inflight;
  }

  private async run(): Promise<SyncState> {
    const collected: Sample[] = [];
    let dateHeader: { offset: number; uncertainty: number } | null = null;

    for (let i = 0; i < this.samples; i++) {
      try {
        const t0 = this.clock();
        const res = await this.fetchImpl(`${this.endpoint}?n=${t0}-${i}`, { cache: 'no-store' });
        const t1 = this.clock();
        if (res.ok) {
          const body = (await res.json()) as { t?: unknown };
          if (typeof body.t === 'number') {
            collected.push({ t0, t1, server: body.t });
            continue;
          }
        }
        const header = res.headers.get('date');
        if (header && !dateHeader) {
          // Date header has 1 s resolution; assume mid-second.
          dateHeader = { offset: Date.parse(header) + 500 - (t0 + t1) / 2, uncertainty: 500 + (t1 - t0) / 2 };
        }
      } catch {
        // network error: try the next sample
      }
    }

    const best = bestOffset(collected);
    if (best) this.set({ source: 'server', ...best, syncedAt: this.clock() });
    else if (dateHeader) this.set({ source: 'date-header', ...dateHeader, syncedAt: this.clock() });
    else if (this.state.source === 'device') this.set({ ...this.state, syncedAt: this.clock() });
    return this.state;
  }

  private set(s: SyncState) {
    this.state = s;
    this.listeners.forEach((fn) => fn(s));
  }
}

/**
 * Call `fn` right after every second boundary of `now()`. Re-arming with setTimeout
 * each tick (instead of setInterval) keeps updates locked to the corrected clock.
 */
export function everySecond(now: () => number, fn: (t: number) => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const t = now();
    fn(t);
    timer = setTimeout(tick, 1000 - (t % 1000) + 2);
  };
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
