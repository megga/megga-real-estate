// MEGGA CRM Sugar v2 — Mes biens · État « Compte neuf » (premier lancement)
// Adapté du handoff Claude Design (crm-biens-firstrun.jsx). La couverture dark
// à halo du proto s'appuie sur des assets (biens-cover.svg / motif.png) ABSENTS
// du bundle → on ne fabrique PAS l'artwork ; version sobre Sugar Pure fidèle au
// contenu (« Vos mandats, au même endroit » + 3 étapes + CTA), thème clair/sombre.

import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { GalSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'

interface BiensFirstRunProps {
  sp: SugarPalette
  surf: GalSurfaces
  onStart: () => void
}

/** Couverture premier lancement (page 0 quand l'agence n'a encore aucun bien). */
export function BiensFirstRun({ sp, surf, onStart }: BiensFirstRunProps) {
  const { t } = useTranslation('listings')
  const steps = [1, 2, 3] as const

  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'grid', placeItems: 'center', padding: '0 7%', fontFamily: '"Inter Tight", system-ui, sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', width: '100%', maxWidth: 980 }}>
        <div>
          <h1 style={{ margin: 0, maxWidth: 420, fontSize: 40, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1.08, color: sp.ink }}>
            {t('biens.firstRun.title')}
          </h1>
          <button
            type="button"
            onClick={onStart}
            style={{ marginTop: 28, height: 46, padding: '0 30px', borderRadius: 999, border: 0, cursor: 'pointer', background: sp.ink, color: sp.pageBg, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, boxShadow: sp.focusShadow }}
          >
            {t('biens.firstRun.start')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((n) => (
            <div key={n} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: surf.card, border: surf.hairline, boxShadow: surf.shadow, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 999, background: surf.cardSub, color: sp.ink, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {n}
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{t(`biens.firstRun.step${n}.title`)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, color: sp.sub, marginTop: 4 }}>{t(`biens.firstRun.step${n}.sub`)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface BiensFollowEmptyProps {
  sp: SugarPalette
  onCreate: () => void
}

/** État vide de la page basse « À suivre » au premier lancement. */
export function BiensFollowEmpty({ sp, onCreate }: BiensFollowEmptyProps) {
  const { t } = useTranslation('listings')
  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'grid', placeItems: 'center', fontFamily: '"Inter Tight", system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 460, padding: '0 24px' }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: sp.ink }}>{t('biens.followUp.emptyFirstRun.title')}</h2>
        <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: sp.sub }}>{t('biens.followUp.emptyFirstRun.subtitle')}</p>
        <button
          type="button"
          onClick={onCreate}
          style={{ marginTop: 24, height: 46, padding: '0 30px', borderRadius: 999, border: 0, cursor: 'pointer', background: sp.ink, color: sp.pageBg, fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
        >
          {t('biens.create')}
        </button>
      </div>
    </div>
  )
}
