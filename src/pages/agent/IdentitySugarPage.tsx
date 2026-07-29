/**
 * Route `/dashboard/identite` (desktop, via ResponsiveRoute dans App.tsx).
 * AgentSugarLayout redirige ici tant que useIdentityGate() renvoie 'required'.
 * Rend le wizard de saisie d'identite legale (5 etapes, IdentityShell) livre a
 * la tache 3 du plan etape 2 - coquille + etape 1 (signataire) ; les etapes 2 a
 * 5 arrivent aux taches 4 a 7. Page volontairement fine : tout le chrome
 * (navigation, persistance, sortie de secours) vit dans IdentityShell.
 */
import IdentityShell from '@/components/crm-sugar-identity/IdentityShell'

export default function IdentitySugarPage() {
  return <IdentityShell />
}
