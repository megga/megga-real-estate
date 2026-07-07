// Atelier Matching — exécution différée des gestes (undo 5 s, style Gmail).
//
// Un triage ne touche PAS la base tant que le toast offre « Annuler » :
// l'UI sort la row immédiatement (état local), l'écriture réelle (match,
// deal, timeline, reminder, e-mail) part à l'expiration de la fenêtre.
// Annuler = rien n'a jamais été écrit. « Voir le deal → » force l'exécution
// immédiate (flushNow) pour obtenir l'id du deal. À la fermeture de la page,
// tout ce qui est en attente est exécuté (l'agent n'a pas annulé).

import type { SendResult } from '@/hooks/useAtelierMatching'

export const UNDO_WINDOW_MS = 4500

export interface PendingHandle {
  cancel: () => void
  /** force l'exécution immédiate et renvoie le résultat (null si annulé/échec) */
  flushNow: () => Promise<SendResult | null>
}

export interface AtelierGestes {
  /** canal 'reception' = lien privé déjà transmis (WhatsApp / lien copié), pas d'email */
  send: (matchId: string, channel?: 'email' | 'reception') => PendingHandle
  relance: (matchId: string) => PendingHandle
  snooze: (matchId: string) => PendingHandle
  dismiss: (matchId: string) => PendingHandle
  /** réaction du client à un dossier envoyé (HITL) → matches.status interested/rejected,
   *  produit response_at via trigger. Même fenêtre d'annulation 5 s que les autres écritures. */
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

  defer(exec: () => Promise<SendResult | null>, opts: DeferOptions = {}): PendingHandle {
    let cancelled = false
    let started = false
    let resultPromise: Promise<SendResult | null> | null = null

    const run = (): Promise<SendResult | null> => {
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
