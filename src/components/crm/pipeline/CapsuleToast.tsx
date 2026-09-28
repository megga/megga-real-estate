/**
 * La capsule de confirmation du Pipeline — un message, un « Annuler » facultatif, en bas au centre.
 *
 * ⛔ C'est une SURFACE FLOTTANTE INVERSÉE : elle garde l'encre, elle ne prend pas l'accent (même
 * arbitrage que le board d'avant, la fiche deal et le Matching). L'encre posée dessus se dérive
 * (`encreSur`) : un blanc écrit en dur parierait sur un fond que personne ne mesure.
 */
import { useTranslation } from 'react-i18next'
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { CrmPalette } from '../tokens'

interface Props {
  sp: CrmPalette
  message: string
  undo?: () => void
}

export function CapsuleToast({ sp, message, undo }: Props) {
  const { t } = useTranslation('pipeline')
  return (
    <div role="status" style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 240,
      background: sp.ink, color: encreSur(sp.ink), padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
      borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-md)', fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', boxShadow: sp.shadow,
      animation: 'crm-toast .2s ease-out',
    }}>
      <span>{message}</span>
      {undo && (
        <button type="button" onClick={undo} style={{
          background: sp.isDark ? 'rgba(3,3,3,.14)' : 'rgba(255,255,255,.14)', color: encreSur(sp.ink),
          border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
          padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)',
        }}>{t('board.toast.undo')}</button>
      )}
    </div>
  )
}
