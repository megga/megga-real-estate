// MEGGA CRM — Section « Notifications » façon Focus (grammaire profil/agence).
// Rendue dans le bento droit des Réglages quand active === 'notifications'.
// Bande info + un groupe de canaux (icône + libellé + description + interrupteur).
// Câblage : profiles.preferences.notifications via useNotifPreferences. Bascule EN
// DIRECT (persistance immédiate), confirmation « Enregistré ». i18n : namespace
// `settings` (canaux = notifications.channels.*, microcopie = focus.notifications.*).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { useNotifPreferences, type NotifPreferences } from '@/hooks/useNotifPreferences'
import { PfIc, PfChip, PfSwitch, type FocusSectionProps, type PfIconName, type PfColors } from './pfKit'
import { pfColors, PF_KEYFRAMES } from './pfKitCore'

type ChannelId = keyof NotifPreferences

const NF_CHANNELS: { id: ChannelId; icon: PfIconName }[] = [
  { id: 'email', icon: 'mail' },
  { id: 'sms', icon: 'smartphone' },
  { id: 'whatsapp', icon: 'chat' },
  { id: 'inapp', icon: 'bell' },
]

export function NotificationsFocusSection({ sp, surf, dark }: FocusSectionProps) {
  const { t } = useTranslation('settings')
  const c: PfColors = pfColors(sp, surf, dark)
  const toast = useToast()
  const { preferences, hasBackend, save } = useNotifPreferences()

  const [local, setLocal] = useState<NotifPreferences>(preferences)
  useEffect(() => { setLocal(preferences) }, [preferences])

  const [savedKey, setSavedKey] = useState<ChannelId | null>(null)

  const toggle = async (id: ChannelId) => {
    const next = { ...local, [id]: !local[id] }
    setLocal(next)
    if (!hasBackend) { toast.error(t('focus.toast.sessionExpired')); return }
    try {
      await save(next)
      setSavedKey(id)
      setTimeout(() => setSavedKey((s) => (s === id ? null : s)), 1600)
    } catch {
      setLocal((s) => ({ ...s, [id]: !s[id] })) // rollback optimiste
      toast.error(t('focus.toast.saveError'))
    }
  }

  const activeCount = Object.values(local).filter(Boolean).length

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        ${PF_KEYFRAMES}
        .nfx-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'}; }
        .nfx-saved { animation: pfxCtrlIn .26s cubic-bezier(.2,.9,.3,1) both; }
      `}</style>

      <div style={{ borderRadius: 22, boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: c.cardSub, borderRadius: '22px 22px 0 0', border: c.hair, borderBottom: `1px solid ${c.hairSoft}`, padding: '8px 20px' }}>
          <PfIc name="info" size={14} stroke={c.sub} sw={1.8} />
          <span style={{ fontSize: 12, fontWeight: 600, color: c.sub, letterSpacing: -0.1 }}>{t('focus.notifications.banner')}</span>
        </div>

        <div style={{ background: c.card, borderRadius: '0 0 22px 22px', border: c.hair, borderTop: 0, padding: '8px 12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px 8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: c.blue, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.2, color: c.ink, flex: 1 }}>{t('focus.notifications.group')}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: c.sub }}>{t('focus.notifications.count', { active: activeCount, total: NF_CHANNELS.length })}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
            {NF_CHANNELS.map((ch) => (
              <div key={ch.id} className="nfx-row" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 10px', borderRadius: 12, minWidth: 0 }}>
                <PfChip name={ch.icon} c={c} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: c.ink }}>{t(`notifications.channels.${ch.id}.label`)}</span>
                    {savedKey === ch.id && <span className="nfx-saved" style={{ fontSize: 10.5, fontWeight: 700, color: c.green }}>{t('focus.common.saved')}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: c.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(`notifications.channels.${ch.id}.desc`)}</div>
                </div>
                <PfSwitch c={c} on={local[ch.id]} onClick={() => toggle(ch.id)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
