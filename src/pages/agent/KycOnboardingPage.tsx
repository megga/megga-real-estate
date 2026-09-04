// MEGGA CRM — KYC · Onboarding « Première ouverture »
// Port fidèle de `CRMScreenKycOnboarding` (crm-kyc-onboarding.jsx) : bento plein
// écran avec la cover PNG (lockup KYC aplati) + sur-impression CTA. Monté dans la
// chrome CRM (CrmSidebar). Route : /dashboard/kyc/bienvenue.
//
// Gating (empty-state) : posé par la page hôte (KycPage) — flag
// localStorage `megga.kyc.onboarded` + 0 dossier. Les CTA posent le flag puis
// naviguent vers le pager (avec un state `openWizard` pour ouvrir le wizard).

import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { CrmSidebar } from '@/components/crm/CrmSidebar'
import { crmPalette } from '@/components/crm/tokens'
import { markKycOnboarded } from '@/lib/kycOnboarding'
import { readCrmDark } from '@/lib/crmDark'


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
    return readCrmDark()
  })
  const sp = useMemo(() => crmPalette(dark), [dark])

  const dismiss = () => markKycOnboarded()
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
        fontFamily: 'var(--crm-font)',
        color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <style>{`
        @keyframes kobUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: no-preference) {
          .kobIn3 { animation: kobUp .5s .16s cubic-bezier(.2,.8,.2,1) both; }
        }
      `}</style>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmSidebar active="kyc" sp={sp} dark={dark} setDark={setDark} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 24, paddingBottom: 22 }}>
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
                  color: MXC_COLOR.n100,
                  border: 0,
                  fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-md)',
                  fontWeight: 600,
                  letterSpacing: '-0.2px',
                  cursor: 'pointer',
                  boxShadow: '0 8px 26px rgba(0,0,0,0.32), 0 0 0 5px rgba(255,255,255,0.08)',
                }}
              >
                Ouvrir mon premier dossier
                <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 999, background: MXC_COLOR.n100 }}>
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
                    fontSize: 'var(--crm-text-sm)',
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
                    fontSize: 'var(--crm-text-sm)',
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
