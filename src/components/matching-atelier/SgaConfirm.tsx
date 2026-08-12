// Atelier Matching — confirmation d'envoi / de relance (modal Sugar minimale)
// puis écran succès auto-fermant (~1,25 s). Enter = confirmer · Esc = annuler
// (verrouillés pendant l'animation de succès). Human-in-the-loop : rien ne
// part sans cette validation explicite de l'agent.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import { sgaFmtCHF, sgaInitials } from './format'
import type { AtelierBuyer, AtelierListing } from './types'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface SgaConfirmProps {
  b: AtelierBuyer
  L: AtelierListing
  relance?: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function SgaConfirm({ b, L, relance, onClose, onConfirm }: SgaConfirmProps) {
  const { t } = useTranslation('matching')
  const refPiegeFocus = useFocusTrap(true, onClose)
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)
  const name = `${b.first} ${b.last}`

  const fire = () => {
    if (doneRef.current) return
    doneRef.current = true
    setDone(true)
    setTimeout(() => onConfirm(), 1250)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (doneRef.current) { e.preventDefault(); e.stopPropagation(); return }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fire() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sga-overlay" onClick={e => { if (!doneRef.current && e.target === e.currentTarget) onClose() }}>
      <div
        className="sga-modal"
        style={{ width: 440, maxWidth: '92vw' }}
        ref={refPiegeFocus}
        role="dialog"
        aria-modal="true"
        aria-label={relance ? t('confirm.followUpTitle') : t('confirm.sendTitle')}
      >
        {done ? (
          <div className="sga-success">
            <div className="sga-success-badge">
              <SgaIcon d="check" size={30} />
            </div>
            <div className="t4 semi" style={{ color: 'var(--ink)' }}>
              {relance ? t('confirm.successFollowUpTitle') : t('confirm.successSendTitle')}
            </div>
            <p className="t2 muted" style={{ margin: 0, lineHeight: 1.5, maxWidth: 320 }}>
              {relance
                ? t('confirm.successFollowUpBody', { name })
                : t('confirm.successSendBody', { name })}
            </p>
          </div>
        ) : (
          <>
            <div className="sga-modal-h">
              <div className="av" style={{ width: 44, height: 44, background: b.av, fontSize: 15 }}>
                {sgaInitials(b.first, b.last)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t4 semi" style={{ color: 'var(--ink)' }}>
                  {relance ? t('confirm.followUpQuestion', { name }) : t('confirm.sendQuestion')}
                </div>
              </div>
            </div>
            <div style={{ padding: '4px 24px 20px' }}>
              <div className="t2 semi" style={{ color: 'var(--ink)', marginBottom: 6 }}>
                {L.title} · <span className="nums">{sgaFmtCHF(L.price)}</span>
              </div>
              <p className="t2 muted" style={{ margin: 0, lineHeight: 1.55 }}>
                {relance
                  ? t('confirm.followUpBody', { firstName: b.first })
                  : t('confirm.sendBody', { firstName: b.first })}
              </p>
            </div>
            <div className="sga-modal-foot">
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={onClose}>{t('common:actions.cancel')}</button>
              <button className="btn btn-primary" onClick={fire} autoFocus>
                {relance ? t('confirm.followUpCta') : t('confirm.sendCta')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
