/** Primitive du kit mobile (crm-mobile/primitives) : socle bottom-card partagé (menu d'actions, confirmation). */
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useMobileTokens } from '../useMobileTokens'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface CrmBottomCardProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
  /** Marge basse en px (au-dessus de la safe-area). Défaut 12. */
  bottomGap?: number
}

// Spring iOS — léger rebond contenu, sans overshoot visible.
const CARD_SPRING = { type: 'spring' as const, stiffness: 380, damping: 34, mass: 0.9 }

/**
 * Socle commun des surfaces compactes Sugar (action-menu, confirmation) :
 * overlay + carte flottante en bas qui glisse vers le haut. Gère portal,
 * verrou de scroll, Échap et `prefers-reduced-motion`. Pas de poignée (≠
 * CrmSheet, qui est la grande feuille scrollable). Surface re-skinnée par
 * tokens mobiles — aucune modification des primitives `ui/*`.
 */
export default function CrmBottomCard({ open, onClose, children, ariaLabel, bottomGap = 12 }: CrmBottomCardProps) {
  const reducedMotion = useReducedMotion()
  const refPiegeFocus = useFocusTrap(open, onClose)
  const { tk } = useMobileTokens()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]" ref={refPiegeFocus} role="dialog" aria-modal="true" aria-label={ariaLabel}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: tk.overlay }}
          />
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={reducedMotion ? { duration: 0 } : CARD_SPRING}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: `calc(${bottomGap}px + env(safe-area-inset-bottom))`,
              background: tk.card,
              borderRadius: 'var(--crm-radius-5xl)',
              boxShadow: tk.shadowLg,
              overflow: 'hidden',
            }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
