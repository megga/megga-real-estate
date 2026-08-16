/**
 * Fiche bien mobile et ses atomes de présentation (Card, Eyebrow, RibbonSpec,
 * Stat, Row) + la visionneuse plein écran (Lightbox). `MobileBienVitrineScreen`
 * porte le câblage Supabase ; voir sa docstring pour la portée v1 et les différés.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useProperty } from '@/hooks/useProperties'
import { usePropertyStats } from '@/hooks/usePropertyStats'
import type { Property } from '@/types/listing'
import { formatCHF, formatRent, formatDate } from '@/lib/utils'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import CrmActionMenu from '../primitives/CrmActionMenu'
import { statusTone, typeKey, type BienType } from './shared'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface MobileBienVitrineScreenProps {
  /** Donnée figée (harnais /dev/mobile, no-auth) — bypasse useProperty. */
  demoData?: Property
}

/** Coerce une valeur inconnue vers un nombre fini, sinon null (tolère les string numériques). */
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/**
 * Fiche bien mobile (/dashboard/listings/:id) — re-skin Sugar Pure de la page
 * déjà câblée (ListingDetailPage). Lecture seule v1 : hero + galerie,
 * identité, caractéristiques, performance (usePropertyStats), mandat, diffusion.
 * C2PA affiché UNIQUEMENT si `c2pa_verified` (jamais fabriqué). Différés :
 * acheteurs/matches, vendeur, édition inline, planif. visite in-fiche, carte.
 */
export function MobileBienVitrineScreen({ demoData }: MobileBienVitrineScreenProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('listings')
  const { tk } = useMobileTokens()

  const { data: live, isLoading, isError } = useProperty(demoData ? undefined : id)
  const { stats } = usePropertyStats(demoData ? undefined : id)
  const bien = demoData ?? live

  const [menuOpen, setMenuOpen] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const photos = bien?.photos ?? []
  const isRent = bien?.transaction_type === 'rent'
  const pricePerM2 = useMemo(() => {
    if (!bien || isRent) return null
    const p = num(bien.price)
    const s = num(bien.surface_m2)
    return p && s ? Math.round(p / s) : null
  }, [bien, isRent])

  if (!demoData && isLoading) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, padding: 'var(--crm-space-3xl) var(--crm-space-4xl)' }}>
        <div style={{ height: 268, borderRadius: 'var(--crm-radius-5xl)', background: tk.cardSubtle }} />
        <div style={{ height: 28, width: '70%', borderRadius: 'var(--crm-radius-sm)', background: tk.cardSubtle, marginTop: 18 }} />
        <div style={{ height: 16, width: '50%', borderRadius: 'var(--crm-radius-sm)', background: tk.cardSubtle, marginTop: 12 }} />
      </div>
    )
  }
  if (!bien) {
    return (
      <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{isError ? t('mobile.detailError') : t('detail.notFound')}</div>
        <button type="button" onClick={() => navigate('/dashboard/listings')} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>
          {t('title')}
        </button>
      </div>
    )
  }

  const status = bien.status
  const priceLabel = isRent ? formatRent(bien.price) : formatCHF(bien.price)
  const charges = num(bien.charges_monthly)

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative' }}>
      {/* En-tête collant */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px', background: tk.headerBg, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button type="button" onClick={() => navigate('/dashboard/listings')} aria-label={t('common:actions.back')} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="chevron-left" size={20} color={tk.ink} />
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setMenuOpen(true)} aria-label={t('common:actions.options')} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, background: tk.card, boxShadow: tk.shadowSm, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <MEIcon name="more-horizontal" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: '0 18px 30px', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
        {/* Hero + filmstrip */}
        <div>
          <button
            type="button"
            onClick={() => photos.length && setLightbox(0)}
            style={{ position: 'relative', width: '100%', height: 268, borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', background: tk.cardSubtle, boxShadow: tk.shadow, border: 0, padding: 0, cursor: photos.length ? 'pointer' : 'default', display: 'block' }}
          >
            {photos[0] ? (
              <img src={photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                <MEIcon name="home" size={48} color={tk.ghost} />
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(3,3,3,0.30) 0%, rgba(3,3,3,0) 32%, rgba(3,3,3,0) 60%, rgba(3,3,3,0.18) 100%)' }} />
            <div style={{ position: 'absolute', top: 13, left: 13, display: 'flex', gap: 'var(--crm-space-md)' }}>
              <span style={{ padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: statusTone(status), color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>{t(`status.${status}`, { defaultValue: status })}</span>
              {bien.c2pa_verified ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(255,255,255,0.95)', color: MXC_COLOR.n100, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
                  <MEIcon name="shield" size={13} color="#0E9F6E" />
                  {t('mobile.c2pa')}
                </span>
              ) : null}
            </div>
            {photos.length ? (
              <span style={{ position: 'absolute', right: 13, bottom: 13, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 30, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(255,255,255,0.95)', color: MXC_COLOR.n100, fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>
                <MEIcon name="gallery" size={14} color={MXC_COLOR.n100} />
                {t('mobile.photosCount', { count: photos.length })}
              </span>
            ) : null}
          </button>

          {photos.length > 1 ? (
            <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', overflowX: 'auto', marginTop: 10, paddingBottom: 'var(--crm-space-2xs)', scrollbarWidth: 'none' }}>
              {photos.slice(0, 12).map((p, i) => (
                <button key={i} type="button" onClick={() => setLightbox(i)} aria-label={t('mobile.photoIndex', { i: i + 1, total: photos.length })} style={{ flexShrink: 0, width: 66, height: 48, borderRadius: 'var(--crm-radius-sm)', overflow: 'hidden', border: 0, padding: 0, cursor: 'pointer', background: tk.cardSubtle }}>
                  <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Identité */}
        <div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted}}>
            {[bien.canton, t(isRent ? 'mobile.txRent' : 'mobile.txSale'), t(typeKey(frType(bien.type)))].filter(Boolean).join(' · ')}
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, color: tk.ink, letterSpacing: -0.7, lineHeight: 1.15 }}>{bien.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginTop: 6 }}>
            <MEIcon name="location" size={14} color={tk.muted} strokeWidth={1.7} />
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted }}>{[bien.address, bien.city].filter(Boolean).join(', ')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)', flexWrap: 'wrap', marginTop: 14 }}>
            <span style={{ fontSize: 'var(--crm-text-7xl)', fontWeight: 500, color: tk.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{priceLabel}</span>
            {charges ? <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted }}>{t('mobile.chargesLine', { value: formatCHF(charges) })}</span> : null}
            {pricePerM2 ? <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>{t('mobile.perM2', { value: formatCHF(pricePerM2) })}</span> : null}
          </div>
        </div>

        {/* Bande de specs */}
        <div style={{ display: 'flex', gap: 'var(--crm-space-6xl)', overflowX: 'auto', paddingTop: 'var(--crm-space-3xl)', borderTop: `1px solid ${tk.hair}`, scrollbarWidth: 'none' }}>
          <RibbonSpec icon="surface" label={t('mobile.spec.surface')} value={`${num(bien.surface_m2) ?? '—'}`} tk={tk} />
          <RibbonSpec icon="home" label={t('mobile.spec.rooms')} value={`${num(bien.rooms) ?? '—'}`} tk={tk} />
          <RibbonSpec icon="bed" label={t('mobile.spec.beds')} value={`${num(bien.bedrooms) ?? '—'}`} tk={tk} />
          <RibbonSpec icon="bath" label={t('mobile.spec.baths')} value={`${num(bien.bathrooms) ?? '—'}`} tk={tk} />
          {bien.year_built ? <RibbonSpec icon="clock" label={t('mobile.spec.year')} value={String(bien.year_built)} tk={tk} /> : null}
          {bien.energy_class ? <RibbonSpec icon="bolt" label={t('mobile.spec.energy')} value={bien.energy_class} tk={tk} /> : null}
        </div>

        {/* Description */}
        {bien.description ? (
          <Card tk={tk}>
            <Eyebrow tk={tk}>{t('mobile.descriptionTitle')}</Eyebrow>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.inkSoft, lineHeight: 1.6 }}>{bien.description}</p>
            {bien.features?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', marginTop: 12 }}>
                {bien.features.map((f) => (
                  <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, color: tk.inkSoft, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
                    <MEIcon name="check" size={12} color={tk.inkSoft} />
                    {f}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* Performance */}
        <Card tk={tk}>
          <Eyebrow tk={tk}>{t('mobile.performanceTitle')}</Eyebrow>
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
            <Stat tk={tk} icon="eye" label={t('mobile.stat.views')} value={stats?.views ?? 0} />
            <Stat tk={tk} icon="heart" label={t('mobile.stat.favorites')} value={stats?.favorites ?? 0} />
            <Stat tk={tk} icon="calendar" label={t('mobile.stat.visits')} value={stats?.visitRequests ?? 0} />
          </div>
        </Card>

        {/* Mandat */}
        {bien.mandate_type ? (
          <Card tk={tk}>
            <Eyebrow tk={tk}>{t('mobile.mandateTitle')}</Eyebrow>
            <div style={{ marginTop: 4 }}>
              <Row tk={tk} label={t('mobile.mandate.type')} value={bien.mandate_type} />
              {bien.mandate_commission_pct != null ? <Row tk={tk} label={t('mobile.mandate.commission')} value={`${bien.mandate_commission_pct} %`} /> : null}
              {bien.mandate_signed_at ? <Row tk={tk} label={t('mobile.mandate.signedAt')} value={formatDate(bien.mandate_signed_at)} /> : null}
              {bien.mandate_expires_at ? <Row tk={tk} label={t('mobile.mandate.expiresAt')} value={formatDate(bien.mandate_expires_at)} last /> : null}
            </div>
          </Card>
        ) : null}

        {/* Diffusion */}
        <Card tk={tk}>
          <Eyebrow tk={tk}>{t('mobile.diffusionTitle')}</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: bien.published_at ? tk.goal : tk.ghost }} />
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink }}>
              {bien.published_at ? t('mobile.diffusionOnline', { date: formatDate(bien.published_at) }) : t('mobile.diffusionOffline')}
            </span>
          </div>
        </Card>
      </div>

      {/* Menu ••• */}
      <CrmActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={bien.title}
        items={[
          { id: 'edit', icon: 'edit', label: t('mobile.edit') },
          { id: 'visit', icon: 'calendar', label: t('mobile.scheduleVisit') },
        ]}
        onAction={(idAction) => {
          setMenuOpen(false)
          if (demoData) return
          if (idAction === 'edit') navigate(`/dashboard/listings/${bien.id}/edit`)
          else if (idAction === 'visit') navigate(`/dashboard/visits/new?bienId=${bien.id}`)
        }}
      />

      {/* Lightbox */}
      {lightbox !== null && photos.length ? (
        <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} t={t} />
      ) : null}
    </div>
  )
}

// CrmBien-style FR type keys aren't on Property; map PropertyType → shared typeKey input.
function frType(t: Property['type']): BienType {
  const m: Record<string, BienType> = {
    apartment: 'appartement', house: 'maison', villa: 'villa', commercial: 'commercial',
    office: 'office', parking: 'parking', storage: 'storage', land: 'land',
  }
  return m[t] ?? 'appartement'
}

type Tk = ReturnType<typeof useMobileTokens>['tk']

/** Carte de section (fond, bordure, coins arrondis). */
function Card({ tk, children }: { tk: Tk; children: ReactNode }) {
  return <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-5xl)' }}>{children}</div>
}
/** Sur-titre de section en petites capitales. */
function Eyebrow({ tk, children }: { tk: Tk; children: ReactNode }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>{children}</div>
}
/** Cellule de la bande de specs : icône + valeur + label. */
function RibbonSpec({ icon, label, value, tk }: { icon: 'surface' | 'home' | 'bed' | 'bath' | 'clock' | 'bolt'; label: string; value: string; tk: Tk }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)', minWidth: 52 }}>
      <MEIcon name={icon} size={21} color={tk.inkSoft} strokeWidth={1.6} />
      <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted}}>{label}</span>
    </div>
  )
}
/** Tuile de performance : icône + valeur + label. */
function Stat({ tk, icon, label, value }: { tk: Tk; icon: 'eye' | 'heart' | 'calendar'; label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: tk.cardSubtle, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-2xl) var(--crm-space-xl)' }}>
      <MEIcon name={icon} size={18} color={tk.muted} />
      <div style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 500, color: tk.ink, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, marginTop: 2 }}>{label}</div>
    </div>
  )
}
/** Ligne clé/valeur d'un bloc (mandat…) ; séparateur bas sauf `last`. */
function Row({ tk, label, value, last }: { tk: Tk; label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-lg) 0', borderBottom: last ? 'none' : `1px solid ${tk.cardSubtle}` }}>
      <span style={{ fontSize: 'var(--crm-text-md)', color: tk.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 'var(--crm-text-lg)', color: tk.ink, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

/** Visionneuse photo plein écran : swipe tactile, flèches clavier, Échap pour fermer. */
function Lightbox({ photos, index, onClose, onIndex, t }: { photos: string[]; index: number; onClose: () => void; onIndex: (i: number) => void; t: TFunction }) {
  const touch = useRef<number | null>(null)
  const refPiegeFocus = useFocusTrap(true, onClose)
  const go = (dx: number) => {
    if (dx < -40) onIndex((index + 1) % photos.length)
    else if (dx > 40) onIndex((index - 1 + photos.length) % photos.length)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length)
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onIndex])
  return (
    <div
      ref={refPiegeFocus}
      role="dialog"
      aria-modal="true"
      aria-label={t('mobile.photoViewer')}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,2,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
      onTouchEnd={(e) => { if (touch.current != null) { go(e.changedTouches[0].clientX - touch.current); touch.current = null } }}
    >
      <img src={photos[index]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose() }} aria-label={t('common:actions.cancel')} style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: 16, width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'rgba(255,255,255,0.14)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
        <MEIcon name="close" size={20} color="#fff" />
      </button>
      <span style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 18px)', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.85)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {index + 1} / {photos.length}
      </span>
    </div>
  )
}
