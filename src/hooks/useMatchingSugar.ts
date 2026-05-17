// MEGGA CRM Sugar v2 — Adapter Supabase → CrmContact/CrmMatch/CrmBien
// Permet à MatchingSugarV2Page de consommer la vraie donnée Supabase
// (matches + contacts + kyc_cases) sans refactorer les composants UI :
// la sortie respecte les shapes mock que FocusPanel/MMiniRow/etc consomment.
//
// Branchements :
//   - matches : useMatching (hook existant)
//   - contacts : SELECT contacts WHERE id IN (buyer ids des matches)
//   - kyc : SELECT kyc_cases WHERE contact_id IN (...) (dernier par contact)
//   - sendMatch : useMatching.sendMatch (UPDATE matches SET status='sent', sent_at, sent_via)
//   - scheduleVisit : INSERT INTO visits (status='planned', scheduled_at, contact_id, property_id)
//   - runMatching : useMatching.runMatching → invoke('matching-engine')
//   - updateCriteria : UPDATE contacts SET search_criteria = $1
//
// Mapping enum match.status :
//   DB 'suggested' → mock 'to-send'
//   DB 'sent' | 'visit_planned' → mock 'sent'
//   DB 'interested' → mock 'liked'
//   DB 'rejected' | 'ignored' → mock 'rejected'

import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useMatching, type MatchResult } from '@/hooks/useMatching'
import type { Contact, SearchCriteria } from '@/types/contact'
import type { KycCase, KycDossierStatus } from '@/types/kyc'
import {
  registerLiveBien,
  registerLiveContact,
  resetLiveOverrides,
  type CrmBien,
  type CrmContact,
  type CrmMatch,
} from '@/components/crm-sugar/mockData'
import type { MatchGroup } from '@/components/crm-sugar/matching/helpers'

// ─── Mapping enum match.status ─────────────────────────────────────────────
function mapMatchStatus(dbStatus: MatchResult['status']): CrmMatch['status'] {
  switch (dbStatus) {
    case 'suggested':    return 'to-send'
    case 'sent':         return 'sent'
    case 'visit_planned': return 'sent'
    case 'interested':   return 'liked'
    case 'rejected':     return 'rejected'
    case 'ignored':      return 'rejected'
    default:             return 'to-send'
  }
}

// ─── Reasons : flatten JSONB structuré en chips lisibles ──────────────────
const REASON_LABELS: Record<string, string> = {
  budget: 'Budget',
  zone: 'Zone',
  type: 'Type',
  rooms: 'Pièces',
  features: 'Critères',
}

function flattenReasons(r: MatchResult['reasons']): string[] {
  return Object.entries(r)
    .filter(([, v]) => v.match && v.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([k, v]) => `${REASON_LABELS[k] ?? k} +${v.score}`)
}

// ─── Mapping KycDossierStatus (Sprint 1 LBA) → CrmContact.kyc.status ──────
// Le champ `dossier_status` de Sprint 1 (migration 20260516_002_sprint1_kyc_lba.sql)
// est la source de vérité — il est calculé par triggers SQL à partir de la
// checklist + screening + expires_at, et passe automatiquement à 'stale' après
// 12 mois. On le mappe 1:1 sur les valeurs UI mock.
function mapKycStatus(
  dbDossierStatus: KycDossierStatus | undefined,
): CrmContact['kyc']['status'] {
  if (!dbDossierStatus) return 'none'
  if (dbDossierStatus === 'failed') return 'none'   // pas d'état UI dédié
  return dbDossierStatus  // 'none' | 'pending' | 'verified' | 'stale' — match exact
}

// ─── Mapping Contact.type DB → CrmContact.type ────────────────────────────
function mapContactType(t: Contact['type']): CrmContact['type'] {
  switch (t) {
    case 'buyer':     return 'buyer'
    case 'seller':    return 'seller'
    case 'tenant':    return 'tenant'
    case 'landlord':  return 'landlord'
    case 'both':      return 'mixed'
    case 'investor':  return 'buyer'   // investor = acheteur côté matching
    case 'lead':      return 'buyer'   // lead pas encore qualifié, traité buyer
    default:          return 'buyer'
  }
}

// ─── SearchCriteria DB → CrmContact.criteria ──────────────────────────────
function mapCriteria(c: SearchCriteria | null): CrmContact['criteria'] {
  if (!c) return undefined
  return {
    transaction: 'vente',  // pas de discriminant côté DB pour l'instant
    types: c.type ? [c.type] : [],
    cantons: [],
    cities: c.zones ?? [],
    budgetMin: c.budget_min,
    budgetMax: c.budget_max ?? 0,
    areaMin: c.surface_min,
    areaMax: c.surface_max,
    roomsMin: c.rooms_min,
    mustHave: c.features ?? [],
  }
}

// ─── Couleur avatar déterministe par contact.id ──────────────────────────
const AVATAR_PALETTE = [
  '#0041D9', '#8B5CF6', '#10B981', '#F59E0B',
  '#06B6D4', '#E53935', '#6366F1', '#EC4899',
]
function pickAvatarBg(contactId: string): string {
  let h = 0
  for (const ch of contactId) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

// ─── MatchResult.listing → CrmBien ───────────────────────────────────────
function listingToBien(m: MatchResult): CrmBien {
  const l = m.listing
  const bienId = m.propertyId ?? m.marketListingId ?? m.id
  // type DB (apartment / house / villa) → type mock (appartement / maison / villa)
  const typeMap: Record<string, CrmBien['type']> = {
    apartment:  'appartement',
    appartement:'appartement',
    house:      'maison',
    maison:     'maison',
    villa:      'villa',
    commercial: 'commercial',
    office:     'office',
    parking:    'parking',
    storage:    'storage',
    land:       'land',
  }
  const isRental = l.days_on_market !== undefined && l.price > 0 && l.price < 20000
  return {
    id: bienId,
    ref: bienId.slice(0, 12).toUpperCase(),
    status: 'active',
    type: typeMap[l.type?.toLowerCase()] ?? 'appartement',
    transaction: isRental ? 'location' : 'vente',
    title: l.title || `${typeMap[l.type] ?? 'Bien'} ${l.city ?? ''}`.trim(),
    addr: [l.address, l.city].filter(Boolean).join(', '),
    canton: l.canton ?? '',
    price: isRental ? null : (l.price || null),
    rent: isRental ? l.price : null,
    charges: l.charges_monthly || null,
    area: l.surface_m2 || 0,
    rooms: l.rooms || 0,
    beds: l.bedrooms || 0,
    baths: 0,
    year: l.year_built || 0,
    energy: '',
    ownerContactId: null,
    mandat: { type: 'simple' },
    visibility: m.source === 'market' ? 'public' : 'agency',
    stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: l.photos?.length ?? 0,
    signedPhotoCount: l.photos?.length ?? 0,
    accent: pickAvatarBg(bienId),
  }
}

// ─── Contact + KycCase → CrmContact ──────────────────────────────────────
function contactToCrm(c: Contact, kyc: KycCase | undefined): CrmContact {
  return {
    id: c.id,
    type: mapContactType(c.type),
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    lang: (c.language as CrmContact['lang']) || 'fr',
    status: 'active',
    score: c.score === 'hot' ? 90 : c.score === 'warm' ? 60 : c.score === 'cold' ? 30 : 0,
    source: 'website',
    assignedTo: '',
    createdAt: c.created_at,
    lastActivityAt: c.last_interaction_at ?? c.created_at,
    kyc: {
      status: mapKycStatus(kyc?.dossier_status),
      riskLevel: kyc?.risk_level === 'high' ? 'high' :
                 kyc?.risk_level === 'medium' ? 'medium' : 'low',
      expiresAt: kyc?.expires_at ?? undefined,
    },
    criteria: mapCriteria(c.search_criteria),
    tags: c.tags ?? [],
    notes: c.notes ?? undefined,
    avatarBg: pickAvatarBg(c.id),
  }
}

// ─── Hook principal ──────────────────────────────────────────────────────
export interface UseMatchingSugarReturn {
  groups: MatchGroup[]
  isLoading: boolean
  sendMatch: (matchId: string, channel: 'email' | 'whatsapp' | 'both') => void
  scheduleVisit: (input: ScheduleVisitInput) => Promise<void>
  runMatching: () => void
  isRunning: boolean
  updateCriteria: (contactId: string, patch: Partial<SearchCriteria>) => Promise<void>
}

export interface ScheduleVisitInput {
  contactId: string
  propertyId: string
  scheduledAt: string  // ISO
  durationMin: number
  notes?: string
}

export function useMatchingSugar(): UseMatchingSugarReturn {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const agencyId = profile?.agency_id

  // 1. Matches via le hook existant.
  // On ne réexporte pas `runMatching` (mode 'match-contact', requiert un contactId) :
  // notre `runMatching()` ci-dessous fait un scan agency-wide via invoke direct.
  const { matches, isLoading: matchesLoading, sendMatch, isRunning } = useMatching()

  // 2. Contacts impliqués (acheteurs des matches)
  const buyerIds = useMemo(
    () => Array.from(new Set(matches.map(m => m.contactId))),
    [matches],
  )

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['matching-sugar-contacts', agencyId, buyerIds],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId || buyerIds.length === 0) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .in('id', buyerIds)
      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: !!agencyId && buyerIds.length > 0,
  })

  // 3. Dossiers KYC du dernier connu par contact
  const { data: kycCases = [], isLoading: kycLoading } = useQuery({
    queryKey: ['matching-sugar-kyc', agencyId, buyerIds],
    queryFn: async (): Promise<KycCase[]> => {
      if (!agencyId || buyerIds.length === 0) return []
      // Filtre par type acheteur uniquement : un contact peut avoir plusieurs
      // dossiers (achat + vente), on ne veut que le dossier acheteur (pp/pm).
      // ORDER BY created_at DESC → le premier match = le plus récent.
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, contact_id, type, status, dossier_status, risk_level, expires_at, created_at')
        .in('contact_id', buyerIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KycCase[]
    },
    enabled: !!agencyId && buyerIds.length > 0,
  })

  // 4. Index KYC par contact (premier = le plus récent)
  const kycByContact = useMemo(() => {
    const map = new Map<string, KycCase>()
    for (const k of kycCases) {
      if (!map.has(k.contact_id)) map.set(k.contact_id, k)
    }
    return map
  }, [kycCases])

  // 5. Adapter Supabase → Crm shapes — PURE (pas de side effects, safe pour
  // React 18+ Concurrent Rendering). Le registry runtime est rempli ensuite
  // par un useEffect dédié, après que groups soit committed.
  const groups = useMemo<MatchGroup[]>(() => {
    if (matches.length === 0) return []

    // a. Indexer contacts
    const contactsById = new Map(contacts.map(c => [c.id, c]))

    // b. Transformer matches en (CrmMatch + CrmBien) par buyer
    type Acc = { matches: CrmMatch[]; biens: CrmBien[] }
    const acc = new Map<string, Acc>()

    for (const m of matches) {
      const bien = listingToBien(m)
      const crmMatch: CrmMatch = {
        id: m.id,
        contactId: m.contactId,
        bienId: bien.id,
        score: m.score,
        reasons: flattenReasons(m.reasons),
        status: mapMatchStatus(m.status),
      }
      const entry = acc.get(m.contactId) ?? { matches: [], biens: [] }
      entry.matches.push(crmMatch)
      entry.biens.push(bien)
      acc.set(m.contactId, entry)
    }

    // c. Construire groups (CrmContact dérivé du contact + KYC du contact_id)
    const out: MatchGroup[] = []
    for (const [buyerId, { matches: ms, biens: _bs }] of acc) {
      const contact = contactsById.get(buyerId)
      if (!contact) continue
      const buyer = contactToCrm(contact, kycByContact.get(buyerId))
      const sorted = ms.sort((a, b) => b.score - a.score)
      out.push({ buyer, matches: sorted, topScore: sorted[0]?.score ?? 0 })
    }

    return out.sort((a, b) => b.topScore - a.topScore)
  }, [matches, contacts, kycByContact])

  // 6. Side effect séparé : remplir le registry runtime après commit.
  // Garantit que crmBienById/crmContactById renvoient les versions Supabase
  // pour les composants UI qui appellent ces helpers.
  useEffect(() => {
    if (groups.length === 0) {
      resetLiveOverrides()
      return
    }
    resetLiveOverrides()
    for (const g of groups) {
      registerLiveContact(g.buyer)
      for (const m of g.matches) {
        const sourceMatch = matches.find(sm => sm.id === m.id)
        if (sourceMatch) registerLiveBien(listingToBien(sourceMatch))
      }
    }
  }, [groups, matches])

  // 7. Cleanup au démontage (évite que d'autres pages Sugar v2 héritent du registry)
  useEffect(() => {
    return () => { resetLiveOverrides() }
  }, [])

  // 7. Mutation : créer une visite (status='planned')
  const scheduleVisitMutation = useMutation({
    mutationFn: async (input: ScheduleVisitInput) => {
      if (!agencyId) throw new Error('No agency')
      const { error } = await supabase.from('visits').insert({
        agency_id: agencyId,
        contact_id: input.contactId,
        property_id: input.propertyId,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMin,
        status: 'planned',
        notes: input.notes ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  // 8. Mutation : update search_criteria du buyer.
  // IMPORTANT : le moteur de matching (Edge Function `matching-engine`) lit
  // `client_searches.criteria`, PAS `contacts.search_criteria`. Pour que
  // l'édit inline impacte le re-matching, on doit propager les deux :
  //   - `contacts.search_criteria` (affiche immédiatement la nouvelle valeur)
  //   - `client_searches.criteria` du dossier actif (pris en compte par l'IA)
  // Si aucun client_search actif n'existe pour ce buyer, on en crée un.
  const updateCriteriaMutation = useMutation({
    mutationFn: async ({ contactId, patch }: { contactId: string; patch: Partial<SearchCriteria> }) => {
      if (!agencyId) throw new Error('No agency')
      // 1. Merge avec l'existant côté contacts.search_criteria
      const existing = contacts.find(c => c.id === contactId)?.search_criteria ?? null
      const merged: SearchCriteria = { ...(existing ?? {}), ...patch }

      // 2. Update contacts.search_criteria (vue dénormalisée)
      const { error: contactErr } = await supabase
        .from('contacts')
        .update({ search_criteria: merged })
        .eq('id', contactId)
      if (contactErr) throw contactErr

      // 3. Propager au client_search actif (consommé par le matching engine)
      const { data: existingSearches } = await supabase
        .from('client_searches')
        .select('id, criteria')
        .eq('contact_id', contactId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingSearches && existingSearches.length > 0) {
        const search = existingSearches[0] as { id: string; criteria: SearchCriteria }
        const mergedSearch: SearchCriteria = { ...(search.criteria ?? {}), ...patch }
        const { error: updErr } = await supabase
          .from('client_searches')
          .update({ criteria: mergedSearch, updated_at: new Date().toISOString() })
          .eq('id', search.id)
        if (updErr) throw updErr
      } else {
        // Pas de client_search actif : en créer un
        const { error: insErr } = await supabase
          .from('client_searches')
          .insert({
            agency_id: agencyId,
            contact_id: contactId,
            criteria: merged,
            is_active: true,
          })
        if (insErr) throw insErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-sugar-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact'] })
    },
  })

  return {
    groups,
    isLoading: matchesLoading || contactsLoading || kycLoading,
    sendMatch,
    scheduleVisit: (input: ScheduleVisitInput) => scheduleVisitMutation.mutateAsync(input),
    runMatching: () => {
      // Trigger un scan global plutôt que par contact (l'agent veut tout rafraîchir)
      // L'Edge Function accepte mode='scan-all' pour agency-wide
      void runScanAll()
    },
    isRunning,
    updateCriteria: (contactId: string, patch: Partial<SearchCriteria>) =>
      updateCriteriaMutation.mutateAsync({ contactId, patch }),
  }

  async function runScanAll() {
    if (!agencyId) return
    const { error } = await supabase.functions.invoke('matching-engine', {
      body: { mode: 'scan-all', agency_id: agencyId },
    })
    if (error) console.error('matching-engine scan-all failed', error)
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }
}
