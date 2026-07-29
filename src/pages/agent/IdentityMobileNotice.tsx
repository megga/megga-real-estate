/**
 * Route `/dashboard/identite` sous 768 px (mobile, via ResponsiveRoute dans
 * App.tsx). La saisie d'identite legale (formulaires denses, televersement de
 * piece d'identite) ne se termine que sur ordinateur - decision actee au
 * plan etape 2. Cet ecran l'explique et n'offre aucun moyen de contourner :
 * pas de lien vers le dashboard, qui redirigerait de toute facon ici tant
 * que le gate reste 'required'. Seule sortie : se deconnecter.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Invite « terminez sur ordinateur » - aucune sortie vers le CRM mobile. */
export default function IdentityMobileNotice() {
  const { t } = useTranslation('onboarding')
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-theme-page px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-theme-tertiary">{t('gate.mobileNotice.eyebrow')}</p>
      <h1 className="mt-3 text-xl font-semibold text-theme-primary">{t('gate.mobileNotice.title')}</h1>
      <p className="mt-3 max-w-sm text-sm text-theme-secondary">{t('gate.mobileNotice.body')}</p>
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
