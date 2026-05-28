# V3 Search → Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static Home V3 search bar query real Supabase rentals and render them on a dynamic Properties page, with a Swiss-cities autocomplete in the Localisation dropdown.

**Architecture:** Static site (`sites/property-preview`) calls Supabase PostgREST (`/rest/v1/market_listings`) directly from the browser with the public anon key (no React, no build). The home search redirects to `company-pages/properties.html?...`; that page reads URL params, fetches listings, and renders cards by cloning the existing card template. A trigram index on `city` keeps the filter fast.

**Tech Stack:** Vanilla JS (ES2017, no bundler), Supabase PostgREST + pg_trgm, static HTML.

> Verification note: this is a static site with no JS test runner. "Tests" = curl against PostgREST + a headless browser check via the webapp-testing skill (local `python3 -m http.server --directory sites/property-preview`). Commit after each task.

---

## File Structure

- Create `sites/property-preview/js/ch-cities.js` — `window.CH_CITIES` array.
- Create `sites/property-preview/js/megga-supabase.js` — `window.MeggaSupabase.fetchListings()`.
- Create `sites/property-preview/js/megga-search.js` — home: autocomplete + submit→redirect.
- Create `sites/property-preview/js/megga-properties.js` — properties: params→fetch→render.
- Create `supabase/migrations/<ts>_market_listings_city_trgm.sql` — city index.
- Modify `sites/property-preview/index.html` + `home-pages/home-v3.html` — inject city input + `<script>` tags.
- Modify `sites/property-preview/company-pages/properties.html` — `<script>` tags + clear-on-load hook.

---

## Task 1: Supabase city index (migration)

**Files:**
- Create: `supabase/migrations/20260527120000_market_listings_city_trgm.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Trigram index on market_listings.city so the V3 search can filter rentals by
-- city (ILIKE prefix) without a seq scan on ~59k active rows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_ml_rent_active_city_trgm
  ON market_listings USING gin (city gin_trgm_ops)
  WHERE transaction_type = 'rent' AND status = 'active';
```

- [ ] **Step 2: Verify SQL is idempotent**

Read the file; confirm `IF NOT EXISTS` on both the extension and the index. The deploy
workflow replays today's migrations, so it must be safe to re-run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527120000_market_listings_city_trgm.sql
git commit -m "feat(db): trigram index on market_listings.city for V3 search"
```

> The index is applied by `.github/workflows/deploy.yml` (Management API) on merge to main. No local DB apply needed.

---

## Task 2: Swiss cities list (`ch-cities.js`)

**Files:**
- Create: `sites/property-preview/js/ch-cities.js`

- [ ] **Step 1: Write the curated list**

```js
// Curated Swiss cities/communes for the Localisation autocomplete.
// name must match the spelling used in market_listings.city where possible.
window.CH_CITIES = [
  { name: 'Genève', canton: 'GE' }, { name: 'Carouge', canton: 'GE' },
  { name: 'Meyrin', canton: 'GE' }, { name: 'Vernier', canton: 'GE' },
  { name: 'Lancy', canton: 'GE' }, { name: 'Lausanne', canton: 'VD' },
  { name: 'Montreux', canton: 'VD' }, { name: 'Nyon', canton: 'VD' },
  { name: 'Morges', canton: 'VD' }, { name: 'Vevey', canton: 'VD' },
  { name: 'Yverdon-les-Bains', canton: 'VD' }, { name: 'Renens', canton: 'VD' },
  { name: 'Zürich', canton: 'ZH' }, { name: 'Winterthur', canton: 'ZH' },
  { name: 'Uster', canton: 'ZH' }, { name: 'Dübendorf', canton: 'ZH' },
  { name: 'Bern', canton: 'BE' }, { name: 'Biel/Bienne', canton: 'BE' },
  { name: 'Thun', canton: 'BE' }, { name: 'Köniz', canton: 'BE' },
  { name: 'Basel', canton: 'BS' }, { name: 'Riehen', canton: 'BS' },
  { name: 'Lugano', canton: 'TI' }, { name: 'Bellinzona', canton: 'TI' },
  { name: 'Locarno', canton: 'TI' }, { name: 'Chiasso', canton: 'TI' },
  { name: 'Luzern', canton: 'LU' }, { name: 'St. Gallen', canton: 'SG' },
  { name: 'Rapperswil-Jona', canton: 'SG' }, { name: 'Fribourg', canton: 'FR' },
  { name: 'Bulle', canton: 'FR' }, { name: 'Neuchâtel', canton: 'NE' },
  { name: 'La Chaux-de-Fonds', canton: 'NE' }, { name: 'Sion', canton: 'VS' },
  { name: 'Sierre', canton: 'VS' }, { name: 'Martigny', canton: 'VS' },
  { name: 'Monthey', canton: 'VS' }, { name: 'Zug', canton: 'ZG' },
  { name: 'Aarau', canton: 'AG' }, { name: 'Baden', canton: 'AG' },
  { name: 'Wettingen', canton: 'AG' }, { name: 'Schaffhausen', canton: 'SH' },
  { name: 'Chur', canton: 'GR' }, { name: 'Davos', canton: 'GR' },
  { name: 'Frauenfeld', canton: 'TG' }, { name: 'Kreuzlingen', canton: 'TG' },
  { name: 'Solothurn', canton: 'SO' }, { name: 'Olten', canton: 'SO' },
  { name: 'Schwyz', canton: 'SZ' }, { name: 'Delémont', canton: 'JU' },
  { name: 'Liestal', canton: 'BL' }, { name: 'Herisau', canton: 'AR' },
  { name: 'Stans', canton: 'NW' }, { name: 'Sarnen', canton: 'OW' },
  { name: 'Altdorf', canton: 'UR' }, { name: 'Glarus', canton: 'GL' },
  { name: 'Appenzell', canton: 'AI' },
];
```

- [ ] **Step 2: Commit**

```bash
git add sites/property-preview/js/ch-cities.js
git commit -m "feat(search): curated Swiss cities list for autocomplete"
```

---

## Task 3: Supabase fetch helper (`megga-supabase.js`)

**Files:**
- Create: `sites/property-preview/js/megga-supabase.js`

> Get the anon key value from `src/lib/supabase.ts` (the hardcoded fallback `eyJ...`) and paste it as `ANON_KEY` below.

- [ ] **Step 1: Write the helper**

```js
// Browser-side Supabase reader for the static marketplace. Anon key is PUBLIC
// (RLS-protected) — same key the React app ships.
window.MeggaSupabase = (function () {
  const BASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1';
  const ANON_KEY = '<PASTE anon key from src/lib/supabase.ts>';

  // filters: { transaction: 'louer'|'acheter', city, type, offset, limit }
  async function fetchListings(filters) {
    const f = filters || {};
    const tx = f.transaction === 'acheter' ? 'buy' : 'rent';
    const limit = f.limit || 24;
    const offset = f.offset || 0;
    const cols = [
      'id', 'title', 'price', 'rent', 'current_price', 'address', 'city',
      'canton', 'postal_code', 'rooms', 'bedrooms', 'surface_m2', 'photos',
      'source_url', 'transaction_type',
    ].join(',');
    const params = new URLSearchParams();
    params.set('select', cols);
    params.set('transaction_type', 'eq.' + tx);
    params.set('status', 'eq.active');
    params.set('quality_score', 'gte.50');
    if (f.city) params.set('city', 'ilike.' + f.city + '%');
    if (f.type) params.set('type', 'eq.' + f.type);
    params.set('order', 'created_at.desc');

    const res = await fetch(BASE_URL + '/market_listings?' + params.toString(), {
      headers: {
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + ANON_KEY,
        Range: offset + '-' + (offset + limit - 1), // page without exact count
      },
    });
    if (!res.ok) throw new Error('Supabase ' + res.status);
    return res.json();
  }

  function formatCHF(n) {
    const v = Number(n);
    if (!v || isNaN(v)) return 'CHF —';
    return 'CHF ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  return { BASE_URL, ANON_KEY, fetchListings, formatCHF };
})();
```

- [ ] **Step 2: Verify the query shape against live data**

Run (replace KEY):
```bash
KEY=$(grep -oE "eyJ[A-Za-z0-9._-]{100,}" src/lib/supabase.ts | head -1)
curl -s "https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1/market_listings?select=id,title,rent,city,rooms,surface_m2,photos&transaction_type=eq.rent&status=eq.active&quality_score=gte.50&city=ilike.Gen%25&order=created_at.desc" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Range: 0-2" | python3 -m json.tool | head -40
```
Expected: 1-3 JSON rentals in/near Genève with title, rent, rooms, photos.

- [ ] **Step 3: Commit**

```bash
git add sites/property-preview/js/megga-supabase.js
git commit -m "feat(search): browser Supabase fetch helper for listings"
```

---

## Task 4: Home search wiring (`megga-search.js`)

**Files:**
- Create: `sites/property-preview/js/megga-search.js`

Context (existing markup in `index.html` / `home-v3.html`):
- Search input: `<input id="search" name="query" placeholder="Rechercher un bien">`, submit: `input.primary-button-icon` inside `form.form.w-form`.
- Localisation dropdown: `<div class="input-dropdown w-dropdown">` → toggle `<div class="input-dropdown-toggle first w-dropdown-toggle"><div>Localisation</div>...`, list `<nav class="input-dropdown-list w-dropdown-list">`. Type/Transaction dropdowns have the same structure with toggles "Type de bien"/"Transaction".

- [ ] **Step 1: Write the module**

```js
// Home V3 search: city autocomplete + read dropdown selections + redirect to the
// dynamic Properties page with query params.
(function () {
  const TYPE_MAP = { 'Maisons': 'house', 'Appartements': 'apartment',
    'Lofts': 'loft', 'Bureaux': 'office' };

  function dropdownByLabel(label) {
    const toggles = document.querySelectorAll('.input-dropdown-toggle');
    for (const t of toggles) {
      const d = t.querySelector('div');
      if (d && (d.dataset.megga === label || d.textContent.trim() === label ||
                d.dataset.label === label)) return t.closest('.input-dropdown');
    }
    return null;
  }

  // Track current selection per dropdown via the toggle's first <div> text.
  function selectedText(dropdown) {
    const d = dropdown && dropdown.querySelector('.input-dropdown-toggle > div');
    return d ? d.textContent.trim() : '';
  }

  function init() {
    const locDropdown = (function () {
      // first dropdown after the search form is Localisation
      return document.querySelector('.input-dropdown');
    })();
    if (!locDropdown) return;

    // Inject a city <input> as the first row of the Localisation list.
    const list = locDropdown.querySelector('.input-dropdown-list');
    const cityRow = document.createElement('div');
    cityRow.className = 'megga-city-row';
    cityRow.innerHTML =
      '<input id="megga-city" type="text" autocomplete="off" placeholder="Tapez une ville" ' +
      'style="width:100%;border:0;border-bottom:1px solid #EEEFF1;padding:10px 12px;' +
      'font:inherit;outline:none">' +
      '<div id="megga-city-suggest" style="max-height:180px;overflow:auto"></div>';
    list.insertBefore(cityRow, list.firstChild);

    const input = cityRow.querySelector('#megga-city');
    const sug = cityRow.querySelector('#megga-city-suggest');
    let chosenCity = '';

    input.addEventListener('input', function () {
      const q = input.value.trim().toLowerCase();
      sug.innerHTML = '';
      chosenCity = input.value.trim();
      if (q.length < 2) return;
      (window.CH_CITIES || []).filter(c => c.name.toLowerCase().startsWith(q))
        .slice(0, 8).forEach(c => {
          const item = document.createElement('div');
          item.textContent = c.name + ' · ' + c.canton;
          item.style.cssText = 'padding:8px 12px;cursor:pointer';
          item.addEventListener('mousedown', function (e) {
            e.preventDefault();
            input.value = c.name; chosenCity = c.name; sug.innerHTML = '';
            const toggle = locDropdown.querySelector('.input-dropdown-toggle > div');
            if (toggle) toggle.textContent = c.name;
          });
          sug.appendChild(item);
        });
    });

    function go(e) {
      if (e) e.preventDefault();
      const typeLabel = selectedText(dropdownByLabel('Type de bien'));
      const txLabel = selectedText(dropdownByLabel('Transaction'));
      const params = new URLSearchParams();
      params.set('transaction', txLabel === 'À vendre' ? 'acheter' : 'louer');
      if (chosenCity) params.set('ville', chosenCity);
      if (TYPE_MAP[typeLabel]) params.set('type', TYPE_MAP[typeLabel]);
      const q = document.getElementById('search');
      if (q && q.value.trim()) params.set('q', q.value.trim());
      window.location.href = 'company-pages/properties.html?' + params.toString();
    }

    const form = document.querySelector('form.form.w-form');
    if (form) form.addEventListener('submit', go);
    const submit = document.querySelector('.primary-button-icon.input-inside');
    if (submit) submit.addEventListener('click', go);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 2: Commit**

```bash
git add sites/property-preview/js/megga-search.js
git commit -m "feat(search): home city autocomplete + redirect to Properties"
```

---

## Task 5: Load the search scripts on the home

**Files:**
- Modify: `sites/property-preview/index.html` (before `</body>`)
- Modify: `sites/property-preview/home-pages/home-v3.html` (before `</body>`)

- [ ] **Step 1: Add the script tags**

In each file, immediately before `</body>`, insert (paths are relative to the file —
both use `../`-clamped roots, so use the relative prefix already used by other
`<img src="../images/...">` on that page; for `index.html` the working prefix is also `../`):

```html
<script src="../js/ch-cities.js"></script>
<script src="../js/megga-supabase.js"></script>
<script src="../js/megga-search.js"></script>
```

- [ ] **Step 2: Verify locally (autocomplete + redirect)**

Serve and check with the webapp-testing skill:
```bash
python3 -m http.server 8099 --directory sites/property-preview &
```
Use a headless browser: open `http://localhost:8099/index.html`, open the
Localisation dropdown, type "Gen" → expect "Genève · GE" suggestion; click it;
click the search submit → URL becomes `.../company-pages/properties.html?transaction=louer&ville=Gen%C3%A8ve`.

- [ ] **Step 3: Commit**

```bash
git add sites/property-preview/index.html sites/property-preview/home-pages/home-v3.html
git commit -m "feat(search): wire search scripts into Home V3"
```

---

## Task 6: Properties page renderer (`megga-properties.js`)

**Files:**
- Create: `sites/property-preview/js/megga-properties.js`

Context: grid container `.grid-2-columns.properties-grid---v1.w-dyn-items`; each card is a
`.w-dyn-item` containing `a.property-wrapper-v1[href]`, `img.cover-image`, a badge
`.property-badge .text-fix div`, and a bottom block `.property-card-bottom-content-v1`
with the title `h2/h3`, address, and rooms/surface. We clone the first existing card as a
template, then fill it.

- [ ] **Step 1: Write the module**

```js
// Properties page: read URL params, fetch listings, render real cards by cloning
// the existing demo card as a template.
(function () {
  function qp(name) { return new URLSearchParams(location.search).get(name) || ''; }

  function fillCard(node, item) {
    const M = window.MeggaSupabase;
    const a = node.querySelector('a.property-wrapper-v1');
    if (a) a.setAttribute('href', '../property/luxury-loft-in-san-francisco.html?id=' + item.id);
    const img = node.querySelector('img.cover-image');
    const photo = (item.photos && item.photos[0]) || '';
    if (img && photo) { img.src = photo; img.alt = item.title || 'Bien'; img.removeAttribute('srcset'); }
    // badge
    const badge = node.querySelector('.property-badge .text-fix div');
    if (badge) badge.textContent = item.transaction_type === 'buy' ? 'À vendre' : 'À louer';
    // title
    const title = node.querySelector('.property-card-bottom-content-v1 h2, .property-card-bottom-content-v1 h3');
    if (title) title.textContent = item.title || ((item.rooms || '?') + ' pièces · ' + (item.city || ''));
    // price: replace the first element that looks like a price/amount
    const price = node.querySelector('.property-card-bottom-content-v1 .display-4, .property-card-bottom-content-v1 .text-titles, .property-card-bottom-content-v1 [class*="price"]');
    const amount = item.rent || item.price || item.current_price;
    if (price) price.textContent = M.formatCHF(amount) + (item.transaction_type === 'buy' ? '' : '/mois');
    // meta lines: address + city, rooms, surface — set any address div
    node.querySelectorAll('.property-card-bottom-content-v1 div').forEach(function (d) {
      const t = d.textContent.trim();
      if (/Rd|St|Segundo|SF|Los Angeles|,/.test(t) && !d.children.length) {
        d.textContent = (item.address ? item.address + ', ' : '') + (item.postal_code || '') + ' ' + (item.city || '');
      }
    });
    return node;
  }

  async function run() {
    const grid = document.querySelector('.grid-2-columns.properties-grid---v1.w-dyn-items');
    if (!grid) return;
    const template = grid.querySelector('.w-dyn-item');
    if (!template) return;
    const tplHTML = template.outerHTML;
    grid.innerHTML = '<div id="megga-status" style="padding:24px">Chargement…</div>';

    try {
      const items = await window.MeggaSupabase.fetchListings({
        transaction: qp('transaction'), city: qp('ville'), type: qp('type'), limit: 24,
      });
      grid.innerHTML = '';
      if (!items.length) {
        grid.innerHTML = '<div style="padding:24px">Aucun bien pour ces critères. Essayez une autre ville.</div>';
        return;
      }
      items.forEach(function (it) {
        const wrap = document.createElement('div');
        wrap.innerHTML = tplHTML;
        const node = wrap.firstElementChild;
        node.style.opacity = '1'; node.style.transform = 'none';
        grid.appendChild(fillCard(node, it));
      });
    } catch (err) {
      grid.innerHTML = '<div style="padding:24px">Une erreur est survenue. Réessayez.</div>';
    }
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
```

- [ ] **Step 2: Commit**

```bash
git add sites/property-preview/js/megga-properties.js
git commit -m "feat(search): dynamic Properties renderer from Supabase"
```

---

## Task 7: Load the renderer on the Properties page

**Files:**
- Modify: `sites/property-preview/company-pages/properties.html` (before `</body>`)

- [ ] **Step 1: Add the script tags**

Before `</body>`:
```html
<script src="../js/megga-supabase.js"></script>
<script src="../js/megga-properties.js"></script>
```

- [ ] **Step 2: Verify end-to-end**

Serve (Task 5) and open
`http://localhost:8099/company-pages/properties.html?transaction=louer&ville=Gen%C3%A8ve`
in a headless browser. Expected: real Genève rentals render (photos, titles, CHF prices,
"À louer" badges). Then open `...?ville=ZzzNoSuchCity` → expect the empty-state message.
Screenshot both for the report.

- [ ] **Step 3: Commit**

```bash
git add sites/property-preview/company-pages/properties.html
git commit -m "feat(search): wire dynamic renderer into Properties page"
```

---

## Task 8: Full-flow verification + push

- [ ] **Step 1: Home → Properties round trip**

Headless browser: home → type "Lausanne" → submit → confirm Properties shows Lausanne
rentals. Confirm CHF apostrophe format (e.g. `CHF 1'850`) and `m²` on surfaces.

- [ ] **Step 2: Perf sanity (city filter uses the index)**

```bash
KEY=$(grep -oE "eyJ[A-Za-z0-9._-]{100,}" src/lib/supabase.ts | head -1)
time curl -s -o /dev/null "https://eayczugyrvmtqnnmvjod.supabase.co/rest/v1/market_listings?select=id&transaction_type=eq.rent&status=eq.active&quality_score=gte.50&city=ilike.Lausanne%25&order=created_at.desc" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Range: 0-23"
```
Expected: fast (<1s) response. (Index lands when the migration deploys to main.)

- [ ] **Step 3: Push the branch**

```bash
git push -u origin claude/upbeat-cray-R7Crw
```

---

## Out of scope (phase 2)

- Dynamic V3 single property page (`/property/...?id=`) — cards link to it but it stays
  static until phase 2.
- "Acheter" activation (real buy inventory), advanced filters (rooms/price), result SEO/hreflang.
