// P8a — Onglet « Annonces » de la page Communication (super-admin).
// Liste + création/édition (AnnouncementFormModal) + publication/suppression.
//
// Rendu en grammaire Sugar : bentos séparés par l'ombre, sévérité en pilule
// pleine (l'ancien `text-blue-500` / `text-amber-500` / `text-red-500` ne
// tenait pas le contraste en sombre), chiffres et dates tabulaires.

import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Megaphone, Eye, EyeOff, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useAnnouncementsAdmin, type Announcement } from '@/hooks/useAnnouncementsAdmin'
import AnnouncementFormModal from '@/components/admin/AnnouncementFormModal'
import AdminConfirm from '@/components/admin/AdminConfirm'
import { useToast } from '@/components/ui/Toast'
import {
  AdminCard, AdminEmpty, AdminError, AdminIc, AdminPill, AdminSkeleton, AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'

/** Ton de pilule de la sévérité d'une annonce (critique = err, avertissement = warn). */
function severityTone(severity: Announcement['severity']): AdminToneName {
  switch (severity) {
    case 'critical': return 'err'
    case 'warning': return 'warn'
    default: return 'info'
  }
}

/** Onglet « Annonces » : liste des annonces in-app, avec publication, édition et suppression. */
export default function AnnouncementsTab() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSurfaces()
  const { announcements, isLoading, isError, refetch, update, remove } = useAnnouncementsAdmin()
  const toast = useToast()
  // Annonce dont la suppression attend confirmation (`null` = aucune).
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)

  // Les actions de ligne restent discrètes et ne se teintent qu'au survol : les
  // transitions vivent dans la classe, une valeur inline les figerait.
  const hoverCss = `
    .ann-act { color: ${sp.sub}; transition: color .16s ease; }
    .ann-act:hover { color: ${sp.ink}; }
    .ann-del:hover { color: ${tones.err}; }
    /* Révélées au survol ET au focus clavier. En \`group-hover\` seul, les trois
       actions — dont la suppression — restaient invisibles pour qui les
       atteignait au clavier : on tabulait sur des boutons qu'on ne voyait pas. */
    .ann-actions { opacity: 0; }
    .group:hover .ann-actions, .group:focus-within .ann-actions { opacity: 1; }
  `

  const actionBtn: CSSProperties = {
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
      <style>{hoverCss}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AdminSolidBtn icon={Plus} onClick={() => setCreating(true)}>
          {t('announcements.new')}
        </AdminSolidBtn>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <AdminSkeleton key={i} height={92} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : isError && announcements.length === 0 ? (
        <AdminCard>
          <AdminError
            message={t('common.loadError')}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        </AdminCard>
      ) : announcements.length === 0 ? (
        <AdminCard>
          <AdminEmpty icon={Megaphone} title={t('announcements.empty.title')} hint={t('announcements.empty.subtitle')} />
        </AdminCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
          {announcements.map(a => (
            <AdminCard key={a.id} className="group" padding="16px 18px">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-xl)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap', marginBottom: 7 }}>
                    <AdminPill
                      label={t(`announcements.severity.${a.severity}`)}
                      tone={severityTone(a.severity)}
                      style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg)', fontSize: 'var(--crm-text-sm)' }}
                    />
                    {/* Métadonnées en `sp.sub`, contenu en `sp.soft` : contre
                        l'intuition des noms, `soft` (#3F4640 en clair) est PLUS
                        contrasté que `sub` (#7A8079). Les intervertir mettait la
                        date plus en avant que le texte de l'annonce. */}
                    <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(a.starts_at)}
                    </span>
                    {!a.published && (
                      <AdminPill
                        label={t('announcements.draft')}
                        icon={EyeOff}
                        style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg) var(--crm-space-2xs) var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}
                      />
                    )}
                    {(a.audience_plans.length > 0 || a.audience_agencies.length > 0) && (
                      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {t('announcements.targeted', {
                          plans: a.audience_plans.length,
                          agencies: a.audience_agencies.length,
                        })}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate" style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>
                    {a.title}
                  </h3>
                  <p className="line-clamp-2" style={{ margin: '6px 0 0', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.soft, lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                    {a.body}
                  </p>
                </div>
                <div className="ann-actions transition-opacity" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flexShrink: 0 }}>
                  <button
                    onClick={() => update.mutate({ id: a.id, patch: { published: !a.published } }, { onError: () => toast.error(t('common.actionFailed')) })}
                    aria-label={a.published ? t('announcements.unpublish') : t('announcements.publish')}
                    className="ann-act"
                    style={actionBtn}
                  >
                    <AdminIc icon={a.published ? Eye : EyeOff} size={15} />
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    aria-label={t('common.edit')}
                    className="ann-act"
                    style={actionBtn}
                  >
                    <AdminIc icon={Pencil} size={15} />
                  </button>
                  <button
                    onClick={() => setPendingDelete(a.id)}
                    aria-label={t('common.delete')}
                    className="ann-act ann-del"
                    style={actionBtn}
                  >
                    <AdminIc icon={Trash2} size={15} />
                  </button>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AnnouncementFormModal existing={editing} onClose={() => { setCreating(false); setEditing(null) }} />
      )}

      {/* Une annonce supprimée ne se rattrape pas : elle cesse d'être diffusée
          et son historique part avec. Le premier clic ne suffit plus. */}
      <AdminConfirm
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t('announcements.deleteTitle')}
        message={t('announcements.deleteMessage')}
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            remove.mutate(pendingDelete, { onError: () => toast.error(t('common.actionFailed')) })
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
