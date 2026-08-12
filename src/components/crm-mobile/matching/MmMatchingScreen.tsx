/**
 * Écran matching mobile (crm-mobile) — inbox par acheteur, VUE 1 liste ↔ VUE 2 focus.
 * Orchestration des gestes (undo, flush au démontage) et câblage : voir la docstring
 * de `MobileMatchingScreen` ci-dessous.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  execDismiss,
  execReact,
  execRelance,
  execSendDossier,
  execSnooze,
  execWake,
  useAtelierMatching,
  type GesteContext,
} from '@/hooks/useAtelierMatching'
import { PendingRegistry, type AtelierGestes, type PendingHandle } from '@/components/matching-atelier/pendingTriage'
import type { AtelierBuyer, AtelierListing, AtelierTab } from '@/components/matching-atelier/types'
import { sgaReturnDate } from '@/components/matching-atelier/format'
import MEIcon from '@/components/propertyx/MEIcon'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import SgActionMenu from '../primitives/SgActionMenu'
import SgConfirmDestructive from '../primitives/SgConfirmDestructive'
import MmBuyerCard from './MmBuyerCard'
import MmFocus from './MmFocus'
import MmSendModal from './MmSendModal'
import MmMatchingSettings from './MmMatchingSettings'
import MmToast, { type MmToastState } from './MmToast'
import {
  DEMO_FOCUS,
  DEMO_GROUPS,
  mmPriceLabel,
  pivotsToGroups,
  poolToFocus,
  type BuyerGroupVM,
  type FocusVM,
  type PoolMatchVM,
} from './vm'

const TABS: AtelierTab[] = ['all', 'to-send', 'engaged', 'no-reply']
const TOAST_MS = 4200 // < UNDO_WINDOW_MS (4500) — l'undo reste cliquable jusqu'à l'écriture

/**
 * Matching mobile — inbox par ACHETEUR (VUE 1 liste ↔ VUE 2 focus). Réutilise
 * `useAtelierMatching` + ses exécuteurs purs via `PendingRegistry` (undo 5 s,
 * flush au démontage = contrat audit). Aucune écriture directe sur `matches` ;
 * les gestes ciblent le matchId du BIEN concerné (un acheteur = N matchId).
 * KYC non-bloquant. Seeds derrière `demo` (harnais /dev/mobile, no-auth).
 *
 * v1 : liste↔focus + envoyer-par-bien (HITL réel) + reporter/écarter + scan +
 * réglages. Différés (cf. spec §6) : fiche annonce, nouvelle recherche, barre
 * dossier multi-bien, relance par bien, section « Reportés » + réactivation.
 */
export function MobileMatchingScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('matching')
  const { tk } = useMobileTokens()
  const { user, profile } = useAuth()
  const { isLoading, isError, pivots, poolFor, buyerFor, refresh } = useAtelierMatching()

  // ── écritures différées (flush au démontage — l'agent n'a pas annulé) ───
  const registryRef = useRef<PendingRegistry | null>(null)
  if (!registryRef.current) registryRef.current = new PendingRegistry()
  const registry = registryRef.current
  useEffect(() => () => registry.flushAll(), [registry])

  const ctx: GesteContext | null = useMemo(() => {
    if (!profile?.agency_id) return null
    return {
      agencyId: profile.agency_id,
      userId: profile.id ?? user?.id ?? '',
      agentName: profile.full_name ?? t('atelier.defaultAgentName'),
      agentPhone: profile.phone ?? null,
    }
  }, [profile, user, t])

  // matchId → (acheteur, annonce) — couvre tous les matches actifs de l'agence
  const matchIndex = useMemo(() => {
    const map = new Map<string, { buyer: AtelierBuyer; listing: AtelierListing }>()
    for (const g of pivots) for (const b of g.buyers) map.set(b.matchId, { buyer: b, listing: g.listing })
    return map
  }, [pivots])

  const gestes: AtelierGestes = useMemo(() => ({
    send: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      return execSendDossier(ctx, e.buyer, e.listing)
    }, { onSettled: refresh }),
    relance: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      return execRelance(ctx, e.buyer, e.listing)
    }, { onSettled: refresh }),
    snooze: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e || !ctx) return null
      await execSnooze(ctx, e.buyer)
      return null
    }, { onSettled: refresh }),
    dismiss: (matchId) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execDismiss(e.buyer)
      return null
    }, { onSettled: refresh }),
    react: (matchId, reaction) => registry.defer(async () => {
      const e = matchIndex.get(matchId)
      if (!e) return null
      await execReact(e.buyer, reaction)
      return null
    }, { onSettled: refresh }),
    wake: (matchId) => { void execWake(matchId).then(refresh) },
    visit: (matchId) => {
      const e = matchIndex.get(matchId)
      if (!e || e.listing.kind !== 'property') return
      registry.flushAll()
      navigate(`/dashboard/visits/new?bienId=${e.listing.id}&contactId=${e.buyer.id}`)
    },
  }), [registry, matchIndex, ctx, refresh, navigate])

  // ── état liste / focus / surfaces ────────────────────────────────────────
  const [filter, setFilter] = useState<AtelierTab>('all')
  const [sel, setSel] = useState<BuyerGroupVM | null>(null)
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState<Set<string>>(() => new Set())
  const [scheduled, setScheduled] = useState<Set<string>>(() => new Set())
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const [menuGroup, setMenuGroup] = useState<BuyerGroupVM | null>(null)
  const [confirmExclude, setConfirmExclude] = useState<BuyerGroupVM | null>(null)
  const [screenMenu, setScreenMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sendTarget, setSendTarget] = useState<PoolMatchVM | null>(null)
  const [scanning, setScanning] = useState(false)

  const handlesRef = useRef<Map<string, PendingHandle[]>>(new Map())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastKey = useRef(0)
  const [toast, setToast] = useState<MmToastState | null>(null)

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(null)
  }, [])
  const showToast = useCallback((next: Omit<MmToastState, 'key'>) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastKey.current += 1
    setToast({ ...next, key: toastKey.current })
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // ── groupes (réels ou démo), filtrés ────────────────────────────────────
  const allGroups = useMemo(
    () => (demo ? DEMO_GROUPS : pivotsToGroups(pivots)).filter((g) => !hidden.has(g.id)),
    [demo, pivots, hidden],
  )
  const counts = useMemo(() => {
    const c: Record<AtelierTab, number> = { all: allGroups.length, 'to-send': 0, engaged: 0, 'no-reply': 0 }
    for (const g of allGroups) c[g.tab] += 1
    return c
  }, [allGroups])
  const visible = filter === 'all' ? allGroups : allGroups.filter((g) => g.tab === filter)

  const focusVM: FocusVM | null = useMemo(() => {
    if (!sel) return null
    if (demo) return DEMO_FOCUS[sel.id] ?? null
    const b = buyerFor(sel.id)
    if (!b) return null
    return poolToFocus(b, poolFor(sel.id, null))
  }, [sel, demo, buyerFor, poolFor])

  // ── navigation focus (anim deux-temps, fidèle au proto) ─────────────────
  const openFocus = useCallback((g: BuyerGroupVM) => {
    setSel(g)
    window.setTimeout(() => setOpen(true), 24)
  }, [])
  const back = useCallback(() => {
    setOpen(false)
    window.setTimeout(() => setSel(null), 340)
  }, [])

  const openDeal = useCallback((dealId: string | null) => {
    registry.flushAll()
    navigate(dealId ? `/dashboard/transactions/${dealId}` : '/dashboard/pipeline')
  }, [navigate, registry])

  // ── gestes UI ────────────────────────────────────────────────────────────
  const buyerName = (g: BuyerGroupVM | FocusVM['buyer']) => `${g.first} ${g.last}`

  const confirmSend = useCallback(() => {
    const m = sendTarget
    const buyer = focusVM?.buyer
    if (!m || !buyer) return
    setSendTarget(null)
    setSent((s) => new Set(s).add(m.matchId))
    const name = buyerName(buyer)
    if (demo) {
      showToast({
        msg: t('atelier.toast.sent', { name }),
        onUndo: () => { setSent((s) => { const n = new Set(s); n.delete(m.matchId); return n }); dismissToast() },
      })
      return
    }
    const handle = gestes.send(m.matchId)
    handlesRef.current.set(m.matchId, [handle])
    showToast({
      msg: t('atelier.toast.sent', { name }),
      onUndo: () => {
        handle.cancel()
        handlesRef.current.delete(m.matchId)
        setSent((s) => { const n = new Set(s); n.delete(m.matchId); return n })
        dismissToast()
      },
      onSeeDeal: () => { void handle.flushNow().then((r) => openDeal(r?.dealId ?? null)); dismissToast() },
    })
  }, [sendTarget, focusVM, demo, gestes, showToast, dismissToast, openDeal, t])

  const requestSchedule = useCallback((m: PoolMatchVM) => {
    if (demo) {
      setScheduled((s) => new Set(s).add(m.matchId))
      showToast({ msg: t('mobile.visitProposed') })
      return
    }
    gestes.visit(m.matchId)
  }, [demo, gestes, showToast, t])

  const snoozeGroup = useCallback((g: BuyerGroupVM) => {
    const name = buyerName(g)
    const date = sgaReturnDate()
    setHidden((s) => new Set(s).add(g.id))
    const unhide = () => { setHidden((s) => { const n = new Set(s); n.delete(g.id); return n }); dismissToast() }
    if (demo) {
      showToast({ msg: t('atelier.toast.later', { name, date }), onUndo: unhide })
      return
    }
    const handles = g.matchIds.map((id) => gestes.snooze(id))
    handlesRef.current.set(`snooze:${g.id}`, handles)
    showToast({
      msg: t('atelier.toast.later', { name, date }),
      onUndo: () => { handles.forEach((h) => h.cancel()); handlesRef.current.delete(`snooze:${g.id}`); unhide() },
    })
  }, [demo, gestes, showToast, dismissToast, t])

  const dismissGroup = useCallback((g: BuyerGroupVM) => {
    const name = buyerName(g)
    setConfirmExclude(null)
    setHidden((s) => new Set(s).add(g.id))
    const unhide = () => { setHidden((s) => { const n = new Set(s); n.delete(g.id); return n }); dismissToast() }
    if (demo) {
      showToast({ msg: t('atelier.toast.skipped', { name }), onUndo: unhide })
      return
    }
    const handles = g.matchIds.map((id) => gestes.dismiss(id))
    handlesRef.current.set(`dismiss:${g.id}`, handles)
    showToast({
      msg: t('atelier.toast.skipped', { name }),
      onUndo: () => { handles.forEach((h) => h.cancel()); handlesRef.current.delete(`dismiss:${g.id}`); unhide() },
    })
  }, [demo, gestes, showToast, dismissToast, t])

  const runScan = useCallback(async () => {
    if (!ctx || scanning || demo) return
    setScanning(true)
    try {
      await supabase.functions.invoke('matching-engine', { body: { mode: 'scan-all', agency_id: ctx.agencyId } })
      refresh()
    } finally {
      setScanning(false)
    }
  }, [ctx, scanning, demo, refresh])

  // ── rendu ────────────────────────────────────────────────────────────────
  const showLoading = !demo && isLoading && allGroups.length === 0
  const showError = !demo && isError
  const showEmpty = !showLoading && !showError && allGroups.length === 0

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative' }}>
      {/* ── COUCHE LISTE (parallaxe quand le focus est ouvert) ── */}
      <div
        style={{
          transition: 'transform .34s cubic-bezier(.4,0,.2,1), filter .34s ease',
          transform: open ? 'translateX(-22%)' : 'none',
          filter: open ? 'brightness(.96)' : 'none',
        }}
      >
        {/* En-tête */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'calc(env(safe-area-inset-top) + 14px) 18px 6px',
          }}
        >
          <MeggaWordmark color={tk.ink} height={22} />
          <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
            <button
              type="button"
              onClick={() => openSugarSearch()}
              aria-label={t('common:nav.search')}
              style={iconBtn(tk)}
            >
              <MEIcon name="search" size={18} color={tk.ink} />
            </button>
            <button
              type="button"
              onClick={() => setScreenMenu(true)}
              aria-label={t('common:actions.options')}
              style={iconBtn(tk)}
            >
              <MEIcon name="more-horizontal" size={18} color={tk.ink} />
            </button>
          </div>
        </header>

        <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
          <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>
            {t('common:nav.matching')}
          </h1>
          <div style={{ marginTop: 7 }}>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.inkSoft }}>
              {t('mobile.activeBuyers', { count: allGroups.length })}
            </span>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '16px 0 0', padding: 'var(--crm-space-2xs) var(--crm-space-4xl) var(--crm-space-xs)', scrollbarWidth: 'none' }}>
          {TABS.map((f) => {
            if (f !== 'all' && f !== filter && !counts[f]) return null
            const on = f === filter
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-sm)',
                  height: 38,
                  padding: '0 var(--crm-space-2xl)',
                  borderRadius: 'var(--crm-radius-pill)',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: on ? tk.accent : tk.card,
                  boxShadow: on ? tk.shadow : tk.shadowSm,
                  transition: 'background .2s ease',
                }}
              >
                <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: on ? tk.accentInk : tk.ink, whiteSpace: 'nowrap' }}>
                  {t(`tabs.${f}`)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Contenu */}
        <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-4xl) 0' }}>
          {showLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ height: 216, borderRadius: 'var(--crm-radius-5xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />
              ))}
            </div>
          ) : showError ? (
            <div style={{ textAlign: 'center', padding: '48px 12px' }}>
              <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3 }}>{t('atelier.error.title')}</div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.muted, marginTop: 6, lineHeight: 1.45 }}>{t('atelier.error.desc')}</div>
              <button
                type="button"
                onClick={refresh}
                style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}
              >
                {t('atelier.error.retry')}
              </button>
            </div>
          ) : showEmpty ? (
            <div style={{ textAlign: 'center', padding: '48px 12px' }}>
              <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3 }}>{t('atelier.empty.title')}</div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: tk.muted, marginTop: 6, lineHeight: 1.45 }}>{t('atelier.empty.desc')}</div>
              {!demo ? (
                <button
                  type="button"
                  onClick={() => void runScan()}
                  disabled={scanning}
                  style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: scanning ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk, opacity: scanning ? 0.85 : 1 }}
                >
                  {scanning ? t('atelier.empty.scanning') : t('atelier.empty.scanCta')}
                </button>
              ) : null}
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: tk.muted, fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>
              {t('mobile.emptyFilter')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
              {visible.map((g) => (
                <MmBuyerCard key={g.id} group={g} onOpen={() => openFocus(g)} onMenu={() => setMenuGroup(g)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── COUCHE FOCUS (glisse depuis la droite) ── */}
      {sel && focusVM ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: tk.canvas,
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform .34s cubic-bezier(.4,0,.2,1)',
            boxShadow: open ? '-24px 0 60px rgba(15,23,42,0.18)' : 'none',
          }}
        >
          <MmFocus
            focus={focusVM}
            sent={sent}
            scheduled={scheduled}
            onBack={back}
            onRequestSend={(m) => setSendTarget(m)}
            onRequestSchedule={requestSchedule}
          />
        </div>
      ) : null}

      {/* Menu écran (••• → réglages) */}
      <SgActionMenu
        open={screenMenu}
        onClose={() => setScreenMenu(false)}
        items={[{ id: 'settings', icon: 'settings', label: t('mobile.settings.title') }]}
        onAction={(id) => {
          setScreenMenu(false)
          if (id === 'settings') setSettingsOpen(true)
        }}
      />

      {/* Menu acheteur */}
      <SgActionMenu
        open={menuGroup !== null}
        onClose={() => setMenuGroup(null)}
        title={menuGroup ? `${menuGroup.first} ${menuGroup.last}` : undefined}
        subtitle={menuGroup ? t('mobile.bienCount', { count: menuGroup.bienCount }) : undefined}
        items={[
          { id: 'contact', icon: 'user', label: t('mobile.viewContact') },
          { id: 'refine', icon: 'edit', label: t('mobile.refine') },
          { id: 'later', icon: 'clock', label: t('atelier.later') },
          { id: 'exclude', icon: 'close-circle', label: t('mobile.removeFromList'), danger: true, divider: true },
        ]}
        onAction={(id) => {
          const g = menuGroup
          setMenuGroup(null)
          if (!g) return
          if (id === 'contact') { registry.flushAll(); navigate(`/dashboard/contacts/${g.id}`) }
          else if (id === 'refine') openFocus(g)
          else if (id === 'later') snoozeGroup(g)
          else if (id === 'exclude') setConfirmExclude(g)
        }}
      />

      {/* Retirer de la liste (écarter) */}
      <SgConfirmDestructive
        open={confirmExclude !== null}
        title={t('mobile.removeTitle')}
        message={confirmExclude ? t('mobile.removeBody', { name: `${confirmExclude.first} ${confirmExclude.last}` }) : undefined}
        confirmLabel={t('mobile.removeFromList')}
        onConfirm={() => { if (confirmExclude) dismissGroup(confirmExclude) }}
        onCancel={() => setConfirmExclude(null)}
      />

      {/* Confirmation d'envoi (HITL) */}
      <MmSendModal
        open={sendTarget !== null}
        buyerFirst={focusVM?.buyer.first ?? ''}
        listingTitle={sendTarget?.title ?? ''}
        listingAddr={sendTarget?.addr ?? ''}
        priceLabel={sendTarget ? mmPriceLabel(sendTarget.price, sendTarget.transaction, t) : ''}
        email={!demo && sendTarget ? matchIndex.get(sendTarget.matchId)?.buyer.email ?? null : null}
        onConfirm={confirmSend}
        onCancel={() => setSendTarget(null)}
      />

      <MmMatchingSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <MmToast toast={toast} />
    </div>
  )
}

/** Style partagé des boutons-icônes ronds de l'en-tête (recherche, menu écran). */
function iconBtn(tk: ReturnType<typeof useMobileTokens>['tk']) {
  return {
    width: 38,
    height: 38,
    borderRadius: 'var(--crm-radius-pill)',
    border: `1px solid ${tk.cardBorder}`,
    cursor: 'pointer',
    background: tk.card,
    boxShadow: tk.shadowSm,
    display: 'grid',
    placeItems: 'center',
  } as const
}
