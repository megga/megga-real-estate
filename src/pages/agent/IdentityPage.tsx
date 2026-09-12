/**
 * Route `/dashboard/identite` (desktop, via ResponsiveRoute dans App.tsx).
 * AgentLayout redirige ici tant que useIdentityGate() renvoie 'required'.
 * Rend le wizard de saisie d'identite legale (5 etapes, IdentityShell) livre a
 * la tache 3 du plan etape 2 - coquille + etape 1 (signataire) ; les etapes 2 a
 * 5 arrivent aux taches 4 a 7. Page volontairement fine : tout le chrome
 * (navigation, persistance, sortie de secours) vit dans IdentityShell.
 */
import IdentityShell from '@/components/crm-identity/IdentityShell'
import { DOCK_PUSH_STYLE } from '@/components/ai-copilot/panel/aiPanel'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { usePorteSaPoussee } from '@/hooks/usePousseeDock'

export default function IdentityPage() {
  // ⚠ Le dock MEGGA AI reste ouvrable ici (⌘K), et le parcours n'a pas de plan de
  // travail pour prendre sa poussée. C'est donc cette enveloppe qui la prend, peinte
  // au canvas de la peau vitrine (`.megga-x`, une seule polarité) : laissée à
  // l'écran, la gouttière serait peinte au `pageBg` du CRM — une plaque claire à
  // côté d'un parcours noir, en mode clair (`usePousseeDock`).
  usePorteSaPoussee()
  return (
    <div style={{ background: MXC_COLOR.n100, ...DOCK_PUSH_STYLE }}>
      <IdentityShell />
    </div>
  )
}
