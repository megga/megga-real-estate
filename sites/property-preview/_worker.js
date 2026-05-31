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

const MOTIVATIONS = ['immediate', '3months', '6months', 'exploring'];

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Build a clean seller_leads row from untrusted form input. We NEVER forward the
// client's raw object to PostgREST — only these whitelisted keys are kept, so the
// visitor can't set status / assigned_agency_id / estimation_* themselves.
function buildSellerLeadRow(payload) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const posNum = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };

  const name = str(payload.contact_name, 200);
  const email = str(payload.contact_email, 200);
  if (!name) return { error: 'contact_name_required' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'contact_email_invalid' };

  const pd = payload.property_data && typeof payload.property_data === 'object' ? payload.property_data : {};
  const property_data = {
    title: str(pd.title, 200),
    type: str(pd.type, 40),
    transaction_type: pd.transaction_type === 'buy' ? 'buy' : pd.transaction_type === 'rent' ? 'rent' : '',
    address: str(pd.address, 200),
    city: str(pd.city, 120),
    canton: str(pd.canton, 40),
    postalCode: str(pd.postalCode, 12),
    price: posNum(pd.price),
    rooms: str(typeof pd.rooms === 'number' ? String(pd.rooms) : pd.rooms, 12),
    bedrooms: str(typeof pd.bedrooms === 'number' ? String(pd.bedrooms) : pd.bedrooms, 12),
    bathrooms: str(typeof pd.bathrooms === 'number' ? String(pd.bathrooms) : pd.bathrooms, 12),
    parking: str(typeof pd.parking === 'number' ? String(pd.parking) : pd.parking, 12),
    surface: posNum(pd.surface),
    landSurface: posNum(pd.landSurface),
    description: str(pd.description, 5000),
    amenities: Array.isArray(pd.amenities) ? pd.amenities.slice(0, 30).map((a) => str(String(a), 60)).filter(Boolean) : [],
    imagesLink: str(pd.imagesLink, 500),
    photos: [],
  };

  return {
    row: {
      property_data,
      contact_name: name,
      contact_email: email,
      contact_phone: str(payload.contact_phone, 60) || null,
      motivation: MOTIVATIONS.indexOf(payload.motivation) >= 0 ? payload.motivation : null,
      source: 'marketplace',
      status: 'new',
    },
  };
}

// Build a clean contact_messages row from untrusted form input (storefront
// "Contact" form). Mirrors the table CHECK constraints (message 10-5000, phone
// 3-40, consent_privacy=true required by RLS).
function buildContactMessageRow(payload) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const name = str(payload.name, 120);
  const email = str(payload.email, 200);
  const message = str(payload.message, 5000);
  const phone = str(payload.phone, 40);
  const subject = str(payload.subject, 200);
  if (!name) return { error: 'name_required' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'email_invalid' };
  if (message.length < 10) return { error: 'message_too_short' };
  if (payload.consent !== true) return { error: 'consent_required' };
  return {
    row: {
      name, email, message,
      phone: phone.length >= 3 ? phone : null,
      subject: subject || null,
      consent_privacy: true,
      lang: 'fr',
      source: 'storefront',
      status: 'new',
    },
  };
}

// INSERT a whitelisted row into a Supabase table with the anon key (server-side),
// shared by the lead/contact endpoints. Returns a JSON Response (201 / 502).
async function insertRow(table, row) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 10000);
  try {
    const sb = await fetch(SUPABASE_URL + '/' + table, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (sb.status >= 200 && sb.status < 300) return jsonResponse({ ok: true }, 201);
    const detail = (await sb.text()).slice(0, 300);
    return jsonResponse({ ok: false, error: 'upstream', status: sb.status, detail }, 502);
  } catch (e) {
    clearTimeout(to);
    return jsonResponse({ ok: false, error: String(e) }, 502);
  }
}

// Read + size-guard + parse a JSON request body. Returns { payload } or { response }.
async function readJsonBody(request) {
  try {
    const raw = await request.text();
    if (raw.length > 20000) return { response: jsonResponse({ error: 'payload_too_large' }, 413) };
    return { payload: JSON.parse(raw || '{}') };
  } catch {
    return { response: jsonResponse({ error: 'invalid_json' }, 400) };
  }
}

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

    // ---- Lead intake: POST /api/seller-lead → Supabase seller_leads ----
    // The storefront "Publier une annonce" form posts here. We INSERT with the
    // anon key (RLS: seller_leads_anon_insert) so the visitor's browser never
    // talks to supabase.co. The lead lands unassigned (assigned_agency_id NULL)
    // in the CRM "Biens" inbox to be claimed, and a DB trigger raises the agent
    // notification (activity_events → notification bell).
    if (url.pathname === '/api/seller-lead') {
      if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
      const { payload, response } = await readJsonBody(request);
      if (response) return response;
      const built = buildSellerLeadRow(payload);
      if (built.error) return jsonResponse({ ok: false, error: built.error }, 400);
      return insertRow('seller_leads', built.row);
    }

    // ---- Contact intake: POST /api/contact-message → Supabase contact_messages ----
    // The storefront "Contact" form posts here. INSERT with the anon key (RLS:
    // contact_messages_anon_insert, consent_privacy=true). A DB trigger raises the
    // agent notification (activity_events → notification bell).
    if (url.pathname === '/api/contact-message') {
      if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
      const { payload, response } = await readJsonBody(request);
      if (response) return response;
      const built = buildContactMessageRow(payload);
      if (built.error) return jsonResponse({ ok: false, error: built.error }, 400);
      return insertRow('contact_messages', built.row);
    }

    // ---- API proxy: /api/<resource>?<PostgREST query string> ----
    // Forwards to Supabase with the anon key (server-side) so the visitor's
    // browser only ever talks to megga.ch. Whitelisted resources only.
    const API_TABLES = { '/api/listings': 'market_listings', '/api/agencies': 'agency_profiles' };
    const apiTable = API_TABLES[url.pathname];
    if (apiTable) {
      const target = SUPABASE_URL + '/' + apiTable + '?' + url.searchParams.toString();
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
