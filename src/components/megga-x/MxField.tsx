// MEGGA X — Champ de formulaire : libellé, contrôle, texte d'aide. Le gabarit
// est celui des écrans d'authentification de la vitrine
// (`<div><label for>…</label><input class="input"></div>`, cf. signup.html) ;
// seul le texte d'aide n'y existe pas et vient de megga-x-additions.css, qui
// documente pourquoi.
//
// Pourquoi ce composant plutôt que `MxInput` seul : les cinq étapes du wizard
// d'identité posent 21 champs dont plusieurs portent une précision légale
// (« La dénomination officielle inscrite au registre du commerce »), et
// `MxInput` est un passe-plat sur `<input class="input">` — ni libellé, ni aide.
// Sans ce composant, chaque appelant réinventerait les deux.
//
// PAS d'état d'erreur par champ, et c'est délibéré : le wizard valide en
// tout-ou-rien à l'étape (isAgencyStepComplete & co. gâtent le bouton
// Continuer), aucun appelant n'a donc d'erreur à afficher SOUS un champ.
// L'ajouter ici en prévision créerait la prop, la classe CSS et la règle de
// style que personne ne consomme — exactement le code mort que le dépôt
// proscrit. À rétablir d'un bloc le jour où la validation devient par champ.

import { useId, type ReactNode } from 'react'

interface Props {
  /** Libellé visible. Rendu dans un vrai <label for>, jamais un div stylé. */
  label: ReactNode
  /**
   * Le contrôle. En fonction, il reçoit l'id à poser sur l'élément saisissable
   * — c'est ce qui relie le libellé au champ sans que l'appelant invente un id.
   * En nœud simple pour les contrôles qui portent déjà leur propre étiquetage
   * (groupe de radios, zone de dépôt), où un `for` unique n'aurait pas de sens.
   */
  children: ReactNode | ((id: string) => ReactNode)
  /** Précision sous le champ. Toujours visible, ce n'est pas une info-bulle. */
  help?: ReactNode
  /**
   * Commande posée à droite du libellé, sur sa ligne — le « i » qui déplie la
   * définition des choix, aujourd'hui son seul usage (StepSignataire).
   *
   * HORS du `<label>` et non dedans : un `<button>` imbriqué dans un `<label>`
   * est du contenu interactif dans un élément qui capte déjà le clic pour son
   * contrôle. Le rendre frère laisse les deux gestes distincts — cliquer le
   * libellé vise le champ, cliquer le « i » ouvre l'aide.
   */
  labelAction?: ReactNode
  className?: string
}

export default function MxField({ label, children, help, labelAction, className }: Props) {
  const id = useId()
  // `for` UNIQUEMENT quand un contrôle a reçu cet id (enfant en fonction). En
  // nœud simple — groupe de radios, zone de dépôt — aucun élément ne le porte :
  // un `for` pointerait vers un id inexistant, ce que la spec HTML interdit
  // (« the ID of a labelable element in the same tree ») et que les lecteurs
  // d'écran ignorent au mieux. Ces cas-là portent leur propre étiquetage
  // (role + aria-label sur le groupe), le libellé visible n'a rien à désigner.
  const hasControl = typeof children === 'function'
  return (
    <div className={className}>
      {labelAction == null ? (
        <label htmlFor={hasControl ? id : undefined}>{label}</label>
      ) : (
        // La marge basse du <label> de la vitrine vit sur le label lui-même : la
        // ligne qui l'enveloppe ne la réplique pas, elle le laisse la porter.
        <div className="mx-label-row">
          <label htmlFor={hasControl ? id : undefined}>{label}</label>
          {labelAction}
        </div>
      )}
      {hasControl ? children(id) : children}
      {help != null && (
        <div className="mg-top-5x-extra-small">
          <p className="paragraph-small mx-field__help">{help}</p>
        </div>
      )}
    </div>
  )
}
