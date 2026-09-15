import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Sentry, sentryEnvoie } from '@/lib/sentry'
import ErreurApplication from './ErreurApplication'
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
 * Notifie Sentry via captureException, puis affiche `ErreurApplication` —
 * plein cadre, hors de la coquille, deux issues : recharger la page, ou
 * revenir au tableau de bord. Class component obligatoire : seuls
 * componentDidCatch / getDerivedStateFromError captent les erreurs de rendu
 * (pas de hook équivalent).
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
  /** La référence de l'événement Sentry, montrée pour le support — `null` s'il n'est pas parti. */
  reference: string | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, recovering: false, reference: null }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    // Lecture seule du drapeau de session ici (phase de rendu) : la POSE du
    // drapeau attend componentDidCatch, la phase de commit.
    return { hasError: true, recovering: isStaleChunkError(error) && shouldAttemptChunkRecovery() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    })
    // ⚠ `captureException` rend un identifiant MÊME quand rien ne part (DSN absent, ou dev
    // où le client existe mais est désactivé) : on ne montre la référence que si
    // l'événement est réellement envoyé.
    if (sentryEnvoie() && eventId) this.setState({ reference: eventId.slice(0, 8) })
    if (this.state.recovering) void this.recoverFromStaleChunk(error)
  }

  /**
   * Purge le chunk fautif et ses dépendances du cache HTTP puis recharge. La
   * purge est un mieux, jamais une condition : sans URL dans le message
   * (échec réseau de Safari, variante MIME de Safari ≤ 26), le rechargement
   * cache-busté part quand même — il suffit au cas « bundle périmé », le plus
   * fréquent.
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
    return <ErreurApplication reference={this.state.reference} onRecharger={this.handleReload} miseAJour={this.state.recovering} />
  }
}
