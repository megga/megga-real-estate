// MEGGA — Page 404. Sobre, aux tokens du thème CRM (dark/light), sans dépendance
// Property X (l'ancien 404 marketplace a été archivé hors repo le 2026-06-08).

import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-theme-page px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-theme-tertiary">Erreur 404</p>
      <h1 className="mt-3 text-3xl font-semibold text-theme-primary md:text-4xl">
        Page introuvable
      </h1>
      <p className="mt-3 max-w-md text-base text-theme-secondary">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary transition-colors hover:bg-theme-hover"
        >
          Retour au tableau de bord
        </Link>
        <Link
          to="/help"
          className="rounded-lg px-4 py-2 text-sm font-medium text-theme-tertiary transition-colors hover:text-theme-primary"
        >
          Centre d'aide
        </Link>
      </div>
    </div>
  )
}
