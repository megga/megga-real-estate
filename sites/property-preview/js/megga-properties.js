// Properties page: read URL params, fetch listings from Supabase, and render real
// cards by cloning the existing demo card as a template.
(function () {
  function qp(name) { return new URLSearchParams(location.search).get(name) || ''; }

  // Webflow only puts a `max-height` on the card image box (no fixed height /
  // aspect-ratio), so each photo renders at its natural ratio capped at 364px —
  // landscape shots come out short, square/portrait ones hit the cap → a ragged
  // grid. Pin a fixed 3:2 box (wider/landscape) and let object-fit:cover crop, so
  // every card photo is the same (larger, wider) size. Scoped to the grid.
  function injectCardImageFix() {
    if (document.getElementById('megga-card-image-fix')) return;
    var css =
      '.properties-grid---v1 .property-card-top-content-v1{max-height:none}' +
      '.properties-grid---v1 .image-wrapper.border-radius-image-default.property-card-top-content-v1---image{aspect-ratio:3/2;height:auto;flex:none;width:100%;display:block}' +
      '.properties-grid---v1 .image-wrapper.property-card-top-content-v1---image .cover-image{width:100%;height:100%;object-fit:cover;display:block}';
    var s = document.createElement('style');
    s.id = 'megga-card-image-fix';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function fillCard(node, item) {
    var M = window.MeggaSupabase;
    var isBuy = item.transaction_type === 'buy';

    var a = node.querySelector('a.property-wrapper-v1');
    if (a) a.setAttribute('href', '/property/luxury-loft-in-san-francisco.html?id=' + item.id);

    var img = node.querySelector('img.cover-image');
    var photo = (item.photos && item.photos[0]) || '';
    if (img) {
      img.removeAttribute('srcset');
      var wrap = img.closest('.image-wrapper');
      var fallback = function () {
        img.style.display = 'none';
        if (wrap) wrap.style.background = '#EEEFF1';
      };
      if (photo) {
        img.alt = item.title || 'Annonce';
        img.onerror = fallback; // expired Flatfox signature / 404 → neutral bg
        img.src = photo;
      } else {
        fallback();
      }
    }

    var badge = node.querySelector('.property-badge .text-fix div');
    if (badge) badge.textContent = isBuy ? 'À vendre' : 'À louer';

    var title = node.querySelector('.property-card-bottom-content-v1 h2, .property-card-bottom-content-v1 h3');
    if (title) {
      title.textContent = item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Annonce'));
    }

    // Location (pin + .text-titles). Show the city (+ postal) — short enough to
    // sit to the RIGHT of the price; the full street address is on the detail page.
    var hasLoc = !!(item.city || item.postal_code);
    var locWrap = node.querySelector('.property-card-bottom-content-v1 .text-titles');
    var addr = locWrap && locWrap.querySelector('div');
    if (addr) addr.textContent = hasLoc ? ((item.postal_code ? item.postal_code + ' ' : '') + (item.city || '')) : '';
    locWrap = locWrap ? (locWrap.closest('.card-feature-wrapper') || locWrap) : null;

    // Price + location on one row, location to the RIGHT of the price.
    var amount = Number(item.rent || item.price || item.current_price);
    if (title && amount > 0 && !(title.nextElementSibling && title.nextElementSibling.classList.contains('megga-price-row'))) {
      var row = document.createElement('div');
      row.className = 'megga-price-row';
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px';
      var price = document.createElement('div');
      price.className = 'megga-price';
      price.style.cssText = 'font-weight:600;white-space:nowrap;flex:none';
      price.textContent = M.formatCHF(amount) + (isBuy ? '' : '/mois');
      row.appendChild(price);
      title.parentNode.insertBefore(row, title.nextSibling);
      if (locWrap && hasLoc) {
        locWrap.style.margin = '0';
        locWrap.style.minWidth = '0';
        locWrap.style.flex = '0 1 auto';
        row.appendChild(locWrap);
      } else if (locWrap) {
        locWrap.style.display = 'none';
      }
    }

    // Feature slots: surface / rooms / bedrooms. Hide a slot when we have no value
    // (Flatfox often has null bedrooms/bathrooms) to avoid dash clutter.
    var wraps = node.querySelectorAll('.property-details .card-feature-wrapper');
    var vals = [
      item.surface_m2 ? (Math.round(item.surface_m2) + ' m²') : null,
      item.rooms ? (item.rooms + ' p.') : null,
      item.bedrooms != null ? (item.bedrooms + ' ch.') : null,
    ];
    for (var i = 0; i < wraps.length; i++) {
      var d = wraps[i].querySelector('.text-neutral-light div');
      if (vals[i]) { if (d) d.textContent = vals[i]; wraps[i].style.display = ''; }
      else { wraps[i].style.display = 'none'; }
    }

    return node;
  }

  function run() {
    injectCardImageFix();
    var grid = document.querySelector('.grid-2-columns.properties-grid---v1.w-dyn-items');
    if (!grid) return;
    var template = grid.querySelector('.w-dyn-item');
    if (!template) return;
    var tplHTML = template.outerHTML;
    grid.innerHTML = '<div id="megga-status" style="padding:24px;grid-column:1/-1">Chargement…</div>';

    var agglo = qp('agglo');
    var canton = qp('canton');
    var ville = qp('ville');
    var type = qp('type');
    var kw = qp('q').toLowerCase();
    // Scope resolution: agglomération > canton > ville (no overlap — only one is
    // ever set at a time by the search UI).
    var aggloEntry = agglo ? ((window.CH_FIND_AGGLO && window.CH_FIND_AGGLO(agglo)) || null) : null;
    var cityEntry = ville ? ((window.CH_FIND_CITY && window.CH_FIND_CITY(ville)) || null) : null;
    var villes = aggloEntry
      ? aggloEntry.cities
      : (cityEntry ? cityEntry.variants : (ville ? [ville] : []));
    // What the user typed/picked, for the empty-state copy.
    var TYPE_LABELS = { apartment: 'Appartements', house: 'Maisons', villa: 'Villas', commercial: 'Commerces', office: 'Bureaux', parking: 'Parkings', storage: 'Dépôts', land: 'Terrains' };
    var typeLabel = type ? (TYPE_LABELS[type] || '') : '';
    var locLabel = aggloEntry ? aggloEntry.name
      : (canton
        ? ((window.CH_FIND_CANTON && (window.CH_FIND_CANTON(canton) || {}).name) || canton)
        : (ville || ''));
    var txLabel = qp('transaction') === 'acheter' ? 'À vendre' : '';
    var scopeLabel = [typeLabel, locLabel].filter(Boolean).join(' à ') || txLabel || qp('q') || 'votre recherche';

    window.MeggaSupabase.fetchListings({
      transaction: qp('transaction'),
      canton: canton,
      villes: villes,
      type: type,
    }).then(function (items) {
      // Geographic scope is server-side. Keyword stays client-side because
      // title is not indexed — but the pool is small once we've narrowed.
      var filtered = items.filter(function (it) {
        if (!kw) return true;
        var c = (it.city || '').toLowerCase();
        var t = (it.title || '').toLowerCase();
        return t.indexOf(kw) >= 0 || c.indexOf(kw) >= 0;
      }).slice(0, 24);
      grid.innerHTML = '';
      if (!filtered.length) {
        grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Aucune annonce récente pour « ' + scopeLabel + ' ». Essayez un autre lieu ou élargissez au canton.</div>';
        return;
      }
      filtered.forEach(function (it) {
        var wrap = document.createElement('div');
        wrap.innerHTML = tplHTML;
        var node = wrap.firstElementChild;
        node.style.opacity = '1';
        node.style.transform = 'none';
        grid.appendChild(fillCard(node, it));
      });
    }).catch(function (err) {
      console.error('[megga] fetchListings failed:', err);
      var msg = (err && err.name === 'AbortError') ? 'délai dépassé' : (err && err.message ? err.message : String(err));
      grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Une erreur est survenue (' + msg + '). Réessayez.</div>';
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
