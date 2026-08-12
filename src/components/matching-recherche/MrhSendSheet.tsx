// Matching · Recherche — feuille d'envoi de la sélection (lien de réception déjà
// minté par useSendReceptionSelection). L'agent partage le lien par WhatsApp ou le
// copie. Zéro email. Réutilise les clés i18n `sendSheet.*` de l'atelier.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import RechIcon from './RechIcon'
import type { MrhCtx } from './mrhCtx'
import type { SendSelectionResult } from '@/hooks/useSendReceptionSelection'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  result: SendSelectionResult
  buyerName: string
  ctx: MrhCtx
  onClose: () => void
}

export default function MrhSendSheet({ result, buyerName, ctx, onClose }: Props) {
  const { t } = useTranslation('matching')
  const refPiegeFocus = useFocusTrap(true, onClose)
  const { sp, surf, cardSolid, ACC, ONACC, dark } = ctx
  const [copied, setCopied] = useState(false)
  const hasPhone = !!(result.phone && result.phone.trim())
  const first = result.firstName || buyerName.split(' ')[0] || buyerName
  const subBg = dark ? sp.solidBg : '#F4F6F9'
  const subLine = 'inset 0 0 0 1px ' + (dark ? 'rgba(255,255,255,.08)' : 'rgba(3,3,3,.06)')

  const onWhatsApp = () => {
    if (!hasPhone) return
    window.open(buildWaMeUrl(result.phone ?? '', t('sendSheet.waMessage', { firstName: first, url: result.url })), '_blank', 'noopener')
    onClose()
  }
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(result.url) } catch { /* clipboard indispo */ }
    setCopied(true)
    setTimeout(onClose, 800)
  }

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,3,3,.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'inherit' }}
    >
      <div style={{ width: 440, maxWidth: '94vw', background: cardSolid, borderRadius: 18, boxShadow: surf.shadow, border: surf.hairline, overflow: 'hidden', animation: 'sgFadeUp .18s cubic-bezier(.2,.8,.2,1) both' }} ref={refPiegeFocus} role="dialog" aria-modal="true" aria-label={t('sendSheet.title', { name: buyerName })}>
        <div style={{ padding: '20px 22px 10px' }}>
          <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink, letterSpacing: -0.3 }}>{t('sendSheet.title', { name: buyerName })}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, marginTop: 6 }}>{t('panel.sentCount', { count: result.count })}</div>
          <p style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub, margin: '6px 0 0', lineHeight: 1.5 }}>{t('sendSheet.body', { firstName: first })}</p>
        </div>
        <div style={{ padding: '4px 22px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onWhatsApp} disabled={!hasPhone} autoFocus={hasPhone}
            style={{ height: 48, borderRadius: 12, border: 0, cursor: hasPhone ? 'pointer' : 'not-allowed', opacity: hasPhone ? 1 : 0.5, background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <RechIcon name="send" size={15} stroke={ONACC} /> {t('sendSheet.whatsapp')}
          </button>
          <button onClick={onCopy} autoFocus={!hasPhone}
            style={{ height: 48, borderRadius: 12, border: 0, cursor: 'pointer', background: subBg, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: subLine }}>
            {copied && <RechIcon name="check" size={15} stroke={sp.ink} />} {copied ? t('sendSheet.copied') : t('sendSheet.copyLink')}
          </button>
          {!hasPhone && <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, lineHeight: 1.4 }}>{t('sendSheet.noPhone')}</div>}
        </div>
        <div style={{ padding: '2px 22px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, padding: '6px 4px' }}>{t('common:actions.close')}</button>
          <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, padding: '6px 4px', textDecoration: 'none' }}>{t('sendSheet.preview')}</a>
        </div>
      </div>
    </div>,
    document.body,
  )
}
