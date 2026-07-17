// Sélecteur DÉTERMINISTE de savoir métier (knowledge_snippets) — module PUR
// (zéro I/O, zéro Deno), testable vitest. 0 embedding, 0 dépendance externe :
// la « bonne fiche » arrive dans le prompt par matching de mots-clés + action +
// canton, avec un comportement explicable ligne par ligne.
//
// Le caller (ai-copilot) fournit les snippets ACTIFS non-expirés (SELECT trivial,
// table minuscule) ; ce module normalise, score, sélectionne sous budget de tokens
// et formate le bloc injecté. Réutilisable tel quel par whatsapp-agent ensuite.

export interface KnowledgeSnippet {
  slug: string
  domain: string
  canton: string | null           // null = droit fédéral (toujours éligible)
  title: string
  body_md: string
  applies_to_actions: string[]
  keywords: string[]               // normalisés à l'écriture, re-normalisés ici par sûreté
  priority: number
  source_ref: string | null
  source_url: string
  verified_at: string              // ISO date (YYYY-MM-DD)
}

/** Minuscule, sans accents/diacritiques, espaces normalisés. */
export function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tokens de ≥3 lettres (chiffres exclus : on veut des mots, pas des montants). */
export function tokenize(s: string): Set<string> {
  const norm = normalizeText(s)
  const out = new Set<string>()
  for (const tok of norm.split(/[^a-z]+/)) {
    if (tok.length >= 3) out.add(tok)
  }
  return out
}

/** Substring avec frontières (ni lettre ni chiffre autour) : « co 216 » ne matche
 *  PAS « eco 216 » ; « 2/3 » matche « les 2/3 du ». Le needle peut contenir
 *  espaces/chiffres/symboles (%, /), d'où le test de frontière manuel plutôt que \b. */
function phraseMatch(hay: string, needle: string): boolean {
  if (!needle) return false
  let from = 0
  for (;;) {
    const idx = hay.indexOf(needle, from)
    if (idx === -1) return false
    const before = idx === 0 ? '' : hay[idx - 1]
    const after = idx + needle.length >= hay.length ? '' : hay[idx + needle.length]
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true
    from = idx + 1
  }
}

/** Score déterministe d'un snippet vs la requête. 0 = non pertinent.
 *  ÉLIGIBILITÉ = au moins un mot-clé matché (sinon 0, quels que soient les bonus) :
 *  un snippet ne s'injecte que si le message parle de son sujet, jamais sur le seul
 *  fait qu'il cible l'action courante (sinon tout snippet « chat » polluerait chaque
 *  requête). +3 par mot-clé MULTI-MOTS présent (substring dans le message normalisé),
 *  +1 par mot-clé simple présent dans les tokens ; PUIS, si éligible, +2 si l'action
 *  est ciblée et +2 si le canton du snippet = canton du contexte. */
export function scoreSnippet(
  snippet: KnowledgeSnippet,
  normMsg: string,
  msgTokens: Set<string>,
  action: string | undefined,
  canton: string | null | undefined,
): number {
  let keywordScore = 0
  for (const kwRaw of snippet.keywords ?? []) {
    const kw = normalizeText(kwRaw)
    if (!kw) continue
    if (kw.includes(' ')) {
      // Expression multi-mots : match fort, mais avec frontières (pas de sous-mot).
      if (phraseMatch(normMsg, kw)) keywordScore += 3
    } else if (/[^a-z]/.test(kw)) {
      // Mot-clé simple contenant chiffres/symboles (« 2/3 », « 0.3% ») : tokenize
      // les exclut → on passe par le match à frontières.
      if (phraseMatch(normMsg, kw)) keywordScore += 1
    } else if (kw.length >= 3 && msgTokens.has(kw)) {
      keywordScore += 1
    }
  }
  if (keywordScore === 0) return 0 // pas de mot-clé matché → non éligible

  let score = keywordScore
  if (action && (snippet.applies_to_actions ?? []).includes(action)) score += 2
  if (snippet.canton && canton && snippet.canton.toUpperCase() === String(canton).toUpperCase()) score += 2
  return score
}

/** ~ tokens d'un texte (approx. 4 caractères/token). */
function approxTokens(s: string): number {
  return Math.ceil((s || '').length / 4)
}

export interface SelectOptions {
  action?: string
  canton?: string | null
  maxSnippets?: number   // défaut 3
  budgetTokens?: number  // défaut 700
}

/** Sélection : score > 0, tri (score desc, priority desc, slug pour stabilité),
 *  top N sous budget de tokens (snippet entier ou rien, jamais tronqué). */
export function selectKnowledge(
  candidates: KnowledgeSnippet[],
  message: string,
  opts: SelectOptions = {},
): KnowledgeSnippet[] {
  const maxSnippets = opts.maxSnippets ?? 3
  const budget = opts.budgetTokens ?? 700
  const normMsg = normalizeText(message)
  const msgTokens = tokenize(message)

  const scored = (candidates ?? [])
    .map((s) => ({ s, score: scoreSnippet(s, normMsg, msgTokens, opts.action, opts.canton) }))
    .filter((x) => x.score > 0)
    .sort((a, b) =>
      b.score - a.score ||
      (b.s.priority ?? 0) - (a.s.priority ?? 0) ||
      a.s.slug.localeCompare(b.s.slug))

  const selected: KnowledgeSnippet[] = []
  // Réserve l'entête du bloc (« SAVOIR MÉTIER VÉRIFIÉ … », ~90 tokens) dès le
  // départ ; par snippet, compte le corps + le titre + la ligne source complète
  // (« ### », « (Source : ref — url, vérifié le … ) », ~60 tokens de gabarit).
  let used = 90
  for (const { s } of scored) {
    if (selected.length >= maxSnippets) break
    const cost = approxTokens(s.body_md) + approxTokens(s.title)
      + approxTokens(`${s.source_ref ?? ''}${s.source_url}`) + 24
    if (used + cost > budget) continue // snippet entier ou rien
    selected.push(s)
    used += cost
  }
  return selected
}

/** Bloc injecté dans le prompt. '' si aucun snippet (comportement actuel préservé).
 *  Chaque snippet porte sa source + date : l'agent peut vérifier ; le modèle est
 *  sommé de fonder sa réponse juridique UNIQUEMENT sur ces extraits. */
export function formatKnowledgeBlock(selected: KnowledgeSnippet[], lang: 'fr' | 'en' = 'fr'): string {
  if (!selected.length) return ''
  const items = selected.map((s) => {
    const ref = s.source_ref ? `${s.source_ref} — ` : ''
    return `### ${s.title}\n${s.body_md.trim()}\n(Source : ${ref}${s.source_url}, vérifié le ${formatDateCH(s.verified_at)})`
  }).join('\n\n')

  const header = lang === 'en'
    ? `\n\nVERIFIED DOMAIN KNOWLEDGE (Swiss real estate). Ground any legal/regulatory answer ONLY on these excerpts; if they do not cover the question, say so and recommend confirming with the notary/lawyer. Always cite the source and its verification date. Never present this as definitive legal advice.\n\n`
    : `\n\nSAVOIR MÉTIER VÉRIFIÉ (immobilier suisse). Fonde toute réponse juridique ou réglementaire UNIQUEMENT sur ces extraits ; s'ils ne couvrent pas la question, dis-le et recommande de confirmer avec le notaire ou un juriste. Cite toujours la source et sa date de vérification. Ne présente jamais cela comme un conseil juridique définitif.\n\n`
  return header + items
}

/** JJ.MM.AAAA depuis un ISO date ; renvoie l'entrée telle quelle si non parsable. */
function formatDateCH(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

// ── Garde runtime anti-citation juridique inventée (pattern isFabricatedKycClaim) ──
// Le one-shot copilote n'a aucune défense post-génération. Ici, on détecte dans la
// réponse une référence légale PRÉCISE (article numéroté, loi nommée) qui n'est PAS
// couverte par les snippets injectés ce tour → on suffixe un avertissement DOUX,
// jamais bloquant, jamais de réécriture. Conservateur : on ne flague que le clair.
const NAMED_LAWS = ['ldtr', 'lex koller', 'lfaie', 'cecb', 'ldfr']

/** Renvoie un avertissement à suffixer, ou null si la réponse est « couverte ».
 *  `injected` = snippets réellement injectés ce tour (source de vérité). */
export function unsourcedCitationWarning(
  reply: string | null | undefined,
  injected: KnowledgeSnippet[],
  lang: 'fr' | 'en' = 'fr',
): string | null {
  if (!reply) return null
  const r = normalizeText(reply)

  // Corpus couvert ce tour : source_ref + TITRE + corps (ce que l'agent voit
  // réellement comme source). Conservateur : on préfère RATER une hallucination
  // que contredire une réponse correctement sourcée (l'avertissement est doux).
  const covered = normalizeText(
    injected.map((s) => `${s.source_ref ?? ''} ${s.title} ${s.body_md}`).join(' '),
  )
  // Numéros d'articles couverts : (a) TOUS les nombres des source_ref (les
  // énumérations « CO art. 266c, 266d, 273 » y vivent, référence autoritaire et
  // courte) ; (b) les nombres préfixés « art. » du titre/corps.
  const coveredArticles = new Set<string>()
  const refText = normalizeText(injected.map((s) => s.source_ref ?? '').join(' '))
  for (const m of refText.matchAll(/\b(\d+[a-z]?)\b/g)) coveredArticles.add(m[1])
  for (const m of covered.matchAll(/\bart\.?\s*(\d+[a-z]?)/g)) coveredArticles.add(m[1])
  const coveredLaws = new Set(NAMED_LAWS.filter((law) => covered.includes(law)))

  // (1) Article numéroté cité dans la réponse mais absent du corpus injecté.
  const citedArticles = new Set<string>()
  for (const m of r.matchAll(/\bart\.?\s*(\d+[a-z]?)/g)) citedArticles.add(m[1])
  const orphanArticle = [...citedArticles].some((a) => !coveredArticles.has(a))

  // (2) Loi nommée invoquée dans la réponse mais absente du corpus injecté.
  const orphanLaw = NAMED_LAWS.some((law) => r.includes(law) && !coveredLaws.has(law))

  if (!orphanArticle && !orphanLaw) return null
  return lang === 'en'
    ? "\n\n_Reference to verify — outside MEGGA's verified knowledge base; please confirm with your notary._"
    : "\n\n_Référence à vérifier — hors du corpus vérifié MEGGA, confirmez avec votre notaire._"
}
