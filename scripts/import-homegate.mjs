#!/usr/bin/env node

/**
 * Import Homegate JSON data → Supabase market_listings
 * Reads homegate-batch*.json from Downloads, transforms, and upserts
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/import-homegate.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ── Load env ─────────────────────────────────────────────────
const envPath = '/Users/megga/Desktop/megga-real-estate/.env.local';
const envContent = readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/import-homegate.mjs');
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
function transform(item) {
  const listing = item.listing;
  if (!listing) return null;
  const id = String(item.id);
  const cantonCode = item._c || item._canton || '';
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
  let ok = 0;
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
    if (resp.ok) ok += chunk.length;
    else {
      const t = await resp.text();
      console.error(`  ❌ Upsert ${resp.status}: ${t.substring(0, 150)}`);
    }
  }
  return ok;
}

async function getDbCount() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?select=id&limit=1`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' },
  });
  const cr = resp.headers.get('content-range');
  return cr ? parseInt(cr.split('/')[1]) : 0;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log('  IMPORT HOMEGATE JSON → SUPABASE');
  console.log('═'.repeat(60));

  const dbBefore = await getDbCount();
  console.log(`DB avant:  ${dbBefore.toLocaleString()} biens\n`);

  // Find JSON files
  const dir = '/Users/megga/Downloads';
  const files = readdirSync(dir).filter(f => f.startsWith('homegate-batch') && f.endsWith('.json')).sort();
  console.log(`Fichiers:  ${files.join(', ')}\n`);

  let totalRaw = 0, totalTransformed = 0, totalUpserted = 0;
  const seenIds = new Set();

  for (const file of files) {
    console.log(`📂 ${file}...`);
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    console.log(`  Brut: ${raw.length.toLocaleString()} items`);
    totalRaw += raw.length;

    // Transform and deduplicate
    const rows = [];
    for (const item of raw) {
      const row = transform(item);
      if (!row) continue;
      if (seenIds.has(row.source_id)) continue;
      seenIds.add(row.source_id);
      rows.push(row);
    }
    console.log(`  Unique: ${rows.length.toLocaleString()} (${raw.length - rows.length} doublons/invalides)`);
    totalTransformed += rows.length;

    // Upsert in batches
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const upserted = await upsertBatch(batch);
      totalUpserted += upserted;
      process.stdout.write(`  ✓ ${Math.min(i + batchSize, rows.length)}/${rows.length} upserted\r`);
    }
    console.log(`  ✅ ${rows.length.toLocaleString()} upserted`);
  }

  const dbAfter = await getDbCount();

  console.log('\n' + '═'.repeat(60));
  console.log('  TERMINÉ');
  console.log('═'.repeat(60));
  console.log(`Brut:      ${totalRaw.toLocaleString()} items lus`);
  console.log(`Unique:    ${totalTransformed.toLocaleString()} après dédoublication`);
  console.log(`Upserted:  ${totalUpserted.toLocaleString()}`);
  console.log(`DB AVANT:  ${dbBefore.toLocaleString()}`);
  console.log(`DB APRÈS:  ${dbAfter.toLocaleString()}`);
  console.log(`NOUVEAUX:  +${(dbAfter - dbBefore).toLocaleString()}`);
  console.log('═'.repeat(60));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
