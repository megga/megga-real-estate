import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RefreshCw, LayoutDashboard } from 'lucide-react'
import { Sentry } from '@/lib/sentry'
import i18n from '@/i18n'
import {
  isStaleChunkError, extractChunkUrl, purgeChunkCache,
  shouldAttemptChunkRecovery, markChunkRecoveryAttempted, cacheBustedReloadUrl,
} from '@/lib/staleChunkRecovery'

/**
 * ErrorBoundary — filet de sécurité global.
 * ────────────────────────────────────────────────────────────────────
 * Capture les erreurs de RENDU (throw pendant render / lifecycle d'un
 * descendant) qui sinon laisseraient un écran blanc. NE capture PAS les
 * rejets de fetch React Query (gérés localement, throwOnError non activé)
 * ni les erreurs async hors React (StaleBundleDetector couvre celles-là).
 *
 * ⚠ Les échecs de chunk des ROUTES lazy arrivent ICI, pas dans
 * StaleBundleDetector : React relance le rejet à travers Suspense pendant le
 * rendu, donc il ne devient jamais un rejet non géré. Sans traitement dédié,
 * un déploiement en cours de bascule (ou un chunk empoisonné dans le cache
 * navigateur — incident du 03.08.2026, cf. src/lib/staleChunkRecovery.ts)
 * affichait le cul-de-sac « Une erreur est survenue » dont même Recharger ne
 * sortait pas. Sur ce motif d'erreur, on tente UNE récupération automatique :
 * purge ciblée du cache des chunks (fetch cache:'reload') puis rechargement
 * cache-busté ; en cas d'échec (drapeau de session déjà posé), le fallback
 * habituel reprend la main.
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
  /** Récupération de chunk en cours : écran neutre, jamais le fallback d'erreur. */
  recovering: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, recovering: false }

  static getDerivedStateFromError(error: unknown): State {
    // Lecture seule du drapeau de session ici (phase de rendu) : la POSE du
    // drapeau attend componentDidCatch, la phase de commit.
    return { hasError: true, recovering: isStaleChunkError(error) && shouldAttemptChunkRecovery() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    })
    if (this.state.recovering) void this.recoverFromStaleChunk(error)
  }

  /**
   * Purge le chunk fautif et ses dépendances du cache HTTP puis recharge. La
   * purge est un mieux, jamais une condition : sans URL dans le message
   * (Safari) ou sur un échec réseau, le rechargement cache-busté part quand
   * même — il suffit au cas « bundle périmé », le plus fréquent.
   */
  private recoverFromStaleChunk = async (error: unknown) => {
    markChunkRecoveryAttempted()
    try {
      const chunkUrl = extractChunkUrl(error)
      if (chunkUrl) await purgeChunkCache(chunkUrl)
    } catch {
      /* noop — le rechargement reste la sortie */
    }
    window.location.replace(cacheBustedReloadUrl(window.location.href, Date.now()))
  }

  private handleReload = () => {
    // Cache-busté aussi ici : après un échec de récupération automatique, un
    // reload() nu relirait l'entrée de cache encore « fraîche » qui a causé
    // l'erreur (max-age=14400 sur les assets).
    window.location.replace(cacheBustedReloadUrl(window.location.href, Date.now()))
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.state.recovering) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-theme-page px-6 text-center">
          <p className="text-sm text-theme-secondary" role="status" aria-live="polite">
            {i18n.t('errorBoundary.updating')}
          </p>
        </div>
      )
    }

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
