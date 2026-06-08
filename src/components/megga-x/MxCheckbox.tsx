// MEGGA X — Checkbox. Transcription fidèle du custom checkbox Webflow la vitrine MEGGA.
// La case visuelle = <div class="w-checkbox-input w-checkbox-input--inputType-custom
// checkbox">, à laquelle on ajoute `.w--redirected-checked` quand cochée (la classe
// d'état définie dans la feuille source). L'input réel est masqué (opacity:0).
import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label?: React.ReactNode
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  small?: boolean
  disabled?: boolean
  name?: string
  className?: string
}

export default function MxCheckbox({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  small,
  disabled,
  name,
  className,
}: Props) {
  const id = useId()
  const [internal, setInternal] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internal

  return (
    <label className={cn('w-checkbox checkbox-field', className)}>
      <div
        className={cn(
          'w-checkbox-input w-checkbox-input--inputType-custom checkbox',
          small && 'small',
          value && 'w--redirected-checked',
        )}
      />
      <input
        type="checkbox"
        id={id}
        name={name}
        checked={value}
        disabled={disabled}
        onChange={(e) => {
          if (!isControlled) setInternal(e.target.checked)
          onCheckedChange?.(e.target.checked)
        }}
        style={{ opacity: 0, position: 'absolute', zIndex: -1 }}
      />
      {label != null && <span className="w-form-label">{label}</span>}
    </label>
  )
}
