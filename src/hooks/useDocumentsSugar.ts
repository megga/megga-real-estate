// MEGGA CRM Sugar v2 — Source de vérité pour DocumentsSugarV2Page.
// Chaque "dossier" du CRM Documents correspond à une transaction active de
// l'agence (un mandat en cours). Les documents (mandat, bons de visite, offre,
// compromis, acte) sont joints via documents.transaction_id.
//
// Hors scope cette PR :
//   - DOC_TEMPLATES : utilise une table dédiée à concevoir (chantier séparé).
//   - DocAIAlert    : suggestions IA (chantier dédié, Edge Function).
//   - signers / pages / size / customizable : pas dans le schéma actuel.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'
import type {
  DocFolder,
  DocItem,
  DocPhaseId,
  DocStatus,
} from '@/components/crm-sugar/documents/data'

// Mapping stage DB → phase UI Documents
function stageToPhase(s: TransactionStage): DocPhaseId {
  switch (s) {
    case 'new_lead':
    case 'to_qualify':
    case 'to_recontact':
      return 'mandate'
    case 'active_search':
    case 'visit_planned':
      return 'prep'
    case 'visit_done':
    case 'interest_confirmed':
      return 'visits'
    case 'offer':
    case 'negotiation':
      return 'offer'
    case 'reserved':
    case 'financing':
      return 'promise'
    case 'notary':
    case 'signed':
      return 'deed'
    case 'lost':
      return 'mandate'
    default:
      return 'mandate'
  }
}

// Progress 0-100 heuristique sur le stage (à raffiner via une vraie RPC plus tard)
const STAGE_PROGRESS: Record<TransactionStage, number> = {
  new_lead: 5,
  to_qualify: 12,
  active_search: 25,
  visit_planned: 40,
  visit_done: 55,
  interest_confirmed: 65,
  offer: 75,
  negotiation: 80,
  reserved: 85,
  financing: 88,
  notary: 95,
  signed: 100,
  lost: 0,
  to_recontact: 10,
}

// Mapping documents.type → DocItem.phase (heuristique sur la chaîne)
function docTypeToPhase(type: string): DocPhaseId {
  const t = type.toLowerCase()
  if (t.includes('mandat')) return 'mandate'
  if (t.includes('visite') || t.includes('bon')) return 'visits'
  if (t.includes('offre') || t.includes('offer')) return 'offer'
  if (t.includes('compromis') || t.includes('promesse')) return 'promise'
  if (t.includes('acte') || t.includes('notaire') || t.includes('deed')) return 'deed'
  return 'prep'
}

function docStatusFromDb(status: string | null | undefined): DocStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'signed':
    case 'signe':
      return 'signed'
    case 'pending':
    case 'awaiting':
      return 'pending'
    case 'draft':
    case 'brouillon':
      return 'draft'
    case 'expired':
    case 'expire':
      return 'expired'
    case 'archived':
    case 'archive':
      return 'archived'
    default:
      return 'pending'
  }
}

interface TransactionJoin {
  id: string
  stage: TransactionStage
  status: string
  updated_at: string
  property_id: string | null
  property: { id: string; title: string | null; address: string | null; city: string | null; type: string | null; price: number | null; surface_m2: number | null; photos: string[] | null } | { id: string; title: string | null; address: string | null; city: string | null; type: string | null; price: number | null; surface_m2: number | null; photos: string[] | null }[] | null
  seller: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | { first_name: string | null; last_name: string | null; email: string | null; phone: string | null }[] | null
}

interface DocumentJoin {
  id: string
  transaction_id: string | null
  name: string
  type: string
  status: string | null
  created_at: string
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export interface UseDocumentsSugarReturn {
  folders: DocFolder[]
  isLoading: boolean
}

export function useDocumentsSugar(): UseDocumentsSugarReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // 1. Transactions actives de l'agence (= chaque transaction est un "dossier")
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['documents-sugar-transactions', agencyId],
    queryFn: async (): Promise<TransactionJoin[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, updated_at, property_id, property:properties(id, title, address, city, type, price, surface_m2, photos), seller:contacts!contact_seller_id(first_name, last_name, email, phone)')
        .eq('agency_id', agencyId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TransactionJoin[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 2. Documents (non-KYC) liés aux transactions de l'agence
  const transactionIds = useMemo(
    () => transactions.map(t => t.id),
    [transactions],
  )
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['documents-sugar-documents', agencyId, transactionIds],
    queryFn: async (): Promise<DocumentJoin[]> => {
      if (!agencyId || transactionIds.length === 0) return []
      const { data, error } = await supabase
        .from('documents')
        .select('id, transaction_id, name, type, status, created_at')
        .is('kyc_case_id', null)
        .in('transaction_id', transactionIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocumentJoin[]
    },
    enabled: !!agencyId && transactionIds.length > 0,
    staleTime: 60_000,
  })

  // 3. Index documents par transaction_id
  const docsByTransaction = useMemo(() => {
    const map = new Map<string, DocItem[]>()
    for (const d of documents) {
      if (!d.transaction_id) continue
      const item: DocItem = {
        id: d.id,
        phase: docTypeToPhase(d.type),
        type: d.type,
        name: d.name,
        status: docStatusFromDb(d.status),
        date: d.created_at,
      }
      const list = map.get(d.transaction_id) ?? []
      list.push(item)
      map.set(d.transaction_id, list)
    }
    return map
  }, [documents])

  // 4. Adapt transactions → DocFolder[]
  const folders = useMemo<DocFolder[]>(() => {
    return transactions.map(t => {
      const property = unwrap(t.property)
      const seller = unwrap(t.seller)
      const propAddress = property
        ? [property.address, property.city].filter(Boolean).join(', ')
        : ''
      const propTitle = property?.title || propAddress || 'Dossier'
      const price = property?.price ?? 0
      const isRent = price > 0 && price < 20000

      return {
        id: t.id,
        ref: t.id.slice(0, 8).toUpperCase(),
        title: propTitle,
        address: propAddress,
        type: property?.type ?? '',
        price,
        isRent,
        surface: property?.surface_m2 ?? 0,
        photo: property?.photos?.[0] ?? '',
        vendor: {
          name: seller
            ? `${seller.first_name ?? ''} ${seller.last_name ?? ''}`.trim()
            : 'Vendeur non assigné',
          email: seller?.email ?? '',
          phone: seller?.phone ?? '',
        },
        currentPhase: stageToPhase(t.stage),
        progress: STAGE_PROGRESS[t.stage] ?? 0,
        lastActivity: new Date(t.updated_at),
        isArchived: t.stage === 'lost' || t.status === 'cancelled' || t.status === 'completed',
        tags: [],
        docs: docsByTransaction.get(t.id) ?? [],
      }
    })
  }, [transactions, docsByTransaction])

  return {
    folders,
    isLoading: txLoading || docsLoading,
  }
}
