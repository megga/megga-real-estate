import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

export interface MmToastState {
  msg: string
  /** « Annuler » — annule l'écriture différée (contrat undo 5 s). */
  onUndo?: () => void
  /** « Voir le deal → » — force le flush et navigue. */
  onSeeDeal?: () => void
  /** clé de remount pour rejouer l'animation à chaque toast. */
  key: number
}

/**
 * Toast d'action Sugar (accent plein, au-dessus de la barre d'onglets) avec
 * actions « Annuler » / « Voir le deal → ». La primitive `SgToast` est
 * volontairement passive (display-only) ; le contrat undo 5 s du matching exige
 * un toast cliquable, d'où ce composant dédié.
 */
export default function MmToast({ toast }: { toast: MmToastState | null }) {
  const reducedMotion = useReducedMotion()
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.key}
          initial={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 12, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 12, x: '-50%' }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(110px + env(safe-area-inset-bottom))',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: tk.accent,
            color: tk.accentInk,
            fontFamily: MOBILE_FONT,
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: -0.2,
            padding: toast.onUndo || toast.onSeeDeal ? '9px 10px 9px 18px' : '11px 18px',
            borderRadius: 999,
            boxShadow: tk.shadowLg,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.msg}
          </span>
          {toast.onSeeDeal ? (
            <button
              type="button"
              onClick={toast.onSeeDeal}
              style={{
                flexShrink: 0,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 800,
                color: tk.accentInk,
                opacity: 0.85,
                padding: '6px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              {t('atelier.seeDeal')}
            </button>
          ) : null}
          {toast.onUndo ? (
            <button
              type="button"
              onClick={toast.onUndo}
              style={{
                flexShrink: 0,
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 800,
                color: tk.accentInk,
                padding: '6px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              {t('common:actions.cancel')}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
