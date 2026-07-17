// Atelier Matching — feuille d'envoi (refonte handoff §2.5). Remplace la
// confirmation email par un LIEN PRIVÉ (magic link réception) partagé par
// WhatsApp ou copié. Zéro email. Les retours de l'acheteur reviennent dans sa
// fiche (boucle de match). Human-in-the-loop : l'agent choisit le canal.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import { sgaFmtCHF, sgaInitials } from './format'
import { useCreateReceptionLink } from '@/hooks/useCreateReceptionLink'
import { buildWaMeUrl } from '@/components/propertyx/PxWhatsAppButton'
import type { AtelierBuyer, AtelierListing } from './types'

interface Props {
  b: AtelierBuyer
  L: AtelierListing
  onClose: () => void
  /** l'agent a transmis via un canal → dépôt (deal + timeline, sans email) */
  onSent: () => void
}

export default function SgaSendSheet({ b, L, onClose, onSent }: Props) {
  const { t } = useTranslation('matching')
  const create = useCreateReceptionLink()
  const urlRef = useRef<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  const name = `${b.first} ${b.last}`
  const hasPhone = !!(b.phone && b.phone.trim())

  // Crée le lien une seule fois (mis en cache) ; renvoie l'URL publique.
  const ensureLink = async (channel: 'whatsapp' | 'link'): Promise<string | null> => {
    if (urlRef.current) return urlRef.current
    setError(false)
    try {
      const link = await create.mutateAsync({ contactId: b.id, matchIds: [b.matchId], channel })
      urlRef.current = link.url
      return link.url
    } catch {
      setError(true)
      return null
    }
  }

  const onWhatsApp = async () => {
    // Sans numéro, wa.me n'a pas de destinataire → on ne marque pas le dossier
    // « transmis ». L'agent passe par « Copier le lien ».
    if (!hasPhone) return
    const url = await ensureLink('whatsapp')
    if (!url) return
    window.open(buildWaMeUrl(b.phone ?? '', t('sendSheet.waMessage', { firstName: b.first, url })), '_blank', 'noopener')
    onSent()
  }
  const onCopy = async () => {
    const url = await ensureLink('link')
    if (!url) return
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard indispo */ }
    setCopied(true)
    setTimeout(onSent, 700)
  }
  const onPreview = async () => {
    const url = await ensureLink('link')
    if (url) window.open(url, '_blank', 'noopener')
  }

  const busy = create.isPending

  return (
    <div className="sga-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sga-modal" style={{ width: 460, maxWidth: '92vw' }} role="dialog" aria-label={t('sendSheet.title', { name })}>
        <div className="sga-modal-h">
          <div className="av" style={{ width: 44, height: 44, background: b.av, fontSize: 15 }}>{sgaInitials(b.first, b.last)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t4 semi" style={{ color: 'var(--ink)' }}>{t('sendSheet.title', { name })}</div>
          </div>
        </div>
        <div style={{ padding: '4px 24px 16px' }}>
          <div className="t2 semi" style={{ color: 'var(--ink)', marginBottom: 6 }}>
            {L.title} · <span className="nums">{sgaFmtCHF(L.price)}</span>
          </div>
          <p className="t2 muted" style={{ margin: 0, lineHeight: 1.55 }}>{t('sendSheet.body', { firstName: b.first })}</p>
          {error && <p className="t2" style={{ margin: '10px 0 0', color: 'var(--sys-red, #C0453B)', fontWeight: 600 }}>{t('sendSheet.error')}</p>}
        </div>
        <div style={{ padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onWhatsApp} disabled={busy || !hasPhone} autoFocus={hasPhone}>
            <SgaIcon d="message" size={16} /> {t('sendSheet.whatsapp')}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%', boxShadow: 'inset 0 0 0 1px var(--hairline)' }} onClick={onCopy} disabled={busy} autoFocus={!hasPhone}>
            <SgaIcon d={copied ? 'check' : 'copy'} size={15} /> {copied ? t('sendSheet.copied') : t('sendSheet.copyLink')}
          </button>
          {!hasPhone && <p className="t2 muted" style={{ margin: '2px 0 0', lineHeight: 1.5 }}>{t('sendSheet.noPhone')}</p>}
        </div>
        <div className="sga-modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common:actions.cancel')}</button>
          <div style={{ flex: 1 }} />
          <button onClick={onPreview} disabled={busy}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', padding: '6px 4px' }}>
            {t('sendSheet.preview')}
          </button>
        </div>
      </div>
    </div>
  )
}
