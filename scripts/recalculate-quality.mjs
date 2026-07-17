#!/usr/bin/env node

/**
 * Recalcul du score qualité pour tous les market_listings existants
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/recalculate-quality.mjs
 *
 * Ce script :
 * 1. Charge tous les biens par batch de 1000
 * 2. Calcule quality_score + quality_flags pour chacun
 * 3. Met à jour en DB par batch de 100
 * 4. Affiche un résumé avec la distribution des scores
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validateListing } from './_shared/validate-listing.mjs'

// ── Load env ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/recalculate-quality.mjs')
  process.exit(1)
}

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

// ── Helpers ─────────────────────────────────────────────────

async function countListings() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/market_listings?select=id&limit=1`,
    {
      headers: {
        ...HEADERS,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    }
  )
  const range = resp.headers.get('content-range')
  return range ? parseInt(range.split('/')[1]) : 0
}

async function fetchBatch(offset, limit) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/market_listings?select=id,price,current_price,surface_m2,rooms,canton,type,lat,lng,photos,photos_count,title,price_per_m2&order=created_at.asc&offset=${offset}&limit=${limit}`,
    { headers: HEADERS }
  )
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Fetch error ${resp.status}: ${err}`)
  }
  return resp.json()
}

async function updateBatch(updates) {
  // Séquentiel par petits groupes de 10 pour éviter le timeout Supabase
  let success = 0
  const CHUNK = 10
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK)
    const promises = chunk.map(async ({ id, quality_score, quality_flags }) => {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/market_listings?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: HEADERS,
          body: JSON.stringify({ quality_score, quality_flags }),
        }
      )
      if (!resp.ok && resp.status !== 204) {
        return false
      }
      return true
    })
    const results = await Promise.all(promises)
    success += results.filter(Boolean).length
    // Petite pause entre les chunks pour ne pas surcharger Supabase
    if (i + CHUNK < updates.length) await new Promise(r => setTimeout(r, 100))
  }
  return success
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const total = await countListings()
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`RECALCUL QUALITÉ — ${total.toLocaleString('fr-CH')} biens`)
  console.log(`${'═'.repeat(60)}\n`)

  const BATCH_SIZE = 500
  const startOffset = parseInt(process.env.START_OFFSET || '0')
  let processed = startOffset
  let updated = 0
  let errors = 0

  // Distribution des scores
  const distribution = {
    excellent: 0,  // 80-100
    good: 0,       // 60-79
    acceptable: 0, // 50-59
    suspect: 0,    // 0-49
  }

  // Top flags
  const flagCounts = {}

  if (startOffset > 0) {
    console.log(`  Reprise à l'offset ${startOffset.toLocaleString('fr-CH')}\n`)
  }

  for (let offset = startOffset; offset < total; offset += BATCH_SIZE) {
    const batch = await fetchBatch(offset, BATCH_SIZE)
    if (!batch || batch.length === 0) break

    const updates = []

    for (const listing of batch) {
      const { quality_score, quality_flags } = validateListing({
        ...listing,
        price: listing.current_price || listing.price,
      })

      updates.push({
        id: listing.id,
        quality_score,
        quality_flags,
      })

      // Stats
      if (quality_score >= 80) distribution.excellent++
      else if (quality_score >= 60) distribution.good++
      else if (quality_score >= 50) distribution.acceptable++
      else distribution.suspect++

      for (const flag of quality_flags) {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1
      }
    }

    // Update
    const success = await updateBatch(updates)
    updated += success
    errors += updates.length - success

    processed += batch.length

    // Progress
    const pct = ((processed / total) * 100).toFixed(1)
    process.stdout.write(
      `\r  [${pct}%] ${processed.toLocaleString('fr-CH')} / ${total.toLocaleString('fr-CH')} — ` +
      `✅ ${distribution.excellent + distribution.good + distribution.acceptable} OK | ⚠️ ${distribution.suspect} suspects`
    )
  }

  console.log('\n')
  console.log(`${'═'.repeat(60)}`)
  console.log(`TERMINÉ`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`\nTraités:    ${processed.toLocaleString('fr-CH')}`)
  console.log(`Mis à jour: ${updated.toLocaleString('fr-CH')}`)
  console.log(`Erreurs:    ${errors}`)

  console.log(`\n── Distribution des scores ──`)
  console.log(`  Excellent (80-100):  ${distribution.excellent.toLocaleString('fr-CH')} (${((distribution.excellent / processed) * 100).toFixed(1)}%)`)
  console.log(`  Bon (60-79):         ${distribution.good.toLocaleString('fr-CH')} (${((distribution.good / processed) * 100).toFixed(1)}%)`)
  console.log(`  Acceptable (50-59):  ${distribution.acceptable.toLocaleString('fr-CH')} (${((distribution.acceptable / processed) * 100).toFixed(1)}%)`)
  console.log(`  Suspect (<50):       ${distribution.suspect.toLocaleString('fr-CH')} (${((distribution.suspect / processed) * 100).toFixed(1)}%)`)

  console.log(`\n── Top flags (problèmes détectés) ──`)
  const sortedFlags = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])
  for (const [flag, count] of sortedFlags.slice(0, 15)) {
    const pct = ((count / processed) * 100).toFixed(1)
    console.log(`  ${flag.padEnd(35)} ${count.toLocaleString('fr-CH').padStart(7)} (${pct}%)`)
  }

  console.log(`\n${'═'.repeat(60)}\n`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
