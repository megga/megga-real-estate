/**
 * Repli EFFECTIF de la barre latérale du CRM — ce que la barre REND, pas ce que
 * l'agent a réglé.
 *
 * Le réglage (`useCrmSidebarCollapsed`) est forcé dans deux cas :
 *   • le téléphone — sous 768 px la barre est TOUJOURS repliée : trois routes du
 *     CRM (`/dashboard/audit`, `market/:externalId`, `listings/:id/edit`) n'ont
 *     pas de variante mobile et rendent la coquille telle quelle, où 264 px
 *     prendraient 70 % de la largeur ;
 *   • le dock MEGGA AI ouvert sous 1440 px — il comprime le contenu de 404 px
 *     (`COPILOT_WIDTH`), qui S'AJOUTENT aux 276 de la barre. Mesuré à 1280 px :
 *     il restait 600 px de travail, moins que l'aside des Réglages plus sa
 *     colonne. Le réglage n'est pas touché ; la barre le retrouve en fermant le
 *     dock.
 *
 * ⚠ Une seule expression pour la barre ET pour son squelette de chargement.
 * Recopiée, elle avait divergé : le squelette ignorait le dock et dessinait
 * 264 px là où la barre en rendait 84 — un saut à chaque chargement, exactement
 * ce que le squelette existe pour empêcher.
 */
import { useCrmSidebarCollapsed } from '@/lib/crmSidebar'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { useAiPanel } from '@/hooks/useAiPanel'

/**
 * `replie` : ce que la barre rend. `force` : vrai quand le réglage est ignoré —
 * la pastille de repli disparaît alors, un bouton qui ne peut rien changer ne se
 * montre pas. `regle` / `setRegle` : le réglage persistant de l'agent.
 */
export function useCrmSidebarRepli(): {
  replie: boolean
  force: boolean
  regle: boolean
  setRegle: (v: boolean) => void
} {
  const [regle, setRegle] = useCrmSidebarCollapsed()
  const isMobile = useIsMobile()
  const ai = useAiPanel()
  const serre = useMediaQuery('(max-width: 1439px)')
  const force = isMobile || (ai.enabled && ai.isOpen && serre)
  return { replie: force || regle, force, regle, setRegle }
}
