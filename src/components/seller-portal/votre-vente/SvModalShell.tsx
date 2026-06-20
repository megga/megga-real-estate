// MEGGA — Espace vendeur — coquille de modal Sugar Pure (overlay + carte centrée).
// createPortal(document.body), verrou de scroll, fermeture Échap / clic backdrop.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useSP } from './theme'
import { SvIcon } from './icons'

export default function SvModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const SP = useSP()
  const { t } = useTranslation('common')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15,23,42,0.32)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        animation: 'sgFadeUp .3s ease both',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 540,
          maxHeight: 'calc(100vh - 56px)',
          overflowY: 'auto',
          background: SP.card,
          borderRadius: 28,
          padding: '34px 36px 32px',
          boxShadow: '0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)',
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <button
          onClick={onClose}
          aria-label={t('portal.modal.close')}
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            width: 34,
            height: 34,
            borderRadius: 999,
            border: 0,
            background: SP.cardSubtle,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            color: SP.muted,
            transition: 'background .18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = SP.closeHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = SP.cardSubtle)}
        >
          <SvIcon name="x" size={17} stroke={SP.inkSoft} sw={2} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}
