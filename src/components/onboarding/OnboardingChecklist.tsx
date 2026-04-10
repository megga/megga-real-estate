import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress'

export default function OnboardingChecklist() {
  const { steps, completedCount, total, percentage, isComplete, isLoading, dismiss } = useOnboardingProgress()
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || dismissed) return null
  // Once all complete, still show for a moment with the success state
  // unless explicitly dismissed

  const handleDismiss = () => {
    dismiss()
    setDismissed(true)
  }

  return (
    <div className="rounded-xl border border-theme-border p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-theme-border" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray={`${percentage * 0.974} 100`}
                strokeLinecap="round"
                className="text-theme-primary transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-theme-primary">
              {percentage}%
            </span>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-theme-primary">
              {isComplete ? 'Vous maîtrisez MEGGA !' : 'Bien démarrer avec MEGGA'}
            </h3>
            <p className="text-xs text-theme-tertiary">
              {completedCount}/{total} étapes complétées
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isComplete && (
            <button
              onClick={handleDismiss}
              className="h-7 px-2.5 rounded-md text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Masquer
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-theme-tertiary hover:text-theme-primary transition-colors"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Steps list */}
      {!collapsed && (
        <div className="mt-4 space-y-2">
          {steps.map(step => (
            <Link
              key={step.key}
              to={step.completed ? '#' : step.link}
              className={cn(
                'flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors group',
                step.completed ? 'opacity-60' : 'hover:bg-theme-hover'
              )}
            >
              <div className={cn(
                'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                step.completed
                  ? 'bg-theme-primary border-theme-primary'
                  : 'border-theme-border group-hover:border-theme-active'
              )}>
                {step.completed && <Check className="h-3 w-3 text-theme-page" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', step.completed ? 'text-theme-secondary line-through' : 'text-theme-primary font-medium')}>
                  {step.label}
                </p>
                {!step.completed && (
                  <p className="text-xs text-theme-tertiary mt-0.5">{step.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
