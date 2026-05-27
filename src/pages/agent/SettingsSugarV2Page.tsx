// MEGGA CRM Sugar v2 — Settings (Tier 3.k)
// 1:1 port from the Claude Design bundle (`crm-screen-settings-sugar.jsx`).
// Bandeau pill par défaut. 9 sections placeholder, Profile en plein.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
// Imports : 6 sections câblées + visibles dans le menu (Profile, Agency,
// Notifications, Preferences, Integrations, Billing). Les 4 autres (Team,
// Brand, Privacy, Security) sont cachées du menu via data.ts jusqu'à
// wire réel — cf. SETTINGS_SECTIONS.
import { BannerPill } from '@/components/crm-sugar/settings/BannerPill'
import { ProfileSection } from '@/components/crm-sugar/settings/ProfileSection'
import { AgencySection } from '@/components/crm-sugar/settings/AgencySection'
import { NotificationsSection } from '@/components/crm-sugar/settings/NotificationsSection'
import { PreferencesSection } from '@/components/crm-sugar/settings/PreferencesSection'
import { BillingSection } from '@/components/crm-sugar/settings/BillingSection'
import { IntegrationsSection } from '@/components/crm-sugar/settings/IntegrationsSection'
import { PrivacySection } from '@/components/crm-sugar/settings/PrivacySection'
import { SecuritySection } from '@/components/crm-sugar/settings/SecuritySection'
import { SET_PALETTE, type SectionId } from '@/components/crm-sugar/settings/data'

const DARK_TONE: DarkTone = 'meggaAi'

export default function SettingsSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const [active, setActive] = useState<SectionId>('profile')

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/parcours'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': navigate('/dashboard/documents'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': break
      default:
    }
  }

  const renderContent = () => {
    if (active === 'profile') return <ProfileSection />
    if (active === 'agency') return <AgencySection />
    if (active === 'notifications') return <NotificationsSection />
    if (active === 'preferences') return <PreferencesSection />
    if (active === 'integrations') return <IntegrationsSection />
    if (active === 'privacy') return <PrivacySection />
    if (active === 'security') return <SecuritySection />
    if (active === 'billing') return <BillingSection />
    // 'team', 'brand' sont exclus du menu (data.ts) jusqu'à wire réel —
    // fallback null si quelqu'un force un id non listé.
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: SET_PALETTE.bgGradient,
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: SET_PALETTE.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes setFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes setSlideUp {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes setFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes setScaleIn {
          from { opacity: 0; transform: scale(.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes setSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <SugarTopNav
        active={'settings' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="settings"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '100px 40px 60px 40px',
            maxWidth: 1480,
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <BannerPill active={active} onChange={setActive} />

          <div
            style={{
              display: 'flex',
              gap: 20,
              alignItems: 'flex-start',
              flex: 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>{renderContent()}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
