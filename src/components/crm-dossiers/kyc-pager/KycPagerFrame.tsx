// MEGGA CRM — KYC Pager · Cadre bento à 2 pages verticales
// Port fidèle de `KypPagerFrame` (kyc-pager-proto.jsx) : viewport bento
// (radius 26) qui clippe une piste de 2 pages glissant en translateY.
//   Page 0 · Dossiers KYC   Page 1 · Vigie
// Molette (accumulateur + verrou 820 ms + canScrollNatively) / flèches /
// swipe / points latéraux / indice bas-gauche. La mécanique est GELÉE quand la
// fiche ou le wizard est ouvert. Fiche route-driven (deep-link), wizard embedded.

import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CrmPalette } from '@/components/crm/tokens'
import { KycWizardModal } from '../kyc-wizard/KycWizardModal'
import { type KypSurf } from './kypTokens'
import { KycListPage } from './KycListPage'
import { KycVigiePage } from './KycVigiePage'
import { KycFicheStrict } from './KycFicheStrict'

const KYP_PAGES = [
  { id: 'liste', label: 'Dossiers KYC' },
  { id: 'vigie', label: 'Vigie' },
]

function KypPageDots({ page, onGo, dark }: { page: number; onGo: (i: number) => void; dark: boolean }) {
  const activeCol = dark ? '#F2F2F6' : MXC_COLOR.n100
  const idleCol = dark ? 'rgba(255,255,255,.22)' : `${crmVoileEncre(false, .18)}`
  return (
    <div
      style={{
        position: 'absolute',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-lg)',
        alignItems: 'center',
      }}
    >
      {KYP_PAGES.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onGo(i)}
          title={p.label}
          style={{
            width: 8,
            height: i === page ? 26 : 8,
            borderRadius: 'var(--crm-radius-pill)',
            border: 0,
            cursor: 'pointer',
            padding: 0,
            background: i === page ? activeCol : idleCol,
            transition: 'height .5s cubic-bezier(.76,0,.24,1), background .4s ease',
          }}
        />
      ))}
    </div>
  )
}

function KypScrollHint({ page, onGo, sp }: { page: number; onGo: (i: number) => void; sp: CrmPalette }) {
  const next = KYP_PAGES[page + 1]
  const target = next || KYP_PAGES[page - 1]
  if (!target) return null
  const dir = next ? 1 : -1
  return (
    <button
      className="kyp-scroll-hint"
      onClick={() => onGo(page + dir)}
      aria-label={`Molette pour ${target.label}`}
      style={{
        position: 'absolute',
        bottom: 18,
        left: 24,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-lg)',
        padding: 'var(--crm-space-sm)',
        border: 0,
        background: 'transparent',
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, lineHeight: 1, color: sp.sub }}>
        {next ? '↓' : '↑'}
      </span>
      <span
        className="kyp-hint-label"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          whiteSpace: 'nowrap',
          maxWidth: 0,
          overflow: 'hidden',
          opacity: 0,
          transform: 'translateX(-6px)',
          transition: 'max-width .4s cubic-bezier(.76,0,.24,1), opacity .3s ease, transform .4s cubic-bezier(.76,0,.24,1)',
        }}
      >
        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{target.label}</span>
      </span>
    </button>
  )
}

export interface KycWizardControl {
  mode: 'new' | 'import'
  contactId?: string | null
}

interface Props {
  sp: CrmPalette
  surf: KypSurf
  dark: boolean
  agentId: string
  dossierId?: string
  onOpenDossier: (id: string) => void
  onCloseDossier: () => void
  /** État wizard levé dans la page hôte (onboarding + deep-link contact). */
  wizard: KycWizardControl | null
  onOpenWizard: (mode: 'new' | 'import') => void
  onCloseWizard: () => void
  onWizardCreated: (id: string) => void
  onNavigate: (screen: string) => void
}

export function KycPagerFrame({
  sp,
  surf,
  dark,
  agentId,
  dossierId,
  onOpenDossier,
  onCloseDossier,
  wizard,
  onOpenWizard,
  onCloseWizard,
  onWizardCreated,
  onNavigate,
}: Props) {
  const [page, setPage] = useState(0)

  const ficheOpen = !!dossierId
  // Gel de la mécanique pager quand fiche/wizard ouverts. On met à jour la ref
  // dans un effet (jamais pendant le render) ; les listeners molette/clavier/
  // swipe la lisent au moment de l'évènement.
  const wizRef = useRef(false)
  useEffect(() => {
    wizRef.current = !!wizard || ficheOpen
  }, [wizard, ficheOpen])

  const pageRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef(0)
  const rafRef = useRef(0)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const dur = 700
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    cancelAnimationFrame(rafRef.current)
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
    setPage((p) => Math.min(KYP_PAGES.length - 1, Math.max(0, p + dir)))
  }, [])

  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => {
      lock.current = false
    }, 820)
  }, [])

  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  useEffect(() => {
    pageRef.current = page
    animateTo(page)
  }, [page, animateTo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const canScrollNatively = (node: EventTarget | null, dir: number) => {
      let nn = node as HTMLElement | null
      while (nn && nn !== el && nn.nodeType === 1) {
        const oy = getComputedStyle(nn).overflowY
        if ((oy === 'auto' || oy === 'scroll') && nn.scrollHeight > nn.clientHeight + 1) {
          if (dir > 0 && nn.scrollTop + nn.clientHeight < nn.scrollHeight - 1) return true
          if (dir < 0 && nn.scrollTop > 1) return true
        }
        nn = nn.parentElement
      }
      return false
    }
    const onWheel = (e: WheelEvent) => {
      if (wizRef.current) {
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
      accTimer.current = setTimeout(() => {
        acc.current = 0
      }, 180)
      if (Math.abs(acc.current) > 40) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => {
          lock.current = false
        }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e: KeyboardEvent) => {
      if (wizRef.current) return
      const tag = (e.target as HTMLElement)?.tagName || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target as HTMLElement)?.isContentEditable) return
      if (['ArrowDown', 'PageDown'].includes(e.key)) {
        e.preventDefault()
        if (!lock.current) {
          lock.current = true
          go(1)
          setTimeout(() => (lock.current = false), 820)
        }
      }
      if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        if (!lock.current) {
          lock.current = true
          go(-1)
          setTimeout(() => (lock.current = false), 820)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    let touchY: number | null = null
    const onTS = (e: TouchEvent) => {
      touchY = e.touches[0].clientY
    }
    const onTM = (e: TouchEvent) => {
      if (wizRef.current) return
      if (touchY == null || lock.current) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) {
        lock.current = true
        go(dy > 0 ? 1 : -1)
        touchY = null
        setTimeout(() => (lock.current = false), 820)
      }
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
    <>
      <div
        ref={viewportRef}
        style={{
          position: 'relative',
          height: '100%',
          borderRadius: 'var(--crm-radius-6xl)',
          overflow: 'hidden',
          border: `1px solid ${sp.frameBorder}`,
          boxShadow: sp.shadow,
        }}
      >
        <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <KycListPage sp={sp} surf={surf} onNewDossier={() => onOpenWizard('new')} onOpen={onOpenDossier} />
          </div>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <KycVigiePage sp={sp} surf={surf} onOpen={onOpenDossier} />
          </div>
        </div>

        {!wizard && !ficheOpen && <KypPageDots page={page} onGo={goTo} dark={dark} />}

        {ficheOpen && dossierId && (
          <KycFicheStrict
            dossierId={dossierId}
            agentId={agentId}
            sp={sp}
            surf={surf}
            onClose={onCloseDossier}
            onNavigate={onNavigate}
          />
        )}

        {wizard && (
          <KycWizardModal
            embedded
            initialMode={wizard.mode}
            initialContactId={wizard.contactId ?? null}
            onClose={onCloseWizard}
            onCreated={onWizardCreated}
          />
        )}
      </div>

      {!wizard && !ficheOpen && <KypScrollHint page={page} onGo={goTo} sp={sp} />}
    </>
  )
}
