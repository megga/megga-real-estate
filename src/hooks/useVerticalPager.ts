/**
 * Pager vertical : molette, flèches, swipe — la mécanique, sans la peau.
 *
 * ── Pourquoi ce hook existe ────────────────────────────────────────────────────────
 *
 * Cette mécanique était écrite TROIS fois, à l'identique et sans partage : `BiensPager`,
 * `ContactsPager` et `MatchingPage`. Chacune porte les mêmes 110 lignes — accumulateur de
 * molette, seuil de 560, fenêtre de 220 ms, verrou de 820 ms, easing cubique sur 700 ms,
 * et surtout `canScrollNatively`, la seule partie réellement délicate. La console de revue
 * KYB en aurait fait une QUATRIÈME copie.
 *
 * ⚠ Les trois existantes ne sont PAS migrées ici, et c'est délibéré : ce sont des écrans
 * livrés, leur reprise est un chantier à part avec son propre risque de régression. Ce
 * hook est écrit pour être leur destination, pas pour la leur imposer aujourd'hui.
 *
 * ── Ce qui compte vraiment : `canScrollNatively` ───────────────────────────────────
 *
 * Sans elle, un tableau qui défile à l'intérieur d'une page ferait tourner le pager dès
 * qu'on le parcourt à la molette — on chercherait à lire une liste et on changerait de
 * page. La règle est donc : tant qu'un ancêtre scrollable du curseur PEUT encore défiler
 * dans la direction demandée, le pager ne prend pas la main.
 *
 * Les constantes ne sont pas des réglages libres : les baisser rend le pager fébrile au
 * trackpad, et le désaligne des trois écrans qui partagent cette grammaire.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Un geste FRANC, pas un frôlement de trackpad. */
const SEUIL_MOLETTE = 560
/** Au-delà, l'accumulation repart de zéro : deux petits gestes ne s'additionnent pas. */
const FENETRE_MS = 220
/** Le temps de l'animation, pendant lequel un second geste est ignoré. */
const VERROU_MS = 820
const DUREE_MS = 700

export interface VerticalPagerOptions {
  /** Nombre de pages. En dessous de 2, le pager se tait complètement. */
  pageCount: number
  /**
   * Gèle le pager — modale ouverte, formulaire en cours. Sans ce gel, une molette dans
   * une boîte de dialogue ferait tourner la page DERRIÈRE elle.
   */
  frozen?: boolean
}

export interface VerticalPager {
  page: number
  goTo: (index: number) => void
  /** À poser sur le conteneur à hauteur fixe qui masque le track. */
  viewportRef: RefObject<HTMLDivElement | null>
  /** À poser sur le track, dont la hauteur vaut `pageCount × 100 %`. */
  trackRef: RefObject<HTMLDivElement | null>
}

export function useVerticalPager({ pageCount, frozen = false }: VerticalPagerOptions): VerticalPager {
  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const verrou = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Les refs doublent les props parce que les écouteurs sont posés UNE fois : sans elles,
  // ils captureraient la valeur du premier rendu et gèleraient (ou dégèleraient) à tort.
  const frozenRef = useRef(frozen)
  useEffect(() => { frozenRef.current = frozen }, [frozen])
  const countRef = useRef(pageCount)
  useEffect(() => { countRef.current = pageCount }, [pageCount])

  const animateTo = useCallback((target: number, instant?: boolean) => {
    const vp = viewportRef.current, track = trackRef.current
    if (!vp || !track) return
    const end = -target * vp.clientHeight
    if (instant) { posRef.current = end; track.style.transform = `translateY(${end}px)`; return }
    const start = posRef.current
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / DUREE_MS)
      posRef.current = start + (end - start) * ease(p)
      track.style.transform = `translateY(${posRef.current}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => {
    setPage((p) => Math.min(countRef.current - 1, Math.max(0, p + dir)))
  }, [])

  const goTo = useCallback((i: number) => {
    if (verrou.current) return
    verrou.current = true
    setPage(Math.min(countRef.current - 1, Math.max(0, i)))
    setTimeout(() => { verrou.current = false }, VERROU_MS)
  }, [])

  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    /** Un ancêtre scrollable peut-il encore défiler dans cette direction ? */
    const canScrollNatively = (node: EventTarget | null, dir: number) => {
      let n = node as HTMLElement | null
      while (n && n !== el && n.nodeType === 1) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
          if (dir < 0 && n.scrollTop > 1) return true
        }
        n = n.parentElement
      }
      return false
    }
    const inerte = () => frozenRef.current || countRef.current < 2

    const onWheel = (e: WheelEvent) => {
      if (inerte()) return
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; return }
      e.preventDefault()
      if (verrou.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, FENETRE_MS)
      if (Math.abs(acc.current) > SEUIL_MOLETTE) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        verrou.current = true
        go(dir)
        setTimeout(() => { verrou.current = false }, VERROU_MS)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (inerte()) return
      // ⚠ Jamais depuis un champ : les flèches y déplacent le curseur, et voler ce geste
      // rendrait toute saisie impossible dans une page du pager.
      const cible = e.target as HTMLElement | null
      if (cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable)) return
      const bas = ['ArrowDown', 'PageDown'].includes(e.key)
      const haut = ['ArrowUp', 'PageUp'].includes(e.key)
      if (!bas && !haut) return
      e.preventDefault()
      if (verrou.current) return
      verrou.current = true
      go(bas ? 1 : -1)
      setTimeout(() => { verrou.current = false }, VERROU_MS)
    }

    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || verrou.current || inerte()) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) {
        verrou.current = true
        go(dy > 0 ? 1 : -1)
        touchY = null
        setTimeout(() => { verrou.current = false }, VERROU_MS)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    el.addEventListener('touchstart', onTS, { passive: true })
    el.addEventListener('touchmove', onTM, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove', onTM)
      if (accTimer.current) clearTimeout(accTimer.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [go])

  return { page, goTo, viewportRef, trackRef }
}
