/**
 * La bascule clair ↔ sombre du CRM, animée d'UN SEUL geste.
 *
 * ── POURQUOI ─────────────────────────────────────────────────────────────────
 * Retour de Julien, 12 septembre 2026 : « quand je change du noir au clair, il y a
 * encore quelques bugs, surtout sur la nouvelle sidebar ». Mesuré ce jour-là sur
 * `/dev/crm` : la bascule courait sur TROIS horloges à la fois. La carte de la
 * barre latérale changeait à la première frame (sa transition ne porte que sur la
 * largeur), ses lignes fondaient en 180 ms, et sur « Aujourd'hui » tout le reste
 * en 450-550 ms (une règle posait une transition sur chaque descendant). À +100 ms
 * le nom de l'agence valait `rgb(49,49,49)` sur une carte déjà `#050505` —
 * illisible —, la carte d'objectif restait un pavé clair dans une carte noire.
 * 97 transitions de couleur en ligne, 18 durées différentes : aucune retouche
 * locale ne les aurait accordées.
 *
 * ── CE QUE FAIT CE MODULE ────────────────────────────────────────────────────
 * Il prend une photo de l'écran, applique la nouvelle palette d'un coup (toutes
 * les transitions COUPÉES), puis révèle le nouvel écran en cercle depuis le
 * bouton cliqué (View Transitions). Tout change ensemble — dock, portails,
 * dégradés, carte — parce que c'est l'ÉCRAN qui s'anime, pas chaque nœud.
 *
 * ⛔ UNE RÉVÉLATION, PAS UN FONDU. La mise en page ne bouge pas : un fondu enchaîné
 * mélangerait chaque pixel avec son opposé et ferait passer tout texte par un
 * gris moyen — contraste 1,01:1 à mi-course, mesuré sur les couleurs de la barre.
 * Le cercle ne mélange jamais : chaque pixel est ancien ou nouveau.
 *
 * ⚠ Sans l'API (Safari < 18, Firefox < 144), en mouvement réduit, ou onglet caché :
 * la même bascule, transitions coupées, SANS animation — uniforme, jamais à moitié.
 *
 * ⚠ Ce module n'importe rien du CRM : `crmDark.ts` l'appelle, pas l'inverse.
 */
import { flushSync } from 'react-dom'

/** Posé sur `<html>` le temps de la bascule : la feuille y coupe toute transition. */
export const ATTR_BASCULE = 'data-crm-bascule'

/** Durée de la révélation. */
const DUREE_MS = 520

/**
 * ⛔ LA RÉVÉLATION EST RYTHMÉE SUR LA SURFACE, PAS SUR LE RAYON.
 *
 * Premier jet : le rayon suivait la courbe du dock (`.2,.8,.2,1`, départ vif,
 * arrivée lente). Mesuré — cercle parti du bouton ☾, écran 1440×900 — 81 % de
 * l'écran était révélé à 20 % du temps, 96 % à 30 %, et la seconde moitié de
 * l'animation ne découvrait plus qu'un coin : ~220 ms de mouvement puis ~230 ms
 * de quasi-arrêt. Deux ralentissements se cumulaient : celui de la courbe, et
 * celui de la géométrie (partie d'un coin, la dernière part d'écran est infime).
 *
 * On fixe donc la PART D'ÉCRAN découverte au fil du temps, et on en déduit le
 * rayon image par image : ce que l'œil suit, c'est la surface qui change, pas un
 * rayon qui court hors champ. La courbe a été choisie sur ses valeurs, pas sur
 * son nom — 12 % de l'écran à 10 % du temps (le clic répond tout de suite), 41 % à
 * 30 %, 67 % à mi-course, et les 20 % de fin découvrent encore 7 % : le mouvement
 * dure jusqu'au bout. ⚠ La « standard » `.4,0,.2,1`, essayée d'abord, démarrait
 * mou (3 % à 10 %) ; les courbes « ease » habituelles finissaient à 95 % dès 70 %.
 */
const COURBE_SURFACE: [number, number, number, number] = [0.25, 0.25, 0.5, 0.9]

/** Nombre d'images clés : une par ~20 ms, interpolées linéairement entre elles. */
const IMAGES = 26

/** Une courbe de Bézier cubique (0,0)→(1,1), évaluée en `t` par dichotomie sur x. */
function bezier([x1, y1, x2, y2]: [number, number, number, number], t: number): number {
  const coord = (a: number, b: number, s: number) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const s = (lo + hi) / 2
    if (coord(x1, x2, s) < t) lo = s
    else hi = s
  }
  return coord(y1, y2, (lo + hi) / 2)
}

/** Part de la fenêtre couverte par un cercle de rayon `r` centré en (x, y) — par bandes de 8 px. */
function couverture(r: number, x: number, y: number, l: number, h: number): number {
  let aire = 0
  for (let cx = 4; cx < l; cx += 8) {
    const dx = cx - x
    if (Math.abs(dx) >= r) continue
    const demi = Math.sqrt(r * r - dx * dx)
    const haut = Math.max(0, y - demi)
    const bas = Math.min(h, y + demi)
    if (bas > haut) aire += (bas - haut) * 8
  }
  return aire / (l * h)
}

/** Les rayons successifs pour que la part d'écran découverte suive `COURBE_SURFACE`. */
export function rayonsDeRevelation(x: number, y: number, l: number, h: number): number[] {
  const rMax = Math.hypot(Math.max(x, l - x), Math.max(y, h - y))
  return Array.from({ length: IMAGES + 1 }, (_, k) => {
    if (k === 0) return 0
    if (k === IMAGES) return rMax
    const part = bezier(COURBE_SURFACE, k / IMAGES)
    let lo = 0
    let hi = rMax
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2
      if (couverture(m, x, y, l, h) < part) lo = m
      else hi = m
    }
    return hi
  })
}

/**
 * Le dernier geste — d'où partira le cercle.
 *
 * ⚠ Relevé à l'échelle de la fenêtre plutôt que passé par chaque appelant : la
 * bascule part de cinq endroits (bande d'onglets, menu du profil, réglages,
 * tableau de bord d'Analytics…) qui reçoivent tous un `setDark(v)` sans
 * événement. Les faire remonter tous changerait vingt signatures pour une
 * coordonnée.
 * ⚠ Sur le CLIC, en capture, et non sur l'appui : il précède le `onClick` du
 * bouton, donc la bascule qu'il déclenche lit SON geste. Au clavier (Entrée,
 * Espace — `detail === 0`, coordonnées nulles), le cercle part du centre du
 * contrôle activé ; l'appui, lui, n'existait pas, et le cercle partait du coin.
 */
let dernierGeste: { x: number; y: number; t: number } | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    const t = performance.now()
    if (e.detail === 0 && e.target instanceof Element) {
      const r = e.target.getBoundingClientRect()
      dernierGeste = { x: r.left + r.width / 2, y: r.top + r.height / 2, t }
    } else {
      dernierGeste = { x: e.clientX, y: e.clientY, t }
    }
  }, { capture: true, passive: true })
}

/** Le centre du cercle : le geste qui vient d'avoir lieu, sinon le coin du bouton ☀/☾. */
function origine(): { x: number; y: number } {
  if (dernierGeste && performance.now() - dernierGeste.t < 1500) return dernierGeste
  return { x: window.innerWidth - 24, y: 24 }
}

function animable(): boolean {
  if (typeof document.startViewTransition !== 'function') return false
  if (document.visibilityState !== 'visible') return false
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

/**
 * Jeton de la bascule en cours. ⚠ Deux bascules rapprochées : la seconde saute la
 * première (l'API l'abandonne), et seule la DERNIÈRE a le droit de rendre les
 * transitions — sinon la fin de la première les rallumerait au milieu de la
 * révélation de la seconde.
 */
let jeton = 0

/**
 * Applique `appliquer` (qui change le thème) en une seule fois, animée si possible.
 *
 * ⛔ `appliquer` passe par `flushSync` : l'API photographie le NOUVEL écran à la
 * sortie du rappel, et React, laissé à lui-même, n'aurait encore rien peint.
 */
export function animerBascule(appliquer: () => void): void {
  if (typeof document === 'undefined') {
    appliquer()
    return
  }
  // ⛔ UNE BASCULE PENDANT UNE RÉVÉLATION ATTEND SA FIN. Lancée tout de suite, elle
  // abandonnait la première : le document entier — déjà dans le thème n° 1 —
  // était peint le temps d'une frame, et la part d'écran que le premier cercle
  // n'avait pas atteinte clignotait avant le second. Attendre coûte au plus la
  // fin d'une révélation, et le double clic reste deux bascules nettes.
  if (enCours) {
    void enCours.then(() => animerBascule(appliquer))
    return
  }
  const racine = document.documentElement
  const moi = ++jeton
  const rendre = () => {
    if (jeton === moi) racine.removeAttribute(ATTR_BASCULE)
  }
  racine.setAttribute(ATTR_BASCULE, '')

  if (!animable()) {
    flushSync(appliquer)
    // La nouvelle palette est acquise transitions coupées, avant qu'on les rende.
    void racine.offsetWidth
    rendre()
    return
  }

  const { x, y } = origine()
  const l = window.innerWidth
  const h = window.innerHeight
  // Calculé AVANT l'appel : l'API prend sa photo pendant ce temps-là de toute façon.
  const cercles = rayonsDeRevelation(x, y, l, h).map((r) => `circle(${r.toFixed(1)}px at ${x}px ${y}px)`)
  const transition = document.startViewTransition(() => flushSync(appliquer))
  const fin = transition.finished.then(rendre, rendre)
  enCours = fin
  void fin.then(() => { if (enCours === fin) enCours = null })
  transition.ready
    .then(() => {
      racine.animate(
        { clipPath: cercles },
        { duration: DUREE_MS, easing: 'linear', pseudoElement: '::view-transition-new(root)' },
      )
    })
    // ⚠ Une transition sautée REJETTE ses promesses, et Sentry compte les rejets
    // non attrapés : les trois sont tenues.
    .catch(() => {})
  transition.updateCallbackDone.catch(() => {})
}

/** La révélation en cours, s'il y en a une. */
let enCours: Promise<void> | null = null

/**
 * Exécute `f` une fois la révélation finie — tout de suite s'il n'y en a pas.
 *
 * ⚠ Pour le travail qui n'a rien à faire PENDANT la révélation : les écrans vivants
 * mais cachés, qui n'y figurent pas, se remettent au thème après. Leur rendu — trois
 * pages entières — occupait sinon le fil principal au moment précis où l'animation
 * en a besoin.
 */
export function apresBascule(f: () => void): void {
  if (enCours) void enCours.then(f)
  else f()
}
