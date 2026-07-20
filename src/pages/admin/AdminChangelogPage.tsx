/**
 * Page super-admin — gestion du changelog produit.
 *
 * Route : `/dashboard/admin/changelog` (section admin, accent violet). Liste des
 * entrées avec création (modale) et suppression ; chaque entrée porte version,
 * titre, contenu et un drapeau publié/brouillon (les brouillons ne sortent pas
 * vers les utilisateurs finaux).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Megaphone } from 'lucide-react'
import { Delete as Trash2, Show2 as Eye, Hide as EyeOff } from '@/components/icons'
import { cn, formatDate } from '@/lib/utils'
import { useChangelog } from '@/hooks/useChangelog'
import Modal from '@/components/ui/modal'

/** Écran changelog : rendu de la liste + formulaire de création en modale. */
export default function AdminChangelogPage() {
  const { t } = useTranslation('admin')
  const { entries, isLoading, createEntry, deleteEntry } = useChangelog()
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [version, setVersion] = useState('')
  const [published, setPublished] = useState(true)

  function handleCreate() {
    if (!title.trim()) return
    createEntry.mutate({ title, content, version, published })
    setShowCreate(false)
    setTitle('')
    setContent('')
    setVersion('')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('changelog.title')}</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">{t('changelog.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('changelog.newEntry')}
        </button>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 animate-pulse">
              <div className="h-5 bg-theme-hover rounded w-48 mb-3" />
              <div className="h-3 bg-theme-hover rounded w-full mb-2" />
              <div className="h-3 bg-theme-hover rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <Megaphone className="h-8 w-8 text-theme-muted mx-auto mb-3" />
          <p className="text-sm text-theme-secondary">{t('changelog.empty.title')}</p>
          <p className="text-xs text-theme-muted mt-1">{t('changelog.empty.subtitle')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-xl border border-theme-border p-5 group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {entry.version && (
                      <span className="text-xs font-mono text-admin-accent bg-admin-accent/10 px-2 py-0.5 rounded">
                        v{entry.version}
                      </span>
                    )}
                    <span className="text-xs text-theme-muted">{formatDate(entry.created_at)}</span>
                    {!entry.published && (
                      <span className="flex items-center gap-1 text-xs text-theme-muted">
                        <EyeOff className="h-3 w-3" /> {t('changelog.modal.draft')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-theme-primary">{entry.title}</h3>
                  {entry.content && (
                    <p className="text-sm text-theme-secondary mt-2 whitespace-pre-line">{entry.content}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry.mutate(entry.id)}
                  aria-label={t('changelog.deleteEntry')}
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded flex items-center justify-center text-theme-muted hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('changelog.modal.title')} size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('changelog.modal.version')}</label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder={t('changelog.modal.versionPlaceholder')}
                className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setPublished(!published)}
                className={cn(
                  'h-9 px-3 rounded-lg text-sm flex items-center gap-2 transition-colors',
                  published ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted'
                )}
              >
                {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {published ? t('changelog.modal.published') : t('changelog.modal.draft')}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('changelog.modal.titleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('changelog.modal.titlePlaceholder')}
              autoFocus
              className="w-full h-9 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-theme-secondary block mb-1.5">{t('changelog.modal.description')}</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder={t('changelog.modal.descriptionPlaceholder')}
              className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-admin-accent/20 focus:border-admin-accent"
            />
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="h-9 px-4 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="h-9 px-4 text-sm font-medium border border-theme-border text-theme-primary rounded-lg hover:border-admin-accent hover:text-admin-accent transition-colors disabled:opacity-50"
            >
              {t('common.publish')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
