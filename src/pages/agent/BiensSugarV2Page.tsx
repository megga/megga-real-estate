// MEGGA CRM Sugar v2 — Mes biens (refonte Galerie)
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// Concept A : bandeau KPI portefeuille + toolbar (recherche · statut · tri ·
// bascule Galerie/Liste) + grille de cartes photo / liste compacte.
// Données réelles via useBiensSugar (RLS agency-scopée). Grammaire Sugar Pure.

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import MEIcon from '@/components/propertyx/MEIcon'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { useBnSubmissions } from '@/hooks/useBnSubmissions'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  BnSubmissionsBanner, BnSubmissionsDrawer,
} from '@/components/crm-sugar/biens/BnSubmissions'
import { BnDetailOverlay } from '@/components/crm-sugar/biens/BnDetailOverlay'
import {
  galSurfaces, galCompact, galNum,
} from '@/components/crm-sugar/biens/gallery/galHelpers'
import {
  GalKpi, GalSegmented, GalSortDropdown,
  type SegOption, type SortOption,
} from '@/components/crm-sugar/biens/gallery/GalleryAtoms'
import { GalCard } from '@/components/crm-sugar/biens/gallery/GalCard'
import { GalRow } from '@/components/crm-sugar/biens/gallery/GalRow'

const DARK_TONE: DarkTone = 'meggaAi'

export default function BiensSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)
  const surf = galSurfaces(sp, dark)

  // Source de vérité : Supabase via useBiensSugar (RLS agency-scopée)
  const { biens, isLoading } = useBiensSugar()
  // Soumissions vendeurs (seller_leads status='new') via useBnSubmissions
  const { submissions } = useBnSubmissions()

  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<string>(() => {
    if (typeof window === 'undefined') return 'galerie'
    return window.localStorage.getItem('megga_biens_view') || 'galerie'
  })
  const setViewP = (v: string) => {
    setView(v)
    try {
      window.localStorage.setItem('megga_biens_view', v)
    } catch {
      /* ignore */
    }
  }
  const [openSubs, setOpenSubs] = useState(false)
  const [openBien, setOpenBien] = useState<CrmBien | null>(null)

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: biens.length, active: 0, reserved: 0, draft: 0, sold: 0,
    }
    for (const b of biens) if (c[b.status] != null) c[b.status]++
    return c
  }, [biens])

  // KPI portefeuille — valeurs RÉELLES (prix sommé + vues + demandes via les
  // stats). Les sparklines/deltas sont la tendance illustrative de la maquette.
  const kpi = useMemo(() => {
    let portfolio = 0
    let views = 0
    let demands = 0
    for (const b of biens) {
      portfolio += b.price || 0
      views += b.stats?.views || 0
      demands += b.stats?.visitRequests || 0
    }
    return { portfolio, views, demands }
  }, [biens])

  const filtered = useMemo<CrmBien[]>(() => {
    let l = [...biens]
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          b.addr.toLowerCase().includes(q) ||
          b.ref.toLowerCase().includes(q),
      )
    }
    if (fStatus !== 'all') l = l.filter(b => b.status === fStatus)
    const pv = (b: CrmBien) => b.price || (b.rent ? b.rent * 300 : 0)
    if (sort === 'price-desc') l.sort((a, b) => pv(b) - pv(a))
    else if (sort === 'price-asc') l.sort((a, b) => pv(a) - pv(b))
    else if (sort === 'views') l.sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
    else if (sort === 'surface') l.sort((a, b) => b.area - a.area)
    return l
  }, [biens, search, fStatus, sort])

  const statusOpts: SegOption[] = [
    { value: 'all', label: 'Tous', count: counts.all },
    { value: 'active', label: 'Actifs', count: counts.active },
    { value: 'reserved', label: 'Réservés', count: counts.reserved },
    { value: 'draft', label: 'Brouillons', count: counts.draft },
  ]
  const sortOpts: SortOption[] = [
    { value: 'recent', label: 'Récents' },
    { value: 'price-desc', label: 'Prix décroissant' },
    { value: 'price-asc', label: 'Prix croissant' },
    { value: 'surface', label: 'Surface' },
    { value: 'views', label: 'Plus vus' },
  ]
  const viewOpts: SegOption[] = [
    { value: 'galerie', label: 'Galerie', icon: 'gallery' },
    { value: 'liste', label: 'Liste', icon: 'menu' },
  ]

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        navigate('/dashboard/matching'); break
      case 'contacts':
        navigate('/dashboard/contacts'); break
      case 'biens':
        break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'calendar':
        navigate('/dashboard/calendar'); break
      case 'docs':
        navigate('/dashboard/documents'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/network'); break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
      // no-op for parcours/julien/ai/etc.
    }
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        .gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        @media (max-width: 1180px) { .gal-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 720px) { .gal-grid { grid-template-columns: 1fr; } }
      `}</style>
      <SugarTopNav active="biens" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="biens"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />
        <main style={{ flex: 1, padding: '32px 40px 80px', minWidth: 0, maxWidth: 1240 }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 16,
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: -1,
                  color: sp.ink,
                  lineHeight: 1,
                }}
              >
                Mes biens
              </h1>
              <div style={{ fontSize: 13, color: sp.sub, marginTop: 8, fontWeight: 500 }}>
                {isLoading
                  ? 'Chargement…'
                  : `${filtered.length} bien${filtered.length > 1 ? 's' : ''} sur ${biens.length} dans votre catalogue`}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button
              style={{
                height: 42,
                padding: '0 18px',
                borderRadius: 999,
                background: surf.card,
                color: sp.ink,
                border: surf.hairline,
                boxShadow: surf.shadow,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MEIcon name="download" size={14} color={sp.soft} /> Exporter
            </button>
            <button
              onClick={() => navigate('/dashboard/listings/new')}
              style={{
                height: 42,
                padding: '0 20px',
                borderRadius: 999,
                border: 0,
                background: sp.ink,
                color: sp.pageBg,
                fontWeight: 700,
                fontSize: 13.5,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: sp.focusShadow,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MEIcon name="plus" size={14} color={sp.pageBg} /> Créer un bien
            </button>
          </div>

          {/* Bandeau soumissions */}
          <BnSubmissionsBanner
            subs={submissions}
            sp={sp}
            dark={dark}
            onOpen={() => setOpenSubs(true)}
          />

          {/* KPI portefeuille — tendance (sparkline + évolution 30 j), façon maquette */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            <GalKpi
              sp={sp}
              surf={surf}
              dark={dark}
              label="Valeur du portefeuille"
              value={'CHF ' + galCompact(kpi.portfolio)}
              spark={[6.2, 6.4, 6.3, 6.8, 7.0, 7.26]}
            />
            <GalKpi
              sp={sp}
              surf={surf}
              dark={dark}
              label="Vues cumulées · 30 j"
              value={galCompact(kpi.views)}
              delta="+18%"
              spark={[2.1, 2.6, 3.0, 3.4, 3.9, 4.4]}
            />
            <GalKpi
              sp={sp}
              surf={surf}
              dark={dark}
              label="Demandes de visite"
              value={galNum(kpi.demands)}
              delta="+5"
              spark={[18, 21, 23, 26, 28, 30]}
            />
          </div>

          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MEIcon name="search" size={15} color={sp.sub} />
              </span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un bien, une adresse, une référence…"
                style={{
                  width: '100%',
                  height: 42,
                  padding: '0 16px 0 42px',
                  borderRadius: 999,
                  outline: 'none',
                  background: surf.card,
                  border: surf.hairline,
                  boxShadow: surf.shadow,
                  color: sp.ink,
                  fontSize: 13.5,
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <GalSegmented
              options={statusOpts}
              value={fStatus}
              onChange={setFStatus}
              sp={sp}
              surf={surf}
              dark={dark}
            />
            <GalSortDropdown
              value={sort}
              options={sortOpts}
              onChange={setSort}
              sp={sp}
              surf={surf}
            />
            <GalSegmented
              options={viewOpts}
              value={view}
              onChange={setViewP}
              sp={sp}
              surf={surf}
              dark={dark}
            />
          </div>

          {/* Contenu */}
          {filtered.length === 0 ? (
            <div
              style={{
                background: surf.card,
                borderRadius: 20,
                boxShadow: surf.shadow,
                border: surf.hairline,
                padding: '64px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  margin: '0 auto 14px',
                  background: surf.cardSub,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <MEIcon name="home" size={22} color={sp.sub} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink }}>
                {isLoading ? 'Chargement…' : 'Aucun bien ne correspond'}
              </div>
            </div>
          ) : view === 'galerie' ? (
            <div className="gal-grid">
              {filtered.map(b => (
                <GalCard
                  key={b.id}
                  bien={b}
                  sp={sp}
                  surf={surf}
                  dark={dark}
                  onOpen={() => setOpenBien(b)}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(b => (
                <GalRow
                  key={b.id}
                  bien={b}
                  sp={sp}
                  surf={surf}
                  dark={dark}
                  onOpen={() => setOpenBien(b)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BnSubmissionsDrawer
        open={openSubs}
        onClose={() => setOpenSubs(false)}
        subs={submissions}
        sp={sp}
      />

      {openBien && (
        <BnDetailOverlay
          bien={openBien}
          onClose={() => setOpenBien(null)}
          sp={sp}
          dark={dark}
        />
      )}
    </div>
  )
}
