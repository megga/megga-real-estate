// MEGGA CRM Sugar v2 — Settings Sécurité — SSO Methods Card (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step4-sso.jsx` (SSOConnectionsCard + SSO_OAuthModal).
// Carte « Méthodes de connexion » (Google / Microsoft / Facebook) + 3 modales OAuth simulées.

import { useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

// ─── Logos officiels (multi-color, taille variable) ───────────────────────
function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function MsLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

function FbLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <path
        fill="#1877F2"
        d="M36 18C36 8.06 27.94 0 18 0S0 8.06 0 18c0 8.98 6.58 16.43 15.19 17.78V23.2h-4.57V18h4.57v-3.97c0-4.51 2.69-7 6.8-7 1.97 0 4.03.35 4.03.35v4.43H23.7c-2.24 0-2.93 1.39-2.93 2.81V18h5l-.8 5.2h-4.2v12.58C29.42 34.43 36 26.98 36 18Z"
      />
      <path
        fill="#fff"
        d="M25 23.2 25.8 18h-5v-3.38c0-1.42.7-2.81 2.93-2.81h2.32V7.38s-2.06-.35-4.03-.35c-4.11 0-6.8 2.49-6.8 7V18h-4.57v5.2h4.57v12.58a18.13 18.13 0 0 0 5.61 0V23.2H25Z"
      />
    </svg>
  )
}

// ─── Petites icônes (locales — proto step4-sso a son propre icon set) ─────
type SsoIconName =
  | 'check' | 'x' | 'lock' | 'shield' | 'info' | 'arrowR'
  | 'plus' | 'mail' | 'user' | 'calendar' | 'photo' | 'logout'

const SSO_PATHS: Record<SsoIconName, ReactNode> = {
  check: <path d="m5 13 4 4 10-12" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  shield: <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  arrowR: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="m4 19 5-5 4 4 3-3 4 4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
}

interface SsoIconProps {
  name: SsoIconName
  size?: number
  stroke?: string
  sw?: number
}

function SsoIcon({ name, size = 16, stroke = 'currentColor', sw = 1.6 }: SsoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SSO_PATHS[name] || null}
    </svg>
  )
}

// ─── Définition des providers SSO ────────────────────────────────────────
type ProviderId = 'google' | 'microsoft' | 'facebook'

interface ProviderScope {
  icon?: SsoIconName
  label: string
}

interface ProviderDef {
  id: ProviderId
  name: string
  logo: ComponentType<{ size?: number }>
  brand: string
  domain: string
  consentTitle: string
  scopes: ProviderScope[]
}

const PROVIDERS: Record<ProviderId, ProviderDef> = {
  google: {
    id: 'google',
    name: 'Google',
    logo: GoogleG,
    brand: '#1A73E8',
    domain: 'accounts.google.com',
    consentTitle: 'MEGGA souhaite accéder à votre compte Google',
    scopes: [
      { icon: 'user', label: 'Voir vos informations personnelles, dont les informations publiques disponibles' },
      { icon: 'mail', label: "Voir l'adresse email principale de votre compte Google" },
    ],
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    logo: MsLogo,
    brand: '#0067B8',
    domain: 'login.microsoftonline.com',
    consentTitle: 'Autorisations demandées',
    scopes: [
      { label: 'Vous connecter et lire votre profil' },
      { label: "Conserver l'accès aux données auxquelles vous lui avez donné l'accès" },
    ],
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    logo: FbLogo,
    brand: '#1877F2',
    domain: 'facebook.com',
    consentTitle: 'MEGGA souhaite accéder à :',
    scopes: [
      { icon: 'user', label: 'Votre nom et photo de profil' },
      { icon: 'mail', label: 'Votre adresse email' },
    ],
  },
}

// ─── Boutons ─────────────────────────────────────────────────────────────
function ConnectBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 36,
        padding: '0 18px',
        borderRadius: 999,
        border: 0,
        background: hover ? SET.blackHover : SET.black,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: hover
          ? '0 8px 20px rgba(11,12,14,0.22)'
          : '0 4px 12px rgba(11,12,14,0.16)',
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

function DiscBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: 0,
        background: hover ? SET.cardSubtle : 'transparent',
        color: SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: `inset 0 0 0 1px ${SET.line}`,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Confirm déconnexion ─────────────────────────────────────────────────
const ghostBtnStyle = (): CSSProperties => ({
  height: 44,
  padding: '0 20px',
  borderRadius: 999,
  border: 0,
  background: 'transparent',
  color: SET.inkSoft,
  fontFamily: 'inherit',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
})

interface DisconnectConfirmProps {
  providerName: string
  onCancel: () => void
  onConfirm: () => void
}

function DisconnectConfirm({ providerName, onCancel, onConfirm }: DisconnectConfirmProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 24,
          padding: 32,
          maxWidth: 460,
          width: '92%',
          boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 20,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.3,
          }}
        >
          Déconnecter {providerName} ?
        </h3>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            color: SET.inkSoft,
            lineHeight: 1.55,
          }}
        >
          Vous ne pourrez plus vous connecter à MEGGA via {providerName}. Votre email + mot de
          passe restent actifs.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={ghostBtnStyle()}>
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 44,
              padding: '0 22px',
              borderRadius: 999,
              border: 0,
              background: SET.bad,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(239,68,68,0.30)',
            }}
          >
            Déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modale OAuth ────────────────────────────────────────────────────────
interface AccountChoice {
  email: string
  name: string
  initial: string
  color: string
}

interface SSOOAuthModalProps {
  providerId: ProviderId
  onCancel: () => void
  onComplete: (account: string) => void
}

function SSOOAuthModal({ providerId, onCancel, onComplete }: SSOOAuthModalProps) {
  const provider = PROVIDERS[providerId]
  const [step, setStep] = useState<'account' | 'consent' | 'loading'>('account')

  const accounts: AccountChoice[] =
    providerId === 'google'
      ? [
          { email: 'gregory@megga.ch', name: 'Grégory Lyonnet', initial: 'G', color: '#1A73E8' },
          { email: 'g.lyonnet@gmail.com', name: 'Grégory Lyonnet', initial: 'G', color: '#34A853' },
        ]
      : providerId === 'microsoft'
        ? [
            { email: 'gregory@megga.ch', name: 'Grégory Lyonnet', initial: 'G', color: '#0067B8' },
            { email: 'gregory@outlook.com', name: 'Grégory Lyonnet', initial: 'G', color: '#7FBA00' },
          ]
        : [
            { email: 'gregory.lyonnet@megga.ch', name: 'Grégory Lyonnet', initial: 'G', color: '#1877F2' },
          ]

  const [account, setAccount] = useState<AccountChoice | null>(null)

  const handleAllow = () => {
    if (!account) return
    setStep('loading')
    setTimeout(() => onComplete(account.email), 1100)
  }

  const Frame = ({ children }: { children: ReactNode }) => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '94vw',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
          fontFamily:
            providerId === 'facebook'
              ? '"Helvetica Neue", Helvetica, Arial, sans-serif'
              : '"Google Sans", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Browser-like chrome */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: '#F1F3F4',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: '#FF5F57',
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: '#FEBC2E',
              }}
            />
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: '#28C840',
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              height: 24,
              marginLeft: 6,
              background: '#fff',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              fontSize: 11,
              color: '#5F6368',
              fontWeight: 500,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
            }}
          >
            <SsoIcon name="lock" size={10} stroke="#5F6368" sw={2.2} />
            <span>{provider.domain}</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )

  if (step === 'loading') {
    const Logo = provider.logo
    return (
      <Frame>
        <div style={{ padding: '60px 28px', textAlign: 'center' }}>
          <div
            style={{
              marginBottom: 18,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Logo size={48} />
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '3px solid rgba(0,0,0,0.10)',
              borderTopColor: provider.brand,
              margin: '0 auto 16px',
              animation: 'setSpin .7s linear infinite',
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#202124',
            }}
          >
            Connexion à {provider.name}…
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: '#5F6368',
              marginTop: 6,
              fontWeight: 500,
            }}
          >
            Vérification des autorisations
          </div>
        </div>
      </Frame>
    )
  }

  if (step === 'account') {
    const Logo = provider.logo
    return (
      <Frame>
        <div style={{ padding: '32px 28px 24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Logo size={36} />
          </div>
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: 22,
              fontWeight: 500,
              color: '#202124',
              textAlign: 'center',
              letterSpacing: -0.2,
            }}
          >
            {providerId === 'facebook' ? 'Connectez-vous à Facebook' : 'Choisir un compte'}
          </h2>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: 13.5,
              color: '#5F6368',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            pour continuer vers{' '}
            <strong style={{ color: '#202124', fontWeight: 500 }}>MEGGA</strong>
          </p>
          <div
            style={{
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {accounts.map((a, i) => (
              <button
                key={a.email}
                onClick={() => {
                  setAccount(a)
                  setStep('consent')
                }}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: 0,
                  background: '#fff',
                  borderTop: i > 0 ? '1px solid rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#F8F9FA'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#fff'
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: a.color,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 15,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {a.initial}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: '#202124',
                    }}
                  >
                    {a.name}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      color: '#5F6368',
                      marginTop: 2,
                    }}
                  >
                    {a.email}
                  </span>
                </span>
              </button>
            ))}
            <button
              style={{
                width: '100%',
                padding: '14px 16px',
                border: 0,
                background: '#fff',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: '#F1F3F4',
                  color: '#5F6368',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SsoIcon name="plus" size={16} stroke="#5F6368" />
              </span>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: '#202124',
                }}
              >
                Utiliser un autre compte
              </span>
            </button>
          </div>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 11.5,
              color: '#5F6368',
              fontWeight: 500,
              lineHeight: 1.55,
              textAlign: 'left',
            }}
          >
            Avant d'utiliser cette application, vous pouvez consulter ses{' '}
            <span style={{ color: provider.brand, cursor: 'pointer' }}>
              règles de confidentialité
            </span>{' '}
            et ses{' '}
            <span style={{ color: provider.brand, cursor: 'pointer' }}>
              conditions d'utilisation
            </span>
            .
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            background: '#fff',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: '0 22px',
              borderRadius: 4,
              border: 0,
              background: 'transparent',
              color: provider.brand,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        </div>
      </Frame>
    )
  }

  // step === 'consent'
  if (!account) return null
  const Logo = provider.logo
  return (
    <Frame>
      <div style={{ padding: '28px 28px 22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Logo size={32} />
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px 5px 5px',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)',
            background: '#fff',
            margin: '0 auto 18px',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: account.color,
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {account.initial}
          </span>
          <span
            style={{ fontSize: 12, color: '#202124', fontWeight: 500 }}
          >
            {account.email}
          </span>
        </div>
        <h2
          style={{
            margin: '0 0 10px',
            fontSize: 19,
            fontWeight: 500,
            color: '#202124',
            textAlign: 'center',
            letterSpacing: -0.2,
            lineHeight: 1.3,
          }}
        >
          {provider.consentTitle}
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 12.5,
            color: '#5F6368',
            textAlign: 'center',
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          En cliquant sur Autoriser, vous permettez à{' '}
          <strong style={{ color: '#202124', fontWeight: 600 }}>MEGGA</strong>{' '}
          d'utiliser ces informations conformément à ses règles de confidentialité.
        </p>
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 10,
            padding: '4px 0',
            marginBottom: 18,
          }}
        >
          {provider.scopes.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                borderTop: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: '#F1F3F4',
                  color: '#5F6368',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SsoIcon name={s.icon || 'check'} size={14} stroke="#5F6368" sw={2} />
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: '#202124',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  paddingTop: 5,
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: '#5F6368',
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Vous pourrez révoquer cet accès à tout moment depuis les paramètres de votre
          compte {provider.name}.
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          background: '#fff',
        }}
      >
        <button
          onClick={() => setStep('account')}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 4,
            border: 0,
            background: 'transparent',
            color: provider.brand,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>
        <button
          onClick={handleAllow}
          style={{
            height: 36,
            padding: '0 22px',
            borderRadius: 4,
            border: 0,
            background: provider.brand,
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 2px 6px ${provider.brand}40`,
          }}
        >
          Autoriser
        </button>
      </div>
    </Frame>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  CARTE — Méthodes de connexion
// ═══════════════════════════════════════════════════════════════════════
interface ConnState {
  connected: boolean
  email?: string
  since?: string
}

export function SSOConnectionsCard() {
  const [conns, setConns] = useState<Record<ProviderId, ConnState>>({
    google: { connected: true, email: 'gregory@megga.ch', since: 'Mars 2024' },
    microsoft: { connected: false },
    facebook: { connected: false },
  })
  const [oauthFor, setOauthFor] = useState<ProviderId | null>(null)
  const [confirmDisc, setConfirmDisc] = useState<ProviderId | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const connect = (id: ProviderId, account: string) => {
    setConns(c => ({
      ...c,
      [id]: { connected: true, email: account, since: "À l'instant" },
    }))
    setOauthFor(null)
    setToast(`${PROVIDERS[id].name} connecté`)
    setTimeout(() => setToast(null), 2400)
  }
  const disconnect = (id: ProviderId) => {
    setConns(c => ({ ...c, [id]: { connected: false } }))
    setConfirmDisc(null)
    setToast(`${PROVIDERS[id].name} déconnecté`)
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <>
      <div
        style={{
          background: SET.card,
          borderRadius: 24,
          boxShadow: SET.shadow,
        }}
      >
        <div style={{ padding: '28px 28px 0' }}>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: 17,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.3,
            }}
          >
            Méthodes de connexion
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: SET.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            Connectez un compte tiers pour vous identifier en un clic. Votre email + mot de
            passe restent toujours actifs.
          </p>
        </div>

        <div style={{ padding: '18px 28px 22px' }}>
          {/* Email + mot de passe — méthode principale toujours active */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 14,
              background: SET.cardSubtle,
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: SET.black,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SsoIcon name="lock" size={17} stroke="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: -0.1,
                }}
              >
                Email + mot de passe
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: SET.muted,
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                gregory@megga.ch · Méthode principale
              </div>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 24,
                padding: '0 10px',
                borderRadius: 999,
                background: `${SET.ok}18`,
                color: SET.ok,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.1,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: SET.ok,
                }}
              />
              Active
            </span>
          </div>

          {/* Providers SSO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.values(PROVIDERS).map(p => {
              const conn = conns[p.id]
              const Logo = p.logo
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: '#fff',
                    boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: '#fff',
                      boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Logo size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: SET.ink,
                        letterSpacing: -0.1,
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: SET.muted,
                        fontWeight: 500,
                        marginTop: 2,
                      }}
                    >
                      {conn.connected
                        ? `${conn.email} · Connecté ${
                            conn.since?.toLowerCase().startsWith('à')
                              ? conn.since
                              : `depuis ${conn.since}`
                          }`
                        : `Connectez-vous avec votre compte ${p.name}`}
                    </div>
                  </div>
                  {conn.connected ? (
                    <>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          height: 24,
                          padding: '0 10px',
                          borderRadius: 999,
                          background: `${SET.ok}18`,
                          color: SET.ok,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.1,
                          marginRight: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 999,
                            background: SET.ok,
                          }}
                        />
                        Connecté
                      </span>
                      <DiscBtn onClick={() => setConfirmDisc(p.id)}>Déconnecter</DiscBtn>
                    </>
                  ) : (
                    <ConnectBtn onClick={() => setOauthFor(p.id)}>Connecter</ConnectBtn>
                  )}
                </div>
              )
            })}
          </div>

          {/* Note de sécurité */}
          <div
            style={{
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 12,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <SsoIcon name="info" size={14} stroke={SET.muted} sw={2} />
            <div
              style={{
                fontSize: 11.5,
                color: SET.inkSoft,
                fontWeight: 500,
                lineHeight: 1.55,
              }}
            >
              MEGGA reçoit uniquement votre nom, email et photo de profil. Aucun mot de passe
              n'est partagé. Vous pouvez révoquer l'accès à tout moment depuis votre compte{' '}
              {Object.values(PROVIDERS)
                .map(p => p.name)
                .join(', ')}{' '}
              ou ici.
            </div>
          </div>
        </div>
      </div>

      {oauthFor && (
        <SSOOAuthModal
          providerId={oauthFor}
          onCancel={() => setOauthFor(null)}
          onComplete={account => connect(oauthFor, account)}
        />
      )}

      {confirmDisc && (
        <DisconnectConfirm
          providerName={PROVIDERS[confirmDisc].name}
          onCancel={() => setConfirmDisc(null)}
          onConfirm={() => disconnect(confirmDisc)}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 300,
            background: SET.black,
            color: '#fff',
            borderRadius: 999,
            padding: '12px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 24px 60px rgba(11,12,14,0.30)',
            fontSize: 13.5,
            fontWeight: 600,
            animation: 'setSlideUp .3s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              background: SET.ok,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SsoIcon name="check" size={12} stroke="#fff" sw={3} />
          </span>
          {toast}
        </div>
      )}
    </>
  )
}
