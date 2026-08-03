/**
 * Geste ops « Relancer un cron » (étape 28) — RPC `admin_cron_run_now`.
 *
 * Le backend existe depuis #1064 et n'avait AUCUN consommateur : ce hook est le premier,
 * et donc le premier à exercer le chemin nominal du geste.
 *
 * Deux points de contrat qui ne se devinent pas en lisant la signature :
 *
 * 1. La CLÉ D'IDEMPOTENCE est fournie par l'appelant, et la confirmation REJOUE la même.
 *    Tous les contrôles de la RPC précèdent la réservation de la clé (correctif du Lot 1 :
 *    un refus métier COMMITTE, donc une clé réservée trop tôt serait brûlée par un simple
 *    « confirmez »). Rejouer la même clé rend donc l'aller-retour « demande → confirmation »
 *    UN seul geste, et protège du double-clic sur le bouton de confirmation ; en tirer une
 *    neuve programmerait deux passages.
 * 2. Le serveur peut répondre « confirmez » (`details.needs_confirm`) : ce n'est pas une
 *    erreur, c'est la deuxième moitié du geste. `readCronRunNow` fait ce tri.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readCronRunNow, type CronRunNowOutcome } from '@/lib/cronRunNow'

export interface CronRunNowInput {
  jobname: string
  /** Clé du GESTE, pas de l'appel : la confirmation rejoue la même (voir en-tête). */
  idempotencyKey: string
  confirm: boolean
}

/** Mutation du geste. Rend l'issue au lieu de la lever, `needs_confirm` compris. */
export function useAdminCronRunNow() {
  const queryClient = useQueryClient()

  return useMutation<CronRunNowOutcome, Error, CronRunNowInput>({
    mutationFn: async ({ jobname, idempotencyKey, confirm }) => {
      const { data, error } = await supabase.rpc('admin_cron_run_now', {
        p_jobname: jobname,
        p_idempotency_key: idempotencyKey,
        p_confirm: confirm,
      })
      // Un refus MÉTIER arrive dans `data` (enveloppe §10.1) ; `error` ne porte que les
      // échecs de transport et le 42501 de la garde super-admin.
      if (error) throw new Error(error.message)
      return readCronRunNow(data)
    },
    onSuccess: (outcome) => {
      // La relance crée un job ponctuel `adhoc-…` que `get_cron_health` liste : la table
      // doit le montrer, sinon l'écran affirme une chose que rien ne corrobore.
      if (outcome.kind === 'requested') {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'cron-health'] })
      }
    },
  })
}
