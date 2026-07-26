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
import {
  AdminCard, AdminEmpty, AdminIc, AdminPill, AdminSkeleton, AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

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
  const { sp, tones } = useAdminSugar()
  const { announcements, isLoading, update, remove } = useAnnouncementsAdmin()
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)

  // Les actions de ligne restent discrètes et ne se teintent qu'au survol : les
  // transitions vivent dans la classe, une valeur inline les figerait.
  const hoverCss = `
    .ann-act { color: ${sp.sub}; transition: color .16s ease; }
    .ann-act:hover { color: ${sp.ink}; }
    .ann-del:hover { color: ${tones.err}; }
  `

  const actionBtn: CSSProperties = {
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{hoverCss}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AdminSolidBtn icon={Plus} onClick={() => setCreating(true)}>
          {t('announcements.new')}
        </AdminSolidBtn>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <AdminSkeleton key={i} height={92} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <AdminCard>
          <AdminEmpty icon={Megaphone} title={t('announcements.empty.title')} hint={t('announcements.empty.subtitle')} />
        </AdminCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {announcements.map(a => (
            <AdminCard key={a.id} className="group" padding="16px 18px">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                    <AdminPill
                      label={t(`announcements.severity.${a.severity}`)}
                      tone={severityTone(a.severity)}
                      style={{ padding: '3px 10px', fontSize: 11 }}
                    />
                    {/* Métadonnées en `sp.sub`, contenu en `sp.soft` : contre
                        l'intuition des noms, `soft` (#3F4640 en clair) est PLUS
                        contrasté que `sub` (#7A8079). Les intervertir mettait la
                        date plus en avant que le texte de l'annonce. */}
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(a.starts_at)}
                    </span>
                    {!a.published && (
                      <AdminPill
                        label={t('announcements.draft')}
                        icon={EyeOff}
                        style={{ padding: '3px 10px 3px 8px', fontSize: 11 }}
                      />
                    )}
                    {(a.audience_plans.length > 0 || a.audience_agencies.length > 0) && (
                      <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {t('announcements.targeted', {
                          plans: a.audience_plans.length,
                          agencies: a.audience_agencies.length,
                        })}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate" style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
                    {a.title}
                  </h3>
                  <p className="line-clamp-2" style={{ margin: '6px 0 0', fontSize: 12.5, fontWeight: 500, color: sp.soft, lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                    {a.body}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => update.mutate({ id: a.id, patch: { published: !a.published } })}
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
                    onClick={() => remove.mutate(a.id)}
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
    </div>
  )
}
