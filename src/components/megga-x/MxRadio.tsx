// MEGGA X — Radio. Transcription fidèle du custom radio Webflow la vitrine MEGGA :
// <div class="w-form-formradioinput w-form-formradioinput--inputType-custom
// radio-button w-radio-input"> + `.w--redirected-checked` à l'état sélectionné.
import { cn } from '@/lib/utils'

interface Props {
  label?: React.ReactNode
  checked?: boolean
  value: string
  name: string
  onSelect?: (value: string) => void
  small?: boolean
  disabled?: boolean
  className?: string
}

export default function MxRadio({
  label,
  checked,
  value,
  name,
  onSelect,
  small,
  disabled,
  className,
}: Props) {
  return (
    <label className={cn('w-radio radio-button-field', className)}>
      <div
        className={cn(
          'w-form-formradioinput w-form-formradioinput--inputType-custom radio-button w-radio-input',
          small && 'small',
          checked && 'w--redirected-checked',
        )}
      />
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect?.(value)}
        style={{ opacity: 0, position: 'absolute', zIndex: -1 }}
      />
      {label != null && <span className="w-form-label">{label}</span>}
    </label>
  )
}
