// MEGGA CRM Sugar v2 — Mes biens · Page 0 « Galerie »
// Port fidèle du handoff Claude Design (crm-screen-biens-proto.jsx, BpTopGallery).
//
// Version finale ÉPURÉE : en-tête (titre + « Créer un bien ») + toolbar
// (recherche · statut · tri · bascule Galerie/Liste) + grille de cartes / liste.
// Le rôle analytique (ex-bandeau KPI à sparklines illustratives) passe à la page
// « À suivre ». En-tête + toolbar épinglés ; contenu scrollable (le pager laisse
// le scroll interne l'emporter avant de changer de page).

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { GalSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import {
  GalSegmented, GalSortDropdown, type SegOption, type SortOption,
} from '@/components/crm-sugar/biens/gallery/GalleryAtoms'
import { GalCard } from '@/components/crm-sugar/biens/gallery/GalCard'
import { GalRow } from '@/components/crm-sugar/biens/gallery/GalRow'

interface BpTopGalleryProps {
  biens: CrmBien[]
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
  isLoading: boolean
  isError: boolean
  refetch: () => void
  onOpenBien: (id: string) => void
  onCreate: () => void
  onResumeDraft: (b: CrmBien) => void
}

export function BpTopGallery({
  biens, sp, surf, dark, isLoading, isError, refetch, onOpenBien, onCreate, onResumeDraft,
}: BpTopGalleryProps) {
  const { t } = useTranslation('listings')
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<string>(() => {
    if (typeof window === 'undefined') return 'galerie'
    return window.localStorage.getItem('megga_biens_view') || 'galerie'
  })
  const setViewP = (v: string) => {
    setView(v)
    try { window.localStorage.setItem('megga_biens_view', v) } catch { /* ignore */ }
  }

  const filtered = useMemo<CrmBien[]>(() => {
    let l = [...biens]
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.addr.toLowerCase().includes(q) ||
          b.ref.toLowerCase().includes(q),
      )
    }
    if (fStatus !== 'all') l = l.filter((b) => b.status === fStatus)
    const pv = (b: CrmBien) => b.price || (b.rent ? b.rent * 300 : 0)
    if (sort === 'price-desc') l.sort((a, b) => pv(b) - pv(a))
    else if (sort === 'price-asc') l.sort((a, b) => pv(a) - pv(b))
    else if (sort === 'views') l.sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
    else if (sort === 'surface') l.sort((a, b) => b.area - a.area)
    return l
  }, [biens, search, fStatus, sort])

  // Pilules de statut SANS compteur (le proto final les affiche en label seul).
  const statusOpts: SegOption[] = [
    { value: 'all', label: t('tab.all') },
    { value: 'active', label: t('tab.active') },
    { value: 'reserved', label: t('tab.reserved') },
    { value: 'draft', label: t('tab.drafts') },
  ]
  const sortOpts: SortOption[] = [
    { value: 'recent', label: t('biens.sort.recent') },
    { value: 'price-desc', label: t('biens.sort.priceDesc') },
    { value: 'price-asc', label: t('biens.sort.priceAsc') },
    { value: 'surface', label: t('biens.sort.surface') },
    { value: 'views', label: t('biens.sort.views') },
  ]
  const viewOpts: SegOption[] = [
    { value: 'galerie', label: t('biens.view.gallery'), icon: 'gallery' },
    { value: 'liste', label: t('biens.view.list'), icon: 'menu' },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .bpg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 1180px) { .bpg-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 720px) { .bpg-grid { grid-template-columns: 1fr; } }
        .bpg-search::placeholder { color: ${sp.sub}; }
      `}</style>

      {/* En-tête + toolbar (épinglés) */}
      <div style={{ flexShrink: 0, padding: '26px 34px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>{t('title')}</h1>
          <div style={{ flex: 1 }} />
          <button
            onClick={onCreate}
            style={{ height: 42, padding: '0 20px', borderRadius: 999, border: 0, background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', boxShadow: sp.focusShadow, display: 'inline-flex', alignItems: 'center' }}
          >
            {t('biens.create')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center' }}>
              <MEIcon name="search" size={15} color={sp.sub} />
            </span>
            <input
              className="bpg-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('biens.searchPlaceholder')}
              style={{ width: '100%', height: 42, padding: '0 16px 0 42px', borderRadius: 999, outline: 'none', background: surf.card, border: surf.hairline, boxShadow: surf.shadow, color: sp.ink, fontSize: 13.5, fontFamily: 'inherit' }}
            />
          </div>
          <GalSegmented options={statusOpts} value={fStatus} onChange={setFStatus} sp={sp} surf={surf} dark={dark} />
          <GalSortDropdown value={sort} options={sortOpts} onChange={setSort} sp={sp} surf={surf} />
          <GalSegmented options={viewOpts} value={view} onChange={setViewP} sp={sp} surf={surf} dark={dark} />
        </div>
      </div>

      {/* Contenu (scrollable) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 34px 30px' }}>
        {filtered.length === 0 ? (
          <div style={{ background: surf.card, borderRadius: 20, boxShadow: surf.shadow, border: surf.hairline, padding: '64px 20px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, margin: '0 auto 14px', background: surf.cardSub, display: 'grid', placeItems: 'center' }}>
              <MEIcon name={isError ? 'alert' : 'home'} size={22} color={isError ? '#E53935' : sp.sub} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink }}>
              {isError ? t('biens.error.title') : isLoading ? t('biens.loading') : t('biens.empty.noMatch')}
            </div>
            {isError && (
              <>
                <div style={{ fontSize: 12.5, color: sp.sub, marginTop: 6, lineHeight: 1.5 }}>{t('biens.error.message')}</div>
                <button
                  onClick={() => refetch()}
                  style={{ marginTop: 14, height: 34, padding: '0 16px', borderRadius: 999, background: surf.card, color: sp.ink, border: surf.hairline, boxShadow: surf.shadow, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <MEIcon name="refresh" size={13} color={sp.soft} /> {t('biens.error.retry')}
                </button>
              </>
            )}
          </div>
        ) : view === 'galerie' ? (
          <div className="bpg-grid">
            {filtered.map((b) => (
              <GalCard
                key={b.id}
                bien={b}
                sp={sp}
                surf={surf}
                dark={dark}
                onOpen={() => onOpenBien(b.id)}
                onFinish={b.status === 'draft' ? () => onResumeDraft(b) : undefined}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((b) => (
              <GalRow key={b.id} bien={b} sp={sp} surf={surf} dark={dark} onOpen={() => onOpenBien(b.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
