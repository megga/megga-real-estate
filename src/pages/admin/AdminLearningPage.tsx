/**
 * Page super-admin — style appris des agents WhatsApp.
 *
 * Route : `/dashboard/admin/learning`. Liste par agent le style
 * distillé (langue, registre, emoji, traits) et permet de l'activer/désactiver
 * ou d'éditer les traits à la main via `useSetLearnedStyle`.
 *
 * Rendu en grammaire Sugar (kit `admin/kit`) : bento séparé par l'ombre, vrai
 * tableau `AdminTh`/`AdminTd`, statut en pilule pleine. Chaque agent occupe
 * DEUX lignes (l'entête + la ligne de traits) groupées dans un `tbody` : la
 * ligne de traits porte l'édition en place et ne rejoue donc pas le filet de
 * séparation. Un style actif se signale par une surface plus sourde, pas par un
 * fond violet — l'accent de la plateforme n'est pas un statut métier.
 *
 * Un refetch en échec se dit en BANDEAU au-dessus du tableau ; l'état d'erreur
 * plein n'est rendu que si le cache est vide, sans quoi il démontait l'édition
 * en place des traits en cours de saisie.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Sparkles } from 'lucide-react'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPill,
  AdminSkeleton, AdminSolidBtn, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminLearning, useSetLearnedStyle } from '@/hooks/useAdminLearning'

/** Troncature d'une cellule : les colonnes du tableau ont une largeur figée. */
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** Ton de pilule d'un statut de style — `neutral` = pas encore de signal. */
function statusTone(status: string): AdminToneName {
  switch (status) {
    case 'active': return 'ok'
    case 'suggested': return 'info'
    default: return 'neutral'
  }
}

export default function AdminLearningPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { data: rows = [], isLoading, error } = useAdminLearning()
  const setStyle = useSetLearnedStyle()

  // Light inline traits edit: track which agent is being edited + the draft text.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTraits, setDraftTraits] = useState('')

  const activeCount = rows.filter((r) => r.learned_style?.status === 'active').length
  // React Query sert le cache et refetch en fond : `error` coexiste donc avec des
  // lignes valides au retour sur la page. Remplacer le tableau par l'erreur
  // démontait au passage l'édition en place des traits ; l'erreur ne prend la
  // place du contenu que s'il n'y a VRAIMENT rien à montrer.
  const hasRows = rows.length > 0

  return (
    <AdminPage
      title={t('learning.title')}
      subtitle={isLoading ? t('common.loading') : t('learning.subtitle', { count: activeCount })}
      width="normal"
    >
      {/* Note observe-only — un style reste suggéré tant qu'il n'est pas activé */}
      <AdminCard padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <AdminIc icon={Sparkles} size={16} color={tones.info} style={{ marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', lineHeight: 1.55, color: sp.sub }}>
            {t('learning.observeNote')}
          </p>
        </div>
      </AdminCard>

      {/* Bandeau d'échec — au-dessus des lignes déjà affichables, pas à leur place */}
      {error && hasRows && (
        <AdminCard padding="14px 16px">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AdminIc icon={AlertTriangle} size={16} color={tones.err} style={{ marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, lineHeight: 1.55, color: sp.ink }}>
              {t('learning.error')}
            </p>
          </div>
        </AdminCard>
      )}

      {/* Styles distillés par agent.
          `overflow: hidden` sur la carte, pas sur l'enfant qui défile : le rayon
          vit ici, et `AdminTh` peint un fond OPAQUE en `position: sticky`. Sans
          clip sur l'élément qui porte le rayon, la bande d'en-tête déborde des
          coins arrondis du bento. */}
      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        {/* Le liseré de repos vit ICI et non en style inline : une déclaration
            inline `box-shadow` l'emporterait sur la règle `:focus` ci-dessous, qui
            ne pourrait plus poser l'anneau d'accent. */}
        <style>{`
          .adml-inp { box-shadow: inset 0 0 0 1px ${sp.solidBorder}; }
          .adml-inp::placeholder { color: ${sp.sub}; font-weight: 500; }
          .adml-inp:focus { box-shadow: inset 0 0 0 2px ${sp.accent}; }
        `}</style>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
            {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={34} />)}
          </div>
        ) : error && !hasRows ? (
          <AdminError message={t('learning.error')} />
        ) : !hasRows ? (
          <AdminEmpty icon={Sparkles} title={t('learning.empty')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <AdminTh>{t('learning.col.agent')}</AdminTh>
                  <AdminTh width={90}>{t('learning.col.language')}</AdminTh>
                  <AdminTh width={120}>{t('learning.col.register')}</AdminTh>
                  <AdminTh align="center" width={90}>{t('learning.col.emoji')}</AdminTh>
                  <AdminTh width={120}>{t('learning.col.status')}</AdminTh>
                  <AdminTh align="right" width={150}>{t('learning.col.action')}</AdminTh>
                </tr>
              </thead>

              {rows.map((r) => {
                const style = r.learned_style
                const status = style?.status ?? 'off'
                const isActive = status === 'active'
                const isEditing = editingId === r.agent_id
                const rowBg = isActive ? surf.cardSub : undefined
                return (
                  <tbody key={r.agent_id}>
                    <tr style={{ background: rowBg }}>
                      <AdminTd style={{ ...CLIP, fontWeight: 600, textTransform: 'capitalize' }}>
                        {r.agent_name ?? '—'}
                      </AdminTd>
                      {/* Le code de langue s'écrit en majuscules — c'est sa forme
                          canonique, pas une composition. Le porter dans la DONNÉE
                          plutôt qu'en CSS le rend aussi copiable tel quel. */}
                      <AdminTd style={{ ...CLIP, color: sp.sub }}>
                        {style?.language?.toUpperCase() ?? '—'}
                      </AdminTd>
                      <AdminTd style={{ ...CLIP, color: sp.sub, textTransform: 'capitalize' }}>
                        {style?.formality ?? '—'}
                      </AdminTd>
                      <AdminTd align="center" style={{ color: sp.sub }}>
                        {style?.emoji ? t('learning.yes') : t('learning.no')}
                      </AdminTd>
                      <AdminTd>
                        <AdminPill label={t(`learning.status.${status}`, status)} tone={statusTone(status)} />
                      </AdminTd>
                      <AdminTd align="right">
                        <AdminGhostBtn
                          disabled={setStyle.isPending}
                          onClick={() => setStyle.mutate({
                            agent_id: r.agent_id,
                            status: isActive ? 'off' : 'active',
                          })}
                        >
                          {isActive ? t('learning.deactivate') : t('learning.activate')}
                        </AdminGhostBtn>
                      </AdminTd>
                    </tr>

                    {/* Traits — lecture seule par défaut, édition en place à la demande.
                        Pas de filet en haut : la ligne appartient à l'agent au-dessus. */}
                    <tr style={{ background: rowBg }}>
                      <td colSpan={6} style={{ padding: '0 12px 11px', borderTop: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ flexShrink: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.soft }}>
                            {t('learning.traits')}
                          </span>
                          {isEditing ? (
                            <>
                              {/* Le champ doit rester d'un ton DIFFÉRENT de sa ligne :
                                  une ligne active vaut déjà `surf.cardSub`, donc y poser
                                  un champ `cardSub` le faisait disparaître (même couleur,
                                  et plus de bordure). Le liseré interne de `.adml-inp`
                                  garantit la délimitation dans les deux cas. */}
                              <input
                                type="text"
                                className="adml-inp"
                                value={draftTraits}
                                onChange={(e) => setDraftTraits(e.target.value)}
                                placeholder={t('learning.traitsPlaceholder')}
                                style={{
                                  flex: 1, minWidth: 0, height: 34, padding: '0 12px', boxSizing: 'border-box',
                                  borderRadius: ADMIN_RADII.row, border: 0,
                                  background: isActive ? surf.card : surf.cardSub,
                                  color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
                                  outline: 'none', transition: 'box-shadow .16s ease',
                                }}
                              />
                              <AdminSolidBtn
                                disabled={setStyle.isPending}
                                onClick={() => {
                                  setStyle.mutate(
                                    { agent_id: r.agent_id, status, traits: draftTraits },
                                    { onSuccess: () => setEditingId(null) }
                                  )
                                }}
                              >
                                {t('learning.save')}
                              </AdminSolidBtn>
                              <AdminGhostBtn onClick={() => setEditingId(null)}>
                                {t('learning.cancel')}
                              </AdminGhostBtn>
                            </>
                          ) : (
                            <>
                              {/* Les traits REVIENNENT à la ligne : c'est la phrase sur
                                  laquelle le super-admin décide d'activer un style, la
                                  tronquer par ellipse lui retirait l'information. */}
                              <span style={{
                                flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', lineHeight: 1.45,
                                color: sp.sub, overflowWrap: 'break-word',
                              }}>
                                {style?.traits || '—'}
                              </span>
                              <AdminGhostBtn
                                onClick={() => {
                                  setEditingId(r.agent_id)
                                  setDraftTraits(style?.traits ?? '')
                                }}
                              >
                                {t('learning.edit')}
                              </AdminGhostBtn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  )
}
