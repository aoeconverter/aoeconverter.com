// Serves a static client-rendered shell page for a pretty URL, swapping in
// per-URL <title> and Open Graph tags so link previews describe the deadline.

interface Meta {
  title: string;
  description: string;
  image?: string;
  robots?: string;
}

export async function serveShell(
  ctx: EventContext<{ ASSETS: Fetcher }, string, unknown>,
  shellPath: string,
  meta: Meta,
): Promise<Response> {
  const url = new URL(ctx.request.url);
  const shell = await ctx.env.ASSETS.fetch(new URL(shellPath, url.origin));
  const set = (selector: string, value: string) => ({ selector, value });
  const attrs = [
    set('meta[property="og:title"]', meta.title),
    set('meta[name="twitter:title"]', meta.title),
    set('meta[name="description"]', meta.description),
    set('meta[property="og:description"]', meta.description),
    set('meta[property="og:url"]', url.href),
    ...(meta.image ? [set('meta[property="og:image"]', meta.image), set('meta[name="twitter:image"]', meta.image)] : []),
  ];
  let rw = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', url.origin + url.pathname);
      },
    });
  if (meta.robots) attrs.push(set('meta[name="robots"]', meta.robots));
  for (const a of attrs) {
    rw = rw.on(a.selector, {
      element(el) {
        el.setAttribute('content', a.value);
      },
    });
  }
  const res = rw.transform(shell);
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(res.body, { status: shell.status, headers });
}
