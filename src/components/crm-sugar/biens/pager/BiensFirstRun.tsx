// MEGGA CRM Sugar v2 — Mes biens · État « Compte neuf » (premier lancement)
// Port fidèle du handoff Claude Design (crm-biens-firstrun.jsx) : couverture
// « Vos mandats, au même endroit » (public/biens/biens-cover.svg + motif PNG
// masqué en haut-droite). PAS Sugar Pure (exception actée, façon covers
// Pipeline/Contacts) : fond sombre #0A0B0D permanent, quel que soit le thème.

import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { useTranslation } from 'react-i18next'

interface BiensFirstRunProps {
  onStart: () => void
  sp: SugarPalette
}

/** Couverture premier lancement (page 0 quand l'agence n'a encore aucun bien). */
export function BiensFirstRun({ onStart, sp }: BiensFirstRunProps) {
  const { t } = useTranslation('listings')
  const steps = [1, 2, 3] as const
  // Masque du motif : fondu diagonal + haut + droite (intersection des 3).
  const motifMask =
    'linear-gradient(225deg,#000 55%,transparent 82%),linear-gradient(180deg,transparent 6%,#000 30%),linear-gradient(270deg,transparent 4%,#000 26%)'

  return (
    <div
      className="bfr-root"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0A0B0D',
        overflow: 'hidden',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: '#FFFFFF',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`.bfr-root button:focus-visible{outline:2.5px solid #8DA4FF;outline-offset:3px;}.bfr-root :focus:not(:focus-visible){outline:none;}`}</style>
      <img
        src="/biens/biens-cover.svg"
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, bottom: 0, left: -3, width: 'calc(100% + 6px)', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }}
      />
      <img
        src="/biens/biens-cover-motif.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-14%',
          right: '-5%',
          width: '43%',
          height: 'auto',
          pointerEvents: 'none',
          WebkitMaskImage: motifMask,
          WebkitMaskComposite: 'source-in,source-in,source-in',
          maskImage: motifMask,
          maskComposite: 'intersect',
        }}
      />
      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', alignItems: 'center', padding: '0 7%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'start', width: '100%' }}>
          <h1
            style={{ margin: 0, maxWidth: 460, fontSize: 40, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1.2, textTransform: 'uppercase', color: '#FFFFFF', textShadow: '0 0 18px rgba(255,255,255,0.55), 0 0 6px rgba(255,255,255,0.35)', whiteSpace: 'pre-line' }}
          >
            {t('biens.firstRun.title')}
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 440 }}>
            {steps.map((n) => (
              <div key={n}>
                <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginBottom: 14 }}>{String(n).padStart(2, '0')}</div>
                <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 9 }}>{t(`biens.firstRun.step${n}.title`)}</div>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', whiteSpace: 'pre-line' }}>{t(`biens.firstRun.step${n}.sub`)}</div>
              </div>
            ))}
            <button
              type="button"
              onClick={onStart}
              style={{ alignSelf: 'flex-start', height: 46, padding: '0 34px', borderRadius: 'var(--crm-radius-pill)', border: 'none', cursor: 'pointer', background: sp.accent, color: sp.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 700, letterSpacing: 0.5, marginTop: 8 }}
            >
              {t('biens.firstRun.start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BiensFollowEmptyProps {
  sp: SugarPalette
  onCreate: () => void
}

/** État vide de la page basse « À suivre » au premier lancement (Sugar Pure). */
export function BiensFollowEmpty({ sp, onCreate }: BiensFollowEmptyProps) {
  const { t } = useTranslation('listings')
  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'grid', placeItems: 'center', fontFamily: '"Inter Tight", system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 460, padding: '0 var(--crm-space-7xl)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: -0.5, color: sp.ink }}>{t('biens.followUp.emptyFirstRun.title')}</h2>
        <p style={{ margin: '10px 0 0', fontSize: 'var(--crm-text-xl)', fontWeight: 500, lineHeight: 1.55, color: sp.sub }}>{t('biens.followUp.emptyFirstRun.subtitle')}</p>
        <button
          type="button"
          onClick={onCreate}
          style={{ marginTop: 24, height: 46, padding: '0 30px', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: sp.ink, color: sp.pageBg, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 700 }}
        >
          {t('biens.create')}
        </button>
      </div>
    </div>
  )
}
