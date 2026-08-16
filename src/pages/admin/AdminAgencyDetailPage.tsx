/**
 * Page super-admin — fiche agence (concept B de la maquette `admin-agency-detail.jsx`).
 *
 * Route : `/dashboard/admin/agencies/:id`. Plein cadre, **une colonne, aucun
 * onglet, aucune carte** : des sections séparées par un filet. Un seul appel —
 * `get_admin_agency_detail()` assemble équipe, invitations, usage, abonnement,
 * note et activation côté serveur, là où la fiche faisait six allers-retours.
 *
 * La fiche **mesure l'usage de la plateforme, pas le contenu du CRM** : les
 * tables de biens et de transactions (titre, prix, ville) ont quitté cet écran,
 * il n'en reste que des compteurs.
 *
 * ── Écarts assumés vis-à-vis de la maquette, nommés plutôt que tus ──
 *
 * É1 · **Aucun plafond de sièges n'est affiché.** La maquette en propose un par
 *      plan ; le dépôt en porte quatre versions divergentes et **aucune ne
 *      s'applique** (aucune fonction de plafond n'existe en base). L'afficher
 *      trancherait en silence la décision PO n° 4. La ligne dit donc l'occupé,
 *      et nomme le manque.
 * É2 · **Pas d'invitation de membre.** La maquette l'offre, mais aucun chemin
 *      serveur super-admin n'existe : `send-team-invite` est un geste d'agence,
 *      et son plafond dépend justement de la décision n° 4. La section
 *      « Invitations en attente » se contente donc de LIRE.
 * É3 · **Pas de bouton « Ouvrir dans Stripe ».** La RPC ampute délibérément
 *      `stripe_customer_id` de sa réponse : le lien n'aurait aucune cible.
 * É4 · **Le compteur de biens garde le même libellé quand l'agence est
 *      suspendue.** La maquette écrit « biens — hors ligne » ; mesuré :
 *      `admin-agency-lifecycle` ne touche jamais `properties`, et le compteur
 *      vaut `count(*) where status='active'`. Afficher « hors ligne » sur des
 *      annonces toujours diffusées serait un fait inventé.
 * É5 · **Le changement de plan quitte la fiche** (maquette) mais survit sur
 *      l'écran Plans : aucune capacité n'est perdue. Son retrait complet
 *      appartient à la décision n° 5, pas à une passe UI.
 * É6 · **L'impersonation reste** sur la ligne de membre : retirer une capacité
 *      branchée et auditée est une décision produit écrite (n° 5), pas un geste
 *      de refonte.
 * É7 · **Deux surfaces perdent leur seule adresse UI** : le formulaire de quotas
 *      (`admin_set_agency_quotas`) et les factures Stripe
 *      (`admin-stripe-agency-billing`). Les deux gestes serveur restent
 *      déployés et testés ; 0 ligne en production dans les deux cas. Rouvrir un
 *      écran plus tard coûtera un écran, pas un backend.
 * É9 · **L'appel d'accueil arrive de `main`, pas de la maquette.** La section
 *      a été ajoutée à l'ancienne fiche pendant cette refonte ; elle est portée
 *      ici plutôt qu'écrasée. Elle garde sa règle : distinguer « jamais
 *      réservé », « à venir » et « déjà passé » — n'afficher « aucun appel »
 *      pour les trois masquerait le seul cas qui demande une relance. Rendue en
 *      section à filet, sans carte, pour suivre la grammaire du concept B.
 * É8 · **La confirmation de suspension ne GARANTIT pas le nombre.** L'edge
 *      épargne les comptes super-admin allowlistés : le libellé dit « jusqu'à
 *      N », pas « N ».
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clock, Eye } from 'lucide-react'
import { formatCHF, formatDate, formatRelativeDate } from '@/lib/utils'
import { ADMIN_CONSOLE_PATH, openImpersonation } from '@/lib/adminEntry'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useAgencyOnboardingCalls } from '@/hooks/useAdminOnboardingCalls'
import {
  useAdminAgencyDetail,
  type AgencyDetailMember,
  type AgencyDetailPayload,
} from '@/hooks/useAdminAgencyDetail'
import AdminConfirm from '@/components/admin/AdminConfirm'
import {
  AdminEmpty,
  AdminError,
  AdminGhostBtn,
  AdminIc,
  AdminPill,
  AdminSkeleton,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

/** Ton de la pilule d'état d'une agence. */
const STATUS_TONE: Record<string, AdminToneName> = { active: 'ok', suspended: 'err' }

export default function AdminAgencyDetailPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSurfaces()
  const { data, isPending, isError, refetch } = useAdminAgencyDetail(id)
  const { updateStatus } = useAdminAgencies()

  const [confirmOuvert, setConfirmOuvert] = useState(false)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)

  const payload: AgencyDetailPayload | undefined = data
  const agency = payload?.agency
  const team = useMemo(() => payload?.team ?? [], [payload])
  const invitations = useMemo(() => payload?.invitations ?? [], [payload])

  const filet: CSSProperties = { borderTop: surf.hairline }
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, minHeight: 46, padding: '0 2px',
  }
  const enveloppe: CSSProperties = {
    padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', minWidth: 0,
    // ⚠ La classe `adm-fade-up` n'anime RIEN par elle-même : c'est uniquement
    // l'interrupteur d'extinction sous `prefers-reduced-motion`. L'animation vit
    // en inline dans `AdminPage` ; sans elle, cette page serait la seule de la
    // console sans entrée en fondu.
    animation: 'admFadeUp .32s cubic-bezier(.2,.8,.2,1) both',
  }

  const filAriane = (
    <Link
      to={`${ADMIN_CONSOLE_PATH}/agencies`}
      className="adm-row"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        marginBottom: 14, padding: '5px 9px 5px 6px', borderRadius: ADMIN_RADII.pill,
        textDecoration: 'none', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
      }}
    >
      <AdminIc icon={ArrowLeft} size={14} color={sp.sub} />
      {t('agencyDetail.back')}
    </Link>
  )

  if (isPending) {
    return (
      <div className="adm-fade-up" style={enveloppe}>
        {filAriane}
        <AdminSkeleton height={44} width={320} />
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => <AdminSkeleton key={i} height={44} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="adm-fade-up" style={enveloppe}>
        {filAriane}
        <AdminError
          message={t('common.loadError')}
          onRetry={() => void refetch()}
          retryLabel={t('common.retry')}
        />
      </div>
    )
  }

  if (!payload?.found || !agency) {
    return (
      <div className="adm-fade-up" style={enveloppe}>
        {filAriane}
        <AdminEmpty icon={Eye} title={t('agencyDetail.notFound')} />
      </div>
    )
  }

  const usage = payload.usage
  const subscription = payload.subscription
  const note = payload.note
  // ⚠ `agencies.status` est NULLABLE en base : sans ce repli, la pilule et le
  // pied destructif rendraient une clé i18n brute.
  const statut = agency.status ?? 'active'
  const suspendue = statut === 'suspended'
  const nom = agency.name
  const planLabel = agency.plan
    ? t(`common.plan.${agency.plan.toLowerCase()}`, { defaultValue: agency.plan })
    : '—'

  const basculer = (vers: 'active' | 'suspended') => {
    setConfirmOuvert(false)
    setFlash(null)
    updateStatus.mutate(
      { id, status: vers },
      {
        onSuccess: () => setFlash({
          ok: true,
          text: vers === 'suspended'
            ? t('agencyDetail.suspend.done', { name: nom })
            : t('agencyDetail.reactivate.done', { name: nom }),
        }),
        onError: () => setFlash({ ok: false, text: t('agencyDetail.lifecycle.error') }),
      },
    )
  }

  const chiffre = (valeur: string, libelle: string) => (
    <div key={libelle} style={{ minWidth: 118 }}>
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.8, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
        {valeur}
      </div>
      <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{libelle}</div>
    </div>
  )

  const section = (cle: string, titre: string, contenu: ReactNode) => (
    <section key={cle} style={{ ...filet, paddingTop: 16, marginTop: 22 }}>
      <h2 style={{
        margin: '0 0 11px', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
      }}>
        {titre}
      </h2>
      {contenu}
    </section>
  )

  const membre = (m: AgencyDetailMember, i: number) => (
    <div key={m.id} style={{ ...ligne, borderTop: i === 0 ? undefined : surf.hairline }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.name ?? t('common.noName')}
          {m.suspended && (
            <span style={{ marginLeft: 8, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: tones.err }}>
              {t('agencyDetail.team.suspended')}
            </span>
          )}
        </div>
        <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[m.email, m.role ? t(`common.role.${m.role}`, { defaultValue: m.role }) : null]
            .filter(Boolean).join(' · ')}
        </div>
      </div>
      <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap' }}>
        {t('agencyDetail.team.registeredOn', { date: formatDate(m.since) })}
      </span>
      {/* Bouton icône : le libellé complet part en `title` ET en `label`
          (nom accessible), sinon un lecteur d'écran n'annonce qu'une icône. */}
      <AdminGhostBtn
        onClick={() => openImpersonation(m.id)}
        title={t('agencyDetail.team.impersonate', { name: m.name ?? t('common.noName') })}
        label={t('agencyDetail.team.impersonate', { name: m.name ?? t('common.noName') })}
        style={{ height: 28, width: 28, padding: 0, justifyContent: 'center' }}
      >
        <AdminIc icon={Eye} size={14} color={sp.sub} />
      </AdminGhostBtn>
    </div>
  )

  return (
    <div className="adm-fade-up" style={enveloppe}>
      {filAriane}

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 600, letterSpacing: -1.4, lineHeight: 1.05, color: sp.ink }}>
          {nom}
        </h1>
        <AdminPill
          label={t(`common.status.${statut}`, { defaultValue: statut })}
          tone={STATUS_TONE[statut] ?? 'neutral'}
        />
        {agency.sub === 'trialing' && <AdminPill label={t('agencies.sub.trialing')} tone="info" />}
        {agency.sub === 'past_due' && <AdminPill label={t('agencies.sub.pastDue')} tone="err" />}
        {suspendue && (
          <div style={{ marginLeft: 'auto' }}>
            <AdminGhostBtn onClick={() => basculer('active')} disabled={updateStatus.isPending} style={{ height: 30, fontSize: 'var(--crm-text-sm)' }}>
              {t('agencyDetail.reactivate.cta')}
            </AdminGhostBtn>
          </div>
        )}
      </div>
      <div style={{ marginTop: 5, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
        {[agency.city, agency.canton, agency.email].filter(Boolean).join(' · ')}
      </div>

      {flash && (
        <div style={{
          marginTop: 14, padding: '11px 13px', borderRadius: ADMIN_RADII.row, background: surf.cardSub,
          fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: flash.ok ? sp.ink : tones.err,
        }}>
          {flash.text}
        </div>
      )}

      {/* ── Équipe ──────────────────────────────────────────────────────────── */}
      {section('team', t('agencyDetail.section.team'),
        team.length === 0
          ? <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, padding: '2px 2px 6px' }}>
              {t('agencyDetail.team.empty')}
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column' }}>{team.map(membre)}</div>,
      )}

      {/* ── Invitations en attente — lecture seule (É2) ──────────────────────── */}
      {invitations.length > 0 && section('invites', t('agencyDetail.section.invites'),
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {invitations.map((inv, i) => (
            <div key={inv.id ?? `${inv.email}-${i}`} style={{ ...ligne, borderTop: i === 0 ? undefined : surf.hairline }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {inv.email ?? t('common.noName')}
              </span>
              {inv.role && (
                <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
                  {t(`common.role.${inv.role}`, { defaultValue: inv.role })}
                </span>
              )}
              {inv.created_at && (
                <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap' }}>
                  {t('agencyDetail.invites.sentOn', { date: formatDate(inv.created_at) })}
                </span>
              )}
            </div>
          ))}
        </div>,
      )}

      {/* ── Portefeuille — des COMPTEURS, jamais le contenu du CRM ───────────── */}
      {section('portfolio', t('agencyDetail.section.portfolio'),
        <div>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            {chiffre(String(agency.agents), t('agencyDetail.portfolio.agents', { count: agency.agents }))}
            {chiffre(String(agency.properties), t('agencyDetail.portfolio.properties'))}
            {chiffre(String(agency.deals), t('agencyDetail.portfolio.deals'))}
          </div>
          <div style={{ marginTop: 10, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
            {agency.last
              ? t('agencyDetail.portfolio.lastActivity', { when: formatRelativeDate(agency.last) })
              : t('agencyDetail.portfolio.noActivity')}
          </div>
        </div>,
      )}

      {/* ── Usage de la plateforme — la RPC le calcule à chaque ouverture ; le
             jeter aurait coûté le calcul sans en rendre la valeur ─────────── */}
      {usage && section('usage', t('agencyDetail.section.usage'),
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
          {chiffre(String(usage.contacts_count ?? 0), t('agencyDetail.usage.contacts'))}
          {chiffre(String(usage.ai_calls_month ?? 0), t('agencyDetail.usage.aiCalls'))}
          {chiffre(`$${Number(usage.ai_cost_month_usd ?? 0).toFixed(2)}`, t('agencyDetail.usage.aiCost'))}
          {chiffre(String(usage.wa_messages_month ?? 0), t('agencyDetail.usage.whatsapp'))}
          {chiffre(`${Math.round(Number(usage.storage_est_mb ?? 0))} Mo`, t('agencyDetail.usage.storage'))}
        </div>,
      )}

      {/* ── Appel d'accueil (apporté par main pendant la refonte, É9) ───────── */}
      <AppelAccueil agencyId={agency.id} section={section} />

      {/* ── Abonnement ──────────────────────────────────────────────────────── */}
      {section('subscription', t('agencyDetail.section.subscription'),
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={ligne}>
            <span style={{ minWidth: 118, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {t('agencyDetail.sub.plan')}
            </span>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
              {t('agencyDetail.sub.planValue', { plan: planLabel, price: formatCHF(Number(agency.mrr)) })}
            </span>
          </div>
          <div style={{ ...ligne, borderTop: surf.hairline }}>
            <span style={{ minWidth: 118, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {t('agencyDetail.sub.seats')}
            </span>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
              {t('agencyDetail.sub.seatsValue', { count: agency.agents })}
              {' · '}
              {/* É1 : le plafond n'est pas affiché, il est NOMMÉ comme manquant. */}
              {t('agencyDetail.sub.seatsNoCap')}
            </span>
          </div>
          {!subscription && (
            <div style={{ ...ligne, borderTop: surf.hairline, minHeight: 38 }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
                {t('agencyDetail.sub.none')}
              </span>
            </div>
          )}
        </div>,
      )}

      {/* ── Note interne — jamais lue par l'agence (RLS super-admin seule) ───── */}
      {note?.note && section('note', t('agencyDetail.section.note'),
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.ink, whiteSpace: 'pre-wrap' }}>
          {note.note}
        </div>,
      )}

      {/* ── Pied destructif ─────────────────────────────────────────────────── */}
      {!suspendue && (
        <div style={{ ...filet, marginTop: 26, paddingTop: 16 }}>
          <AdminGhostBtn
            onClick={() => setConfirmOuvert(true)}
            disabled={updateStatus.isPending}
            style={{ height: 30, fontSize: 'var(--crm-text-sm)', color: tones.err }}
          >
            {t('agencyDetail.suspend.cta')}
          </AdminGhostBtn>
        </div>
      )}

      <AdminConfirm
        open={confirmOuvert}
        onClose={() => setConfirmOuvert(false)}
        onConfirm={() => basculer('suspended')}
        title={t('agencyDetail.suspend.title', { name: nom })}
        message={
          team.length === 0
            ? t('agencyDetail.suspend.messageNoMember')
            : t('agencyDetail.suspend.message', { count: team.length })
        }
        confirmLabel={t('agencyDetail.suspend.confirm')}
        tone="warn"
        // Sans `busy`, un double-clic part deux fois : deux lignes au registre
        // pour un seul geste voulu.
        busy={updateStatus.isPending}
        busyLabel={t('common.saving')}
      />
    </div>
  )
}

/**
 * Appel d'accueil de l'agence.
 *
 * Trois états qui se ressemblent trop pour être confondus : jamais réservé,
 * réservé et à venir, déjà passé. Un écran qui n'afficherait « aucun appel »
 * pour les trois masquerait le seul cas qui demande une relance — c'est la
 * règle apportée par `main`, conservée telle quelle.
 */
function AppelAccueil({ agencyId, section }: {
  agencyId: string
  section: (cle: string, titre: string, contenu: ReactNode) => ReactNode
}) {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSurfaces()
  const { data: calls, isLoading } = useAgencyOnboardingCalls(agencyId)

  const trie = [...(calls ?? [])].sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at))
  const aVenir = trie.find(c => c.status === 'confirmed' && Date.parse(c.scheduled_at) > Date.now())
  const dernier = aVenir ?? trie[0] ?? null

  return section('call', t('agencyDetail.onboardingCall.title'),
    isLoading ? <AdminSkeleton height={40} /> : !dernier ? (
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, padding: '2px 2px 6px' }}>
        {t('agencyDetail.onboardingCall.none')}
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 40 }}>
        <AdminIc icon={Clock} size={15} color={sp.sub} />
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
          {new Intl.DateTimeFormat('fr-CH', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
          }).format(new Date(dernier.scheduled_at))}
        </span>
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{dernier.host_name}</span>
        <AdminPill
          label={t(`onboardingCalls.status.${dernier.status}`)}
          tone={dernier.status === 'confirmed' ? 'ok' : dernier.status === 'no_show' ? 'err' : 'neutral'}
        />
        {dernier.rescheduled_count > 0 && (
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
            {t('onboardingCalls.table.rescheduled', { count: dernier.rescheduled_count })}
          </span>
        )}
      </div>
    ))
}
