// MEGGA — Espace vendeur — modal Paramètres (Sugar Pure).
// Notifications · disponibilités visites · langue & contact · apparence (dark mode).
// Contrôlé : reçoit settings + onChange(key,val) + dark + onDark.
// Phase 1 (visuel) : la persistance réelle est stubbée (prop onSave).
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSP } from './theme'
import { SvIcon } from './icons'
import type { SvIconName } from './icons'
import SvModalShell from './SvModalShell'

export interface SellerSettings {
  notifOffre: boolean
  notifVisite: boolean
  notifRetour: boolean
  notifResume: boolean
  jours: string[]
  creneaux: string[]
  preavis: string
  langue: string
  canal: string
}

interface Props {
  settings: SellerSettings
  onChange: <K extends keyof SellerSettings>(key: K, value: SellerSettings[K]) => void
  dark: boolean
  onDark: (v: boolean) => void
  onClose: () => void
  /** Persiste les préférences vendeur (PATCH token-scoped). Peut être async. */
  onSave?: (settings: SellerSettings) => void | Promise<void>
}

// ── Contrôles ───────────────────────────────────────────────────────────
function SgToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const SP = useSP()
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        border: 0,
        cursor: 'pointer',
        padding: 3,
        flexShrink: 0,
        position: 'relative',
        background: on ? SP.accent : SP.line,
        transition: 'background .2s ease',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 22,
          height: 22,
          borderRadius: 999,
          background: on ? SP.onAccent : SP.card,
          boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform .2s cubic-bezier(.2,.8,.2,1)',
        }}
      />
    </button>
  )
}

function SgToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  const SP = useSP()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: SP.ink, letterSpacing: -0.1 }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      <SgToggle on={on} onChange={onChange} />
    </div>
  )
}

interface Option {
  value: string
  label: string
}

function SgChips({ options, values, onToggle }: { options: Option[]; values: string[]; onToggle: (v: string) => void }) {
  const SP = useSP()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = values.includes(o.value)
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            style={{
              padding: '8px 15px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: on ? SP.accent : SP.card,
              color: on ? SP.onAccent : SP.inkSoft,
              boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${SP.line}`,
              transition: 'all .15s ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SgSegment({ options, value, onChange }: { options: Option[]; value: string; onChange: (v: string) => void }) {
  const SP = useSP()
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: SP.cardSubtle }}>
      {options.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              padding: '9px 10px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: on ? SP.card : 'transparent',
              color: on ? SP.ink : SP.muted,
              boxShadow: on ? SP.shadowSm : 'none',
              transition: 'all .15s ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SgSection({ icon, title, sub, children, first }: { icon: SvIconName; title: string; sub?: string; children: ReactNode; first?: boolean }) {
  const SP = useSP()
  return (
    <div style={{ paddingTop: first ? 0 : 24, marginTop: first ? 0 : 24, borderTop: first ? 'none' : `1px solid ${SP.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: sub ? 4 : 16 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            background: SP.cardSubtle,
            color: SP.ink,
          }}
        >
          <SvIcon name={icon} size={16} stroke={SP.ink} sw={1.7} />
        </span>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: SP.ink, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, margin: '0 0 12px 43px' }}>{sub}</div>}
      <div style={{ paddingLeft: 43 }}>{children}</div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  const SP = useSP()
  return <div style={{ fontSize: 12.5, fontWeight: 600, color: SP.inkSoft, margin: '16px 0 9px' }}>{children}</div>
}

// ── Modal ───────────────────────────────────────────────────────────────
export default function SvSettingsModal({ settings, onChange, dark, onDark, onClose, onSave }: Props) {
  const SP = useSP()
  const { t } = useTranslation('common')
  const [saving, setSaving] = useState(false)

  const toggleDay = (d: string) => {
    const next = settings.jours.includes(d) ? settings.jours.filter((x) => x !== d) : [...settings.jours, d]
    onChange('jours', next)
  }
  const toggleSlot = (s: string) => {
    const next = settings.creneaux.includes(s) ? settings.creneaux.filter((x) => x !== s) : [...settings.creneaux, s]
    onChange('creneaux', next)
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave?.(settings)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <SvModalShell onClose={onClose}>
      <div style={{ marginBottom: 22 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11.5,
            fontWeight: 700,
            color: SP.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {t('portal.settings.eyebrow')}
        </span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SP.ink, letterSpacing: -0.5 }}>{t('portal.settings.title')}</h2>
      </div>

      <SgSection icon="mail" title={t('portal.settings.notif.title')} sub={t('portal.settings.notif.sub')} first>
        <SgToggleRow label={t('portal.settings.notif.offer')} on={settings.notifOffre} onChange={(v) => onChange('notifOffre', v)} />
        <SgToggleRow label={t('portal.settings.notif.visit')} on={settings.notifVisite} onChange={(v) => onChange('notifVisite', v)} />
        <SgToggleRow label={t('portal.settings.notif.feedback')} on={settings.notifRetour} onChange={(v) => onChange('notifRetour', v)} />
      </SgSection>

      <SgSection icon="calendar" title={t('portal.settings.availability.title')} sub={t('portal.settings.availability.sub')}>
        <SgChips
          options={[
            { value: 'lun', label: t('portal.settings.availability.day.mon') },
            { value: 'mar', label: t('portal.settings.availability.day.tue') },
            { value: 'mer', label: t('portal.settings.availability.day.wed') },
            { value: 'jeu', label: t('portal.settings.availability.day.thu') },
            { value: 'ven', label: t('portal.settings.availability.day.fri') },
            { value: 'sam', label: t('portal.settings.availability.day.sat') },
            { value: 'dim', label: t('portal.settings.availability.day.sun') },
          ]}
          values={settings.jours}
          onToggle={toggleDay}
        />
        <FieldLabel>{t('portal.settings.availability.slotsLabel')}</FieldLabel>
        <SgChips
          options={[
            { value: 'matin', label: t('portal.settings.availability.slot.morning') },
            { value: 'apresmidi', label: t('portal.settings.availability.slot.afternoon') },
            { value: 'soir', label: t('portal.settings.availability.slot.evening') },
          ]}
          values={settings.creneaux}
          onToggle={toggleSlot}
        />
        <FieldLabel>{t('portal.settings.availability.noticeLabel')}</FieldLabel>
        <SgSegment
          options={[
            { value: 'jour', label: t('portal.settings.availability.notice.sameDay') },
            { value: '24h', label: t('portal.settings.availability.notice.24h') },
            { value: '48h', label: t('portal.settings.availability.notice.48h') },
          ]}
          value={settings.preavis}
          onChange={(v) => onChange('preavis', v)}
        />
      </SgSection>

      <SgSection icon="globe" title={t('portal.settings.langContact.title')}>
        <FieldLabel>{t('portal.settings.langContact.langLabel')}</FieldLabel>
        <SgSegment
          options={[
            { value: 'fr', label: 'FR' },
            { value: 'de', label: 'DE' },
            { value: 'en', label: 'EN' },
            { value: 'it', label: 'IT' },
          ]}
          value={settings.langue}
          onChange={(v) => onChange('langue', v)}
        />
        <FieldLabel>{t('portal.settings.langContact.channelLabel')}</FieldLabel>
        <SgSegment
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'tel', label: t('portal.settings.langContact.channel.phone') },
            { value: 'email', label: t('portal.settings.langContact.channel.email') },
          ]}
          value={settings.canal}
          onChange={(v) => onChange('canal', v)}
        />
      </SgSection>

      <SgSection icon={dark ? 'moon' : 'sun'} title={t('portal.settings.appearance.title')}>
        <SgToggleRow label={t('portal.settings.appearance.darkMode')} sub={t('portal.settings.appearance.darkModeSub')} on={dark} onChange={onDark} />
      </SgSection>

      <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
        <button
          onClick={onClose}
          style={{
            flex: '0 0 auto',
            minWidth: 120,
            height: 50,
            borderRadius: 999,
            cursor: 'pointer',
            border: 0,
            background: SP.card,
            color: SP.inkSoft,
            boxShadow: `inset 0 0 0 1.5px ${SP.line}`,
            fontSize: 14.5,
            fontWeight: 600,
            fontFamily: 'inherit',
            transition: 'background .18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = SP.cardSubtle)}
          onMouseLeave={(e) => (e.currentTarget.style.background = SP.card)}
        >
          {t('portal.settings.cancel')}
        </button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            flex: 1,
            height: 50,
            borderRadius: 999,
            border: 0,
            cursor: saving ? 'default' : 'pointer',
            background: saving ? SP.disabledBg : SP.accent,
            color: SP.onAccent,
            fontSize: 14.5,
            fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: saving ? 'none' : '0 6px 16px rgba(11,12,14,0.18)',
            transition: 'all .18s ease',
          }}
          onMouseEnter={(e) => {
            if (saving) return
            e.currentTarget.style.background = SP.accentHover
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            if (saving) return
            e.currentTarget.style.background = SP.accent
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          {saving ? t('portal.settings.saving') : t('portal.settings.save')}
        </button>
      </div>
    </SvModalShell>
  )
}
