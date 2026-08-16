/** Hook d'état de toast du CRM mobile — primitive « Sugar ». */
import { useCallback, useRef, useState } from 'react'

/**
 * État local de toast « une à la fois » — auto-dismiss (défaut 2,2 s). Pattern
 * par-écran fidèle aux maquettes (pas de provider global) :
 *   const { toast, showToast } = useCrmToast()
 *   ... showToast('Bien dupliqué') ...
 *   <CrmToast toast={toast} />
 */
export function useCrmToast(durationMs = 2200) {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback(
    (message: string) => {
      setToast(message)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setToast(null), durationMs)
    },
    [durationMs],
  )
  return { toast, showToast }
}
