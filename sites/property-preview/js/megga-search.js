// Home V3 search: turn the Webflow nav-dropdowns into a real filter form.
// City autocomplete (Swiss list) + Type/Transaction selectors → on submit,
// redirect to the dynamic Properties page with query params.
(function () {
  var TYPE_MAP = { 'Maisons': 'house', 'Appartements': 'apartment',
    'Lofts': 'loft', 'Bureaux': 'office' };
  var TX_MAP = { 'À louer': 'louer', 'À vendre': 'acheter' };

  // scope: '' | 'city' | 'canton'. value is the canonical city name or canton code.
  var state = { scope: '', value: '', label: '', type: '', transaction: 'louer' };

  function toggleLabel(dropdown) {
    return dropdown.querySelector('.input-dropdown-toggle > div');
  }
  function labelText(dropdown) {
    var d = toggleLabel(dropdown);
    return d ? d.textContent.trim() : '';
  }
  function closeDropdown(dropdown) {
    var t = dropdown.querySelector('.w-dropdown-toggle');
    var list = dropdown.querySelector('.w-dropdown-list');
    dropdown.classList.remove('w--open');
    if (t) { t.classList.remove('w--open'); t.setAttribute('aria-expanded', 'false'); }
    if (list) list.classList.remove('w--open');
  }

  function findDropdowns() {
    var map = {};
    document.querySelectorAll('.input-dropdown').forEach(function (dd) {
      var label = labelText(dd);
      if (label === 'Localisation') map.loc = dd;
      else if (label === 'Type de bien') map.type = dd;
      else if (label === 'Transaction') map.tx = dd;
    });
    return map;
  }

  function setupSelector(dropdown, valueMap, stateKey) {
    if (!dropdown) return;
    dropdown.querySelectorAll('.input-dropdown-list a.link').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.preventDefault();
        var txt = (opt.querySelector('div') || opt).textContent.trim();
        state[stateKey] = valueMap[txt] || '';
        var lbl = toggleLabel(dropdown);
        if (lbl) lbl.textContent = txt;
        closeDropdown(dropdown);
      });
    });
  }

  function setupCity(dropdown) {
    if (!dropdown) return;
    var list = dropdown.querySelector('.input-dropdown-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'megga-city-row';
    row.innerHTML =
      '<input id="megga-city" type="text" autocomplete="off" placeholder="Ville ou canton" ' +
      'style="width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #EEEFF1;' +
      'padding:10px 12px;font:inherit;outline:none">' +
      '<div id="megga-city-suggest" style="max-height:240px;overflow:auto"></div>';
    list.insertBefore(row, list.firstChild);

    var input = row.querySelector('#megga-city');
    var sug = row.querySelector('#megga-city-suggest');

    function pickCity(c) {
      state.scope = 'city'; state.value = c.name; state.label = c.name + ' · ' + c.canton;
      input.value = c.name; sug.innerHTML = '';
      var lbl = toggleLabel(dropdown);
      if (lbl) lbl.textContent = c.name;
    }
    function pickCanton(k) {
      state.scope = 'canton'; state.value = k.code; state.label = k.name + ' (canton)';
      input.value = k.name; sug.innerHTML = '';
      var lbl = toggleLabel(dropdown);
      if (lbl) lbl.textContent = k.name + ' · canton';
    }

    function renderSuggestion(text, kind, onPick) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;gap:12px';
      var left = document.createElement('span'); left.textContent = text;
      var right = document.createElement('span');
      right.textContent = kind;
      right.style.cssText = 'opacity:.55;font-size:.85em';
      item.appendChild(left); item.appendChild(right);
      item.addEventListener('mouseover', function () { item.style.background = '#FAFAFB'; });
      item.addEventListener('mouseout', function () { item.style.background = ''; });
      item.addEventListener('mousedown', function (e) { e.preventDefault(); onPick(); });
      sug.appendChild(item);
    }

    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('input', function () {
      var raw = input.value.trim();
      var q = raw.toLowerCase();
      // While typing freely, capture the value as a city fallback (server will
      // try eq.<value>); a confirmed pick overrides this below.
      state.scope = 'city'; state.value = raw; state.label = raw;
      sug.innerHTML = '';
      if (q.length < 2) return;

      // Cantons first (smaller set, broader scope — usually the more useful match).
      var cantons = (window.CH_CANTONS || []).filter(function (k) {
        return k.code.toLowerCase().indexOf(q) === 0 || k.name.toLowerCase().indexOf(q) === 0;
      }).slice(0, 3);
      cantons.forEach(function (k) {
        renderSuggestion(k.name, 'canton', function () { pickCanton(k); });
      });

      // Cities: prefix match on canonical name OR any variant (catches "lausanne",
      // "yverdon-les-bains" typed lowercase, etc.).
      var cities = (window.CH_CITIES || []).filter(function (c) {
        if (c.name.toLowerCase().indexOf(q) === 0) return true;
        for (var i = 0; i < (c.variants || []).length; i++) {
          if (c.variants[i].toLowerCase().indexOf(q) === 0) return true;
        }
        return false;
      }).slice(0, 8);
      cities.forEach(function (c) {
        renderSuggestion(c.name, c.canton, function () { pickCity(c); });
      });
    });

    // Quick links inside the dropdown (Genève / Lausanne / Zürich) → treat as city pick.
    dropdown.querySelectorAll('.input-dropdown-list a.link').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.preventDefault();
        var name = (opt.querySelector('div') || opt).textContent.trim();
        var match = (window.CH_FIND_CITY && window.CH_FIND_CITY(name)) ||
                    { name: name, canton: '', variants: [name] };
        pickCity(match);
        closeDropdown(dropdown);
      });
    });
  }

  function go(e) {
    if (e) e.preventDefault();
    var params = new URLSearchParams();
    params.set('transaction', state.transaction || 'louer');
    if (state.scope === 'canton' && state.value) params.set('canton', state.value);
    else if (state.scope === 'city' && state.value) params.set('ville', state.value);
    if (state.type) params.set('type', state.type);
    var q = document.getElementById('search');
    if (q && q.value.trim()) params.set('q', q.value.trim());
    window.location.href = '/company-pages/properties?' + params.toString();
  }

  function init() {
    var dd = findDropdowns();
    setupCity(dd.loc);
    setupSelector(dd.type, TYPE_MAP, 'type');
    setupSelector(dd.tx, TX_MAP, 'transaction');

    var form = document.querySelector('form.form.w-form');
    if (form) form.addEventListener('submit', go);
    var submit = document.querySelector('.primary-button-icon.input-inside');
    if (submit) submit.addEventListener('click', go);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
