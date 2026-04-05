import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface ClaimProfileCTAProps {
  name: string
  status: 'unclaimed' | 'claimed' | 'verified'
}

export default function ClaimProfileCTA({ name, status }: ClaimProfileCTAProps) {
  const { t } = useTranslation('directory')

  if (status === 'verified') return null

  if (status === 'unclaimed') {
    return (
      <div className="rounded-xl border border-dashed border-theme-border p-5 text-center">
        <p className="text-sm font-medium text-theme-primary mb-1">
          {t('claim.title', { name })}
        </p>
        <p className="text-xs text-theme-secondary mb-4">
          {t('claim.subtitle')}
        </p>
        <Link
          to="/register"
          className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
        >
          {t('claim.button')}
        </Link>
      </div>
    )
  }

  // claimed but not verified — upsell to CRM
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
      <p className="text-sm font-medium text-theme-primary mb-1">
        {t('claim.upgradeCTA')}
      </p>
      <Link
        to="/register"
        className="inline-flex h-9 px-4 mt-3 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
      >
        {t('claim.upgradeButton')}
      </Link>
    </div>
  )
}
