// MEGGA CRM — Pager « Contacts » (refonte Claude Design, port fidèle).
// Un grand bento arrondi (viewport) qui glisse verticalement entre deux pages :
//   Page 0 → La liste (sous-nav audience, lignes)                      [en haut]
//   Page 1 → Santé du portefeuille (agrégats + segments cliquables)   [en bas]
// Recherche LOCALE depuis le 16.09.2026 (décision Julien) : elle FILTRE la liste
// par nom, e-mail ou téléphone, `/` pour y aller. Ce n'est pas un doublon de la
// recherche globale (⌘K, `openCrmSearch`), qui ouvre UN résultat de n'importe quel
// genre. Le port du handoff Beta v1 n'en avait pas ; ce commentaire l'interdisait.
// Cliquer un segment de la Santé filtre la liste et remonte en page 0.
// Molette (accumulateur) / flèches + PageUp-Down / swipe / points latéraux.
// Réf. handoff : `crm-screen-contacts-proto.jsx` (CRMScreenContactsProto).
//
// Le chrome (CrmSidebar) est monté par la page conteneur
// (ContactsPage) ; ce composant remplit le <main> avec le viewport.

import EtatVide from '@/components/crm/EtatVide'
import {
  Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef,
  type CSSProperties, type ReactNode, type RefObject,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmContact } from '@/components/crm/mockData'
import { type CrmPalette } from '@/components/crm/tokens'
import { crmInitials } from '@/components/crm/tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { CTP_FN, FN_BUYER_INK } from '@/components/crm/contacts-pager/ctpTokens'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActifRef } from '@/hooks/useEcranActif'
import { modaleOuverte } from '@/lib/modaleOuverte'
import MEIcon from '@/components/propertyx/MEIcon'
import { grouperMilliers } from '@/lib/montantSaisi'

type Audience = 'buyer' | 'seller' | 'tenant'

/**
 * Grille de REPLI de la liste — squelette, et en-tête tant qu'aucun contact n'est
 * chargé. Dès qu'il y en a, `--ctp-cols` la remplace par des colonnes MESURÉES.
 */
const CTP_GRID = '1.7fr .8fr 1fr 1fr 1.1fr 34px'
const CTP_COLS = `var(--ctp-cols, ${CTP_GRID})`
/** Bornes de la colonne Contact : un nom très long se coupe au lieu d'écraser les autres. */
const CONTACT_MIN = 160
const CONTACT_MAX = 360
const CHEVRON_W = 34

// Styles de texte partagés par les cellules ET leur gabarit de mesure : une largeur
// mesurée dans un autre style que celui affiché serait fausse.
const ST_NOM: CSSProperties = { fontSize: 'var(--crm-text-xl)', fontWeight: 600 }
const ST_MONTANT: CSSProperties = { fontSize: 'var(--crm-text-lg)', fontWeight: 600 }
const ST_PRECISION: CSSProperties = { fontSize: 'var(--crm-text-sm)', fontWeight: 500 }
const ST_DERNIER: CSSProperties = { fontSize: 'var(--crm-text-lg)', fontWeight: 600 }
const ST_ENTETE: CSSProperties = { fontSize: 'var(--crm-text-sm)', fontWeight: 500 }

// ── Dérivations depuis un CrmContact ────────────────────────────────────
function audienceOf(c: CrmContact): Audience {
  if (c.type === 'seller' || c.type === 'landlord') return 'seller'
  if (c.type === 'tenant' || c.criteria?.transaction === 'location') return 'tenant'
  return 'buyer'
}
function kycStatusOf(c: CrmContact): 'verified' | 'pending' | 'stale' | 'none' {
  const s = c.kyc?.status
  return s && s !== 'none' ? s : 'none'
}
const daysSince = (iso: string | undefined): number => {
  if (!iso) return 9999
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

// Arrondi à une décimale — ne sert plus qu’à la médiane de budget de la Santé.
const num1 = (n: number) => (Math.round(n * 10) / 10).toString()

/**
 * Cellule « Budget » : le PLAFOND en montant complet, et une ligne de précision
 * dessous. ⛔ Remplace le 16.09.2026 (décision Julien, « fouillis ») une écriture
 * abrégée qui mélangeait les échelles et les symboles sur une même colonne —
 * « 3.2K/mois », « 0.9–1.3M », « ≤ 1.1M ». Le plafond est ce qui compte pour
 * proposer des biens ; le minimum passe dessous, en petit.
 */
type BudgetCell = { montant: string; precision: { cle: 'from' | 'max' | 'min' | 'perMonth'; n?: string } }
function budgetCell(c: CrmContact): BudgetCell | null {
  const cr = c.criteria
  if (!cr) return null
  const lo = cr.budgetMin || null
  const hi = cr.budgetMax || null
  if (cr.transaction === 'location') {
    const loyer = hi ?? lo
    return loyer ? { montant: grouperMilliers(Math.round(loyer)), precision: { cle: 'perMonth' } } : null
  }
  if (hi && lo) return { montant: grouperMilliers(Math.round(hi)), precision: { cle: 'from', n: grouperMilliers(Math.round(lo)) } }
  if (hi) return { montant: grouperMilliers(Math.round(hi)), precision: { cle: 'max' } }
  if (lo) return { montant: grouperMilliers(Math.round(lo)), precision: { cle: 'min' } }
  return null
}

// ── Modèle de filtre (liste + Santé partagent le même) ──────────────────
type Filter =
  | { type: 'audience'; value: 'all' | Audience; label?: string }
  | { type: 'kyc'; value: 'verified' | 'pending' | 'none'; label: string }
  | { type: 'source'; value: string; label: string }
  | { type: 'stale'; value: 'stale'; label: string }

const plier = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Recherche de la liste. Chaque mot doit figurer dans le nom ou l'e-mail (sans
 * accents : « zoe » trouve Zoé). Trois chiffres ou plus cherchent AUSSI dans le
 * téléphone, zéro de tête ignoré — « 079 412 » trouve « +41 79 412 88 03 ».
 */
function matchRecherche(c: CrmContact, q: string): boolean {
  const mots = plier(q).split(/\s+/).filter(Boolean)
  if (!mots.length) return true
  const texte = plier(`${c.firstName} ${c.lastName} ${c.email || ''}`)
  if (mots.every((m) => texte.includes(m))) return true
  const chiffres = q.replace(/\D/g, '').replace(/^0+/, '')
  return chiffres.length >= 3 && (c.phone || '').replace(/\D/g, '').includes(chiffres)
}

function matchFilter(c: CrmContact, f: Filter): boolean {
  if (f.type === 'audience') return f.value === 'all' || audienceOf(c) === f.value
  if (f.type === 'kyc') {
    // La tuile « Aucun » agrège none + stale → le filtre doit couvrir les deux
    // (sinon le compteur diverge de la liste filtrée).
    if (f.value === 'none') return kycStatusOf(c) === 'none' || kycStatusOf(c) === 'stale'
    return kycStatusOf(c) === f.value
  }
  if (f.type === 'source') return (c.source || '') === f.value
  if (f.type === 'stale') return daysSince(c.lastActivityAt) >= 7
  return true
}

// ═══════════════════════════════════════════════════════════════════════
//   ATOMES (dark-aware via sp)
// ═══════════════════════════════════════════════════════════════════════
/**
 * ⚠ L'encre est DÉRIVÉE de l'aplat, jamais choisie. La teinte vient d'un hachage
 * de l'id du contact : aucun humain ne la relit avant qu'elle s'affiche, et sept
 * des huit échouaient l'AA sous le blanc figé qui était posé ici (#F59E0B :
 * 2,15:1). Choisir sept nouvelles encres à la main aurait reproduit le défaut à
 * la teinte suivante.
 */
function CtpAvatar({ c, size = 38, sp }: { c: CrmContact; size?: number; sp: CrmPalette }) {
  const aplat = c.avatarBg || sp.accent
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0,
      background: aplat, color: encreSur(aplat),
      display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 600,
      letterSpacing: 0.2, boxShadow: `0 0 0 3px ${sp.avatarBorder}`,
    }}>
      {crmInitials(`${c.firstName} ${c.lastName}`)}
    </div>
  )
}

/**
 * ⚠ Même règle que l'avatar. Sous le `'#fff'` qui était écrit ici, trois des
 * quatre teintes échouaient l'AA — `seller` 4,37 · `tenant` 3,68 · `ok` 3,77 ;
 * seul `buyer` passait (6,24). L'encre reste DÉRIVÉE ; ce sont `seller` et `tenant`
 * qui ont été foncés (16.09.2026, cf. `CTP_FN`) pour que le blanc l'emporte sur les
 * trois pastilles — la teinte, qui encode le type, n'a pas bougé.
 */
function CtpTypePill({ aud, label }: { aud: Audience; label: string }) {
  const aplat = CTP_FN[aud]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 var(--crm-space-md)',
      borderRadius: 'var(--crm-radius-pill)', background: aplat, color: encreSur(aplat),
      fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.1, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function CtpKyc({ status, sp, dark, labels }: {
  status: ReturnType<typeof kycStatusOf>
  sp: CrmPalette
  dark: boolean
  labels: { verified: string; verifiedTitle: string; pending: string; stale: string }
}) {
  if (status === 'verified')
    return <span title={labels.verifiedTitle} style={{ display: 'inline-flex', alignItems: 'center', color: FN_BUYER_INK(dark), fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{labels.verified}</span>
  if (status === 'pending')
    return <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>{labels.pending}</span>
  if (status === 'stale')
    return <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub }}>{labels.stale}</span>
  return <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, opacity: 0.6 }}>{'—'}</span>
}

function CtpBar({ pct, color, dark }: { pct: number; color: string; dark: boolean }) {
  return (
    <div style={{ height: 8, borderRadius: 'var(--crm-radius-pill)', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(3, pct)}%`, height: '100%', borderRadius: 'var(--crm-radius-pill)', background: color, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
    </div>
  )
}

function CtpCta({ children, sp, onClick }: { children: ReactNode; sp: CrmPalette; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-2xl)',
      borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, border: 0,
      fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    }}>{children}</button>
  )
}

/**
 * Squelette de chargement de la liste — reprend la grille et les gabarits de
 * ligne réels pour que l'apparition des vraies données ne décale rien.
 * Même grammaire de shimmer que `ContactsFirstRun` (1.25 s, garde
 * `prefers-reduced-motion`), classe distincte car ces deux écrans ne coexistent
 * jamais mais vivent dans des blocs `<style>` séparés.
 */
function CtpSkeletonRows({ dark, hairSoft }: { dark: boolean; hairSoft: string }) {
  const skVars = {
    '--sk': dark ? 'rgba(255,255,255,.08)' : '#E7EAF0',
    '--skHi': dark ? 'rgba(255,255,255,.17)' : '#F5F7FA',
  } as CSSProperties
  const bar = (w: number) => ({ width: w, height: 11, borderRadius: 'var(--crm-radius-xs)' })
  return (
    <div aria-hidden="true" style={skVars}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: CTP_GRID, gap: 'var(--crm-space-xl)', alignItems: 'center',
          padding: 'var(--crm-space-xl) var(--crm-space-6xl)', borderBottom: i < 5 ? `1px solid ${hairSoft}` : '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
            <div className="ctp-sk" style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0 }} />
            <div className="ctp-sk" style={bar(140)} />
          </div>
          <div className="ctp-sk" style={bar(60)} />
          <div className="ctp-sk" style={{ ...bar(70), justifySelf: 'end', marginRight: 'var(--crm-space-6xl)' }} />
          <div className="ctp-sk" style={bar(50)} />
          <div className="ctp-sk" style={bar(70)} />
          <div />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 0 — LA LISTE
// ═══════════════════════════════════════════════════════════════════════
function CtpTopList({ contacts, sp, dark, isLoading, filter, setFilter, recherche, setRecherche, rechercheRef, onOpenContact, onNewContact }: {
  contacts: CrmContact[]
  sp: CrmPalette
  dark: boolean
  /** Chargement Supabase en cours → squelette, jamais le message d'empty-filter. */
  isLoading: boolean
  filter: Filter
  setFilter: (f: Filter) => void
  recherche: string
  setRecherche: (q: string) => void
  /** Posée par le pager : `/` y met le focus depuis n'importe où dans l'écran. */
  rechercheRef: RefObject<HTMLInputElement | null>
  onOpenContact: (id: string) => void
  onNewContact: () => void
}) {
  const { t } = useTranslation('contacts')
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const hairStrong = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'
  const hairSoft = dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'

  const kycLabels = {
    verified: t('pager.kyc.verified'),
    // Le title qualifie la donnée (« KYC vérifié ») là où le libellé visible
    // dit juste « Vérifié » — sinon l'infobulle n'apporte rien.
    verifiedTitle: t('pager.kyc.verifiedTitle'),
    pending: t('pager.kyc.pending'),
    stale: t('pager.kyc.stale'),
  }
  const audLabel: Record<Audience, string> = {
    buyer: t('contactType.buyer'),
    seller: t('contactType.seller'),
    tenant: t('contactType.tenant'),
  }
  const relLabel = useCallback((iso: string | undefined) => {
    const d = daysSince(iso)
    if (d <= 0) return t('pager.today')
    if (d === 1) return t('pager.yesterday')
    if (d < 30) return t('relativeTime.j', { n: d })
    if (d < 365) return t('relativeTime.mois', { n: Math.round(d / 30) })
    // Au-delà d'un an, basculer en années : « il y a 36 mois » est illisible.
    return t('relativeTime.ans', { count: Math.floor(d / 365) })
  }, [t])
  const precisionLabel = useCallback((b: BudgetCell) => t(`pager.budget.${b.precision.cle}`, { n: b.precision.n }), [t])

  /*
   * ⚖ COLONNES MESURÉES (16.09.2026, décision Julien : « mesure chaque catégorie pour
   * un parfait équilibre »). Des fractions fixes laissaient un vide inégal : KYC collé
   * au budget, Type loin du nom. Chaque colonne prend désormais la largeur de son
   * contenu le plus large, et l'espace restant se partage À PARTS ÉGALES entre elles
   * (`justify-content: space-between`).
   * La mesure porte sur TOUS les contacts (et les titres de colonne), jamais sur les
   * seules lignes affichées : sans quoi les colonnes glisseraient à chaque lettre tapée
   * dans la recherche. ⚠ Pas sur tout le vocabulaire non plus : un « En attente » que
   * personne ne porte élargirait la colonne KYC et creuserait un vide que l'œil voit.
   */
  const gabarit = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs)]
    const budgets = contacts.map(budgetCell).filter((b): b is BudgetCell => b !== null)
    return {
      noms: uniq(contacts.map(c => `${c.firstName} ${c.lastName}`)),
      audiences: [...new Set(contacts.map(audienceOf))],
      kycs: [...new Set(contacts.map(kycStatusOf))],
      montants: uniq(budgets.map(b => b.montant)),
      sansBudget: budgets.length < contacts.length,
      precisions: uniq(budgets.map(precisionLabel)),
      derniers: uniq(contacts.map(c => relLabel(c.lastActivityAt))),
    }
  }, [contacts, precisionLabel, relLabel])
  const listeRef = useRef<HTMLDivElement>(null)
  const gabaritRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const liste = listeRef.current, mesure = gabaritRef.current
    if (!liste || !mesure) return
    const mesurer = () => {
      if (!contacts.length) { liste.style.removeProperty('--ctp-cols'); return }
      const [contact, type, budget, kyc, dernier] = [0, 1, 2, 3, 4].map((i) => Math.ceil(Math.max(0,
        ...Array.from(mesure.querySelectorAll<HTMLElement>(`[data-col="${i}"] > *`), (el) => el.getBoundingClientRect().width))))
      liste.style.setProperty('--ctp-cols',
        `minmax(${CONTACT_MIN}px, ${Math.min(CONTACT_MAX, contact)}px) ${type}px ${budget}px ${kyc}px ${dernier}px ${CHEVRON_W}px`)
    }
    mesurer()
    // Inter Tight peut arriver après le premier rendu : ses chiffres ne font pas la
    // largeur de la police de repli.
    let vivant = true
    void document.fonts?.ready.then(() => { if (vivant) mesurer() })
    return () => { vivant = false }
  }, [contacts.length, gabarit, t])

  // Les compteurs suivent la recherche : « Acheteurs 0 · Vendeurs 1 » dit où est
  // le résultat avant qu'on change de filtre.
  const trouves = useMemo(() => contacts.filter(c => matchRecherche(c, recherche)), [contacts, recherche])
  const tabs: { id: 'all' | Audience; label: string; n: number }[] = [
    { id: 'all', label: t('segments.all'), n: trouves.length },
    { id: 'buyer', label: t('segments.buyer'), n: trouves.filter(c => audienceOf(c) === 'buyer').length },
    { id: 'seller', label: t('segments.seller'), n: trouves.filter(c => audienceOf(c) === 'seller').length },
    { id: 'tenant', label: t('segments.tenant'), n: trouves.filter(c => audienceOf(c) === 'tenant').length },
  ]
  const rows = useMemo(() => trouves.filter(c => matchFilter(c, filter)), [trouves, filter])
  const segActive = filter.type !== 'audience'
  // Montants calés à droite, pour que les millions tombent sous les millions.
  const BUDGET_COL: CSSProperties = { textAlign: 'right' }
  const ligneGrille: CSSProperties = {
    display: 'grid', gridTemplateColumns: CTP_COLS, justifyContent: 'space-between', columnGap: 'var(--crm-space-3xl)',
    padding: 'var(--crm-space-xl) var(--crm-space-6xl)',
  }
  const colonneGabarit: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }

  return (
    // Bord à bord (16.09.2026) : la liste n'est plus une carte posée dans le cadre du
    // pager, avec 26 × 34 px de marge — deux cadres l'un dans l'autre. Elle PREND le
    // cadre ; la barre et l'en-tête de colonnes s'alignent sur la marge des lignes.
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: surface }}>
      {/* Titre pour les lecteurs d'écran seulement : l'onglet et la barre latérale disent
          déjà « Contacts », et le titre visible poussait la liste d'une ligne entière
          (retiré le 16.09.2026, décision Julien). */}
      <h1 className="sr-only">{t('pager.title')}</h1>

      {/* Barre unique : audiences + éventuel filtre issu de la Santé, puis le bouton de
          création au bout de la même ligne — plus d'élément isolé au-dessus de la liste. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap', padding: 'var(--crm-space-5xl) var(--crm-space-6xl) var(--crm-space-3xl)' }}>
        {tabs.map(tb => {
          const on = !segActive && (filter.type === 'audience' ? filter.value : 'all') === tb.id
          return (
            <button key={tb.id} onClick={() => setFilter({ type: 'audience', value: tb.id })} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
              border: on ? '0' : `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(3,3,3,.1)'}`,
              background: on ? sp.accent : surface,
              color: on ? sp.accentInk : sp.soft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer', boxShadow: on ? 'none' : sp.shadowSm,
            }}>
              {tb.label}
              <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: on ? sp.accentInk : sp.sub, opacity: on ? 0.72 : 1 }}>{tb.n}</span>
            </button>
          )
        })}
        {segActive && (
          <button onClick={() => setFilter({ type: 'audience', value: 'all' })} title={t('pager.removeFilter')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 36, padding: '0 var(--crm-space-md) 0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
            border: 0, background: dark ? 'rgba(30,91,198,0.22)' : '#E8EFFE', color: FN_BUYER_INK(dark),
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
          }}>
            {filter.label}
            <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', background: dark ? 'rgba(255,255,255,.12)' : 'rgba(30,91,198,.14)', fontSize: 'var(--crm-text-lg)', lineHeight: 1 }}>{'✕'}</span>
          </button>
        )}
        <div style={{ flex: 1 }} />
        <label className="ctp-search" style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', width: 260, height: 36, boxSizing: 'border-box',
          padding: '0 var(--crm-space-md) 0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)',
          border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(3,3,3,.1)'}`, color: sp.sub, cursor: 'text',
        }}>
          <MEIcon name="search" size={16} strokeWidth={2} />
          <input
            ref={rechercheRef}
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setRecherche(''); e.currentTarget.blur() } }}
            placeholder={t('pager.search')}
            aria-label={t('pager.searchLabel')}
            autoComplete="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, height: '100%', padding: 0, border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500 }}
          />
          {recherche
            ? (
              <button type="button" onClick={() => { setRecherche(''); rechercheRef.current?.focus() }} aria-label={t('pager.searchClear')} style={{
                display: 'grid', placeItems: 'center', width: 22, height: 22, padding: 0, border: 0, borderRadius: 'var(--crm-radius-pill)',
                background: dark ? 'rgba(255,255,255,.1)' : 'rgba(3,3,3,.07)', color: sp.soft, cursor: 'pointer',
              }}>
                <MEIcon name="close" size={12} strokeWidth={2.4} />
              </button>
            )
            : (
              <kbd aria-hidden style={{
                display: 'grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 var(--crm-space-xs)', boxSizing: 'border-box',
                borderRadius: 'var(--crm-radius-xs)', border: `1px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(3,3,3,.12)'}`,
                fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
              }}>/</kbd>
            )}
        </label>
        <CtpCta sp={sp} onClick={onNewContact}>{t('pager.newContact')}</CtpCta>
      </div>

      {/* Liste (scrollable) */}
      <div ref={listeRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Gabarit de mesure : invisible, hors du flux, mêmes styles que les cellules. */}
        <div ref={gabaritRef} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div data-col="0" style={colonneGabarit}>
            <span style={ST_ENTETE}>{t('pager.col.contact')}</span>
            {gabarit.noms.map(n => (
              <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
                <span style={{ width: 38, flexShrink: 0 }} /><span style={ST_NOM}>{n}</span>
              </span>
            ))}
          </div>
          <div data-col="1" style={colonneGabarit}>
            <span style={ST_ENTETE}>{t('pager.col.type')}</span>
            {gabarit.audiences.map(a => <CtpTypePill key={a} aud={a} label={audLabel[a]} />)}
          </div>
          <div data-col="2" style={{ ...colonneGabarit, fontVariantNumeric: 'tabular-nums' }}>
            <span style={ST_ENTETE}>{t('pager.col.budget')}</span>
            {gabarit.sansBudget && <span style={ST_MONTANT}>—</span>}
            {gabarit.montants.map(m => <span key={`m${m}`} style={ST_MONTANT}>{m}</span>)}
            {gabarit.precisions.map(p => <span key={`p${p}`} style={ST_PRECISION}>{p}</span>)}
          </div>
          <div data-col="3" style={colonneGabarit}>
            <span style={ST_ENTETE}>{t('pager.col.kyc')}</span>
            {gabarit.kycs.map(k => (
              <Fragment key={k}><CtpKyc status={k} sp={sp} dark={dark} labels={kycLabels} /></Fragment>
            ))}
          </div>
          <div data-col="4" style={colonneGabarit}>
            <span style={ST_ENTETE}>{t('pager.col.last')}</span>
            {gabarit.derniers.map(d => <span key={d} style={ST_DERNIER}>{d}</span>)}
          </div>
        </div>
        <div style={{ ...ligneGrille, ...ST_ENTETE, color: sp.sub, borderTop: `1px solid ${hairStrong}`, borderBottom: `1px solid ${hairStrong}` }}>
          <div>{t('pager.col.contact')}</div><div>{t('pager.col.type')}</div><div style={BUDGET_COL}>{t('pager.col.budget')}</div><div>{t('pager.col.kyc')}</div><div>{t('pager.col.last')}</div><div />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {isLoading && <CtpSkeletonRows dark={dark} hairSoft={hairSoft} />}
          {!isLoading && rows.length === 0 && (
            <EtatVide dark={dark} titre={recherche.trim() ? t('pager.searchEmpty', { q: recherche.trim() }) : t('pager.emptyFilter')} />
          )}
          {!isLoading && rows.map((c, i) => {
            const aud = audienceOf(c)
            const budget = budgetCell(c)
            return (
              <div key={c.id} className="ctp-row" role="button" tabIndex={0}
                onClick={() => onOpenContact(c.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenContact(c.id) } }}
                style={{ ...ligneGrille, alignItems: 'center', borderBottom: i < rows.length - 1 ? `1px solid ${hairSoft}` : '0', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', minWidth: 0 }}>
                  <CtpAvatar c={c} sp={sp} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ ...ST_NOM, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName} {c.lastName}</div>
                  </div>
                </div>
                <div><CtpTypePill aud={aud} label={audLabel[aud]} /></div>
                <div style={{ ...BUDGET_COL, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                  {budget ? (
                    <>
                      <div style={{ ...ST_MONTANT, color: sp.ink }}>{budget.montant}</div>
                      <div style={{ ...ST_PRECISION, color: sp.sub }}>{precisionLabel(budget)}</div>
                    </>
                  ) : <span style={{ ...ST_MONTANT, fontWeight: 400, color: sp.sub }}>—</span>}
                </div>
                <div><CtpKyc status={kycStatusOf(c)} sp={sp} dark={dark} labels={kycLabels} /></div>
                <div style={{ ...ST_DERNIER, color: sp.soft, whiteSpace: 'nowrap' }}>{relLabel(c.lastActivityAt)}</div>
                <div style={{ color: sp.sub, opacity: 0.6, fontSize: 'var(--crm-text-3xl)', textAlign: 'center' }}>{'›'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 1 — SANTÉ DU PORTEFEUILLE
// ═══════════════════════════════════════════════════════════════════════
/**
 * Panneau et ligne de segment de la page Santé.
 *
 * Définis au niveau module, PAS dans le corps de CtpHealthPage : un composant
 * créé pendant le rendu change d'identité à chaque passe, donc React démonte et
 * remonte tout son sous-arbre au lieu de le mettre à jour — état interne perdu,
 * focus perdu, transitions CSS rejouées. Les valeurs dérivées (surface, ombre)
 * se recalculent ici à partir de `sp`/`dark`, comme les autres Ctp*.
 */
function CtpCard({ title, children, sp, dark }: {
  title: string
  children: ReactNode
  sp: CrmPalette
  dark: boolean
}) {
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const panelSh = dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadow}` : sp.shadow
  return (
    <section style={{ background: surface, borderRadius: 'var(--crm-radius-5xl)', boxShadow: panelSh, padding: 'var(--crm-space-5xl) var(--crm-space-6xl)' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 'var(--crm-text-xl)', fontWeight: 500, letterSpacing: -0.2, color: sp.ink }}>{title}</h3>
      {children}
    </section>
  )
}

function CtpSegRow({ dot, label, count, pct, color, seg, sp, dark, onSegment }: {
  dot: string
  label: string
  count: number
  pct: number
  color: string
  seg?: Filter
  sp: CrmPalette
  dark: boolean
  onSegment: (f: Filter) => void
}) {
  return (
    <button className="ctp-seg-row" onClick={() => seg && onSegment(seg)} style={{
      display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: seg ? 'pointer' : 'default', fontFamily: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: dot }} />
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      <CtpBar pct={pct} color={color} dark={dark} />
    </button>
  )
}

function CtpHealthPage({ contacts, sp, dark, onSegment }: {
  contacts: CrmContact[]
  sp: CrmPalette
  dark: boolean
  onSegment: (f: Filter) => void
}) {
  const { t } = useTranslation('contacts')
  const surface = dark ? sp.cardBg : '#FFFFFF'
  const panelShSm = dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadowSm}` : sp.shadowSm
  const n = contacts.length || 1

  const audLabel: Record<Audience, string> = {
    buyer: t('segments.buyer'), seller: t('segments.seller'), tenant: t('segments.tenant'),
  }
  const srcLabel = (s: string): string => {
    const key = `pager.src.${s}`
    const translated = t(key)
    return translated === key ? (s || t('pager.src.other')) : translated
  }

  const kycVerified = contacts.filter(c => kycStatusOf(c) === 'verified').length
  const toRelance = contacts.filter(c => daysSince(c.lastActivityAt) >= 7).length
  const buyerBudgets = contacts.filter(c => audienceOf(c) === 'buyer')
    .map(c => c.criteria?.budgetMax).filter((x): x is number => !!x).sort((a, b) => a - b)
  const medBudget = buyerBudgets.length ? buyerBudgets[Math.floor((buyerBudgets.length - 1) / 2)] : 0
  const medBudgetShort = medBudget >= 1_000_000 ? num1(medBudget / 1_000_000) + 'M' : medBudget >= 1_000 ? Math.round(medBudget / 1_000) + 'K' : null

  const byAud: { a: Audience; n: number }[] = (['buyer', 'tenant', 'seller'] as Audience[]).map(a => ({ a, n: contacts.filter(c => audienceOf(c) === a).length }))
  const kyc = [
    { k: t('pager.kyc.verified'), val: 'verified' as const, n: contacts.filter(c => kycStatusOf(c) === 'verified').length, col: CTP_FN.ok },
    { k: t('pager.kyc.pending'), val: 'pending' as const, n: contacts.filter(c => kycStatusOf(c) === 'pending').length, col: CTP_FN.seller },
    { k: t('pager.kyc.noneShort'), val: 'none' as const, n: contacts.filter(c => kycStatusOf(c) === 'none' || kycStatusOf(c) === 'stale').length, col: sp.sub },
  ]
  const bySrc = Object.entries(contacts.reduce<Record<string, number>>((m, c) => { const s = c.source || 'other'; m[s] = (m[s] || 0) + 1; return m }, {}))
    .map(([k, v]) => ({ k, n: v })).sort((a, b) => b.n - a.n)
  const maxSrc = Math.max(1, ...bySrc.map(s => s.n))

  const kpis = [
    { label: t('health.kpi.active'), val: contacts.length, seg: { type: 'audience', value: 'all', label: t('segments.all') } as Filter },
    { label: t('health.kpi.medBudget'), val: medBudgetShort || '—', seg: { type: 'audience', value: 'buyer', label: t('segments.buyer') } as Filter },
    { label: t('health.kpi.kycVerified'), val: `${kycVerified}/${contacts.length}`, seg: { type: 'kyc', value: 'verified', label: t('health.seg.kycVerified') } as Filter },
    { label: t('health.kpi.relance'), val: toRelance, seg: { type: 'stale', value: 'stale', label: t('health.seg.stale') } as Filter },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '34px 36px', boxSizing: 'border-box', overflowY: 'auto', background: sp.pageBg, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1000, margin: 'auto 0' }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-7xl)', fontWeight: 500, letterSpacing: -1, color: sp.ink, lineHeight: 1 }}>{t('health.title')}</h1>
          <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 8 }}>{t('health.intro')}</div>
        </div>

        {/* Bandeau KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--crm-space-2xl)', marginBottom: 18 }}>
          {kpis.map(k => (
            <button key={k.label} className="ctp-seg" onClick={() => onSegment(k.seg)} style={{
              textAlign: 'left', background: surface, borderRadius: 'var(--crm-radius-3xl)', boxShadow: panelShSm, padding: 'var(--crm-space-3xl) var(--crm-space-4xl)',
              border: 0, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: sp.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, marginTop: 8 }}>{k.label}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 'var(--crm-space-3xl)', alignItems: 'stretch' }}>
          <div className="ctp-seg">
            <CtpCard title={t('health.byAudience')} sp={sp} dark={dark}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
                {byAud.map(r => (
                  <CtpSegRow key={r.a} dot={CTP_FN[r.a]} label={audLabel[r.a]} count={r.n} pct={(r.n / n) * 100} color={CTP_FN[r.a]}
                    seg={{ type: 'audience', value: r.a, label: audLabel[r.a] }} sp={sp} dark={dark} onSegment={onSegment} />
                ))}
              </div>
            </CtpCard>
          </div>

          <div className="ctp-seg">
            <CtpCard title={t('health.kycCoverage')} sp={sp} dark={dark}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
                {kyc.map(r => (
                  <CtpSegRow key={r.val} dot={r.col} label={r.k} count={r.n} pct={(r.n / n) * 100} color={r.col}
                    seg={{ type: 'kyc', value: r.val, label: t('health.seg.kyc', { status: r.k }) }} sp={sp} dark={dark} onSegment={onSegment} />
                ))}
              </div>
            </CtpCard>
          </div>

          <div className="ctp-seg">
            <CtpCard title={t('health.sources')} sp={sp} dark={dark}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
                {bySrc.map(r => (
                  <button key={r.k} className="ctp-seg-row" onClick={() => onSegment({ type: 'source', value: r.k, label: t('health.seg.source', { source: srcLabel(r.k) }) })} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <span style={{ width: 96, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{srcLabel(r.k)}</span>
                    <div style={{ flex: 1 }}><CtpBar pct={(r.n / maxSrc) * 100} color={dark ? 'rgba(255,255,255,.85)' : 'rgba(3,3,3,.82)'} dark={dark} /></div>
                    <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums', width: 16, textAlign: 'right' }}>{r.n}</span>
                  </button>
                ))}
              </div>
            </CtpCard>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   ÉTAT D'ERREUR DE CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════
/**
 * Écran d'échec du chargement Supabase.
 *
 * Indispensable pour ne PAS confondre « la requête a échoué » avec « ce compte
 * n'a aucun contact » : sans lui, une panne réseau présentait le carnet de
 * l'agent comme vide via la couverture premier lancement.
 */
function CtpLoadError({ sp, dark, onRetry, title, message, retryLabel }: {
  sp: CrmPalette
  dark: boolean
  onRetry?: () => void
  title: string
  message: string
  retryLabel: string
}) {
  return (
    <div role="alert" style={{
      position: 'absolute', inset: 0, background: sp.pageBg, padding: '34px 36px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-lg)', textAlign: 'center',
    }}>
      <h2 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: sp.ink }}>{title}</h2>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.5, color: sp.sub }}>{message}</p>
      {onRetry && (
        <button className="ctp-seg" onClick={onRetry} style={{
          marginTop: 8, height: 34, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: 'transparent', color: sp.ink,
          border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(3,3,3,.1)'}`,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
        }}>{retryLabel}</button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   POINTS + INDICE
// ═══════════════════════════════════════════════════════════════════════
function CtpPageDots({ page, onGo, sp, dark, count, labels, goLabel }: {
  page: number
  onGo: (i: number) => void
  sp: CrmPalette
  dark: boolean
  count: number
  labels: string[]
  /** Annonce l'interaction ET la destination — un point nu ne dit rien au lecteur d'écran. */
  goLabel: (target: string) => string
}) {
  const activeCol = sp.accent
  const idleCol = dark ? 'rgba(255,255,255,.22)' : 'rgba(3,3,3,.18)'
  if (count < 2) return null
  return (
    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)} title={labels[i]} aria-label={goLabel(labels[i])} style={{
          width: 8, height: i === page ? 26 : 8, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0,
          background: i === page ? activeCol : idleCol, transition: 'height .5s cubic-bezier(.76,0,.24,1), background .4s ease',
        }} />
      ))}
    </div>
  )
}

function CtpScrollHint({ page, onGo, sp, labels, count, goLabel }: {
  page: number
  onGo: (i: number) => void
  sp: CrmPalette
  labels: string[]
  count: number
  /** Annonce l'interaction ET la destination : le libellé visible n'apparaît qu'au survol. */
  goLabel: (target: string) => string
}) {
  const nextLabel = page + 1 < count ? labels[page + 1] : null
  const prevLabel = page > 0 ? labels[page - 1] : null
  const target = nextLabel || prevLabel
  if (!target) return null
  const dir = nextLabel ? 1 : -1
  return (
    <button className="ctp-scroll-hint" onClick={() => onGo(page + dir)} aria-label={goLabel(target)} style={{
      position: 'absolute', bottom: 18, left: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
      padding: 'var(--crm-space-sm)', border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer',
    }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, lineHeight: 1, color: sp.sub }}>{nextLabel ? '↓' : '↑'}</span>
      <span className="ctp-hint-label" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', whiteSpace: 'nowrap',
        maxWidth: 0, overflow: 'hidden', opacity: 0, transform: 'translateX(-6px)',
        transition: 'max-width .4s cubic-bezier(.76,0,.24,1), opacity .3s ease, transform .4s cubic-bezier(.76,0,.24,1)',
      }}>
        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{target}</span>
      </span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGER CONTACTS
// ═══════════════════════════════════════════════════════════════════════
export interface ContactsPagerProps {
  contacts: CrmContact[]
  sp: CrmPalette
  dark: boolean
  onOpenContact: (id: string) => void
  onNewContact: () => void
  /** Chargement Supabase en cours → squelette de liste (jamais « aucun contact »). */
  isLoading?: boolean
  /**
   * Le chargement a ÉCHOUÉ. Distinct de `fresh` : une base injoignable ne doit
   * jamais être présentée comme un carnet vide.
   */
  loadError?: boolean
  onRetry?: () => void
  /**
   * Liste vide alors que le chargement a RÉUSSI (compte neuf) → page 0 =
   * firstRunSlot, pager mono-page.
   */
  fresh: boolean
  firstRunSlot?: ReactNode
  /** Modale « Nouveau contact » embarquée dans le cadre (overlay). */
  modalOpen: boolean
  modalSlot?: ReactNode
}

export default function ContactsPager({
  contacts, sp, dark, onOpenContact, onNewContact, isLoading = false, loadError = false, onRetry,
  fresh, firstRunSlot, modalOpen, modalSlot,
}: ContactsPagerProps) {
  const { t } = useTranslation('contacts')
  const [page, setPage] = useTabScopedState('pager', 0)
  // Le filtre de liste est une position d'écran (petit objet : type + valeur +
  // libellé), pas un jeu de données — il tient dans la tranche de l'onglet.
  const [filter, setFilter] = useTabScopedState<Filter>('filtre', { type: 'audience', value: 'all' })
  const [recherche, setRecherche] = useTabScopedState('recherche', '')
  const rechercheRef = useRef<HTMLInputElement>(null)
  // Premier lancement ET erreur de chargement réduisent le pager à une seule
  // page : dans les deux cas la Santé du portefeuille n'a rien à agréger.
  const mono = fresh || loadError
  const pageCount = mono ? 1 : 2
  const pageLabels = [t('pager.title'), t('health.title')]
  const goLabel = useCallback((target: string) => t('pager.goToPage', { page: target }), [t])

  // ⚠ Initialisé sur `page`, pas sur 0 : c'est la valeur que lit le
  // `useLayoutEffect` de placement, et un onglet rouvert sur la page 1 doit s'y
  // poser d'emblée plutôt que d'y défiler depuis le haut.
  const pageRef = useRef(page)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalOpenRef = useRef(modalOpen)
  useEffect(() => { modalOpenRef.current = modalOpen }, [modalOpen])
  const monoRef = useRef(mono)
  useEffect(() => { monoRef.current = mono; if (mono) setPage(0) }, [mono, setPage])

  const animateTo = useCallback((target: number, instant?: boolean) => {
    const vp = viewportRef.current, track = trackRef.current
    if (!vp || !track) return
    const h = vp.clientHeight
    const end = -target * h
    if (instant) { posRef.current = end; track.style.transform = `translateY(${end}px)`; return }
    const start = posRef.current
    const dur = 700
    const t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const y = start + (end - start) * ease(p)
      posRef.current = y
      track.style.transform = `translateY(${y}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => {
    const max = (monoRef.current ? 1 : 2) - 1
    setPage((p) => Math.min(max, Math.max(0, p + dir)))
  }, [setPage])
  const goTo = useCallback((i: number) => {
    if (lock.current) return
    lock.current = true
    setPage(i)
    setTimeout(() => { lock.current = false }, 820)
  }, [setPage])

  // Clic sur un segment Santé → filtre + remontée page 0 (sans verrou résiduel).
  const applySegment = useCallback((seg: Filter) => { setFilter(seg); lock.current = false; setPage(0) }, [setPage, setFilter])

  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  const ecranActifRef = useEcranActifRef()
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const canScrollNatively = (node: EventTarget | null, dir: number) => {
      let n = node as HTMLElement | null
      while (n && n !== el && n.nodeType === 1) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
          if (dir < 0 && n.scrollTop > 1) return true
        }
        n = n.parentElement
      }
      return false
    }
    const onWheel = (e: WheelEvent) => {
      if (modalOpenRef.current || monoRef.current) return
      if (canScrollNatively(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; return }
      e.preventDefault()
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      // Seuil du handoff : un geste FRANC (560 accumulés, fenêtre 220 ms) fait
      // tourner la page. Descendre ce seuil rend le pager fébrile au trackpad
      // et le désaligne de MatchingPage, qui partage la même grammaire.
      accTimer.current = setTimeout(() => { acc.current = 0 }, 220)
      if (Math.abs(acc.current) > 560) {
        const dir = acc.current > 0 ? 1 : -1
        acc.current = 0
        lock.current = true
        go(dir)
        setTimeout(() => { lock.current = false }, 820)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e: KeyboardEvent) => {
      // ⛔ Écran vivant mais caché : il ne vole pas les flèches à l'écran montré.
      if (!ecranActifRef.current) return
      if (modalOpenRef.current || monoRef.current) return
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      // `/` : la recherche de la liste, depuis la Santé aussi. `preventScroll` : le
      // pager défile par transform ; un focus qui fait défiler le cadre le décalerait.
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !modaleOuverte()) {
        e.preventDefault()
        setPage(0)
        rechercheRef.current?.focus({ preventScroll: true })
        return
      }
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 820) } }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 820) } }
    }
    window.addEventListener('keydown', onKey)
    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current || modalOpenRef.current || monoRef.current) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 60) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 820) }
    }
    el.addEventListener('touchstart', onTS, { passive: true })
    el.addEventListener('touchmove', onTM, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove', onTM)
    }
  }, [go, ecranActifRef, setPage])

  return (
    <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
      <style>{`
        .ctp-scroll-hint { opacity: .55; transition: opacity .35s ease; }
        .ctp-scroll-hint:hover, .ctp-scroll-hint:focus-visible { opacity: 1; }
        .ctp-scroll-hint:hover .ctp-hint-label, .ctp-scroll-hint:focus-visible .ctp-hint-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
        .ctp-row { transition: background .15s ease; }
        .ctp-search:focus-within { border-color: ${sp.accent} !important; color: ${sp.ink} !important; }
        .ctp-search input::-webkit-search-cancel-button { display: none; }
        .ctp-row:hover { background: ${dark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.03)'}; }
        .ctp-seg, .ctp-seg-row, .ctp-row, .ctp-scroll-hint { -webkit-tap-highlight-color: transparent; }
        /* Pas d'anneau à la souris ; anneau visible au clavier (a11y). */
        .ctp-seg:focus:not(:focus-visible), .ctp-seg-row:focus:not(:focus-visible), .ctp-row:focus:not(:focus-visible), .ctp-scroll-hint:focus:not(:focus-visible) { outline: none; }
        .ctp-seg:focus-visible, .ctp-seg-row:focus-visible, .ctp-row:focus-visible, .ctp-scroll-hint:focus-visible { outline: 2px solid ${sp.accent}; outline-offset: 2px; border-radius: 10px; }
        @keyframes ctpShimmer { 0% { background-position: -40% 0; } 100% { background-position: 160% 0; } }
        .ctp-sk { background-color: var(--sk); background-image: linear-gradient(90deg, transparent, var(--skHi), transparent);
          background-size: 220% 100%; background-repeat: no-repeat; animation: ctpShimmer 1.25s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ctp-sk { animation: none; } }
      `}</style>
      <div ref={viewportRef} style={{
        position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
        border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow,
      }}>
        <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            {loadError
              ? <CtpLoadError sp={sp} dark={dark} onRetry={onRetry} title={t('pager.error.title')} message={t('pager.error.message')} retryLabel={t('pager.error.retry')} />
              : fresh
                ? firstRunSlot
                : <CtpTopList contacts={contacts} sp={sp} dark={dark} isLoading={isLoading} filter={filter} setFilter={setFilter} recherche={recherche} setRecherche={setRecherche} rechercheRef={rechercheRef} onOpenContact={onOpenContact} onNewContact={onNewContact} />}
          </div>
          {!mono && (
            <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <CtpHealthPage contacts={contacts} sp={sp} dark={dark} onSegment={applySegment} />
            </div>
          )}
        </div>
        <CtpPageDots page={page} onGo={goTo} sp={sp} dark={dark} count={pageCount} labels={pageLabels} goLabel={goLabel} />
        {modalOpen && modalSlot && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 45, borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden' }}>
            {modalSlot}
          </div>
        )}
      </div>
      {!mono && <CtpScrollHint page={page} onGo={goTo} sp={sp} labels={pageLabels} count={pageCount} goLabel={goLabel} />}
    </main>
  )
}
