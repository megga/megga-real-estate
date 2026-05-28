// Home V3 — "La marketplace MEGGA" section.
// Replaces the two static Webflow PNG/JPG mockups (phone + bento) with live
// markup that pulls 4 real listings from the storefront PostgREST proxy.
//
// What gets rendered:
//   - 1 hero card in `[data-megga-hero-card]` (the bento on the front)
//   - 3 mini cards in `[data-megga-phone-feed]` (inside the phone frame)
//
// All branding (logo, badges, copy) is MEGGA — no Property X / SF / LA
// fakery remains. Falls back to a quiet placeholder if the API is slow or
// fails — the section never breaks the page render.
(function () {
  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'style') n.style.cssText = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function fmtPrice(item) {
    var amount = Number(item.rent || item.price || item.current_price);
    if (!amount || isNaN(amount)) return null;
    var s = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return 'CHF ' + s + ' / mois';
  }

  function locationLine(item) {
    // Prefer street address when available; fall back to postal + city.
    if (item.address && item.city) return item.address + ', ' + item.city;
    var parts = [];
    if (item.postal_code) parts.push(item.postal_code);
    if (item.city) parts.push(item.city);
    return parts.join(' ') || (item.canton || 'Suisse');
  }

  function title(item) {
    return item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Bien'));
  }

  function photoUrl(item) {
    return (item.photos && item.photos[0]) || null;
  }

  function renderHero(item) {
    var card = el('div', { class: 'megga-hero-card' });
    var imgWrap = el('div', { class: 'megga-hero-card__image' });
    var photo = photoUrl(item);
    if (photo) {
      var img = el('img', { src: photo, alt: title(item), loading: 'lazy' });
      img.onerror = function () { img.style.display = 'none'; };
      imgWrap.appendChild(img);
    }
    imgWrap.appendChild(el('div', { class: 'megga-hero-card__badge' }, ['À louer']));
    card.appendChild(imgWrap);
    var body = el('div', { class: 'megga-hero-card__body' }, [
      el('h4', { class: 'megga-hero-card__title' }, [title(item)]),
      el('div', { class: 'megga-hero-card__address' }, [locationLine(item)]),
    ]);
    var stats = el('div', { class: 'megga-hero-card__stats' });
    if (item.surface_m2) stats.appendChild(el('span', null, [Math.round(item.surface_m2) + ' m²']));
    if (item.rooms) stats.appendChild(el('span', null, [item.rooms + ' p.']));
    if (item.bedrooms != null) stats.appendChild(el('span', null, [item.bedrooms + ' ch.']));
    if (stats.childNodes.length) body.appendChild(stats);
    card.appendChild(body);
    return card;
  }

  function renderPhoneCard(item) {
    var row = el('div', { class: 'megga-phone-card' });
    var imgWrap = el('div', { class: 'megga-phone-card__image' });
    var photo = photoUrl(item);
    if (photo) {
      var img = el('img', { src: photo, alt: title(item), loading: 'lazy' });
      img.onerror = function () { img.style.display = 'none'; };
      imgWrap.appendChild(img);
    }
    imgWrap.appendChild(el('div', { class: 'megga-phone-card__badge' }, ['À louer']));
    row.appendChild(imgWrap);
    var body = el('div', { class: 'megga-phone-card__body' }, [
      el('div', { class: 'megga-phone-card__title' }, [title(item)]),
      el('div', { class: 'megga-phone-card__address' }, [locationLine(item)]),
    ]);
    var price = fmtPrice(item);
    if (price) body.appendChild(el('div', { class: 'megga-phone-card__price' }, [price]));
    row.appendChild(body);
    return row;
  }

  function fetchListings() {
    // 4 most-recent active residential rentals with at least one photo.
    // Filter to apartment/house/villa so the homepage showcase doesn't end
    // up surfacing storage units or commercial arcades — those are valid
    // inventory but tonally wrong for a "dream home" hero. limit=18 so we
    // can drop entries without photos client-side and still have 4 clean.
    var cols = 'id,title,rent,current_price,city,canton,postal_code,address,rooms,bedrooms,surface_m2,photos,type';
    var url = '/api/listings?select=' + cols
      + '&transaction_type=eq.rent&status=eq.active&quality_score=gte.60'
      + '&type=in.(apartment,house,villa)'
      + '&order=created_at.desc&limit=18';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (to) clearTimeout(to); if (!r.ok) throw new Error('proxy ' + r.status); return r.json(); })
      .then(function (rows) {
        return (rows || []).filter(function (r) { return r.photos && r.photos.length > 0; });
      });
  }

  function run() {
    var heroMount = $('[data-megga-hero-card]');
    var phoneMount = $('[data-megga-phone-feed]');
    if (!heroMount && !phoneMount) return;

    fetchListings().then(function (items) {
      if (!items.length) return;
      if (heroMount) {
        heroMount.innerHTML = '';
        heroMount.appendChild(renderHero(items[0]));
      }
      if (phoneMount) {
        phoneMount.innerHTML = '';
        items.slice(1, 4).forEach(function (it) {
          phoneMount.appendChild(renderPhoneCard(it));
        });
      }
    }).catch(function (err) {
      // Quiet failure: leave the placeholder copy alone. The section degrades
      // to "Chargement…" rather than blowing up the page.
      console.error('[megga-home-showcase] fetch failed:', err);
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
