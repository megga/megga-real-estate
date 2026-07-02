// MEGGA CRM Sugar v3 — Card « Signature électronique »
// Point d'entrée RÉEL d'émission d'une demande de signature depuis la fiche
// contact : l'agent téléverse un PDF (mandat, contrat…) et l'envoie à signer
// via SignatureLaunchModal → edge `sign-document` (Skribble, QES/AES/SES).
//
// Contexte : l'écran Documents (générateur de PDF par templates) a été retiré
// (commit 0a7e85c3), laissant SignatureLaunchModal sans point d'entrée. Cette
// carte rebranche l'émission sur un upload de PDF — flux minimal et honnête,
// sans ressusciter le studio de templates. Le PDF signé revient via webhook
// dans le bucket `signed-documents`.
//
// Surface agent VERROUILLÉE (garde-fou i18n) : tout le texte visible passe par
// t() (namespace contacts). « Skribble » = nom de marque, laissé verbatim.

import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycSection } from '../primitives'
import {
  SignatureLaunchModal,
  type SignatureLaunchSigner,
} from '@/components/signature/SignatureLaunchModal'

interface Props {
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
  }
}

// PDF → base64 brut (sans préfixe data:) attendu par l'edge function.
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result)
      const comma = res.indexOf(',')
      resolve(comma >= 0 ? res.slice(comma + 1) : res)
    }
    reader.onerror = () => reject(new Error('read_error'))
    reader.readAsDataURL(file)
  })
}

const MAX_PDF_BYTES = 20 * 1024 * 1024 // 20 Mo — garde-fou upload

export function CdSignatureCard({ contact }: Props) {
  const { t } = useTranslation('contacts')
  const fileRef = useRef<HTMLInputElement>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fullName = `${contact.first_name} ${contact.last_name}`.trim()
  const signers: SignatureLaunchSigner[] = [
    {
      name: fullName || undefined,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
    },
  ]

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    setErr(null)
    if (file.type !== 'application/pdf') {
      setErr(t('detail.signature.errPdfOnly'))
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      setErr(t('detail.signature.errTooLarge'))
      return
    }
    try {
      const b64 = await readBase64(file)
      setPdfBase64(b64)
      setTitle(file.name.replace(/\.pdf$/i, ''))
      setOpen(true)
    } catch {
      setErr(t('detail.signature.errRead'))
    }
  }

  return (
    <KycSection
      title={t('detail.signature.title')}
      eyebrow="Skribble"
      action={<SgIcon name="shieldStar" size={16} stroke={SugarV3.inkSoft} />}
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        onChange={onFile}
        style={{ display: 'none' }}
      />

      <p
        style={{
          margin: '0 0 14px',
          fontSize: 13,
          lineHeight: 1.55,
          color: SugarV3.muted,
          fontWeight: 500,
        }}
      >
        {t('detail.signature.description', {
          name: fullName || t('detail.signature.thisContact'),
        })}
      </p>

      <button
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%',
          height: 44,
          borderRadius: 14,
          border: 0,
          background: SugarV3.black,
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
        }}
      >
        <SgIcon name="send" size={15} stroke="#fff" />
        {t('detail.signature.send')}
      </button>

      {err && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            fontWeight: 600,
            color: SugarV3.err,
            lineHeight: 1.5,
          }}
        >
          {err}
        </div>
      )}

      {pdfBase64 && (
        <SignatureLaunchModal
          key={title}
          open={open}
          onClose={() => {
            setOpen(false)
            setPdfBase64(null)
          }}
          pdfBase64={pdfBase64}
          defaultTitle={title || t('detail.signature.defaultTitle')}
          defaultSigners={signers}
          contextType="contract"
          contact={{ id: contact.id, phone: contact.phone }}
        />
      )}
    </KycSection>
  )
}
