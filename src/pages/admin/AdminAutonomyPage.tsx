/**
 * Page super-admin — autonomie des agents IA.
 *
 * Route : `/dashboard/admin/autonomy`. Vue en lecture seule
 * (observe-only) : par agent × outil, compteurs yes/no des décisions HITL et
 * suggestion de reprise d'autonomie. N'exécute aucune action — la reprise
 * reste un geste humain.
 *
 * Rendu en grammaire Sugar (kit `admin/kit`) : bento séparé par l'ombre, vrai
 * tableau `AdminTh`/`AdminTd`, suggestion en pilule pleine. Les lignes
 * suggérées se détachent par une surface plus sourde et NON par un fond violet :
 * l'accent de la plateforme n'est pas un statut métier. Le repère « Admin
 * MEGGA » a quitté la page — il vit une seule fois dans le rail du shell.
 *
 * Un refetch en échec se dit en BANDEAU au-dessus du tableau ; l'état d'erreur
 * plein n'est rendu que si le cache est vide, pour ne pas emporter des lignes
 * encore valides.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Sparkles } from 'lucide-react'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminEmpty, AdminError, AdminIc, AdminPill, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminAutonomy } from '@/hooks/useAdminAutonomy'

/** Troncature d'une cellule : les colonnes du tableau ont une largeur figée. */
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** Identifiant technique (nom d'outil) — chasse fixe, pour que les noms s'alignent. */
const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' } as const

/** Tableau des décisions d'autonomie ; met en évidence les lignes suggérant une reprise. */
export default function AdminAutonomyPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { data: rows = [], isLoading, error } = useAdminAutonomy()
  const suggestions = rows.filter((r) => r.suggest_resume)
  // React Query sert le cache et refetch en fond : `error` coexiste donc avec des
  // lignes valides au retour sur la page. L'erreur ne remplace le tableau que
  // s'il n'y a VRAIMENT rien à montrer ; sinon c'est un bandeau au-dessus.
  const hasRows = rows.length > 0

  return (
    <AdminPage
      title={t('autonomy.title')}
      subtitle={isLoading ? t('common.loading') : t('autonomy.subtitle', { count: suggestions.length })}
      width="normal"
    >
      {/* Note observe-only — MEGGA propose, l'humain décide */}
      <AdminCard padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <AdminIc icon={Sparkles} size={16} color={tones.info} style={{ marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', lineHeight: 1.55, color: sp.sub }}>
            {t('autonomy.observeNote')}
          </p>
        </div>
      </AdminCard>

      {/* Bandeau d'échec — au-dessus des lignes déjà affichables, pas à leur place */}
      {error && hasRows && (
        <AdminCard padding="14px 16px">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AdminIc icon={AlertTriangle} size={16} color={tones.err} style={{ marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, lineHeight: 1.55, color: sp.ink }}>
              {t('autonomy.error')}
            </p>
          </div>
        </AdminCard>
      )}

      {/* Décisions par agent × outil.
          `overflow: hidden` sur la carte, pas sur l'enfant qui défile : le rayon
          vit ici, et `AdminTh` peint un fond OPAQUE en `position: sticky`. Sans
          clip sur l'élément qui porte le rayon, la bande d'en-tête déborde des
          coins arrondis du bento. */}
      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
            {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={34} />)}
          </div>
        ) : error && !hasRows ? (
          <AdminError message={t('autonomy.error')} />
        ) : !hasRows ? (
          <AdminEmpty icon={Sparkles} title={t('autonomy.empty')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <AdminTh>{t('autonomy.col.agent')}</AdminTh>
                  <AdminTh width={120}>{t('autonomy.col.autonomy')}</AdminTh>
                  <AdminTh>{t('autonomy.col.tool')}</AdminTh>
                  <AdminTh align="right" width={110}>{t('autonomy.col.yesno')}</AdminTh>
                  <AdminTh align="right" width={170}>{t('autonomy.col.suggestion')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.profile_id}-${r.tool}`}
                    style={{ background: r.suggest_resume ? surf.cardSub : undefined }}
                  >
                    <AdminTd style={{ ...CLIP, fontWeight: 600, textTransform: 'capitalize' }}>
                      {r.agent_name ?? '—'}
                    </AdminTd>
                    <AdminTd style={{ ...CLIP, color: sp.sub }}>{r.autonomy ?? '—'}</AdminTd>
                    {/* `title` : la colonne est tronquée dès la largeur minimale du
                        tableau, et le nom d'outil est l'identifiant qu'on vient lire. */}
                    <AdminTd style={{ ...CLIP, ...MONO, color: sp.sub }}>
                      <span title={r.tool}>{r.tool}</span>
                    </AdminTd>
                    <AdminTd align="right" numeric style={{ color: sp.sub }}>
                      {r.yes_count} / {r.no_count}
                    </AdminTd>
                    <AdminTd align="right">
                      {/* Le tiret « pas de suggestion » prend `sp.sub` : en clair
                          `sp.soft` (#3F4640) est plus SOMBRE que le `sp.sub` (#7A8079)
                          des colonnes voisines, donc il criait plus fort qu'une pilule. */}
                      {r.suggest_resume
                        ? <AdminPill label={t('autonomy.suggestResume')} tone="info" />
                        : <span style={{ color: sp.sub }}>—</span>}
                    </AdminTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  )
}
