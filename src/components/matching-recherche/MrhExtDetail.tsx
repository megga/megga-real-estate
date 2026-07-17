// Matching · Recherche — fiche annonce marché (« Voir l'annonce »). Plein bento
// central, grammaire Sugar. Partagée Recherche ↔ mode « par acheteur ». Port du
// proto handoff `MrhExtDetail`, câblé aux vraies photos + i18n.
//
// Carte : vraie carte Mapbox (react-map-gl, lazy) quand VITE_MAPBOX_TOKEN est
// présent ; repli placeholder CSS (grille + rues + pin, vraies coordonnées) sinon.

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RechIcon from './RechIcon'
import MrhPhoto from './MrhPhoto'
import MrhLightbox from './MrhLightbox'
import { formatCHF } from '@/lib/utils'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { MrhBien, MrhContact } from './types'
import type { MrhSurf } from './mrhCtx'

// Carte réelle isolée + lazy → mapbox-gl ne charge qu'à l'ouverture d'une fiche avec token.
const MrhMapbox = lazy(() => import('./MrhMapbox'))
const HAS_MAPBOX = !!((import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || '')

interface Props {
  bien: MrhBien
  sp: SugarPalette
  surf: MrhSurf
  dark: boolean
  line: string
  chipBg: string
  ACC: string
  ONACC: string
  buyer: MrhContact | null
  on: boolean
  onToggle: () => void
  onClose: () => void
  /** masque la pastille « N photos » (contexte par-acheteur) */
  hidePhotoCount?: boolean
}

export default function MrhExtDetail({ bien, sp, surf, dark, line, chipBg, ACC, ONACC, buyer, on, onToggle, onClose, hidePhotoCount }: Props) {
  const { t } = useTranslation('matching')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isRent = bien.transaction === 'location'
  const price = isRent ? bien.rent : bien.price
  const portalLabel = bien.source_portal === 'flatfox' ? 'Flatfox' : bien.source_portal === 'realadvisor' ? 'RealAdvisor' : (bien.source_portal || 'portail')
  const openPortal = () => { const u = bien.source_url || ''; if (u) window.open(/^https?:/i.test(u) ? u : 'https://' + u, '_blank', 'noopener') }
  const subBg = dark ? 'rgba(255,255,255,.045)' : '#F7F8FA'
  const dot = dark ? 'rgba(255,255,255,.22)' : 'rgba(15,23,42,.22)'
  const ppm2 = bien.price_per_m2 || (price && bien.area ? Math.round(price / bien.area) : null)
  const priceOrig = bien.price_original
  const dropPct = priceOrig && price && priceOrig > price ? Math.round((1 - price / priceOrig) * 100) : null
  const priceLabel = price ? formatCHF(price) : t('recherche.detail.priceOnRequest')
  const agencyName = bien.agency || '—'
  const agencyInit = agencyName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const mapBg = dark ? '#12151B' : '#E7ECF2'
  const mapLine = dark ? 'rgba(255,255,255,.05)' : 'rgba(15,23,42,.06)'
  const locChips = (
    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 13px', borderRadius: 999, maxWidth: '100%', background: dark ? 'rgba(11,12,14,.8)' : 'rgba(255,255,255,.94)', color: sp.ink, fontSize: 12.5, fontWeight: 700, boxShadow: '0 2px 8px rgba(15,23,42,.12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bien.addr}</span>
      {bien.lat != null && bien.lng != null ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 11px', borderRadius: 999, background: dark ? 'rgba(11,12,14,.66)' : 'rgba(255,255,255,.85)', color: sp.sub, fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{bien.lat.toFixed(4) + ', ' + bien.lng.toFixed(4)}</span> : null}
    </div>
  )
  const photos = useMemo(() => bien.photos, [bien.photos])
  const [lb, setLb] = useState(-1)

  const onMarket = bien.days_on_market == null ? '—'
    : bien.days_on_market <= 0 ? t('recherche.detail.onMarketLessDay')
    : t('recherche.detail.onMarketDays', { count: bien.days_on_market })

  const facts: Array<{ k: string; v: string }> = [
    { k: t('recherche.detail.factRooms'), v: bien.rooms != null ? String(bien.rooms) : '—' },
    { k: t('recherche.detail.factSurface'), v: bien.area ? bien.area + ' m²' : '—' },
    ...(bien.land_surface ? [{ k: t('recherche.detail.factLand'), v: bien.land_surface + ' m²' }] : []),
    { k: t('recherche.detail.factYear'), v: bien.year ? String(bien.year) : '—' },
    { k: isRent ? t('recherche.detail.factPpm2Rent') : t('recherche.detail.factPpm2Sale'), v: ppm2 ? formatCHF(ppm2) : '—' },
  ]
  const details: Array<{ k: string; v: string; mono?: boolean }> = [
    { k: t('recherche.detail.dType'), v: bien.typeLabel },
    { k: t('recherche.detail.dTransaction'), v: isRent ? t('recherche.trans.rent') : t('recherche.trans.sale') },
    { k: t('recherche.detail.dLocality'), v: [bien.postal_code, bien.city].filter(Boolean).join(' ') || bien.city || '—' },
    { k: t('recherche.detail.dCanton'), v: bien.canton || '—' },
    { k: t('recherche.detail.dOnMarket'), v: onMarket },
    { k: t('recherche.detail.dPortalRef'), v: bien.ref || '—', mono: true },
  ]

  const selectBtn = (block?: boolean) => buyer ? (
    <button onClick={onToggle}
      style={{ marginTop: block ? 10 : 0, width: block ? '100%' : undefined, height: block ? 46 : 44, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: block ? 14 : 13.5, fontWeight: 700, background: on ? chipBg : 'transparent', color: sp.ink, boxShadow: on ? 'none' : 'inset 0 0 0 1px ' + sp.solidBorder, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <RechIcon name={on ? 'check' : 'plus'} size={15} stroke={sp.ink} />
      {on ? (block ? t('recherche.detail.inSelectionOf', { name: buyer.firstName }) : t('recherche.detail.inSelection')) : t('recherche.detail.addToSelection')}
    </button>
  ) : null

  return (
    <div className="mrh-detail" style={{ position: 'absolute', inset: 0, zIndex: 70, background: sp.pageBg, display: 'flex', flexDirection: 'column', animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both', color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 30px 12px' }}>
        <button onClick={onClose} title={t('recherche.detail.back')} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: surf.card, boxShadow: surf.shadow }}>
          <RechIcon name="chevronL" size={18} stroke={sp.ink} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: sp.sub }}>{t('recherche.detail.back')}</div>
        <div style={{ flex: 1 }} />
        {selectBtn(false)}
      </div>

      <div className="mrh-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 30px 34px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {/* galerie */}
          <div className="mrh-gallery" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8, height: 440 }}>
            <button className="mrh-gal-main" onClick={() => photos.length && setLb(0)} title={t('recherche.detail.seePhotos')} style={{ gridColumn: '1', gridRow: '1 / span 2', position: 'relative', border: 0, cursor: photos.length ? 'zoom-in' : 'default', padding: 0, borderRadius: 20, overflow: 'hidden', background: subBg, boxShadow: surf.shadow }}>
              <MrhPhoto url={photos[0]} dark={dark} alt={bien.title} fallbackBg={subBg} fallbackInk={sp.sub} />
              {bien.status === 'price_reduced' && (
                <span style={{ position: 'absolute', top: 16, right: 16, display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 13px', borderRadius: 999, background: '#C45A00', color: '#fff', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(15,23,42,.18)' }}>{t('recherche.card.priceDrop')}</span>
              )}
              {!hidePhotoCount && photos.length > 0 && (
                <span style={{ position: 'absolute', bottom: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px', borderRadius: 999, background: 'rgba(11,12,14,.72)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  <RechIcon name="layers" size={13} stroke="#fff" /> {t('recherche.card.photos', { count: photos.length })}
                </span>
              )}
            </button>
            {photos.slice(1, 5).map((p, i) => {
              const overflow = i === 3 && photos.length > 5
              return (
                <button key={p + i} className="mrh-gal-thumb" onClick={() => setLb(i + 1)} title={t('recherche.detail.seePhotos')} style={{ position: 'relative', border: 0, cursor: 'zoom-in', padding: 0, borderRadius: 14, overflow: 'hidden', background: subBg, boxShadow: surf.shadow }}>
                  <MrhPhoto url={p} dark={dark} alt="" fallbackBg={subBg} fallbackInk={sp.sub} />
                  {overflow && (
                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(6,7,9,.52)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{'+' + (photos.length - 5)}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mrh-detail-grid" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: sp.ink, lineHeight: 1.1 }}>{bien.title}</h2>
                  <div style={{ fontSize: 14.5, color: sp.sub, marginTop: 8, fontWeight: 600 }}>{bien.addr}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: sp.ink, letterSpacing: -0.8, lineHeight: 1, whiteSpace: 'nowrap' }}>{priceLabel}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {isRent && price ? <span style={{ fontSize: 12.5, color: sp.sub, fontWeight: 600 }}>{t('recherche.detail.perMonthLong')}</span> : null}
                    {priceOrig ? <span style={{ fontSize: 13, color: sp.sub, fontWeight: 600, textDecoration: 'line-through' }}>{formatCHF(priceOrig)}</span> : null}
                    {dropPct ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: '#C45A00', color: '#fff', fontSize: 11.5, fontWeight: 800 }}>{'−' + dropPct + ' %'}</span> : null}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 12 }}>
                {facts.map((f) => (
                  <div key={f.k} style={{ background: surf.card, borderRadius: 14, boxShadow: surf.shadow, padding: '15px 16px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: sp.sub }}>{f.k}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: sp.ink, marginTop: 5, letterSpacing: -0.3 }}>{f.v}</div>
                  </div>
                ))}
              </div>

              {bien.features.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: sp.sub, marginBottom: 12 }}>{t('recherche.detail.equip')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {bien.features.map((f) => <span key={f} style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 15px', borderRadius: 999, background: chipBg, color: sp.ink, fontSize: 13, fontWeight: 600 }}>{f}</span>)}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: sp.sub, marginBottom: 12 }}>{t('recherche.detail.details')}</div>
                <div style={{ background: surf.card, borderRadius: 18, boxShadow: surf.shadow, overflow: 'hidden' }}>
                  {details.map((d, i) => (
                    <div key={d.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px', borderTop: i ? '1px solid ' + line : 'none' }}>
                      <span style={{ fontSize: 13.5, color: sp.sub, fontWeight: 600 }}>{d.k}</span>
                      <span style={{ fontSize: 13.5, color: sp.ink, fontWeight: 700, textAlign: 'right', fontFamily: d.mono ? "'JetBrains Mono', monospace" : 'inherit' }}>{d.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: sp.sub, marginBottom: 12 }}>{t('recherche.detail.location')}</div>
                {HAS_MAPBOX && bien.lat != null && bien.lng != null ? (
                  <div style={{ position: 'relative', height: 240, borderRadius: 18, overflow: 'hidden', background: mapBg, boxShadow: surf.shadow }}>
                    <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: mapBg }} />}>
                      <MrhMapbox
                        center={{ lng: bien.lng, lat: bien.lat, zoom: 14 }}
                        markers={[{ id: 'loc', lng: bien.lng, lat: bien.lat, anchor: 'bottom', el: (
                          <svg width="30" height="30" viewBox="0 0 24 24" fill={sp.ink} style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))' }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.6" fill={mapBg} /></svg>
                        ) }]}
                        dark={dark} radius={18} interactive={false}
                        overlay={locChips}
                        fallback={<div style={{ position: 'absolute', inset: 0, background: mapBg }} />}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div style={{ position: 'relative', height: 240, borderRadius: 18, overflow: 'hidden', background: mapBg, boxShadow: surf.shadow }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${mapLine} 1px, transparent 1px), linear-gradient(90deg, ${mapLine} 1px, transparent 1px)`, backgroundSize: '34px 34px' }} />
                    <div style={{ position: 'absolute', top: '-12%', left: '20%', width: '62%', height: '160%', transform: 'rotate(22deg)', background: mapLine }} />
                    <div style={{ position: 'absolute', top: '42%', left: '-10%', width: '130%', height: 12, background: mapLine }} />
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-100%)' }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill={sp.ink} style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))' }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.6" fill={mapBg} /></svg>
                    </div>
                    {locChips}
                  </div>
                )}
              </div>
            </div>

            {/* Régie */}
            <div style={{ position: 'sticky', top: 6 }}>
              <div style={{ background: surf.card, borderRadius: 20, boxShadow: surf.shadow, padding: '20px 20px 22px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: sp.sub }}>{t('recherche.detail.agency')}</div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: ACC, color: ONACC, fontSize: 13.5, fontWeight: 800 }}>{agencyInit || '—'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: sp.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agencyName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, fontSize: 12, color: sp.sub, fontWeight: 600, marginTop: 2 }}>
                      <span>{portalLabel}</span>
                      {bien.postedAt ? <><span style={{ color: dot }}>·</span><span>{bien.postedAt}</span></> : null}
                    </div>
                  </div>
                </div>
                {bien.agency_phone ? (
                  <a href={'tel:' + bien.agency_phone.replace(/\s+/g, '')} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 14px', borderRadius: 12, background: chipBg, color: sp.ink, textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }}>
                    <RechIcon name="phone" size={15} stroke={sp.ink} /> {bien.agency_phone}
                  </a>
                ) : null}
                <button onClick={openPortal} style={{ marginTop: 18, width: '100%', height: 46, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: ACC, color: ONACC, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {t('recherche.detail.openOn', { portal: portalLabel })} <RechIcon name="arrowR" size={15} stroke={ONACC} />
                </button>
                {selectBtn(true)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lb >= 0 && photos.length > 0 && <MrhLightbox photos={photos} index={lb} onIndex={setLb} onClose={() => setLb(-1)} />}

      <style>{'@media (max-width: 900px){ .mrh-detail-grid{ grid-template-columns: 1fr !important; } } @media (max-width: 820px){ .mrh-gallery{ grid-template-columns: 1fr !important; grid-template-rows: auto !important; height: auto !important; } .mrh-gallery .mrh-gal-thumb{ display: none !important; } .mrh-gallery .mrh-gal-main{ grid-row: auto !important; aspect-ratio: 16 / 10; } }'}</style>
    </div>
  )
}
