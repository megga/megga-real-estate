// MEGGA vitrine (megga.ch) — HTTP Basic Auth gate (pré-lancement).
//
// Single-file Pages Worker (Advanced mode): gates 100% of traffic with Basic
// Auth, then serves the static vitrine assets. No Supabase proxy here — the
// vitrine is a marketing landing that points to the CRM (app.megga.ch); it does
// not query listings. (The marketplace proxy lives in
// sites/_marketplace-phase-ulterieure/_worker.js, kept for the later phase.)
//
// Credentials: megga / preview  (browser-native Basic Auth prompt, pre-launch).

const USER = 'megga';
const PASS = 'preview';

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
