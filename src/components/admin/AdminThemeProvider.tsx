/**
 * Thème de la console super-admin, aligné sur celui du CRM.
 *
 * Le CRM Sugar stocke sa préférence clair/sombre dans `megga.sugar.dark`
 * ('1' / '0', défaut = préférence système) ; le reste de l'app utilisait
 * `megga-theme` ('light' / 'dark'). Deux clés sans lien, donc deux réglages qui
 * divergeaient — bascule en sombre côté CRM, console restée en clair.
 *
 * La console adopte la clé Sugar. Elle continue de poser `data-theme` sur
 * `<html>`, puisque c'est ce que lisent les variables CSS des pages
 * (globals.css, re-teintes par admin-console.css) : même interrupteur que le
 * CRM, même noir.
 *
 * ⚠️ `data-theme` est un attribut GLOBAL, que le provider du CRM pilote depuis
 * une autre clé (`megga-theme`). La console le pose pour que les surfaces
 * rendues en portal — modales, toasts, hors de `.megga-admin-console` — suivent
 * son mode ; elle le RESTAURE donc en sortant, sans quoi le CRM héritait du
 * réglage de la console jusqu'à la prochaine bascule manuelle.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
// Lecture de la préférence : source unique `@/lib/sugarDark`. Ce module en
// hébergeait une copie identique, jamais importée ailleurs — deux définitions à
// garder en phase pour rien.
import {
  applySugarThemeAttribute,
  captureThemeAttribute,
  readSugarDark,
  SUGAR_DARK_KEY as STORAGE_KEY,
} from '@/lib/sugarDark'

interface AdminThemeState {
  dark: boolean
  setDark: (v: boolean) => void
  toggle: () => void
}

const AdminThemeContext = createContext<AdminThemeState | undefined>(undefined)

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(readSugarDark)

  // Rendre `data-theme` au CRM en sortant. Déclaré AVANT l'effet ci-dessous
  // pour capturer la valeur d'origine : au montage, les effets s'exécutent dans
  // l'ordre de déclaration.
  useEffect(() => captureThemeAttribute(document.documentElement), [])

  useEffect(() => {
    applySugarThemeAttribute(document.documentElement, dark)
    window.localStorage.setItem(STORAGE_KEY, dark ? '1' : '0')
  }, [dark])

  // Cross-onglet : deux consoles ouvertes suivent le même réglage.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDarkState(readSugarDark())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const setDark = useCallback((v: boolean) => setDarkState(v), [])
  const toggle = useCallback(() => setDarkState(v => !v), [])

  return (
    <AdminThemeContext.Provider value={{ dark, setDark, toggle }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

/** Accès au thème de la console. Lance si appelé hors du provider (bug de montage). */
// Hook colocalisé avec son provider (contexte privé au module) : Fast Refresh
// perd le state de ce fichier à chaque édition, compromis assumé — cf. useAuth.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminTheme(): AdminThemeState {
  const ctx = useContext(AdminThemeContext)
  if (!ctx) throw new Error('useAdminTheme doit être appelé sous <AdminThemeProvider>')
  return ctx
}
