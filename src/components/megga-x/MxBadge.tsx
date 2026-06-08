// MEGGA X — Badge. Transcription fidèle de la classe la vitrine MEGGA `.badge`
// (+ `.link-badge` quand rendu comme lien). Aucun style nouveau.

import { cn } from '@/lib/utils'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  /** rendu comme lien (ajoute la classe `.link-badge` de la source) */
  asLink?: boolean
}

export default function MxBadge({ asLink, className, children, ...rest }: Props) {
  return (
    <div className={cn('badge', asLink && 'link-badge', className)} {...rest}>
      {children}
    </div>
  )
}
