#!/usr/bin/env node

/**
 * Scrape real logos from agency websites
 *
 * Strategy (priority order):
 * 1. <meta property="og:image"> — often the best quality logo
 * 2. <link rel="apple-touch-icon"> — high-res icon (180px+)
 * 3. <link rel="icon" type="image/png" sizes="192x192"> or similar large favicon
 * 4. <img> in <header>/<nav> with "logo" in class/id/alt/src
 * 5. First <img> in <header>/<nav>
 * 6. <link rel="icon"> — fallback favicon
 *
 * Usage:
 *   node scripts/scrape-logos.mjs                # All agencies
 *   node scripts/scrape-logos.mjs --limit=50     # First 50
 *   node scripts/scrape-logos.mjs --dry-run      # Preview only
 *   node scripts/scrape-logos.mjs --force        # Re-scrape even if logo exists
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 99999

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── Helpers ─────────────────────────────────────────────────

function extractDomain(url) {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) clean = 'https://' + clean
    return new URL(clean).origin
  } catch {
    return null
  }
}

function resolveUrl(base, path) {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('//')) return 'https:' + path
  if (path.startsWith('/')) return base + path
  return base + '/' + path
}

function isValidLogoUrl(url) {
  if (!url) return false
  // Skip tracking pixels, spacers, tiny images
  const lower = url.toLowerCase()
  if (lower.includes('pixel') || lower.includes('spacer') || lower.includes('tracking')) return false
  if (lower.includes('.gif') && lower.includes('1x1')) return false
  // Must be an image
  if (lower.match(/\.(png|jpg|jpeg|svg|webp|ico)(\?|$)/i) || lower.includes('image') || lower.includes('logo')) return true
  // Accept if no extension but looks like a CDN/image URL
  if (lower.includes('cdn') || lower.includes('img') || lower.includes('asset') || lower.includes('upload')) return true
  return true // be permissive
}

// ── Extract logo from HTML ──────────────────────────────────

function extractLogoFromHtml(html, baseUrl) {
  const candidates = []

  // 1. og:image (often the logo or brand image)
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogMatch) {
    const url = resolveUrl(baseUrl, ogMatch[1])
    if (url && isValidLogoUrl(url)) candidates.push({ url, priority: 1, source: 'og:image' })
  }

  // 2. apple-touch-icon (high-res, usually 180px)
  const appleMatches = html.matchAll(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/gi)
  for (const m of appleMatches) {
    const url = resolveUrl(baseUrl, m[1])
    if (url && isValidLogoUrl(url)) candidates.push({ url, priority: 2, source: 'apple-touch-icon' })
  }

  // 3. Large favicons (32px+)
  const iconMatches = html.matchAll(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["'][^>]*/gi)
  for (const m of iconMatches) {
    const href = m[1]
    const sizeMatch = m[0].match(/sizes=["'](\d+)x(\d+)["']/i)
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 16
    const url = resolveUrl(baseUrl, href)
    if (url && isValidLogoUrl(url) && size >= 32) {
      candidates.push({ url, priority: 3, source: `favicon-${size}px`, size })
    }
  }

  // 4. <img> with "logo" in class/id/alt/src inside <header> or <nav>
  const headerMatch = html.match(/<(?:header|nav)[^>]*>([\s\S]*?)<\/(?:header|nav)>/i)
  if (headerMatch) {
    const headerHtml = headerMatch[1]
    const logoImgs = headerHtml.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*/gi)
    for (const m of logoImgs) {
      const src = m[1]
      const fullTag = m[0].toLowerCase()
      const url = resolveUrl(baseUrl, src)
      if (url && isValidLogoUrl(url)) {
        const isLogo = fullTag.includes('logo') || src.toLowerCase().includes('logo')
        candidates.push({ url, priority: isLogo ? 4 : 5, source: isLogo ? 'header-logo-img' : 'header-img' })
      }
    }
  }

  // 5. Any <img> with "logo" in src/class/alt anywhere on page
  if (candidates.length === 0) {
    const allLogoImgs = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*/gi)
    for (const m of allLogoImgs) {
      const src = m[1]
      const fullTag = m[0].toLowerCase()
      if ((fullTag.includes('logo') || src.toLowerCase().includes('logo')) && !src.includes('footer')) {
        const url = resolveUrl(baseUrl, src)
        if (url && isValidLogoUrl(url)) {
          candidates.push({ url, priority: 6, source: 'page-logo-img' })
          break // take first one only
        }
      }
    }
  }

  // 6. Fallback: any favicon
  if (candidates.length === 0) {
    const anyIcon = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i)
    if (anyIcon) {
      const url = resolveUrl(baseUrl, anyIcon[1])
      if (url) candidates.push({ url, priority: 7, source: 'favicon-fallback' })
    }
  }

  // Sort by priority (lower = better)
  candidates.sort((a, b) => a.priority - b.priority)

  // Prefer header/nav logo > apple-touch-icon > page-logo > og:image
  // og:image is often a hero photo, not a logo
  const headerLogo = candidates.find(c => c.source.includes('header-logo'))
  if (headerLogo) return headerLogo

  const pageLogo = candidates.find(c => c.source === 'page-logo-img')
  if (pageLogo) return pageLogo

  const appleIcon = candidates.find(c => c.source === 'apple-touch-icon')
  if (appleIcon) return appleIcon

  // Only use og:image if the URL contains "logo" — otherwise it's likely a photo
  const ogImage = candidates.find(c => c.source === 'og:image')
  if (ogImage && ogImage.url.toLowerCase().includes('logo')) return ogImage

  // Large favicon as fallback
  const largeFavicon = candidates.find(c => c.source.startsWith('favicon-') && c.size >= 64)
  if (largeFavicon) return largeFavicon

  // Any remaining candidate except og:image (which is likely a photo)
  const nonOg = candidates.find(c => c.source !== 'og:image')
  if (nonOg) return nonOg

  return candidates[0] || null
}

// ── Verify image URL is actually reachable ──────────────────

async function verifyImage(url) {
  try {
    const resp = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return false
    const ct = resp.headers.get('content-type') || ''
    return ct.startsWith('image/') || ct.includes('svg') || ct.includes('icon')
  } catch {
    // HEAD might not work, try GET
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      })
      const ct = resp.headers.get('content-type') || ''
      await resp.arrayBuffer() // consume
      return resp.ok && (ct.startsWith('image/') || ct.includes('svg'))
    } catch {
      return false
    }
  }
}

// ── Fetch agencies ──────────────────────────────────────────

async function fetchAgencies() {
  const all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const filter = FORCE ? 'website_url=not.is.null' : 'website_url=not.is.null'
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/agency_profiles?select=id,name,website_url,logo_url&${filter}&order=id&limit=${pageSize}&offset=${from}`,
      { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
    )
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`)
    const data = await resp.json()
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all.slice(0, LIMIT)
}

// ── Update logo ─────────────────────────────────────────────

async function updateLogo(id, logoUrl) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/agency_profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ logo_url: logoUrl }),
  })
  if (!resp.ok) throw new Error(`Update failed: ${resp.status}`)
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Fetching agencies...')
  const agencies = await fetchAgencies()
  console.log(`   ${agencies.length} agencies to process\n`)

  let found = 0, notFound = 0, errors = 0, skipped = 0

  for (let i = 0; i < agencies.length; i++) {
    const a = agencies[i]

    // Skip if already has a scraped logo (not logo.dev)
    if (!FORCE && a.logo_url && !a.logo_url.includes('logo.dev')) {
      skipped++
      continue
    }

    const baseUrl = extractDomain(a.website_url)
    if (!baseUrl) {
      errors++
      console.log(`  ⚠️  ${i + 1}/${agencies.length} ${a.name} — invalid URL`)
      continue
    }

    try {
      const resp = await fetch(baseUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-CH,fr;q=0.9,de;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      })

      if (!resp.ok) {
        notFound++
        console.log(`  ❌ ${i + 1}/${agencies.length} ${a.name} → ${resp.status}`)
        continue
      }

      const html = await resp.text()
      const result = extractLogoFromHtml(html, baseUrl)

      if (result) {
        // Verify the image is reachable
        const valid = await verifyImage(result.url)
        if (valid) {
          found++
          if (!DRY_RUN) await updateLogo(a.id, result.url)
          console.log(`  ✅ ${i + 1}/${agencies.length} ${a.name} → ${result.source} → ${result.url.substring(0, 80)}`)
        } else {
          notFound++
          console.log(`  ❌ ${i + 1}/${agencies.length} ${a.name} → ${result.source} broken: ${result.url.substring(0, 60)}`)
        }
      } else {
        notFound++
        console.log(`  ❌ ${i + 1}/${agencies.length} ${a.name} → no logo found`)
      }
    } catch (err) {
      errors++
      const msg = err.name === 'TimeoutError' ? 'timeout' : err.message?.substring(0, 40)
      console.log(`  ⚠️  ${i + 1}/${agencies.length} ${a.name} → ${msg}`)
    }

    // Rate limit: 200ms between requests
    await new Promise(r => setTimeout(r, 200))

    if ((i + 1) % 100 === 0) {
      console.log(`\n   ── ${i + 1}/${agencies.length} | ✅ ${found} | ❌ ${notFound} | ⚠️ ${errors} | ⏭️ ${skipped} ──\n`)
    }
  }

  console.log(`\n════════════════════════════════════════`)
  console.log(`  Total:     ${agencies.length}`)
  console.log(`  ✅ Found:   ${found}`)
  console.log(`  ❌ Missing: ${notFound}`)
  console.log(`  ⚠️  Errors:  ${errors}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  Mode:      ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`════════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
