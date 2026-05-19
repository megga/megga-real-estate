// Modal "Accès interne" ouvert depuis le splash Coming Soon.
// Saisie d'un mot de passe partagé pour révéler le site complet.
//
// Design tokens : Property X (neutral200 card, neutral700 ink, pill inputs).
// Pattern : createPortal vers document.body + z-[100], conforme CLAUDE.md.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PX } from '@/components/propertyx'

interface PasswordModalProps {
  onClose: () => void
  verify: (password: string) => boolean
  onSuccess: () => void
}

// Note: monté/démonté par le parent (`{modalOpen && <PasswordModal ... />}`)
// pour repartir avec un state propre à chaque ouverture.
export default function PasswordModal({ onClose, verify, onSuccess }: PasswordModalProps) {
  const { t } = useTranslation('comingSoon')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (verify(password)) {
      onSuccess()
      onClose()
    } else {
      setError(true)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="px-pwd-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(20, 22, 28, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: PX.font.display,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: PX.neutral200,
          borderRadius: PX.radius.large,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.24)',
        }}
      >
        <h2
          id="px-pwd-modal-title"
          style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: '-0.66px',
            color: PX.neutral700,
            textAlign: 'center',
          }}
        >
          {t('modalTitle')}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(false)
            }}
            placeholder={t('modalPlaceholder')}
            aria-label={t('modalPlaceholder')}
            autoComplete="current-password"
            style={{
              width: '100%',
              height: 52,
              padding: '0 20px',
              background: PX.neutral300,
              border: error ? `1px solid #FCA5A5` : '1px solid transparent',
              borderRadius: PX.radius.pill,
              outline: 'none',
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              textAlign: 'center',
            }}
          />

          {error && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 13,
                fontWeight: 400,
                color: '#DC2626',
                textAlign: 'center',
              }}
            >
              {t('modalError')}
            </p>
          )}

          <button
            type="submit"
            disabled={password.length === 0}
            style={{
              width: '100%',
              height: 52,
              background: PX.neutral700,
              border: 0,
              borderRadius: PX.radius.pill,
              color: PX.neutral100,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              cursor: password.length === 0 ? 'not-allowed' : 'pointer',
              opacity: password.length === 0 ? 0.5 : 1,
              transition: 'opacity 120ms ease',
            }}
          >
            {t('modalSubmit')}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
