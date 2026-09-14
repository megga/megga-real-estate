/**
 * Le coin haut-droit du CADRE de page — le « pager » — et son rayon réel.
 *
 * Pour qu'un menu ouvert depuis la bande d'onglets se loge EXACTEMENT dans le coin
 * du cadre qu'il recouvre (retour de Julien, 14.09.2026 : « le dropdown doit
 * épouser l'arrondi du pager »). Deux choses ne se supposent pas, elles se mesurent :
 *
 * 1. **Le rayon.** Les cadres de page portent 26 px, un littéral hors échelle écrit
 *    sur treize pages, quand `--crm-radius-6xl` vaut 24. Deux courbes de 24 et 26
 *    posées sur le même coin ne se rejoignent qu'aux tangentes : entre les deux, un
 *    croissant du cadre dépasse du menu. Le recopier ici ferait un quatorzième
 *    littéral ; on lit donc le rayon CALCULÉ du cadre, et le menu suivra s'il change.
 * 2. **Le cadre lui-même.** Chaque surface monte le sien, à sa profondeur, sans
 *    marque commune. On le trouve par la géométrie, sous un point franchement
 *    intérieur au coin : le plus EXTÉRIEUR des éléments arrondis dont le bord droit
 *    est celui de la bande — c'est le contrat de `CrmWorkspace`, qui aligne les
 *    gouttières de la bande sur celles du `<main>` — et qui commence juste sous elle.
 *    Les écrans d'onglet cachés sont en `visibility: hidden`, donc hors du test de
 *    frappe : seul le cadre visible répond.
 *
 * ⚠ LA MESURE NE PASSE PAS PAR UN `ResizeObserver`, et c'est mesuré (4 septembre 2026,
 * sur la pose latérale qui l'a précédé) : posé sur une popover et son ancre, il a rendu
 * ZÉRO livraison en 500 ms, et la popover restait garée hors écran. D'où : une première
 * mesure en MICROTÂCHE — une frame ne tire pas quand le rendu est gelé (onglet en
 * arrière-plan, volet d'aperçu masqué), un microtask si — puis une sonde rAF brève, et
 * le `setState` dans les rappels, jamais dans le corps de l'effet.
 *
 * Il sert les DEUX popovers de la bande (menu du compte et cloche), qui se posent donc
 * au même coin, au même rayon.
 */
import { useEffect, useState, type RefObject } from 'react'

/** Le coin où se loger, en pixels de fenêtre. */
export interface CoinCadre {
  top: number
  right: number
  /** Rayon haut-droit calculé du cadre (`'26px'`). Vide quand aucun cadre n'a répondu. */
  rayon: string
}

/** Durée de la sonde : couvre une mise en page qui se stabilise juste après l'ouverture. */
const SONDE_MS = 400
/** Où l'on sonde : assez loin du coin pour tomber DANS la courbe, quel que soit le rayon. */
const RETRAIT_SONDE = 40
/** Écart toléré entre le haut du cadre et le bas de la bande (la gouttière vaut 12). */
const ECART_MAX = 32
/** Sous ce rayon, un élément arrondi n'est pas un cadre de page. */
const RAYON_MIN = 12
/** Repli sans cadre : sous l'ancre, à cette gouttière. */
const GOUTTIERE_REPLI = 10

function trouverCadre(bande: DOMRect, exclure: HTMLElement | null): HTMLElement | null {
  let retenu: HTMLElement | null = null
  // Du plus haut (le plus profond) au plus bas (la racine) : le DERNIER retenu est le
  // plus extérieur. Un conteneur intérieur qui partagerait le même coin céderait au cadre.
  for (const el of document.elementsFromPoint(bande.right - RETRAIT_SONDE, bande.bottom + RETRAIT_SONDE)) {
    if (!(el instanceof HTMLElement) || exclure?.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (Math.abs(r.right - bande.right) > 2) continue
    if (r.top < bande.bottom || r.top - bande.bottom > ECART_MAX) continue
    if (parseFloat(getComputedStyle(el).borderTopRightRadius) < RAYON_MIN) continue
    retenu = el
  }
  return retenu
}

/**
 * Mesure, tant que `actif`, le coin haut-droit du cadre posé sous la bande `bandeRef`.
 * `menuRef` désigne le menu lui-même, qu'il faut ignorer : ouvert, il recouvre le point
 * sondé. Sans cadre trouvé, le coin retombe sous `ancreRef`.
 */
export function useCoinDuCadre(
  actif: boolean,
  bandeRef: RefObject<HTMLElement | null>,
  ancreRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
): CoinCadre | null {
  const [coin, setCoin] = useState<CoinCadre | null>(null)
  // Refermé, on oublie le coin : à la réouverture, une fenêtre redimensionnée entre-temps
  // ferait sinon paraître le menu une frame à l'ancienne place.
  if (!actif && coin) setCoin(null)

  useEffect(() => {
    if (!actif) return
    const place = () => {
      const bande = bandeRef.current?.getBoundingClientRect()
      if (!bande) return
      const cadre = trouverCadre(bande, menuRef.current)
      let next: CoinCadre
      if (cadre) {
        const r = cadre.getBoundingClientRect()
        next = { top: Math.round(r.top), right: Math.round(r.right), rayon: getComputedStyle(cadre).borderTopRightRadius }
      } else {
        const a = (ancreRef.current ?? bandeRef.current)?.getBoundingClientRect() ?? bande
        next = { top: Math.round(a.bottom + GOUTTIERE_REPLI), right: Math.round(bande.right), rayon: '' }
      }
      setCoin(prev => (prev && prev.top === next.top && prev.right === next.right && prev.rayon === next.rayon ? prev : next))
    }
    queueMicrotask(place)
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      place()
      if (performance.now() - t0 < SONDE_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', place)
    // En capture : une page qui défile emporte la bande ET le cadre, le menu doit suivre.
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [actif, bandeRef, ancreRef, menuRef])

  return actif ? coin : null
}
