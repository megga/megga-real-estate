// MEGGA X — Button. Transcription fidèle des classes la vitrine MEGGA
// `.primary-button` / `.secondary-button` (+ variante `.small`). Aucun style
// nouveau : seul le markup/les classes de la source sont reproduits.

import { cn } from '@/lib/utils'

type MxButtonVariant = 'primary' | 'secondary'
type MxButtonSize = 'default' | 'small'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MxButtonVariant
  size?: MxButtonSize
}

export default function MxButton({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...rest
}: Props) {
  const base = variant === 'secondary' ? 'secondary-button' : 'primary-button'
  return (
    <button className={cn(base, size === 'small' && 'small', className)} {...rest}>
      {children}
    </button>
  )
}
