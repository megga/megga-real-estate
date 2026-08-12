// Matching · Recherche — fiche annonce marché (« Voir l'annonce »).
// Port au verbatim du proto handoff `MrhExtDetail` : deux bentos empilés —
// « Affiche » (collage photo + identité + prix) puis le corps (description,
// caractéristiques, équipements, régie, localisation).
//
// Choix non évidents :
//  · Les champs de fiche (description, étage, charges…) NE viennent PAS de la
//    liste : `useMarketListingDetail` les lit à l'ouverture, par clé primaire.
//    La grille en charge 400 à la fois et `description` pèse ~1,5 Ko — la mettre
//    dans `CARD_COLS` coûterait ~600 Ko par recherche (CLAUDE.md §7).
//  · « Meublé » est gaté sur `=== true`, pas sur `!= null` comme le proto : la
//    colonne a un DEFAULT false, 78 342 annonces actives sur 78 354 sont donc
//    non-nulles et le proto afficherait « Meublé : Non » sur toute la base.
//  · « Réf. MEGGA » du proto n'est PAS reprise : aucune colonne `megga_ref`
//    n'existe: l'afficher fabriquerait un identifiant communicable au client.
//  · Les valeurs aberrantes des portails (étage 99, année 206…) sont filtrées en
//    amont par `plausible` / `plausibleDate` dans le mapper — ici tout champ
//    `null` est simplement masqué.
//  · Carte plein écran et lightbox sont PORTÉES dans `document.body` : la fiche
//    vit sous le track translaté du pager, où `position: fixed` deviendrait un
//    cadre local (même correctif que SgaOverlayHost côté atelier).

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import RechIcon from './RechIcon'
import MrhPhoto from './MrhPhoto'
import MrhLightbox from './MrhLightbox'
import { useMarketListingDetail } from '@/hooks/useMatchingRecherche'
import { formatCHF, formatDate } from '@/lib/utils'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { floorLabelKey, type MrhBien, type MrhBienDetail, type MrhContact } from './types'
import type { MrhSurf } from './mrhCtx'

// Carte réelle isolée + lazy → mapbox-gl ne charge qu'à l'ouverture d'une fiche avec token.
const MrhMapbox = lazy(() => import('./MrhMapbox'))
const HAS_MAPBOX = !!((import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || '')

/** Une ligne du bloc « Caractéristiques ». */
interface Spec { k: string; v: string; mono?: boolean }

/**
 * Description du portail — repliée à 4 lignes tant qu'elle dépasse ~320 signes.
 * La moyenne réelle est de 1 462 signes (max 9 335) : sans repli, la fiche
 * s'ouvre au milieu d'un pavé et le prix passe sous la ligne de flottaison.
 */
function MrhDescription({ text, sp }: { text: string; sp: SugarPalette }) {
  const { t } = useTranslation('matching')
  const [open, setOpen] = useState(false)
  const long = text.length > 320
  return (
    <div>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.65, color: sp.ink, textWrap: 'pretty', whiteSpace: 'pre-line', display: open || !long ? 'block' : '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: open || !long ? 'unset' : 4, overflow: 'hidden' }}>
        {text}
      </div>
      {long && (
        <button onClick={() => setOpen((v) => !v)} style={{ marginTop: 8, border: 0, background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', color: sp.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
          {open ? t('recherche.detail.readLess') : t('recherche.detail.readMore')}
        </button>
      )}
    </div>
  )
}

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
  /**
   * Banc d'essai : champs de fiche fournis au lieu d'être lus par clé primaire.
   * Sans ça, la moitié basse de la fiche — description, étage, charges,
   * disponibilité — reste vide au banc, et c'est justement la partie la plus
   * dense du plus gros fichier du périmètre.
   */
  detailDemo?: MrhBienDetail
}

export default function MrhExtDetail({ bien, sp, surf, dark, line, chipBg, ACC, ONACC, buyer, on, onToggle, onClose, detailDemo }: Props) {
  const { t } = useTranslation('matching')
  // `isPending`/`isError` ne sont pas décoratifs : la description s'insère AU-DESSUS
  // des caractéristiques, donc sans place réservée toute la fiche saute quand la
  // requête revient. Et un échec rendu comme une absence ferait affirmer à l'écran
  // que le portail n'a rien publié, sans l'avoir vérifié.
  // ⚠ `null` en id désactive la query — le banc ne doit pas interroger la base.
  const live = useMarketListingDetail(detailDemo ? null : bien.id)
  const detail = detailDemo ?? live.data
  const detailPending = detailDemo ? false : live.isPending
  const detailError = detailDemo ? false : live.isError

  const [lb, setLb] = useState(-1)
  const [mapOpen, setMapOpen] = useState(false)

  // Échap ferme la fiche — sauf si la carte plein écran est au-dessus (elle a
  // sa propre écoute et se ferme d'abord).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mapOpen) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, mapOpen])

  useEffect(() => {
    if (!mapOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMapOpen(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [mapOpen])

  const isRent = bien.transaction === 'location'
  const price = isRent ? bien.rent : bien.price
  const portalLabel = bien.source_portal === 'flatfox' ? 'Flatfox' : bien.source_portal === 'realadvisor' ? 'RealAdvisor' : (bien.source_portal || t('recherche.detail.portalFallback'))
  const openPortal = () => { const u = bien.source_url || ''; if (u) window.open(/^https?:/i.test(u) ? u : 'https://' + u, '_blank', 'noopener') }
  const subBg = dark ? 'rgba(255,255,255,.045)' : '#F7F8FA'
  const dot = dark ? 'rgba(255,255,255,.22)' : 'rgba(3,3,3,.22)'
  const ppm2 = bien.price_per_m2 || (price && bien.area ? Math.round(price / bien.area) : null)
  const priceOrig = bien.price_original
  const dropPct = priceOrig && price && priceOrig > price ? Math.round((1 - price / priceOrig) * 100) : null
  const priceLabel = price ? formatCHF(price) : t('recherche.detail.priceOnRequest')
  const agencyName = bien.agency || '—'
  const agencyInit = agencyName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const mapBg = dark ? '#12151B' : '#E7ECF2'
  const mapLine = dark ? 'rgba(255,255,255,.05)' : 'rgba(3,3,3,.06)'
  const photos = bien.photos
  const hasCoords = bien.lat != null && bien.lng != null

  // Mosaïque ajustée au nombre réel de vignettes : 16 843 annonces actives sur
  // 78 354 (21,5 %) ont 1 à 4 photos et 1 179 n'en ont aucune. Une grille figée à
  // 3 × 2 leur laisserait les deux tiers du bento en aplat vide.
  const thumbs = photos.slice(1, 5)
  const galCols = thumbs.length >= 3 ? '2fr 1fr 1fr' : thumbs.length >= 1 ? '2fr 1fr' : '1fr'
  const galRows = thumbs.length >= 2 ? '1fr 1fr' : '1fr'
  const galMainRow = thumbs.length >= 2 ? '1 / span 2' : '1'

  const onMarket = bien.days_on_market == null ? '—'
    : bien.days_on_market <= 0 ? t('recherche.detail.onMarketLessDay')
      : t('recherche.detail.onMarketDays', { count: bien.days_on_market })

  // Caractéristiques — grille plate libellé/valeur (le proto fusionne les faits
  // et les détails dans un seul bloc). Tout champ absent est simplement omis.
  const specs: Spec[] = useMemo(() => {
    const d = detail
    /** Étage : « Rez » au niveau 0, sous-sols nommés — routage testé dans types.ts. */
    const floorLabel = (n: number): string => {
      const f = floorLabelKey(n)
      return t(`recherche.detail.${f.key}`, { n: f.n })
    }
    const out: Spec[] = [
      { k: t('recherche.detail.factRooms'), v: bien.rooms != null ? String(bien.rooms) : '—' },
      { k: t('recherche.detail.factSurface'), v: bien.area ? bien.area + ' m²' : '—' },
    ]
    // `if (baths)` et non `!= null` : « Salles de bain : 0 » n'apprend rien.
    if (bien.baths) out.push({ k: t('recherche.detail.factBathrooms'), v: String(bien.baths) })
    if (d?.floor != null) out.push({ k: t('recherche.detail.factFloor'), v: floorLabel(d.floor) })
    if (d?.parking_count != null) out.push({ k: t('recherche.detail.factParking'), v: t('recherche.detail.parkingSpots', { count: d.parking_count }) })
    if (bien.land_surface) out.push({ k: t('recherche.detail.factLand'), v: bien.land_surface + ' m²' })
    out.push({ k: t('recherche.detail.factYear'), v: bien.year ? String(bien.year) : '—' })
    out.push({ k: isRent ? t('recherche.detail.factPpm2Rent') : t('recherche.detail.factPpm2Sale'), v: ppm2 ? formatCHF(ppm2) : '—' })

    out.push({ k: t('recherche.detail.dType'), v: bien.typeLabel })
    out.push({ k: t('recherche.detail.dTransaction'), v: isRent ? t('recherche.trans.rent') : t('recherche.trans.sale') })
    if (d?.year_renovated != null) out.push({ k: t('recherche.detail.dRenovated'), v: String(d.year_renovated) })
    if (d?.usable_surface != null) out.push({ k: t('recherche.detail.dUsableSurface'), v: d.usable_surface + ' m²' })
    if (d?.charges_monthly != null) out.push({ k: isRent ? t('recherche.detail.dChargesRent') : t('recherche.detail.dChargesSale'), v: formatCHF(d.charges_monthly) + t('recherche.card.perMonth') })
    // `=== true` et pas `!= null` — cf en-tête de fichier.
    if (d?.is_furnished === true) out.push({ k: t('recherche.detail.dFurnished'), v: t('recherche.detail.yes') })
    if (d?.availability_date) out.push({ k: t('recherche.detail.dAvailability'), v: formatDate(d.availability_date) })
    out.push({ k: t('recherche.detail.dLocality'), v: [bien.postal_code, bien.city].filter(Boolean).join(' ') || bien.city || '—' })
    out.push({ k: t('recherche.detail.dCanton'), v: bien.canton || '—' })
    out.push({ k: t('recherche.detail.dOnMarket'), v: onMarket })
    if (d?.visit_contact_name) out.push({ k: t('recherche.detail.dVisitContact'), v: d.visit_contact_name })
    out.push({ k: t('recherche.detail.dPortalRef'), v: bien.ref || d?.agency_reference || '—', mono: true })
    return out
  }, [bien, detail, isRent, ppm2, onMarket, t])

  const selectBtn = (block?: boolean) => buyer ? (
    <button onClick={onToggle}
      style={{ marginTop: block ? 10 : 0, width: block ? '100%' : undefined, height: block ? 46 : 44, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: on ? chipBg : 'transparent', color: sp.ink, boxShadow: on ? 'none' : 'inset 0 0 0 1px ' + sp.solidBorder, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap' }}>
      <RechIcon name={on ? 'check' : 'plus'} size={15} stroke={sp.ink} />
      {on ? (block ? t('recherche.detail.inSelectionOf', { name: buyer.firstName }) : t('recherche.detail.inSelection')) : t('recherche.detail.addToSelection')}
    </button>
  ) : null

  const eyebrow = (label: string) => (
    <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, marginBottom: 12 }}>{label}</div>
  )
  const rule = <div style={{ height: 1, background: line, margin: '22px 0' }} />

  /**
   * Géométrie de la bande de pilules — UNE seule source, lue à la fois par
   * `locChips` et par `chromeInset`. Sans ça, changer la hauteur d'une pilule
   * recouvre à nouveau l'attribution Mapbox, en silence : exactement le défaut
   * que `chromeInset` existe pour corriger.
   */
  const CHIPS = { sm: { edge: 14, h: 30 }, lg: { edge: 18, h: 34 } }
  const chipsBox = (big?: boolean) => (big ? CHIPS.lg : CHIPS.sm)
  /** Hauteur à laisser libre sous la carte pour le logo et l'attribution Mapbox. */
  const chromeInset = (big?: boolean) => chipsBox(big).edge + chipsBox(big).h + 4

  /** Pilules adresse + coordonnées, posées au bas de la carte. */
  const locChips = (big?: boolean): ReactNode => {
    const box = chipsBox(big)
    return (
      <div style={{ position: 'absolute', left: box.edge, right: box.edge, bottom: box.edge, zIndex: 2, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: box.h, padding: big ? '0 15px' : '0 13px', borderRadius: 999, maxWidth: '100%', background: dark ? 'rgba(3,3,3,.8)' : 'rgba(255,255,255,.94)', color: sp.ink, fontSize: big ? 'var(--crm-text-md)' : 'var(--crm-text-sm)', fontWeight: 600, boxShadow: '0 2px 8px rgba(3,3,3,.12)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bien.addr}</span>
        {hasCoords && (
          <span style={{ display: 'inline-flex', alignItems: 'center', height: box.h - 4, padding: big ? '0 13px' : '0 11px', borderRadius: 999, background: dark ? 'rgba(3,3,3,.66)' : 'rgba(255,255,255,.85)', color: sp.sub, fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
            {(bien.lat as number).toFixed(4) + ', ' + (bien.lng as number).toFixed(4)}
          </span>
        )}
      </div>
    )
  }

  /** Fond de carte stylisé — repli sans token Mapbox, et décor du plein écran. */
  const mapSurface = (big?: boolean): ReactNode => (
    <>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${mapLine} 1px, transparent 1px), linear-gradient(90deg, ${mapLine} 1px, transparent 1px)`, backgroundSize: big ? '48px 48px' : '34px 34px' }} />
      <div style={{ position: 'absolute', top: '-12%', left: '20%', width: '62%', height: '160%', transform: 'rotate(22deg)', background: mapLine }} />
      <div style={{ position: 'absolute', top: '42%', left: '-10%', width: '130%', height: big ? 16 : 12, background: mapLine }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-100%)' }}>
        <svg width={big ? 44 : 30} height={big ? 44 : 30} viewBox="0 0 24 24" fill={sp.ink} style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))' }}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.6" fill={mapBg} />
        </svg>
      </div>
    </>
  )

  const pinSvg = (
    <svg width="30" height="30" viewBox="0 0 24 24" fill={sp.ink} style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))' }}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.6" fill={mapBg} />
    </svg>
  )

  return (
    <div className="mrh-detail" style={{ position: 'absolute', inset: 0, zIndex: 70, background: sp.pageBg, display: 'flex', flexDirection: 'column', animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both', color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '18px 30px 12px' }}>
        <button onClick={onClose} title={t('recherche.detail.back')} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: surf.card, boxShadow: surf.shadow }}>
          <RechIcon name="chevronL" size={18} stroke={sp.ink} />
        </button>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>{t('recherche.detail.back')}</div>
        <div style={{ flex: 1 }} />
        {selectBtn(false)}
      </div>

      <div className="mrh-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 30px 34px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>

          {/* ── Bento 1 · Affiche (collage photo + identité + prix) ── */}
          <div style={{ background: surf.card, borderRadius: 26, boxShadow: dark ? surf.shadow : '0 24px 60px rgba(3,3,3,0.10), 0 6px 18px rgba(3,3,3,0.06)', padding: 14 }}>
            <div className="mrh-gallery" style={{ display: 'grid', gridTemplateColumns: galCols, gridTemplateRows: galRows, gap: 8, height: 420 }}>
              <button className="mrh-gal-main" onClick={() => photos.length && setLb(0)} title={t('recherche.detail.seePhotos')} style={{ gridColumn: '1', gridRow: galMainRow, position: 'relative', border: 0, cursor: photos.length ? 'zoom-in' : 'default', padding: 0, borderRadius: 16, overflow: 'hidden', background: subBg }}>
                <MrhPhoto url={photos[0]} dark={dark} alt={bien.title} fallbackBg={subBg} fallbackInk={sp.sub} />
                {bien.status === 'price_reduced' && (
                  <span style={{ position: 'absolute', top: 16, left: 16, display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 13px', borderRadius: 999, background: '#C45A00', color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600, boxShadow: '0 2px 8px rgba(3,3,3,.18)' }}>{t('recherche.card.priceDrop')}</span>
                )}
                {photos.length > 0 && (
                  <span style={{ position: 'absolute', bottom: 16, right: 16, display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 13px', borderRadius: 999, background: 'rgba(3,3,3,.72)', color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
                    <RechIcon name="layers" size={13} stroke="#fff" /> {t('recherche.card.photos', { count: photos.length })}
                  </span>
                )}
              </button>
              {thumbs.map((p, i) => {
                const overflow = i === 3 && photos.length > 5
                // À 3 vignettes, la dernière prend les deux colonnes de la 2ᵉ rangée
                // — sinon il resterait une cellule vide en bas à droite.
                const wide = thumbs.length === 3 && i === 2
                return (
                  <button key={p + String(i)} className="mrh-gal-thumb" onClick={() => setLb(i + 1)} title={t('recherche.detail.seePhotos')} style={{ position: 'relative', gridColumn: wide ? 'span 2' : undefined, border: 0, cursor: 'zoom-in', padding: 0, borderRadius: 12, overflow: 'hidden', background: subBg }}>
                    <MrhPhoto url={p} dark={dark} alt="" fallbackBg={subBg} fallbackInk={sp.sub} />
                    {overflow && (
                      <span style={{ position: 'absolute', inset: 0, background: 'rgba(6,7,9,.52)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.5 }}>{'+' + (photos.length - 5)}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mrh-affiche" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 80, flexWrap: 'wrap', padding: '40px 22px 24px' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 600, letterSpacing: -0.8, color: sp.ink, lineHeight: 1.1 }}>{bien.title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--crm-text-lg)', color: sp.sub, marginTop: 8, fontWeight: 600 }}>
                  <RechIcon name="mapPin" size={15} stroke={sp.sub} /> {bien.addr}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub, marginBottom: 5 }}>
                  {isRent ? t('recherche.detail.priceCaptionRent') : t('recherche.detail.priceCaptionSale')}
                </div>
                <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: sp.ink, letterSpacing: -0.8, lineHeight: 1, whiteSpace: 'nowrap' }}>{priceLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {isRent && price ? <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 600 }}>{t('recherche.detail.perMonthLong')}</span> : null}
                  {priceOrig ? <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600, textDecoration: 'line-through' }}>{formatCHF(priceOrig)}</span> : null}
                  {dropPct ? <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: '#C45A00', color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>{'−' + dropPct + ' %'}</span> : null}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bento 2 · Corps (lecture + rail régie, puis localisation) ── */}
          <div style={{ marginTop: 24, background: surf.card, borderRadius: 22, boxShadow: surf.shadow, padding: 24 }}>
            <div className="mrh-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>
                {detailPending ? (
                  // Place réservée pendant le chargement : 4 lignes, exactement la
                  // hauteur du clamp de MrhDescription, pour que l'arrivée du texte
                  // ne pousse rien vers le bas.
                  <>
                    {eyebrow(t('recherche.detail.sectionDescription'))}
                    <div aria-hidden="true" style={{ height: 95, borderRadius: 10, background: chipBg }} />
                    {rule}
                  </>
                ) : detailError ? (
                  <>
                    {eyebrow(t('recherche.detail.sectionDescription'))}
                    <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{t('recherche.detail.detailError')}</div>
                    {rule}
                  </>
                ) : detail?.description ? (
                  <>
                    {eyebrow(t('recherche.detail.sectionDescription'))}
                    <MrhDescription text={detail.description} sp={sp} />
                    {rule}
                  </>
                ) : null}
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, marginBottom: 14 }}>{t('recherche.detail.sectionSpecs')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px 22px' }}>
                  {specs.map((s) => (
                    <div key={s.k} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{s.k}</div>
                      <div title={s.v} style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, marginTop: 4, letterSpacing: -0.2, fontFamily: s.mono ? "'JetBrains Mono', monospace" : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {bien.features.length > 0 && (
                  <>
                    {rule}
                    {eyebrow(t('recherche.detail.equip'))}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {bien.features.map((f) => (
                        <span key={f} style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 15px', borderRadius: 999, background: chipBg, color: sp.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* sticky : la colonne de gauche fait jusqu'à ~9 300 signes de
                  description plus une vingtaine de caractéristiques. Sans ça, les
                  deux seules actions de la fiche — ouvrir le portail, ajouter à la
                  sélection — sortent de l'écran dès qu'on déroule pour lire. */}
              <div style={{ position: 'sticky', top: 6 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{t('recherche.detail.agency')}</div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: ACC, color: ONACC, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{agencyInit || '—'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agencyName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, fontSize: 'var(--crm-text-sm)', color: sp.sub, fontWeight: 600, marginTop: 2 }}>
                      <span>{portalLabel}</span>
                      {bien.postedAt ? <><span style={{ color: dot }}>·</span><span>{bien.postedAt}</span></> : null}
                    </div>
                  </div>
                </div>
                {bien.agency_phone ? (
                  <a href={'tel:' + bien.agency_phone.replace(/\s+/g, '')} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, height: 42, padding: '0 14px', borderRadius: 12, background: chipBg, color: sp.ink, textDecoration: 'none', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                    <RechIcon name="phone" size={15} stroke={sp.ink} /> {bien.agency_phone}
                  </a>
                ) : null}
                <button onClick={openPortal} style={{ marginTop: 18, width: '100%', height: 46, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: ACC, color: ONACC, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {t('recherche.detail.openOn', { portal: portalLabel })} <RechIcon name="arrowR" size={15} stroke={ONACC} />
                </button>
                {selectBtn(true)}
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid ' + line }}>
              {eyebrow(t('recherche.detail.location'))}
              <div onClick={() => setMapOpen(true)} title={t('recherche.detail.expandMap')}
                style={{ position: 'relative', height: 380, borderRadius: 18, overflow: 'hidden', background: mapBg, boxShadow: surf.shadow, cursor: 'zoom-in' }}>
                {HAS_MAPBOX && hasCoords ? (
                  <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: mapBg }} />}>
                    <MrhMapbox
                      center={{ lng: bien.lng as number, lat: bien.lat as number, zoom: 14 }}
                      markers={[{ id: 'loc', lng: bien.lng as number, lat: bien.lat as number, anchor: 'bottom', el: pinSvg }]}
                      dark={dark} radius={18} interactive={false}
                      chromeInset={chromeInset()}
                      overlay={locChips()}
                      // pas de `locChips` ici : MrhMapbox rend `{fallback}{overlay}`,
                      // les pilules se dédoubleraient si la carte échoue.
                      fallback={mapSurface()}
                    />
                  </Suspense>
                ) : (
                  <>{mapSurface()}{locChips()}</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {lb >= 0 && photos.length > 0 && <MrhLightbox photos={photos} index={lb} onIndex={setLb} onClose={() => setLb(-1)} />}

      {mapOpen && createPortal(
        // Pas de « clic à côté pour fermer » : la carte occupe tout le calque, il
        // n'y a aucun à-côté. Le bouton et Échap sont les deux sorties.
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: mapBg, animation: 'sgFadeUp .22s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {HAS_MAPBOX && hasCoords ? (
              <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: mapBg }} />}>
                <MrhMapbox
                  center={{ lng: bien.lng as number, lat: bien.lat as number, zoom: 15 }}
                  markers={[{ id: 'loc-big', lng: bien.lng as number, lat: bien.lat as number, anchor: 'bottom', el: pinSvg }]}
                  // zoom à GAUCHE : le bouton « Fermer » occupe le coin haut-droit
                  // et recouvrirait les contrôles (même contexte d'empilement).
                  dark={dark} radius={0} controls controlsPosition="top-left"
                  chromeInset={chromeInset(true)}
                  overlay={locChips(true)}
                  fallback={mapSurface(true)}
                />
              </Suspense>
            ) : (
              <>{mapSurface(true)}{locChips(true)}</>
            )}
          </div>
          <button onClick={() => setMapOpen(false)} title={t('recherche.detail.close')}
            style={{ position: 'absolute', top: 18, right: 18, zIndex: 2, width: 42, height: 42, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: dark ? 'rgba(3,3,3,.72)' : 'rgba(255,255,255,.94)', boxShadow: '0 4px 14px rgba(3,3,3,.2)' }}>
            <RechIcon name="close" size={18} stroke={dark ? '#fff' : '#030303'} />
          </button>
        </div>,
        document.body,
      )}

      <style>{'@media (max-width: 900px){ .mrh-detail-grid{ grid-template-columns: 1fr !important; } .mrh-affiche{ gap: 24px !important; } } @media (max-width: 820px){ .mrh-gallery{ grid-template-columns: 1fr !important; grid-template-rows: auto !important; height: auto !important; } .mrh-gallery .mrh-gal-thumb{ display: none !important; } .mrh-gallery .mrh-gal-main{ grid-row: auto !important; aspect-ratio: 16 / 10; } }'}</style>
    </div>
  )
}
