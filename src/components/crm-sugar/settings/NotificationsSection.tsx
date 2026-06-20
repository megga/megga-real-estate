// MEGGA CRM Sugar v2 — Settings Notifications section (maquette « Sugar Pure »).
// Fidèle à `crm-screen-settings-step3.jsx` (SettingsNotificationsSection) :
// SetCard padding 0, 4 canaux (email / sms / whatsapp / inapp), divider SET.line.
// Câblage réel : profiles.preferences.notifications (JSON Supabase) via useNotifPreferences.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  labelKey: string
  icon: SettingsIconName
  descKey: string
}

const CHANNELS: Channel[] = [
  { id: 'email', labelKey: 'notifications.channels.email.label', icon: 'mail', descKey: 'notifications.channels.email.desc' },
  { id: 'sms', labelKey: 'notifications.channels.sms.label', icon: 'sms', descKey: 'notifications.channels.sms.desc' },
  { id: 'whatsapp', labelKey: 'notifications.channels.whatsapp.label', icon: 'bell', descKey: 'notifications.channels.whatsapp.desc' },
  { id: 'inapp', labelKey: 'notifications.channels.inapp.label', icon: 'bell', descKey: 'notifications.channels.inapp.desc' },
]

export type NotifData = NotifPreferences

export function NotificationsSection() {
  const { t } = useTranslation('settings')
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
      toast.error(t('notifications.toast.sessionExpired'))
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success(t('notifications.toast.saved'), { duration: 2400 })
    } catch (err) {
      console.error('[NotificationsSection] save failed', err)
      toast.error(t('notifications.toast.saveError'))
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
          kicker={t('notifications.header.kicker')}
          title={t('notifications.header.title')}
          sub={t('notifications.header.sub')}
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
                  {t(c.labelKey)}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {t(c.descKey)}
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
      {/* Toast piloté par le useToast() global. */}
    </>
  )
}
