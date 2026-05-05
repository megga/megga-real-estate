// MEGGA CRM Sugar v2 — Réseau d'agences (Tier 5)
// Module multi-tenant — 5 vues organisées en tabs :
//   1. Mon réseau (agences partenaires) — implémenté
//   2. Biens partagés / sortants (matrice biens × agences × niveau) — implémenté
//   3. Biens reçus / entrants — stub Coming soon
//   4. Demandes (workflow approuver/refuser) — stub Coming soon
//   5. Settings agence (niveau par défaut, PDF avec/sans logo) — stub Coming soon
//
// Mock data uniquement. Les écritures + RLS + templates PDF arrivent dans des
// PRs ultérieures (cf. HANDOFF_RESEAU_AGENCES.md du bundle).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  BlackBtn, GhostBtn, KycIcon, Pill, SP,
} from '@/components/crm-sugar/kyc/atoms'
import {
  BIEN_SHARE_RULES, RECEIVED_LISTINGS, RESEAU_FILTERS, RESEAU_PARTNERS, RESEAU_TABS,
  RELATION_LABELS, SHARE_LEVEL_LABELS, SHARE_LEVEL_TONE, partnerById,
  REQUEST_STATUS_LABELS, REQUEST_STATUS_TONE, SHARE_REQUESTS,
  type AgencyPartner, type AgencyRelationStatus, type AgencyShareLevel,
  type BienShareRule, type ReceivedListing, type ReseauTabId,
  type ShareRequest, type ShareRequestDirection,
} from '@/components/crm-sugar/reseau/data'

const DARK_TONE: DarkTone = 'meggaAi'

const STATUS_TONE: Record<AgencyRelationStatus, 'ok' | 'pending' | 'neutral' | 'danger'> = {
  partner: 'ok',
  megga: 'neutral',
  new: 'pending',
  blocked: 'danger',
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days}j`
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem`
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`
  return `il y a ${Math.floor(days / 365)} ans`
}

export default function ReseauSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const [activeTab, setActiveTab] = useState<ReseauTabId>('mon-reseau')
  const [activeFilter, setActiveFilter] = useState<AgencyRelationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortantsFilterAgency, setSortantsFilterAgency] = useState<string>('all')
  const [sortantsSearch, setSortantsSearch] = useState('')
  const [entrantsFilterAgency, setEntrantsFilterAgency] = useState<string>('all')
  const [entrantsSearch, setEntrantsSearch] = useState('')
  const [demandesDirection, setDemandesDirection] = useState<ShareRequestDirection>('incoming')

  const filtered = useMemo(() => {
    return RESEAU_PARTNERS.filter(a => {
      if (activeFilter !== 'all' && a.status !== activeFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!a.name.toLowerCase().includes(q) && !a.city.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [activeFilter, search])

  const kpis = useMemo(() => {
    const total = RESEAU_PARTNERS.length
    const partners = RESEAU_PARTNERS.filter(a => a.status === 'partner').length
    const sharedOut = RESEAU_PARTNERS.reduce((s, a) => s + a.sharedOut, 0)
    const sharedIn = RESEAU_PARTNERS.reduce((s, a) => s + a.sharedIn, 0)
    const pending = RESEAU_PARTNERS.filter(a => a.defaultLevel === 'pending').length
    return [
      { k: 'Agences connectées', v: String(total), sub: `${partners} de confiance`, tone: 'neutral' as const },
      { k: 'Biens que je partage', v: String(sharedOut), sub: 'sortants', tone: 'ok' as const },
      { k: 'Biens reçus', v: String(sharedIn), sub: 'entrants', tone: 'neutral' as const },
      { k: 'Demandes en attente', v: String(pending), sub: pending > 0 ? 'à traiter' : 'à jour', tone: pending > 0 ? 'warn' as const : 'neutral' as const },
    ]
  }, [])

  const onCmd = () => {}
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/parcours'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': navigate('/dashboard/documents'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/reseau'); break
      case 'auto': navigate('/dashboard/automation'); break
      case 'chat': navigate('/dashboard/messages'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: SP.bg,
        fontFamily: SP.font,
        color: SP.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav
        active={'today' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="reseau"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '100px 40px 60px 40px',
            maxWidth: 1480,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: SP.muted,
                  marginBottom: 6,
                }}
              >
                Multi-tenant · Partage entre agences
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                  lineHeight: 1.05,
                }}
              >
                Réseau d'agences
              </div>
            </div>
            <GhostBtn>Settings agence</GhostBtn>
            <BlackBtn
              icon={<KycIcon name="plus" size={14} stroke="#fff" sw={2.2} />}
              style={{ height: 40 }}
            >
              Inviter une agence
            </BlackBtn>
          </div>

          {/* Banner MVP */}
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 14,
              background: SP.pendingSoft,
              color: SP.pending,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <KycIcon name="alert" size={14} stroke={SP.pending} sw={2} />
            Aperçu visuel · les vraies écritures (invitations, partage de biens, audit
            trail RLS) arrivent dans une prochaine PR. Données mock pour l'instant.
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: SP.surface,
              borderRadius: 14,
              boxShadow: SP.shadowSm,
              alignSelf: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            {RESEAU_TABS.map(tab => {
              const on = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 0,
                    background: on ? SP.ink : 'transparent',
                    color: on ? '#fff' : SP.inkSoft,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    transition: 'all .15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 1,
                    textAlign: 'left',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: on ? 'rgba(255,255,255,0.55)' : SP.muted,
                      letterSpacing: '.04em',
                    }}
                  >
                    {tab.sub}
                  </span>
                </button>
              )
            })}
          </div>

          {activeTab === 'mon-reseau' && (
            <MonReseauView
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              search={search}
              setSearch={setSearch}
              filtered={filtered}
              kpis={kpis}
            />
          )}
          {activeTab === 'sortants' && (
            <SortantsView
              filterAgency={sortantsFilterAgency}
              setFilterAgency={setSortantsFilterAgency}
              search={sortantsSearch}
              setSearch={setSortantsSearch}
            />
          )}
          {activeTab === 'entrants' && (
            <EntrantsView
              filterAgency={entrantsFilterAgency}
              setFilterAgency={setEntrantsFilterAgency}
              search={entrantsSearch}
              setSearch={setEntrantsSearch}
            />
          )}
          {activeTab === 'demandes' && (
            <DemandesView
              direction={demandesDirection}
              setDirection={setDemandesDirection}
            />
          )}
          {activeTab === 'settings' && (
            <ComingSoonView
              tab="Settings agence"
              desc="Niveau de partage par défaut, auto-approbation, choix du template PDF (avec ou sans logo agence)."
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Vue 1 : Mon réseau (KPIs + filters + agency cards grid) ─────────────

interface MonReseauViewProps {
  activeFilter: AgencyRelationStatus | 'all'
  setActiveFilter: (f: AgencyRelationStatus | 'all') => void
  search: string
  setSearch: (s: string) => void
  filtered: AgencyPartner[]
  kpis: { k: string; v: string; sub: string; tone: 'ok' | 'warn' | 'pending' | 'neutral' }[]
}

function MonReseauView({
  activeFilter, setActiveFilter, search, setSearch, filtered, kpis,
}: MonReseauViewProps) {
  return (
    <>
      {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
            }}
          >
            {kpis.map((k, i) => (
              <div
                key={i}
                style={{
                  background: SP.surface,
                  borderRadius: 18,
                  padding: '16px 18px',
                  boxShadow: SP.shadowSm,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: SP.muted,
                  }}
                >
                  {k.k}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      letterSpacing: -0.8,
                    }}
                  >
                    {k.v}
                  </div>
                  <Pill tone={k.tone}>{k.sub}</Pill>
                </div>
              </div>
            ))}
          </div>

          {/* Filtres + recherche */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {RESEAU_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: 0,
                  background: f.id === activeFilter ? SP.ink : SP.surface,
                  color: f.id === activeFilter ? '#fff' : SP.inkSoft,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  boxShadow: f.id === activeFilter ? 'none' : SP.shadowSm,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {f.label}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: f.id === activeFilter ? 'rgba(255,255,255,0.6)' : SP.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {f.count}
                </span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 999,
                background: SP.surface,
                boxShadow: SP.shadowSm,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: 280,
              }}
            >
              <KycIcon name="scan" size={14} stroke={SP.muted} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une agence…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  fontSize: 12.5,
                  color: SP.ink,
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* Cards grid */}
          {filtered.length === 0 ? (
            <div
              style={{
                background: SP.surface,
                borderRadius: 18,
                padding: '60px 24px',
                textAlign: 'center',
                color: SP.muted,
                fontSize: 13,
              }}
            >
              Aucune agence ne correspond à ces critères.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 14,
              }}
            >
              {filtered.map(a => (
                <AgencyCard key={a.id} agency={a} />
              ))}
            </div>
          )}
    </>
  )
}

// ─── Vue 2 : Biens partagés (sortants — biens × agences × niveau) ────────

interface SortantsViewProps {
  filterAgency: string
  setFilterAgency: (id: string) => void
  search: string
  setSearch: (s: string) => void
}

function SortantsView({ filterAgency, setFilterAgency, search, setSearch }: SortantsViewProps) {
  const filtered = useMemo(() => {
    return BIEN_SHARE_RULES.filter(b => {
      if (filterAgency !== 'all') {
        if (!b.shares.some(s => s.agencyId === filterAgency)) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!b.title.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q) && !b.ref.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [filterAgency, search])

  // KPIs sortants
  const kpis = useMemo(() => {
    const totalBiens = BIEN_SHARE_RULES.filter(b => b.shares.length > 0).length
    const totalShares = BIEN_SHARE_RULES.reduce((s, b) => s + b.shares.length, 0)
    const fullShares = BIEN_SHARE_RULES.reduce(
      (s, b) => s + b.shares.filter(sh => sh.level === 'full').length,
      0,
    )
    const pendingShares = BIEN_SHARE_RULES.reduce(
      (s, b) => s + b.shares.filter(sh => sh.level === 'pending').length,
      0,
    )
    return [
      { k: 'Biens partagés', v: String(totalBiens), sub: 'avec au moins 1 agence', tone: 'neutral' as const },
      { k: 'Partages totaux', v: String(totalShares), sub: 'tous niveaux', tone: 'ok' as const },
      { k: 'Niveau Complet', v: String(fullShares), sub: 'avec adresse + photos HD', tone: 'ok' as const },
      { k: 'En attente', v: String(pendingShares), sub: pendingShares > 0 ? 'à valider' : 'à jour', tone: pendingShares > 0 ? 'warn' as const : 'neutral' as const },
    ]
  }, [])

  return (
    <>
      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={i}
            style={{
              background: SP.surface,
              borderRadius: 18,
              padding: '16px 18px',
              boxShadow: SP.shadowSm,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: SP.muted,
              }}
            >
              {k.k}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                }}
              >
                {k.v}
              </div>
              <Pill tone={k.tone}>{k.sub}</Pill>
            </div>
          </div>
        ))}
      </div>

      {/* Filter par agence + recherche */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setFilterAgency('all')}
          style={{
            padding: '7px 14px',
            borderRadius: 999,
            border: 0,
            background: filterAgency === 'all' ? SP.ink : SP.surface,
            color: filterAgency === 'all' ? '#fff' : SP.inkSoft,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: filterAgency === 'all' ? 'none' : SP.shadowSm,
            cursor: 'pointer',
          }}
        >
          Toutes agences
        </button>
        {RESEAU_PARTNERS.map(a => (
          <button
            key={a.id}
            onClick={() => setFilterAgency(a.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: 0,
              background: filterAgency === a.id ? SP.ink : SP.surface,
              color: filterAgency === a.id ? '#fff' : SP.inkSoft,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: filterAgency === a.id ? 'none' : SP.shadowSm,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: a.logoBg,
                flexShrink: 0,
              }}
            />
            {a.short}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            background: SP.surface,
            boxShadow: SP.shadowSm,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 280,
          }}
        >
          <KycIcon name="scan" size={14} stroke={SP.muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un bien…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontSize: 12.5,
              color: SP.ink,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Bien cards */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: SP.surface,
            borderRadius: 18,
            padding: '60px 24px',
            textAlign: 'center',
            color: SP.muted,
            fontSize: 13,
          }}
        >
          Aucun bien ne correspond à ces critères.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(b => (
            <BienShareRow key={b.bienId} bien={b} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Vue 3 : Biens reçus (entrants — listings partagés par d'autres agences) ─

interface EntrantsViewProps {
  filterAgency: string
  setFilterAgency: (id: string) => void
  search: string
  setSearch: (s: string) => void
}

function EntrantsView({
  filterAgency, setFilterAgency, search, setSearch,
}: EntrantsViewProps) {
  const filtered = useMemo(() => {
    return RECEIVED_LISTINGS.filter(l => {
      if (filterAgency !== 'all' && l.sourceAgencyId !== filterAgency) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const corpus = `${l.title} ${l.zone} ${l.city ?? ''} ${l.address ?? ''} ${l.sourceRef}`.toLowerCase()
        if (!corpus.includes(q)) return false
      }
      return true
    })
  }, [filterAgency, search])

  const kpis = useMemo(() => {
    const total = RECEIVED_LISTINGS.length
    const full = RECEIVED_LISTINGS.filter(l => l.level === 'full').length
    const partial = RECEIVED_LISTINGS.filter(l => l.level === 'partial').length
    const sources = new Set(RECEIVED_LISTINGS.filter(l => l.level !== 'pending').map(l => l.sourceAgencyId)).size
    return [
      { k: 'Biens reçus', v: String(total), sub: 'tous niveaux', tone: 'neutral' as const },
      { k: 'Niveau Complet', v: String(full), sub: 'avec adresse + photos', tone: 'ok' as const },
      { k: 'Niveau Partiel', v: String(partial), sub: 'photos floutées', tone: 'warn' as const },
      { k: 'Agences sources', v: String(sources), sub: 'me partagent', tone: 'neutral' as const },
    ]
  }, [])

  // Liste des agences qui apparaissent dans les biens reçus (pour le filter)
  const sourceAgencies = useMemo(
    () => Array.from(new Set(RECEIVED_LISTINGS.map(l => l.sourceAgencyId)))
      .map(id => partnerById(id))
      .filter((a): a is AgencyPartner => !!a),
    [],
  )

  return (
    <>
      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={i}
            style={{
              background: SP.surface,
              borderRadius: 18,
              padding: '16px 18px',
              boxShadow: SP.shadowSm,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: SP.muted,
              }}
            >
              {k.k}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                }}
              >
                {k.v}
              </div>
              <Pill tone={k.tone}>{k.sub}</Pill>
            </div>
          </div>
        ))}
      </div>

      {/* Filter par agence source + recherche */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setFilterAgency('all')}
          style={{
            padding: '7px 14px',
            borderRadius: 999,
            border: 0,
            background: filterAgency === 'all' ? SP.ink : SP.surface,
            color: filterAgency === 'all' ? '#fff' : SP.inkSoft,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: filterAgency === 'all' ? 'none' : SP.shadowSm,
            cursor: 'pointer',
          }}
        >
          Toutes sources
        </button>
        {sourceAgencies.map(a => (
          <button
            key={a.id}
            onClick={() => setFilterAgency(a.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: 0,
              background: filterAgency === a.id ? SP.ink : SP.surface,
              color: filterAgency === a.id ? '#fff' : SP.inkSoft,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow: filterAgency === a.id ? 'none' : SP.shadowSm,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: a.logoBg,
                flexShrink: 0,
              }}
            />
            {a.short}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 999,
            background: SP.surface,
            boxShadow: SP.shadowSm,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 280,
          }}
        >
          <KycIcon name="scan" size={14} stroke={SP.muted} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les biens reçus…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              outline: 'none',
              fontSize: 12.5,
              color: SP.ink,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Reçu bien grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: SP.surface,
            borderRadius: 18,
            padding: '60px 24px',
            textAlign: 'center',
            color: SP.muted,
            fontSize: 13,
          }}
        >
          Aucun bien reçu ne correspond à ces critères.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 14,
          }}
        >
          {filtered.map(l => (
            <ReceivedListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Carte d'un bien reçu — masquée selon le niveau de partage ───────────

function ReceivedListingCard({ listing }: { listing: ReceivedListing }) {
  const [hover, setHover] = useState(false)
  const partner = partnerById(listing.sourceAgencyId)
  if (!partner) return null

  const formatPrice = (n: number, txn: 'vente' | 'location') => {
    if (n === 0) return '—'
    const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return txn === 'location' ? `CHF ${formatted}/mois` : `CHF ${formatted}`
  }

  const isPending = listing.level === 'pending'
  const tone = SHARE_LEVEL_TONE[listing.level]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: SP.surface,
        borderRadius: 22,
        padding: 0,
        boxShadow: hover ? SP.shadow : SP.shadowSm,
        transition: 'all .18s',
        transform: hover && !isPending ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        cursor: isPending ? 'default' : 'pointer',
        overflow: 'hidden',
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {/* Photo placeholder — comportement par niveau */}
      <PhotoPlaceholder listing={listing} />

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Source agency + level pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: partner.logoBg,
              color: partner.logoColor,
              display: 'grid',
              placeItems: 'center',
              fontSize: 7,
              fontWeight: 800,
              letterSpacing: partner.logoLetterSpacing,
              fontFamily: 'Helvetica, Arial, sans-serif',
              flexShrink: 0,
            }}
          >
            {partner.short.slice(0, 4)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: SP.muted }}>
            Partagé par {partner.name}
          </span>
          <div style={{ flex: 1 }} />
          <Pill tone={tone} dot>
            {SHARE_LEVEL_LABELS[listing.level]}
          </Pill>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            letterSpacing: -0.2,
            color: SP.ink,
            lineHeight: 1.3,
          }}
        >
          {listing.title}
        </div>

        {/* Localisation — masquée selon le niveau */}
        {!isPending && (
          <div style={{ fontSize: 11.5, color: SP.muted, lineHeight: 1.5 }}>
            {listing.level === 'full' && listing.address && (
              <>
                <KycIcon name="globe" size={11} stroke={SP.muted} sw={1.8} />
                <span style={{ marginLeft: 6 }}>{listing.address}</span>
              </>
            )}
            {listing.level === 'partial' && listing.city && (
              <>{listing.zone} · {listing.city} <span style={{ color: SP.warn }}>(adresse masquée)</span></>
            )}
            {listing.level === 'preview' && (
              <>{listing.zone} <span style={{ color: SP.muted }}>(zone large uniquement)</span></>
            )}
          </div>
        )}

        {/* Détails ligne — type + pièces + surface + prix */}
        {!isPending && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              fontSize: 12,
              color: SP.inkSoft,
            }}
          >
            <span>{listing.type}</span>
            {listing.rooms !== null && <><span>·</span><span>{listing.rooms} pièces</span></>}
            <span>·</span>
            <span>{listing.area} m²</span>
            <span>·</span>
            <span style={{ color: SP.ink, fontWeight: 700 }}>
              {formatPrice(listing.price, listing.transaction)}
            </span>
          </div>
        )}

        {/* Pending state */}
        {isPending && (
          <div
            style={{
              fontSize: 12,
              color: SP.pending,
              fontStyle: 'italic',
              padding: '6px 0',
            }}
          >
            Demande de partage envoyée le{' '}
            {new Date(listing.sharedAt).toLocaleDateString('fr-CH', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })}
            . En attente de validation côté agence.
          </div>
        )}

        {/* Source ref + sharedAt */}
        <div
          style={{
            fontSize: 10.5,
            color: SP.muted,
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 4,
            borderTop: `1px solid ${SP.cardSubtle}`,
            marginTop: 4,
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{listing.sourceRef}</span>
          <span>Partagé {fmtRelative(listing.sharedAt)}</span>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {listing.level === 'full' && (
            <BlackBtn
              style={{ height: 34, padding: '0 14px', fontSize: 12, flex: 1 }}
              icon={<KycIcon name="arrow" size={12} stroke="#fff" sw={2.2} />}
            >
              Ouvrir la fiche complète
            </BlackBtn>
          )}
          {listing.level === 'partial' && (
            <BlackBtn
              style={{ height: 34, padding: '0 14px', fontSize: 12, flex: 1 }}
              icon={<KycIcon name="arrow" size={12} stroke="#fff" sw={2.2} />}
            >
              Voir aperçu partiel
            </BlackBtn>
          )}
          {listing.level === 'preview' && (
            <GhostBtn style={{ height: 34, padding: '0 14px', fontSize: 12, flex: 1 }}>
              Demander accès complet
            </GhostBtn>
          )}
          {isPending && (
            <GhostBtn style={{ height: 34, padding: '0 14px', fontSize: 12, flex: 1 }}>
              Annuler la demande
            </GhostBtn>
          )}
        </div>
      </div>
    </div>
  )
}

// Photo placeholder — masquée/floutée selon le niveau
function PhotoPlaceholder({ listing }: { listing: ReceivedListing }) {
  const isPending = listing.level === 'pending'
  const isPreview = listing.level === 'preview'
  const isPartial = listing.level === 'partial'

  return (
    <div
      style={{
        height: 140,
        background: isPending
          ? SP.cardSubtle
          : `linear-gradient(135deg, ${listing.accent}25 0%, ${listing.accent}10 100%)`,
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Faux pattern décoratif (simule une photo) */}
      {!isPending && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 360 140"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, opacity: isPreview ? 0.15 : isPartial ? 0.4 : 0.7, filter: isPartial ? 'blur(6px)' : 'none' }}
        >
          <rect x="0" y="0" width="360" height="140" fill={listing.accent} opacity="0.15" />
          <path d="M0 110 L80 70 L150 90 L240 50 L360 80 L360 140 L0 140 Z" fill={listing.accent} opacity="0.5" />
          <circle cx="280" cy="40" r="14" fill={listing.accent} opacity="0.6" />
        </svg>
      )}

      {/* Overlay selon niveau */}
      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <KycIcon name="lock" size={28} stroke={SP.muted} sw={1.5} />
          <span style={{ fontSize: 11, fontWeight: 700, color: SP.muted, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            En attente
          </span>
        </div>
      )}
      {isPreview && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SP.muted,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 999,
              background: SP.surface,
              boxShadow: SP.shadowSm,
            }}
          >
            🔒 Aperçu — photo verrouillée
          </span>
        </div>
      )}
      {isPartial && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            padding: '3px 8px',
            borderRadius: 999,
            background: SP.surface,
            boxShadow: SP.shadowSm,
            fontSize: 10,
            fontWeight: 700,
            color: SP.warn,
          }}
        >
          Photos floutées
        </div>
      )}
    </div>
  )
}

// ─── Vue 4 : Demandes (workflow approbation entrantes/sortantes) ─────────

interface DemandesViewProps {
  direction: ShareRequestDirection
  setDirection: (d: ShareRequestDirection) => void
}

function DemandesView({ direction, setDirection }: DemandesViewProps) {
  const filtered = useMemo(
    () => SHARE_REQUESTS.filter(r => r.direction === direction),
    [direction],
  )

  const kpis = useMemo(() => {
    const incomingPending = SHARE_REQUESTS.filter(r => r.direction === 'incoming' && r.status === 'pending').length
    const outgoingPending = SHARE_REQUESTS.filter(r => r.direction === 'outgoing' && r.status === 'pending').length
    const approved = SHARE_REQUESTS.filter(r => r.status === 'approved').length
    const refusedOrCountered = SHARE_REQUESTS.filter(r => r.status === 'refused' || r.status === 'countered').length
    return [
      { k: 'Entrantes en attente', v: String(incomingPending), sub: incomingPending > 0 ? 'à traiter' : 'à jour', tone: incomingPending > 0 ? 'warn' as const : 'neutral' as const },
      { k: 'Sortantes en attente', v: String(outgoingPending), sub: 'côté agence', tone: 'pending' as const },
      { k: 'Approuvées', v: String(approved), sub: 'historique', tone: 'ok' as const },
      { k: 'Refusées / négociées', v: String(refusedOrCountered), sub: 'à examiner', tone: 'neutral' as const },
    ]
  }, [])

  return (
    <>
      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
        }}
      >
        {kpis.map((k, i) => (
          <div
            key={i}
            style={{
              background: SP.surface,
              borderRadius: 18,
              padding: '16px 18px',
              boxShadow: SP.shadowSm,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: SP.muted,
              }}
            >
              {k.k}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                }}
              >
                {k.v}
              </div>
              <Pill tone={k.tone}>{k.sub}</Pill>
            </div>
          </div>
        ))}
      </div>

      {/* Direction toggle */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          background: SP.surface,
          borderRadius: 12,
          boxShadow: SP.shadowSm,
          alignSelf: 'flex-start',
        }}
      >
        {(['incoming', 'outgoing'] as ShareRequestDirection[]).map(dir => {
          const on = dir === direction
          const label = dir === 'incoming' ? 'Entrantes' : 'Sortantes'
          const sub = dir === 'incoming' ? 'reçues à traiter' : 'envoyées par moi'
          return (
            <button
              key={dir}
              onClick={() => setDirection(dir)}
              style={{
                padding: '8px 16px',
                borderRadius: 9,
                border: 0,
                background: on ? SP.ink : 'transparent',
                color: on ? '#fff' : SP.inkSoft,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 1,
                textAlign: 'left',
                transition: 'all .15s',
              }}
            >
              <span>{label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: on ? 'rgba(255,255,255,0.55)' : SP.muted,
                  letterSpacing: '.04em',
                }}
              >
                {sub}
              </span>
            </button>
          )
        })}
      </div>

      {/* Liste des demandes */}
      {filtered.length === 0 ? (
        <div
          style={{
            background: SP.surface,
            borderRadius: 18,
            padding: '60px 24px',
            textAlign: 'center',
            color: SP.muted,
            fontSize: 13,
          }}
        >
          Aucune demande {direction === 'incoming' ? 'entrante' : 'sortante'} pour
          le moment.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => (
            <RequestRow key={req.id} request={req} />
          ))}
        </div>
      )}
    </>
  )
}

function RequestRow({ request }: { request: ShareRequest }) {
  const partner = partnerById(request.agencyId)
  if (!partner) return null
  const isPending = request.status === 'pending'
  const isIncoming = request.direction === 'incoming'

  const formatPrice = (n: number, txn: 'vente' | 'location') => {
    if (n === 0) return '—'
    const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return txn === 'location' ? `CHF ${formatted}/mois` : `CHF ${formatted}`
  }

  return (
    <div
      style={{
        background: SP.surface,
        borderRadius: 18,
        padding: '18px 22px',
        boxShadow: SP.shadowSm,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'flex-start',
        opacity: !isPending ? 0.85 : 1,
      }}
    >
      {/* Agency logo */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: partner.logoBg,
          color: partner.logoColor,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: partner.logoLetterSpacing,
            fontFamily: 'Helvetica, Arial, sans-serif',
          }}
        >
          {partner.short}
        </span>
      </div>

      {/* Body */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Top line : agency + status pill + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: SP.ink, letterSpacing: -0.2 }}>
            {partner.name}
          </span>
          <Pill tone={REQUEST_STATUS_TONE[request.status]} dot>
            {REQUEST_STATUS_LABELS[request.status]}
          </Pill>
          <span style={{ fontSize: 11, color: SP.muted }}>
            {isIncoming ? '←' : '→'} {fmtRelative(request.createdAt)}
          </span>
        </div>

        {/* Bien info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '.08em',
              color: SP.muted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {request.bienRef}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: SP.ink }}>
            {request.bienTitle}
          </span>
          {request.bienPrice > 0 && (
            <>
              <span style={{ fontSize: 11.5, color: SP.muted }}>·</span>
              <span style={{ fontSize: 11.5, color: SP.muted }}>
                {request.bienType} · {request.bienZone} · {formatPrice(request.bienPrice, request.bienTransaction)}
              </span>
            </>
          )}
        </div>

        {/* Niveau demandé + counter (si applicable) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: SP.muted,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
            }}
          >
            Niveau demandé
          </span>
          <Pill tone={SHARE_LEVEL_TONE[request.requestedLevel]}>
            {SHARE_LEVEL_LABELS[request.requestedLevel]}
          </Pill>
          {request.counterLevel && (
            <>
              <span style={{ fontSize: 11.5, color: SP.muted }}>→</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: SP.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '.07em',
                }}
              >
                Contre-proposé
              </span>
              <Pill tone={SHARE_LEVEL_TONE[request.counterLevel]}>
                {SHARE_LEVEL_LABELS[request.counterLevel]}
              </Pill>
            </>
          )}
        </div>

        {/* Message */}
        {request.message && (
          <div
            style={{
              fontSize: 12,
              color: SP.inkSoft,
              padding: '10px 12px',
              borderRadius: 10,
              background: SP.cardSubtle,
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}
          >
            « {request.message} »
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'stretch',
          minWidth: 160,
        }}
      >
        {isIncoming && isPending && (
          <>
            <BlackBtn
              style={{ height: 32, padding: '0 12px', fontSize: 12 }}
              icon={<KycIcon name="check" size={11} stroke="#fff" sw={2.4} />}
            >
              Approuver
            </BlackBtn>
            <GhostBtn style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}>
              Négocier le niveau
            </GhostBtn>
            <GhostBtn
              style={{
                height: 32,
                padding: '0 12px',
                fontSize: 11.5,
                color: SP.danger,
              }}
            >
              Refuser
            </GhostBtn>
          </>
        )}
        {isIncoming && !isPending && (
          <span style={{ fontSize: 11, color: SP.muted, textAlign: 'center', fontStyle: 'italic' }}>
            Résolu {request.resolvedAt ? fmtRelative(request.resolvedAt) : ''}
          </span>
        )}
        {!isIncoming && isPending && (
          <GhostBtn style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}>
            Annuler la demande
          </GhostBtn>
        )}
        {!isIncoming && request.status === 'countered' && (
          <>
            <BlackBtn
              style={{ height: 32, padding: '0 12px', fontSize: 12 }}
              icon={<KycIcon name="check" size={11} stroke="#fff" sw={2.4} />}
            >
              Accepter contre
            </BlackBtn>
            <GhostBtn style={{ height: 32, padding: '0 12px', fontSize: 11.5 }}>
              Re-négocier
            </GhostBtn>
          </>
        )}
        {!isIncoming && request.status === 'refused' && (
          <span style={{ fontSize: 11, color: SP.muted, textAlign: 'center', fontStyle: 'italic' }}>
            Refusée {request.resolvedAt ? fmtRelative(request.resolvedAt) : ''}
          </span>
        )}
        {!isIncoming && request.status === 'approved' && (
          <span style={{ fontSize: 11, color: SP.ok, textAlign: 'center', fontWeight: 700 }}>
            Approuvée — accessible
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Vue 5 : stub Coming soon ────────────────────────────────────────────

function ComingSoonView({ tab, desc }: { tab: string; desc: string }) {
  return (
    <div
      style={{
        background: SP.surface,
        borderRadius: 22,
        padding: '60px 32px',
        textAlign: 'center',
        boxShadow: SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: SP.cardSubtle,
          display: 'grid',
          placeItems: 'center',
          color: SP.inkSoft,
        }}
      >
        <KycIcon name="lock" size={28} stroke={SP.inkSoft} sw={1.6} />
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: -0.3,
        }}
      >
        {tab} · prochaine PR
      </div>
      <div
        style={{
          fontSize: 13,
          color: SP.muted,
          maxWidth: 480,
          lineHeight: 1.55,
        }}
      >
        {desc}
      </div>
    </div>
  )
}

// ─── Bien share row (carte horizontale avec pills agences) ───────────────

function BienShareRow({ bien }: { bien: BienShareRule }) {
  const [hover, setHover] = useState(false)
  const formatPrice = (n: number, txn: 'vente' | 'location') => {
    const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
    return txn === 'location' ? `CHF ${formatted}/mois` : `CHF ${formatted}`
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: SP.surface,
        borderRadius: 18,
        padding: '16px 20px',
        boxShadow: hover ? SP.shadow : SP.shadowSm,
        transition: 'all .18s',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      {/* Visual placeholder */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          background: bien.accent + '22',
          display: 'grid',
          placeItems: 'center',
          color: bien.accent,
          flexShrink: 0,
        }}
      >
        <KycIcon name="doc" size={22} stroke={bien.accent} sw={1.7} />
      </div>

      {/* Bien info + share pills */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '.09em',
              color: SP.muted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {bien.ref}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: SP.ink,
            }}
          >
            {bien.title}
          </span>
          {bien.status !== 'active' && (
            <Pill tone={bien.status === 'reserved' ? 'warn' : 'neutral'}>
              {bien.status === 'reserved'
                ? 'Réservé'
                : bien.status === 'draft'
                  ? 'Brouillon'
                  : bien.status}
            </Pill>
          )}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: SP.muted,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span>{bien.address}</span>
          <span>·</span>
          <span>{bien.type}</span>
          {bien.rooms !== null && <><span>·</span><span>{bien.rooms} pièces</span></>}
          <span>·</span>
          <span>{bien.area} m²</span>
          <span>·</span>
          <span style={{ color: SP.ink, fontWeight: 600 }}>{formatPrice(bien.price, bien.transaction)}</span>
        </div>
        {bien.shares.length === 0 ? (
          <div style={{ fontSize: 12, color: SP.muted, fontStyle: 'italic' }}>
            Pas encore partagé.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {bien.shares.map(share => (
              <SharePill key={share.agencyId} share={share} />
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <GhostBtn
        style={{ height: 34, padding: '0 14px', fontSize: 12 }}
      >
        Régler partage
      </GhostBtn>
    </div>
  )
}

function SharePill({
  share,
}: {
  share: { agencyId: string; level: AgencyShareLevel }
}) {
  const partner = partnerById(share.agencyId)
  if (!partner) return null
  const tone = SHARE_LEVEL_TONE[share.level]
  return (
    <Pill tone={tone}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: partner.logoBg,
          flexShrink: 0,
          marginRight: 4,
        }}
      />
      {partner.short} · {SHARE_LEVEL_LABELS[share.level]}
    </Pill>
  )
}

interface AgencyCardProps {
  agency: AgencyPartner
}

function AgencyCard({ agency }: AgencyCardProps) {
  const [hover, setHover] = useState(false)
  const tone = STATUS_TONE[agency.status]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: SP.surface,
        borderRadius: 22,
        padding: 20,
        boxShadow: hover ? SP.shadow : SP.shadowSm,
        transition: 'all .18s ease',
        transform: hover ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        cursor: 'pointer',
      }}
    >
      {/* Header : logo + nom + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AgencyLogo agency={agency} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: -0.2,
              color: SP.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agency.name}
          </div>
          <div style={{ fontSize: 11.5, color: SP.muted, marginTop: 2 }}>
            {agency.city} · {fmtRelative(agency.lastInteractionAt)}
          </div>
        </div>
        <Pill tone={tone} dot>
          {RELATION_LABELS[agency.status]}
        </Pill>
      </div>

      {/* Note */}
      {agency.note && (
        <div
          style={{
            fontSize: 12,
            color: SP.inkSoft,
            lineHeight: 1.5,
            padding: '10px 12px',
            borderRadius: 12,
            background: SP.cardSubtle,
          }}
        >
          {agency.note}
        </div>
      )}

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
        }}
      >
        <SmallStat label="Partagés" value={agency.sharedOut} icon="upload" />
        <SmallStat label="Reçus" value={agency.sharedIn} icon="arrow" />
        <SmallStat
          label="Niveau"
          value={SHARE_LEVEL_LABELS[agency.defaultLevel]}
          icon="shield"
          asText
        />
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <BlackBtn
          style={{ height: 34, padding: '0 14px', fontSize: 12.5, flex: 1 }}
          icon={<KycIcon name="arrow" size={12} stroke="#fff" sw={2.2} />}
        >
          Voir biens partagés
        </BlackBtn>
        <GhostBtn style={{ height: 34, padding: '0 14px', fontSize: 12 }}>
          Réglages
        </GhostBtn>
      </div>
    </div>
  )
}

function AgencyLogo({ agency, size = 44 }: { agency: AgencyPartner; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: agency.logoBg,
        color: agency.logoColor,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: Math.round(size * 0.22),
          fontWeight: 800,
          letterSpacing: agency.logoLetterSpacing,
          color: agency.logoColor,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {agency.logoText}
      </span>
    </div>
  )
}

interface SmallStatProps {
  label: string
  value: number | string
  icon: 'upload' | 'arrow' | 'shield'
  asText?: boolean
}

function SmallStat({ label, value, icon, asText }: SmallStatProps) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        background: SP.cardSubtle,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: SP.muted,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <KycIcon name={icon} size={10} stroke={SP.muted} sw={2} />
        {label}
      </div>
      <div
        style={{
          fontSize: asText ? 13 : 17,
          fontWeight: 700,
          color: SP.ink,
          letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}
