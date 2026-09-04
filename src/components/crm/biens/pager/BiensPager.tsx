// MEGGA CRM Sugar v2 — Mes biens · Pager plein écran (bento vertical 2 pages)
// Port du handoff Claude Design (crm-screen-biens-proto.jsx) ALIGNÉ sur la
// mécanique réelle des autres pagers CRM (ContactsPager) : molette / flèches /
// swipe qui glissent le track entre Page 0 « Galerie » (haut) et Page 1 « À
// suivre » (bas). Points latéraux + indice bas. Le scroll interne d'une page
// l'emporte avant le snap (canScrollNatively). Gel du pager quand le wizard ou
// une modale est ouvert.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmBien } from '@/components/crm/mockData'
import type { CrmPalette } from '@/components/crm/tokens'
import type { GalSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { BpTopGallery } from './BpTopGallery'
import { BpFollowupPage } from './BpFollowupPage'
import { BiensFirstRun, BiensFollowEmpty } from './BiensFirstRun'

const PAGE_COUNT = 2

function BpgPageDots({ page, onGo, sp, dark, labels }: { page: number; onGo: (i: number) => void; sp: CrmPalette; dark: boolean; labels: string[] }) {
  const activeCol = sp.accent
  const idleCol = dark ? 'rgba(255,255,255,.22)' : 'rgba(3,3,3,.18)'
  return (
    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', alignItems: 'center' }}>
      {labels.map((label, i) => (
        <button
          key={label}
          onClick={() => onGo(i)}
          title={label}
          style={{ width: 8, height: i === page ? 26 : 8, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0, background: i === page ? activeCol : idleCol, transition: 'height .5s cubic-bezier(.76,0,.24,1), background .4s ease' }}
        />
      ))}
    </div>
  )
}

function BpgScrollHint({ page, onGo, sp, labels }: { page: number; onGo: (i: number) => void; sp: CrmPalette; labels: string[] }) {
  const nextLabel = page + 1 < labels.length ? labels[page + 1] : null
  const prevLabel = page > 0 ? labels[page - 1] : null
  const target = nextLabel || prevLabel
  if (!target) return null
  const dir = nextLabel ? 1 : -1
  return (
    <button className="bpg-scroll-hint" onClick={() => onGo(page + dir)} aria-label={target} style={{ position: 'absolute', bottom: 18, left: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-sm)', border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, lineHeight: 1, color: sp.sub }}>{nextLabel ? '↓' : '↑'}</span>
      <span className="bpg-hint-label" style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap', maxWidth: 0, overflow: 'hidden', opacity: 0, transform: 'translateX(-6px)', transition: 'max-width .4s cubic-bezier(.76,0,.24,1), opacity .3s ease, transform .4s cubic-bezier(.76,0,.24,1)' }}>
        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{target}</span>
      </span>
    </button>
  )
}

interface BiensPagerProps {
  biens: CrmBien[]
  sp: CrmPalette
  surf: GalSurfaces
  dark: boolean
  now: Date
  /** Compte neuf : page 0 = couverture premier lancement, page 1 = « rien à suivre ». */
  fresh: boolean
  isLoading: boolean
  isError: boolean
  refetch: () => void
  idxEnabled?: boolean
  onOpenBien: (id: string) => void
  onCreate: () => void
  onResumeDraft: (b: CrmBien) => void
  /** Wizard « Créer un bien » embarqué dans le bento. */
  wizardOpen: boolean
  wizardSlot?: ReactNode
}

export function BiensPager({
  biens, sp, surf, dark, now, fresh, isLoading, isError, refetch, idxEnabled,
  onOpenBien, onCreate, onResumeDraft, wizardOpen, wizardSlot,
}: BiensPagerProps) {
  const { t } = useTranslation('listings')
  const pageLabels = [t('title'), t('biens.followUp.title')]
  const [page, setPage] = useState(0)
  const [childModal, setChildModal] = useState(false)

  const pageRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Gel : wizard ouvert OU modale enfant (renew) ouverte. Ref lu dans les
  // listeners natifs (wheel/key/touch) → synchronisé via effet (pas au render).
  const frozenRef = useRef(false)
  useEffect(() => { frozenRef.current = wizardOpen || childModal }, [wizardOpen, childModal])

  const animateTo = useCallback((target: number, instant?: boolean) => {
    const vp = viewportRef.current, track = trackRef.current
    if (!vp || !track) return
    const h = vp.clientHeight
    const end = -target * h
    if (instant) { posRef.current = end; track.style.transform = `translateY(${end}px)`; return }
    const start = posRef.current
    const dur = 700
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (nowTs: number) => {
      const p = Math.min(1, (nowTs - t0) / dur)
      const y = start + (end - start) * ease(p)
      posRef.current = y
      track.style.transform = `translateY(${y}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => {
    setPage((p) => Math.min(PAGE_COUNT - 1, Math.max(0, p + dir)))
  }, [])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 820)
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
      if (frozenRef.current) { acc.current = 0; return }
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; return }
      e.preventDefault()
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, 180)
      if (Math.abs(acc.current) > 40) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e: KeyboardEvent) => {
      if (frozenRef.current) return
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 820) } }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 820) } }
    }
    window.addEventListener('keydown', onKey)
    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current || frozenRef.current) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 820) }
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
    <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
      <style>{`
        .bpg-scroll-hint { opacity: .55; transition: opacity .35s ease; }
        .bpg-scroll-hint:hover, .bpg-scroll-hint:focus-visible { opacity: 1; }
        .bpg-scroll-hint:hover .bpg-hint-label, .bpg-scroll-hint:focus-visible .bpg-hint-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
        .bpg-scroll-hint { -webkit-tap-highlight-color: transparent; }
        .bpg-scroll-hint:focus:not(:focus-visible) { outline: none; }
        .bpg-scroll-hint:focus-visible { outline: 2px solid ${sp.accent}; outline-offset: 2px; border-radius: 10px; }
      `}</style>
      <div ref={viewportRef} style={{ position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow }}>
        <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            {fresh ? (
              <BiensFirstRun onStart={onCreate} sp={sp} />
            ) : (
              <BpTopGallery
                biens={biens}
                sp={sp}
                surf={surf}
                dark={dark}
                isLoading={isLoading}
                isError={isError}
                refetch={refetch}
                onOpenBien={onOpenBien}
                onCreate={onCreate}
                onResumeDraft={onResumeDraft}
              />
            )}
          </div>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            {fresh ? (
              <BiensFollowEmpty sp={sp} onCreate={onCreate} />
            ) : (
              <BpFollowupPage
                biens={biens}
                sp={sp}
                surf={surf}
                dark={dark}
                now={now}
                isLoading={isLoading}
                isError={isError}
                idxEnabled={idxEnabled}
                onOpenBien={onOpenBien}
                onResumeDraft={onResumeDraft}
                onFreeze={setChildModal}
                onRefetch={refetch}
              />
            )}
          </div>
        </div>

        {!wizardOpen && <BpgPageDots page={page} onGo={goTo} sp={sp} dark={dark} labels={pageLabels} />}

        {/* Wizard « Créer un bien » embarqué : overlay plein bento. */}
        {wizardOpen && wizardSlot && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden' }}>
            {wizardSlot}
          </div>
        )}
      </div>
      {!wizardOpen && <BpgScrollHint page={page} onGo={goTo} sp={sp} labels={pageLabels} />}
    </main>
  )
}
