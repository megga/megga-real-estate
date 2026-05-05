// MEGGA CRM Sugar v2 — Réseau d'agences (Tier 5 — vue 1 « Mon réseau »)
// Visual MVP du module multi-tenant. Mock data uniquement (5 agences partenaires).
// Les écritures + RLS + templates PDF arrivent dans des PRs ultérieures
// (cf. HANDOFF_RESEAU_AGENCES.md du bundle).

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
  RESEAU_FILTERS, RESEAU_PARTNERS, RELATION_LABELS, SHARE_LEVEL_LABELS,
  type AgencyPartner, type AgencyRelationStatus,
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

  const [activeFilter, setActiveFilter] = useState<AgencyRelationStatus | 'all'>('all')
  const [search, setSearch] = useState('')

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
        </main>
      </div>
    </div>
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
