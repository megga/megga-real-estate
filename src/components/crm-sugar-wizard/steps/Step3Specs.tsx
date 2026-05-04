// MEGGA CRM Sugar v2 Wizard — Step 3 : Caractéristiques
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step3.jsx).
// Type, surface, pièces, année, DPE, équipements.

import { type ReactNode } from 'react'
import { SugarV2, type WizardData } from '../tokens'
import { SgSection } from '../primitives'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

const TYPES: { v: WizardData['type']; label: string; icon: (c: string) => ReactNode }[] = [
  { v: 'appartement', label: 'Appartement',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg> },
  { v: 'maison', label: 'Maison',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg> },
  { v: 'villa', label: 'Villa',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20"/><path d="M3 12V7l5-3 5 3v5"/><path d="M13 12V9l4-2 4 2v3"/><path d="M3 12v8h18v-8"/></svg> },
  { v: 'terrain', label: 'Terrain',
    icon: (c) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 18 6-3 6 3 6-3"/><path d="m3 14 6-3 6 3 6-3"/><path d="m3 10 6-3 6 3 6-3"/></svg> },
]

const DPE: { v: WizardData['energy']; color: string; desc: string }[] = [
  { v: 'A', color: '#1F8B4C', desc: 'Très performant' },
  { v: 'B', color: '#4FAD3D', desc: 'Performant' },
  { v: 'C', color: '#A6C13D', desc: 'Bonne performance' },
  { v: 'D', color: '#F2C94C', desc: 'Performance moyenne' },
  { v: 'E', color: '#F2994A', desc: 'Énergivore' },
  { v: 'F', color: '#EB5757', desc: 'Très énergivore' },
  { v: 'G', color: '#B92E2E', desc: 'Passoire thermique' },
]

const FEATURES = [
  { v: 'balcon', label: 'Balcon' },
  { v: 'terrasse', label: 'Terrasse' },
  { v: 'jardin', label: 'Jardin' },
  { v: 'garage', label: 'Garage' },
  { v: 'parking', label: 'Place de parc' },
  { v: 'cave', label: 'Cave' },
  { v: 'ascenseur', label: 'Ascenseur' },
  { v: 'piscine', label: 'Piscine' },
  { v: 'cheminée', label: 'Cheminée' },
  { v: 'clim', label: 'Climatisation' },
  { v: 'buanderie', label: 'Buanderie' },
  { v: 'vue', label: 'Vue dégagée' },
]

export function Step3Specs({ data, set }: StepProps) {
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
        }}>Étape 4 sur 8 · Caractéristiques</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>Décrivez le bien</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          Type, surface, pièces, performance énergétique. Tout est optionnel — vous pourrez compléter plus tard.
        </p>
      </div>

      {/* Section 1 — Type */}
      <SgSection title="Type de bien" subtitle="Choisissez la nature du bien à publier.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {TYPES.map(t => {
            const sel = data.type === t.v
            return (
              <button key={t.v} onClick={() => set({ type: t.v })} style={{
                padding: '22px 16px', borderRadius: 18, border: 0,
                background: sel ? SugarV2.black : SugarV2.card,
                color: sel ? '#fff' : SugarV2.ink,
                boxShadow: sel ? '0 14px 36px rgba(11,12,14,0.30)' : SugarV2.shadowSm,
                fontFamily: 'inherit', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-3px)' : 'translateY(0)',
              }}>
                {t.icon(sel ? '#fff' : SugarV2.ink)}
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </SgSection>

      {/* Section 2 — Surface */}
      <SgSection title="Surface habitable" subtitle="Glissez le slider pour ajuster.">
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
      <SgSection title="Pièces & année" subtitle="Détails sur la composition du bien.">
        <div style={{
          background: SugarV2.card, borderRadius: 22, padding: '20px 24px',
          boxShadow: SugarV2.shadowSm,
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 22,
        }}>
          <NumStepper label="Pièces" value={num(data.rooms) || 0}
            onChange={v => set({ rooms: v })} step={0.5} min={1} max={20}
            format={(v) => v % 1 === 0 ? String(v) : v.toFixed(1)} />
          <NumStepper label="Chambres" value={num(data.bedrooms) || 0}
            onChange={v => set({ bedrooms: v })} step={1} min={0} max={15} />
          <NumStepper label="Salles de bain" value={num(data.bathrooms) || 0}
            onChange={v => set({ bathrooms: v })} step={1} min={0} max={10} />
          <YearInput value={num(data.year)} onChange={v => set({ year: v })} />
        </div>
      </SgSection>

      {/* Section 4 — DPE */}
      <SgSection title="Performance énergétique" subtitle="Classe DPE selon le canton. Visible sur l'annonce.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {DPE.map(d => {
            const sel = data.energy === d.v
            return (
              <button key={d.v} onClick={() => set({ energy: d.v })} style={{
                padding: '18px 8px 14px', borderRadius: 14, border: 0,
                background: sel ? d.color : SugarV2.card,
                color: sel ? '#fff' : SugarV2.ink,
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
              background: DPE.find(d => d.v === data.energy)!.color,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.ink }}>
              Classe {data.energy} — {DPE.find(d => d.v === data.energy)!.desc}
            </span>
          </div>
        )}
      </SgSection>

      {/* Section 5 — Équipements */}
      <SgSection title="Équipements & atouts"
        subtitle="Ce qui rendra l'annonce plus attirante. Sélectionnez tout ce qui s'applique.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {FEATURES.map(f => {
            const sel = features.includes(f.v)
            return (
              <button key={f.v} onClick={() => toggleFeature(f.v)} style={{
                padding: '14px 16px', borderRadius: 14, border: 0,
                background: sel ? SugarV2.black : SugarV2.card,
                color: sel ? '#fff' : SugarV2.ink,
                boxShadow: sel ? '0 10px 24px rgba(11,12,14,0.20)' : SugarV2.shadowSm,
                fontFamily: 'inherit', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                transition: 'all .18s cubic-bezier(.2,.8,.2,1)',
                transform: sel ? 'translateY(-2px)' : 'translateY(0)',
              }}>
                <span>{f.label}</span>
                {sel && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

function YearInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: SugarV2.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
      }}>Année de construction</div>
      <input type="number" value={value || ''} placeholder="Ex: 1985"
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
