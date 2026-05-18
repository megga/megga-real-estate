import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import Shimmer from '@/components/ui/Shimmer'

/**
 * `<LanguageChangeOverlay>` is a brief frosted-glass overlay that appears
 * during `i18n.changeLanguage(...)`. It masks the three things that happen
 * simultaneously during a language swap and would otherwise read as a
 * "broken moment" to the eye:
 *
 *   1. react-i18next reloads the translation bundle (~50–150 ms)
 *   2. Text widths reflow ("Acheter" → "Buy" −40 %, "Settings" → "Paramètres" +50 %)
 *   3. The lazy chunk for the target language may still be downloading
 *
 * Behaviour:
 *   - Listens to `i18n.on('languageChanged', ...)`
 *   - Shows for `OVERLAY_DURATION_MS` (350 ms — long enough to mask the
 *     reflow, short enough to feel responsive)
 *   - Composes the existing `<Shimmer>` atom + the MEGGA wordmark as
 *     premium loading content
 *   - Reduced-motion users: skipped entirely (i18n still swaps, they just
 *     don't see the overlay — matches their explicit preference)
 *
 * This is mounted once globally in App.tsx (next to <ToastProvider>) so it
 * fires regardless of which page the user is on when they change language.
 */

const OVERLAY_DURATION_MS = 350

export default function LanguageChangeOverlay() {
  const { i18n } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const handler = () => {
      if (reducedMotion) return
      setActive(true)
      const id = window.setTimeout(() => setActive(false), OVERLAY_DURATION_MS)
      return () => window.clearTimeout(id)
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [i18n, reducedMotion])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="language-change-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // iOS easeOut curve, same as PageTransition crossfade had.
          transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6"
          style={{
            // Frosted glass — slightly tinted toward the page background so the
            // effect works on both light and dark themes (the 0.92 alpha lets
            // the underlying theme bleed through, blur softens hard edges).
            backgroundColor: 'rgba(250, 251, 253, 0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          aria-busy="true"
          aria-live="polite"
          aria-label="Changement de langue"
        >
          <span className="text-3xl font-bold tracking-tight text-theme-primary select-none">
            MEGGA
          </span>
          <Shimmer className="h-1 w-32 rounded-full" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
