// scripts/intercom-news.mjs
// Gestion des Actualités (News) Intercom via l'API REST — Phase 1 de la couche proactive.
//
// On commence par AUDITER (lecture seule) : lister les newsfeeds (et leurs IDs), les news
// items existants (les 2 quick wins déjà LIVE), et les admins (pour récupérer un sender_id
// valide). On conçoit la publication ENSUITE, sur la structure réelle — pas à l'aveugle.
//
// USAGE :
//   INTERCOM_ACCESS_TOKEN=xxx node scripts/intercom-news.mjs news-audit
//
// Token = secret GitHub `INTERCOM_ACCESS_TOKEN` (write-only, consommé via le workflow
// intercom-content.yml), ou .env.local en local. Workspace US → api.intercom.io.
// Scope : "Read content data" pour l'audit (Write pour la future publication).
// Rappel LPD : News = sortant vers les utilisateurs SaaS (agents). Aucune donnée client.

const TOKEN = process.env.INTERCOM_ACCESS_TOKEN
const BASE = process.env.INTERCOM_API_BASE || 'https://api.intercom.io'
const API_VERSION = process.env.INTERCOM_API_VERSION || '2.11'
const mode = (process.argv[2] || 'news-audit').toLowerCase()

if (!TOKEN) {
  console.error(
    '✗ INTERCOM_ACCESS_TOKEN manquant.\n' +
      '  GitHub : secret Actions INTERCOM_ACCESS_TOKEN (scope Read content data).\n' +
      '  Local  : INTERCOM_ACCESS_TOKEN=... dans .env.local (gitignoré).',
  )
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'Intercom-Version': API_VERSION,
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body)
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path} — ${detail}`)
  }
  return body
}

// Liste paginée (curseur Intercom : pages.next.starting_after).
async function listAll(path) {
  const out = []
  let startingAfter = null
  do {
    const sep = path.includes('?') ? '&' : '?'
    const url = `${path}${sep}per_page=150${startingAfter ? `&starting_after=${encodeURIComponent(startingAfter)}` : ''}`
    const body = await api(url)
    if (Array.isArray(body?.data)) out.push(...body.data)
    startingAfter = body?.pages?.next?.starting_after ?? null
  } while (startingAfter)
  return out
}

async function newsAudit() {
  console.log(`→ Intercom News audit (${BASE}, API ${API_VERSION})\n`)

  // Admins / teammates → pour récupérer un sender_id valide (obligatoire à la publication).
  const adminsBody = await api('/admins')
  const admins = Array.isArray(adminsBody?.admins) ? adminsBody.admins : []
  console.log(`Admins (sender_id possibles) : ${admins.length}`)
  for (const a of admins) console.log(`  • [${a.id}] ${a.name ?? '—'}  ${a.email ?? ''}`)
  console.log('')

  // Newsfeeds → IDs nécessaires pour assigner les news items.
  const feeds = await listAll('/news/newsfeeds')
  console.log(`Newsfeeds : ${feeds.length}`)
  for (const f of feeds) {
    console.log(`  • [${f.id}] ${f.name ?? '—'}  (état: ${f.state ?? '—'})`)
  }
  console.log('')

  // News items existants (les quick wins déjà LIVE).
  const items = await listAll('/news/news_items')
  console.log(`News items : ${items.length}`)
  for (const n of items) {
    const feedsAssigned = Array.isArray(n.newsfeed_assignments)
      ? n.newsfeed_assignments.map((x) => x.newsfeed_id).join(', ')
      : '—'
    console.log(`  • [${n.id}] ${n.title ?? '—'}`)
    console.log(`      état: ${n.state ?? '—'}   sender_id: ${n.sender_id ?? '—'}   newsfeeds: ${feedsAssigned}`)
  }

  console.log('\n──────── Pour la suite (publication) ────────')
  console.log('Besoin de : 1 sender_id (admin ci-dessus) + le newsfeed_id "Agents MEGGA"')
  console.log('(à créer au dashboard — les newsfeeds ne sont PAS créables par l\'API).')
}

async function main() {
  switch (mode) {
    case 'news-audit':
      await newsAudit()
      break
    case 'news-publish':
      console.error(
        '✗ mode "news-publish" pas encore implémenté.\n' +
          '  Lance d\'abord "news-audit" pour récupérer le sender_id + le newsfeed_id réels,\n' +
          '  puis on construit la publication sur la structure réelle.',
      )
      process.exit(2)
      break
    default:
      console.error(`✗ mode inconnu: "${mode}". Attendu : news-audit | news-publish`)
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
