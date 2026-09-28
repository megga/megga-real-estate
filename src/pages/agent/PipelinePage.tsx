/**
 * MEGGA CRM — le Pipeline à CINQ PHASES (route /dashboard/pipeline, bureau ; le téléphone a son
 * propre écran, `MobilePipelinePage`). Refonte du 27.09.2026, qui a remplacé le Pipeline v2
 * « Sugar Pure » et ses huit colonnes d'étape.
 *
 * Deux vues, deux questions :
 *   · Kanban — OÙ en est chaque affaire ? Cinq phases qui tiennent à l'écran (`phases.ts`),
 *     une carte à l'identité d'abord (`AffaireCard`), « Conclu » et « Perdu » en zones de dépôt ;
 *   · Timeline — QUAND agir ? Une grille fixe de quatorze jours (`PipelineAgenda`).
 *
 * ⚠ CE QUI N'Y EST PLUS, et c'est voulu : la vue Liste (elle ne répondait à aucune question que
 * ces deux-là ne couvrent), le panneau de filtres (le filtre d'étapes doublait les colonnes, celui
 * de risque triait sur ce que les cartes n'affichaient pas), la colonne « Signé ».
 *
 * ⚠ LE MOTEUR EST CELUI DE LA PRODUCTION : `usePipelineScreen`, les mêmes mutations, les mêmes
 * modales (nouveau deal, perdu, suites de la signature). Seuls l'agencement et les cartes changent.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import EtatVide from '@/components/crm/EtatVide'
import MEIcon from '@/components/propertyx/MEIcon'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import { usePipelineScreen } from '@/hooks/usePipelineScreen'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useTeamMembers } from '@/hooks/useTeam'
import { useArchiveTransaction, useReassignTransaction, useUpdateTransactionStatus } from '@/hooks/useTransactions'
import {
  useCancelTransactionReminders, useCompleteReminder, usePipelineReminderCreators, useRescheduleReminder,
} from '@/hooks/usePipelineNextActions'
import { mapStage } from '@/lib/crmAdapters'
import type { TransactionStage } from '@/lib/constants'
import { useCrmDarkPref } from '@/lib/crmDark'
import { crmPalette } from '@/components/crm/tokens'
import type { CrmDeal } from '@/components/crm/mockData'
import { AffaireCard } from '@/components/crm/pipeline/AffaireCard'
import { CapsuleToast } from '@/components/crm/pipeline/CapsuleToast'
import type { VisitSlot } from '@/components/crm/pipeline/CardQuickActions'
import { CrmInlineNewDeal } from '@/components/crm/pipeline/CrmInlineNewDeal'
import { LostConfirmModal } from '@/components/crm/pipeline/LostConfirmModal'
import { MenuContextuel } from '@/components/crm/pipeline/MenuContextuel'
import { menuNatifVoulu, type EntreeMenu, type MenuOuvert } from '@/components/crm/pipeline/menuClicDroit'
import { NouvelleAffaireModal, type NewDealPrefill } from '@/components/crm/pipeline/NouvelleAffaireModal'
import { PhaseColumn } from '@/components/crm/pipeline/PhaseColumn'
import { PipelineAgenda } from '@/components/crm/pipeline/PipelineAgenda'
import { SegmentedView, type VuePipeline } from '@/components/crm/pipeline/SegmentedView'
import { ClotureAffaire } from '@/components/crm/pipeline/ClotureAffaire'
import { ZonesDeSortie, type Sortie } from '@/components/crm/pipeline/ZonesDeSortie'
import { PHASES, phaseDe, stadeDEntree, stadeDuDeal, type PhaseId } from '@/components/crm/pipeline/phases'
import { creneauxDeVisite, echeanceDans, joursProposes, type Arrivee } from '@/components/crm/pipeline/affaire'
import { ton } from '@/components/crm/pipeline/tons'


export default function PipelinePage() {
  const { t, i18n } = useTranslation('pipeline')
  const navigate = useNavigate()
  const ai = useAiPanel()
  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark)

  // ⚠ La clé est celle de l'écran d'avant, qui rangeait aussi « list » : un onglet ouvert avant
  // le 27.09.2026 peut la porter encore, et il retombe sur le Kanban.
  const [vueRangee, setVue] = useTabScopedState<string>('vue', 'kanban')
  const vue: VuePipeline = vueRangee === 'timeline' ? 'timeline' : 'kanban'
  const [recherche, setRecherche] = useTabScopedState('recherche', '')
  // La fiche d'AFFAIRE proposée (`FicheAffaire`), à côté de la fiche d'avant : le banc lit `?v=`.
  const openDeal = (id: string) => navigate(`/dashboard/transactions/${id}`)

  const live = usePipelineScreen()
  const { contactsById, biensById, updateStage } = live
  const updateStatus = useUpdateTransactionStatus()
  const archiveTx = useArchiveTransaction()
  const reassignTx = useReassignTransaction()
  const { createVisitReminder, createNextAction } = usePipelineReminderCreators()
  const cancelReminders = useCancelTransactionReminders()
  const rescheduleReminder = useRescheduleReminder()
  const terminerAction = useCompleteReminder()
  const logAudit = useLogAudit()

  // ── Surcouches optimistes : le stade posé, le « conclu » — le temps que la base réponde. ──
  const [enAttente, setEnAttente] = useState<Map<string, TransactionStage>>(() => new Map())
  const [conclus, setConclus] = useState<Set<string>>(() => new Set())
  const poser = (id: string, stade: TransactionStage | null) => setEnAttente((prev) => {
    const n = new Map(prev)
    if (stade === null) n.delete(id); else n.set(id, stade)
    return n
  })

  const deals = useMemo<CrmDeal[]>(() => live.deals.map((d) => {
    const s = enAttente.get(d.id)
    const won = conclus.has(d.id) || d.won
    if (!s && won === d.won) return d
    return { ...d, dbStage: s ?? d.dbStage, stage: s ? mapStage(s) : d.stage, won }
  }), [live.deals, enAttente, conclus])

  // ── Toast (unique, 5 s, « Annuler » optionnel) — le même que le board d'avant. ──
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montrer = (message: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, undo })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const nomDe = (d: CrmDeal) => {
    const c = contactsById.get(d.contactId)
    return c ? `${c.firstName} ${c.lastName}` : d.id
  }

  /** Change le stade d'un deal : surcouche, écriture, journal — le journal SEULEMENT si la base a dit oui. */
  const deplacer = (d: CrmDeal, stade: TransactionStage, opts?: { apres?: () => void; echec?: () => void }) => {
    const de = stadeDuDeal(d)
    poser(d.id, stade)
    updateStage.mutate({ id: d.id, stage: stade }, {
      onSuccess: () => {
        logAudit.mutate({
          category: 'deal', severity: 'info', action: 'Étape changée', entityType: 'deal', entityId: d.id,
          objectLabel: nomDe(d), metadata: { from: mapStage(de), to: mapStage(stade) },
        })
        opts?.apres?.()
      },
      onError: () => { montrer(t('board.toast.moveFailedTitle')); opts?.echec?.() },
      onSettled: () => poser(d.id, null),
    })
  }

  // ── « Conclu » : la célébration (1 050 / 1 750 ms), puis les suites de la signature. ──
  const [signant, setSignant] = useState<string | null>(null)
  const [sortieSignant, setSortieSignant] = useState(false)
  const [signe, setSigne] = useState<string | null>(null)
  const minuteries = useRef<ReturnType<typeof setTimeout>[]>([])
  const annulerCelebration = () => {
    minuteries.current.forEach(clearTimeout); minuteries.current = []
    setSignant(null); setSortieSignant(false)
  }
  useEffect(() => () => { minuteries.current.forEach(clearTimeout) }, [])
  const conclure = (d: CrmDeal) => {
    annulerCelebration()
    setSignant(d.id)
    // Le stade « Signé », puis le statut « conclu » : l'ordre de la base, et celui du board d'avant.
    if (stadeDuDeal(d) !== 'signed') deplacer(d, 'signed', { echec: annulerCelebration })
    minuteries.current.push(setTimeout(() => setSortieSignant(true), 1050))
    minuteries.current.push(setTimeout(() => {
      setConclus((prev) => new Set(prev).add(d.id))
      updateStatus.mutateAsync({ id: d.id, status: 'completed' }).catch(() => {
        setConclus((prev) => { const n = new Set(prev); n.delete(d.id); return n })
        montrer(t('board.toast.moveFailedTitle'))
      })
      setSignant(null); setSortieSignant(false); setSigne(d.id)
    }, 1750))
  }

  // ── « Perdu » : la confirmation, puis « Annuler » qui RESTAURE le stade d'origine. ──
  const [perdu, setPerdu] = useState<string | null>(null)
  const confirmerPerdu = (id: string) => {
    setPerdu(null)
    const d = deals.find((x) => x.id === id)
    if (!d) return
    const origine = stadeDuDeal(d)
    deplacer(d, 'lost', {
      apres: () => montrer(t('board.toast.lost'), () => { deplacer({ ...d, dbStage: 'lost' }, origine); setToast(null) }),
    })
  }

  // ── Glisser-déposer ──
  const [glisseId, setGlisseId] = useState<string | null>(null)
  const [survolPhase, setSurvolPhase] = useState<PhaseId | null>(null)
  const [survolSortie, setSurvolSortie] = useState<Sortie | null>(null)
  const finGlisser = () => { setGlisseId(null); setSurvolPhase(null); setSurvolSortie(null) }
  const deposerPhase = (p: PhaseId) => {
    const d = deals.find((x) => x.id === glisseId)
    finGlisser()
    if (!d || phaseDe(stadeDuDeal(d)) === p) return
    deplacer(d, stadeDEntree(p))
  }
  const deposerSortie = (s: Sortie) => {
    const d = deals.find((x) => x.id === glisseId)
    finGlisser()
    if (!d) return
    if (s === 'conclu') conclure(d); else setPerdu(d.id)
  }

  // ── Actions de carte (menu au survol) — celles de la production. ──
  const reassigner = (id: string, m: { id: string; name: string }) => {
    reassignTx.mutateAsync({ id, assignedTo: m.id })
      .then(() => montrer(t('board.toast.reassigned', { name: m.name })))
      .catch(() => montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  const archiver = (id: string) => {
    archiveTx.mutateAsync({ id, archived: true })
      .then(() => {
        logAudit.mutate({ category: 'deal', severity: 'info', action: 'Deal archivé', entityType: 'deal', entityId: id })
        montrer(t('board.toast.archived'), () => { void archiveTx.mutateAsync({ id, archived: false }); setToast(null) })
      })
      .catch(() => montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  /** Un deal vient de naître : on le dit, on le montre, et une erreur de saisie se range d'un geste. */
  const [nouveauId, setNouveauId] = useState<string | null>(null)
  const nouveauTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (nouveauTimer.current) clearTimeout(nouveauTimer.current) }, [])
  // L'affaire que « Nouveau deal » est en train d'écrire : sa carte attend, cachée, que la modale
  // se retire. Sans mouvement demandé, elle paraît simplement.
  const [attenteId, setAttenteId] = useState<string | null>(null)
  const reduit = useReducedMotion()
  const arriveeDe = (id: string): Arrivee | undefined =>
    reduit ? undefined : id === attenteId ? 'attente' : id === nouveauId ? 'atterrit' : undefined
  const annoncerCree = (txId: string) => {
    setAttenteId(null)
    setNouveauId(txId)
    if (nouveauTimer.current) clearTimeout(nouveauTimer.current)
    nouveauTimer.current = setTimeout(() => setNouveauId(null), 2400)
    montrer(t('board.toast.created'), () => {
      void archiveTx.mutateAsync({ id: txId, archived: true })
      cancelReminders.mutateAsync(txId).catch(() => {})
      setToast(null)
    })
  }
  const planifierVisite = (id: string, slot: VisitSlot) => {
    const d = deals.find((x) => x.id === id)
    if (!d) return
    const ici = phaseDe(stadeDuDeal(d))
    // Vers « Visites » seulement si c'est un progrès : jamais de recul.
    if (ici === 'prospects' || ici === 'recherche') deplacer(d, 'visit_planned')
    createVisitReminder({
      transactionId: id, contactId: d.contactId || null, slotAt: slot.at,
      note: t('board.card.visitReminderNote', { day: slot.day, time: slot.time }),
    })
      .then(() => montrer(t('board.toast.visitScheduled', { day: slot.day, time: slot.time })))
      .catch(() => montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') })))
  }
  const demanderIaVisite = (id: string) => {
    const d = deals.find((x) => x.id === id)
    const b = d?.bienId ? biensById.get(d.bienId) : null
    const name = d ? nomDe(d) : t('deal.buyer_fallback')
    const prompt = b ? t('board.card.visitAiPromptWithBien', { name, bien: b.title }) : t('board.card.visitAiPrompt', { name })
    if (ai.enabled) ai.askAi(prompt); else if (d) openDeal(d.id)
  }

  // ── Le clic droit (`MenuContextuel`) : une affaire, une colonne, le fond — comme un navigateur. ──
  const onglets = useCrmTabsOptionnel()
  const { data: membres = [] } = useTeamMembers()
  const champRecherche = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<MenuOuvert | null>(null)
  const ouvrirMenu = (e: React.MouseEvent, libelle: string, entrees: EntreeMenu[]) => {
    // Un champ, un lien, du texte sélectionné ou ⇧ : le menu du navigateur.
    if (menuNatifVoulu(e) || entrees.length === 0) return
    e.preventDefault(); e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, libelle, entrees })
  }
  const echec = () => montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
  /** Replanifie (ou planifie) l'action dans N jours, l'heure gardée — la règle de la fiche et de la Timeline. */
  const planifierDans = (d: CrmDeal, jours: number) => {
    const na = d.nextAction
    const quand = echeanceDans(jours, na?.dueAt ?? null)
    if (na?.reminderId) {
      rescheduleReminder.mutateAsync({ id: na.reminderId, triggerAt: quand.toISOString() })
        .then(() => montrer(t('fiche.toast.replanifiee'))).catch(echec)
    } else {
      createNextAction({ transactionId: d.id, contactId: d.contactId || null, kind: 'call', at: quand, note: t('phases.agenda.relance') })
        .then(() => montrer(t('fiche.toast.planifiee'))).catch(echec)
    }
  }
  const copierLien = (chemin: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${chemin}`).then(() => montrer(t('menu.lienCopie'))).catch(echec)
  }
  /** Le menu d'une AFFAIRE — la carte du Kanban comme la ligne de la Timeline. */
  const entreesAffaire = (d: CrmDeal): EntreeMenu[] => {
    const na = d.nextAction
    const ici = phaseDe(stadeDuDeal(d))
    const lien = `/dashboard/transactions/${d.id}`
    const equipe = membres.filter((m) => m.id !== d.ownerAgentId)
    const e: EntreeMenu[] = [{ genre: 'action', cle: 'ouvrir', icone: 'arrow-right', libelle: t('menu.ouvrir'), onChoisir: () => openDeal(d.id) }]
    if (onglets) e.push({ genre: 'action', cle: 'onglet', icone: 'external', libelle: t('menu.nouvelOnglet'), onChoisir: () => onglets.ouvrirDans(lien) })
    e.push({ genre: 'separateur', cle: 's-action' })
    if (na?.reminderId) {
      const id = na.reminderId
      e.push({ genre: 'action', cle: 'fait', icone: 'check', libelle: t('menu.actionFaite'), onChoisir: () => { terminerAction.mutateAsync(id).then(() => montrer(t('fiche.toast.fait'))).catch(echec) } })
    }
    e.push({
      genre: 'sous-menu', cle: 'quand', icone: 'calendar', libelle: na ? t('fiche.replanifier') : t('fiche.planifier'),
      entrees: joursProposes(!na).map((c) => ({
        genre: 'action', cle: c.cle, libelle: c.cle === 'aujourdhui' ? t('board.card.today') : t(`fiche.quand.${c.cle}`),
        onChoisir: () => planifierDans(d, c.jours),
      })),
    })
    e.push({
      genre: 'sous-menu', cle: 'visite', icone: 'home', libelle: t('board.card.scheduleVisit'),
      entrees: creneauxDeVisite(i18n.language, t('board.card.tomorrow')).map((s) => ({
        genre: 'action', cle: s.label, libelle: `${s.day} · ${s.time}`, onChoisir: () => planifierVisite(d.id, s),
      })),
    })
    e.push({ genre: 'separateur', cle: 's-place' })
    e.push({
      genre: 'sous-menu', cle: 'deplacer', icone: 'pipeline', libelle: t('menu.deplacer'),
      entrees: PHASES.map((p) => ({
        genre: 'action', cle: p.id, pastille: p.teinte, libelle: t(`phases.noms.${p.id}`), coche: p.id === ici,
        onChoisir: () => deplacer(d, stadeDEntree(p.id)),
      })),
    })
    if (equipe.length > 0) {
      e.push({
        genre: 'sous-menu', cle: 'reassigner', icone: 'users', libelle: t('board.card.reassign'),
        entrees: equipe.map((m) => ({ genre: 'action', cle: m.id, icone: 'user', libelle: m.full_name, onChoisir: () => reassigner(d.id, { id: m.id, name: m.full_name }) })),
      })
    }
    e.push({ genre: 'separateur', cle: 's-liens' })
    e.push({ genre: 'action', cle: 'contact', icone: 'user', libelle: t('menu.ouvrirContact'), onChoisir: () => navigate(`/dashboard/contacts/${d.contactId}`) })
    if (d.bienId) e.push({ genre: 'action', cle: 'bien', icone: 'building', libelle: t('fiche.ouvrirBien'), onChoisir: () => navigate(`/dashboard/listings/${d.bienId}`) })
    e.push({ genre: 'action', cle: 'lien', icone: 'copy', libelle: t('menu.copierLien'), onChoisir: () => copierLien(lien) })
    e.push({ genre: 'separateur', cle: 's-sortie' })
    e.push({ genre: 'action', cle: 'conclu', icone: 'check-circle', teinte: ton('conclu', sp).encre, libelle: t('menu.marquerConclu'), onChoisir: () => conclure(d) })
    e.push({ genre: 'action', cle: 'perdu', icone: 'close-circle', danger: true, libelle: t('board.card.markLost'), onChoisir: () => setPerdu(d.id) })
    e.push({ genre: 'action', cle: 'archiver', icone: 'download', libelle: t('board.card.archive'), onChoisir: () => archiver(d.id) })
    return e
  }
  /** Le menu du FOND — une colonne (sa phase préremplie dans « Nouveau deal »), ou la Timeline. */
  const entreesFond = (p?: PhaseId): EntreeMenu[] => [
    // « Signature » ne se crée pas à la main : on y arrive par une offre acceptée.
    ...(p === 'signature' ? [] : [{
      genre: 'action' as const, cle: 'nouveau', icone: 'plus' as const, libelle: t('new_deal'),
      onChoisir: () => { setPrefill(p ? { stage: mapStage(stadeDEntree(p)) } : null); setNouveauOuvert(true) },
    }]),
    { genre: 'action', cle: 'rechercher', icone: 'search', libelle: t('menu.rechercher'), onChoisir: () => champRecherche.current?.focus() },
    { genre: 'separateur', cle: 's-vue' },
    vue === 'kanban'
      ? { genre: 'action', cle: 'vue', icone: 'calendar', libelle: t('menu.vueTimeline'), onChoisir: () => setVue('timeline') }
      : { genre: 'action', cle: 'vue', icone: 'pipeline', libelle: t('menu.vueKanban'), onChoisir: () => setVue('kanban') },
  ]

  // ── Création ──
  const [ajoutPhase, setAjoutPhase] = useState<PhaseId | null>(null)
  const [nouveauOuvert, setNouveauOuvert] = useState(false)
  // Le cadre de la page : « Nouveau deal » et « Perdu » s'y montent, et leur flou n'en déborde pas.
  const [cadre, setCadre] = useState<HTMLDivElement | null>(null)
  const [prefill, setPrefill] = useState<NewDealPrefill | null>(null)

  // ── La clôture : ce qui suit « Conclu » (`ClotureAffaire`) ──
  const dealSigne = signe ? deals.find((d) => d.id === signe) ?? null : null

  // ── Ce que le board montre : hors rangés, conclus et perdus ; la recherche par-dessus. ──
  const actifs = deals.filter((d) => !d.archived && !d.won && phaseDe(stadeDuDeal(d)) !== null && contactsById.has(d.contactId))
  const q = recherche.trim().toLowerCase()
  const visibles = !q ? actifs : actifs.filter((d) => {
    const c = contactsById.get(d.contactId)!
    const b = d.bienId ? biensById.get(d.bienId) : null
    return `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)
      || (b ? `${b.title} ${b.addr}`.toLowerCase().includes(q) : false)
      || (d.nextAction?.note?.toLowerCase().includes(q) ?? false)
  })
  // Dans une colonne, l'urgence d'abord : les échéances les plus proches en haut, les affaires
  // sans action en bas — elles ne s'oublient pas, l'agenda les remonte dans « À planifier ».
  const parPhase = (p: PhaseId) => visibles
    .filter((d) => phaseDe(stadeDuDeal(d)) === p)
    .sort((a, b) => (a.nextAction?.dueAt ?? '9999').localeCompare(b.nextAction?.dueAt ?? '9999'))

  const aucunDeal = !live.isLoading && !live.isError && actifs.length === 0
  const aucunResultat = !aucunDeal && actifs.length > 0 && visibles.length === 0

  return (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="pipeline" sp={sp} dark={dark} setDark={setDark}>
          <main style={{
            flex: 1, minWidth: 0, minHeight: 0, height: '100%',
            padding: 'var(--crm-space-lg) var(--crm-space-7xl) var(--crm-space-6xl) var(--crm-space-lg)',
          }}>
            {/* `data-cadre` : les menus portés des cartes (`CardQuickActions`) se bornent à ce cadre. */}
            <div ref={setCadre} data-cadre="" style={{
              position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
              display: 'flex', flexDirection: 'column',
            }}>
              {/* Barre d'outils : recherche · deux vues · nouveau deal. Plus de panneau de filtres.
                  ⛔ PLUS DE TITRE VISIBLE (Julien, 27.09.2026 : « inutile », « plus épuré ») : la
                  barre latérale et l'onglet disent déjà « Pipeline », et les 34 px du titre
                  poussaient le board vers le bas. Il reste pour les lecteurs d'écran — une page
                  sans titre de niveau 1 ne s'annonce plus. */}
              <h1 style={{
                position: 'absolute', width: 1, height: 1, overflow: 'hidden', whiteSpace: 'nowrap',
                clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', margin: 0,
              }}>{t('title')}</h1>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexShrink: 0,
                padding: 'var(--crm-space-4xl) var(--crm-space-7xl) var(--crm-space-2xl)',
              }}>
                <div style={{
                  flex: '0 1 360px', minWidth: 170, height: 40, padding: '0 var(--crm-space-2xl)',
                  background: sp.cardBg, borderRadius: 'var(--crm-radius-pill)',
                  // En sombre l'ombre vaut 'none' et la surface EST le canvas : sans filet, le champ
                  // n'avait plus de bord — un texte gris posé sur le fond.
                  boxShadow: sp.isDark ? `inset 0 0 0 1px ${sp.cardBorder}` : sp.shadowSm,
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                }}>
                  <MEIcon name="search" size={14} color={sp.sub} />
                  <input
                    ref={champRecherche}
                    value={recherche} onChange={(e) => setRecherche(e.target.value)}
                    placeholder={t('board.searchPlaceholder')}
                    style={{
                      flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
                      color: sp.ink, fontSize: 'var(--crm-text-md)', fontFamily: 'inherit',
                    }}
                  />
                  {recherche && (
                    <button type="button" onClick={() => setRecherche('')} title={t('clear')} style={{
                      background: 'none', border: 0, cursor: 'pointer', color: sp.sub, fontFamily: 'inherit',
                      fontSize: 'var(--crm-text-2xl)', padding: 0,
                    }}>×</button>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <SegmentedView sp={sp} value={vue} onChange={setVue} />
                <button type="button" onClick={() => { setPrefill(null); setNouveauOuvert(true) }} style={{
                  height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                  background: sp.accent, color: sp.accentInk, fontWeight: 600, fontSize: 'var(--crm-text-md)',
                  fontFamily: 'inherit', cursor: 'pointer', boxShadow: sp.focusShadow, whiteSpace: 'nowrap',
                }}>{t('new_deal')}</button>
              </div>

              {/* Un bandeau d'échec, et lui seul : l'ancien board y ajoutait « Créez votre premier deal ». */}
              {live.isError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexShrink: 0,
                  margin: '0 var(--crm-space-7xl) var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)',
                  borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg, boxShadow: sp.shadowSm,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('board.error.title')}</div>
                    <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('board.error.message')}</div>
                  </div>
                  <button type="button" onClick={() => live.refetch()} style={{
                    height: 30, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)',
                    background: 'transparent', color: sp.ink, border: `1px solid ${sp.cardBorder}`, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, flexShrink: 0,
                  }}>{t('board.error.retry')}</button>
                </div>
              )}

              <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' }}>
                {aucunDeal ? (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <div style={{ maxWidth: 380 }}>
                      <EtatVide
                        dark={dark}
                        titre={t('board.emptyState.none.title')}
                        corps={t('board.emptyState.none.body')}
                        action={{ libelle: t('new_deal'), onClick: () => { setPrefill(null); setNouveauOuvert(true) } }}
                      />
                    </div>
                  </div>
                ) : aucunResultat ? (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    {/* Pas de bouton « Effacer » (Julien, 28.09.2026 : « il sert à rien ») : la recherche se vide
                        dans son champ, là où elle s'est écrite. */}
                    <EtatVide dark={dark} titre={t('timeline.emptySearch')} />
                  </div>
                ) : vue === 'kanban' ? (
                  <div style={{ display: 'flex', height: '100%' }}>
                    {PHASES.map((p, i) => {
                      const colonne = parPhase(p.id)
                      const ventes = colonne.reduce((s, d) => {
                        const b = d.bienId ? biensById.get(d.bienId) : null
                        return s + (b?.transaction === 'location' ? 0 : d.value || 0)
                      }, 0)
                      const entree = mapStage(stadeDEntree(p.id))
                      return (
                        <PhaseColumn
                          key={p.id} phase={p} premiere={i === 0} derniere={i === PHASES.length - 1} nombre={colonne.length} totalVentes={ventes}
                          sp={sp} dark={dark}
                          cibleDeDepot={!!glisseId && survolPhase === p.id}
                          onDragOver={() => { if (survolPhase !== p.id) setSurvolPhase(p.id); if (survolSortie) setSurvolSortie(null) }}
                          onDragLeave={() => {}}
                          onDrop={() => deposerPhase(p.id)}
                          onMenu={(e) => ouvrirMenu(e, t(`phases.noms.${p.id}`), entreesFond(p.id))}
                          // « Signature » ne se crée pas à la main : on y arrive par une offre acceptée.
                          onAjouter={p.id === 'signature' ? null : () => setAjoutPhase(p.id)}
                          formulaire={ajoutPhase === p.id ? (
                            <CrmInlineNewDeal
                              stage={entree} sp={sp} dark={dark}
                              onCancel={() => setAjoutPhase(null)}
                              onCreated={(txId) => { setAjoutPhase(null); annoncerCree(txId) }}
                              onMore={(pf) => { setAjoutPhase(null); setPrefill(pf); setNouveauOuvert(true) }}
                            />
                          ) : null}
                        >
                          {colonne.map((d) => (
                            <AffaireCard
                              key={d.id} deal={d} sp={sp} dark={dark}
                              contact={contactsById.get(d.contactId)!}
                              bien={d.bienId ? biensById.get(d.bienId) ?? null : null}
                              isDragging={glisseId === d.id}
                              signing={signant === d.id} signExit={sortieSignant && signant === d.id}
                              onClick={() => openDeal(d.id)}
                              onDragStart={() => setGlisseId(d.id)}
                              onDragEnd={finGlisser}
                              onChangeStade={(s) => deplacer(d, s)}
                              nouvelle={d.id === nouveauId} arrivee={arriveeDe(d.id)}
                              onMenu={(e) => ouvrirMenu(e, nomDe(d), entreesAffaire(d))}
                              onReassign={reassigner} onArchive={archiver} onMarkLost={(id) => setPerdu(id)}
                              onScheduleVisit={planifierVisite} onAskAiVisit={demanderIaVisite}
                            />
                          ))}
                        </PhaseColumn>
                      )
                    })}
                  </div>
                ) : (
                  <PipelineAgenda
                    sp={sp} dark={dark} deals={visibles} contactsById={contactsById} biensById={biensById}
                    onOpenDeal={openDeal}
                    nouveauId={nouveauId} arriveeDe={arriveeDe}
                    onMenuAffaire={(e, d) => ouvrirMenu(e, nomDe(d), entreesAffaire(d))}
                    onMenuFond={(e) => ouvrirMenu(e, t('view.timeline'), entreesFond())}
                    onFait={async (reminderId) => {
                      try { await terminerAction.mutateAsync(reminderId); montrer(t('fiche.toast.fait')) } catch {
                        montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
                      }
                    }}
                    onReschedule={async (reminderId, iso) => {
                      try { await rescheduleReminder.mutateAsync({ id: reminderId, triggerAt: iso }) } catch (e) {
                        montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
                        throw e
                      }
                    }}
                    onPlanifier={async (d, jour) => {
                      try {
                        await createNextAction({
                          transactionId: d.id, contactId: d.contactId || null, kind: 'call', at: jour,
                          note: t('phases.agenda.relance'),
                        })
                      } catch {
                        montrer(t('board.card.actionFailed', { message: t('board.card.unknownError') }))
                      }
                    }}
                  />
                )}
              </div>

              {glisseId && vue === 'kanban' && (
                <ZonesDeSortie
                  sp={sp} survolee={survolSortie} onDepot={deposerSortie}
                  // Au-dessus d'une sortie, plus aucune colonne n'est la cible.
                  onSurvol={(s) => { setSurvolSortie(s); if (s) setSurvolPhase(null) }}
                />
              )}

              <NouvelleAffaireModal
                open={nouveauOuvert} onClose={() => setNouveauOuvert(false)} sp={sp} dark={dark} prefill={prefill}
                onCreated={annoncerCree} onNaissance={setAttenteId} cadre={cadre}
              />
            </div>
          </main>
        </CrmWorkspace>
      </div>

      {perdu && (
        <LostConfirmModal
          sp={sp} dark={dark}
          contactName={(() => { const d = deals.find((x) => x.id === perdu); return d ? nomDe(d) : null })()}
          onCancel={() => setPerdu(null)}
          onConfirm={() => confirmerPerdu(perdu)}
          cadre={cadre}
        />
      )}

      {toast && <CapsuleToast sp={sp} message={toast.message} undo={toast.undo} />}
      {menu && <MenuContextuel sp={sp} menu={menu} onFermer={() => setMenu(null)} />}

      {signe && dealSigne && (
        <ClotureAffaire
          sp={sp} dealId={dealSigne.id} cadre={cadre}
          nom={nomDe(dealSigne) ?? t('deal.buyer_fallback')}
          onFermer={() => setSigne(null)}
          onEnregistree={() => montrer(t('cloture.toast'))}
        />
      )}
    </div>
  )
}
