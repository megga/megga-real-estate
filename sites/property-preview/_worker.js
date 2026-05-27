// MEGGA storefront (V3) — HTTP Basic Auth gate.
//
// Single-file Pages Worker (Advanced mode): detected natively by every
// Cloudflare Pages deploy (git-connected build AND `wrangler pages deploy`),
// unlike functions/_middleware which is silently skipped on some direct
// uploads. It intercepts 100% of traffic, then serves the static V3 files
// via env.ASSETS once authenticated.
//
// Credentials: ai / ai  (browser-native Basic Auth prompt).

const USER = 'ai';
const PASS = 'ai';

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
    return env.ASSETS.fetch(request);
  },
};
