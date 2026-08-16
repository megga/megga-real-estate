import { useEffect, type ReactNode, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/**
 * `<Sheet>` — iOS-style sheet primitive that supports three orientations:
 *
 *   - `side="bottom"` (default): modal action sheet (mobile menus, filters).
 *                                 Slides up from the bottom edge, drag-down
 *                                 dismisses.
 *   - `side="right"` : side drawer (CRM details, settings). Slides in from
 *                      the right edge, drag-right dismisses.
 *   - `side="left"`  : side drawer (rare — main nav on tablet). Slides in
 *                      from the left edge, drag-left dismisses.
 *
 * Replaces the 18+ ad-hoc `createPortal` + static `bg-black/40` overlays in
 * the codebase. Each side gets its own spring physics and drag axis but
 * shares backdrop, scroll-lock, Escape, and reduced-motion handling.
 *
 * Drag-dismiss thresholds (per axis):
 *   - Past 100 px in the dismiss direction, OR
 *   - Strong flick past 500 px/s, OR
 *   - User releases the backdrop.
 *
 * NOT included (intentional — caller composes):
 *   - Header / title (every sheet looks different)
 *   - Action buttons
 *   - Focus trap (use Radix Dialog if a hard trap is required — see modal.tsx)
 */

type SheetSide = 'bottom' | 'right' | 'left'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Which edge the sheet attaches to. Default `'bottom'`. */
  side?: SheetSide
  /** Max height as a viewport fraction. Only applies to `side="bottom"`. Default 0.92. */
  maxHeightVh?: number
  /** Sheet width — only applies to `side="right" | "left"`. Default `'min(720px, 100vw)'`. */
  width?: string | number
  /** Label for screen readers. */
  ariaLabel?: string
  /** Container className — overrides default styling (use sparingly). */
  className?: string
  /** Inline style override — for theming the sheet panel surface. */
  style?: CSSProperties
}

// Tuned to match iOS UISheetPresentationController. Slightly heavier damping
// than tap-feedback springs so the sheet doesn't overshoot visibly.
const SHEET_SPRING = { type: 'spring' as const, stiffness: 360, damping: 36, mass: 0.9 }
const DISMISS_OFFSET_PX = 100
const DISMISS_VELOCITY_PX_S = 500

export default function Sheet({
  open,
  onClose,
  children,
  side = 'bottom',
  maxHeightVh = 0.92,
  width = 'min(720px, 100vw)',
  ariaLabel = 'Panneau',
  className,
  style,
}: SheetProps) {
  const reducedMotion = useReducedMotion()
  const refPiegeFocus = useFocusTrap(open, onClose)

  // Escape key + body scroll lock while open
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

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const { offset, velocity } = info
    if (side === 'bottom') {
      if (offset.y > DISMISS_OFFSET_PX || velocity.y > DISMISS_VELOCITY_PX_S) onClose()
    } else if (side === 'right') {
      if (offset.x > DISMISS_OFFSET_PX || velocity.x > DISMISS_VELOCITY_PX_S) onClose()
    } else {
      // side === 'left' — dismiss when dragged toward the left edge
      if (offset.x < -DISMISS_OFFSET_PX || velocity.x < -DISMISS_VELOCITY_PX_S) onClose()
    }
  }

  // ── Variant-specific motion + drag config ─────────────────────────────
  const variant = (() => {
    if (side === 'bottom') {
      return {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        drag: 'y' as const,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.4 },
        positionClass:
          'absolute bottom-0 left-0 right-0 bg-theme-card rounded-t-2xl border-t border-theme-border',
        sizeStyle: {
          maxHeight: `${Math.round(maxHeightVh * 100)}vh`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        } as CSSProperties,
        touchAction: 'pan-y',
        renderHandle: true,
      }
    }
    if (side === 'right') {
      return {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        drag: 'x' as const,
        dragConstraints: { left: 0, right: 0 },
        dragElastic: { left: 0, right: 0.4 },
        positionClass:
          'absolute top-0 bottom-0 right-0 bg-theme-card border-l border-theme-border shadow-2xl',
        sizeStyle: {
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: '100vw',
        } as CSSProperties,
        touchAction: 'pan-x',
        renderHandle: false,
      }
    }
    return {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
      drag: 'x' as const,
      dragConstraints: { left: 0, right: 0 },
      dragElastic: { left: 0.4, right: 0 },
      positionClass:
        'absolute top-0 bottom-0 left-0 bg-theme-card border-r border-theme-border shadow-2xl',
      sizeStyle: {
        width: typeof width === 'number' ? `${width}px` : width,
        maxWidth: '100vw',
      } as CSSProperties,
      touchAction: 'pan-x',
      renderHandle: false,
    }
  })()

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100]"
          ref={refPiegeFocus}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />

          {/* Sheet panel */}
          <motion.div
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={reducedMotion ? { duration: 0 } : SHEET_SPRING}
            drag={reducedMotion ? false : variant.drag}
            dragConstraints={variant.dragConstraints}
            dragElastic={variant.dragElastic}
            onDragEnd={handleDragEnd}
            className={className ?? variant.positionClass}
            style={{
              ...variant.sizeStyle,
              overflowY: 'auto',
              touchAction: reducedMotion ? 'auto' : variant.touchAction,
              ...style,
            }}
          >
            {/* Drag handle — only meaningful for bottom sheets */}
            {variant.renderHandle && (
              <div
                className="flex justify-center pt-3 pb-2 sticky top-0 z-10"
                aria-hidden="true"
              >
                <div className="w-10 h-1 rounded-full bg-theme-border" />
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
