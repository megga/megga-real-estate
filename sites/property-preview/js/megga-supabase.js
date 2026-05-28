// Browser-side Supabase reader for the static marketplace.
// The anon key is PUBLIC BY DESIGN (RLS-protected) — same key the app ships.
window.MeggaSupabase = (function () {
  var BASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw';

  // filters: { transaction: 'louer'|'acheter', city, type, offset, limit }
  function fetchListings(filters) {
    var f = filters || {};
    var tx = f.transaction === 'acheter' ? 'buy' : 'rent';
    var limit = f.limit || 24;
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
    // City: from the Localisation dropdown OR the free-text box. Uses the
    // trigram index → fast. The free-text keyword only narrows WITHIN a city
    // (small subset) to avoid an unindexed title scan over ~59k rows.
    var city = f.city || f.q;
    if (city) params.set('city', 'ilike.' + city + '%');
    if (f.type) params.set('type', 'eq.' + f.type);
    if (f.q && f.city) params.set('title', 'ilike.*' + f.q + '*');
    params.set('order', 'created_at.desc');
    // Paginate via query params (not a Range header) — simpler CORS request.
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
