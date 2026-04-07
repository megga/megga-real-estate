#!/usr/bin/env node

/**
 * Fetch agency logos via logo.dev API
 *
 * Reads agency_profiles with website_url but no logo_url,
 * fetches logo URL from logo.dev, updates the record.
 *
 * Usage:
 *   node scripts/fetch-logos.mjs              # Run for real
 *   node scripts/fetch-logos.mjs --dry-run    # Preview only
 *   node scripts/fetch-logos.mjs --limit=50   # Process 50 agencies
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')

const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const SERVICE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
const LOGO_TOKEN = envContent.match(/LOGO_DEV_TOKEN=(.+)/)?.[1]?.trim()

if (!SUPABASE_URL || !SERVICE_KEY || !LOGO_TOKEN) {
  console.error('Missing env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOGO_DEV_TOKEN')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 9999

if (DRY_RUN) console.log('[DRY RUN] No database writes\n')

// ── Extract domain from URL ──────────────────────────────────

function extractDomain(url) {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) clean = 'https://' + clean
    const u = new URL(clean)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ── Fetch agencies without logos ──────────────────────────────

async function fetchAgencies() {
  const pageSize = 500
  let all = []
  let page = 0

  while (true) {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/agency_profiles?select=id,name,website_url&website_url=not.is.null&logo_url=is.null&order=id&limit=${pageSize}&offset=${page * pageSize}`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        }
      }
    )
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
    const data = await resp.json()
    if (data.length === 0) break
    all.push(...data)
    page++
    if (all.length >= LIMIT) break
  }

  return all.slice(0, LIMIT)
}

// ── Check if logo.dev has a logo for this domain ─────────────

async function checkLogo(domain) {
  const url = `https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=128&format=png`
  try {
    const resp = await fetch(url)
    if (resp.ok) {
      const contentType = resp.headers.get('content-type') || ''
      // Consume body to free connection
      await resp.arrayBuffer()
      if (contentType.startsWith('image/')) {
        return url
      }
    } else {
      await resp.text()
    }
    return null
  } catch {
    return null
  }
}

// ── Update agency logo_url in Supabase ───────────────────────

async function updateLogo(id, logoUrl) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/agency_profiles?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ logo_url: logoUrl }),
    }
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Update failed for ${id}: ${resp.status} — ${text.substring(0, 200)}`)
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Fetching agencies without logos...')
  const agencies = await fetchAgencies()
  console.log(`   Found ${agencies.length} agencies to process\n`)

  let found = 0
  let notFound = 0
  let errors = 0

  for (let i = 0; i < agencies.length; i++) {
    const a = agencies[i]
    const domain = extractDomain(a.website_url)

    if (!domain) {
      console.log(`  ⚠️  ${i + 1}/${agencies.length} ${a.name} — invalid URL: ${a.website_url}`)
      errors++
      continue
    }

    const logoUrl = await checkLogo(domain)

    if (logoUrl) {
      found++
      if (!DRY_RUN) {
        await updateLogo(a.id, logoUrl)
      }
      console.log(`  ✅ ${i + 1}/${agencies.length} ${a.name} → ${domain}`)
    } else {
      notFound++
      console.log(`  ❌ ${i + 1}/${agencies.length} ${a.name} → ${domain} (not found)`)
    }

    // Rate limit: 50ms between requests (= ~20/sec, well within 500K/month)
    if (i < agencies.length - 1) {
      await new Promise(r => setTimeout(r, 50))
    }

    // Progress every 100
    if ((i + 1) % 100 === 0) {
      console.log(`\n   ── Progress: ${i + 1}/${agencies.length} | ✅ ${found} | ❌ ${notFound} | ⚠️ ${errors} ──\n`)
    }
  }

  console.log(`\n════════════════════════════════════════`)
  console.log(`  Total:     ${agencies.length}`)
  console.log(`  ✅ Found:   ${found} (${Math.round(found / agencies.length * 100)}%)`)
  console.log(`  ❌ Missing: ${notFound}`)
  console.log(`  ⚠️  Errors:  ${errors}`)
  console.log(`  Mode:      ${DRY_RUN ? 'DRY RUN' : 'LIVE — logos saved to DB'}`)
  console.log(`════════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
