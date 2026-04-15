import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { RegieContact } from '@/lib/utils'

interface RegieContactCardProps {
  regie: RegieContact
  className?: string
}

export default function RegieContactCard({ regie, className }: RegieContactCardProps) {
  const { t } = useTranslation('common')

  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <p className="text-xs font-medium text-theme-tertiary capitalize mb-3">
        {t('rental.regieContact', 'Contacter la régie')}
      </p>
      <p className="text-base font-semibold text-theme-primary">{regie.name}</p>
      <div className="mt-3 space-y-1.5 text-sm text-theme-secondary">
        {regie.phone && (
          <a href={`tel:${regie.phone}`} className="block hover:text-theme-primary">
            {regie.phone}
          </a>
        )}
        {regie.email && (
          <a href={`mailto:${regie.email}`} className="block hover:text-theme-primary">
            {regie.email}
          </a>
        )}
        {regie.website && (
          <a
            href={regie.website}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:text-theme-primary"
          >
            {regie.website.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>
      <div className="flex gap-2 mt-4">
        {regie.phone && (
          <a
            href={`tel:${regie.phone}`}
            className="flex-1 h-10 rounded-lg border border-theme-border text-sm text-center leading-10 text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            {t('rental.regieCtaCall', 'Appeler')}
          </a>
        )}
        {regie.email && (
          <a
            href={`mailto:${regie.email}`}
            className="flex-1 h-10 rounded-lg border border-theme-border text-sm text-center leading-10 text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
          >
            {t('rental.regieCtaEmail', 'Écrire')}
          </a>
        )}
      </div>
    </div>
  )
}
