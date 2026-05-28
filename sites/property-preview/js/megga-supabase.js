// Browser-side reader for the static marketplace.
// Calls our SAME-ORIGIN proxy /api/listings (handled by _worker.js) instead
// of supabase.co directly — avoids any browser/CORS/throttle issues on the
// visitor's side; the worker holds the anon key server-side and forwards.
//
// IMPORTANT: only the base filters (transaction/status/quality) + ORDER BY
// created_at are sent server-side — that combination is covered by the
// partial index idx_ml_rent_active_created and returns fast. City / type /
// keyword filtering on ~59k rows has no matching index so it's done
// CLIENT-SIDE in megga-properties.js over the recent pool returned here.
window.MeggaSupabase = (function () {
  var PROXY_URL = '/api/listings';

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

    // Client-side timeout (the worker also has its own 10s upstream timeout).
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;
    return fetch(PROXY_URL + '?' + params.toString(), {
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (res) {
      if (to) clearTimeout(to);
      if (!res.ok) throw new Error('proxy ' + res.status);
      return res.json();
    });
  }

  // Swiss-formatted price: CHF 1'850
  function formatCHF(n) {
    var v = Number(n);
    if (!v || isNaN(v)) return 'CHF —';
    return 'CHF ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  return { PROXY_URL: PROXY_URL, fetchListings: fetchListings, formatCHF: formatCHF };
})();
