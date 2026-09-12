/**
 * Le client React Query de l'app — ses défauts, et pourquoi il n'y en a qu'un.
 *
 * ⚠ Ce fichier n'éprouve pas la garde des écrans cachés (`IsRestoringProvider`
 * dans `EcranVivant`) : elle se joue au rendu, et le dépôt n'a pas d'outillage
 * de rendu de hooks. Il fige les réglages dont une dérive serait SILENCIEUSE.
 */

import { describe, it, expect } from 'vitest'
import { queryClient } from '@/lib/queryClients'

describe('queryClient — les défauts de l’app', () => {
  it('rafraîchit au retour sur la page et à la reconnexion', () => {
    const q = queryClient.getDefaultOptions().queries
    expect(q?.refetchOnWindowFocus).toBe(true)
    expect(q?.refetchOnReconnect).toBe(true)
  })

  it('⛔ garde une donnée inactive 30 min — le temps qu’un écran peut passer caché', () => {
    // Un écran vivant mais caché est désabonné de ses requêtes. À 5 min (le défaut
    // de TanStack), sa donnée était ramassée pendant qu'il attendait, et il
    // réapparaissait sur des squelettes.
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(1000 * 60 * 30)
  })

  it('⛔ `gcTime` reste au-dessus de `staleTime` — sinon une donnée périmée disparaît avant d’être relue', () => {
    const q = queryClient.getDefaultOptions().queries
    expect(Number(q?.gcTime)).toBeGreaterThan(Number(q?.staleTime))
  })

  it('les réglages qui protègent d’un `navigator.onLine` coincé sont posés', () => {
    // `networkMode: 'always'` : Chrome rapporte parfois « hors ligne » après une
    // veille ou une bascule WiFi↔4G, et le drapeau peut rester coincé — les
    // requêtes resteraient en pause, sur des squelettes éternels, sans erreur.
    expect(queryClient.getDefaultOptions().queries?.networkMode).toBe('always')
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe('always')
  })
})
