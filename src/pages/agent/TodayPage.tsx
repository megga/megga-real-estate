// MEGGA CRM — Écran « Aujourd'hui » (refonte Claude Design, port fidèle).
//
// Page 0 = « concept H » (handoff Today V2, 3 août 2026) — un seul bento :
// la journée + les dossiers/annonces + « Pendant ton absence ». Elle remplace
// l'ancien cockpit `PageAujourdhui`, qui reste au dépôt : c'est lui qui porte
// le câblage Supabase (useFocusQueue, agenda, pipeline, objectif) à reprendre
// au « Lot 0 » d'hydratation du concept H.
// Page 1 = catalogue de matchs. Pager molette vertical (1 cran = 1 page plein
// écran), chrome CRM standard (CrmSidebar).
//
// ⚠️ Port VISUEL sur DONNÉES DÉMO (cf. ./today/data.ts). Le handoff prescrit
// « porter à l'identique d'abord, câbler ensuite » : le câblage live (Supabase)
// est la phase suivante.
//
// Wrapper / pager porté de `crm-screen-today-proto.jsx` :
//   - tween rAF du défilement vertical (fiable partout)
//   - molette / flèches clavier / swipe tactile / points latéraux / indice molette
//   - applyTK(dark) « allume » l'ambiance du cockpit (et la modale Détail du match)

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { crmPalette, crmVoileEncre } from '@/components/crm/tokens'
import type { CrmScreenId } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { TK, applyTK } from '@/components/crm/today/tk'
import { TodayNavProvider } from '@/components/crm/today/TodayNavContext'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { PageAujourdhuiH } from '@/components/crm/today/PageAujourdhuiH'
import { PageCatalogue } from '@/components/crm/today/PageCatalogue'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

// `labelKey` = clé i18n stable (namespace dashboard) ; le libellé est traduit
// chez le consommateur (cf. § conventions i18n — module statique, pas de hook).
const TODAY_PAGES = [
  { id: 'today', labelKey: 'today.pager.today' },
  { id: 'catalogue', labelKey: 'today.pager.catalogue' },
]

// ─── Points de page (droite) ────────────────────────────────────────────
function TodayPageDots({ page, onGo, lightMode }: { page: number; onGo: (i: number) => void; lightMode: boolean }) {
  const { t } = useTranslation('dashboard')
  // Point de page ACTIF : même règle que partout ailleurs, il porte l'accent.
  const activeCol = TK.accent
  const idleCol = crmVoileEncre(!lightMode, lightMode ? 0.18 : 0.22)
  return (
    <div style={{
      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 30,
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
    }}>
      {TODAY_PAGES.map((p, i) => {
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
function TodayScrollHint({ page, onGo, sub, ink }: { page: number; onGo: (i: number) => void; sub: string; ink: string }) {
  const { t } = useTranslation('dashboard')
  const next = TODAY_PAGES[page + 1]
  const prev = page > 0 ? TODAY_PAGES[page - 1] : null
  const target = next || prev
  const dir = next ? 1 : -1
  if (!target) return null
  const targetLabel = t(target.labelKey)
  return (
    <button
      className="today-scroll-hint"
      onClick={() => onGo(page + dir)}
      aria-label={t('today.pager.wheelTo', { label: targetLabel })}
      style={{
        position: 'absolute', bottom: 20, left: 26, zIndex: 60,
        display: 'flex', alignItems: 'center', gap: 11,
        padding: 6, border: 0, background: 'transparent',
        fontFamily: 'inherit', cursor: 'pointer',
      }}>
      <span className="tsh-mouse" style={{
        display: 'grid', placeItems: 'center', flex: 'none',
        width: 22, height: 22,
        fontSize: 'var(--crm-text-2xl)', fontWeight: 600, lineHeight: 1, color: sub,
        transition: 'color .35s ease',
      }}>
        {next ? '↓' : '↑'}
      </span>
      <span className="tsh-label" style={{
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

export default function TodayPage() {
  const navigate = useNavigate()

  // ─── Theme: dark/light, tied to the icon-rail toggle ─────────────────
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
    }
  }, [dark])

  const sp = crmPalette(dark)
  // « allume » / éteint tout le cockpit selon l'ambiance (singleton muté en place).
  applyTK(dark)
  const lightMode = TK.frameSolid === '#FFFFFF'


  // `ref` = identifiant réel porté par le payload (uuid). Les cibles « détail »
  // n'existent qu'avec lui : sans référence, on ouvre la LISTE correspondante
  // plutôt que de laisser un bouton sans effet.
  const onNavigate = (id: CrmScreenId | string, ref?: string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'contact-detail': navigate(ref ? `/dashboard/contacts/${ref}` : '/dashboard/contacts'); break
      case 'deal-detail': navigate(ref ? `/dashboard/transactions/${ref}` : '/dashboard/pipeline'); break
      case 'visite-detail': navigate(ref ? `/dashboard/visits/${ref}` : '/dashboard/calendar'); break
      case 'biens-detail': navigate(ref ? `/dashboard/listings/${ref}` : '/dashboard/listings'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      // `?contact=` est le contrat que MatchingAtelierPage lit déjà pour
      // focaliser un acheteur — pas une globale posée avant la navigation.
      case 'matching': navigate(ref ? `/dashboard/matching?contact=${ref}` : '/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
        /* Pas de toast « à venir » — un bouton qui ne fait rien doit disparaître. */
    }
  }

  // ─── Pager molette ──────────────────────────────────────────────────
  const [page, setPage] = useTabScopedState('pager', 0)
  // ⚠ Initialisé sur `page`, pas sur 0 : quand l'onglet rend une page restaurée,
  // c'est cette valeur que le `useLayoutEffect` de placement lit — la lire à 0
  // ferait démarrer en haut puis défiler sur 720 ms vers la page retrouvée.
  const pageRef = useRef(page)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setPage((p) => Math.min(TODAY_PAGES.length - 1, Math.max(0, p + dir)))
  }, [setPage])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 850)
  }, [setPage])

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

    // Ancêtre scrollable (modale, panneau…) capable de défiler encore dans le
    // sens de la molette ? Si oui, scroll natif et on NE pagine PAS.
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

    // Un overlay (modale Détail du match, galerie…) est-il sous le curseur ?
    const insideOverlay = (node: EventTarget | null) => {
      let n = node as HTMLElement | null
      while (n && n !== el && n.nodeType === 1) {
        const cs = getComputedStyle(n)
        if (cs.position === 'fixed' || cs.position === 'absolute') {
          const z = parseInt(cs.zIndex, 10)
          const r = n.getBoundingClientRect()
          if (z >= 10 && r.width > window.innerWidth * 0.6 && r.height > window.innerHeight * 0.6) return true
        }
        n = n.parentElement
      }
      return false
    }

    const onWheel = (e: WheelEvent) => {
      if (insideOverlay(e.target)) {
        if (!canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) e.preventDefault()
        acc.current = 0
        return
      }
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) {
        acc.current = 0
        return
      }
      e.preventDefault()
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, 180)
      if (Math.abs(acc.current) > 36) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 850)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 850) } }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 850) } }
    }
    window.addEventListener('keydown', onKey)

    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 850) }
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
    <TodayNavProvider value={{ navigate: onNavigate, goToPage: goTo }}>
      <div className="today-proto-amb" style={{
        position: 'relative',
        background: TK.bg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
        color: sp.ink,
      }}>
        <style>{`
          .today-proto-amb { transition: background-color .55s ease, color .45s ease; }
          .today-proto-amb *:not(button):not([class*="tsh-"]) {
            transition: background-color .55s ease, border-color .55s ease, color .45s ease, box-shadow .55s ease, fill .45s ease, stroke .45s ease;
          }
          @keyframes focus-ping { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.4); opacity: 0; } }
          @keyframes fmRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
          .today-scroll-hint { opacity: .55; transition: opacity .35s ease; }
          .today-scroll-hint:hover, .today-scroll-hint:focus-visible { opacity: 1; }
          .today-scroll-hint:hover .tsh-mouse, .today-scroll-hint:focus-visible .tsh-mouse { color: ${TK.ink} !important; }
          .today-scroll-hint:hover .tsh-label, .today-scroll-hint:focus-visible .tsh-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
          @keyframes cat-overlay { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cat-pop { from { opacity: 0; transform: translateY(18px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes cat-page { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes m2pulse { 0% { transform: scale(1); opacity: .7; } 75%, 100% { transform: scale(2.2); opacity: 0; } }
        `}</style>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CrmWorkspace active="today" sp={sp} dark={dark} setDark={setDark}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 24, paddingBottom: 22 }}>
            {/* Viewport pager — clippe les deux pages, capte la molette */}
            <div ref={viewportRef} style={{
              position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
              border: `1px solid ${TK.border}`,
              boxShadow: TK.shadowLg,
            }}>
              <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
                <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                  <PageAujourdhuiH />
                </div>
                <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                  <PageCatalogue />
                </div>
              </div>
              <TodayPageDots page={page} onGo={goTo} lightMode={lightMode} />
            </div>
          </main>
          </CrmWorkspace>
        </div>

        {/* Indice molette — coin bas-gauche, discret */}
        <TodayScrollHint page={page} onGo={goTo} sub={TK.sub} ink={TK.ink} />
      </div>
    </TodayNavProvider>
  )
}
