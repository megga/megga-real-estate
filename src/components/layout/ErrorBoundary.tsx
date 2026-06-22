import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw, LayoutDashboard } from 'lucide-react'
import { Sentry } from '@/lib/sentry'
import i18n from '@/i18n'

/**
 * ErrorBoundary — filet de sécurité global.
 * ────────────────────────────────────────────────────────────────────
 * Capture les erreurs de RENDU (throw pendant render / lifecycle d'un
 * descendant) qui sinon laisseraient un écran blanc. NE capture PAS les
 * rejets de fetch React Query (gérés localement, throwOnError non activé)
 * ni les erreurs async hors React (voir StaleBundleDetector pour les
 * échecs de chargement de chunk lazy).
 *
 * Notifie Sentry via captureException, puis affiche un fallback sobre au
 * thème CRM dark avec deux issues : recharger la page, ou revenir au
 * dashboard. Class component obligatoire : seuls componentDidCatch /
 * getDerivedStateFromError captent les erreurs de rendu (pas de hook
 * équivalent).
 *
 * Enrouler une fois, au-dessus de <Routes>, dans App.tsx.
 */

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-theme-page px-6 text-center">
        <div className="w-full max-w-md rounded-xl border border-theme-border bg-theme-card p-8">
          <h1 className="text-lg font-semibold text-theme-primary">
            {i18n.t('errorBoundary.title')}
          </h1>
          <p className="mt-2 text-sm text-theme-secondary">
            {i18n.t('errorBoundary.body')}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary transition-colors hover:bg-theme-hover"
            >
              <RefreshCw className="h-4 w-4" />
              {i18n.t('errorBoundary.reload')}
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary transition-colors hover:bg-theme-hover"
            >
              <LayoutDashboard className="h-4 w-4" />
              {i18n.t('errorBoundary.dashboard')}
            </a>
          </div>
        </div>
      </div>
    )
  }
}
