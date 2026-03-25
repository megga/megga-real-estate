import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface UpgradePromptProps {
  title?: string
  description?: string
  requiredPlan?: 'pro' | 'entreprise'
  className?: string
}

export default function UpgradePrompt({
  title = 'Fonctionnalité disponible avec le plan Pro',
  description = 'Passez à un plan supérieur pour débloquer cette fonctionnalité.',
  requiredPlan = 'pro',
  className,
}: UpgradePromptProps) {
  const navigate = useNavigate()

  const planLabel = requiredPlan === 'entreprise' ? 'Entreprise' : 'Pro'

  return (
    <div className={cn(
      'rounded-xl border border-accent/20 bg-accent/5 p-6',
      className,
    )}>
      <h3 className="text-sm font-semibold text-theme-primary">
        {title || `Fonctionnalité disponible avec le plan ${planLabel}`}
      </h3>
      <p className="text-sm text-theme-secondary mt-1">
        {description}
      </p>
      <button
        onClick={() => navigate('/dashboard/settings?tab=abonnement')}
        className="mt-4 h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
      >
        Découvrir les plans
      </button>
    </div>
  )
}
