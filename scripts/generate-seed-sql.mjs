#!/usr/bin/env node
// Convertit seed-placeholder-listings.mjs en un fichier SQL standalone
// que l'utilisateur peut copier-coller dans le Supabase SQL Editor.

import { readFileSync, writeFileSync } from 'node:fs'

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `ARRAY[${v.map((x) => sqlStr(x)).join(',')}]::text[]`
  return `'${String(v).replace(/'/g, "''")}'`
}

function rowToInsert(r) {
  const cols = [
    'source_id', 'source_portal', 'source_url', 'title', 'description', 'type',
    'transaction_type', 'price', 'price_at_first_seen', 'current_price', 'price_per_m2',
    'rooms', 'bedrooms', 'bathrooms', 'surface_m2',
    'address', 'city', 'canton', 'postal_code', 'lat', 'lng',
    'photos', 'photos_count', 'features', 'charges_monthly',
    'is_furnished', 'deposit_months',
    'agency_name', 'agency_phone', 'status', 'quality_score', 'quality_flags',
  ]
  const vals = cols.map((c) => {
    const v = r[c]
    if (c === 'photos') return v ? sqlStr(v) : 'ARRAY[]::text[]'
    return sqlStr(v === undefined ? null : v)
  })
  return `INSERT INTO public.market_listings (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT (source_id) DO UPDATE SET current_price=EXCLUDED.current_price, updated_at=NOW();`
}

// Extract arrays + buildRecord from source via Function wrapper (no side effects)
const src = readFileSync('scripts/seed-placeholder-listings.mjs', 'utf8')
const cleaned = src
  .replace(/^main\(\)\s*$/m, '/* main() */')
  .replace(/^if \(!SUPABASE_URL[\s\S]+?^\}\s*$/m, '')
  .replace(/^#!.*$/m, '')

// eslint-disable-next-line no-new-func
const extract = new Function(`
  ${cleaned}
  return { BUY_LISTINGS, RENT_LISTINGS, buildRecord };
`)
const { BUY_LISTINGS, RENT_LISTINGS, buildRecord } = extract()

const buyRows = BUY_LISTINGS.map((l) => buildRecord(l, 'buy'))
const rentRows = RENT_LISTINGS.map((l) => buildRecord(l, 'rent'))
const all = [...buyRows, ...rentRows]

const sql = `-- ═══════════════════════════════════════════════════════════════════════
-- MEGGA — TRUNCATE 38K market_listings + seed 27 placeholders
-- À copier-coller dans Supabase SQL Editor puis cliquer Run.
-- https://supabase.com/dashboard/project/eayczugyrvmtqnnmvjod/sql/new
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. TRUNCATE ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_price_history') THEN
    TRUNCATE TABLE public.market_price_history RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_changes') THEN
    TRUNCATE TABLE public.market_changes RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'external_listings') THEN
    TRUNCATE TABLE public.external_listings RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_listings') THEN
    TRUNCATE TABLE public.market_listings RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- ── 2. INSERT 27 placeholders (12 buy + 15 rent) ────────────────────────
${all.map(rowToInsert).join('\n')}

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────
SELECT transaction_type, COUNT(*) FROM public.market_listings GROUP BY transaction_type;
-- Expected : buy = 12, rent = 15
`

writeFileSync('scripts/seed-placeholder-listings.sql', sql)
console.log(`✓ Generated scripts/seed-placeholder-listings.sql (${all.length} rows)`)
console.log(`  BUY : ${buyRows.length}`)
console.log(`  RENT: ${rentRows.length}`)
