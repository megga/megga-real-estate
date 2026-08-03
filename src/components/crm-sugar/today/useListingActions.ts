// MEGGA CRM — Today V2 « concept H » · LOT 3 · le segment « Annonces ».
// ----------------------------------------------------------------------------
// Dérive les actions de diffusion des biens de l'agence. AUCUNE table nouvelle :
// `properties` porte déjà l'état de complétude, `property_syndications` l'état de
// poussée sur le portail.
//
// ⛔ MOTIFS RÉELS UNIQUEMENT. Le handoff (§2.7) est explicite : la carte de démo
// « 2 photos sans certificat C2PA » est un motif à NE PAS implémenter — C2PA est
// hors MVP. On ne produit donc que ce que la base sait dire : brouillon,
// complétude manquante, bien public jamais poussé, bien diffusé.
//
// ⛔ LES CTA EMMÈNENT, ILS N'AGISSENT PAS. « Publier » n'écrit rien ici : le
// go-live est bloqué chez le TIERS (accès FTP, `idx_enabled` à false), donc une
// RPC `listing_publish_portal` écrirait `queued` sans que rien ne parte — un
// bouton qui ment. Le CTA ouvre la fiche du bien, là où la diffusion se pilote.
//
// Portail unique V1 = Immobilier.ch (CLAUDE.md). Aucun autre n'est présenté.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatCHF } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { HlAnnData } from './dataH'

/** Une description plus courte que ça ne vend rien : le bien est incomplet. */
const DESCRIPTION_MIN = 80

/** Le fil est volume-adaptatif, comme la maquette : au plus 4 cartes. */
const MAX_ACTIONS = 4

interface PropertyRow {
  id: string
  title: string | null
  address: string | null
  city: string | null
  price: number | null
  status: string
  photos: string[] | null
  description: string | null
  syndications: Array<{ portal: string; status: string; last_pushed_at: string | null }> | null
}

export interface ListingAction extends HlAnnData {
  /** Bien visé — le CTA ouvre sa fiche. */
  propertyId: string
}

export interface UseListingActionsReturn {
  actions: ListingAction[]
  /** Nombre de biens de l'agence, tous motifs confondus. */
  total: number
  isLoading: boolean
}

/** Gravité décroissante : ce qui empêche de vendre passe avant ce qui l'améliore. */
type Motif = 'draft' | 'noPhoto' | 'thinDescription' | 'notPushed' | 'published'

const MOTIF_DOT: Record<Motif, string> = {
  draft: '#797D90',            // brouillon — neutre
  noPhoto: '#C45A00',          // bloquant à la diffusion
  thinDescription: '#C45A00',
  notPushed: '#1E5BC6',        // prêt, mais pas encore poussé
  published: '#059669',        // diffusé
}

export function useListingActions(): UseListingActionsReturn {
  const { t } = useTranslation('dashboard')
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['today-listing-actions', agencyId],
    queryFn: async (): Promise<PropertyRow[]> => {
      if (!agencyId) return []
      // ⚠ `photos` et `description` sont des colonnes LOURDES (CLAUDE.md §7).
      // Ici c'est assumé : le périmètre est UNE agence (quelques dizaines de
      // lignes), pas `market_listings` et ses 173k. On ne trie ni ne filtre
      // dessus — le classement se fait en mémoire, sur un jeu déjà borné.
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, address, city, price, status, photos, description, syndications:property_syndications(portal, status, last_pushed_at)')
        .eq('agency_id', agencyId)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data ?? []) as unknown as PropertyRow[]
    },
    enabled: !!agencyId,
    staleTime: 5 * 60_000,
  })

  const actions = useMemo<ListingAction[]>(() => {
    const scored = rows.map((p) => {
      const pushed = (p.syndications ?? []).some((s) => s.status === 'published' || !!s.last_pushed_at)
      const noPhoto = !p.photos || p.photos.length === 0
      const thin = !p.description || p.description.trim().length < DESCRIPTION_MIN

      // Un seul motif par bien : le plus grave. Empiler les reproches sur une
      // carte de 56 px ne rend service à personne.
      const motif: Motif =
        p.status === 'draft' ? 'draft'
          : noPhoto ? 'noPhoto'
            : thin ? 'thinDescription'
              : !pushed ? 'notPushed'
                : 'published'

      return { p, motif, noPhoto, thin, pushed }
    })

    // Le bien DIFFUSÉ et complet n'appelle aucune action : il sort du fil.
    const order: Motif[] = ['draft', 'noPhoto', 'thinDescription', 'notPushed']
    return scored
      .filter((s) => s.motif !== 'published')
      .sort((a, z) => order.indexOf(a.motif) - order.indexOf(z.motif))
      .slice(0, MAX_ACTIONS)
      .map(({ p, motif }): ListingAction => ({
        id: p.id,
        propertyId: p.id,
        title: p.title?.trim() || p.address?.trim() || t('today.h.listings.untitled'),
        price: p.price != null ? formatCHF(p.price) : '',
        dot: MOTIF_DOT[motif],
        issue: t(`today.h.listings.issue.${motif}`),
        cta: t(`today.h.listings.cta.${motif}`),
        photo: p.photos?.[0],
      }))
  }, [rows, t])

  return { actions, total: rows.length, isLoading }
}
