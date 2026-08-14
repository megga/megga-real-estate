/**
 * Page super-admin — Communication (concept C « écrire d'abord »).
 *
 * Route : `/dashboard/admin/changelog`. L'onglet Changelog n'ouvre plus de
 * modale : la **feuille de rédaction est l'écran**, et l'historique vit
 * dessous. Écrire est le geste par défaut, pas un clic préalable.
 *
 * ── Écarts et constats assumés, nommés plutôt que tus ──
 *
 * É1 · **L'onglet « Annonces » est CONSERVÉ**, alors que la maquette écrit
 *      « un seul objet ici : le changelog, pas d'annonce in-app ». Retirer une
 *      capacité branchée relève de la décision PO n° 5 (« périmètre à
 *      démonter »), pas d'une passe UI. Ce que le PO doit savoir pour trancher,
 *      mesuré : `platform_announcements` = **0 ligne**, aucune surface agent ne
 *      la lit, et ses écritures passent en PostgREST direct — donc **modifier,
 *      dépublier ou supprimer une annonce ne laisse aucune trace**, et l'écran
 *      Sécurité n'en montrera jamais aucune. Le changelog, lui, passe par cinq
 *      RPC gardées et journalisées.
 * É2 · ⛔ **AUCUNE chaîne de cet écran n'affirme une visibilité agent**, et
 *      c'est une propriété, pas une liste d'interdits. Mesuré :
 *      `get_agent_changelog` est déployée, gardée, testée — et n'a **aucun
 *      appelant** dans `src/`. Publier enregistre un état ; personne ne le lit.
 *      L'écran le DIT (`changelog.noReader`) au lieu de le taire.
 * É3 · **Pas d'« Aperçu de l'entrée »** : la maquette en dessine un, calqué sur
 *      une carte agent (`today-h-live.jsx`) qui **n'existe pas au dépôt**.
 *      « Aperçu » veut dire « voilà ce que ça donnera » — rien ne donnera ça.
 * É4 · **Pas de compteur d'agents.** La maquette écrit deux fois « sur la page
 *      Aujourd'hui des 240 agents ». La base compte **sept** profils, dont
 *      **un seul** agent, et aucune page ne sert cette nouveauté.
 * É5 · **Trois états, pas deux.** La table porte `draft | scheduled |
 *      published` ; l'écran n'en montrait que deux (`published` ou non), ce qui
 *      rendait `scheduled` invisible — et donc inatteignable, faute d'appelant.
 * É6 · **Une entrée publiée n'est plus modifiable**, et l'écran le dit au lieu
 *      de laisser cliquer : `admin_changelog_save` refuse. C'est aussi pourquoi
 *      la création part désormais en **brouillon** par défaut — l'ancien
 *      `published = true` initial menait tout droit dans cette impasse.
 * É7 · **Le retrait est un « repasser en brouillon »**, pas une suppression :
 *      le texte est conservé. La suppression reste offerte, séparément, et sa
 *      confirmation ne promet plus la perte de l'historique — la ligne
 *      d'`activity_events` survit (table append-only).
 * É8 · **La PROGRAMMATION n'a pas de surface.** `scheduleEntry` et
 *      `admin_changelog_schedule` sont déployées et testées, mais programmer
 *      exige un sélecteur de date que la maquette ne dessine pas — et le cron
 *      `changelog-publish` tourne depuis le 1ᵉʳ août sans avoir jamais eu quoi
 *      que ce soit à publier, faute d'appelant. L'état `scheduled` est donc
 *      AFFICHÉ (une entrée programmée en base se voit) mais non PRODUISIBLE
 *      depuis cet écran. Nommé plutôt que bricolé.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Megaphone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useChangelog } from '@/hooks/useChangelog'
import { useToast } from '@/components/ui/Toast'
import AnnouncementsTab from '@/components/admin/AnnouncementsTab'
import AdminPage from '@/components/admin/kit/AdminPage'
import AdminConfirm from '@/components/admin/AdminConfirm'
import {
  AdminEmpty, AdminError, AdminGhostBtn, AdminPill, AdminSegmentBtn,
  AdminSkeleton, AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

type Tab = 'changelog' | 'announcements'

/** État d'une entrée, dérivé du couple `status`/`published` de la table. */
type EntryState = 'draft' | 'scheduled' | 'published'

const STATE_TONE: Record<EntryState, AdminToneName> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'ok',
}

/** Ordre du calendrier éditorial : ce qui attend une décision d'abord. */
const STATE_ORDER: Record<EntryState, number> = { scheduled: 0, draft: 1, published: 2 }

export default function AdminCommunicationPage() {
  const { t } = useTranslation('admin')
  const [tab, setTab] = useState<Tab>('changelog')

  return (
    <AdminPage title={t('communication.title')} subtitle={t('communication.subtitle')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {(['changelog', 'announcements'] as const).map(k => (
          <AdminSegmentBtn key={k} on={tab === k} onClick={() => setTab(k)} variant="tab">
            {t(`communication.tab.${k}`)}
          </AdminSegmentBtn>
        ))}
      </div>

      {tab === 'changelog' ? <ChangelogSheet /> : <AnnouncementsTab />}
    </AdminPage>
  )
}

/** Onglet Changelog — la feuille d'abord, l'historique dessous. */
function ChangelogSheet() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const toast = useToast()
  const {
    entries, isLoading, isError, refetch,
    createEntry, publishEntry, unpublishEntry, deleteEntry,
  } = useChangelog()

  const [titre, setTitre] = useState('')
  const [texte, setTexte] = useState('')
  const [version, setVersion] = useState('')
  const [aPublier, setAPublier] = useState<string | null>(null)
  const [aRetirer, setARetirer] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const pret = titre.trim().length > 2

  /** État d'une entrée. `status` fait foi quand il existe ; `published` est le repli. */
  const etatDe = (e: { status?: string | null; published?: boolean | null }): EntryState => {
    if (e.status === 'scheduled') return 'scheduled'
    if (e.status === 'published' || e.published) return 'published'
    return 'draft'
  }

  const triees = useMemo(
    () => [...entries].sort((a, b) => STATE_ORDER[etatDe(a)] - STATE_ORDER[etatDe(b)]),
    [entries],
  )
  const compte = useMemo(() => {
    let drafts = 0, scheduled = 0
    for (const e of entries) {
      const s = etatDe(e)
      if (s === 'draft') drafts += 1
      else if (s === 'scheduled') scheduled += 1
    }
    return { drafts, scheduled }
  }, [entries])

  const vider = () => { setTitre(''); setTexte(''); setVersion('') }
  const echec = () => toast.error(t('changelog.error'))

  /**
   * Enregistrer. ⚠ TOUJOURS en brouillon : `admin_changelog_save` crée en
   * brouillon quoi qu'on demande, et refuse ensuite de modifier une entrée
   * publiée. L'ancien écran initialisait « publié » — une création partait donc
   * directement dans l'état où plus rien n'est modifiable.
   */
  const enregistrer = (publier: boolean) => {
    if (!pret || createEntry.isPending) return
    createEntry.mutate(
      { title: titre.trim(), content: texte.trim(), version: version.trim(), published: publier },
      {
        onSuccess: () => { vider(); toast.success(t(publier ? 'changelog.flash.published' : 'changelog.flash.draft')) },
        onError: echec,
      },
    )
  }

  const champ: CSSProperties = {
    width: '100%', border: 0, background: 'transparent', outline: 'none',
    fontFamily: 'inherit', color: sp.ink, padding: 0,
  }
  const ligne: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 13, minHeight: 50, padding: '0 2px',
    borderTop: surf.hairline,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ── La feuille : écrire est le geste par défaut ─────────────────────── */}
      <div style={{ padding: '18px 18px 14px', borderRadius: ADMIN_RADII.card, background: surf.cardSub }}>
        <input
          value={titre}
          onChange={e => setTitre(e.target.value)}
          placeholder={t('changelog.sheet.titlePlaceholder')}
          aria-label={t('changelog.sheet.titlePlaceholder')}
          style={{ ...champ, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: -0.5 }}
        />
        <textarea
          value={texte}
          onChange={e => setTexte(e.target.value)}
          placeholder={t('changelog.sheet.descPlaceholder')}
          aria-label={t('changelog.sheet.descPlaceholder')}
          rows={3}
          style={{ ...champ, marginTop: 10, fontSize: 'var(--crm-text-md)', fontWeight: 500, resize: 'vertical', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 12, borderTop: surf.hairline, flexWrap: 'wrap' }}>
          <input
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder={t('changelog.sheet.versionPlaceholder')}
            aria-label={t('changelog.sheet.versionPlaceholder')}
            style={{ ...champ, width: 160, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <AdminGhostBtn
              onClick={() => enregistrer(false)}
              disabled={!pret || createEntry.isPending}
              style={{ height: 32, fontSize: 'var(--crm-text-sm)' }}
            >
              {t('changelog.sheet.saveDraft')}
            </AdminGhostBtn>
            <AdminSolidBtn
              onClick={() => enregistrer(true)}
              disabled={!pret || createEntry.isPending}
            >
              {t('changelog.sheet.publishNow')}
            </AdminSolidBtn>
          </div>
        </div>
      </div>

      {/* ── L'historique ────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '0 2px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>
            {t('changelog.history')}
          </h2>
          {(compte.drafts > 0 || compte.scheduled > 0) && (
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
              {t('changelog.counts', compte)}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => <AdminSkeleton key={i} height={50} />)}
          </div>
        ) : isError ? (
          <AdminError message={t('common.loadError')} onRetry={() => void refetch()} retryLabel={t('common.retry')} />
        ) : triees.length === 0 ? (
          <AdminEmpty icon={Megaphone} title={t('changelog.empty.title')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {triees.map(e => {
              const etat = etatDe(e)
              return (
                <div key={e.id} style={ligne}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink }}>{e.title}</span>
                      <AdminPill label={t(`changelog.state.${etat}`)} tone={STATE_TONE[etat]} />
                      {e.version && <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{e.version}</span>}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {etat === 'published'
                        ? `${t('changelog.publishedLocked')} · ${formatDate(e.created_at)}`
                        : formatDate(e.created_at)}
                    </div>
                  </div>

                  {/* Les gestes offerts dépendent de l'état — publier une entrée
                      déjà publiée, ou modifier ce que le serveur a figé, n'a pas
                      de sens et ne doit pas être proposé. */}
                  {etat === 'published' ? (
                    <AdminGhostBtn onClick={() => setARetirer(e.id)} disabled={unpublishEntry.isPending} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
                      {t('changelog.action.unpublish')}
                    </AdminGhostBtn>
                  ) : (
                    <AdminGhostBtn onClick={() => setAPublier(e.id)} disabled={publishEntry.isPending} style={{ height: 28, fontSize: 'var(--crm-text-xs)' }}>
                      {t('changelog.action.publish')}
                    </AdminGhostBtn>
                  )}
                  <AdminGhostBtn
                    onClick={() => setASupprimer(e.id)}
                    disabled={deleteEntry.isPending}
                    style={{ height: 28, fontSize: 'var(--crm-text-xs)', color: tones.err }}
                  >
                    {t('changelog.action.delete')}
                  </AdminGhostBtn>
                </div>
              )
            })}
          </div>
        )}

        {/* ⛔ La seule ligne que l'écran DOIT dire : rien ne lit encore ce qu'on
            publie. La taire ferait d'un geste sans effet un geste qui paraît en
            avoir un (É2). */}
        <div style={{ marginTop: 14, padding: '0 2px', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
          {t('changelog.noReader')}
        </div>
      </div>

      <AdminConfirm
        open={aPublier !== null}
        onClose={() => setAPublier(null)}
        onConfirm={() => {
          const id = aPublier
          setAPublier(null)
          if (id) publishEntry.mutate(id, {
            onSuccess: () => toast.success(t('changelog.flash.published')),
            onError: echec,
          })
        }}
        title={t('changelog.publishTitle')}
        message={t('changelog.publishBody')}
        confirmLabel={t('changelog.action.publish')}
        tone="warn"
        busy={publishEntry.isPending}
        busyLabel={t('common.saving')}
      />

      <AdminConfirm
        open={aRetirer !== null}
        onClose={() => setARetirer(null)}
        onConfirm={() => {
          const id = aRetirer
          setARetirer(null)
          if (id) unpublishEntry.mutate(id, {
            onSuccess: () => toast.success(t('changelog.flash.unpublished')),
            onError: echec,
          })
        }}
        title={t('changelog.unpublishTitle')}
        message={t('changelog.unpublishMessage')}
        confirmLabel={t('changelog.action.unpublish')}
        tone="warn"
        busy={unpublishEntry.isPending}
        busyLabel={t('common.saving')}
      />

      <AdminConfirm
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        onConfirm={() => {
          const id = aSupprimer
          setASupprimer(null)
          if (id) deleteEntry.mutate(id, {
            onSuccess: () => toast.success(t('changelog.flash.deleted')),
            onError: echec,
          })
        }}
        title={t('changelog.deleteTitle')}
        message={t('changelog.deleteMessage')}
        confirmLabel={t('changelog.action.delete')}
        tone="err"
        busy={deleteEntry.isPending}
        busyLabel={t('common.saving')}
      />

    </div>
  )
}
