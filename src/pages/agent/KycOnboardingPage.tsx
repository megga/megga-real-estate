// MEGGA CRM — KYC · Onboarding « Première ouverture »
// Port fidèle de `CRMScreenKycOnboarding` (crm-kyc-onboarding.jsx) : bento plein
// écran avec la cover PNG (lockup KYC aplati) + sur-impression CTA. Monté dans la
// chrome CRM (SugarTopNav + SugarIconRail). Route : /dashboard/kyc/bienvenue.
//
// Gating (empty-state) : posé par la page hôte (KycSugarV3Page) — flag
// localStorage `megga.kyc.onboarded` + 0 dossier. Les CTA posent le flag puis
// naviguent vers le pager (avec un state `openWizard` pour ouvrir le wizard).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'

const DARK_TONE: DarkTone = 'meggaAi'
export const KYC_ONBOARDED_KEY = 'megga.kyc.onboarded'

function ArrowGlyph({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export default function KycOnboardingPage() {
  const navigate = useNavigate()
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = useMemo(() => crmSugarPalette(t, dark, DARK_TONE), [t, dark])

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onCmd = () => {}

  const dismiss = () => {
    try {
      window.localStorage.setItem(KYC_ONBOARDED_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  const startWizard = (mode: 'new' | 'import') => {
    dismiss()
    navigate('/dashboard/kyc', { state: { openWizard: mode } })
  }
  const later = () => {
    dismiss()
    navigate('/dashboard/kyc')
  }

  return (
    <div
      data-screen-label="KYC — Première ouverture"
      style={{
        position: 'relative',
        background: sp.pageBg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes kobUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: no-preference) {
          .kobIn3 { animation: kobUp .5s .16s cubic-bezier(.2,.8,.2,1) both; }
        }
      `}</style>

      <SugarTopNav active={'kyc' as SugarScreenId} t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} dark={dark} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="kyc" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          <div
            style={{
              position: 'relative',
              height: '100%',
              borderRadius: 26,
              overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`,
              boxShadow: sp.shadow,
              background: sp.pageBg,
              minHeight: 0,
            }}
          >
            {/* Cover KYC (PNG complète, aplatie — lockup + halo garantis) */}
            <img
              src="/kyc/kyc-cover.png"
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
            />
            {/* Sur-impression CTA, ancrée en bas */}
            <div
              className="kobIn3"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 104,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '0 24px',
                zIndex: 2,
              }}
            >
              <button
                onClick={() => startWizard('new')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  height: 44,
                  padding: '0 10px 0 22px',
                  borderRadius: 999,
                  background: '#FFFFFF',
                  color: '#0B0C0E',
                  border: 0,
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 26px rgba(0,0,0,0.32), 0 0 0 5px rgba(255,255,255,0.08)',
                }}
              >
                Ouvrir mon premier dossier
                <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: '#0B0C0E' }}>
                  <ArrowGlyph color="#FFFFFF" />
                </span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => startWizard('import')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.10)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.22)',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  Importer
                </button>
                <button
                  onClick={later}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.62)',
                    padding: 0,
                  }}
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
