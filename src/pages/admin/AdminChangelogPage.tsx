/**
 * Page super-admin — communication produit (changelog + annonces).
 *
 * Route : `/changelog` (console admin.megga.ch). Deux onglets : le changelog
 * produit (entrées version / titre / contenu, avec création en modale et
 * suppression ; un brouillon ne sort pas vers les utilisateurs finaux) et les
 * annonces in-app ciblées (`AnnouncementsTab`).
 *
 * Rendu en grammaire Sugar (kit `@/components/admin/kit`) : bentos séparés par
 * l'ombre, onglets et brouillon en pilules, publication en interrupteur. Le
 * repère violet « Admin MEGGA » a quitté la page — il ne vit plus qu'une fois,
 * dans le rail du shell.
 */
import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Megaphone, EyeOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useChangelog } from '@/hooks/useChangelog'
import Modal from '@/components/ui/modal'
import AnnouncementsTab from '@/components/admin/AnnouncementsTab'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminGhostBtn, AdminIc, AdminPill,
  AdminSkeleton, AdminSolidBtn, AdminSwitch,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

/** Onglets de l'écran : changelog produit / annonces in-app ciblées. */
type Tab = 'changelog' | 'announcements'

/** Écran « Communication » : changelog produit + annonces in-app ciblées (2 onglets). */
export default function AdminCommunicationPage() {
  const { t } = useTranslation('admin')
  const { sp, surf } = useAdminSugar()
  const [tab, setTab] = useState<Tab>('changelog')

  return (
    <AdminPage title={t('communication.title')} subtitle={t('communication.subtitle')}>
      {/* Onglets : pilules pleines, plus de soulignement sur une bordure décorative */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {(['changelog', 'announcements'] as const).map(key => {
          const on = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={on}
              style={{
                height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                background: on ? sp.accent : surf.card, color: on ? sp.accentInk : sp.soft,
                boxShadow: on ? 'none' : sp.shadowSm,
              }}
            >
              {t(`communication.tab.${key}`)}
            </button>
          )
        })}
      </div>

      {tab === 'changelog' ? <ChangelogTab /> : <AnnouncementsTab />}
    </AdminPage>
  )
}

/** Onglet « Changelog » : liste des entrées, création en modale et suppression. */
function ChangelogTab() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
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

  const labelStyle: CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: sp.sub,
  }
  // Champ Sugar : pas de bordure, une surface creuse et un filet INTÉRIEUR — le
  // trait ne sépare rien, l'ombre du bento s'en charge.
  const fieldStyle: CSSProperties = {
    width: '100%', height: 38, padding: '0 12px', borderRadius: ADMIN_RADII.row, border: 0,
    background: surf.cardSub, color: sp.ink,
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, outline: 'none',
    boxShadow: `0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'} inset`,
  }

  // La corbeille reste discrète et ne prend le ton d'erreur qu'au survol : les
  // transitions vivent dans la classe, une valeur inline les figerait.
  const hoverCss = `
    .chg-del { color: ${sp.sub}; transition: color .16s ease, opacity .16s ease; }
    .chg-del:hover { color: ${tones.err}; }
  `

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{hoverCss}</style>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <AdminSolidBtn icon={Plus} onClick={() => setShowCreate(true)}>
          {t('changelog.newEntry')}
        </AdminSolidBtn>
      </div>

      {/* Entrées */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <AdminSkeleton key={i} height={96} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <AdminCard>
          <AdminEmpty icon={Megaphone} title={t('changelog.empty.title')} hint={t('changelog.empty.subtitle')} />
        </AdminCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(entry => (
            <AdminCard key={entry.id} className="group" padding="16px 18px">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
                    {entry.version && (
                      <AdminPill
                        label={`v${entry.version}`}
                        style={{ padding: '3px 10px', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                      />
                    )}
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>
                      {formatDate(entry.created_at)}
                    </span>
                    {!entry.published && (
                      <AdminPill
                        label={t('changelog.modal.draft')}
                        icon={EyeOff}
                        style={{ padding: '3px 10px 3px 8px', fontSize: 11 }}
                      />
                    )}
                  </div>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
                    {entry.title}
                  </h3>
                  {entry.content && (
                    <p style={{ margin: '7px 0 0', fontSize: 12.5, fontWeight: 500, color: sp.sub, lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                      {entry.content}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry.mutate(entry.id)}
                  aria-label={t('changelog.deleteEntry')}
                  className="chg-del opacity-0 group-hover:opacity-100"
                  style={{
                    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
                    background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}
                >
                  <AdminIc icon={Trash2} size={15} />
                </button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* Modale de création */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('changelog.modal.title')} size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('changelog.modal.version')}</label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder={t('changelog.modal.versionPlaceholder')}
                style={{ ...fieldStyle, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}>
                {/* Le nom accessible doit suivre l'état, comme le faisait l'ancien
                    bouton dont le libellé visible ÉTAIT le nom : figé sur
                    « Publié », il annonce l'inverse du texte affiché à côté dès
                    que l'entrée repasse en brouillon. */}
                <AdminSwitch
                  on={published}
                  onClick={() => setPublished(!published)}
                  label={published ? t('changelog.modal.published') : t('changelog.modal.draft')}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink }}>
                  {published ? t('changelog.modal.published') : t('changelog.modal.draft')}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t('changelog.modal.titleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('changelog.modal.titlePlaceholder')}
              autoFocus
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('changelog.modal.description')}</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder={t('changelog.modal.descriptionPlaceholder')}
              style={{ ...fieldStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, paddingTop: 4 }}>
            <AdminGhostBtn onClick={() => setShowCreate(false)}>{t('common.cancel')}</AdminGhostBtn>
            <AdminSolidBtn onClick={handleCreate} disabled={!title.trim()}>{t('common.publish')}</AdminSolidBtn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
