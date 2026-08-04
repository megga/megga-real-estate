/**
 * Filet de sécurité runtime : bannière de rechargement quand un import lazy
 * échoue parce que l'index.html en cache référence des chunks renommés depuis un
 * redeploy. Mécanisme et modes d'échec détaillés dans le bloc ci-dessous.
 */
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isStaleChunkError } from '@/lib/staleChunkRecovery'

/**
 * StaleBundleDetector
 * ────────────────────────────────────────────────────────────────────
 * When Cloudflare Pages redeploys, the old `index.html` in the user's
 * browser still references chunk filenames (e.g. MonDossierPage-abc.js)
 * whose hashed names have changed. The next lazy navigation then fails
 * with:
 *
 *   TypeError: Failed to fetch dynamically imported module: …*.js
 *
 * …and the page goes blank because React Router has no fallback.
 *
 * This component listens globally for that specific failure mode and
 * shows a friendly "nouvelle version" banner that offers a one-click
 * reload (or auto-reloads after 8 s). It also catches the classic
 * `ChunkLoadError` thrown by webpack-style bundlers, for safety.
 *
 * Mount once near the top of the tree (inside <BrowserRouter> is fine).
 */

// Once we've shown the banner we set this flag so repeated errors don't
// flood the UI with copies — and to stop our own retry-loop triggering it.
// (Les motifs d'erreur reconnus vivent dans src/lib/staleChunkRecovery.ts,
// partagés avec ErrorBoundary — voir son en-tête pour qui attrape quoi.)
const SESSION_FLAG = 'megga-stale-bundle-shown'

export default function StaleBundleDetector() {
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(8)

  const reload = useCallback(() => {
    // Burst caches that the browser might honour otherwise. The cache=reload
    // flag on the new URL is a defensive belt-and-braces — the SW, if any,
    // should see the no-store intent too.
    try {
      sessionStorage.removeItem(SESSION_FLAG)
    } catch { /* noop */ }
    const url = new URL(window.location.href)
    url.searchParams.set('_v', String(Date.now()))
    window.location.replace(url.toString())
  }, [])

  // Listen for the two ways this failure reaches the runtime: unhandled
  // promise rejections (most common with lazy imports) and plain errors.
  useEffect(() => {
    function handle(reason: unknown) {
      if (!isStaleChunkError(reason)) return
      if (sessionStorage.getItem(SESSION_FLAG) === 'true') return
      try { sessionStorage.setItem(SESSION_FLAG, 'true') } catch { /* noop */ }
      setVisible(true)
    }

    const onReject = (e: PromiseRejectionEvent) => handle(e.reason)
    const onError = (e: ErrorEvent) => handle(e.error ?? e.message)

    window.addEventListener('unhandledrejection', onReject)
    window.addEventListener('error', onError)
    return () => {
      window.removeEventListener('unhandledrejection', onReject)
      window.removeEventListener('error', onError)
    }
  }, [])

  // Auto-reload countdown so the user isn't stranded on a blank screen
  // if they walk away from the tab.
  useEffect(() => {
    if (!visible) return
    if (countdown <= 0) { reload(); return }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [visible, countdown, reload])

  if (!visible) return null

  return createPortal(
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
    >
      <div
        className={cn(
          'flex items-start gap-4 rounded-2xl bg-theme-card',
          'border border-theme-border',
          'pl-5 pr-4 py-4 max-w-md',
          'shadow-[0_20px_40px_-15px_rgba(15,23,42,0.18)]',
        )}
      >
        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-500" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-theme-primary">
            Une nouvelle version est disponible
          </p>
          <p className="text-xs text-theme-tertiary mt-0.5">
            Rechargement automatique dans{' '}
            <span className="tabular-nums font-medium text-theme-secondary">
              {countdown}s
            </span>
            .
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={reload}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-theme-border text-theme-primary hover:bg-theme-hover',
                'text-xs font-medium transition-all hover:-translate-y-0.5',
                'hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:focus-visible:ring-white/30',
              )}
            >
              Recharger maintenant
            </button>
            <button
              onClick={() => setVisible(false)}
              className={cn(
                'h-8 px-2.5 rounded-full text-xs font-medium text-theme-tertiary',
                'hover:text-theme-primary transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10',
              )}
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Fermer"
          className={cn(
            'shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-theme-muted',
            'hover:text-theme-primary hover:bg-theme-hover transition-colors',
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
