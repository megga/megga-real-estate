// Atelier Matching — étage de présentation (triptyque + machine d'état triage).
// Séparé du conteneur (MatchingAtelierPage = données réelles + gestes Supabase ;
// /dev/matching-atelier = données mock du handoff + gestes stub) pour permettre
// la QA visuelle hi-fi sans session — même pattern que le portail vendeur
// (PortalDevWrapper). Toute la logique d'écran vit ici : onglets, recherche,
// sélection, sorties animées, undo, parking, modals, raccourcis clavier.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import SgaQueue, { type SnoozedEntry } from './SgaQueue'
import SgaListing from './SgaListing'
import SgaWhy from './SgaWhy'
import SgaConfirm from './SgaConfirm'
import SgaGallery from './SgaGallery'
import SgaAnnonceVue from './SgaAnnonceVue'
import SgaAcheteurMode from './SgaAcheteurMode'
import { SGA_TABS, sgaMatchQuery, sgaMatchTab } from './constants'
import { sgaReturnDate } from './format'
import { isSnoozed } from '@/hooks/useAtelierMatching'
import type { AtelierGestes, PendingHandle } from './pendingTriage'
import type { AtelierBuyer, AtelierPivot, AtelierPoolMatch, AtelierTab, TriageKind } from './types'

interface AtelierToast {
  msg: string
  deal: boolean
  plain: boolean
  key: number
  handle: PendingHandle | null
}

export interface AtelierStageProps {
  dark: boolean
  isLoading: boolean
  /** true si la query a échoué — affiche l'état d'erreur au lieu de l'empty */
  isError?: boolean
  /** relance le scan/refresh depuis l'état d'erreur */
  onRetry?: () => void
  /** pivot annonce courant (null = aucun match) */
  pivot: AtelierPivot | null
  /** pivot acheteur (mode « Par acheteur ») */
  pivotBuyer: AtelierBuyer | null
  pool: AtelierPoolMatch[]
  poolCountFor: (contactId: string) => number
  gestes: AtelierGestes
  onClose: () => void
  onOpenDeal: (dealId: string | null) => void
  onOpenBuyerPivot: (contactId: string) => void
  onCloseBuyerPivot: () => void
  onStartKyc: (contactId: string) => void
  /** action de l'état vide (scan moteur) — absente en démo */
  emptyAction?: { label: string; busy: boolean; run: () => void }
}

export default function AtelierStage({
  dark, isLoading, isError, onRetry, pivot, pivotBuyer, pool, poolCountFor, gestes,
  onClose, onOpenDeal, onOpenBuyerPivot, onCloseBuyerPivot, onStartKyc, emptyAction,
}: AtelierStageProps) {
  const { t } = useTranslation('matching')
  const [tab, setTab] = useState<AtelierTab>('to-send')
  const [query, setQuery] = useState('')
  const [processed, setProcessed] = useState<Record<string, TriageKind>>({})
  const [laterInfo, setLaterInfo] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<string[]>([])
  const [exiting, setExiting] = useState<{ id: string; dir: string } | null>(null)
  const [toast, setToast] = useState<AtelierToast | null>(null)
  const [confirmSend, setConfirmSend] = useState<{ matchId: string; relance?: boolean } | null>(null)
  const [gallery, setGallery] = useState<{ index: number } | null>(null)
  const [annonce, setAnnonce] = useState(false)
  const [selId, setSelId] = useState<string | null>(null)
  const handles = useRef(new Map<string, PendingHandle>())
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canVisit = pivot?.listing.kind === 'property'
  const buyers = useMemo(() => pivot?.buyers ?? [], [pivot])

  const isOpen = useCallback(
    (b: AtelierBuyer) => !processed[b.matchId] && !isSnoozed(b.snoozedUntil) && sgaMatchTab(b, tab) && sgaMatchQuery(b, query),
    [processed, tab, query],
  )
  const filtered = useMemo(() => buyers.filter(isOpen), [buyers, isOpen])
  const countFor = useCallback(
    (key: AtelierTab) => buyers.filter(b => !processed[b.matchId] && !isSnoozed(b.snoozedUntil) && sgaMatchTab(b, key) && sgaMatchQuery(b, query)).length,
    [buyers, processed, query],
  )
  const selected = filtered.find(b => b.matchId === selId) ?? filtered[0] ?? null

  useEffect(() => {
    if (!filtered.length) return
    if (!filtered.some(b => b.matchId === selId)) setSelId(filtered[0].matchId)
  }, [tab, query, processed, filtered]) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((msg: string, deal: boolean, handle: PendingHandle | null, plain = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, deal, plain, key: Date.now(), handle })
    toastTimer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const nextAfter = useCallback((matchId: string): string | null => {
    const idx = filtered.findIndex(b => b.matchId === matchId)
    const rest = filtered.filter(b => b.matchId !== matchId)
    if (!rest.length) return null
    return (filtered[idx + 1] ?? rest[rest.length - 1] ?? rest[0]).matchId
  }, [filtered])

  const triage = useCallback((matchId: string, kind: TriageKind) => {
    if (exitTimer.current) return
    const b = buyers.find(x => x.matchId === matchId)
    if (!b) return
    const nxt = nextAfter(matchId)
    const ret = kind === 'later' ? sgaReturnDate() : null

    const handle =
      kind === 'sent' ? gestes.send(matchId)
      : kind === 'relance' ? gestes.relance(matchId)
      : kind === 'later' ? gestes.snooze(matchId)
      : kind === 'interested' ? gestes.react(matchId, 'interested')
      : kind === 'rejected' ? gestes.react(matchId, 'rejected')
      : gestes.dismiss(matchId)
    handles.current.set(matchId, handle)

    setExiting({ id: matchId, dir: kind === 'sent' || kind === 'relance' || kind === 'interested' ? 'send' : kind === 'later' ? 'later' : 'skip' })
    exitTimer.current = setTimeout(() => {
      setProcessed(p => ({ ...p, [matchId]: kind }))
      if (ret) setLaterInfo(m => ({ ...m, [matchId]: ret }))
      setHistory(h => [...h, matchId])
      setExiting(null)
      if (nxt) setSelId(nxt)
      exitTimer.current = null
      const name = `${b.first} ${b.last}`
      showToast(
        kind === 'sent' ? t('atelier.toast.sent', { name })
        : kind === 'relance' ? t('atelier.toast.relance', { name })
        : kind === 'later' ? t('atelier.toast.later', { name, date: ret })
        : kind === 'interested' ? t('atelier.toast.interested', { name })
        : kind === 'rejected' ? t('atelier.toast.rejected', { name })
        : t('atelier.toast.skipped', { name }),
        kind === 'sent' || kind === 'relance' || kind === 'interested',
        handle,
      )
    }, 340)
  }, [buyers, nextAfter, gestes, showToast, t])

  const requestSend = useCallback((matchId: string) => {
    if (exitTimer.current) return
    setConfirmSend({ matchId })
  }, [])

  const requestRelance = useCallback((matchId: string) => {
    if (exitTimer.current) return
    setConfirmSend({ matchId, relance: true })
  }, [])

  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h
      const last = h[h.length - 1]
      handles.current.get(last)?.cancel()
      handles.current.delete(last)
      setProcessed(p => { const q = { ...p }; delete q[last]; return q })
      setLaterInfo(m => { if (!(last in m)) return m; const q = { ...m }; delete q[last]; return q })
      setSelId(last)
      setToast(null)
      return h.slice(0, -1)
    })
  }, [])

  // Réactiver un reporté : session → annule l'écriture différée ; base → wake
  const wake = useCallback((matchId: string) => {
    const b = buyers.find(x => x.matchId === matchId)
    if (!b) return
    const handle = handles.current.get(matchId)
    if (handle) { handle.cancel(); handles.current.delete(matchId) }
    else gestes.wake(matchId)
    setProcessed(p => { const q = { ...p }; delete q[matchId]; return q })
    setLaterInfo(m => { const q = { ...m }; delete q[matchId]; return q })
    setHistory(h => h.filter(x => x !== matchId))
    setSelId(matchId)
    showToast(t('atelier.toast.backInQueue', { name: `${b.first} ${b.last}` }), false, null, true)
  }, [buyers, gestes, showToast, t])

  const move = useCallback((dir: number) => {
    if (!filtered.length) return
    const idx = filtered.findIndex(b => b.matchId === selId)
    const ni = Math.max(0, Math.min(filtered.length - 1, (idx < 0 ? 0 : idx) + dir))
    setSelId(filtered[ni].matchId)
  }, [filtered, selId])

  // ── raccourcis clavier (mode annonce — le mode acheteur a les siens) ────
  useEffect(() => {
    if (pivotBuyer) return
    const onKey = (e: KeyboardEvent) => {
      if (confirmSend || gallery || annonce) return
      const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const k = e.key.toLowerCase()
      if (k === 'e' || e.key === 'ArrowRight') { e.preventDefault(); if (selected) requestSend(selected.matchId) }
      else if (k === 'x' || e.key === 'ArrowLeft') { e.preventDefault(); if (selected) triage(selected.matchId, 'skipped') }
      else if (k === 'p') { e.preventDefault(); if (selected) triage(selected.matchId, 'later') }
      else if (k === 'r') { e.preventDefault(); if (selected && selected.status === 'no-reply') requestRelance(selected.matchId) }
      else if (k === 'i') { e.preventDefault(); if (selected && selected.status === 'no-reply') triage(selected.matchId, 'interested') }
      else if (k === 'v') { e.preventDefault(); if (selected && selected.status === 'engaged' && canVisit) gestes.visit(selected.matchId) }
      else if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
      else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      else if (e.key === 'Backspace') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pivotBuyer, selected, confirmSend, gallery, annonce, canVisit, requestSend, requestRelance, triage, gestes, move, undo])

  // ── parking « Reportés » : session + base ───────────────────────────────
  const snoozedList: SnoozedEntry[] = useMemo(() => [
    ...history
      .filter(id => processed[id] === 'later')
      .map(id => ({ b: buyers.find(x => x.matchId === id), until: laterInfo[id] ?? '—' }))
      .filter((x): x is SnoozedEntry => Boolean(x.b)),
    ...buyers
      .filter(b => !processed[b.matchId] && isSnoozed(b.snoozedUntil))
      .map(b => ({ b, until: sgaReturnDate(b.snoozedUntil ?? undefined) })),
  ], [history, processed, laterInfo, buyers])

  const confirmBuyer = confirmSend ? buyers.find(x => x.matchId === confirmSend.matchId) ?? null : null

  return (
    <div className="sga sga-stage" data-theme={dark ? 'dark' : 'light'} data-density="confort">
      {/* ── top bar ── */}
      <div className="sga-top">
        <button className="btn circle" title={t('atelier.closeAtelier')} onClick={onClose}>
          <SgaIcon d="close" size={18} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.18, minWidth: 0 }}>
          <span className="t3 semi" style={{ color: 'var(--ink)' }}>
            {pivotBuyer ? t('atelier.buyerTitle') : t('atelier.listingTitle')}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {pivotBuyer ? (
          <button className="btn btn-ghost" style={{ padding: '10px 18px' }} onClick={onCloseBuyerPivot}>
            {t('atelier.backToListing')}
          </button>
        ) : pivot ? (
          <div className="seg">
            {SGA_TABS.map(tb => (
              <button key={tb.key} className="sga-seg-btn" data-active={tab === tb.key} onClick={() => setTab(tb.key)}>
                {tb.label}{tab === tb.key && <span className="cnt nums">{countFor(tb.key)}</span>}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── triptyque ── */}
      <div className="sga-body">
        {pivotBuyer ? (
          <SgaAcheteurMode key={pivotBuyer.id} b={pivotBuyer} pool={pool} gestes={gestes} onOpenDeal={onOpenDeal} />
        ) : isLoading ? (
          <>
            <section className="sga-panel sga-enter" />
            <section className="sga-panel sga-enter d1" />
            <section className="sga-panel sga-enter d2" />
          </>
        ) : isError ? (
          <section className="sga-panel sga-enter" style={{ gridColumn: '1 / -1' }}>
            <div className="sga-empty">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div className="t4 semi" style={{ color: 'var(--ink)' }}>{t('atelier.error.title')}</div>
                <div className="t1 muted" style={{ maxWidth: 320 }}>{t('atelier.error.desc')}</div>
                {onRetry && (
                  <button className="btn btn-ghost" onClick={onRetry}>
                    <SgaIcon d="refresh" size={15} /> {t('atelier.error.retry')}
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : !pivot ? (
          <section className="sga-panel sga-enter" style={{ gridColumn: '1 / -1' }}>
            <div className="sga-empty">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div className="t4 semi" style={{ color: 'var(--ink)' }}>{t('atelier.empty.title')}</div>
                <div className="t1 muted" style={{ maxWidth: 320 }}>
                  {t('atelier.empty.desc')}
                </div>
                {emptyAction && (
                  <button className="btn btn-ghost" onClick={emptyAction.run} disabled={emptyAction.busy}>
                    <SgaIcon d="refresh" size={15} /> {emptyAction.busy ? t('atelier.empty.scanning') : emptyAction.label}
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            <SgaQueue
              filtered={filtered}
              selectedId={selected?.matchId ?? null}
              exiting={exiting}
              query={query}
              setQuery={setQuery}
              snoozed={snoozedList}
              onWake={wake}
              tab={tab}
              onPick={setSelId}
            />

            <SgaListing
              L={pivot.listing}
              onOpenPhoto={i => setGallery({ index: i })}
              onOpenListing={() => setAnnonce(true)}
            />

            <section className="sga-panel sga-enter d2" aria-label="Pourquoi ça matche">
              {selected ? (
                <SgaWhy
                  b={selected}
                  poolCount={poolCountFor(selected.id)}
                  canVisit={canVisit}
                  onSend={() => requestSend(selected.matchId)}
                  onSkip={() => triage(selected.matchId, 'skipped')}
                  onLater={() => triage(selected.matchId, 'later')}
                  onVisit={() => gestes.visit(selected.matchId)}
                  onRelance={() => requestRelance(selected.matchId)}
                  onInterested={() => triage(selected.matchId, 'interested')}
                  onNotInterested={() => triage(selected.matchId, 'rejected')}
                  onPivot={() => onOpenBuyerPivot(selected.id)}
                  onStartKyc={() => onStartKyc(selected.id)}
                />
              ) : (
                <div className="sga-empty">
                  <div>
                    <div className="t4 semi" style={{ marginBottom: 6, color: 'var(--ink)' }}>{t('atelier.queueDone.title')}</div>
                    <div className="t1 muted" style={{ maxWidth: 240 }}>
                      {t('atelier.queueDone.desc')}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── confirmation d'envoi / relance ── */}
      {confirmSend && confirmBuyer && pivot && (
        <SgaConfirm
          b={confirmBuyer}
          L={pivot.listing}
          relance={confirmSend.relance}
          onClose={() => setConfirmSend(null)}
          onConfirm={() => {
            const rel = confirmSend.relance
            setConfirmSend(null)
            triage(confirmBuyer.matchId, rel ? 'relance' : 'sent')
          }}
        />
      )}

      {/* ── vue annonce complète (modal hi-fi) ── */}
      {annonce && pivot && (
        <SgaAnnonceVue
          L={pivot.listing}
          keysOff={!!gallery}
          buyer={selected}
          onClose={() => setAnnonce(false)}
          onPropose={selected ? () => { setAnnonce(false); requestSend(selected.matchId) } : null}
          onOpenPhoto={i => setGallery({ index: i })}
        />
      )}

      {/* ── galerie photo (lightbox) ── */}
      {gallery && pivot && (
        <SgaGallery L={pivot.listing} openIndex={gallery.index} onClose={() => setGallery(null)} />
      )}

      {/* ── toast triage (undo 5 s · voir le deal) ── */}
      {toast && (
        <div className="sga-toast" key={toast.key}>
          <span>{toast.msg}</span>
          {toast.deal && (
            <button
              className="undo deal"
              onClick={() => {
                const h = toast.handle
                setToast(null)
                if (!h) { onOpenDeal(null); return }
                void h.flushNow().then(r => onOpenDeal(r?.dealId ?? null))
              }}
            >
              {t('atelier.toast.seeDeal')}
            </button>
          )}
          {!toast.plain && <button className="undo" onClick={undo}>{t('common:actions.cancel')}</button>}
        </div>
      )}
    </div>
  )
}
