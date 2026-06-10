// Mode sombre des pages Sugar — même clé localStorage que le reste du CRM
// (KycSugarV3Page, ContactDetailSugarV3Page…) : l'atelier SUIT le thème
// global, il n'a pas de toggle propre.

import { useEffect, useState } from 'react'

const DARK_LS_KEY = 'megga.sugar.dark'

export function useSugarDark(): boolean {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem(DARK_LS_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    const sync = () => {
      const saved = window.localStorage.getItem(DARK_LS_KEY)
      if (saved === '1') setDark(true)
      else if (saved === '0') setDark(false)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return dark
}
