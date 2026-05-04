// MEGGA — MFA reset flow (3 elements)
// Port from `crm-mfa-reset-flow.jsx` du bundle (504l).
//
// 3 éléments :
//   - MFALostDeviceModal      : self-service depuis login (« j'ai perdu mon téléphone »)
//   - MFAResetLandingScreen   : landing après clic du lien email admin
//   - MFAAdminEmailPreview    : aperçu de l'email envoyé à l'agent réinitialisé

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// ─── Tokens (cohérent avec MfaModals.tsx) ────────────────────────────────

const SET = {
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  card: '#FFFFFF',
  cardSubtle: '#F5F6F8',
  line: '#E4E6EC',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ok: '#0E9F6E',
  warn: '#C45A00',
  bad: '#D32F2F',
}
const FF = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'

// ─── Icons ───────────────────────────────────────────────────────────────

type IconName =
  | 'check' | 'x' | 'shield' | 'shieldX' | 'key' | 'mail' | 'mailOpen'
  | 'alert' | 'info' | 'arrowR' | 'phone' | 'lock' | 'logout' | 'clock'
  | 'device'

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="m5 13 4 4 10-12" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  shield: <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />,
  shieldX: (
    <>
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  key: <><circle cx="7" cy="14" r="4" /><path d="m21 2-9.5 9.5M15 8l3 3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></>,
  mailOpen: (
    <>
      <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8l9-6 9 6Z" />
      <path d="m3 8 9 6 9-6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="m10.3 2.6-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.7-3.4l-8-14a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  arrowR: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.71 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.71A2 2 0 0 1 22 16.92Z" />,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  device: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M11 18h2" /></>,
}

interface IconProps { name: IconName; size?: number; stroke?: string; sw?: number }
function Icon({ name, size = 18, stroke = 'currentColor', sw = 1.6 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || null}
    </svg>
  )
}

// ─── Buttons ─────────────────────────────────────────────────────────────

interface BtnProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

function BlackBtn({ children, onClick, disabled, icon, size = 'md', loading, fullWidth }: BtnProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 50 : size === 'sm' ? 36 : 44
  return (
    <button
      onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === 'sm' ? '0 16px' : '0 22px',
        width: fullWidth ? '100%' : undefined,
        borderRadius: 999, border: 0,
        background: (disabled || loading) ? SET.ghost : (hover ? SET.blackHover : SET.black),
        color: '#fff', fontFamily: FF,
        fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: (disabled || loading) ? 'none'
          : (hover ? '0 12px 30px rgba(11,12,14,0.25)' : '0 6px 16px rgba(11,12,14,0.18)'),
        transition: 'all .18s',
        transform: hover && !disabled && !loading ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, borderRadius: 999,
          border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
          animation: 'mfaSpin .7s linear infinite',
        }} />
      )}
      {!loading && icon}{children}
    </button>
  )
}

function GhostBtn({ children, onClick, icon, size = 'md', fullWidth }: BtnProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'sm' ? 36 : 44
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === 'sm' ? '0 14px' : '0 20px',
        width: fullWidth ? '100%' : undefined,
        borderRadius: 999, border: 0,
        background: hover ? SET.cardSubtle : 'transparent',
        color: SET.inkSoft, fontFamily: FF,
        fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        transition: 'all .15s',
      }}
    >
      {icon}{children}
    </button>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────

function ResetModal({ children, onClose, width = 460 }: { children: ReactNode; onClose: () => void; width?: number }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'grid', placeItems: 'center', padding: 20,
        animation: 'mfaFadeUp .2s ease both',
        fontFamily: FF,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card, borderRadius: 24, padding: 28,
          width, maxWidth: '100%',
          boxShadow: '0 40px 100px rgba(11,12,14,0.30)',
          maxHeight: '86vh', overflowY: 'auto',
          animation: 'mfaSlideUp .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ─── MFALostDeviceModal — self-service depuis login ──────────────────────

interface MFALostDeviceModalProps {
  onClose: () => void
  onSubmitted?: () => void
}

const REASONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'lost', label: 'Téléphone perdu ou volé', icon: 'phone' },
  { id: 'new', label: 'Changement de téléphone', icon: 'device' },
  { id: 'app', label: "App d'authentification supprimée", icon: 'shieldX' },
  { id: 'backup', label: 'Plus de codes de secours', icon: 'key' },
]

export function MFALostDeviceModal({ onClose, onSubmitted }: MFALostDeviceModalProps) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('julien.morel@megga.ch')
  const [reason, setReason] = useState('lost')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  const submit = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setStep(2)
      onSubmitted?.()
    }, 800)
  }

  return (
    <ResetModal onClose={onClose} width={500}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${SET.warn}18`, color: SET.warn,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <Icon name={step === 1 ? 'shieldX' : 'mailOpen'} size={22} stroke={SET.warn} sw={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Kicker>{step === 1 ? "Récupération d'accès" : 'Demande envoyée'}</Kicker>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
            {step === 1 ? "Je n'ai plus accès à ma 2FA" : 'Votre admin a été notifié'}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34, height: 34, border: 0, borderRadius: 999,
            background: SET.cardSubtle, color: SET.inkSoft, cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <Icon name="x" size={14} stroke={SET.inkSoft} sw={2.4} />
        </button>
      </div>

      {step === 1 && (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            Pour des raisons de sécurité, vous ne pouvez pas réinitialiser votre 2FA seul. Votre{' '}
            <strong>admin d'agence</strong> recevra votre demande et devra vérifier votre identité (téléphone
            ou en personne) avant de débloquer votre compte.
          </p>

          <label style={{ display: 'block', marginBottom: 14 }}>
            <Kicker>Votre email MEGGA</Kicker>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="prenom.nom@agence.ch"
              style={{
                width: '100%', height: 46, padding: '0 14px',
                borderRadius: 12, border: 0, outline: 'none',
                background: SET.cardSubtle,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                fontFamily: FF, fontSize: 14, fontWeight: 600, color: SET.ink,
              }}
            />
          </label>

          <div style={{ marginBottom: 14 }}>
            <Kicker>Que s'est-il passé ?</Kicker>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {REASONS.map(r => {
                const active = reason === r.id
                return (
                  <button
                    key={r.id} onClick={() => setReason(r.id)}
                    style={{
                      padding: '12px 14px', borderRadius: 12, border: 0, textAlign: 'left',
                      background: active ? SET.card : SET.cardSubtle,
                      boxShadow: active
                        ? `inset 0 0 0 2px ${SET.ink}, 0 6px 16px rgba(11,12,14,0.08)`
                        : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
                      cursor: 'pointer', fontFamily: FF,
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'all .15s',
                    }}
                  >
                    <Icon name={r.icon} size={15} stroke={SET.ink} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: SET.ink }}>{r.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 18 }}>
            <Kicker>
              Précisions{' '}
              <span style={{ color: SET.muted, opacity: 0.7, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                (optionnel)
              </span>
            </Kicker>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Ex : téléphone perdu hier soir au bureau, je ne retrouve pas mes codes de secours…"
              rows={3}
              style={{
                width: '100%', padding: '12px 14px',
                borderRadius: 12, border: 0, outline: 'none', resize: 'vertical',
                background: SET.cardSubtle,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
                fontFamily: FF, fontSize: 13, fontWeight: 500, color: SET.ink, lineHeight: 1.5,
              }}
            />
          </label>

          <div
            style={{
              padding: '12px 14px', borderRadius: 12,
              background: `${SET.ok}12`, marginBottom: 18,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <Icon name="info" size={15} stroke={SET.ok} sw={2.2} />
            <div style={{ fontSize: 12, color: SET.ink, fontWeight: 500, lineHeight: 1.5 }}>
              Délai habituel de traitement : <strong>moins de 4 h</strong> en heures ouvrables. Vous recevrez
              un email dès que votre admin aura validé.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <GhostBtn onClick={onClose}>Annuler</GhostBtn>
            <BlackBtn
              onClick={submit} loading={sending} disabled={!email}
              icon={!sending ? <Icon name="mail" size={14} stroke="#fff" sw={2.2} /> : undefined}
            >
              Envoyer la demande
            </BlackBtn>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>
            Un email a été envoyé à <strong>Camille Rochat</strong>, admin de votre agence. Elle va vérifier
            votre identité et débloquer votre compte.
          </p>

          <div style={{ padding: '16px 18px', borderRadius: 14, background: SET.cardSubtle, marginBottom: 18 }}>
            <Kicker>Prochaines étapes</Kicker>
            <Step n={1} title="Votre admin vous contacte" desc="Par téléphone ou en personne pour vérifier votre identité." />
            <Step n={2} title="Reset effectué côté admin" desc="Votre 2FA actuelle est invalidée et vos sessions actives sont déconnectées." />
            <Step n={3} title="Email avec lien de réenrôlement" desc="Vous recevez un lien pour reconfigurer une nouvelle 2FA depuis cet appareil." last />
          </div>

          <div
            style={{
              padding: '10px 14px', borderRadius: 10,
              background: `${SET.warn}14`, marginBottom: 18,
              display: 'flex', gap: 10, alignItems: 'center',
            }}
          >
            <Icon name="clock" size={14} stroke={SET.warn} sw={2.2} />
            <div style={{ fontSize: 12, color: SET.ink, fontWeight: 500 }}>
              <strong>Demande #MFA-7821</strong> · envoyée à l'instant
            </div>
          </div>

          <BlackBtn onClick={onClose} fullWidth icon={<Icon name="check" size={14} stroke="#fff" sw={2.4} />}>
            J'ai compris
          </BlackBtn>
        </>
      )}
    </ResetModal>
  )
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11, fontWeight: 700, color: SET.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}

function Step({ n, title, desc, last }: { n: number; title: string; desc: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: last ? 0 : 12 }}>
      <div
        style={{
          width: 24, height: 24, borderRadius: 999,
          background: SET.ink, color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          fontSize: 11, fontWeight: 700,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 12, color: SET.muted, fontWeight: 500, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

// ─── MFAResetLandingScreen — landing après clic du lien email ───────────

interface MFAResetLandingScreenProps {
  onContinue: () => void
  agentName?: string
}

export function MFAResetLandingScreen({ onContinue, agentName = 'Julien' }: MFAResetLandingScreenProps) {
  return (
    <ResetModal onClose={() => {}} width={520}>
      <div style={{ textAlign: 'center', padding: '8px 4px 0' }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: 20,
            background: `${SET.ok}18`, color: SET.ok,
            display: 'grid', placeItems: 'center', margin: '0 auto 18px',
          }}
        >
          <Icon name="shield" size={32} stroke={SET.ok} sw={2} />
        </div>
        <Kicker>Lien validé · Réinitialisation 2FA</Kicker>
        <h2
          style={{
            margin: '0 0 12px', fontSize: 24, fontWeight: 700,
            color: SET.ink, letterSpacing: -0.6, fontFamily: 'Georgia, serif',
          }}
        >
          Bonjour {agentName}
        </h2>
        <p
          style={{
            margin: '0 auto 22px', maxWidth: 400,
            fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.6,
          }}
        >
          Votre 2FA a été réinitialisée par <strong>Camille Rochat</strong> à votre demande. Toutes vos
          sessions actives ont été déconnectées par sécurité.
        </p>
      </div>

      <div style={{ padding: '16px 18px', borderRadius: 14, background: SET.cardSubtle, marginBottom: 18 }}>
        <Kicker>Ce qui a changé sur votre compte</Kicker>
        <ChangeRow icon="key" label="Ancien secret TOTP" value="Supprimé" tone="bad" />
        <ChangeRow icon="key" label="Anciens codes de secours" value="10 invalidés" tone="bad" />
        <ChangeRow icon="logout" label="Sessions actives" value="4 déconnectées" tone="bad" />
        <ChangeRow icon="clock" label="Validité de ce lien" value="Expire dans 1 h" tone="warn" last />
      </div>

      <div
        style={{
          padding: '12px 14px', borderRadius: 12,
          background: `${SET.warn}14`, marginBottom: 18,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}
      >
        <Icon name="alert" size={15} stroke={SET.warn} sw={2.2} />
        <div style={{ fontSize: 12.5, color: SET.ink, fontWeight: 500, lineHeight: 1.55 }}>
          Si vous n'êtes pas à l'origine de cette demande, <strong>fermez cette page immédiatement</strong> et
          contactez votre admin au +41 22 555 12 34.
        </div>
      </div>

      <BlackBtn
        onClick={onContinue} fullWidth size="lg"
        icon={<Icon name="arrowR" size={15} stroke="#fff" sw={2.2} />}
      >
        Configurer ma nouvelle 2FA
      </BlackBtn>
      <div
        style={{
          marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SET.line}`,
          textAlign: 'center', fontSize: 11.5, color: SET.muted, fontWeight: 500,
        }}
      >
        Lien sécurisé envoyé à julien.morel@megga.ch · Demande #MFA-7821
      </div>
    </ResetModal>
  )
}

function ChangeRow({
  icon, label, value, tone, last,
}: { icon: IconName; label: string; value: string; tone: 'bad' | 'warn' | 'ok'; last?: boolean }) {
  const map: Record<string, string> = { bad: SET.bad, warn: SET.warn, ok: SET.ok }
  const color = map[tone] || SET.ink
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        paddingBottom: last ? 0 : 10, marginBottom: last ? 0 : 10,
        borderBottom: last ? 'none' : `1px solid ${SET.line}`,
      }}
    >
      <Icon name={icon} size={14} stroke={SET.muted} />
      <span style={{ flex: 1, fontSize: 12.5, color: SET.ink, fontWeight: 500 }}>{label}</span>
      <span
        style={{
          fontSize: 11.5, fontWeight: 700, color,
          padding: '3px 8px', borderRadius: 999,
          background: `${color}14`,
          letterSpacing: 0.3,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── MFAAdminEmailPreview — aperçu de l'email envoyé à l'agent ──────────

interface MFAAdminEmailPreviewProps {
  onClose: () => void
  agent?: { name: string; email: string }
}

export function MFAAdminEmailPreview({
  onClose,
  agent = { name: 'Léa Vuilleumier', email: 'lea.vuilleumier@megga.ch' },
}: MFAAdminEmailPreviewProps) {
  return (
    <ResetModal onClose={onClose} width={560}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${SET.ink}10`, color: SET.ink,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <Icon name="mailOpen" size={22} stroke={SET.ink} sw={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Kicker>Aperçu · Email de réenrôlement</Kicker>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
            Email envoyé à {agent.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34, height: 34, border: 0, borderRadius: 999,
            background: SET.cardSubtle, color: SET.inkSoft, cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <Icon name="x" size={14} stroke={SET.inkSoft} sw={2.4} />
        </button>
      </div>

      {/* Email envelope header */}
      <div
        style={{
          padding: '12px 16px', borderRadius: '14px 14px 0 0',
          background: SET.cardSubtle, borderBottom: `1px solid ${SET.line}`,
          fontSize: 11.5, fontWeight: 500, color: SET.muted, lineHeight: 1.7,
        }}
      >
        <div><strong style={{ color: SET.ink, fontWeight: 700 }}>De :</strong> MEGGA Sécurité &lt;security@megga.ch&gt;</div>
        <div><strong style={{ color: SET.ink, fontWeight: 700 }}>À :</strong> {agent.name} &lt;{agent.email}&gt;</div>
        <div><strong style={{ color: SET.ink, fontWeight: 700 }}>Objet :</strong> Votre 2FA a été réinitialisée — action requise</div>
      </div>

      {/* Email body */}
      <div
        style={{
          padding: '24px 22px', borderRadius: '0 0 14px 14px',
          background: '#fff', border: `1px solid ${SET.line}`, borderTop: 'none',
          marginBottom: 18, fontSize: 13.5, color: SET.ink, lineHeight: 1.65, fontWeight: 500,
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
            marginBottom: 12, letterSpacing: -0.3,
          }}
        >
          Bonjour {agent.name.split(' ')[0]},
        </div>

        <p style={{ margin: '0 0 14px' }}>
          Votre admin <strong>Camille Rochat</strong> vient de réinitialiser votre authentification à deux
          facteurs sur MEGGA, suite à votre demande #MFA-7821.
        </p>
        <p style={{ margin: '0 0 18px' }}>
          Pour des raisons de sécurité, votre ancien secret TOTP et vos 10 codes de secours ont été{' '}
          <strong>invalidés</strong>, et toutes vos sessions actives ont été déconnectées.
        </p>

        <div style={{ textAlign: 'center', margin: '22px 0' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '14px 28px', borderRadius: 999,
              background: SET.black, color: '#fff',
              fontSize: 13.5, fontWeight: 700,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            Configurer ma nouvelle 2FA →
          </span>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: SET.muted }}>
          Ce lien expire dans <strong>1 heure</strong> et n'est utilisable qu'une seule fois.
        </p>

        <div
          style={{
            padding: '12px 14px', borderRadius: 10,
            background: SET.cardSubtle, marginTop: 18,
            fontSize: 12, color: SET.inkSoft, lineHeight: 1.5,
          }}
        >
          <strong style={{ color: SET.ink }}>Ce n'était pas vous ?</strong> Contactez immédiatement votre admin
          au <strong>+41 22 555 12 34</strong> ou répondez à cet email.
        </div>

        <div
          style={{
            marginTop: 22, paddingTop: 14, borderTop: `1px solid ${SET.line}`,
            fontSize: 11, color: SET.muted, lineHeight: 1.6,
          }}
        >
          MEGGA SA · Rue du Rhône 65 · 1204 Genève<br />
          Vous recevez cet email car vous êtes utilisateur MEGGA. Pour toute question : security@megga.ch
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <GhostBtn onClick={onClose}>Fermer</GhostBtn>
      </div>
    </ResetModal>
  )
}
