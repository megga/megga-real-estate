// MEGGA X — Select. Transcription fidèle : <div class="input select-input-wrapper">
// <select class="input select-input w-select">…</select></div>.
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[]
  wrapperClassName?: string
}

export default function MxSelect({ options, className, wrapperClassName, ...rest }: Props) {
  return (
    <div className={cn('input select-input-wrapper', wrapperClassName)}>
      <select className={cn('input select-input w-select', className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
