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
// Client partagé depuis le 17 août 2026 : `scripts/vitrine-aide.mjs` lit le même
// corpus pour générer megga.ch/aide. Auth, version d'API et pagination y vivent
// une seule fois.
import { creerClientIntercom, BASE_PAR_DEFAUT, VERSION_PAR_DEFAUT } from './_shared/intercom-api.mjs'

const BASE = BASE_PAR_DEFAUT
const API_VERSION = VERSION_PAR_DEFAUT
const mode = (process.argv[2] || 'audit').toLowerCase()

// Ce script n'a rien à faire sans jeton : il sort. (Le générateur de la vitrine,
// lui, distingue la CI du poste local — voir vitrine-aide.mjs.)
let client
try {
  client = creerClientIntercom()
} catch (e) {
  console.error(`✗ ${e.message}`)
  process.exit(1)
}
const { api, listAll } = client

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
// Crée de NOUVEAUX articles Help Center à partir de scripts/_data/intercom-articles-content.json
// (rédigés grounded dans le code). Par défaut en BROUILLON (revue + passage live au dashboard).
// Contenu FR : texte dans la locale par défaut + traduction `fr` (miroir des 7 articles existants).
// Dédup par titre → re-run sûr. ARTICLE_STATE=published pour publier direct.

const AUTHOR_ID = Number(process.env.INTERCOM_AUTHOR_ID || 10788807) // Julien Gauthier
const ARTICLE_STATE = (process.env.ARTICLE_STATE || 'draft').toLowerCase()

async function articlesPublish() {
  console.log(`→ Articles publish (état=${ARTICLE_STATE}, author=${AUTHOR_ID}, ${BASE})\n`)
  const items = JSON.parse(readFileSync(new URL('./_data/intercom-articles-content.json', import.meta.url), 'utf8'))

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

// ───────────────────────── Promotion brouillon → publié (MT2) ─────────────────────────
// Publie des articles DÉJÀ rédigés mais en brouillon (lot articles-publish). Pour qu'un
// article soit visible (Messenger côté agent + Help Center public + corpus Fin), il faut
// que l'article ET chacune de ses locales soient `published` — le mode `migrate` ne touche
// QUE la locale fr, pas l'état top-level. Ici on passe les DEUX à published.
//
// Cible par défaut : tous les brouillons SAUF l'article démo (auto-maintenu, pas de liste
// codée en dur). Restreignable via PROMOTE_IDS="id1,id2" (sécurité / publication ciblée).
// Toujours faire un `articles-promote-dry` d'abord pour relire la liste exacte.

// Identifiants ciblés par `articles-unpublish`. ⛔ Sans eux le mode refuse de
// tourner : « tout dépublier » n'est jamais l'intention.
const UNPUBLISH_IDS = (process.env.UNPUBLISH_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const PROMOTE_IDS = (process.env.PROMOTE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

async function buildPromotePlans() {
  const articles = await listAll('/articles')
  const plans = []
  for (const a of articles) {
    if (DEMO_ARTICLE_IDS.has(String(a.id))) continue
    if (a.state === 'published') continue // déjà live
    if (PROMOTE_IDS.length && !PROMOTE_IDS.includes(String(a.id))) continue
    const full = await api(`/articles/${a.id}`) // GET complet (locales + body)
    const tc = full.translated_content || {}
    const locales = Object.keys(tc).filter((k) => k !== 'type' && tc[k] && typeof tc[k] === 'object')
    const hasBody =
      locales.some((loc) => tc[loc].body && tc[loc].body.trim()) || (full.body && full.body.trim())
    plans.push({ id: String(a.id), title: full.title, state: a.state, locales, hasBody, full })
  }
  return plans
}

async function articlesPromote(dry) {
  console.log(`→ Articles promote (brouillon → publié)${dry ? ' [DRY-RUN]' : ''} (${BASE}, API ${API_VERSION})`)
  console.log(PROMOTE_IDS.length ? `  cible: ${PROMOTE_IDS.join(', ')}\n` : '  cible: tous les brouillons (hors démo)\n')
  const plans = await buildPromotePlans()
  if (!plans.length) {
    console.log('Aucun brouillon à publier (hors démo). Rien à faire.')
    return
  }
  for (const p of plans) {
    console.log(`• [${p.id}] ${p.title}`)
    console.log(`    état: ${p.state} → published   locales: ${p.locales.join(', ') || '—'}${p.hasBody ? '' : '   ⚠ pas de body'}`)
  }
  if (dry) {
    console.log(`\nDRY-RUN : aucune écriture (${plans.length} article(s) seraient publiés).`)
    console.log('Lance le mode "articles-promote" (scope Write content data) pour appliquer.')
    return
  }
  let done = 0
  let skipped = 0
  let failed = 0
  for (const p of plans) {
    if (!p.hasBody) {
      console.log(`= [${p.id}] ${p.title} — pas de body exploitable, SKIP`)
      skipped++
      continue
    }
    // Reconstruit chaque locale existante en la passant à published (préserve titre/desc/body/author).
    const tc = p.full.translated_content || {}
    const out = {}
    for (const [loc, content] of Object.entries(tc)) {
      if (loc === 'type' || !content || typeof content !== 'object') continue
      out[loc] = writableLocale(content, { state: 'published' })
    }
    try {
      await api(`/articles/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ state: 'published', translated_content: out }),
      })
      console.log(`✓ [${p.id}] ${p.title} — publié (${Object.keys(out).join(', ')})`)
      done++
    } catch (err) {
      console.error(`✗ [${p.id}] ${p.title} — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nPubliés: ${done} | ignorés: ${skipped} | échecs: ${failed}`)
  console.log('Vérif : https://intercom.help/megga/fr (+ bouton « ? » in-app + corpus Fin).')
  if (failed) process.exitCode = 1
}

// ───────────────────────── Réécriture v2 : MAJ + créations (articles-update) ─────────────────────────
// Source : scripts/_data/intercom-articles-v2.json. `id` présent → MAJ de la locale FR d'un article live
// (PRÉSERVE EN et les autres locales, ne touche pas le top-level) ; `id` absent → création (FR, publié).
// `articles-update-dry` liste le plan sans rien écrire. Re-run sûr (dédup création par titre).

async function articlesUpdateRun(dry) {
  const items = JSON.parse(readFileSync(new URL('./_data/intercom-articles-v2.json', import.meta.url), 'utf8'))
  console.log(`→ Articles update${dry ? ' [DRY-RUN]' : ''} (${items.length} entrées · ${BASE})\n`)
  const existing = await listAll('/articles')
  const existingByTitle = new Map(existing.map((a) => [a.title, a]))

  let updated = 0
  let created = 0
  let skipped = 0
  let failed = 0
  for (const a of items) {
    if (a.id) {
      try {
        const full = await api(`/articles/${a.id}`)
        const tc = full.translated_content || {}
        const out = {}
        for (const [loc, content] of Object.entries(tc)) {
          if (loc === 'type' || !content || typeof content !== 'object') continue
          out[loc] = writableLocale(content) // préserve EN (+ autres) tel quel
        }
        out.fr = {
          type: 'article_content',
          title: a.title,
          description: a.summary,
          body: a.body_html,
          author_id: (tc.fr && tc.fr.author_id) || full.author_id || AUTHOR_ID,
          state: 'published',
        }
        // Locale EN : écrite seulement si la traduction est fournie (préserve l'existant sinon).
        if (a.body_html_en) {
          out.en = {
            type: 'article_content',
            title: a.title_en || a.title,
            description: a.summary_en || a.summary,
            body: a.body_html_en,
            author_id: (tc.en && tc.en.author_id) || full.author_id || AUTHOR_ID,
            state: 'published',
          }
        }
        console.log(`• MAJ [${a.id}] ${a.title}  (FR ${a.body_html.length}${a.body_html_en ? ' + EN ' + a.body_html_en.length : ''} car.)`)
        if (!dry) {
          await api(`/articles/${a.id}`, { method: 'PUT', body: JSON.stringify({ translated_content: out }) })
          updated++
        }
      } catch (err) {
        console.error(`✗ MAJ [${a.id}] ${a.title} — ${err.message}`)
        failed++
      }
    } else {
      if (existingByTitle.has(a.title)) {
        console.log(`= déjà présent : « ${a.title} » (skip création)`)
        skipped++
        continue
      }
      const fr = { type: 'article_content', title: a.title, description: a.summary, body: a.body_html, author_id: AUTHOR_ID, state: 'published' }
      const payload = {
        title: a.title, description: a.summary, body: a.body_html, author_id: AUTHOR_ID, state: 'published',
        parent_id: Number(a.collection_id), parent_type: 'collection', translated_content: { fr },
      }
      console.log(`• CRÉATION « ${a.title} » (collection ${a.collection_id})`)
      if (!dry) {
        try {
          const res = await api('/articles', { method: 'POST', body: JSON.stringify(payload) })
          console.log(`  ✓ créé [${res?.id ?? '?'}]`)
          created++
        } catch (err) {
          console.error(`  ✗ ${err.message}`)
          failed++
        }
      }
    }
  }
  if (dry) {
    console.log(`\nDRY-RUN : aucune écriture. ${items.filter((x) => x.id).length} MAJ + ${items.filter((x) => !x.id).length} création(s) prévues.`)
    return
  }
  console.log(`\n──────── Résultat ────────\nMAJ: ${updated} | créés: ${created} | déjà présents: ${skipped} | échecs: ${failed}`)
  console.log('Vérif : https://intercom.help/megga/fr')
  if (failed) process.exitCode = 1
}

/**
 * Dépublie des articles (publié → brouillon). Symétrique d'`articles-promote`.
 *
 * POURQUOI CE MODE EXISTE. Un article qui documente une fonctionnalité RETIRÉE
 * est pire qu'un article absent : il se lit comme vrai. « Le portail vendeur »
 * (15492031) décrit une surface supprimée du produit le 26 juillet 2026, tables
 * comprises — sa clé d'aide est partie du CRM, mais l'article restait `published`,
 * donc visible dans le centre d'aide public ET dans le corpus de Fin, qui s'en
 * servait pour répondre.
 *
 * ⛔ CIBLAGE OBLIGATOIRE. Contrairement à `articles-promote`, qui peut traiter
 * « tous les brouillons », ce mode REFUSE de tourner sans `UNPUBLISH_IDS` : son
 * cas dégénéré dépublierait le centre d'aide entier.
 */
async function articlesUnpublish(dry) {
  console.log(`→ Articles unpublish (publié → brouillon)${dry ? ' [DRY-RUN]' : ''} (${BASE}, API ${API_VERSION})`)
  if (!UNPUBLISH_IDS.length) {
    console.error('✗ UNPUBLISH_IDS est vide. Ce mode exige des identifiants explicites (CSV).')
    process.exit(1)
  }
  console.log(`  cible: ${UNPUBLISH_IDS.join(', ')}\n`)

  const plans = []
  for (const id of UNPUBLISH_IDS) {
    let full
    try {
      full = await api(`/articles/${id}`)
    } catch (err) {
      console.error(`✗ [${id}] introuvable — ${err.message}`)
      process.exitCode = 1
      continue
    }
    plans.push({ id: String(full.id), title: full.title, state: full.state, full })
  }
  for (const p of plans) {
    console.log(`• [${p.id}] ${p.title}`)
    console.log(`    état: ${p.state} → draft`)
  }
  if (dry) {
    console.log(`\nDRY-RUN : aucune écriture (${plans.length} article(s) seraient dépubliés).`)
    return
  }

  let done = 0
  let failed = 0
  for (const p of plans) {
    if (p.state === 'draft') {
      console.log(`= [${p.id}] ${p.title} — déjà en brouillon, rien à faire`)
      continue
    }
    // Chaque locale repasse en draft : laisser une locale `published` garderait
    // l'article visible dans SA langue, ce qui est exactement le défaut qu'on ferme.
    const tc = p.full.translated_content || {}
    const out = {}
    for (const [loc, content] of Object.entries(tc)) {
      if (loc === 'type' || !content || typeof content !== 'object') continue
      out[loc] = writableLocale(content, { state: 'draft' })
    }
    try {
      await api(`/articles/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ state: 'draft', translated_content: out }),
      })
      console.log(`✓ [${p.id}] ${p.title} — dépublié (${Object.keys(out).join(', ')})`)
      done++
    } catch (err) {
      console.error(`✗ [${p.id}] ${p.title} — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nDépubliés: ${done} | échecs: ${failed}`)
  console.log('Vérif : mode "audit" (état attendu : draft) + https://intercom.help/megga/fr')
  if (failed) process.exitCode = 1
}

async function main() {
  switch (mode) {
    case 'audit':
      await audit()
      break
    case 'articles-unpublish-dry':
      await articlesUnpublish(true)
      break
    case 'articles-unpublish':
      await articlesUnpublish(false)
      break
    case 'articles-publish':
      await articlesPublish()
      break
    case 'articles-promote-dry':
      await articlesPromote(true)
      break
    case 'articles-promote':
      await articlesPromote(false)
      break
    case 'articles-update-dry':
      await articlesUpdateRun(true)
      break
    case 'articles-update':
      await articlesUpdateRun(false)
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
      console.error(`✗ mode inconnu: "${mode}". Attendu : audit | articles-unpublish-dry | articles-unpublish | articles-publish | articles-promote-dry | articles-promote | articles-update-dry | articles-update | attributes-declare | migrate-dry | migrate | migrate-collections | delete-demo`)
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`)
  process.exit(1)
})
