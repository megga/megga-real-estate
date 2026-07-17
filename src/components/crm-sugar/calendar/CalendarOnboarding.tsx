// MEGGA CRM Sugar — Calendrier — Écran « Première connexion »
// Concept immersif intégré à la chrome CRM (dark quasi-noir uniforme). Colonne
// texte à gauche, héros animé à droite : icône verre Calendar reliée à Google +
// Outlook par des flèches de synchro. CTA « Connecter … » → vrai OAuth ;
// « Plus tard » → bento de rappel puis révèle le calendrier.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { SugarTopNav, SugarIconRail, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { buildCalPalette, CalPaletteContext, useCalPalette, type CalSugarPalette } from './data'

const DARK_TONE: DarkTone = 'meggaAi'

function LogoGoogle({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
function LogoOutlook({ s = 19 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" fill="#F25022" /><rect x="26" y="4" width="18" height="18" fill="#7FBA00" />
      <rect x="4" y="26" width="18" height="18" fill="#00A4EF" /><rect x="26" y="26" width="18" height="18" fill="#FFB900" />
    </svg>
  )
}

function ConnectBtn({ logo, children, onClick }: { logo: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  const SP = useCalPalette()
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, height: 54, padding: '0 22px', borderRadius: 999, background: SP.card, color: SP.ink, border: 0, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', boxShadow: SP.shadowSm, width: '100%', maxWidth: 360 }}
    >
      <span style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{logo}</span>
      {children}
    </button>
  )
}

function Hero() {
  const SP = useCalPalette()
  return (
    <div style={{ display: 'grid', placeItems: 'center', position: 'relative', minWidth: 0 }}>
      <div className="cobHero" style={{ position: 'relative', width: 620, height: 430 }}>
        <svg className="cobArcs" viewBox="0 0 620 430" style={{ position: 'absolute', inset: 0 }}>
          <path id="cobPG" d="M 112 112 C 195 85, 240 135, 296 192" fill="none" stroke={SP.ghost} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 8" />
          <path id="cobPM" d="M 508 312 C 428 344, 375 284, 326 228" fill="none" stroke={SP.ghost} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 8" />
          <circle r="4" fill={SP.ink}><animateMotion dur="4.2s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear"><mpath href="#cobPG" /></animateMotion></circle>
          <circle r="4" fill={SP.ink}><animateMotion dur="4.8s" begin="0.9s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear"><mpath href="#cobPM" /></animateMotion></circle>
        </svg>
        <img className="cobCal" src="/calendar/calendar-glass.svg" alt="" style={{ position: 'absolute', left: '50%', top: '50%', width: 250, transform: 'translate(-50%,-52%)', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.55))' }} />
        <span className="cobChipG" style={{ position: 'absolute', left: 44, top: 64, width: 64, height: 64, borderRadius: 18, background: SP.card, boxShadow: SP.shadowSm, display: 'grid', placeItems: 'center' }}><LogoGoogle s={28} /></span>
        <span className="cobChipM" style={{ position: 'absolute', right: 48, bottom: 70, width: 64, height: 64, borderRadius: 18, background: SP.card, boxShadow: SP.shadowSm, display: 'grid', placeItems: 'center' }}><LogoOutlook s={26} /></span>
      </div>
    </div>
  )
}

export interface CalendarOnboardingProps {
  dark: boolean
  setDark: (v: boolean) => void
  onDismiss: () => void
  onConnectGoogle: () => void
  onConnectOutlook: () => void
}

export function CalendarOnboarding({ dark, setDark, onDismiss, onConnectGoogle, onConnectOutlook }: CalendarOnboardingProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('calendar')
  const tk = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(tk, dark, DARK_TONE)
  const SP: CalSugarPalette = buildCalPalette(dark, tk)
  const [later, setLater] = useState(false)

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings?tab=integrations'); break
      default:
    }
  }

  return (
    <CalPaletteContext.Provider value={SP}>
      <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'Manrope, "Inter Tight", system-ui, sans-serif', color: SP.ink }}>
        <style>{`
          @keyframes cobFloat{from{transform:translate(-50%,-52%) translateY(0)}to{transform:translate(-50%,-52%) translateY(-10px)}}
          @keyframes cobChip{from{transform:translateY(0)}to{transform:translateY(-7px)}}
          @keyframes cobDash{to{stroke-dashoffset:-22}}
          @keyframes cobUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
          @media (prefers-reduced-motion: no-preference){
            .cobCal{animation:cobFloat 6s ease-in-out infinite alternate}
            .cobChipG{animation:cobChip 5s .4s ease-in-out infinite alternate}
            .cobChipM{animation:cobChip 5.6s 1.1s ease-in-out infinite alternate}
            .cobArcs path{animation:cobDash 1.5s linear infinite}
            .cobIn1{animation:cobUp .5s cubic-bezier(.2,.8,.2,1) both}
            .cobIn3{animation:cobUp .5s .16s cubic-bezier(.2,.8,.2,1) both}
          }
        `}</style>

        <SugarTopNav active="calendar" t={tk} sp={sp} dark={dark} onNavigate={onNavigate} />

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <SugarIconRail active="calendar" onNavigate={onNavigate} onCmd={() => {}} dark={dark} setDark={setDark} sp={sp} />

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
            <div style={{ position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg, display: 'grid', gridTemplateColumns: '1fr 1.2fr', minHeight: 0 }}>
              {/* Colonne texte */}
              <div style={{ position: 'relative', padding: '0 0 0 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                <div className="cobIn1" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: SP.muted }}>{t('onboarding.kicker')}</div>
                <h1 className="cobIn1" style={{ margin: '14px 0 0', fontSize: 44, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1.06, color: SP.ink }}>{t('onboarding.title')}</h1>
                <div className="cobIn3" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 34, maxWidth: 360 }}>
                  <ConnectBtn logo={<LogoGoogle s={20} />} onClick={onConnectGoogle}>{t('onboarding.connectGoogle')}</ConnectBtn>
                  <ConnectBtn logo={<LogoOutlook s={19} />} onClick={onConnectOutlook}>{t('onboarding.connectOutlook')}</ConnectBtn>
                </div>
                <button onClick={() => setLater(true)} className="cobIn3" style={{ alignSelf: 'flex-start', marginTop: 18, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: SP.muted, padding: 0 }}>{t('onboarding.later')}</button>
                <div style={{ position: 'absolute', left: 96, bottom: 36, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 500, color: SP.muted }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={SP.muted} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  {t('onboarding.privacy')}
                </div>
              </div>
              {/* Colonne héros */}
              <Hero />
            </div>
          </main>
        </div>

        {later && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'grid', placeItems: 'center', background: 'rgba(6,7,10,0.55)', backdropFilter: 'blur(3px)', animation: 'cobUp .2s ease both' }}>
            <div style={{ width: 440, background: SP.card, borderRadius: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3)', padding: '28px 30px 24px' }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: SP.cardSubtle, display: 'grid', placeItems: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={SP.inkSoft} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              </span>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, color: SP.ink, marginTop: 16 }}>{t('onboarding.laterTitle')}</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: SP.muted, lineHeight: 1.55, marginTop: 10 }}>{t('onboarding.laterBody')} <b style={{ color: SP.inkSoft, fontWeight: 700 }}>{t('onboarding.laterPath')}</b>.</div>
              <button onClick={onDismiss} style={{ width: '100%', height: 46, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, background: SP.accent, color: SP.onAccent, marginTop: 24 }}>{t('onboarding.goToCalendar')}</button>
            </div>
          </div>
        )}
      </div>
    </CalPaletteContext.Provider>
  )
}
