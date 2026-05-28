// MEGGA storefront (V3) — HTTP Basic Auth gate + Supabase API proxy.
//
// Single-file Pages Worker (Advanced mode): detected natively by every
// Cloudflare Pages deploy. Intercepts 100% of traffic, gates with Basic Auth,
// then either proxies /api/listings to Supabase (so the visitor's browser
// never has to talk to supabase.co directly — works around browser/network
// CORS/throttle issues) or serves the static V3 assets.
//
// Credentials: ai / ai  (browser-native Basic Auth prompt).

const USER = 'ai';
const PASS = 'ai';
const SUPABASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw';

export default {
  async fetch(request, env) {
    const expected = 'Basic ' + btoa(`${USER}:${PASS}`);
    if (request.headers.get('Authorization') !== expected) {
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="MEGGA — accès restreint", charset="UTF-8"',
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const url = new URL(request.url);

    // ---- API proxy: /api/listings?<PostgREST query string> ----
    // Forwards to market_listings on Supabase with the anon key (server-side),
    // so the visitor's browser only talks to megga.ch.
    if (url.pathname === '/api/listings') {
      const target = SUPABASE_URL + '/market_listings?' + url.searchParams.toString();
      try {
        // Manual timeout (more portable than AbortSignal.timeout).
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 10000);
        const sb = await fetch(target, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          },
          signal: ctrl.signal,
        });
        clearTimeout(to);
        const body = await sb.text();
        return new Response(body, {
          status: sb.status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Short edge cache: same query within 60s served instantly.
            'Cache-Control': 'public, max-age=60',
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
