// Splash universel affiché par <PasswordGate /> tant que le visiteur n'a pas
// saisi le mot de passe d'accès interne.
//
// Composition :
//   - PxComingSoonHero : page publique Coming Soon Property X (Figma 9552:21496),
//     avec form Subscribe branché sur la table coming_soon_subscribers.
//   - Footer minimal (logo + copyright + lien "Accès équipe")
//   - PasswordModal au clic sur "Accès équipe" → onSuccess révèle le site.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX, PxLogo } from '@/components/propertyx'
import PxComingSoonHero from '@/components/propertyx/sections/PxComingSoonHero'
import PasswordModal from './PasswordModal'

interface ComingSoonSplashProps {
  verify: (password: string) => boolean
  onUnlock: () => void
}

export default function ComingSoonSplash({ verify, onUnlock }: ComingSoonSplashProps) {
  const { t } = useTranslation('comingSoon')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
    }}>
      <PxComingSoonHero />

      {/* Footer minimal splash — logo + copyright + accès équipe */}
      <footer style={{
        width: '100%',
        maxWidth: PX.containerDesktop,
        margin: '0 auto',
        padding: '32px 24px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <PxLogo variant="dark" form="text" size="sm" to="/" />

        <p style={{
          margin: 0,
          fontFamily: PX.font.display,
          fontSize: 13,
          fontWeight: 400,
          lineHeight: 1.4,
          color: PX.neutral500,
          textAlign: 'center',
        }}>
          {t('copyright')}
        </p>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            background: 'transparent',
            border: 0,
            padding: 4,
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.4,
            color: PX.neutral400,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          }}
        >
          {t('teamAccess')}
        </button>
      </footer>

      {modalOpen && (
        <PasswordModal
          onClose={() => setModalOpen(false)}
          verify={verify}
          onSuccess={onUnlock}
        />
      )}
    </div>
  )
}
