// MEGGA CRM Sugar v2 — Mes biens · Page 0 « Galerie »
// Port fidèle du handoff Claude Design (crm-screen-biens-proto.jsx, BpTopGallery).
//
// Une SEULE barre (16.09.2026, décision Julien) : statuts avec compteurs, puis
// recherche · tri · vue · « Créer un bien » au bout de la même ligne — la
// grammaire de Contacts. Le titre visible est retiré : l'onglet et la barre
// latérale disent déjà « Mes biens », et il laissait le bouton seul dans le vide.
// Le rôle analytique (ex-bandeau KPI à sparklines illustratives) passe à la page
// « À suivre ». En-tête + toolbar épinglés ; contenu scrollable (le pager laisse
// le scroll interne l'emporter avant de changer de page).

import EtatVide from '@/components/crm/EtatVide'
import { useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '@/components/crm/mockData'
import type { CrmPalette } from '@/components/crm/tokens'
import type { GalSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { GalSortDropdown, type SortOption } from '@/components/crm/biens/gallery/GalleryAtoms'
import { GalCard } from '@/components/crm/biens/gallery/GalCard'
import { GalRow } from '@/components/crm/biens/gallery/GalRow'
import { BpFiltres, BpFiltresActifs } from './BpFiltres'
import { useTeamMembers } from '@/hooks/useTeam'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import {
  AGENCES_PARTENAIRES, FILTRES_VIDES, filtrerBiens, grouperBiens,
  type DimensionBien, type FiltresBiens, type GroupeBiens,
} from '@/lib/biensFiltres'

interface BpTopGalleryProps {
  biens: CrmBien[]
  sp: CrmPalette
  surf: GalSurfaces
  dark: boolean
  isLoading: boolean
  isError: boolean
  refetch: () => void
  onOpenBien: (id: string) => void
  onCreate: () => void
  onResumeDraft: (b: CrmBien) => void
  /** Focalisée par `/` depuis le pager (qui ramène d'abord à cette page). */
  searchRef: RefObject<HTMLInputElement | null>
}

/**
 * Filtres de statut, dans l'ordre de la barre.
 *
 * ⚠ « Off-market » regroupe `paused` ET `sold` (16.09.2026) : sans lui, ces biens
 * comptaient dans « Tous » sans qu'aucun filtre les isole — la somme des pastilles
 * ne tombait pas juste. Pas « Archivés » : un bien en pause revient sur le marché.
 * La pilule de la carte continue de dire lequel des deux.
 * ⚠ Le libellé n'est PAS traduit : « Off-market » est le terme du métier, écrit
 * ainsi dans les quatre langues, comme sur la fiche (`fiche.offMarket`).
 */
const STATUTS = ['all', 'active', 'reserved', 'draft', 'offMarket'] as const
type Statut = typeof STATUTS[number]
const STATUT_LABEL: Record<Statut, string> = { all: 'tab.all', active: 'tab.active', reserved: 'tab.reserved', draft: 'tab.drafts', offMarket: 'tab.offMarket' }
const dansStatut = (b: CrmBien, st: Statut) =>
  st === 'all' || (st === 'offMarket' ? b.status === 'paused' || b.status === 'sold' : b.status === st)

export function BpTopGallery({
  biens, sp, surf, dark, isLoading, isError, refetch, onOpenBien, onCreate, onResumeDraft, searchRef,
}: BpTopGalleryProps) {
  const { t, i18n } = useTranslation('listings')
  const locale = `${(i18n.language || 'fr').slice(0, 2)}-CH`
  // Filtres et regroupement RANGÉS DANS L'ONGLET : ils survivent à un aller-retour.
  const [filtres, setFiltres] = useTabScopedState<FiltresBiens>('biens-filtres', FILTRES_VIDES)
  const [groupe, setGroupe] = useTabScopedState<GroupeBiens>('biens-groupe', 'aucun')
  // Horloge figée au montage : « expire dans 60 jours » ne bascule pas pendant qu'on lit.
  const [maintenant] = useState(() => Date.now())
  const { data: equipe } = useTeamMembers()
  const nomsAgents = useMemo(() => new Map((equipe ?? []).map((m) => [m.id, m.full_name])), [equipe])
  /** Le libellé d'une valeur sur un axe — la palette, les pastilles et les en-têtes de groupe. */
  const libelle = useCallback((dim: DimensionBien, cle: string): string => {
    if (cle === '') return dim === 'agence' ? t('biens.filtres.notreAgence') : t('biens.filtres.nonRenseigne')
    switch (dim) {
      case 'agent': return nomsAgents.get(cle) ?? t('biens.filtres.agentInconnu')
      case 'agence': return AGENCES_PARTENAIRES[cle] ?? cle
      case 'type': return t(`biens.filtres.types.${cle}`, { defaultValue: cle })
      case 'transaction': return cle === 'location' ? t('detail.transactionRent') : t('detail.transactionSale')
      case 'statut': return t(`status.${cle}`, { defaultValue: cle })
      case 'mandat': return t(`biens.filtres.mandats.${cle}`, { defaultValue: cle })
      default: return cle
    }
  }, [nomsAgents, t])
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState<Statut>('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState<string>(() => {
    if (typeof window === 'undefined') return 'galerie'
    return window.localStorage.getItem('megga_biens_view') || 'galerie'
  })
  const setViewP = (v: string) => {
    setView(v)
    try { window.localStorage.setItem('megga_biens_view', v) } catch { /* ignore */ }
  }

  // Les compteurs suivent la recherche ET les filtres : « Actifs 0 · Brouillons 1 » dit
  // où est le résultat avant qu'on change de statut — même règle que Contacts.
  const trouves = useMemo<CrmBien[]>(() => {
    const q = search.trim().toLowerCase()
    const retenus = filtrerBiens(biens, filtres, maintenant)
    if (!q) return retenus
    return retenus.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.addr.toLowerCase().includes(q) ||
        b.ref.toLowerCase().includes(q),
    )
  }, [biens, search, filtres, maintenant])

  const filtered = useMemo<CrmBien[]>(() => {
    const l = trouves.filter((b) => dansStatut(b, fStatus))
    const pv = (b: CrmBien) => b.price || (b.rent ? b.rent * 300 : 0)
    if (sort === 'price-desc') l.sort((a, b) => pv(b) - pv(a))
    else if (sort === 'price-asc') l.sort((a, b) => pv(a) - pv(b))
    else if (sort === 'views') l.sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
    else if (sort === 'surface') l.sort((a, b) => b.area - a.area)
    return l
  }, [trouves, fStatus, sort])

  const sortOpts: SortOption[] = [
    { value: 'recent', label: t('biens.sort.recent') },
    { value: 'price-desc', label: t('biens.sort.priceDesc') },
    { value: 'price-asc', label: t('biens.sort.priceAsc') },
    { value: 'surface', label: t('biens.sort.surface') },
    { value: 'views', label: t('biens.sort.views') },
  ]
  const vues = [
    { value: 'galerie', label: t('biens.view.gallery'), icon: 'gallery' as const },
    { value: 'liste', label: t('biens.view.list'), icon: 'menu' as const },
  ]

  /** Une liste de biens dans la vue choisie — la page entière, ou un groupe. */
  const rendre = (liste: CrmBien[]): ReactNode => view === 'galerie' ? (
    <div className="bpg-grid">
      {liste.map((b) => (
        <GalCard
          key={b.id}
          bien={b}
          sp={sp}
          surf={surf}
          dark={dark}
          onOpen={() => onOpenBien(b.id)}
          onFinish={b.status === 'draft' ? () => onResumeDraft(b) : undefined}
        />
      ))}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
      {liste.map((b) => (
        <GalRow key={b.id} bien={b} sp={sp} surf={surf} dark={dark} onOpen={() => onOpenBien(b.id)} />
      ))}
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: sp.pageBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .bpg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--crm-space-5xl); }
        @media (max-width: 1180px) { .bpg-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 720px) { .bpg-grid { grid-template-columns: 1fr; } }
        .bpg-search::placeholder { color: ${sp.sub}; }
      `}</style>

      {/* Titre pour les lecteurs d'écran seulement : l'onglet et la barre latérale
          disent déjà « Mes biens ». */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Barre unique (épinglée) : statuts à gauche, outils et création à droite.
          ⚠ DEUX groupes, pas une rangée plate : quand la largeur manque, les outils
          passent à la ligne ENSEMBLE et restent calés à droite (`marginLeft: auto`).
          À plat, « Créer un bien » retombait seul à gauche de la seconde ligne. */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', columnGap: 'var(--crm-space-3xl)', rowGap: 'var(--crm-space-md)', flexWrap: 'wrap', padding: 'var(--crm-space-5xl) var(--crm-space-6xl) var(--crm-space-3xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
        {STATUTS.map((st) => {
          const on = fStatus === st
          const n = trouves.filter((b) => dansStatut(b, st)).length
          return (
            <button key={st} type="button" onClick={() => setFStatus(st)} aria-pressed={on} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-pill)', border: on ? 0 : surf.hairline,
              background: on ? sp.accent : surf.card, color: on ? sp.accentInk : sp.soft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
              boxShadow: on ? 'none' : sp.shadowSm,
            }}>
              {t(STATUT_LABEL[st])}
              <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: on ? sp.accentInk : sp.sub, opacity: on ? 0.72 : 1 }}>{n}</span>
            </button>
          )
        })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', flex: '0 1 240px', minWidth: 150, height: 36, boxSizing: 'border-box',
          padding: '0 var(--crm-space-md) 0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)',
          border: surf.hairline, color: sp.sub, cursor: 'text',
        }}>
          <MEIcon name="search" size={16} strokeWidth={2} />
          <input
            ref={searchRef}
            className="bpg-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSearch(''); e.currentTarget.blur() } }}
            placeholder={t('biens.search')}
            aria-label={t('biens.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: 0, height: '100%', padding: 0, border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500 }}
          />
          {search ? (
            <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus() }} aria-label={t('common:search.clearSearch')} style={{
              display: 'grid', placeItems: 'center', width: 22, height: 22, padding: 0, border: 0, borderRadius: 'var(--crm-radius-pill)',
              background: sp.focusSurface, color: sp.soft, cursor: 'pointer',
            }}>
              <MEIcon name="close" size={12} strokeWidth={2.4} />
            </button>
          ) : (
            <kbd aria-hidden style={{
              display: 'grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 var(--crm-space-xs)', boxSizing: 'border-box',
              borderRadius: 'var(--crm-radius-xs)', border: surf.hairline,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub,
            }}>/</kbd>
          )}
        </label>

        <BpFiltres biens={biens} filtres={filtres} setFiltres={setFiltres} groupe={groupe} setGroupe={setGroupe}
          libelle={libelle} nbResultats={filtered.length} sp={sp} surf={surf} />
        <GalSortDropdown value={sort} options={sortOpts} onChange={setSort} sp={sp} surf={surf} />

        {/* Vue : deux icônes, le libellé en infobulle — il répétait ce que l'icône dit. */}
        <div role="group" aria-label={t('biens.view.label')} style={{ display: 'inline-flex', height: 36, boxSizing: 'border-box', padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', border: surf.hairline }}>
          {vues.map((v) => {
            const on = view === v.value
            return (
              <button key={v.value} type="button" onClick={() => setViewP(v.value)} aria-pressed={on} aria-label={v.label} title={v.label} style={{
                display: 'grid', placeItems: 'center', width: 36, height: '100%', padding: 0, border: 0,
                borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer',
                background: on ? sp.focusSurface : 'transparent', color: on ? sp.ink : sp.sub,
                transition: 'background .15s, color .15s',
              }}>
                <MEIcon name={v.icon} size={15} />
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onCreate} style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, padding: '0 var(--crm-space-2xl)',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, border: 0,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
        }}>
          {t('biens.create')}
        </button>
        </div>
      </div>

      <BpFiltresActifs filtres={filtres} setFiltres={setFiltres} groupe={groupe} setGroupe={setGroupe} libelle={libelle} sp={sp} />

      {/* Contenu (scrollable) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 var(--crm-space-6xl) var(--crm-space-6xl)' }}>
        {filtered.length === 0 ? (
          <EtatVide
            dark={dark}
            registre={isError ? 'erreur' : 'neutre'}
            glyphe={<MEIcon name={isError ? 'alert' : 'home'} size={24} />}
            titre={isError ? t('biens.error.title') : isLoading ? t('biens.loading') : t('biens.empty.noMatch')}
            corps={isError ? t('biens.error.message') : undefined}
            action={isError ? { libelle: t('biens.error.retry'), onClick: () => { void refetch() } } : undefined}
          />
        ) : groupe === 'aucun' ? (
          rendre(filtered)
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-6xl)' }}>
            {grouperBiens(filtered, groupe, (cle) => libelle(groupe, cle), locale).map((g) => (
              <section key={g.cle || '∅'}>
                {/* En-tête collant : dans un long groupe, on sait toujours où l'on est. */}
                <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-md) 0', marginBottom: 'var(--crm-space-md)', background: sp.pageBg }}>
                  <h2 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink }}>{g.libelle}</h2>
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{g.biens.length}</span>
                </div>
                {rendre(g.biens)}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
