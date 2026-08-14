/**
 * Drawer latéral de gestion d'un utilisateur (section super-admin).
 *
 * Rendu via `createPortal` (z-100, focus trap, Escape/clic overlay pour fermer).
 * Affiche l'identité, permet le changement de rôle, l'impersonation (audit-first),
 * l'export DSAR (nLPD art. 25) et les actions de cycle de vie
 * (suspendre / réinitialiser le mot de passe / supprimer), plus la timeline d'activité.
 *
 * Habillage en grammaire Sugar (kit `admin/kit`) : panneau posé sur son ombre
 * sans bordure, bento d'identité séparé par des filets, statuts en pilules
 * pleines et tons fonctionnels (`tones.warn` / `tones.err`) au lieu des
 * `text-amber-500` / `text-red-500`. L'impersonation est l'action PRINCIPALE du
 * panneau : elle prend l'accent noir de Sugar, pas le violet de la console (qui
 * ne dit que « tu es dans la plateforme »).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { X, Mail, Phone, Building2, Clock, Eye, FileDown, Ban, KeyRound, Trash2 } from 'lucide-react'
import { formatDate, formatRelativeDate } from '@/lib/utils'
import { useAdminUsers, useUserActivity, useDsarExport } from '@/hooks/useAdminUsers'
import { consentView, ORG_ROLES, ROLE_LABEL_KEY, displayName } from '@/lib/adminUserRegistry'
import { useAdminUserLifecycle } from '@/hooks/useAdminUserLifecycle'
import { ADMIN_CONSOLE_PATH, openImpersonation } from '@/lib/adminEntry'
import AdminConfirm from '@/components/admin/AdminConfirm'
import { useToast } from '@/components/ui/Toast'
import {
  AdminAvatar, AdminCard, AdminEmpty, AdminGhostBtn, AdminIc, AdminPill,
  AdminSkeleton, AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'


interface UserDrawerProps {
  userId: string
  onClose: () => void
}

/** Initiales (2 max) tirées du nom complet — la seule entrée de l'avatar Sugar. */
function initialsOf(name: string): string {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/** Ligne du bento d'identité : icône, libellé, valeur. Filet au-dessus sauf la première. */
function InfoRow({ icon, label, first, children }: {
  icon: LucideIcon
  label: string
  first?: boolean
  children: ReactNode
}) {
  const { sp, surf } = useAdminSugar()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderTop: first ? undefined : surf.hairline }}>
      <AdminIc icon={icon} size={15} color={sp.sub} />
      <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, width: 76, flexShrink: 0 }}>{label}</span>
      <span style={{ minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </span>
    </div>
  )
}

/** Panneau de détail/gestion d'un compte, résolu depuis la liste `useAdminUsers` par `userId`. */
export default function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
  const { users, updateRole } = useAdminUsers()
  const { data: activity, isLoading: activityLoading } = useUserActivity(userId)
  const dsarExport = useDsarExport()
  const { lifecycle, deleteAccount } = useAdminUserLifecycle()
  const toast = useToast()

  const user = users.find(u => u.id === userId)

  /**
   * Compte PROTÉGÉ : l'edge refuse sur lui les TROIS gestes de cycle de vie.
   * Proxy assumé de l'allowlist super-admin — voir la note du bloc de gestes.
   */
  const protege = user?.role === 'super_admin'
  const focusTrapRef = useFocusTrap(true)
  // Action destructive en attente de confirmation (`null` = aucune).
  const [confirming, setConfirming] = useState<'suspend' | 'delete' | null>(null)

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleRoleChange(newRole: string) {
    updateRole.mutate({ id: userId, role: newRole })
  }

  const fullWidthBtn = { width: '100%', justifyContent: 'center' } as const

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex justify-end">
      <style>{`
        .audr-ev { transition: background .15s ease; }
        .audr-ev:hover { background: ${sgVoileEncre(dark, 0.045)}; }
        .audr-sel:focus { box-shadow: inset 0 0 0 2px ${sp.accent}; }
        .audr-link:hover { text-decoration: underline; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: dark ? 'rgba(0,0,4,.68)' : 'rgba(14,20,16,.42)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={focusTrapRef}
        className="relative w-[380px] max-w-full h-full overflow-y-auto scrollbar-hide"
        style={{
          // Tiroir = surface flottante : palier haut, pas le canvas — au fond de
          // page il ne se détachait pas de ce qu'il recouvre.
          background: sp.solidBg, boxShadow: sp.solidShadow,
          // Le drawer est porté sur `document.body`, hors du conteneur du shell :
          // il doit redéclarer la police et les chiffres tabulaires de la console.
          fontFamily: '"Inter Tight", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={t('userDrawer.close')}
          style={{
            position: 'absolute', top: 14, right: 14, width: 30, height: 30,
            borderRadius: ADMIN_RADII.pill, border: 0, background: surf.cardSub,
            cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 1,
          }}
        >
          <AdminIc icon={X} size={14} color={sp.sub} />
        </button>

        {!user ? (
          <AdminEmpty title={t('userDrawer.notFound')} />
        ) : (
          <div style={{ padding: '22px 18px 26px', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
            {/* User header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--crm-space-lg)', paddingTop: 'var(--crm-space-md)' }}>
              <AdminAvatar initials={initialsOf(user.full_name ?? 'Utilisateur')} photo={user.avatar_url} size={64} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, letterSpacing: -0.5, color: sp.ink, lineHeight: 1.2 }}>
                  {user.full_name ?? t('common.noName')}
                </h2>
                {user.is_suspended && (
                  <AdminPill label={t('common.status.suspended')} tone="err" />
                )}
                <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub, wordBreak: 'break-all' }}>{user.email}</p>
              </div>
            </div>

            {/* Info fields */}
            <AdminCard padding={0} style={{ overflow: 'hidden' }}>
              <InfoRow icon={Phone} label={t('userDrawer.phone')} first>
                {user.phone || <span style={{ color: sp.sub, fontWeight: 500 }}>{t('common.notProvided')}</span>}
              </InfoRow>

              <InfoRow icon={Mail} label={t('userDrawer.email')}>
                {user.email}
              </InfoRow>

              <InfoRow icon={Building2} label={t('userDrawer.agency')}>
                {user.agency_name && user.agency_id ? (
                  <Link
                    to={`${ADMIN_CONSOLE_PATH}/agencies/${user.agency_id}`}
                    onClick={onClose}
                    className="audr-link"
                    style={{ color: sp.ink, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {user.agency_name}
                  </Link>
                ) : (
                  <span style={{ color: sp.sub, fontWeight: 500 }}>{t('common.none')}</span>
                )}
              </InfoRow>

              <InfoRow icon={Clock} label={t('userDrawer.registration')}>
                {formatRelativeDate(user.created_at)}
              </InfoRow>
            </AdminCard>

            {/* Role selector */}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub, marginBottom: 7 }}>
                {t('userDrawer.role')}
              </label>
              <select
                value={user.role ?? 'agent'}
                onChange={(e) => handleRoleChange(e.target.value)}
                disabled={updateRole.isPending}
                className="audr-sel"
                style={{
                  width: '100%', height: 38, padding: '0 var(--crm-space-lg)', boxSizing: 'border-box',
                  borderRadius: ADMIN_RADII.row, border: 0, background: surf.cardSub,
                  color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                  outline: 'none', cursor: updateRole.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateRole.isPending ? 0.6 : 1,
                }}
              >
                {ORG_ROLES.map((r) => (
                  <option key={r} value={r}>{t(ROLE_LABEL_KEY[r])}</option>
                ))}
              </select>
              {updateRole.isError && (
                <p style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tones.err }}>
                  {t('userDrawer.roleUpdateError')}
                </p>
              )}
            </div>

            {/* Impersonate button */}
            <AdminSolidBtn
              icon={Eye}
              onClick={() => {
                // Nouvel onglet : la console reste ouverte à côté. C'est le CRM
                // qui journalise (audit-first, RPC admin_log_impersonation)
                // avant d'activer quoi que ce soit.
                openImpersonation(user.id)
                onClose()
              }}
              style={fullWidthBtn}
            >
              {t('userDrawer.impersonate')}
            </AdminSolidBtn>

            {/* Export DSAR (nLPD art. 25) — JSON journalisé côté serveur */}
            <AdminGhostBtn
              icon={FileDown}
              onClick={() =>
                dsarExport.mutate(
                  { userId: user.id, email: user.email },
                  { onError: () => toast.error(t('userDrawer.dsarExportError')) },
                )
              }
              disabled={dsarExport.isPending}
              style={fullWidthBtn}
            >
              {dsarExport.isPending ? t('userDrawer.dsarExporting') : t('userDrawer.dsarExport')}
            </AdminGhostBtn>

            {/* Cycle de vie du compte (P4) — actions journalisées serveur.
                ⛔ MESURÉ : la garde anti-lockout d'`admin-user-lifecycle` est posée
                AVANT le switch d'action (index.ts:69), elle refuse donc en 403
                `suspend`, `reactivate` ET `force_password_reset` sur un compte
                allowlisté — pas seulement la suppression, comme le laissait croire
                l'ancienne note. Sur ce déploiement, l'unique compte allowlisté est
                l'opérateur lui-même : sans ce garde-fou, le bouton principal du
                premier compte de la liste échouait en silence.
                ⚠ `role === 'super_admin'` est un PROXY de l'allowlist, pas
                l'allowlist : un e-mail allowlisté au profil `admin` serait refusé
                sans signal. Les deux coïncident aujourd'hui. */}
            {/* Les trois actions sont empilées pleine largeur : à 380 px de
                panneau, deux colonnes ne tiennent pas « Reset mot de passe »
                (et encore moins sa traduction allemande) sans débordement. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-2xl)', borderTop: surf.hairline }}>
              <AdminGhostBtn
                onClick={() => {
                  // Réactiver rend un accès, ce n'est pas destructeur : pas de
                  // confirmation. Suspendre coupe la connexion, donc si.
                  if (user.is_suspended) {
                    lifecycle.mutate(
                      { action: 'reactivate', userId: user.id },
                      {
                        onSuccess: () => toast.success(t('userDrawer.lifecycle.done')),
                        onError: () => toast.error(t('userDrawer.lifecycle.error')),
                      },
                    )
                    return
                  }
                  setConfirming('suspend')
                }}
                disabled={lifecycle.isPending || protege}
                style={{ ...fullWidthBtn, color: user.is_suspended ? sp.ink : tones.warn }}
              >
                <AdminIc icon={Ban} size={15} color={user.is_suspended ? sp.ink : tones.warn} />
                {user.is_suspended ? t('userDrawer.lifecycle.reactivate') : t('userDrawer.lifecycle.suspend')}
              </AdminGhostBtn>
              <AdminGhostBtn
                icon={KeyRound}
                onClick={() =>
                  lifecycle.mutate(
                    { action: 'force_password_reset', userId: user.id },
                    {
                      onSuccess: () => toast.success(t('userDrawer.lifecycle.resetSent')),
                      onError: () => toast.error(t('userDrawer.lifecycle.error')),
                    },
                  )
                }
                disabled={lifecycle.isPending || protege}
                style={fullWidthBtn}
              >
                {t('userDrawer.lifecycle.resetPassword')}
              </AdminGhostBtn>
              <AdminGhostBtn
                onClick={() => setConfirming('delete')}
                disabled={deleteAccount.isPending || protege}
                style={{ ...fullWidthBtn, color: tones.err }}
              >
                <AdminIc icon={Trash2} size={15} color={tones.err} />
                {deleteAccount.isPending ? t('userDrawer.lifecycle.deleting') : t('userDrawer.lifecycle.delete')}
              </AdminGhostBtn>
              {protege && (
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
                  {t('userDrawer.protectedNote')}
                </div>
              )}
            </div>

            {/* Consentements nLPD — ce que le compte a accepté, et quand.
                ⛔ Le marketing ne rend JAMAIS « refusé » : aucun chemin
                d'inscription ne pose de case marketing, donc l'absence de ligne
                signifie « jamais demandé », pas un refus. */}
            <div style={{ paddingTop: 'var(--crm-space-2xl)', borderTop: surf.hairline }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, marginBottom: 9 }}>
                {t('userDrawer.consents.title')}
              </div>
              {(() => {
                const c = consentView(user.consents, user.marketing)
                return ([['terms', c.terms], ['privacy', c.privacy], ['marketing', c.marketing]] as const).map(([cle, etat]) => (
                  <div key={cle} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)', minHeight: 26 }}>
                    <span style={{ minWidth: 132, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>
                      {t(`userDrawer.consents.${cle}`)}
                    </span>
                    <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
                      {etat.kind === 'accepted'
                        ? (etat.version
                            ? t('userDrawer.consents.acceptedVersion', { version: etat.version, date: etat.at ? formatDate(etat.at) : '—' })
                            : t('userDrawer.consents.accepted', { date: etat.at ? formatDate(etat.at) : '—' }))
                        : etat.kind === 'notAsked'
                          ? t('userDrawer.consents.notAsked')
                          : t('userDrawer.consents.notRecorded')}
                    </span>
                  </div>
                ))
              })()}
            </div>

            {/* Activity timeline */}
            <div>
              <h3 style={{ margin: '0 0 10px', fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub }}>
                {t('userDrawer.recentActivity')}
              </h3>

              {activityLoading ? (
                <div style={{ display: 'grid', gap: 'var(--crm-space-md)' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <AdminSkeleton key={i} height={38} />
                  ))}
                </div>
              ) : !activity || activity.length === 0 ? (
                <AdminEmpty title={t('userDrawer.noActivity')} />
              ) : (
                <div style={{ display: 'grid', gap: 'var(--crm-space-2xs)' }}>
                  {activity.map((event) => (
                    <div
                      key={event.id}
                      className="audr-ev"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: ADMIN_RADII.row }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: ADMIN_RADII.pill, background: sp.accent, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.ink, lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{event.action}</span>
                          {event.entity_type && (
                            <span style={{ color: sp.sub }}> {t('userDrawer.actionOn')} {event.entity_type}</span>
                          )}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
                          {formatRelativeDate(event.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmations des actions irréversibles. Montées ici, dans le portal du
          tiroir : le tiroir reste visible derrière, donc on voit de QUI il est
          question au moment de trancher. */}
      {user && (
        <>
          <AdminConfirm
            open={confirming === 'suspend'}
            onClose={() => setConfirming(null)}
            title={t('userDrawer.lifecycle.suspendTitle')}
            message={t('userDrawer.lifecycle.suspendConfirm', { name: displayName(user.full_name, user.email) })}
            confirmLabel={t('userDrawer.lifecycle.suspend')}
            tone="warn"
            busy={lifecycle.isPending}
            onConfirm={() => {
              lifecycle.mutate(
                { action: 'suspend', userId: user.id },
                {
                  onSuccess: () => { toast.success(t('userDrawer.lifecycle.done')); setConfirming(null) },
                  onError: () => { toast.error(t('userDrawer.lifecycle.error')); setConfirming(null) },
                },
              )
            }}
          />
          <AdminConfirm
            open={confirming === 'delete'}
            onClose={() => setConfirming(null)}
            title={t('userDrawer.lifecycle.deleteTitle')}
            message={t('userDrawer.lifecycle.deletePrompt', { email: user.email })}
            confirmLabel={t('userDrawer.lifecycle.delete')}
            // L'e-mail exact reste exigé, mais il bloque le bouton au lieu
            // d'être reproché après coup comme le faisait `window.prompt`.
            requireText={user.email}
            requireTextLabel={t('userDrawer.lifecycle.deleteTypeEmail')}
            busy={deleteAccount.isPending}
            busyLabel={t('userDrawer.lifecycle.deleting')}
            onConfirm={() => {
              deleteAccount.mutate(
                { userId: user.id },
                {
                  onSuccess: () => {
                    toast.success(t('userDrawer.lifecycle.deleted'))
                    setConfirming(null)
                    onClose()
                  },
                  onError: () => { toast.error(t('userDrawer.lifecycle.error')); setConfirming(null) },
                },
              )
            }}
          />
        </>
      )}
    </div>,
    document.body
  )
}
