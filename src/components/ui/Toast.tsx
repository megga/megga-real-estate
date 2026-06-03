import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * Drop-in iOS-feel toast system. One `<ToastProvider>` wraps the app, any
 * descendant calls `useToast()` to push messages.
 *
 *   const toast = useToast()
 *   toast.success('Bien publié')
 *   toast.error('Échec — réessayez')
 *
 * Design notes:
 *   - Stacks at the top-right on desktop (≥md), top-center on mobile.
 *     Top placement matches iOS system notifications; bottom on mobile
 *     would clash with the BottomTabBar.
 *   - Spring slide from above + per-toast height-FLIP via `layout` so new
 *     toasts push older ones down smoothly.
 *   - Auto-dismiss after 4 s (default), but the timer pauses on hover so
 *     a user reading the toast doesn't lose it mid-read.
 *   - Click anywhere on the toast dismisses immediately (whole row is the
 *     hit target — iOS convention for these system banners).
 *   - Reduced-motion: instant in/out, no spring.
 */

type ToastType = 'success' | 'error' | 'info' | 'warn'

interface ToastEntry {
  id: number
  type: ToastType
  message: string
  description?: string
  duration: number
}

interface ToastApi {
  success: (msg: string, opts?: { description?: string; duration?: number }) => number
  error: (msg: string, opts?: { description?: string; duration?: number }) => number
  info: (msg: string, opts?: { description?: string; duration?: number }) => number
  warn: (msg: string, opts?: { description?: string; duration?: number }) => number
  dismiss: (id: number) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastCtx)
  if (!api) {
    // Don't crash, but no-op so renderless trees / Storybook don't blow up.
    return {
      success: () => -1,
      error: () => -1,
      info: () => -1,
      warn: () => -1,
      dismiss: () => undefined,
    }
  }
  return api
}

interface ToastProviderProps {
  children: ReactNode
  /** Max toasts visible at once. Excess gets queued. Default 4. */
  max?: number
  /** Default auto-dismiss in ms. Default 4000. */
  defaultDuration?: number
}

let idCounter = 0

export function ToastProvider({ children, max = 4, defaultDuration = 4000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string, opts?: { description?: string; duration?: number }) => {
      const id = ++idCounter
      const entry: ToastEntry = {
        id,
        type,
        message,
        description: opts?.description,
        duration: opts?.duration ?? defaultDuration,
      }
      setToasts((prev) => [...prev, entry].slice(-max))
      return id
    },
    [defaultDuration, max],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      warn: (m, o) => push('warn', m, o),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

const TOAST_SPRING = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 }

const TYPE_STYLES: Record<ToastType, { icon: MEIconName; ring: string; iconClass: string }> = {
  success: { icon: 'check-circle', ring: 'ring-emerald-500/30', iconClass: 'text-emerald-500' },
  error:   { icon: 'close-circle',      ring: 'ring-red-500/30',     iconClass: 'text-red-500' },
  info:    { icon: 'info',         ring: 'ring-blue-500/30',    iconClass: 'text-blue-500' },
  warn:    { icon: 'alert',  ring: 'ring-amber-500/30',   iconClass: 'text-amber-500' },
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: number) => void }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[110] inset-x-0 top-0 md:top-4 md:inset-x-auto md:right-4 flex flex-col items-center md:items-end gap-2 px-3 md:px-0 pt-2 pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const reducedMotion = useReducedMotion()
  const { icon: Icon, ring, iconClass } = TYPE_STYLES[toast.type]
  const [hovered, setHovered] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (hovered) return
    timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.duration, hovered, onDismiss])

  return (
    <motion.div
      layout
      initial={reducedMotion ? false : { y: -32, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { y: -16, opacity: 0, scale: 0.96 }}
      transition={reducedMotion ? { duration: 0 } : TOAST_SPRING}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onDismiss(toast.id)}
      role="status"
      className={cn(
        'pointer-events-auto w-full max-w-sm cursor-pointer select-none',
        'rounded-xl bg-theme-card border border-theme-border shadow-lg ring-1',
        'px-3.5 py-3 flex items-start gap-3 text-theme-primary',
        ring,
      )}
    >
      <MEIcon name={Icon as MEIconName} className={cn('h-5 w-5 shrink-0 mt-0.5', iconClass)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-theme-tertiary leading-snug mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(toast.id)
        }}
        aria-label="Fermer"
        className="shrink-0 -mr-1 -mt-1 p-1 rounded text-theme-tertiary hover:text-theme-primary"
      >
        <MEIcon name="close" className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}
