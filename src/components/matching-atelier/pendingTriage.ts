// Atelier Matching — exécution différée des gestes (undo 5 s, style Gmail).
//
// Un triage ne touche PAS la base tant que le toast offre « Annuler » :
// l'UI sort la row immédiatement (état local), l'écriture réelle (match,
// deal, timeline, relance interne) part à l'expiration de la fenêtre. Aucune
// n'écrit à l'acheteur : le matching reste chez l'agent (21.09.2026).
// Annuler = rien n'a jamais été écrit. « Voir le deal → » force l'exécution
// immédiate (flushNow) pour obtenir l'id du deal. À la fermeture de la page,
// tout ce qui est en attente est exécuté (l'agent n'a pas annulé).

import type { ResultatProposition } from '@/hooks/useAtelierMatching'

export const UNDO_WINDOW_MS = 4500

export interface PendingHandle {
  cancel: () => void
  /** force l'exécution immédiate et renvoie le résultat (null si annulé/échec) */
  flushNow: () => Promise<ResultatProposition | null>
}

export interface AtelierGestes {
  /** « Je l'ai proposé » : l'agent a présenté le bien lui-même, le CRM consigne. Sans effet sur un
   *  match qui n'est plus à proposer (`ResultatProposition.deja`) */
  send: (matchId: string) => PendingHandle
  /** « J'ai relancé » : la relance interne est repoussée, rien n'est envoyé */
  relance: (matchId: string) => PendingHandle
  snooze: (matchId: string) => PendingHandle
  dismiss: (matchId: string) => PendingHandle
  /** réponse de l'acheteur, consignée par l'agent (Intéressé / Pas intéressé) → matches.status
   *  interested/rejected, produit response_at via trigger. Même fenêtre d'annulation 5 s. */
  react: (matchId: string, reaction: 'interested' | 'rejected') => PendingHandle
  /** réactivation d'un reporté — immédiate, pas de fenêtre d'annulation */
  wake: (matchId: string) => void
  /** « Proposer une visite » — bascule vers le flux visite (picker réel) */
  visit: (matchId: string) => void
}

interface DeferOptions {
  onSettled?: () => void
  onError?: (err: unknown) => void
}

/** Registre des écritures en attente — flush global au démontage de la page */
export class PendingRegistry {
  private pending = new Set<() => Promise<unknown>>()

  defer(exec: () => Promise<ResultatProposition | null>, opts: DeferOptions = {}): PendingHandle {
    let cancelled = false
    let started = false
    let resultPromise: Promise<ResultatProposition | null> | null = null

    const run = (): Promise<ResultatProposition | null> => {
      if (cancelled) return Promise.resolve(null)
      if (!started) {
        started = true
        this.pending.delete(run)
        resultPromise = exec()
          .catch((err: unknown) => {
            console.error('[atelier] geste différé en échec', err)
            opts.onError?.(err)
            return null
          })
          .finally(() => opts.onSettled?.())
      }
      return resultPromise ?? Promise.resolve(null)
    }

    this.pending.add(run)
    const timer = setTimeout(() => { void run() }, UNDO_WINDOW_MS)

    return {
      cancel: () => {
        if (started) return // trop tard — déjà parti
        cancelled = true
        clearTimeout(timer)
        this.pending.delete(run)
      },
      flushNow: () => {
        clearTimeout(timer)
        return run()
      },
    }
  }

  /** Exécute tout ce qui attend encore (fermeture de l'atelier) */
  flushAll(): void {
    for (const run of Array.from(this.pending)) void run()
    this.pending.clear()
  }
}
