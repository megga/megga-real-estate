import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import Pressable from '@/components/ui/Pressable'
import { useMobileTokens } from '../useMobileTokens'

interface MobileHeaderBackProps {
  title?: string
  /** Défaut : `navigate(-1)`. */
  onBack?: () => void
  right?: ReactNode
}

/** En-tête des vues détail : bouton-retour rond + titre, sans barre d'onglets. */
export default function MobileHeaderBack({ title, onBack, right }: MobileHeaderBackProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const { tk } = useMobileTokens()
  const handleBack = onBack ?? (() => navigate(-1))

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 'calc(env(safe-area-inset-top) + 12px) 16px 12px',
        background: tk.headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Pressable
        onClick={handleBack}
        aria-label={t('actions.back')}
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          background: tk.card,
          boxShadow: tk.shadowSm,
          color: tk.ink,
          border: 0,
          cursor: 'pointer',
        }}
      >
        <MEIcon name="chevron-left" size={20} color={tk.ink} />
      </Pressable>
      {title ? (
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: tk.ink }}>
          {title}
        </h1>
      ) : null}
      <div style={{ flex: 1 }} />
      {right}
    </header>
  )
}
