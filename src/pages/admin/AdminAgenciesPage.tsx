/**
 * Page super-admin — registre des agences (concept A de la maquette `admin-agencies.jsx`).
 *
 * Route : `/dashboard/admin/agencies`. **La liste nue** : outils et table posés
 * à même le fond, aucune carte, aucune couture. Une ligne = une agence, un clic
 * ouvre sa fiche.
 *
 * La colonne « Statut » a disparu, et c'est la décision fondatrice de l'écran :
 * « Active » sur douze lignes sur quatorze n'informe personne. Ce qui informe,
 * c'est la SANTÉ — un mot, jamais un score nu (`src/lib/adminAgencyHealth.ts`).
 *
 * ⚡ Un fetch en moins. L'ancienne page appelait `get_agency_activity_summary`
 * en plus du registre pour calculer un score maison ; la dérivation de la
 * maquette n'a besoin que du `score` d'activation, déjà servi par la RPC.
 *
 * ── Écarts et constats assumés, nommés plutôt que tus ──
 *
 * É1 · **La pilule KYB s'affichera sur 100 % des lignes tant qu'aucune agence
 *      n'est validée** (mesuré : 9 `pending`, 2 `manual_review`, 0 validée).
 *      C'est exactement le bruit que le retrait de « Statut » supprime — mais
 *      l'amendement C9 du handoff la rend DUE sur la liste comme sur la fiche.
 *      La restreindre aux seuls statuts qui appellent un geste
 *      (`manual_review`, `correction_requested`, `rejected`) la ramènerait à
 *      2 lignes sur 11 : **c'est un arbitrage PO**, pas une formule à choisir ici.
 * É2 · **La colonne MRR rend « non facturée » sur toute la base**, et le tri par
 *      MRR est donc inerte. La cause n'est PAS l'absence d'abonnements : les
 *      onze agences sont Starter, et Starter vaut 0 au catalogue
 *      (`app_config.plan_pricing`). Le déclencheur d'un MRR non nul est la
 *      première montée en Pro ou Entreprise, pas le premier abonnement.
 * É3 · **La colonne Plan affiche « Starter » onze fois sur onze**, et la
 *      sous-ligne d'identité est vide sur neuf lignes sur onze (`city` nulle).
 *      Deux colonnes constantes ou vides de plus, à connaître avant de juger
 *      l'écran : la maquette les demande, la base ne les nourrit pas encore.
 * É4 · **Trois chips de filtre sur quatre ne discriminent rien** aujourd'hui —
 *      « Toutes » et « Actives » sélectionnent le MÊME ensemble (11), et
 *      « Suspendues » comme « Essai » sont à zéro. La barre est celle de la
 *      maquette ; son inertie est un fait de la base, pas un défaut de code.
 * É5 · **Le placeholder annonce trois champs dont deux sont presque toujours
 *      nuls** : `email` est renseigné sur 1 agence sur 11, `city` sur 2. Le
 *      verbatim de la maquette est conservé — le corriger serait dévier de la
 *      spec — mais la recherche ne fonctionne en pratique que sur le nom.
 * É6 · **Le tableau d'usage par agence quitte cet écran** : la maquette ne le
 *      porte pas, et la fiche agence rend désormais l'usage agence par agence.
 *      Ce qui est perdu est la COMPARAISON transversale (coût IA, stockage,
 *      WhatsApp côte à côte) — nommé ici plutôt que tu.
 * É7 · **La suspension n'est plus sur cette liste** (elle vit sur la fiche,
 *      derrière une confirmation). Le survol ne propose que la réactivation.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Building2, Plus } from 'lucide-react'
import { formatCHF, formatRelativeDate } from '@/lib/utils'
import { useAdminAgencies, type AgencyWithStats } from '@/hooks/useAdminAgencies'
import {
  agencyHealth,
  compareAgencies,
  agencyIdentityLine,
  HEALTH_WORD_KEY,
  HEALTH_CAUSE_KEY,
  type AgencyHealthTone,
} from '@/lib/adminAgencyHealth'
import CreateAgencyModal from '@/components/admin/CreateAgencyModal'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminEmpty,
  AdminError,
  AdminGhostBtn,
  AdminPill,
  AdminSearchInput,
  AdminSegmentBtn,
  AdminSkeleton,
  AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

/** Lignes rendues avant le « voir les N autres » (maquette). */
const SHOW = 20

/** Statuts KYB qui portent une pilule. `validated` / `auto_validated` restent muets. */
const KYB_PILL: Record<string, { key: string; tone: AdminToneName }> = {
  pending: { key: 'agencies.kyb.pending', tone: 'neutral' },
  manual_review: { key: 'agencies.kyb.manualReview', tone: 'info' },
  correction_requested: { key: 'agencies.kyb.correctionRequested', tone: 'warn' },
  rejected: { key: 'agencies.kyb.rejected', tone: 'err' },
}

export default function AdminAgenciesPage() {
  const { t } = useTranslation('admin')
  const { agencies, isLoading, isError, refetch, updateStatus } = useAdminAgencies()
  const { sp, surf, tones } = useAdminSugar()

  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'all' | 'active' | 'suspended' | 'trial'>('all')
  const [tout, setTout] = useState(false)
  const [creation, setCreation] = useState(false)

  /**
   * Couleur d'un ton de santé.
   *
   * ⛔ `ok` n'est PAS vert : sur ce registre, « Saine » retombe à l'encre douce.
   * C'est la décision de la maquette — une liste où le sain crie autant que le
   * malade ne trie plus rien. (La fiche agence, elle, peut se permettre le vert :
   * elle ne montre qu'une agence à la fois.)
   */
  const couleurTon = (ton: AgencyHealthTone): string =>
    ton === 'err' ? tones.err : ton === 'warn' ? tones.warn : ton === 'mute' ? sp.sub : sp.soft

  const comptes = useMemo(() => ({
    all: agencies.length,
    active: agencies.filter(a => a.status === 'active').length,
    suspended: agencies.filter(a => a.status === 'suspended').length,
    trial: agencies.filter(a => a.subscription_status === 'trialing').length,
  }), [agencies])

  const filtrees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agencies
      .filter(a =>
        filtre === 'all' ? true
        : filtre === 'trial' ? a.subscription_status === 'trialing'
        : a.status === filtre)
      .filter(a => {
        if (!q) return true
        // Le canton est cherchable sans être annoncé : le placeholder de la
        // maquette ne cite que trois champs (É5).
        return [a.name, a.email, a.city, a.canton]
          .some(v => (v ?? '').toLowerCase().includes(q))
      })
      .sort(compareAgencies)
  }, [agencies, filtre, search])

  const visibles = tout ? filtrees : filtrees.slice(0, SHOW)
  const reste = filtrees.length - visibles.length

  const th = { bg: sp.pageBg }
  const cellule: CSSProperties = {
    padding: '12px', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink,
    borderTop: surf.hairline, verticalAlign: 'middle',
  }

  const ligne = (a: AgencyWithStats) => {
    const sante = agencyHealth({
      status: a.status,
      subscription_status: a.subscription_status,
      score: a.score,
      transaction_count: a.transaction_count,
    })
    const kyb = a.verification_status ? KYB_PILL[a.verification_status] : undefined
    const identite = agencyIdentityLine(a.city, a.canton)

    return (
      <tr key={a.id} className="adm-row" style={{ cursor: 'pointer' }}>
        {/* Agence — nom, identité, et la pilule KYB due par l'amendement C9 */}
        <td style={cellule}>
          <Link
            to={`${ADMIN_CONSOLE_PATH}/agencies/${a.id}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>{a.name}</span>
              {a.status === 'suspended' && (
                <AdminPill label={t('common.status.suspended')} tone="err" />
              )}
              {kyb && <AdminPill label={t(kyb.key)} tone={kyb.tone} />}
            </div>
            {identite && (
              <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{identite}</div>
            )}
          </Link>
        </td>

        <td style={cellule}>
          {t(`common.plan.${(a.plan ?? 'starter').toLowerCase()}`, { defaultValue: a.plan ?? '—' })}
        </td>

        {/* Portefeuille — trois compteurs fondus en une cellule (maquette) */}
        <td style={{ ...cellule, fontWeight: 500, color: sp.sub, fontSize: 'var(--crm-text-xs)' }}>
          {[
            t('agencies.portfolio.agents', { count: a.agent_count }),
            t('agencies.portfolio.properties', { count: a.property_count }),
            t('agencies.portfolio.deals', { count: a.transaction_count }),
          ].join(' · ')}
        </td>

        <td style={{ ...cellule, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {a.mrr > 0
            ? formatCHF(a.mrr)
            : <span style={{ fontWeight: 500, color: sp.sub }}>{t('agencies.mrr.notBilled')}</span>}
        </td>

        {/* Santé — un MOT, et sa cause en infobulle : deux branches rendent
            « Dormante » pour des états incompatibles (suspendue par un admin,
            ou score bas), que rien d'autre ne distinguerait à l'écran. */}
        <td style={cellule}>
          <span
            title={t(HEALTH_CAUSE_KEY[sante.cause])}
            style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: couleurTon(sante.tone) }}
          >
            {t(HEALTH_WORD_KEY[sante.word])}
          </span>
        </td>

        <td style={{ ...cellule, fontWeight: 500, color: sp.sub, fontSize: 'var(--crm-text-xs)', whiteSpace: 'nowrap' }}>
          {a.last_activity_at ? formatRelativeDate(a.last_activity_at) : t('agencies.noEvent')}
        </td>

        {/* Action au survol — réactivation SEULE (É7) */}
        <td style={{ ...cellule, textAlign: 'right' }}>
          {a.status === 'suspended' && (
            <button
              className="agx-act"
              onClick={() => updateStatus.mutate({ id: a.id, status: 'active' })}
              disabled={updateStatus.isPending}
              style={{
                height: 28, padding: '0 12px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 600, whiteSpace: 'nowrap',
                background: surf.card, boxShadow: sp.shadowSm, color: tones.ok,
              }}
            >
              {t('agencies.action.reactivate')}
            </button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <AdminPage
      title={t('agencies.title')}
      subtitle={t('agencies.subtitle', { count: agencies.length })}
      width="wide"
      actions={
        <AdminGhostBtn onClick={() => setCreation(true)} icon={Plus} style={{ height: 30, fontSize: 'var(--crm-text-sm)' }}>
          {t('agencies.create')}
        </AdminGhostBtn>
      }
    >
      {/* Outils posés à MÊME le fond — aucune carte (concept A) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px 12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(['all', 'active', 'suspended', 'trial'] as const).map(f => (
            <AdminSegmentBtn key={f} on={filtre === f} onClick={() => { setFiltre(f); setTout(false) }}>
              {t(`agencies.filter.${f}`)} · {comptes[f]}
            </AdminSegmentBtn>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <AdminSearchInput
            value={search}
            onChange={v => { setSearch(v); setTout(false) }}
            placeholder={t('agencies.searchPlaceholder')}
            label={t('agencies.searchPlaceholder')}
            maxWidth={240}
            compact
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <AdminSkeleton key={i} height={46} />)}
        </div>
      ) : isError && agencies.length === 0 ? (
        <AdminError
          message={t('common.loadError')}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      ) : filtrees.length === 0 ? (
        <AdminEmpty icon={Building2} title={t('agencies.empty.title')} />
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <AdminTh width={214} {...th}>{t('agencies.table.agency')}</AdminTh>
                <AdminTh width={108} {...th}>{t('agencies.table.plan')}</AdminTh>
                <AdminTh width={216} {...th}>{t('agencies.table.portfolio')}</AdminTh>
                <AdminTh width={96} align="right" {...th}>{t('agencies.table.mrr')}</AdminTh>
                <AdminTh width={132} {...th}>{t('agencies.table.health')}</AdminTh>
                <AdminTh width={132} {...th}>{t('agencies.table.lastEvent')}</AdminTh>
                <AdminTh width={132} align="right" {...th}>{''}</AdminTh>
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
              {t('agencies.showMore', { count: reste })}
            </button>
          )}
        </>
      )}

      {creation && <CreateAgencyModal onClose={() => setCreation(false)} />}
    </AdminPage>
  )
}
