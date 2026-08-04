/**
 * Le motif de la correction demandée sur le dossier KYB de MON agence — côté client.
 *
 * POURQUOI CE HOOK EXISTE. `admin_request_agency_correction` (20260731150000) rend le
 * motif OBLIGATOIRE (`a correction request must say what to correct`) précisément pour
 * qu'il soit actionnable, et le range dans `activity_events.metadata->>'reason'`. Mais il
 * ne sortait de la base que par un e-mail (agency-verification-notify) : dans l'app, le
 * bandeau et l'écran bloqué disaient « une correction vous a été demandée par e-mail »,
 * et le wizard — où la RPC renvoie pourtant le dirigeant en remettant
 * `identity_submitted_at` à NULL — ne disait rien du tout. Un e-mail qu'on ne retrouve
 * pas, et le dossier repart à l'identique.
 *
 * AUCUNE NOUVELLE PERMISSION. La policy `events_select` du socle ouvre déjà
 * `activity_events` en lecture à l'agence propriétaire (`agency_id =
 * get_my_agency_id()`), et la RPC écrit l'événement sous `agency_id = p_agency_id` :
 * lire son propre motif ne demande donc ni RPC ni migration. Le hook ne lit QUE cette
 * action-là et QUE `metadata`, jamais le journal entier.
 *
 * NE DÉCIDE RIEN. Il ne dit pas si l'agence est bloquée — c'est le rôle de useLabGuard,
 * qui tranche sur `verification_status`. Il n'apporte qu'un TEXTE, que ses appelants
 * n'affichent que dans la branche `blocked_correction_requested`. Un motif périmé (une
 * correction déjà corrigée et resoumise) ne peut donc pas réapparaître tout seul : sans
 * le statut, personne ne le montre.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/** L'action journalisée par admin_request_agency_correction — miroir de la RPC. */
export const CORRECTION_REQUESTED_ACTION = 'agency_verification_correction_requested'

/**
 * Le motif porté par la ligne de journal, ou null.
 *
 * Défensif à dessein : `metadata` est un `jsonb` libre, et un motif vide ou d'un autre
 * type ne doit pas produire un encart qui s'ouvre sur du blanc — mieux vaut retomber sur
 * la phrase générique de l'appelant, qui reste vraie. Pure et testée directement
 * (tests/unit/agency-correction-reason.spec.ts).
 */
export function readCorrectionReason(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== 'object') return null
  const reason = (metadata as { reason?: unknown }).reason
  if (typeof reason !== 'string') return null
  const trimmed = reason.trim()
  return trimmed.length > 0 ? trimmed : null
}

export interface AgencyCorrectionReason {
  /** Le motif écrit par le relecteur, ou null (aucune demande, ou motif illisible). */
  reason: string | null
  /** Horodatage de la demande — permet de dire QUAND elle a été faite. */
  requestedAt: string | null
}

const EMPTY: AgencyCorrectionReason = { reason: null, requestedAt: null }

/**
 * La DERNIÈRE demande de correction adressée à mon agence.
 *
 * La plus récente et non la seule : un dossier peut être renvoyé plusieurs fois, et
 * afficher une demande d'il y a trois semaines à la place de celle d'hier serait pire
 * que de ne rien afficher.
 */
export function useAgencyCorrectionReason(): AgencyCorrectionReason {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null

  const { data } = useQuery({
    queryKey: ['agency-correction-reason', agencyId],
    queryFn: async (): Promise<AgencyCorrectionReason> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('metadata, created_at')
        .eq('agency_id', agencyId as string)
        .eq('action', CORRECTION_REQUESTED_ACTION)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return EMPTY
      return { reason: readCorrectionReason(data.metadata), requestedAt: data.created_at }
    },
    enabled: !!agencyId,
    // Un motif ne change qu'à une décision humaine : le relire souvent n'apprendrait
    // rien. Même ordre de grandeur que la lecture de statut de useLabGuard, qui commande
    // l'affichage de ce texte.
    staleTime: 60_000,
  })

  return data ?? EMPTY
}
