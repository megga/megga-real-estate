/**
 * Ferme un menu contextuel au clic DEHORS (gauche comme droit) et à Échap.
 *
 * ⛔ ABONNÉ AU TICK SUIVANT, et c'est ce qui rend le menu ouvrable. Le clic droit
 * qui OUVRE un menu n'a pas fini sa course quand l'effet d'ouverture s'exécute :
 * React vide les effets d'un événement discret avant que l'événement natif
 * n'atteigne le `document`. Abonné tout de suite, le menu recevait son propre clic
 * droit comme un clic « dehors » et se refermait dans la même frame. Mesuré le
 * 13.09.2026 par un vrai clic droit (Playwright) : AUCUN des deux menus de la
 * Messagerie ne s'ouvrait — ni celui d'un libellé du rail, ni celui d'un fil. Seul
 * un appelant qui arrêtait la propagation y échappait, par accident.
 *
 * ⚠ ÉCHAP NE FERME QUE LE MENU : écouté en phase de CAPTURE, et arrêté. Ouvert
 * depuis la bulle d'un événement du Calendrier, le menu laissait passer la touche
 * jusqu'à l'écouteur de la bulle, qui se fermait avec lui.
 *
 * ⚠ Ce hook ne rattrape pas le clic qui SUIT la fermeture : c'est le VOILE posé
 * sous chaque menu qui le reçoit (il ne déclenche donc pas ce qu'il y a dessous),
 * et c'est aussi lui qui reçoit le `pointerdown` qu'un bloc du Calendrier annule
 * pour son glissé — sans voile, ce clic-là ne fermait rien.
 *
 * ⛔ Écran caché muet (onglets gardés vivants) — voir `useEcranActif`.
 */
import { useEffect, type RefObject } from 'react'
import { useEcranActif } from '@/hooks/useEcranActif'

export function useFermetureMenu(ref: RefObject<HTMLElement | null>, onClose: () => void): void {
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!ecranActif) return
    const dehors = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const armement = window.setTimeout(() => {
      document.addEventListener('mousedown', dehors)
      document.addEventListener('contextmenu', dehors)
    }, 0)
    window.addEventListener('keydown', touche, true)
    return () => {
      window.clearTimeout(armement)
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('contextmenu', dehors)
      window.removeEventListener('keydown', touche, true)
    }
  }, [ref, onClose, ecranActif])
}
