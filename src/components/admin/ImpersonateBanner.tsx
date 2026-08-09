/**
 * Bandeau sticky signalant une session d'impersonation super-admin en cours.
 * Monté en haut de l'app (z-90) ; rappelle le compte usurpé et offre la sortie.
 *
 * Le fond violet est CONSERVÉ : c'est le repère plateforme, le seul endroit du
 * CRM où l'accent de la console a le droit d'apparaître. Le bouton de sortie
 * abandonne `bg-white/20` (interdit par CLAUDE.md) pour un voile en pilule —
 * même idiome que la piste d'`AdminSwitch` — dont le survol passe par une classe
 * scopée, une valeur inline ne pouvant pas porter d'état `:hover`.
 *
 * ⚠️ Ce composant vit dans le CRM (`AgentLayout`, `AgentSugarLayout`), hors de
 * `AdminThemeProvider` : il ne peut donc PAS appeler `useAdminSugar()`, qui lève
 * hors du provider. Seules les constantes du kit (`ADMIN_RADII`) sont
 * utilisables ici.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useImpersonate } from '@/hooks/useImpersonate'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

const EXIT_CSS = `
.imp-exit { background: rgba(255,255,255,0.16); transition: background .18s ease; }
.imp-exit:hover { background: rgba(255,255,255,0.28); }
`

/** Rendu uniquement pendant une impersonation ; le bouton coupe la session via `stopImpersonate`. */
export default function ImpersonateBanner() {
  const { t } = useTranslation('admin')
  const { impersonating, stopImpersonate } = useImpersonate()

  if (!impersonating) return null

  return (
    <div className="sticky top-0 z-[90] flex items-center justify-center gap-3 h-10 bg-admin-accent text-white text-sm font-medium px-4">
      <style>{EXIT_CSS}</style>
      <MEIcon name="eye" size={16} />
      <span>{t('userDrawer.impersonate')} <strong>{impersonating.full_name}</strong> ({impersonating.email})</span>
      <button
        onClick={stopImpersonate}
        className="imp-exit ml-2 h-6 px-2.5 flex items-center gap-1.5"
        style={{
          borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
          color: 'inherit', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 700,
        }}
      >
        <MEIcon name="close" size={13} />
        {t('common.close')}
      </button>
    </div>
  )
}
