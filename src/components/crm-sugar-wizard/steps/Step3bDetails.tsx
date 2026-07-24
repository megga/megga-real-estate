// MEGGA CRM Sugar v2 Wizard — Q7 « Les détails du bien » (liste Gregory).
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step3b.jsx —
// `window.SgDetailsSections`). Accordéon rail + panneau dont les sections sont
// STRICTEMENT conditionnelles à la famille du type (apt/house/terrain/commerce),
// résolue par `sp4bFamily`. Monté par Step3Specs quand `data.specsQ === 6`.
//
// Le contenu détaillé vit dans `data.det` (WizardDetails) : blob UI initialisé au
// montage (référence d'affichage MEG-2026-XXXX + préremplissage depuis le parcours
// guidé — surface, atouts — et l'adresse — étage). Les libellés sont des CLÉS
// STABLES persistées (standing/expo/heat/glazing/ext/equip/lux) rendues via i18n.

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, type WizardData, type WizardDetails } from '../tokens'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// Familles de type : apt (appartement, attique, duplex, triplex, loft) ·
// house (maison, villa, chalet) · terrain · commerce.
type Sp4bFam = 'apt' | 'house' | 'terrain' | 'commerce'
function sp4bFamily(type: WizardData['type']): Sp4bFam {
  if (['appartement', 'attique', 'duplex', 'triplex', 'loft'].includes(type)) return 'apt'
  if (['maison', 'villa', 'chalet'].includes(type)) return 'house'
  if (type === 'terrain') return 'terrain'
  if (type === 'commerce') return 'commerce'
  return 'apt'
}

// Clés stables (valeurs persistées dans `det`) — libellés résolus via i18n au render.
const EXT_KEYS = ['balcon', 'terrasse', 'jardin', 'piscine', 'jacuzzi', 'vueMontagne', 'vueLac'] as const
const EQUIP_KEYS = ['ascenseur', 'clim', 'domotique', 'cheminee', 'caveVin', 'alarme', 'video', 'concierge', 'pmr'] as const
const LUX_KEYS = ['quai', 'ponton', 'accesLac', 'sauna', 'hammam', 'piscInt', 'piscExt', 'vue360', 'accesSecu', 'domaine'] as const
const STANDING_KEYS = ['standard', 'hautDeGamme', 'luxe', 'ultraLuxe'] as const
const EXPO_KEYS = ['sud', 'sudOuest', 'sudEst', 'est', 'ouest', 'nord'] as const
const HEAT_KEYS = ['pac', 'gaz', 'mazout', 'pellets', 'electrique', 'cad'] as const
const GLAZING_KEYS = ['double', 'triple'] as const

// Surfaces par famille : [clé WizardDetails, sous-clé i18n].
const SURF_DEFS: Record<Sp4bFam, [keyof WizardDetails, string][]> = {
  apt: [['sPPE', 'ppe'], ['sHab', 'hab'], ['sUtile', 'utile'], ['sPond', 'pond'], ['sBalc', 'balc'], ['sTerr', 'terr'], ['sJard', 'jard']],
  house: [['sHab', 'hab'], ['sUtile', 'utile'], ['sTerrain', 'terrain'], ['sTerr', 'terr']],
  terrain: [['sTerrain', 'terrain']],
  commerce: [['sUtile', 'utile']],
}

const sp4bNN = (v: unknown): boolean => v != null && v !== ''

// Mois (fr-CH) + initiales de jours (lundi→dimanche) dérivés d'Intl — pas de
// littéral français en dur. 1er janv. 2024 = lundi (ancre pour l'ordre des jours).
const SP4B_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = new Intl.DateTimeFormat('fr-CH', { month: 'long' }).format(new Date(2000, i, 1))
  return m.charAt(0).toUpperCase() + m.slice(1)
})
const SP4B_WEEKDAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Intl.DateTimeFormat('fr-CH', { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i))
  return d.toUpperCase()
})

// Sentinelle stable pour « À convenir » (distincte d'une date JJ.MM.AAAA, i18n-safe).
const DISPO_TBD = '__aConvenir__'
const sp4bFmtDate = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

// ─── Contrôles ────────────────────────────────────────────────────────────
function Sp4bCheckIco({ c, s = 12 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function Sp4bInput({
  label, value, onChange, unit, placeholder = '—',
}: {
  label: string
  value: number | null | undefined
  onChange: (v: number | null) => void
  unit?: string
  placeholder?: string
}) {
  const [foc, setFoc] = useState(false)
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: SugarV2.muted }}>{label}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 16px', borderRadius: 12,
        background: SugarV2.cardSubtle,
        boxShadow: foc ? `inset 0 0 0 2px ${SugarV2.black}` : 'none', transition: 'box-shadow .12s',
      }}>
        <input className="sp4b-num" type="number" value={value ?? ''} placeholder={placeholder}
          onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit',
            fontSize: 15.5, fontWeight: 600, color: SugarV2.ink, fontVariantNumeric: 'tabular-nums',
          }} />
        {unit && <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.muted, flexShrink: 0 }}>{unit}</span>}
      </span>
    </label>
  )
}

// Champ date + calendrier popover (Disponibilité).
function Sp4bDateField({
  label, value, onChange,
}: {
  label: string
  value: string | null | undefined
  onChange: (v: string | null) => void
}) {
  const { t } = useTranslation('listings')
  const ON = sgOn()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() } })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isDate = /^\d{2}\.\d{2}\.\d{4}$/.test(value || '')
  const sel = isDate && value ? new Date(+value.slice(6, 10), +value.slice(3, 5) - 1, +value.slice(0, 2)) : null
  const first = new Date(view.y, view.m, 1)
  const offset = (first.getDay() + 6) % 7
  const nDays = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)]
  const nav = (d: number) => setView(v => { const m = v.m + d; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 } })
  const navBtn = (d: number, path: string) => (
    <button onClick={() => nav(d)} style={{
      width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', background: SugarV2.card,
      boxShadow: SugarV2.shadowSm, color: SugarV2.ink, display: 'grid', placeItems: 'center', fontFamily: 'inherit',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </button>
  )
  const isTbd = value === DISPO_TBD
  const display = isTbd ? t('wizard.step3b.toAgree') : (value || t('wizard.step3b.datePlaceholder'))

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: SugarV2.muted }}>{label}</span>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 16px', borderRadius: 12,
        background: SugarV2.cardSubtle, border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        boxShadow: open ? `inset 0 0 0 2px ${SugarV2.black}` : 'none', transition: 'box-shadow .12s',
      }}>
        <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: value ? SugarV2.ink : SugarV2.ghost, fontVariantNumeric: 'tabular-nums' }}>{display}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SugarV2.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
      </button>
      {open && (
        <div style={{ boxSizing: 'border-box', width: '100%', padding: 16, borderRadius: 14, background: SugarV2.cardSubtle, animation: 'sgFadeUp .25s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {navBtn(-1, 'm15 18-6-6 6-6')}
            <span style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: SugarV2.ink }}>{SP4B_MONTHS[view.m]} {view.y}</span>
            {navBtn(1, 'm9 18 6-6-6-6')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {SP4B_WEEKDAYS.map((d, i) => <span key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: SugarV2.ghost }}>{d}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              if (d == null) return <span key={i} />
              const dt = new Date(view.y, view.m, d)
              const isSel = !!sel && dt.getTime() === sel.getTime()
              const isToday = dt.getTime() === today.getTime()
              const past = dt < today
              return (
                <button key={i} disabled={past} onClick={() => { onChange(sp4bFmtDate(dt)); setOpen(false) }} style={{
                  height: 34, borderRadius: 999, border: 0, cursor: past ? 'default' : 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: isSel ? 700 : 600, fontVariantNumeric: 'tabular-nums',
                  background: isSel ? SugarV2.black : 'transparent', color: isSel ? ON : past ? SugarV2.ghost : SugarV2.ink,
                  boxShadow: !isSel && isToday ? `inset 0 0 0 1.5px ${SugarV2.black}` : 'none',
                }}>{d}</button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => { onChange(DISPO_TBD); setOpen(false) }} style={{
              flex: 1, height: 38, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, background: isTbd ? SugarV2.black : SugarV2.card,
              boxShadow: isTbd ? 'none' : SugarV2.shadowSm, color: isTbd ? ON : SugarV2.inkSoft,
            }}>{t('wizard.step3b.toAgree')}</button>
            {value && <button onClick={() => { onChange(null); setOpen(false) }} style={{
              height: 38, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, background: 'transparent', color: SugarV2.muted,
            }}>{t('wizard.step3b.clear')}</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function Sp4bChip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      height: 40, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 13.5, fontWeight: 600, background: active ? SugarV2.black : SugarV2.cardSubtle,
      color: active ? sgOn() : SugarV2.inkSoft, display: 'inline-flex', alignItems: 'center', transition: 'background .12s',
    }}>
      {children}
    </button>
  )
}

interface SegOption { value: string; label: string }
function Sp4bSeg({ options, value, onChange }: { options: SegOption[]; value: string | null | undefined; onChange: (v: string | null) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => <Sp4bChip key={o.value} active={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}>{o.label}</Sp4bChip>)}
    </div>
  )
}

function Sp4bCount({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  const disMinus = value == null || value <= 0
  const btn = (d: number, dis: boolean) => (
    <button disabled={dis} onClick={() => onChange(value == null ? (d > 0 ? 1 : null) : Math.max(0, value + d))} style={{
      width: 30, height: 30, borderRadius: 999, border: 0, cursor: dis ? 'default' : 'pointer', background: SugarV2.card,
      boxShadow: SugarV2.shadowSm, color: dis ? SugarV2.ghost : SugarV2.ink, fontSize: 16, fontWeight: 700,
      display: 'grid', placeItems: 'center', fontFamily: 'inherit',
    }}>{d > 0 ? '+' : '−'}</button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 9px 0 16px', borderRadius: 12, background: SugarV2.cardSubtle }}>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: SugarV2.inkSoft }}>{label}</span>
      {btn(-1, disMinus)}
      <span style={{ width: 24, textAlign: 'center', fontSize: 15, fontWeight: 700, color: value == null ? SugarV2.ghost : SugarV2.ink, fontVariantNumeric: 'tabular-nums' }}>{value == null ? '—' : value}</span>
      {btn(1, false)}
    </div>
  )
}

function Sp4bLbl({ children, first }: { children: ReactNode; first?: boolean }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: SugarV2.muted, margin: first ? '0 0 10px' : '22px 0 10px' }}>{children}</div>
}

function Sp4bRailBtn({ title, done, active, onClick }: { title: string; done: boolean; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 16px', borderRadius: 999,
      border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      background: active ? SugarV2.black : 'transparent', color: active ? sgOn() : SugarV2.inkSoft, transition: 'background .12s',
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: active ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      {done && <span style={{ width: 18, height: 18, borderRadius: 999, background: '#059669', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Sp4bCheckIco c="#fff" s={10} /></span>}
    </button>
  )
}

interface Section { id: string; title: string; done: boolean; body: ReactNode }

// ─── L'écran ────────────────────────────────────────────────────────────
export function Step3bDetails({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const fam = sp4bFamily(data.type)
  const [openId, setOpenId] = useState('info')
  const panelRef = useRef<HTMLDivElement>(null)
  const pick = (id: string) => { setOpenId(id); if (panelRef.current) panelRef.current.scrollTop = 0 }

  // Init : référence auto + préremplissage depuis le guidé (surface, atouts) et
  // l'adresse (étage). Monté une fois — les valeurs suivantes se remplissent au fil de l'eau.
  useEffect(() => {
    if (data.det) return
    const f = data.features || []
    const det: WizardDetails = { ref: 'MEG-2026-' + (1000 + Math.floor(Math.random() * 9000)), ext: [], equip: [], lux: [] }
    if (fam === 'apt' || fam === 'house') det.sHab = data.area ?? null
    if (fam === 'terrain') det.sTerrain = data.area ?? null
    if (fam === 'commerce') det.sUtile = data.area ?? null
    for (const k of ['balcon', 'terrasse', 'jardin', 'piscine']) if (f.includes(k)) det.ext.push(k)
    for (const k of ['ascenseur', 'clim', 'cheminee']) if (f.includes(k)) det.equip.push(k)
    if (fam === 'apt' && data.floor != null) det.etage = Number(data.floor)
    set({ det })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const det = data.det
  if (!det) return null
  const setDet = (p: Partial<WizardDetails>) => set({ det: { ...det, ...p } })
  const tgl = (key: 'ext' | 'equip' | 'lux', v: string) => {
    const a = det[key] || []
    const next = a.includes(v) ? a.filter(x => x !== v) : [...a, v]
    setDet({ [key]: next } as Partial<WizardDetails>)
  }
  const luxOn = det.standing === 'luxe' || det.standing === 'ultraLuxe'

  const detVal = (k: string): unknown => (det as unknown as Record<string, unknown>)[k]
  const cnt = (keys: string[]): number => keys.filter(k => sp4bNN(detVal(k))).length

  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } as const
  const chips = { display: 'flex', flexWrap: 'wrap', gap: 8 } as const

  const standingOpts: SegOption[] = STANDING_KEYS.map(k => ({ value: k, label: t(`wizard.step3b.standing.${k}`) }))
  const expoOpts: SegOption[] = EXPO_KEYS.map(k => ({ value: k, label: t(`wizard.step3b.expo.${k}`) }))
  const heatOpts: SegOption[] = HEAT_KEYS.map(k => ({ value: k, label: t(`wizard.step3b.energy.heat.${k}`) }))
  const glazingOpts: SegOption[] = GLAZING_KEYS.map(k => ({ value: k, label: t(`wizard.step3b.energy.glazing.${k}`) }))

  // ── Corps de sections ──
  const infoFields = fam === 'terrain' ? ['dispo'] : fam === 'apt' ? ['standing', 'dispo', 'renovYear'] : ['standing', 'dispo', 'renovYear', 'charges']
  const infoBody = (
    <div>
      <div style={grid2}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: SugarV2.muted }}>{t('wizard.step3b.reference')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 16px', borderRadius: 12, background: SugarV2.cardSubtle }}>
            <span style={{ flex: 1, fontSize: 15.5, fontWeight: 700, color: SugarV2.ink, fontVariantNumeric: 'tabular-nums' }}>{det.ref}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: SugarV2.ghost }}>{t('wizard.step3b.auto')}</span>
          </span>
        </label>
        <Sp4bDateField label={t('wizard.step3b.availability')} value={det.dispo} onChange={v => setDet({ dispo: v })} />
      </div>
      {fam !== 'terrain' && (
        <div>
          <Sp4bLbl>{t('wizard.step3b.standing.label')}</Sp4bLbl>
          <Sp4bSeg options={standingOpts} value={det.standing} onChange={v => setDet({ standing: v })} />
          <div style={{ ...grid2, marginTop: 22 }}>
            <Sp4bInput label={t('wizard.step3b.renovYear')} placeholder={t('wizard.step3b.renovYearPlaceholder')} value={det.renovYear} onChange={v => setDet({ renovYear: v })} />
            {(fam === 'house' || fam === 'commerce') && <Sp4bInput label={t('wizard.step3b.charges')} unit={t('wizard.step3b.unit.chfMonth')} value={det.charges} onChange={v => setDet({ charges: v })} />}
          </div>
        </div>
      )}
    </div>
  )

  const surfFields = SURF_DEFS[fam]
  const surfBody = (
    <div style={grid2}>
      {surfFields.map(([k, sub]) => <Sp4bInput key={k} label={t(`wizard.step3b.surf.${sub}`)} unit={t('wizard.step3b.unit.m2')} value={det[k] as number | null | undefined} onChange={v => setDet({ [k]: v } as Partial<WizardDetails>)} />)}
    </div>
  )

  const piecesBody = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Sp4bCount label={t('wizard.step3b.pieces.chambres')} value={det.chambres} onChange={v => setDet({ chambres: v })} />
      <Sp4bCount label={t('wizard.step3b.pieces.sdb')} value={det.sdb} onChange={v => setDet({ sdb: v })} />
      <Sp4bCount label={t('wizard.step3b.pieces.wc')} value={det.wc} onChange={v => setDet({ wc: v })} />
    </div>
  )

  const extBody = (
    <div>
      <div style={chips}>{EXT_KEYS.map(k => <Sp4bChip key={k} active={(det.ext || []).includes(k)} onClick={() => tgl('ext', k)}>{t(`wizard.step3b.ext.${k}`)}</Sp4bChip>)}</div>
      <Sp4bLbl>{t('wizard.step3b.expo.label')}</Sp4bLbl>
      <Sp4bSeg options={expoOpts} value={det.expo} onChange={v => setDet({ expo: v })} />
    </div>
  )

  const parkBody = (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Sp4bCount label={t('wizard.step3b.park.int')} value={det.pInt} onChange={v => setDet({ pInt: v })} />
        <Sp4bCount label={t('wizard.step3b.park.ext')} value={det.pExt} onChange={v => setDet({ pExt: v })} />
        <Sp4bCount label={t('wizard.step3b.park.garage')} value={det.pGarage} onChange={v => setDet({ pGarage: v })} />
        <Sp4bCount label={t('wizard.step3b.park.box')} value={det.pBox} onChange={v => setDet({ pBox: v })} />
        <Sp4bCount label={t('wizard.step3b.park.visit')} value={det.pVisit} onChange={v => setDet({ pVisit: v })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Sp4bChip active={!!det.borne} onClick={() => setDet({ borne: !det.borne })}>{t('wizard.step3b.park.borne')}</Sp4bChip>
      </div>
    </div>
  )

  const equipBody = <div style={chips}>{EQUIP_KEYS.map(k => <Sp4bChip key={k} active={(det.equip || []).includes(k)} onClick={() => tgl('equip', k)}>{t(`wizard.step3b.equip.${k}`)}</Sp4bChip>)}</div>

  const immBody = (
    <div style={grid2}>
      <Sp4bInput label={t('wizard.step3b.imm.etage')} placeholder={t('wizard.step3b.imm.etagePlaceholder')} value={det.etage} onChange={v => setDet({ etage: v })} />
      <Sp4bInput label={t('wizard.step3b.imm.floors')} placeholder={t('wizard.step3b.imm.floorsPlaceholder')} value={det.floors} onChange={v => setDet({ floors: v })} />
      <Sp4bInput label={t('wizard.step3b.imm.chargesPPE')} unit={t('wizard.step3b.unit.chfMonth')} value={det.chargesPPE} onChange={v => setDet({ chargesPPE: v })} />
      <Sp4bInput label={t('wizard.step3b.imm.fondsReno')} unit={t('wizard.step3b.unit.chf')} value={det.fondsReno} onChange={v => setDet({ fondsReno: v })} />
    </div>
  )

  const energyBody = (
    <div>
      <Sp4bLbl first>{t('wizard.step3b.energy.heatLabel')}</Sp4bLbl>
      <Sp4bSeg options={heatOpts} value={det.heat} onChange={v => setDet({ heat: v })} />
      <Sp4bLbl>{t('wizard.step3b.energy.optionsLabel')}</Sp4bLbl>
      <div style={chips}>
        <Sp4bChip active={!!det.floorHeat} onClick={() => setDet({ floorHeat: !det.floorHeat })}>{t('wizard.step3b.energy.floorHeat')}</Sp4bChip>
        <Sp4bChip active={!!det.pv} onClick={() => setDet({ pv: !det.pv })}>{t('wizard.step3b.energy.pv')}</Sp4bChip>
        <Sp4bChip active={!!det.solarTherm} onClick={() => setDet({ solarTherm: !det.solarTherm })}>{t('wizard.step3b.energy.solarTherm')}</Sp4bChip>
      </div>
      <Sp4bLbl>{t('wizard.step3b.energy.glazingLabel')}</Sp4bLbl>
      <Sp4bSeg options={glazingOpts} value={det.glazing} onChange={v => setDet({ glazing: v })} />
    </div>
  )

  const luxBody = <div style={chips}>{LUX_KEYS.map(k => <Sp4bChip key={k} active={(det.lux || []).includes(k)} onClick={() => tgl('lux', k)}>{t(`wizard.step3b.lux.${k}`)}</Sp4bChip>)}</div>

  // ── Assemblage conditionnel à la famille ──
  const sections: Section[] = []
  const nInfo = cnt(infoFields)
  const nSurf = cnt(surfFields.map(f => f[0] as string))
  sections.push({ id: 'info', title: t('wizard.step3b.section.info'), done: nInfo === infoFields.length, body: infoBody })
  sections.push({ id: 'surf', title: t('wizard.step3b.section.surf'), done: nSurf === surfFields.length, body: surfBody })
  if (fam === 'apt' || fam === 'house') {
    sections.push({ id: 'pieces', title: t('wizard.step3b.section.pieces'), done: cnt(['chambres', 'sdb', 'wc']) === 3, body: piecesBody })
    sections.push({ id: 'ext', title: t('wizard.step3b.section.ext'), done: (det.ext || []).length > 0 && sp4bNN(det.expo), body: extBody })
  }
  if (fam !== 'terrain') {
    sections.push({ id: 'park', title: t('wizard.step3b.section.park'), done: false, body: parkBody })
    sections.push({ id: 'equip', title: t('wizard.step3b.section.equip'), done: (det.equip || []).length > 0, body: equipBody })
  }
  if (fam === 'apt') sections.push({ id: 'imm', title: t('wizard.step3b.section.imm'), done: cnt(['etage', 'floors', 'chargesPPE', 'fondsReno']) === 4, body: immBody })
  if (fam !== 'terrain') sections.push({ id: 'energy', title: t('wizard.step3b.section.energy'), done: sp4bNN(det.heat) && sp4bNN(det.glazing), body: energyBody })
  if ((fam === 'apt' || fam === 'house') && luxOn) sections.push({ id: 'lux', title: t('wizard.step3b.section.lux'), done: (det.lux || []).length > 0, body: luxBody })

  const cur = sections.find(s => s.id === openId) || sections[0]

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', margin: '0 auto', textAlign: 'left', display: 'grid', gridTemplateColumns: '230px 1fr', gap: 18, alignItems: 'start' }}>
      <style>{'input.sp4b-num::-webkit-outer-spin-button,input.sp4b-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input.sp4b-num[type=number]{-moz-appearance:textfield}'}</style>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 10, borderRadius: 22, background: SugarV2.card, boxShadow: SugarV2.shadowSm }}>
        {sections.map(s => <Sp4bRailBtn key={s.id} title={s.title} done={s.done} active={cur.id === s.id} onClick={() => pick(s.id)} />)}
      </nav>
      <div style={{ borderRadius: 22, background: SugarV2.card, boxShadow: SugarV2.shadow, height: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, padding: '22px 26px 0' }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2 }}>{cur.title}</span>
        </div>
        <div ref={panelRef} key={cur.id} style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable', padding: '20px 26px 26px', animation: 'sgFadeUp .28s cubic-bezier(.2,.8,.2,1) both' }}>
          {cur.body}
        </div>
      </div>
    </div>
  )
}
