// MEGGA X — conteneur de scope du design system.
// Tout composant MEGGA X doit vivre à l'intérieur de <MeggaX> : c'est lui qui
// porte la classe `.megga-x` (tokens + canvas sombre) et importe la feuille
// transcrite verbatim de la vitrine MEGGA. Cohabite avec Sugar sans le toucher.

import '@/styles/megga-x.css'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
  /**
   * Thème de la vitrine. `'dark'` est son état NATIF — la feuille déclare ses
   * neutres pour un canvas sombre, et les 18 surfaces qui montent `<MeggaX>`
   * l'attendent. `'light'` stamp `data-mx-theme` et fait basculer les dix
   * variables (bloc de `megga-x-additions.css`).
   *
   * ⚠ Par défaut on ne stamp RIEN : ajouter le thème ne devait changer aucune
   * des surfaces existantes, seulement en ouvrir une nouvelle à l'onboarding.
   */
  theme?: 'dark' | 'light'
}

export default function MeggaX({ children, className, theme }: Props) {
  return (
    <div className={cn('megga-x', className)} data-mx-theme={theme}>
      {children}
    </div>
  )
}
