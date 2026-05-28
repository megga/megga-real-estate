// Home V3 search: turn the Webflow nav-dropdowns into a real filter form.
// City autocomplete (Swiss list) + Type/Transaction selectors → on submit,
// redirect to the dynamic Properties page with query params.
(function () {
  var TYPE_MAP = { 'Maisons': 'house', 'Appartements': 'apartment',
    'Lofts': 'loft', 'Bureaux': 'office' };
  var TX_MAP = { 'À louer': 'louer', 'À vendre': 'acheter' };

  var state = { city: '', type: '', transaction: 'louer' };

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
      '<input id="megga-city" type="text" autocomplete="off" placeholder="Tapez une ville" ' +
      'style="width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #EEEFF1;' +
      'padding:10px 12px;font:inherit;outline:none">' +
      '<div id="megga-city-suggest" style="max-height:180px;overflow:auto"></div>';
    list.insertBefore(row, list.firstChild);

    var input = row.querySelector('#megga-city');
    var sug = row.querySelector('#megga-city-suggest');

    function choose(name) {
      input.value = name; state.city = name; sug.innerHTML = '';
      var lbl = toggleLabel(dropdown);
      if (lbl) lbl.textContent = name;
    }

    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      state.city = input.value.trim();
      sug.innerHTML = '';
      if (q.length < 2) return;
      (window.CH_CITIES || []).filter(function (c) {
        return c.name.toLowerCase().indexOf(q) === 0;
      }).slice(0, 8).forEach(function (c) {
        var item = document.createElement('div');
        item.textContent = c.name + ' · ' + c.canton;
        item.style.cssText = 'padding:8px 12px;cursor:pointer';
        item.addEventListener('mouseover', function () { item.style.background = '#FAFAFB'; });
        item.addEventListener('mouseout', function () { item.style.background = ''; });
        item.addEventListener('mousedown', function (e) { e.preventDefault(); choose(c.name); });
        sug.appendChild(item);
      });
    });

    // Existing Genève/Lausanne/Zurich quick links → set city instead of navigating.
    dropdown.querySelectorAll('.input-dropdown-list a.link').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.preventDefault();
        choose((opt.querySelector('div') || opt).textContent.trim());
        closeDropdown(dropdown);
      });
    });
  }

  function go(e) {
    if (e) e.preventDefault();
    var params = new URLSearchParams();
    params.set('transaction', state.transaction || 'louer');
    if (state.city) params.set('ville', state.city);
    if (state.type) params.set('type', state.type);
    var q = document.getElementById('search');
    if (q && q.value.trim()) params.set('q', q.value.trim());
    window.location.href = '/company-pages/properties.html?' + params.toString();
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
