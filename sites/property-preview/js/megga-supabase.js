// Browser-side Supabase reader for the static marketplace.
// The anon key is PUBLIC BY DESIGN (RLS-protected) — same key the app ships.
window.MeggaSupabase = (function () {
  var BASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw';

  // filters: { transaction: 'louer'|'acheter', offset, limit }
  // IMPORTANT: only the base filters (transaction/status/quality) + ORDER BY
  // created_at run server-side — that combination is covered by the partial
  // index idx_ml_rent_active_created and returns in <1s. City / type / keyword
  // filtering on ~59k rows has NO matching index and makes the request hang,
  // so it's done CLIENT-SIDE (see megga-properties.js) over this recent pool.
  function fetchListings(filters) {
    var f = filters || {};
    var tx = f.transaction === 'acheter' ? 'buy' : 'rent';
    var limit = f.limit || 120;
    var offset = f.offset || 0;
    var cols = [
      'id', 'title', 'price', 'rent', 'current_price', 'address', 'city',
      'canton', 'postal_code', 'rooms', 'bedrooms', 'bathrooms', 'surface_m2',
      'photos', 'source_url', 'transaction_type',
    ].join(',');
    var params = new URLSearchParams();
    params.set('select', cols);
    params.set('transaction_type', 'eq.' + tx);
    params.set('status', 'eq.active');
    params.set('quality_score', 'gte.50');
    params.set('order', 'created_at.desc');
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    // Client-side timeout so the page never stays stuck on "Chargement…".
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;
    return fetch(BASE_URL + '/market_listings?' + params.toString(), {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (res) {
      if (to) clearTimeout(to);
      if (!res.ok) throw new Error('Supabase ' + res.status);
      return res.json();
    });
  }

  // Swiss-formatted price: CHF 1'850
  function formatCHF(n) {
    var v = Number(n);
    if (!v || isNaN(v)) return 'CHF —';
    return 'CHF ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  return { BASE_URL: BASE_URL, ANON_KEY: ANON_KEY, fetchListings: fetchListings, formatCHF: formatCHF };
})();
