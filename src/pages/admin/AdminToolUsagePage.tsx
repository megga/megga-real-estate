/**
 * Page super-admin — usage des outils WhatsApp de l'agent IA.
 *
 * Route : `/dashboard/admin/tool-usage`. Croise la RPC des appels
 * observés avec le catalogue `WHATSAPP_TOOL_CATALOG` (outils jamais appelés
 * inclus en lignes à 0), affiche tier + taux d'erreur par outil, puis les coûts
 * IA par agence via `AiCostsSection`. Vue observe-only, aucune action.
 *
 * Rendu en grammaire Sugar (kit `admin/kit`) : bento séparé par l'ombre, vrai
 * tableau `AdminTh`/`AdminTd`, chiffres tabulaires, et le `text-red-500` du
 * taux d'erreur remplacé par le ton fonctionnel `tones.err`. Le repère « Admin
 * MEGGA » a quitté la page — il vit une seule fois dans le rail du shell.
 *
 * Un échec de la RPC se dit en BANDEAU au-dessus du tableau : les lignes du
 * catalogue sont calculées ici, elles restent exactes sans elle.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Sparkles } from 'lucide-react'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminIc, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { useAdminToolUsage, type ToolUsageRow } from '@/hooks/useAdminToolUsage'
import { WHATSAPP_TOOL_CATALOG } from '@/lib/whatsapp-tools-catalog'
import { AiCostsSection } from '@/components/admin/AdminOpsPanels'

const TIER_BY_TOOL = new Map(WHATSAPP_TOOL_CATALOG.map((tt) => [tt.name, tt.tier]))

/** Troncature d'une cellule : les colonnes du tableau ont une largeur figée. */
const CLIP = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const

/** Identifiant technique (nom d'outil) — chasse fixe, pour que les noms s'alignent. */
const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' } as const

/** Seuil au-delà duquel le taux d'erreur d'un outil passe au ton d'alerte. */
const ERROR_RATE_ALERT = 0.2

/** Table d'usage des outils (observés + jamais utilisés) suivie de la section coûts IA. */
export default function AdminToolUsagePage() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSurfaces()
  const { data: observed = [], isLoading, error } = useAdminToolUsage()

  // La RPC ne renvoie que les outils observés. On complète avec les outils JAMAIS utilisés du
  // catalogue (lignes synthétiques 0 appel), pour une vue exhaustive. Les outils observés mais hors
  // catalogue restent en tête (vrais appels) avec un tier « hors catalogue ».
  const observedNames = new Set(observed.map((r) => r.tool))
  const neverUsedRows: ToolUsageRow[] = WHATSAPP_TOOL_CATALOG
    .filter((c) => !observedNames.has(c.name))
    .map((c) => ({ tool: c.name, total_calls: 0, error_count: 0, error_rate: 0, last_used_at: null }))
    .sort((a, b) => a.tool.localeCompare(b.tool))
  const rows: ToolUsageRow[] = [...observed, ...neverUsedRows]
  const total = WHATSAPP_TOOL_CATALOG.length
  const neverUsed = neverUsedRows.length

  return (
    <AdminPage
      title={t('toolUsage.title')}
      subtitle={isLoading ? t('common.loading') : t('toolUsage.subtitle', { neverUsed, total })}
      width="normal"
    >
      {/* Note observe-only — on trace l'appel, jamais le contenu des messages */}
      <AdminCard padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <AdminIc icon={Sparkles} size={16} color={tones.info} style={{ marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', lineHeight: 1.55, color: sp.sub }}>
            {t('toolUsage.observeNote')}
          </p>
        </div>
      </AdminCard>

      {/* Échec de la RPC : BANDEAU, jamais un remplacement du tableau. Les lignes
          des outils jamais appelés sont calculées ici depuis WHATSAPP_TOOL_CATALOG
          et restent valides quand la RPC tombe — les court-circuiter effaçait un
          contenu exact. Le bandeau dit seulement que les compteurs observés
          manquent. */}
      {error && (
        <AdminCard padding="14px 16px">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AdminIc icon={AlertTriangle} size={16} color={tones.err} style={{ marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, lineHeight: 1.55, color: sp.ink }}>
              {t('toolUsage.error')}
            </p>
          </div>
        </AdminCard>
      )}

      {/* Appels par outil.
          `overflow: hidden` sur la carte, pas sur l'enfant qui défile : le rayon
          vit ici, et `AdminTh` peint un fond OPAQUE en `position: sticky`. Sans
          clip sur l'élément qui porte le rayon, la bande d'en-tête déborde des
          coins arrondis du bento. */}
      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
            {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={34} />)}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <AdminTh>{t('toolUsage.col.tool')}</AdminTh>
                  <AdminTh width={130}>{t('toolUsage.col.tier')}</AdminTh>
                  <AdminTh align="right" width={100}>{t('toolUsage.col.calls')}</AdminTh>
                  <AdminTh align="right" width={120}>{t('toolUsage.col.errorRate')}</AdminTh>
                  <AdminTh align="right" width={160}>{t('toolUsage.col.lastUsed')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tier = TIER_BY_TOOL.get(r.tool)
                  const never = r.total_calls === 0
                  const rate = Number(r.error_rate)
                  return (
                    // Un outil jamais appelé reste lisible mais s'efface : c'est une ligne
                    // synthétique du catalogue, pas une mesure.
                    <tr key={r.tool} style={{ opacity: never ? 0.6 : undefined }}>
                      {/* `title` : la colonne est tronquée dès la largeur minimale du
                          tableau, et le nom d'outil est l'identifiant qu'on vient lire. */}
                      <AdminTd style={{ ...CLIP, ...MONO }}>
                        <span title={r.tool}>{r.tool}</span>
                      </AdminTd>
                      <AdminTd style={{ ...CLIP, color: sp.sub }}>
                        {tier ? t(`toolUsage.tier.${tier}`) : t('toolUsage.tier.unknown')}
                      </AdminTd>
                      <AdminTd align="right" numeric style={{ color: sp.sub }}>{r.total_calls}</AdminTd>
                      {/* Ce qui s'efface prend `sp.sub` (le plus clair), pas `sp.soft` :
                          en clair `soft` (#3F4640) est plus SOMBRE que `sub` (#7A8079),
                          donc l'appuyer ici mettait le tiret et la dernière utilisation
                          en avant des colonnes qu'ils accompagnent. */}
                      <AdminTd
                        align="right"
                        numeric
                        style={{ color: !never && rate >= ERROR_RATE_ALERT ? tones.err : sp.sub }}
                      >
                        {never ? '—' : `${(rate * 100).toFixed(1)}%`}
                      </AdminTd>
                      <AdminTd align="right" numeric style={{ ...CLIP, color: sp.sub }}>
                        {r.last_used_at
                          ? new Date(r.last_used_at).toLocaleDateString('fr-CH')
                          : t('toolUsage.neverUsed')}
                      </AdminTd>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Coûts IA par agence × provider × module (P3 admin — RPC 20260705172000) */}
      <AiCostsSection />
    </AdminPage>
  )
}
