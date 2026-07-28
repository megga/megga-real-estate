/**
 * Page super-admin — flux d'activité temps réel.
 *
 * Route : `/dashboard/admin/live`. Stream des `activity_events` (via
 * `useAdminLiveFeed`) avec pause, filtres par type d'entité / action, stats du
 * jour et détail metadata dépliable par ligne.
 *
 * Présentation portée sur le kit `admin/kit` (grammaire des Paramètres du CRM) :
 * bento séparé par l'ombre, indicateurs `AdminStat`, état direct/pause en pilule
 * pleine, pastilles de type en tons du kit (teinte + forme, cf. `ENTITY_DOTS`,
 * les tons étant moins nombreux que les types). Le flux reste une LISTE en flex et
 * non un `<table>` — chaque ligne se déplie sur son JSON metadata, ce qu'une
 * grille de cellules rendrait plus lourd qu'elle ne l'alignerait. Le repère
 * « Admin MEGGA » a quitté la page : il vit une seule fois dans le rail du shell.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio, Pause, Play, Filter, ChevronDown, Activity, Clock, Layers, History } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPill, AdminSkeleton, AdminStat,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminLiveFeed, type LiveEvent } from '@/hooks/useAdminLiveFeed'

// ─── ACTION LABELS ─────────────────────────────────────────────────────────

const ACTION_KEYS: Record<string, string> = {
  contact_created: 'liveFeed.action.contactCreated',
  contact_updated: 'liveFeed.action.contactUpdated',
  property_created: 'liveFeed.action.propertyCreated',
  property_updated: 'liveFeed.action.propertyUpdated',
  transaction_stage_change: 'liveFeed.action.pipelineChanged',
  transaction_created: 'liveFeed.action.transactionCreated',
  kyc_screening_match: 'liveFeed.action.kycScreeningMatch',
  kyc_case_created: 'liveFeed.action.kycCaseCreated',
  kyc_case_validated: 'liveFeed.action.kycValidated',
  email_sent: 'liveFeed.action.emailSent',
  visit_created: 'liveFeed.action.visitCreated',
  visit_completed: 'liveFeed.action.visitCompleted',
  match_created: 'liveFeed.action.matchCreated',
  match_sent: 'liveFeed.action.matchSent',
  agency_created: 'liveFeed.action.agencyCreated',
  edge_function_error: 'liveFeed.action.systemError',
  document_uploaded: 'liveFeed.action.documentUploaded',
  login: 'liveFeed.action.login',
  logout: 'liveFeed.action.logout',
}

// ─── ALL ENTITY TYPES FOR FILTER ───────────────────────────────────────────

const ENTITY_TYPE_KEYS: Array<{ value: string; labelKey: string }> = [
  { value: 'all', labelKey: 'liveFeed.entityType.all' },
  { value: 'contact', labelKey: 'liveFeed.entityType.contacts' },
  { value: 'property', labelKey: 'liveFeed.entityType.properties' },
  { value: 'transaction', labelKey: 'liveFeed.entityType.transactions' },
  { value: 'kyc', labelKey: 'liveFeed.entityType.kyc' },
  { value: 'email', labelKey: 'liveFeed.entityType.emails' },
  { value: 'visit', labelKey: 'liveFeed.entityType.visits' },
  { value: 'match', labelKey: 'liveFeed.entityType.matches' },
  { value: 'agency', labelKey: 'liveFeed.entityType.agencies' },
]

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/**
 * Géométrie des colonnes du flux.
 *
 * L'en-tête et les lignes lisent les MÊMES valeurs — c'est la seule chose qui
 * tient l'alignement d'une liste en flex qui se fait passer pour un tableau.
 */
const COL = { time: 72, dot: 8, action: 140, gap: 12, padX: 15 } as const

/** Décalage du bloc metadata déplié, aligné sous la colonne « Action ». */
const META_INDENT = COL.padX + COL.time + COL.gap + COL.dot + COL.gap

/** Formate un ISO en HH:MM:SS (fuseau fr-CH) pour la colonne horodatage. */
function formatTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Résumé une ligne des 3 premières entrées metadata (valeurs tronquées à 40 car.). */
function summarizeMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return ''
  const entries = Object.entries(metadata).slice(0, 3)
  return entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v)
    const truncated = val.length > 40 ? val.slice(0, 40) + '...' : val
    return `${k}: ${truncated}`
  }).join(' | ')
}

/** Teintes admissibles pour une pastille : les tons du kit, plus l'encre douce. */
type DotHue = 'info' | 'ok' | 'warn' | 'err' | 'cyan' | 'soft'

/** Signal d'une pastille : une teinte, rendue en disque plein ou en anneau. */
interface DotSignal { hue: DotHue; ring?: boolean }

/**
 * Signal de pastille par type d'entité — deux axes, teinte ET forme.
 *
 * Le dictionnaire d'avant (`bg-blue-500` / `bg-emerald-500` / `bg-admin-accent`…)
 * donnait huit teintes pour huit types. Les tons Sugar n'en offrent que cinq plus
 * l'encre douce, et le violet reste hors jeu : dans la console il ne dit qu'une
 * chose, « tu es dans la plateforme », jamais « ceci est un match ». Réduire à
 * six teintes coûtait donc le pouvoir discriminant de la colonne — contact et
 * agence, bien et match rendaient un signal identique.
 *
 * On récupère les huit signaux avec un second axe plutôt qu'avec des teintes
 * inventées : le disque plein porte l'entité elle-même, l'anneau porte ce qui en
 * relie ou en englobe d'autres (une agence groupe des contacts, un match relie un
 * contact à un bien). Chaque anneau partage donc la teinte du disque dont il est
 * le pendant, ce qui garde la famille lisible, et le couple (teinte, forme) reste
 * unique. Bénéfice au passage : la forme survit au daltonisme, ce qu'une
 * neuvième teinte n'aurait pas fait.
 */
const ENTITY_DOTS: Record<string, DotSignal> = {
  contact: { hue: 'info' },
  agency: { hue: 'info', ring: true },
  property: { hue: 'ok' },
  match: { hue: 'ok', ring: true },
  transaction: { hue: 'warn' },
  kyc: { hue: 'err' },
  visit: { hue: 'cyan' },
  // `email` n'a pas de signal propre : encre douce, disque plein.
  email: { hue: 'soft' },
}

/**
 * Repli des types non répertoriés.
 *
 * En ANNEAU, pour ne pas se confondre avec `email` qui porte la même encre en
 * disque plein — sinon un type nouveau ressemblerait à un e-mail.
 */
const UNKNOWN_DOT: DotSignal = { hue: 'soft', ring: true }

/** Pastille de type d'entité : teinte du kit + forme (voir `ENTITY_DOTS`). */
function EntityDot({ entityType, size = 8 }: { entityType: string; size?: number }) {
  const { sp, tones } = useAdminSugar()
  const { hue, ring } = ENTITY_DOTS[entityType] ?? UNKNOWN_DOT
  const color = hue === 'soft' ? sp.soft : tones[hue]
  return (
    <span
      style={{
        width: size, height: size, borderRadius: ADMIN_RADII.pill, flexShrink: 0,
        // L'anneau se dessine en ombre INTERNE et non en `border` : une bordure
        // participe au modèle de boîte, donc elle grossirait la pastille hors de
        // `COL.dot` et décalerait la colonne « Action » d'une ligne à l'autre.
        // Même technique que la légende de MobileAnalyticsScreen. Épaisseur
        // proportionnelle pour que le trou reste visible à 8 px (le flux) comme
        // à 6 px (les pilules de filtre).
        background: ring ? 'transparent' : color,
        boxShadow: ring ? `inset 0 0 0 ${Math.max(1.5, size / 4)}px ${color}` : undefined,
      }}
    />
  )
}

/** Ligne d'événement ; cliquable pour déplier le JSON metadata brut si présent. */
function EventRow({ event, isNew, getActionLabel }: { event: LiveEvent; isNew: boolean; getActionLabel: (action: string) => string }) {
  const { sp, surf } = useAdminSugar()
  const [expanded, setExpanded] = useState(false)
  const metaSummary = summarizeMetadata(event.metadata)
  const hasMetadata = metaSummary.length > 0

  return (
    <div
      role={hasMetadata ? 'button' : undefined}
      tabIndex={hasMetadata ? 0 : undefined}
      onKeyDown={hasMetadata ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } } : undefined}
      className={isNew ? 'lfx-row adm-fade-up' : 'lfx-row'}
      onClick={() => hasMetadata && setExpanded(!expanded)}
      style={{
        borderTop: surf.hairline,
        cursor: hasMetadata ? 'pointer' : 'default',
        animation: isNew ? 'admFadeUp .3s cubic-bezier(.2,.8,.2,1) both' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: COL.gap, padding: `9px ${COL.padX}px` }}>
        {/* Horodatage */}
        <span style={{
          width: COL.time, flexShrink: 0, paddingTop: 2,
          fontFamily: MONO, fontSize: 11, color: sp.sub, fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(event.created_at)}
        </span>

        {/* Pastille de type */}
        <span style={{ display: 'flex', paddingTop: 6 }}>
          <EntityDot entityType={event.entity_type} />
        </span>

        {/* Action */}
        <span style={{ minWidth: COL.action, flexShrink: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>
          {getActionLabel(event.action)}
        </span>

        {/* Type d'entité — pilule neutre : la teinte est déjà portée par la pastille */}
        <AdminPill label={event.entity_type} tone="neutral" style={{ fontSize: 11, padding: '3px 10px' }} />

        {/* Résumé metadata */}
        <span style={{
          flex: 1, minWidth: 0, paddingTop: 2, fontSize: 11.5, color: sp.sub,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {metaSummary || '—'}
        </span>

        {/* Indicateur de dépliage */}
        {hasMetadata && (
          <span style={{
            display: 'flex', paddingTop: 3, flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .18s ease',
          }}>
            <AdminIc icon={ChevronDown} size={14} color={sp.soft} />
          </span>
        )}
      </div>

      {/* Metadata dépliée */}
      {expanded && hasMetadata && (
        <div style={{ padding: `0 ${COL.padX}px 12px ${META_INDENT}px` }} onClick={(e) => e.stopPropagation()}>
          <pre style={{
            margin: 0, padding: 12, borderRadius: ADMIN_RADII.row,
            background: surf.cardSub, color: sp.sub,
            fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/** Vue principale : bandeau stats, filtres et liste temps réel des 100 derniers events. */
export default function AdminLiveFeedPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark } = useAdminSugar()
  const { events, isLoading, isError, refetch } = useAdminLiveFeed(100)
  const [paused, setPaused] = useState(false)
  // Snapshot capturé à la mise en pause — le Realtime continue d'alimenter
  // `events`, mais l'affichage reste gelé tant que frozenEvents est posé.
  const [frozenEvents, setFrozenEvents] = useState<typeof events | null>(null)

  const togglePause = () => {
    if (paused) {
      setPaused(false)
      setFrozenEvents(null)
    } else {
      setFrozenEvents(events)
      setPaused(true)
    }
  }
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const [prevCount, setPrevCount] = useState(0)

  function getActionLabel(action: string): string {
    const key = ACTION_KEYS[action]
    return key ? t(key) : action.replace(/_/g, ' ')
  }

  // Track new events for animation
  const newEventIds = useRef(new Set<string>())
  useEffect(() => {
    if (events.length > prevCount) {
      const newOnes = events.slice(0, events.length - prevCount)
      newOnes.forEach(e => newEventIds.current.add(e.id))
      // Clear "new" flag after animation
      const timer = setTimeout(() => { newEventIds.current.clear() }, 400)
      setPrevCount(events.length)
      return () => clearTimeout(timer)
    }
    setPrevCount(events.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, prevCount])

  // Display events (paused = freeze the current list)
  const displayEvents = paused && frozenEvents ? frozenEvents : events

  // Filter by entity type
  const filteredByEntity = useMemo(() => {
    if (entityFilter === 'all') return displayEvents
    return displayEvents.filter(e => e.entity_type === entityFilter)
  }, [displayEvents, entityFilter])

  // Filter by action
  const filteredEvents = useMemo(() => {
    if (!actionFilter) return filteredByEntity
    const q = actionFilter.toLowerCase()
    return filteredByEntity.filter(e =>
      e.action.toLowerCase().includes(q) ||
      getActionLabel(e.action).toLowerCase().includes(q)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredByEntity, actionFilter])

  // Unique action types for dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(events.map(e => e.action))
    return Array.from(set).sort()
  }, [events])

  // Stats
  const { todayCount, hourCount, uniqueTypes, lastEvent } = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    return {
      todayCount: events.filter(e => new Date(e.created_at) >= todayStart).length,
      hourCount: events.filter(e => new Date(e.created_at) >= oneHourAgo).length,
      uniqueTypes: new Set(events.map(e => e.action)).size,
      lastEvent: events[0] ? formatRelativeDate(events[0].created_at) : '—',
    }
  }, [events])

  return (
    <AdminPage
      title={t('liveFeed.title')}
      width="wide"
      actions={(
        <>
          <AdminPill
            label={paused ? t('liveFeed.paused') : t('liveFeed.realtime')}
            tone={paused ? 'warn' : 'ok'}
            icon={paused ? Pause : Radio}
          />
          <AdminGhostBtn onClick={togglePause} icon={paused ? Play : Pause}>
            {paused ? t('liveFeed.resume') : t('liveFeed.pause')}
          </AdminGhostBtn>
        </>
      )}
    >
      <style>{`
        .lfx-row { transition: background .15s ease; }
        .lfx-row:hover { background: ${dark ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.03)'}; }
        .lfx-row:focus:not(:focus-visible) { outline: none; }
        .lfx-row:focus-visible { outline: 2px solid ${sp.accent}; outline-offset: -2px; }
      `}</style>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <AdminSkeleton key={i} height={62} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AdminStat label={t('liveFeed.stats.today')} value={todayCount} icon={Activity} tone="info" />
          <AdminStat label={t('liveFeed.stats.thisHour')} value={hourCount} icon={Clock} />
          <AdminStat label={t('liveFeed.stats.uniqueTypes')} value={uniqueTypes} icon={Layers} />
          <AdminStat label={t('liveFeed.stats.lastEvent')} value={lastEvent} icon={History} />
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        {/* Pilules de type d'entité */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {ENTITY_TYPE_KEYS.map((et) => {
            const on = entityFilter === et.value
            return (
              <button
                key={et.value}
                onClick={() => setEntityFilter(et.value)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 30, padding: '0 13px', borderRadius: ADMIN_RADII.pill, border: 0,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  background: on ? sp.accent : surf.cardSub, color: on ? sp.accentInk : sp.soft,
                  transition: 'background .18s ease',
                }}
              >
                {et.value !== 'all' && <EntityDot entityType={et.value} size={6} />}
                {t(et.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Filtre par action */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 11, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <AdminIc icon={Filter} size={14} color={sp.sub} />
            </span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{
                height: 30, padding: '0 13px 0 32px', borderRadius: ADMIN_RADII.pill, border: 0,
                background: surf.cardSub, color: sp.soft,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
              }}
            >
              <option value="">{t('liveFeed.filter.allActions')}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{getActionLabel(a)}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
            {t('liveFeed.events', { count: filteredEvents.length })}
          </span>
        </div>
      </div>

      {/* Flux */}
      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        {/* En-tête de colonnes */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: COL.gap, padding: `9px ${COL.padX}px`,
          background: sp.tableHeadBg, fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub,
        }}>
          <span style={{ width: COL.time, flexShrink: 0 }}>{t('liveFeed.column.time')}</span>
          <span style={{ width: COL.dot, flexShrink: 0 }} />
          <span style={{ minWidth: COL.action, flexShrink: 0 }}>{t('liveFeed.column.action')}</span>
          <span style={{ flexShrink: 0 }}>{t('liveFeed.column.type')}</span>
          <span style={{ flex: 1 }}>{t('liveFeed.column.details')}</span>
        </div>

        {/* Liste des événements */}
        <div
          ref={feedRef}
          className="scrollbar-hide"
          style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}
        >
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
              {[0, 1, 2, 3, 4, 5].map(i => <AdminSkeleton key={i} height={34} />)}
            </div>
          ) : isError && filteredEvents.length === 0 ? (
            // Un flux muet passe pour « plateforme au calme » : sans cet état, une
            // requête en échec ressemble à une absence d'activité.
            <AdminError
              message={t('common.loadError')}
              onRetry={() => void refetch()}
              retryLabel={t('common.retry')}
            />
          ) : filteredEvents.length === 0 ? (
            <AdminEmpty icon={Radio} title={t('liveFeed.empty.title')} hint={t('liveFeed.empty.subtitle')} />
          ) : (
            filteredEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                isNew={newEventIds.current.has(event.id)}
                getActionLabel={getActionLabel}
              />
            ))
          )}
        </div>
      </AdminCard>
    </AdminPage>
  )
}
