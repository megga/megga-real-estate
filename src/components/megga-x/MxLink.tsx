// MEGGA X — Link. Transcription fidèle de la vitrine MEGGA : <a class="link-single">
// dans un .link-content-flex avec icônes optionnelles gauche/droite.
import { cn } from '@/lib/utils'

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** graisse medium (.medium de la source) */
  medium?: boolean
  /** couleur primaire (.text-color-primary-1) */
  primary?: boolean
  /** taille de texte display (1 ou 2 dans le style guide) */
  display?: 1 | 2
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

export default function MxLink({
  medium,
  primary,
  display = 1,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: Props) {
  return (
    <a
      className={cn(
        `display-${display}`,
        'link-single',
        'w-inline-block',
        medium && 'medium',
        primary && 'text-color-primary-1',
        className,
      )}
      {...rest}
    >
      <div className="link-content-flex">
        {iconLeft != null && <div className="link-item-icon-left">{iconLeft}</div>}
        <div>{children}</div>
        {iconRight != null && <div className="link-item-icon-right">{iconRight}</div>}
      </div>
    </a>
  )
}
