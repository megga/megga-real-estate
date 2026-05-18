// MEGGA CRM Sugar v2 — Settings Notifications section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step3.jsx` (SettingsNotificationsSection).
// NB: la chaîne « WhatsApp » du proto est remplacée par « Messagerie interne »
// pour respecter la règle CLAUDE.md (canal interne, pas WhatsApp public).

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  SectionHeader,
  SetCard,
  SetIcon,
  SetSwitch,
  StickySaveBar,
} from './atoms'
import { SET_PALETTE, type SettingsIconName } from './data'
import { useNotifPreferences, type NotifPreferences } from '@/hooks/useNotifPreferences'

const SET = SET_PALETTE

interface Channel {
  id: keyof NotifData
  label: string
  icon: SettingsIconName
  desc: string
}

const CHANNELS: Channel[] = [
  { id: 'email', label: 'Email', icon: 'mail', desc: 'Notifications principales par email' },
  { id: 'sms', label: 'SMS', icon: 'sms', desc: 'Pour les urgences (offres, signatures)' },
  { id: 'messages', label: 'Messagerie', icon: 'bell', desc: 'Messages clients reçus dans le CRM' },
  { id: 'inapp', label: 'Dans le CRM', icon: 'app', desc: 'Cloche de notifications du CRM' },
]

export type NotifData = NotifPreferences

export function NotificationsSection() {
  // Source de vérité : profiles.preferences.notifications (JSON Supabase)
  const { preferences: serverData, isSaving, hasBackend, save } = useNotifPreferences()
  const [data, setData] = useState<NotifData>(serverData)
  const [saved, setSaved] = useState<NotifData>(serverData)

  useEffect(() => {
    setData(serverData)
    setSaved(serverData)
  }, [serverData])

  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const toast = useToast()

  const setCh = (id: keyof NotifData, v: boolean) => setData(d => ({ ...d, [id]: v }))

  const handleSave = async () => {
    if (!hasBackend) {
      toast.success('Notifications enregistrées', { duration: 2400 })
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success('Notifications enregistrées', { duration: 2400 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[NotificationsSection] save failed', err)
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
          kicker="Notifications"
          title="Choisissez les canaux qui vous préviennent"
          sub="MEGGA vous notifie sur les canaux activés ci-dessous : nouveaux messages clients, offres, visites, signatures."
        />

        <SetCard padding={0}>
          {CHANNELS.map((c, i) => (
            <div
              key={c.id}
              style={{
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderBottom:
                  i < CHANNELS.length - 1 ? `1px solid ${SET.line}` : 'none',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: SET.cardSubtle,
                  color: SET.ink,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SetIcon name={c.icon} size={18} stroke={SET.ink} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: SET.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {c.label}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {c.desc}
                </div>
              </div>
              <SetSwitch value={data[c.id]} onChange={v => setCh(c.id, v)} />
            </div>
          ))}
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={isSaving}
        onSave={handleSave}
        onCancel={() => setData(saved)}
      />
      {/* Toast handled by global useToast(). */}
    </>
  )
}
