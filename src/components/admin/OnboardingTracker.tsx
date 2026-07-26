/**
 * Suivi d'onboarding des agences (section super-admin).
 *
 * Deux vues : un funnel agrégé (part des agences ayant franchi chaque étape) et
 * la liste des agences triée par complétion croissante — les plus à risque en
 * tête. Étapes et statut (active / at_risk / dormant) viennent de
 * `useOnboardingTracker`.
 *
 * Rendu en grammaire Sugar : bento séparé par l'ombre, barres de progression en
 * accent NOIR (`sp.accent`) — le violet plateforme n'a rien à faire sur une
 * métrique métier —, statut en pilule pleine au lieu d'un point de couleur, et
 * pourcentages en chiffres tabulaires pour que la colonne ne tremble pas.
 */
import { useTranslation } from 'react-i18next'
import { formatRelativeDate } from '@/lib/utils'
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker'
import type { AgencyOnboarding } from '@/hooks/useOnboardingTracker'
import { Building2, Check } from 'lucide-react'
import {
  AdminCard, AdminEmpty, AdminGroupTitle, AdminIc, AdminPill, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

const STEP_LABEL_KEYS: { key: keyof AgencyOnboarding['steps']; i18nKey: string }[] = [
  { key: 'profile_completed', i18nKey: 'onboarding.step.registered' },
  { key: 'first_contact', i18nKey: 'onboarding.step.contact' },
  { key: 'first_property', i18nKey: 'onboarding.step.property' },
  { key: 'first_kyc', i18nKey: 'onboarding.step.kyc' },
  { key: 'first_transaction', i18nKey: 'onboarding.step.transaction' },
  { key: 'first_match', i18nKey: 'onboarding.step.match' },
]

const STATUS_CONFIG: Record<AgencyOnboarding['status'], { i18nKey: string; tone: AdminToneName }> = {
  active: { i18nKey: 'onboarding.status.active', tone: 'ok' },
  at_risk: { i18nKey: 'onboarding.status.atRisk', tone: 'warn' },
  dormant: { i18nKey: 'onboarding.status.dormant', tone: 'err' },
}

/** Carte funnel + table des agences, chacune avec barre de progression, pastilles d'étapes et statut. */
export default function OnboardingTracker() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones, onTone } = useAdminSugar()
  const { data: agencies, isLoading } = useOnboardingTracker()

  if (isLoading) {
    return (
      <AdminCard padding="8px 12px 14px">
        <AdminGroupTitle label={t('onboarding.title')} tone="info" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <AdminSkeleton key={i} height={32} />
          ))}
        </div>
      </AdminCard>
    )
  }

  if (!agencies?.length) {
    return (
      <AdminCard padding="8px 12px 14px">
        <AdminGroupTitle label={t('onboarding.title')} tone="info" />
        <AdminEmpty icon={Building2} title={t('onboarding.noAgencies')} />
      </AdminCard>
    )
  }

  // Compute funnel counts
  const total = agencies.length
  const funnelSteps = STEP_LABEL_KEYS.map(step => {
    const count = agencies.filter(a => a.steps[step.key]).length
    return { ...step, count, pct: Math.round((count / total) * 100) }
  })

  // Sort agencies by completion ascending (most at risk first)
  const sorted = [...agencies].sort((a, b) => a.completion - b.completion)

  return (
    <AdminCard padding="8px 12px 14px">
      <AdminGroupTitle label={t('onboarding.title')} tone="info" />

      {/* Funnel summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 4px' }}>
        {funnelSteps.map((step) => (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 96, flexShrink: 0, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: sp.sub }}>
              {t(step.i18nKey)}
            </span>
            <div style={{ flex: 1, position: 'relative', height: 22, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${step.pct}%`, borderRadius: ADMIN_RADII.pill,
                background: sp.accent, transition: 'width .5s cubic-bezier(.2,.8,.2,1)',
              }} />
              {/* Le compteur passe en encre inversée dès qu'il repose sur la barre. */}
              <span style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 11px',
                fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: step.pct > 40 ? sp.accentInk : sp.ink,
              }}>
                {step.count}/{total}
              </span>
            </div>
            <span style={{ width: 38, flexShrink: 0, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {step.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Agency list */}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <AdminTh>{t('onboarding.table.agency')}</AdminTh>
              <AdminTh width={150}>{t('onboarding.table.progress')}</AdminTh>
              <AdminTh align="center" width={160}>{t('onboarding.table.steps')}</AdminTh>
              <AdminTh width={110}>{t('onboarding.table.status')}</AdminTh>
              <AdminTh align="right" width={120}>{t('onboarding.table.lastActivity')}</AdminTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map(agency => {
              const statusCfg = STATUS_CONFIG[agency.status]
              return (
                <tr key={agency.agency_id}>
                  {/* Agency name */}
                  <AdminTd style={{ fontWeight: 700, letterSpacing: -0.2 }}>{agency.agency_name}</AdminTd>

                  {/* Progress bar */}
                  <AdminTd>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${agency.completion}%`, borderRadius: ADMIN_RADII.pill,
                          background: agency.completion === 100 ? tones.ok : sp.accent,
                          transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
                        }} />
                      </div>
                      <span style={{ width: 32, textAlign: 'right', fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {agency.completion}%
                      </span>
                    </div>
                  </AdminTd>

                  {/* Step dots */}
                  <AdminTd align="center">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {STEP_LABEL_KEYS.map(step => {
                        const done = agency.steps[step.key]
                        return (
                          <span
                            key={step.key}
                            title={t(step.i18nKey)}
                            style={{
                              width: 16, height: 16, borderRadius: ADMIN_RADII.pill, flexShrink: 0,
                              display: 'grid', placeItems: 'center',
                              background: done ? tones.ok : surf.cardSub,
                            }}
                          >
                            {done && <AdminIc icon={Check} size={10} color={onTone} />}
                          </span>
                        )
                      })}
                    </div>
                  </AdminTd>

                  {/* Status */}
                  <AdminTd>
                    <AdminPill label={t(statusCfg.i18nKey)} tone={statusCfg.tone} />
                  </AdminTd>

                  {/* Last activity */}
                  <AdminTd align="right" numeric style={{ color: sp.sub, whiteSpace: 'nowrap' }}>
                    {agency.last_activity ? formatRelativeDate(agency.last_activity) : t('onboarding.noActivity')}
                  </AdminTd>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AdminCard>
  )
}
