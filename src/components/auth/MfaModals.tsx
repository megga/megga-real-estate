// MEGGA — MFA TOTP modals (enroll, challenge, reset, backup codes, policy card)
// Port from `crm-mfa-modals.jsx` du bundle (1246l).
//
// 4 modales + 1 carte settings :
//   - MFAEnrollModal      : enrôlement TOTP en 3 étapes (QR / OTP verify / backup codes)
//   - MFAChallengeModal   : challenge OTP au login (avec fallback code de secours)
//   - MFAResetAgentModal  : admin réinitialise la 2FA d'un agent (confirm by typing name)
//   - MFABackupCodesModal : régénération des codes de secours
//   - AgencyMFAPolicyCard : carte settings agence (toggle + stats + liste agents)

import {
  Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// ─── Tokens ──────────────────────────────────────────────────────────────

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
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
}
const FF = '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'

// ─── Icons ───────────────────────────────────────────────────────────────

type IconName =
  | 'check' | 'x' | 'shield' | 'shieldOk' | 'key' | 'lock' | 'copy'
  | 'download' | 'print' | 'alert' | 'info' | 'arrowR' | 'arrowL'
  | 'device' | 'refresh' | 'user' | 'help' | 'mail' | 'logout'

const ICON_PATHS: Record<IconName, ReactNode> = {
  check: <path d="m5 13 4 4 10-12" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  shield: <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />,
  shieldOk: (
    <>
      <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  key: <><circle cx="7" cy="14" r="4" /><path d="m21 2-9.5 9.5M15 8l3 3" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  print: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
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
  arrowL: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  device: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M11 18h2" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M12 17h.01" />
    </>
  ),
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></>,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
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
  danger?: boolean
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

function GhostBtn({ children, onClick, disabled, icon, size = 'md', danger, fullWidth }: BtnProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'sm' ? 36 : 44
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === 'sm' ? '0 14px' : '0 20px',
        width: fullWidth ? '100%' : undefined,
        borderRadius: 999, border: 0,
        background: hover ? (danger ? `${SET.bad}14` : SET.cardSubtle) : 'transparent',
        color: danger ? SET.bad : SET.inkSoft, fontFamily: FF,
        fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        transition: 'all .15s',
      }}
    >
      {icon}{children}
    </button>
  )
}

interface SwitchProps { value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }

function Switch({ value, onChange, size = 'md' }: SwitchProps) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 22 : 26
  const t = size === 'sm' ? 16 : 20
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: w, height: h, borderRadius: 999, border: 0,
        background: value ? SET.black : SET.ghost,
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: (h - t) / 2,
        left: value ? (w - t - (h - t) / 2) : (h - t) / 2,
        width: t, height: t, borderRadius: 999, background: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        transition: 'left .2s cubic-bezier(.2,.8,.2,1)',
      }} />
    </button>
  )
}

// ─── Modal shell ─────────────────────────────────────────────────────────

interface MfaModalProps {
  children: ReactNode
  onClose: () => void
  wide?: boolean
}

function MfaModal({ children, onClose, wide }: MfaModalProps) {
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
      <style>{`
        @keyframes mfaFadeUp { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform: none } }
        @keyframes mfaSlideUp { from { opacity:0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }
        @keyframes mfaSpin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card, borderRadius: 24, padding: 28,
          width: wide ? 560 : 460, maxWidth: '100%',
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

// ─── FakeQR (motif déterministe, 21x21) ─────────────────────────────────

function FakeQR({ size = 156, color = '#0B0C0E' }: { size?: number; color?: string }) {
  const finder = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ]
  const noise: (number | null)[][] = []
  for (let y = 0; y < 21; y++) {
    const row: (number | null)[] = []
    for (let x = 0; x < 21; x++) {
      const inTL = x < 8 && y < 8
      const inTR = x > 12 && y < 8
      const inBL = x < 8 && y > 12
      if (inTL || inTR || inBL) { row.push(null); continue }
      const v = ((x * 31 + y * 17 + (x ^ y) * 3) % 7) > 3 ? 1 : 0
      row.push(v)
    }
    noise.push(row)
  }
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" shapeRendering="crispEdges">
      <rect x="0" y="0" width="21" height="21" fill="#fff" />
      {finder.flatMap((row, y) => row.map((c, x) => c ? <rect key={`tl-${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null))}
      {finder.flatMap((row, y) => row.map((c, x) => c ? <rect key={`tr-${x}-${y}`} x={x + 14} y={y} width={1} height={1} fill={color} /> : null))}
      {finder.flatMap((row, y) => row.map((c, x) => c ? <rect key={`bl-${x}-${y}`} x={x} y={y + 14} width={1} height={1} fill={color} /> : null))}
      {noise.flatMap((row, y) => row.map((c, x) => c ? <rect key={`d-${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null))}
    </svg>
  )
}

// ─── OTPInput (6 cases) ──────────────────────────────────────────────────

interface OTPInputProps {
  value: string
  onChange: (v: string) => void
  error?: boolean
  autoFocus?: boolean
  length?: number
  mono?: boolean
}

function OTPInput({ value, onChange, error, autoFocus = true, length = 6, mono }: OTPInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = value.padEnd(length, ' ').split('').slice(0, length)

  useEffect(() => {
    if (autoFocus && refs.current[0]) refs.current[0].focus()
  }, [autoFocus])

  const setAt = (i: number, ch: string) => {
    const next = value.split('')
    while (next.length < length) next.push('')
    next[i] = ch
    onChange(next.join('').slice(0, length))
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i].trim() && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onIn = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const v = (e.target.value || '').replace(/\D/g, '').slice(0, 1)
    setAt(i, v)
    if (v && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length)
    if (txt) {
      onChange(txt)
      const next = Math.min(txt.length, length - 1)
      setTimeout(() => refs.current[next]?.focus(), 0)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${length}, 1fr)`, gap: 8 }}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          value={c.trim()}
          onChange={e => onIn(i, e)}
          onKeyDown={e => onKey(i, e)}
          onPaste={onPaste}
          inputMode="numeric"
          maxLength={1}
          style={{
            height: 56, borderRadius: 14, border: 0, outline: 'none',
            textAlign: 'center',
            fontFamily: mono ? 'ui-monospace, SF Mono, Menlo, monospace' : FF,
            fontSize: 22, fontWeight: 700, letterSpacing: 0.5,
            color: SET.ink,
            background: SET.cardSubtle,
            boxShadow: error
              ? `inset 0 0 0 2px ${SET.bad}`
              : (c.trim() ? `inset 0 0 0 2px ${SET.ink}` : 'inset 0 0 0 1px rgba(15,23,42,0.06)'),
            transition: 'box-shadow .15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Modal header (icône + kicker + title + X) ──────────────────────────

interface ModalHeaderProps {
  iconName: IconName
  iconBg: string
  iconColor: string
  kicker: string
  title: string
  onClose: () => void
}

function ModalHeader({ iconName, iconBg, iconColor, kicker, title, onClose }: ModalHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
      <div
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: iconBg, color: iconColor,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Icon name={iconName} size={22} stroke={iconColor} sw={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11, fontWeight: 700, color: SET.muted,
            letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
          }}
        >
          {kicker}
        </div>
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
          {title}
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
  )
}

// ─── Demo data (TOTP secret + backup codes) ─────────────────────────────

const SECRET = 'MEGG A4XJ K7P2 W9QH'
const BACKUP_CODES = [
  '9F3K-2WQX', 'L7P8-MZ4T', 'B6HN-RY2Q',
  'K3X9-VW8M', 'T4QP-J7BC', 'R8MZ-5LFW',
  'Y2NK-PQ7H', 'V9HJ-6XKR', 'C5WL-T3MB',
  'M7BR-X2QP',
]

// ════════════════════════════════════════════════════════════════════════
// Modale 1 — Enrôlement TOTP (3 étapes)
// ════════════════════════════════════════════════════════════════════════

interface MFAEnrollModalProps {
  onClose: () => void
  onDone?: () => void
  /** True si la politique d'agence impose la 2FA (UX renforcée, pas d'annuler) */
  enforced?: boolean
  /** Email/identifiant affiché à côté du QR */
  account?: string
}

export function MFAEnrollModal({ onClose, onDone, enforced, account = 'MEGGA · julien.morel@megga.ch' }: MFAEnrollModalProps) {
  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  const copySecret = () => {
    navigator.clipboard?.writeText(SECRET.replace(/\s/g, '')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const verify = () => {
    if (code.length !== 6) { setError(true); return }
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      if (code === '000000') { setError(true); return }
      setStep(3)
    }, 700)
  }

  return (
    <MfaModal onClose={onClose}>
      <ModalHeader
        iconName="shieldOk"
        iconBg={`${SET.ok}18`}
        iconColor={SET.ok}
        kicker={`Étape ${step} / 3 · Authentification forte`}
        title={
          step === 1 ? "Configurer l'authentificateur"
          : step === 2 ? 'Vérifier le code à 6 chiffres'
          : 'Vos codes de secours'
        }
        onClose={onClose}
      />

      {/* Progress bars */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              flex: 1, height: 4, borderRadius: 999,
              background: s <= step ? SET.ink : SET.line,
              transition: 'background .25s',
            }}
          />
        ))}
      </div>

      {enforced && step === 1 && (
        <div
          style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '12px 14px', borderRadius: 12,
            background: `${SET.warn}14`, marginBottom: 18,
          }}
        >
          <Icon name="alert" size={15} stroke={SET.warn} sw={2.2} />
          <div style={{ fontSize: 12.5, color: SET.ink, fontWeight: 500, lineHeight: 1.5 }}>
            Votre agence impose la <strong>2FA TOTP</strong> pour tous les agents. Cette étape est obligatoire
            pour continuer à utiliser MEGGA.
          </div>
        </div>
      )}

      {/* STEP 1 — QR + secret */}
      {step === 1 && (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            Ouvrez votre application d'authentification (Authy, Google Authenticator, 1Password) et scannez ce
            QR code.
          </p>
          <div
            style={{
              padding: 18, borderRadius: 18, background: SET.cardSubtle,
              display: 'flex', gap: 18, alignItems: 'center', marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 160, height: 160, borderRadius: 14, background: '#fff',
                padding: 8, display: 'grid', placeItems: 'center',
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)', flexShrink: 0,
              }}
            >
              <FakeQR size={144} color={SET.ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <KickLabel>Compte</KickLabel>
              <div
                style={{
                  fontSize: 14, fontWeight: 700, color: SET.ink, marginBottom: 14,
                  letterSpacing: -0.1, wordBreak: 'break-all',
                }}
              >
                {account}
              </div>
              <KickLabel>Clé manuelle</KickLabel>
              <button
                onClick={copySecret}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', border: 0, borderRadius: 10,
                  background: '#fff', cursor: 'pointer', textAlign: 'left',
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.08)',
                }}
              >
                <span
                  style={{
                    flex: 1, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
                    fontSize: 12.5, fontWeight: 700, color: SET.ink, letterSpacing: 0.4,
                  }}
                >
                  {SECRET}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700,
                    color: copied ? SET.ok : SET.muted,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={12} stroke={copied ? SET.ok : SET.muted} sw={2.4} />
                  {copied ? 'Copié' : 'Copier'}
                </span>
              </button>
            </div>
          </div>
          <InfoLine>
            Si vous ne pouvez pas scanner, saisissez la clé manuellement dans votre application (type : TOTP,
            période : 30 s).
          </InfoLine>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            {!enforced && <GhostBtn onClick={onClose}>Annuler</GhostBtn>}
            <BlackBtn
              onClick={() => setStep(2)}
              icon={<Icon name="arrowR" size={14} stroke="#fff" sw={2.2} />}
            >
              J'ai scanné le QR
            </BlackBtn>
          </div>
        </>
      )}

      {/* STEP 2 — Vérification */}
      {step === 2 && (
        <>
          <p style={{ margin: '0 0 22px', fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            Entrez le code à 6 chiffres affiché par votre application d'authentification pour confirmer la
            liaison.
          </p>
          <OTPInput value={code} onChange={v => { setCode(v); setError(false) }} error={error} mono />
          {error && (
            <ErrorBanner>
              Code invalide ou expiré. Réessayez avec le code actuel.
            </ErrorBanner>
          )}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: SET.muted, fontWeight: 500 }}>
            <Icon name="info" size={13} stroke={SET.muted} />
            Le code change toutes les 30 secondes. Utilisez le plus récent.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 24 }}>
            <GhostBtn
              onClick={() => setStep(1)}
              icon={<Icon name="arrowL" size={14} stroke={SET.inkSoft} sw={2.2} />}
            >
              Retour
            </GhostBtn>
            <BlackBtn
              onClick={verify} loading={verifying} disabled={code.length !== 6}
              icon={!verifying ? <Icon name="check" size={14} stroke="#fff" sw={2.4} /> : undefined}
            >
              Vérifier et activer
            </BlackBtn>
          </div>
        </>
      )}

      {/* STEP 3 — Backup codes */}
      {step === 3 && (
        <>
          <div
            style={{
              padding: '12px 14px', borderRadius: 12,
              background: `${SET.warn}14`, marginBottom: 18,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <Icon name="alert" size={15} stroke={SET.warn} sw={2.2} />
            <div style={{ fontSize: 12.5, color: SET.ink, fontWeight: 500, lineHeight: 1.5 }}>
              Conservez ces 10 codes en lieu sûr. Chaque code n'est utilisable <strong>qu'une seule fois</strong>
              {' '}en cas de perte de votre téléphone. Ils ne seront plus affichés.
            </div>
          </div>
          <BackupCodesGrid />
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <GhostBtn size="sm" icon={<Icon name="download" size={13} stroke={SET.inkSoft} />}>Télécharger .txt</GhostBtn>
            <GhostBtn size="sm" icon={<Icon name="print" size={13} stroke={SET.inkSoft} />}>Imprimer</GhostBtn>
            <GhostBtn size="sm" icon={<Icon name="copy" size={13} stroke={SET.inkSoft} />}>Tout copier</GhostBtn>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <BlackBtn
              onClick={() => { onDone?.(); onClose() }}
              icon={<Icon name="check" size={14} stroke="#fff" sw={2.4} />}
            >
              J'ai sauvegardé mes codes
            </BlackBtn>
          </div>
        </>
      )}
    </MfaModal>
  )
}

// ── Helpers ──

function KickLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11, fontWeight: 700, color: SET.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

function InfoLine({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 12px', borderRadius: 10, marginBottom: 6,
      }}
    >
      <Icon name="info" size={14} stroke={SET.muted} />
      <div style={{ fontSize: 12, color: SET.muted, fontWeight: 500, lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  )
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 10,
        background: `${SET.bad}14`, color: SET.bad,
        fontSize: 12.5, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <Icon name="alert" size={14} stroke={SET.bad} sw={2.2} />
      {children}
    </div>
  )
}

function BackupCodesGrid() {
  return (
    <div
      style={{
        padding: 18, borderRadius: 16, background: SET.cardSubtle,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        marginBottom: 18,
      }}
    >
      {BACKUP_CODES.map((c, i) => (
        <div
          key={c}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10, background: '#fff',
            fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
            fontSize: 13, fontWeight: 700, color: SET.ink, letterSpacing: 0.5,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          }}
        >
          <span style={{ fontSize: 10, color: SET.muted, fontWeight: 700, fontFamily: 'inherit', width: 18, flexShrink: 0 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          {c}
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Modale 2 — Challenge TOTP au login
// ════════════════════════════════════════════════════════════════════════

interface MFAChallengeModalProps {
  onClose: () => void
  onSuccess?: () => void
  /** Label appareil détecté */
  deviceLabel?: string
}

export function MFAChallengeModal({ onClose, onSuccess, deviceLabel = 'Chrome · macOS · Genève' }: MFAChallengeModalProps) {
  const [code, setCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const tryVerify = () => {
    const v = useBackup ? backupCode.replace(/\s|-/g, '') : code
    const ok = useBackup ? v.length === 8 : v.length === 6
    if (!ok) { setError(true); return }
    setVerifying(true)
    setTimeout(() => {
      setVerifying(false)
      onSuccess?.()
      onClose()
    }, 700)
  }

  return (
    <MfaModal onClose={onClose}>
      <ModalHeader
        iconName="lock"
        iconBg={`${SET.ink}10`}
        iconColor={SET.ink}
        kicker="Vérification de sécurité"
        title={useBackup ? 'Code de secours' : 'Code à 6 chiffres'}
        onClose={onClose}
      />

      {/* Device context */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 12, background: SET.cardSubtle,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#fff', display: 'grid', placeItems: 'center',
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)', flexShrink: 0,
          }}
        >
          <Icon name="device" size={16} stroke={SET.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: SET.ink }}>Nouvel appareil détecté</div>
          <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500, marginTop: 2 }}>{deviceLabel}</div>
        </div>
      </div>

      <p style={{ margin: '0 0 18px', fontSize: 13, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
        {useBackup
          ? "Entrez l'un de vos 10 codes de secours (8 caractères, format XXXX-XXXX). Chaque code n'est utilisable qu'une seule fois."
          : "Ouvrez votre application d'authentification et entrez le code affiché pour MEGGA."}
      </p>

      {!useBackup ? (
        <OTPInput value={code} onChange={v => { setCode(v); setError(false) }} error={error} mono />
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', height: 56,
            padding: '0 16px', borderRadius: 14, background: SET.cardSubtle,
            boxShadow: error ? `inset 0 0 0 2px ${SET.bad}` : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
          }}
        >
          <input
            autoFocus
            value={backupCode}
            onChange={e => { setBackupCode(e.target.value.toUpperCase()); setError(false) }}
            placeholder="XXXX-XXXX"
            maxLength={9}
            style={{
              flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent',
              fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
              fontSize: 18, fontWeight: 700, color: SET.ink, letterSpacing: 1,
              textAlign: 'center',
            }}
          />
        </div>
      )}

      {error && (
        <ErrorBanner>
          Code invalide. {useBackup ? 'Vérifiez le format XXXX-XXXX.' : 'Utilisez le code en cours dans votre app.'}
        </ErrorBanner>
      )}

      <div style={{ marginTop: 18, marginBottom: 6 }}>
        <button
          onClick={() => { setUseBackup(!useBackup); setError(false); setCode(''); setBackupCode('') }}
          style={{
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            fontFamily: FF, fontSize: 12.5, fontWeight: 700,
            color: SET.ink, textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          {useBackup ? '← Utiliser un code à 6 chiffres' : 'Utiliser un code de secours →'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <GhostBtn onClick={onClose}>Annuler</GhostBtn>
        <BlackBtn
          onClick={tryVerify}
          loading={verifying}
          disabled={useBackup ? backupCode.replace(/\s|-/g, '').length !== 8 : code.length !== 6}
          icon={!verifying ? <Icon name="check" size={14} stroke="#fff" sw={2.4} /> : undefined}
        >
          Vérifier
        </BlackBtn>
      </div>

      <div
        style={{
          marginTop: 18, paddingTop: 14, borderTop: `1px solid ${SET.line}`,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11.5, color: SET.muted, fontWeight: 500,
        }}
      >
        <Icon name="help" size={13} stroke={SET.muted} />
        Téléphone perdu ?{' '}
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
            color: SET.ink, textDecoration: 'underline', fontWeight: 600,
            fontFamily: FF, fontSize: 'inherit',
          }}
        >
          Contacter votre admin d'agence
        </button>
      </div>
    </MfaModal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Modale 3 — Reset agent (admin)
// ════════════════════════════════════════════════════════════════════════

export interface MfaAgent { id: string; name: string; email: string }

interface MFAResetAgentModalProps {
  agent: MfaAgent
  onClose: () => void
  onConfirm?: () => void
}

export function MFAResetAgentModal({ agent, onClose, onConfirm }: MFAResetAgentModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [sending, setSending] = useState(false)

  const ok = confirmText.trim().toLowerCase() === agent.name.trim().toLowerCase()

  const submit = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      onConfirm?.()
      onClose()
    }, 700)
  }

  const consequences: { ic: IconName; label: string; val: string }[] = [
    { ic: 'key', label: 'Secret TOTP actuel', val: 'Supprimé' },
    { ic: 'key', label: 'Codes de secours (10)', val: 'Invalidés' },
    { ic: 'logout', label: 'Sessions actives (3)', val: 'Déconnectées' },
    { ic: 'mail', label: 'Email de réenrôlement', val: 'Envoyé' },
  ]

  return (
    <MfaModal onClose={onClose}>
      <ModalHeader
        iconName="refresh"
        iconBg={`${SET.warn}18`}
        iconColor={SET.warn}
        kicker="Action admin · Sécurité"
        title={`Réinitialiser la 2FA de ${agent.name}`}
        onClose={onClose}
      />

      {/* Agent card */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', borderRadius: 14, background: SET.cardSubtle,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            width: 42, height: 42, borderRadius: 12,
            background: '#fff', color: SET.ink,
            display: 'grid', placeItems: 'center', flexShrink: 0,
            fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
          }}
        >
          {agent.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: SET.muted, fontWeight: 500, marginTop: 2 }}>{agent.email}</div>
        </div>
        <span
          style={{
            padding: '4px 10px', borderRadius: 999,
            background: `${SET.ok}18`, color: SET.ok,
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          }}
        >
          2FA active
        </span>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>
        Cette action va <strong>supprimer le secret TOTP actuel</strong> et invalider tous les codes de secours.
        L'agent recevra un email pour se réenregistrer à sa prochaine connexion.
      </p>

      {/* Conséquences */}
      <div style={{ padding: '14px 16px', borderRadius: 12, background: SET.cardSubtle, marginBottom: 14 }}>
        <KickLabel>Conséquences immédiates</KickLabel>
        {consequences.map((r, i, arr) => (
          <div
            key={r.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              paddingBottom: i === arr.length - 1 ? 0 : 8,
              marginBottom: i === arr.length - 1 ? 0 : 8,
              borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${SET.line}`,
            }}
          >
            <Icon name={r.ic} size={13} stroke={SET.muted} />
            <span style={{ flex: 1, fontSize: 12.5, color: SET.ink, fontWeight: 500 }}>{r.label}</span>
            <span
              style={{
                fontSize: 11, fontWeight: 700, color: SET.bad,
                padding: '3px 8px', borderRadius: 999,
                background: `${SET.bad}14`, letterSpacing: 0.3,
              }}
            >
              {r.val}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '12px 14px', borderRadius: 12,
          background: `${SET.warn}14`, marginBottom: 18,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}
      >
        <Icon name="alert" size={15} stroke={SET.warn} sw={2.2} />
        <div style={{ fontSize: 12, color: SET.ink, fontWeight: 500, lineHeight: 1.5 }}>
          Vérifiez l'identité de l'agent par un canal externe (téléphone, en personne) avant de confirmer.
          Cette action est tracée dans le journal d'audit.
        </div>
      </div>

      <label style={{ display: 'block', marginBottom: 18 }}>
        <KickLabel>Saisissez « {agent.name} » pour confirmer</KickLabel>
        <input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={agent.name}
          style={{
            width: '100%', height: 46, padding: '0 14px',
            borderRadius: 12, border: 0, outline: 'none',
            background: SET.cardSubtle,
            boxShadow: ok && confirmText
              ? `inset 0 0 0 2px ${SET.ok}`
              : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
            fontFamily: FF, fontSize: 14, fontWeight: 600, color: SET.ink,
            transition: 'box-shadow .15s',
          }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <GhostBtn onClick={onClose}>Annuler</GhostBtn>
        <button
          onClick={submit} disabled={!ok || sending}
          style={{
            height: 44, padding: '0 22px', border: 0, borderRadius: 999,
            background: (!ok || sending) ? SET.ghost : SET.warn,
            color: (!ok || sending) ? SET.muted : '#fff',
            fontFamily: FF, fontSize: 13.5, fontWeight: 700,
            cursor: (!ok || sending) ? 'not-allowed' : 'pointer',
            boxShadow: (!ok || sending) ? 'none' : '0 6px 16px rgba(217,119,6,0.30)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all .18s',
          }}
        >
          {sending ? (
            <span
              style={{
                width: 14, height: 14, borderRadius: 999,
                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                animation: 'mfaSpin .7s linear infinite',
              }}
            />
          ) : (
            <Icon name="refresh" size={14} stroke="#fff" sw={2.2} />
          )}
          Réinitialiser et notifier
        </button>
      </div>
    </MfaModal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Modale 4 — Régénérer codes de secours
// ════════════════════════════════════════════════════════════════════════

export function MFABackupCodesModal({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <MfaModal onClose={onClose}>
      <ModalHeader
        iconName="key"
        iconBg={`${SET.ink}10`}
        iconColor={SET.ink}
        kicker="Codes de secours"
        title={done ? 'Nouveaux codes générés' : 'Régénérer 10 nouveaux codes'}
        onClose={onClose}
      />

      {!done ? (
        <>
          <div
            style={{
              padding: '12px 14px', borderRadius: 12,
              background: `${SET.warn}14`, marginBottom: 18,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <Icon name="alert" size={15} stroke={SET.warn} sw={2.2} />
            <div style={{ fontSize: 12, color: SET.ink, fontWeight: 500, lineHeight: 1.5 }}>
              Vos 10 codes de secours actuels seront <strong>invalidés immédiatement</strong>. Si quelqu'un les
              a en sa possession, il ne pourra plus les utiliser.
            </div>
          </div>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            Régénérez vos codes si vous pensez qu'ils ont fuité, si vous en avez utilisé plusieurs, ou tous les
            6 mois par hygiène.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <GhostBtn onClick={onClose}>Annuler</GhostBtn>
            <BlackBtn onClick={() => setDone(true)} icon={<Icon name="refresh" size={14} stroke="#fff" sw={2.2} />}>
              Générer de nouveaux codes
            </BlackBtn>
          </div>
        </>
      ) : (
        <>
          <BackupCodesGrid />
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <GhostBtn size="sm" icon={<Icon name="download" size={13} stroke={SET.inkSoft} />}>Télécharger .txt</GhostBtn>
            <GhostBtn size="sm" icon={<Icon name="print" size={13} stroke={SET.inkSoft} />}>Imprimer</GhostBtn>
            <GhostBtn size="sm" icon={<Icon name="copy" size={13} stroke={SET.inkSoft} />}>Tout copier</GhostBtn>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <BlackBtn onClick={onClose} icon={<Icon name="check" size={14} stroke="#fff" sw={2.4} />}>
              J'ai sauvegardé mes codes
            </BlackBtn>
          </div>
        </>
      )}
    </MfaModal>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Carte settings — Politique d'agence : 2FA obligatoire
// ════════════════════════════════════════════════════════════════════════

interface AgentRow {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'pending' | 'blocked'
  enrolledAt: string
  current?: boolean
}

const AGENTS_INIT: AgentRow[] = [
  { id: 'a1', name: 'Julien Morel', email: 'julien.morel@megga.ch', role: 'Admin', status: 'active', enrolledAt: 'il y a 12 jours', current: true },
  { id: 'a2', name: 'Camille Rochat', email: 'camille.rochat@megga.ch', role: 'Senior', status: 'active', enrolledAt: 'il y a 8 jours' },
  { id: 'a3', name: 'Thomas Schenker', email: 'thomas.schenker@megga.ch', role: 'Agent', status: 'active', enrolledAt: 'il y a 6 jours' },
  { id: 'a4', name: 'Léa Vuilleumier', email: 'lea.vuilleumier@megga.ch', role: 'Agent', status: 'pending', enrolledAt: '—' },
  { id: 'a5', name: 'Marc Dübendorfer', email: 'marc.dubendorfer@megga.ch', role: 'Agent', status: 'blocked', enrolledAt: '—' },
  { id: 'a6', name: 'Sophie Pellegrini', email: 'sophie.pellegrini@megga.ch', role: 'Assistant', status: 'active', enrolledAt: 'il y a 2 jours' },
]

export function AgencyMFAPolicyCard() {
  const [enforced, setEnforced] = useState(true)
  const [graceDays, setGraceDays] = useState(7)
  const [allowSMSFallback, setAllowSMSFallback] = useState(false)
  const [agents, setAgents] = useState<AgentRow[]>(AGENTS_INIT)
  const [resetTarget, setResetTarget] = useState<MfaAgent | null>(null)
  const [toast, setToast] = useState<string>('')

  const counts = {
    active: agents.filter(a => a.status === 'active').length,
    pending: agents.filter(a => a.status === 'pending').length,
    blocked: agents.filter(a => a.status === 'blocked').length,
  }
  const total = agents.length

  const handleReset = () => {
    if (!resetTarget) return
    setAgents(prev => prev.map(a => a.id === resetTarget.id ? { ...a, status: 'pending', enrolledAt: '—' } : a))
    setToast(`2FA réinitialisée pour ${resetTarget.name}`)
    setTimeout(() => setToast(''), 2400)
  }

  const handleResend = (agent: AgentRow) => {
    setToast(`Email de configuration renvoyé à ${agent.name}`)
    setTimeout(() => setToast(''), 2400)
  }

  return (
    <>
      <div style={{ background: SET.card, borderRadius: 24, padding: 0, boxShadow: SET.shadow, overflow: 'hidden', fontFamily: FF }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: `${SET.ink}08`, color: SET.ink,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            <Icon name="shield" size={20} stroke={SET.ink} sw={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: SET.ink, letterSpacing: -0.2 }}>
                Politique d'agence — 2FA obligatoire
              </h3>
              <span
                style={{
                  padding: '2px 8px', borderRadius: 999,
                  background: `${SET.ink}10`, color: SET.ink,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}
              >
                Admin
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: SET.muted, fontWeight: 500, lineHeight: 1.5 }}>
              Imposer l'authentification TOTP à tous les agents de votre agence. Recommandé pour les agences
              traitant des transactions immobilières.
            </p>
          </div>
          <Switch value={enforced} onChange={setEnforced} />
        </div>

        {enforced && (
          <>
            {/* Stats */}
            <div style={{ padding: '0 28px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Stat label="Agents" value={total} tone="neutral" />
              <Stat label="2FA active" value={counts.active} tone="ok" />
              <Stat label="En attente" value={counts.pending} tone="warn" />
              <Stat label="Bloqués" value={counts.blocked} tone="bad" />
            </div>

            {/* Réglages */}
            <div
              style={{
                padding: '18px 28px', borderTop: `1px solid ${SET.line}`,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
              }}
            >
              <div>
                <KickLabel>Délai de grâce</KickLabel>
                <select
                  value={graceDays} onChange={e => setGraceDays(Number(e.target.value))}
                  style={{
                    width: '100%', height: 44, padding: '0 14px',
                    borderRadius: 12, border: 0, outline: 'none',
                    background: SET.cardSubtle,
                    fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: SET.ink,
                    cursor: 'pointer',
                  }}
                >
                  <option value={0}>Immédiat — accès bloqué tout de suite</option>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours (recommandé)</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </select>
                <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                  Temps laissé aux agents pour configurer leur 2FA avant blocage.
                </div>
              </div>
              <div>
                <KickLabel>Méthodes acceptées</KickLabel>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    height: 44, padding: '0 14px',
                    borderRadius: 12, background: SET.cardSubtle,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: SET.ink }}>SMS comme fallback</span>
                  <Switch value={allowSMSFallback} onChange={setAllowSMSFallback} size="sm" />
                </div>
                <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                  {allowSMSFallback
                    ? "SMS autorisé si l'agent perd son authentificateur."
                    : 'TOTP uniquement. Plus sûr — résistant au SIM swap.'}
                </div>
              </div>
            </div>

            {/* Agents list */}
            <div style={{ borderTop: `1px solid ${SET.line}` }}>
              <div style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>
                  Statut par agent
                </div>
                <span style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500 }}>
                  {total} membres · mis à jour à l'instant
                </span>
              </div>
              <div>
                {agents.map(a => (
                  <div
                    key={a.id}
                    style={{
                      padding: '14px 28px', borderTop: `1px solid ${SET.line}`,
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: SET.cardSubtle, color: SET.ink,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                        fontFamily: 'Georgia, serif', fontSize: 13.5, fontWeight: 700,
                      }}
                    >
                      {a.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>
                          {a.name}
                        </span>
                        {a.current && (
                          <span
                            style={{
                              padding: '2px 7px', borderRadius: 999,
                              background: `${SET.ok}18`, color: SET.ok,
                              fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                            }}
                          >
                            Vous
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 10.5, color: SET.muted, fontWeight: 600,
                            padding: '2px 7px', borderRadius: 999, background: SET.cardSubtle,
                          }}
                        >
                          {a.role}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: SET.muted, fontWeight: 500, marginTop: 2 }}>
                        {a.email}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
                      <div style={{ marginBottom: 3 }}><StatusPill status={a.status} /></div>
                      <div style={{ fontSize: 11, color: SET.muted, fontWeight: 500 }}>
                        {a.status === 'active' ? `Activée ${a.enrolledAt}`
                        : a.status === 'pending' ? 'Email envoyé'
                        : 'Délai dépassé'}
                      </div>
                    </div>
                    {!a.current && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {a.status === 'pending' && (
                          <GhostBtn size="sm" onClick={() => handleResend(a)} icon={<Icon name="mail" size={12} stroke={SET.inkSoft} />}>
                            Relancer
                          </GhostBtn>
                        )}
                        {a.status === 'active' && (
                          <GhostBtn size="sm" onClick={() => setResetTarget({ id: a.id, name: a.name, email: a.email })} icon={<Icon name="refresh" size={12} stroke={SET.inkSoft} />}>
                            Réinitialiser
                          </GhostBtn>
                        )}
                        {a.status === 'blocked' && (
                          <GhostBtn size="sm" onClick={() => handleResend(a)} icon={<Icon name="mail" size={12} stroke={SET.inkSoft} />}>
                            Renvoyer config
                          </GhostBtn>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!enforced && (
          <div
            style={{
              padding: '20px 28px 24px', borderTop: `1px solid ${SET.line}`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}
          >
            <Icon name="info" size={15} stroke={SET.muted} />
            <div style={{ fontSize: 12.5, color: SET.muted, fontWeight: 500, lineHeight: 1.5 }}>
              Politique désactivée. Chaque agent active la 2FA individuellement depuis ses paramètres. Risque
              de phishing accru.
            </div>
          </div>
        )}
      </div>

      {resetTarget && (
        <MFAResetAgentModal
          agent={resetTarget}
          onClose={() => setResetTarget(null)}
          onConfirm={handleReset}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
            background: SET.ink, color: '#fff',
            padding: '12px 20px', borderRadius: 14,
            fontSize: 13, fontWeight: 600, fontFamily: FF,
            boxShadow: '0 12px 40px rgba(11,12,14,0.30)',
            display: 'flex', alignItems: 'center', gap: 10, zIndex: 300,
          }}
        >
          <Icon name="check" size={14} stroke="#fff" sw={2.4} />
          {toast}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const map: Record<string, { fg: string; bg: string }> = {
    neutral: { fg: SET.ink, bg: SET.cardSubtle },
    ok: { fg: SET.ok, bg: `${SET.ok}12` },
    warn: { fg: SET.warn, bg: `${SET.warn}14` },
    bad: { fg: SET.bad, bg: `${SET.bad}12` },
  }
  const m = map[tone]
  return (
    <div style={{ padding: '14px 16px', borderRadius: 14, background: m.bg }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: SET.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: m.fg, letterSpacing: -0.5, fontFamily: 'Georgia, serif' }}>
        {value}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: 'active' | 'pending' | 'blocked' }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: `${SET.ok}18`, fg: SET.ok, label: 'Activée' },
    pending: { bg: `${SET.warn}18`, fg: SET.warn, label: 'En attente' },
    blocked: { bg: `${SET.bad}18`, fg: SET.bad, label: 'Accès bloqué' },
  }
  const m = map[status]
  return (
    <span
      style={{
        padding: '4px 10px', borderRadius: 999,
        background: m.bg, color: m.fg,
        fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  )
}

// Suppress unused — kept for potential consumers
void Fragment
const _kept: CSSProperties = {}
void _kept
