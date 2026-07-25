// P8a — Onglet « Annonces » de la page Communication (super-admin).
// Liste + création/édition (AnnouncementFormModal) + publication/suppression.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Megaphone, Eye, EyeOff, Pencil } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useAnnouncementsAdmin, type Announcement } from '@/hooks/useAnnouncementsAdmin'
import AnnouncementFormModal from '@/components/admin/AnnouncementFormModal'

const SEVERITY_COLOR: Record<string, string> = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
}

export default function AnnouncementsTab() {
  const { t } = useTranslation('admin')
  const { announcements, isLoading, update, remove } = useAnnouncementsAdmin()
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('announcements.new')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-5 bg-theme-hover rounded w-48 mb-3" />
              <div className="h-3 bg-theme-hover rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <Megaphone className="h-8 w-8 text-theme-muted mx-auto mb-3" />
          <p className="text-sm text-theme-secondary">{t('announcements.empty.title')}</p>
          <p className="text-xs text-theme-muted mt-1">{t('announcements.empty.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="rounded-xl border border-theme-border p-5 group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn('text-xs font-medium', SEVERITY_COLOR[a.severity])}>
                      {t(`announcements.severity.${a.severity}`)}
                    </span>
                    <span className="text-xs text-theme-muted">{formatDate(a.starts_at)}</span>
                    {!a.published && (
                      <span className="flex items-center gap-1 text-xs text-theme-muted">
                        <EyeOff className="h-3 w-3" /> {t('announcements.draft')}
                      </span>
                    )}
                    {(a.audience_plans.length > 0 || a.audience_agencies.length > 0) && (
                      <span className="text-xs text-theme-muted">
                        {t('announcements.targeted', {
                          plans: a.audience_plans.length,
                          agencies: a.audience_agencies.length,
                        })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-theme-primary truncate">{a.title}</h3>
                  <p className="text-sm text-theme-secondary mt-1 whitespace-pre-line line-clamp-2">{a.body}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
                  <button
                    onClick={() => update.mutate({ id: a.id, patch: { published: !a.published } })}
                    aria-label={a.published ? t('announcements.unpublish') : t('announcements.publish')}
                    className="h-7 w-7 rounded flex items-center justify-center text-theme-muted hover:text-admin-accent transition-colors"
                  >
                    {a.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setEditing(a)}
                    aria-label={t('common.edit')}
                    className="h-7 w-7 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove.mutate(a.id)}
                    aria-label={t('common.delete')}
                    className="h-7 w-7 rounded flex items-center justify-center text-theme-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AnnouncementFormModal existing={editing} onClose={() => { setCreating(false); setEditing(null) }} />
      )}
    </div>
  )
}
