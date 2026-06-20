// MEGGA CRM Sugar v2 Wizard — Step 6 : Options
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step6.jsx).

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, shade, sgOn, sgAcc, type WizardData } from '../tokens'
import { SgSwitch } from '../primitives'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

const STYLES: { v: string; labelKey: string; tone: string; accent: string }[] = [
  { v: 'scandinave', labelKey: 'wizard.step6.style.scandinave', tone: '#E8E4DD', accent: '#A8B5BF' },
  { v: 'moderne',    labelKey: 'wizard.step6.style.modern',     tone: '#D4D8DC', accent: '#3C4148' },
  { v: 'chaleureux', labelKey: 'wizard.step6.style.warm',       tone: '#E8D6C2', accent: '#8B6F4E' },
  { v: 'minimal',    labelKey: 'wizard.step6.style.minimal',    tone: '#EFEFEF', accent: '#0B0C0E' },
  { v: 'luxe',       labelKey: 'wizard.step6.style.luxe',       tone: '#D9C9A0', accent: '#7A632E' },
  { v: 'familial',   labelKey: 'wizard.step6.style.family',     tone: '#D6E1D8', accent: '#5A7A60' },
]

export function Step6Options({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const opt = data.options
  const setOpt = (patch: Partial<typeof opt>) => set({ options: { ...opt, ...patch } })

  const stagingUserOn = !!opt.virtualStagingUser
  const [sliderPos, setSliderPos] = useState(50)

  const stagingAgent = opt.virtualStagingAgent || []
  const toggleStyle = (v: string) => {
    const next = stagingAgent.includes(v)
      ? stagingAgent.filter(s => s !== v)
      : [...stagingAgent, v]
    setOpt({ virtualStagingAgent: next })
  }

  const total = (
    (stagingUserOn ? 49 : 0) +
    (stagingAgent.length * 29) +
    (opt.featured ? 199 : 0) +
    (opt.videoTour ? 89 : 0)
  )

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      <div style={{ marginBottom: 36, maxWidth: 760 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{tr('wizard.step6.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{tr('wizard.step6.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {tr('wizard.step6.intro')}
        </p>
      </div>

      {/* Bloc 1 — Staging acheteur */}
      <div style={{
        background: SugarV2.card, borderRadius: 28, overflow: 'hidden',
        boxShadow: SugarV2.shadow, marginBottom: 22,
        display: 'grid', gridTemplateColumns: '1.4fr 1fr',
      }}>
        <div style={{
          position: 'relative', aspectRatio: '4 / 3', minHeight: 360,
          background: '#222',
          userSelect: 'none',
        }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - r.left) / r.width) * 100
          setSliderPos(Math.max(0, Math.min(100, x)))
        }}>
          <div style={{ position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(45deg, #C8CDD3 0 14px, #BFC4CA 14px 28px)',
          }}>
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: 'rgba(0,0,0,0.25)',
            }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M3 21V11l9-7 9 7v10"/><path d="M9 21v-7h6v7"/>
              </svg>
            </div>
            <div style={{
              position: 'absolute', top: 16, left: 16,
              padding: '5px 11px', borderRadius: 999,
              background: sgAcc(0.92), color: SugarV2.ink,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>{tr('wizard.step6.staging.before')}</div>
          </div>

          <div style={{
            position: 'absolute', inset: 0,
            clipPath: `inset(0 0 0 ${sliderPos}%)`,
            background: 'repeating-linear-gradient(135deg, #D4DDE3 0 14px, #C4CDD3 14px 28px)',
          }}>
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: 'rgba(0,0,0,0.40)',
            }}>
              <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.9">
                <rect x="3" y="13" width="18" height="6" rx="2"/>
                <path d="M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
                <path d="M5 19v2M19 19v2"/>
                <rect x="8" y="3" width="8" height="4" rx="1"/>
              </svg>
            </div>
            <div style={{
              position: 'absolute', top: 16, right: 16,
              padding: '5px 11px', borderRadius: 999,
              background: SugarV2.black, color: sgOn(),
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>{tr('wizard.step6.staging.after')}</div>
          </div>

          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
            width: 2, background: sgOn(),
            boxShadow: '0 0 24px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 44, height: 44, borderRadius: 999,
              background: sgOn(),
              boxShadow: '0 6px 20px rgba(0,0,0,0.30)',
              display: 'grid', placeItems: 'center',
              color: SugarV2.ink, fontSize: 14, fontWeight: 700,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/>
              </svg>
            </div>
          </div>

          <div style={{
            position: 'absolute', bottom: 14, left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 11px', borderRadius: 999,
            background: 'rgba(0,0,0,0.65)', color: sgOn(),
            fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
            backdropFilter: 'blur(6px)',
          }}>{tr('wizard.step6.staging.dragToCompare')}</div>
        </div>

        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: SugarV2.muted,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
          }}>{tr('wizard.step6.staging.buyerEyebrow')}</div>
          <h3 style={{
            margin: '0 0 12px', fontSize: 24, fontWeight: 700,
            color: SugarV2.ink, letterSpacing: -0.5, lineHeight: 1.2,
          }}>{tr('wizard.step6.staging.buyerTitle')}</h3>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            {tr('wizard.step6.staging.buyerDesc')}
          </p>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px', borderRadius: 16,
            background: stagingUserOn ? SugarV2.black : SugarV2.cardSubtle,
            color: stagingUserOn ? sgOn() : SugarV2.ink,
            transition: 'all .25s ease',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, marginBottom: 2 }}>
                {tr('wizard.step6.staging.enableBuyer')}
              </div>
              <div style={{
                fontSize: 11.5, fontWeight: 500,
                color: stagingUserOn ? sgAcc(0.70) : SugarV2.muted,
              }}>
                {tr('wizard.step6.staging.buyerPrice', { price: 49 })}
              </div>
            </div>
            <SgSwitch
              checked={stagingUserOn}
              onChange={() => setOpt({ virtualStagingUser: !stagingUserOn })}
              dark={stagingUserOn} />
          </div>

          <div style={{
            marginTop: 16, paddingTop: 16,
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: SugarV2.cardSubtle,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.1, marginBottom: 2 }}>
                {tr('wizard.step6.staging.provenanceTitle')}
              </div>
              <div style={{ fontSize: 11, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.4 }}>
                {tr('wizard.step6.staging.provenanceDesc')}
              </div>
            </div>
            <span style={{
              padding: '4px 10px', borderRadius: 6, background: SugarV2.cardSubtle,
              color: SugarV2.ink, fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>C2PA</span>
          </div>
        </div>
      </div>

      {/* Bloc 2 — Staging agent */}
      <div style={{
        background: SugarV2.card, borderRadius: 28, padding: 28,
        boxShadow: SugarV2.shadow, marginBottom: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
            }}>{tr('wizard.step6.agent.eyebrow')}</div>
            <h3 style={{
              margin: '0 0 6px', fontSize: 22, fontWeight: 700,
              color: SugarV2.ink, letterSpacing: -0.4, lineHeight: 1.2,
            }}>{tr('wizard.step6.agent.title')}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55, maxWidth: 540 }}>
              {tr('wizard.step6.agent.desc')}
            </p>
          </div>
          {stagingAgent.length > 0 && (
            <div style={{
              padding: '6px 12px', borderRadius: 999,
              background: SugarV2.black, color: sgOn(),
              fontSize: 11.5, fontWeight: 700, letterSpacing: 0.2,
              flexShrink: 0,
            }}>
              {tr('wizard.step6.agent.selectedStyles', { count: stagingAgent.length, price: stagingAgent.length * 29 })}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {STYLES.map(s => {
            const sel = stagingAgent.includes(s.v)
            return (
              <button key={s.v} onClick={() => toggleStyle(s.v)} style={{
                position: 'relative', padding: 0, borderRadius: 18, border: 0,
                background: SugarV2.cardSubtle, fontFamily: 'inherit', cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: sel ? '0 12px 30px rgba(0,0,0,0.18)' : 'none',
                outline: sel ? `3px solid ${SugarV2.black}` : 'none', outlineOffset: -3,
                transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-2px)' : 'translateY(0)',
              }}>
                <div style={{
                  height: 110,
                  background: `linear-gradient(135deg, ${s.tone} 0%, ${shade(s.tone, -0.05)} 100%)`,
                  display: 'grid', placeItems: 'center',
                  color: s.accent,
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="13" width="18" height="6" rx="2"/>
                    <path d="M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
                    <rect x="8" y="3" width="8" height="4" rx="1"/>
                  </svg>
                </div>
                <div style={{
                  padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: SugarV2.card,
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2 }}>
                      {tr(s.labelKey)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: SugarV2.muted, marginTop: 1 }}>
                      {tr('wizard.step6.pricePerStyle', { price: 29 })}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: sel ? SugarV2.black : 'transparent',
                    boxShadow: sel ? 'none' : `inset 0 0 0 2px ${SugarV2.ghost}`,
                    display: 'grid', placeItems: 'center',
                    transition: 'all .15s ease',
                  }}>
                    {sel && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bloc 3 + 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginBottom: 22 }}>
        <OptionCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m13 2-3 7h6l-3 13"/>
              <path d="M13 2 8 9h2"/>
            </svg>
          }
          tag={tr('wizard.step6.featured.tag')}
          title={tr('wizard.step6.featured.title')}
          subtitle={tr('wizard.step6.featured.subtitle')}
          price={tr('wizard.step6.priceChf', { price: 199 })}
          checked={!!opt.featured}
          onToggle={() => setOpt({ featured: !opt.featured })}
          stats={[
            { label: tr('wizard.step6.featured.statViews'), value: '×3,2' },
            { label: tr('wizard.step6.featured.statRequests'), value: '×2,4' },
          ]}
        />

        <OptionCard
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="14" height="12" rx="2"/>
              <path d="m17 10 4-2v8l-4-2"/>
            </svg>
          }
          tag={tr('wizard.step6.video.tag')}
          title={tr('wizard.step6.video.title')}
          subtitle={tr('wizard.step6.video.subtitle')}
          price={tr('wizard.step6.priceChf', { price: 89 })}
          checked={!!opt.videoTour}
          onToggle={() => setOpt({ videoTour: !opt.videoTour })}
          stats={[
            { label: tr('wizard.step6.video.statDelay'),     value: tr('wizard.step6.video.statDelayValue', { count: 7 }) },
            { label: tr('wizard.step6.video.statEngagement'), value: '+58 %' },
          ]}
        />
      </div>

      {/* Récap total */}
      <div style={{
        background: SugarV2.card, borderRadius: 22, padding: '20px 24px',
        boxShadow: SugarV2.shadow,
        display: 'flex', alignItems: 'center', gap: 16,
        animation: total > 0 ? 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both' : 'none',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: total > 0 ? SugarV2.black : SugarV2.cardSubtle,
          color: total > 0 ? sgOn() : SugarV2.muted,
          display: 'grid', placeItems: 'center', flexShrink: 0,
          transition: 'all .25s ease',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2"/>
            <path d="M3 10h18M7 15h2"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: SugarV2.muted,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
          }}>
            {tr('wizard.step6.recap.eyebrow')}
          </div>
          <div style={{ fontSize: 15, color: SugarV2.ink, fontWeight: 600, letterSpacing: -0.2 }}>
            {total === 0
              ? tr('wizard.step6.recap.empty')
              : tr('wizard.step6.recap.total', { total })}
          </div>
        </div>
        {total > 0 && (
          <div style={{
            fontSize: 28, fontWeight: 800, color: SugarV2.ink, letterSpacing: -1,
          }}>{total} <span style={{ fontSize: 13, fontWeight: 700, color: SugarV2.muted, letterSpacing: 0.2 }}>CHF</span></div>
        )}
      </div>
    </div>
  )
}

function OptionCard({
  icon, tag, title, subtitle, price, checked, onToggle, stats,
}: {
  icon: ReactNode
  tag: string
  title: string
  subtitle: string
  price: string
  checked: boolean
  onToggle: () => void
  stats: { label: string; value: string }[]
}) {
  return (
    <div style={{
      background: checked ? SugarV2.black : SugarV2.card,
      color: checked ? sgOn() : SugarV2.ink,
      borderRadius: 24, padding: 24,
      boxShadow: checked ? '0 20px 48px rgba(0,0,0,0.28)' : SugarV2.shadow,
      transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
      transform: checked ? 'translateY(-2px)' : 'translateY(0)',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: checked ? sgAcc(0.12) : SugarV2.cardSubtle,
          color: checked ? sgOn() : SugarV2.ink,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>{icon}</div>
        <SgSwitch checked={checked} onChange={onToggle} dark={checked} />
      </div>

      <div>
        <div style={{
          fontSize: 10.5, fontWeight: 700,
          color: checked ? sgAcc(0.65) : SugarV2.muted,
          letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
        }}>{tag}</div>
        <h3 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2 }}>
          {title}
        </h3>
        <p style={{
          margin: 0, fontSize: 13.5, fontWeight: 500, lineHeight: 1.55,
          color: checked ? sgAcc(0.75) : SugarV2.inkSoft,
        }}>{subtitle}</p>
      </div>

      <div style={{
        marginTop: 'auto', paddingTop: 14,
        borderTop: `1px solid ${checked ? sgAcc(0.10) : 'rgba(0,0,0,0.05)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      }}>
        <div style={{ display: 'flex', gap: 18 }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{
                fontSize: 9.5, fontWeight: 700,
                color: checked ? sgAcc(0.55) : SugarV2.muted,
                letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2,
              }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{price}</div>
      </div>
    </div>
  )
}
