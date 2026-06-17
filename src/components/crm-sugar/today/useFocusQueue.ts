// MEGGA CRM — Cockpit « Aujourd'hui » · File de priorité FOCUS (algo réel)
// ----------------------------------------------------------------------------
// Fusionne 3 sources actionnables et les classe par un SCORE de priorité
// DÉTERMINISTE + EXPLICABLE (module pur focusScore.ts) :
//   1. Reminders du jour/échus (useReminders).
//   2. Deals (usePipelineSugar) — risque dérivé du status (on_hold/cancelled),
//      poids modeste (nextAction = placeholder, pas de vraie échéance).
//   3. Matches 'suggested' à fort score (RPC focus_top_matches via useFocusMatches)
//      — le signal vivant dominant, internes (mandat propre) vs marché distingués.
// Chaque item porte score (estimation), reason (« pourquoi #1 ») et tier
// (now/next/rest). Le tri + les caps (3 « Maintenant », 2 matches/contact)
// vivent dans finalizeQueue. Items AUTO-SUFFISANTS (contact/bien embarqués) :
// plus de dépendance au registry runtime global (fragile).
//
// Compliance : score = estimation (HITL, jamais d'action auto) ; KYC = bonus
// non-bloquant ; 0 LLM. Empty-state honnête côté UI (plus de seed démo en prod).

import { useMemo, useCallback } from 'react'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useReminders } from '@/hooks/useReminders'
import { useSellerLeads } from '@/hooks/useSellerLeads'
import { useRelanceLeads } from '@/hooks/useRelanceLeads'
import { useExpiringOffers } from '@/hooks/useOffers'
import { useFocusVisits } from '@/hooks/useVisits'
import type { StageId } from '@/components/crm-sugar/tokens'
import type { FocusItem } from './focusQueue'
import { fmtCHF } from './data'
import { useFocusMatches, snoozeMatch } from './useFocusMatches'
import { useFocusProperties } from './useFocusProperties'
import { useFocusConfig } from './useFocusConfig'
import {
  scoreItem,
  assignTier,
  buildReason,
  finalizeQueue,
  toDisplayScore,
  isClosingProximate,
  hasKycGap,
  classifyVisit,
  type FocusScoreInput,
  type FocusRankable,
} from './focusScore'

// Item interne = FocusItem + clés de tri (FocusRankable.due) consommées par
// finalizeQueue ; `due` n'est PAS exposé à l'UI.
type QueueItem = FocusItem & FocusRankable

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '··'
}
const AV_PAL = ['#5b6cff', '#E08A45', '#39B7C9', '#34C796', '#9b7cf0', '#8B5CF6', '#2370ff', '#74d184']
function avFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return AV_PAL[Math.abs(h) % AV_PAL.length]
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

// Étape du deal → type d'action (bouton) + libellé de catégorie (badge).
function dealType(stage: StageId): { type: string; category: string } {
  if (stage === 'offer' || stage === 'interest-confirmed') return { type: 'offer', category: 'OFFRE' }
  if (stage === 'signed') return { type: 'sign', category: 'MANDAT' }
  return { type: 'call', category: 'RELANCE' }
}

// Type de reminder → type d'action + libellé de catégorie.
function reminderType(t: string): { type: string; category: string } {
  if (t === 'missing_document') return { type: 'kyc', category: 'KYC' }
  if (t === 'price_change') return { type: 'offer', category: 'OFFRE' }
  return { type: 'call', category: 'RELANCE' }
}

export interface UseFocusQueueResult {
  items: FocusItem[]
  isLive: boolean
  /** Sources encore en chargement — évite le flash « File traitée » trompeur. */
  isLoading: boolean
  /** Geste « Fait » → clôt le reminder en base ; match/deal = UI-only en v1. */
  completeItem: (item: FocusItem) => void
  /** Geste « Replanifier » → reporte le reminder OU snooze le match en base. */
  snoozeItem: (item: FocusItem) => void
}

export function useFocusQueue(): UseFocusQueueResult {
  const { deals, contactsById, biensById, kycByContact, isLoading: dealsLoading } = usePipelineSugar()
  const { reminders, isLoading: remLoading, markAsDone, snooze } = useReminders()
  const { matches, isLoading: matchesLoading } = useFocusMatches()
  // RADAR : nouveaux mandats vendeurs 'new' à réclamer (argent qui attend).
  // Limite bornée : la file Focus est une « liste courte » et l'entonnoir public
  // (anon insert) peut faire grossir seller_leads — on ne charge que le haut.
  const { data: sellerLeads = [], isLoading: sellerLoading } = useSellerLeads('new', 50)
  // RADAR v2 : leads qui refroidissent (recency). useRelanceLeads calcule déjà
  // les contacts dormants (last_interaction_at > 14j OU NULL), qualité + dormance.
  const { leads: coolingLeads, isLoading: coolingLoading } = useRelanceLeads()
  // RADAR v3 : offres 'pending' proches de l'échéance + visites de l'agenda.
  const { data: expiringOffers = [], isLoading: offersLoading } = useExpiringOffers(50)
  const { data: focusVisits = [], isLoading: visitsLoading } = useFocusVisits(100)
  // RADAR v4 : biens internes à pousser (score de bien backend, RLS agence).
  const { properties: focusProperties, isLoading: propsLoading } = useFocusProperties(12)
  const cfg = useFocusConfig()

  const items = useMemo<QueueItem[]>(() => {
    // Snapshot du temps courant : la file est FIGÉE à l'instant du calcul et
    // recalculée quand les sources changent. Usage intentionnel (sinon la file
    // se reset à chaque render) — on tait la règle purity.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const out: QueueItem[] = []

    // 1. Deals (hors 'lost') — le score/tier décide de la visibilité.
    for (const d of deals) {
      if (d.stage === 'lost') continue
      const c = contactsById.get(d.contactId)
      const b = d.bienId ? biensById.get(d.bienId) : undefined
      const contact = c ? `${c.firstName} ${c.lastName}`.trim() : 'Contact'
      const kyc = kycByContact.get(d.contactId)

      // 1b. RADAR KYC×closing : deal proche du closing dont le dossier KYC
      // (acheteur, déjà ouvert) n'est pas vérifié → item 'kyc' À LA PLACE du
      // deal (compléter la vérif = la prochaine action). NON-BLOQUANT : aucune
      // étape n'est gelée, on surface seulement. On exige un dossier EXISTANT
      // (pas de faux « démarrer le KYC » sur un deal côté vendeur sans acheteur).
      if (isClosingProximate(d.stage) && kyc && hasKycGap(kyc.dossier_status)) {
        const input: FocusScoreInput = {
          signalKind: 'kyc',
          stageProb: d.probability,
          dealStage: d.stage,
          dealValue: d.value,
          kycDossierStatus: kyc.dossier_status,
        }
        const score = scoreItem(input, now, cfg)
        const tier = assignTier(input, now, cfg)
        out.push({
          id: `kyc-${d.id}`,
          type: 'kyc',
          signalKind: 'kyc',
          contact,
          contactId: d.contactId,
          initials: c ? initialsOf(contact) : '··',
          av: c?.avatarBg || '#39B7C9',
          category: 'KYC',
          time: '',
          eta: '',
          sub: b?.title
            ? `${b.title} — dossier KYC à finaliser avant le closing.`
            : 'Dossier KYC à finaliser avant le closing.',
          reason: buildReason(input, now, cfg),
          score,
          displayScore: toDisplayScore(score, cfg),
          tier,
          urgent: tier === 'now',
          bien: { photo: b?.coverPhoto || '', price: fmtCHF(d.value), title: b?.title || undefined },
          due: new Date(d.updatedAt).getTime(),
        })
        continue
      }

      const { type, category } = dealType(d.stage)
      const input: FocusScoreInput = {
        signalKind: 'deal',
        stageProb: d.probability,
        dealRisk: d.risk,
        dealStage: d.stage,
        dealValue: d.value,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      out.push({
        id: `deal-${d.id}`,
        type,
        signalKind: 'deal',
        contact,
        contactId: d.contactId,
        initials: c ? initialsOf(contact) : '··',
        av: c?.avatarBg || '#6F8CFF',
        category,
        time: fmtTime(d.nextAction?.dueAt),
        eta: '',
        sub: b?.title ? `${b.title} — à faire avancer.` : 'Deal à faire avancer.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: b?.coverPhoto || '', price: fmtCHF(d.value), title: b?.title || undefined },
        due: d.nextAction?.dueAt ? new Date(d.nextAction.dueAt).getTime() : new Date(d.updatedAt).getTime(),
      })
    }

    // 2. Reminders actifs (pending/triggered). Le tier filtre les futurs en « rest ».
    for (const r of reminders) {
      if (r.status !== 'pending' && r.status !== 'triggered') continue
      const { type, category } = reminderType(r.type)
      const input: FocusScoreInput = {
        signalKind: 'reminder',
        reminderTriggerAt: r.triggerAt,
        reminderType: r.type,
        reminderTime: fmtTime(r.triggerAt),
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      out.push({
        id: `rem-${r.id}`,
        type,
        signalKind: 'reminder',
        contact: r.contactName || 'Contact',
        contactId: r.contactId || r.id,
        initials: initialsOf(r.contactName || ''),
        av: avFromId(r.contactId || r.id),
        category,
        time: fmtTime(r.triggerAt),
        eta: '',
        sub: r.description || r.title || (category === 'KYC' ? "Vérification d'identité à compléter." : 'À relancer.'),
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: '', price: '—', title: r.propertyTitle },
        due: r.triggerAt ? new Date(r.triggerAt).getTime() : undefined,
      })
    }

    // 3. Matches (RPC) — déjà gatés + cappés en SQL ; on score et on tiers.
    for (const m of matches) {
      const input: FocusScoreInput = {
        signalKind: m.signalKind,
        matchScore: m.score,
        reasonsMatchCount: m.reasonsMatchCount,
        reasonKeys: m.reasonKeys,
        kyc: m.kyc,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = m.contactName || 'Contact'
      out.push({
        id: `match-${m.matchId}`,
        type: 'match',
        signalKind: m.signalKind,
        contact,
        contactId: m.contactId,
        initials: initialsOf(contact),
        av: avFromId(m.contactId),
        category: 'MATCH',
        time: '',
        eta: '',
        sub: m.propertyTitle
          ? `${m.propertyTitle}${m.city ? ` · ${m.city}` : ''}`
          : 'Bien proposé — à présenter.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        scoreBrut: m.score,
        tier,
        urgent: tier === 'now',
        bien: {
          photo: m.propertyPhoto || '',
          price: m.propertyPrice != null ? fmtCHF(m.propertyPrice) : '—',
          title: m.propertyTitle || undefined,
        },
        due: undefined,
      })
    }

    // 4. Seller-leads 'new' (RADAR) — nouveaux mandats à réclamer. Auto-suffisants
    // (le lead 'new' n'a souvent ni contact_id ni property_id) : on lit
    // property_data / estimation / contact_name. NB : un lead non assigné est
    // visible par toutes les agences (pool d'entrée partagé, RLS by design).
    for (const lead of sellerLeads) {
      if (!lead.contact_name) continue // pas d'identité exploitable → on ignore
      const pd = lead.property_data
      const city = pd?.city || null
      const est = lead.estimation_median != null ? fmtCHF(lead.estimation_median) : null
      const input: FocusScoreInput = {
        signalKind: 'seller-lead',
        sellerEstimation: lead.estimation_median,
        sellerMotivation: lead.motivation,
        sellerCity: city,
        sellerCreatedAt: lead.created_at,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      out.push({
        id: `seller-${lead.id}`,
        type: 'seller',
        signalKind: 'seller-lead',
        contact: lead.contact_name,
        contactId: lead.contact_id || lead.id,
        initials: initialsOf(lead.contact_name),
        av: avFromId(lead.id),
        category: 'VENDEUR',
        time: '',
        eta: '',
        sub: [pd?.address || city, est ? `estimation ${est}` : null].filter(Boolean).join(' · ')
          || 'Nouveau mandat vendeur à qualifier.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: pd?.photos?.[0] || '', price: est || '—', title: pd?.address || undefined },
        due: lead.created_at ? new Date(lead.created_at).getTime() : undefined,
      })
    }

    // 4b. Offres 'pending' proches de l'échéance (RADAR v3) — événement daté.
    // Argent en jeu + délai : on surface l'offre dont la réponse expire bientôt.
    // crm_offers n'a PAS de contact_id → contact = by_label, contactId = by_id
    // (sinon l'id de l'offre). PAS de dédup : une offre qui expire est une action
    // propre, même si le contact a déjà un autre signal. Le tier 'rest' (offre
    // lointaine) est plié côté UI ; le cap offer_expiring_returned borne le reste.
    for (const o of expiringOffers) {
      const input: FocusScoreInput = {
        signalKind: 'offer-expiring',
        offerExpiresAt: o.expires_at,
        offerAmount: o.amount,
        offerStatus: o.status,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = o.by_label || 'Offre'
      out.push({
        id: `offer-${o.id}`,
        type: 'offer',
        signalKind: 'offer-expiring',
        contact,
        contactId: o.by_id || o.id,
        initials: initialsOf(contact),
        av: avFromId(o.id),
        category: 'OFFRE',
        time: '',
        eta: '',
        sub: `Offre ${fmtCHF(o.amount)} en attente — réponse à suivre.`,
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: '', price: fmtCHF(o.amount), title: undefined },
        due: o.expires_at ? new Date(o.expires_at).getTime() : undefined,
      })
    }

    // 4c. Visites de l'agenda (RADAR v3) — à préparer (aujourd'hui) / débrief en
    // attente / no-show. classifyVisit route le sous-signal ; on NE construit PAS
    // les visites sans signal ('none' : future au-delà d'aujourd'hui, annulée,
    // déjà débriefée). Cappé (visit_returned) pour une journée chargée.
    for (const v of focusVisits) {
      const input: FocusScoreInput = {
        signalKind: 'visit',
        visitScheduledAt: v.scheduledAt,
        visitStatus: v.status,
        visitDebriefMissing: v.debriefMissing,
      }
      if (classifyVisit(input, now) === 'none') continue
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = v.contactName || 'Contact'
      out.push({
        id: `visit-${v.id}`,
        type: 'visit',
        signalKind: 'visit',
        contact,
        contactId: v.contactId,
        initials: initialsOf(contact),
        av: avFromId(v.id),
        category: 'VISITE',
        time: fmtTime(v.scheduledAt),
        eta: '',
        sub: [v.propertyTitle, v.propertyCity].filter(Boolean).join(' · ') || 'Visite à suivre.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: '', price: '—', title: v.propertyTitle || undefined },
        due: v.scheduledAt ? new Date(v.scheduledAt).getTime() : undefined,
      })
    }

    // 5. Leads qui refroidissent (RADAR v2) — signal de FOND. DÉDUP : on ne
    // surface QUE les contacts sans autre signal plus fort déjà dans la file
    // (la famille cooling = les leads OUBLIÉS, pas ceux qui ont déjà un match /
    // rappel / deal / KYC en cours). Le cap dur (cooling_returned) + le tier
    // 'next' (jamais 'now') vivent dans focusScore (finalizeQueue / assignTier).
    const alreadyInQueue = new Set(out.map((it) => it.contactId))
    for (const lead of coolingLeads) {
      const cid = lead.contactId ?? lead.id
      if (alreadyInQueue.has(cid)) continue
      // Libellé honnête « jamais recontacté » vs « se refroidit » : on lit la
      // nullabilité réelle (lead.engaged), PAS le sentinel dormSince=999 (qui
      // collisionnerait avec un contact dormant ~999 j → faux « jamais recontacté »).
      const hasDate = lead.engaged === true
      const input: FocusScoreInput = {
        signalKind: 'lead-cooling',
        coolingQuality: lead.score,
        coolingDormDays: lead.dormSince,
        coolingHasDate: hasDate,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = `${lead.first} ${lead.last}`.trim() || 'Contact'
      out.push({
        id: `cooling-${lead.id}`,
        type: 'cooling',
        signalKind: 'lead-cooling',
        contact,
        contactId: cid,
        initials: initialsOf(contact),
        av: lead.avatarBg || avFromId(lead.id),
        category: 'RELANCE',
        time: '',
        eta: '',
        sub: lead.reason,
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: '', price: '—', title: undefined },
        due: undefined,
      })
    }

    // 6. Biens à pousser (RADAR v4 — score de bien). Signal de FOND portfolio :
    // les biens internes les mieux placés (overall_score backend) avec un geste
    // HONNÊTE tiré du levier le plus faible. UI-only ; jamais 'now' ; cappé
    // (property_returned). assignTier relègue les 'en_veille' (overall < 45) en
    // 'rest' → on ne les construit pas (pas de bruit dans la file live).
    for (const p of focusProperties) {
      const input: FocusScoreInput = {
        signalKind: 'property-push',
        propertyOverall: p.overall,
        propertyLabel: p.label,
        propertyCompleteness: p.completeness ?? undefined,
        propertyInterest: p.interest ?? undefined,
        propertyPipeline: p.pipeline ?? undefined,
        propertyDataCompleteness: p.dataCompleteness ?? undefined,
      }
      const tier = assignTier(input, now, cfg)
      if (tier === 'rest') continue
      const score = scoreItem(input, now, cfg)
      const title = p.title || 'Bien sans titre'
      out.push({
        id: `bien-${p.propertyId}`,
        type: 'bien',
        signalKind: 'property-push',
        contact: title,
        // clé synthétique property-keyée : pas de contact (≠ familles contact) ; ne
        // collisionne pas avec un contactId et n'est pas touchée par le cap match.
        contactId: `property:${p.propertyId}`,
        initials: initialsOf(title),
        av: avFromId(p.propertyId),
        category: 'BIEN',
        time: '',
        eta: '',
        sub: [p.title, p.city].filter(Boolean).join(' · ') || 'Bien interne à travailler.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: false,
        bien: { photo: p.photo || '', price: p.price != null ? fmtCHF(p.price) : '—', title: p.title || undefined },
        due: undefined,
      })
    }

    return finalizeQueue(out, cfg)
  }, [deals, contactsById, biensById, kycByContact, reminders, matches, sellerLeads, coolingLeads, expiringOffers, focusVisits, focusProperties, cfg])

  const isLoading = dealsLoading || remLoading || matchesLoading || sellerLoading || coolingLoading || offersLoading || visitsLoading || propsLoading
  const hasData = deals.length > 0 || reminders.length > 0 || matches.length > 0 || sellerLeads.length > 0 || coolingLeads.length > 0 || expiringOffers.length > 0 || focusVisits.length > 0 || focusProperties.length > 0
  const isLive = !isLoading && hasData

  // Gestes réels (HITL) : Fait clôt le reminder ; Replanifier reporte le
  // reminder OU snooze le match (+3 j). Fait sur un match = UI-only en v1 (ne PAS
  // écrire matches.status/sent_at — ça fausserait le pipeline matching/analytics).
  // Items deal / kyc (kyc-…) / seller-lead (seller-…) / lead-cooling (cooling-…) /
  // offre (offer-…) / visite (visit-…) = UI-only (réclamer un lead exige le flux
  // d'acceptation complet ; le KYC reste non-bloquant ; l'offre se traite dans la
  // fiche, la visite dans l'agenda). Fire-and-forget : le refetch rafraîchit la file.
  const completeItem = useCallback((item: FocusItem) => {
    if (item.id.startsWith('rem-')) markAsDone(item.id.slice(4))
  }, [markAsDone])

  const snoozeItem = useCallback((item: FocusItem) => {
    if (item.id.startsWith('rem-')) void snooze(item.id.slice(4))
    else if (item.id.startsWith('match-')) void snoozeMatch(item.id.slice(6))
  }, [snooze])

  return { items, isLive, isLoading, completeItem, snoozeItem }
}
