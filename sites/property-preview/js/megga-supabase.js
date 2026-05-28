// Browser-side reader for the static marketplace.
// Calls our SAME-ORIGIN proxy /api/listings (handled by _worker.js) instead
// of supabase.co directly — avoids any browser/CORS/throttle issues on the
// visitor's side; the worker holds the anon key server-side and forwards.
//
// Server-side filters (all covered by indexes — fast under the anon role):
//   transaction_type / status / quality_score → partial idx_ml_rent_active_created
//   canton = (exact)                          → walks the same partial index
//   city IN (variants)                        → btree idx_market_listings_city_type_price
// Free-text keyword (title) is NOT indexed; it's filtered CLIENT-SIDE in
// megga-properties.js over the already-narrow server result.
//
// City matching: substring ILIKE on city is unusable (the anon planner refuses
// both the trigram and the partial created_at index — selectivity estimate
// for substring is too low → Seq Scan + Sort > 3s → timeout). Instead the
// client passes the FULL list of DB-spelling variants for the picked city
// (see ch-cities.js variants[]). PostgREST's `in.(...)` keeps the partial
// index usable and runs in <1s end-to-end.
window.MeggaSupabase = (function () {
  var PROXY_URL = '/api/listings';

  function fetchListings(filters) {
    var f = filters || {};
    var tx = f.transaction === 'acheter' ? 'buy' : 'rent';
    var canton = (f.canton || '').trim();
    var villes = Array.isArray(f.villes) ? f.villes : [];
    var ville = (f.ville || '').trim();
    var scoped = canton || villes.length || ville;
    // When the user narrowed by city/canton, a smaller limit is enough. Without
    // a scope we keep a larger recent pool so keyword-only searches still have
    // something to filter over.
    var limit = f.limit || (scoped ? 60 : 120);
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
    if (canton) {
      params.set('canton', 'eq.' + canton);
    } else if (villes.length) {
      // PostgREST in.(...) — values with commas/parens/spaces are double-quoted.
      var quoted = villes.map(function (v) {
        return /[,()" ]/.test(v) ? '"' + v.replace(/"/g, '\\"') + '"' : v;
      });
      params.set('city', 'in.(' + quoted.join(',') + ')');
    } else if (ville) {
      params.set('city', 'eq.' + ville);
    }
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
