/**
 * Le glissé d'un événement du Calendrier — d'une heure et d'un JOUR à l'autre.
 *
 * Deux moteurs, un par forme de grille : `useCalDeplacement` pour les colonnes
 * horaires (Semaine, Jour), `useCalGlisseMois` pour les cases du mois. Les calculs
 * purs vivent dans `calDeplacement.ts` ; les fantômes qui suivent le pointeur sont
 * rendus par les vues (`CalFantome`, `FantomeMois`).
 *
 * ⛔ POURQUOI LE GLISSÉ EST PORTÉ PAR LA VUE, ET NON PAR LE BLOC. Porté par le bloc, il
 * déplaçait l'événement en direct dans les données ; mais un événement qui change de
 * jour change de colonne — le bloc est démonté d'une colonne et remonté dans l'autre, et
 * le glissé mourait avec lui. Il n'y avait donc qu'un axe, l'heure : impossible de
 * changer une tâche de jour à la souris (Julien, 14.09.2026).
 *
 * Ici l'événement ne bouge PAS pendant le glissé : il reste en place, estompé, et un
 * FANTÔME montre où il tomberait. Rien n'est écrit avant le relâché, qui pose l'horaire
 * (`onUpdate`) et l'enregistre (`onCommit`) dans le même rendu. Échap annule ; un clic
 * sans mouvement reste un clic (la bulle s'ouvre).
 *
 * ⚠ Les moteurs sont créés UNE fois par vue (`useState`) : les écouteurs posés sur
 * `window` doivent être les mêmes fonctions à la pose et au retrait. Ils reçoivent leurs
 * options après chaque rendu (`regler`), jamais pendant.
 *
 * ⚠ L'Échap du glissé est un écouteur clavier GLOBAL, posé depuis un écran d'onglet :
 * il ne vit que le temps d'un glissé, qu'un écran caché ne peut pas commencer (aucun
 * pointeur n'y arrive) ; et si l'écran passe en arrière-plan en plein geste, le glissé
 * s'abandonne (`useEcranActif`) — un écran caché se tait.
 */
import { useEffect, useLayoutEffect, useState } from 'react'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { CalEvent } from './data'
import { CAL_HOUR_END, CAL_HOUR_START, calSetBodyDrag } from './helpers'
import { calColonneSous, calDecalerDeJours, calEcartJours, calPlacer } from './calDeplacement'

/**
 * Avale le clic qui suit un glissé : relâcher un bloc ne doit ni ouvrir sa bulle,
 * ni créer un créneau dans la colonne où il tombe.
 */
export function calAvalerClic(): void {
  const avale = (cev: MouseEvent) => { cev.stopPropagation(); cev.preventDefault() }
  window.addEventListener('click', avale, true)
  setTimeout(() => window.removeEventListener('click', avale, true), 0)
}

type Deplacer = (id: string, start: Date, end: Date) => void
type Enregistrer = (id: string, mode: 'move' | 'resize', start: Date, end: Date, title: string) => void

/** Distance au-delà de laquelle une pression devient un glissé — en deçà, c'est un clic. */
const SEUIL_GLISSE_PX = 4
/** Bande, en haut et en bas du corps, où le pointeur fait défiler la journée. */
const BORD_DEFILEMENT_PX = 56
const VITESSE_DEFILEMENT_MAX = 18
const MINUTES_GRILLE = (CAL_HOUR_END - CAL_HOUR_START) * 60

/** Les écouteurs d'un glissé, posés à la saisie et retirés au relâché. */
function ecouter(bouger: (pe: PointerEvent) => void, lacher: () => void, abandonner: () => void, clavier: (ke: KeyboardEvent) => void, poser: boolean) {
  if (poser) {
    window.addEventListener('pointermove', bouger)
    window.addEventListener('pointerup', lacher)
    window.addEventListener('pointercancel', abandonner)
    // En CAPTURE : Échap doit arrêter le glissé avant qu'un autre écouteur ne ferme autre chose.
    window.addEventListener('keydown', clavier, true)
  } else {
    window.removeEventListener('pointermove', bouger)
    window.removeEventListener('pointerup', lacher)
    window.removeEventListener('pointercancel', abandonner)
    window.removeEventListener('keydown', clavier, true)
  }
}

// ─── Colonnes horaires (Semaine / Jour) ──────────────────────────────────────

/** Ce que montre le glissé en cours : où l'événement tomberait s'il était lâché maintenant. */
export interface CalGlisse {
  ev: CalEvent
  /** Index de la colonne visée. */
  colonne: number
  start: Date
  end: Date
  /** Bord gauche et largeur de la colonne visée, dans le repère de la grille. */
  gauche: number
  largeur: number
}

export interface CalDeplacementOptions {
  /** Les jours des colonnes, dans l'ordre de la grille. */
  jours: Date[]
  /** La grille (gouttière + colonnes `data-cal-col`), en `position: relative` : le fantôme s'y pose. */
  grilleRef: React.RefObject<HTMLDivElement | null>
  /** Le corps qui défile — il défile SEUL quand le pointeur approche d'un bord. */
  corpsRef: React.RefObject<HTMLDivElement | null>
  onUpdate: Deplacer
  onCommit: Enregistrer
  /** Le glissé vient de partir (seuil franchi) — la bulle ouverte doit se fermer. */
  onDebut?: (id: string) => void
}

interface EtatGlisse {
  ev: CalEvent
  x0: number
  y0: number
  x: number
  y: number
  /** Minute sous le pointeur à la saisie, dans le repère de la grille — le défilement n'y touche pas. */
  minuteSaisie: number
  colonnes: { left: number; right: number; gauche: number; largeur: number }[]
  lance: boolean
  /** Échap en plein glissé : plus rien ne se pose, mais le clic du relâché reste à avaler. */
  annule: boolean
  raf: number
  cible: CalGlisse | null
}

/**
 * Glisser un bloc dans une grille de colonnes horaires. Le fantôme se CALE (quart
 * d'heure, colonne) : l'état ne change qu'à chaque cran, pas à chaque pixel.
 */
export function useCalDeplacement(options: CalDeplacementOptions): {
  glisse: CalGlisse | null
  saisir: (ev: CalEvent, pe: React.PointerEvent<HTMLElement>) => void
} {
  const [glisse, setGlisse] = useState<CalGlisse | null>(null)
  const [moteur] = useState(() => creerMoteurColonnes(setGlisse))
  useLayoutEffect(() => { moteur.regler(options) })
  // Démonté (changement de vue) ou caché (bascule d'onglet) en plein glissé : rien ne
  // doit rester accroché à `window`.
  const actif = useEcranActif()
  useEffect(() => { if (!actif) moteur.abandonner() }, [actif, moteur])
  useEffect(() => moteur.abandonner, [moteur])
  return { glisse, saisir: moteur.saisir }
}

function creerMoteurColonnes(poser: (g: CalGlisse | null) => void) {
  let o: CalDeplacementOptions | null = null
  let etat: EtatGlisse | null = null

  const calculer = () => {
    const s = etat
    const grille = o?.grilleRef.current
    if (!o || !s || s.annule || !grille) return
    const r = grille.getBoundingClientRect()
    if (!r.height) return
    const pxParMin = r.height / MINUTES_GRILLE
    const colonne = calColonneSous(s.x, s.colonnes)
    const jour = o.jours[colonne]
    if (!jour) return
    const { start, end } = calPlacer(s.ev, jour, (s.y - r.top) / pxParMin - s.minuteSaisie)
    if (s.cible && s.cible.colonne === colonne && s.cible.start.getTime() === start.getTime()) return
    const c = s.colonnes[colonne]
    s.cible = { ev: s.ev, colonne, start, end, gauche: c.gauche, largeur: c.largeur }
    poser(s.cible)
  }

  // Près d'un bord, la journée défile : sans ça, déplacer une tâche de 9 h à 18 h
  // demandait de la lâcher, défiler, la reprendre — trois gestes pour un.
  const defiler = () => {
    const s = etat
    if (!s) return
    const corps = o?.corpsRef.current
    if (corps && !s.annule) {
      const r = corps.getBoundingClientRect()
      const v = s.y < r.top + BORD_DEFILEMENT_PX ? s.y - (r.top + BORD_DEFILEMENT_PX)
        : s.y > r.bottom - BORD_DEFILEMENT_PX ? s.y - (r.bottom - BORD_DEFILEMENT_PX)
          : 0
      if (v) {
        const avant = corps.scrollTop
        corps.scrollTop = avant + Math.max(-VITESSE_DEFILEMENT_MAX, Math.min(VITESSE_DEFILEMENT_MAX, v / 3))
        if (corps.scrollTop !== avant) calculer()
      }
    }
    s.raf = requestAnimationFrame(defiler)
  }

  const bouger = (pe: PointerEvent) => {
    const s = etat
    if (!s) return
    s.x = pe.clientX
    s.y = pe.clientY
    if (!s.lance) {
      if (Math.hypot(s.x - s.x0, s.y - s.y0) < SEUIL_GLISSE_PX) return
      s.lance = true
      calSetBodyDrag('grabbing')
      o?.onDebut?.(s.ev.id)
      s.raf = requestAnimationFrame(defiler)
    }
    calculer()
  }

  const nettoyer = (): EtatGlisse | null => {
    ecouter(bouger, lacher, abandonner, clavier, false)
    const s = etat
    etat = null
    if (s) {
      cancelAnimationFrame(s.raf)
      if (s.lance) calSetBodyDrag(null)
    }
    return s
  }

  function lacher() {
    const s = nettoyer()
    // Sans glissé, c'était un clic : la bulle s'ouvre comme avant.
    if (!s || !s.lance) return
    calAvalerClic()
    const c = s.cible
    if (o && !s.annule && c && (c.start.getTime() !== s.ev.start.getTime() || c.end.getTime() !== s.ev.end.getTime())) {
      o.onUpdate(s.ev.id, c.start, c.end)
      o.onCommit(s.ev.id, 'move', c.start, c.end, s.ev.title)
    }
    poser(null)
  }

  // Glissé interrompu (geste système, pointeur perdu, vue démontée) : rien ne se pose.
  function abandonner() {
    if (nettoyer()) poser(null)
  }

  function clavier(ke: KeyboardEvent) {
    const s = etat
    if (ke.key !== 'Escape' || !s?.lance || s.annule) return
    ke.preventDefault()
    ke.stopPropagation()
    s.annule = true
    s.cible = null
    calSetBodyDrag(null)
    poser(null)
  }

  const saisir = (ev: CalEvent, pe: React.PointerEvent<HTMLElement>) => {
    const grille = o?.grilleRef.current
    if (pe.button !== 0 || etat || !grille) return
    const cols = Array.from(grille.querySelectorAll<HTMLElement>('[data-cal-col]'))
      .sort((a, b) => Number(a.dataset.calCol) - Number(b.dataset.calCol))
    const r = grille.getBoundingClientRect()
    if (!cols.length || !r.height) return
    // Ni sélection de texte ni glisser natif du navigateur ; et la colonne ne doit pas
    // prendre la pression pour le début d'une création.
    pe.preventDefault()
    pe.stopPropagation()
    etat = {
      ev,
      x0: pe.clientX, y0: pe.clientY, x: pe.clientX, y: pe.clientY,
      minuteSaisie: (pe.clientY - r.top) / (r.height / MINUTES_GRILLE),
      colonnes: cols.map(c => {
        const b = c.getBoundingClientRect()
        return { left: b.left, right: b.right, gauche: c.offsetLeft, largeur: c.offsetWidth }
      }),
      lance: false, annule: false, raf: 0, cible: null,
    }
    ecouter(bouger, lacher, abandonner, clavier, true)
  }

  return { saisir, abandonner, regler: (options: CalDeplacementOptions) => { o = options } }
}

// ─── Cases du mois ───────────────────────────────────────────────────────────

/** Le glissé d'une pastille du mois : sa case de départ, la case visée, et où la tient le pointeur. */
export interface CalGlisseMois {
  ev: CalEvent
  /** Case où la pastille a été saisie — une pastille multi-jours en occupe plusieurs. */
  depart: number
  cible: number | null
  x: number
  y: number
  /** Point de saisie dans la pastille : le fantôme reste accroché là où on l'a prise. */
  dx: number
  dy: number
  largeur: number
}

export interface CalGlisseMoisOptions {
  /** Les jours des cases, dans l'ordre de leur attribut `data-cal-cell`. */
  jours: Date[]
  onUpdate: Deplacer
  onCommit: Enregistrer
  onDebut?: (id: string) => void
}

/**
 * Glisser une pastille d'une case du mois à une autre : heure et durée intactes, le
 * décalage se compte en jours civils.
 *
 * ⚠ Le fantôme suit le pointeur SANS rendu React : sa position est écrite dans son
 * style à chaque mouvement (`fantome`, sa référence). Un état par pixel re-rendait les
 * quarante-deux cases du mois et toutes leurs pastilles — c'est ce qui rend un glissé
 * saccadé. L'état ne change qu'au départ, quand la case visée change, et au relâché.
 */
export function useCalGlisseMois(options: CalGlisseMoisOptions): {
  glisse: CalGlisseMois | null
  saisir: (ev: CalEvent, depart: number, pe: React.PointerEvent<HTMLElement>) => void
  fantome: (el: HTMLElement | null) => void
} {
  const [glisse, setGlisse] = useState<CalGlisseMois | null>(null)
  const [moteur] = useState(() => creerMoteurMois(setGlisse))
  useLayoutEffect(() => { moteur.regler(options) })
  const actif = useEcranActif()
  useEffect(() => { if (!actif) moteur.abandonner() }, [actif, moteur])
  useEffect(() => moteur.abandonner, [moteur])
  return { glisse, saisir: moteur.saisir, fantome: moteur.fantome }
}

function creerMoteurMois(poser: (g: CalGlisseMois | null) => void) {
  let o: CalGlisseMoisOptions | null = null
  let etat: (CalGlisseMois & { x0: number; y0: number; lance: boolean; annule: boolean }) | null = null
  let noeud: HTMLElement | null = null

  const placer = () => {
    if (etat && noeud) noeud.style.transform = `translate3d(${etat.x - etat.dx}px, ${etat.y - etat.dy}px, 0)`
  }
  const instantane = (): CalGlisseMois | null => etat && {
    ev: etat.ev, depart: etat.depart, cible: etat.cible, x: etat.x, y: etat.y, dx: etat.dx, dy: etat.dy, largeur: etat.largeur,
  }
  // Le fantôme ignore le pointeur (`pointer-events: none`) : la case sous le curseur est
  // bien celle qu'on vise, pas le fantôme lui-même.
  const caseSous = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cal-cell]')
    return el ? Number(el.dataset.calCell) : null
  }

  const bouger = (pe: PointerEvent) => {
    const s = etat
    if (!s) return
    s.x = pe.clientX
    s.y = pe.clientY
    if (!s.lance) {
      if (Math.hypot(s.x - s.x0, s.y - s.y0) < SEUIL_GLISSE_PX) return
      s.lance = true
      calSetBodyDrag('grabbing')
      o?.onDebut?.(s.ev.id)
      poser(instantane())
    }
    if (s.annule) return
    placer()
    const cible = caseSous(s.x, s.y)
    if (cible !== s.cible) {
      s.cible = cible
      poser(instantane())
    }
  }

  const nettoyer = () => {
    ecouter(bouger, lacher, abandonner, clavier, false)
    const s = etat
    etat = null
    if (s?.lance) calSetBodyDrag(null)
    return s
  }

  function lacher() {
    const s = nettoyer()
    if (!s || !s.lance) return
    calAvalerClic()
    const de = o?.jours[s.depart]
    const vers = s.cible == null ? undefined : o?.jours[s.cible]
    if (o && !s.annule && de && vers) {
      const jours = calEcartJours(de, vers)
      if (jours) {
        const { start, end } = calDecalerDeJours(s.ev, jours)
        o.onUpdate(s.ev.id, start, end)
        o.onCommit(s.ev.id, 'move', start, end, s.ev.title)
      }
    }
    poser(null)
  }

  function abandonner() {
    if (nettoyer()) poser(null)
  }

  function clavier(ke: KeyboardEvent) {
    const s = etat
    if (ke.key !== 'Escape' || !s?.lance || s.annule) return
    ke.preventDefault()
    ke.stopPropagation()
    s.annule = true
    calSetBodyDrag(null)
    poser(null)
  }

  const saisir = (ev: CalEvent, depart: number, pe: React.PointerEvent<HTMLElement>) => {
    if (pe.button !== 0 || etat) return
    pe.preventDefault()
    pe.stopPropagation()
    const r = pe.currentTarget.getBoundingClientRect()
    etat = {
      ev, depart, cible: depart,
      x0: pe.clientX, y0: pe.clientY, x: pe.clientX, y: pe.clientY,
      dx: pe.clientX - r.left, dy: pe.clientY - r.top, largeur: r.width,
      lance: false, annule: false,
    }
    ecouter(bouger, lacher, abandonner, clavier, true)
  }

  /** Référence du fantôme : posé, il prend aussitôt la position courante du pointeur. */
  const fantome = (el: HTMLElement | null) => {
    noeud = el
    placer()
  }

  return { saisir, abandonner, fantome, regler: (options: CalGlisseMoisOptions) => { o = options } }
}
