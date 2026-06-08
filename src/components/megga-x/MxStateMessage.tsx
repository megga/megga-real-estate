// MEGGA X — State message. Transcription fidèle : message de succès / d'erreur
// Webflow (.success-message.w-form-done / .error-message.w-form-fail).
import { cn } from '@/lib/utils'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error'
}

export default function MxStateMessage({ variant = 'success', className, children, ...rest }: Props) {
  const cls = variant === 'error' ? 'error-message w-form-fail' : 'success-message w-form-done'
  return (
    <div className={cn(cls, className)} {...rest}>
      <div>{children}</div>
    </div>
  )
}
