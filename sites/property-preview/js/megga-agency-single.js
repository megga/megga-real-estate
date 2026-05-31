// Agency detail — the agent-single page (agent/john-carter.html) repurposed as
// the AGENCY single page. Reads ?id, fetches the agency via /api/agencies, and
// fills the hero (logo / name / ville·canton / site) + the agency's biens
// (market_listings by agency_name) in the existing property grid; hides the demo
// bio/articles. Without ?id → keeps the demo. Needs megga-supabase.js loaded first.
(function () {
  function qp(n) { return new URLSearchParams(location.search).get(n) || ''; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function setPhoto(img, url, contain) {
    if (!img) return;
    img.removeAttribute('srcset');
    img.setAttribute('referrerpolicy', 'no-referrer');
    if (contain) { img.style.objectFit = 'contain'; img.style.background = '#fff'; img.style.padding = '10px'; }
    img.onerror = function () {
      img.style.display = 'none';
      var w = img.closest('.avatar-wrapper, .image-wrapper');
      if (w) w.style.background = '#EEEFF1';
    };
    if (url) img.src = url; else img.onerror();
  }

  // Fill one property card (same structure as properties.html, but the agent
  // card uses .text-light for the address — fall back to .text-titles).
  function fillListingCard(node, item, M) {
    var isBuy = item.transaction_type === 'buy';
    var a = node.querySelector('a.property-wrapper-v1');
    if (a) a.setAttribute('href', '/property/luxury-loft-in-san-francisco.html?id=' + item.id);
    setPhoto(node.querySelector('img.cover-image'), (item.photos && item.photos[0]) || '', false);
    var badge = node.querySelector('.property-badge .text-fix div');
    if (badge) badge.textContent = isBuy ? 'À vendre' : 'À louer';
    var title = node.querySelector('.property-card-bottom-content-v1 h2, .property-card-bottom-content-v1 h3');
    if (title) {
      title.textContent = item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Annonce'));
      var amount = Number(item.rent || item.price || item.current_price);
      if (amount > 0 && (!title.nextElementSibling || !title.nextElementSibling.classList.contains('megga-price'))) {
        var pr = document.createElement('div');
        pr.className = 'megga-price'; pr.style.cssText = 'margin-top:4px;font-weight:500';
        pr.textContent = M.formatCHF(amount) + (isBuy ? '' : '/mois');
        title.parentNode.insertBefore(pr, title.nextSibling);
      }
    }
    var addr = node.querySelector('.property-card-bottom-content-v1 .text-light div') ||
               node.querySelector('.property-card-bottom-content-v1 .text-titles div');
    if (addr) addr.textContent = (item.address ? item.address + ', ' : '') + (item.postal_code ? item.postal_code + ' ' : '') + (item.city || '');
    var wraps = node.querySelectorAll('.property-details .card-feature-wrapper, .property-details-wrapper-v1-1 .card-feature-wrapper');
    var vals = [
      item.surface_m2 ? Math.round(item.surface_m2) + ' m²' : null,
      item.rooms ? item.rooms + ' p.' : null,
      item.bedrooms != null ? item.bedrooms + ' ch.' : null,
    ];
    for (var i = 0; i < wraps.length; i++) {
      var d = wraps[i].querySelector('.text-neutral-light div, .text-light div, div div');
      if (vals[i]) { if (d) d.textContent = vals[i]; wraps[i].style.display = ''; }
      else { wraps[i].style.display = 'none'; }
    }
    return node;
  }

  function loadListings(agency, M) {
    var grid = $('.properties-grid---v1.w-dyn-items');
    var section = grid ? (grid.closest('section') || grid.parentElement) : null;
    if (!grid) return;
    var template = grid.querySelector('.w-dyn-item');
    if (!template) { if (section) section.style.display = 'none'; return; }
    var tpl = template.outerHTML;
    var params = new URLSearchParams();
    params.set('select', 'id,title,rent,price,current_price,address,city,postal_code,rooms,bedrooms,surface_m2,photos,transaction_type');
    // Flatfox sets EITHER the FK (agency_profile_id) OR just the name — match on
    // either for the best coverage (some agencies have one, some the other).
    var nameQ = '"' + String(agency.name || '').replace(/"/g, '\\"') + '"';
    params.set('or', '(agency_profile_id.eq.' + agency.id + ',agency_name.eq.' + nameQ + ')');
    params.set('status', 'eq.active');
    params.set('order', 'created_at.desc');
    params.set('limit', '12');
    fetch('/api/listings?' + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) { if (section) section.style.display = 'none'; return; }
        var browse = section && section.querySelector('a[href*="propert"]');
        if (browse) browse.style.display = 'none';
        grid.innerHTML = '';
        items.forEach(function (it) {
          var w = document.createElement('div'); w.innerHTML = tpl;
          var node = w.firstElementChild;
          node.style.opacity = '1'; node.style.transform = 'none';
          grid.appendChild(fillListingCard(node, it, M));
        });
      })
      .catch(function () { if (section) section.style.display = 'none'; });
  }

  function fill(agency) {
    var M = window.MeggaSupabase;
    var loc = [agency.city, agency.canton].filter(Boolean).join(' · ') || 'Suisse';

    // Reveal Webflow IX2-hidden CONTENT (opacity:0 / off-screen transform).
    // Scoped to <section>s and skips nav/dropdown/modal/lightbox so we never
    // accidentally pop open hidden navigation or overlays.
    $all('section, section [style]').forEach(function (el) {
      if (el.closest('.w-nav, .w-dropdown, [class*="modal"], [class*="popup"], [class*="lightbox"]')) return;
      if (el.style && el.style.opacity === '0') el.style.opacity = '1';
      if (el.style && /translate|scale|rotate/.test(el.style.transform || '')) el.style.transform = 'none';
    });

    // ── Hero ──
    var name = $('h1.display-5') || $('h1');
    if (name) name.textContent = agency.name || 'Agence';
    document.title = (agency.name || 'Agence') + ' — MEGGA';
    var handle = $('.agent-single-grid .display-2.mid') || $('.display-2.mid');
    if (handle) handle.textContent = loc;
    var avatar = $('.avatar-wrapper img');
    if (avatar) {
      setPhoto(avatar, agency.logo_url, true);
      avatar.classList.remove('circle');
      var aw = avatar.closest('.avatar-wrapper');
      if (aw) { aw.style.background = '#fff'; aw.style.borderRadius = '16px'; aw.style.overflow = 'hidden'; }
    }
    // Structured contact rows: keep Location/Position, drop fake Email/Phone.
    $all('.agent-contact-link').forEach(function (row) {
      var lblEl = row.querySelector('.display-2:not(.mid)');
      var lbl = (lblEl && lblEl.textContent) || '';
      var val = row.querySelector('.display-2.mid, .text-titles');
      if (/email|e-mail|phone|téléphone|tel/i.test(lbl)) { row.style.display = 'none'; return; }
      if (/location|adresse|ville/i.test(lbl) && val) val.textContent = loc;
      else if (/position|poste/i.test(lbl) && val) val.textContent = 'Agence immobilière';
    });
    // Hero website link (a.link-cms) → the agency site, or hide it.
    var web = $('a.link-cms');
    if (web) {
      if (agency.website_url) {
        web.href = agency.website_url; web.target = '_blank'; web.rel = 'noopener noreferrer';
        web.textContent = agency.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      } else {
        var wc = web.closest('.input, .agent-contact-link') || web;
        wc.style.display = 'none';
      }
    }
    // Drop the mislabeled demo "Contact agent" CTA in the hero (the site link is
    // already shown in the hero card; this is an agency, not an agent).
    var hero = name && name.closest('section');
    if (hero) {
      $all('a, [class*="button"]', hero).forEach(function (el) {
        if (/contact/i.test(el.textContent)) (el.closest('a') || el).style.display = 'none';
      });
    }
    // Keep social/OG titles in sync for sharing.
    ['og:title', 'twitter:title'].forEach(function (k) {
      var m = document.querySelector('meta[property="' + k + '"]') || document.querySelector('meta[name="' + k + '"]');
      if (m) m.setAttribute('content', (agency.name || 'Agence') + ' — MEGGA');
    });

    // ── Hide the bio (About me / My experience) — only its grid column ──
    $all('h2').forEach(function (hh) {
      if (!/about me|à propos|my experience|expérience/i.test(hh.textContent)) return;
      var col = hh;
      while (col.parentElement && !/w-layout-grid/.test(col.parentElement.className || '')) col = col.parentElement;
      (col || hh).style.display = 'none';
    });
    // Hide an articles/blog section (guard: not the hero or the listings).
    $all('h2').forEach(function (hh) {
      if (!/article|blog|guide|astuce|conseil/i.test(hh.textContent)) return;
      var sec = hh.closest('section');
      if (sec && !sec.querySelector('h1') && !sec.querySelector('.properties-grid---v1')) sec.style.display = 'none';
    });

    // ── Replace residual demo agent identity ──
    $all('h1,h2,h3,div,span,a,p').forEach(function (el) {
      if (!el.children.length && el.textContent.trim() === 'John Carter') el.textContent = agency.name;
    });
    // Listings title → "Biens de l'agence" (drop the demo "Properties in charge of …" prefix).
    var lg = $('.properties-grid---v1.w-dyn-items');
    var lsec = lg && lg.closest('section');
    if (lsec) {
      var lh = lsec.querySelector('h2'); if (lh) lh.textContent = "Annonces de l’agence";
      $all('div,span,p', lsec).forEach(function (el) {
        if (!el.children.length && /^properties\b/i.test(el.textContent.trim())) el.style.display = 'none';
      });
    }
    // Hide the demo "Articles / blog" block (shares the section with the listings).
    var blogGrid = $('[class*="blog-grid"]');
    if (blogGrid) {
      var bblk = blogGrid;
      for (var bk = 0; bk < 5 && bblk.parentElement; bk++) {
        var bup = bblk.parentElement;
        if (bup.querySelector('.properties-grid---v1') || bup.querySelector('h1')) break;
        bblk = bup;
      }
      bblk.style.display = 'none';
    }
    $all('h2').forEach(function (hh) {
      if (!/article|blog/i.test(hh.textContent)) return;
      var t = hh;
      for (var hk = 0; hk < 3 && t.parentElement && !t.parentElement.querySelector('.properties-grid---v1'); hk++) t = t.parentElement;
      t.style.display = 'none';
    });

    loadListings(agency, M);
    $all('p').forEach(function (p) { if (/^\s*Lorem ipsum/i.test(p.textContent)) p.style.display = 'none'; });
  }

  function notFound() {
    var n = $('h1.display-5') || $('h1');
    if (n) n.textContent = 'Agence introuvable';
  }

  function run() {
    var M = window.MeggaSupabase;
    var id = qp('id');
    if (!id || !M) return;
    var n = $('h1.display-5') || $('h1');
    if (n) n.textContent = 'Chargement…';
    fetch('/api/agencies?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1')
      .then(function (r) { return r.json(); })
      .then(function (rows) { var a = Array.isArray(rows) ? rows[0] : null; if (!a) { notFound(); return; } fill(a); })
      .catch(function (e) { console.error('[megga] agency load failed', e); notFound(); });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
