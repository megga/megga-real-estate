/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » (route /dashboard/pipeline, desktop).
 * Port du handoff crm-screen-pipeline-sugar.jsx (CRMScreenPipelineSugar) monté
 * dans le cadre bento mono-page de crm-screen-pipeline-proto.jsx.
 *
 * Écarts prod assumés (plan Pipeline v2) :
 *   - données réelles : usePipelineSugar (transactions + reminders) + overlay
 *     optimiste de drag ; « maintenant » = date réelle (les données vivent, pas
 *     besoin de l'ancre « deal le plus récent » du proto aux données figées) ;
 *   - période par défaut « Tous » (0) — un défaut 30 j masquerait les dossiers
 *     dormants réels (décision produit pré-existante, conservée) ;
 *   - « won » ⇔ transactions.status='completed', « archivé » ⇔ archived_at ;
 *   - « Féliciter » et « Envoyer à MEGGA AI » ouvrent le copilote avec un
 *     brouillon (human-in-the-loop — jamais d'envoi automatique) ;
 *   - planifier une visite persiste un reminder « visite » réel (pas d'action
 *     factice) en plus de l'avancement d'étape du proto.
 *
 * ── SLOT `banc` (aperçu `/dev/pipeline`) ─────────────────────────────────────
 * Cette page tire TOUT d'`usePipelineSugar()`, gaté sur `profile.agency_id` :
 * sans session elle ne rend qu'un board vide, et `ProtectedRoute` renvoie vers
 * la production avant même d'y arriver. Le slot `banc` substitue la SOURCE et
 * rend les ÉCRITURES inertes — la page, elle, reste la page : mêmes filtres,
 * mêmes vues, mêmes colonnes, mêmes modales, même drag-drop.
 *
 * ⚠ Il ne pilote PAS l'état interne : le banc reçoit les mêmes poignées que
 * l'agent (`PipelineBancGestes`) et appuie sur les mêmes boutons. Un banc qui
 * dupliquerait la machine à états mesurerait sa copie.
 */

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CRM_STAGES, CRM_STAGE_ORDER, crmSugarPalette, type StageId,
} from '@/components/crm-sugar/tokens'
import { type CrmDeal } from '@/components/crm-sugar/mockData'
import MEIcon from '@/components/propertyx/MEIcon'
import { useLogAudit } from '@/hooks/useAuditLog'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useAiPanel } from '@/hooks/useAiPanel'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'
import {
  useUpdateTransactionStatus, useArchiveTransaction, useReassignTransaction,
} from '@/hooks/useTransactions'
import {
  usePipelineReminderCreators, useCancelTransactionReminders, useRescheduleReminder,
} from '@/hooks/usePipelineNextActions'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_STAGE_PROBS } from '@/components/crm-sugar/pipeline/stageConstants'
import { SugarStageColumn } from '@/components/crm-sugar/pipeline/SugarStageColumn'
import { PipelineList } from '@/components/crm-sugar/pipeline/PipelineList'
import { PipelineTimeline } from '@/components/crm-sugar/pipeline/PipelineTimeline'
import { SignedBento } from '@/components/crm-sugar/pipeline/SignedBento'
import { LostConfirmModal } from '@/components/crm-sugar/pipeline/LostConfirmModal'
import type { VisitSlot } from '@/components/crm-sugar/pipeline/SugarCardQuickActions'
import {
  SugarSegmentedView, SugarFilterPill,
  SugarStageFilter, SugarRiskFilter, SugarPeriodFilter,
  type PipelineView, type RiskFilterValue,
} from '@/components/crm-sugar/pipeline/PipelineFilters'
import { NewDealModal, type NewDealBanc, type NewDealPrefill } from '@/components/crm-sugar/pipeline/NewDealModal'
import { SgInlineNewDeal } from '@/components/crm-sugar/pipeline/SgInlineNewDeal'
import type { CrmContact, CrmBien } from '@/components/crm-sugar/mockData'

/**
 * Poignées du board, telles que l'agent les actionne. Le banc les reçoit pour
 * ouvrir les surfaces qui, autrement, ne s'atteignent que par un survol suivi
 * d'un menu (« perdu »), ou par un drag suivi de 1 750 ms d'animation (le bento
 * « Signé ») — deux gestes qu'une capture ne peut pas tenir.
 */
export interface PipelineBancGestes {
  ouvrirNouveauDeal: () => void
  ouvrirPerdu: (dealId: string) => void
  ouvrirSigne: (dealId: string) => void
  ouvrirInline: (stage: StageId) => void
  fermerTout: () => void
}

/** Contrat du slot d'aperçu — voir l'en-tête de fichier. */
export interface PipelineBanc {
  deals: CrmDeal[]
  contactsById: Map<string, CrmContact>
  biensById: Map<string, CrmBien>
  /** Rend le bandeau d'erreur NON bloquant, colonnes conservées. */
  isError: boolean
  /**
   * ⛔ INTERCEPTE TOUTE NAVIGATION, et ce n'est pas un confort.
   *
   * Sans elle, un clic sur une carte fait `navigate('/dashboard/transactions/…')`
   * → `ProtectedRoute` → `window.location.replace('https://megga.ch/login')`. Le
   * banc éjecte alors vers la PRODUCTION — mesuré à l'écran, pas déduit : c'est
   * exactement le piège pour lequel ce banc existe, et la première version l'a
   * livré avec. Vaut aussi pour la barre supérieure et le rail.
   */
  onNavigate?: (vers: string) => void
  /**
   * Listes des DEUX surfaces de création, qui portent leurs propres sources
   * (`useContactsSugar`, `useBiensSugar`). Elles sont fournies à part des index
   * du board : l'état « vide · filtré » vide `contactsById` pour atteindre la
   * carte « affinez vos filtres », et la modale n'a pas à se vider avec lui.
   */
  creation?: NewDealBanc
  /**
   * Commandes du banc, rendues à la RACINE de la page.
   *
   * ⚠ Elles ne peuvent pas vivre dans le cadre bento : il porte
   * `overflow: hidden` et clippe tout ce qui le déborde. Et le banc ne relit
   * jamais `megga.sugar.dark` pour son compte — il REÇOIT `dark`, sinon ses
   * propres commandes seraient peintes dans le thème d'avant la bascule.
   */
  Chrome?: (p: { dark: boolean; gestes: PipelineBancGestes }) => ReactNode
}

export default function PipelineSugarV2Page({ banc }: { banc?: PipelineBanc } = {}) {
  const { t } = useTranslation('pipeline')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const ai = useAiPanel()

  // Drilldown depuis le Dashboard Analytics : `?stage=signed,visit-scheduled`.
  // Parse une fois au mount, puis l'URL est nettoyée (effet plus bas).
  const initialFilterStages = useMemo<StageId[]>(() => {
    const raw = searchParams.get('stage')
    if (!raw) return []
    const valid = new Set(Object.keys(CRM_STAGES) as StageId[])
    return raw.split(',').filter((s): s is StageId => valid.has(s as StageId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Thème dark/light, persisté (partagé entre pages Sugar) ───────────
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

  const [view, setView] = useState<PipelineView>('kanban')
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newDealPrefill, setNewDealPrefill] = useState<NewDealPrefill | null>(null)
  // Création inline (concept B) : quelle colonne a sa carte fantôme ouverte.
  const [inlineStage, setInlineStage] = useState<StageId | null>(null)
  /** Seul point de sortie de la page — voir `PipelineBanc.onNavigate`. */
  const go = (vers: string) => { if (banc?.onNavigate) banc.onNavigate(vers); else navigate(vers) }
  const openDeal = (dealId: string) => { go(`/dashboard/transactions/${dealId}`) }

  const logAudit = useLogAudit()

  // ── Source de vérité : Supabase via usePipelineSugar ────────────────
  // ⚠ Le hook est appelé DANS TOUS LES CAS (règle des hooks) ; en banc son
  // résultat est simplement écarté. Sans session il ne part de toute façon
  // aucune requête : ses cinq queries sont gatées sur `agency_id`.
  const live = usePipelineSugar()
  const enBanc = banc !== undefined
  const liveDeals = banc ? banc.deals : live.deals
  const contactsById = banc ? banc.contactsById : live.contactsById
  const biensById = banc ? banc.biensById : live.biensById
  const { updateStage } = live
  // En banc, l'état d'erreur est celui que le banc demande, et « Réessayer »
  // n'a rien à relancer — le bouton reste actionnable pour être photographié.
  const pipelineError = banc ? banc.isError : live.isError
  const pipelineRefetch = enBanc ? () => undefined : live.refetch
  const updateStatus = useUpdateTransactionStatus()
  const archiveTx = useArchiveTransaction()
  const reassignTx = useReassignTransaction()
  const { createVisitReminder } = usePipelineReminderCreators()
  const cancelReminders = useCancelTransactionReminders()
  const rescheduleReminder = useRescheduleReminder()

  // ── Overlays optimistes ──────────────────────────────────────────────
  // React Query invalide après mutation → léger délai. On surcouche localement
  // le stage / le « gagné » le temps que la mutation aboutisse (pas de flash).
  const [pendingStage, setPendingStage] = useState<Map<string, StageId>>(() => new Map())
  const [pendingWon, setPendingWon] = useState<Set<string>>(() => new Set())

  const localDeals = useMemo<CrmDeal[]>(() => {
    if (pendingStage.size === 0 && pendingWon.size === 0) return liveDeals
    return liveDeals.map(d => {
      const pending = pendingStage.get(d.id)
      const won = pendingWon.has(d.id) || d.won
      if (!pending && won === d.won) return d
      return {
        ...d,
        stage: pending ?? d.stage,
        probability: pending ? (CRM_STAGE_PROBS[pending] || d.probability) : d.probability,
        won,
      }
    })
  }, [liveDeals, pendingStage, pendingWon])

  const patchPendingStage = (dealId: string, stage: StageId | null) => {
    setPendingStage(prev => {
      const next = new Map(prev)
      if (stage === null) next.delete(dealId); else next.set(dealId, stage)
      return next
    })
  }

  // ── Toast capsule (unique, 5 s, undo optionnel) ─────────────────────
  const [pipeToast, setPipeToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (message: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setPipeToast({ message, undo })
    toastTimer.current = setTimeout(() => setPipeToast(null), 5000)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // ── Célébration « Signé » (3 phases) + bento de suites naturelles ────
  const [signingId, setSigningId] = useState<string | null>(null)
  const [signExit, setSignExit] = useState(false)
  const [signedDeal, setSignedDeal] = useState<string | null>(null)
  const signTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearSignTimers = () => { signTimers.current.forEach(clearTimeout); signTimers.current = [] }
  useEffect(() => () => clearSignTimers(), [])

  const celebrateSign = (dealId: string) => {
    clearSignTimers()
    setSigningId(dealId)
    setSignExit(false)
    signTimers.current.push(setTimeout(() => setSignExit(true), 1050))
    signTimers.current.push(setTimeout(() => {
      // « Gagné » : le deal sort du board actif (status='completed').
      setPendingWon(prev => new Set(prev).add(dealId))
      if (!enBanc) {
        updateStatus.mutateAsync({ id: dealId, status: 'completed' })
          .catch(() => {
            setPendingWon(prev => { const n = new Set(prev); n.delete(dealId); return n })
            showToast(t('board.toast.moveFailedTitle'))
          })
      }
      setSigningId(null)
      setSignExit(false)
      setSignedDeal(dealId)
    }, 1750))
  }
  const cancelCelebration = () => {
    clearSignTimers()
    setSigningId(null)
    setSignExit(false)
  }

  // ── Drag & drop ──────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)

  const applyStageMove = (dealId: string, targetStage: StageId, opts?: {
    onSuccess?: () => void
    onError?: () => void
  }) => {
    patchPendingStage(dealId, targetStage)
    // En banc l'overlay optimiste EST le résultat : on ne le retire pas, sinon
    // la carte reviendrait dans sa colonne de départ après chaque déplacement.
    if (enBanc) { opts?.onSuccess?.(); return }
    updateStage.mutate(
      { id: dealId, stage: stageIdToTransactionStage(targetStage) },
      {
        // B1 : audit émis SEULEMENT si la mutation réussit — sinon on tracerait
        // un déplacement annulé (piste d'audit LBA inexacte).
        onSuccess: () => { opts?.onSuccess?.() },
        onError: () => {
          showToast(t('board.toast.moveFailedTitle'))
          opts?.onError?.()
        },
        onSettled: () => { patchPendingStage(dealId, null) },
      },
    )
  }

  const handleDragStart = (dealId: string) => setDraggingId(dealId)
  const handleDragEnd = () => { setDraggingId(null); setDragOverStage(null); stopAutoScroll() }
  const handleDragOver = (stage: StageId) => setDragOverStage(stage)
  const handleDrop = (targetStage: StageId) => {
    if (!draggingId) return
    const deal = localDeals.find(d => d.id === draggingId)
    if (!deal || deal.stage === targetStage) { handleDragEnd(); return }
    // KYC non-bloquant (CLAUDE.md) : aucun garde-fou — un deal avance librement
    // vers n'importe quelle étape, KYC validé ou non.
    const movedId = draggingId
    const contact = contactsById.get(deal.contactId)
    const fromStage = deal.stage
    applyStageMove(movedId, targetStage, {
      onSuccess: () => {
        if (enBanc) return
        logAudit.mutate({
          category: 'deal',
          severity: 'info',
          action: 'Étape changée',
          entityType: 'deal',
          entityId: movedId,
          objectLabel: contact ? `${contact.firstName} ${contact.lastName}` : movedId,
          metadata: { from: fromStage, to: targetStage },
        })
      },
      // Drop sur « Signé » : la célébration démarre au drop (optimiste) — si la
      // mutation échoue, on l'annule proprement (pas de deal « gagné » fantôme).
      onError: targetStage === 'signed' ? cancelCelebration : undefined,
    })
    handleDragEnd()
    if (targetStage === 'signed') celebrateSign(movedId)
  }

  // ── Auto-scroll horizontal pendant le drag (bords du board) ──────────
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef({ speed: 0, raf: 0 })
  const stepAutoScroll = () => {
    const el = scrollRef.current
    const s = autoScroll.current
    if (el && s.speed) {
      el.scrollLeft += s.speed
      s.raf = requestAnimationFrame(stepAutoScroll)
    } else {
      s.raf = 0
    }
  }
  const stopAutoScroll = () => {
    autoScroll.current.speed = 0
    if (autoScroll.current.raf) { cancelAnimationFrame(autoScroll.current.raf); autoScroll.current.raf = 0 }
  }
  const onBoardDragOver = (e: React.DragEvent) => {
    const el = scrollRef.current
    if (!el || !draggingId) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    const edge = 110
    const x = e.clientX
    let speed = 0
    if (x < rect.left + edge) speed = -Math.max(6, Math.round((rect.left + edge - x) / edge * 24))
    else if (x > rect.right - edge) speed = Math.max(6, Math.round((x - (rect.right - edge)) / edge * 24))
    autoScroll.current.speed = speed
    if (speed && !autoScroll.current.raf) autoScroll.current.raf = requestAnimationFrame(stepAutoScroll)
  }
  useEffect(() => stopAutoScroll, [])

  // ── Molette : geste horizontal → board ; vertical → colonne sinon rien ─
  // Le bento est un cadre à hauteur fixe : la page ne défile pas. On bloque le
  // mapping natif « deltaY → scroll horizontal » du navigateur quand aucune
  // colonne ne peut défiler dans la direction du geste.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || view !== 'kanban') return
    const canScrollY = (node: EventTarget | null, dir: number): boolean => {
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
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        el.scrollLeft += e.deltaX
        e.preventDefault()
        return
      }
      if (canScrollY(e.target, e.deltaY > 0 ? 1 : -1)) return
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view])

  // ── Recherche + filtres ──────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterStages, setFilterStages] = useState<StageId[]>(initialFilterStages)
  const [filterRisk, setFilterRisk] = useState<RiskFilterValue>('all')
  // Défaut = « Tous » (0). Un défaut à 30 j masquerait silencieusement tout deal
  // dont la dernière activité date de plus d'un mois (dossier qui dort).
  const [filterPeriod, setFilterPeriod] = useState(0)

  // Consomme le `?stage=` : injecté dans filterStages au mount, puis retiré de
  // l'URL pour que F5 ne re-applique pas le filtre.
  useEffect(() => {
    if (searchParams.has('stage')) {
      const next = new URLSearchParams(searchParams)
      next.delete('stage')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredDeals = useMemo(() => {
    return localDeals.filter(d => {
      // Hors board : deal rangé, perdu ou gagné (proto : archived || lost || won).
      if (d.archived || d.won || d.stage === 'lost') return false
      const c = contactsById.get(d.contactId)
      if (!c) return false
      const b = d.bienId ? biensById.get(d.bienId) ?? null : null
      if (search) {
        const q = search.toLowerCase()
        const inContact = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        const inBien = b ? b.title.toLowerCase().includes(q) || b.addr.toLowerCase().includes(q) : false
        const inNote = d.nextAction?.note?.toLowerCase().includes(q)
        if (!inContact && !inBien && !inNote) return false
      }
      if (filterStages.length > 0 && !filterStages.includes(d.stage)) return false
      if (filterRisk !== 'all' && d.risk !== filterRisk) return false
      if (filterPeriod !== 0) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - filterPeriod)
        if (new Date(d.updatedAt) < cutoff) return false
      }
      return true
    })
    // contactsById/biensById en deps : recompute dès que les contacts hydratent.
  }, [search, filterStages, filterRisk, filterPeriod, localDeals, contactsById, biensById])

  // Map stage → deals filtrés (évite 8 .filter() inline par render).
  const dealsByStage = useMemo(() => {
    const map = new Map<StageId, CrmDeal[]>()
    for (const stage of CRM_STAGE_ORDER) map.set(stage, [])
    for (const d of filteredDeals) {
      const arr = map.get(d.stage)
      if (arr) arr.push(d)
    }
    return map
  }, [filteredDeals])
  const filteredByStage = (stage: StageId) => dealsByStage.get(stage) ?? []
  const activeFilters = (filterStages.length > 0 ? 1 : 0) + (filterRisk !== 'all' ? 1 : 0) + (filterPeriod !== 0 ? 1 : 0)
  const resetFilters = () => {
    setFilterStages([]); setFilterRisk('all'); setFilterPeriod(0); setSearch('')
  }

  // ── Actions de carte ────────────────────────────────────────────────
  const handleReassign = (dealId: string, member: { id: string; name: string }) => {
    if (enBanc) { showToast(t('board.toast.reassigned', { name: member.name })); return }
    reassignTx.mutateAsync({ id: dealId, assignedTo: member.id })
      .then(() => showToast(t('board.toast.reassigned', { name: member.name })))
      .catch(() => showToast(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  const handleArchive = (dealId: string) => {
    if (enBanc) { showToast(t('board.toast.archived'), () => setPipeToast(null)); return }
    archiveTx.mutateAsync({ id: dealId, archived: true })
      .then(() => {
        logAudit.mutate({
          category: 'deal', severity: 'info', action: 'Deal archivé',
          entityType: 'deal', entityId: dealId,
        })
        showToast(t('board.toast.archived'), () => {
          void archiveTx.mutateAsync({ id: dealId, archived: false })
          setPipeToast(null)
        })
      })
      .catch(() => showToast(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  const [lostConfirm, setLostConfirm] = useState<string | null>(null)
  const handleMarkLost = (dealId: string) => setLostConfirm(dealId)
  const applyMarkLost = (dealId: string) => {
    setLostConfirm(null)
    const deal = localDeals.find(d => d.id === dealId)
    const fromStage = deal?.stage ?? 'new-lead'
    applyStageMove(dealId, 'lost', {
      onSuccess: () => {
        showToast(t('board.toast.lost'), () => {
          // Undo : restaure l'étape d'origine (le proto laissait le deal en
          // stage 'lost' — un « Annuler » qui n'annule pas ; corrigé).
          applyStageMove(dealId, fromStage)
          setPipeToast(null)
        })
      },
    })
  }
  const handleScheduleVisit = (dealId: string, slot: VisitSlot) => {
    const deal = localDeals.find(d => d.id === dealId)
    if (!deal) return
    // Avance vers « Visite planifiée » seulement si c'est un progrès (jamais de recul).
    const advance = CRM_STAGE_PROBS['visit-scheduled'] > (CRM_STAGE_PROBS[deal.stage] || 0)
    if (advance) applyStageMove(dealId, 'visit-scheduled')
    if (enBanc) { showToast(t('board.toast.visitScheduled', { day: slot.day, time: slot.time })); return }
    // Le créneau devient l'échéance réelle du deal — reminder « visite » persisté
    // (une visite « planifiée » qui ne planifie rien serait une action factice).
    createVisitReminder({
      transactionId: dealId,
      contactId: deal.contactId || null,
      slotAt: slot.at,
      note: t('board.card.visitReminderNote', { day: slot.day, time: slot.time }),
    })
      .then(() => showToast(t('board.toast.visitScheduled', { day: slot.day, time: slot.time })))
      .catch(() => showToast(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  const handleAskAiVisit = (dealId: string) => {
    const deal = localDeals.find(d => d.id === dealId)
    const c = deal ? contactsById.get(deal.contactId) : null
    const name = c ? `${c.firstName} ${c.lastName}` : t('deal.buyer_fallback')
    const b = deal?.bienId ? biensById.get(deal.bienId) : null
    const prompt = b
      ? t('board.card.visitAiPromptWithBien', { name, bien: b.title })
      : t('board.card.visitAiPrompt', { name })
    if (ai.enabled) ai.askAi(prompt)
    else if (deal) openDeal(deal.id)
  }

  // ── Suites naturelles du bento signé ────────────────────────────────
  const signedDealData = signedDeal ? localDeals.find(d => d.id === signedDeal) ?? null : null
  const signedContact = signedDealData ? contactsById.get(signedDealData.contactId) ?? null : null
  const finishSigned = () => {
    // Hygiène : un deal gagné ne garde pas de relances actives (Focus/Calendrier).
    if (signedDeal && !enBanc) cancelReminders.mutateAsync(signedDeal).catch(() => {})
    setSignedDeal(null)
  }
  const reopenSigned = () => {
    if (!signedDeal) return
    const dealId = signedDeal
    setSignedDeal(null)
    setPendingWon(prev => { const n = new Set(prev); n.delete(dealId); return n })
    if (!enBanc) updateStatus.mutateAsync({ id: dealId, status: 'active' }).catch(() => {})
    applyStageMove(dealId, 'interest-confirmed')
  }
  const congratsSigned = () => {
    const name = signedContact ? signedContact.firstName : null
    const b = signedDealData?.bienId ? biensById.get(signedDealData.bienId) : null
    const dealId = signedDeal
    finishSigned()
    const prompt = b
      ? t('board.sign.congratsPromptWithBien', { name: name ?? t('deal.buyer_fallback'), bien: b.title })
      : t('board.sign.congratsPrompt', { name: name ?? t('deal.buyer_fallback') })
    if (ai.enabled) ai.askAi(prompt)
    else if (signedContact) go(`/dashboard/contacts/${signedContact.id}`)
    else if (dealId) openDeal(dealId)
  }

  // ── Nav (partagé avec Today) ────────────────────────────────────────
  const onCmd = () => window.alert(t('board.commandPaletteComingSoon'))
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     go('/dashboard'); break
      case 'pipeline':  go('/dashboard/pipeline'); break
      case 'matching':  go('/dashboard/matching'); break
      case 'contacts':  go('/dashboard/contacts'); break
      case 'biens':     go('/dashboard/listings'); break
      case 'biens-new': go('/dashboard/listings/new'); break
      case 'calendar':  go('/dashboard/calendar'); break
      case 'kyc':       go('/dashboard/kyc'); break
      case 'ai':
      case 'julien':    go('/dashboard/julien'); break
      case 'dashboard': go('/dashboard/analytics'); break
      case 'settings':  go('/dashboard/settings'); break
      default: break
    }
  }

  // ── Poignées offertes au banc ───────────────────────────────────────
  // Ce sont celles de l'agent, pas des raccourcis : « perdu » passe par le même
  // `setLostConfirm` que le menu de carte, « signé » par le même `setSignedDeal`
  // que la fin de la célébration. Le banc n'ouvre rien que l'écran n'ouvre.
  const bancGestes = useMemo<PipelineBancGestes>(() => ({
    ouvrirNouveauDeal: () => { setNewDealPrefill(null); setNewDealOpen(true) },
    ouvrirPerdu: (dealId) => setLostConfirm(dealId),
    ouvrirSigne: (dealId) => setSignedDeal(dealId),
    ouvrirInline: (stage) => setInlineStage(stage),
    fermerTout: () => {
      setNewDealOpen(false); setLostConfirm(null); setSignedDeal(null); setInlineStage(null)
    },
  }), [])

  // ── État vide partagé (2 variantes) ─────────────────────────────────
  const pipeHasAnyActive = localDeals.some(d => !d.archived && !d.won && d.stage !== 'lost')
  const pipeEmptyCard = (
    <div style={{
      pointerEvents: 'auto', textAlign: 'center', background: sp.cardBg, borderRadius: 22,
      boxShadow: sp.shadow, padding: '34px 46px', maxWidth: 380,
      animation: 'sugar-fade-up .4s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: sp.ink }}>
        {pipeHasAnyActive ? t('board.emptyState.filtered.title') : t('board.emptyState.none.title')}
      </div>
      <p style={{ margin: '9px 0 0', fontSize: 13, fontWeight: 500, color: sp.ink, lineHeight: 1.55 }}>
        {pipeHasAnyActive ? t('board.emptyState.filtered.body') : t('board.emptyState.none.body')}
      </p>
      <button
        onClick={pipeHasAnyActive ? resetFilters : () => { setNewDealPrefill(null); setNewDealOpen(true) }}
        style={{
          marginTop: 20, height: 42, padding: '0 22px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: sp.accent, color: sp.accentInk, fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
        }}>{pipeHasAnyActive ? t('board.emptyState.filtered.cta') : t('new_deal')}</button>
    </div>
  )

  return (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        .sgPipeBoard{scrollbar-width:thin;scrollbar-color:${sp.cardBorder} transparent}
        .sgPipeBoard::-webkit-scrollbar{width:10px;height:10px}
        .sgPipeBoard::-webkit-scrollbar-track{background:transparent}
        .sgPipeBoard::-webkit-scrollbar-thumb{background:${sp.cardBorder};border-radius:999px;border:3px solid transparent;background-clip:padding-box}
        .sgPipeBoard::-webkit-scrollbar-corner{background:transparent}
      `}</style>

      <SugarTopNav active="pipeline" sp={sp} onNavigate={onNavigate} onCmd={onCmd} dark={dark} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="pipeline" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          {/* Grand cadre bento mono-page — clippe le corps du pipeline */}
          <div style={{
            position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
            border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow,
          }}>
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              background: sp.pageBg, color: sp.ink,
              padding: '30px 34px 22px', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              {/* En-tête : titre · recherche · Filtres · vues · Nouveau deal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexShrink: 0 }}>
                <h1 style={{
                  margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: -1.1,
                  color: sp.ink, lineHeight: 1, marginRight: 4,
                }}>{t('title')}</h1>
                <div style={{ flex: 1 }} />
                <div style={{
                  flex: '0 1 320px', minWidth: 170, height: 40, padding: '0 16px',
                  background: sp.cardBg, borderRadius: 999, boxShadow: sp.shadowSm,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <MEIcon name="search" size={14} color={sp.sub} />
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={t('board.searchPlaceholder')}
                    style={{
                      flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
                      color: sp.ink, fontSize: 13, fontFamily: 'inherit',
                    }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{
                      background: 'none', border: 0, cursor: 'pointer',
                      color: sp.sub, fontFamily: 'inherit', fontSize: 16,
                    }}>×</button>
                  )}
                </div>
                <SugarFilterPill sp={sp} dark={dark} label={t('board.filter.label')}
                  value={activeFilters > 0 ? String(activeFilters) : t('board.filter.none')}
                  active={activeFilters > 0}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(170px,1fr)',
                    gap: 22, maxHeight: 'min(64vh, 540px)', overflowY: 'auto',
                  }}>
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                        color: sp.sub, padding: '2px 4px 8px',
                      }}>{t('filter.stage')}</div>
                      <SugarStageFilter sp={sp} dark={dark} value={filterStages} onChange={setFilterStages} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                        color: sp.sub, padding: '2px 4px 8px',
                      }}>{t('board.filter.riskHeader')}</div>
                      <SugarRiskFilter sp={sp} dark={dark} value={filterRisk} onChange={setFilterRisk} />
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                        color: sp.sub, padding: '16px 4px 8px',
                      }}>{t('board.filter.periodHeader')}</div>
                      <SugarPeriodFilter sp={sp} dark={dark} value={filterPeriod} onChange={setFilterPeriod} />
                    </div>
                  </div>
                  {activeFilters > 0 && (
                    <button onClick={resetFilters} style={{
                      marginTop: 10, padding: '8px 4px', borderRadius: 10, border: 0, cursor: 'pointer',
                      background: 'transparent', color: sp.sub, fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                      textDecoration: 'underline', textUnderlineOffset: 2,
                    }}>{t('board.filter.resetAll')}</button>
                  )}
                </SugarFilterPill>
                <SugarSegmentedView sp={sp} value={view} onChange={setView} />
                <button onClick={() => { setNewDealPrefill(null); setNewDealOpen(true) }} style={{
                  height: 40, padding: '0 20px', borderRadius: 999, border: 0,
                  background: sp.accent, color: sp.accentInk, fontWeight: 700, fontSize: 13,
                  fontFamily: 'inherit', cursor: 'pointer', boxShadow: sp.focusShadow,
                  display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                }}>{t('new_deal')}</button>
              </div>

              {/* Bandeau d'erreur NON bloquant — le board garde ses colonnes affichées. */}
              {pipelineError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14,
                  background: sp.cardBg, boxShadow: sp.shadowSm, color: sp.ink, marginBottom: 12, flexShrink: 0,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{t('board.error.title')}</div>
                    <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>{t('board.error.message')}</div>
                  </div>
                  <button
                    onClick={() => pipelineRefetch()}
                    style={{
                      height: 30, padding: '0 14px', borderRadius: 999, background: 'transparent',
                      color: sp.ink, border: `1px solid ${sp.cardBorder}`, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>{t('board.error.retry')}</button>
                </div>
              )}

              {/* Board — kanban (scroll horizontal interne) ou liste */}
              <div
                ref={scrollRef}
                onDragOver={onBoardDragOver}
                className="sgPipeBoard"
                style={{
                  position: 'relative', flex: 1, minHeight: 0,
                  overflowY: view === 'kanban' ? 'hidden' : 'auto', overflowX: 'auto',
                  overscrollBehavior: 'contain',
                }}
              >
                {/* Masqué pendant une création inline : la carte d'état vide
                    (pointerEvents:auto) volerait les clics du formulaire. */}
                {view === 'kanban' && filteredDeals.length === 0 && !inlineStage && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    zIndex: 5, pointerEvents: 'none',
                  }}>{pipeEmptyCard}</div>
                )}
                {view === 'kanban' && (
                  <div style={{ display: 'flex', gap: 14, paddingBottom: 8, height: '100%' }}>
                    {CRM_STAGE_ORDER.map(stage => (
                      <SugarStageColumn
                        key={stage} stage={stage}
                        deals={filteredByStage(stage)}
                        sp={sp} dark={dark}
                        onOpenDeal={openDeal}
                        draggingId={draggingId}
                        signingId={signingId} signExit={signExit}
                        dragOver={dragOverStage === stage}
                        onDragOver={() => handleDragOver(stage)}
                        onDrop={() => handleDrop(stage)}
                        onDragLeave={() => dragOverStage === stage && setDragOverStage(null)}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onInlineOpen={() => setInlineStage(stage)}
                        inlineForm={inlineStage === stage ? (
                          <SgInlineNewDeal
                            stage={stage} sp={sp} dark={dark}
                            banc={banc?.creation}
                            onCancel={() => setInlineStage(null)}
                            onCreated={(txId) => {
                              setInlineStage(null)
                              // Undo = ranger le deal créé par erreur (pas de DELETE
                              // client : archived_at préserve l'audit) + annuler sa relance.
                              showToast(t('board.toast.created'), () => {
                                if (!enBanc) {
                                  void archiveTx.mutateAsync({ id: txId, archived: true })
                                  cancelReminders.mutateAsync(txId).catch(() => {})
                                }
                                setPipeToast(null)
                              })
                            }}
                            onMore={(prefill) => {
                              setInlineStage(null)
                              setNewDealPrefill(prefill)
                              setNewDealOpen(true)
                            }}
                          />
                        ) : null}
                        onReassign={handleReassign} onArchive={handleArchive} onMarkLost={handleMarkLost}
                        onScheduleVisit={handleScheduleVisit} onAskAiVisit={handleAskAiVisit}
                      />
                    ))}
                  </div>
                )}
                {view === 'list' && (
                  filteredDeals.length === 0
                    ? <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>{pipeEmptyCard}</div>
                    : <PipelineList sp={sp} dark={dark} deals={filteredDeals} onOpenDeal={openDeal} />
                )}
                {view === 'timeline' && (
                  filteredDeals.length === 0
                    ? <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>{pipeEmptyCard}</div>
                    : (
                      <PipelineTimeline
                        sp={sp} dark={dark} deals={filteredDeals} onOpenDeal={openDeal}
                        onReschedule={async (reminderId, triggerAtIso) => {
                          if (enBanc) return
                          try {
                            await rescheduleReminder.mutateAsync({ id: reminderId, triggerAt: triggerAtIso })
                          } catch (e) {
                            showToast(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
                            throw e
                          }
                        }}
                      />
                    )
                )}
              </div>
            </div>

            {/* Modale « Nouveau deal » — plein cadre, confinée au bento (comme le
                fixed du proto contenu par le transform du pager). */}
            <NewDealModal
              open={newDealOpen}
              onClose={() => setNewDealOpen(false)}
              sp={sp} dark={dark}
              prefill={newDealPrefill}
              banc={banc?.creation}
            />
          </div>
        </main>
      </div>

      {/* Overlays */}
      {lostConfirm && (() => {
        const d = localDeals.find(x => x.id === lostConfirm)
        const c = d ? contactsById.get(d.contactId) : null
        return (
          <LostConfirmModal
            sp={sp} dark={dark}
            contactName={c ? `${c.firstName} ${c.lastName}` : null}
            onCancel={() => setLostConfirm(null)}
            onConfirm={() => applyMarkLost(lostConfirm)}
          />
        )
      })()}

      {pipeToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#0B0C0E', color: '#fff', padding: '13px 16px 13px 20px', borderRadius: 999,
          fontSize: 13, fontWeight: 600, zIndex: 240,
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,.28)', animation: 'sugar-toast .2s ease-out',
        }}>
          <span>{pipeToast.message}</span>
          {pipeToast.undo && (
            <button onClick={pipeToast.undo} style={{
              background: 'rgba(255,255,255,.14)', color: '#fff', border: 0, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
            }}>{t('board.toast.undo')}</button>
          )}
        </div>
      )}

      {signedDeal && (
        <SignedBento
          sp={sp} dark={dark}
          firstName={signedContact?.firstName ?? null}
          onScheduleAct={() => { finishSigned(); go('/dashboard/calendar') }}
          onCongrats={congratsSigned}
          onOpenFile={() => { const id = signedDeal; finishSigned(); if (id) openDeal(id) }}
          onReopen={reopenSigned}
          onFinish={finishSigned}
        />
      )}

      {banc?.Chrome ? <banc.Chrome dark={dark} gestes={bancGestes} /> : null}
    </div>
  )
}
