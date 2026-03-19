import type { FieldErrors, UseFormRegister } from 'react-hook-form'

interface FieldProps {
  label: string
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>
  type?: string
  placeholder?: string
  required?: boolean
  className?: string
}

export function TextField({ label, id, register, errors, type = 'text', placeholder, required, className }: FieldProps) {
  const error = errors[id]
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-primary-700 mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        {...register(id)}
        className="w-full h-11 px-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
      />
      {error && <p className="text-xs text-danger mt-1">{error.message as string}</p>}
    </div>
  )
}

interface SelectFieldProps extends Omit<FieldProps, 'type' | 'placeholder'> {
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectField({ label, id, register, errors, options, placeholder, required, className }: SelectFieldProps) {
  const error = errors[id]
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-primary-700 mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <select
        id={id}
        {...register(id)}
        className="w-full h-11 px-4 text-sm bg-input border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
      >
        <option value="">{placeholder || 'Sélectionnez...'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-danger mt-1">{error.message as string}</p>}
    </div>
  )
}
