// MEGGA CRM Sugar v2 — KYC detail (Tier 4)
// 1:1 port from `megga-kyc-variations.jsx` VariationB (lines 370-590).

import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  Avatar, BlackBtn, GhostBtn, KycIcon, Pill, SectionLabel, SP,
} from '@/components/crm-sugar/kyc/atoms'
import { KYC_DETAIL_MOCK } from '@/components/crm-sugar/kyc/data'

const DARK_TONE: DarkTone = 'meggaAi'

export default function KycDetailSugarV2Page() {
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
      case 'auto': navigate('/dashboard/automation'); break
      case 'chat': navigate('/dashboard/messages'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  const data = KYC_DETAIL_MOCK
  const heroStats: { label: string; v: string; sub: string; tone: 'ok' | 'neutral' }[] = [
    { label: 'Risque', v: String(data.hero.riskScore), sub: data.hero.riskLabel, tone: 'ok' },
    {
      label: 'Progression',
      v: `${data.hero.progressPct}%`,
      sub: data.hero.progressSub,
      tone: 'neutral',
    },
    {
      label: 'Dernier screening',
      v: data.hero.lastScreening,
      sub: data.hero.lastScreeningSub,
      tone: 'neutral',
    },
  ]

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
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => navigate('/dashboard/kyc')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SP.muted,
                letterSpacing: '.05em',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              CRM › Conformité › Dossiers KYC ›
            </button>
            <div style={{ fontSize: 11, fontWeight: 700, color: SP.ink }}>
              {data.hero.ref}
            </div>
            <div style={{ flex: 1 }} />
            <Pill tone="warn" dot>
              En revue
            </Pill>
            <GhostBtn>Imprimer</GhostBtn>
            <BlackBtn
              icon={<KycIcon name="shield" size={14} stroke="#fff" sw={2} />}
              style={{ height: 38 }}
            >
              Valider le dossier
            </BlackBtn>
          </div>

          {/* Hero card */}
          <div
            style={{
              background: SP.surface,
              borderRadius: 22,
              padding: '22px 26px',
              boxShadow: SP.shadow,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto auto',
              gap: 22,
              alignItems: 'center',
            }}
          >
            <Avatar name={data.hero.name} size={56} />
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                  }}
                >
                  {data.hero.name}
                </div>
                <Pill tone="neutral">{data.hero.badge}</Pill>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: SP.muted,
                  display: 'flex',
                  gap: 14,
                }}
              >
                {data.hero.metaItems.map((item, i) => (
                  <Fragment key={i}>
                    <span>{item}</span>
                    {i < data.hero.metaItems.length - 1 && <span>·</span>}
                  </Fragment>
                ))}
              </div>
            </div>
            {heroStats.map(s => (
              <div
                key={s.label}
                style={{
                  textAlign: 'right',
                  paddingLeft: 22,
                  borderLeft: `1px solid ${SP.cardSubtle}`,
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
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: -0.6,
                    color: s.tone === 'ok' ? SP.ok : SP.ink,
                    marginTop: 2,
                  }}
                >
                  {s.v}
                </div>
                <div style={{ fontSize: 11, color: SP.muted, marginTop: 2 }}>
                  {s.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Body 3 colonnes */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '300px 1fr 320px',
              gap: 18,
              minHeight: 0,
            }}
          >
            {/* Colonne gauche : étapes du dossier */}
            <div
              style={{
                background: SP.surface,
                borderRadius: 22,
                padding: 18,
                boxShadow: SP.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <SectionLabel>Étapes du dossier</SectionLabel>
              {data.steps.map((s, i) => {
                const stateConf =
                  s.state === 'done'
                    ? {
                        ring: SP.okSoft,
                        bg: SP.ok,
                        mark: (
                          <KycIcon
                            name="check"
                            size={11}
                            stroke="#fff"
                            sw={3}
                          />
                        ),
                      }
                    : s.state === 'active'
                      ? {
                          ring: 'rgba(11,12,14,0.08)',
                          bg: SP.ink,
                          mark: (
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: '#fff',
                              }}
                            />
                          ),
                        }
                      : {
                          ring: SP.cardSubtle,
                          bg: '#fff',
                          mark: null,
                        }
                return (
                  <div
                    key={s.k}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 8px',
                      alignItems: 'flex-start',
                      borderRadius: 12,
                      background:
                        s.state === 'active' ? SP.cardSubtle : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: stateConf.bg,
                          boxShadow:
                            s.state === 'todo'
                              ? `0 0 0 1.5px ${SP.ghost} inset`
                              : `0 0 0 4px ${stateConf.ring}`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {stateConf.mark}
                      </div>
                      {i < data.steps.length - 1 && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            background: SP.cardSubtle,
                            marginTop: 4,
                            minHeight: 16,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: s.state === 'todo' ? SP.muted : SP.ink,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{ fontSize: 11.5, color: SP.muted, marginTop: 2 }}
                      >
                        {s.sub}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Colonne centre : screening + risque */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Screening */}
              <div
                style={{
                  background: SP.surface,
                  borderRadius: 22,
                  padding: 22,
                  boxShadow: SP.shadow,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <KycIcon name="scan" size={16} stroke={SP.ink} sw={2} />
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      letterSpacing: -0.3,
                    }}
                  >
                    Screening PEP & sanctions
                  </div>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: SP.muted }}>
                    {data.screeningLastRun} · {data.screeningSources} sources
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: 10,
                  }}
                >
                  {data.screenings.map(r => (
                    <div
                      key={r.src}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: SP.cardSubtle,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: SP.muted,
                          marginBottom: 6,
                        }}
                      >
                        {r.src}
                      </div>
                      {r.match === 'clear' ? (
                        <Pill tone="ok" dot>
                          Aucune correspondance
                        </Pill>
                      ) : (
                        <Pill tone="warn" dot>
                          1 correspondance partielle
                        </Pill>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: SP.warnSoft,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <KycIcon name="alert" size={16} stroke={SP.warn} sw={2} />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: SP.ink,
                      }}
                    >
                      1 alerte à examiner
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: SP.inkSoft,
                        marginTop: 2,
                        lineHeight: 1.5,
                      }}
                    >
                      {data.alertText}
                    </div>
                  </div>
                  <GhostBtn
                    style={{ height: 30, padding: '0 12px', fontSize: 12 }}
                  >
                    Examiner
                  </GhostBtn>
                </div>
              </div>

              {/* Risque */}
              <div
                style={{
                  background: SP.surface,
                  borderRadius: 22,
                  padding: 22,
                  boxShadow: SP.shadow,
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <KycIcon name="shield" size={16} stroke={SP.ink} sw={2} />
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      letterSpacing: -0.3,
                    }}
                  >
                    Évaluation du risque
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 24,
                    alignItems: 'center',
                  }}
                >
                  {/* gauge */}
                  <div
                    style={{
                      position: 'relative',
                      width: 140,
                      height: 140,
                    }}
                  >
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle
                        cx="70"
                        cy="70"
                        r="58"
                        fill="none"
                        stroke={SP.cardSubtle}
                        strokeWidth="14"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="58"
                        fill="none"
                        stroke={SP.ok}
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeDasharray={`${(data.riskScore / 100) * 2 * Math.PI * 58} 1000`}
                        transform="rotate(-90 70 70)"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 36,
                            fontWeight: 700,
                            letterSpacing: -1.5,
                            color: SP.ok,
                            lineHeight: 1,
                          }}
                        >
                          {data.riskScore}
                        </div>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            letterSpacing: '.09em',
                            textTransform: 'uppercase',
                            color: SP.muted,
                            marginTop: 4,
                          }}
                        >
                          / 100
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {data.riskRows.map(r => (
                      <div
                        key={r.k}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '180px 1fr 36px',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: 12, color: SP.inkSoft }}>{r.k}</div>
                        <div
                          style={{
                            height: 6,
                            background: SP.cardSubtle,
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${(r.v / r.max) * 100}%`,
                              height: '100%',
                              background: r.v > 0 ? SP.ink : 'transparent',
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: SP.ink,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          +{r.v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite : pièces */}
            <div
              style={{
                background: SP.surface,
                borderRadius: 22,
                padding: 18,
                boxShadow: SP.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <SectionLabel>Pièces du dossier</SectionLabel>
                <div style={{ flex: 1 }} />
                <GhostBtn
                  style={{
                    height: 28,
                    padding: '0 10px',
                    fontSize: 11.5,
                  }}
                >
                  + Ajouter
                </GhostBtn>
              </div>
              {data.docs.map(d => (
                <div
                  key={d.name}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: SP.cardSubtle,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: SP.surface,
                      display: 'grid',
                      placeItems: 'center',
                      color: SP.inkSoft,
                    }}
                  >
                    <KycIcon name="doc" size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {d.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: SP.muted,
                        marginTop: 1,
                      }}
                    >
                      {d.by}
                    </div>
                  </div>
                  {d.state === 'ok' && (
                    <span
                      title={d.method ? `Méthode : ${d.method}` : undefined}
                      style={{ display: 'inline-flex' }}
                    >
                      <KycIcon name="check" size={14} stroke={SP.ok} sw={2.4} />
                    </span>
                  )}
                  {d.state === 'wait' && (
                    <KycIcon name="clock" size={14} stroke={SP.warn} sw={2} />
                  )}
                  {d.state === 'todo' && (
                    <KycIcon name="plus" size={14} stroke={SP.muted} sw={2} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
