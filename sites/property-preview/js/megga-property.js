// Single-property page: read ?id, fetch the real listing through the SAME
// /api/listings proxy (worker holds the anon key), and replace the Webflow demo
// content ("Luxury Loft in San Francisco" / "$8,500") with the real bien —
// gallery, title, price, address, details, description, amenities. Without an
// ?id the page keeps its demo content (template preview).
//
// Requires megga-supabase.js (window.MeggaSupabase) to be loaded first.
(function () {
  function qp(n) { return new URLSearchParams(location.search).get(n) || ''; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var TYPE_FR = {
    apartment: 'Appartement', house: 'Maison', villa: 'Villa', commercial: 'Commercial',
    office: 'Bureau', parking: 'Place de parc', storage: 'Dépôt', land: 'Terrain',
  };

  function imgFallback(img) {
    img.style.display = 'none';
    var w = img.closest('.image-wrapper, .gallery-image-wrapper, ._w-h-100');
    if (w) w.style.background = '#EEEFF1';
  }
  function setPhoto(img, url) {
    if (!img) return;
    img.removeAttribute('srcset');
    if (!url) { imgFallback(img); return; }
    img.onerror = function () { imgFallback(img); };
    img.style.display = '';
    img.src = url;
  }
  // Keep Webflow's click-to-zoom lightbox in sync with the real photo.
  function setLightbox(link, url) {
    if (!link || !url) return;
    var s = link.querySelector('script.w-json');
    if (!s) return;
    try {
      var j = JSON.parse(s.textContent);
      if (j.items && j.items[0]) { j.items[0].url = url; s.textContent = JSON.stringify(j); }
    } catch (e) { /* leave as-is */ }
  }

  function fillGallery(photos) {
    photos = (photos || []).filter(Boolean);
    var mainLink = $('.property-gallery-wrapper .lightbox-link');
    setPhoto(mainLink && mainLink.querySelector('img.cover-image'), photos[0]);
    setLightbox(mainLink, photos[0]);

    var thumbs = $all('.gallery-images-grid .gallery-image-wrapper');
    thumbs.forEach(function (t, i) {
      var p = photos[i + 1];
      if (p) {
        setPhoto(t.querySelector('img'), p);
        setLightbox(t.querySelector('a.w-lightbox') || t.querySelector('a'), p);
        t.style.display = '';
      } else {
        t.style.display = 'none';
      }
    });
    // Re-init the lightbox so the gallery group opens the real photos.
    try { if (window.Webflow && window.Webflow.require) window.Webflow.require('lightbox').ready(); } catch (e) { /* noop */ }
  }

  function fillDetails(item) {
    $all('.property-details .card-feature-wrapper').forEach(function (w) {
      var img = w.querySelector('img');
      var box = w.querySelector('.text-neutral-light div');
      var src = ((img && img.getAttribute('src')) || '').toLowerCase();
      var v = null;
      if (src.indexOf('sqft') >= 0) v = item.surface_m2 ? Math.round(item.surface_m2) + ' m²' : null;
      else if (src.indexOf('bathroom') >= 0) v = (item.bathrooms != null && item.bathrooms !== '') ? item.bathrooms + ' sdb' : null;
      else if (src.indexOf('bedroom') >= 0) v = item.rooms ? item.rooms + ' pièces' : (item.bedrooms != null ? item.bedrooms + ' ch.' : null);
      else if (src.indexOf('parking') >= 0) v = item.has_garage ? 'Garage' : (item.has_parking ? 'Parking' : null);
      if (v != null && box) { box.textContent = v; w.style.display = ''; }
      else { w.style.display = 'none'; }
    });
  }

  function fillAmenities(item) {
    // Flatfox exposes only a handful of reliable booleans — show the matching
    // Webflow amenity cards (relabelled FR), hide the rest (never fake amenities).
    var KW = [
      ['pool', 'Piscine', !!item.has_swimming_pool],
      ['elevator', 'Ascenseur', !!item.has_elevator],
      ['garage', 'Garage', !!item.has_garage],
      ['chimney', 'Cheminée', !!item.has_fireplace],
    ];
    var kept = 0;
    $all('.amenities-grid .amenity-card').forEach(function (c) {
      var img = c.querySelector('.amenity-image');
      var src = ((img && img.getAttribute('src')) || '').toLowerCase();
      var match = KW.filter(function (k) { return k[2] && src.indexOf(k[0]) >= 0; })[0];
      if (match) {
        var lbl = c.querySelector('div');
        if (lbl) lbl.textContent = match[1];
        c.style.display = ''; kept++;
      } else {
        c.style.display = 'none';
      }
    });
    var h = $all('h2').filter(function (x) { return /amenities|équipements/i.test(x.textContent); })[0];
    if (h) h.textContent = 'Équipements';
    if (kept === 0) {
      var grid = $('.amenities-grid'); if (grid) grid.style.display = 'none';
      if (h) { h.style.display = 'none'; if (h.nextElementSibling) h.nextElementSibling.style.display = 'none'; }
    }
  }

  // Replace the remaining Webflow demo copy: the lorem excerpt under the title
  // (→ a real one-line summary), the fake agent identity, and every leftover
  // "Lorem ipsum" placeholder paragraph (amenities/agent/form intros).
  function cleanDemoText(item) {
    var h1 = $('h1.display-8') || $('h1');
    var exP = h1 && h1.nextElementSibling && h1.nextElementSibling.querySelector('p');
    if (exP) {
      var bits = [];
      if (TYPE_FR[item.type]) bits.push(TYPE_FR[item.type]);
      if (item.rooms) bits.push(item.rooms + ' pièces');
      if (item.surface_m2) bits.push(Math.round(item.surface_m2) + ' m²');
      if (item.city) bits.push('à ' + item.city);
      exP.textContent = bits.join(' · ');
    }
    var nameEl = $('.agent-link-wrapper .display-4.mid');
    if (nameEl) nameEl.textContent = item.agency_name || 'MEGGA';
    var avatar = $('.agent-link-wrapper .avatar-wrapper');
    if (avatar) avatar.style.display = 'none';
    // Localise the remaining English template headings.
    $all('.display-4.mid, .display-1, h2').forEach(function (el) {
      var t = el.textContent.trim();
      if (/^Get in touch to receive/i.test(t)) el.textContent = 'Demande d’informations';
      else if (/^Get in touch with/i.test(t)) el.textContent = 'Contacter l’agence';
      else if (/^Get in touch$/i.test(t)) el.textContent = 'Contactez-nous';
    });
    $all('p').forEach(function (p) {
      if (/^\s*Lorem ipsum/i.test(p.textContent)) p.style.display = 'none';
    });
  }

  function dropFakeAgentContacts() {
    // No real per-listing agent for marketplace listings → remove the demo
    // email/phone so we never show fake contact details.
    $all('a.contact-link[href^="mailto:"], a.contact-link[href^="tel:"]').forEach(function (a) {
      a.style.display = 'none';
    });
  }

  function fill(item) {
    var M = window.MeggaSupabase;
    var isBuy = item.transaction_type === 'buy';
    var title = item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Bien'));
    var amount = Number(item.rent || item.price || item.current_price);

    var h1 = $('h1.display-8') || $('h1');
    if (h1) h1.textContent = title;
    document.title = title + ' — MEGGA';

    var locImg = $('.card-feature-wrapper img[src*="location"]');
    var locBox = locImg && locImg.closest('.card-feature-wrapper').querySelector('.text-titles div');
    if (locBox) {
      locBox.textContent = (item.address ? item.address + ', ' : '') +
        (item.postal_code ? item.postal_code + ' ' : '') + (item.city || '');
    }

    var priceEl = $('.listing-price .display-8');
    if (priceEl) priceEl.textContent = amount > 0 ? M.formatCHF(amount) : 'Sur demande';
    var curEl = $('.listing-price---currency---page-v1 .display-4');
    if (curEl) curEl.textContent = (amount > 0 && !isBuy) ? '/mois' : '';
    var priceBox = $('.listing-price') && $('.listing-price').parentElement;
    if (priceBox) {
      var inl = $all('.display-4.text-inline', priceBox);
      if (inl[0]) inl[0].textContent = TYPE_FR[item.type] || 'Bien';
      if (inl[1]) inl[1].textContent = isBuy ? 'À vendre' : 'À louer';
    }

    fillGallery(item.photos);
    fillDetails(item);

    var rt = $('.rich-text-v2');
    if (rt) {
      var h2 = rt.querySelector('h2');
      rt.innerHTML = '';
      if (h2) { h2.textContent = 'Description'; rt.appendChild(h2); }
      if (item.description) {
        var p = document.createElement('p');
        p.textContent = item.description;
        rt.appendChild(p);
      }
    }

    fillAmenities(item);
    dropFakeAgentContacts();
    cleanDemoText(item);

    // The demo "More properties" grid is static CMS placeholder data — hide it.
    var more = $('.properties-grid---v1');
    var moreSection = more && more.closest('section');
    if (moreSection) moreSection.style.display = 'none';
  }

  function notFound() {
    var h1 = $('h1.display-8') || $('h1');
    if (h1) h1.textContent = 'Bien introuvable';
    var locImg = $('.card-feature-wrapper img[src*="location"]');
    var locBox = locImg && locImg.closest('.card-feature-wrapper').querySelector('.text-titles div');
    if (locBox) locBox.textContent = 'Ce bien n’est plus disponible ou a été retiré.';
  }

  function run() {
    var M = window.MeggaSupabase;
    var id = qp('id');
    if (!id || !M) return; // direct visit without an id → keep the template/demo
    var h1 = $('h1.display-8') || $('h1');
    if (h1) h1.textContent = 'Chargement…';
    fetch(M.PROXY_URL + '?id=eq.' + encodeURIComponent(id) + '&status=eq.active&select=*&limit=1')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        var item = Array.isArray(rows) ? rows[0] : (rows && rows.id ? rows : null);
        if (!item) { notFound(); return; }
        fill(item);
      })
      .catch(function (err) { console.error('[megga] property load failed:', err); notFound(); });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
