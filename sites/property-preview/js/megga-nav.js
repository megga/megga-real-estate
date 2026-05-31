// Nav/footer "Pages" links → real Swiss listings.
// The Webflow demo nav points to US CMS pages (Los Angeles, Houses, For sale…)
// — 3 of which are demo grids and 6 are dead (404). This rewrites every
// location/category/type link (in the nav dropdown AND the footer) to the real
// Annonces grid (/company-pages/properties.html) with the right filter, and
// redirects direct hits to the 3 surviving demo pages. Marketplace = rent-only
// (buy ≈ 12 listings), types per real inventory (apartment/office/commercial/house).
(function () {
  var BASE = '/company-pages/properties.html';

  // Direct-hit redirects for the 3 demo CMS pages that still exist.
  var PAGE_REDIRECT = {
    '/property-location/los-angeles.html': { p: 'ville', v: 'Genève' },
    '/property-category/houses.html': { p: 'type', v: 'house' },
    '/property-type/for-sale.html': { p: 'transaction', v: 'acheter' },
  };
  function url(p, v) { return p ? BASE + '?' + p + '=' + encodeURIComponent(v) : BASE; }

  var here = location.pathname;
  if (PAGE_REDIRECT[here]) { var r = PAGE_REDIRECT[here]; location.replace(url(r.p, r.v)); return; }

  // Demo link TEXT (lowercased) → real Swiss scope + FR label. Generic English
  // dropdown labels also handled; anything else (e.g. footer "Par localisation")
  // keeps its label and just points to the full Annonces grid.
  var MAP = {
    // by location
    'los angeles': { p: 'ville', v: 'Genève', label: 'Genève' },
    'san francisco': { p: 'ville', v: 'Lausanne', label: 'Lausanne' },
    'san diego': { p: 'ville', v: 'Zürich', label: 'Zürich' },
    'properties by location': { p: '', v: '', label: 'Annonces par ville' },
    // by type of property (mapped to types with real inventory)
    'apartments': { p: 'type', v: 'apartment', label: 'Appartements' },
    'apartament': { p: 'type', v: 'apartment', label: 'Appartements' },
    'houses': { p: 'type', v: 'house', label: 'Maisons' },
    'lofts': { p: 'type', v: 'commercial', label: 'Commerces' },
    'offices': { p: 'type', v: 'office', label: 'Bureaux' },
    'properties by type of property': { p: '', v: '', label: 'Annonces par type' },
    // by transaction (rent-only dataset)
    'for rent': { p: 'transaction', v: 'louer', label: 'À louer' },
    'for sale': { p: 'transaction', v: 'acheter', label: 'À vendre' },
    'properties by type': { p: '', v: '', label: 'Toutes les annonces' },
  };

  function labelEl(a) {
    var div = a.querySelector('div');
    return (div && !div.children.length) ? div : a;
  }

  function run() {
    var sel = 'a[href*="/property-location/"],a[href*="/property-category/"],a[href*="/property-type/"]';
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (a) {
      var el = labelEl(a);
      var txt = (el.textContent || '').trim().toLowerCase();
      var m = MAP[txt];
      if (m) { a.setAttribute('href', url(m.p, m.v)); el.textContent = m.label; }
      else { a.setAttribute('href', BASE); } // generic FR label → all Annonces
    });
    // Tidy the dropdown column title.
    Array.prototype.forEach.call(document.querySelectorAll('.dropodown-title'), function (el) {
      if (/^main pages$/i.test((el.textContent || '').trim())) el.textContent = 'Pages';
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
