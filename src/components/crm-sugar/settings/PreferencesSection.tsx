// MEGGA CRM Sugar v2 — Settings Preferences section (maquette « Sugar Pure »).
// Fidèle à `crm-screen-settings-step3.jsx` (SettingsPreferencesSection) : 4 cartes
// empilées (Région & langue, Vues par défaut, Apparence, Édition & assistance).
// PrefSelect (dropdown custom) + PrefRadio (cartes segmentées, actif = accent +
// blackInk) locaux ; ToggleRow importé des atoms.
// Câblage réel : profiles.preferences.ui (JSON Supabase) via useUiPreferences.
// L'IA y est présentée comme « assistance » (suggestions), jamais automatique.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { useToast } from '@/components/ui/Toast'
import { useUiPreferences } from '@/hooks/useUiPreferences'
import type { PrefsData } from './PreferencesSection.types'
import { SectionHeader, SetCard, SetIcon, ToggleRow, StickySaveBar } from './atoms'
import { SET_PALETTE } from './data'

export type { PrefsData }

const SET = SET_PALETTE

interface PrefSelectOption {
  id: string
  label: string
}

interface PrefSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: PrefSelectOption[]
}

// Dropdown custom Sugar — bouton stylé comme un SetInput, panneau flottant ancré.
function PrefSelect({ label, value, onChange, options }: PrefSelectProps) {
  const [open, setOpen] = useState(false)
  const sel = options.find(o => o.id === value)
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            height: 48,
            width: '100%',
            padding: '0 16px',
            borderRadius: 14,
            border: 0,
            background: SET.cardSubtle,
            color: SET.ink,
            fontFamily: 'inherit',
            fontSize: 14.5,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {sel?.label || '—'}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={SET.muted}
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 30 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 31,
                background: SET.card,
                borderRadius: 14,
                padding: 6,
                boxShadow: SET.shadowLg,
                maxHeight: 280,
                overflowY: 'auto',
                animation: 'setFadeUp .15s ease both',
              }}
            >
              {options.map(o => {
                const active = o.id === value
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: 0,
                      background: active ? SET.cardSubtle : 'transparent',
                      color: SET.ink,
                      fontFamily: 'inherit',
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.background = SET.cardSubtle
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {o.label}
                    {active && <SetIcon name="check" size={14} stroke={SET.ok} sw={2.4} />}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface PrefRadioOption {
  id: string
  label: string
  sub?: string
}

interface PrefRadioProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: PrefRadioOption[]
}

// Cartes segmentées — la carte active prend le fond accent (SET.black), avec
// titre/sous-titre posés en SET.blackInk (jamais #fff codé en dur → marche en dark).
function PrefRadio({ label, value, onChange, options }: PrefRadioProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 8,
        }}
      >
        {options.map(o => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                border: 0,
                background: active ? SET.black : SET.cardSubtle,
                color: active ? SET.blackInk : SET.ink,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                boxShadow: active ? '0 8px 22px rgba(11,12,14,0.22)' : 'none',
                transition: 'all .18s',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{o.label}</div>
              {o.sub && (
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    marginTop: 3,
                    color: active ? `${SET.blackInk}B8` : SET.muted,
                  }}
                >
                  {o.sub}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PreferencesSection() {
  const { t } = useTranslation('settings')
  // Source de vérité : profiles.preferences.ui (JSON Supabase).
  // NB : timezone et firstDayOfWeek n'ont pas de contrôle UI dans la maquette ;
  // ils restent dans PrefsData (valeurs par défaut / serveur) et sont persistés
  // tels quels par `save` — on ne les écrase pas.
  const { preferences: serverPrefs, isSaving, hasBackend, save } = useUiPreferences()
  const [data, setData] = useState<PrefsData>(serverPrefs)
  const [saved, setSaved] = useState<PrefsData>(serverPrefs)

  // Sync depuis le serveur quand la query charge / s'invalide
  useEffect(() => {
    setData(serverPrefs)
    setSaved(serverPrefs)
  }, [serverPrefs])

  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const set = (patch: Partial<PrefsData>) => setData(d => ({ ...d, ...patch }))

  const toast = useToast()

  const handleSave = async () => {
    if (!hasBackend) {
      toast.error(t('preferences.toast.sessionExpired'))
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success(t('preferences.toast.saved'), { duration: 2400 })
    } catch (err) {
      console.error('[PreferencesSection] save failed', err)
      toast.error(t('preferences.toast.saveError'))
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker={t('preferences.header.kicker')}
          title={t('preferences.header.title')}
          sub={t('preferences.header.sub')}
        />

        {/* G1 — Région & langue */}
        <SetCard
          title={t('preferences.region.title')}
          sub={t('preferences.region.sub')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <PrefSelect
              label={t('preferences.region.language')}
              value={data.language}
              onChange={v => {
                set({ language: v })
                // Bascule l'interface tout de suite (l'overlay anime la transition) ;
                // le détecteur i18next met aussi à jour localStorage['megga-language'].
                // « Enregistrer » persiste ensuite la préférence côté serveur.
                void i18n.changeLanguage(v)
              }}
              options={[
                { id: 'fr', label: t('common:language.fr') },
                { id: 'en', label: t('common:language.en') },
                { id: 'de', label: t('common:language.de') },
                { id: 'it', label: t('common:language.it') },
              ]}
            />
            <PrefSelect
              label={t('preferences.region.currency')}
              value={data.currency}
              onChange={v => set({ currency: v })}
              options={[
                { id: 'CHF', label: t('preferences.region.currencyOptions.CHF') },
                { id: 'EUR', label: t('preferences.region.currencyOptions.EUR') },
                { id: 'USD', label: t('preferences.region.currencyOptions.USD') },
              ]}
            />
            <PrefSelect
              label={t('preferences.region.units')}
              value={data.units}
              onChange={v => set({ units: v })}
              options={[
                { id: 'metric', label: 'm² · m' },
                { id: 'imperial', label: 'ft² · ft' },
              ]}
            />
            <PrefSelect
              label={t('preferences.region.dateFormat')}
              value={data.dateFormat}
              onChange={v => set({ dateFormat: v })}
              options={[
                { id: 'dd.MM.yyyy', label: t('preferences.region.dateFormatOptions.ch') },
                { id: 'dd/MM/yyyy', label: t('preferences.region.dateFormatOptions.fr') },
                { id: 'MM/dd/yyyy', label: t('preferences.region.dateFormatOptions.us') },
                { id: 'yyyy-MM-dd', label: t('preferences.region.dateFormatOptions.iso') },
              ]}
            />
          </div>
        </SetCard>

        {/* G2 — Vues par défaut */}
        <SetCard
          title={t('preferences.views.title')}
          sub={t('preferences.views.sub')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <PrefSelect
              label={t('preferences.views.homeScreen')}
              value={data.defaultScreen}
              onChange={v => set({ defaultScreen: v })}
              options={[
                { id: 'today', label: t('preferences.views.screens.today') },
                { id: 'pipeline', label: t('preferences.views.screens.pipeline') },
                { id: 'matching', label: t('preferences.views.screens.matching') },
                { id: 'contacts', label: t('preferences.views.screens.contacts') },
                { id: 'biens', label: t('preferences.views.screens.biens') },
                { id: 'calendar', label: t('preferences.views.screens.calendar') },
              ]}
            />
            <PrefSelect
              label={t('preferences.views.defaultPipelineView')}
              value={data.defaultPipelineView}
              onChange={v => set({ defaultPipelineView: v })}
              options={[
                { id: 'kanban', label: t('preferences.views.pipelineViews.kanban') },
                { id: 'list', label: t('preferences.views.pipelineViews.list') },
                { id: 'timeline', label: t('preferences.views.pipelineViews.timeline') },
              ]}
            />
          </div>
        </SetCard>

        {/* G3 — Apparence */}
        <SetCard title={t('preferences.appearance.title')} sub={t('preferences.appearance.sub')}>
          <div style={{ display: 'grid', gap: 18 }}>
            <PrefRadio
              label={t('preferences.appearance.theme')}
              value={data.theme}
              onChange={v => set({ theme: v })}
              options={[
                { id: 'light', label: t('preferences.appearance.themes.light.label'), sub: t('preferences.appearance.themes.light.sub') },
                { id: 'dark', label: t('preferences.appearance.themes.dark.label'), sub: t('preferences.appearance.themes.dark.sub') },
                { id: 'system', label: t('preferences.appearance.themes.system.label'), sub: t('preferences.appearance.themes.system.sub') },
              ]}
            />
            <PrefRadio
              label={t('preferences.appearance.density')}
              value={data.density}
              onChange={v => set({ density: v })}
              options={[
                { id: 'comfort', label: t('preferences.appearance.densities.comfort.label'), sub: t('preferences.appearance.densities.comfort.sub') },
                { id: 'compact', label: t('preferences.appearance.densities.compact.label'), sub: t('preferences.appearance.densities.compact.sub') },
              ]}
            />
          </div>
        </SetCard>

        {/* G4 — Édition & assistance */}
        <SetCard
          title={t('preferences.editing.title')}
          sub={t('preferences.editing.sub')}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <ToggleRow
              label={t('preferences.editing.spellcheck.label')}
              desc={t('preferences.editing.spellcheck.desc')}
              value={data.spellcheck}
              onChange={v => set({ spellcheck: v })}
              emphasis
            />
            <ToggleRow
              label={t('preferences.editing.autosave.label')}
              desc={t('preferences.editing.autosave.desc')}
              value={data.autosave}
              onChange={v => set({ autosave: v })}
              emphasis
            />
            <PrefRadio
              label={t('preferences.editing.aiAssist.label')}
              value={data.aiAssist}
              onChange={v => set({ aiAssist: v })}
              options={[
                { id: 'off', label: t('preferences.editing.aiAssist.off.label'), sub: t('preferences.editing.aiAssist.off.sub') },
                { id: 'balanced', label: t('preferences.editing.aiAssist.balanced.label'), sub: t('preferences.editing.aiAssist.balanced.sub') },
                { id: 'proactif', label: t('preferences.editing.aiAssist.proactif.label'), sub: t('preferences.editing.aiAssist.proactif.sub') },
              ]}
            />
          </div>
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={isSaving}
        onSave={handleSave}
        onCancel={() => setData(saved)}
      />
    </>
  )
}
