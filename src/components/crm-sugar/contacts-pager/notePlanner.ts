/**
 * Planificateur d'écriture de la note de contact — le débounce, isolé de React.
 *
 * POURQUOI CE FICHIER EXISTE. La partie subtile de l'enregistrement de la note
 * n'est pas le délai, c'est ce qu'on fait de la frappe EN ATTENTE quand la fiche
 * disparaît. Annuler le minuteur au démontage — le geste réflexe, et ce que
 * demandait littéralement l'audit — PERDRAIT la dernière frappe : l'agent a
 * tapé, il quitte, rien n'est écrit. C'est pire que le défaut qu'on corrige.
 *
 * On CHASSE donc au lieu d'annuler : à la perte de focus et au démontage,
 * l'écriture en attente part immédiatement.
 *
 * Ce comportement n'est pas éprouvable depuis un composant — le dépôt n'a aucun
 * moteur de rendu React dans ses tests. D'où cette fonction, sans React et sans
 * état de module, que `notePlanner.spec.ts` met à l'épreuve avec de faux
 * minuteurs.
 *
 * ⚠ L'écrivain est capturé À CHAQUE FRAPPE, pas à la création. Un planificateur
 * créé une fois (`useRef`) garderait sinon la fermeture du premier rendu, et
 * écrirait sur un contact qu'on a quitté depuis.
 */

/** Consomme la valeur à écrire. Ne rend rien : le verdict se traite chez l'appelant. */
type Ecriture = (valeur: string) => void

export interface NotePlanner {
  /** Une frappe : arme, ou ré-arme, le délai. */
  frapper(valeur: string, ecrire: Ecriture): void
  /** Écrit maintenant ce qui attend. Sans attente, ne fait rien. */
  chasser(): void
  /** Une frappe attend-elle encore ? Sert à éprouver le planificateur. */
  enAttente(): boolean
}

/** Délai par défaut — celui que portait `ContactDetailSugarV3Page`. */
export const NOTE_DELAI_MS = 600

export function creerNotePlanner(delaiMs: number = NOTE_DELAI_MS): NotePlanner {
  let minuteur: ReturnType<typeof setTimeout> | null = null
  let attente: { valeur: string; ecrire: Ecriture } | null = null

  /** Désarme et rend ce qui attendait, en une seule opération — pour qu'aucun
   *  chemin ne puisse écrire deux fois la même frappe. */
  const prendre = (): { valeur: string; ecrire: Ecriture } | null => {
    if (minuteur !== null) { clearTimeout(minuteur); minuteur = null }
    const a = attente
    attente = null
    return a
  }

  return {
    frapper(valeur, ecrire) {
      if (minuteur !== null) clearTimeout(minuteur)
      attente = { valeur, ecrire }
      minuteur = setTimeout(() => {
        const a = prendre()
        if (a) a.ecrire(a.valeur)
      }, delaiMs)
    },
    chasser() {
      const a = prendre()
      if (a) a.ecrire(a.valeur)
    },
    enAttente() {
      return attente !== null
    },
  }
}
