// scripts/intercom-content.mjs
// Audit (et plus tard migration) du contenu Help Center Intercom via l'API REST.
//
// POURQUOI : les 7 articles sont publiés mais rangés sous la locale EN ; la locale FR
// du Help Center est vide (intercom.help/megga/fr). Ce script sert d'abord à AUDITER
// l'état réel (id, état, locale par défaut, traductions présentes) avant toute écriture.
//
// USAGE :
//   INTERCOM_ACCESS_TOKEN=xxx node scripts/intercom-content.mjs audit
//   (mode "migrate" ajouté dans un 2e temps, une fois l'audit lu)
//
// Le token N'est JAMAIS dans le repo : il vient de l'env (secret GitHub Actions
// `INTERCOM_ACCESS_TOKEN` injecté par .github/workflows/intercom-content.yml, ou
// .env.local en exécution locale). Workspace Intercom = région US → api.intercom.io.
// Scope requis pour l'audit : "Read content data". (Write content data pour migrate.)

const TOKEN = process.env.INTERCOM_ACCESS_TOKEN
const BASE = process.env.INTERCOM_API_BASE || 'https://api.intercom.io'
const API_VERSION = process.env.INTERCOM_API_VERSION || '2.11'
const mode = (process.argv[2] || 'audit').toLowerCase()

if (!TOKEN) {
  console.error(
    '✗ INTERCOM_ACCESS_TOKEN manquant.\n' +
      '  GitHub : Settings → Secrets and variables → Actions → New repository secret\n' +
      '           name = INTERCOM_ACCESS_TOKEN (scope Intercom : Read content data).\n' +
      '  Local  : ajoute INTERCOM_ACCESS_TOKEN=... dans .env.local (gitignoré).',
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

function localesOf(article) {
  const tc = article?.translated_content
  if (!tc || typeof tc !== 'object') return []
  return Object.entries(tc)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([loc, v]) => ({ locale: loc, state: v.state ?? '?', title: v.title ?? '' }))
}

async function audit() {
  console.log(`→ Intercom Help Center audit (${BASE}, API ${API_VERSION})\n`)

  const collections = await listAll('/help_center/collections')
  const collById = new Map(collections.map((c) => [c.id, c]))
  console.log(`Collections : ${collections.length}`)
  for (const c of collections) {
    console.log(`  • [${c.id}] ${c.name}  (locale défaut: ${c.default_locale ?? '—'})`)
  }
  console.log('')

  const articles = await listAll('/articles')
  console.log(`Articles : ${articles.length}\n`)

  const localeCount = {}
  const missingFr = []

  for (const a of articles) {
    const coll = a.parent_id != null ? collById.get(a.parent_id) : null
    const locales = localesOf(a)
    for (const l of locales) localeCount[l.locale] = (localeCount[l.locale] || 0) + 1
    const hasFr = locales.some((l) => l.locale === 'fr')
    if (!hasFr) missingFr.push(a)

    console.log(`• [${a.id}] ${a.title}`)
    console.log(`    état: ${a.state}   locale défaut: ${a.default_locale ?? '—'}   collection: ${coll?.name ?? a.parent_id ?? '—'}`)
    console.log(
      `    traductions: ${
        locales.length ? locales.map((l) => `${l.locale}(${l.state})`).join(', ') : 'aucune'
      }`,
    )
  }

  console.log('\n──────── Résumé ────────')
  console.log(`Articles par locale : ${JSON.stringify(localeCount)}`)
  console.log(`Articles SANS version FR : ${missingFr.length}${missingFr.length ? ' → ' + missingFr.map((a) => a.id).join(', ') : ''}`)
  console.log(
    '\nDiagnostic attendu : tout sous "en", 0 sous "fr" → le Help Center FR (intercom.help/megga/fr)\n' +
      'est vide. La migration recopiera le contenu EN vers la locale FR (mode "migrate", à venir).',
  )
}

async function main() {
  switch (mode) {
    case 'audit':
      await audit()
      break
    case 'migrate':
    case 'migrate-dry':
      console.error(
        `✗ mode "${mode}" pas encore implémenté.\n` +
          '  On lance d\'abord "audit" pour voir la structure réelle des articles,\n' +
          '  puis on conçoit la migration sur des données réelles (pas à l\'aveugle).',
      )
      process.exit(2)
      break
    default:
      console.error(`✗ mode inconnu: "${mode}". Attendu : audit | migrate-dry | migrate`)
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
