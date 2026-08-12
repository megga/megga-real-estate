// MEGGA CRM — Écran « Matching » (pager vertical, refonte Claude Design).
//
// Même grammaire que Today/Pipeline : un grand bento arrondi qui clippe 2 pages
// glissant en translateY.
//   Page 0 → Atelier triptyque « par score » (MatchingAtelierPage embarqué)
//   Page 1 → Recherche hybride du marché connecté (vente + location)
// Molette / PageUp-PageDown / swipe tactile / points latéraux / indice bas.
//
// Différences avec le pager Today :
//   - seuil molette élevé + refroidissement après un scroll interne arrivé en
//     butée : l'atelier a des colonnes scrollables (file d'acheteurs) — un scroll
//     léger défile la colonne, seul un geste franc bascule vers « Recherche ».
//   - clavier = PageUp/PageDown UNIQUEMENT (les flèches restent à l'atelier :
//     J/K/←/→ y déplacent la sélection ; seules `e` et `x` agissent).
//
// Réf. handoff : `crm-screen-matching-proto.jsx` (CRMScreenMatchingProto).

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { SugarTopNav, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { SugarIconRail } from '@/components/crm-sugar/LiquidGlassRail'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import MatchingAtelierPage from '@/pages/agent/MatchingAtelierPage'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'

const MATCHING_PAGES = [
  { id: 'score', labelKey: 'pager.score' },
  { id: 'recherche', labelKey: 'pager.recherche' },
]

// Page d'atterrissage = « Recherche ». Les deux pages sont montées d'emblée, mais
// celle-ci était positionnée une hauteur d'écran plus bas et clippée : le marché
// connecté n'apparaissait qu'après un geste (molette / PageDown / point latéral).
// L'Atelier « par score » reste à un cran vers le haut. Index DÉRIVÉ (pas `1` en
// dur) pour ne pas atterrir sur la mauvaise page si l'ordre du pager change.
const LANDING_PAGE = Math.max(0, MATCHING_PAGES.findIndex((p) => p.id === 'recherche'))

// ─── Points de page (droite) ────────────────────────────────────────────
function MatchingPageDots({ page, onGo, lightMode }: { page: number; onGo: (i: number) => void; lightMode: boolean }) {
  const { t } = useTranslation('matching')
  const activeCol = lightMode ? '#0B0C0E' : '#F2F2F6'
  const idleCol = lightMode ? 'rgba(11,12,14,.18)' : 'rgba(255,255,255,.22)'
  return (
    <div style={{
      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 80,
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
    }}>
      {MATCHING_PAGES.map((p, i) => {
        const active = i === page
        return (
          <button key={p.id} onClick={() => onGo(i)} title={t(p.labelKey)} style={{
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
        fontSize: 16, fontWeight: 700, lineHeight: 1, color: sub,
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
        <span style={{ fontSize: 13, fontWeight: 700, color: ink }}>{targetLabel}</span>
      </span>
    </button>
  )
}

/**
 * Contenus de substitution du banc `/dev/matching-atelier`, et rien d'autre.
 *
 * ⚠ La MÉCANIQUE reste celle de la production — chrome, molette, clavier, points
 * de page, bascule de thème du rail. C'est elle qu'on vient éprouver : un banc
 * qui recopierait le pager mesurerait sa copie, et les deux divergeraient au
 * premier correctif. Seul le CONTENU est fourni de l'extérieur, pour que les
 * fixtures ne descendent pas dans le bundle de production.
 *
 * Sa présence rend aussi la navigation du chrome INERTE : chaque cible mène à
 * une surface protégée, donc au rebond vers la production que le banc existe
 * précisément pour éviter.
 *
 * ⚠ Des COMPOSANTS, pas des fonctions à appeler. Deux raisons, et la seconde a
 * mordu :
 *
 * 1. Un slot APPELÉ pendant le rendu reçoit `onOpenRecherche`, qui lit le verrou
 *    de transition (`lock`) : `react-hooks/refs` refuse — à raison, un ref lu au
 *    rendu ne déclenche pas de nouveau rendu. En JSX, c'est une prop, pas un
 *    argument, et le grief tombe.
 * 2. Un slot appelé rendrait `AtelierStage` sous une identité d'élément qui
 *    change à chaque rendu du banc : la session de triage en cours (onglet,
 *    sélection, historique d'annulation) serait remise à zéro à chaque clic.
 *    Les slots doivent donc être STABLES côté banc — définis hors du composant.
 */
export interface MatchingPagerBanc {
  Page0: (p: { dark: boolean; onOpenRecherche: () => void }) => ReactNode
  Page1: (p: { dark: boolean }) => ReactNode
  /**
   * Commandes du banc, rendues à la RACINE du pager — hors du viewport clippé.
   *
   * ⚠ Elles ne peuvent pas vivre dans une page : le track porte un `transform`,
   * qui fait de lui le bloc englobant de tout descendant en `position: fixed` —
   * les commandes glisseraient avec la page au lieu de rester à l'écran.
   *
   * ⚠ Et elles ne peuvent pas non plus vivre dans le banc au-dessus du pager :
   * c'est le pager qui POSSÈDE le thème (bouton du rail + `megga.sugar.dark`).
   * Un banc qui relirait la clé pour son compte peindrait ses commandes dans le
   * thème d'avant la dernière bascule — un banc qui fabrique lui-même une
   * incohérence de thème, défaut déjà vécu sur `/dev/biens`.
   */
  Chrome?: (p: { dark: boolean }) => ReactNode
}

export default function MatchingPagerPage({ banc }: { banc?: MatchingPagerBanc } = {}) {
  const navigate = useNavigate()

  // ─── Thème: dark/light, calé sur le toggle du rail (comme Today) ────────
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const sp = crmSugarPalette(dark)
  const lightMode = !dark

  const onCmd = () => openSugarSearch()

  const onNavigate = (id: SugarScreenId | string) => {
    if (banc) return
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  // ─── Pager molette ──────────────────────────────────────────────────
  // Arrivée pivotée (fiche deal V4 « Transmettre à … », fiche contact) : un
  // `?contact=` / `?annonce=` cible l'Atelier — on atterrit directement dessus
  // au lieu de la page Recherche (le param était ignoré et l'atelier hors écran).
  const [searchParams] = useSearchParams()
  const [initialPage] = useState(() =>
    searchParams.has('contact') || searchParams.has('annonce')
      ? Math.max(0, MATCHING_PAGES.findIndex((pg) => pg.id === 'score'))
      : LANDING_PAGE,
  )
  const [page, setPage] = useState(initialPage)
  // `pageRef` sert au positionnement initial SANS animation (useLayoutEffect plus
  // bas) : il doit démarrer sur la page d'atterrissage, sinon on verrait l'Atelier
  // une frame avant de glisser vers Recherche.
  const pageRef = useRef(initialPage)
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
  }, [])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 820)
  }, [])
  // Extrait de la vue : `goTo` lit `lock.current`, et le passer inline à un slot
  // APPELÉ pendant le rendu déclenche `react-hooks/refs`. Le stabiliser ici règle
  // le grief à sa source plutôt que de le taire — et évite au passage une
  // nouvelle fonction par rendu sur la page 0.
  const openRecherche = useCallback(() => goTo(LANDING_PAGE), [goTo])

  // Position initiale (sans animation) + repositionnement au resize.
  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  // Anime vers la page courante à chaque changement + tient pageRef à jour.
  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    // Ancêtre scrollable (colonne de l'atelier, overlay…) capable de défiler
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
      // Seuil nettement plus haut que Today (~15×) : il faut un scroll franc et
      // soutenu pour basculer — un scroll léger défile d'abord la colonne.
      if (Math.abs(acc.current) > 560) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    // Clavier : PageUp/PageDown UNIQUEMENT — les flèches restent à l'atelier.
    const onKey = (e: KeyboardEvent) => {
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
  }, [go])

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
        /* L'atelier (page 0) est un stage plein écran (position:fixed) : la classe
           .sga-embedded le rend absolu pour qu'il glisse avec le track du pager,
           embarqué dans le bento. */
        .matching-scroll-hint { opacity: .55; transition: opacity .35s ease; }
        .matching-scroll-hint:hover, .matching-scroll-hint:focus-visible { opacity: 1; }
        .matching-scroll-hint:hover .msh-mouse, .matching-scroll-hint:focus-visible .msh-mouse { color: ${sp.ink} !important; }
        .matching-scroll-hint:hover .msh-label, .matching-scroll-hint:focus-visible .msh-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
      `}</style>

      <SugarTopNav active="matching" sp={sp} dark={dark} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail
          active="matching" onNavigate={onNavigate} onCmd={onCmd}
          dark={dark} setDark={setDark} sp={sp}
        />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          {/* Viewport pager — clippe les deux pages, capte la molette */}
          <div ref={viewportRef} style={{
            position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${sp.frameBorder}`,
            boxShadow: sp.shadow,
          }}>
            <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
              <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc
                  ? <banc.Page0 dark={dark} onOpenRecherche={openRecherche} />
                  : <MatchingAtelierPage embedded dark={dark} onOpenRecherche={openRecherche} />}
              </div>
              <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {banc ? <banc.Page1 dark={dark} /> : <MatchingRechercheHybride dark={dark} />}
              </div>
            </div>
            <MatchingPageDots page={page} onGo={goTo} lightMode={lightMode} />
          </div>
        </main>
      </div>

      <MatchingScrollHint page={page} onGo={goTo} sub={sp.sub} ink={sp.ink} />
      {banc?.Chrome ? <banc.Chrome dark={dark} /> : null}
    </div>
  )
}
