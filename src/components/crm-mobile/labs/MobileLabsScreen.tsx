/**
 * MEGGA CRM mobile — Labs, en LECTURE SEULE.
 *
 * Ce que l'écran fait : la galerie des productions de l'agence, et l'ouverture d'une
 * production en plein écran. Ce qu'il ne fait pas : générer, importer, ranger. Ces
 * gestes demandent une saisie longue et une photo source, et ils restent sur
 * ordinateur — et l'écran le DIT (`mobile.readOnly`).
 *
 * ⚠ MANROPE, PAS INTER TIGHT : Inter Tight est la police de l'agent au BUREAU,
 * Manrope celle du mobile (`polices-domaines.spec.ts`).
 *
 * ⚠ La mosaïque est COLLÉE et sans rayon, comme au bureau (Julien, 20.09.2026) :
 * c'est la même galerie, elle ne peut pas avoir deux allures. Les `0` sont des
 * RESETS — le cliquet de grammaire les exclut nommément.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import MEIcon from '@/components/propertyx/MEIcon'
import { MOBILE_FONT, MT_DARK, MT_LIGHT } from '@/components/crm-mobile/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { useLabsAssets } from '@/hooks/useLabsAssets'
import { labsAssetRatioPercent, labsRelativeTime } from '@/lib/labs'
import { crmVoileAssombrissant } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import type { LabsAsset } from '@/types/labs'

export default function MobileLabsScreen() {
  const { t, i18n } = useTranslation('labs')
  const lang = i18n.language.slice(0, 2)
  const dark = useCrmDark()
  const mt = dark ? MT_DARK : MT_LIGHT
  const { assets, isLoading, isError } = useLabsAssets()
  const [ouvert, setOuvert] = useState<LabsAsset | null>(null)

  return (
    <div style={{ minHeight: '100dvh', background: mt.canvas, color: mt.ink, fontFamily: MOBILE_FONT, paddingBottom: 'calc(var(--crm-space-7xl) * 4)' }}>
      <header style={{ padding: 'var(--crm-space-6xl) var(--crm-space-2xl) var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: '-0.02em' }}>{t('title')}</h1>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: mt.inkSoft, lineHeight: 1.45 }}>{t('mobile.readOnly')}</p>
      </header>

      {isError && (
        <p style={{ margin: 0, padding: '0 var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', color: mt.inkSoft }}>{t('error.title')}</p>
      )}
      {!isError && !isLoading && assets.length === 0 && (
        <p style={{ margin: 0, padding: '0 var(--crm-space-2xl)', fontSize: 'var(--crm-text-md)', color: mt.inkSoft }}>{t('mobile.empty')}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {isLoading && assets.length === 0 && [100, 75, 130, 100].map((ar, i) => (
          <div key={i} style={{ borderRadius: 0, background: mt.cardSubtle, paddingBottom: `${ar}%` }} />
        ))}
        {assets.map((a) => {
          const src = a.kind === 'video' ? a.thumbnailUrl : (a.thumbnailUrl ?? a.url)
          const enCours = a.status === 'generating' || a.status === 'pending'
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOuvert(a)}
              aria-label={a.prompt ?? t(`kind.${a.kind}`)}
              style={{
                position: 'relative', padding: 0, border: 0, borderRadius: 0, overflow: 'hidden', background: mt.cardSubtle,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ paddingBottom: `${Math.min(140, labsAssetRatioPercent(a))}%`, position: 'relative' }}>
                {src && <img src={src} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: enCours ? 'blur(6px)' : 'none' }} />}
                {a.kind === 'video' && (
                  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', background: crmVoileAssombrissant(0.55) }}>
                    <MEIcon name="play" size={14} color={MXC_COLOR.n1000} />
                  </span>
                )}
                <span style={{ position: 'absolute', left: 'var(--crm-space-sm)', bottom: 'var(--crm-space-sm)', padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-sm)', background: crmVoileAssombrissant(0.6), color: MXC_COLOR.n1000, fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>
                  {enCours ? t(`status.${a.status}`) : a.status === 'failed' ? t('status.failed') : labsRelativeTime(a.createdAt, lang)}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {ouvert && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ouvert.prompt ?? t(`kind.${ouvert.kind}`)}
          onClick={() => setOuvert(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: crmVoileAssombrissant(0.92), display: 'flex', flexDirection: 'column', fontFamily: MOBILE_FONT }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-lg)' }} onClick={(e) => e.stopPropagation()}>
            {ouvert.kind === 'video' && ouvert.url ? (
              <video src={ouvert.url} poster={ouvert.thumbnailUrl ?? undefined} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 0 }} />
            ) : (
              <img src={(ouvert.kind === 'video' ? ouvert.thumbnailUrl : ouvert.url ?? ouvert.thumbnailUrl) ?? ''} alt={ouvert.prompt ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 0 }} />
            )}
          </div>
          {ouvert.prompt && (
            <p style={{ margin: 0, padding: 'var(--crm-space-lg) var(--crm-space-2xl) var(--crm-space-6xl)', color: MXC_COLOR.n1000, fontSize: 'var(--crm-text-md)', lineHeight: 1.5 }}>{ouvert.prompt}</p>
          )}
          <button
            type="button"
            onClick={() => setOuvert(null)}
            aria-label={t('lightbox.close')}
            style={{ position: 'absolute', top: 'var(--crm-space-lg)', right: 'var(--crm-space-lg)', width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, background: crmVoileAssombrissant(0.5), color: MXC_COLOR.n1000, display: 'grid', placeItems: 'center' }}
          >
            <MEIcon name="close" size={16} color={MXC_COLOR.n1000} />
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
