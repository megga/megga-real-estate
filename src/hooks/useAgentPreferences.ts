// MEGGA — Hook React Query pour les préférences IA dérivées du Premier jour.
//
// Lit la fonction Postgres compute_agent_preferences(agent_id) qui décompose
// profiles.day0_payload en valeurs exploitables (SLA window, autonomy gate,
// priorité weights).
//
// Cache 5 minutes : ces préférences changent rarement (l'agent ajuste son
// autonomy ou son dispo via Settings, pas en cours de session). Le hook se
// rafraîchit automatiquement au focus de l'onglet et au reconnect réseau.
//
// Retourne `null` quand l'agent n'a pas encore joué le sas Premier jour ;
// les composants en aval doivent skip-er leurs effets IA dans ce cas.
//
// Voir supabase/migrations/20260522_002_ai_day0_orchestration.sql.

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { AgentPreferences } from '@/types/aiActions'

/**
 * Lit les préférences calibrées du Premier jour pour l'agent courant.
 * Source de vérité unique pour tout ce qui dépend du sas (SLA, autonomy,
 * priorité weights, liste des zones).
 *
 * Retourne `null` si l'agent n'a pas encore joué le sas.
 */
export function useAgentPreferences() {
  const { profile } = useAuth()
  const agentId = profile?.id ?? null

  return useQuery({
    queryKey: ['agent-preferences', agentId],
    enabled: !!agentId,
    staleTime: 5 * 60_000, // 5 min
    queryFn: async (): Promise<AgentPreferences | null> => {
      if (!agentId) return null

      const { data, error } = await supabase.rpc('compute_agent_preferences', {
        p_agent_id: agentId,
      })
      if (error) throw error

      // La fonction retourne NULL JSONB → ici on reçoit null direct.
      return (data ?? null) as AgentPreferences | null
    },
  })
}

/**
 * Helper synchrone : « est-ce que l'agent peut auto-envoyer ce type
 * d'action selon son autonomy actuel ? ».
 *
 * Utilisé côté UI pour afficher "Envoyer" vs "Valider et envoyer" sur les
 * boutons d'action (les Edge Functions appellent la fonction SQL
 * `can_auto_send` directement, pas via ce helper).
 *
 * Fail-safe : retourne `false` si les préférences ne sont pas encore
 * chargées (human-in-the-loop par défaut).
 */
export function canAutoSend(
  prefs: AgentPreferences | null | undefined,
  actionType: string,
): boolean {
  if (!prefs) return false
  return prefs.autonomy_gate[actionType] === true
}

/**
 * Helper synchrone : « est-on dans la fenêtre de disponibilité agent ? ».
 *
 * Réplique côté JS la logique SQL `is_within_sla_window` pour éviter un
 * round-trip serveur sur chaque rendu. Utilise l'heure locale du
 * navigateur ; pour les agents non-CH, à terme on devra lire un fuseau
 * stocké côté serveur.
 */
export function isWithinSlaWindow(
  prefs: AgentPreferences | null | undefined,
  at: Date = new Date(),
): boolean {
  if (!prefs?.sla) return false
  const dow = ((at.getDay() + 6) % 7) + 1 // JS dim=0 → ISO 7, lun=1 → ISO 1
  const hour = at.getHours()
  if (!prefs.sla.days_of_week.includes(dow)) return false
  return hour >= prefs.sla.hours_start && hour < prefs.sla.hours_end
}
