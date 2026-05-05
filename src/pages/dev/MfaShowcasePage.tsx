// MEGGA — Demo route pour visualiser tous les modaux MFA en isolation.
// Accessible à /dev/mfa — pas de garde auth.

import { useState } from 'react'
import {
  AgencyMFAPolicyCard, MFABackupCodesModal, MFAChallengeModal,
  MFAEnrollModal, MFAResetAgentModal,
} from '@/components/auth/MfaModals'
import {
  MFAAdminEmailPreview, MFALostDeviceModal, MFAResetLandingScreen,
} from '@/components/auth/MfaResetFlow'

type ModalKey = null | 'enroll' | 'enroll-enforced' | 'challenge' | 'reset-agent' | 'backup' | 'lost' | 'landing' | 'email'

export default function MfaShowcasePage() {
  const [open, setOpen] = useState<ModalKey>(null)

  const triggers: { key: ModalKey; label: string; desc: string }[] = [
    { key: 'enroll', label: 'MFAEnrollModal', desc: 'Enrôlement TOTP en 3 étapes (QR / OTP verify / backup codes)' },
    { key: 'enroll-enforced', label: 'MFAEnrollModal · enforced', desc: 'Enrôlement obligatoire (sans bouton Annuler)' },
    { key: 'challenge', label: 'MFAChallengeModal', desc: 'Challenge OTP au login + fallback code de secours' },
    { key: 'reset-agent', label: 'MFAResetAgentModal', desc: 'Admin réinitialise la 2FA (confirm by typing name)' },
    { key: 'backup', label: 'MFABackupCodesModal', desc: 'Régénération des codes de secours' },
    { key: 'lost', label: 'MFALostDeviceModal', desc: 'Self-service depuis login (« j\'ai perdu mon téléphone »)' },
    { key: 'landing', label: 'MFAResetLandingScreen', desc: 'Landing après clic du lien email admin' },
    { key: 'email', label: 'MFAAdminEmailPreview', desc: "Aperçu de l'email envoyé à l'agent" },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F6F8',
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: 60,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <div
            style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.09em',
              textTransform: 'uppercase', color: '#7A8088', marginBottom: 8,
            }}
          >
            Demo · MFA / 2FA TOTP
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 700, color: '#0B0C0E', letterSpacing: -0.8 }}>
            MFA modals showcase
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#3A3D44', lineHeight: 1.6, maxWidth: 720 }}>
            Port 1:1 des protos <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>crm-mfa-modals.jsx</code>
            {' '}+ <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>crm-mfa-reset-flow.jsx</code> du
            bundle. Cliquez chaque bouton pour ouvrir la modale correspondante.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {triggers.map(t => (
            <button
              key={t.key as string}
              onClick={() => setOpen(t.key)}
              style={{
                textAlign: 'left',
                padding: '18px 18px',
                borderRadius: 16, border: 0,
                background: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'transform .15s, box-shadow .15s',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(11,12,14,0.10)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.04)'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0B0C0E', letterSpacing: -0.2 }}>
                {t.label}
              </div>
              <div style={{ fontSize: 12, color: '#7A8088', fontWeight: 500, lineHeight: 1.5 }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>

        <div>
          <div
            style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.09em',
              textTransform: 'uppercase', color: '#7A8088', marginBottom: 12,
            }}
          >
            Carte settings agence (inline)
          </div>
          <AgencyMFAPolicyCard />
        </div>
      </div>

      {open === 'enroll' && (
        <MFAEnrollModal onClose={() => setOpen(null)} onDone={() => alert('Enrôlement terminé !')} />
      )}
      {open === 'enroll-enforced' && (
        <MFAEnrollModal onClose={() => setOpen(null)} enforced onDone={() => alert('Enrôlement (forcé) terminé')} />
      )}
      {open === 'challenge' && (
        <MFAChallengeModal
          onClose={() => setOpen(null)}
          onSuccess={() => alert('Challenge passé')}
          onLostDevice={() => setOpen('lost')}
        />
      )}
      {open === 'reset-agent' && (
        <MFAResetAgentModal
          agent={{ id: 'a4', name: 'Léa Vuilleumier', email: 'lea.vuilleumier@megga.ch' }}
          onClose={() => setOpen(null)}
          onConfirm={() => alert('2FA réinitialisée')}
        />
      )}
      {open === 'backup' && <MFABackupCodesModal onClose={() => setOpen(null)} />}
      {open === 'lost' && (
        <MFALostDeviceModal onClose={() => setOpen(null)} onSubmitted={() => alert('Demande envoyée')} />
      )}
      {open === 'landing' && (
        <MFAResetLandingScreen onContinue={() => { alert('Continuer vers MFAEnrollModal'); setOpen('enroll') }} />
      )}
      {open === 'email' && <MFAAdminEmailPreview onClose={() => setOpen(null)} />}
    </div>
  )
}
