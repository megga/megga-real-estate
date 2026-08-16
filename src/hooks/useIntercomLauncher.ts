// src/hooks/useIntercomLauncher.ts
// Masque la bulle Intercom native dans les coquilles CRM, qui portent déjà leur
// propre entrée d'aide MEGGA X.
//
// POURQUOI : la bulle est le dernier élément non-MEGGA X du CRM, et elle fait
// doublon — l'aide est déjà dans la barre du haut (`CrmTopNav`, `openHelpFor`) et
// dans l'écran « Plus » du mobile. Elle se superpose en plus au panneau MEGGA AI,
// lui aussi ancré en bas à droite (`CopilotPanel`, bottom/right 16) mais avec un
// z-index de 70 contre ~2147483000 pour le lanceur : la bulle passe DEVANT.
//
// ⛔ Ne pas appeler depuis une surface sans entrée d'aide (pages publiques,
// onboarding, console admin) : le support n'y serait plus joignable du tout.
import { useEffect } from 'react'
import { setIntercomLauncherHidden } from '@/lib/intercom'

/**
 * Masque le lanceur natif tant que la coquille appelante est montée, et le
 * rétablit au démontage (retour vers une surface sans entrée d'aide MEGGA X).
 */
export function useHideIntercomLauncher(): void {
  useEffect(() => {
    setIntercomLauncherHidden(true)
    return () => setIntercomLauncherHidden(false)
  }, [])
}
