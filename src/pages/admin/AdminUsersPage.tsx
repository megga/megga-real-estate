/**
 * Page super-admin — annuaire des utilisateurs de la plateforme.
 *
 * Route : `/users`. Table (desktop) / cartes (mobile) avec recherche, filtre par
 * rôle, pagination et export CSV. Un clic sur une ligne ouvre `UserDrawer`
 * (détail + impersonation) ; l'agence renvoie vers sa fiche.
 *
 * Rendu en grammaire Sugar (kit `components/admin/kit`) : le bento se sépare du
 * fond par l'ombre, les rôles sont des pilules pleines, l'avatar est à initiales
 * sur fond encre, et la page active de la pagination est une pilule d'accent
 * NOIR — le violet de la console reste le repère de contexte du rail, jamais une
 * couleur d'action ni un statut.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, Users, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { formatDate } from '@/lib/utils'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import type { AdminUser } from '@/hooks/useAdminUsers'
import UserDrawer from '@/components/admin/UserDrawer'
import PageTransition from '@/components/layout/PageTransition'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminAvatar, AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPill,
  AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'

const ITEMS_PER_PAGE = 10

const ROLE_I18N: Record<string, string> = {
  super_admin: 'common.role.superAdmin',
  admin: 'common.role.admin',
  manager: 'common.role.manager',
  agent: 'common.role.agent',
  assistant: 'common.role.assistant',
}

const ROLE_FILTER_VALUES = ['', 'super_admin', 'admin', 'manager', 'agent', 'assistant']

// Ton de pilule par rôle : seuls les deux rôles à privilèges portent un signal,
// les autres restent neutres. Pas d'accent violet ici — il ne dit que « tu es
// dans la console », pas « ce compte a ce rôle ».
const ROLE_TONE: Record<string, AdminToneName> = {
  super_admin: 'info',
  admin: 'warn',
}

/** Initiales (2 max) tirées du nom complet — la seule entrée de l'avatar Sugar. */
function initialsOf(name: string): string {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/** Lignes squelette affichées pendant le chargement de l'annuaire. */
function SkeletonRows() {
  return (
    <div style={{ display: 'grid', gap: 8, padding: 14 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <AdminSkeleton key={i} height={44} />
      ))}
    </div>
  )
}

/** État vide, distinguant « aucun utilisateur » de « aucun résultat filtré ». */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <AdminEmpty
      icon={Users}
      title={hasFilters ? t('admin:users.empty.titleFiltered') : t('admin:users.empty.title')}
      hint={hasFilters ? t('admin:users.empty.subtitleFiltered') : t('admin:users.empty.subtitle')}
    />
  )
}

/** Page : annuaire utilisateurs filtrable/paginé + drawer de détail au clic sur une ligne. */
export default function AdminUsersPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark } = useAdminSugar()
  const { users, isLoading, isError, refetch } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = [...users]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        u => (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
      )
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter)
    return list
  }, [users, search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function handleRowClick(user: AdminUser) {
    setSelectedUserId(user.id)
  }

  const hasFilters = !!search || !!roleFilter
  const pagerBtn = {
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0,
  } as const

  return (
    <PageTransition>
      <AdminPage
        title={t('admin:users.title')}
        subtitle={isLoading
          ? t('admin:common.loading')
          : t(users.length !== 1 ? 'admin:users.subtitle_plural' : 'admin:users.subtitle', { count: users.length })}
        width="wide"
        actions={(
          <AdminGhostBtn
            icon={Download}
            onClick={() => exportToCsv('megga-utilisateurs', users.map(u => ({
              nom: u.full_name, email: u.email, agence: u.agency_name ?? '',
              role: u.role, date: u.created_at,
            })))}
          >
            {t('admin:common.export')}
          </AdminGhostBtn>
        )}
      >
        <style>{`
          .admu-row { transition: background .15s ease; }
          /* \`!important\` requis : la carte mobile est un <button> qui déclare
             \`background: 'transparent'\` en INLINE pour neutraliser le fond par
             défaut du navigateur, et une déclaration inline bat toute règle
             d'auteur non-important — son survol ne s'appliquait donc jamais. La
             <tr> desktop, elle, n'a pas de fond inline : la règle la couvrait déjà. */
          .admu-row:hover { background: ${dark ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.03)'} !important; }
          .admu-row:focus:not(:focus-visible) { outline: none; }
          .admu-row:focus-visible { outline: 2px solid ${sp.accent}; outline-offset: -2px; }
          .admu-search::placeholder { color: ${sp.sub}; font-weight: 500; }
          .admu-search:focus { box-shadow: inset 0 0 0 2px ${sp.accent}; }
          .admu-link:hover { text-decoration: underline; }
        `}</style>

        {/* Recherche + filtre par rôle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center' }}>
              <AdminIc icon={Search} size={15} color={sp.sub} />
            </span>
            <input
              type="text"
              className="admu-search"
              placeholder={t('admin:users.searchPlaceholder')}
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
            {ROLE_FILTER_VALUES.map((value) => {
              const on = roleFilter === value
              return (
                <button
                  key={value}
                  onClick={() => { setRoleFilter(value); setPage(1) }}
                  style={{
                    height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill, border: 0,
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap',
                    background: on ? sp.accent : surf.card,
                    color: on ? sp.accentInk : sp.soft,
                    boxShadow: on ? 'none' : sp.shadowSm,
                  }}
                >
                  {value ? t(ROLE_I18N[value] ?? 'common.role.agent') : t('admin:common.all')}
                </button>
              )
            })}
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
            paginated.map((user, i) => (
              <button
                key={user.id}
                className="admu-row"
                onClick={() => handleRowClick(user)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                  padding: '12px 14px', border: 0, background: 'transparent',
                  borderTop: i === 0 ? undefined : surf.hairline,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <AdminAvatar
                  initials={initialsOf(user.full_name ?? t('admin:common.user'))}
                  photo={user.avatar_url}
                  alt={user.full_name ?? t('admin:common.noName')}
                  size={32}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.full_name ?? t('admin:common.noName')}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t(ROLE_I18N[user.role] ?? 'common.role.agent')}
                    {user.agency_name && ` · ${user.agency_name}`}
                  </div>
                </div>
              </button>
            ))
          )}
        </AdminCard>

        {/* Desktop : table */}
        <AdminCard className="hidden md:block" padding={0} style={{ overflow: 'hidden' }}>
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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <AdminTh>{t('admin:users.table.name')}</AdminTh>
                    <AdminTh width={230}>{t('admin:users.table.email')}</AdminTh>
                    <AdminTh width={170}>{t('admin:users.table.agency')}</AdminTh>
                    <AdminTh width={130}>{t('admin:users.table.role')}</AdminTh>
                    <AdminTh width={120}>{t('admin:users.table.registration')}</AdminTh>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((user) => (
                    // La ligne entière ouvre le drawer. `role="button"` + `tabIndex`
                    // rendent à la <tr> la sémantique et l'accès clavier que portait
                    // le <button> d'avant, `aria-label` lui donne un nom (sans lui,
                    // un lecteur d'écran annonce « ligne » sans dire ce qu'Entrée
                    // déclenche) et `aria-haspopup` annonce le tiroir qui s'ouvre.
                    //
                    // Le garde `e.target !== e.currentTarget` est indispensable : le
                    // keydown du <Link> agence REMONTE jusqu'ici, et `preventDefault()`
                    // y annulait le clic que le navigateur synthétise sur le <a> —
                    // Entrée sur le lien ouvrait le tiroir au lieu de naviguer.
                    <tr
                      key={user.id}
                      className="admu-row"
                      role="button"
                      tabIndex={0}
                      aria-label={user.full_name ?? t('admin:common.noName')}
                      aria-haspopup="dialog"
                      onClick={() => handleRowClick(user)}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(user) }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <AdminTd>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                          <AdminAvatar
                            initials={initialsOf(user.full_name ?? t('admin:common.user'))}
                            photo={user.avatar_url}
                            alt={user.full_name ?? t('admin:common.noName')}
                            size={30}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.full_name ?? t('admin:common.noName')}
                            </div>
                            {user.phone && (
                              <div style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </AdminTd>

                      {/* Le plafond de largeur est porté par un bloc INTERNE, pas par
                          la cellule : en layout automatique, une cellule de tableau
                          ignore `max-width` (CSS 2.1 §17.5.2) — la colonne poussait
                          donc la table au lieu de tronquer. Sur un bloc ordinaire, la
                          contrainte tient, et `title` garde lisible au survol ce que
                          l'ellipsis coupe. Pas de `tableLayout: 'fixed'` ici : les
                          quatre largeurs fixes des <th> totalisent déjà plus que la
                          place disponible à côté du rail de 300 px, et la colonne du
                          nom — la seule sans largeur — serait écrasée à zéro. */}
                      <AdminTd style={{ color: sp.sub }}>
                        <span
                          title={user.email}
                          style={{ display: 'block', maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {user.email}
                        </span>
                      </AdminTd>

                      <AdminTd>
                        {user.agency_name ? (
                          // Même mécanique que la colonne e-mail. Le plafond est sur le
                          // bloc, pas sur le lien : un `<a>` passé en `block` étendrait
                          // sa zone cliquable à toute la cellule, et naviguer prendrait
                          // le pas sur l'ouverture du tiroir sur la partie vide.
                          <span style={{ display: 'block', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Link
                              to={`${ADMIN_CONSOLE_PATH}/agencies/${user.agency_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="admu-link"
                              title={user.agency_name}
                              style={{ color: sp.ink, fontWeight: 600, textDecoration: 'none' }}
                            >
                              {user.agency_name}
                            </Link>
                          </span>
                        ) : (
                          <span style={{ color: sp.sub }}>—</span>
                        )}
                      </AdminTd>

                      <AdminTd>
                        <AdminPill
                          label={t(ROLE_I18N[user.role] ?? 'common.role.agent')}
                          tone={ROLE_TONE[user.role] ?? 'neutral'}
                        />
                      </AdminTd>

                      <AdminTd numeric style={{ color: sp.sub, whiteSpace: 'nowrap' }}>
                        {formatDate(user.created_at)}
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
          <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
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
      </AdminPage>

      {/* Drawer */}
      {selectedUserId && (
        <UserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </PageTransition>
  )
}
