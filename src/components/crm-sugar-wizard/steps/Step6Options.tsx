// MEGGA CRM Sugar v2 Wizard — Step 6 : Options
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step6.jsx).

import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, sgAcc, type WizardData } from '../tokens'
import { SgSwitch } from '../primitives'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

export function Step6Options({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const opt = data.options
  const setOpt = (patch: Partial<typeof opt>) => set({ options: { ...opt, ...patch } })

  const total = (
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
