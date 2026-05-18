// MEGGA CRM Sugar v2 — Mes biens (Tier 3 part 2.2)
// 1:1 port from the Claude Design bundle (`crm-screen-biens-sugar.jsx`).

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import CRMIcon from '@/components/crm-sugar/CRMIcon'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { useBnSubmissions } from '@/hooks/useBnSubmissions'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { BnRow } from '@/components/crm-sugar/biens/BnRow'
import {
  BnFilterDropdown, type FilterOption,
} from '@/components/crm-sugar/biens/BnFilterDropdown'
import {
  BnSubmissionsBanner, BnSubmissionsDrawer,
} from '@/components/crm-sugar/biens/BnSubmissions'
import { BnDetailOverlay } from '@/components/crm-sugar/biens/BnDetailOverlay'

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

  // Source de vérité : Supabase via useBiensSugar (RLS agency-scopée)
  const { biens, isLoading } = useBiensSugar()
  // Soumissions vendeurs (seller_leads status='new') via useBnSubmissions
  const { submissions } = useBnSubmissions()

  const [search, setSearch] = useState('')
  const [fBaths, setFBaths] = useState('all')
  const [fBeds, setFBeds] = useState('all')
  const [fSurface, setFSurface] = useState('all')
  const [fPrice, setFPrice] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fType, setFType] = useState('all')
  const [openSubs, setOpenSubs] = useState(false)
  const [openBien, setOpenBien] = useState<CrmBien | null>(null)

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
    if (fBaths !== 'all') l = l.filter(b => b.baths >= +fBaths)
    if (fBeds !== 'all') l = l.filter(b => b.beds >= +fBeds)
    if (fSurface !== 'all') {
      const [min, max] = fSurface.split('-').map(Number)
      l = l.filter(b => b.area >= min && (!max || b.area <= max))
    }
    if (fPrice !== 'all') {
      const [min, max] = fPrice.split('-').map(Number)
      l = l.filter(b => {
        const p = b.price || (b.rent ? b.rent * 12 * 25 : 0)
        return p >= min && (!max || p <= max)
      })
    }
    if (fStatus !== 'all') l = l.filter(b => b.status === fStatus)
    if (fType !== 'all') l = l.filter(b => b.type === fType)
    return l
  }, [biens, search, fBaths, fBeds, fSurface, fPrice, fStatus, fType])

  const optBaths: FilterOption[] = [
    { value: 'all', label: 'Tous' },
    { value: '1', label: '1+' },
    { value: '2', label: '2+' },
    { value: '3', label: '3+' },
  ]
  const optBeds: FilterOption[] = [
    { value: 'all', label: 'Tous' },
    { value: '1', label: '1+' },
    { value: '2', label: '2+' },
    { value: '3', label: '3+' },
    { value: '4', label: '4+' },
  ]
  const optSurface: FilterOption[] = [
    { value: 'all', label: 'Toute' },
    { value: '0-50', label: '< 50 m²' },
    { value: '50-100', label: '50–100 m²' },
    { value: '100-150', label: '100–150 m²' },
    { value: '150-', label: '> 150 m²' },
  ]
  const optPrice: FilterOption[] = [
    { value: 'all', label: 'Tous' },
    { value: '0-500000', label: '< 500K' },
    { value: '500000-1000000', label: '500K–1M' },
    { value: '1000000-2000000', label: '1M–2M' },
    { value: '2000000-', label: '> 2M' },
  ]
  const optStatus: FilterOption[] = [
    { value: 'all', label: 'Tous' },
    { value: 'active', label: 'Actif' },
    { value: 'reserved', label: 'Réservé' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'sold', label: 'Vendu' },
  ]
  const optType: FilterOption[] = [
    { value: 'all', label: 'Tous' },
    { value: 'appartement', label: 'Appartement' },
    { value: 'maison', label: 'Maison' },
  ]

  const filtersDirty =
    fBaths !== 'all' ||
    fBeds !== 'all' ||
    fSurface !== 'all' ||
    fPrice !== 'all' ||
    fType !== 'all' ||
    fStatus !== 'all'

  const resetFilters = () => {
    setFBaths('all')
    setFBeds('all')
    setFSurface('all')
    setFPrice('all')
    setFType('all')
    setFStatus('all')
  }

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
      case 'inbox': navigate('/dashboard/inbox'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/reseau'); break
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
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav
        active="biens"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="biens"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />
        <main
          style={{
            flex: 1,
            padding: '32px 40px 80px 0',
            minWidth: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 38,
                  fontWeight: 800,
                  letterSpacing: -1.2,
                  color: sp.ink,
                  lineHeight: 1,
                }}
              >
                Mes biens
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: sp.sub,
                  marginTop: 8,
                  fontWeight: 500,
                }}
              >
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
                background: 'transparent',
                color: sp.ink,
                border: `1px solid ${sp.cardBorder}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CRMIcon name="download" size={13} stroke={sp.ink} />
              Exporter CSV
            </button>
            <button
              onClick={() => navigate('/dashboard/listings/new')}
              style={{
                height: 42,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: sp.ink,
                color: sp.pageBg,
                fontWeight: 700,
                fontSize: 13.5,
                fontFamily: 'inherit',
                cursor: 'pointer',
                boxShadow: sp.focusShadow,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CRMIcon name="plus" size={13} stroke={sp.pageBg} />
              Créer un bien
            </button>
          </div>

          {/* Bandeau soumissions */}
          <BnSubmissionsBanner
            subs={submissions}
            sp={sp}
            dark={dark}
            onOpen={() => setOpenSubs(true)}
          />

          {/* Frame liste */}
          <div
            style={{
              background: sp.frameBg,
              border: `1px solid ${sp.frameBorder}`,
              borderRadius: 24,
              boxShadow: sp.shadow,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              overflow: 'hidden',
            }}
          >
            {/* Search bar */}
            <div style={{ padding: '18px 24px 12px' }}>
              <div
                style={{
                  height: 44,
                  padding: '0 16px',
                  background: sp.cardBg,
                  border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <CRMIcon name="search" size={14} stroke={sp.sub} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un bien, une adresse, une référence…"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                    color: sp.ink,
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      color: sp.sub,
                      fontSize: 16,
                      fontFamily: 'inherit',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filtres */}
            <div
              style={{
                padding: '6px 24px 18px',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                borderBottom: `1px solid ${sp.cardBorder}`,
              }}
            >
              <BnFilterDropdown label="S. de bain" value={fBaths} options={optBaths} onChange={setFBaths} sp={sp} />
              <BnFilterDropdown label="Chambres" value={fBeds} options={optBeds} onChange={setFBeds} sp={sp} />
              <BnFilterDropdown label="Surface" value={fSurface} options={optSurface} onChange={setFSurface} sp={sp} />
              <BnFilterDropdown label="Prix" value={fPrice} options={optPrice} onChange={setFPrice} sp={sp} />
              <BnFilterDropdown label="Type" value={fType} options={optType} onChange={setFType} sp={sp} />
              <BnFilterDropdown label="Statut" value={fStatus} options={optStatus} onChange={setFStatus} sp={sp} />
              {filtersDirty && (
                <button
                  onClick={resetFilters}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    background: 'transparent',
                    color: sp.sub,
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Réinitialiser
                </button>
              )}
            </div>

            {/* Liste */}
            {filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    margin: '0 auto 14px',
                    background: sp.cardSubBg,
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${sp.cardBorder}`,
                  }}
                >
                  <CRMIcon name="bien" size={22} stroke={sp.sub} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: sp.ink,
                    marginBottom: 6,
                  }}
                >
                  Aucun bien ne correspond
                </div>
                <div style={{ fontSize: 12, color: sp.sub }}>
                  Essayez de réinitialiser les filtres ou la recherche.
                </div>
              </div>
            ) : (
              <div>
                {filtered.map((b, i) => (
                  <BnRow
                    key={b.id}
                    bien={b}
                    sp={sp}
                    isFirst={i === 0}
                    onOpen={() => setOpenBien(b)}
                  />
                ))}
              </div>
            )}
          </div>
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
