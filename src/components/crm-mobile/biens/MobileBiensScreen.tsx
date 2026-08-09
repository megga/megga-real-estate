import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import { formatCHF, formatRent } from '@/lib/utils'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import SgActionMenu from '../primitives/SgActionMenu'
import { statusTone } from '../bien/shared'

type StatusFilter = 'all' | 'active' | 'reserved' | 'draft'
const FILTERS: StatusFilter[] = ['all', 'active', 'reserved', 'draft']
const FILTER_KEY: Record<StatusFilter, string> = { all: 'tab.all', active: 'tab.active', reserved: 'tab.reserved', draft: 'tab.drafts' }

// Photos de démo (harnais /dev/mobile) — aucune donnée réelle.
const U = (id: string) => `https://images.unsplash.com/${id}?w=900&q=80`
const DEMO: CrmBien[] = [
  { id: 'p1', ref: 'MG-001', status: 'active', type: 'maison', transaction: 'vente', title: 'Maison familiale', addr: 'Av. Cardinal-Mermillod 22, Carouge', canton: 'GE', price: 1850000, charges: null, area: 180, rooms: 6, beds: 4, baths: 2, year: 2008, energy: 'B', ownerContactId: null, mandat: { type: 'exclusif' }, visibility: 'agency', stats: { views: 240, favorites: 18, visitRequests: 5 }, photoCount: 12, signedPhotoCount: 12, coverPhoto: U('photo-1568605114967-8130f3a36994'), health: { overall: 88, label: 'chaud', dataCompleteness: 0.8 }, accent: '#0041D9' },
  { id: 'p2', ref: 'MG-002', status: 'active', type: 'appartement', transaction: 'location', title: '3 pièces meublé', addr: 'Rue de Berne 4, Pâquis', canton: 'GE', price: null, rent: 3200, charges: 220, area: 75, rooms: 3, beds: 2, baths: 1, year: 1995, energy: 'C', ownerContactId: null, mandat: { type: 'simple' }, visibility: 'agency', stats: { views: 130, favorites: 9, visitRequests: 3 }, photoCount: 8, signedPhotoCount: 8, coverPhoto: U('photo-1502672260266-1c1ef2d93688'), health: { overall: 71, label: 'a_animer', dataCompleteness: 0.6 }, accent: '#0891B2' },
  { id: 'p3', ref: 'MG-003', status: 'reserved', type: 'villa', transaction: 'vente', title: 'Villa contemporaine', addr: 'Route de la Capite, Cologny', canton: 'GE', price: 3850000, charges: null, area: 240, rooms: 7, beds: 5, baths: 3, year: 2019, energy: 'A', ownerContactId: null, mandat: { type: 'exclusif' }, visibility: 'agency', stats: { views: 410, favorites: 32, visitRequests: 11 }, photoCount: 20, signedPhotoCount: 20, coverPhoto: U('photo-1512917774080-9991f1c4c750'), health: { overall: 94, label: 'chaud', dataCompleteness: 0.9 }, accent: '#C45A00' },
  { id: 'p4', ref: 'MG-004', status: 'draft', type: 'appartement', transaction: 'vente', title: '4 pièces à rénover', addr: 'Rue de la Servette 90, Genève', canton: 'GE', price: 720000, charges: null, area: 95, rooms: 4, beds: 2, baths: 1, year: 1972, energy: 'E', ownerContactId: null, mandat: { type: 'recherche' }, visibility: 'private', stats: { views: 0, favorites: 0, visitRequests: 0 }, photoCount: 0, signedPhotoCount: 0, coverPhoto: null, health: null, accent: '#6366F1' },
]

/** Libellé de prix : loyer si location, sinon prix de vente. */
function priceLabel(b: CrmBien): string {
  return b.transaction === 'location' ? formatRent(b.rent) : formatCHF(b.price)
}

/**
 * « Mes biens » mobile (sous l'onglet « Plus ») — galerie de la portefeuille,
 * câblée `useBiensSugar` (données réelles, RLS agence). Carte → fiche
 * (/dashboard/listings/:id). FAB → wizard de création. Seeds derrière `demo`.
 * v1 : liste + recherche + filtres de statut ; gestes destructifs (dupliquer,
 * statut, supprimer) différés (mutations non exposées par useBiensSugar).
 */
export function MobileBiensScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('listings')
  const { tk } = useMobileTokens()
  const { biens, isLoading, isError, refetch } = useBiensSugar()

  const all = demo ? DEMO : biens
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [menuBien, setMenuBien] = useState<CrmBien | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((b) => {
      if (filter !== 'all' && b.status !== filter) return false
      if (!q) return true
      return [b.title, b.addr, b.ref].some((s) => s?.toLowerCase().includes(q))
    })
  }, [all, filter, query])

  const showLoading = !demo && isLoading && all.length === 0
  const showError = !demo && isError

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative', minHeight: '70vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button
          type="button"
          onClick={() => openSugarSearch()}
          aria-label={t('common:nav.search')}
          style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="search" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>
          {t('title')}
        </h1>
        <div style={{ marginTop: 7 }}>
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.inkSoft }}>
            {t('mobile.subtitle', { count: filtered.length, total: all.length })}
          </span>
        </div>
      </div>

      {/* Recherche */}
      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-4xl) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', height: 46, padding: '0 var(--crm-space-2xl)', background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: tk.shadowSm }}>
          <MEIcon name="search" size={16} color={tk.muted} strokeWidth={1.9} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mobile.searchPlaceholder')}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }}
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common:actions.cancel')} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <MEIcon name="close" size={16} color={tk.muted} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '12px 0 0', padding: 'var(--crm-space-2xs) var(--crm-space-4xl) var(--crm-space-xs)', scrollbarWidth: 'none' }}>
        {FILTERS.map((f) => {
          const on = f === filter
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{ flexShrink: 0, height: 38, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: on ? 800 : 700, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.ink, boxShadow: on ? tk.shadow : tk.shadowSm, transition: 'background .2s ease' }}
            >
              {t(FILTER_KEY[f])}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-4xl) 0' }}>
        {showLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 240, borderRadius: 'var(--crm-radius-5xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />
            ))}
          </div>
        ) : showError ? (
          <div style={{ textAlign: 'center', padding: '48px 12px' }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.3 }}>{t('mobile.errorTitle')}</div>
            <button type="button" onClick={refetch} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}>
              {t('mobile.retry')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: tk.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <MEIcon name="home" size={24} color={tk.muted} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink, marginTop: 14 }}>{t('mobile.emptyTitle')}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, marginTop: 5, maxWidth: 240, marginInline: 'auto', lineHeight: 1.45 }}>{t('mobile.emptyDesc')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
            {filtered.map((b) => (
              <BienCard key={b.id} b={b} t={t} onOpen={() => { if (!demo) navigate(`/dashboard/listings/${b.id}`) }} onMenu={() => setMenuBien(b)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB — créer un bien (wizard réel) */}
      {!showError ? (
        <button
          type="button"
          onClick={() => { if (!demo) navigate('/dashboard/listings/new') }}
          aria-label={t('add_button', { defaultValue: 'Ajouter un bien' })}
          style={{ position: 'fixed', right: 18, bottom: 'calc(100px + env(safe-area-inset-bottom))', zIndex: 54, width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: tk.accent, color: tk.accentInk, boxShadow: tk.shadowLg, display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="plus" size={24} color={tk.accentInk} strokeWidth={2.2} />
        </button>
      ) : null}

      <SgActionMenu
        open={menuBien !== null}
        onClose={() => setMenuBien(null)}
        title={menuBien?.title}
        subtitle={menuBien?.ref}
        items={[
          { id: 'open', icon: 'eye', label: t('mobile.viewListing') },
          { id: 'edit', icon: 'edit', label: t('mobile.edit') },
        ]}
        onAction={(id) => {
          const b = menuBien
          setMenuBien(null)
          if (!b || demo) return
          if (id === 'open') navigate(`/dashboard/listings/${b.id}`)
          else if (id === 'edit') navigate(`/dashboard/listings/${b.id}/edit`)
        }}
      />
    </div>
  )
}

/** Puce spec compacte : icône + valeur (surface, pièces…). */
function Spec({ icon, value, color }: { icon: 'surface' | 'home' | 'bed' | 'bath'; value: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
      <MEIcon name={icon} size={15} color={color} strokeWidth={1.8} />
      <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color }}>{value}</span>
    </span>
  )
}

/** Carte bien de la galerie : couverture, statut, prix, specs et score de santé ; ••• ouvre le menu contextuel. */
function BienCard({ b, t, onOpen, onMenu }: { b: CrmBien; t: TFunction; onOpen: () => void; onMenu: () => void }) {
  const { tk } = useMobileTokens()
  const tone = statusTone(b.status)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      style={{ background: tk.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: tk.shadow, overflow: 'hidden', cursor: 'pointer' }}
    >
      {/* couverture */}
      <div style={{ position: 'relative', height: 158, background: tk.cardSubtle }}>
        {b.coverPhoto ? (
          <img src={b.coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <MEIcon name="home" size={40} color={tk.ghost} />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,12,14,0.30) 0%, rgba(11,12,14,0) 30%, rgba(11,12,14,0) 55%, rgba(11,12,14,0.42) 100%)' }} />
        <span style={{ position: 'absolute', top: 12, left: 12, padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: tone, color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.1, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          {t(`status.${b.status}`, { defaultValue: b.status })}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMenu() }}
          aria-label={t('common:actions.options')}
          style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'rgba(11,12,14,0.6)', backdropFilter: 'blur(6px)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="more-horizontal" size={17} color="#fff" />
        </button>
        <span style={{ position: 'absolute', left: 14, bottom: 11, fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.2 }}>
          {b.transaction === 'location' ? t('mobile.txRent') : t('mobile.txSale')}
        </span>
        <span style={{ position: 'absolute', right: 14, bottom: 11, fontSize: 'var(--crm-text-3xl)', fontWeight: 800, color: '#fff', letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 8px rgba(0,0,0,0.35)' }}>
          {priceLabel(b)}
        </span>
      </div>

      {/* corps */}
      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-3xl) var(--crm-space-3xl)' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', marginTop: 4 }}>
          <MEIcon name="location" size={13} color={tk.muted} strokeWidth={1.7} />
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.addr}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', flexWrap: 'wrap', marginTop: 13 }}>
          <Spec icon="surface" value={`${b.area} m²`} color={tk.inkSoft} />
          {b.rooms ? <Spec icon="home" value={t('mobile.roomsShort', { count: b.rooms })} color={tk.inkSoft} /> : null}
          {b.beds ? <Spec icon="bed" value={String(b.beds)} color={tk.inkSoft} /> : null}
          {b.baths ? <Spec icon="bath" value={String(b.baths)} color={tk.inkSoft} /> : null}
          {b.health ? (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
              <MEIcon name="sparkle" size={13} color={tk.muted} />
              {b.health.overall}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
