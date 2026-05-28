// Properties page: read URL params, fetch listings from Supabase, and render real
// cards by cloning the existing demo card as a template.
(function () {
  function qp(name) { return new URLSearchParams(location.search).get(name) || ''; }

  function fillCard(node, item) {
    var M = window.MeggaSupabase;
    var isBuy = item.transaction_type === 'buy';

    var a = node.querySelector('a.property-wrapper-v1');
    if (a) a.setAttribute('href', '../property/luxury-loft-in-san-francisco.html?id=' + item.id);

    var img = node.querySelector('img.cover-image');
    var photo = (item.photos && item.photos[0]) || '';
    if (img && photo) { img.src = photo; img.alt = item.title || 'Bien'; img.removeAttribute('srcset'); }

    var badge = node.querySelector('.property-badge .text-fix div');
    if (badge) badge.textContent = isBuy ? 'À vendre' : 'À louer';

    var title = node.querySelector('.property-card-bottom-content-v1 h2, .property-card-bottom-content-v1 h3');
    if (title) {
      title.textContent = item.title || ((item.rooms ? item.rooms + ' pièces · ' : '') + (item.city || 'Bien'));
      // Inject a price line right after the title (the template has none).
      if (!title.nextElementSibling || !title.nextElementSibling.classList.contains('megga-price')) {
        var amount = item.rent || item.price || item.current_price;
        var price = document.createElement('div');
        price.className = 'megga-price';
        price.style.cssText = 'margin-top:4px;font-weight:500';
        price.textContent = M.formatCHF(amount) + (isBuy ? '' : '/mois');
        title.parentNode.insertBefore(price, title.nextSibling);
      }
    }

    // Address line (location feature uses .text-titles).
    var addr = node.querySelector('.property-card-bottom-content-v1 .text-titles div');
    if (addr) {
      addr.textContent = (item.address ? item.address + ', ' : '') +
        (item.postal_code ? item.postal_code + ' ' : '') + (item.city || '');
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
    var grid = document.querySelector('.grid-2-columns.properties-grid---v1.w-dyn-items');
    if (!grid) return;
    var template = grid.querySelector('.w-dyn-item');
    if (!template) return;
    var tplHTML = template.outerHTML;
    grid.innerHTML = '<div id="megga-status" style="padding:24px;grid-column:1/-1">Chargement…</div>';

    window.MeggaSupabase.fetchListings({
      transaction: qp('transaction'), city: qp('ville'), type: qp('type'), limit: 24,
    }).then(function (items) {
      grid.innerHTML = '';
      if (!items.length) {
        grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Aucun bien pour ces critères. Essayez une autre ville.</div>';
        return;
      }
      items.forEach(function (it) {
        var wrap = document.createElement('div');
        wrap.innerHTML = tplHTML;
        var node = wrap.firstElementChild;
        node.style.opacity = '1';
        node.style.transform = 'none';
        grid.appendChild(fillCard(node, it));
      });
    }).catch(function () {
      grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Une erreur est survenue. Réessayez.</div>';
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
