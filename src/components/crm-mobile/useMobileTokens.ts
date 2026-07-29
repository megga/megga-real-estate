import { useTheme } from '@/hooks/useTheme'
import { useDarkTone } from '@/hooks/useDarkTone'
import { MT_DARK, MT_LIGHT, type MobileTokens } from './tokens'

/**
 * Tokens Sugar Pure mobile liés au thème global de l'app.
 *
 * Source UNIQUE de la bascule clair/sombre : `useTheme()` (qui pose
 * `data-theme` sur <html>). Pas de localStorage parallèle, pas de second
 * contexte — on évite toute désynchronisation avec le ThemeProvider.
 *
 * `useDarkTone()` n'est lu que pour l'abonnement : les surfaces de `MT_DARK`
 * sont des getters sur l'échelle active, donc c'est ce hook qui provoque le
 * re-render à la bascule de teinte — sans lui le mobile garderait l'ancienne.
 */
export function useMobileTokens(): { tk: MobileTokens; isDark: boolean } {
  const { theme } = useTheme()
  useDarkTone()
  const isDark = theme === 'dark'
  return { tk: isDark ? MT_DARK : MT_LIGHT, isDark }
}
