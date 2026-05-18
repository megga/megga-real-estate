// MEGGA — Écrans du parcours client KYC Magic Link
// Sprint 4.7.C — Port pixel-près de handoff-kyc-magic-link/maquette/megga-kyc-magic-link.jsx
//
// 4 écrans :
//   1. MlkLanding  — accueil rassurant (Bonjour <prénom>, finalisons votre dossier)
//   2. MlkUpload   — drop zone + sélecteur type + liste uploaded + CTA confirm
//   3. MlkSuccess  — confirmation finale
//   4. MlkExpired  — lien expiré
//
// Mode 'verifiee' (OCR) → couvert par Sprint 4.7.D (composant MlkVerified à venir).

import { useRef, useState } from 'react'
import {
  MLK,
  MlkAgentAvatar,
  MlkBlackPill,
  MlkFooter,
  MlkIcon,
  MlkReassureRow,
  MlkShell,
  MlkWordmark,
} from './MlkPrimitives'

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH', {
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

const REASSURE_ITEMS = [
  {
    icon: 'swiss' as const,
    title: 'Données en Suisse',
    sub: 'Hébergement Genève',
  },
  {
    icon: 'lock' as const,
    title: 'Chiffré bout-en-bout',
    sub: 'AES-256, transit TLS 1.3',
  },
  {
    icon: 'shield' as const,
    title: 'Vu par 2 personnes',
    sub: 'Votre agent + conformité',
  },
  {
    icon: 'clock' as const,
    title: 'Conservé 10 ans',
    sub: 'LBA art. 7, puis supprimé',
  },
]

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
            gap: 7,
            padding: '6px 12px 6px 9px',
            borderRadius: 999,
            background: MLK.cardSubtle,
            fontSize: 11.5,
            fontWeight: 600,
            color: MLK.inkSoft,
            letterSpacing: 0.1,
          }}
        >
          <MlkIcon name="lock" size={12} stroke={MLK.ink} sw={2} />
          Lien chiffré · expire le {formatDateShort(expiresAt)}
        </div>
      </div>

      {/* Agent block */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 18px',
          background: MLK.cardSubtle,
          borderRadius: 18,
          marginBottom: 28,
        }}
      >
        <MlkAgentAvatar name={agentFullName} color="#3B82F6" size={48} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: MLK.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            Demande de votre agent
          </div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 700,
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
        style={{
          margin: '0 0 16px',
          fontSize: 38,
          fontWeight: 700,
          color: MLK.ink,
          letterSpacing: -0.9,
          lineHeight: 1.08,
        }}
      >
        Bonjour {firstName},
        <br />
        finalisons votre dossier.
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          maxWidth: 580,
        }}
      >
        La loi suisse anti-blanchiment (LBA) nous oblige à vérifier votre identité et,
        selon le dossier, l&apos;origine des fonds. Comptez{' '}
        <strong style={{ color: MLK.ink, fontWeight: 700 }}>5 à 8 minutes</strong>.
      </p>

      {/* Reassurance bullets — 4 colonnes */}
      <div style={{ marginTop: 36, marginBottom: 36 }}>
        <MlkReassureRow items={REASSURE_ITEMS} />
      </div>

      {/* CTA */}
      <MlkBlackPill
        onClick={onStart}
        iconRight={<MlkIcon name="arrowR" size={18} stroke="#fff" sw={2} />}
        size="lg"
        full
      >
        Commencer
      </MlkBlackPill>

      <div
        style={{
          marginTop: 16,
          textAlign: 'center',
          fontSize: 12,
          color: MLK.muted,
          fontWeight: 500,
        }}
      >
        En continuant, vous acceptez le traitement de vos données conformément à la nLPD.
      </div>

      <MlkFooter />
    </MlkShell>
  )
}

// ─── 2. MlkUpload ─────────────────────────────────────────────────────────

type UploadType = 'identity' | 'address' | 'funds' | 'other'

const UPLOAD_TYPE_LABELS: Record<UploadType, { title: string; sub: string; icon: 'id' | 'home' | 'coins' | 'fileText' }> = {
  identity: {
    title: "Pièce d'identité",
    sub: 'Passeport, carte d’identité ou permis C',
    icon: 'id',
  },
  address: {
    title: 'Justificatif de domicile',
    sub: 'Facture électricité, internet ou bail (< 3 mois)',
    icon: 'home',
  },
  funds: {
    title: 'Source des fonds',
    sub: 'Relevé bancaire, vente d’un bien, donation, prêt',
    icon: 'coins',
  },
  other: {
    title: 'Autre document',
    sub: 'Demandé spécifiquement par votre agent',
    icon: 'fileText',
  },
}

interface UploadedFileLite {
  id: string
  type: string
  filename: string
  size_bytes: number
  uploaded_at: string
}

interface UploadProps {
  firstName: string
  agentFullName: string
  agencyName: string
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
  agentFullName,
  agencyName,
  contactSummary,
  uploaded,
  isUploading,
  uploadError,
  onFilePick,
  onConfirm,
  isConfirming,
}: UploadProps) {
  const [selectedType, setSelectedType] = useState<UploadType>('identity')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

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
        <div style={{ fontSize: 11.5, color: MLK.muted, fontWeight: 500 }}>
          {contactSummary}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: MLK.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        Pièces justificatives
      </div>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 32,
          fontWeight: 700,
          color: MLK.ink,
          letterSpacing: -0.7,
          lineHeight: 1.1,
        }}
      >
        Bonjour {firstName}, déposez vos documents
      </h1>
      <p
        style={{
          margin: '0 0 28px',
          fontSize: 14.5,
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          maxWidth: 600,
        }}
      >
        Joignez votre pièce d&apos;identité, un justificatif de domicile récent et tout
        élément démontrant l&apos;origine des fonds. Vous pouvez ajouter les pièces une
        par une.
      </p>

      {/* Type sélecteur — 4 radio cards en grid 2x2 */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: MLK.muted,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Type de pièce
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 22,
        }}
      >
        {(Object.keys(UPLOAD_TYPE_LABELS) as UploadType[]).map((t) => {
          const isSelected = selectedType === t
          const def = UPLOAD_TYPE_LABELS[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedType(t)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 0,
                padding: '14px 16px',
                borderRadius: 16,
                background: isSelected ? MLK.card : MLK.cardSubtle,
                boxShadow: isSelected ? MLK.shadow : 'none',
                outline: isSelected ? `2px solid ${MLK.black}` : 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all .18s ease',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: isSelected ? MLK.black : 'transparent',
                  boxShadow: isSelected
                    ? 'none'
                    : 'inset 0 0 0 1.5px rgba(11,12,14,0.25)',
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
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: MLK.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {def.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
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
          background: dragOver ? 'rgba(11,12,14,0.05)' : 'rgba(11,12,14,0.025)',
          borderRadius: 22,
          boxShadow: dragOver
            ? `inset 0 0 0 2px ${MLK.black}`
            : 'inset 0 0 0 1.5px rgba(11,12,14,0.10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          textAlign: 'center',
          marginBottom: 14,
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
              fontSize: 16,
              fontWeight: 700,
              color: MLK.ink,
              letterSpacing: -0.2,
            }}
          >
            Glissez votre document ici
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: MLK.muted,
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            PDF, JPG, PNG, WEBP ou HEIC · max 10 Mo
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <MlkBlackPill
            onClick={() => fileInputRef.current?.click()}
            icon={<MlkIcon name="file" size={14} stroke="#fff" sw={1.8} />}
            size="sm"
            disabled={isUploading}
          >
            {isUploading ? 'Téléversement…' : 'Parcourir'}
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
            gap: 10,
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.10)',
            borderRadius: 12,
            marginBottom: 14,
            fontSize: 12.5,
            color: '#B91C1C',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          <MlkIcon name="alert" size={14} stroke="#B91C1C" sw={1.8} />
          {uploadError}
        </div>
      )}

      {/* Liste des fichiers uploadés */}
      {uploaded.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: MLK.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            {uploaded.length} document{uploaded.length > 1 ? 's' : ''} reçu
            {uploaded.length > 1 ? 's' : ''}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {uploaded.map((f) => {
              const typeKey = (f.type as UploadType) in UPLOAD_TYPE_LABELS
                ? (f.type as UploadType)
                : 'other'
              const def = UPLOAD_TYPE_LABELS[typeKey]
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
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
                        fontSize: 13,
                        fontWeight: 700,
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
                        fontSize: 11,
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
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(16,185,129,0.10)',
                      color: '#0E7C5B',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: '#10B981',
                      }}
                    />
                    Reçu
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Tip sécurité */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px 14px',
          background: MLK.cardSubtle,
          borderRadius: 12,
          marginBottom: 28,
        }}
      >
        <MlkIcon name="lock" size={14} stroke={MLK.muted} sw={1.8} />
        <div
          style={{
            fontSize: 11.5,
            color: MLK.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          Vos documents sont chiffrés dès le téléversement. Personne d&apos;autre que{' '}
          {agentFullName} et l&apos;équipe conformité de {agencyName} n&apos;y aura accès.
        </div>
      </div>

      {/* Footer CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          paddingTop: 4,
        }}
      >
        <MlkBlackPill
          onClick={onConfirm}
          iconRight={<MlkIcon name="arrowR" size={16} stroke="#fff" sw={2} />}
          disabled={!canConfirm}
          size="md"
        >
          {isConfirming ? 'Envoi en cours…' : 'Valider et envoyer'}
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
}

export function MlkSuccess({ firstName, agentFullName, agencyName }: SuccessProps) {
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
          background: MLK.black,
          color: '#fff',
          margin: '0 auto 32px',
          display: 'grid',
          placeItems: 'center',
          boxShadow:
            '0 24px 60px rgba(11,12,14,0.20), 0 8px 24px rgba(11,12,14,0.12)',
        }}
      >
        <MlkIcon name="check" size={42} stroke="#fff" sw={2.4} />
      </div>

      <h1
        style={{
          margin: '0 0 14px',
          fontSize: 36,
          fontWeight: 700,
          color: MLK.ink,
          letterSpacing: -0.9,
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        Merci {firstName},
        <br />
        vos pièces sont transmises.
      </h1>
      <p
        style={{
          margin: '0 0 36px',
          fontSize: 15,
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {agentFullName} vérifiera votre dossier sous{' '}
        <strong style={{ color: MLK.ink, fontWeight: 700 }}>24 heures ouvrées</strong>.
        Vous recevrez un email de confirmation dès que votre dossier est validé.
      </p>

      {/* Card agent */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px',
          background: MLK.card,
          borderRadius: 18,
          boxShadow: MLK.shadow,
          marginBottom: 24,
        }}
      >
        <MlkAgentAvatar name={agentFullName} color="#3B82F6" size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: MLK.ink,
              letterSpacing: -0.1,
            }}
          >
            Une question pour {agentFullName.split(' ')[0]} ?
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: MLK.muted,
              fontWeight: 500,
              marginTop: 1,
            }}
          >
            {agencyName}
          </div>
        </div>
      </div>

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
        style={{
          margin: '0 0 14px',
          fontSize: 30,
          fontWeight: 700,
          color: MLK.ink,
          letterSpacing: -0.7,
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        Ce lien a expiré
      </h1>
      <p
        style={{
          margin: '0 0 30px',
          fontSize: 14.5,
          color: MLK.inkSoft,
          fontWeight: 500,
          lineHeight: 1.6,
          textAlign: 'center',
          maxWidth: 440,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Pour la sécurité de vos données, les liens MEGGA expirent au bout de{' '}
        <strong style={{ color: MLK.ink, fontWeight: 700 }}>7 jours</strong>.
        Contactez {agentFullName ?? 'votre agent'}
        {agencyName ? ` chez ${agencyName}` : ''} pour qu&apos;un nouveau lien vous soit envoyé.
      </p>

      <div
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 12,
          color: MLK.muted,
          fontWeight: 500,
        }}
      >
        Aucune donnée n&apos;a été perdue. Vos pièces précédemment téléversées sont conservées.
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
          margin: '0 auto 22px',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MlkIcon name={iconName} size={28} stroke={MLK.ink} sw={1.7} />
      </div>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 24,
          fontWeight: 700,
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
          fontSize: 14,
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

