// MEGGA X — Modale. Transcription de la modale MANUSCRITE de la vitrine
// (sites/megga-vitrine/css/megga-auth.css, `.megga-modal*`) : voile flouté,
// dialogue centré, bouton de fermeture rond, animations, verrou de défilement.
//
// Pourquoi une transcription et non une reprise verbatim : cette modale ne vit
// PAS dans css/styles.css, la seule feuille que lit le générateur
// (scripts/build-megga-x-css.mjs). Elle est donc absente de
// megga-x.generated.css, et son comportement est écrit en DOM impératif dans
// js/megga-auth.js. Les valeurs sont reprises au pixel ; seule la mécanique
// (ouverture, fermeture, focus) est réécrite en React. Voir megga-x-additions.css.
//
// ⚠ PAS de createPortal(document.body), contrairement à la règle générale du
// dépôt pour les modales Sugar : les jetons de la vitrine sont déclarés sur
// `.megga-x` et non sur `:root`, et TOUS les sélecteurs de la feuille exigent
// cet ancêtre. Un portail sur `document.body` sortirait du scope et rendrait la
// modale sans aucun style. Elle est donc rendue en place, et c'est le `position:
// fixed` du voile qui la sort du flux.
// ⚠ Ne jamais monter cette modale dans un conteneur qui porte un `transform` :
// il deviendrait le bloc conteneur des descendants `fixed` et le plein écran se
// retrouverait rogné à la taille du conteneur. `.link-item-image-wrapper` de la
// vitrine porte `transform: translate(0)` — cas réel rencontré ici.

import { useEffect, useId, type ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  /** Titre du dialogue. Nomme la modale pour les lecteurs d'écran (aria-labelledby). */
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Libellé accessible du bouton de fermeture (traduit par l'appelant). */
  closeLabel: string
  /** Largeur du dialogue. Par défaut celle de la vitrine (520 px). */
  wide?: boolean
}

export default function MxModal({ title, onClose, children, closeLabel, wide }: Props) {
  const titleId = useId()
  // ⚠ Pas d'`onEscape` ici : ce composant ferme DÉJÀ sur Échap juste en
  // dessous. Le passer au piège appellerait `onClose` deux fois.
  const dialogRef = useFocusTrap(true)

  // Échap ferme, et le fond ne défile pas pendant ce temps — les deux gestes de
  // la modale vitrine (js/megga-auth.js), portés ici sur le cycle de vie React.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Le focus entre dans le dialogue à l'ouverture : sans ça, Tab continuerait
  // dans la page derrière le voile, que l'utilisateur ne voit plus.

  return (
    <div className="mx-modal" role="presentation">
      {/* Le voile ferme au clic, comme sur la vitrine. Il n'est pas focusable :
          la fermeture au clavier passe par Échap et par le bouton. */}
      <div className="mx-modal__backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        className={`mx-modal__dialog card sign-in-card${wide ? ' mx-modal__dialog--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button type="button" className="mx-modal__close circle-button-secondary" onClick={onClose} aria-label={closeLabel}>
          {/* Deux traits dans un viewBox carré, jamais le caractère « × » : son
              encre se pose sur l'axe mathématique de la police, au-dessus du
              milieu de la ligne, d'où une croix visiblement décalée dans un
              bouton rond. Même raisonnement que la vitrine. */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
        <div className="pd---content-inside-card">
          <h2 id={titleId} className="display-2 semi-bold">{title}</h2>
          <div className="mg-top-3x-extra-small">{children}</div>
        </div>
      </div>
    </div>
  )
}
