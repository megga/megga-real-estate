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
import { switchLanguage } from '@/i18n'
import { useToast } from '@/components/ui/Toast'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import type { PrefsData } from '../PreferencesSection.types'
import { pfAccents, pfColors, PF_KEYFRAMES, type FocusSectionProps, type PfAccent, type PfColors } from './pfKitCore'

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

/* ─── Contrôles ─────────────────────────────────────────────────────────────── */
function PxfSwitch({ c, on, onClick, accent, onAccent }: { c: PfColors; on: boolean; onClick: () => void; accent: string; onAccent: string }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{ width: 44, height: 26, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0,
      background: on ? accent : (c.dark ? 'rgba(255,255,255,0.16)' : '#D5DAE2'), position: 'relative', transition: 'background .22s ease', padding: 0 }}>
      {/* Bouton allumé = l'encre de l'accent. Un blanc d'office disparaîtrait
          sur les pastilles pâles de MEGGA X (jaune, vert, cyan). */}
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', background: on ? onAccent : '#fff', transition: 'left .22s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

function PxfSwatch({ c, dark, accents, value, onChange, labelOf }: { c: PfColors; dark: boolean; accents: PfAccent[]; value: string; onChange: (v: string) => void; labelOf: (id: string) => string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--crm-space-lg)', flexShrink: 0, alignItems: 'center' }}>
      {accents.map((o) => {
        const on = o.id === value
        const col = dark ? o.darkHex : o.hex
        const label = labelOf(o.id)
        return (
          <button key={o.id} onClick={() => onChange(o.id)} title={label} aria-label={label} aria-pressed={on}
            style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', padding: 0, border: 0, background: col, position: 'relative', flexShrink: 0, display: 'grid', placeItems: 'center',
              boxShadow: on ? `0 0 0 2px ${c.card}, 0 0 0 4px ${col}` : `0 0 0 1.5px ${c.hairSoft} inset`, transition: 'box-shadow .16s' }}>
            {/* La coche est POSÉE sur la pastille : elle prend l'encre de la
                pastille, pas un blanc d'office — les teintes pâles de MEGGA X
                l'avaleraient (1,7:1). */}
            {on && <PxfIc name="check" size={15} stroke={dark ? o.darkInk : o.ink} sw={2.6} />}
          </button>
        )
      })}
    </div>
  )
}

function PxfSeg({ c, value, onChange, options, accent, onAccent }: { c: PfColors; value: string; onChange: (v: string) => void; options: Opt[]; accent: string; onAccent: string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--crm-space-xs)', background: c.cardSub, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-xs)', flexShrink: 0, boxShadow: `0 0 0 1.5px ${c.hairSoft} inset` }}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{ height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 700, whiteSpace: 'nowrap',
            background: on ? accent : 'transparent', color: on ? onAccent : c.soft, transition: 'color .15s' }}>{o.label}</button>
        )
      })}
    </div>
  )
}

function PxfSelect({ c, value, onChange, options }: { c: PfColors; value: string; onChange: (v: string) => void; options: Opt[] }) {
  const [open, setOpen] = useState(false)
  const sel = options.find((o) => o.id === value)
  // Surface FLOTTANTE : le palier des surfaces posées au-dessus de la carte,
  // jamais un gris neutre codé en dur.
  const menuBg = c.solid
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Pas de chevron : la valeur est centrée dans un padding symétrique. */}
      <button onClick={() => setOpen((o) => !o)} style={{ height: 40, minWidth: 148, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', background: c.cardSub, color: c.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-lg)', boxShadow: `0 0 0 1.5px ${c.hairSoft} inset` }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel?.label}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '100%', zIndex: 61, background: menuBg, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-sm)', boxShadow: c.shadow, border: c.hair, maxHeight: 288, overflowY: 'auto', animation: 'pxfMenuIn .15s cubic-bezier(.2,.8,.2,1) both' }}>
            {options.map((o) => {
              const on = o.id === value
              return (
                <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = c.cardSub }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                  style={{ width: '100%', padding: 'var(--crm-space-md) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', background: on ? c.cardSub : 'transparent', color: c.ink, fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-lg)', fontWeight: on ? 700 : 500, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--crm-space-xl)', whiteSpace: 'nowrap' }}>
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
/** Les lignes « Direction » et « Teinte sombre » sont parties avec la direction
 *  Sugar : chaque ligne correspond désormais à une préférence serveur. */
type RowKey = PrefKey
type CtrlType = 'select' | 'seg' | 'swatch' | 'toggle'
interface RowDef { key: RowKey; icon: PxfIconName; labelKey: string; type: CtrlType; options?: Opt[] }
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
    // `switchLanguage` et non `i18n.changeLanguage` : ce dernier bascule avant que
    // le bundle de la langue soit téléchargé, ce qui repassait l'écran par le
    // français puis le re-rendait une seconde fois (cf. sa JSDoc, src/i18n/index.ts).
    if (key === 'language') void switchLanguage(String(value))
    if (!hasBackend) { toast.error(t('focus.toast.sessionExpired')); return }
    try {
      await save(next)
      setSavedKey(key)
      setTimeout(() => setSavedKey((s) => (s === key ? null : s)), 1600)
    } catch {
      toast.error(t('focus.toast.saveError'))
    }
  }

  // Un réglage hérité d'avant MEGGA X n'a pas de pastille : le repli sur `[0]`
  // rend alors l'accent de la marque, ce qui est le comportement voulu.
  const accents = pfAccents()
  const accentDef = accents.find((a) => a.id === local.accent) ?? accents[0]
  const accentCol = dark ? accentDef.darkHex : accentDef.hex
  const onAccent = dark ? accentDef.darkInk : accentDef.ink
  const accentLabel = (id: string) => t(`focus.preferences.accents.${id}`)

  // Thème : la pilule reflète le dark RÉELLEMENT rendu (source de vérité = le shell),
  // jamais une valeur persistée périmée — évite toute désynchro pilule↔app.
  const themeSeg = local.theme === 'system' ? 'system' : (dark ? 'dark' : 'light')

  const control = (r: RowDef): ReactNode => {
    const k = r.key as PrefKey
    if (r.type === 'toggle') return <PxfSwitch c={c} accent={accentCol} onAccent={onAccent} on={Boolean(local[k])} onClick={() => commit(k, !local[k])} />
    if (r.type === 'seg') return <PxfSeg c={c} accent={accentCol} onAccent={onAccent} value={k === 'theme' ? themeSeg : String(local[k])} onChange={(v) => commit(k, v)} options={r.options ?? []} />
    // `accentDef.id` et non la valeur brute : un réglage hérité n'a pas de
    // pastille, et l'afficher tel quel ne cochait RIEN — le nuancier semblait
    // sans sélection. On coche ce qui rend réellement.
    if (r.type === 'swatch') return <PxfSwatch c={c} dark={dark} accents={accents} value={accentDef.id} onChange={(v) => commit(k, v)} labelOf={accentLabel} />
    return <PxfSelect c={c} value={String(local[k])} onChange={(v) => commit(k, v)} options={r.options ?? []} />
  }

  const Row = (r: RowDef) => (
    <div key={r.key} className="pxf-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', minWidth: 0 }}>
      <PxfChip name={r.icon} c={c} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, letterSpacing: -0.2, color: c.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(r.labelKey)}</span>
        {savedKey === r.key && <span className="pxf-saved" style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, color: c.green, flexShrink: 0 }}>{t('focus.common.saved')}</span>}
      </div>
      {control(r)}
    </div>
  )

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
      <style>{`
        ${PF_KEYFRAMES}
        @media (prefers-reduced-motion: no-preference) {
          @keyframes pxfCtrlIn { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: none; } }
          @keyframes pxfMenuIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .pxf-saved { animation: pxfCtrlIn .26s cubic-bezier(.2,.9,.3,1) both; }
        }
        .pxf-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; border-radius: 12px; }
      `}</style>

      <div style={{ borderRadius: 'var(--crm-radius-5xl)', boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', background: c.cardSub, borderRadius: '22px 22px 0 0', borderTop: c.hair, borderLeft: c.hair, borderRight: c.hair, borderBottom: `1px solid ${c.hairSoft}`, padding: 'var(--crm-space-md) var(--crm-space-5xl)' }}>
          <PxfIc name="info" size={14} stroke={c.sub} sw={1.8} />
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: c.sub, letterSpacing: -0.1 }}>{t('focus.preferences.banner')}</span>
        </div>

        <div style={{ background: c.card, borderRadius: '0 0 22px 22px', borderLeft: c.hair, borderRight: c.hair, borderBottom: c.hair, padding: 'var(--crm-space-md) var(--crm-space-xl) var(--crm-space-2xl)' }}>
          {GROUPS.map((g, gi) => (
            <div key={g.id} style={{ padding: 'var(--crm-space-sm) 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-xl) var(--crm-space-lg) var(--crm-space-md)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: c[g.dot], flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t(g.titleKey)}</span>
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
