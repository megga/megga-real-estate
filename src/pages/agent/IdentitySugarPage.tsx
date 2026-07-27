/**
 * Route `/dashboard/identite` (desktop, via ResponsiveRoute dans App.tsx).
 * Coquille a ce stade : le wizard de saisie d'identite legale (5 etapes,
 * IdentityShell) arrive a la tache 3 du plan etape 2. AgentSugarLayout
 * redirige ici tant que useIdentityGate() renvoie 'required' - cette page
 * affiche donc un etat d'attente honnete plutot qu'un ecran vide, pendant
 * que le reste du CRM reste bloque.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Etat d'attente de la route gate - remplace par IdentityShell (tache 3). */
export default function IdentitySugarPage() {
  const { t } = useTranslation('onboarding')
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-theme-page px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-theme-tertiary">{t('gate.shell.eyebrow')}</p>
      <h1 className="mt-3 max-w-lg text-2xl font-semibold text-theme-primary md:text-3xl">
        {t('gate.shell.title')}
      </h1>
      <p className="mt-3 max-w-md text-base text-theme-secondary">{t('gate.shell.body')}</p>
      <div className="mt-8 flex items-center gap-2 text-sm text-theme-tertiary" role="status" aria-live="polite">
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-theme-border border-t-accent"
          aria-hidden="true"
        />
        {t('gate.shell.preparing')}
      </div>
      {/* Pas de bypass vers le CRM (le gate redirigerait de toute facon ici) -
          seule sortie honnete : se deconnecter. */}
      <button
        type="button"
        onClick={() => { void signOut().then(() => navigate('/login')) }}
        className="mt-10 rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary transition-colors hover:bg-theme-hover"
      >
        {t('common:logout')}
      </button>
    </div>
  )
}
