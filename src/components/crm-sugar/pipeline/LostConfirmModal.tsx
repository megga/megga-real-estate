/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : confirmation « Marquer perdu ».
 * Port du handoff crm-screen-pipeline-sugar.jsx §lostConfirm : modale Sugar
 * (panneau opaque radius 28, CTA destructif plein), Échap et clic hors panneau
 * ferment. Sans sélecteur de motif — fidèle à la maquette (le hook
 * useUpdateTransactionStage garde son support lostReason pour le mobile).
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '../tokens'

interface Props {
  sp: SugarPalette
  dark: boolean
  /** « Prénom Nom » du contact du deal — null si non résolu (message générique). */
  contactName: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function LostConfirmModal({ sp, dark, contactName, onCancel, onConfirm }: Props) {
  const { t } = useTranslation('pipeline')

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onCancel])

  return createPortal(
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 140,
      background: 'rgba(8,10,14,.45)', display: 'grid', placeItems: 'center',
      animation: 'sgSignVeil .15s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 400, maxWidth: 'calc(100vw - 48px)',
        background: dark ? '#17181A' : '#FFFFFF', borderRadius: 28,
        boxShadow: '0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)',
        padding: '26px 26px 22px',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        animation: 'sugar-fade-up .3s cubic-bezier(.2,.8,.2,1) both',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: sp.ink }}>
          {t('board.lostConfirm.title')}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: sp.sub, lineHeight: 1.55 }}>
          {contactName
            ? t('board.lostConfirm.message', { name: contactName })
            : t('board.lostConfirm.messageNoName')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={{
            height: 42, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: dark ? '#26272A' : '#F1F4F8', color: sp.ink,
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          }}>{t('board.lostConfirm.cancel')}</button>
          <button onClick={onConfirm} style={{
            height: 42, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer',
            background: dark ? '#E0738C' : '#8E1F3D', color: '#FFFFFF',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          }}>{t('board.lostConfirm.confirm')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
