// MEGGA CRM Sugar v2 — KYC showcase démo (Tier 4 — D + E)
// Page de démo des composants KYC non-bloquants + bento contact.
// Utilisée pour vérifier visuellement les composants D + E avant intégration
// dans les pages contact/pipeline existantes (PR séparée).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { SectionLabel, SP } from '@/components/crm-sugar/kyc/atoms'
import { KycContactBento } from '@/components/crm-sugar/kyc/KycContactBento'
import { KycNonBlockingShowcase } from '@/components/crm-sugar/kyc/KycNonBlocking'

const DARK_TONE: DarkTone = 'meggaAi'

export default function KycShowcasePage() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const onCmd = () => {}
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
      case 'auto': navigate('/dashboard/automation'); break
      case 'chat': navigate('/dashboard/messages'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: SP.bg,
        fontFamily: SP.font,
        color: SP.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav
        active={'kyc' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="kyc"
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
            gap: 28,
          }}
        >
          {/* Header */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: SP.muted,
                marginBottom: 6,
              }}
            >
              Tier 4 KYC · Composants intégrables
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -0.8,
                lineHeight: 1.05,
              }}
            >
              KYC touchpoints — bento contact + alertes douces
            </div>
            <div
              style={{
                fontSize: 14,
                color: SP.inkSoft,
                marginTop: 10,
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              Composants à glisser dans la fiche contact, la carte deal, ou la vue
              responsable conformité. Le KYC ne bloque jamais une action métier — il
              accumule de la dette visible.
            </div>
          </div>

          {/* D — Bento contact */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>Variation D · Bento conformité dans fiche contact</SectionLabel>
            <div style={{ maxWidth: 540 }}>
              <KycContactBento
                onOpen={() => navigate('/dashboard/kyc/0431')}
                onRelance={() => {}}
              />
            </div>
          </section>

          {/* E — Mode non-bloquant */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>
              Variation E · Mode non-bloquant — alertes douces
            </SectionLabel>
            <div
              style={{
                fontSize: 13,
                color: SP.inkSoft,
                lineHeight: 1.55,
                maxWidth: 720,
                marginBottom: 6,
              }}
            >
              Le KYC ne bloque jamais une action — il accumule de la dette visible.
              Banner pliable sur la fiche contact, badge persistant sur la carte deal,
              tableau de dette pour le responsable conformité.
            </div>
            <KycNonBlockingShowcase />
          </section>
        </main>
      </div>
    </div>
  )
}
