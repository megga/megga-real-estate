// Logique PURE du routage agent WhatsApp (Phase 3). Aucun I/O — testable Node.

/** Code à 8 chiffres si le corps en contient exactement 8 (espaces internes ignorés), sinon null.
 *  8 chiffres (aléa cryptographique) depuis le durcissement 2026-07 : espace 10^8 + plafond de
 *  tentatives côté webhook rendent le brute-force du lien agent infaisable en ligne. */
export function extractPairingCode(body: string | null | undefined): string | null {
  if (!body) return null
  const digits = body.replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

/** Valide si la date d'expiration est dans le futur. */
export function isPairingCodeValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}

export type ToolTier = 'read' | 'auto' | 'confirm' | 'slow_async'

// Source de vérité du tier par outil. Inconnu => 'confirm' (fail-safe : jamais
// d'exécution d'un outil non classé sans confirmation humaine).
const TOOL_TIERS: Record<string, ToolTier> = {
  get_my_agenda: 'read',
  search_contacts: 'read',
  get_contact_brief: 'read',
  list_followups: 'read',
  get_matches: 'read',
  get_daily_brief: 'read',
  search_listings: 'read',
  get_kyc_status: 'read',
  // summarize_group_thread : lecture seule, analyse un fil de groupe collé par l'agent —
  // rien n'est envoyé, résultat rendu uniquement à l'agent (digest privé).
  summarize_group_thread: 'read',
  // check_group_leak : lecture seule, défensif, n'envoie rien — vérifie qu'un brouillon
  // de message de groupe ne révèle pas une info confidentielle d'une partie à l'autre ;
  // alerte l'agent dans son 1:1 (résultat agent-facing uniquement).
  check_group_leak: 'read',
  // draft_listing_copy : lecture seule, agent-facing — rédige un brouillon d'annonce
  // (titre + description bilingue + grille) depuis les vraies données d'un bien de l'agence.
  // Rien n'est envoyé au client ; le résultat revient à l'agent dans son 1:1, il l'utilise.
  draft_listing_copy: 'read',
  // prepare_meeting : lecture seule, agent-facing — agrège la fiche, les biens correspondants
  // et la visite à venir (vraies tables, scope agence) + 3 points à aborder ; rien n'est envoyé,
  // le résultat (brief de préparation de RDV) revient à l'agent dans son 1:1.
  prepare_meeting: 'read',
  // read_document : lecture seule d'une pièce entrante (photo/scan/PDF du message courant) →
  // OCR Gemini + digest DeepSeek rendu À L'AGENT. Aucune écriture, aucun envoi → read.
  read_document: 'read',
  // file_document : même lecture, puis classe le digest en NOTE timeline sur un contact
  // (état CRM interne, jamais d'envoi client). Écriture réversible/auditée → auto, comme add_note.
  file_document: 'auto',
  create_contact: 'auto',
  add_note: 'auto',
  schedule_visit: 'auto',
  create_reminder: 'auto',
  qualify_lead: 'auto',
  // create_deal : ouvre un dossier (transaction) à une étape de DÉPART. État CRM interne
  // réversible (status annulable), aucun envoi/argent → auto, comme create_contact/qualify.
  create_deal: 'auto',
  // send_kyc_link : envoi d'un email au CLIENT (lien d'upload KYC) → confirm. Le KYC reste
  // facultatif : l'outil n'est qu'un assist, jamais une étape obligatoire.
  send_kyc_link: 'confirm',
  // send_client_email : rédige + envoie un email au CLIENT → confirm. Socle légal : toute
  // communication client sort sous validation humaine, jamais automatique.
  send_client_email: 'confirm',
  // update_pipeline modifie l'étape pipeline → garde-fou absolu du cerveau
  // (ai-guardrails : « jamais sans action humaine ») ⇒ confirm (le « oui » de l'agent).
  update_pipeline: 'confirm',
  send_client_message: 'confirm',
  send_listings: 'confirm',
  record_offer: 'confirm',
  // delete_contact : suppression DÉFINITIVE d'une fiche contact → confirm obligatoire
  // (destructif + irréversible, jamais dans la boucle). Le socle légal ne peut jamais
  // quitter confirm (canLeaveConfirm ne renvoie true que pour update_pipeline).
  delete_contact: 'confirm',
  open_kyc_case: 'confirm',
  attach_kyc_document: 'auto',          // reste synchrone (P2b : async + R2)
  run_kyc_screening: 'slow_async',      // ~50s Dilisense → hors boucle (file + cron)
  send_kyc_report: 'slow_async',        // ~60s render PDF + envoi → hors boucle
  // Syndication sortante (Phase 2). publish/withdraw modifient ce qui est PUBLIÉ vers
  // l'extérieur (portails) → confirm obligatoire (jamais sans le « oui » de l'agent),
  // au même titre que le socle client/offre. get_publication_status = pure lecture.
  publish_to_portals: 'confirm',
  withdraw_from_portals: 'confirm',
  get_publication_status: 'read',
  // attach_property_photos : ajoute une photo entrante à la galerie d'un bien (état
  // CRM interne, réversible, aucun envoi client) → auto, comme attach_kyc_document.
  attach_property_photos: 'auto',
  // update_property : complète/corrige les champs d'un bien (saisie de données CRM
  // interne, réversible, aucun envoi client) → auto, comme qualify_lead/add_note.
  update_property: 'auto',
  // create_property : crée un brouillon de bien (état CRM interne, jamais publié
  // sans le publish confirm dédié) → auto, comme create_contact/create_deal.
  create_property: 'auto',
}

export function toolTier(name: string): ToolTier {
  return TOOL_TIERS[name] ?? 'confirm'
}

// Portails de syndication supportés + libellé humain (jamais l'enum brut à l'agent).
export const PORTAL_LABELS: Record<string, string> = { immobilier_ch: 'immobilier.ch' }
export function portalLabel(portal: string): string {
  return PORTAL_LABELS[portal] ?? portal
}
/** Normalise un nom de portail saisi librement ('immobilier.ch' → 'immobilier_ch'). */
export function normalizePortal(raw: string): string {
  return raw.trim().toLowerCase().replace(/[.\-\s]+/g, '_')
}

// SEUL outil 'confirm' qui peut passer en auto (Palier 3) : update_pipeline — réversible
// (undo) + audité, aucun flux client/argent. Le socle légal (send_client_message/send_listings/
// record_offer/open_kyc_case) renvoie false ICI quel que soit l'agent → ne quitte JAMAIS confirm.
export function canLeaveConfirm(tool: string): boolean {
  return tool === 'update_pipeline'
}

// NB: 'annule'/'annuler' figurent aussi dans le set NO de parseConfirmation — garder les deux cohérents.
const UNDO_WORDS = new Set(['/annuler', 'annuler', 'annule', 'undo', 'reviens', 'rétablis', 'retablis'])
/** Vrai si le message est une commande d'annulation courte (pour l'undo différé). */
export function isUndoCommand(body: string | null | undefined): boolean {
  if (!body) return false
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  return UNDO_WORDS.has(norm)
}

// ── Garde anti-hallucination KYC (hotfix 3 juin 2026) ────────────────────────
// Depuis le passage des outils KYC en async (Palier 2), la réponse immédiate à un screening
// est une PROMESSE (« je lance, résultat plus tard ») que DeepSeek peut FABRIQUER en texte
// sans appeler l'outil — il l'a fait en prod (incident Vladimir : « j'ai lancé le screening »
// alors que rien n'avait tourné). C'est compliance-critique (fausse assurance LBA).
// Cette fonction PURE détecte, dans une réponse en texte LIBRE de DeepSeek (= aucun outil KYC
// appelé ce tour-ci), une affirmation qu'un screening / rapport KYC a été lancé / fait / est en
// cours. Si oui, l'agent remplace la réponse par un message honnête (jamais de fausse action).
// `kycToolCalled` = true ⇒ un outil KYC a réellement tourné ⇒ l'affirmation est légitime (pas de flag).
// kycStatusRead (défaut false) : un outil de LECTURE de statut (get_kyc_status) a tourné ce tour.
// Distinction compliance clé : lire un statut ≠ lancer une action. Une lecture légitime la NARRATION
// D'ÉTAT/RÉSULTAT (« risque faible », « screening en cours », « correspondance ») mais JAMAIS une
// revendication d'ACTION (« j'ai lancé le screening », « résultats à venir ») — sinon le modèle
// pourrait lire un statut puis prétendre avoir lancé une action jamais exécutée (régression Vladimir).
// kycToolCalled (action KYC réellement exécutée : screening/rapport/attache) court-circuite tout.
export function isFabricatedKycClaim(
  reply: string | null | undefined,
  kycToolCalled: boolean,
  kycStatusRead = false,
): boolean {
  if (kycToolCalled || !reply) return false
  const r = reply.toLowerCase()

  // (1) EXPOSER LE MÉCANISME ASYNC = fabrication, SANS gate KYC : les seuls outils async de l'agent
  // sont les outils KYC, donc « traitement asynchrone » / « asynchronous » ne peut venir que de là.
  if (/(traitement\s+asynchrone|asynchron)/.test(r)) return true

  // (2) Hors de ce tell : exiger une mention KYC (scope) + écarter l'historique légitime
  // (« on a déjà généré le rapport », « le screening d'hier… » = l'agent rappelle un fait passé).
  if (!/(screening|\bscreen\b|kyc|sanctions?|\bpep\b|vérif|verif|\blba\b|contrôl|controle)/.test(r)) return false
  if (/\b(déjà|deja|hier|avant-hier|la\s+semaine\s+(dernière|derniere|passée|passee)|le\s+mois\s+dernier|auparavant|already|yesterday|last\s+(week|month))\b/.test(r)) return false

  // (3) PROMESSE de résultat À VENIR / délivrance future = revendication d'une action async lancée.
  // Une lecture de statut donne le résultat MAINTENANT, elle ne promet rien pour plus tard → JAMAIS
  // légitimée par kycStatusRead.
  if (
    /(résultats?\s+(dans|d['e ]?ici|sous|à\s+venir|bient[ôo]t|arrive)|results?\b[^.]{0,20}(shortly|soon|coming|in\s+a\s+(few|moment)))/.test(r) ||
    /((je\s+te\s+(préviens|previens|reviens|tiens|donne|recontacte))|(je\s+reviens\s+vers)|(d[èe]s\s+que\s+c['e ]?est\s+(dispo|pr[êe]t|fait))|(i['\s]?(ll|will)\s+(let\s+you\s+know|get\s+back|keep\s+you)))/.test(r) ||
    /(ne\s+(me\s+)?remonte\s+pas\b[^.]*résultat)|((ça|ca)\s+arrive)/.test(r)
  ) return true

  // (4) Offre / futur (« tu veux que je lance », « je vais », « je peux ») = légitime, pas une action FAITE.
  if (/\b(je\s+vais|tu\s+veux|veux-tu|souhaites?-tu|si\s+tu|je\s+peux|dois-je|will\s+you|do\s+you\s+want|i\s+can|shall\s+i)\b/.test(r)) return false

  // (5) Prétend avoir LANCÉ / FAIT l'action (lire ≠ lancer) → fabrication même après une simple lecture.
  if (
    /\bj['e ]?ai\s+(re)?(lanc|déclench|declench|démarr|demarr|initi|envoy|génér|gener|effectu|réalis|realis|vérifi|verifi|fait)/.test(r) ||
    /\bje\s+(viens\s+de|m['e ]?occupe)\b/.test(r) ||
    /\b(est|a\s+ét[ée]|sont|ont\s+ét[ée])\s+(lanc[ée]|déclench[ée]|declench[ée]|démarr[ée]|demarr[ée]|initi[ée]|envoy[ée]|génér[ée]|gener[ée]|effectu[ée]|réalis[ée]|realis[ée]|vérifi[ée]|verifi[ée]|parti[es]?)/.test(r) ||
    /\bfaite?\b/.test(r) ||
    /c['e ]?est\s+parti/.test(r) ||
    /\bi['\s]?(ve|m| have| am)?\s*(just\s+)?(launch|ran\b|run\b|start|sent|trigger|initiat|complet)/.test(r) ||
    /(screening|kyc|sanctions?|pep|report|check)\s+(is\s+|has\s+been\s+|was\s+)?(started|launched|done|complete|completed|sent|triggered)/.test(r)
  ) return true

  // (6) ÉTAT / RÉSULTAT de statut (en cours, pas de PEP, correspondance, risque…). C'est EXACTEMENT ce
  // qu'une lecture réelle de get_kyc_status produit → légitime SI un statut a été lu ce tour
  // (kycStatusRead) ; sinon (aucune lecture), c'est une fabrication de résultat.
  const stateOrResult =
    /(en\s+cours|en\s+route|en\s+train\s+de|\btourne\b|\bin\s+progress\b|\bprocessing\b|\brunning\b|\bunderway\b)/.test(r) ||
    /(pas\s+de\s+pep|aucun\s+pep|pep\s+(détecté|detecte|trouvé|trouve|match)|correspondance\s+sanction|risque\s+(faible|moyen|élev[ée])|\bras\b)/.test(r) ||
    /(no\s+pep\s+match|sanctions?\s+(clear|match)|(low|medium|high)\s+risk)/.test(r)
  if (stateOrResult) return !kycStatusRead
  return false
}

// ── Anti-fabrication : helpers PURS (testables hors Deno/Supabase) ──────────
// Vivent ici (module pur déjà allowlisté en unit) et NON dans whatsapp-actions.ts
// (imports https:/Deno non résolus par le loader unit).

/** Date seule DD.MM (Europe/Zurich) pour « screené le … ». '' si pas de date / invalide. */
export function kycDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Zurich' }).formatToParts(d)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${get('day')}.${get('month')}`
}

/** Libellé HUMAIN d'un statut PEP/sanctions KYC. Ne JAMAIS renvoyer l'enum brut au modèle :
 *  'not_checked' narré « pas de PEP / RAS » confond ABSENCE de contrôle et CLEAR (faute LBA).
 *  Source = CHECK kyc_cases_{pep,sanctions}_status : clear|match|pending|not_checked.
 *  NULL/inconnu = traité comme « non vérifié » (jamais « RAS »), c'est le cœur compliance. */
export function kycScreenLabel(status: string | null | undefined, screenedAtIso: string | null | undefined): string {
  switch (status) {
    case 'clear': {
      const d = kycDateShort(screenedAtIso)
      return d ? `rien à signaler (screené le ${d})` : 'rien à signaler (screening clôturé)'
    }
    case 'match':   return 'correspondance détectée ⚠'
    case 'pending': return 'screening en cours'
    default:        return 'non vérifié (aucun screening lancé)'
  }
}

// Projection PURE d'un match + ses lignes résolues → objet enrichi pour le modèle.
// Champ absent/null/<=0 OMIS (jamais null ni inventé) : le modèle ne voit aucune clé vide
// à halluciner. Property prioritaire sur market_listing (mandat propre > annonce externe).
export interface MatchListingInput {
  score: number | null; status: string | null
  property_id: string | null; market_listing_id: string | null
}
export interface ResolvedPropertyRow { title: string | null; price: number | null; city: string | null; rooms: number | null }
export interface ResolvedMarketRow {
  title: string | null; transaction_type: string | null
  price: number | null; rent: number | null; rent_chf: number | null; city: string | null; rooms: number | null
}
export interface ResolvedMatchView {
  id: string; titre?: string; montant?: number; ville?: string; pieces?: number; score?: number; statut?: string
}

export function projectMatchListing(
  m: MatchListingInput,
  prop: ResolvedPropertyRow | null | undefined,
  ml: ResolvedMarketRow | null | undefined,
): ResolvedMatchView {
  const out: ResolvedMatchView = { id: (m.property_id || m.market_listing_id || '') }
  if (typeof m.score === 'number') out.score = m.score
  if (m.status) out.statut = m.status
  if (prop) {
    if (prop.title) out.titre = prop.title
    if (typeof prop.price === 'number' && prop.price > 0) out.montant = prop.price
    if (prop.city) out.ville = prop.city
    if (typeof prop.rooms === 'number' && prop.rooms > 0) out.pieces = prop.rooms
  } else if (ml) {
    if (ml.title) out.titre = ml.title
    const amt = ml.transaction_type === 'rent' ? (ml.rent_chf ?? ml.rent ?? ml.price ?? 0) : (ml.price ?? 0)
    if (typeof amt === 'number' && amt > 0) out.montant = amt
    if (ml.city) out.ville = ml.city
    if (typeof ml.rooms === 'number' && ml.rooms > 0) out.pieces = ml.rooms
  }
  return out
}

// Garde DÉTERMINISTE anti-fuite d'adresse pour l'annonce confidentielle (pattern d). La consigne
// « ne révèle pas l'adresse exacte » donnée au modèle est MOLLE ; ici on masque EN CODE le NUMÉRO
// de rue réel (connu en base) s'il co-apparaît avec un mot distinctif de la rue dans une phrase.
// Conservateur : sans numéro dans l'adresse, ou nom de rue < 4 lettres (« Rue », « Lac »… trop
// communs), on ne touche à rien — pas de faux positif. Ne fait que MASQUER (→ '—'), jamais ajouter.
export function stripExactAddress(text: string, address: string | null | undefined): string {
  const addr = (address ?? '').trim()
  if (!addr || !text) return text
  const num = /\b\d{1,4}[a-zA-Z]?\b/.exec(addr)?.[0]
  if (!num) return text // pas de numéro = pas de token discriminant → on ne strip pas
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const generics = new Set(['rue', 'route', 'avenue', 'chemin', 'place', 'quai', 'impasse', 'allee', 'boulevard', 'street', 'road'])
  const streetWords = norm(addr).replace(/\d/g, ' ').split(/[^a-z]+/).filter((w) => w.length >= 4 && !generics.has(w))
  if (streetWords.length === 0) return text
  const numRe = new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  return text.split(/(?<=[.!?\n])/).map((seg) => {
    const nseg = norm(seg)
    const leaks = streetWords.some((w) => nseg.includes(w)) && numRe.test(seg)
    return leaks ? seg.replace(numRe, '—') : seg
  }).join('')
}

// Les 14 colonnes canoniques du pipeline (= transactions.stage, hors valeurs legacy
// lead/qualified/closed/visit_planned_legacy). Source unique partagée par le catalogue
// d'outils (enum exposé à DeepSeek) et l'exécuteur update_pipeline (validation défensive).
export const PIPELINE_STAGES = [
  'new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done',
  'interest_confirmed', 'offer', 'negotiation', 'reserved', 'financing',
  'notary', 'signed', 'lost', 'to_recontact',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Vrai si `stage` est une étape canonique du pipeline (sensible à la casse). */
export function isValidStage(stage: string): stage is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(stage)
}

/** Libellés FR des étapes — pour parler humain à l'agent (jamais l'enum brut). */
export const STAGE_LABELS_FR: Record<PipelineStage, string> = {
  new_lead: 'Nouveau lead', to_qualify: 'À qualifier', active_search: 'Recherche active',
  visit_planned: 'Visite planifiée', visit_done: 'Visite effectuée', interest_confirmed: 'Intérêt confirmé',
  offer: 'Offre', negotiation: 'Négociation', reserved: 'Réservé', financing: 'Financement',
  notary: 'Notaire', signed: 'Signé', lost: 'Perdu', to_recontact: 'À relancer',
}

/** Libellés EN des étapes (copilote bilingue FR/EN, cf. whatsapp-i18n). */
export const STAGE_LABELS_EN: Record<PipelineStage, string> = {
  new_lead: 'New lead', to_qualify: 'To qualify', active_search: 'Active search',
  visit_planned: 'Visit planned', visit_done: 'Visit done', interest_confirmed: 'Interest confirmed',
  offer: 'Offer', negotiation: 'Negotiation', reserved: 'Reserved', financing: 'Financing',
  notary: 'Notary', signed: 'Signed', lost: 'Lost', to_recontact: 'To follow up',
}

/** Libellé d'étape dans la langue de l'agent ('fr' par défaut). */
export function stageLabel(stage: string, lang: 'fr' | 'en'): string {
  const map = lang === 'en' ? STAGE_LABELS_EN : STAGE_LABELS_FR
  return map[stage as PipelineStage] ?? stage
}

// ── Ouverture de dossier (create_deal) — logique pure ───────────────────────
export type DealParty = 'buyer' | 'seller'

/** Côté du dossier : choix explicite de l'agent sinon déduit du type de contact
 *  (un vendeur → 'seller', tout le reste → 'buyer', défaut sûr le plus fréquent). */
export function deriveDealParty(contactType: string | null | undefined, explicit?: string | null): DealParty {
  if (explicit === 'buyer' || explicit === 'seller') return explicit
  return contactType === 'seller' ? 'seller' : 'buyer'
}

/** Étape de départ d'un nouveau dossier : vendeur → mandat (new_lead),
 *  acheteur → recherche active (active_search). */
export function dealStageDefault(party: DealParty): PipelineStage {
  return party === 'seller' ? 'new_lead' : 'active_search'
}

const YES = new Set(['oui', 'ok', 'okay', 'yes', 'y', 'vas-y', 'vasy', 'go', 'confirme', 'confirmer', 'valide', "d'accord", 'daccord', 'ouais', 'yep'])
const NO = new Set(['non', 'no', 'n', 'annule', 'annuler', 'stop', 'cancel', 'laisse', 'laisse tomber'])

export function parseConfirmation(body: string | null | undefined): 'yes' | 'no' | 'none' {
  if (!body) return 'none'
  const norm = body.trim().toLowerCase().replace(/[!.…]+$/, '')
  if (YES.has(norm)) return 'yes'
  if (NO.has(norm)) return 'no'
  return 'none'
}

export function isPendingActionValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t > Date.now()
}

// ── Phase 4C / C1 : mémoire de conversation (pur) ───────────────────────────
export interface WaHistoryRow { direction: string; body: string | null; transcript: string | null }

/** Reconstruit l'historique agent↔MEGGA (lignes triées DESC) en tours chat
 *  chronologiques : inbound→user, outbound→assistant. transcript prioritaire,
 *  vides ignorés, contenu borné (1000 car). */
export function buildHistoryMessages(rowsDesc: WaHistoryRow[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [...rowsDesc].reverse()
    .map((r) => ({
      role: (r.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: (r.transcript || r.body || '').trim().slice(0, 1000),
    }))
    .filter((m) => m.content.length > 0)
}
