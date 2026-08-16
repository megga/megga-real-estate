// MEGGA CRM — KYC Pager · Modale de téléversement d'une pièce
// Port fidèle de `KypUploadModal` (kyc-pager-proto.jsx) mais avec un VRAI
// <input type="file"> (le proto simulait le fichier). La pièce choisie est
// remontée à la fiche qui la téléverse via `useUploadKycDocument`.

import { useRef, useState } from 'react'
import { type CrmPalette, crmVoileEncre } from '@/components/crm/tokens'
import { KYC_CHECK_LABELS } from '../tokens'
import type { KycCheckCategory } from '@/types/kyc'
import { KYP_FONT, type KypSurf } from './kypTokens'
import { KypCta, KypIcon } from './kypAtoms'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

interface Props {
  category: KycCheckCategory
  contactName: string
  sp: CrmPalette
  surf: KypSurf
  pending?: boolean
  onCancel: () => void
  onConfirm: (file: File) => void
}

export function KycUploadModal({ category, contactName, sp, surf, pending, onCancel, onConfirm }: Props) {
  const label = KYC_CHECK_LABELS[category]?.title ?? category
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dark = surf.dark

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        background: dark ? 'rgba(0,0,4,.72)' : 'rgba(14,20,16,.42)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 430,
          maxWidth: 'calc(100% - 60px)',
          background: dark ? '#202124' : '#FFFFFF',
          borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: `0 40px 100px ${crmVoileEncre(false, 0.20)}, 0 8px 24px ${crmVoileEncre(false, 0.10)}`,
          padding: '26px 28px',
          boxSizing: 'border-box',
          animation: 'kypPop .38s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setFile(f)
          }}
        />
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.4, color: sp.ink }}>{label}</div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub, marginTop: 4 }}>{contactName}</div>

        {!file ? (
          <div
            style={{
              marginTop: 18,
              background: surf.cardSub,
              borderRadius: 'var(--crm-radius-2xl)',
              padding: '30px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--crm-space-2xl)',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--crm-radius-pill)',
                background: dark ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
                boxShadow: sp.shadowSm,
                display: 'grid',
                placeItems: 'center',
                color: sp.ink,
              }}
            >
              <KypIcon name="upload" size={20} sw={1.8} />
            </span>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.soft }}>Choisissez un fichier à joindre</div>
            <KypCta sp={sp} h={36} onClick={() => inputRef.current?.click()}>
              Choisir un fichier
            </KypCta>
          </div>
        ) : (
          <div
            style={{
              marginTop: 18,
              background: surf.cardSub,
              borderRadius: 'var(--crm-radius-2xl)',
              padding: 'var(--crm-space-2xl) var(--crm-space-3xl)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-lg)',
            }}
          >
            <span style={{ color: sp.ink, display: 'inline-flex', flexShrink: 0 }}>
              <KypIcon name="doc" size={17} sw={1.8} />
            </span>
            <span
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 600,
                color: sp.ink,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {file.name}
            </span>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              {humanSize(file.size)}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--crm-space-2xl)', marginTop: 20 }}>
          <span
            onClick={onCancel}
            style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.soft, cursor: 'pointer', fontFamily: KYP_FONT }}
          >
            Annuler
          </span>
          {file && (
            <KypCta sp={sp} h={38} disabled={pending} onClick={() => onConfirm(file)}>
              {pending ? 'Envoi…' : 'Joindre au dossier'}
            </KypCta>
          )}
        </div>
      </div>
    </div>
  )
}
