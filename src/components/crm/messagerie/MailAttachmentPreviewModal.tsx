/**
 * « Aperçu de la pièce » (README §9).
 *
 * ⛔ CE QUI EST AFFICHABLE SE DÉCIDE SUR CE QUE LE SERVEUR A SERVI, jamais sur
 * `mail_attachments.mime_type` — ce dernier vient de l'EXPÉDITEUR du courrier.
 * `mail-attachment` ne rend l'essence d'origine que pour une liste sûre (PDF,
 * PNG, JPEG, WebP, GIF, texte) et sert tout le reste en
 * `application/octet-stream`. Décider « c'est une image » sur la déclaration de
 * l'expéditeur poserait un `<img>` sur un SVG refusé : une image cassée en 200,
 * exactement le mensonge que le repli du logo évite ailleurs.
 *
 * ⚠ Aucune URL publique n'existe pour une pièce : les octets passent par l'edge
 * avec le jeton de la session, en blob local (`useMailAttachmentBlob`). C'est
 * aussi ce qui interdit qu'un lien fuite hors de l'agence.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailAttachmentBlob } from '@/hooks/useMailAttachmentBlob'
import type { MailAttachmentRow } from '@/hooks/useMailThread'
import { MailCloseButton, MailModalShell } from './MailModalShell'
import { PILL, type MailSurfaces } from './mailTokens'

/** Carte, voile et flou de la maquette (README §9). */
const LARGEUR = 600
const VOILE = 0.28
const FLOU = 8
/** Au-dessus de la modale de classement (306), qui est elle-même au-dessus des sept autres (300). */
const Z_INDEX = 305
/** Hauteur de la scène d'aperçu (README §9). */
const SCENE = 330

interface Props {
  ms: MailSurfaces
  att: MailAttachmentRow | null
  onClose: () => void
  onFile: () => void
}

/** L'aperçu d'une pièce jointe, et la porte vers son classement au dossier. */
export function MailAttachmentPreviewModal({ ms, att, onClose, onFile }: Props) {
  const { t } = useTranslation('messages')
  const blob = useMailAttachmentBlob(att?.id ?? null)
  const servi = blob.type ?? ''
  const estImage = servi.startsWith('image/')
  const estPdf = servi === 'application/pdf'

  return (
    <MailModalShell ms={ms} open={!!att} onClose={onClose} width={LARGEUR} ariaLabel={t('mail.preview.title')} veil={VOILE} blur={FLOU} zIndex={Z_INDEX}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att?.filename}</div>
        <MailCloseButton ms={ms} onClick={onClose} label={t('mail.actions.close')} />
      </div>

      <div style={{ marginTop: 'var(--crm-space-2xl)', height: SCENE, borderRadius: 'var(--crm-radius-xl)', background: ms.elev, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {blob.loading && <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.mut }}>{t('mail.preview.loading')}</span>}
        {blob.error && <span style={{ fontSize: 'var(--crm-text-sm)', color: ms.danger }}>{t('mail.preview.error')}</span>}
        {blob.url && estImage && <img src={blob.url} alt={att?.filename ?? ''} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
        {blob.url && estPdf && <iframe src={blob.url} title={att?.filename ?? ''} style={{ width: '100%', height: '100%', border: 'none' }} />}
        {/* Ni image ni PDF : on ne fait pas semblant d'afficher, on propose le fichier. */}
        {blob.url && !estImage && !estPdf && (
          <a
            href={blob.url}
            download={att?.filename}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', color: ms.accent, fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}
          >
            <MEIcon name="paperclip" size={14} color={ms.accent} /> {t('mail.preview.download')}
          </a>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-3xl)' }}>
        {/* Une pièce déjà classée ne propose pas de l'être une seconde fois :
            le second classement produirait un doublon dans `documents`. */}
        {att?.document_id && (
          <span style={{ fontSize: 'var(--crm-text-xs)', color: ms.successInk, background: ms.success, borderRadius: PILL, padding: 'var(--crm-space-2xs) var(--crm-space-lg)' }}>
            {t('mail.file.filed')}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: ms.txt3, fontSize: 'var(--crm-text-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('mail.actions.close')}
        </button>
        {!att?.document_id && (
          <button
            type="button"
            onClick={onFile}
            style={{ background: ms.accent, color: ms.accentInk, border: 'none', borderRadius: PILL, padding: 'var(--crm-space-md) var(--crm-space-4xl)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('mail.file.cta')}
          </button>
        )}
      </div>
    </MailModalShell>
  )
}
