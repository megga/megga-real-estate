import { useTheme } from '@/hooks/useTheme'
import { MT_DARK, MT_LIGHT, type MobileTokens } from './tokens'

/**
 * Tokens Sugar Pure mobile liés au thème global de l'app.
 *
 * Source UNIQUE de la bascule clair/sombre : `useTheme()` (qui pose
 * `data-theme` sur <html>). Pas de localStorage parallèle, pas de second
 * contexte — on évite toute désynchronisation avec le ThemeProvider.
 *
 * L'abonnement à la teinte a disparu avec le choix Graphite / Noir pur : les
 * surfaces de `MT_DARK` restent des getters, mais sur une échelle unique.
 */
export function useMobileTokens(): { tk: MobileTokens; isDark: boolean } {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return { tk: isDark ? MT_DARK : MT_LIGHT, isDark }
}
