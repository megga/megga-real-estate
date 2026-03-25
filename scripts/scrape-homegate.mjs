#!/usr/bin/env node

/**
 * Scrape Homegate via reverse-engineered POST API
 *
 * Uses Playwright to get valid Datadome cookies, then calls
 * POST https://api.homegate.ch/search/listings from the browser context.
 *
 * Strategy:
 * - 26 cantons, each queried separately
 * - Cantons with >1000 results are split by price ranges
 * - Max 100 listings per page, max offset 999
 * - All data upserted into market_listings via Supabase REST API
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-homegate.mjs
 *
 * Options:
 *   DRY_RUN=1         — log without inserting
 *   CANTON=ge         — scrape only one canton (code or name)
 *   DELAY_MS=500      — delay between API calls (default: 300)
 */

import { readFileSync } from 'fs';
import { chromium } from 'playwright';

// ── Load env ────────────────────────────────────────────────

const envPath = '/Users/megga/Desktop/megga-real-estate/.env.local';
const envContent = readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-homegate.mjs');
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_CANTON = process.env.CANTON || null;
const DELAY_MS = parseInt(process.env.DELAY_MS || '300', 10);
const PAGE_SIZE = 100;
const MAX_FROM = 999;

// ── All 26 Swiss cantons with their Homegate geo IDs ─────────

const CANTONS = [
  { geoTag: 'geo-canton-geneve', name: 'Genève', code: 'GE' },
  { geoTag: 'geo-canton-vaud', name: 'Vaud', code: 'VD' },
  { geoTag: 'geo-canton-valais', name: 'Valais', code: 'VS' },
  { geoTag: 'geo-canton-neuchatel', name: 'Neuchâtel', code: 'NE' },
  { geoTag: 'geo-canton-fribourg', name: 'Fribourg', code: 'FR' },
  { geoTag: 'geo-canton-bern', name: 'Berne', code: 'BE' },
  { geoTag: 'geo-canton-jura', name: 'Jura', code: 'JU' },
  { geoTag: 'geo-canton-basel-stadt', name: 'Bâle-Ville', code: 'BS' },
  { geoTag: 'geo-canton-basel-landschaft', name: 'Bâle-Campagne', code: 'BL' },
  { geoTag: 'geo-canton-aargau', name: 'Argovie', code: 'AG' },
  { geoTag: 'geo-canton-solothurn', name: 'Soleure', code: 'SO' },
  { geoTag: 'geo-canton-zurich', name: 'Zurich', code: 'ZH' },
  { geoTag: 'geo-canton-luzern', name: 'Lucerne', code: 'LU' },
  { geoTag: 'geo-canton-zug', name: 'Zoug', code: 'ZG' },
  { geoTag: 'geo-canton-schwyz', name: 'Schwyz', code: 'SZ' },
  { geoTag: 'geo-canton-nidwalden', name: 'Nidwald', code: 'NW' },
  { geoTag: 'geo-canton-obwalden', name: 'Obwald', code: 'OW' },
  { geoTag: 'geo-canton-uri', name: 'Uri', code: 'UR' },
  { geoTag: 'geo-canton-glarus', name: 'Glaris', code: 'GL' },
  { geoTag: 'geo-canton-schaffhausen', name: 'Schaffhouse', code: 'SH' },
  { geoTag: 'geo-canton-thurgau', name: 'Thurgovie', code: 'TG' },
  { geoTag: 'geo-canton-appenzell-ausserrhoden', name: 'Appenzell RE', code: 'AR' },
  { geoTag: 'geo-canton-appenzell-innerrhoden', name: 'Appenzell RI', code: 'AI' },
  { geoTag: 'geo-canton-st-gallen', name: 'Saint-Gall', code: 'SG' },
  { geoTag: 'geo-canton-graubunden', name: 'Grisons', code: 'GR' },
  { geoTag: 'geo-canton-ticino', name: 'Tessin', code: 'TI' },
];

// Price ranges for splitting large cantons (CHF)
const PRICE_SPLITS = [
  [0, 200000],
  [200000, 400000],
  [400000, 600000],
  [600000, 800000],
  [800000, 1000000],
  [1000000, 1500000],
  [1500000, 2000000],
  [2000000, 3000000],
  [3000000, 5000000],
  [5000000, 10000000],
  [10000000, 50000000],
];

// ── Type mapping ─────────────────────────────────────────────

const TYPE_MAP = {
  'APARTMENT': 'apartment', 'FLAT': 'apartment', 'PENTHOUSE': 'apartment',
  'DUPLEX': 'apartment', 'ATTIC_FLAT': 'apartment', 'STUDIO': 'apartment',
  'SINGLE_ROOM': 'apartment', 'LOFT': 'apartment',
  'HOUSE': 'house', 'SINGLE_HOUSE': 'house', 'CHALET': 'house',
  'FARM_HOUSE': 'house', 'TERRACE_HOUSE': 'house', 'BIFAMILIAR_HOUSE': 'house',
  'ROW_HOUSE': 'house', 'MULTI_FAMILY_HOUSE': 'house', 'RUSTICO': 'house',
  'VILLA': 'villa', 'CASTLE': 'villa',
  'BUILDING_LAND': 'land', 'AGRICULTURE': 'land',
  'PARKING': 'commercial', 'COMMERCIAL': 'commercial', 'OFFICE': 'commercial',
  'GASTRONOMY': 'commercial', 'RETAIL': 'commercial', 'INDUSTRIAL': 'commercial',
  'STORAGE': 'commercial',
};

// ── Supabase helpers ─────────────────────────────────────────

async function supabaseBatchUpsert(listings) {
  if (listings.length === 0 || DRY_RUN) return listings.length;

  // Split into chunks of 50 to avoid payload too large
  let total = 0;
  for (let i = 0; i < listings.length; i += 50) {
    const chunk = listings.slice(i, i + 50);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?on_conflict=source_id`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`  ❌ Upsert error: ${resp.status} — ${text.substring(0, 200)}`);
    } else {
      total += chunk.length;
    }
  }
  return total;
}

async function getDbCount() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?select=id&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' },
  });
  const cr = resp.headers.get('content-range');
  return cr ? parseInt(cr.split('/')[1]) : 0;
}

// ── Transform Homegate listing → market_listings row ─────────

function transformListing(item, cantonCode) {
  const listing = item.listing;
  if (!listing) return null;

  const id = String(item.id);
  const chars = listing.characteristics || {};
  const addr = listing.address || {};
  const prices = listing.prices || {};
  const buyPrice = prices.buy?.price || 0;
  if (buyPrice <= 0) return null;

  const meta = listing.meta || {};
  const agent = item.agencyAgent || {};
  const branding = item.listerBranding || {};

  // Localization: prefer FR → DE → EN → IT
  const loc = listing.localization || {};
  const frLoc = loc.fr || loc.de || loc.en || loc.it || {};
  const deLoc = loc.de || {};
  const enLoc = loc.en || {};
  const itLoc = loc.it || {};

  const title = frLoc.text?.title || deLoc.text?.title || '';
  const description = (frLoc.text?.description || deLoc.text?.description || '').substring(0, 5000) || null;
  const descriptionDe = (deLoc.text?.description || '').substring(0, 5000) || null;
  const descriptionEn = (enLoc.text?.description || '').substring(0, 5000) || null;
  const descriptionIt = (itLoc.text?.description || '').substring(0, 5000) || null;

  // Photos
  const attachments = frLoc.attachments || deLoc.attachments || enLoc.attachments || [];
  const photos = attachments.filter(a => a.type === 'IMAGE' && a.url).map(a => a.url).slice(0, 20);

  // Type from categories
  const categories = listing.categories || [];
  let type = 'apartment';
  for (const cat of categories) {
    if (TYPE_MAP[cat]) { type = TYPE_MAP[cat]; break; }
  }

  const canton = addr.region || cantonCode;
  const surface = chars.livingSpace || chars.totalFloorSpace || null;
  const pricePerM2 = (surface && buyPrice) ? Math.round(buyPrice / surface) : null;

  // Features from booleans
  const features = [];
  if (chars.hasBalcony) features.push('balcony');
  if (chars.hasParking) features.push('parking');
  if (chars.hasGarage) features.push('garage');
  if (chars.hasElevator) features.push('elevator');
  if (chars.hasNiceView) features.push('nice_view');
  if (chars.hasFireplace) features.push('fireplace');
  if (chars.hasSwimmingPool) features.push('swimming_pool');
  if (chars.isMinergieGeneral || chars.isMinergieCertified) features.push('minergie');
  if (chars.isNewBuilding) features.push('new_building');
  if (chars.isChildFriendly) features.push('child_friendly');
  if (chars.isWheelchairAccessible) features.push('wheelchair_accessible');
  if (chars.arePetsAllowed) features.push('pets_allowed');
  if (chars.isQuiet) features.push('quiet');

  return {
    source_id: 'hg_' + id,
    source_portal: 'homegate',
    source_url: `https://www.homegate.ch/fr/acheter/${id}`,
    canton,
    city: addr.locality || '',
    postal_code: addr.postalCode || null,
    address: addr.street || '',
    lat: addr.geoCoordinates?.latitude || null,
    lng: addr.geoCoordinates?.longitude || null,
    title: (title || '').substring(0, 500),
    description,
    description_de: descriptionDe,
    description_en: descriptionEn,
    description_it: descriptionIt,
    type,
    transaction_type: 'buy',
    price: buyPrice,
    price_at_first_seen: buyPrice,
    current_price: buyPrice,
    price_per_m2: pricePerM2,
    currency: prices.currency || 'CHF',
    rooms: chars.numberOfRooms || null,
    bedrooms: null,
    bathrooms: chars.numberOfBathrooms || null,
    surface_m2: surface,
    floor: chars.floor || null,
    features: JSON.stringify(features),
    photos,
    photos_count: photos.length,
    year_built: chars.yearBuilt || null,
    year_renovated: chars.yearLastRenovated || null,
    usable_surface: chars.totalFloorSpace || null,
    land_surface: chars.lotSize || null,
    parking_count: (chars.hasParking ? 1 : 0) + (chars.hasGarage ? 1 : 0) || null,
    property_type_detail: categories.join(',') || null,
    has_balcony: chars.hasBalcony || false,
    has_parking: chars.hasParking || false,
    has_garage: chars.hasGarage || false,
    has_elevator: chars.hasElevator || false,
    has_nice_view: chars.hasNiceView || false,
    has_fireplace: chars.hasFireplace || false,
    has_swimming_pool: chars.hasSwimmingPool || false,
    is_minergie: chars.isMinergieGeneral || chars.isMinergieCertified || false,
    is_new_building: chars.isNewBuilding || false,
    is_child_friendly: chars.isChildFriendly || false,
    pets_allowed: chars.arePetsAllowed || false,
    agency_name: null,
    agency_phone: agent.phoneNumber || null,
    agency_contact_name: agent.firstName && agent.lastName ? `${agent.firstName} ${agent.lastName}` : null,
    agency_contact_phone: agent.mobileNumber || agent.phoneNumber || null,
    agency_logo_url: branding?.logoUrl || null,
    agency_reference: agent.headAgencyId || null,
    listing_type: item.listingType?.type || null,
    platforms: listing.platforms || [],
    source_created_at: meta.createdAt || null,
    source_updated_at: meta.updatedAt || null,
    quality_score: 90,
    quality_flags: '[]',
    status: 'active',
  };
}

// ── API call from browser context ────────────────────────────

async function searchListings(page, geoTag, priceFrom, priceTo, from, size) {
  return page.evaluate(async ({ geoTag, priceFrom, priceTo, from, size }) => {
    const query = { offerType: 'BUY', location: { geoTags: [geoTag] } };
    if (priceFrom !== null && priceFrom !== undefined) {
      query.purchasePrice = {};
      if (priceFrom != null) query.purchasePrice.from = priceFrom;
      if (priceTo != null) query.purchasePrice.to = priceTo;
    }
    try {
      const resp = await fetch('https://api.homegate.ch/search/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, from, size, trackTotalHits: true }),
      });
      if (!resp.ok) return { error: resp.status, message: (await resp.text()).substring(0, 200) };
      return resp.json();
    } catch (e) {
      return { error: 'NETWORK', message: e.message };
    }
  }, { geoTag, priceFrom, priceTo, from, size });
}

// ── Scrape one canton ────────────────────────────────────────

async function scrapeCanton(page, canton, stats) {
  const countResult = await searchListings(page, canton.geoTag, null, null, 0, 1);
  if (countResult.error) {
    console.error(`  ❌ ${canton.name}: API error ${countResult.error} — ${countResult.message}`);
    stats.errors++;
    return;
  }

  const total = countResult.total || 0;
  console.log(`\n📍 ${canton.name} (${canton.code}): ${total} biens`);
  if (total === 0) return;

  if (total <= 1000) {
    await scrapeQuery(page, canton, null, null, total, stats);
  } else {
    console.log(`  ⚡ Split par prix (${PRICE_SPLITS.length} tranches)`);
    for (const [priceFrom, priceTo] of PRICE_SPLITS) {
      const rangeResult = await searchListings(page, canton.geoTag, priceFrom, priceTo, 0, 1);
      const rangeTotal = rangeResult.total || 0;
      if (rangeTotal === 0) continue;

      const label = `${(priceFrom / 1000).toFixed(0)}K-${(priceTo / 1000).toFixed(0)}K`;
      if (rangeTotal > 1000) {
        console.log(`  ⚠️  ${label}: ${rangeTotal} > 1000 — cap, max 1000 récupérés`);
      } else {
        console.log(`  💰 ${label}: ${rangeTotal} biens`);
      }
      await scrapeQuery(page, canton, priceFrom, priceTo, rangeTotal, stats);
    }
  }
}

async function scrapeQuery(page, canton, priceFrom, priceTo, total, stats) {
  const maxItems = Math.min(total, MAX_FROM + 1);
  let from = 0;

  while (from < maxItems) {
    const size = Math.min(PAGE_SIZE, maxItems - from);
    const result = await searchListings(page, canton.geoTag, priceFrom, priceTo, from, size);

    if (result.error) {
      console.error(`    ❌ from=${from}: ${result.error}`);
      stats.errors++;
      break;
    }

    const listings = result.results || [];
    if (listings.length === 0) break;

    const rows = [];
    for (const item of listings) {
      const row = transformListing(item, canton.code);
      if (row) rows.push(row);
    }

    stats.fetched += listings.length;

    if (rows.length > 0) {
      const upserted = await supabaseBatchUpsert(rows);
      stats.upserted += upserted;
      process.stdout.write(`    ✓ ${from + listings.length}/${Math.min(total, 1000)} (${rows.length} upserted)\r`);
    }

    from += listings.length;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  SCRAPE HOMEGATE — API reverse-engineered');
  console.log('═'.repeat(60));

  const dbBefore = await getDbCount();
  console.log(`DB actuelle:     ${dbBefore.toLocaleString()} biens`);
  console.log(`Cantons:         ${ONLY_CANTON || '26 (toute la Suisse)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Page size:       ${PAGE_SIZE}`);
  console.log(`Delay:           ${DELAY_MS}ms`);
  console.log('═'.repeat(60));

  console.log('\n🌐 Lancement de VOTRE Chrome (pas Chromium de test)...');
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'fr-CH',
    viewport: { width: 1280, height: 800 },
  });

  // Hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log('🔑 Navigation vers homegate.ch...');
  await page.goto('https://www.homegate.ch/fr', { waitUntil: 'networkidle', timeout: 60000 });

  // Accept cookies if banner appears
  try {
    const acceptBtn = page.locator('button:has-text("Accepter"), button:has-text("accepter"), button:has-text("Accept")').first();
    await acceptBtn.click({ timeout: 5000 });
    console.log('  🍪 Cookies acceptés');
  } catch {
    // No cookie banner
  }

  // Test API call to verify cookies work
  console.log('🧪 Test API...');
  const testResult = await searchListings(page, 'geo-canton-geneve', null, null, 0, 1);
  if (testResult.error) {
    console.log('');
    console.log('⚠️  Datadome CAPTCHA détecté !');
    console.log('👉 Résous le CAPTCHA dans la fenêtre du navigateur');
    console.log('   puis appuie sur ENTRÉE ici pour continuer...');
    console.log('');

    // Wait for user to solve CAPTCHA
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Re-navigate after CAPTCHA
    await page.goto('https://www.homegate.ch/fr', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // Re-test
    const retest = await searchListings(page, 'geo-canton-geneve', null, null, 0, 1);
    if (retest.error) {
      console.error('❌ API toujours bloquée après CAPTCHA. Abandon.');
      await browser.close();
      process.exit(1);
    }
    console.log(`✅ API OK après CAPTCHA — ${retest.total} biens à Genève`);
  } else {
    console.log(`✅ API OK — ${testResult.total} biens à Genève`);
  }

  console.log('');

  const stats = { fetched: 0, upserted: 0, errors: 0 };
  const startTime = Date.now();

  const cantons = ONLY_CANTON
    ? CANTONS.filter(c =>
        c.code.toLowerCase() === ONLY_CANTON.toLowerCase() ||
        c.geoTag.includes(ONLY_CANTON.toLowerCase()) ||
        c.name.toLowerCase().includes(ONLY_CANTON.toLowerCase())
      )
    : CANTONS;

  if (cantons.length === 0) {
    console.error(`Canton "${ONLY_CANTON}" non trouvé`);
    process.exit(1);
  }

  for (const canton of cantons) {
    await scrapeCanton(page, canton, stats);
  }

  await browser.close();

  const dbAfter = await getDbCount();
  const duration = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log(`  TERMINÉ — ${duration} minutes`);
  console.log('═'.repeat(60));
  console.log(`Fetched:         ${stats.fetched.toLocaleString()}`);
  console.log(`Upserted:        ${stats.upserted.toLocaleString()}`);
  console.log(`Errors:          ${stats.errors}`);
  console.log(`DB AVANT:        ${dbBefore.toLocaleString()}`);
  console.log(`DB APRÈS:        ${dbAfter.toLocaleString()}`);
  console.log(`NOUVEAUX:        +${(dbAfter - dbBefore).toLocaleString()}`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
