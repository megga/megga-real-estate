/**
 * Page super-admin — Plans & abonnements (poste de triage — maquette `admin-plans.jsx`).
 *
 * Route : `/dashboard/admin/plans`. La page ne répond plus « où en est cette
 * agence ? » — c'est le travail de la fiche agence — mais « où en est le
 * REVENU ? » : le MRR réel (règle serveur, une seule source), les files qui le
 * menacent (Impayés · Essais qui finissent — une file vide disparaît, les deux
 * vides laissent une ligne calme), le portefeuille en table nue dont chaque
 * ligne ouvre la fiche, et la grille en vigueur en pied.
 *
 * Écarts assumés vis-à-vis de la maquette, tous suspendus à des décisions PO :
 * - la file « Sièges saturés » n'est PAS rendue : le plafond de sièges n'est pas
 *   arbitré (décision n° 4) et le serveur la nomme dans `unavailable`. La
 *   colonne Sièges affiche le compte nu, sans plafond ni jauge — en afficher un
 *   trancherait la question en silence.
 * - le changement de plan RESTE (colonne Actions) : la maquette l'exclut
 *   (« la console NE CHANGE PAS de plan ») mais le retrait d'une capacité
 *   branchée appartient à la décision n° 5 (périmètre à démonter), pas à une
 *   passe UI.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, ChevronDown, ChevronRight } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { PLANS } from '@/lib/plans'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useAdminPlansBoard, type PlansBoardRow } from '@/hooks/useAdminPlansBoard'
import { supabase } from '@/lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/Toast'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminEmpty,
  AdminError,
  AdminGhostBtn,
  AdminIc,
  AdminPill,
  AdminSearchInput,
  AdminSegmentBtn,
  AdminSkeleton,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

/** Pilule d'état d'abonnement : ton + clé i18n par `state` serveur. */
const STATE_META: Record<PlansBoardRow['state'], { tone: AdminToneName; key: string }> = {
  active: { tone: 'ok', key: 'plans.state.active' },
  trial: { tone: 'warn', key: 'plans.state.trial' },
  unpaid: { tone: 'err', key: 'plans.state.unpaid' },
  none: { tone: 'neutral', key: 'plans.state.none' },
}

/** Libellé d'un plan depuis le catalogue (`PLANS`), repli sur la valeur brute. */
function planLabel(plan: string | null): string {
  if (!plan) return '—'
  return PLANS.find(p => p.id === plan.toLowerCase())?.name ?? plan
}

/** Menu de changement de plan d'une agence ; mutation via `admin_set_agency_plan`. */
function PlanChangeDropdown({ currentPlan, agencyId }: { currentPlan: string; agencyId: string }) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { sp, surf } = useAdminSurfaces()

  // Échap ferme le menu. L'écoute est posée sur le DOCUMENT et non sur le voile :
  // un `<div>` sans `tabIndex` n'est jamais focusable, donc le `onKeyDown` qu'il
  // portait ne se déclenchait jamais — Échap était mort sur cet écran. Même motif
  // que `AgencyTargetPicker` (AdminFeatureFlagsPage).
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open])

  const changePlan = useMutation({
    mutationFn: async (newPlan: string) => {
      // La RPC upsert subscriptions avec p_status (défaut 'active') : on lit le
      // statut courant pour ne pas écraser un trialing/past_due existant.
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('agency_id', agencyId)
        .maybeSingle()
      const keepable = ['active', 'trialing', 'past_due', 'canceled']
      const { error } = await supabase.rpc('admin_set_agency_plan', {
        p_agency_id: agencyId,
        p_plan: newPlan,
        p_status: sub?.status && keepable.includes(sub.status) ? sub.status : 'active',
        p_note: 'via AdminPlansPage',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t('plans.changeDone'))
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-plans-board'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-agency-billing'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-billing-stripe'] })
      setOpen(false)
    },
    onError: () => toast.error(t('plans.changeError')),
  })

  const normalized = (currentPlan ?? 'starter').toLowerCase()

  return (
    <div style={{ position: 'relative' }}>
      <AdminGhostBtn
        onClick={() => setOpen(!open)}
        expanded={open}
        hasPopup
        style={{ height: 30, padding: '0 13px', fontSize: 'var(--crm-text-sm)' }}
      >
        {t('admin:plans.changePlan')}
        <AdminIc
          icon={ChevronDown}
          size={13}
          color={sp.sub}
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .18s ease' }}
        />
      </AdminGhostBtn>
      {open && (
        <>
          {/* Voile « clic dehors » seulement : le clavier passe par l'écoute
              document ci-dessus (un div non focusable ne reçoit pas de keydown). */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          {/* Pas de `role="listbox"` ici : les enfants sont des BOUTONS d'action —
              cliquer écrit le plan de l'agence, ce n'est pas la sélection d'une
              valeur dans une liste. Sans enfants `role="option"` le rôle annonçait
              une liste vide, et un rôle faux coûte plus cher que pas de rôle. Les
              `<button>` natifs portent déjà focus et activation clavier ; le plan
              courant est nommé « (actuel) » dans son propre libellé. */}
          <div
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 5, zIndex: 20, minWidth: 152,
              background: surf.card, borderRadius: ADMIN_RADII.card, border: surf.hairline,
              boxShadow: sp.shadow, padding: 6,
            }}
          >
            {PLANS.map(plan => {
              const current = plan.id === normalized
              return (
                <button
                  key={plan.id}
                  // Le fond de repos est déclaré en INLINE (`transparent`) : aucune
                  // règle `:hover` de feuille de style ne peut le battre, sauf en
                  // `!important` — c'est ce que fait `.adm-row` (admin-console.css).
                  // Le plan courant en est exclu : il est désactivé et ne doit pas
                  // se signaler comme cliquable.
                  className={current ? undefined : 'adm-row'}
                  disabled={current || changePlan.isPending}
                  onClick={() => changePlan.mutate(plan.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 12px', borderRadius: ADMIN_RADII.pill, border: 0, background: 'transparent',
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap',
                    color: current ? sp.sub : sp.ink,
                    cursor: current ? 'default' : 'pointer',
                  }}
                >
                  {plan.name}
                  {current && <span style={{ marginLeft: 6, color: sp.sub }}>({t('admin:common.current')})</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** Une file de triage (maquette) : titre + compte, lignes nues, disparaît vide. */
function PlanQueue({ title, rows, dot, amount, onOpen }: {
  title: string
  rows: PlansBoardRow[]
  dot: string
  amount: (row: PlansBoardRow) => string
  onOpen: (row: PlansBoardRow) => void
}) {
  const { sp, surf } = useAdminSurfaces()
  if (rows.length === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '0 2px 8px' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
          {title}
        </h3>
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{rows.length}</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="adm-row"
          onClick={() => onOpen(row)}
          style={{
            display: 'flex', alignItems: 'center', gap: 14, minHeight: 46,
            padding: '0 12px 0 2px', cursor: 'pointer',
            borderTop: i === 0 ? undefined : surf.hairline,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: dot, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>
            {row.name}
          </div>
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.soft, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {amount(row)}
          </span>
          <AdminIc icon={ChevronRight} size={15} color={sp.sub} />
        </div>
      ))}
    </div>
  )
}

/** Vue principale : MRR, files de triage, portefeuille, grille en vigueur. */
export default function AdminPlansPage() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { sp, surf, dark, tones } = useAdminSurfaces()
  const { data: board, isPending, isError, refetch } = useAdminPlansBoard()
  // Jointure d'AFFICHAGE seulement (ville, compte de biens) : aucune règle n'est
  // recalculée ici — le MRR et les états viennent du serveur (§4.3).
  const { agencies } = useAdminAgencies()

  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')

  const extras = useMemo(
    () => new Map(agencies.map(a => [a.id, { city: a.city, properties: a.property_count }])),
    [agencies],
  )

  const portfolio = useMemo(() => board?.portfolio ?? [], [board])

  const rows = useMemo(() => {
    const nq = q.trim().toLowerCase()
    return portfolio
      .filter(r =>
        filter === 'all' ? true
        : filter === 'todo' ? r.state === 'unpaid' || r.state === 'trial'
        : (r.plan ?? '').toLowerCase() === filter)
      .filter(r => {
        if (!nq) return true
        const city = extras.get(r.id)?.city ?? ''
        return r.name.toLowerCase().includes(nq) || city.toLowerCase().includes(nq)
      })
  }, [portfolio, filter, q, extras])

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: portfolio.length,
      todo: portfolio.filter(r => r.state === 'unpaid' || r.state === 'trial').length,
    }
    for (const p of PLANS) c[p.id] = portfolio.filter(r => (r.plan ?? '').toLowerCase() === p.id).length
    return c
  }, [portfolio])

  const seatsTotal = useMemo(() => portfolio.reduce((s, r) => s + Number(r.seats_used || 0), 0), [portfolio])
  const propsTotal = useMemo(
    () => portfolio.reduce((s, r) => s + (extras.get(r.id)?.properties ?? 0), 0),
    [portfolio, extras],
  )

  const openAgency = (row: PlansBoardRow) => navigate(`${ADMIN_CONSOLE_PATH}/agencies/${row.id}`)

  /** Montant menacé d'une ligne de file : le prix CATALOGUE du plan (grille C2),
   *  jamais `row.mrr` — la règle serveur met justement l'impayé et l'essai à zéro. */
  const threatened = (row: PlansBoardRow): string => {
    const monthly = row.plan ? board?.pricing_source?.[row.plan.toLowerCase()]?.monthly : undefined
    if (monthly === undefined || monthly === null) return '—'
    return `${formatCHF(Number(monthly))} ${t('plans.perMonth')}`
  }

  /** Échéance d'une ligne : fin d'essai pour un essai, fin de période sinon. */
  const renewalLabel = (row: PlansBoardRow): string => {
    const iso = row.state === 'trial' ? (row.trial_end ?? row.current_period_end) : row.current_period_end
    if (!iso) return '—'
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    if (sameDay(d, today)) return t('plans.renewal.today')
    if (sameDay(d, tomorrow)) return t('plans.renewal.tomorrow')
    return d.toLocaleDateString('fr-CH')
  }

  const calm = (board?.queues.unpaid.length ?? 0) === 0 && (board?.queues.trials.length ?? 0) === 0

  const th = (label: string, extra?: { align?: 'left' | 'right'; width?: number }) => (
    <th style={{
      textAlign: extra?.align ?? 'left', width: extra?.width, padding: '9px 12px',
      whiteSpace: 'nowrap', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
    }}>{label}</th>
  )
  const tdStyle = (extra?: { align?: 'left' | 'right'; total?: boolean }): CSSProperties => ({
    padding: extra?.total ? '13px 12px 11px' : '11px 12px', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink,
    whiteSpace: 'nowrap', textAlign: extra?.align ?? 'left', fontVariantNumeric: 'tabular-nums',
    borderTop: extra?.total
      ? `1px solid ${dark ? 'rgba(255,255,255,0.16)' : 'rgba(3, 3, 3, 0.16)'}`
      : surf.hairline,
  })

  if (isPending) {
    return (
      <AdminPage title={t('admin:plans.title')} subtitle={t('admin:plans.subtitle')} width="wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AdminSkeleton height={52} width={280} />
          {Array.from({ length: 6 }).map((_, i) => <AdminSkeleton key={i} height={42} />)}
        </div>
      </AdminPage>
    )
  }

  if (isError || !board) {
    return (
      <AdminPage title={t('admin:plans.title')} subtitle={t('admin:plans.subtitle')} width="wide">
        <AdminError
          message={t('admin:common.loadError')}
          onRetry={() => void refetch()}
          retryLabel={t('admin:common.retry')}
        />
      </AdminPage>
    )
  }

  return (
    <AdminPage title={t('admin:plans.title')} subtitle={t('admin:plans.subtitle')} width="wide">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {/* MRR — le seul chiffre que la fiche agence ne peut pas donner */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -2, lineHeight: 1, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
            {formatCHF(Number(board.mrr))}
          </span>
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, marginBottom: 5 }}>
            {t('plans.mrrSuffix')}
          </span>
        </div>

        {/* Les files : ce qui menace le revenu, rien d'autre. « Sièges saturés »
            attend la décision n° 4 — le serveur la nomme dans `unavailable`. */}
        {calm ? (
          <div style={{ padding: '6px 2px 0', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>
            {t('plans.calm')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PlanQueue
              title={t('plans.queue.unpaid')}
              rows={board.queues.unpaid}
              dot={tones.err}
              amount={threatened}
              onOpen={openAgency}
            />
            <PlanQueue
              title={t('plans.queue.trials')}
              rows={board.queues.trials}
              dot={tones.warn}
              amount={threatened}
              onOpen={openAgency}
            />
          </div>
        )}

        {/* Le portefeuille — une ligne par agence, le détail vit dans sa fiche */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px 10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <AdminSegmentBtn on={filter === 'all'} onClick={() => setFilter('all')}>
                {t('plans.filter.all')} · {counts.all}
              </AdminSegmentBtn>
              {PLANS.map(p => (
                <AdminSegmentBtn key={p.id} on={filter === p.id} onClick={() => setFilter(p.id)}>
                  {p.name} · {counts[p.id] ?? 0}
                </AdminSegmentBtn>
              ))}
              <AdminSegmentBtn on={filter === 'todo'} onClick={() => setFilter('todo')}>
                {t('plans.filter.todo')} · {counts.todo}
              </AdminSegmentBtn>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <AdminSearchInput
                value={q}
                onChange={setQ}
                placeholder={t('plans.searchPlaceholder')}
                label={t('plans.searchPlaceholder')}
                maxWidth={200}
                compact
              />
            </div>
          </div>

          {portfolio.length === 0 ? (
            <AdminEmpty icon={CreditCard} title={t('admin:plans.noAgency')} />
          ) : rows.length === 0 ? (
            <AdminEmpty icon={CreditCard} title={t('admin:plans.noAgency')} hint={t('plans.emptyHint')} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {th(t('plans.table.agency'), { width: 236 })}
                  {th(t('plans.table.plan'), { width: 108 })}
                  {th(t('plans.table.seats'), { width: 90, align: 'right' })}
                  {th(t('plans.table.properties'), { width: 78, align: 'right' })}
                  {th(t('plans.table.mrr'), { width: 104, align: 'right' })}
                  {th(t('plans.table.renewal'), { width: 132 })}
                  {th(t('plans.table.status'))}
                  {th(t('plans.table.actions'), { width: 130, align: 'right' })}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const meta = STATE_META[row.state]
                  const mrr = Number(row.mrr || 0)
                  const extra = extras.get(row.id)
                  return (
                    <tr key={row.id} className="adm-row" onClick={() => openAgency(row)} style={{ cursor: 'pointer' }}>
                      <td style={tdStyle()}>
                        <div style={{ fontWeight: 600, letterSpacing: -0.2 }}>{row.name}</div>
                        {extra?.city && (
                          <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{extra.city}</div>
                        )}
                      </td>
                      <td style={tdStyle()}>{planLabel(row.plan)}</td>
                      <td style={tdStyle({ align: 'right' })}>{row.seats_used}</td>
                      <td style={tdStyle({ align: 'right' })}>{extra?.properties ?? '—'}</td>
                      <td style={{ ...tdStyle({ align: 'right' }), color: mrr ? sp.ink : sp.sub }}>
                        {mrr ? formatCHF(mrr) : '—'}
                      </td>
                      <td style={tdStyle()}>{renewalLabel(row)}</td>
                      <td style={tdStyle()}>
                        <AdminPill label={t(meta.key)} tone={meta.tone} />
                      </td>
                      {/* La cellule Actions n'ouvre pas la fiche : elle porte le menu. */}
                      <td style={tdStyle({ align: 'right' })} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <PlanChangeDropdown currentPlan={row.plan ?? 'starter'} agencyId={row.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {/* Ligne de totaux : population COMPLÈTE, pas la vue filtrée. */}
                <tr>
                  <td style={{ ...tdStyle({ total: true }), fontWeight: 600 }}>
                    {rows.length === portfolio.length
                      ? t('plans.totals.all', { count: portfolio.length })
                      : t('plans.totals.filtered', { shown: rows.length, total: portfolio.length })}
                  </td>
                  <td style={tdStyle({ total: true })} />
                  <td style={{ ...tdStyle({ total: true, align: 'right' }), fontWeight: 600 }}>
                    {t('plans.totals.seats', { count: seatsTotal })}
                  </td>
                  <td style={{ ...tdStyle({ total: true, align: 'right' }), fontWeight: 600 }}>{propsTotal}</td>
                  <td style={{ ...tdStyle({ total: true, align: 'right' }), fontWeight: 600 }}>
                    {formatCHF(Number(board.mrr))}
                  </td>
                  <td style={tdStyle({ total: true })} />
                  <td style={tdStyle({ total: true })} />
                  <td style={tdStyle({ total: true })} />
                </tr>
              </tbody>
            </table>
          )}

          {/* Grille en vigueur — les prix vivent en base (C2), la console les lit. */}
          {board.pricing_source && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 26, margin: '14px 2px 0', paddingTop: 14,
              borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(3, 3, 3, 0.07)'}`,
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{t('plans.grid')}</span>
              {PLANS.map(p => {
                const monthly = board.pricing_source?.[p.id]?.monthly
                if (monthly === undefined || monthly === null) return null
                return (
                  <span key={p.id} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
                    {p.name}{' '}
                    <span style={{ fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCHF(Number(monthly))}
                    </span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
