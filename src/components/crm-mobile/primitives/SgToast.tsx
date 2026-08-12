/** Toast en forme de pilule du CRM mobile — primitive « Sugar ». */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'

/**
 * Pilule de toast Sugar (accent plein, centrée, au-dessus de la barre
 * d'onglets). Piloté par l'état de `useSgToast` :
 *   const { toast, showToast } = useSgToast()
 *   <SgToast toast={toast} />
 */
export default function SgToast({ toast }: { toast: string | null }) {
  const reducedMotion = useReducedMotion()
  const { tk } = useMobileTokens()

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 12, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={reducedMotion ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 12, x: '-50%' }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(110px + env(safe-area-inset-bottom))',
            zIndex: 120,
            background: tk.accent,
            color: tk.accentInk,
            fontFamily: MOBILE_FONT,
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            letterSpacing: -0.2,
            padding: 'var(--crm-space-lg) var(--crm-space-4xl)',
            borderRadius: 'var(--crm-radius-pill)',
            boxShadow: tk.shadowLg,
            maxWidth: 'calc(100vw - 32px)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
