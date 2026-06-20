// MEGGA CRM Sugar v2 Wizard — Step 3 : Caractéristiques
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step3.jsx).
// Type, surface, pièces, année, DPE, équipements.

import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, type WizardData } from '../tokens'
import { SgSection } from '../primitives'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// Icônes seules ici ; libellés résolus via i18n dans le composant.
const TYPE_ICONS: { v: WizardData['type']; icon: (c: string) => ReactNode }[] = [
  { v: 'appartement',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg> },
  { v: 'maison',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg> },
  { v: 'villa',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M3 12V7l5-3 5 3v5"/><path d="M13 12V9l4-2 4 2v3"/><path d="M3 12v8h18v-8"/></svg> },
  { v: 'terrain',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 18 6-3 6 3 6-3"/><path d="m3 14 6-3 6 3 6-3"/><path d="m3 10 6-3 6 3 6-3"/></svg> },
]

// Mapping type wizard (FR) → clé i18n listings:type.* (EN existant réutilisé).
const TYPE_I18N: Record<NonNullable<WizardData['type']>, string> = {
  appartement: 'apartment', maison: 'house', villa: 'villa', terrain: 'land',
}

// Couleurs DPE (codes A-G non traduits) ; descriptions via i18n.
const DPE_COLORS: { v: WizardData['energy']; color: string }[] = [
  { v: 'A', color: '#1F8B4C' },
  { v: 'B', color: '#4FAD3D' },
  { v: 'C', color: '#A6C13D' },
  { v: 'D', color: '#F2C94C' },
  { v: 'E', color: '#F2994A' },
  { v: 'F', color: '#EB5757' },
  { v: 'G', color: '#B92E2E' },
]

// Valeurs persistées (NON traduites) ; libellé via i18n.
const FEATURES: { v: string }[] = [
  { v: 'balcon' }, { v: 'terrasse' }, { v: 'jardin' }, { v: 'garage' },
  { v: 'parking' }, { v: 'cave' }, { v: 'ascenseur' }, { v: 'piscine' },
  { v: 'cheminée' }, { v: 'clim' }, { v: 'buanderie' }, { v: 'vue' },
]

export function Step3Specs({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const num = (v: number | null | undefined): number | null => v == null ? null : Number(v)

  const features = data.features || []
  const toggleFeature = (v: string) => {
    if (features.includes(v)) set({ features: features.filter(f => f !== v) })
    else set({ features: [...features, v] })
  }

  return (
    <div style={{
      maxWidth: 980, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.step3.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{t('wizard.step3.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.step3.subtitle')}
        </p>
      </div>

      {/* Section 1 — Type */}
      <SgSection title={t('wizard.step3.typeSection.title')} subtitle={t('wizard.step3.typeSection.subtitle')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {TYPE_ICONS.map(item => {
            const sel = data.type === item.v
            return (
              <button key={item.v} onClick={() => set({ type: item.v })} style={{
                padding: '22px 16px', borderRadius: 18, border: 0,
                background: sel ? SugarV2.black : SugarV2.card,
                color: sel ? sgOn() : SugarV2.ink,
                boxShadow: sel ? '0 14px 36px rgba(0,0,0,0.30)' : SugarV2.shadowSm,
                fontFamily: 'inherit', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-3px)' : 'translateY(0)',
              }}>
                {item.icon(sel ? sgOn() : SugarV2.ink)}
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>{item.v ? t(`type.${TYPE_I18N[item.v]}`) : ''}</span>
              </button>
            )
          })}
        </div>
      </SgSection>

      {/* Section 2 — Surface */}
      <SgSection title={t('wizard.step3.surfaceSection.title')} subtitle={t('wizard.step3.surfaceSection.subtitle')}>
        <div style={{
          background: SugarV2.card, borderRadius: 22, padding: '28px 32px',
          boxShadow: SugarV2.shadowSm,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 22 }}>
            <span style={{ fontSize: 52, fontWeight: 700, color: SugarV2.ink, letterSpacing: -1.5, lineHeight: 1 }}>
              {data.area || '—'}
            </span>
            <span style={{ fontSize: 22, fontWeight: 600, color: SugarV2.muted, letterSpacing: -0.3 }}>m²</span>
          </div>
          <input type="range" value={data.area || 80} min={20} max={500} step={5}
            onChange={e => set({ area: Number(e.target.value) })}
            className="sg-range"
            style={{
              width: '100%', height: 6, borderRadius: 999,
              appearance: 'none', WebkitAppearance: 'none',
              background: `linear-gradient(to right, ${SugarV2.black} 0%, ${SugarV2.black} ${(((data.area || 80) - 20) / (500 - 20)) * 100}%, ${SugarV2.cardSubtle} ${(((data.area || 80) - 20) / (500 - 20)) * 100}%, ${SugarV2.cardSubtle} 100%)`,
              outline: 'none', cursor: 'pointer',
            }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: SugarV2.muted, letterSpacing: 0.4 }}>20 m²</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: SugarV2.muted, letterSpacing: 0.4 }}>500 m²</span>
          </div>
        </div>
      </SgSection>

      {/* Section 3 — Pièces */}
      <SgSection title={t('wizard.step3.roomsSection.title')} subtitle={t('wizard.step3.roomsSection.subtitle')}>
        <div style={{
          background: SugarV2.card, borderRadius: 22, padding: '20px 24px',
          boxShadow: SugarV2.shadowSm,
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22,
        }}>
          <NumStepper label={t('form.fields.rooms')} value={num(data.rooms) || 0}
            onChange={v => set({ rooms: v })} step={0.5} min={1} max={20}
            format={(v) => v % 1 === 0 ? String(v) : v.toFixed(1)} />
          <NumStepper label={t('form.fields.bedrooms')} value={num(data.bedrooms) || 0}
            onChange={v => set({ bedrooms: v })} step={1} min={0} max={15} />
          <NumStepper label={t('form.fields.bathrooms')} value={num(data.bathrooms) || 0}
            onChange={v => set({ bathrooms: v })} step={1} min={0} max={10} />
          <YearInput value={num(data.year)} onChange={v => set({ year: v })} label={t('wizard.step3.yearLabel')} placeholder={t('wizard.step3.yearPlaceholder')} />
        </div>
      </SgSection>

      {/* Section 4 — DPE */}
      <SgSection title={t('wizard.step3.energySection.title')} subtitle={t('wizard.step3.energySection.subtitle')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {DPE_COLORS.map(d => {
            const sel = data.energy === d.v
            return (
              <button key={d.v} onClick={() => set({ energy: d.v })} style={{
                padding: '18px 8px 14px', borderRadius: 14, border: 0,
                background: sel ? d.color : SugarV2.card,
                color: sel ? sgOn() : SugarV2.ink,
                boxShadow: sel ? `0 12px 28px ${d.color}55` : SugarV2.shadowSm,
                fontFamily: 'inherit', cursor: 'pointer',
                fontSize: 22, fontWeight: 700, letterSpacing: -0.5,
                transition: 'all .2s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-3px)' : 'translateY(0)',
              }}>{d.v}</button>
            )
          })}
        </div>
        {data.energy && (
          <div style={{
            marginTop: 14, padding: '12px 18px', borderRadius: 12,
            background: SugarV2.card, boxShadow: SugarV2.shadowSm,
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: DPE_COLORS.find(d => d.v === data.energy)!.color,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.ink }}>
              {t('wizard.step3.energyClassLabel', { class: data.energy, desc: t(`wizard.step3.energyDesc.${data.energy}`) })}
            </span>
          </div>
        )}
      </SgSection>

      {/* Section 5 — Équipements */}
      <SgSection title={t('wizard.step3.featuresSection.title')}
        subtitle={t('wizard.step3.featuresSection.subtitle')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {FEATURES.map(f => {
            const sel = features.includes(f.v)
            return (
              <button key={f.v} onClick={() => toggleFeature(f.v)} style={{
                padding: '14px 16px', borderRadius: 14, border: 0,
                background: sel ? SugarV2.black : SugarV2.card,
                color: sel ? sgOn() : SugarV2.ink,
                boxShadow: sel ? '0 10px 24px rgba(0,0,0,0.20)' : SugarV2.shadowSm,
                fontFamily: 'inherit', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                transition: 'all .18s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-2px)' : 'translateY(0)',
              }}>
                <span>{t(`wizard.step3.feature.${f.v}`)}</span>
                {sel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </SgSection>
    </div>
  )
}

function NumStepper({
  label, value, onChange, step = 1, min = 0, max = 99, format,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  format?: (v: number) => string
}) {
  const display = format ? format(value) : String(value)
  const dec = () => onChange(Math.max(min, value - step))
  const inc = () => onChange(Math.min(max, value + step))
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: SugarV2.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={dec} style={{
          width: 36, height: 36, borderRadius: 999, border: 0,
          background: SugarV2.cardSubtle, color: SugarV2.ink,
          fontSize: 18, fontWeight: 600, cursor: 'pointer',
          display: 'grid', placeItems: 'center', fontFamily: 'inherit',
        }}>−</button>
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 22, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.5,
        }}>{display}</div>
        <button onClick={inc} style={{
          width: 36, height: 36, borderRadius: 999, border: 0,
          background: SugarV2.cardSubtle, color: SugarV2.ink,
          fontSize: 18, fontWeight: 600, cursor: 'pointer',
          display: 'grid', placeItems: 'center', fontFamily: 'inherit',
        }}>+</button>
      </div>
    </div>
  )
}

function YearInput({ value, onChange, label, placeholder }: { value: number | null; onChange: (v: number | null) => void; label: string; placeholder: string }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: SugarV2.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
      }}>{label}</div>
      <input type="number" value={value || ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value ? parseInt(e.target.value) : null)}
        style={{
          width: '100%', boxSizing: 'border-box',
          height: 44, padding: '0 14px', borderRadius: 12,
          border: 0, outline: 'none', fontFamily: 'inherit',
          background: SugarV2.cardSubtle,
          color: SugarV2.ink, fontSize: 16, fontWeight: 600, letterSpacing: -0.2,
          textAlign: 'center',
        }} />
    </div>
  )
}
