// Agencies directory (company-pages/agencies.html): fetch agencies through the
// worker proxy (/api/agencies → agency_profiles), clone the demo agent card as a
// template, and render real agencies — logo, name, ville/canton, lien site.
// Search bar (home-hero look) + canton filter + "Charger plus" pagination, all
// client-side over the full set. Reuses the Agents page layout (.agents-grid).
(function () {
  var PAGE = 24;            // cards shown per "page"
  var FETCH_BATCH = 1000;   // PostgREST caps rows per request

  var CANTONS = [
    ['ZH', 'Zurich'], ['BE', 'Berne'], ['LU', 'Lucerne'], ['UR', 'Uri'], ['SZ', 'Schwytz'],
    ['OW', 'Obwald'], ['NW', 'Nidwald'], ['GL', 'Glaris'], ['ZG', 'Zoug'], ['FR', 'Fribourg'],
    ['SO', 'Soleure'], ['BS', 'Bâle-Ville'], ['BL', 'Bâle-Campagne'], ['SH', 'Schaffhouse'],
    ['AR', 'Appenzell RE'], ['AI', 'Appenzell RI'], ['SG', 'Saint-Gall'], ['GR', 'Grisons'],
    ['AG', 'Argovie'], ['TG', 'Thurgovie'], ['TI', 'Tessin'], ['VD', 'Vaud'], ['VS', 'Valais'],
    ['NE', 'Neuchâtel'], ['GE', 'Genève'], ['JU', 'Jura'],
  ];

  var grid, tplHTML, loadMoreBtn, countEl;
  var all = [];
  var state = { search: '', canton: '', shown: PAGE };

  // ── Styles: logos CONTAINED (not face-cropped) + filter bar look ──
  function injectStyle() {
    if (document.getElementById('megga-agency-style')) return;
    var css =
      '.agents-grid .avatar-wrapper.agent-avatar{background:#fff;border-radius:14px;overflow:hidden}' +
      '.agents-grid .avatar-wrapper.agent-avatar img{object-fit:contain!important;padding:14px;background:#fff}' +
      '.megga-filters{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;align-items:center;max-width:720px;margin:0 auto 8px}' +
      '.megga-filters .input-wrapper{flex:1 1 320px;min-width:240px;margin:0}' +
      '.megga-canton{flex:0 0 220px;min-width:180px;height:100%;padding:14px 18px;border:1px solid #EEEFF1;border-radius:100px;background:#fff;font-family:inherit;font-size:15px;color:#100A14;cursor:pointer;appearance:auto}' +
      '.megga-count{flex-basis:100%;text-align:center;color:#85838A;font-size:14px;margin-top:4px}' +
      '.megga-loadmore-wrap{display:flex;justify-content:center;margin-top:48px}';
    var st = document.createElement('style');
    st.id = 'megga-agency-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // ── Filter bar (search input reuses the home-hero pill; canton select) ──
  function buildFilterBar() {
    var bar = document.createElement('div');
    bar.className = 'megga-filters';
    var opts = '<option value="">Tous les cantons</option>' +
      CANTONS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + '</option>'; }).join('');
    bar.innerHTML =
      '<div class="input-wrapper">' +
        '<input id="megga-agency-search" class="input browse-input---first w-input" type="search" ' +
        'placeholder="Rechercher une agence (nom, ville)" autocomplete="off" />' +
        '<div class="primary-button-icon input-inside" aria-hidden="true"><div class="icon-font-rounded"></div></div>' +
      '</div>' +
      '<select id="megga-agency-canton" class="megga-canton" aria-label="Filtrer par canton">' + opts + '</select>' +
      '<div class="megga-count" id="megga-agency-count"></div>';

    var anchor = document.querySelector('.agents-grid') ;
    var host = (anchor.closest('.w-dyn-list') || anchor);
    host.parentNode.insertBefore(bar, host);

    var search = bar.querySelector('#megga-agency-search');
    var canton = bar.querySelector('#megga-agency-canton');
    countEl = bar.querySelector('#megga-agency-count');
    search.addEventListener('input', debounce(function () {
      state.search = search.value.trim().toLowerCase();
      state.shown = PAGE; applyAndRender();
    }, 160));
    canton.addEventListener('change', function () {
      state.canton = canton.value; state.shown = PAGE; applyAndRender();
    });

    loadMoreBtn = document.createElement('button');
    loadMoreBtn.type = 'button';
    loadMoreBtn.className = 'button-secondary w-button';
    loadMoreBtn.textContent = 'Charger plus de résultats';
    loadMoreBtn.style.cssText = 'cursor:pointer';
    loadMoreBtn.addEventListener('click', function () { state.shown += PAGE; applyAndRender(); });
    var wrap = document.createElement('div');
    wrap.className = 'megga-loadmore-wrap';
    wrap.appendChild(loadMoreBtn);
    host.parentNode.insertBefore(wrap, host.nextSibling);
  }

  function fillCard(node, a) {
    // Card → the agency detail page (the agent-single template, ?id-driven).
    var href = '/agent/john-carter.html?id=' + encodeURIComponent(a.id);
    var links = node.querySelectorAll('a.agent-card, a.primary-button-icon');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('href', href);
      links[i].removeAttribute('target');
      links[i].removeAttribute('rel');
    }

    var img = node.querySelector('.avatar-wrapper.agent-avatar img');
    if (img) {
      img.removeAttribute('srcset');
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.alt = a.name || 'Agence';
      img.onerror = function () {
        img.style.display = 'none';
        var w = img.closest('.avatar-wrapper');
        if (w) w.style.background = '#EEEFF1';
      };
      if (a.logo_url) img.src = a.logo_url; else img.onerror();
    }
    var name = node.querySelector('h2.title');
    if (name) name.textContent = a.name || 'Agence';
    var sub = node.querySelector('.mg-top-extra-small div');
    if (sub) sub.textContent = [a.city, a.canton].filter(Boolean).join(' · ') || 'Agence immobilière';
    var bottom = node.querySelector('.agent-card-links');
    if (bottom) bottom.style.display = 'none';
    return node;
  }

  function applyFilters() {
    var q = state.search, c = state.canton;
    return all.filter(function (a) {
      if (c && a.canton !== c) return false;
      if (q) {
        var hay = ((a.name || '') + ' ' + (a.city || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function applyAndRender() {
    var filtered = applyFilters();
    var visible = filtered.slice(0, state.shown);
    grid.innerHTML = '';
    if (!filtered.length) {
      grid.innerHTML = '<div style="padding:24px;grid-column:1/-1;text-align:center;color:#85838A">Aucune agence ne correspond à votre recherche.</div>';
    } else {
      visible.forEach(function (a) {
        var wrap = document.createElement('div');
        wrap.innerHTML = tplHTML;
        var node = wrap.firstElementChild;
        node.style.opacity = '1';
        node.style.transform = 'none';
        grid.appendChild(fillCard(node, a));
      });
    }
    refreshMeta(filtered);
  }

  function refreshMeta(filtered) {
    filtered = filtered || applyFilters();
    var vis = Math.min(state.shown, filtered.length);
    if (countEl) {
      countEl.textContent = filtered.length
        ? (filtered.length + ' agence' + (filtered.length > 1 ? 's' : '') +
            (state.shown < filtered.length ? ' · ' + vis + ' affichées' : ''))
        : '';
    }
    if (loadMoreBtn) loadMoreBtn.parentNode.style.display = (state.shown < filtered.length) ? 'flex' : 'none';
  }

  function fetchBatch(offset) {
    var params = new URLSearchParams();
    params.set('select', 'id,name,slug,canton,city,logo_url,website_url');
    params.set('logo_url', 'not.is.null');
    params.set('order', 'name.asc');
    params.set('limit', String(FETCH_BATCH));
    params.set('offset', String(offset));
    return fetch('/api/agencies?' + params.toString())
      .then(function (r) { if (!r.ok) throw new Error('proxy ' + r.status); return r.json(); });
  }

  // Progressive load: paint the first batch immediately, then keep fetching the
  // rest in the background so the grid + filters cover the full set.
  function loadAll(offset) {
    fetchBatch(offset)
      .then(function (rows) {
        if (!Array.isArray(rows)) rows = [];
        var firstPaint = all.length === 0;
        all = all.concat(rows);
        var more = rows.length === FETCH_BATCH && all.length < 8000;
        if (firstPaint || !more) applyAndRender();
        else refreshMeta();
        if (more) loadAll(offset + FETCH_BATCH);
      })
      .catch(function (err) {
        if (!all.length) {
          console.error('[megga] agencies load failed:', err);
          var msg = (err && err.message) ? err.message : String(err);
          grid.innerHTML = '<div style="padding:24px;grid-column:1/-1;text-align:center">Une erreur est survenue (' + msg + '). Réessayez.</div>';
        }
      });
  }

  function run() {
    grid = document.querySelector('.agents-grid.w-dyn-items') || document.querySelector('.agents-grid');
    if (!grid) return;
    var template = grid.querySelector('.w-dyn-item');
    if (!template) return;
    tplHTML = template.outerHTML;

    injectStyle();
    // Hide leftover "Lorem ipsum" placeholders from the agents template.
    var ps = document.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
      if (/^\s*Lorem ipsum/i.test(ps[i].textContent)) ps[i].style.display = 'none';
    }
    buildFilterBar();
    grid.innerHTML = '<div id="megga-status" style="padding:24px;grid-column:1/-1;text-align:center;color:#85838A">Chargement…</div>';
    loadAll(0);
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
