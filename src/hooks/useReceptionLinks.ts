/**
 * Liens de réception d'un contact (`buyer_reception_links`) : liste + retrait.
 *
 * Un lien de réception est une CAPABILITY : son jeton HMAC circule par WhatsApp,
 * vit jusqu'à 90 jours et ouvre, sans compte, la sélection de biens transmise +
 * le prénom du contact + les coordonnées de l'agent. Il n'existait aucune surface
 * pour le voir ni le retirer ; ce hook alimente celle de la fiche contact.
 *
 * ⚠ La colonne `token` n'est JAMAIS sélectionnée ici. Elle n'a rien à faire dans le
 * bundle navigateur ni dans le cache React Query : la lire pour l'afficher, c'est
 * recopier la capability partout où le cache est inspectable.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Statuts admis par le CHECK de `buyer_reception_links`. */
export type ReceptionLinkStatus = 'pending' | 'viewed' | 'reacted' | 'expired' | 'revoked'

export interface ReceptionLink {
  id: string
  /** `null` si la base porte un statut que ce code ne connaît pas (CHECK élargi
   *  sans passer par ici) — l'UI le dit alors au lieu de l'étiqueter au hasard. */
  status: ReceptionLinkStatus | null
  channel: 'whatsapp' | 'link' | null
  createdAt: string
  expiresAt: string
  viewedAt: string | null
  reactedAt: string | null
  revokedAt: string | null
  /** Nombre de biens que ce lien ouvre. */
  count: number
  /**
   * Le lien ouvre ENCORE la sélection : ni retiré, ni expiré (statut comme
   * échéance). Un lien `reacted` reste actif — l'acheteur peut y revenir tant
   * qu'il n'a pas expiré ; c'est précisément ce qui rend le retrait nécessaire.
   *
   * ⚠ Calculé à l'instant du fetch : un lien qui échoit entre la lecture et le clic
   * paraîtra encore actif. Sans conséquence — la RPC retire volontiers un lien déjà
   * échu (elle ne refuse qu'un lien DÉJÀ retiré, ou hors agence).
   */
  active: boolean
}

/** Prédicat plutôt que cast : un statut inconnu doit se voir, pas se faire absorber. */
function isStatus(v: string): v is ReceptionLinkStatus {
  return v === 'pending' || v === 'viewed' || v === 'reacted' || v === 'expired' || v === 'revoked'
}

const isChannel = (v: string | null): v is 'whatsapp' | 'link' => v === 'whatsapp' || v === 'link'

/** Clé de liste, partagée par la lecture et l'invalidation post-retrait. */
const listKey = (contactId: string | undefined) => ['reception-links', contactId] as const

/**
 * Liens de réception émis pour un contact, du plus récent au plus ancien.
 * Lecture autorisée par la policy `brl_agent_read` (SELECT, scopée agence).
 */
export function useReceptionLinks(contactId: string | undefined) {
  return useQuery({
    queryKey: listKey(contactId),
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<ReceptionLink[]> => {
      if (!contactId) return []
      const { data, error } = await supabase
        .from('buyer_reception_links')
        // Surtout PAS `token` : cf. l'en-tête de fichier.
        .select('id, status, channel, created_at, expires_at, viewed_at, reacted_at, revoked_at, match_ids')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const now = Date.now()
      return (data ?? []).map((row): ReceptionLink => {
        const status = isStatus(row.status) ? row.status : null
        const expiresAt = row.expires_at
        return {
          id: row.id,
          status,
          channel: isChannel(row.channel) ? row.channel : null,
          createdAt: row.created_at,
          expiresAt,
          viewedAt: row.viewed_at,
          reactedAt: row.reacted_at,
          revokedAt: row.revoked_at,
          count: row.match_ids.length,
          active:
            (status === 'pending' || status === 'viewed' || status === 'reacted') &&
            new Date(expiresAt).getTime() > now,
        }
      })
    },
  })
}

/**
 * Message porté par un refus métier de la RPC de retrait. Distinct d'une panne :
 * le lien a été compris, il n'ouvrait simplement plus rien à retirer.
 */
export const RECEPTION_LINK_REFUSED = 'reception_link_refused'

/** `true` si l'échec est un REFUS de la RPC, pas une panne réseau ou serveur. */
export const estRefusDeRetrait = (e: unknown): boolean =>
  e instanceof Error && e.message === RECEPTION_LINK_REFUSED

/**
 * Retrait d'un lien de réception (RPC `revoke_reception_link`).
 *
 * ⚠ La RPC rend `false` sur un refus métier (lien déjà retiré, introuvable, hors
 * agence), PAS une erreur PostgREST : `error` est alors `null`. Sans la levée sur
 * `data !== true`, la mutation « réussirait », l'écran afficherait un retrait qui
 * n'a rien écrit, et l'agent croirait avoir coupé un accès toujours ouvert. Même
 * défaut, même correctif que `gesteParJeton` dans `useVisits.ts`.
 */
export function useRevokeReceptionLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ linkId }: { linkId: string; contactId: string }): Promise<void> => {
      const { data, error } = await supabase.rpc('revoke_reception_link', { p_link_id: linkId })
      if (error) throw new Error(error.message)
      if (data !== true) throw new Error(RECEPTION_LINK_REFUSED)
    },
    // `onSettled` et non `onSuccess` : un REFUS signifie précisément que notre liste
    // est périmée (le lien a été retiré ou a échu ailleurs) — c'est le cas où re-lire
    // sert le plus. Sur une panne, le refetch est au pire inutile.
    onSettled: (_result, _error, { contactId }) => {
      void qc.invalidateQueries({ queryKey: listKey(contactId) })
    },
  })
}
