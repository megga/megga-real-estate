/**
 * /dashboard/audit — le journal d'audit de l'agence : l'historique de ce qui s'y est passé.
 *
 * ⛔ REFAIT LE 14.09.2026 (Julien : « inclus tout cela dans le pager ; que l'historique
 * soit organisé et épuré », puis « les exports, on n'en a pas besoin : contente-toi de
 * l'historique »). Ce qui est parti, et pourquoi :
 *  · les exports CSV et PDF, sur décision. L'edge `audit-pdf-export` n'a plus d'appelant
 *    dans l'app — la console avait rendu le sien le 14.08.2026 ;
 *  · les quatre cartes de chiffres et les deux rangées de pastilles (dix catégories, deux
 *    sévérités) : trois menus discrets les remplacent, à côté de la recherche et de la
 *    période, et chaque jour dit ses critiques dans son propre en-tête ;
 *  · deux affirmations FAUSSES du pied de page : « les évènements sont signés
 *    cryptographiquement » (seul l'export PDF chaînait un SHA-256, calculé à la volée) et
 *    « toute tentative de suppression ou modification est elle-même journalisée » (le
 *    trigger d'immuabilité lève une exception : la transaction est annulée, rien ne
 *    s'écrit).
 * Ce qui reste : le CADRE des pages sœurs (Parcours, Analytics : rayon 26, défilement
 * intérieur, barre d'outils fixe au-dessus de l'historique — le titre visible, son
 * sous-titre et le compte sont partis le même jour, à la demande de Julien ; la puce de
 * l'onglet nomme déjà la page), les jours aux en-têtes collants, les rafales « ×N »
 * dépliables, le détail de chaque ligne au clic.
 *
 * ⚠ L'historique se lit PAR PAGES de 1000 — le max_rows de PostgREST, qu'aucune requête
 * ne dépasse (`useAuditEvents`) : « Charger les évènements plus anciens » prolonge la
 * liste, et tant qu'il reste des pages, la recherche — qui filtre à l'écran — dit
 * qu'elle ne voit que le chargé.
 *
 * ⛔ PÉRIMÈTRE : l'agence du profil (voir useAuditLog.ts). Sans agence — le super-admin
 * de production n'en a pas —, rien n'est lu, et la page le dit au lieu de se taire.
 *
 * ⛔ PAS DE VARIANTE MOBILE (route sans `ResponsiveRoute`) : sous 768 px (`useIsMobile`,
 * le seuil de `ResponsiveRoute`), tout défile d'un bloc, la barre passe à la ligne et
 * l'acteur quitte sa colonne pour se poser sous le sujet.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import EtatVide from '@/components/crm/EtatVide'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { AUDIT_CATEGORIES, dossierPalette } from '@/components/crm-dossiers/tokens'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import { AudDayGroup } from '@/components/crm-dossiers/audit/AudDayGroup'
import { correspondRecherche, grouperParJour, libelleActeur, nombreSuisse } from '@/components/crm-dossiers/audit/journal'
import { useCrmDarkPref } from '@/lib/crmDark'
import { useTabLabel, useTabScopedState } from '@/hooks/useCrmTabs'
import { useAuditEvents } from '@/hooks/useAuditLog'
import { useTeamMembers } from '@/hooks/useTeam'
import { useAuth } from '@/hooks/useAuth'
import type { FamilleActeur } from '@/lib/auditActor'
import type { AuditCategory, AuditSeverity } from '@/types/kyc'

const PERIODES = [
  { jours: 7, cle: 'audit.period.days7' },
  { jours: 30, cle: 'audit.period.days30' },
  { jours: 90, cle: 'audit.period.days90' },
  { jours: 3650, cle: 'audit.period.all' },
] as const

/** Hauteur commune des contrôles de la barre : recherche, période, menus. */
const H_CONTROLE = 36

interface MenuProps<T extends string> {
  sp: CrmPalette
  dark: boolean
  libelle: string
  valeur: T | 'all'
  options: { v: T | 'all'; libelle: string }[]
  onChange: (v: T | 'all') => void
}

/**
 * Un filtre de la barre : un `<select>` natif habillé en pilule — accessible au clavier,
 * juste sur mobile. Un filtre posé prend l'ACCENT (l'élément actif le porte, règle du
 * 10.08.2026) : on voit d'un coup d'œil ce qui restreint l'historique.
 */
function Menu<T extends string>({ sp, dark, libelle, valeur, options, onChange }: MenuProps<T>) {
  const actif = valeur !== 'all'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <select
        aria-label={libelle}
        value={valeur}
        onChange={(e) => onChange(e.target.value as T | 'all')}
        style={{
          appearance: 'none', WebkitAppearance: 'none', height: H_CONTROLE,
          paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'calc(var(--crm-space-2xl) + 14px)',
          borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${actif ? sp.accent : sp.cardBorder}`,
          background: actif ? sp.accent : sp.cardBg, color: actif ? sp.accentInk : sp.ink,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
          colorScheme: dark ? 'dark' : 'light',
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v} style={{ color: sp.ink, background: sp.solidBg }}>{o.libelle}</option>
        ))}
      </select>
      <span aria-hidden style={{ position: 'absolute', right: 'var(--crm-space-lg)', top: '50%', transform: 'translateY(-50%)', display: 'grid', pointerEvents: 'none' }}>
        <CrmIcon name="chevDown" size={12} stroke={actif ? sp.accentInk : sp.sub} />
      </span>
    </span>
  )
}

export default function AuditPage() {
  const etroit = useIsMobile()
  const { t: tr } = useTranslation('common')
  // L'onglet dit « Journal d'audit », pas « Analytics » — la section à laquelle la route
  // est rattachée dans la barre latérale, et que la puce reprenait faute de libellé.
  useTabLabel(tr('audit.tabLabel'))
  // ⚠ Le thème PARTAGÉ : la barre latérale de cette page le bascule, et les lignes du
  // journal le lisent (`useCrmDark`). Un état local laissait la bascule privée.
  const [dark, setDark] = useCrmDarkPref()
  const sp = useMemo(() => crmPalette(dark), [dark])
  // Les encres d'état lisibles sur la surface (`errDarker` : 6,47:1 en clair, `red400` en sombre).
  const S = useMemo(() => dossierPalette(dark), [dark])
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null

  // Les filtres sont rangés dans l'ONGLET : un aller-retour vers un autre onglet retrouve
  // le journal tel qu'on l'avait laissé. La recherche, elle, reste locale — une saisie en
  // cours n'a rien à faire dans la pile des onglets, qui se sauvegarde.
  const [jours, setJours] = useTabScopedState<number>('audit:jours', 30)
  const [categorie, setCategorie] = useTabScopedState<AuditCategory | 'all'>('audit:categorie', 'all')
  const [acteur, setActeur] = useTabScopedState<FamilleActeur | 'all'>('audit:acteur', 'all')
  const [severite, setSeverite] = useTabScopedState<AuditSeverity | 'all'>('audit:severite', 'all')
  const [recherche, setRecherche] = useState('')

  const {
    data: events = [], isLoading, isError, isPlaceholderData, refetch,
    hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError,
  } = useAuditEvents({ days: jours, category: categorie, acteur, severity: severite })
  // ⚠ Une page suivante qui échoue met la requête en erreur SANS lui retirer ce qu'elle a
  // lu : l'historique chargé reste à l'écran, seul le bouton dit l'échec.
  const echec = isError && events.length === 0
  // Pas de page suivante demandée sur une liste de remplacement : elle appartient aux
  // filtres d'AVANT, et sa « suite » n'existe pas pour ceux d'après.
  const suite = !!hasNextPage && !isPlaceholderData
  const chargerPlus = () => { void fetchNextPage() }
  // Les collègues nomment l'agent qui a agi : « Grégory Lyonnet » plutôt qu'« Agent ».
  const { data: equipe } = useTeamMembers()
  const noms = useMemo(() => new Map((equipe ?? []).map((m) => [m.id, m.full_name])), [equipe])

  const visibles = useMemo(
    () => (recherche.trim() ? events.filter((e) => correspondRecherche(e, recherche, libelleActeur(e, noms))) : events),
    [events, recherche, noms],
  )
  const parJour = useMemo(
    () => grouperParJour(visibles, { today: tr('audit.today'), yesterday: tr('audit.yesterday') }),
    [visibles, tr],
  )
  const filtre = categorie !== 'all' || acteur !== 'all' || severite !== 'all' || recherche.trim() !== ''
  const reinitialiser = () => {
    setCategorie('all')
    setActeur('all')
    setSeverite('all')
    setRecherche('')
  }

  // ⛔ PLUS D'EN-TÊTE VISIBLE (14.09.2026, Julien : « supprime ») : la puce de l'onglet dit
  // déjà « Journal d'audit », et le titre, le sous-titre et le compte repoussaient
  // l'historique d'un bloc entier. Le titre reste pour les lecteurs d'écran : sans `h1`,
  // la page n'a plus de nom dans la liste de ses titres.
  const titre = <h1 className="sr-only">{tr('audit.title')}</h1>

  // ⚠ La période et les trois menus forment UN bloc qui se replie d'un tenant : faute de
  // place (1280 px, barre latérale ouverte), c'est le bloc entier qui passe sous la
  // recherche — pas un menu orphelin seul sur sa ligne.
  const barre = (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        flex: '1 1 240px', minWidth: 0, height: H_CONTROLE,
        padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)',
        background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      }}>
        <CrmIcon name="search" size={15} stroke={sp.sub} />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={tr('audit.searchPlaceholder')}
          aria-label={tr('audit.searchPlaceholder')}
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', color: sp.ink,
          }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: etroit ? 'wrap' : 'nowrap', gap: 'var(--crm-space-md)', minWidth: 0, maxWidth: '100%' }}>
        {/* Sous 768 px la période défile dans sa pilule plutôt que de déborder du cadre. */}
        <div role="group" aria-label={tr('audit.period.label')} className={etroit ? 'scrollbar-hide' : undefined} style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: H_CONTROLE,
          maxWidth: '100%', overflowX: etroit ? 'auto' : 'visible', flexShrink: 0,
          padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)',
          background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
        }}>
          {PERIODES.map((p) => {
            const on = jours === p.jours
            return (
              <button
                key={p.jours}
                type="button"
                aria-pressed={on}
                onClick={() => setJours(p.jours)}
                style={{
                  height: '100%', padding: '0 var(--crm-space-lg)', border: 0, borderRadius: 'var(--crm-radius-pill)',
                  background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.sub,
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {tr(p.cle)}
              </button>
            )
          })}
        </div>

        <Menu<AuditCategory>
          sp={sp} dark={dark} libelle={tr('audit.filter.category')} valeur={categorie} onChange={setCategorie}
          options={[
            { v: 'all', libelle: tr('audit.filter.allCategories') },
            ...(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => ({ v: c, libelle: AUDIT_CATEGORIES[c].label })),
          ]}
        />
        <Menu<FamilleActeur>
          sp={sp} dark={dark} libelle={tr('audit.filter.actor')} valeur={acteur} onChange={setActeur}
          options={[
            { v: 'all', libelle: tr('audit.filter.allActors') },
            { v: 'agent', libelle: tr('audit.filter.agents') },
            { v: 'ai', libelle: tr('audit.actor.ai') },
            { v: 'system', libelle: tr('audit.actor.system') },
          ]}
        />
        <Menu<AuditSeverity>
          sp={sp} dark={dark} libelle={tr('audit.filter.severity')} valeur={severite} onChange={setSeverite}
          options={[
            { v: 'all', libelle: tr('audit.filter.allSeverities') },
            { v: 'critical', libelle: tr('audit.severity.critical') },
            { v: 'warn', libelle: tr('audit.severity.warning') },
          ]}
        />
        {/* Une pastille d'icône, pas un libellé : écrit en toutes lettres, « Effacer les
            filtres » faisait passer le bloc sous la recherche dès qu'un filtre était posé. */}
        {filtre && (
          <button
            type="button"
            onClick={reinitialiser}
            aria-label={tr('audit.filter.reset')}
            title={tr('audit.filter.reset')}
            style={{
              width: H_CONTROLE, height: H_CONTROLE, flexShrink: 0, padding: 0,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg,
            }}
          >
            <CrmIcon name="close" size={13} stroke={sp.ink} />
          </button>
        )}
      </div>
    </div>
  )

  // ⚠ La recherche filtre À L'ÉCRAN : elle ne voit que les pages chargées. Tant qu'il en
  // reste, elle le dit — et offre d'aller plus loin, là où l'œil cherche le résultat.
  const avisRecherche = recherche.trim() && suite && (
    <p style={{ margin: 'var(--crm-space-md) 0 0', fontSize: 'var(--crm-text-sm)', lineHeight: 1.5, color: sp.sub }}>
      {tr('audit.searchLoadedOnly', { count: events.length, n: nombreSuisse(events.length) })}{' '}
      <button type="button" onClick={chargerPlus} disabled={isFetchingNextPage} style={{
        border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', cursor: 'pointer',
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink,
        textDecoration: 'underline', textUnderlineOffset: 3,
      }}>
        {isFetchingNextPage ? tr('audit.loading') : tr('audit.loadMore')}
      </button>
    </p>
  )

  // Le squelette dessine la forme de ce qui arrive : un jour, cinq lignes.
  const barreGrise = (largeur: number | string, hauteur: number) => (
    <span style={{ display: 'block', width: largeur, height: hauteur, borderRadius: 'var(--crm-radius-xs)', background: sp.focusSurface }} />
  )
  const squelette = (
    <div aria-busy="true" aria-label={tr('audit.loading')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-lg)' }}>
      {barreGrise(120, 14)}
      <div style={{ borderRadius: 'var(--crm-radius-4xl)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-lg) var(--crm-space-4xl)',
            borderBottom: i < 4 ? `1px solid ${sp.cardBorder}` : 0,
          }}>
            {barreGrise(36, 10)}
            <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--crm-radius-lg)', background: sp.focusSurface }} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
              {barreGrise('38%', 12)}
              {barreGrise('22%', 10)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  // Quatre raisons d'un historique vide, quatre phrases : pas d'agence, lecture en échec,
  // filtre trop étroit, période sans rien.
  const corps = !agencyId ? (
    <EtatVide dark={dark} glyphe={<CrmIcon name="lock" size={22} />} titre={tr('audit.noAgency')} />
  ) : echec ? (
    <EtatVide
      dark={dark} registre="erreur" titre={tr('audit.error')}
      action={{ libelle: tr('audit.retry'), onClick: () => { void refetch() } }}
    />
  ) : isLoading ? squelette : parJour.length === 0 ? (
    <EtatVide
      dark={dark} glyphe={<CrmIcon name="clock" size={22} />}
      titre={filtre ? tr('audit.empty') : tr('audit.emptyPeriod')}
      action={filtre ? { libelle: tr('audit.filter.reset'), onClick: reinitialiser } : undefined}
    />
  ) : (
    <div aria-busy={isPlaceholderData} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)',
      opacity: isPlaceholderData ? 0.55 : 1, transition: 'opacity .2s ease',
    }}>
      {parJour.map((j) => (
        <AudDayGroup key={j.cle} libelle={j.libelle} events={j.events} noms={noms} compacte={etroit} />
      ))}
    </div>
  )

  const pied = agencyId && (
    <footer style={{ marginTop: 'var(--crm-space-4xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', lineHeight: 1.5, color: sp.sub }}>
      {/* La suite de l'historique, page par page : une requête ne rend jamais plus de 1000
          lignes (max_rows de PostgREST), et une agence active les dépasse vite sur « Tout ». */}
      {suite && !echec && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-sm)', marginBottom: 'var(--crm-space-lg)' }}>
          <button
            type="button"
            onClick={chargerPlus}
            disabled={isFetchingNextPage}
            aria-busy={isFetchingNextPage}
            style={{
              height: H_CONTROLE, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, color: sp.ink,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
              cursor: isFetchingNextPage ? 'default' : 'pointer', opacity: isFetchingNextPage ? 0.6 : 1,
            }}
          >
            {isFetchingNextPage ? tr('audit.loading') : tr('audit.loadMore')}
          </button>
          {isFetchNextPageError && (
            <span role="alert" style={{ color: S.errDarker, fontWeight: 600 }}>{tr('audit.loadMoreError')}</span>
          )}
        </div>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
        <CrmIcon name="lock" size={13} stroke={sp.sub} />
        {tr('audit.footer.retention')}
      </span>
    </footer>
  )

  return (
    <div
      data-screen-label="CRM Audit nLPD"
      style={{
        position: 'relative', height: '100vh', width: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: sp.pageBg, fontFamily: 'var(--crm-font)', color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace sp={sp} dark={dark} setDark={setDark}>
          {/* Le CADRE BENTO des pages sœurs : le journal flottait à même le canvas, sa page
              entière défilait, et les popovers de la bande n'avaient pas de coin où se loger. */}
          <main style={etroit
            ? { flex: 1, minWidth: 0, minHeight: 0, height: '100%', padding: 'var(--crm-space-lg) var(--crm-space-2xl) var(--crm-space-6xl)' }
            : { flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}
          >
            <div style={{ position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg }}>
              {etroit ? (
                <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'var(--crm-space-2xl)' }}>
                  {titre}
                  {barre}
                  {avisRecherche}
                  <div style={{ marginTop: 'var(--crm-space-lg)' }}>{corps}</div>
                  {pied}
                </div>
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                  {/* En-tête et barre FIXES : seul l'historique défile, sous des jours collants. */}
                  <div style={{ flex: 'none', padding: 'var(--crm-space-7xl) var(--crm-space-7xl) var(--crm-space-md)' }}>
                    {titre}
                    {barre}
                    {avisRecherche}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 var(--crm-space-7xl) var(--crm-space-7xl)' }}>
                    {corps}
                    {pied}
                  </div>
                </div>
              )}
            </div>
          </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}
