/**
 * Page super-admin — modération moderation.
 *
 * Route : `/dashboard/admin/moderation`.
 * Table paginée des annonces avec actions approuver / signaler / retirer
 * (`useAdminModeration`), recherche, filtre de statut et export CSV.
 *
 * Rendu en grammaire Sugar (kit `components/admin/kit`) : bentos séparés par
 * l'ombre, statut en pilule pleine (les pastilles `bg-emerald-500` /
 * `bg-amber-500` / `bg-red-500` ont disparu), vrai tableau `AdminTh`/`AdminTd`,
 * et actions de ligne en icônes au ton fonctionnel. Les actions apparaissent
 * aussi au FOCUS clavier, pas seulement au survol. Le repère « Admin MEGGA » a
 * quitté la page : il vit une seule fois dans le rail du shell.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, AlertTriangle, Trash2, Check, Building2, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { formatCHF, formatDate } from '@/lib/utils'
import { useAdminModeration } from '@/hooks/useAdminModeration'
import type { ModerationListing } from '@/hooks/useAdminModeration'
import { useClientPagination } from '@/hooks/useClientPagination'
import ModerationActionDialog from '@/components/admin/ModerationActionDialog'
import PageTransition from '@/components/layout/PageTransition'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPager, AdminPill, AdminSearchInput, AdminSegmentBtn, AdminSkeleton, AdminStat, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

const ITEMS_PER_PAGE = 15

const STATUS_FILTER_KEYS = [
  { value: '', key: 'moderation.filter.all' },
  { value: 'published', key: 'moderation.filter.published' },
  { value: 'flagged', key: 'moderation.filter.flagged' },
  { value: 'removed', key: 'moderation.filter.removed' },
] as const

/** Ton de pilule par statut de modération (remplace les pastilles colorées). */
const STATUS_TONE: Record<string, AdminToneName> = {
  published: 'ok',
  flagged: 'warn',
  removed: 'err',
}

const STATUS_LABEL_KEY: Record<string, string> = {
  published: 'common.status.published',
  flagged: 'common.status.flagged',
  removed: 'common.status.removed',
}

/** Troncature d'une cellule : les colonnes ont une largeur fixe (`tableLayout: fixed`). */
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** Vignette d'annonce — photo de couverture, ou surface creuse à l'icône si l'annonce n'en a pas. */
function Thumb({ src, width, height }: { src?: string; width: number; height: number }) {
  const { sp, surf } = useAdminSugar()
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={{ width, height, borderRadius: ADMIN_RADII.row, objectFit: 'cover', display: 'block', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width, height, borderRadius: ADMIN_RADII.row, background: surf.cardSub,
      display: 'grid', placeItems: 'center', flexShrink: 0,
    }}>
      <AdminIc icon={Building2} size={height >= 44 ? 17 : 15} color={sp.sub} />
    </div>
  )
}

/** Lignes squelette du bento pendant le chargement de la file de modération. */
function SkeletonRows() {
  return (
    <div style={{ display: 'grid', gap: 8, padding: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <AdminSkeleton key={i} height={44} />
      ))}
    </div>
  )
}

/** État vide de la liste ; message distinct selon qu'un filtre est actif ou non. */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <AdminEmpty
      icon={ShieldCheck}
      title={hasFilters ? t('admin:moderation.empty.titleFiltered') : t('admin:moderation.empty.title')}
      hint={hasFilters ? t('admin:moderation.empty.subtitleFiltered') : t('admin:moderation.empty.subtitle')}
    />
  )
}

/** Page de modération : recherche + filtre statut, table responsive, dialog de confirmation. */
export default function AdminModerationPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
  const { listings, isLoading, isError, refetch, stats, statsLoading, moderate } = useAdminModeration()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<'flag' | 'remove'>('flag')
  const [dialogListing, setDialogListing] = useState<ModerationListing | null>(null)

  const filtered = useMemo(() => {
    let list = [...listings]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        (l.title ?? '').toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.agency_name ?? '').toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      list = list.filter(l => l.moderation_status === statusFilter)
    }
    return list
  }, [listings, search, statusFilter])

  const { page, setPage, totalPages, paginated, perPage, total } = useClientPagination(filtered, ITEMS_PER_PAGE)

  function openDialog(listing: ModerationListing, action: 'flag' | 'remove') {
    setDialogListing(listing)
    setDialogAction(action)
    setDialogOpen(true)
  }

  function handleApprove(e: React.MouseEvent, listing: ModerationListing) {
    e.stopPropagation()
    moderate.mutate({ propertyId: listing.id, action: 'approve' })
  }

  function handleDialogConfirm(reason: string) {
    if (!dialogListing) return
    moderate.mutate({ propertyId: dialogListing.id, action: dialogAction, reason })
    setDialogOpen(false)
    setDialogListing(null)
  }

  const hasFilters = !!search || !!statusFilter
  const sub = { color: sp.sub } as const
  // Action de ligne : pastille creuse, le signal vient de la teinte de l'icône.
  const actBtn = {
    width: 26, height: 26, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: surf.cardSub, display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer',
  } as const

  return (
    <PageTransition>
      <AdminPage
        title={t('admin:moderation.title')}
        subtitle={isLoading ? t('admin:common.loading') : t('admin:moderation.subtitle', { count: listings.length })}
        width="wide"
        actions={(
          <AdminGhostBtn
            icon={Download}
            onClick={() => exportToCsv('megga-moderation', listings.map(l => ({
              titre: l.title, agence: l.agency_name ?? '', prix: l.price,
              canton: l.canton ?? '', statut: l.moderation_status, date: l.published_at ?? '',
            })))}
          >
            {t('admin:common.export')}
          </AdminGhostBtn>
        )}
      >
        <style>{`
          .admm-row { transition: background .15s ease; }
          .admm-row:hover { background: ${dark ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.03)'}; }
          .admm-act { opacity: 0; transition: opacity .15s ease; }
          .admm-row:hover .admm-act, .admm-row:focus-within .admm-act { opacity: 1; }
        `}</style>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AdminStat
            label={t('admin:moderation.kpi.published')}
            value={statsLoading ? '-' : (stats?.totalPublished ?? 0)}
            icon={ShieldCheck}
          />
          <AdminStat
            label={t('admin:moderation.kpi.flaggedThisMonth')}
            value={statsLoading ? '-' : (stats?.flaggedThisMonth ?? 0)}
            icon={AlertTriangle}
            tone={stats?.flaggedThisMonth ? 'err' : undefined}
          />
          <AdminStat
            label={t('admin:moderation.kpi.removedThisMonth')}
            value={statsLoading ? '-' : (stats?.removedThisMonth ?? 0)}
            icon={Trash2}
            tone={stats?.removedThisMonth ? 'err' : undefined}
          />
        </div>

        {/* Recherche + filtre de statut */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <AdminSearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder={t('admin:moderation.searchPlaceholder')}
            label={t('admin:moderation.searchPlaceholder')}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTER_KEYS.map((f) => (
              <AdminSegmentBtn
                key={f.value}
                on={statusFilter === f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1) }}
                variant="tab"
              >
                {t(`admin:${f.key}`)}
              </AdminSegmentBtn>
            ))}
          </div>
        </div>

        {/* Mobile : cartes dans un seul bento */}
        <AdminCard className="md:hidden" padding={0} style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <SkeletonRows />
          ) : isError && paginated.length === 0 ? (
            <AdminError
              message={t('admin:common.loadError')}
              onRetry={() => void refetch()}
              retryLabel={t('admin:common.retry')}
            />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            paginated.map((listing, i) => (
              <div
                key={listing.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
                  borderTop: i === 0 ? undefined : surf.hairline,
                }}
              >
                <Thumb src={listing.photos[0]} width={72} height={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, ...CLIP }}>
                    {listing.title || t('admin:common.noTitle')}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, marginTop: 1, fontVariantNumeric: 'tabular-nums', ...CLIP }}>
                    {formatCHF(listing.price)}
                    {listing.canton ? ` · ${listing.canton}` : ''}
                  </div>
                </div>
                <AdminPill
                  label={t(`admin:${STATUS_LABEL_KEY[listing.moderation_status] ?? STATUS_LABEL_KEY.published}`)}
                  tone={STATUS_TONE[listing.moderation_status] ?? STATUS_TONE.published}
                />
              </div>
            ))
          )}
        </AdminCard>

        {/* Desktop : table */}
        <AdminCard className="hidden md:block" padding={0} style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <SkeletonRows />
          ) : isError && paginated.length === 0 ? (
            // Une file de modération vide se lit « rien à modérer » : la servir
            // sur une requête en échec masquerait des annonces signalées.
            <AdminError
              message={t('admin:common.loadError')}
              onRetry={() => void refetch()}
              retryLabel={t('admin:common.retry')}
            />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {/* Colonnes vignette et actions : en-tête sans libellé. */}
                    <AdminTh width={82}>{null}</AdminTh>
                    <AdminTh>{t('admin:moderation.table.title')}</AdminTh>
                    <AdminTh width={140}>{t('admin:moderation.table.agency')}</AdminTh>
                    <AdminTh width={120} align="right">{t('admin:moderation.table.price')}</AdminTh>
                    <AdminTh width={74} align="center">{t('admin:moderation.table.canton')}</AdminTh>
                    <AdminTh width={110}>{t('admin:moderation.table.date')}</AdminTh>
                    <AdminTh width={124} align="center">{t('admin:moderation.table.status')}</AdminTh>
                    <AdminTh width={116}>{null}</AdminTh>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((listing) => (
                    <tr key={listing.id} className="admm-row">
                      <AdminTd>
                        <Thumb src={listing.photos[0]} width={64} height={42} />
                      </AdminTd>

                      <AdminTd>
                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, ...CLIP }}>
                          {listing.title || t('admin:common.noTitle')}
                        </div>
                        {listing.city && (
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, ...CLIP }}>{listing.city}</div>
                        )}
                      </AdminTd>

                      <AdminTd style={{ ...CLIP, ...sub }}>{listing.agency_name ?? '-'}</AdminTd>

                      <AdminTd align="right" numeric style={{ ...CLIP, ...sub }}>{formatCHF(listing.price)}</AdminTd>

                      <AdminTd align="center" style={sub}>{listing.canton ?? '-'}</AdminTd>

                      <AdminTd numeric style={{ ...CLIP, ...sub }}>
                        {listing.published_at ? formatDate(listing.published_at) : '-'}
                      </AdminTd>

                      <AdminTd align="center">
                        <AdminPill
                          label={t(`admin:${STATUS_LABEL_KEY[listing.moderation_status] ?? STATUS_LABEL_KEY.published}`)}
                          tone={STATUS_TONE[listing.moderation_status] ?? STATUS_TONE.published}
                        />
                      </AdminTd>

                      {/* Actions révélées au survol ET au focus clavier (classe `admm-act`) */}
                      <AdminTd align="right">
                        <div className="admm-act" style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                          {listing.moderation_status !== 'published' && (
                            <button
                              onClick={(e) => handleApprove(e, listing)}
                              title={t('admin:moderation.action.approve')}
                              style={actBtn}
                            >
                              <AdminIc icon={Check} size={14} color={tones.ok} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openDialog(listing, 'flag') }}
                            title={t('admin:moderation.action.flag')}
                            style={actBtn}
                          >
                            <AdminIc icon={AlertTriangle} size={14} color={tones.warn} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDialog(listing, 'remove') }}
                            title={t('admin:moderation.action.remove')}
                            style={actBtn}
                          >
                            <AdminIc icon={Trash2} size={14} color={tones.err} />
                          </button>
                        </div>
                      </AdminTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <AdminPager page={page} totalPages={totalPages} total={total} perPage={perPage} onPage={setPage} />
        </AdminCard>

        {/* Pagination mobile (cible tactile 44 px) */}
        {!isLoading && totalPages > 1 && (
          // Le `display` reste la SEULE propriété tenue hors du style inline : une
          // déclaration inline bat toute règle de feuille de style non-`!important`,
          // donc un `display: 'flex'` inline neutralisait le `display: none` de
          // `md:hidden` et ce pager mobile s'affichait aussi sur desktop.
          <div className="flex md:hidden" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
            <AdminGhostBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ height: 44 }}
            >
              {t('admin:common.previous')}
            </AdminGhostBtn>
            <span style={{ fontSize: 12, fontWeight: 700, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {page}/{totalPages}
            </span>
            <AdminGhostBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ height: 44 }}
            >
              {t('admin:common.next')}
            </AdminGhostBtn>
          </div>
        )}
        {/* Les files entrantes (leads vendeurs + messages storefront) ont déménagé
            vers « Clients finaux » (P6b) — cette page redevient modération pure. */}
      </AdminPage>

      {/* Moderation dialog */}
      <ModerationActionDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setDialogListing(null) }}
        propertyTitle={dialogListing?.title || t('admin:common.noTitle')}
        propertyPhoto={dialogListing?.photos[0]}
        action={dialogAction}
        onConfirm={handleDialogConfirm}
      />
    </PageTransition>
  )
}
