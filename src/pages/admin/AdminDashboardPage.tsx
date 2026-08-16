/**
 * Page super-admin — Vue d'ensemble (concept A de la maquette `admin-overview.jsx`).
 *
 * Route : `/dashboard/admin`. Un seul objet, un seul appel : `admin_overview()`
 * assemble ses sept sources côté serveur. La page ne recalcule rien et ne
 * complète rien par un second fetch — c'est le contrat de cet écran.
 *
 * Structure (profondeur 1, aucune carte) : pouls · cinq chiffres nus · tête
 * « À traiter » · manques déclarés · journal · pied de trois renvois.
 *
 * ── Écarts assumés vis-à-vis de la maquette, tous nommés ici plutôt que tus ──
 *
 * É1 · Le KPI « KYC à risque » DISPARAÎT, et le pouls change de source. La
 *      maquette l'écrit trois fois : « le KYC/LBA des clients finaux n'est pas
 *      l'affaire de la plateforme ». `admin_overview()` calcule la valeur puis
 *      la jette — le serveur applique déjà l'arbitrage. Le pouls lit désormais
 *      `pulse.healthy`, plus un compte de dossiers à risque.
 * É2 · Le pouls dit « aucune erreur de fonction REMONTÉE », pas « aucun incident
 *      sur 24 h ». Le capteur (`edge_function_error`) n'est câblé que dans 4 des
 *      68 edge functions : l'absence d'erreur ne prouve pas l'absence d'incident,
 *      et l'écran n'a pas à l'affirmer.
 * É3 · Le journal n'annonce AUCUNE fenêtre de 24 h. Mesuré : `get_admin_live_feed`
 *      n'a aucun prédicat temporel — ce sont « les 40 événements non-KYC les plus
 *      récents », qui peuvent dater de plusieurs semaines sur une plateforme calme.
 * É4 · Le renvoi vers Live ne porte AUCUN nombre. « Les N plus anciens » se
 *      lirait « il en reste N », alors que N ne serait que l'écart entre 40 et
 *      l'affiché, face à des milliers de lignes en base.
 * É5 · Le signal `payments_failed` s'affiche « agence à régulariser ». Le serveur
 *      compte les agences de la file `unpaid`, où tombe aussi toute agence
 *      SUSPENDUE, y compris sans la moindre ligne d'abonnement : « paiement
 *      échoué » serait un fait inventé.
 * É6 · Le pied KYC dit « déposés », le mot du serveur (`links_submitted`), et non
 *      « confirmés » : la plateforme ne confirme rien et ne voit aucune pièce.
 * É7 · Le libellé des comptes reste « utilisateurs » et non « comptes agents » :
 *      la source est un `COUNT(*)` sur `profiles`, sans filtre de rôle — elle
 *      compte les administrateurs, un acheteur et le super-admin qui regarde.
 * É8 · Le tableau des motifs du pouls est AFFICHÉ, là où la maquette le calcule
 *      et rend `null` : sans lui, « Attention requise » n'est suivi d'aucune
 *      explication.
 * É9 · Les tendances « +N ce mois » ne sont pas reprises : la maquette veut des
 *      chiffres NUS. Le contrat les rend toujours (`new_agencies_this_month`),
 *      elles sont donc disponibles sans nouvelle mesure.
 * É10 · Le signal « tickets support » n'est pas dessiné, et son absence est
 *      AFFICHÉE sous « Pas encore de source » : il n'existe ni table, ni un seul
 *      événement `ticket_created`.
 *
 * Le rapport hebdomadaire a quitté cette page pour le Monitoring : les revenus
 * vont à Plans et l'activation à Agences, l'accueil ne garde que des renvois.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, AlertTriangle, Check, ChevronRight, CreditCard, Eye } from 'lucide-react'
import { formatCHF, formatRelativeDate } from '@/lib/utils'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { useAdminOverview } from '@/hooks/useAdminOverview'
import {
  sectionPath,
  groupJournal,
  journalDetail,
  JOURNAL_ACTION_KEY,
  SIGNAL_LABEL_KEY,
  SIGNAL_CTA_KEY,
  UNAVAILABLE_KEY,
  type AdminOverview,
  type OverviewSignal,
} from '@/lib/adminOverview'
import AdminPage from '@/components/admin/kit/AdminPage'
import KycLinkDiagnosticModal from '@/components/admin/KycLinkDiagnosticModal'
import {
  AdminError,
  AdminGhostBtn,
  AdminIc,
  AdminSegmentBtn,
  AdminSkeleton,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

/** Icône d'un signal, par `kind` serveur. Un `kind` inconnu prend l'icône neutre. */
const SIGNAL_ICON: Record<string, typeof AlertTriangle> = {
  functions_error: AlertTriangle,
  payments_failed: CreditCard,
  kyb_review: Eye,
}

/** Nombre de lignes rendues en maille « Détail » avant le renvoi vers Live. */
const DETAIL_ROWS = 9

export default function AdminDashboardPage() {
  const { t } = useTranslation(['admin', 'common'])
  const navigate = useNavigate()
  const { sp, surf, dark, tones } = useAdminSurfaces()
  const { data, isPending, isError, refetch } = useAdminOverview()
  const [maille, setMaille] = useState<'familles' | 'detail'>('familles')
  const [diagOuvert, setDiagOuvert] = useState(false)

  const familles = useMemo(() => groupJournal(data?.journal ?? []), [data])
  const detail = useMemo(() => journalDetail(data?.journal ?? []), [data])

  const tonOf = (ton: string): string =>
    ton === 'critical' || ton === 'err' ? tones.err : ton === 'warn' ? tones.warn : tones.info

  if (isPending) {
    return (
      <AdminPage title={t('admin:dashboard.title')} width="wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AdminSkeleton height={28} width={260} />
          <AdminSkeleton height={54} />
          {Array.from({ length: 5 }).map((_, i) => <AdminSkeleton key={i} height={40} />)}
        </div>
      </AdminPage>
    )
  }

  if (isError || !data) {
    return (
      <AdminPage title={t('admin:dashboard.title')} width="wide">
        <AdminError
          message={t('admin:common.loadError')}
          onRetry={() => void refetch()}
          retryLabel={t('admin:common.retry')}
        />
      </AdminPage>
    )
  }

  const o: AdminOverview = data

  // Ce qui ne va pas, en toutes lettres : « Attention requise » sans explication
  // n'aide personne (É8).
  const motifs: string[] = []
  if (o.pulse.functions_err > 0) motifs.push(t('admin:dashboard.pulse.functionsErr', { count: o.pulse.functions_err }))
  if (o.pulse.crons_failed > 0) motifs.push(t('admin:dashboard.pulse.cronsFailed', { count: o.pulse.crons_failed }))

  const chiffres: Array<{ k: string; v: string }> = [
    { k: 'agencies', v: String(o.kpis.agencies) },
    { k: 'users', v: String(o.kpis.users) },
    { k: 'properties', v: String(o.kpis.properties) },
    { k: 'transactions', v: String(o.kpis.transactions) },
    { k: 'mrr', v: formatCHF(o.kpis.mrr) },
  ]

  const ligneSignal: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, minHeight: 46,
    padding: '0 12px', borderRadius: ADMIN_RADII.row, background: surf.cardSub,
  }
  const ligneJournal: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, minHeight: 44, padding: '0 2px',
  }
  const lignePied: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, minHeight: 48, padding: '0 2px',
    borderTop: surf.hairline,
  }

  const signalLabel = (s: OverviewSignal): string => {
    const key = SIGNAL_LABEL_KEY[s.kind]
    return key ? t(`admin:${key}`, { count: s.count }) : `${s.count} · ${s.kind}`
  }
  const actionLabel = (action: string): string =>
    JOURNAL_ACTION_KEY[action] ? t(`admin:${JOURNAL_ACTION_KEY[action]}`) : action

  return (
    <AdminPage title={t('admin:dashboard.title')} width="wide">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>

        {/* ── Pouls ────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          <span style={{
            width: 9, height: 9, borderRadius: ADMIN_RADII.pill, flexShrink: 0,
            background: o.pulse.healthy ? tones.ok : tones.err,
          }} />
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: sp.ink }}>
            {o.pulse.healthy ? t('admin:dashboard.platformHealthy') : t('admin:dashboard.attentionRequired')}
          </span>
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>
            {motifs.length > 0 ? motifs.join(' · ') : t('admin:dashboard.pulse.noFunctionError')}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <AdminGhostBtn onClick={() => navigate(sectionPath('monitoring'))} style={{ height: 30, fontSize: 'var(--crm-text-sm)' }}>
              {t('common:nav.adminMonitoring')}
            </AdminGhostBtn>
          </div>
        </div>

        {/* ── Cinq chiffres nus ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 38, flexWrap: 'wrap' }}>
          {chiffres.map(c => (
            <div key={c.k}>
              <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.05, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
                {c.v}
              </div>
              <div style={{ marginTop: 3, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>
                {t(`admin:dashboard.num.${c.k}`)}
              </div>
            </div>
          ))}
        </div>

        {/* ── À traiter ────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '0 2px 9px' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
              {t('admin:dashboard.head.title')}
            </h2>
            {o.signals.length > 0 && (
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{o.signals.length}</span>
            )}
          </div>

          {o.signals.length === 0 ? (
            // Seule surface CREUSÉE de la page : un anneau intérieur, pas une carte.
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, minHeight: 54, padding: '0 14px',
              borderRadius: ADMIN_RADII.row,
              boxShadow: `0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(3, 3, 3, 0.07)'} inset`,
            }}>
              <AdminIc icon={Check} size={15} color={sp.sub} />
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>
                {t('admin:dashboard.head.empty')}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {o.signals.map(s => (
                <div key={s.id} style={ligneSignal}>
                  <AdminIc icon={SIGNAL_ICON[s.kind] ?? Activity} size={15} color={tonOf(s.tone)} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>
                    {signalLabel(s)}
                  </span>
                  <AdminGhostBtn onClick={() => navigate(sectionPath(s.go))} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
                    {SIGNAL_CTA_KEY[s.kind] ? t(`admin:${SIGNAL_CTA_KEY[s.kind]}`) : t('common:actions.view')}
                    <AdminIc icon={ChevronRight} size={13} color={sp.sub} />
                  </AdminGhostBtn>
                </div>
              ))}
            </div>
          )}

          {/* Les manques que le SERVEUR nomme. Un jeton inconnu s'affiche brut :
              taire un manque non répertorié serait le pire des deux. */}
          {o.unavailable.length > 0 && (
            <div style={{ marginTop: 11, padding: '0 2px' }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
                {t('admin:dashboard.unavailable.title')}
              </span>
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
                {' · '}
                {o.unavailable.map(u => (UNAVAILABLE_KEY[u] ? t(`admin:${UNAVAILABLE_KEY[u]}`) : u)).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* ── Journal ──────────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 2px 10px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
              {t('admin:dashboard.journal.title')}
            </h2>
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
              {t('admin:dashboard.journal.window')}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
              <AdminSegmentBtn on={maille === 'familles'} onClick={() => setMaille('familles')}>
                {t('admin:dashboard.journal.grouped')}
              </AdminSegmentBtn>
              <AdminSegmentBtn on={maille === 'detail'} onClick={() => setMaille('detail')}>
                {t('admin:dashboard.journal.detail')}
              </AdminSegmentBtn>
            </div>
          </div>

          {detail.length === 0 ? (
            <div style={{ padding: '4px 2px', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>
              {t('admin:dashboard.journal.empty')}
            </div>
          ) : maille === 'familles' ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {familles.map((f, i) => (
                <div key={f.action} style={{ ...ligneJournal, borderTop: i === 0 ? undefined : surf.hairline }}>
                  <span style={{ width: 7, height: 7, borderRadius: ADMIN_RADII.pill, flexShrink: 0, background: tonOf(f.tone) }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>
                    {actionLabel(f.action)}
                  </span>
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>{f.count}</span>
                  <span style={{ minWidth: 118, textAlign: 'right', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.agencies.length === 0
                      ? t('admin:dashboard.journal.platform')
                      : f.agencies.length === 1
                        ? f.agencies[0]
                        : t('admin:dashboard.journal.agencies', { count: f.agencies.length })}
                  </span>
                  <span style={{ minWidth: 96, textAlign: 'right', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
                    {formatRelativeDate(f.last)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {detail.slice(0, DETAIL_ROWS).map((r, i) => (
                <div key={r.id} style={{ ...ligneJournal, borderTop: i === 0 ? undefined : surf.hairline }}>
                  <span style={{ width: 7, height: 7, borderRadius: ADMIN_RADII.pill, flexShrink: 0, background: tonOf(r.severity) }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {actionLabel(r.action)}
                    {r.object_label && (
                      <span style={{ marginLeft: 7, fontWeight: 500, color: sp.sub }}>{r.object_label}</span>
                    )}
                  </span>
                  <span style={{ minWidth: 118, textAlign: 'right', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.agency_name ?? t('admin:dashboard.journal.platform')}
                  </span>
                  <span style={{ minWidth: 96, textAlign: 'right', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
                    {formatRelativeDate(r.ts)}
                  </span>
                </div>
              ))}
              {/* Sans nombre : « les N plus anciens » se lirait comme un reste (É4). */}
              <button
                type="button"
                className="adm-row"
                onClick={() => navigate(sectionPath('live'))}
                style={{
                  marginTop: 8, alignSelf: 'flex-start', border: 0, background: 'transparent',
                  padding: '6px 8px', borderRadius: ADMIN_RADII.pill, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
                }}
              >
                {t('admin:dashboard.journal.more')}
              </button>
            </div>
          )}
        </div>

        {/* ── Pied : trois renvois ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={lignePied}>
            <span style={{ minWidth: 148, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {t('admin:dashboard.foot.activation')}
            </span>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
              {o.activation.total}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
              {[
                t('admin:dashboard.foot.activationDormant', { count: o.activation.dormant }),
                t('admin:dashboard.foot.activationRisk', { count: o.activation.at_risk }),
              ].join(' · ')}
            </span>
            <AdminGhostBtn onClick={() => navigate(sectionPath('agencies'))} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
              {t('common:nav.adminAgencies')}
            </AdminGhostBtn>
          </div>

          {/* Liens KYC publics — agrégat SEUL, aucun nom : c'est la frontière que
              cet écran défend. La pilule ouvre le diagnostic, qui exige un motif. */}
          <div style={lignePied}>
            <span style={{ minWidth: 148, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {t('admin:dashboard.foot.kyc')}
            </span>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
              {o.kyc_funnel.links_sent}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
              {o.kyc_funnel.links_sent === 0
                ? t('admin:dashboard.foot.kycEmpty')
                : t('admin:dashboard.foot.kycDetail', {
                    opened: o.kyc_funnel.links_opened,
                    submitted: o.kyc_funnel.links_submitted,
                    conversion: o.kyc_funnel.conversion_pct,
                  })}
            </span>
            <AdminGhostBtn onClick={() => setDiagOuvert(true)} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
              {t('admin:dashboard.foot.diagnose')}
            </AdminGhostBtn>
          </div>

          <div style={lignePied}>
            <span style={{ minWidth: 148, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {t('admin:dashboard.foot.revenue')}
            </span>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
              {formatCHF(o.revenue.mrr)}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
              {o.revenue.subscriptions === 0
                ? t('admin:dashboard.foot.revenueEmpty')
                : t('admin:dashboard.foot.revenueDetail', {
                    count: o.revenue.subscriptions,
                    arpu: formatCHF(o.revenue.arpu),
                  })}
              {o.revenue.failed > 0 && ` · ${t('admin:dashboard.foot.revenueFailed', { count: o.revenue.failed })}`}
            </span>
            <AdminGhostBtn onClick={() => navigate(sectionPath('plans'))} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
              {t('common:nav.adminPlans')}
            </AdminGhostBtn>
          </div>
        </div>
      </div>

      {/* Montée conditionnellement : la modale tire la liste des agences, et cet
          écran s'interdit un second fetch tant qu'on ne le lui demande pas. */}
      {diagOuvert && (
        <KycLinkDiagnosticModal
          onClose={() => setDiagOuvert(false)}
          onGoToJournal={() => { setDiagOuvert(false); navigate(`${ADMIN_CONSOLE_PATH}/security`) }}
        />
      )}
    </AdminPage>
  )
}
