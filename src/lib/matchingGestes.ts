/**
 * Les gestes du matching : les exécuteurs de ce que l'agent CONSIGNE sur un match, et ce qu'ils portent — la
 * référence d'un bien, la règle du report, les statuts d'une relance ouverte, le deal rattaché.
 *
 * ⛔ UN GESTE, UN ÉCRIVAIN. Le fil de matchs et l'écran mobile posent les mêmes gestes, et la Recherche en lit la
 * règle du report : tous passent par ce module, pour que le match, le deal, la relance et la ligne de journal d'un
 * geste soient les mêmes d'où qu'on le pose. Il ne dépend d'aucun écran — hors deux types du fil, importés comme
 * types (`MotifRefus`, `CorrectionChangement`) : ses types (`AcheteurGeste`, `BienGeste`) ne portent que ce que les
 * gestes lisent, et chaque écran y ramène sa propre forme.
 *
 * Gestes. C'est l'écran qui décide du moment : ceux qu'il sait annuler (proposer, reporter, écarter, répondre, au
 * fil ; leurs pendants sur le mobile) partent APRÈS la fenêtre d'annulation (`matchingAnnulation` — undo
 * Gmail-style : rien n'est écrit tant que le toast offre « Annuler ») ; les autres s'écrivent tout de suite :
 *   proposer     → « Je l'ai proposé » : le match, s'il est encore 'suggested' → 'sent',
 *                  sent_via='agent' + Deal new_lead (créé ou rattaché) + activity_events
 *                  'match_propose' + relance interne +3 j + jalon Intercom first_match_sent.
 *                  Plus rien à proposer → rien d'autre n'est écrit (`deja`)
 *   proposerSelection → ses matchs encore 'suggested' → 'sent' 'agent' + UN deal,
 *                  UN 'match_propose', UNE relance +3 j, sur les SEULS matchs marqués (fil)
 *   relance      → « J'ai relancé » : matches.sent_at=now + activity_events 'relance' +
 *                  relance de proposition repoussée +3 j
 *   react        → Intéressé / Pas intéressé : matches.status + relance de proposition close
 *   snooze       → matches.snoozed_until=+7 j + reminder 'custom' à échéance
 *                  (la ligne « de retour » remonte dans Aujourd'hui) + 'match_reporte'
 *   dismiss      → matches.status='ignored' (le moteur ne re-propose jamais
 *                  un couple existant — aucun deal) + activity_events 'match_ecarte'
 *   wake         → snoozed_until=null + reminder annulé (immédiat, hors queue) + 'match_reactive'
 *   repondre     → (fil, lot B) Intéressé / Pas intéressé + motif : matches.status, motif, note ; la
 *                  relance de la PROPOSITION se clôt par trigger quand plus aucun de ses biens n'attend
 *   pasEncore    → (fil) la relance de la proposition repoussée de +3 j, si le bien attend encore ; rien
 *                  sur le match
 *   planifierVisite → (fil, et fiche d'un mandat pour un acquéreur intéressé) match 'visit_planned' +
 *                  visite interne (mandat) ou événement « visite » de l'agenda (annonce du marché) + deal
 *                  avancé ; aucune invitation
 *   ajusterRecherche / ignorerCorrection → (fil) « Apprendre » : la correction validée (edge
 *                  matching-engine, mode rescore-search, la SEULE clé corrigée) ou ses refus pris en compte
 *
 * ⛔ Une relance qui ne se pose pas FAIT LEVER le geste (`poserRelance`) : sans elle, l'agent n'est jamais
 * rappelé de noter la réponse, et l'échec ne se lisait qu'en console.
 *
 * ⛔ Aucun geste n'écrit à l'acheteur — ni e-mail, ni lien, ni WhatsApp (décision de
 * Julien, 21.09.2026 : le matching reste chez l'agent). L'agent présente les biens par
 * ses propres moyens ; le CRM consigne et lui rappelle de noter la réponse.
 */
import { supabase } from '@/lib/supabase'
import { INTERCOM_EVENTS } from '@/lib/intercom'
import { markIntercomMilestone } from '@/lib/intercom-milestones'
import { ETAPE_DEAL_PERDU, STATUTS_DEAL_OUVERT } from '@/lib/dealOuvert'
import type { Enums, Json, TablesInsert } from '@/types/database'
import type { MotifRefus } from '@/components/matching-fil/filBoucle'
import type { CorrectionChangement } from '@/components/matching-fil/filApprendre'

// ─── Ce que les gestes portent ──────────────────────────────────────────

/** Référence affichée d'une annonce du marché — la même dans l'atelier et dans le fil de matchs. */
export const refAnnonceMarche = (portail: string | null, sourceId: string | null, id: string): string =>
  `MG-${portail === 'flatfox' ? 'FL' : 'MK'}-${sourceId ?? id.slice(0, 6)}`

/** Référence affichée d'un bien interne — la même dans l'atelier et dans le fil de matchs. */
export const refBienInterne = (id: string): string => `MG-IN-${id.slice(0, 6).toUpperCase()}`

/** true tant que le report (snooze) d'un match n'est pas échu. */
export const isSnoozed = (until: string | null): boolean =>
  until != null && new Date(until).getTime() > Date.now()

// ═══════════════════ Gestes métier (exécuteurs) ═══════════════════════════
// L'appelant les diffère ou non (fenêtre d'annulation de 5 s) — cf. en-tête.

export interface GesteContext {
  agencyId: string
  userId: string
}

/**
 * Ce qu'une proposition rend à son appelant et, par lui, au registre d'annulation (`matchingAnnulation`) :
 * le deal, pour « Voir le deal → », et `deja`.
 *
 * `deja` : aucun des matchs n'était encore à proposer à cet acheteur — déjà proposé, répondu ou
 * écarté entre-temps (un collègue, un autre onglet, un double geste), ou d'un autre acheteur. RIEN
 * d'autre n'est alors écrit : ni deal, ni journal, ni relance. C'est un RÉSULTAT et non une erreur :
 * l'état voulu est déjà là, ou a été tranché autrement. Un rejet passerait par `onError`, qui dit
 * « échec » à l'agent et rend la ligne ; l'appelant rafraîchit, et la file se remet d'accord.
 */
export interface ResultatProposition {
  dealId: string | null
  deja: boolean
}

/**
 * Ce qu'un geste lit d'un acheteur et d'un bien, et rien de plus : le journal et la relance nomment
 * l'acheteur, le bien par sa référence et son titre ; le deal se rattache par le genre et l'id du
 * bien. Écrits en propre, sans rien emprunter à la forme d'un écran : chaque surface a la sienne et
 * n'en passe que ces champs — les exécuteurs restent la source UNIQUE des écritures, et ne leur
 * demandent que ce qu'ils lisent.
 */
export interface AcheteurGeste {
  /** L'id du CONTACT, pas celui du match. */
  id: string
  matchId: string
  first: string
  last: string
  /** Le score du match, consigné au journal. */
  score: number
}

/** Le bien d'un geste : son genre et son id rattachent le deal, sa référence et son titre le nomment. */
export interface BienGeste {
  /** `property` : un bien en mandat (`properties`) ; `market` : une annonce du marché (`market_listings`). */
  kind: 'property' | 'market'
  id: string
  /** `refBienInterne` ou `refAnnonceMarche`. */
  ref: string
  title: string
}

/**
 * Le deal d'un acheteur à qui l'on propose un bien : l'OUVERT le plus récent s'il existe (`dealOuvert` : un deal
 * perdu n'en est pas un) — un bien en mandat y est rattaché s'il n'en porte aucun, jamais écrasé —, sinon un
 * `new_lead` créé sur ce bien. Partagé par la proposition d'un bien, celle d'une sélection et la visite planifiée,
 * pour qu'elles ne divergent pas.
 */
async function rattacherDeal(ctx: GesteContext, contactId: string, listing: Pick<BienGeste, 'kind' | 'id'>): Promise<string> {
  const { data: existing, error: lErr } = await supabase
    .from('transactions')
    .select('id, property_id')
    .eq('agency_id', ctx.agencyId)
    .eq('contact_buyer_id', contactId)
    // Deux statuts, donc `in` : la règle de CLAUDE.md §7 (`eq` plutôt qu'`in`) vise les grandes tables et leurs
    // index partiels ; `transactions` est petite, et cette lecture passe par l'acheteur (`idx_transactions_buyer`).
    .in('status', STATUTS_DEAL_OUVERT)
    // `neq` exclut aussi une étape nulle : il n'y en a pas, `stage` est `NOT NULL`.
    .neq('stage', ETAPE_DEAL_PERDU)
    .order('created_at', { ascending: false })
    .limit(1)
  // ⛔ Une lecture refusée ou expirée fait lever : avalée, elle se lirait « aucun deal ouvert », et le geste ouvrirait
  // en silence un second deal à un acheteur qui en a déjà un.
  if (lErr) throw lErr

  if (existing && existing.length > 0) {
    const deal = existing[0] as { id: string; property_id: string | null }
    if (listing.kind === 'property' && !deal.property_id) {
      // `property_id is null`, comme le jumeau SQL (`wa_matching_consigner`, `wa_matching_visite`) : un mandat posé
      // entre la lecture et l'écriture, par un collègue ou le copilote, n'est pas écrasé. Un refus fait lever : le
      // geste ne passe pas pour fait sur un deal resté sans son mandat.
      const { error: pErr } = await supabase
        .from('transactions')
        .update({ property_id: listing.id })
        .eq('id', deal.id)
        .is('property_id', null)
      if (pErr) throw pErr
    }
    return deal.id
  }
  const insert: TablesInsert<'transactions'> = {
    agency_id: ctx.agencyId,
    contact_buyer_id: contactId,
    assigned_to: ctx.userId,
    stage: 'new_lead',
    status: 'active',
  }
  if (listing.kind === 'property') insert.property_id = listing.id
  else insert.market_listing_id = listing.id
  const { data: created, error } = await supabase.from('transactions').insert(insert).select('id').single()
  if (error) throw error
  return (created as { id: string }).id
}

/**
 * « Je l'ai proposé » (E) — l'agent a présenté le bien à l'acheteur, par ses propres moyens.
 *
 * ⛔ LE CRM N'ENVOIE RIEN À L'ACHETEUR (décision de Julien, 21.09.2026 : le matching reste chez
 * l'agent). Le geste consigne : le match passe `sent` avec `sent_via = 'agent'`, le deal est
 * rattaché (ou créé en `new_lead`), une ligne `match_propose` au journal, et UNE relance interne
 * à +3 jours (canal `task`) pour que l'agent consigne la réponse.
 *
 * Le marquage ne touche le match que s'il est ENCORE `suggested` et qu'il est bien celui de CET
 * acheteur. ⛔ Sinon, un double geste (ou celui d'un collègue) réécrivait un match déjà proposé, voire
 * `interested`, en `sent`, et posait un deuxième deal, une deuxième ligne de journal, une deuxième
 * relance. Aucune ligne marquée : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 */
export async function execProposer(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<ResultatProposition> {
  // 1. Match → proposé par l'agent, s'il est encore à proposer
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { dealId: null, deja: true }
  // Jalon Intercom (une première proposition par agent). Signal seul : ni le bien ni l'acheteur ne partent.
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  // 2. Deal : rattacher au deal ouvert existant, sinon créer en new_lead
  const dealId = await rattacherDeal(ctx, buyer.id, listing)

  // 3. Timeline contact (consignation systématique)
  await logEvent(ctx, {
    action: 'match_propose',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_ids: [buyer.matchId], deal_id: dealId, bien_refs: [listing.ref], nombre: 1, score: buyer.score },
  })

  // 4. La relance interne : l'agent notera la réponse de l'acheteur
  await poserRelance(ctx, {
    contactId: buyer.id,
    matchId: buyer.matchId,
    matchIds: [buyer.matchId],
    dealId,
    propertyId: listing.kind === 'property' ? listing.id : null,
    message: `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}`,
  })

  return { dealId, deja: false }
}

/** Un bien d'une sélection du marché, tel que la proposition le consigne. */
export interface PropositionSelection { matchId: string; score: number; bien: BienGeste }

/**
 * « J'ai proposé N biens » — la sélection du marché d'un acheteur, que l'agent lui a présentée par ses
 * propres moyens. ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : même consignation que
 * `execProposer`, pour la sélection entière.
 *
 * Le marquage ne touche que les matchs encore `suggested` DE CET ACHETEUR. ⛔ Sans cette restriction, un
 * match déjà `interested` ou `ignored` repris dans la sélection serait réécrit en `sent` : il sortirait
 * de « Réponses », et la réponse consignée par l'agent serait perdue.
 *
 * ⛔ LE SUIVI NE PORTE QUE CE QUI A ÉTÉ MARQUÉ : le journal (`match_ids`, `bien_refs`, `nombre`), le deal
 * et la relance se calculent sur les matchs que la base a réellement réécrits, pas sur ceux qu'on lui a
 * soumis. Aucun : rien d'autre n'est écrit, `deja` le dit (cf. `ResultatProposition`).
 *
 * ⛔ UN GESTE, UN SUIVI : un deal, UNE ligne de journal et UNE relance à +3 j pour la sélection entière.
 * Appeler `execProposer` N fois poserait N relances identiques pour le même acheteur dans
 * « Aujourd'hui ». Le deal et la relance portent le MEILLEUR bien de la sélection.
 */
export async function execProposerSelection(
  ctx: GesteContext,
  acheteur: Pick<AcheteurGeste, 'id' | 'first' | 'last'>,
  propositions: readonly PropositionSelection[],
): Promise<ResultatProposition> {
  if (propositions.length === 0) return { dealId: null, deja: true }
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'sent', sent_via: 'agent', sent_at: new Date().toISOString() })
    .in('id', propositions.map((p) => p.matchId))
    .eq('contact_id', acheteur.id)
    .eq('status', 'suggested')
    .select('id')
  if (mErr) throw mErr
  const marquesIds = new Set((marques ?? []).map((r) => r.id))
  const proposees = propositions.filter((p) => marquesIds.has(p.matchId))
  if (proposees.length === 0) return { dealId: null, deja: true }
  void markIntercomMilestone(INTERCOM_EVENTS.FIRST_MATCH_SENT)

  const meilleur = proposees.reduce((a, b) => (b.score > a.score ? b : a))
  const dealId = await rattacherDeal(ctx, acheteur.id, meilleur.bien)
  const n = proposees.length
  const biens = `${n} bien${n > 1 ? 's' : ''}`

  await logEvent(ctx, {
    action: 'match_propose',
    contactId: acheteur.id,
    label: `${acheteur.first} ${acheteur.last} · ${biens}`,
    metadata: {
      match_ids: proposees.map((p) => p.matchId), deal_id: dealId, bien_refs: proposees.map((p) => p.bien.ref), nombre: n,
    },
  })

  // Une sélection du marché ne porte aucun bien en mandat : la relance n'en nomme pas.
  await poserRelance(ctx, {
    contactId: acheteur.id,
    matchId: meilleur.matchId,
    // TOUS les biens marqués : le trigger `fermer_relance_proposition` clôt la relance au dernier répondu.
    matchIds: proposees.map((p) => p.matchId),
    dealId,
    propertyId: null,
    message: `Retour de ${acheteur.first} ${acheteur.last} sur ${biens} proposé${n > 1 ? 's' : ''}`,
  })

  return { dealId, deja: false }
}

/**
 * « J'ai relancé » (R) — l'agent a relancé l'acheteur lui-même ; le CRM repousse la relance interne.
 *
 * ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026) : le geste lui envoyait jusque-là un e-mail
 * de relance. Pas de nouveau deal ; le match reste `sent`, `sent_at` date la dernière sollicitation.
 */
export async function execRelance(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
): Promise<void> {
  // 1. Dernière sollicitation = maintenant (le match reste 'sent' / sans retour)
  const { error: mErr } = await supabase
    .from('matches')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', buyer.matchId)
  if (mErr) throw mErr

  // 2. Timeline
  await logEvent(ctx, {
    action: 'relance',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, canal: 'agent' },
  })

  // 3. Relance interne repoussée de 3 j (celle du match, sinon posée). Seule la relance de
  // PROPOSITION se reprend, la plus récente : un match porte aussi le rappel d'un report
  // (`custom`, « de retour dans la file »), que ce geste ne doit ni dater ni réécrire.
  // ⛔ Une lecture ou un report refusés font lever, comme la pose (`poserRelance`) : avalés, l'un reposait
  // une seconde relance, l'autre laissait croire la relance repoussée.
  const message = `Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}, après relance`
  const { data: pending, error: lErr } = await supabase
    .from('reminders')
    .select('id')
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
    .order('created_at', { ascending: false })
    .limit(1)
  if (lErr) throw lErr
  if (pending && pending.length > 0) {
    const { error: rErr } = await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending', message_template: message })
      .eq('id', (pending[0] as { id: string }).id)
    if (rErr) throw rErr
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      message,
    })
  }
}

/** « Plus tard » (P) — snooze +7 j sur le match, retour visible dans Aujourd'hui, consigné au journal */
export async function execSnooze(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const until = inDays(7)
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: until })
    .eq('id', buyer.matchId)
  if (error) throw error

  await supabase.from('reminders').insert({
    agency_id: ctx.agencyId,
    contact_id: buyer.id,
    match_id: buyer.matchId,
    type: 'custom',
    trigger_rule: 'manual',
    trigger_days: 7,
    trigger_at: until,
    status: 'pending',
    channel: 'notification',
    message_template: `${buyer.first} ${buyer.last} — acheteur reporté, de retour dans la file matching`,
  })

  await logEvent(ctx, {
    action: 'match_reporte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, jusqu_au: until, score: buyer.score },
  })
}

/** « Écarter » (X) — le couple n'est plus jamais proposé. Aucun deal ; consigné au journal. */
export async function execDismiss(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: 'ignored' })
    .eq('id', buyer.matchId)
  if (error) throw error

  await logEvent(ctx, {
    action: 'match_ecarte',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, score: buyer.score },
  })
}

/** La réponse de l'acheteur à un bien proposé, consignée par l'agent (Intéressé / Pas intéressé).
 *  Pose matches.status -> déclenche set_match_response_at (response_at) + log_match_reaction
 *  (audit, tracé `actor_kind = 'user'`) — la boucle se ferme chez l'agent.
 *
 *  La réponse est là : la relance de proposition du match (« Retour de … ») n'a plus d'objet et
 *  passe `done`. Sans ça, elle remontait dans « Aujourd'hui » pour un acheteur qui avait répondu.
 *  Un refus est signalé sans faire lever : la réponse, elle, est consignée.
 *  ⚠ Atelier et mobile seulement (inchangés au lot B) : le fil consigne par `execRepondre`, sans clore par
 *  `match_id` — une sélection n'a qu'une relance, que le trigger clôt au dernier bien répondu. */
export async function execReact(
  buyer: Pick<AcheteurGeste, 'matchId'>,
  reaction: 'interested' | 'rejected',
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status: reaction })
    .eq('id', buyer.matchId)
  if (error) throw error

  const { error: rErr } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('match_id', buyer.matchId)
    .eq('type', 'follow_up_sent_property')
    .in('status', ['pending', 'triggered'])
  if (rErr) console.error('[atelier] reminder close failed', rErr)
}

/** « Réactiver » — réactivation manuelle anticipée d'un reporté (parking), immédiate ; consignée au journal */
export async function execWake(ctx: GesteContext, buyer: AcheteurGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ snoozed_until: null })
    .eq('id', buyer.matchId)
  if (error) throw error
  await supabase
    .from('reminders')
    .update({ status: 'cancelled' })
    .eq('match_id', buyer.matchId)
    .eq('type', 'custom')
    .in('status', ['pending', 'triggered'])

  await logEvent(ctx, {
    action: 'match_reactive',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last}`,
    metadata: { match_id: buyer.matchId, score: buyer.score },
  })
}

// ═══════════════════ La boucle dans le fil (lot B) ════════════════════════
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.4 à §4.6.

/** La réponse de l'acheteur, consignée par l'agent depuis le fil. */
export type ReponseAcheteur =
  | { genre: 'interested' }
  | { genre: 'rejected'; motif: MotifRefus; note: string | null }

/**
 * « Intéressé » / « Pas intéressé » (+ motif) — la réponse de l'acheteur à un bien proposé, consignée par
 * l'agent (§4.4).
 *
 * Les triggers font le reste, quel que soit l'écrivain : `set_match_response_at` date la réponse,
 * `log_match_reaction` l'inscrit au journal, motif compris, et `fermer_relance_proposition` clôt la relance de
 * la proposition quand plus AUCUN de ses biens n'attend. ⛔ Pas de clôture par `match_id` ici, contrairement à
 * `execReact` : une sélection de trois biens n'a qu'UNE relance, portée par son meilleur bien — la clore sur la
 * réponse à ce seul bien laissait les deux autres sans suivi.
 *
 * Seulement depuis l'étape d'avant : « Intéressé » répond à un bien PROPOSÉ ; « Pas intéressé » aussi, ou
 * revient sur un intérêt (« À conclure »). Rien de réécrit : `deja` (un collègue a répondu entre-temps).
 */
export async function execRepondre(
  buyer: Pick<AcheteurGeste, 'id' | 'matchId'>,
  reponse: ReponseAcheteur,
): Promise<{ deja: boolean }> {
  const ecriture = reponse.genre === 'interested'
    ? { status: 'interested', reaction_motif: null, reaction_note: null, apprentissage_at: null }
    : { status: 'rejected', reaction_motif: reponse.motif, reaction_note: reponse.note?.trim() || null, apprentissage_at: null }
  const { data, error } = await supabase
    .from('matches')
    .update(ecriture)
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .in('status', reponse.genre === 'interested' ? ['sent'] : ['sent', 'interested'])
    .select('id')
  if (error) throw error
  return { deja: !data || data.length === 0 }
}

/**
 * Les statuts d'une relance ENCORE OUVERTE : `snoozed` compris, que pose « Repousser » dans « Aujourd'hui »
 * (`useReminders`). Oubliée, une relance repoussée n'était plus vue : « En attente » perdait son échéance et
 * « Pas encore » en posait une seconde. Même liste que `fermer_relance_proposition` (migration du lot B).
 */
export const STATUTS_RELANCE_OUVERTE = ['pending', 'triggered', 'snoozed']

/**
 * « Pas encore » — l'acheteur n'a pas décidé : rien sur le match, la relance de SA proposition est repoussée
 * de trois jours (§4.4). La relance est celle qui COUVRE le bien (`match_ids`, ou `match_id` pour une
 * proposition d'un seul bien) : dans une sélection, elle est portée par un autre bien. Aucune : une relance
 * est posée.
 *
 * ⛔ Seulement si le bien attend ENCORE sa réponse (`sent`, de cet acheteur) : un collègue qui a répondu
 * entre-temps a clos la relance, et « Pas encore » en reposait une pour un bien déjà répondu. Rien d'écrit
 * alors : `deja`, comme les autres gestes de la boucle.
 */
export async function execPasEncore(ctx: GesteContext, buyer: AcheteurGeste, listing: BienGeste): Promise<{ deja: boolean }> {
  const { data: enAttente, error: mErr } = await supabase
    .from('matches')
    .select('id')
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'sent')
  if (mErr) throw mErr
  if (!enAttente || enAttente.length === 0) return { deja: true }
  const { data: enCours, error: lErr } = await supabase
    .from('reminders')
    .select('id, match_id, match_ids')
    .eq('contact_id', buyer.id)
    .eq('type', 'follow_up_sent_property')
    .in('status', STATUTS_RELANCE_OUVERTE)
    .order('created_at', { ascending: false })
  if (lErr) throw lErr
  const relance = ((enCours ?? []) as { id: string; match_id: string | null; match_ids: string[] | null }[])
    .find((r) => (r.match_ids ?? (r.match_id ? [r.match_id] : [])).includes(buyer.matchId))
  if (relance) {
    const { error } = await supabase
      .from('reminders')
      .update({ trigger_at: inDays(DELAI_RELANCE_JOURS), status: 'pending' })
      .eq('id', relance.id)
    if (error) throw error
  } else {
    await poserRelance(ctx, {
      contactId: buyer.id,
      matchId: buyer.matchId,
      matchIds: [buyer.matchId],
      dealId: null,
      propertyId: listing.kind === 'property' ? listing.id : null,
      // « Retour de {prénom} » n'élide pas (« de Emma ») : le nom vient après les deux-points.
      message: `Retour : ${buyer.first} ${buyer.last} sur ${listing.ref}`,
    })
  }
  await logEvent(ctx, {
    action: 'match_pas_encore',
    contactId: buyer.id,
    label: `${buyer.first} ${buyer.last} · ${listing.title}`,
    metadata: { match_id: buyer.matchId, bien_ref: listing.ref, relance_id: relance?.id ?? null },
  })
  return { deja: false }
}

/**
 * Le créneau d'une visite planifiée par l'écrivain du fil : depuis « À conclure », ou depuis la fiche d'un mandat pour
 * un acquéreur intéressé (lot E1, `PlanifierVisite`).
 */
export interface VisiteAPlanifier {
  /** Début, ISO. */
  debut: string
  dureeMinutes: number
  /** Adresse du bien, pour l'agenda. */
  lieu: string | null
  /**
   * Ce que la fiche d'un mandat pose en plus sur la visite (`detailsVisite`) : le mode et le lien d'une visio, le bon de
   * visite, le point de rendez-vous. Le fil n'en pose aucun : une visite sur place, sans bon.
   */
  details?: Pick<TablesInsert<'visits'>, 'visit_type' | 'video_link' | 'bon' | 'qualification'>
}

/** Les étapes d'un deal AVANT la visite : « Planifier une visite » l'y fait avancer, jamais reculer. */
const ETAPES_AVANT_VISITE: Enums<'transaction_stage'>[] = ['new_lead', 'to_qualify', 'active_search', 'to_recontact']

/**
 * « Planifier une visite » (§4.5) — depuis « À conclure », EN INTERNE : rien n'est envoyé à l'acheteur, ni
 * invitation ni lien (comme l'outil `schedule_visit` du copilote).
 *
 * Le match passe `visit_planned` D'ABORD, et seulement s'il est encore « intéressé » : un double geste ne pose
 * pas deux visites. Puis le deal (l'ouvert, sinon un `new_lead`, `rattacherDeal`), puis la visite : un bien EN
 * MANDAT reçoit une ligne `visits` (sa fiche, son bon) ; une annonce du MARCHÉ, que l'agence ne détient pas
 * (`visits.property_id` n'accepte qu'un mandat), un événement `visite` de l'agenda (`calendar_events`, qui se
 * journalise lui-même). Le deal avance à `visit_planned` s'il était avant. Une visite refusée rend au match son
 * « intéressé » : il reste dans « À conclure ».
 *
 * ⛔ Aucun rappel au client non plus : `visit-reminders-j1` écrit à l'acheteur la veille de toute visite `planned`
 * dont `reminder_sent` est faux (`send-visit-email`). Posé à la création, il ne part pas — le matching reste chez
 * l'agent, et aucun envoi au client ne part sans sa validation (CLAUDE.md §5).
 *
 * Rend la visite écrite (`visiteId`, qu'ouvre la fiche d'un mandat) ; une annonce du marché n'en a pas, son événement
 * d'agenda se lit dans le Calendrier.
 */
export async function execPlanifierVisite(
  ctx: GesteContext,
  buyer: AcheteurGeste,
  listing: BienGeste,
  visite: VisiteAPlanifier,
): Promise<{ deja: boolean; visiteId: string | null }> {
  const { data: marques, error: mErr } = await supabase
    .from('matches')
    .update({ status: 'visit_planned' })
    .eq('id', buyer.matchId)
    .eq('contact_id', buyer.id)
    .eq('status', 'interested')
    .select('id')
  if (mErr) throw mErr
  if (!marques || marques.length === 0) return { deja: true, visiteId: null }

  let visiteId: string | null = null
  try {
    const dealId = await rattacherDeal(ctx, buyer.id, listing)
    if (listing.kind === 'property') {
      const { data: v, error: vErr } = await supabase
        .from('visits')
        .insert({
          agency_id: ctx.agencyId,
          agent_id: ctx.userId,
          property_id: listing.id,
          contact_id: buyer.id,
          transaction_id: dealId,
          scheduled_at: visite.debut,
          duration_minutes: visite.dureeMinutes,
          status: 'planned',
          visit_type: 'sur_place',
          buyer_name: `${buyer.first} ${buyer.last}`.trim() || null,
          ...visite.details,
          // Le rappel J-1 ne part pas : voir la docstring. Après les détails de la fiche, qui ne le rouvrent pas.
          reminder_sent: true,
        })
        .select('id')
        .single()
      if (vErr) throw vErr
      visiteId = (v as { id: string }).id
      await logEvent(ctx, {
        action: 'visit_scheduled',
        contactId: buyer.id,
        label: `${buyer.first} ${buyer.last} · ${listing.title}`,
        categorie: 'contact',
        metadata: { match_id: buyer.matchId, visit_id: visiteId, deal_id: dealId, bien_ref: listing.ref, scheduled_at: visite.debut },
      })
    } else {
      const fin = new Date(Date.parse(visite.debut) + visite.dureeMinutes * 60_000).toISOString()
      const { error: eErr } = await supabase.from('calendar_events').insert({
        agency_id: ctx.agencyId,
        type: 'visite',
        title: `Visite · ${listing.title}`.slice(0, 200),
        starts_at: visite.debut,
        ends_at: fin,
        contact_id: buyer.id,
        location: visite.lieu,
      })
      if (eErr) throw eErr
    }
    const { error: dErr } = await supabase
      .from('transactions')
      .update({ stage: 'visit_planned' })
      .eq('id', dealId)
      .in('stage', ETAPES_AVANT_VISITE)
    if (dErr) console.error('[atelier] deal stage advance failed', dErr)
  } catch (err) {
    await supabase.from('matches').update({ status: 'interested' }).eq('id', buyer.matchId).eq('status', 'visit_planned')
    throw err
  }
  return { deja: false, visiteId }
}

/** Une correction de recherche proposée par « Apprendre », telle que ses deux gestes la lisent. */
export interface CorrectionGeste {
  contactId: string
  /** Prénom et nom de l'acheteur : le sujet de la ligne de journal. */
  nom: string
  rechercheId: string
  motif: string
  refusIds: readonly string[]
}

/**
 * « Ajuster la recherche » (§4.6) — la correction validée par l'agent.
 *
 * TOUT se fait côté serveur, en UN appel (`matching-engine`, mode `rescore-search`) : les matchs à proposer
 * sont renotés par le VRAI barème avec les critères corrigés, puis, d'un bloc, la clé corrigée est posée (et sur
 * la fiche si elle portait les mêmes critères), les refus pris en compte et UNE ligne `recherche_ajustee` écrite
 * au journal. ⛔ Critères écrits d'abord par le client, un échec de la renotation effaçait la correction de
 * l'écran (plus d'écart à proposer) sans rien avoir renoté ; ici, un échec la laisse, et la même validation se
 * rejoue.
 *
 * ⛔ SEULE LA CLÉ CORRIGÉE PART, jamais les critères entiers : ceux que le fil a lus peuvent dater, et les
 * renvoyer écrasait ce qu'un collègue avait changé entre-temps sur une autre clé.
 */
export async function execAjusterRecherche(
  c: CorrectionGeste,
  changement: Pick<CorrectionChangement, 'cle' | 'apres'>,
): Promise<{ reevalues: number; ecartes: number }> {
  const { data, error } = await supabase.functions.invoke('matching-engine', {
    body: {
      mode: 'rescore-search', client_search_id: c.rechercheId, correction: { cle: changement.cle, valeur: changement.apres },
      motif: c.motif, refus_ids: [...c.refusIds],
    },
  })
  if (error) throw error
  const r = (data ?? {}) as { reevalues?: unknown; ecartes?: unknown }
  return {
    reevalues: typeof r.reevalues === 'number' ? r.reevalues : 0,
    ecartes: typeof r.ecartes === 'number' ? r.ecartes : 0,
  }
}

/**
 * « Ignorer » une correction : ses refus sont pris en compte sans rien corriger. Deux NOUVEAUX refus pour ce
 * motif en proposeront une autre.
 */
export async function execIgnorerCorrection(ctx: GesteContext, c: CorrectionGeste): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ apprentissage_at: new Date().toISOString() })
    .in('id', [...c.refusIds])
    .eq('client_search_id', c.rechercheId)
    .eq('status', 'rejected')
  if (error) throw error
  await logEvent(ctx, {
    action: 'correction_ignoree',
    contactId: c.contactId,
    // Le sujet sous le titre (`detailFor`) : l'acheteur, comme les autres gestes du matching. Le code du
    // motif (« prix ») s'y lisait tel quel ; il reste dans les métadonnées.
    label: c.nom,
    // Famille `contact`, comme `recherche_ajustee` : c'est la recherche de l'acheteur qui est en jeu.
    categorie: 'contact',
    metadata: { client_search_id: c.rechercheId, motif: c.motif, match_ids: [...c.refusIds] },
  })
}

// ─── privé ──────────────────────────────────────────────────────────────
const inDays = (d: number): string => new Date(Date.now() + d * 864e5).toISOString()

/** Délai de la relance interne : posée par « Je l'ai proposé », repoussée d'autant par « J'ai relancé ». */
const DELAI_RELANCE_JOURS = 3

/**
 * La relance interne d'une proposition : une tâche de l'agent (canal `task`), jamais un message à
 * l'acheteur. Elle remplace la relance J+3 automatique d'`automation-engine`, retirée au lot A : elle
 * doublait celle-ci et pouvait écrire au client. Partagée par les gestes pour qu'ils ne divergent pas.
 *
 * `match_ids` ne s'écrit que pour une proposition de PLUSIEURS biens (une sélection n'a qu'une relance) : le
 * trigger `fermer_relance_proposition` la clôt quand plus aucun n'attend, et lit `match_id` seul là où elle
 * manque. ⛔ Écrite à chaque relance, la colonne partait aussi de l'atelier, du mobile et d'« Aujourd'hui » —
 * en production, dont l'écran part AVANT la migration qui la crée (CLAUDE.md §8) : PostgREST refusait
 * l'insertion (`PGRST204`), et le refus était avalé.
 *
 * ⛔ Un refus FAIT LEVER : le geste le dit (le toast de son appelant) au lieu de passer pour réussi sans
 * relance — l'agent n'aurait jamais été rappelé de noter la réponse. Ce qui est déjà écrit (le match, le deal,
 * le journal) reste, et la relecture qui suit l'échec le montre.
 */
async function poserRelance(
  ctx: GesteContext,
  r: { contactId: string; matchId: string; matchIds: readonly string[]; dealId: string | null; propertyId: string | null; message: string },
): Promise<void> {
  const relance: TablesInsert<'reminders'> = {
    agency_id: ctx.agencyId,
    contact_id: r.contactId,
    property_id: r.propertyId,
    transaction_id: r.dealId,
    match_id: r.matchId,
    type: 'follow_up_sent_property',
    trigger_rule: 'manual',
    trigger_days: DELAI_RELANCE_JOURS,
    trigger_at: inDays(DELAI_RELANCE_JOURS),
    status: 'pending',
    channel: 'task',
    message_template: r.message,
  }
  if (r.matchIds.length > 1) relance.match_ids = [...r.matchIds]
  const { error } = await supabase.from('reminders').insert(relance)
  if (error) throw error
}

async function logEvent(
  ctx: GesteContext,
  e: { action: string; contactId: string; label: string; metadata: Record<string, unknown>; categorie?: 'deal' | 'contact' },
): Promise<void> {
  const { error } = await supabase.from('activity_events').insert({
    agency_id: ctx.agencyId,
    actor_id: ctx.userId,
    actor_kind: 'user',
    action: e.action,
    entity_type: 'contact',
    entity_id: e.contactId,
    // `visit_scheduled` est de la famille `contact`, comme l'écrit le copilote (whatsapp-actions), et
    // `correction_ignoree` comme `recherche_ajustee` ; les autres gestes du matching font avancer le deal.
    category: e.categorie ?? 'deal',
    severity: 'info',
    object_label: e.label,
    metadata: e.metadata as Json,
  })
  // Consignation = exigence du contrat ; une erreur RLS ne doit pas passer inaperçue
  if (error) console.error('[atelier] activity_events insert failed', error)
}
