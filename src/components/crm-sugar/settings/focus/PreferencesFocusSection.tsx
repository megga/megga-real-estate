// MEGGA CRM — Section « Préférences » façon Focus (grammaire profil/notifications).
// Rendue dans le bento droit des Réglages quand active === 'preferences'.
// Bande info + 4 groupes (Région & langue, Vues par défaut, Apparence, Édition &
// assistance). Contrôles : select / segmented / interrupteur / nuancier d'accent.
// Câblage : profiles.preferences.ui via useUiPreferences (persistance EN DIRECT).
// Le thème pilote réellement le dark du CRM (setDark remonté par le shell) ;
// la langue bascule i18n immédiatement. L'accent est persisté + re-tinte les
// contrôles de la section (pas de propagation globale — cf. plan).
// i18n : réutilise preferences.* existant, microcopie neuve = focus.preferences.*.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { useToast } from '@/components/ui/Toast'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import type { PrefsData } from '../PreferencesSection.types'
import { pfColors, PF_KEYFRAMES, type FocusSectionProps, type PfColors } from './pfKitCore'

/* ─── Icônes propres aux préférences ────────────────────────────────────────── */
const PXF_ICONS = {
  lang: <><path d="M4 6h9M8.5 4v2c0 5-3 8.5-6.5 9.5" /><path d="M5.5 10.5c1.5 2.7 4 4.5 7 5.5" /><path d="m12.5 20 4.2-9 4.2 9M14 17h6" /></>,
  currency: <><circle cx="9.5" cy="9.5" r="5.5" /><path d="M14.4 6.4a5.5 5.5 0 1 1 .2 10.9" /><path d="M9.5 7.4v4.2M7.6 9.5h3.8" /></>,
  ruler: <><path d="M3.2 8.6 8.6 3.2 20.8 15.4l-5.4 5.4L3.2 8.6Z" /><path d="m7 7 1.6 1.6M9.8 9.8l1.6 1.6M12.6 12.6l1.6 1.6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v4M16 3v4" /></>,
  home: <><path d="m3.5 11 8.5-7.5 8.5 7.5" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  columns: <><rect x="3" y="4" width="4.6" height="16" rx="1.3" /><rect x="9.7" y="4" width="4.6" height="11" rx="1.3" /><rect x="16.4" y="4" width="4.6" height="14" rx="1.3" /></>,
  theme: <><circle cx="12" cy="12" r="8.2" /><path d="M12 3.8a8.2 8.2 0 0 0 0 16.4Z" fill="currentColor" stroke="none" /></>,
  spellcheck: <><path d="M3.8 17 8.3 6l4.5 11M5.4 13.2h5.8" /><path d="m14.6 14.4 2 2 4.2-4.2" /></>,
  save: <><path d="M5 4h11l3 3v13H5Z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  ai: <><path d="M12 3l1.6 7.4L21 12l-7.4 1.6L12 21l-1.6-7.4L3 12l7.4-1.6Z" /><path d="M18.6 3.4l.5 2.1 2.1.5-2.1.5-.5 2.1-.5-2.1-2.1-.5 2.1-.5Z" /></>,
  tone: <><path d="M5 5.5h14v9H10l-4 3.5V14.5H5Z" /><path d="M8.5 8.5h7M8.5 11.2h4.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11.5v5M12 7.75h.01" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.3 0 1.9-1 1.9-1.9 0-.5-.3-.9-.7-1.3-.4-.4-.6-.8-.6-1.3 0-1 .8-1.8 1.9-1.8H16a5 5 0 0 0 5-5c0-3.6-4-6.7-9-6.7Z" /><circle cx="7.6" cy="11.6" r="1.1" fill="currentColor" stroke="none" /><circle cx="10.8" cy="7.6" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.3" cy="8.6" r="1.1" fill="currentColor" stroke="none" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  chev: <path d="m6 9 6 6 6-6" />,
} as const
type PxfIconName = keyof typeof PXF_ICONS

function PxfIc({ name, size = 22, stroke = 'currentColor', sw = 1.7 }: { name: PxfIconName; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>{PXF_ICONS[name]}</svg>
  )
}
function PxfChip({ name, c }: { name: PxfIconName; c: PfColors }) {
  return <span style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', flexShrink: 0 }}><PxfIc name={name} size={22} stroke={c.ink} /></span>
}

interface Opt { id: string; label: string }
interface Accent { id: string; hex: string; darkHex: string }

const PXF_ACCENTS: Accent[] = [
  { id: 'black', hex: '#0B0C0E', darkHex: '#ECEDF3' },
  { id: 'periwinkle', hex: '#6F8CFF', darkHex: '#8CA3FF' },
  { id: 'blue', hex: '#0041D9', darkHex: '#4C7BFF' },
  { id: 'cyan', hex: '#0891B2', darkHex: '#2CB7D6' },
  { id: 'green', hex: '#059669', darkHex: '#2FBE8B' },
  { id: 'orange', hex: '#C45A00', darkHex: '#EE8B36' },
]

/* ─── Contrôles ─────────────────────────────────────────────────────────────── */
function PxfSwitch({ c, on, onClick, accent, knobDark }: { c: PfColors; on: boolean; onClick: () => void; accent: string; knobDark: boolean }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{ width: 44, height: 26, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
      background: on ? accent : (c.dark ? 'rgba(255,255,255,0.16)' : '#D5DAE2'), position: 'relative', transition: 'background .22s ease', padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: knobDark && on ? '#0B0C0E' : '#fff', transition: 'left .22s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

function PxfSwatch({ c, dark, value, onChange, labelOf }: { c: PfColors; dark: boolean; value: string; onChange: (v: string) => void; labelOf: (id: string) => string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 11, flexShrink: 0, alignItems: 'center' }}>
      {PXF_ACCENTS.map((o) => {
        const on = o.id === value
        const col = dark ? o.darkHex : o.hex
        const label = labelOf(o.id)
        return (
          <button key={o.id} onClick={() => onChange(o.id)} title={label} aria-label={label} aria-pressed={on}
            style={{ width: 30, height: 30, borderRadius: 999, cursor: 'pointer', padding: 0, border: 0, background: col, position: 'relative', flexShrink: 0, display: 'grid', placeItems: 'center',
              boxShadow: on ? `0 0 0 2px ${c.card}, 0 0 0 4px ${col}` : `0 0 0 1.5px ${c.hairSoft} inset`, transition: 'box-shadow .16s' }}>
            {on && <PxfIc name="check" size={15} stroke={o.id === 'black' && dark ? '#0B0C0E' : '#FFFFFF'} sw={2.6} />}
          </button>
        )
      })}
    </div>
  )
}

function PxfSeg({ c, value, onChange, options, accent, onAccent }: { c: PfColors; value: string; onChange: (v: string) => void; options: Opt[]; accent: string; onAccent: string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: c.cardSub, borderRadius: 999, padding: 4, flexShrink: 0, boxShadow: `0 0 0 1.5px ${c.hairSoft} inset` }}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ height: 32, padding: '0 15px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
            background: on ? accent : 'transparent', color: on ? onAccent : c.soft, transition: 'color .15s' }}>{o.label}</button>
        )
      })}
    </div>
  )
}

function PxfSelect({ c, value, onChange, options }: { c: PfColors; value: string; onChange: (v: string) => void; options: Opt[] }) {
  const [open, setOpen] = useState(false)
  const sel = options.find((o) => o.id === value)
  const menuBg = c.dark ? '#262629' : '#FFFFFF'
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ height: 40, minWidth: 148, padding: '0 12px 0 15px', borderRadius: 11, border: 0, cursor: 'pointer', background: c.cardSub, color: c.ink, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxShadow: `0 0 0 1.5px ${c.hairSoft} inset` }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel?.label}</span>
        <span style={{ display: 'grid', placeItems: 'center', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>
          <PxfIc name="chev" size={13} stroke={c.sub} sw={2.4} />
        </span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '100%', zIndex: 61, background: menuBg, borderRadius: 12, padding: 6, boxShadow: c.shadow, border: c.hair, maxHeight: 288, overflowY: 'auto', animation: 'pxfMenuIn .15s cubic-bezier(.2,.8,.2,1) both' }}>
            {options.map((o) => {
              const on = o.id === value
              return (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = c.cardSub }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: 0, cursor: 'pointer', background: on ? c.cardSub : 'transparent', color: c.ink, fontFamily: 'inherit',
                    fontSize: 13, fontWeight: on ? 700 : 500, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
                  {o.label}
                  {on && <PxfIc name="check" size={14} stroke={c.green} sw={2.4} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Structure des groupes (labels résolus via i18n) ───────────────────────── */
type PrefKey = keyof PrefsData
type CtrlType = 'select' | 'seg' | 'swatch' | 'toggle'
interface RowDef { key: PrefKey; icon: PxfIconName; labelKey: string; type: CtrlType; options?: Opt[] }
interface GroupDef { id: string; titleKey: string; dot: 'blue' | 'cyan' | 'orange' | 'green'; layout: 'grid' | 'stack'; rows: RowDef[] }

// Endonymes de langue (affichés dans leur propre langue — invariants).
const LANG_OPTS: Opt[] = [{ id: 'fr', label: 'Français' }, { id: 'en', label: 'English' }, { id: 'de', label: 'Deutsch' }, { id: 'it', label: 'Italiano' }]

/* ─── Section ───────────────────────────────────────────────────────────────── */
export function PreferencesFocusSection({ sp, surf, dark, setDark }: FocusSectionProps) {
  const { t } = useTranslation('settings')
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const { preferences, hasBackend, save } = useUiPreferences()

  const [local, setLocal] = useState<PrefsData>(preferences)
  useEffect(() => { setLocal(preferences) }, [preferences])
  const [savedKey, setSavedKey] = useState<PrefKey | null>(null)

  // Garde la pilule Thème synchro si l'utilisateur bascule via le rail (local only).
  useEffect(() => {
    setLocal((s) => (s.theme === 'system' ? s : { ...s, theme: dark ? 'dark' : 'light' }))
  }, [dark])

  // Groupes construits avec libellés + options traduits (réutilise preferences.*).
  const GROUPS: GroupDef[] = useMemo(() => {
    const opt = (ids: string[], keyer: (id: string) => string): Opt[] => ids.map((id) => ({ id, label: t(keyer(id)) }))
    return [
      { id: 'region', titleKey: 'preferences.region.title', dot: 'blue', layout: 'grid', rows: [
        { key: 'language', icon: 'lang', labelKey: 'preferences.region.language', type: 'select', options: LANG_OPTS },
        { key: 'currency', icon: 'currency', labelKey: 'preferences.region.currency', type: 'select', options: opt(['CHF', 'EUR', 'USD'], (id) => `preferences.region.currencyOptions.${id}`) },
        { key: 'units', icon: 'ruler', labelKey: 'preferences.region.units', type: 'select', options: opt(['metric', 'imperial'], (id) => `focus.preferences.units.${id}`) },
        { key: 'dateFormat', icon: 'calendar', labelKey: 'preferences.region.dateFormat', type: 'select', options: [
          { id: 'dd.MM.yyyy', label: t('preferences.region.dateFormatOptions.ch') }, { id: 'dd/MM/yyyy', label: t('preferences.region.dateFormatOptions.fr') },
          { id: 'MM/dd/yyyy', label: t('preferences.region.dateFormatOptions.us') }, { id: 'yyyy-MM-dd', label: t('preferences.region.dateFormatOptions.iso') }] },
      ] },
      { id: 'views', titleKey: 'preferences.views.title', dot: 'cyan', layout: 'grid', rows: [
        { key: 'defaultScreen', icon: 'home', labelKey: 'preferences.views.homeScreen', type: 'select', options: opt(['today', 'pipeline', 'matching', 'contacts', 'biens', 'calendar', 'docs'], (id) => `preferences.views.screens.${id}`) },
        { key: 'defaultPipelineView', icon: 'columns', labelKey: 'preferences.views.defaultPipelineView', type: 'select', options: opt(['kanban', 'list', 'timeline'], (id) => `preferences.views.pipelineViews.${id}`) },
      ] },
      { id: 'appearance', titleKey: 'preferences.appearance.title', dot: 'orange', layout: 'stack', rows: [
        { key: 'theme', icon: 'theme', labelKey: 'preferences.appearance.theme', type: 'seg', options: opt(['light', 'dark', 'system'], (id) => `preferences.appearance.themes.${id}.label`) },
        { key: 'accent', icon: 'palette', labelKey: 'focus.preferences.accent', type: 'swatch' },
      ] },
      { id: 'assist', titleKey: 'preferences.editing.title', dot: 'green', layout: 'stack', rows: [
        { key: 'spellcheck', icon: 'spellcheck', labelKey: 'preferences.editing.spellcheck.label', type: 'toggle' },
        { key: 'autosave', icon: 'save', labelKey: 'preferences.editing.autosave.label', type: 'toggle' },
        { key: 'aiAssist', icon: 'ai', labelKey: 'focus.preferences.aiAssistLabel', type: 'seg', options: opt(['off', 'balanced', 'proactif'], (id) => `preferences.editing.aiAssist.${id}.label`) },
        { key: 'aiTone', icon: 'tone', labelKey: 'focus.preferences.aiTone', type: 'seg', options: opt(['amicale', 'neutre', 'professionnel'], (id) => `focus.preferences.aiTones.${id}`) },
      ] },
    ]
  }, [t])

  const applyTheme = (v: string) => {
    if (!setDark) return
    if (v === 'light') setDark(false)
    else if (v === 'dark') setDark(true)
    else setDark(!!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches))
  }

  const commit = async (key: PrefKey, value: string | boolean) => {
    const next = { ...local, [key]: value } as PrefsData
    setLocal(next)
    if (key === 'theme') applyTheme(String(value))
    if (key === 'language') void i18n.changeLanguage(String(value))
    if (!hasBackend) { toast.error(t('focus.toast.sessionExpired')); return }
    try {
      await save(next)
      setSavedKey(key)
      setTimeout(() => setSavedKey((s) => (s === key ? null : s)), 1600)
    } catch {
      toast.error(t('focus.toast.saveError'))
    }
  }

  const accentDef = PXF_ACCENTS.find((a) => a.id === local.accent) ?? PXF_ACCENTS[0]
  const accentCol = dark ? accentDef.darkHex : accentDef.hex
  const onAccent = accentDef.id === 'black' ? c.onInk : '#FFFFFF'
  const knobDark = c.dark && accentDef.id === 'black'
  const accentLabel = (id: string) => t(`focus.preferences.accents.${id}`)

  // Thème : la pilule reflète le dark RÉELLEMENT rendu (source de vérité = le shell),
  // jamais une valeur persistée périmée — évite toute désynchro pilule↔app.
  const themeSeg = local.theme === 'system' ? 'system' : (dark ? 'dark' : 'light')

  const control = (r: RowDef): ReactNode => {
    if (r.type === 'toggle') return <PxfSwitch c={c} accent={accentCol} knobDark={knobDark} on={Boolean(local[r.key])} onClick={() => commit(r.key, !local[r.key])} />
    if (r.type === 'seg') return <PxfSeg c={c} accent={accentCol} onAccent={onAccent} value={r.key === 'theme' ? themeSeg : String(local[r.key])} onChange={(v) => commit(r.key, v)} options={r.options ?? []} />
    if (r.type === 'swatch') return <PxfSwatch c={c} dark={dark} value={String(local[r.key])} onChange={(v) => commit(r.key, v)} labelOf={accentLabel} />
    return <PxfSelect c={c} value={String(local[r.key])} onChange={(v) => commit(r.key, v)} options={r.options ?? []} />
  }

  const Row = (r: RowDef) => (
    <div key={r.key} className="pxf-row" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 10px', borderRadius: 12, minWidth: 0 }}>
      <PxfChip name={r.icon} c={c} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: c.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(r.labelKey)}</span>
        {savedKey === r.key && <span className="pxf-saved" style={{ fontSize: 10.5, fontWeight: 700, color: c.green, flexShrink: 0 }}>{t('focus.common.saved')}</span>}
      </div>
      {control(r)}
    </div>
  )

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        ${PF_KEYFRAMES}
        @media (prefers-reduced-motion: no-preference) {
          @keyframes pxfCtrlIn { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: none; } }
          @keyframes pxfMenuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .pxf-saved { animation: pxfCtrlIn .26s cubic-bezier(.2,.9,.3,1) both; }
        }
        .pxf-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; border-radius: 12px; }
      `}</style>

      <div style={{ borderRadius: 22, boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: c.cardSub, borderRadius: '22px 22px 0 0', borderTop: c.hair, borderLeft: c.hair, borderRight: c.hair, borderBottom: `1px solid ${c.hairSoft}`, padding: '8px 20px' }}>
          <PxfIc name="info" size={14} stroke={c.sub} sw={1.8} />
          <span style={{ fontSize: 12, fontWeight: 600, color: c.sub, letterSpacing: -0.1 }}>{t('focus.preferences.banner')}</span>
        </div>

        <div style={{ background: c.card, borderRadius: '0 0 22px 22px', borderLeft: c.hair, borderRight: c.hair, borderBottom: c.hair, padding: '8px 12px 14px' }}>
          {GROUPS.map((g, gi) => (
            <div key={g.id} style={{ padding: '6px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px 8px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c[g.dot], flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t(g.titleKey)}</span>
              </div>
              {g.layout === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>{g.rows.map((r) => Row(r))}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>{g.rows.map((r) => Row(r))}</div>
              )}
              {gi < GROUPS.length - 1 && <div style={{ height: 1, background: c.hairSoft, margin: '12px 12px 0' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
