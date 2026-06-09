// MEGGA X — conteneur de scope du design system.
// Tout composant MEGGA X doit vivre à l'intérieur de <MeggaX> : c'est lui qui
// porte la classe `.megga-x` (tokens + canvas sombre) et importe la feuille
// transcrite verbatim de la vitrine MEGGA. Cohabite avec Sugar sans le toucher.

import '@/styles/megga-x.css'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function MeggaX({ children, className }: Props) {
  return <div className={cn('megga-x', className)}>{children}</div>
}
