/**
 * Page super-admin — modération marketplace.
 *
 * Route : `/dashboard/admin/marketplace`.
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
import { Search, ShieldCheck, AlertTriangle, Trash2, Check, Building2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { formatCHF, formatDate } from '@/lib/utils'
import { useAdminModeration } from '@/hooks/useAdminModeration'
import type { ModerationListing } from '@/hooks/useAdminModeration'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import ModerationActionDialog from '@/components/admin/ModerationActionDialog'
import PageTransition from '@/components/layout/PageTransition'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminGhostBtn, AdminIc, AdminPill, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

const ITEMS_PER_PAGE = 15

const STATUS_FILTER_KEYS = [
  { value: '', key: 'marketplace.filter.all' },
  { value: 'published', key: 'marketplace.filter.published' },
  { value: 'flagged', key: 'marketplace.filter.flagged' },
  { value: 'removed', key: 'marketplace.filter.removed' },
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
      title={hasFilters ? t('admin:marketplace.empty.titleFiltered') : t('admin:marketplace.empty.title')}
      hint={hasFilters ? t('admin:marketplace.empty.subtitleFiltered') : t('admin:marketplace.empty.subtitle')}
    />
  )
}

/** Page de modération : recherche + filtre statut, table responsive, dialog de confirmation. */
export default function AdminMarketplacePage() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
  const { listings, isLoading, stats, statsLoading, moderate } = useAdminModeration()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

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
  const pagerBtn = {
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0,
  } as const
  // Action de ligne : pastille creuse, le signal vient de la teinte de l'icône.
  const actBtn = {
    width: 26, height: 26, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: surf.cardSub, display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer',
  } as const

  return (
    <PageTransition>
      <AdminPage
        title={t('admin:marketplace.title')}
        subtitle={isLoading ? t('admin:common.loading') : t('admin:marketplace.subtitle', { count: listings.length })}
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
          .admm-search::placeholder { color: ${sp.sub}; font-weight: 500; }
          .admm-search:focus { box-shadow: inset 0 0 0 2px ${sp.accent}; }
        `}</style>

        {/* Indicateurs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <AdminKpiCard
            label={t('admin:marketplace.kpi.published')}
            value={statsLoading ? '-' : (stats?.totalPublished ?? 0)}
            icon={ShieldCheck}
          />
          <AdminKpiCard
            label={t('admin:marketplace.kpi.flaggedThisMonth')}
            value={statsLoading ? '-' : (stats?.flaggedThisMonth ?? 0)}
            icon={AlertTriangle}
            variant={stats?.flaggedThisMonth ? 'danger' : 'default'}
          />
          <AdminKpiCard
            label={t('admin:marketplace.kpi.removedThisMonth')}
            value={statsLoading ? '-' : (stats?.removedThisMonth ?? 0)}
            icon={Trash2}
            variant={stats?.removedThisMonth ? 'danger' : 'default'}
          />
        </div>

        {/* Recherche + filtre de statut */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center' }}>
              <AdminIc icon={Search} size={15} color={sp.sub} />
            </span>
            <input
              type="text"
              className="admm-search"
              placeholder={t('admin:marketplace.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{
                width: '100%', height: 36, padding: '0 12px 0 35px', boxSizing: 'border-box',
                borderRadius: ADMIN_RADII.row, border: 0, background: surf.cardSub,
                color: sp.ink, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                outline: 'none', transition: 'box-shadow .16s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTER_KEYS.map((f) => {
              const on = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1) }}
                  style={{
                    height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill, border: 0,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: on ? sp.accent : surf.card,
                    color: on ? sp.accentInk : sp.soft,
                    boxShadow: on ? 'none' : sp.shadowSm,
                  }}
                >
                  {t(`admin:${f.key}`)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile : cartes dans un seul bento */}
        <AdminCard className="md:hidden" padding={0} style={{ overflow: 'hidden' }}>
          {isLoading ? (
            <SkeletonRows />
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
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    {/* Colonnes vignette et actions : en-tête sans libellé. */}
                    <AdminTh width={82}>{null}</AdminTh>
                    <AdminTh>{t('admin:marketplace.table.title')}</AdminTh>
                    <AdminTh width={140}>{t('admin:marketplace.table.agency')}</AdminTh>
                    <AdminTh width={120} align="right">{t('admin:marketplace.table.price')}</AdminTh>
                    <AdminTh width={74} align="center">{t('admin:marketplace.table.canton')}</AdminTh>
                    <AdminTh width={110}>{t('admin:marketplace.table.date')}</AdminTh>
                    <AdminTh width={124} align="center">{t('admin:marketplace.table.status')}</AdminTh>
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
                              title={t('admin:marketplace.action.approve')}
                              style={actBtn}
                            >
                              <AdminIc icon={Check} size={14} color={tones.ok} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openDialog(listing, 'flag') }}
                            title={t('admin:marketplace.action.flag')}
                            style={actBtn}
                          >
                            <AdminIc icon={AlertTriangle} size={14} color={tones.warn} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDialog(listing, 'remove') }}
                            title={t('admin:marketplace.action.remove')}
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

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '11px 14px', borderTop: surf.hairline,
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} {t('admin:common.on')} {filtered.length}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label={t('admin:common.previousPage')}
                  style={{ ...pagerBtn, cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.4 : 1 }}
                >
                  <AdminIc icon={ChevronLeft} size={15} color={sp.soft} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1]
                    const showEllipsis = prev !== undefined && p - prev > 1
                    const on = p === safePage
                    return (
                      <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                        {showEllipsis && (
                          <span style={{ padding: '0 4px', fontSize: 11.5, fontWeight: 600, color: sp.sub }}>...</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          style={{
                            minWidth: 28, height: 28, padding: '0 8px', borderRadius: ADMIN_RADII.pill,
                            border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5,
                            fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            background: on ? sp.accent : 'transparent',
                            color: on ? sp.accentInk : sp.soft,
                          }}
                        >
                          {p}
                        </button>
                      </span>
                    )
                  })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label={t('admin:common.nextPage')}
                  style={{ ...pagerBtn, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.4 : 1 }}
                >
                  <AdminIc icon={ChevronRight} size={15} color={sp.soft} />
                </button>
              </div>
            </div>
          )}
        </AdminCard>

        {/* Pagination mobile (cible tactile 44 px) */}
        {!isLoading && filtered.length > ITEMS_PER_PAGE && (
          // Le `display` reste la SEULE propriété tenue hors du style inline : une
          // déclaration inline bat toute règle de feuille de style non-`!important`,
          // donc un `display: 'flex'` inline neutralisait le `display: none` de
          // `md:hidden` et ce pager mobile s'affichait aussi sur desktop.
          <div className="flex md:hidden" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
            <AdminGhostBtn
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{ height: 44 }}
            >
              {t('admin:common.previous')}
            </AdminGhostBtn>
            <span style={{ fontSize: 12, fontWeight: 700, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {safePage}/{totalPages}
            </span>
            <AdminGhostBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
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
