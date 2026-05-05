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
  BIEN_SHARE_RULES, RESEAU_FILTERS, RESEAU_PARTNERS, RESEAU_TABS,
  RELATION_LABELS, SHARE_LEVEL_LABELS, SHARE_LEVEL_TONE, partnerById,
  type AgencyPartner, type AgencyRelationStatus, type AgencyShareLevel,
  type BienShareRule, type ReseauTabId,
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
            <ComingSoonView
              tab="Biens reçus"
              desc="Vue des biens partagés par d'autres agences avec mon CRM, filtrable par agence et niveau d'autorisation."
            />
          )}
          {activeTab === 'demandes' && (
            <ComingSoonView
              tab="Demandes"
              desc="Workflow d'approbation entrante / sortante : approuver, refuser, négocier le niveau de partage."
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

// ─── Vue 3-4-5 : stub Coming soon ────────────────────────────────────────

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
