// MEGGA CRM — Écran « Matching » (pager vertical, refonte Claude Design).
//
// Un grand bento arrondi qui clippe 2 pages glissant en translateY.
//   Page 0 → le fil de matchs (MatchingFil), sur lequel « Matching » s'ouvre
//   Page 1 → Recherche hybride du marché connecté (vente + location)
// Molette / PageUp-PageDown / swipe tactile / points latéraux / indice bas.
//
// Réglé pour le fil :
//   - seuil molette élevé + refroidissement après un scroll interne arrivé en
//     butée : le fil a des colonnes scrollables (sa liste, son panneau) — un
//     scroll léger défile la colonne, seul un geste franc bascule vers « Recherche ».
//   - clavier = PageUp/PageDown UNIQUEMENT (les flèches restent au fil : ↑/↓ y
//     déplacent la sélection, ←/→ y changent d'onglet).
//
// Réf. handoff : `crm-screen-matching-proto.jsx` (CRMScreenMatchingProto).

import { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { crmPalette } from '@/components/crm/tokens'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import MatchingFil from '@/components/matching-fil/MatchingFil'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'
import { estArriveeFil } from '@/components/matching-fil/filLiens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useCrmDarkPref } from '@/lib/crmDark'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActifRef } from '@/hooks/useEcranActif'
import { useArrivee } from '@/hooks/useArrivee'

const MATCHING_PAGES = [
  { id: 'score', labelKey: 'pager.score' },
  { id: 'recherche', labelKey: 'pager.recherche' },
]

// La page du fil de matchs (page 0) : « Matching » s'ouvre sur elle, et toute arrivée du fil y atterrit. Index
// DÉRIVÉ (pas `0` en dur) pour ne pas atterrir sur la mauvaise page si l'ordre du pager change.
const SCORE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'score'))
// La page Recherche (page 1), qu'ouvre « Voir le marché » du fil. Index DÉRIVÉ, comme `SCORE_PAGE`.
const RECHERCHE_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))

/**
 * Un clic de souris sur une commande du pager ne lui donne pas le focus : il reste là où il était — ou se perd avec la
 * page qui devient inerte —, et le fil de la page 0 le prend à son retour (son focus d'ouverture ne prend qu'un focus
 * perdu). Au clavier, la commande garde le sien.
 */
const garderLeFocus = (e: ReactMouseEvent) => e.preventDefault()

// ─── Points de page (droite) ────────────────────────────────────────────
function MatchingPageDots({ page, onGo, lightMode }: { page: number; onGo: (i: number) => void; lightMode: boolean }) {
  const { t } = useTranslation('matching')
  // Le point de la page COURANTE est l'exemple même d'un élément actif : il ne
  // fait rien d'autre que dire où l'on est. Il portait l'encre inversée
  // (#0B0C0E clair / #F2F2F6 sombre), c'est-à-dire la règle « l'accent EST
  // l'encre » retirée le 10 août 2026.
  const activeCol = MXC_COLOR.accent
  const idleCol = lightMode ? 'rgba(3,3,3,.18)' : 'rgba(255,255,255,.22)'
  return (
    <div style={{
      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 80,
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
    }}>
      {MATCHING_PAGES.map((p, i) => {
        const active = i === page
        return (
          <button key={p.id} onClick={() => onGo(i)} onMouseDown={garderLeFocus} title={t(p.labelKey)} style={{
            width: 8, height: active ? 26 : 8, borderRadius: 999, border: 0, cursor: 'pointer', padding: 0,
            background: active ? activeCol : idleCol,
            transition: 'height .5s cubic-bezier(.76,0,.24,1), background .4s ease',
          }} />
        )
      })}
    </div>
  )
}

// ─── Indice molette (bas-gauche, discret) ────────────────────────────────
function MatchingScrollHint({ page, onGo, sub, ink }: { page: number; onGo: (i: number) => void; sub: string; ink: string }) {
  const { t } = useTranslation('matching')
  const next = MATCHING_PAGES[page + 1]
  const prev = page > 0 ? MATCHING_PAGES[page - 1] : null
  const target = next || prev
  const dir = next ? 1 : -1
  if (!target) return null
  const targetLabel = t(target.labelKey)
  return (
    <button
      className="matching-scroll-hint"
      onClick={() => onGo(page + dir)}
      onMouseDown={garderLeFocus}
      aria-label={t('pager.wheelTo', { label: targetLabel })}
      style={{
        position: 'absolute', bottom: 20, left: 26, zIndex: 80,
        display: 'flex', alignItems: 'center', gap: 11,
        padding: 6, border: 0, background: 'transparent',
        fontFamily: 'inherit', cursor: 'pointer',
      }}>
      <span className="msh-mouse" style={{
        display: 'grid', placeItems: 'center', flex: 'none',
        width: 22, height: 22,
        fontSize: 'var(--crm-text-2xl)', fontWeight: 600, lineHeight: 1, color: sub,
        transition: 'color .35s ease',
      }}>
        {next ? '↓' : '↑'}
      </span>
      <span className="msh-label" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
        textAlign: 'left', whiteSpace: 'nowrap',
        maxWidth: 0, overflow: 'hidden', opacity: 0,
        transform: 'translateX(-6px)',
        transition: 'max-width .4s cubic-bezier(.76,0,.24,1), opacity .3s ease, transform .4s cubic-bezier(.76,0,.24,1)',
      }}>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ink }}>{targetLabel}</span>
      </span>
    </button>
  )
}

/**
 * Contenus de substitution du banc `/dev/crm` : il y injecte des données de
 * démonstration, et rien d'autre.
 *
 * ⚠ La MÉCANIQUE reste celle de la production — chrome, molette, clavier, points
 * de page, bascule de thème de la barre latérale. C'est elle qu'on vient
 * éprouver : un banc qui recopierait le pager mesurerait sa copie, et les deux
 * divergeraient au premier correctif. Seul le CONTENU est fourni de l'extérieur,
 * pour que les fixtures ne descendent pas dans le bundle de production.
 *
 * ⚠ La barre latérale navigue ELLE-MÊME (elle porte la table des routes, pour
 * qu'il n'y ait plus vingt-et-un aiguillages divergents). Le banc `/dev/crm` la
 * monte sous un routeur mémoire, sur les adresses de production : elle y
 * navigue sans quitter le banc.
 *
 * ⚠ Des COMPOSANTS, pas des fonctions à appeler. Deux raisons, et la seconde a
 * mordu :
 *
 * 1. Un slot APPELÉ pendant le rendu reçoit `onOpenRecherche`, qui lit le verrou
 *    de transition (`lock`) : `react-hooks/refs` refuse — à raison, un ref lu au
 *    rendu ne déclenche pas de nouveau rendu. En JSX, c'est une prop, pas un
 *    argument, et le grief tombe.
 * 2. Un slot appelé rendrait le fil sous une identité d'élément qui change à
 *    chaque rendu du banc : sa sélection et sa fenêtre d'annulation seraient
 *    remises à zéro à chaque clic. Les slots doivent donc être STABLES côté
 *    banc — définis hors du composant.
 */
export interface MatchingPagerBanc {
  Page0: (p: { dark: boolean; onOpenRecherche: () => void; montre: boolean }) => ReactNode
  Page1: (p: { dark: boolean }) => ReactNode
}

export default function MatchingPage(
  { banc, atterrissage = 'score' }: {
    banc?: MatchingPagerBanc
    /**
     * La page où « Matching » s'ouvre quand ni une arrivée ni l'onglet n'en demandent une :
     * le fil (« score ») par défaut.
     */
    atterrissage?: 'score' | 'recherche'
  } = {},
) {
  // ─── Thème: dark/light, calé sur la barre latérale (comme Today) ────────
  const [dark, setDark] = useCrmDarkPref()

  const sp = crmPalette(dark)
  const lightMode = !dark

  // ─── Pager molette ──────────────────────────────────────────────────
  // Une arrivée — un lien d'arrivée du fil (`estArriveeFil` : `?contact=`, `?annonce=`,
  // `?onglet=`, `?ligne=`, `?attente=`), suivi depuis une fiche deal ou contact,
  // « Aujourd'hui », « Sa boucle » ou « Qui pour ce bien ? » — cible la page 0, le
  // fil, même dans un onglet resté sur la Recherche. Sans arrivée, l'onglet rouvre la
  // dernière page vue.
  const [searchParams] = useSearchParams()
  const [pageStockee, setPage] = useTabScopedState('pager', atterrissage === 'score' ? SCORE_PAGE : RECHERCHE_PAGE)
  /**
   * ⚠ UNE ARRIVÉE NEUVE L'EMPORTE SUR LA PAGE MÉMORISÉE — une fois.
   *
   * `useTabScopedState` rend la valeur STOCKÉE dès qu'elle existe. Dans un onglet
   * qui avait déjà servi à Matching et bougé son pager, une arrivée (« Transmettre
   * à … » depuis une fiche deal, par exemple) atterrirait sur la page mémorisée
   * au lieu de la page 0 : le geste qu'on vient de demander serait ignoré au
   * profit d'un souvenir.
   *
   * Règle : une INTENTION EXPRIMÉE MAINTENANT (un lien suivi) passe devant une
   * position retenue, une fois par navigation (`useArrivee`) : revenir sur
   * l'onglet, un retour arrière ou un rechargement rendent la page choisie
   * depuis ; un nouveau clic sur le même lien ramène à la page 0.
   *
   * ⛔ L'arrivée se lit au RENDU et s'écrit dans un EFFET — jamais l'inverse.
   * Poser la valeur pendant le rendu écrirait dans le fournisseur d'onglets
   * depuis le rendu d'un autre composant, ce que React refuse ; et la poser
   * seulement dans l'effet ferait afficher une frame sur la mauvaise page avant
   * de glisser vers la page 0. L'effet attend la pile d'onglets : écrite avant
   * son chargement, la page serait effacée par l'hydratation.
   */
  const {
    neuve: arriveeNeuve, aAppliquer: arriveeAAppliquer, marquerAppliquee,
  } = useArrivee('pager.arrivee', estArriveeFil(searchParams))
  const page = arriveeNeuve ? SCORE_PAGE : pageStockee
  useEffect(() => {
    if (!arriveeAAppliquer) return
    setPage(SCORE_PAGE)
    marquerAppliquee()
  }, [arriveeAAppliquer, setPage, marquerAppliquee])
  // `pageRef` sert au positionnement initial SANS animation (useLayoutEffect plus
  // bas) : il doit démarrer sur la page montrée, sinon, dans un onglet resté sur la
  // Recherche, on verrait le fil une frame avant de glisser vers elle. ⚠ Il lit
  // `page` : dans un onglet rouvert, la page RETROUVÉE est celle qu'il faut poser
  // d'emblée.
  const pageRef = useRef(page)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cool = useRef(0) // fin de fenêtre de refroidissement après un scroll interne (epoch ms)

  // Tween JS (rAF) du défilement vertical — fiable partout.
  const animateTo = useCallback((targetPage: number, instant?: boolean) => {
    const vp = viewportRef.current
    const track = trackRef.current
    if (!vp || !track) return
    const h = vp.clientHeight
    const end = -targetPage * h
    if (instant) {
      posRef.current = end
      track.style.transform = `translateY(${end}px)`
      return
    }
    const start = posRef.current
    const dur = 720
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const y = start + (end - start) * ease(p)
      posRef.current = y
      track.style.transform = `translateY(${y}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => {
    setPage((p) => Math.min(MATCHING_PAGES.length - 1, Math.max(0, p + dir)))
  }, [setPage])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 820)
  }, [setPage])
  // Extrait de la vue : `goTo` lit `lock.current`, et le passer inline à un slot
  // APPELÉ pendant le rendu déclenche `react-hooks/refs`. Le stabiliser ici règle
  // le grief à sa source plutôt que de le taire — et évite au passage une
  // nouvelle fonction par rendu sur la page 0.
  const openRecherche = useCallback(() => goTo(RECHERCHE_PAGE), [goTo])

  // Position initiale (sans animation) + repositionnement au resize.
  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  // Anime vers la page courante à chaque changement + tient pageRef à jour.
  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  const ecranActifRef = useEcranActifRef()
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    // Ancêtre scrollable (colonne du fil, overlay…) capable de défiler
    // encore dans le sens de la molette ? Si oui, scroll natif et on NE pagine PAS.
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

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return // geste horizontal → ignore
      // Pendant la transition, on avale TOUT : sinon l'élan résiduel du geste part
      // défiler la colonne de la page qui vient d'apparaître (et repousse `cool`
      // à chaque événement, ce qui gèle la bascule suivante).
      if (lock.current) { e.preventDefault(); acc.current = 0; return }
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; cool.current = Date.now() + 450; return }
      e.preventDefault()
      // L'élan qui déborde d'une colonne interne arrivée en butée ne doit JAMAIS
      // basculer la page : on avale la fin du geste tant que le dernier scroll
      // interne date de moins de 450 ms, en prolongeant la fenêtre à chaque
      // événement avalé. Seule une NOUVELLE impulsion, après une vraie pause,
      // peut changer de page.
      if (Date.now() < cool.current) { cool.current = Date.now() + 260; acc.current = 0; return }
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, 220)
      // Seuil élevé : il faut un scroll franc et soutenu pour basculer — un
      // scroll léger défile d'abord la colonne.
      if (Math.abs(acc.current) > 560) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    // Clavier : PageUp/PageDown UNIQUEMENT — les flèches restent au fil.
    const onKey = (e: KeyboardEvent) => {
      // ⛔ Écran vivant mais caché : il ne vole pas les flèches à l'écran montré.
      if (!ecranActifRef.current) return
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      if (e.key === 'PageDown') { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 820) } }
      if (e.key === 'PageUp') { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 820) } }
    }
    window.addEventListener('keydown', onKey)

    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current) return
      const dy = touchY - e.touches[0].clientY
      if (canScrollNatively(e.target, dy > 0 ? 1 : -1)) { touchY = null; return }
      if (Math.abs(dy) > 180) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 820) }
    }
    el.addEventListener('touchstart', onTS, { passive: true })
    el.addEventListener('touchmove', onTM, { passive: true })

    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove', onTM)
    }
  }, [go, ecranActifRef])

  return (
    <div style={{
      position: 'relative',
      background: sp.pageBg,
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
      color: sp.ink,
    }}>
      <style>{`
        .matching-scroll-hint { opacity: .55; transition: opacity .35s ease; }
        .matching-scroll-hint:hover, .matching-scroll-hint:focus-visible { opacity: 1; }
        .matching-scroll-hint:hover .msh-mouse, .matching-scroll-hint:focus-visible .msh-mouse { color: ${sp.ink} !important; }
        .matching-scroll-hint:hover .msh-label, .matching-scroll-hint:focus-visible .msh-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
      `}</style>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="matching" sp={sp} dark={dark} setDark={setDark}>
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 24, paddingBottom: 'var(--crm-space-6xl)' }}>
          {/* Viewport pager — clippe les deux pages, capte la molette */}
          <div ref={viewportRef} style={{
            position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${sp.frameBorder}`,
            boxShadow: sp.shadow,
          }}>
            <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
              {/* ⛔ LA PAGE CACHÉE EST INERTE. Mesuré sur le banc du fil : Tab depuis le dernier bouton de la
                  page 0 entrait dans la page 1, et le navigateur faisait défiler le viewport clippé de 470 px
                  pour la montrer — mise en page cassée. Et les raccourcis du fil (P, X, E), posés sur l'`onKeyDown`
                  de sa RACINE, triaient encore des matchs sur une page qu'on ne voyait plus. `inert` sort la page
                  du clavier, de Tab et de l'arbre d'accessibilité ; React 19 rend l'attribut (React 18 l'ignorait).
                  ⚠ Il ne couvre que les gestionnaires liés au FOCUS : un écouteur posé sur `window` (comme le « / »
                  de la Recherche) continue de recevoir toutes les touches, page inerte ou pas. */}
              <div inert={page !== 0} style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc
                  ? <banc.Page0 dark={dark} onOpenRecherche={openRecherche} montre={page === 0} />
                  : <MatchingFil dark={dark} onOpenRecherche={openRecherche} montre={page === 0} />}
              </div>
              <div inert={page !== 1} style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc ? <banc.Page1 dark={dark} /> : <MatchingRechercheHybride dark={dark} />}
              </div>
            </div>
            <MatchingPageDots page={page} onGo={goTo} lightMode={lightMode} />
          </div>
        </main>
        </CrmWorkspace>
      </div>

      <MatchingScrollHint page={page} onGo={goTo} sub={sp.sub} ink={sp.ink} />
    </div>
  )
}
