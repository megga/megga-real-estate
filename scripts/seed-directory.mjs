#!/usr/bin/env node

/**
 * Seed Swiss broker directory — SVIT / SMK / USPI
 *
 * Fetches agency data from 3 professional associations:
 * 1. SVIT members (JSON API, paginated) — filter organisation_id=30 (Maklerkammer)
 * 2. SMK certified brokers (HTML parse)
 * 3. USPI Geneva members (HTML parse)
 *
 * Deduplicates, generates slugs, inserts into agency_profiles via Supabase.
 * Idempotent: uses upsert on (source, source_id).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-directory.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-directory.mjs --dry-run
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Load env ────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

const DRY_RUN_EARLY = process.argv.includes('--dry-run')
if (!SUPABASE_URL || !ANON_KEY || (!SERVICE_KEY && !DRY_RUN_EARLY)) {
  console.error('Missing env vars.')
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seed-directory.mjs [--dry-run]')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 1500 // 1.5s between requests to be respectful

if (DRY_RUN) {
  console.log('[DRY RUN] No database writes will be performed\n')
}

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

/**
 * Normalize a company name for deduplication.
 * Lowercases, removes legal suffixes, trims, collapses whitespace.
 */
function normalizeName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\b(sa|s\.a\.|sàrl|s\.à\.r\.l\.|sarl|ag|gmbh|srl|inc|ltd|llc)\b/gi, '')
    .replace(/[.,;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Generate a URL-safe slug from name + city.
 * e.g. "Dupont Immobilier SA" + "Genève" → "dupont-immobilier-geneve"
 */
function generateSlug(name, city) {
  const raw = city ? `${name} ${city}` : name
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')           // spaces to hyphens
    .replace(/-+/g, '-')            // collapse hyphens
    .replace(/^-|-$/g, '')          // trim hyphens
    .slice(0, 80)                   // max length
}

/**
 * Detect canton code from city or postal code.
 */
const CITY_CANTON_MAP = {
  'genève': 'GE', 'geneva': 'GE', 'genf': 'GE', 'carouge': 'GE', 'lancy': 'GE',
  'vernier': 'GE', 'meyrin': 'GE', 'onex': 'GE', 'thônex': 'GE', 'plan-les-ouates': 'GE',
  'lausanne': 'VD', 'nyon': 'VD', 'montreux': 'VD', 'vevey': 'VD', 'morges': 'VD',
  'renens': 'VD', 'pully': 'VD', 'yverdon': 'VD', 'ecublens': 'VD',
  'zürich': 'ZH', 'zurich': 'ZH', 'winterthur': 'ZH', 'uster': 'ZH', 'kloten': 'ZH',
  'bern': 'BE', 'berne': 'BE', 'biel': 'BE', 'bienne': 'BE', 'thun': 'BE',
  'basel': 'BS', 'bâle': 'BS', 'riehen': 'BS',
  'luzern': 'LU', 'lucerne': 'LU',
  'st. gallen': 'SG', 'st.gallen': 'SG', 'saint-gall': 'SG',
  'lugano': 'TI', 'locarno': 'TI', 'bellinzona': 'TI',
  'fribourg': 'FR', 'freiburg': 'FR',
  'sion': 'VS', 'sierre': 'VS', 'martigny': 'VS', 'monthey': 'VS',
  'neuchâtel': 'NE', 'la chaux-de-fonds': 'NE',
  'delémont': 'JU',
  'aarau': 'AG', 'baden': 'AG', 'wettingen': 'AG',
  'solothurn': 'SO', 'olten': 'SO',
  'schaffhausen': 'SH',
  'chur': 'GR', 'coire': 'GR', 'davos': 'GR',
  'zug': 'ZG',
  'schwyz': 'SZ',
}

/**
 * Infer canton from NPA (postal code) first digit ranges.
 */
function cantonFromNpa(npa) {
  if (!npa) return null
  const n = parseInt(npa, 10)
  if (n >= 1200 && n <= 1299) return 'GE'
  if (n >= 1000 && n <= 1199) return 'VD'
  if (n >= 1300 && n <= 1399) return 'VD'
  if (n >= 1400 && n <= 1499) return 'VD'
  if (n >= 1500 && n <= 1599) return 'VD'
  if (n >= 1600 && n <= 1699) return 'FR'
  if (n >= 1700 && n <= 1799) return 'FR'
  if (n >= 1800 && n <= 1899) return 'VD'
  if (n >= 1900 && n <= 1999) return 'VS'
  if (n >= 2000 && n <= 2099) return 'NE'
  if (n >= 2300 && n <= 2399) return 'NE'
  if (n >= 2800 && n <= 2899) return 'JU'
  if (n >= 3000 && n <= 3199) return 'BE'
  if (n >= 3900 && n <= 3999) return 'VS'
  if (n >= 4000 && n <= 4099) return 'BS'
  if (n >= 4100 && n <= 4199) return 'BL'
  if (n >= 5000 && n <= 5099) return 'AG'
  if (n >= 6000 && n <= 6099) return 'LU'
  if (n >= 6300 && n <= 6399) return 'ZG'
  if (n >= 6500 && n <= 6599) return 'TI'
  if (n >= 6600 && n <= 6699) return 'TI'
  if (n >= 6900 && n <= 6999) return 'TI'
  if (n >= 7000 && n <= 7099) return 'GR'
  if (n >= 8000 && n <= 8099) return 'ZH'
  if (n >= 9000 && n <= 9099) return 'SG'
  return null
}

function detectCanton(city, postalCode) {
  if (city) {
    const normalized = city.toLowerCase().trim()
    if (CITY_CANTON_MAP[normalized]) return CITY_CANTON_MAP[normalized]
  }
  return cantonFromNpa(postalCode)
}

// ── Source 1: SVIT Members ──────────────────────────────────
// API returns a single JSON array of ~2700 members with HTML in `content` field.
// We filter for "Maklerkammer" mentions to get certified brokers.

function parseSvitContent(html) {
  const extract = (cls) => {
    const match = html.match(new RegExp(`<div class="${cls}">([^<]+)<\\/div>`))
    return match ? match[1].trim() : ''
  }
  const emailMatch = html.match(/href="mailto:([^"]+)"/)
  const websiteMatch = html.match(/href="(https?:\/\/[^"]+)"/)
  const name = extract('member-title')
  const zipCity = extract('member-zip-city')
  const street = extract('member-street')
  const zipCityMatch = zipCity.match(/^(\d{4})\s+(.+)$/)
  return {
    name,
    address: street,
    city: zipCityMatch ? zipCityMatch[2] : zipCity,
    postal_code: zipCityMatch ? zipCityMatch[1] : '',
    email: emailMatch ? emailMatch[1] : '',
    website_url: websiteMatch ? websiteMatch[1] : '',
  }
}

async function fetchSvitMembers() {
  console.log('Fetching SVIT members...')
  const agencies = []

  try {
    const res = await fetchWithTimeout('https://svit.ch/de/svit/members/json?page=0', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
      },
    }, 30000)

    if (!res.ok) {
      console.warn(`  SVIT returned ${res.status}`)
      return agencies
    }

    const data = await res.json()
    const members = Array.isArray(data) ? data : []
    console.log(`  SVIT raw: ${members.length} total members`)

    // Take ALL members (Firmenmitglied + Maklerkammer + all types)
    const toProcess = members.filter(m => m.content)
    console.log(`  SVIT: processing all ${toProcess.length} members`)

    for (const m of toProcess) {
      const parsed = parseSvitContent(m.content || '')
      if (!parsed.name) continue

      agencies.push({
        name: parsed.name,
        address: parsed.address,
        city: parsed.city,
        postal_code: parsed.postal_code,
        canton: detectCanton(parsed.city, parsed.postal_code),
        phone: '',
        email: parsed.email,
        website_url: parsed.website_url,
        source: 'svit',
        source_id: `svit-${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}`,
      })
    }
  } catch (err) {
    console.warn(`  SVIT error: ${err.message}`)
  }

  console.log(`  SVIT: ${agencies.length} agencies found`)
  return agencies
}

// ── Source 2: SMK Certified Brokers ─────────────────────────
// Data is in HTML data-* attributes on marker elements:
// data-company, data-name, data-email, data-phone, data-street, data-postcode, data-city, data-stateshort, data-website

async function fetchSmkBrokers() {
  console.log('Fetching SMK certified brokers...')
  const agencies = []

  try {
    const res = await fetchWithTimeout('https://www.maklerkammer.ch/zertifizierte-makler/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'text/html' },
    })

    if (!res.ok) {
      console.warn(`  SMK returned ${res.status} — skipping`)
      return agencies
    }

    const html = await res.text()

    // Parse data-* attributes from marker elements
    const markerRegex = /data-stateshort="([^"]*)"[^>]*data-lat="([^"]*)"[^>]*data-lng="([^"]*)"[^>]*data-city="([^"]*)"[^>]*data-postcode="([^"]*)"[^>]*data-street="([^"]*)"[^>]*data-website="([^"]*)"[^>]*data-email="([^"]*)"[^>]*data-phone="([^"]*)"[^>]*data-company="([^"]*)"[^>]*data-name="([^"]*)"/g

    let m
    while ((m = markerRegex.exec(html)) !== null) {
      const company = m[10].trim()
      if (!company) continue

      agencies.push({
        name: company,
        address: m[6].trim(),
        city: m[4].trim(),
        postal_code: m[5].trim(),
        canton: m[1].substring(0, 2).toUpperCase() || detectCanton(m[4], m[5]),
        phone: m[9].trim(),
        email: m[8].trim(),
        website_url: m[7].trim(),
        source: 'smk',
        source_id: `smk-${normalizeName(company)}-${m[5] || agencies.length}`,
      })
    }

    // Map German canton names to abbreviations
    const CANTON_MAP_DE = {
      'AG': 'AG', 'AI': 'AI', 'AR': 'AR', 'BE': 'BE', 'BL': 'BL', 'BS': 'BS',
      'FR': 'FR', 'GE': 'GE', 'GL': 'GL', 'GR': 'GR', 'JU': 'JU', 'LU': 'LU',
      'NE': 'NE', 'NW': 'NW', 'OW': 'OW', 'SG': 'SG', 'SH': 'SH', 'SO': 'SO',
      'SZ': 'SZ', 'TG': 'TG', 'TI': 'TI', 'UR': 'UR', 'VD': 'VD', 'VS': 'VS',
      'ZG': 'ZG', 'ZH': 'ZH',
    }
    for (const a of agencies) {
      if (a.canton && a.canton.length > 2) {
        a.canton = detectCanton(a.city, a.postal_code) || a.canton.substring(0, 2)
      }
    }
  } catch (err) {
    console.warn(`  SMK fetch error: ${err.message}`)
  }

  console.log(`  SMK: ${agencies.length} certified brokers found`)
  return agencies
}

// ── Source 3: USPI Geneva Members ───────────────────────────
// WordPress site with custom post type "regie" accessible via wp-json API

async function fetchUspiMembers() {
  console.log('Fetching USPI Geneva members (WordPress API)...')
  const agencies = []

  try {
    const res = await fetchWithTimeout('https://www.uspi-ge.ch/wp-json/wp/v2/regie?per_page=100', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' },
    })

    if (!res.ok) {
      console.warn(`  USPI returned ${res.status} — skipping`)
      return agencies
    }

    const data = await res.json()
    console.log(`  USPI API: ${data.length} régies found`)

    for (const regie of data) {
      const name = (regie.title?.rendered || '')
        .replace(/&#038;/g, '&')
        .replace(/&#8211;/g, '–')
        .replace(/<[^>]+>/g, '')
        .trim()
      if (!name) continue

      agencies.push({
        name,
        address: '',
        city: 'Genève',
        postal_code: '',
        canton: 'GE',
        phone: '',
        email: '',
        website_url: regie.link || '',
        source: 'uspi',
        source_id: `uspi-${regie.slug || normalizeName(name)}`,
      })
    }
  } catch (err) {
    console.warn(`  USPI fetch error: ${err.message}`)
  }

  // Also fetch USPI Vaud (same WordPress pattern, type "uspi_member")
  try {
    console.log('Fetching USPI Vaud members (WordPress API)...')
    const resVaud = await fetchWithTimeout('https://www.uspi-vaud.ch/wp-json/wp/v2/uspi_member?per_page=100', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' },
    })
    if (resVaud.ok) {
      const dataVaud = await resVaud.json()
      console.log(`  USPI Vaud API: ${dataVaud.length} members found`)
      for (const member of dataVaud) {
        const name = (member.title?.rendered || '')
          .replace(/&#038;/g, '&').replace(/&#8211;/g, '–').replace(/<[^>]+>/g, '').trim()
        if (!name) continue
        agencies.push({
          name,
          address: '',
          city: '',
          postal_code: '',
          canton: 'VD',
          phone: '',
          email: '',
          website_url: member.link || '',
          source: 'uspi',
          source_id: `uspi-vd-${member.slug || normalizeName(name)}`,
        })
      }
    }
  } catch (err) {
    console.warn(`  USPI Vaud fetch error: ${err.message}`)
  }

  console.log(`  USPI total: ${agencies.length} régies found`)
  return agencies
}

// ── Deduplication ───────────────────────────────────────────

function deduplicateAgencies(allAgencies) {
  const seen = new Map() // normalized name → agency
  const unique = []
  let dupeCount = 0

  for (const agency of allAgencies) {
    const key = normalizeName(agency.name)
    if (!key) continue

    if (seen.has(key)) {
      dupeCount++
      const existing = seen.get(key)
      // Merge: prefer fields from the entry that has more data
      if (!existing.phone && agency.phone) existing.phone = agency.phone
      if (!existing.email && agency.email) existing.email = agency.email
      if (!existing.website_url && agency.website_url) existing.website_url = agency.website_url
      if (!existing.address && agency.address) existing.address = agency.address
      if (!existing.canton && agency.canton) existing.canton = agency.canton
      if (!existing.city && agency.city) existing.city = agency.city
      continue
    }

    seen.set(key, agency)
    unique.push(agency)
  }

  if (dupeCount > 0) {
    console.log(`  Dedup: ${dupeCount} duplicates merged`)
  }

  return unique
}

// ── Build agency_profiles records ───────────────────────────

function buildRecords(agencies) {
  const slugCounts = new Map()

  return agencies.map(a => {
    let slug = generateSlug(a.name, a.city)

    // Ensure slug uniqueness
    if (slugCounts.has(slug)) {
      const count = slugCounts.get(slug) + 1
      slugCounts.set(slug, count)
      slug = `${slug}-${count}`
    } else {
      slugCounts.set(slug, 1)
    }

    return {
      name: a.name,
      slug,
      canton: a.canton || null,
      city: a.city || null,
      address: a.address || null,
      phone: a.phone || null,
      email: a.email || null,
      website_url: a.website_url || null,
      status: 'unclaimed',
      source: a.source,
      source_id: a.source_id,
    }
  })
}

// ── Supabase REST helpers ────────────────────────────────────

async function supabaseBatchUpsert(table, records, onConflict = 'source,source_id') {
  if (records.length === 0) return 0
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`${resp.status} — ${text.substring(0, 300)}`)
  }
  return records.length
}

// ── Insert into Supabase ────────────────────────────────────

async function insertRecords(records) {
  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would insert ${records.length} agency profiles:`)
    const bySrc = {}
    for (const r of records) {
      bySrc[r.source] = (bySrc[r.source] || 0) + 1
    }
    for (const [src, count] of Object.entries(bySrc)) {
      console.log(`  ${src}: ${count}`)
    }
    console.log('\nSample records:')
    for (const r of records.slice(0, 5)) {
      console.log(`  - ${r.name} (${r.city || 'no city'}, ${r.canton || 'no canton'}) [${r.source}] → /${r.slug}`)
    }
    return
  }

  console.log(`\nInserting ${records.length} agency profiles into Supabase...`)

  const BATCH_SIZE = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)

    try {
      // Try upsert on (source, source_id) composite key first
      const n = await supabaseBatchUpsert('agency_profiles', batch, 'source,source_id')
      inserted += n
    } catch (err) {
      // If composite key constraint doesn't exist, fall back to slug-based upsert
      if (err.message.includes('unique') || err.message.includes('constraint') || err.message.includes('42P10') || err.message.includes('could not')) {
        console.warn(`  Batch upsert on (source,source_id) failed, falling back to slug...`)
        for (const record of batch) {
          try {
            await supabaseBatchUpsert('agency_profiles', [record], 'slug')
            inserted++
          } catch (singleErr) {
            errors++
            if (errors <= 5) console.warn(`  Error inserting "${record.name}": ${singleErr.message}`)
          }
        }
      } else {
        console.error(`  Batch error: ${err.message}`)
        errors += batch.length
      }
    }
  }

  console.log(`  Inserted: ${inserted}, Errors: ${errors}`)
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('=== MEGGA Directory Seed ===\n')

  const allAgencies = []

  // 1. SVIT
  try {
    const svit = await fetchSvitMembers()
    allAgencies.push(...svit)
  } catch (err) {
    console.error(`SVIT source failed: ${err.message}`)
  }

  await sleep(DELAY_MS)

  // 2. SMK
  try {
    const smk = await fetchSmkBrokers()
    allAgencies.push(...smk)
  } catch (err) {
    console.error(`SMK source failed: ${err.message}`)
  }

  await sleep(DELAY_MS)

  // 3. USPI
  try {
    const uspi = await fetchUspiMembers()
    allAgencies.push(...uspi)
  } catch (err) {
    console.error(`USPI source failed: ${err.message}`)
  }

  console.log(`\nTotal raw entries: ${allAgencies.length}`)

  // 4. Deduplicate
  const unique = deduplicateAgencies(allAgencies)
  console.log(`After dedup: ${unique.length} unique agencies`)

  if (unique.length === 0) {
    console.log('\nNo agencies to insert. Exiting.')
    return
  }

  // 5. Build records
  const records = buildRecords(unique)

  // 6. Sync agencies (detect adds/removes/updates)
  const agencyReport = await syncAgencies(records)

  // 7. Sync individual agents
  const agentReport = await seedAgentProfiles()

  // 8. Print summary report
  printReport(agencyReport, agentReport)

  console.log('\nDone.')
}

// ── Sync with change detection ─────────────────────────────

async function syncAgencies(newRecords) {
  const report = { added: 0, updated: 0, removed: 0, unchanged: 0, errors: 0, removedNames: [] }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would sync ${newRecords.length} agency profiles`)
    return report
  }

  // 1. Fetch existing agencies from DB
  console.log('\nSyncing agency profiles...')
  let existingAgencies = []
  try {
    let page = 0
    const pageSize = 1000
    while (true) {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/agency_profiles?select=id,slug,name,source,source_id,updated_at&order=id&limit=${pageSize}&offset=${page * pageSize}`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      )
      if (!resp.ok) break
      const batch = await resp.json()
      existingAgencies.push(...batch)
      if (batch.length < pageSize) break
      page++
    }
  } catch (err) {
    console.warn(`  Could not fetch existing agencies: ${err.message}`)
  }
  console.log(`  Existing in DB: ${existingAgencies.length}`)

  // 2. Build lookup maps
  const existingBySlug = new Map()
  for (const a of existingAgencies) existingBySlug.set(a.slug, a)

  const newBySlug = new Map()
  for (const r of newRecords) newBySlug.set(r.slug, r)

  // 3. Detect removals (in DB but not in new data — only for seeded profiles, not claimed ones)
  for (const [slug, existing] of existingBySlug) {
    if (!newBySlug.has(slug) && existing.source && existing.source !== 'manual') {
      report.removed++
      report.removedNames.push(existing.name)
    }
  }

  // 4. Detect adds vs updates
  for (const [slug, record] of newBySlug) {
    if (existingBySlug.has(slug)) {
      report.updated++
    } else {
      report.added++
    }
  }
  report.unchanged = existingAgencies.length - report.updated - report.removed

  // 5. Upsert all new records
  await insertRecords(newRecords)

  // 6. Mark removed agencies (soft-delete: set source to 'removed' instead of deleting)
  if (report.removed > 0 && report.removed < 50) {
    console.log(`  Marking ${report.removed} removed agencies...`)
    for (const [slug, existing] of existingBySlug) {
      if (!newBySlug.has(slug) && existing.source && existing.source !== 'manual') {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/agency_profiles?id=eq.${existing.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ source: 'removed_' + existing.source }),
          })
        } catch (err) { /* ignore */ }
      }
    }
  }

  return report
}

// ── Agent Profiles ─────────────────────────────────────────

async function seedAgentProfiles() {
  const report = { added: 0, updated: 0, total: 0 }
  console.log('\n--- Syncing agent profiles ---\n')

  const agents = []

  // Source 1: SVIT — parse member-name + member-title from HTML content
  try {
    console.log('Fetching SVIT individual contacts...')
    const res = await fetchWithTimeout('https://svit.ch/de/svit/members/json?page=0', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'application/json' },
    }, 30000)
    if (res.ok) {
      const data = await res.json()
      const members = Array.isArray(data) ? data : []
      for (const m of members) {
        const content = m.content || ''
        const nameMatch = content.match(/<div class="member-name">([^<]+)<\/div>/)
        const companyMatch = content.match(/<div class="member-title">([^<]+)<\/div>/)
        const emailMatch = content.match(/href="mailto:([^"]+)"/)
        const zipCityMatch = content.match(/<div class="member-zip-city">(\d{4})\s+([^<]+)<\/div>/)

        if (!nameMatch || !nameMatch[1].trim()) continue
        const fullName = nameMatch[1].trim()
        const nameParts = fullName.split(/\s+/)
        if (nameParts.length < 2) continue

        agents.push({
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(' '),
          company_name: companyMatch?.[1]?.trim() || '',
          email: emailMatch?.[1] || '',
          city: zipCityMatch?.[2]?.trim() || '',
          postal_code: zipCityMatch?.[1] || '',
          source: 'svit',
        })
      }
      console.log(`  SVIT: ${agents.length} individual contacts`)
    }
  } catch (err) {
    console.warn(`  SVIT agents error: ${err.message}`)
  }

  // Source 2: SMK — data-name + data-company attributes
  try {
    console.log('Fetching SMK individual brokers...')
    const res = await fetchWithTimeout('https://www.maklerkammer.ch/zertifizierte-makler/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept': 'text/html' },
    })
    if (res.ok) {
      const html = await res.text()
      const regex = /data-city="([^"]*)"[^>]*data-postcode="([^"]*)"[^>]*data-street="[^"]*"[^>]*data-website="[^"]*"[^>]*data-email="([^"]*)"[^>]*data-phone="([^"]*)"[^>]*data-company="([^"]*)"[^>]*data-name="([^"]*)"/g
      let match
      const smkCount = agents.length
      while ((match = regex.exec(html)) !== null) {
        const fullName = match[6].trim()
        if (!fullName) continue
        const nameParts = fullName.split(/\s+/)
        if (nameParts.length < 2) continue

        agents.push({
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(' '),
          company_name: match[5].trim(),
          email: match[3].trim(),
          city: match[1].trim(),
          postal_code: match[2].trim(),
          phone: match[4].trim(),
          source: 'smk',
        })
      }
      console.log(`  SMK: ${agents.length - smkCount} individual brokers`)
    }
  } catch (err) {
    console.warn(`  SMK agents error: ${err.message}`)
  }

  // Dedup agents by name
  const seen = new Map()
  const unique = []
  for (const a of agents) {
    const key = normalizeName(a.first_name + ' ' + a.last_name)
    if (seen.has(key)) {
      // Merge: prefer SMK data (has phone, certifications)
      const existing = seen.get(key)
      if (!existing.email && a.email) existing.email = a.email
      if (!existing.phone && a.phone) existing.phone = a.phone
      continue
    }
    seen.set(key, a)
    unique.push(a)
  }
  console.log(`  Dedup: ${agents.length - unique.length} duplicates merged`)
  console.log(`  Unique agents: ${unique.length}`)

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would insert ${unique.length} agent profiles`)
    unique.slice(0, 5).forEach(a =>
      console.log(`  - ${a.first_name} ${a.last_name} (${a.company_name}) [${a.source}]`)
    )
    report.total = unique.length
    return report
  }

  // Fetch agency_profiles to link agents → agencies
  console.log('\nFetching agency profiles for linking...')
  const agencyResp = await fetch(`${SUPABASE_URL}/rest/v1/agency_profiles?select=id,name,slug&limit=5000`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  })
  const agencyList = agencyResp.ok ? await agencyResp.json() : []
  console.log(`  ${agencyList.length} agencies in DB`)

  // Build lookup by normalized name
  const agencyLookup = new Map()
  for (const ag of agencyList) {
    agencyLookup.set(normalizeName(ag.name), ag.id)
  }

  // Build agent records
  const agentRecords = unique.map(a => {
    const slug = generateSlug(a.first_name + ' ' + a.last_name, a.city)
    const agencyId = agencyLookup.get(normalizeName(a.company_name)) || null
    const canton = detectCanton(a.city, a.postal_code)

    return {
      first_name: a.first_name,
      last_name: a.last_name,
      slug,
      canton,
      city: a.city || null,
      email: a.email || null,
      phone: a.phone || null,
      agency_profile_id: agencyId,
      status: 'unclaimed',
      source: a.source,
      source_id: `${a.source}-agent-${normalizeName(a.first_name + a.last_name)}`,
      specialties: '{}',
      languages: '{}',
      certifications: a.source === 'smk' ? '{SMK}' : '{}',
    }
  })

  // Insert in batches
  console.log(`\nInserting ${agentRecords.length} agent profiles...`)
  const BATCH = 50
  let inserted = 0
  let errors = 0

  for (let i = 0; i < agentRecords.length; i += BATCH) {
    const batch = agentRecords.slice(i, i + BATCH)
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/agent_profiles?on_conflict=slug`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(batch),
      })
      if (resp.ok) {
        inserted += batch.length
      } else {
        const err = await resp.text()
        console.warn(`  Agent batch error: ${resp.status} — ${err.substring(0, 200)}`)
        errors += batch.length
      }
    } catch (err) {
      console.warn(`  Agent batch network error: ${err.message}`)
      errors += batch.length
    }
  }

  console.log(`  Agents inserted: ${inserted}, Errors: ${errors}`)

  // Update agency agent_count
  if (inserted > 0) {
    console.log('  Updating agency agent counts...')
  }

  report.total = unique.length
  report.added = inserted
  return report
}

// ── Weekly Report ──────────────────────────────────────────

function printReport(agencyReport, agentReport) {
  console.log('\n' + '═'.repeat(50))
  console.log('  MEGGA Directory Sync Report')
  console.log('  ' + new Date().toISOString().split('T')[0])
  console.log('═'.repeat(50))

  console.log('\n  AGENCES:')
  console.log(`    Nouvelles:      ${agencyReport.added}`)
  console.log(`    Mises à jour:   ${agencyReport.updated}`)
  console.log(`    Retirées:       ${agencyReport.removed}`)
  console.log(`    Inchangées:     ${agencyReport.unchanged}`)
  if (agencyReport.removedNames.length > 0) {
    console.log(`    Agences retirées:`)
    agencyReport.removedNames.slice(0, 20).forEach(n => console.log(`      - ${n}`))
    if (agencyReport.removedNames.length > 20) console.log(`      ... et ${agencyReport.removedNames.length - 20} autres`)
  }

  console.log('\n  AGENTS:')
  console.log(`    Total sync:     ${agentReport.total}`)
  console.log(`    Insérés:        ${agentReport.added}`)

  console.log('\n' + '═'.repeat(50))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
