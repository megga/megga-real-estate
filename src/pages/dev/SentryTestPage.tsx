// MEGGA — Test route pour vérifier l'intégration Sentry (init, logs, metrics, errors).
// Accessible à /dev/sentry-test — pas de garde auth, non listé dans la navigation.

import * as Sentry from '@sentry/react'

export default function SentryTestPage() {
  return (
    <div className="min-h-screen bg-theme-page p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-theme-primary">Sentry test</h1>
          <p className="text-sm text-theme-secondary">
            Clique sur le bouton ci-dessous pour envoyer un log, une métrique et une erreur à Sentry.
            Va ensuite vérifier sur{' '}
            <a
              href="https://gauthier-ru.sentry.io/projects/javascript-react/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              gauthier-ru.sentry.io
            </a>{' '}
            que l'événement est arrivé.
          </p>
          <p className="text-xs text-theme-tertiary">
            Note : Sentry est désactivé en dev par défaut. Lance avec{' '}
            <code className="rounded bg-theme-section px-1 py-0.5">VITE_SENTRY_FORCE_DEV=true</code>{' '}
            pour tester en local, ou teste après un déploiement prod.
          </p>
        </header>

        <button
          type="button"
          onClick={() => {
            Sentry.logger.info('User triggered test error', {
              action: 'test_error_button_click',
            })
            Sentry.metrics.count('test_counter', 1)
            throw new Error('This is your first error!')
          }}
          className="rounded-lg border border-theme-border bg-theme-card px-4 py-2 text-sm text-theme-secondary transition hover:bg-theme-hover"
        >
          Break the world
        </button>
      </div>
    </div>
  )
}
