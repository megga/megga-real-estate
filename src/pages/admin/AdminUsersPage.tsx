/**
 * Page super-admin — registre des comptes (maquette `admin-users.jsx`).
 *
 * Route : `/dashboard/admin/users`. Même grammaire que le registre des agences
 * (C5) : outils et table posés à MÊME le fond, aucune carte, aucune couture.
 * Un clic sur une ligne ouvre le tiroir du compte.
 *
 * ── Écarts et constats assumés, nommés plutôt que tus ──
 *
 * É1 · **Les colonnes « E-mail » et « Inscription » disparaissent** au profit
 *      d'un compte (nom + e-mail sur deux lignes) et d'une **dernière
 *      activité** : la maquette juge qu'une date d'inscription n'aide à rien
 *      quand on cherche qui ne se connecte plus.
 * É2 · **La ligne d'anomalies remplace le filtre par rôle** comme entrée
 *      principale. Les chips comptent des comptes à traiter — suspendus, jamais
 *      connectés, dormants — au lieu de trier par un attribut qui ne pose
 *      aucune question.
 * É3 · **Aucun libellé de droits par rôle**, ni ici ni dans le tiroir. Mesuré :
 *      aucune policy RLS ne mentionne `manager` ni `assistant`, et les lectures
 *      métier sont scopées par AGENCE, aveugles au rôle. Décrire « ce que ce
 *      rôle contrôle » aurait affirmé des restrictions inexistantes — par
 *      exemple qu'un agent ne voit pas les dossiers de ses collègues, alors que
 *      la policy lui donne toute l'agence.
 * É4 · **La vue mobile en cartes est retirée**, comme sur le registre des
 *      agences (C5) : la console assume le desktop. C'était tacite depuis C5,
 *      c'est écrit ici.
 * É5 · **Trois rôles de clients finaux** (`buyer`, `seller`, `particulier`)
 *      s'affichent mais ne sont jamais proposés au changement : ils existent en
 *      base, la RPC les accepte, mais ce ne sont pas des rôles d'organisation.
 * É6 · **Ce que l'écran montrera vraiment** : sept comptes, dont deux sans nom
 *      (`full_name` vide en base, jamais nul — le repli teste donc la chaîne
 *      vide), un seul par agence, et un compte `buyer` que le tri doit ranger
 *      sans produire un ordre indéfini.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { useAdminUsers, type AdminUser } from '@/hooks/useAdminUsers'
import {
  userFlag,
  compareUsers,
  displayName,
  activityView,
  USER_FLAG_ORDER,
  USER_FLAG_KEY,
  USER_FLAG_TONE,
  ROLE_LABEL_KEY,
  type UserFlagId,
} from '@/lib/adminUserRegistry'
import UserDrawer from '@/components/admin/UserDrawer'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminAvatar,
  AdminEmpty,
  AdminError,
  AdminPill,
  AdminSearchInput,
  AdminSegmentBtn,
  AdminSkeleton,
  AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

/** Lignes rendues avant le « voir les N autres » (grammaire C5). */
const SHOW = 20

/** Ton de pilule par rôle : seuls les rôles à privilèges portent un signal. */
const ROLE_TONE: Record<string, AdminToneName> = {
  super_admin: 'cyan',
  admin: 'info',
}

export default function AdminUsersPage() {
  const { t } = useTranslation('admin')
  const { users, isLoading, isError, refetch } = useAdminUsers()
  const { sp, surf, tones } = useAdminSugar()

  const [search, setSearch] = useState('')
  const [flag, setFlag] = useState<UserFlagId | null>(null)
  const [tout, setTout] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)

  const sansNom = t('common.noName')

  /** Drapeau d'un compte — calculé une fois, servant les compteurs ET le filtre. */
  const drapeaux = useMemo(() => {
    const m = new Map<string, UserFlagId | null>()
    for (const u of users) {
      m.set(u.id, userFlag({ suspended: u.is_suspended, last: u.last_activity_at, stale_days: u.stale_days }))
    }
    return m
  }, [users])

  const comptes = useMemo(() => {
    const c: Record<string, number> = { all: users.length }
    for (const f of USER_FLAG_ORDER) c[f] = 0
    for (const v of drapeaux.values()) if (v) c[v] += 1
    return c
  }, [users, drapeaux])

  const filtres = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter(u => (flag ? drapeaux.get(u.id) === flag : true))
      .filter(u => !q || [u.full_name, u.email, u.agency_name].some(v => (v ?? '').toLowerCase().includes(q)))
      .map(u => ({ u, tri: { agency: u.agency_name, role: u.role, name: u.full_name } }))
      .sort((a, b) => compareUsers(a.tri, b.tri))
      .map(x => x.u)
  }, [users, flag, search, drapeaux])

  const visibles = tout ? filtres : filtres.slice(0, SHOW)
  const reste = filtres.length - visibles.length

  const th = { bg: sp.pageBg }
  const cellule: CSSProperties = {
    padding: '12px', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink,
    borderTop: surf.hairline, verticalAlign: 'middle',
  }

  const ligne = (u: AdminUser) => {
    const nom = displayName(u.full_name, sansNom)
    const activite = activityView({ last: u.last_activity_at, stale_days: u.stale_days })
    const f = drapeaux.get(u.id) ?? null

    return (
      <tr
        key={u.id}
        className="adm-row"
        onClick={() => setOuvert(u.id)}
        style={{ cursor: 'pointer' }}
        aria-label={nom}
      >
        {/* Compte — avatar, nom, e-mail, et l'anomalie s'il y en a une */}
        <td style={cellule}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <AdminAvatar initials={nom.slice(0, 2).toUpperCase()} photo={u.avatar_url ?? undefined} alt={nom} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>{nom}</span>
                {f && <AdminPill label={t(USER_FLAG_KEY[f])} tone={USER_FLAG_TONE[f]} />}
              </div>
              <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email}
              </div>
            </div>
          </div>
        </td>

        <td style={{ ...cellule, fontWeight: 500, color: sp.sub, fontSize: 'var(--crm-text-xs)' }}>
          {u.agency_name ?? t('users.platform')}
        </td>

        <td style={cellule}>
          <AdminPill
            label={t(ROLE_LABEL_KEY[u.role] ?? u.role, { defaultValue: u.role })}
            tone={ROLE_TONE[u.role] ?? 'neutral'}
          />
        </td>

        {/* Dernière activité — un fait, et son absence dite plutôt que masquée */}
        <td style={{ ...cellule, fontWeight: 500, fontSize: 'var(--crm-text-xs)', whiteSpace: 'nowrap', color: activite.kind === 'recent' ? sp.sub : tones.warn }}>
          {activite.kind === 'none'
            ? t('users.activity.never')
            : activite.kind === 'stale'
              ? `${formatRelativeDate(activite.at as string)} · ${t('users.activity.stale')}`
              : formatRelativeDate(activite.at as string)}
        </td>
      </tr>
    )
  }

  return (
    <AdminPage
      title={t('users.title')}
      subtitle={t('users.subtitle', { count: users.length })}
      width="wide"
    >
      {/* Outils à même le fond — chips d'ANOMALIE, pas de rôle (É2) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px 12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <AdminSegmentBtn on={flag === null} onClick={() => { setFlag(null); setTout(false) }}>
            {t('users.filter.all')} · {comptes.all}
          </AdminSegmentBtn>
          {USER_FLAG_ORDER.map(f => (
            <AdminSegmentBtn key={f} on={flag === f} onClick={() => { setFlag(f); setTout(false) }}>
              {t(USER_FLAG_KEY[f])} · {comptes[f]}
            </AdminSegmentBtn>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <AdminSearchInput
            value={search}
            onChange={v => { setSearch(v); setTout(false) }}
            placeholder={t('users.searchPlaceholder')}
            label={t('users.searchPlaceholder')}
            maxWidth={240}
            compact
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <AdminSkeleton key={i} height={52} />)}
        </div>
      ) : isError && users.length === 0 ? (
        <AdminError message={t('common.loadError')} onRetry={() => void refetch()} retryLabel={t('common.retry')} />
      ) : filtres.length === 0 ? (
        <AdminEmpty icon={Users} title={t('users.empty.title')} />
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <AdminTh width={280} {...th}>{t('users.table.account')}</AdminTh>
                <AdminTh width={180} {...th}>{t('users.table.agency')}</AdminTh>
                <AdminTh width={140} {...th}>{t('users.table.role')}</AdminTh>
                <AdminTh width={180} {...th}>{t('users.table.activity')}</AdminTh>
              </tr>
            </thead>
            <tbody>{visibles.map(ligne)}</tbody>
          </table>

          {reste > 0 && (
            <button
              type="button"
              className="adm-row"
              onClick={() => setTout(true)}
              style={{
                marginTop: 12, alignSelf: 'flex-start', border: 0, background: 'transparent',
                padding: '7px 10px', borderRadius: ADMIN_RADII.pill, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
              }}
            >
              {t('users.showMore', { count: reste })}
            </button>
          )}
        </>
      )}

      {ouvert && <UserDrawer userId={ouvert} onClose={() => setOuvert(null)} />}
    </AdminPage>
  )
}
