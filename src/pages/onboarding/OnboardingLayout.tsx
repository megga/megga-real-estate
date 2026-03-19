import { Link } from 'react-router-dom'
import { Check, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

export interface OnboardingStep {
  id: number
  label: string
  icon: LucideIcon
}

interface OnboardingLayoutProps {
  title: string
  subtitle: string
  steps: OnboardingStep[]
  currentStep: number
  isComplete: boolean
  children: React.ReactNode
  onPrev?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  isSubmitting?: boolean
  submitError?: string | null
}

export default function OnboardingLayout({
  title,
  subtitle,
  steps,
  currentStep,
  isComplete,
  children,
  onPrev,
  onNext,
  nextLabel = 'Continuer',
  nextDisabled = false,
  isSubmitting = false,
  submitError = null,
}: OnboardingLayoutProps) {
  if (isComplete) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
        <Link to="/" className="block text-center mb-10">
          <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
        </Link>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-6">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-semibold text-primary-900 mb-3">
            Merci, votre dossier a été transmis !
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Votre agent immobilier a bien reçu vos informations et reviendra vers vous dans les plus brefs délais.
          </p>
          <Link to="/">
            <Button className="rounded-button">
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-4 py-8">
      {/* Logo */}
      <Link to="/" className="block text-center mb-8">
        <span className="text-3xl font-bold tracking-tight text-primary-900">MEGGA</span>
      </Link>

      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-primary-900">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map((step, i) => {
            const isActive = step.id === currentStep
            const isDone = step.id < currentStep
            const Icon = step.icon

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all',
                      isDone && 'bg-success border-success',
                      isActive && 'bg-accent border-accent',
                      !isDone && !isActive && 'bg-white border-border',
                    )}
                  >
                    {isDone ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Icon className={cn('h-5 w-5', isActive ? 'text-white' : 'text-primary-400')} />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs mt-1.5 font-medium whitespace-nowrap',
                    isActive ? 'text-accent' : isDone ? 'text-success' : 'text-muted-foreground',
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    'w-12 sm:w-16 h-0.5 mx-1 mt-[-18px]',
                    step.id < currentStep ? 'bg-success' : 'bg-border',
                  )} />
                )}
              </div>
            )
          })}
        </div>

        {/* Form content */}
        <div className="bg-white rounded-card border border-border p-6 sm:p-8">
          {children}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          {onPrev ? (
            <Button variant="outline" onClick={onPrev} className="rounded-button">
              Précédent
            </Button>
          ) : (
            <div />
          )}
          {onNext && (
            <Button onClick={onNext} className="rounded-button" disabled={nextDisabled || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                nextLabel
              )}
            </Button>
          )}
        </div>

        {submitError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}
      </div>
    </div>
  )
}
