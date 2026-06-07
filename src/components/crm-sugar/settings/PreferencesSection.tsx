// MEGGA CRM Sugar v2 — Settings Preferences section (maquette « Sugar Pure »).
// Fidèle à `crm-screen-settings-step3.jsx` (SettingsPreferencesSection) : 4 cartes
// empilées (Région & langue, Vues par défaut, Apparence, Édition & assistance).
// PrefSelect (dropdown custom) + PrefRadio (cartes segmentées, actif = accent +
// blackInk) locaux ; ToggleRow importé des atoms.
// Câblage réel : profiles.preferences.ui (JSON Supabase) via useUiPreferences.
// L'IA y est présentée comme « assistance » (suggestions), jamais automatique.

import { useEffect, useState } from 'react'
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
      toast.error('Session expirée — reconnectez-vous pour enregistrer')
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success('Préférences enregistrées', { duration: 2400 })
    } catch (err) {
      console.error('[PreferencesSection] save failed', err)
      toast.error('Erreur lors de l’enregistrement')
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
          kicker="Préférences"
          title="Réglages personnels du CRM"
          sub="Spécifique à votre compte, n'affecte pas les autres membres de l'équipe."
        />

        {/* G1 — Région & langue */}
        <SetCard
          title="Région & langue"
          sub="Affecte la langue d'interface et les formats par défaut."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <PrefSelect
              label="Langue"
              value={data.language}
              onChange={v => set({ language: v })}
              options={[
                { id: 'fr', label: 'Français' },
                { id: 'en', label: 'English' },
                { id: 'de', label: 'Deutsch' },
                { id: 'it', label: 'Italiano' },
              ]}
            />
            <PrefSelect
              label="Devise"
              value={data.currency}
              onChange={v => set({ currency: v })}
              options={[
                { id: 'CHF', label: 'CHF · Franc suisse' },
                { id: 'EUR', label: 'EUR · Euro' },
                { id: 'USD', label: 'USD · Dollar US' },
              ]}
            />
            <PrefSelect
              label="Unités"
              value={data.units}
              onChange={v => set({ units: v })}
              options={[
                { id: 'metric', label: 'm² · m' },
                { id: 'imperial', label: 'ft² · ft' },
              ]}
            />
            <PrefSelect
              label="Format de date"
              value={data.dateFormat}
              onChange={v => set({ dateFormat: v })}
              options={[
                { id: 'dd.MM.yyyy', label: '03.05.2026 (CH)' },
                { id: 'dd/MM/yyyy', label: '03/05/2026 (FR)' },
                { id: 'MM/dd/yyyy', label: '05/03/2026 (US)' },
                { id: 'yyyy-MM-dd', label: '2026-05-03 (ISO)' },
              ]}
            />
          </div>
        </SetCard>

        {/* G2 — Vues par défaut */}
        <SetCard
          title="Vues par défaut"
          sub="Sur quel écran arriver à l'ouverture du CRM, et avec quelle vue."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <PrefSelect
              label="Écran d'accueil"
              value={data.defaultScreen}
              onChange={v => set({ defaultScreen: v })}
              options={[
                { id: 'today', label: "Aujourd'hui" },
                { id: 'pipeline', label: 'Pipeline' },
                { id: 'matching', label: 'Matching IA' },
                { id: 'contacts', label: 'Contacts' },
                { id: 'biens', label: 'Mes biens' },
                { id: 'calendar', label: 'Calendrier' },
                { id: 'docs', label: 'Documents' },
              ]}
            />
            <PrefSelect
              label="Vue pipeline par défaut"
              value={data.defaultPipelineView}
              onChange={v => set({ defaultPipelineView: v })}
              options={[
                { id: 'kanban', label: 'Kanban' },
                { id: 'list', label: 'Liste' },
                { id: 'timeline', label: 'Timeline' },
              ]}
            />
          </div>
        </SetCard>

        {/* G3 — Apparence */}
        <SetCard title="Apparence" sub="Adapte l'interface à votre confort de lecture.">
          <div style={{ display: 'grid', gap: 18 }}>
            <PrefRadio
              label="Thème"
              value={data.theme}
              onChange={v => set({ theme: v })}
              options={[
                { id: 'light', label: 'Clair', sub: 'Recommandé en journée' },
                { id: 'dark', label: 'Sombre', sub: 'Mode marine' },
                { id: 'system', label: 'Système', sub: 'Suit votre OS' },
              ]}
            />
            <PrefRadio
              label="Densité"
              value={data.density}
              onChange={v => set({ density: v })}
              options={[
                { id: 'comfort', label: 'Confort', sub: 'Marges aérées' },
                { id: 'compact', label: 'Compact', sub: "Plus d'infos par écran" },
              ]}
            />
          </div>
        </SetCard>

        {/* G4 — Édition & assistance */}
        <SetCard
          title="Édition & assistance"
          sub="Contrôle de l'aide intelligente pendant la saisie."
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <ToggleRow
              label="Vérification orthographique"
              desc="Correcteur multilingue dans tous les champs longs."
              value={data.spellcheck}
              onChange={v => set({ spellcheck: v })}
              emphasis
            />
            <ToggleRow
              label="Sauvegarde automatique des brouillons"
              desc="Vos saisies sont gardées en mémoire pendant 30 jours."
              value={data.autosave}
              onChange={v => set({ autosave: v })}
              emphasis
            />
            <PrefRadio
              label="Niveau d'assistance Julien IA"
              value={data.aiAssist}
              onChange={v => set({ aiAssist: v })}
              options={[
                { id: 'off', label: 'Désactivé', sub: 'Aucune suggestion' },
                { id: 'balanced', label: 'Équilibré', sub: 'Suggestions à la demande' },
                { id: 'proactif', label: 'Proactif', sub: 'Suggestions au fil de la saisie' },
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
