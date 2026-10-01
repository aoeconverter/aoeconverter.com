// Server clock for client-side sync. CORS is open so third-party embeds can use it.
export const onRequest: PagesFunction = () =>
  new Response(JSON.stringify({ t: Date.now() }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
      'timing-allow-origin': '*',
    },
  });
