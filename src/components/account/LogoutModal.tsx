import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  open: boolean
  onClose: () => void
  redirectTo?: string
}

interface UserSnapshot {
  name: string
  email: string
  initials: string
}

export default function LogoutModal({ open, onClose, redirectTo = '/' }: Props) {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  const [phase, setPhase] = useState<'loading' | 'done'>('loading')
  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null)

  useEffect(() => {
    if (!open) return

    const name = profile?.full_name || user?.email || ''
    const email = user?.email || ''
    const initials = name
      ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
      : (email[0] || 'U').toUpperCase()

    setPhase('loading')
    setSnapshot({ name, email, initials })

    const t1 = setTimeout(() => {
      void signOut()
    }, 900)
    const t2 = setTimeout(() => {
      setPhase('done')
    }, 1100)
    const t3 = setTimeout(() => {
      onClose()
      navigate(redirectTo)
    }, 1900)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [open, signOut, navigate, onClose, redirectTo, user, profile])

  if (!open) return null

  const display = snapshot ?? { name: '', email: '', initials: '' }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(14,20,16,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'megga-account-fade-in 0.18s ease-out',
        fontFamily: T.fontStack,
      }}
    >
      <style>{`
        @keyframes megga-account-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes megga-account-modal-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes megga-account-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        aria-labelledby="account-logout-title"
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 22,
          boxShadow: '0 24px 80px -20px rgba(14,20,16,0.45)',
          overflow: 'hidden',
          animation: 'megga-account-modal-in 0.2s ease-out',
          padding: '36px 32px 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {phase === 'loading' ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: `3px solid ${T.accentSoft}`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '3px solid transparent',
                  borderTopColor: T.accent,
                  animation: 'megga-account-spin 0.9s linear infinite',
                }}
              />
              <div style={{ color: T.accent, display: 'inline-flex' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
                  <path d="M10 17l-5-5 5-5" />
                  <path d="M5 12h11" />
                </svg>
              </div>
            </>
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: T.accent,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'megga-account-modal-in 0.25s ease-out',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l3.5 3.5L13 5" />
              </svg>
            </div>
          )}
        </div>

        <h2
          id="account-logout-title"
          style={{
            margin: 0,
            fontFamily: T.fontStack,
            fontSize: 20,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -0.4,
            lineHeight: 1.25,
          }}
        >
          {phase === 'loading' ? 'Déconnexion en cours…' : 'Vous êtes déconnecté·e'}
        </h2>

        <p
          style={{
            margin: '10px auto 0',
            maxWidth: 320,
            fontFamily: T.fontStack,
            fontSize: 13.5,
            color: T.muted,
            lineHeight: 1.55,
            letterSpacing: -0.05,
          }}
        >
          {phase === 'loading'
            ? 'Nous fermons votre session MEGGA en toute sécurité.'
            : 'À bientôt — redirection vers la page d’accueil.'}
        </p>

        {display.name && (
          <div
            style={{
              marginTop: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px 8px 8px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#FAFBFD',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: T.accent,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 800,
                flex: '0 0 auto',
              }}
            >
              {display.initials}
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: T.ink,
                  lineHeight: 1.1,
                }}
              >
                {display.name}
              </div>
              {display.email && (
                <div
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 11,
                    fontWeight: 500,
                    color: T.muted,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 220,
                  }}
                >
                  {display.email}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
