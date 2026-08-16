/**
 * Source de données réelle pour la session de relance du dashboard : les
 * contacts dormants de l'agence (dernière interaction > 14 j ou jamais).
 * Renvoie `isEmpty` pour que l'appelant retombe sur le seed `RELANCE_LEADS`.
 */
// Real-data source for the dashboard relance session.
//
// Replaces the seed RELANCE_LEADS array (still kept in
// src/components/crm-dossiers/dashboard/relanceData.ts) with contacts
// from the agent's agency that have gone dormant — defined as:
//   - last_interaction_at older than 14 days, OR
//   - last_interaction_at IS NULL (never touched after creation)
//
// Returns up to 50 leads ordered by oldest-dormant first. The relance
// session UI is capped to 47 in the seed; we match that bias here.
//
// When the agency has zero qualifying contacts (fresh signup, empty
// pipeline, or RLS denies) the hook returns an empty list and the
// session caller falls back to the seed RELANCE_LEADS to keep the demo
// UX usable. The session also surfaces a "Mode démo" banner in that
// case so the agent knows nothing is being persisted to real recipients.

import { useState } from 'react'
import { useQuery } from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { KycStatus, RelanceLead } from '@/components/crm-dossiers/dashboard/relanceData'

const DORMANT_DAYS = 14
const MAX_LEADS = 50
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#84CC16']

// We sort dormant-first so the agent attacks the coldest leads first
// (highest urgency to re-engage before they ghost permanently).
function daysSince(iso: string | null): number {
  if (!iso) return 999 // treat "never engaged" as maximally dormant
  const diffMs = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
}

// Lightweight contact → RelanceLead adapter. Fields the DB doesn't have
// (bien, bienPrice, budget, quote, history, nextStep, nextStepHint) get
// safe defaults — those are AI-generated nudges in the seed data that
// require their own pipeline to derive from real activity.
function contactToLead(c: {
  id: string
  first_name: string
  last_name: string
  email: string | null
  last_interaction_at: string | null
  score: string | null
}, idx: number): RelanceLead {
  const dorm = daysSince(c.last_interaction_at)
  const kyc: KycStatus = 'none' // real KYC status lives on kyc_cases — fast-follow
  // Map textual contact.score (hot|warm|cold) to a 0-100 number for the
  // UI ring. Default to 50 when unknown.
  const score =
    c.score === 'hot' ? 85
    : c.score === 'warm' ? 65
    : c.score === 'cold' ? 35
    : 50

  return {
    id: c.id,
    contactId: c.id,
    email: c.email,
    first: c.first_name,
    last: c.last_name,
    avatarBg: PALETTE[idx % PALETTE.length],
    score,
    bien: '—',
    bienPrice: '—',
    budget: '—',
    kyc,
    dormSince: dorm,
    // Nullabilité réelle (≠ sentinel dormSince=999) — libellé honnête côté Focus.
    engaged: c.last_interaction_at != null,
    reason:
      c.last_interaction_at
        ? `Dernier contact il y a ${dorm} jours — sans réponse depuis.`
        : 'Jamais relancé depuis sa création.',
    quote: null,
    history: c.last_interaction_at
      ? [{ d: new Date(c.last_interaction_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }), t: 'Dernière interaction', icon: 'msg' }]
      : [{ d: '—', t: 'Aucune interaction enregistrée', icon: 'msg' }],
    nextStep: 'Relance simple',
    nextStepHint:
      'Source : contacts.last_interaction_at. Enrichir le contexte (bien, budget, citation) viendra dans un sprint dédié.',
  }
}

export interface UseRelanceLeadsResult {
  leads: RelanceLead[]
  /** True while the Supabase query is in flight. */
  isLoading: boolean
  /** True when the agency has 0 dormant contacts — caller should fall back to seed. */
  isEmpty: boolean
}

/** Requête les contacts dormants (buyer/seller/tenant/landlord), les adapte en `RelanceLead`, triés du plus froid au plus récent. */
export function useRelanceLeads(): UseRelanceLeadsResult {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null

  // Cut-off: contacts whose last_interaction_at is older than DORMANT_DAYS,
  // OR null (no interaction recorded). PostgREST `.or()` express both.
  //
  // MUST be stable across renders. @supabase-cache-helpers dérive la clé de
  // cache de l'URL PostgREST — or `cutoff` embarquait un `Date.now()` à la
  // milliseconde. Recalculé à chaque render, il faisait muter l'URL → nouvelle
  // clé → refetch → setState → re-render → boucle infinie de requêtes /contacts
  // (jamais de `networkidle`, cf. E2E admin + le contournement domcontentloaded
  // dans agent-dashboard.spec.ts). L'initialiseur paresseux de useState garantit
  // un calcul unique au montage (contrairement à useMemo, que React peut
  // rejeter) ; la précision milliseconde n'a aucune valeur pour un seuil 14 j.
  //
  // Le `useState` paresseux tue la BOUCLE, pas le cache froid : deux montages
  // successifs (retour sur « Aujourd'hui ») produisaient deux horodatages
  // différents, donc deux URL, donc deux clés — la réponse déjà en cache n'était
  // jamais réutilisée et la colonne Focus repartait sur son écran de chargement.
  // On arrondit donc le seuil à l'HEURE : stable d'un montage à l'autre, et sans
  // effet métier sur une fenêtre de 14 jours.
  const [cutoff] = useState(() => {
    const hour = 60 * 60 * 1000
    const bucketed = Math.floor(Date.now() / hour) * hour
    return new Date(bucketed - DORMANT_DAYS * 24 * 60 * 60 * 1000).toISOString()
  })

  const query = supabase
    .from('contacts')
    .select('id, first_name, last_name, email, last_interaction_at, score')
    // Filter: dormant OR never engaged. The `last_interaction_at.lt.X,last_interaction_at.is.null`
    // syntax is PostgREST's OR-in-a-single-filter.
    .or(`last_interaction_at.lt.${cutoff},last_interaction_at.is.null`)
    // Type filter: only leads we'd actually relance (buyer/seller pipeline,
    // not investors or 'lead' bucket which is too cold).
    .in('type', ['buyer', 'seller', 'tenant', 'landlord'])
    .order('last_interaction_at', { ascending: true, nullsFirst: true })
    .limit(MAX_LEADS)

  const { data, isLoading } = useQuery(query, { enabled: !!agencyId })

  const leads = ((data ?? []) as Array<{
    id: string
    first_name: string
    last_name: string
    email: string | null
    last_interaction_at: string | null
    score: string | null
  }>).map(contactToLead)

  return {
    leads,
    isLoading,
    isEmpty: !isLoading && leads.length === 0,
  }
}
