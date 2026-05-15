// MEGGA Marketplace — Property X "Top Notification Bar" section.
// Source : Figma node 11709:33362 — code Figma EXACT (3 variantes V1/V2/V3).
//
// Anatomie commune (V1/V2/V3) :
//   <section bg neutral700 py-24 px-0 flex items-center justify-center overflow-clip>
//     <Container>...</Container>
//     <Close X icon absolute right-32 size-20 top-1/2>
//   </section>
//
// Variantes :
//   V1 (plain)  — texte centré seul (node 11709:33363, 1440×72)
//   V2 (button) — texte + bouton invert "Get started" (node 11709:33367, 1440×88)
//   V3 (form)   — texte + email input avec bouton Subscribe à l'intérieur (node 11709:33372, 1440×100)
//
// La barre est dismissible (X) — état local (sessionStorage si dismissKey fourni).
// Si la section est ajoutée à une page, elle se place AU-DESSUS de PxNav.

import { useState, type FormEvent } from 'react'
import { PX, PxButton, PxFigmaIcon } from '..'

export type PxTopNotificationBarVariant = 'plain' | 'button' | 'form'

interface PxTopNotificationBarProps {
  variant?: PxTopNotificationBarVariant
  message?: string
  // V2
  buttonText?: string
  buttonHref?: string
  onButtonClick?: () => void
  // V3
  placeholder?: string
  submitText?: string
  onSubmit?: (email: string) => void
  // Dismiss
  onDismiss?: () => void
  dismissKey?: string
}

const DEFAULT_MESSAGE = 'Get a lifetime account for a one-time payment of $99'

export default function PxTopNotificationBar({
  variant = 'plain',
  message = DEFAULT_MESSAGE,
  buttonText = 'Get started',
  buttonHref,
  onButtonClick,
  placeholder = 'Enter your email',
  submitText = 'Subscribe',
  onSubmit,
  onDismiss,
  dismissKey,
}: PxTopNotificationBarProps) {
  const storageKey = dismissKey ? `px-notif-${dismissKey}` : null
  const [dismissed, setDismissed] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return false
    return window.sessionStorage.getItem(storageKey) === '1'
  })
  const [email, setEmail] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (storageKey && typeof window !== 'undefined') {
      window.sessionStorage.setItem(storageKey, '1')
    }
    onDismiss?.()
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    onSubmit?.(email.trim())
  }

  return (
    <section
      data-node-id="11709:33362"
      style={{
        position: 'relative',
        width: '100%',
        background: PX.neutral700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        // Spacings/X Large = 24px (py-x-large), pas de padding horizontal sur la section
        paddingTop: PX.space.xLarge,
        paddingBottom: PX.space.xLarge,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      {variant === 'plain' && <PlainContent message={message} />}
      {variant === 'button' && (
        <ButtonContent
          message={message}
          buttonText={buttonText}
          buttonHref={buttonHref}
          onButtonClick={onButtonClick}
        />
      )}
      {variant === 'form' && (
        <FormContent
          message={message}
          placeholder={placeholder}
          submitText={submitText}
          email={email}
          setEmail={setEmail}
          focused={emailFocused}
          setFocused={setEmailFocused}
          onSubmit={handleSubmit}
        />
      )}

      {/* Close X — absolute right-32 size-20 top-1/2 */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        style={{
          position: 'absolute',
          right: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20,
          height: 20,
          padding: 0,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          color: PX.neutral100,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PxFigmaIcon name="close" size={14.5} color={PX.neutral100} />
      </button>
    </section>
  )
}

// ─── V1 : plain text centered ────────────────────────────────────────
function PlainContent({ message }: { message: string }) {
  return (
    <p
      data-node-id="11734:15200"
      style={{
        margin: 0,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.5,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </p>
  )
}

// ─── V2 : text + invert button (gap 24) ──────────────────────────────
function ButtonContent({
  message,
  buttonText,
  buttonHref,
  onButtonClick,
}: {
  message: string
  buttonText: string
  buttonHref?: string
  onButtonClick?: () => void
}) {
  return (
    <div
      data-node-id="11709:33368"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: PX.space.xLarge, // 24px
      }}
    >
      <p
        data-node-id="11709:33369"
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </p>
      {buttonHref ? (
        <PxButton variant="invert" size="sm" href={buttonHref}>
          {buttonText}
        </PxButton>
      ) : (
        <PxButton variant="invert" size="sm" onClick={onButtonClick}>
          {buttonText}
        </PxButton>
      )}
    </div>
  )
}

// ─── V3 : text + email input with embedded Subscribe button ─────────
function FormContent({
  message,
  placeholder,
  submitText,
  email,
  setEmail,
  focused,
  setFocused,
  onSubmit,
}: {
  message: string
  placeholder: string
  submitText: string
  email: string
  setEmail: (v: string) => void
  focused: boolean
  setFocused: (v: boolean) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div
      data-node-id="11709:33373"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 1200,
        maxWidth: 'calc(100% - 128px)', // marge pour la X (32px) + padding
      }}
    >
      <p
        data-node-id="11709:33374"
        style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </p>

      {/* Input Text — node 11734:15086 */}
      <form
        onSubmit={onSubmit}
        data-node-id="11734:15086"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: 380,
          minHeight: 52,
          background: PX.neutral700,
          // Outline au focus (pas de border permanent dans Figma — ajout d'un outline
          // qui ne pousse pas la box-size, conservant la hauteur 100px).
          outline: focused ? `1px solid ${PX.neutral400}` : 'none',
          outlineOffset: 0,
          borderRadius: PX.radius.pill,
          paddingLeft: PX.space.large,  // 16px
          paddingRight: PX.space.xSmall, // 6px
          paddingTop: PX.space.xSmall,
          paddingBottom: PX.space.xSmall,
          boxSizing: 'border-box',
          transition: `outline-color ${PX.duration.base} ${PX.ease}`,
        }}
      >
        <style>{`.px-tnb-input::placeholder { color: ${PX.neutral100}; opacity: 1; }`}</style>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="px-tnb-input"
          style={{
            flex: '1 0 0',
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            paddingTop: 2,   // pt-xx-small dans Figma (Wrapper)
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
          }}
        />
        <PxButton variant="invert" size="sm" type="submit">
          {submitText}
        </PxButton>
      </form>
    </div>
  )
}
