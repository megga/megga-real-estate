#!/usr/bin/env node

/**
 * Bridge server: receives Homegate listings from Chrome and upserts to Supabase
 *
 * 1. Start this script in the terminal
 * 2. Open homegate.ch in Chrome
 * 3. Paste the scraper script in Chrome console
 * 4. Chrome fetches from Homegate API → sends to this bridge → upserts to Supabase
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/hg-bridge.mjs
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';

// ── Load env ─────────────────────────────────────────────────
const envPath = '/Users/megga/Desktop/megga-real-estate/.env.local';
const envContent = readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/hg-bridge.mjs');
  process.exit(1);
}

// ── Type mapping ─────────────────────────────────────────────
const TYPE_MAP = {
  'APARTMENT':'apartment','FLAT':'apartment','PENTHOUSE':'apartment',
  'DUPLEX':'apartment','ATTIC_FLAT':'apartment','STUDIO':'apartment',
  'SINGLE_ROOM':'apartment','LOFT':'apartment',
  'HOUSE':'house','SINGLE_HOUSE':'house','CHALET':'house',
  'FARM_HOUSE':'house','TERRACE_HOUSE':'house','BIFAMILIAR_HOUSE':'house',
  'ROW_HOUSE':'house','MULTI_FAMILY_HOUSE':'house','RUSTICO':'house',
  'VILLA':'villa','CASTLE':'villa',
  'BUILDING_LAND':'land','AGRICULTURE':'land',
  'PARKING':'commercial','COMMERCIAL':'commercial','OFFICE':'commercial',
  'GASTRONOMY':'commercial','RETAIL':'commercial','INDUSTRIAL':'commercial',
  'STORAGE':'commercial',
};

// ── Transform ────────────────────────────────────────────────
function transform(item, cantonCode) {
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
  const loc = listing.localization || {};
  const frLoc = loc.fr || loc.de || loc.en || loc.it || {};
  const deLoc = loc.de || {};
  const enLoc = loc.en || {};
  const itLoc = loc.it || {};

  const title = frLoc.text?.title || deLoc.text?.title || '';
  const description = (frLoc.text?.description || deLoc.text?.description || '').substring(0, 5000) || null;

  const attachments = frLoc.attachments || deLoc.attachments || enLoc.attachments || [];
  const photos = attachments.filter(a => a.type === 'IMAGE' && a.url).map(a => a.url).slice(0, 20);

  const categories = listing.categories || [];
  let type = 'apartment';
  for (const cat of categories) { if (TYPE_MAP[cat]) { type = TYPE_MAP[cat]; break; } }

  const surface = chars.livingSpace || chars.totalFloorSpace || null;
  const pricePerM2 = (surface && buyPrice) ? Math.round(buyPrice / surface) : null;

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
    source_id: 'hg_' + id, source_portal: 'homegate',
    source_url: `https://www.homegate.ch/fr/acheter/${id}`,
    canton: addr.region || cantonCode, city: addr.locality || '',
    postal_code: addr.postalCode || null, address: addr.street || '',
    lat: addr.geoCoordinates?.latitude || null, lng: addr.geoCoordinates?.longitude || null,
    title: (title || '').substring(0, 500), description,
    description_de: (deLoc.text?.description || '').substring(0, 5000) || null,
    description_en: (enLoc.text?.description || '').substring(0, 5000) || null,
    description_it: (itLoc.text?.description || '').substring(0, 5000) || null,
    type, transaction_type: 'buy',
    price: buyPrice, price_at_first_seen: buyPrice, current_price: buyPrice,
    price_per_m2: pricePerM2, currency: prices.currency || 'CHF',
    rooms: chars.numberOfRooms || null, bedrooms: null,
    bathrooms: chars.numberOfBathrooms || null,
    surface_m2: surface, floor: chars.floor || null,
    features: JSON.stringify(features), photos, photos_count: photos.length,
    year_built: chars.yearBuilt || null, year_renovated: chars.yearLastRenovated || null,
    usable_surface: chars.totalFloorSpace || null, land_surface: chars.lotSize || null,
    parking_count: (chars.hasParking ? 1 : 0) + (chars.hasGarage ? 1 : 0) || null,
    property_type_detail: categories.join(',') || null,
    has_balcony: chars.hasBalcony || false, has_parking: chars.hasParking || false,
    has_garage: chars.hasGarage || false, has_elevator: chars.hasElevator || false,
    has_nice_view: chars.hasNiceView || false, has_fireplace: chars.hasFireplace || false,
    has_swimming_pool: chars.hasSwimmingPool || false,
    is_minergie: chars.isMinergieGeneral || chars.isMinergieCertified || false,
    is_new_building: chars.isNewBuilding || false,
    is_child_friendly: chars.isChildFriendly || false,
    pets_allowed: chars.arePetsAllowed || false,
    agency_name: null, agency_phone: agent.phoneNumber || null,
    agency_contact_name: agent.firstName && agent.lastName ? `${agent.firstName} ${agent.lastName}` : null,
    agency_contact_phone: agent.mobileNumber || agent.phoneNumber || null,
    agency_logo_url: branding?.logoUrl || null,
    agency_reference: agent.headAgencyId || null,
    listing_type: item.listingType?.type || null,
    platforms: listing.platforms || [],
    source_created_at: meta.createdAt || null, source_updated_at: meta.updatedAt || null,
    quality_score: 90, quality_flags: '[]', status: 'active',
  };
}

// ── Supabase upsert ──────────────────────────────────────────
async function upsertBatch(rows) {
  let total = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?on_conflict=source_id`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (resp.ok) total += chunk.length;
    else console.error(`  Upsert error: ${resp.status} — ${(await resp.text()).substring(0, 150)}`);
  }
  return total;
}

// ── Stats ────────────────────────────────────────────────────
let totalReceived = 0;
let totalUpserted = 0;
let cantonsDone = 0;

// ── HTTP Server ──────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // CORS headers for Chrome
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/batch') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { canton, items } = JSON.parse(body);
        console.log(`📦 Reçu ${canton}: ${items.length} listings`);

        const rows = items.map(item => transform(item, canton)).filter(Boolean);
        const upserted = await upsertBatch(rows);

        totalReceived += items.length;
        totalUpserted += upserted;
        cantonsDone++;

        console.log(`  ✅ ${upserted}/${rows.length} upserted (total: ${totalUpserted})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, upserted, totalUpserted, cantonsDone }));
      } catch (e) {
        console.error('Error:', e.message);
        res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ totalReceived, totalUpserted, cantonsDone }));
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(3456, () => {
  console.log('═'.repeat(60));
  console.log('  BRIDGE HOMEGATE → SUPABASE');
  console.log('  Écoute sur http://localhost:3456');
  console.log('═'.repeat(60));
  console.log('');
  console.log('En attente de données depuis Chrome...');
  console.log('');
});
