// MEGGA — Écrans du parcours client KYC Magic Link
// Sprint 4.7.C — Port pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
// Sprint 4.7.F — Brancher i18n (FR/DE/EN/IT) + responsive mobile (@media query
// sur le grid de réassurance et les tailles de titre).
//
// 4 écrans :
//   1. MlkLanding  — accueil rassurant (Bonjour <prénom>, finalisons votre dossier)
//   2. MlkUpload   — drop zone + sélecteur type + liste uploaded + CTA confirm
//   3. MlkSuccess  — confirmation finale
//   4. MlkExpired  — lien expiré
//
// Mode 'verifiee' (OCR) → couvert par Sprint 4.7.D (composant MlkVerified à venir).

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MlkAgentAvatar,
  MlkBlackPill,
  MlkFooter,
  MlkIcon,
  MlkReassureRow,
  MlkShell,
  MlkWordmark,
} from './MlkPrimitives'
import { MLK, MLK_STATUT } from './mlkTokens'
import { crmVoileEncre } from '@/components/crm/tokens'

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateShort(iso: string, locale: string): string {
  const localeTag =
    locale === 'de' ? 'de-CH' :
    locale === 'it' ? 'it-CH' :
    locale === 'en' ? 'en-GB' :
    'fr-CH'
  return new Date(iso).toLocaleDateString(localeTag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ─── 1. MlkLanding ────────────────────────────────────────────────────────

interface LandingProps {
  firstName: string
  agentFullName: string
  agencyName: string
  expiresAt: string
  onStart: () => void
}

export function MlkLanding({
  firstName,
  agentFullName,
  agencyName,
  expiresAt,
  onStart,
}: LandingProps) {
  const { t, i18n } = useTranslation('kyc')

  const reassureItems = [
    {
      icon: 'swiss' as const,
      title: t('client.landing.reassure_swiss_title'),
    },
    {
      icon: 'lock' as const,
      title: t('client.landing.reassure_lock_title'),
    },
    {
      icon: 'shield' as const,
      title: t('client.landing.reassure_shield_title'),
    },
    {
      icon: 'clock' as const,
      title: t('client.landing.reassure_clock_title'),
    },
  ]

  return (
    <MlkShell>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 44,
        }}
      >
        <MlkWordmark size={18} />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--crm-space-sm)',
            padding: 'var(--crm-space-sm) var(--crm-space-xl) var(--crm-space-sm) var(--crm-space-lg)',
            borderRadius: 999,
            background: MLK.cardSubtle,
            fontSize: 'var(--crm-text-xs)',
            fontWeight: 600,
            color: MLK.inkSoft,
            letterSpacing: 0.1,
          }}
        >
          <MlkIcon name="lock" size={12} stroke={MLK.ink} sw={2} />
          {t('client.landing.lock_label', { date: formatDateShort(expiresAt, i18n.language) })}
        </div>
      </div>

      {/* Agent block */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-2xl)',
          padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
          background: MLK.cardSubtle,
          borderRadius: 18,
          marginBottom: 28,
        }}
      >
        <MlkAgentAvatar name={agentFullName} size={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              color: MLK.ink,
              letterSpacing: -0.2,
            }}
          >
            {agentFullName} · {agencyName}
          </div>
        </div>
      </div>

      {/* Titre + sous-titre */}
      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 var(--crm-space-2xl)',
          fontSize: 'var(--crm-text-9xl)',
          fontWeight: 600,
          color: MLK.ink,
          letterSpacing: -0.9,
          lineHeight: 1.08,
        }}
      >
        {t('client.landing.title_part1', { firstName })}
        <br />
        {t('client.landing.title_part2')}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-xl)',
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          maxWidth: 580,
        }}
      >
        {t('client.landing.subtitle_prefix')}
        <span style={{ color: MLK.ink, fontWeight: 600 }}>
          {t('client.landing.subtitle_duration')}
        </span>
        {t('client.landing.subtitle_suffix')}
      </p>

      {/* Reassurance bullets — 4 colonnes desktop, 2x2 mobile */}
      <div style={{ marginTop: 36, marginBottom: 36 }}>
        <MlkReassureRow items={reassureItems} />
      </div>

      {/* CTA */}
      <MlkBlackPill
        onClick={onStart}
        iconRight={<MlkIcon name="arrowR" size={18} stroke="#fff" sw={2} />}
        size="lg"
        full
      >
        {t('client.landing.cta_start')}
      </MlkBlackPill>

      <div
        style={{
          marginTop: 'var(--crm-space-2xl)',
          textAlign: 'center',
          fontSize: 'var(--crm-text-sm)',
          color: MLK.muted,
          fontWeight: 500,
        }}
      >
        {t('client.landing.consent')}
      </div>

      <MlkFooter />
    </MlkShell>
  )
}

// ─── 2. MlkUpload ─────────────────────────────────────────────────────────

type UploadType = 'identity' | 'address' | 'funds' | 'other'

interface UploadedFileLite {
  id: string
  type: string
  filename: string
  size_bytes: number
  uploaded_at: string
}

interface UploadProps {
  firstName: string
  contactSummary: string             // ex: "Sophie Bernard · 4 pièces Eaux-Vives"
  uploaded: UploadedFileLite[]
  isUploading: boolean
  uploadError: string | null
  onFilePick: (file: File, type: UploadType) => void
  onConfirm: () => void
  isConfirming: boolean
}

export function MlkUpload({
  firstName,
  contactSummary,
  uploaded,
  isUploading,
  uploadError,
  onFilePick,
  onConfirm,
  isConfirming,
}: UploadProps) {
  const { t } = useTranslation('kyc')
  const [selectedType, setSelectedType] = useState<UploadType>('identity')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const uploadTypeDefs: Record<UploadType, { title: string; sub: string; icon: 'id' | 'home' | 'coins' | 'fileText' }> = {
    identity: {
      title: t('client.upload_types.identity_title'),
      sub: t('client.upload_types.identity_sub'),
      icon: 'id',
    },
    address: {
      title: t('client.upload_types.address_title'),
      sub: t('client.upload_types.address_sub'),
      icon: 'home',
    },
    funds: {
      title: t('client.upload_types.funds_title'),
      sub: t('client.upload_types.funds_sub'),
      icon: 'coins',
    },
    other: {
      title: t('client.upload_types.other_title'),
      sub: t('client.upload_types.other_sub'),
      icon: 'fileText',
    },
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const file = fileList[0]
    onFilePick(file, selectedType)
  }

  const canConfirm = uploaded.length > 0 && !isConfirming && !isUploading

  return (
    <MlkShell width={760} pad={52}>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
        }}
      >
        <MlkWordmark size={16} />
        <div style={{ fontSize: 'var(--crm-text-xs)', color: MLK.muted, fontWeight: 500 }}>
          {contactSummary}
        </div>
      </div>

      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 var(--crm-space-xl)',
          fontSize: 'var(--crm-text-7xl)',
          fontWeight: 600,
          color: MLK.ink,
          letterSpacing: -0.7,
          lineHeight: 1.1,
        }}
      >
        {t('client.upload.title', { firstName })}
      </h1>

      {/* Type sélecteur — 4 radio cards en grid 2x2 */}
      <div
        style={{
          fontSize: 'var(--crm-text-xs)',
          fontWeight: 600,
          color: MLK.muted,
          marginBottom: 'var(--crm-space-lg)',
        }}
      >
        {t('client.upload.type_label')}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--crm-space-lg)',
          marginBottom: 'var(--crm-space-6xl)',
        }}
      >
        {(Object.keys(uploadTypeDefs) as UploadType[]).map((typeKey) => {
          const isSelected = selectedType === typeKey
          const def = uploadTypeDefs[typeKey]
          return (
            <button
              key={typeKey}
              type="button"
              onClick={() => setSelectedType(typeKey)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 0,
                padding: 'var(--crm-space-2xl) var(--crm-space-2xl)',
                borderRadius: 16,
                background: isSelected ? MLK.card : MLK.cardSubtle,
                boxShadow: isSelected ? MLK.shadow : 'none',
                outline: isSelected ? `2px solid ${MLK.accent}` : 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--crm-space-xl)',
                transition: 'all .18s ease',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: isSelected ? MLK.accent : 'transparent',
                  boxShadow: isSelected
                    ? 'none'
                    : `inset 0 0 0 1.5px ${crmVoileEncre(false, 0.25)}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: '#fff',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: MLK.cardSubtle,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <MlkIcon name={def.icon} size={17} stroke={MLK.ink} sw={1.7} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--crm-text-md)',
                    fontWeight: 600,
                    color: MLK.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {def.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-xs)',
                    color: MLK.muted,
                    fontWeight: 500,
                    marginTop: 1,
                    lineHeight: 1.35,
                  }}
                >
                  {def.sub}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        style={{
          padding: '44px 28px',
          background: dragOver ? crmVoileEncre(false, 0.05) : crmVoileEncre(false, 0.025),
          borderRadius: 22,
          boxShadow: dragOver
            ? `inset 0 0 0 2px ${MLK.accent}`
            : `inset 0 0 0 1.5px ${crmVoileEncre(false, 0.10)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--crm-space-2xl)',
          textAlign: 'center',
          marginBottom: 'var(--crm-space-2xl)',
          transition: 'all .18s ease',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: MLK.card,
            boxShadow: MLK.shadow,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MlkIcon name="upload" size={26} stroke={MLK.ink} sw={1.7} />
        </div>
        <div>
          <div
            style={{
              fontSize: 'var(--crm-text-2xl)',
              fontWeight: 600,
              color: MLK.ink,
              letterSpacing: -0.2,
            }}
          >
            {t('client.upload.drop_title')}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-xs)' }}>
          <MlkBlackPill
            onClick={() => fileInputRef.current?.click()}
            icon={<MlkIcon name="file" size={14} stroke="#fff" sw={1.8} />}
            size="sm"
            disabled={isUploading}
          >
            {isUploading ? t('client.upload.uploading') : t('client.upload.browse')}
          </MlkBlackPill>
        </div>
      </div>

      {/* Error */}
      {uploadError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--crm-space-lg)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            // ⚠ L'APLAT PASSE DE TRANSLUCIDE À OPAQUE, ET C'EST INVISIBLE : composé
            // sur la carte blanche, `rgba(239,68,68,.10)` donne `#fdecec`, à 1,04:1
            // d'`errFill`. Ce que le changement retire n'est pas une teinte, c'est
            // une SECONDE définition du même aplat — celle qui se met à diverger le
            // jour où la famille bouge.
            background: MLK_STATUT.errFill,
            boxShadow: `inset 0 0 0 1px ${MLK_STATUT.errLine}`,
            borderRadius: 12,
            marginBottom: 'var(--crm-space-2xl)',
            fontSize: 'var(--crm-text-sm)',
            // `#B91C1C` était `errInk` au caractère près, écrit deux fois.
            color: MLK_STATUT.errInk,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          <MlkIcon name="alert" size={14} stroke={MLK_STATUT.errInk} sw={1.8} />
          {uploadError}
        </div>
      )}

      {/* Liste des fichiers uploadés */}
      {uploaded.length > 0 && (
        <>
          <div
            style={{
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 600,
              color: MLK.muted,
              marginBottom: 'var(--crm-space-lg)',
            }}
          >
            {t(uploaded.length === 1 ? 'client.upload.received_one' : 'client.upload.received_other', { count: uploaded.length })}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--crm-space-sm)',
              marginBottom: 'var(--crm-space-6xl)',
            }}
          >
            {uploaded.map((f) => {
              const typeKey = (f.type as UploadType) in uploadTypeDefs
                ? (f.type as UploadType)
                : 'other'
              const def = uploadTypeDefs[typeKey]
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--crm-space-2xl)',
                    padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
                    background: MLK.cardSubtle,
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: MLK.card,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MlkIcon name={def.icon} size={16} stroke={MLK.ink} sw={1.7} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--crm-text-md)',
                        fontWeight: 600,
                        color: MLK.ink,
                        letterSpacing: -0.1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {f.filename}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--crm-text-xs)',
                        color: MLK.muted,
                        fontWeight: 500,
                        marginTop: 1,
                      }}
                    >
                      {def.title} · {formatBytes(f.size_bytes)}
                    </div>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--crm-space-sm)',
                      padding: 'var(--crm-space-xs) var(--crm-space-lg)',
                      borderRadius: 999,
                      // Même mesure que la bannière d'erreur : le voile à 10 % donne
                      // `#e7f8f2`, à 1,04:1 d'`okFill`. ⚠ Ces deux valeurs venaient de
                      // `PDF.okBg`/`okDot` — la famille du RAPPORT A4, recopiée sur un
                      // écran client qui n'a rien à voir avec elle.
                      background: MLK_STATUT.okFill,
                      // `#0E7C5B` était une TROISIÈME encre verte pour le rôle
                      // qu'`okInk` nomme déjà. Le jeton est aussi meilleur : 4,92 → 5,21:1.
                      color: MLK_STATUT.okInk,
                      fontSize: 'var(--crm-text-xs)',
                      fontWeight: 600,
                      letterSpacing: 0.2,
                      flexShrink: 0,
                    }}
                  >
                    {/* ⛔ LE SEUL DES CINQ QUI ÉTAIT UN VRAI DÉFAUT, pas seulement une
                        valeur hors famille : `#10B981` rendait 2,41:1 sur son propre
                        aplat, sous le seuil de 3 des éléments NON TEXTUELS. `okLine`
                        aurait été pire encore (1,45:1) ; `okInk` est le seul barreau de
                        la famille qui tienne (5,21:1), et il aligne la pastille sur
                        l'encre du mot qu'elle accompagne. */}
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: MLK_STATUT.okInk,
                      }}
                    />
                    {t('client.upload.received_pill')}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Footer CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 'var(--crm-space-2xl)',
          paddingTop: 'var(--crm-space-xs)',
        }}
      >
        <MlkBlackPill
          onClick={onConfirm}
          iconRight={<MlkIcon name="arrowR" size={16} stroke="#fff" sw={2} />}
          disabled={!canConfirm}
          size="md"
        >
          {isConfirming ? t('client.upload.cta_confirming') : t('client.upload.cta_confirm')}
        </MlkBlackPill>
      </div>

      <MlkFooter />
    </MlkShell>
  )
}

// ─── 3. MlkSuccess ────────────────────────────────────────────────────────

interface SuccessProps {
  firstName: string
  agentFullName: string
  agencyName: string
  /**
   * Ouvre la prise de rendez-vous de vérification.
   *
   * Proposé sans vérifier au préalable que l'agent a ouvert l'auto-réservation :
   * ce contrôle coûterait un appel free/busy (donc un aller-retour Google) sur
   * CHAQUE ouverture du lien, y compris pendant le dépôt des pièces. L'écran de
   * réservation traite le cas fermé par un message informatif — « votre agent
   * vous contactera » — et non par une erreur, donc l'impasse n'en est pas une.
   */
  onBook?: () => void
}

export function MlkSuccess({ firstName, agentFullName, agencyName, onBook }: SuccessProps) {
  const { t } = useTranslation('kyc')
  const agentFirstName = agentFullName.split(' ')[0]

  return (
    <MlkShell width={680} pad={56}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <MlkWordmark size={16} />
      </div>

      {/* Big check */}
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 999,
          background: MLK.ink,
          color: '#fff',
          margin: '0 auto 32px',
          display: 'grid',
          placeItems: 'center',
          boxShadow:
            `0 24px 60px ${crmVoileEncre(false, 0.20)}, 0 8px 24px ${crmVoileEncre(false, 0.12)}`,
        }}
      >
        <MlkIcon name="check" size={42} stroke="#fff" sw={2.4} />
      </div>

      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 var(--crm-space-2xl)',
          fontSize: 'var(--crm-text-8xl)',
          fontWeight: 600,
          color: MLK.ink,
          letterSpacing: -0.9,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {t('client.success.title_part1', { firstName })}
        <br />
        {t('client.success.title_part2')}
      </h1>
      <p
        style={{
          margin: '0 0 36px',
          fontSize: 'var(--crm-text-xl)',
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {t('client.success.body_prefix', { agentName: agentFullName })}
        <span style={{ color: MLK.ink, fontWeight: 600 }}>
          {t('client.success.body_duration')}
        </span>
        {t('client.success.body_suffix')}
      </p>

      {/* Card agent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-2xl)',
          padding: 'var(--crm-space-2xl) var(--crm-space-4xl)',
          background: MLK.card,
          borderRadius: 18,
          boxShadow: MLK.shadow,
          marginBottom: 'var(--crm-space-6xl)',
        }}
      >
        <MlkAgentAvatar name={agentFullName} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--crm-text-md)',
              fontWeight: 600,
              color: MLK.ink,
              letterSpacing: -0.1,
            }}
          >
            {t('client.success.agent_card_q', { firstName: agentFirstName })}
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-xs)',
              color: MLK.muted,
              fontWeight: 500,
              marginTop: 1,
            }}
          >
            {agencyName}
          </div>
        </div>
      </div>

      {onBook && (
        <div style={{ marginTop: 'var(--crm-space-xs)' }}>
          <MlkBlackPill onClick={onBook} full>
            {t('client.booking.cta_open')}
          </MlkBlackPill>
        </div>
      )}

      <MlkFooter />
    </MlkShell>
  )
}

// ─── 4. MlkExpired ────────────────────────────────────────────────────────

interface ExpiredProps {
  agentFullName?: string
  agencyName?: string
}

export function MlkExpired({ agentFullName, agencyName }: ExpiredProps) {
  const { t } = useTranslation('kyc')
  const agentName = agentFullName ?? t('client.expired.fallback_agent')
  const agencySuffix = agencyName
    ? t('client.expired.body_agency_suffix', { agencyName })
    : ''

  return (
    <MlkShell width={620} pad={56}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
        <MlkWordmark size={16} />
      </div>

      <div
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background: MLK.cardSubtle,
          color: MLK.ink,
          margin: '0 auto 28px',
          display: 'grid',
          placeItems: 'center',
          boxShadow: MLK.shadowSm,
        }}
      >
        <MlkIcon name="clock" size={36} stroke={MLK.ink} sw={1.5} />
      </div>

      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 var(--crm-space-2xl)',
          fontSize: 'var(--crm-text-6xl)',
          fontWeight: 600,
          color: MLK.ink,
          letterSpacing: -0.7,
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        {t('client.expired.title')}
      </h1>
      <p
        style={{
          margin: '0 0 30px',
          fontSize: 'var(--crm-text-lg)',
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 440,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {t('client.expired.body_prefix')}
        <span style={{ color: MLK.ink, fontWeight: 600 }}>
          {t('client.expired.body_duration')}
        </span>
        {t('client.expired.body_middle', { agentName })}
        {agencySuffix}
        {t('client.expired.body_suffix')}
      </p>

      <div
        style={{
          marginTop: 'var(--crm-space-2xl)',
          textAlign: 'center',
          fontSize: 'var(--crm-text-sm)',
          color: MLK.muted,
          fontWeight: 500,
        }}
      >
        {t('client.expired.no_data_loss')}
      </div>

      <MlkFooter />
    </MlkShell>
  )
}

// ─── 5. État vide / loading / erreur — Shell minimaliste ──────────────────

interface PlaceholderProps {
  title: string
  message: string
  iconName?: 'alert' | 'clock' | 'check' | 'lock'
}

export function MlkPlaceholder({ title, message, iconName = 'alert' }: PlaceholderProps) {
  return (
    <MlkShell width={520} pad={48}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <MlkWordmark size={16} />
      </div>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          background: MLK.cardSubtle,
          margin: '0 auto var(--crm-space-6xl)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MlkIcon name={iconName} size={28} stroke={MLK.ink} sw={1.7} />
      </div>
      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 var(--crm-space-xl)',
          fontSize: 'var(--crm-text-5xl)',
          fontWeight: 600,
          color: MLK.ink,
          letterSpacing: -0.5,
          textAlign: 'center',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-lg)',
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          textAlign: 'center',
        }}
      >
        {message}
      </p>
      <MlkFooter />
    </MlkShell>
  )
}
