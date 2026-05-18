// MEGGA CRM Sugar v3 — Modal agent KYC Magic Link
// Sprint 4.7.B — Port pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
// (composant MlkAgentModal lignes 1067-1186).
//
// Direction artistique : Sugar Pure strict, tokens SugarV3.*, accent noir #0B0C0E.
// L'agent choisit le mode (Libre / Vérifiée), les canaux (Email / SMS),
// personnalise un message optionnel, puis envoie le lien magique au client.
//
// Workflow :
//   1. Modal s'ouvre avec contact pré-rempli (depuis wizard ou détail dossier)
//   2. Sélection mode + channels + message
//   3. Submit → useCreateMagicLink → Edge function magic-link-create
//   4. Affichage du résultat : URL + bouton "Copier" + bouton "Fermer"

import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycBlackPill, KycGhostPill } from '../primitives'
import { useCreateMagicLink } from '@/hooks/useMagicLink'
import type {
  MagicLinkChannel,
  MagicLinkMode,
  CreateMagicLinkResponse,
} from '@/types/magicLink'

interface Props {
  kycCaseId: string
  contactId: string
  contactName: string                    // ex: "Sophie Marie Bernard"
  contactSummary?: string                // ex: "Acheteuse · 4 pièces Eaux-Vives"
  contactEmail?: string | null
  contactPhone?: string | null
  /** Pré-sélection du mode (Vigilance renforcée → 'verifiee'). */
  defaultMode?: MagicLinkMode
  /** Texte placeholder du message custom (signature agent). */
  defaultMessagePlaceholder?: string
  onClose: () => void
  /** Callback appelé quand le lien est créé avec succès. */
  onSuccess?: (link: CreateMagicLinkResponse) => void
}

interface ModeCardProps {
  selected: boolean
  title: string
  sub: string
  duration: string
  steps: string
  recommended?: boolean
  onClick: () => void
}

function MlkModeCard({ selected, title, sub, duration, steps, recommended, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        padding: '18px 18px 16px',
        borderRadius: 18,
        background: selected ? SugarV3.black : SugarV3.cardSubtle,
        color: selected ? '#fff' : SugarV3.ink,
        boxShadow: selected
          ? '0 14px 32px rgba(11,12,14,0.20), 0 4px 12px rgba(11,12,14,0.10)'
          : 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        transition: 'all .2s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      {recommended && (
        <span
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '3px 9px',
            borderRadius: 999,
            background: selected ? 'rgba(255,255,255,0.16)' : SugarV3.black,
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Conseillé
        </span>
      )}
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: selected ? 'rgba(255,255,255,0.70)' : SugarV3.muted,
            lineHeight: 1.45,
          }}
        >
          {sub}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 4,
          fontSize: 10.5,
          fontWeight: 600,
          color: selected ? 'rgba(255,255,255,0.88)' : SugarV3.inkSoft,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: selected ? 'rgba(255,255,255,0.12)' : 'rgba(11,12,14,0.05)',
          }}
        >
          {duration}
        </span>
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: selected ? 'rgba(255,255,255,0.12)' : 'rgba(11,12,14,0.05)',
          }}
        >
          {steps}
        </span>
      </div>
    </button>
  )
}

interface ChannelChipProps {
  icon: 'mail' | 'phone'
  label: string
  sub: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}

function MlkChannelChip({ icon, label, sub, selected, disabled, onClick }: ChannelChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        textAlign: 'left',
        border: 0,
        padding: '12px 14px',
        borderRadius: 14,
        background: SugarV3.card,
        boxShadow: selected ? SugarV3.shadow : SugarV3.shadowSm,
        outline: selected ? `2px solid ${SugarV3.black}` : 'none',
        outlineOffset: -1,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all .18s ease',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          flexShrink: 0,
          background: selected ? SugarV3.black : 'transparent',
          boxShadow: selected ? 'none' : 'inset 0 0 0 1.5px rgba(11,12,14,0.22)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {selected && <SgIcon name="check" size={11} stroke="#fff" sw={3} />}
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          flexShrink: 0,
          background: SugarV3.cardSubtle,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SgIcon name={icon} size={15} stroke={SugarV3.ink} sw={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: SugarV3.ink, letterSpacing: -0.1 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: SugarV3.muted, fontWeight: 500, marginTop: 1 }}>
          {sub}
        </div>
      </div>
    </button>
  )
}

// ─── Modal principal ─────────────────────────────────────────────────────

export function MlkAgentModal({
  kycCaseId,
  contactId,
  contactName,
  contactSummary,
  contactEmail,
  contactPhone,
  defaultMode = 'verifiee',
  defaultMessagePlaceholder,
  onClose,
  onSuccess,
}: Props) {
  const createLink = useCreateMagicLink()
  const [mode, setMode] = useState<MagicLinkMode>(defaultMode)
  const [channels, setChannels] = useState<MagicLinkChannel[]>(() => {
    const initial: MagicLinkChannel[] = []
    if (contactEmail) initial.push('email')
    if (!initial.length && contactPhone) initial.push('sms')
    if (!initial.length) initial.push('email')
    return initial
  })
  const [customMessage, setCustomMessage] = useState('')
  const [createdLink, setCreatedLink] = useState<CreateMagicLinkResponse | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const canSubmit = useMemo(() => {
    if (channels.length === 0) return false
    if (channels.includes('email') && !contactEmail) return false
    if (channels.includes('sms') && !contactPhone) return false
    return true
  }, [channels, contactEmail, contactPhone])

  const toggleChannel = (c: MagicLinkChannel) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      const result = await createLink.mutateAsync({
        kyc_case_id: kycCaseId,
        contact_id: contactId,
        mode,
        channels,
        custom_message: customMessage.trim() || null,
        expiration_days: 7,
      })
      setCreatedLink(result)
      onSuccess?.(result)
    } catch (err) {
      // L'erreur est affichée via createLink.error
      console.error('Magic link creation failed:', err)
    }
  }

  const handleCopy = async () => {
    if (!createdLink) return
    try {
      await navigator.clipboard.writeText(createdLink.url)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Best effort — pas critique
    }
  }

  const errorMessage = createLink.error instanceof Error ? createLink.error.message : null

  return (
    <ModalOverlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 32px)',
          background: SugarV3.card,
          borderRadius: 28,
          boxShadow:
            '0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)',
          fontFamily: SugarV3.font,
          color: SugarV3.ink,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
          overflow: 'hidden',
        }}
      >
        {createdLink ? (
          <SuccessView
            link={createdLink}
            contactName={contactName}
            copyState={copyState}
            onCopy={handleCopy}
            onClose={onClose}
          />
        ) : (
          <FormView
            contactName={contactName}
            contactSummary={contactSummary}
            contactEmail={contactEmail}
            contactPhone={contactPhone}
            mode={mode}
            setMode={setMode}
            channels={channels}
            toggleChannel={toggleChannel}
            customMessage={customMessage}
            setCustomMessage={setCustomMessage}
            defaultMessagePlaceholder={defaultMessagePlaceholder}
            canSubmit={canSubmit}
            isPending={createLink.isPending}
            errorMessage={errorMessage}
            onClose={onClose}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </ModalOverlay>
  )
}

// ─── Overlay wrapper (fond semi-transparent + clic backdrop ferme) ────────

function ModalOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {children}
    </div>
  )
}

// ─── Form view (édition initiale) ─────────────────────────────────────────

interface FormViewProps {
  contactName: string
  contactSummary?: string
  contactEmail?: string | null
  contactPhone?: string | null
  mode: MagicLinkMode
  setMode: (m: MagicLinkMode) => void
  channels: MagicLinkChannel[]
  toggleChannel: (c: MagicLinkChannel) => void
  customMessage: string
  setCustomMessage: (s: string) => void
  defaultMessagePlaceholder?: string
  canSubmit: boolean
  isPending: boolean
  errorMessage: string | null
  onClose: () => void
  onSubmit: () => void
}

function FormView({
  contactName,
  contactSummary,
  contactEmail,
  contactPhone,
  mode,
  setMode,
  channels,
  toggleChannel,
  customMessage,
  setCustomMessage,
  defaultMessagePlaceholder,
  canSubmit,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: FormViewProps) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '28px 32px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: SugarV3.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Lien magique · KYC
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.6,
              lineHeight: 1.15,
            }}
          >
            Demander ses pièces à {contactName.split(' ')[0]}
          </h2>
          {contactSummary && (
            <div style={{ marginTop: 8, fontSize: 13, color: SugarV3.muted, fontWeight: 500 }}>
              {contactSummary}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            border: 0,
            background: SugarV3.cardSubtle,
            color: SugarV3.inkSoft,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <SgIcon name="close" size={16} stroke={SugarV3.inkSoft} sw={2} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0 32px 8px' }}>
        {/* Mode */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Mode de collecte
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 22,
          }}
        >
          <MlkModeCard
            selected={mode === 'libre'}
            title="Libre"
            sub="Le client dépose ses pièces et c'est tout. Vous vérifiez vous-même côté CRM."
            duration="3 min"
            steps="2 écrans"
            onClick={() => setMode('libre')}
          />
          <MlkModeCard
            selected={mode === 'verifiee'}
            title="Vérifiée"
            sub="Le client confirme les données détectées sur ses pièces avant envoi."
            duration="5 min"
            steps="3 écrans"
            recommended
            onClick={() => setMode('verifiee')}
          />
        </div>

        {/* Channels */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Envoyer par
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
          <MlkChannelChip
            icon="mail"
            label="Email"
            sub={contactEmail ?? 'Aucun email renseigné'}
            selected={channels.includes('email')}
            disabled={!contactEmail}
            onClick={() => toggleChannel('email')}
          />
          <MlkChannelChip
            icon="phone"
            label="SMS"
            sub={contactPhone ?? 'Aucun téléphone renseigné'}
            selected={channels.includes('sms')}
            disabled={!contactPhone}
            onClick={() => toggleChannel('sms')}
          />
        </div>

        {/* Custom message */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Message personnalisé · optionnel
        </div>
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value.slice(0, 500))}
          placeholder={
            defaultMessagePlaceholder ??
            `Bonjour ${contactName.split(' ')[0]},\nComme convenu, voici le lien pour finaliser votre dossier KYC. À très vite.`
          }
          rows={3}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 14,
            background: SugarV3.cardSubtle,
            color: SugarV3.ink,
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 500,
            marginBottom: 22,
            boxSizing: 'border-box',
            border: 0,
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            minHeight: 80,
          }}
        />

        {/* Info expiry */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: SugarV3.cardSubtle,
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <SgIcon name="clock" size={14} stroke={SugarV3.muted} sw={1.8} />
          <span
            style={{
              fontSize: 11.5,
              color: SugarV3.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            Le lien expire dans{' '}
            <strong style={{ color: SugarV3.ink, fontWeight: 700 }}>7 jours</strong>. L&apos;envoi
            est consigné dans la piste d&apos;audit LBA art. 7.
          </span>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: SugarV3.errSoft,
              color: SugarV3.errDarker,
              fontSize: 12.5,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '18px 32px 26px',
          background: SugarV3.cardSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <KycGhostPill onClick={onClose}>Annuler</KycGhostPill>
        <KycBlackPill
          size="md"
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          icon={<SgIcon name="arrowR" size={16} stroke="#fff" sw={2} />}
        >
          {isPending
            ? 'Envoi en cours…'
            : `Envoyer le lien à ${contactName.split(' ')[0]}`}
        </KycBlackPill>
      </div>
    </>
  )
}

// ─── Success view (après création) ────────────────────────────────────────

interface SuccessViewProps {
  link: CreateMagicLinkResponse
  contactName: string
  copyState: 'idle' | 'copied'
  onCopy: () => void
  onClose: () => void
}

function SuccessView({ link, contactName, copyState, onCopy, onClose }: SuccessViewProps) {
  return (
    <>
      <div style={{ padding: '40px 40px 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            margin: '0 auto 22px',
            background: SugarV3.okSoft,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SgIcon name="check" size={32} stroke={SugarV3.okDark} sw={2.5} />
        </div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Lien magique créé
        </div>
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: 26,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.6,
            lineHeight: 1.15,
          }}
        >
          Lien envoyé à {contactName.split(' ')[0]}
        </h2>
        <p
          style={{
            margin: '0 0 22px',
            fontSize: 13.5,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
            maxWidth: 460,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {contactName.split(' ')[0]} recevra le lien dans quelques secondes. Vous serez
          notifié dès qu&apos;il dépose ses pièces ou si rien n&apos;arrive sous 3 jours.
        </p>
      </div>

      <div style={{ padding: '0 32px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            background: SugarV3.cardSubtle,
            borderRadius: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              URL sécurisée · expire dans 7 jours
            </div>
            <div
              style={{
                fontSize: 13,
                color: SugarV3.ink,
                fontWeight: 600,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {link.url}
            </div>
          </div>
          <KycGhostPill
            onClick={onCopy}
            icon={
              <SgIcon
                name={copyState === 'copied' ? 'check' : 'file'}
                size={14}
                stroke={copyState === 'copied' ? SugarV3.okDark : SugarV3.inkSoft}
                sw={1.8}
              />
            }
          >
            {copyState === 'copied' ? 'Copié' : 'Copier'}
          </KycGhostPill>
        </div>
      </div>

      <div
        style={{
          padding: '18px 32px 26px',
          background: SugarV3.cardSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
        }}
      >
        <KycBlackPill size="md" onClick={onClose}>
          Fermer
        </KycBlackPill>
      </div>
    </>
  )
}
