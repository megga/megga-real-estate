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

// Cibles réelles (audit du 2026-06-13). Surchargables par env si besoin.
const NEWSFEED_ID = Number(process.env.INTERCOM_NEWSFEED_ID || 104188) // Users Newsfeed (agents connectés)
const SENDER_ID = Number(process.env.INTERCOM_SENDER_ID || 10788807) // Julien Gauthier
// État de création : 'draft' par défaut (revue dashboard avant live). NEWS_STATE=live pour publier direct.
const NEWS_STATE = (process.env.NEWS_STATE || 'draft').toLowerCase()

// Posts validés (copie validée 2026-06-13). N5 « Nouveau ce mois-ci » = rituel mensuel
// manuel, pas seedé ici. body = HTML ; le lien vers l'article FR est ajouté au runtime.
const POSTS = [
  {
    key: 'N1',
    title: 'Importer vos leads en 2 minutes',
    html:
      "<p>Vos contacts existants n'ont pas à être ressaisis un par un. Importez un fichier CSV " +
      "(export de votre ancien outil, tableur, liste de mandats) et MEGGA crée les fiches d'un coup.</p>" +
      "<p>Rien n'est envoyé à personne : l'import alimente seulement votre base.</p>",
    articleId: '15424962',
    cta: 'Voir comment faire',
  },
  {
    key: 'N2',
    title: 'Le pipeline, à votre façon de travailler',
    html:
      '<p>Le pipeline suit vos affaires de la prise de mandat à la signature. Les colonnes se ' +
      'réorganisent pour coller à votre façon de travailler — pas l\'inverse.</p>' +
      '<p>Un coup d\'œil vous dit où en est chaque dossier et ce qui bloque.</p>',
    articleId: '15424971',
    cta: 'Découvrir le pipeline',
  },
  {
    key: 'N3',
    title: 'Le KYC : un assistant, pas un péage',
    html:
      '<p>Le KYC de MEGGA vous aide à vérifier un client (PEP, sanctions) quand vous en avez besoin — ' +
      'il ne bloque aucune de vos actions.</p>' +
      "<p>C'est le notaire qui finalise la transaction ; MEGGA vous fait gagner du temps sur la " +
      'vérification. À utiliser quand c\'est utile, pas par obligation.</p>',
    articleId: '15424977',
    cta: 'En savoir plus',
  },
  {
    key: 'N4',
    title: 'Votre agenda dans MEGGA',
    html:
      '<p>Connectez Google Agenda ou Outlook une fois, et vos rendez-vous (visites, points clients) ' +
      'se synchronisent avec MEGGA.</p>' +
      '<p>Un seul endroit pour votre semaine, moins d\'allers-retours entre les outils.</p>',
    articleId: '15424986',
    cta: 'Connecter mon agenda',
  },
]

// URL publique FR d'un article (pour le lien de la News).
async function articleFrUrl(id) {
  try {
    const a = await api(`/articles/${id}`)
    return a?.translated_content?.fr?.url || a?.url || null
  } catch {
    return null
  }
}

async function newsPublish() {
  console.log(`→ News publish (état=${NEWS_STATE}, newsfeed=${NEWSFEED_ID}, sender=${SENDER_ID})\n`)
  // Dédup par titre : ne pas recréer un post déjà présent (re-run sûr).
  const existing = await listAll('/news/news_items')
  const existingTitles = new Set(existing.map((n) => n.title))

  let done = 0
  let skipped = 0
  let failed = 0
  for (const p of POSTS) {
    if (existingTitles.has(p.title)) {
      console.log(`= ${p.key} déjà présent : « ${p.title} » (skip)`)
      skipped++
      continue
    }
    let body = p.html
    if (p.articleId) {
      const url = await articleFrUrl(p.articleId)
      if (url) body += `<p><a href="${url}">${p.cta || 'En savoir plus'}</a></p>`
      else console.warn(`  ⚠ ${p.key} : URL article ${p.articleId} introuvable, post sans lien`)
    }
    const payload = {
      title: p.title,
      body,
      sender_id: SENDER_ID,
      state: NEWS_STATE,
      newsfeed_assignments: [{ newsfeed_id: NEWSFEED_ID, published_at: Math.floor(Date.now() / 1000) }],
    }
    try {
      const res = await api('/news/news_items', { method: 'POST', body: JSON.stringify(payload) })
      console.log(`✓ ${p.key} créé [${res?.id ?? '?'}] « ${p.title} » → état ${NEWS_STATE}`)
      done++
    } catch (err) {
      console.error(`✗ ${p.key} « ${p.title} » — ${err.message}`)
      failed++
    }
  }
  console.log(`\n──────── Résultat ────────\nCréés (${NEWS_STATE}): ${done} | déjà présents: ${skipped} | échecs: ${failed}`)
  console.log('Revue + image de couverture + passage « live » : dashboard Intercom > Actualités.')
  if (failed) process.exitCode = 1
}

async function main() {
  switch (mode) {
    case 'news-audit':
      await newsAudit()
      break
    case 'news-publish':
      await newsPublish()
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
