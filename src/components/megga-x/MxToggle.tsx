// MEGGA X — Toggle. Transcription fidèle : <div class="toggle"><div class="toggle-circle"/></div>.
// NB la vitrine MEGGA : l'état on/off est une INTERACTION Webflow (data-w-id), pas une
// classe CSS — la source ne définit que l'apparence (.toggle a justify-content:
// flex-end, cercle à droite). Pour rester utilisable sans inventer de design, on
// bascule justify-content (flex-end = on / flex-start = off) via l'état React ;
// aucune autre valeur n'est changée.
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  on?: boolean
  defaultOn?: boolean
  onToggle?: (on: boolean) => void
  small?: boolean
  className?: string
}

export default function MxToggle({ on, defaultOn, onToggle, small, className }: Props) {
  const [internal, setInternal] = useState(defaultOn ?? true)
  const isControlled = on !== undefined
  const value = isControlled ? on : internal

  return (
    <div
      role="switch"
      aria-checked={value}
      className={cn('toggle', small && 'small', className)}
      style={{ justifyContent: value ? 'flex-end' : 'flex-start' }}
      onClick={() => {
        if (!isControlled) setInternal((v) => !v)
        onToggle?.(!value)
      }}
    >
      <div className={cn('toggle-circle', small && 'small')} />
    </div>
  )
}
