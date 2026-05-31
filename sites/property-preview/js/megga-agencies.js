// Agencies directory (company-pages/agencies.html): fetch agencies through the
// same worker proxy (/api/agencies → agency_profiles), clone the demo card as a
// template, and render real agencies — logo, name, ville/canton, lien vers le
// site de l'agence. Reuses the Agents page layout (.agents-grid / .agent-card).
(function () {
  // Agency logos are rectangular & varied — show them CONTAINED (not face-cropped
  // like an avatar) on white with a soft radius. Scoped to this grid; injected once.
  function injectLogoStyle() {
    if (document.getElementById('megga-agency-logo-fix')) return;
    var css =
      '.agents-grid .avatar-wrapper.agent-avatar{background:#fff;border-radius:14px;overflow:hidden}' +
      '.agents-grid .avatar-wrapper.agent-avatar img{object-fit:contain!important;padding:14px;background:#fff}';
    var st = document.createElement('style');
    st.id = 'megga-agency-logo-fix';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function fillCard(node, a) {
    var website = a.website_url || '';

    // Whole card + top-right button → the agency website (new tab) when present.
    var links = node.querySelectorAll('a.agent-card, a.primary-button-icon');
    for (var i = 0; i < links.length; i++) {
      if (website) {
        links[i].setAttribute('href', website);
        links[i].setAttribute('target', '_blank');
        links[i].setAttribute('rel', 'noopener noreferrer');
      } else {
        links[i].removeAttribute('href');
        links[i].style.pointerEvents = 'none';
      }
    }
    var arrow = node.querySelector('.badge-wrapper---top-right');
    if (arrow && !website) arrow.style.display = 'none';

    // Logo
    var img = node.querySelector('.avatar-wrapper.agent-avatar img');
    if (img) {
      img.removeAttribute('srcset');
      img.setAttribute('referrerpolicy', 'no-referrer'); // external logo hosts
      img.alt = a.name || 'Agence';
      img.onerror = function () {
        img.style.display = 'none';
        var w = img.closest('.avatar-wrapper');
        if (w) w.style.background = '#EEEFF1';
      };
      if (a.logo_url) img.src = a.logo_url; else img.onerror();
    }

    // Name
    var name = node.querySelector('h2.title');
    if (name) name.textContent = a.name || 'Agence';

    // Subtitle → ville · canton
    var sub = node.querySelector('.mg-top-extra-small div');
    if (sub) sub.textContent = [a.city, a.canton].filter(Boolean).join(' · ') || 'Agence immobilière';

    // Bottom links (email/phone) — no per-agency contact in the data → hide.
    var bottom = node.querySelector('.agent-card-links');
    if (bottom) bottom.style.display = 'none';

    return node;
  }

  // Hide leftover "Lorem ipsum" placeholders carried over from the agents
  // template (CTA / footer sections below the grid).
  function cleanDemoCopy() {
    var ps = document.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      if (/^\s*Lorem ipsum/i.test(ps[i].textContent)) ps[i].style.display = 'none';
    }
  }

  function run() {
    var grid = document.querySelector('.agents-grid.w-dyn-items') || document.querySelector('.agents-grid');
    if (!grid) return;
    injectLogoStyle();
    cleanDemoCopy();
    var template = grid.querySelector('.w-dyn-item');
    if (!template) return;
    var tplHTML = template.outerHTML;
    grid.innerHTML = '<div id="megga-status" style="padding:24px;grid-column:1/-1">Chargement…</div>';

    var params = new URLSearchParams();
    params.set('select', 'id,name,slug,canton,city,logo_url,website_url');
    params.set('logo_url', 'not.is.null');
    params.set('order', 'name.asc');
    params.set('limit', '90');

    fetch('/api/agencies?' + params.toString())
      .then(function (r) { if (!r.ok) throw new Error('proxy ' + r.status); return r.json(); })
      .then(function (items) {
        grid.innerHTML = '';
        if (!items || !items.length) {
          grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Aucune agence pour le moment.</div>';
          return;
        }
        items.forEach(function (a) {
          var wrap = document.createElement('div');
          wrap.innerHTML = tplHTML;
          var node = wrap.firstElementChild;
          node.style.opacity = '1';
          node.style.transform = 'none';
          grid.appendChild(fillCard(node, a));
        });
      })
      .catch(function (err) {
        console.error('[megga] agencies load failed:', err);
        var msg = (err && err.message) ? err.message : String(err);
        grid.innerHTML = '<div style="padding:24px;grid-column:1/-1">Une erreur est survenue (' + msg + '). Réessayez.</div>';
      });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
