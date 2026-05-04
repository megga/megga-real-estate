// MEGGA CRM Sugar v2 — KYC upload doc modal (Tier 4)
// Modal compagnon du Detail KYC : sélection catégorie + fichier + upload via
// useUploadKycDocument (Storage `kyc-documents` + insert documents row + audit event).

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BlackBtn, GhostBtn, KycIcon, SectionLabel, SP } from './atoms'
import type { KycIconName } from './atoms'
import { useUploadKycDocument } from '@/hooks/useKyc'
import type { DocumentCategory } from '@/types/kyc'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 Mo
const ACCEPTED_MIME = '.pdf,.jpg,.jpeg,.png,.webp'

interface CategoryDef {
  k: DocumentCategory
  label: string
  icon: KycIconName
}

const CATEGORIES: CategoryDef[] = [
  { k: 'identity', label: 'Identité', icon: 'user' },
  { k: 'domicile', label: 'Domicile', icon: 'globe' },
  { k: 'financial', label: 'Revenus', icon: 'bank' },
  { k: 'compliance', label: 'Conformité', icon: 'shield' },
  { k: 'other', label: 'Autre', icon: 'doc' },
]

interface KycUploadDocModalProps {
  kycCaseId: string
  agencyId: string
  uploadedBy: string
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

export function KycUploadDocModal({
  kycCaseId,
  agencyId,
  uploadedBy,
  onClose,
  onSuccess,
  onError,
}: KycUploadDocModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<DocumentCategory>('identity')
  const [file, setFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const uploadMutation = useUploadKycDocument()

  const submitting = uploadMutation.isPending
  const canSubmit = !!file && !submitting

  const acceptFile = (f: File) => {
    if (f.size > MAX_SIZE_BYTES) {
      setErrorMsg('Fichier trop volumineux (10 Mo max).')
      setFile(null)
      return
    }
    setErrorMsg(null)
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    try {
      setErrorMsg(null)
      await uploadMutation.mutateAsync({
        kycCaseId,
        agencyId,
        file,
        documentCategory: category,
        uploadedBy,
      })
      onSuccess(`Document ajouté : ${file.name}`)
      onClose()
    } catch (e) {
      const msg = (e as Error).message || "Échec de l'upload."
      setErrorMsg(msg)
      onError(msg)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
  }

  return createPortal(
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(11,12,14,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        animation: 'kycFadeIn .25s ease both',
        fontFamily: SP.font,
      }}
    >
      <style>{`
        @keyframes kycFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kycScaleIn { from { opacity: 0; transform: scale(.97) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SP.surface,
          borderRadius: 24,
          padding: 28,
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 40px 100px rgba(11,12,14,0.30)',
          animation: 'kycScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
          color: SP.ink,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: SP.cardSubtle,
              display: 'grid',
              placeItems: 'center',
              color: SP.ink,
            }}
          >
            <KycIcon name="upload" size={20} sw={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.3,
                color: SP.ink,
              }}
            >
              Ajouter une pièce
            </h3>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: SP.muted,
              }}
            >
              PDF, JPG, PNG · 10 Mo max · Stockage chiffré
            </p>
          </div>
          <button
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: SP.cardSubtle,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: SP.muted,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <KycIcon name="x" size={14} sw={2} />
          </button>
        </div>

        {/* Catégorie */}
        <SectionLabel>Catégorie</SectionLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 6,
            marginBottom: 18,
          }}
        >
          {CATEGORIES.map(c => {
            const on = category === c.k
            return (
              <button
                key={c.k}
                onClick={() => setCategory(c.k)}
                disabled={submitting}
                style={{
                  padding: '10px 4px',
                  borderRadius: 12,
                  border: 0,
                  background: on ? SP.ink : SP.cardSubtle,
                  color: on ? '#fff' : SP.inkSoft,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all .15s',
                  fontFamily: SP.font,
                }}
              >
                <KycIcon
                  name={c.icon}
                  size={16}
                  stroke={on ? '#fff' : SP.inkSoft}
                  sw={1.8}
                />
                <span style={{ fontSize: 11, fontWeight: 700 }}>{c.label}</span>
              </button>
            )
          })}
        </div>

        {/* File picker */}
        <SectionLabel>Document</SectionLabel>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) acceptFile(f)
          }}
          style={{ display: 'none' }}
        />
        {file ? (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: SP.cardSubtle,
              boxShadow: `0 0 0 1.5px ${SP.ink} inset`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: SP.surface,
                display: 'grid',
                placeItems: 'center',
                color: SP.ink,
                flexShrink: 0,
              }}
            >
              <KycIcon name="doc" size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: SP.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {file.name}
              </div>
              <div style={{ fontSize: 11, color: SP.muted, marginTop: 1 }}>
                {formatSize(file.size)}
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              disabled={submitting}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: 0,
                background: SP.surface,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: SP.muted,
                flexShrink: 0,
                opacity: submitting ? 0.5 : 1,
              }}
              title="Retirer le fichier"
            >
              <KycIcon name="x" size={12} sw={2} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) acceptFile(f)
            }}
            style={{
              padding: '24px 18px',
              borderRadius: 14,
              background: dragOver ? SP.surface : SP.cardSubtle,
              border: `2px dashed ${dragOver ? SP.ink : SP.ghost}`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              cursor: 'pointer',
              transition: 'all .15s',
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: SP.surface,
                boxShadow: SP.shadowSm,
                display: 'grid',
                placeItems: 'center',
                color: SP.ink,
                flexShrink: 0,
              }}
            >
              <KycIcon name="upload" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: SP.ink }}>
                Glisser un fichier ici
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: SP.muted,
                  marginTop: 2,
                }}
              >
                ou cliquer pour parcourir
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: SP.dangerSoft,
              color: SP.danger,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <KycIcon name="alert" size={13} stroke={SP.danger} sw={2} />
            {errorMsg}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <GhostBtn onClick={() => !submitting && onClose()}>Annuler</GhostBtn>
          <BlackBtn
            onClick={handleSubmit}
            icon={
              submitting ? (
                <KycIcon name="clock" size={14} stroke="#fff" sw={2} />
              ) : (
                <KycIcon name="upload" size={14} stroke="#fff" sw={2} />
              )
            }
            style={{
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Téléversement…' : 'Téléverser'}
          </BlackBtn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
