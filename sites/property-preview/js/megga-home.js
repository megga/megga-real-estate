// Home: fill the "featured" property cards (featured-property-item---main) with
// real recent listings instead of the Webflow demo. Reuses the same worker proxy
// (/api/listings) and links to the wired property page. Needs megga-supabase.js.
(function () {
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function setPhoto(img, url) {
    if (!img) return;
    img.removeAttribute('srcset');
    img.setAttribute('referrerpolicy', 'no-referrer'); // Flatfox anti-hotlink
    img.onerror = function () {
      img.style.display = 'none';
      var w = img.closest('.image-wrapper, [class*="image"]');
      if (w) w.style.background = '#EEEFF1';
    };
    if (url) img.src = url; else img.onerror();
  }

  function fillCard(card, item, M) {
    var isBuy = item.transaction_type === 'buy';
    var photos = (item.photos || []).filter(Boolean);
    var scope = card.closest('.w-dyn-item') || card;

    $all('a.featured-property-block---link, a.primary-button-icon', scope).forEach(function (a) {
      a.setAttribute('href', '/property/luxury-loft-in-san-francisco.html?id=' + item.id);
    });
    setPhoto(card.querySelector('img.featured-property---image'), photos[0]);
    // Hover-panel gallery → the listing's other photos.
    $all('.panel-overlay img.featured-image, img.featured-image', scope).forEach(function (im, i) {
      setPhoto(im, photos[(i + 1) % Math.max(photos.length, 1)] || photos[0]);
    });

    var badge = card.querySelector('.property-badge .text-fix div');
    if (badge) badge.textContent = isBuy ? 'À vendre' : 'À louer';

    var title = card.querySelector('.featured-property-bottom-content h3');
    if (title) {
      title.textContent = item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Annonce'));
      var amount = Number(item.rent || item.price || item.current_price);
      if (amount > 0 && (!title.nextElementSibling || !title.nextElementSibling.classList.contains('megga-price'))) {
        var pr = document.createElement('div');
        pr.className = 'megga-price';
        pr.style.cssText = 'margin-top:6px;font-weight:600;font-size:18px';
        pr.textContent = M.formatCHF(amount) + (isBuy ? '' : '/mois');
        title.parentNode.insertBefore(pr, title.nextSibling);
      }
    }
    var sub = card.querySelector('.featured-property-bottom-content p');
    if (sub) {
      var bits = [];
      if (item.rooms) bits.push(item.rooms + ' pièces');
      if (item.surface_m2) bits.push(Math.round(item.surface_m2) + ' m²');
      if (item.city) bits.push('à ' + item.city);
      sub.textContent = bits.join(' · ');
    }
    var addr = card.querySelector('.featured-property-bottom-content .card-feature-wrapper .text-light div');
    if (addr) addr.textContent = (item.address ? item.address + ', ' : '') + (item.postal_code ? item.postal_code + ' ' : '') + (item.city || '');

    // Hover-panel captions / alts still carry the demo property — replace them
    // (scoped to this card) so nothing demo remains, even on hover.
    var addrTxt = (item.address ? item.address + ', ' : '') + (item.postal_code ? item.postal_code + ' ' : '') + (item.city || '');
    $all('h3,h4,p,div', scope).forEach(function (el) {
      if (el.children.length) return;
      var t = el.textContent.trim();
      if (/Loft contemporain/.test(t)) el.textContent = item.title || (item.city || 'Annonce');
      else if (/Rue du Rhône 12/.test(t)) el.textContent = addrTxt;
    });
    $all('img[alt*="Loft contemporain"]', scope).forEach(function (im) { im.alt = item.title || 'Annonce'; });
  }

  function run() {
    var M = window.MeggaSupabase;
    if (!M) return;
    var cards = $all('.featured-property-item---main');
    if (!cards.length) return;
    var params = new URLSearchParams();
    params.set('select', 'id,title,rent,price,current_price,address,city,postal_code,rooms,surface_m2,photos,transaction_type');
    params.set('status', 'eq.active');
    params.set('transaction_type', 'eq.rent');
    params.set('quality_score', 'gte.50');
    params.set('order', 'created_at.desc');
    params.set('limit', String(cards.length * 3));
    fetch('/api/listings?' + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (items) {
        if (!Array.isArray(items) || !items.length) return;
        var withPhotos = items.filter(function (it) { return it.photos && it.photos.length; });
        var use = withPhotos.length >= cards.length ? withPhotos : items;
        cards.forEach(function (c, i) { if (use[i]) fillCard(c, use[i], M); });

        // Reveal the whole featured section (Webflow IX2 starts blocks at
        // opacity:0 / off-screen transform) so both cards always show.
        function reveal(el) {
          if (!el || !el.style) return;
          if (el.style.opacity === '0') el.style.opacity = '1';
          if (/translate|scale|rotate/.test(el.style.transform || '')) el.style.transform = 'none';
        }
        var section = cards[0].closest('section') || document.body;
        reveal(section);
        $all('[style]', section).forEach(reveal);
        var up = section; while (up && up !== document.body) { reveal(up); up = up.parentElement; }
        $all('.panel-overlay').forEach(function (el) { el.style.display = 'none'; });

        // Sweep any remaining demo property text/alt left in the component.
        var d = use[0];
        var dAddr = (d.address ? d.address + ', ' : '') + (d.postal_code ? d.postal_code + ' ' : '') + (d.city || '');
        $all('h3,h4,p,div,span').forEach(function (el) {
          if (el.children.length) return;
          var t = el.textContent.trim();
          if (/Loft contemporain/.test(t)) el.textContent = d.title || (d.city || 'Annonce');
          else if (/Rue du Rhône 12/.test(t)) el.textContent = dAddr;
        });
        $all('img[alt*="Loft contemporain"]').forEach(function (im) { im.alt = d.title || 'Annonce'; });
      })
      .catch(function (e) { console.error('[megga] home featured failed:', e); });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
