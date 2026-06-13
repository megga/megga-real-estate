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

// ───────────────────────── Migration FR ─────────────────────────
//
// Stratégie ADDITIVE : on crée une locale "fr" publiée sans jamais toucher l'existant.
//   - Article avec un brouillon FR déjà rédigé → on le PUBLIE tel quel (pas d'écrasement).
//   - Article sans FR → on COPIE le contenu EN (qui est déjà en français) vers une
//     traduction FR publiée.
// Sécurité : on relit l'article complet et on reconstruit TOUTES les locales existantes
// avant d'ajouter le FR. Que l'API merge ou remplace, le contenu EN ne peut pas être perdu.
// L'article démo Intercom n'est PAS touché par migrate (mode "delete-demo" séparé).

const DEMO_ARTICLE_IDS = new Set(['15408130']) // "Your first public article" (sample Intercom)

// Ne garde que les champs ÉCRIVABLES d'un contenu de locale (drop nulls / read-only).
function writableLocale(content, overrides = {}) {
  const out = { type: 'article_content' }
  for (const k of ['title', 'description', 'body', 'author_id', 'state']) {
    const v = overrides[k] !== undefined ? overrides[k] : content?.[k]
    if (v !== undefined && v !== null) out[k] = v
  }
  return out
}

// Reconstruit translated_content en préservant chaque locale existante + applique fr.
function buildNewTranslatedContent(full, frContent) {
  const tc = full.translated_content || {}
  const out = {}
  for (const [loc, content] of Object.entries(tc)) {
    if (loc === 'type' || !content || typeof content !== 'object') continue
    out[loc] = writableLocale(content)
  }
  out.fr = frContent
  return out
}

async function buildArticlePlans() {
  const articles = await listAll('/articles')
  const plans = []
  for (const a of articles) {
    if (DEMO_ARTICLE_IDS.has(String(a.id))) continue
    const full = await api(`/articles/${a.id}`) // GET complet (body entier)
    const tc = full.translated_content || {}
    const en = tc.en
    const fr = tc.fr
    const localesBefore = Object.keys(tc).filter((k) => k !== 'type' && tc[k])

    let action, source, bodyLen, frContent
    if (fr && fr.body && fr.body.trim()) {
      if (fr.state === 'published') {
        action = 'fr-already-published'
        source = 'FR déjà publié'
        bodyLen = fr.body.length
      } else {
        action = 'publish-existing-fr'
        source = 'brouillon FR existant → publier'
        bodyLen = fr.body.length
        frContent = writableLocale(fr, { state: 'published' })
      }
    } else if (en && en.body && en.body.trim()) {
      action = 'copy-en-to-fr'
      source = 'copie EN → FR (publié)'
      bodyLen = en.body.length
      frContent = writableLocale(en, {
        state: 'published',
        author_id: en.author_id ?? full.author_id,
      })
    } else {
      action = 'skip-no-source'
      source = 'aucune source exploitable'
      bodyLen = 0
    }

    plans.push({ id: String(a.id), title: full.title, localesBefore, action, source, bodyLen, full, frContent })
  }
  return plans
}

function printPlans(plans) {
  const counts = {}
  for (const p of plans) {
    counts[p.action] = (counts[p.action] || 0) + 1
    console.log(`• [${p.id}] ${p.title}`)
    console.log(`    locales actuelles : ${p.localesBefore.join(', ') || '—'}`)
    console.log(`    action : ${p.action}  (${p.source}, ${p.bodyLen} car.)`)
  }
  console.log('\n──────── Plan ────────')
  console.log(JSON.stringify(counts, null, 0))
}

async function migrateDry() {
  console.log(`→ DRY-RUN migration FR (lecture seule, ${BASE}, API ${API_VERSION})\n`)
  const plans = await buildArticlePlans()
  printPlans(plans)
  console.log(
    '\nAucune écriture effectuée. Lance le mode "migrate" (scope Write content data) pour appliquer.\n' +
      'Hors périmètre de migrate (à finir au dashboard) : noms FR des 4 collections,\n' +
      'langue par défaut du Help Center = français, et suppression de l\'article démo (mode delete-demo).',
  )
}

async function migrate() {
  console.log(`→ MIGRATE FR (écritures réelles, ${BASE}, API ${API_VERSION})\n`)
  const plans = await buildArticlePlans()
  let done = 0
  let skipped = 0
  let failed = 0
  for (const p of plans) {
    if (p.action === 'fr-already-published' || p.action === 'skip-no-source') {
      console.log(`= [${p.id}] ${p.title} — ${p.source} (rien à faire)`) ; skipped++
      continue
    }
    const newTc = buildNewTranslatedContent(p.full, p.frContent)
    // Garde-fou : on ne PUT que si toutes les locales d'origine sont préservées.
    const ok = p.localesBefore.every((loc) => newTc[loc] && (loc === 'fr' || newTc[loc].body))
    if (!ok) {
      console.error(`✗ [${p.id}] ${p.title} — garde-fou: locale d'origine manquante après reconstruction, SKIP`)
      failed++
      continue
    }
    try {
      await api(`/articles/${p.id}`, { method: 'PUT', body: JSON.stringify({ translated_content: newTc }) })
      console.log(`✓ [${p.id}] ${p.title} — ${p.action}`)
      done++
    } catch (err) {
      console.error(`✗ [${p.id}] ${p.title} — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nÉcrits: ${done} | inchangés: ${skipped} | échecs: ${failed}`)
  if (failed) process.exitCode = 1
}

async function deleteDemo() {
  console.log(`→ DELETE article(s) démo (${BASE}, API ${API_VERSION})\n`)
  for (const id of DEMO_ARTICLE_IDS) {
    try {
      const full = await api(`/articles/${id}`)
      await api(`/articles/${id}`, { method: 'DELETE' })
      console.log(`✓ supprimé [${id}] ${full.title}`)
    } catch (err) {
      console.error(`✗ [${id}] ${err.message}`)
      process.exitCode = 1
    }
  }
}

async function main() {
  switch (mode) {
    case 'audit':
      await audit()
      break
    case 'migrate-dry':
      await migrateDry()
      break
    case 'migrate':
      await migrate()
      break
    case 'delete-demo':
      await deleteDemo()
      break
    default:
      console.error(`✗ mode inconnu: "${mode}". Attendu : audit | migrate-dry | migrate | delete-demo`)
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
