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

import { readFileSync } from 'node:fs'

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

// Noms FR des collections (le Help Center FR liste les collections : sans traduction
// FR, /fr reste vide même si les articles ont leur version FR). IDs issus de l'audit.
const COLLECTION_FR = {
  '19659046': { name: 'Intégrations', description: 'Connecter et gérer les outils tiers.' },
  '19659047': { name: 'Démarrer', description: 'Tout ce qu’il faut pour bien commencer.' },
  '19659048': { name: 'Général', description: 'Informations utiles sur les sujets courants.' },
  '19659049': { name: 'Facturation', description: 'Gérer les paiements et l’abonnement.' },
}

async function migrateCollections() {
  console.log(`→ MIGRATE collections FR (${BASE}, API ${API_VERSION})\n`)
  const collections = await listAll('/help_center/collections')
  let done = 0
  let failed = 0
  for (const c of collections) {
    const fr = COLLECTION_FR[String(c.id)]
    if (!fr) {
      console.log(`= [${c.id}] ${c.name} — pas de mapping FR, skip`)
      continue
    }
    const tc = c.translated_content || {}
    console.log(`  [${c.id}] ${c.name} — locales actuelles: ${Object.keys(tc).filter((k) => k !== 'type' && tc[k]).join(', ') || '(top-level uniquement)'}`)
    // Reconstruit en préservant les locales existantes ; synthétise EN depuis le
    // top-level si translated_content est vide. Nom par défaut (top-level) non touché.
    const out = {}
    for (const [loc, content] of Object.entries(tc)) {
      if (loc === 'type' || !content || typeof content !== 'object') continue
      out[loc] = { type: content.type || 'group_content', name: content.name, description: content.description ?? '' }
    }
    if (!out.en) out.en = { type: 'group_content', name: c.name, description: c.description ?? '' }
    out.fr = { type: 'group_content', name: fr.name, description: fr.description }
    try {
      await api(`/help_center/collections/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: c.name, translated_content: out }),
      })
      console.log(`✓ [${c.id}] ${c.name} → fr: ${fr.name}`)
      done++
    } catch (err) {
      console.error(`✗ [${c.id}] ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nÉcrits: ${done} | échecs: ${failed}`)
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

// ───────────────────────── Publication d'articles (MT1) ─────────────────────────
// Crée de NOUVEAUX articles Help Center à partir de scripts/intercom-articles-content.json
// (rédigés grounded dans le code). Par défaut en BROUILLON (revue + passage live au dashboard).
// Contenu FR : texte dans la locale par défaut + traduction `fr` (miroir des 7 articles existants).
// Dédup par titre → re-run sûr. ARTICLE_STATE=published pour publier direct.

const AUTHOR_ID = Number(process.env.INTERCOM_AUTHOR_ID || 10788807) // Julien Gauthier
const ARTICLE_STATE = (process.env.ARTICLE_STATE || 'draft').toLowerCase()

async function articlesPublish() {
  console.log(`→ Articles publish (état=${ARTICLE_STATE}, author=${AUTHOR_ID}, ${BASE})\n`)
  const items = JSON.parse(readFileSync(new URL('./intercom-articles-content.json', import.meta.url), 'utf8'))

  const existing = await listAll('/articles')
  const existingTitles = new Set(existing.map((a) => a.title))

  let done = 0
  let skipped = 0
  let failed = 0
  for (const a of items) {
    if (existingTitles.has(a.title)) {
      console.log(`= déjà présent : « ${a.title} » (skip)`)
      skipped++
      continue
    }
    const localeContent = {
      type: 'article_content',
      title: a.title,
      description: a.summary,
      body: a.body_html,
      author_id: AUTHOR_ID,
      state: ARTICLE_STATE,
    }
    const payload = {
      title: a.title,
      description: a.summary,
      body: a.body_html,
      author_id: AUTHOR_ID,
      state: ARTICLE_STATE,
      parent_id: Number(a.collection_id),
      parent_type: 'collection',
      translated_content: { fr: localeContent },
    }
    try {
      const res = await api('/articles', { method: 'POST', body: JSON.stringify(payload) })
      console.log(`✓ créé [${res?.id ?? '?'}] « ${a.title} » → ${ARTICLE_STATE} (collection ${a.collection_id})`)
      done++
    } catch (err) {
      console.error(`✗ « ${a.title} » — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nCréés (${ARTICLE_STATE}) : ${done} | déjà présents : ${skipped} | échecs : ${failed}`)
  console.log('Revue + passage « live » : dashboard Intercom → Help Center → Articles.')
  if (failed) process.exitCode = 1
}

// ───────────────────────── Déclaration des CDAs (MT4) ─────────────────────────
// Déclare les Custom Data Attributes déjà ENVOYÉS au boot (src/lib/intercom.ts) mais
// jamais déclarés → invisibles en ciblage tant qu'ils ne sont pas créés. Les `name`
// DOIVENT être identiques aux clés du boot, sinon doublon non relié.
// NB : déclarer ≠ recevoir — l'attribut devient sélectionnable dans le builder, mais
// reste sans valeurs tant qu'un VRAI user ne les a pas transmises en prod.
// Frontière LPD : uniquement des attributs de l'agent / de l'agence SaaS.

const CDA_DEFS = [
  { name: 'role', model: 'contact', data_type: 'string', description: "Rôle de l'agent MEGGA (agent, admin, …)" },
  { name: 'canton', model: 'contact', data_type: 'string', description: "Canton suisse de l'agent" },
  { name: 'onboarding_completed', model: 'contact', data_type: 'boolean', description: "L'agent a terminé l'onboarding MEGGA" },
  { name: 'stripe_customer_id', model: 'company', data_type: 'string', description: "ID client Stripe de l'agence (facturation)" },
]

async function attributesDeclare() {
  console.log(`→ Déclaration des Custom Data Attributes (${BASE}, API ${API_VERSION})\n`)
  const body = await api('/data_attributes')
  const existing = new Set(
    (Array.isArray(body?.data) ? body.data : []).map((a) => `${a.model}:${a.name}`),
  )

  let done = 0
  let skipped = 0
  let failed = 0
  for (const def of CDA_DEFS) {
    if (existing.has(`${def.model}:${def.name}`)) {
      console.log(`= ${def.model}.${def.name} déjà déclaré (skip)`)
      skipped++
      continue
    }
    try {
      await api('/data_attributes', { method: 'POST', body: JSON.stringify(def) })
      console.log(`✓ ${def.model}.${def.name} (${def.data_type}) déclaré`)
      done++
    } catch (err) {
      console.error(`✗ ${def.model}.${def.name} — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nDéclarés : ${done} | déjà présents : ${skipped} | échecs : ${failed}`)
  console.log('Rappel : un attribut déclaré devient sélectionnable mais reste vide tant qu\'un vrai user ne l\'a pas transmis.')
  if (failed) process.exitCode = 1
}

async function main() {
  switch (mode) {
    case 'audit':
      await audit()
      break
    case 'articles-publish':
      await articlesPublish()
      break
    case 'attributes-declare':
      await attributesDeclare()
      break
    case 'migrate-dry':
      await migrateDry()
      break
    case 'migrate':
      await migrate()
      break
    case 'migrate-collections':
      await migrateCollections()
      break
    case 'delete-demo':
      await deleteDemo()
      break
    default:
      console.error(`✗ mode inconnu: "${mode}". Attendu : audit | articles-publish | attributes-declare | migrate-dry | migrate | migrate-collections | delete-demo`)
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
