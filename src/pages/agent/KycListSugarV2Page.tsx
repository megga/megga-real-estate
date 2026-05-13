// MEGGA CRM Sugar v2 — KYC list/dashboard (Tier 4)
// 1:1 port from `megga-kyc-variations.jsx` VariationC (lines 595-743).
// Wiring Supabase via useKycCases — fallback sur KYC_ROWS mock si table vide.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  Avatar, BlackBtn, GhostBtn, KycIcon, Pill, SP,
} from '@/components/crm-sugar/kyc/atoms'
import {
  KYC_FILTERS, KYC_KPIS, KYC_ROWS, KYC_STATUS_MAP,
} from '@/components/crm-sugar/kyc/data'
import { KycWizardModal } from '@/components/crm-sugar/kyc/KycWizardModal'
import { mapKycCaseToRow } from '@/components/crm-sugar/kyc/mapping'
import { useKycCases } from '@/hooks/useKyc'

const DARK_TONE: DarkTone = 'meggaAi'

export default function KycListSugarV2Page() {
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

  const [activeFilter, setActiveFilter] = useState<number>(1)
  const [wizardOpen, setWizardOpen] = useState(false)

  // ─── Real data from Supabase ──────────────────────────────────────────
  const { data: kycCases, isLoading, isError, error } = useKycCases()
  const isUsingMock = !kycCases || kycCases.length === 0
  const rows = useMemo(
    () =>
      isUsingMock
        ? KYC_ROWS
        : kycCases.map(mapKycCaseToRow),
    [kycCases, isUsingMock],
  )

  const kpis = useMemo(() => {
    if (isUsingMock) return KYC_KPIS
    const total = kycCases.length
    const review = kycCases.filter(c => c.status === 'review').length
    const high = kycCases.filter(c => (c.risk_score ?? 0) >= 60).length
    const stale = kycCases.filter(c => {
      if (!c.last_screening_at) return false
      const months = (Date.now() - new Date(c.last_screening_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      return months > 12
    }).length
    const avgRisk = total > 0
      ? Math.round(kycCases.reduce((sum, c) => sum + (c.risk_score ?? 0), 0) / total)
      : 0
    return [
      { k: 'Dossiers actifs', v: String(total), sub: `${total} au total`, tone: 'neutral' as const },
      { k: 'À valider', v: String(review), sub: 'En revue', tone: 'warn' as const },
      { k: 'Score moyen', v: String(avgRisk), sub: avgRisk < 30 ? 'Faible' : avgRisk < 60 ? 'Moyen' : 'Élevé', tone: avgRisk < 30 ? 'ok' as const : avgRisk < 60 ? 'warn' as const : 'danger' as const },
      { k: 'Risque élevé', v: String(high), sub: 'Score ≥ 60', tone: 'danger' as const },
      { k: 'Screenings > 12 mois', v: String(stale), sub: 'À rafraîchir', tone: 'pending' as const },
    ]
  }, [kycCases, isUsingMock])

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
      case 'kyc': break
      case 'reseau': navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'auto': navigate('/dashboard/automation'); break
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
        active={'kyc' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="kyc"
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
                Agence Carouge · Conformité LBA
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: -0.8,
                  lineHeight: 1.05,
                }}
              >
                Tableau de bord KYC
              </div>
            </div>
            <GhostBtn>Exporter</GhostBtn>
            <BlackBtn
              onClick={() => setWizardOpen(true)}
              icon={<KycIcon name="plus" size={14} stroke="#fff" sw={2.2} />}
              style={{ height: 40 }}
            >
              Nouveau dossier
            </BlackBtn>
          </div>

          {/* Demo banner if using mock data */}
          {isUsingMock && !isLoading && !isError && (
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
              Mode démo · aucun dossier KYC dans Supabase. Affichage des données
              d'exemple. Cliquez « Nouveau dossier » pour créer le premier.
            </div>
          )}
          {isError && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 14,
                background: SP.dangerSoft,
                color: SP.danger,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <KycIcon name="alert" size={14} stroke={SP.danger} sw={2} />
              Erreur de chargement : {(error as Error)?.message || 'inconnue'}
            </div>
          )}

          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
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

          {/* Filtres */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {KYC_FILTERS.map((f, i) => (
              <button
                key={f}
                onClick={() => setActiveFilter(i)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: 0,
                  background: i === activeFilter ? SP.ink : SP.surface,
                  color: i === activeFilter ? '#fff' : SP.inkSoft,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  boxShadow: i === activeFilter ? 'none' : SP.shadowSm,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                {f}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: SP.muted,
                fontSize: 12.5,
                minWidth: 220,
              }}
            >
              <KycIcon name="scan" size={14} />
              <span>Rechercher · nom, ID, agent…</span>
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              background: SP.surface,
              borderRadius: 22,
              boxShadow: SP.shadow,
              overflow: 'hidden',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '60px 1.7fr 1fr 1.1fr 90px 100px 110px 1.4fr 110px 60px',
                padding: '14px 22px',
                borderBottom: `1px solid ${SP.cardSubtle}`,
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: SP.muted,
                background: SP.cardSubtle,
              }}
            >
              <div>ID</div>
              <div>Contact</div>
              <div>Type</div>
              <div>Montant</div>
              <div>Risque</div>
              <div>PEP/S</div>
              <div>Statut</div>
              <div>Progression</div>
              <div>Agent</div>
              <div></div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {isLoading && (
                <div
                  style={{
                    padding: 60,
                    textAlign: 'center',
                    color: SP.muted,
                    fontSize: 13,
                  }}
                >
                  Chargement des dossiers KYC…
                </div>
              )}
              {!isLoading && rows.map((r, i) => {
                const riskColor =
                  r.risk >= 60 ? SP.danger : r.risk >= 30 ? SP.warn : SP.ok
                const stConf = KYC_STATUS_MAP[r.st]
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/dashboard/kyc/${r.id}`)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '60px 1.7fr 1fr 1.1fr 90px 100px 110px 1.4fr 110px 60px',
                      padding: '12px 22px',
                      alignItems: 'center',
                      borderBottom:
                        i < rows.length - 1
                          ? `1px solid ${SP.cardSubtle}`
                          : 'none',
                      fontSize: 13,
                      color: SP.ink,
                      cursor: 'pointer',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = SP.cardSubtle
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        fontVariantNumeric: 'tabular-nums',
                        color: SP.muted,
                        fontWeight: 700,
                        fontSize: 11.5,
                      }}
                    >
                      #{r.id}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Avatar name={r.name} size={32} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.name}</div>
                        {r.days > 0 && (
                          <div
                            style={{
                              fontSize: 10.5,
                              color: r.days > 5 ? SP.danger : SP.muted,
                              marginTop: 1,
                            }}
                          >
                            en attente {r.days}j
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: SP.inkSoft }}>{r.type}</div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.amt}
                    </div>
                    <div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: riskColor,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {r.risk}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: SP.muted,
                          marginLeft: 4,
                        }}
                      >
                        /100
                      </span>
                    </div>
                    <div>
                      {r.pep === 'ok' && <Pill tone="ok" dot>Clean</Pill>}
                      {r.pep === 'review' && <Pill tone="warn" dot>À voir</Pill>}
                      {r.pep === 'match' && <Pill tone="danger" dot>Match</Pill>}
                    </div>
                    <div>
                      <Pill tone={stConf.tone} dot>
                        {stConf.label}
                      </Pill>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 999,
                          background: SP.cardSubtle,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${r.prog}%`,
                            height: '100%',
                            background: r.prog === 100 ? SP.ok : SP.ink,
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: SP.inkSoft,
                          fontVariantNumeric: 'tabular-nums',
                          width: 36,
                          textAlign: 'right',
                        }}
                      >
                        {r.prog}%
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: SP.inkSoft }}>{r.agent}</div>
                    <div style={{ textAlign: 'right' }}>
                      <KycIcon name="chev" size={14} stroke={SP.muted} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {wizardOpen && <KycWizardModal onClose={() => setWizardOpen(false)} />}
    </div>
  )
}
