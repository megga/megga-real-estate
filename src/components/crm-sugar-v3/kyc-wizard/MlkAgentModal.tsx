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

import { useState, useMemo, useId } from 'react'
import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycBlackPill, KycGhostPill } from '../primitives'
import { useCreateMagicLink } from '@/hooks/useMagicLink'
import type {
  MagicLinkChannel,
  MagicLinkMode,
  CreateMagicLinkResponse,
} from '@/types/magicLink'
import { useFocusTrap } from '@/hooks/useFocusTrap'

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
  const { t } = useTranslation('kyc')
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        padding: 'var(--crm-space-4xl) var(--crm-space-4xl) var(--crm-space-3xl)',
        borderRadius: 'var(--crm-radius-3xl)',
        background: selected ? SugarV3.black : SugarV3.cardSubtle,
        color: selected ? '#fff' : SugarV3.ink,
        boxShadow: selected
          ? '0 14px 32px rgba(11,12,14,0.20), 0 4px 12px rgba(11,12,14,0.10)'
          : 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-lg)',
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
            padding: 'var(--crm-space-2xs) var(--crm-space-md)',
            borderRadius: 'var(--crm-radius-pill)',
            background: selected ? 'rgba(255,255,255,0.16)' : SugarV3.black,
            color: '#fff',
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {t('wizard.magic.recommended')}
        </span>
      )}
      <div>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-md)',
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
          gap: 'var(--crm-space-sm)',
          marginTop: 4,
          fontSize: 'var(--crm-text-xs)',
          fontWeight: 600,
          color: selected ? 'rgba(255,255,255,0.88)' : SugarV3.inkSoft,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span
          style={{
            padding: 'var(--crm-space-2xs) var(--crm-space-md)',
            borderRadius: 'var(--crm-radius-pill)',
            background: selected ? 'rgba(255,255,255,0.12)' : 'rgba(11,12,14,0.05)',
          }}
        >
          {duration}
        </span>
        <span
          style={{
            padding: 'var(--crm-space-2xs) var(--crm-space-md)',
            borderRadius: 'var(--crm-radius-pill)',
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
        padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-xl)',
        background: SugarV3.card,
        boxShadow: selected ? SugarV3.shadow : SugarV3.shadowSm,
        outline: selected ? `2px solid ${SugarV3.black}` : 'none',
        outlineOffset: -1,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-xl)',
        transition: 'all .18s ease',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 'var(--crm-radius-xs)',
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
          borderRadius: 'var(--crm-radius-pill)',
          flexShrink: 0,
          background: SugarV3.cardSubtle,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SgIcon name={icon} size={15} stroke={SugarV3.ink} sw={1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: SugarV3.ink, letterSpacing: -0.1 }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--crm-text-sm)', color: SugarV3.muted, fontWeight: 500, marginTop: 1 }}>
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

  // ⚠ Le dialogue est nommé par SON TITRE VISIBLE, pas par une chaîne recopiée :
  // les deux vues (formulaire, succès) portent des titres différents et une
  // seule est montée à la fois, donc l'identifiant désigne toujours celui qui
  // est à l'écran. Une chaîne en dur aurait divergé du titre au premier
  // remaniement, et personne ne l'aurait vu — un nom accessible ne s'affiche pas.
  const titreId = useId()

  return (
    <ModalOverlay onClose={onClose} titreId={titreId}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 32px)',
          background: SugarV3.card,
          borderRadius: 'var(--crm-radius-6xl)',
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
            titreId={titreId}
            link={createdLink}
            contactName={contactName}
            copyState={copyState}
            onCopy={handleCopy}
            onClose={onClose}
          />
        ) : (
          <FormView
            titreId={titreId}
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

function ModalOverlay({ children, onClose, titreId }: { children: ReactNode; onClose: () => void; titreId: string }) {
  // ⚠ Le piège vit dans la COQUILLE, pas dans son contenu : c'est elle qui
  // porte `role="dialog"`, et elle enveloppe tout ce que la modale affiche.
  const refPiegeFocus = useFocusTrap(true, onClose)
  return (
    <div
      ref={refPiegeFocus}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titreId}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--crm-space-7xl)',
      }}
    >
      {children}
    </div>
  )
}

// ─── Form view (édition initiale) ─────────────────────────────────────────

interface FormViewProps {
  /** Identifiant posé sur le titre : c'est lui qui NOMME le dialogue. */
  titreId: string
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
  titreId,
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
  const { t } = useTranslation('kyc')
  const firstName = contactName.split(' ')[0]
  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '28px 32px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--crm-space-3xl)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 700,
              color: SugarV3.muted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {t('wizard.magic.eyebrow')}
          </div>
          <h2
            id={titreId}
            style={{
              margin: 0,
              fontSize: 'var(--crm-text-5xl)',
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.6,
              lineHeight: 1.15,
            }}
          >
            {t('wizard.magic.title', { firstName })}
          </h2>
          {contactSummary && (
            <div style={{ marginTop: 8, fontSize: 'var(--crm-text-lg)', color: SugarV3.muted, fontWeight: 500 }}>
              {contactSummary}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('wizard.magic.close')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--crm-radius-pill)',
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
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {t('wizard.magic.modeLabel')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--crm-space-lg)',
            marginBottom: 22,
          }}
        >
          <MlkModeCard
            selected={mode === 'libre'}
            title={t('wizard.magic.modeLibre.title')}
            sub={t('wizard.magic.modeLibre.sub')}
            duration={t('wizard.magic.modeLibre.duration')}
            steps={t('wizard.magic.modeLibre.steps')}
            onClick={() => setMode('libre')}
          />
          <MlkModeCard
            selected={mode === 'verifiee'}
            title={t('wizard.magic.modeVerifiee.title')}
            sub={t('wizard.magic.modeVerifiee.sub')}
            duration={t('wizard.magic.modeVerifiee.duration')}
            steps={t('wizard.magic.modeVerifiee.steps')}
            recommended
            onClick={() => setMode('verifiee')}
          />
        </div>

        {/* Channels */}
        <div
          style={{
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {t('wizard.magic.channelLabel')}
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginBottom: 22 }}>
          <MlkChannelChip
            icon="mail"
            label={t('wizard.magic.channelEmail')}
            sub={contactEmail ?? t('wizard.magic.noEmail')}
            selected={channels.includes('email')}
            disabled={!contactEmail}
            onClick={() => toggleChannel('email')}
          />
          <MlkChannelChip
            icon="phone"
            label={t('wizard.magic.channelSms')}
            sub={contactPhone ?? t('wizard.magic.noPhone')}
            selected={channels.includes('sms')}
            disabled={!contactPhone}
            onClick={() => toggleChannel('sms')}
          />
        </div>

        {/* Custom message */}
        <div
          style={{
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {t('wizard.magic.messageLabel')}
        </div>
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value.slice(0, 500))}
          placeholder={
            defaultMessagePlaceholder ??
            t('wizard.magic.messagePlaceholder', { firstName })
          }
          rows={3}
          style={{
            width: '100%',
            padding: 'var(--crm-space-2xl) var(--crm-space-3xl)',
            borderRadius: 'var(--crm-radius-xl)',
            background: SugarV3.cardSubtle,
            color: SugarV3.ink,
            fontSize: 'var(--crm-text-lg)',
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
            gap: 'var(--crm-space-lg)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            background: SugarV3.cardSubtle,
            borderRadius: 'var(--crm-radius-lg)',
            marginBottom: 24,
          }}
        >
          <SgIcon name="clock" size={14} stroke={SugarV3.muted} sw={1.8} />
          <span
            style={{
              fontSize: 'var(--crm-text-sm)',
              color: SugarV3.muted,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            <Trans
              i18nKey="kyc:wizard.magic.expiryNote"
              components={{ 1: <strong style={{ color: SugarV3.ink, fontWeight: 700 }} /> }}
            />
          </span>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-lg)',
              background: SugarV3.errSoft,
              color: SugarV3.errDarker,
              fontSize: 'var(--crm-text-md)',
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
          gap: 'var(--crm-space-3xl)',
        }}
      >
        <KycGhostPill onClick={onClose}>{t('wizard.magic.cancel')}</KycGhostPill>
        <KycBlackPill
          size="md"
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          icon={<SgIcon name="arrowR" size={16} stroke="#fff" sw={2} />}
        >
          {isPending
            ? t('wizard.magic.sending')
            : t('wizard.magic.sendLink', { firstName })}
        </KycBlackPill>
      </div>
    </>
  )
}

// ─── Success view (après création) ────────────────────────────────────────

interface SuccessViewProps {
  /** Identifiant posé sur le titre : c'est lui qui NOMME le dialogue. */
  titreId: string
  link: CreateMagicLinkResponse
  contactName: string
  copyState: 'idle' | 'copied'
  onCopy: () => void
  onClose: () => void
}

function SuccessView({ titreId, link, contactName, copyState, onCopy, onClose }: SuccessViewProps) {
  const { t } = useTranslation('kyc')
  const firstName = contactName.split(' ')[0]
  return (
    <>
      <div style={{ padding: '40px 40px 24px', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--crm-radius-pill)',
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
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 700,
            color: SugarV3.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {t('wizard.magic.success.eyebrow')}
        </div>
        <h2
          id={titreId}
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--crm-text-5xl)',
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.6,
            lineHeight: 1.15,
          }}
        >
          {t('wizard.magic.success.title', { firstName })}
        </h2>
        <p
          style={{
            margin: '0 0 22px',
            fontSize: 'var(--crm-text-lg)',
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
            maxWidth: 460,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {t('wizard.magic.success.body', { firstName })}
        </p>
      </div>

      <div style={{ padding: '0 32px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
            background: SugarV3.cardSubtle,
            borderRadius: 'var(--crm-radius-xl)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--crm-text-xs)',
                fontWeight: 700,
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {t('wizard.magic.success.urlLabel')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
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
            {copyState === 'copied' ? t('wizard.magic.success.copied') : t('wizard.magic.success.copy')}
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
          gap: 'var(--crm-space-3xl)',
        }}
      >
        <KycBlackPill size="md" onClick={onClose}>
          {t('wizard.magic.success.close')}
        </KycBlackPill>
      </div>
    </>
  )
}
