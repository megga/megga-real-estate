/**
 * Page super-admin — appels d'accueil.
 *
 * Route : `/dashboard/admin/onboarding-calls`. Deux segments dans une seule page
 * plutôt que deux entrées de rail : « Rendez-vous » (le carnet transverse, toutes
 * agences confondues) et « Hôtes » (le pool MEGGA et ses horaires). Le rail compte
 * déjà seize destinations, en ajouter deux pour un même sujet le rend moins lisible.
 *
 * Toutes les lectures passent par RPC gardée `is_super_admin()` : les tables du pool
 * n'accordent aucun droit au client (cf. migration 20260803214105).
 */
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, CheckCircle2, ChevronDown, ChevronUp, Clock, UserX, XCircle, Video, Power, Pencil, Plus } from 'lucide-react'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc,
  AdminPager, AdminPill, AdminSearchInput, AdminSegmentBtn, AdminSkeleton,
  AdminStat, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import type { AdminToneName } from '@/components/admin/kit/adminKitCore'
import AdminConfirm from '@/components/admin/AdminConfirm'
import OnboardingHostForm from '@/components/admin/OnboardingHostForm'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useClientPagination } from '@/hooks/useClientPagination'
import {
  useAdminOnboardingCalls,
  useAdminOnboardingHosts,
  useSetOnboardingHostActive,
  useSetOnboardingCallOutcome,
  useAdminCancelOnboardingCall,
  type AdminOnboardingCall,
  type AdminOnboardingHost,
} from '@/hooks/useAdminOnboardingCalls'

const PER_PAGE = 15

const STATUS_TONE: Record<string, AdminToneName> = {
  confirmed: 'ok',
  done: 'info',
  cancelled: 'neutral',
  no_show: 'err',
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/** Clés du questionnaire de calibrage, dans l'ordre du formulaire (OcBooking). */
const CALIBRATION_KEYS = ['portfolio', 'business', 'team', 'priority', 'cantons'] as const

/** L'identité (prénom, nom, e-mail) voyage dans le même jsonb, mais la rangée du
 *  tableau la porte déjà : la répéter dans le détail n'apprendrait rien. */
const IDENTITY_ANSWER_KEYS = new Set(['first_name', 'last_name', 'email'])

/**
 * Nombre de jours d'horaires rendus en clair dans le tableau ; au-delà, un compte.
 *
 * Deux, et pas plus : un hôte qui ouvre quatre jours produisait trois lignes qui
 * s'enroulaient dans une cellule, et c'est la ligne la plus longue qui donnait sa hauteur
 * à toute la rangée. Le détail complet reste à un clic, dans le formulaire d'édition.
 */
const HOURS_DAYS_SHOWN = 2

/** Le fuseau de tous les hôtes en pratique — n'est affiché que lorsqu'il en diffère. */
const DEFAULT_TIMEZONE = 'Europe/Zurich'

/**
 * Résumé d'un horaire hebdomadaire : les deux premiers jours en clair, le reste compté.
 *
 * Rend un couple plutôt qu'une chaîne pour que l'appelant compose lui-même la
 * troncature avec sa propre encre atténuée — recoller « +2 autres jours » dans la même
 * chaîne lui donnerait le poids visuel d'un horaire réel.
 */
function weeklySummary(
  host: AdminOnboardingHost,
  dayNames: string[],
): { shown: string; more: number } {
  if (host.weekly_hours.length === 0) return { shown: '—', more: 0 }
  const byDay = new Map<number, string[]>()
  for (const slice of host.weekly_hours) {
    const list = byDay.get(slice.dow) ?? []
    list.push(`${slice.start}-${slice.end}`)
    byDay.set(slice.dow, list)
  }
  const days = [...byDay.entries()].sort((a, b) => a[0] - b[0])
  return {
    shown: days
      .slice(0, HOURS_DAYS_SHOWN)
      .map(([dow, ranges]) => `${dayNames[dow - 1] ?? dow} ${ranges.join(', ')}`)
      .join(' · '),
    more: Math.max(0, days.length - HOURS_DAYS_SHOWN),
  }
}

function CallsTab() {
  // Le namespace `onboarding` s'ajoute pour libeller les réponses de calibrage avec
  // les questions du wizard lui-même : une seule source pour la question ET ses options.
  const { t } = useTranslation(['admin', 'onboarding'])
  const { sp, surf, tones } = useAdminSugar()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('all')
  /** Appel dont la rangée de détail est dépliée — une seule à la fois suffit. */
  const [openDetails, setOpenDetails] = useState<string | null>(null)

  const { data: calls, isLoading, isError, refetch } = useAdminOnboardingCalls()
  const setOutcome = useSetOnboardingCallOutcome()
  const cancelCall = useAdminCancelOnboardingCall()
  const [toCancel, setToCancel] = useState<AdminOnboardingCall | null>(null)

  const nowMs = Date.now()
  const stats = useMemo(() => {
    const list = calls ?? []
    return {
      upcoming: list.filter((c) => c.status === 'confirmed' && Date.parse(c.scheduled_at) > nowMs).length,
      done: list.filter((c) => c.status === 'done').length,
      noShow: list.filter((c) => c.status === 'no_show').length,
      cancelled: list.filter((c) => c.status === 'cancelled').length,
    }
  }, [calls, nowMs])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (calls ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false
      if (!needle) return true
      return [c.agency_name, c.host_name, c.booked_by_name, c.booked_by_email]
        .some((v) => (v ?? '').toLowerCase().includes(needle))
    })
  }, [calls, query, status])

  const { page, setPage, totalPages, paginated, perPage, total } = useClientPagination(filtered, PER_PAGE)

  /**
   * Réponses affichables d'un appel : les questions connues d'abord, libellées par le
   * questionnaire du wizard, puis toute clé inconnue en brut — le jsonb est déclaratif,
   * une clé future ne doit pas disparaître en silence.
   */
  const answerRowsFor = (call: AdminOnboardingCall): { key: string; label: string; value: string }[] => {
    const answers = call.attendee_answers
    if (!answers) return []
    const known = CALIBRATION_KEYS
      .filter((key) => answers[key])
      .map((key) => ({
        key: key as string,
        label: t(`onboarding:call.questions.${key}.label`, { defaultValue: key }),
        // `cantons` est une réponse libre, les autres sont des options fermées dont le
        // libellé vit avec la question ; une option inconnue s'affiche telle quelle.
        value: key === 'cantons'
          ? answers[key]
          : t(`onboarding:call.questions.${key}.options.${answers[key]}`, { defaultValue: answers[key] }),
      }))
    const rest = Object.keys(answers)
      .filter((key) => !IDENTITY_ANSWER_KEYS.has(key) && !(CALIBRATION_KEYS as readonly string[]).includes(key))
      .map((key) => ({ key, label: key, value: answers[key] }))
    return [...known, ...rest]
  }

  if (isError) return <AdminError message={t('onboardingCalls.error')} onRetry={() => void refetch()} />

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <AdminStat label={t('onboardingCalls.stats.upcoming')} value={stats.upcoming} icon={Clock} tone="ok" />
        <AdminStat label={t('onboardingCalls.stats.done')} value={stats.done} icon={CheckCircle2} tone="info" />
        <AdminStat label={t('onboardingCalls.stats.noShow')} value={stats.noShow} icon={UserX} tone="err" />
        <AdminStat label={t('onboardingCalls.stats.cancelled')} value={stats.cancelled} icon={XCircle} tone="neutral" />
      </div>

      <AdminCard>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <AdminSearchInput
            value={query}
            onChange={(v) => { setQuery(v); setPage(1) }}
            placeholder={t('onboardingCalls.searchPlaceholder')}
            label={t('onboardingCalls.searchLabel')}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'confirmed', 'done', 'no_show', 'cancelled'].map((s) => (
              <AdminSegmentBtn
                key={s}
                on={status === s}
                onClick={() => { setStatus(s); setPage(1) }}
                variant="filter"
              >
                {t(`onboardingCalls.filters.${s}`)}
              </AdminSegmentBtn>
            ))}
          </div>
        </div>

        {isLoading && (
          <div style={{ display: 'grid', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((i) => <AdminSkeleton key={i} height={44} />)}
          </div>
        )}

        {!isLoading && paginated.length === 0 && (
          <AdminEmpty
            icon={CalendarCheck}
            title={t('onboardingCalls.empty.title')}
            hint={t('onboardingCalls.empty.hint')}
          />
        )}

        {!isLoading && paginated.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <AdminTh>{t('onboardingCalls.table.agency')}</AdminTh>
                  <AdminTh>{t('onboardingCalls.table.when')}</AdminTh>
                  <AdminTh>{t('onboardingCalls.table.host')}</AdminTh>
                  <AdminTh>{t('onboardingCalls.table.status')}</AdminTh>
                  <AdminTh align="right">{t('onboardingCalls.table.actions')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {paginated.map((call: AdminOnboardingCall) => {
                  const isPast = Date.parse(call.scheduled_at) <= nowMs
                  const answerRows = answerRowsFor(call)
                  const hasDetails = !!(call.attendee_phone || call.attendee_note || answerRows.length > 0)
                  const isOpen = hasDetails && openDetails === call.id
                  return (
                    <Fragment key={call.id}>
                    <tr style={{ borderTop: surf.hairline }}>
                      <AdminTd>
                        <span style={{ fontWeight: 600 }}>{call.agency_name ?? '—'}</span>
                        <br />
                        <span style={{ color: sp.soft, fontSize: 12 }}>
                          {call.booked_by_name ?? call.booked_by_email ?? '—'}
                        </span>
                      </AdminTd>
                      <AdminTd numeric>
                        {formatWhen(call.scheduled_at)}
                        {call.rescheduled_count > 0 && (
                          <>
                            <br />
                            <span style={{ color: sp.soft, fontSize: 12 }}>
                              {t('onboardingCalls.table.rescheduled', { count: call.rescheduled_count })}
                            </span>
                          </>
                        )}
                      </AdminTd>
                      <AdminTd>{call.host_name}</AdminTd>
                      <AdminTd>
                        <AdminPill
                          label={t(`onboardingCalls.status.${call.status}`)}
                          tone={STATUS_TONE[call.status] ?? 'neutral'}
                        />
                      </AdminTd>
                      <AdminTd align="right">
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {call.meeting_url && (
                            <a
                              href={call.meeting_url}
                              target="_blank"
                              rel="noreferrer"
                              title={t('onboardingCalls.table.openMeeting')}
                              style={{ color: tones.info, display: 'inline-flex' }}
                            >
                              <AdminIc icon={Video} size={15} />
                            </a>
                          )}
                          {/* Marquer l'issue n'a de sens qu'une fois l'heure passée. */}
                          {call.status === 'confirmed' && isPast && (
                            <>
                              <AdminSegmentBtn
                                on={false}
                                variant="hollow"
                                onClick={() => setOutcome.mutate({ callId: call.id, status: 'done' })}
                              >
                                {t('onboardingCalls.actions.markDone')}
                              </AdminSegmentBtn>
                              <AdminSegmentBtn
                                on={false}
                                variant="hollow"
                                onClick={() => setOutcome.mutate({ callId: call.id, status: 'no_show' })}
                              >
                                {t('onboardingCalls.actions.markNoShow')}
                              </AdminSegmentBtn>
                            </>
                          )}
                          {/* Annuler prévient l'agence et libère l'agenda de l'hôte :
                              cela passe par l'edge function, pas par une écriture directe. */}
                          {call.status === 'confirmed' && !isPast && (
                            <AdminSegmentBtn on={false} variant="hollow" onClick={() => setToCancel(call)}>
                              {t('onboardingCalls.actions.cancel')}
                            </AdminSegmentBtn>
                          )}
                          {/* Téléphone, note et réponses de calibrage : à un clic, pas en
                              colonnes — la plupart des rangées n'en ont pas, des colonnes
                              vides ne feraient qu'élargir le tableau. */}
                          {hasDetails && (
                            <AdminSegmentBtn
                              on={isOpen}
                              variant="hollow"
                              onClick={() => setOpenDetails(isOpen ? null : call.id)}
                              title={t('onboardingCalls.table.details')}
                            >
                              <AdminIc icon={isOpen ? ChevronUp : ChevronDown} size={14} />
                            </AdminSegmentBtn>
                          )}
                        </div>
                      </AdminTd>
                    </tr>
                    {isOpen && (
                      /* La rangée de détail appartient à celle du dessus : pas de filet
                         entre les deux, c'est la rangée suivante qui en porte un. */
                      <tr>
                        <td colSpan={5} style={{ padding: '0 10px 14px' }}>
                          <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                            {call.attendee_phone && (
                              <div>
                                <span style={{ color: sp.soft, fontSize: 12 }}>{t('onboardingCalls.details.phone')}</span>
                                <br />
                                {call.attendee_phone}
                              </div>
                            )}
                            {call.attendee_note && (
                              <div>
                                <span style={{ color: sp.soft, fontSize: 12 }}>{t('onboardingCalls.details.note')}</span>
                                <br />
                                {call.attendee_note}
                              </div>
                            )}
                            {answerRows.length > 0 && (
                              <div>
                                <div style={{ color: sp.soft, fontSize: 12, marginBottom: 4 }}>
                                  {t('onboardingCalls.details.answers')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 6 }}>
                                  {answerRows.map((row) => (
                                    <div key={row.key}>
                                      <span style={{ color: sp.soft, fontSize: 12 }}>{row.label}</span>
                                      <br />
                                      {row.value}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <AdminPager page={page} totalPages={totalPages} total={total} perPage={perPage} onPage={setPage} />
      </AdminCard>

      <AdminConfirm
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={() => {
          if (!toCancel) return
          cancelCall.mutate(
            { callId: toCancel.id, reason: 'admin' },
            { onSettled: () => setToCancel(null) },
          )
        }}
        title={t('onboardingCalls.cancelConfirm.title')}
        message={t('onboardingCalls.cancelConfirm.message', {
          agency: toCancel?.agency_name ?? '',
          when: toCancel ? formatWhen(toCancel.scheduled_at) : '',
        })}
        confirmLabel={t('onboardingCalls.cancelConfirm.confirm')}
        busy={cancelCall.isPending}
        busyLabel={t('onboardingCalls.cancelConfirm.busy')}
      />
    </>
  )
}

function HostsTab() {
  const { t } = useTranslation('admin')
  const { sp, surf } = useAdminSugar()
  const { data: hosts, isLoading, isError, refetch } = useAdminOnboardingHosts()
  const setActive = useSetOnboardingHostActive()
  // `null` = fermé ; `'new'` = création ; sinon l'hôte en cours de modification.
  const [editing, setEditing] = useState<AdminOnboardingHost | 'new' | null>(null)

  const dayNames = t('onboardingCalls.hosts.dayNames', { returnObjects: true }) as string[]

  if (isError) return <AdminError message={t('onboardingCalls.error')} onRetry={() => void refetch()} />

  return (
    <AdminCard>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <AdminGhostBtn onClick={() => setEditing('new')} icon={Plus}>
          {t('onboardingCalls.hosts.addHost')}
        </AdminGhostBtn>
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2].map((i) => <AdminSkeleton key={i} height={44} />)}
        </div>
      )}

      {!isLoading && (hosts ?? []).length === 0 && (
        <AdminEmpty
          icon={CalendarCheck}
          title={t('onboardingCalls.hosts.empty.title')}
          hint={t('onboardingCalls.hosts.empty.hint')}
        />
      )}

      {!isLoading && (hosts ?? []).length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <AdminTh>{t('onboardingCalls.hosts.table.host')}</AdminTh>
                <AdminTh>{t('onboardingCalls.hosts.table.hours')}</AdminTh>
                <AdminTh align="right">{t('onboardingCalls.hosts.table.upcoming')}</AdminTh>
                <AdminTh align="right">{t('onboardingCalls.hosts.table.state')}</AdminTh>
              </tr>
            </thead>
            <tbody>
              {(hosts ?? []).map((host) => {
                const hours = weeklySummary(host, dayNames)
                return (
                <tr key={host.id} style={{ borderTop: surf.hairline }}>
                  <AdminTd>
                    <span style={{ fontWeight: 600 }}>{host.display_name}</span>
                    <br />
                    <span style={{ color: sp.soft, fontSize: 12 }}>
                      {host.profile_email ?? '—'}
                      {/* Le fuseau seulement quand il SURPREND. Tous les hôtes sont à
                          Europe/Zurich : répété sur chaque rangée, il n'apprenait rien
                          et faisait passer l'e-mail à la ligne. */}
                      {host.timezone !== DEFAULT_TIMEZONE && ` · ${host.timezone}`}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    {/* La ligne de règles (« 30 min, tampon 15 min, préavis 12 h,
                        horizon 30 j ») a été RETIRÉE : elle s'affichait à l'identique
                        sur chaque hôte, pesait un tiers du texte du tableau et n'en
                        distinguait aucun. C'est de la configuration — elle vit dans le
                        formulaire d'édition, qui porte déjà les quatre champs. */}
                    {hours.shown}
                    {hours.more > 0 && (
                      <>
                        <br />
                        <span style={{ color: sp.soft, fontSize: 12 }}>
                          {t('onboardingCalls.hosts.table.hoursMore', { n: hours.more })}
                        </span>
                      </>
                    )}
                  </AdminTd>
                  <AdminTd numeric align="right">{host.upcoming_calls}</AdminTd>
                  <AdminTd align="right">
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <AdminPill
                        label={t(host.is_active ? 'onboardingCalls.hosts.active' : 'onboardingCalls.hosts.inactive')}
                        tone={host.is_active ? 'ok' : 'neutral'}
                      />
                      <AdminSegmentBtn
                        on={false}
                        variant="hollow"
                        onClick={() => setEditing(host)}
                        title={t('onboardingCalls.hosts.editHost')}
                      >
                        <AdminIc icon={Pencil} size={14} />
                      </AdminSegmentBtn>
                      <AdminSegmentBtn
                        on={false}
                        variant="hollow"
                        onClick={() => setActive.mutate({ hostId: host.id, active: !host.is_active })}
                        title={t(host.is_active ? 'onboardingCalls.hosts.deactivate' : 'onboardingCalls.hosts.activate')}
                      >
                        <AdminIc icon={Power} size={14} />
                      </AdminSegmentBtn>
                    </div>
                  </AdminTd>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <OnboardingHostForm
          host={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Sans hôte actif, l'écran de réservation dit honnêtement qu'aucun créneau n'est
          ouvert. Le rappeler évite de chercher la panne ailleurs — mais SEULEMENT quand
          c'est le cas : sous une liste d'hôtes actifs, la phrase n'expliquait rien et
          s'ajoutait au texte que cet écran demande déjà de lire. */}
      {!isLoading && (hosts ?? []).length > 0 && !(hosts ?? []).some((h) => h.is_active) && (
        <p style={{ color: sp.soft, fontSize: 12, marginTop: 14, lineHeight: 1.6 }}>
          {t('onboardingCalls.hosts.provisioningNote')}
        </p>
      )}
    </AdminCard>
  )
}

export default function AdminOnboardingCallsPage() {
  const { t } = useTranslation('admin')
  const [tab, setTab] = useState<'calls' | 'hosts'>('calls')

  return (
    <AdminPage
      title={t('onboardingCalls.title')}
      subtitle={t('onboardingCalls.subtitle')}
      width="wide"
      actions={
        <div style={{ display: 'flex', gap: 6 }}>
          <AdminSegmentBtn on={tab === 'calls'} onClick={() => setTab('calls')} variant="tab">
            {t('onboardingCalls.tabs.calls')}
          </AdminSegmentBtn>
          <AdminSegmentBtn on={tab === 'hosts'} onClick={() => setTab('hosts')} variant="tab">
            {t('onboardingCalls.tabs.hosts')}
          </AdminSegmentBtn>
        </div>
      }
    >
      {tab === 'calls' ? <CallsTab /> : <HostsTab />}
    </AdminPage>
  )
}
