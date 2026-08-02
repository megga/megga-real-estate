// MEGGA X — State message. Transcription fidèle des messages de la vitrine :
// `.error-message` (pilule rouge) et `.success-message` (conteneur centré).
//
// Les marqueurs Webflow `w-form-fail` / `w-form-done` sont volontairement omis :
// la vitrine les tient en `display: none` et ne les révèle qu'en JS, à l'issue
// d'un envoi de formulaire. Ici le rendu est déjà conditionnel côté React — les
// porter rendrait le message invisible dans les deux variantes.
import { cn } from '@/lib/utils'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error'
}

export default function MxStateMessage({ variant = 'success', className, children, ...rest }: Props) {
  const cls = variant === 'error' ? 'error-message' : 'success-message'
  return (
    <div className={cn(cls, className)} {...rest}>
      <div>{children}</div>
    </div>
  )
}
