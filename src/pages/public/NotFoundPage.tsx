// MEGGA — Page 404 (CRM theme, sans dépendance Property X).
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-theme-page px-6 text-center">
      <p className="text-sm font-medium text-theme-tertiary">Erreur 404</p>
      <h1 className="text-2xl font-semibold text-theme-primary">Page introuvable</h1>
      <p className="max-w-md text-theme-secondary">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/dashboard"
        className="mt-2 rounded-lg border border-theme-border px-4 py-2 text-sm text-theme-secondary transition-colors hover:bg-theme-hover"
      >
        Retour au tableau de bord
      </Link>
    </div>
  )
}
