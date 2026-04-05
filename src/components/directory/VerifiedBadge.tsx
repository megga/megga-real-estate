import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VerifiedBadgeProps {
  status: 'unclaimed' | 'claimed' | 'verified'
  compact?: boolean
}

export default function VerifiedBadge({ status, compact }: VerifiedBadgeProps) {
  const { t } = useTranslation('directory')

  if (status === 'verified') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 font-medium',
        compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1',
        'bg-accent/10 text-accent rounded-md'
      )}>
        <ShieldCheck className="h-3 w-3" />
        {!compact && t('badge.verified')}
      </span>
    )
  }

  if (status === 'unclaimed') {
    return (
      <span className="inline-flex items-center text-xs text-theme-muted px-2 py-1 bg-theme-hover rounded-md">
        {t('badge.unclaimed')}
      </span>
    )
  }

  return null
}
