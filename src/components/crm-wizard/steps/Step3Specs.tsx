// MEGGA CRM Sugar v2 Wizard — Step 3 : Caractéristiques (parcours GUIDÉ).
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step3.jsx —
// `window.WzStepSpecs`). Une question à la fois (Q1→Q7), indexée par `data.specsQ`.
//
// Contrat de navigation : la COQUILLE (WizardShell) pilote Précédent/Continuer en
// incrémentant/décrémentant `data.specsQ` (0→6) puis en montant Step4 après Q7. Ce
// composant NE rend PAS de nav inter-questions — seulement le contenu de la question
// active + la barre de progression à 7 segments (chaque segment reste cliquable).
// Q7 (index 6) monte l'accordéon détaillé <Step3bDetails/>.

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { WizardTokens, crmOn, crmAcc, type WizardData } from '../tokens'
import { Step3bDetails } from './Step3bDetails'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// Les 10 types (liste Gregory) — icône seule ici, libellé résolu via i18n `type.*`.
const SP4_TYPES: { v: WizardData['type']; icon: (c: string, s?: number) => ReactNode }[] = [
  { v: 'appartement', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" /></svg> },
  { v: 'attique', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V9h16v12" /><path d="M8 9V4h8v5" /><path d="M8 4h8" /><path d="M4 15h16" /></svg> },
  { v: 'duplex', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 12h16" /><path d="M10 12v4h4v-4" /></svg> },
  { v: 'triplex', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16" /></svg> },
  { v: 'loft', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 12h18M9 6v14M15 6v14" /></svg> },
  { v: 'maison', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg> },
  { v: 'villa', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" /><path d="M3 12V7l5-3 5 3v5" /><path d="M13 12V9l4-2 4 2v3" /><path d="M3 12v8h18v-8" /></svg> },
  { v: 'chalet', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14 12 3l10 11" /><path d="M5 11v9h14v-9" /><path d="M10 20v-5h4v5" /></svg> },
  { v: 'terrain', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 18 6-3 6 3 6-3" /><path d="m3 14 6-3 6 3 6-3" /><path d="m3 10 6-3 6 3 6-3" /></svg> },
  { v: 'commerce', icon: (c, s = 30) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9 5.5 4h13L20 9" /><path d="M4 9c0 1.4 1.1 2.5 2.5 2.5S9 10.4 9 9c0 1.4 1.1 2.5 2.5 2.5S14 10.4 14 9c0 1.4 1.1 2.5 2.5 2.5S19 10.4 19 9" /><path d="M5 12v8h14v-8" /><path d="M9 20v-5h6v5" /></svg> },
]

// Mapping type wizard (FR) → clé i18n `listings:type.*` (traductions existantes).
const TYPE_I18N: Record<WizardData['type'], string> = {
  appartement: 'apartment', attique: 'attic', duplex: 'duplex', triplex: 'triplex',
  loft: 'loft', maison: 'house', villa: 'villa', chalet: 'chalet',
  terrain: 'land', commerce: 'commercial',
}

// Couleurs DPE (codes A-G non traduits, teintes de marque fixes).
const DPE_COLORS: { v: NonNullable<WizardData['energy']>; color: string }[] = [
  { v: 'A', color: '#1F8B4C' }, { v: 'B', color: '#4FAD3D' }, { v: 'C', color: '#A6C13D' },
  { v: 'D', color: '#F2C94C' }, { v: 'E', color: '#F2994A' }, { v: 'F', color: '#EB5757' }, { v: 'G', color: '#B92E2E' },
]

// Valeurs persistées (clés stables) ; libellé via i18n `wizard.step3.feature.*`.
// ⚠ Les clés balcon/terrasse/jardin/piscine/ascenseur/clim/cheminee doivent rester
// alignées avec le préremplissage ext/equip du Step3b (mêmes valeurs).
const SP4_FEATURES: string[] = [
  'balcon', 'terrasse', 'jardin', 'garage', 'parking', 'cave', 'ascenseur', 'piscine',
  'cheminee', 'clim', 'buanderie', 'vue', 'vue_lac', 'cuisine_agencee', 'dressing',
  'parquet', 'reduit', 'cave_a_vin', 'pompe_chaleur', 'solaire', 'borne_recharge',
  'domotique', 'fibre', 'triple_vitrage', 'abri_pc', 'velo', 'conciergerie',
  'plain_pied', 'mansarde', 'accessible_pmr', 'animaux', 'meuble',
]

const sp4FmtP = (v: number | null): string => v == null ? '' : (v % 1 === 0 ? String(v) : v.toFixed(1))

// ─── Petits composants (locaux au fichier) ─────────────────────────────────
function Sp4Pill({ active, children, onClick, big }: { active?: boolean; children: ReactNode; onClick?: () => void; big?: boolean }) {
  return (
    <button onClick={onClick} style={{
      height: big ? 52 : 44, padding: big ? '0 26px' : '0 20px', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
      fontFamily: 'inherit', fontWeight: 600, letterSpacing: -0.1,
      fontSize: big ? 'var(--crm-text-3xl)' : 'var(--crm-text-lg)',
      background: active ? WizardTokens.black : WizardTokens.card, color: active ? crmOn() : WizardTokens.ink,
      boxShadow: active ? WizardTokens.shadow : WizardTokens.shadowSm,
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', transition: 'background .12s',
      fontVariantNumeric: 'tabular-nums',
    }}>{children}</button>
  )
}

function Sp4Rooms({ value, onChange, big }: { value: number | null; onChange: (v: number) => void; big?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-lg)', justifyContent: 'center' }}>
      {[1.5, 2.5, 3.5, 4.5, 5.5, 6.5].map(o => <Sp4Pill key={o} big={big} active={value === o} onClick={() => onChange(o)}>{sp4FmtP(o)}</Sp4Pill>)}
      <Sp4Pill big={big} active={value != null && value >= 7} onClick={() => onChange(7)}>7+</Sp4Pill>
    </div>
  )
}

function Sp4Dpe({ value, onChange, s = 52 }: { value: WizardData['energy']; onChange: (v: NonNullable<WizardData['energy']>) => void; s?: number }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-md)', justifyContent: 'center' }}>
      {DPE_COLORS.map(d => {
        const sel = value === d.v
        return (
          <button key={d.v} onClick={() => onChange(d.v)} style={{
            width: s, height: s, borderRadius: 'var(--crm-radius-xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            // Teinte DPE saturée fixe dans les deux thèmes → texte blanc constant
            // (crmOn() basculerait en sombre en dark et casserait le contraste).
            background: sel ? d.color : WizardTokens.card, color: sel ? '#fff' : WizardTokens.inkSoft,
            fontSize: 'var(--crm-text-3xl)', fontWeight: 600, boxShadow: sel ? `0 8px 20px ${d.color}44` : WizardTokens.shadowSm,
            transition: 'background .12s', fontVariantNumeric: 'tabular-nums',
          }}>{d.v}</button>
        )
      })}
    </div>
  )
}

// ─── L'étape guidée ─────────────────────────────────────────────────────────
export function Step3Specs({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const q = Math.min(6, Math.max(0, data.specsQ || 0))
  const features = data.features || []
  const toggleFeat = (v: string) => set({ features: features.includes(v) ? features.filter(x => x !== v) : [...features, v] })

  // Atouts personnalisés stockés « custom:xxx » dans data.features.
  const customs = features.filter(f => f.startsWith('custom:')).map(f => f.slice(7))
  const addCustom = () => { const v = draft.trim(); if (v && !customs.includes(v)) set({ features: [...features, 'custom:' + v] }); setDraft(''); setAdding(false) }
  const removeCustom = (v: string) => set({ features: features.filter(x => x !== 'custom:' + v) })

  const surfaceQ = data.type === 'terrain' ? t('wizard.step3.q.surfaceTerrain')
    : data.type === 'commerce' ? t('wizard.step3.q.surfaceCommerce')
    : t('wizard.step3.q.surfaceHab')
  const QUESTIONS = [
    t('wizard.step3.q.type'), surfaceQ, t('wizard.step3.q.rooms'), t('wizard.step3.q.year'),
    t('wizard.step3.q.energy'), t('wizard.step3.q.features'), t('wizard.step3.q.details'),
  ]
  const surfacePresets = data.type === 'terrain' ? [400, 600, 800, 1200, 1600, 2500]
    : data.type === 'commerce' ? [80, 120, 200, 300, 500, 800]
    : [50, 80, 100, 120, 150, 200]

  const bodies: ReactNode[] = [
    // 0 — Type
    <div key="type" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 'var(--crm-space-xl)', maxWidth: 780, margin: '0 auto' }}>
      {SP4_TYPES.map(item => {
        const sel = data.type === item.v
        return (
          <button key={item.v} onClick={() => set({ type: item.v })} style={{
            padding: 'var(--crm-space-6xl) var(--crm-space-md)', borderRadius: 'var(--crm-radius-5xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            background: sel ? WizardTokens.black : WizardTokens.card, color: sel ? crmOn() : WizardTokens.ink,
            boxShadow: sel ? WizardTokens.shadow : WizardTokens.shadowSm,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-lg)', transition: 'background .12s',
          }}>{item.icon(sel ? crmOn() : WizardTokens.ink, 26)}<span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{t(`type.${TYPE_I18N[item.v]}`)}</span></button>
        )
      })}
    </div>,
    // 1 — Surface
    <div key="surface" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)', marginBottom: 24 }}>
        <input type="number" value={data.area ?? ''} placeholder="—" autoFocus min={0} max={5000}
          onChange={e => set({ area: e.target.value === '' ? null : Number(e.target.value) })}
          className="sp4-big" style={{ width: 190, border: 0, outline: 0, background: 'transparent', textAlign: 'center', fontFamily: 'inherit', fontWeight: 500, fontSize: 72, color: WizardTokens.ink, letterSpacing: -2, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: WizardTokens.muted }}>m²</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', justifyContent: 'center' }}>
        {surfacePresets.map(p => <Sp4Pill key={p} active={data.area === p} onClick={() => set({ area: p })}>{p} m²</Sp4Pill>)}
      </div>
    </div>,
    // 2 — Pièces
    <div key="rooms" style={{ maxWidth: 520, margin: '0 auto' }}><Sp4Rooms value={data.rooms} onChange={v => set({ rooms: v })} big /></div>,
    // 3 — Année
    <div key="year" style={{ maxWidth: 320, margin: '0 auto', textAlign: 'center' }}>
      <input type="number" value={data.year ?? ''} placeholder={t('wizard.step3.yearPlaceholder')} autoFocus min={1800} max={2100}
        onChange={e => set({ year: e.target.value === '' ? null : Number(e.target.value) })}
        style={{ width: 260, boxSizing: 'border-box', height: 72, textAlign: 'center', border: 0, outline: 0, background: WizardTokens.card, boxShadow: WizardTokens.shadowSm, borderRadius: 'var(--crm-radius-3xl)', fontFamily: 'inherit', fontWeight: 500, fontSize: 'var(--crm-text-8xl)', color: WizardTokens.ink, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }} />
    </div>,
    // 4 — DPE
    <Sp4Dpe key="dpe" value={data.energy} onChange={v => set({ energy: v })} s={56} />,
    // 5 — Équipements + atouts personnalisés
    <div key="features" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-lg)', justifyContent: 'center', maxWidth: 640, margin: '0 auto' }}>
      {SP4_FEATURES.map(f => <Sp4Pill key={f} active={features.includes(f)} onClick={() => toggleFeat(f)}>{t(`wizard.step3.feature.${f}`)}</Sp4Pill>)}
      {customs.map(v => (
        <button key={v} onClick={() => removeCustom(v)} title={t('wizard.step3.removeFeature')} style={{
          height: 44, padding: '0 var(--crm-space-xl) 0 var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: WizardTokens.black, color: crmOn(), boxShadow: WizardTokens.shadow,
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
        }}>
          {v}
          <span style={{ display: 'grid', placeItems: 'center', width: 19, height: 19, borderRadius: 'var(--crm-radius-pill)', background: crmAcc(0.18) }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={crmOn()} strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </span>
        </button>
      ))}
      {adding ? (
        <input autoFocus value={draft} placeholder={t('wizard.step3.customPlaceholder')}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') { setDraft(''); setAdding(false) } }}
          onBlur={addCustom}
          style={{ height: 44, width: 220, boxSizing: 'border-box', padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, outline: 0, background: WizardTokens.card, boxShadow: `inset 0 0 0 2px ${WizardTokens.black}`, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink }} />
      ) : (
        <button onClick={() => setAdding(true)} style={{
          height: 44, padding: '0 var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: WizardTokens.card, color: WizardTokens.ink, boxShadow: `inset 0 0 0 1.5px ${WizardTokens.line}`,
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.ink} strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t('wizard.step3.addFeature')}
        </button>
      )}
    </div>,
    // 6 — Détails complets (accordéon, sections conditionnelles au type)
    <Step3bDetails key="details" data={data} set={set} />,
  ]

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
      <style>{'input.sp4-big::-webkit-outer-spin-button,input.sp4-big::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.sp4-big{-moz-appearance:textfield}'}</style>

      {/* Progression — 7 segments cliquables (seule nav interne de l'étape). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 44 }}>
        {QUESTIONS.map((_, i) => (
          <div key={i} onClick={() => set({ specsQ: i })} style={{ flex: 1, height: 5, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', background: i <= q ? WizardTokens.black : WizardTokens.line, transition: 'background .25s' }} />
        ))}
      </div>

      {/* Question active — Q7 (accordéon) ancrée en haut : la hauteur varie sans recentrage. */}
      <div key={q} style={{ minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: q === 6 ? 'flex-start' : 'center', animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both' }}>
        <h1 style={{ margin: q === 6 ? '0 0 30px' : '0 0 42px', fontSize: q === 6 ? 32 : 40, fontWeight: 500, color: WizardTokens.ink, letterSpacing: -1, lineHeight: 1.08, textAlign: 'center' }}>{QUESTIONS[q]}</h1>
        {bodies[q]}
      </div>
    </div>
  )
}
