// MEGGA CRM Sugar v2 — Settings Integrations section (Tier 3.k)
// 1:1 port from `crm-screen-settings-step3.jsx` (SettingsIntegrationsSection + helpers).
// Note : DocuSignAuthFlow + SkribbleAuthFlow du proto (~750l combinés) sont remplacés
// par un loading modal générique — l'auth flow custom de chaque provider sera porté dans
// une PR future si nécessaire (le UX est équivalent pour le démo : connexion → toast).

import { useState, type ReactNode } from 'react'
import { SectionHeader, SetGhostBtn, SetIcon, Toast } from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

// ─── Logos officiels ─────────────────────────────────────────────────────
function GoogleG({ size = 18 }: { size?: number }) {
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

function MsLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

// ─── INTEGRATIONS data ───────────────────────────────────────────────────
type ProviderId =
  | 'google'
  | 'microsoft'
  | 'docusign'
  | 'skribble'
  | 'iazi'
  | 'realadvisor'
  | 'six'
  | 'onfido'
  | 'veriff'
  | 'whatsapp'
  | 'zapier'

type Category =
  | 'Productivité'
  | 'Signature'
  | 'Données marché'
  | 'Bancaire'
  | 'KYC / LBA'
  | 'Messagerie'
  | 'Automatisation'

interface IntegrationServices {
  calendar?: boolean
  gmail?: boolean
  mail?: boolean
  contacts?: boolean
  sign?: boolean
  attach?: boolean
  status?: boolean
  send?: boolean
  template?: boolean
  webhook?: boolean
}

interface Integration {
  id: string
  category: Category
  provider?: ProviderId
  name: string
  desc: string
  logoBg: string
  logo?: ReactNode
  logoText?: string
  logoColor?: string
  recommended?: boolean
  premium?: boolean
  connected: boolean
  account?: string
  connectedSince?: string
  services?: IntegrationServices
}

const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'google',
    category: 'Productivité',
    provider: 'google',
    name: 'Compte Google',
    desc: 'Synchronisez Google Calendar, Gmail et Contacts en un seul branchement OAuth.',
    logoBg: '#FFFFFF',
    logo: <GoogleG size={22} />,
    connected: true,
    account: 'gregory@megga.ch',
    connectedSince: 'Mars 2024',
    services: { calendar: true, gmail: true, contacts: false },
  },
  {
    id: 'microsoft',
    category: 'Productivité',
    provider: 'microsoft',
    name: 'Compte Microsoft 365',
    desc: "Outlook Calendar, Outlook Mail et carnet d'adresses Exchange.",
    logoBg: '#FFFFFF',
    logo: <MsLogo size={22} />,
    connected: false,
    services: { calendar: false, mail: false, contacts: false },
  },
  {
    id: 'sign-docusign',
    category: 'Signature',
    provider: 'docusign',
    name: 'DocuSign',
    desc: 'Signature électronique conforme eIDAS pour mandats et offres.',
    logoBg: '#FFCC22',
    logoText: 'D',
    logoColor: '#0B0C0E',
    connected: false,
  },
  {
    id: 'sign-skribble',
    category: 'Signature',
    provider: 'skribble',
    name: 'Skribble',
    desc: 'Signature qualifiée suisse, conformité ZertES.',
    logoBg: '#0B0C0E',
    logoText: 'S',
    recommended: true,
    connected: false,
  },
  {
    id: 'mls-iazi',
    category: 'Données marché',
    name: 'IAZI Pulse',
    desc: 'Comparables et estimations en temps réel sur tout le marché suisse.',
    logoBg: '#003B71',
    logoText: 'IZ',
    connected: true,
    account: 'Licence Pro',
    connectedSince: 'Septembre 2023',
  },
  {
    id: 'mls-realadvisor',
    category: 'Données marché',
    name: 'RealAdvisor',
    desc: 'Estimations automatisées et lead generation.',
    logoBg: '#FF5A1F',
    logoText: 'RA',
    connected: false,
  },
  {
    id: 'bank-six',
    category: 'Bancaire',
    name: 'SIX Payment',
    desc: 'Encaissements directs des arrhes via QR-bill.',
    logoBg: '#E2001A',
    logoText: '6',
    connected: false,
    premium: true,
  },
  {
    id: 'id-onfido',
    category: 'KYC / LBA',
    name: 'Onfido',
    desc: "Vérification d'identité et anti-blanchiment automatisés.",
    logoBg: '#3D38FA',
    logoText: 'O',
    connected: true,
    account: 'Pack Diligence',
    connectedSince: 'Octobre 2024',
  },
  {
    id: 'id-veri',
    category: 'KYC / LBA',
    name: 'Veriff',
    desc: "Vérification d'identité avec biométrie.",
    logoBg: '#241B5C',
    logoText: 'V',
    connected: false,
  },
  {
    id: 'comm-whatsapp',
    category: 'Messagerie',
    name: 'WhatsApp Business',
    desc: 'Conversations clients dans le CRM, modèles certifiés.',
    logoBg: '#25D366',
    logoText: 'W',
    recommended: true,
    connected: false,
  },
  {
    id: 'data-zapier',
    category: 'Automatisation',
    name: 'Zapier',
    desc: 'Connectez plus de 5000 services à votre CRM.',
    logoBg: '#FF4F00',
    logoText: 'Z',
    connected: false,
  },
]

// ─── IntegrationLogo ─────────────────────────────────────────────────────
interface IntegrationLogoProps {
  item: Integration
  size?: number
}

function IntegrationLogo({ item, size = 44 }: IntegrationLogoProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: item.logoBg,
        color: item.logoColor || '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.4,
        fontWeight: 800,
        letterSpacing: -0.3,
        flexShrink: 0,
        boxShadow:
          '0 4px 12px rgba(15,23,42,0.10), inset 0 0 0 1px rgba(0,0,0,0.04)',
      }}
    >
      {item.logo || item.logoText}
    </div>
  )
}

// ─── IntegrationCard ─────────────────────────────────────────────────────
interface IntegrationCardProps {
  item: Integration
  onClick: () => void
  onConnect: () => void
  onDisconnect: () => void
  connecting: boolean
}

function IntegrationCard({
  item,
  onClick,
  onConnect,
  onDisconnect,
  connecting,
}: IntegrationCardProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: SET.card,
        borderRadius: 20,
        padding: 22,
        boxShadow: hover ? SET.shadowLg : SET.shadow,
        cursor: 'pointer',
        transition: 'all .2s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 184,
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        {item.connected ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 24,
              padding: '0 10px',
              borderRadius: 999,
              background: SET.ok,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: -0.05,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: '#fff',
              }}
            />
            Connecté
          </span>
        ) : item.recommended ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 24,
              padding: '0 10px',
              borderRadius: 999,
              background: SET.cardSubtle,
              color: SET.ink,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: -0.05,
            }}
          >
            <SetIcon name="sparkle" size={10} stroke={SET.ink} sw={2.4} />
            Recommandé
          </span>
        ) : item.premium ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 24,
              padding: '0 10px',
              borderRadius: 999,
              background: 'rgba(124,58,237,0.10)',
              color: '#7C3AED',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: -0.05,
            }}
          >
            Premium
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IntegrationLogo item={item} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: SET.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {item.category}
          </div>
          <div
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.2,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </div>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: SET.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.desc}
      </p>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 12,
          borderTop: `1px solid ${SET.line}`,
        }}
      >
        {item.connected ? (
          <>
            <div style={{ minWidth: 0, marginRight: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  color: SET.ink,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.account}
              </div>
              <div style={{ fontSize: 11, color: SET.muted, fontWeight: 500 }}>
                Depuis {item.connectedSince}
              </div>
            </div>
            <button
              onClick={e => {
                e.stopPropagation()
                onDisconnect()
              }}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                background: SET.cardSubtle,
                color: SET.err,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Déconnecter
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: SET.muted, fontWeight: 500 }}>
              Non connecté
            </span>
            <button
              onClick={e => {
                e.stopPropagation()
                onConnect()
              }}
              disabled={connecting}
              style={{
                height: 32,
                padding: '0 14px',
                borderRadius: 999,
                border: 0,
                background: SET.black,
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? (
                <>
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 999,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      animation: 'setSpin .7s linear infinite',
                    }}
                  />
                  Connexion…
                </>
              ) : (
                <>
                  <SetIcon name="check" size={11} stroke="#fff" sw={2.4} />
                  Connecter
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── OAuthFlow Google/Microsoft (DocuSign/Skribble simulés via stub) ─────
type OAuthScope = 'calendar' | 'gmail' | 'mail' | 'contacts'

interface OAuthFlowProps {
  item: Integration
  onCancel: () => void
  onComplete: (account: string, scopes: string[]) => void
}

function OAuthFlow({ item, onCancel, onComplete }: OAuthFlowProps) {
  const isGoogle = item.provider === 'google'
  const isCustomProvider = item.provider === 'docusign' || item.provider === 'skribble'

  // DocuSign + Skribble stub : loading modal direct + auto-complete
  // (les flows custom officiels du proto sont remplacés par cette version simplifiée)
  if (isCustomProvider) {
    return <ProviderLoadingStub item={item} onCancel={onCancel} onComplete={onComplete} />
  }

  const accentBlue = isGoogle ? '#1A73E8' : '#0067B8'
  const [step, setStep] = useState<'choose' | 'consent' | 'loading'>('choose')
  const [account, setAccount] = useState<{
    email: string
    name: string
    initial: string
    color: string
  } | null>(null)
  const [scopes, setScopes] = useState<OAuthScope[]>(
    isGoogle ? ['calendar', 'gmail'] : ['calendar', 'mail'],
  )

  const accounts = isGoogle
    ? [
        { email: 'gregory@megga.ch', name: 'Grégory Beuret', initial: 'G', color: '#1A73E8' },
        { email: 'g.beuret@gmail.com', name: 'Grégory Beuret', initial: 'G', color: '#34A853' },
      ]
    : [{ email: 'gregory@megga.ch', name: 'Grégory Beuret', initial: 'G', color: '#0067B8' }]

  const allScopes = isGoogle
    ? [
        {
          key: 'calendar' as OAuthScope,
          icon: 'calendar' as const,
          title: 'Voir, créer et modifier vos événements Google Calendar',
          sub: 'MEGGA pourra lire votre agenda et y ajouter visites, signatures et rendez-vous.',
        },
        {
          key: 'gmail' as OAuthScope,
          icon: 'mail' as const,
          title: 'Lire, envoyer et gérer vos emails Gmail',
          sub: 'Conversations clients liées automatiquement aux deals dans le CRM.',
        },
        {
          key: 'contacts' as OAuthScope,
          icon: 'users' as const,
          title: 'Voir et modifier vos contacts',
          sub: 'Synchroniser le carnet d\'adresses avec les contacts du CRM.',
        },
      ]
    : [
        {
          key: 'calendar' as OAuthScope,
          icon: 'calendar' as const,
          title: 'Lire et écrire dans votre Outlook Calendar',
          sub: 'MEGGA pourra ajouter et synchroniser visites et rendez-vous.',
        },
        {
          key: 'mail' as OAuthScope,
          icon: 'mail' as const,
          title: 'Lire et envoyer des emails Outlook',
          sub: 'Conversations clients liées aux deals MEGGA.',
        },
        {
          key: 'contacts' as OAuthScope,
          icon: 'users' as const,
          title: 'Accéder à votre carnet d\'adresses',
          sub: 'Synchroniser les contacts Exchange.',
        },
      ]

  const toggle = (k: OAuthScope) => {
    setScopes(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]))
  }

  const handleAllow = () => {
    if (!account) return
    setStep('loading')
    setTimeout(() => onComplete(account.email, scopes), 1200)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
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
          background: '#fff',
          borderRadius: 12,
          width: 460,
          maxWidth: '94%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
          fontFamily:
            '"Google Sans", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: '#F1F3F4',
            borderBottom: '1px solid #E0E0E0',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FF5F57' }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#FEBC2E' }} />
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#28C840' }} />
          </div>
          <div
            style={{
              flex: 1,
              height: 22,
              borderRadius: 999,
              background: '#fff',
              border: '1px solid #DADCE0',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              fontSize: 11,
              color: '#5F6368',
              fontWeight: 500,
            }}
          >
            <SetIcon name="lock" size={10} stroke="#5F6368" sw={2.2} />
            <span>{isGoogle ? 'accounts.google.com' : 'login.microsoftonline.com'}</span>
          </div>
        </div>

        <div style={{ padding: '32px 40px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            {isGoogle ? <GoogleG size={36} /> : <MsLogo size={36} />}
          </div>

          {step === 'choose' && (
            <>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 400,
                  color: '#202124',
                  textAlign: 'center',
                  letterSpacing: -0.2,
                }}
              >
                Choisir un compte
              </h2>
              <p
                style={{
                  margin: '6px 0 22px',
                  fontSize: 14,
                  color: '#5F6368',
                  textAlign: 'center',
                  fontWeight: 400,
                }}
              >
                pour continuer vers <span style={{ color: '#202124', fontWeight: 500 }}>MEGGA</span>
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid #DADCE0',
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      borderBottom: i < accounts.length - 1 ? '1px solid #DADCE0' : 'none',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#F8F9FA'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: a.color,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 15,
                        fontWeight: 500,
                      }}
                    >
                      {a.initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ fontSize: 14, color: '#202124', fontWeight: 500 }}
                      >
                        {a.name}
                      </div>
                      <div style={{ fontSize: 13, color: '#5F6368' }}>{a.email}</div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={onCancel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    border: 0,
                    borderTop: '1px solid #DADCE0',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#F8F9FA'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      border: '1px solid #DADCE0',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#5F6368',
                    }}
                  >
                    <SetIcon name="plus" size={16} stroke="#5F6368" sw={2.2} />
                  </div>
                  <div style={{ fontSize: 14, color: '#202124', fontWeight: 500 }}>
                    Utiliser un autre compte
                  </div>
                </button>
              </div>
              <p
                style={{
                  margin: '22px 0 0',
                  fontSize: 12,
                  color: '#5F6368',
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                Avant d'utiliser cette application, vous pouvez consulter les{' '}
                <span style={{ color: accentBlue, cursor: 'pointer' }}>
                  conditions d'utilisation
                </span>{' '}
                et la{' '}
                <span style={{ color: accentBlue, cursor: 'pointer' }}>
                  politique de confidentialité
                </span>{' '}
                de MEGGA.
              </p>
            </>
          )}

          {step === 'consent' && account && (
            <>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 400,
                  color: '#202124',
                  textAlign: 'center',
                  letterSpacing: -0.2,
                }}
              >
                MEGGA souhaite accéder à votre compte {isGoogle ? 'Google' : 'Microsoft'}
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '18px auto 22px',
                  padding: '6px 14px 6px 6px',
                  border: '1px solid #DADCE0',
                  borderRadius: 999,
                  width: 'fit-content',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: account.color,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {account.initial}
                </div>
                <span style={{ fontSize: 13, color: '#202124', fontWeight: 500 }}>
                  {account.email}
                </span>
              </div>
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 13.5,
                  color: '#202124',
                  lineHeight: 1.55,
                  fontWeight: 500,
                }}
              >
                Vérifiez les autorisations que MEGGA pourra utiliser. Vous pouvez révoquer cet accès à
                tout moment dans votre compte {isGoogle ? 'Google' : 'Microsoft'}.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: 18,
                }}
              >
                {allScopes.map(s => {
                  const on = scopes.includes(s.key)
                  return (
                    <label
                      key={s.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: on ? '#F8FBFF' : 'transparent',
                        transition: 'background .12s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(s.key)}
                        style={{
                          margin: '3px 0 0',
                          width: 16,
                          height: 16,
                          accentColor: accentBlue,
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#202124',
                            fontWeight: 500,
                            lineHeight: 1.4,
                          }}
                        >
                          {s.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#5F6368',
                            lineHeight: 1.45,
                            marginTop: 2,
                          }}
                        >
                          {s.sub}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#F1F3F4',
                  marginBottom: 22,
                  fontSize: 12,
                  color: '#5F6368',
                  lineHeight: 1.5,
                }}
              >
                En cliquant sur <strong style={{ color: '#202124' }}>Autoriser</strong>, vous
                permettez à MEGGA d'utiliser vos données conformément à ses conditions
                d'utilisation et à sa politique de confidentialité.
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <button
                  onClick={onCancel}
                  style={{
                    height: 36,
                    padding: '0 18px',
                    borderRadius: 4,
                    border: 0,
                    background: 'transparent',
                    color: accentBlue,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    letterSpacing: 0.1,
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleAllow}
                  disabled={scopes.length === 0}
                  style={{
                    height: 36,
                    padding: '0 22px',
                    borderRadius: 4,
                    border: 0,
                    background: scopes.length === 0 ? '#DADCE0' : accentBlue,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: scopes.length === 0 ? 'not-allowed' : 'pointer',
                    letterSpacing: 0.1,
                    boxShadow: scopes.length === 0 ? 'none' : '0 1px 2px rgba(0,0,0,0.10)',
                  }}
                >
                  Autoriser
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                padding: '30px 0 18px',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: `3px solid ${accentBlue}25`,
                  borderTopColor: accentBlue,
                  animation: 'setSpin .8s linear infinite',
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  color: '#202124',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                Connexion en cours…
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: '#5F6368',
                  textAlign: 'center',
                  lineHeight: 1.5,
                }}
              >
                Redirection vers MEGGA après autorisation
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ProviderLoadingStub (DocuSign / Skribble — auth flow simplifié) ─────
function ProviderLoadingStub({ item, onCancel, onComplete }: OAuthFlowProps) {
  const isDocuSign = item.provider === 'docusign'
  const brand = isDocuSign ? '#FFCC22' : '#0B0C0E'
  const [step, setStep] = useState<'connecting' | 'done'>('connecting')

  const handleConnect = () => {
    setStep('connecting')
    setTimeout(() => {
      setStep('done')
      setTimeout(() => {
        const scopes = isDocuSign
          ? ['send', 'template', 'webhook']
          : ['sign', 'attach', 'status']
        onComplete('gregory@megga.ch', scopes)
      }, 800)
    }, 1100)
  }

  // Auto-launch the connection on mount (matches proto UX of immediate redirect)
  useState(() => {
    setTimeout(handleConnect, 250)
    return null
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
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
          background: '#fff',
          borderRadius: 16,
          width: 420,
          maxWidth: '94%',
          padding: '36px 32px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: brand,
            color: isDocuSign ? '#0B0C0E' : '#fff',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 18px',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -0.4,
          }}
        >
          {item.logoText}
        </div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: 18,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.3,
          }}
        >
          {step === 'connecting'
            ? `Connexion à ${item.name}…`
            : `${item.name} connecté`}
        </h3>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: SET.muted,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {step === 'connecting'
            ? `Authentification en cours via ${item.name}.`
            : 'Toutes les permissions ont été accordées.'}
        </p>
        {step === 'connecting' ? (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: `3px solid ${brand}30`,
              borderTopColor: brand,
              margin: '0 auto',
              animation: 'setSpin .7s linear infinite',
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: SET.ok,
              margin: '0 auto',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SetIcon name="check" size={18} stroke="#fff" sw={3} />
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//  SECTION — INTÉGRATIONS
// ═══════════════════════════════════════════════════════════════════════
export function IntegrationsSection() {
  const [items, setItems] = useState<Integration[]>(INITIAL_INTEGRATIONS)
  const [filter, setFilter] = useState<string>('all')
  const [details, setDetails] = useState<Integration | null>(null)
  const [confirmDisc, setConfirmDisc] = useState<Integration | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [oauthFor, setOauthFor] = useState<Integration | null>(null)

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category)))]
  const visible = filter === 'all' ? items : items.filter(i => i.category === filter)
  const connected = items.filter(i => i.connected)

  const fakeConnect = (id: string) => {
    const item = items.find(i => i.id === id)
    if (
      item &&
      (item.provider === 'google' ||
        item.provider === 'microsoft' ||
        item.provider === 'docusign' ||
        item.provider === 'skribble')
    ) {
      setOauthFor(item)
      return
    }
    setConnecting(id)
    setTimeout(() => {
      setItems(arr =>
        arr.map(it =>
          it.id === id
            ? {
                ...it,
                connected: true,
                account: 'gregory@megga.ch',
                connectedSince: "À l'instant",
              }
            : it,
        ),
      )
      setConnecting(null)
      setToast('Connecté avec succès')
      setTimeout(() => setToast(null), 2400)
    }, 1100)
  }

  const completeOAuth = (item: Integration, account: string, scopes: string[]) => {
    let services: IntegrationServices
    if (item.provider === 'google') {
      services = {
        calendar: scopes.includes('calendar'),
        gmail: scopes.includes('gmail'),
        contacts: scopes.includes('contacts'),
      }
    } else if (item.provider === 'microsoft') {
      services = {
        calendar: scopes.includes('calendar'),
        mail: scopes.includes('mail'),
        contacts: scopes.includes('contacts'),
      }
    } else if (item.provider === 'skribble') {
      services = {
        sign: scopes.includes('sign'),
        attach: scopes.includes('attach'),
        status: scopes.includes('status'),
      }
    } else {
      services = {
        send: scopes.includes('send'),
        template: scopes.includes('template'),
        webhook: scopes.includes('webhook'),
      }
    }
    const accountLabel =
      item.provider === 'docusign'
        ? `${account} · Plan Business`
        : item.provider === 'skribble'
          ? `${account} · Plan Business`
          : account
    setItems(arr =>
      arr.map(it =>
        it.id === item.id
          ? { ...it, connected: true, account: accountLabel, connectedSince: "À l'instant", services }
          : it,
      ),
    )
    setOauthFor(null)
    setToast(`${item.name} connecté`)
    setTimeout(() => setToast(null), 2400)
  }

  const updateServices = (id: string, services: IntegrationServices) => {
    setItems(arr => arr.map(it => (it.id === id ? { ...it, services } : it)))
  }

  const disconnect = (id: string) => {
    setItems(arr =>
      arr.map(it =>
        it.id === id
          ? { ...it, connected: false, account: undefined, connectedSince: undefined }
          : it,
      ),
    )
    setConfirmDisc(null)
    setToast('Intégration déconnectée')
    setTimeout(() => setToast(null), 2400)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 40,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Intégrations"
          title="Connectez votre stack métier"
          sub={`${connected.length} services actifs sur ${items.length} disponibles · agenda, email, signature, données marché, KYC, banque.`}
        />

        {/* Stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Connectés', value: String(connected.length), sub: "Actifs aujourd'hui" },
            { label: 'Synchronisations', value: '12.3k', sub: 'Sur 30 jours' },
            { label: 'Latence moyenne', value: '0.8s', sub: 'Temps réel' },
            { label: 'Incidents', value: '0', sub: 'Sur 30 jours' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: SET.card,
                borderRadius: 18,
                padding: '18px 20px',
                boxShadow: SET.shadowSm,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: SET.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: SET.ink,
                  letterSpacing: -0.5,
                  marginTop: 6,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: SET.muted,
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Filtre catégories */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            background: SET.card,
            borderRadius: 22,
            padding: 8,
            boxShadow: SET.shadowSm,
          }}
        >
          {categories.map(c => {
            const active = filter === c
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 999,
                  border: 0,
                  background: active ? SET.black : 'transparent',
                  color: active ? '#fff' : SET.inkSoft,
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  letterSpacing: -0.05,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = SET.cardSubtle
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {c === 'all' ? 'Tous' : c}
                <span
                  style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, opacity: 0.6 }}
                >
                  {c === 'all' ? items.length : items.filter(i => i.category === c).length}
                </span>
              </button>
            )
          })}
        </div>

        {/* Grille intégrations */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {visible.map(it => (
            <IntegrationCard
              key={it.id}
              item={it}
              onClick={() => setDetails(it)}
              onConnect={() => fakeConnect(it.id)}
              onDisconnect={() => setConfirmDisc(it)}
              connecting={connecting === it.id}
            />
          ))}
        </div>
      </div>

      <Toast open={!!toast} label={toast || ''} />

      {/* Modal détails */}
      {details && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(11,12,14,0.40)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            animation: 'setFadeIn .2s ease both',
          }}
          onClick={() => setDetails(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: SET.card,
              borderRadius: 24,
              padding: 32,
              maxWidth: 540,
              width: '92%',
              boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
              animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 22,
              }}
            >
              <IntegrationLogo item={details} size={56} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SET.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  {details.category}
                </div>
                <h3
                  style={{
                    margin: '2px 0 0',
                    fontSize: 22,
                    fontWeight: 700,
                    color: SET.ink,
                    letterSpacing: -0.4,
                  }}
                >
                  {details.name}
                </h3>
              </div>
              <button
                onClick={() => setDetails(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: 0,
                  background: SET.cardSubtle,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: SET.ink,
                }}
              >
                <SetIcon name="x" size={16} />
              </button>
            </div>
            <p
              style={{
                margin: '0 0 22px',
                fontSize: 14,
                color: SET.inkSoft,
                lineHeight: 1.55,
              }}
            >
              {details.desc}
            </p>

            {details.connected ? (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: SET.cardSubtle,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: SET.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Connexion active
                </div>
                <div style={{ fontSize: 13.5, color: SET.ink, fontWeight: 600 }}>
                  {details.account}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  Connecté depuis {details.connectedSince}
                </div>
              </div>
            ) : details.premium ? (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'rgba(124, 58, 237, 0.08)',
                  marginBottom: 18,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <SetIcon name="sparkle" size={16} stroke="#7C3AED" />
                <span
                  style={{ fontSize: 12.5, fontWeight: 600, color: '#7C3AED' }}
                >
                  Plan Cabinet+ requis
                </span>
              </div>
            ) : null}

            {/* Si Google/Microsoft connecté → toggles services activés */}
            {details.connected &&
            (details.provider === 'google' || details.provider === 'microsoft') ? (
              <>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: SET.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  Services activés
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: SET.cardSubtle,
                    borderRadius: 14,
                    overflow: 'hidden',
                    marginBottom: 22,
                  }}
                >
                  {(details.provider === 'google'
                    ? [
                        {
                          key: 'calendar' as const,
                          label: 'Google Calendar',
                          sub: 'Visites et rendez-vous synchronisés',
                        },
                        {
                          key: 'gmail' as const,
                          label: 'Gmail',
                          sub: 'Emails clients liés aux deals',
                        },
                        {
                          key: 'contacts' as const,
                          label: 'Google Contacts',
                          sub: 'Synchronisation des contacts',
                        },
                      ]
                    : [
                        {
                          key: 'calendar' as const,
                          label: 'Outlook Calendar',
                          sub: 'Visites et rendez-vous synchronisés',
                        },
                        {
                          key: 'mail' as const,
                          label: 'Outlook Mail',
                          sub: 'Emails clients liés aux deals',
                        },
                        {
                          key: 'contacts' as const,
                          label: "Carnet d'adresses",
                          sub: 'Contacts Exchange',
                        },
                      ]
                  ).map((s, i, arr) => {
                    const on = !!(
                      details.services &&
                      details.services[s.key as keyof IntegrationServices]
                    )
                    return (
                      <div
                        key={s.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderBottom:
                            i < arr.length - 1 ? `1px solid ${SET.line}` : 'none',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontSize: 13.5, color: SET.ink, fontWeight: 600 }}
                          >
                            {s.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: SET.muted,
                              fontWeight: 500,
                              marginTop: 1,
                            }}
                          >
                            {s.sub}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const next = {
                              ...details.services,
                              [s.key]: !on,
                            }
                            updateServices(details.id, next)
                            setDetails({ ...details, services: next })
                          }}
                          style={{
                            width: 38,
                            height: 22,
                            borderRadius: 999,
                            border: 0,
                            background: on ? SET.black : '#D1D5DB',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background .2s',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: on ? 18 : 2,
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              background: '#fff',
                              transition: 'left .2s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: SET.muted,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  Permissions accordées
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginBottom: 22,
                  }}
                >
                  {(details.provider === 'google'
                    ? [
                        'Calendar : visites, rendez-vous',
                        'Gmail : emails clients dans le CRM',
                        'Contacts : synchronisation',
                      ]
                    : details.provider === 'microsoft'
                      ? [
                          'Outlook Calendar : agenda',
                          'Outlook Mail : conversations',
                          "Carnet d'adresses Exchange",
                        ]
                      : details.category === 'Signature'
                        ? [
                            'Préparer des enveloppes',
                            'Suivre les statuts de signature',
                          ]
                        : details.category === 'Données marché'
                          ? [
                              'Interroger les estimations',
                              'Récupérer les comparables',
                            ]
                          : details.category === 'KYC / LBA'
                            ? [
                                "Lancer des vérifications d'identité",
                                'Stocker les preuves de conformité',
                              ]
                            : ['Accès lecture', 'Création de ressources']
                  ).map((p, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: SET.inkSoft,
                        fontWeight: 500,
                      }}
                    >
                      <SetIcon name="check" size={14} stroke={SET.ok} sw={2.4} />
                      {p}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <SetGhostBtn
                icon={<SetIcon name="arrowR" size={13} />}
                onClick={() => {}}
              >
                Documentation
              </SetGhostBtn>
              {details.connected ? (
                <button
                  onClick={() => {
                    setDetails(null)
                    setConfirmDisc(details)
                  }}
                  style={{
                    height: 44,
                    padding: '0 22px',
                    borderRadius: 999,
                    border: 0,
                    background: SET.cardSubtle,
                    color: SET.err,
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Déconnecter
                </button>
              ) : (
                <button
                  onClick={() => {
                    fakeConnect(details.id)
                    setDetails(null)
                  }}
                  style={{
                    height: 44,
                    padding: '0 22px',
                    borderRadius: 999,
                    border: 0,
                    background: SET.black,
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <SetIcon name="check" size={14} stroke="#fff" />
                  Connecter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OAuth officiel Google / Microsoft (+ stub DocuSign / Skribble) */}
      {oauthFor && (
        <OAuthFlow
          item={oauthFor}
          onCancel={() => setOauthFor(null)}
          onComplete={(account, scopes) => completeOAuth(oauthFor, account, scopes)}
        />
      )}

      {/* Confirm déconnexion */}
      {confirmDisc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(11,12,14,0.40)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            animation: 'setFadeIn .2s ease both',
          }}
          onClick={() => setConfirmDisc(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: SET.card,
              borderRadius: 24,
              padding: 32,
              maxWidth: 460,
              width: '90%',
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
              Déconnecter {confirmDisc.name} ?
            </h3>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 14,
                color: SET.inkSoft,
                lineHeight: 1.55,
              }}
            >
              La synchronisation s'arrête immédiatement. Vos données existantes restent dans le CRM,
              mais ne seront plus mises à jour.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <SetGhostBtn onClick={() => setConfirmDisc(null)}>Garder</SetGhostBtn>
              <button
                onClick={() => disconnect(confirmDisc.id)}
                style={{
                  height: 44,
                  padding: '0 22px',
                  borderRadius: 999,
                  border: 0,
                  background: SET.err,
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
      )}
    </>
  )
}
