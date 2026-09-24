/**
 * « Qui pour ce bien ? » (lot C) — les anciens prospects d'un bien, notés À LA DEMANDE par `matching-engine` (mode
 * `prospects`, lecture seule), et le geste qui en réactive un (mode `reactiver-prospect`). Règles côté moteur :
 * `supabase/functions/_shared/matching-prospects.ts`.
 *
 * ⚠ La réponse de l'edge est relue champ par champ : un prospect mal formé est écarté, jamais affiché à moitié.
 * ⚠ Réactiver invalide TOUT le fil (`CLE_FIL`) — et les fiches, dont la clé vit sous ce préfixe (`useQuiPourCeBien`) :
 * le match né entre dans « À proposer », et la liste des prospects — sous la même clé — le perd. Un ÉCHEC relit la liste
 * seule : la ligne refusée était périmée (réactivée entre-temps, passée sous le seuil), elle doit disparaître au lieu
 * d'appeler un second refus.
 * ⚠ `CLE_FIL` vient du module pur du fil (`filModele`), pas de `useMatchingFil`, qui tire statiquement
 * `useAtelierMatching` : les deux fiches de bien montent ce hook (`QuiPourCeBien`) et n'ont pas à le charger.
 * ⛔ Rien n'est écrit à l'acheteur : la seule fonction appelée est `matching-engine` (`matching-sans-sortie.spec.ts`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CLE_FIL } from '@/components/matching-fil/filModele'

/** Un ancien prospect d'un bien, tel que le moteur le rend. */
export interface AncienProspect {
  contact_id: string
  prenom: string
  nom: string
  client_search_id: string
  score: number
  origine: 'recherche_close' | 'deal_perdu'
  /** La perte du deal, sinon la clôture de la recherche. */
  depuis: string | null
}

function lireProspects(data: unknown): AncienProspect[] {
  const brut = (data as { prospects?: unknown } | null)?.prospects
  if (!Array.isArray(brut)) return []
  return brut.flatMap((p): AncienProspect[] => {
    const x = (p ?? {}) as Record<string, unknown>
    if (typeof x.contact_id !== 'string' || typeof x.client_search_id !== 'string' || typeof x.score !== 'number') return []
    if (x.origine !== 'recherche_close' && x.origine !== 'deal_perdu') return []
    return [{
      contact_id: x.contact_id, client_search_id: x.client_search_id, score: x.score, origine: x.origine,
      prenom: typeof x.prenom === 'string' ? x.prenom : '', nom: typeof x.nom === 'string' ? x.nom : '',
      depuis: typeof x.depuis === 'string' ? x.depuis : null,
    }]
  })
}

/** Les anciens prospects d'un bien en mandat, et `reactiver`, le geste qui en fait entrer un dans « À proposer ». */
export function useAnciensProspects(propertyId: string | null) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const qc = useQueryClient()
  const cle = [CLE_FIL, 'prospects', agencyId, propertyId]
  const requete = useQuery({
    queryKey: cle,
    enabled: Boolean(agencyId && propertyId),
    // Noter à la demande relit toutes les recherches closes de l'agence : pas à chaque retour sur la ligne.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('matching-engine', { body: { mode: 'prospects', property_id: propertyId } })
      if (error) {
        // Un mandat qui n'est plus ACTIF (vendu, archivé) : le moteur ne le note pas, il n'a donc pas d'ancien
        // prospect (404) — ce n'est pas une panne à afficher.
        if ((error as { context?: { status?: number } }).context?.status === 404) return []
        throw error
      }
      return lireProspects(data)
    },
  })
  const reactiver = useMutation({
    mutationFn: async (p: AncienProspect) => {
      const { data, error } = await supabase.functions.invoke('matching-engine', {
        body: { mode: 'reactiver-prospect', property_id: propertyId, client_search_id: p.client_search_id, origine: p.origine },
      })
      if (error) throw error
      // Rien n'est réactivé sans `match_id` : l'edge le dit par un 409 (sous le seuil, déjà sur ce bien), le banc
      // par `{ error }` en 200. Jamais un « réactivé » sur la foi d'une réponse sans match.
      const r = (data ?? {}) as { match_id?: unknown; score?: unknown }
      if (typeof r.match_id !== 'string') throw new Error('reactiver-prospect : aucun match créé')
      return { match_id: r.match_id, score: typeof r.score === 'number' ? r.score : null }
    },
    // Le succès relit tout le fil, la liste des prospects comprise (même préfixe) : une seconde invalidation de
    // sa clé annulerait ce rechargement et rappellerait le moteur. L'échec la relit seule, sans faire attendre son
    // message : le geste n'a rien changé au reste du fil.
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLE_FIL] }),
    onError: () => { void qc.invalidateQueries({ queryKey: cle, exact: true }) },
  })
  return { ...requete, reactiver }
}
