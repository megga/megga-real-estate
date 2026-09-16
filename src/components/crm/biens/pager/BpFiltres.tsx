/**
 * « Filtres » de Mes biens : le bouton, sa palette, et les critères posés en pastilles.
 *
 * ⚖ Demandé par Julien le 16.09.2026 — classer un portefeuille comme l'agent travaille :
 * par secteur, par agent, par agence (la sienne ou une agence partenaire), par type… et
 * REGROUPER la galerie sur l'un de ces axes. La logique est pure et testée à part
 * (`src/lib/biensFiltres.ts`) ; ce fichier n'est que l'écran.
 *
 * ⚠ LA PALETTE S'ADAPTE AU PORTEFEUILLE. Un axe n'est proposé que s'il DISTINGUE quelque
 * chose — au moins deux valeurs présentes (ou une sélection déjà posée) : un agent seul
 * ne voit pas « Agent », une agence sans partenaire ne voit pas « Agence ». C'est ce qui
 * couvre « tous les scénarios » sans afficher onze sections vides à tout le monde.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '@/components/crm/mockData'
import type { CrmPalette } from '@/components/crm/tokens'
import type { GalSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { galFmtCHF } from '@/components/crm/biens/gallery/galHelpers'
import { useEcranActif } from '@/hooks/useEcranActif'
import {
  FILTRES_VIDES, JOURS_MANDAT_BIENTOT, nombreFiltresActifs, valeursPresentes,
  type DimensionBien, type FiltresBiens, type GroupeBiens,
} from '@/lib/biensFiltres'

type Libelle = (dim: DimensionBien, cle: string) => string

/** Les axes à choix multiples, dans l'ordre de la palette. */
const AXES: { dim: Exclude<DimensionBien, 'statut'>; cle: keyof FiltresBiens }[] = [
  { dim: 'canton', cle: 'cantons' },
  { dim: 'ville', cle: 'villes' },
  { dim: 'agent', cle: 'agents' },
  { dim: 'agence', cle: 'agences' },
  { dim: 'type', cle: 'types' },
  { dim: 'transaction', cle: 'transactions' },
  { dim: 'mandat', cle: 'mandats' },
]
/** Les axes de regroupement proposés, s'ils distinguent quelque chose. */
const GROUPES: DimensionBien[] = ['canton', 'ville', 'agent', 'agence', 'type', 'transaction', 'statut', 'mandat']
const PIECES = [1, 2, 3, 4, 5]

function Puce({ on, onClick, children, sp }: { on: boolean; onClick: () => void; children: ReactNode; sp: CrmPalette }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={on ? undefined : 'bpf-puce'} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 30, padding: '0 var(--crm-space-lg)',
      borderRadius: 'var(--crm-radius-pill)', border: on ? 0 : `1px solid ${sp.cardBorder}`, cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
      background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.ink,
    }}>{children}</button>
  )
}

function Section({ titre, children, sp }: { titre: string; children: ReactNode; sp: CrmPalette }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>{titre}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>{children}</div>
    </section>
  )
}

const basculer = (liste: string[], v: string) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

/** Le bouton « Filtres » et sa palette. */
export function BpFiltres({ biens, filtres, setFiltres, groupe, setGroupe, libelle, nbResultats, sp, surf }: {
  /** TOUS les biens — la palette propose ce qui existe, pas ce qui reste après filtre. */
  biens: CrmBien[]
  filtres: FiltresBiens
  setFiltres: (f: FiltresBiens) => void
  groupe: GroupeBiens
  setGroupe: (g: GroupeBiens) => void
  libelle: Libelle
  nbResultats: number
  sp: CrmPalette
  surf: GalSurfaces
}) {
  const { t, i18n } = useTranslation('listings')
  const locale = `${(i18n.language || 'fr').slice(0, 2)}-CH`
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const ecranActif = useEcranActif()
  const actifs = nombreFiltresActifs(filtres)

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [ouvert])
  // ⛔ Écran caché muet : Échap ne ferme pas la palette d'un onglet qu'on ne regarde pas.
  useEffect(() => {
    if (!ouvert || !ecranActif) return
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('keydown', echap)
    return () => document.removeEventListener('keydown', echap)
  }, [ouvert, ecranActif])

  const presentes = (dim: DimensionBien) =>
    [...valeursPresentes(biens, dim)].sort((a, b) => libelle(dim, a[0]).localeCompare(libelle(dim, b[0]), locale))
  const champPrix = (cle: 'prixMin' | 'prixMax', placeholder: string) => (
    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 34, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: `1px solid ${sp.cardBorder}`, color: sp.sub, minWidth: 0 }}>
      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>CHF</span>
      <input type="number" inputMode="numeric" min={0} step={10000} placeholder={placeholder} aria-label={placeholder}
        value={filtres[cle] ?? ''} onChange={(e) => setFiltres({ ...filtres, [cle]: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
        className="bpf-input"
        style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }} />
    </label>
  )

  const panneau: CSSProperties = {
    position: 'absolute', top: 'calc(100% + var(--crm-space-sm))', right: 0, zIndex: 100, width: 380, maxHeight: 'min(70vh, 640px)',
    display: 'flex', flexDirection: 'column', background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
    borderRadius: 'var(--crm-radius-xl)', boxShadow: sp.solidShadow, overflow: 'hidden',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`
        .bpf-puce:hover { background: ${sp.focusSurface} !important; }
        .bpf-input::-webkit-outer-spin-button, .bpf-input::-webkit-inner-spin-button { -webkit-appearance: none; margin-block: 0; margin-inline: 0; }
        .bpf-input::placeholder { color: ${sp.sub}; }
      `}</style>
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} aria-haspopup="dialog" style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 36, boxSizing: 'border-box',
        padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: surf.hairline, cursor: 'pointer',
        background: actifs || groupe !== 'aucun' ? sp.focusSurface : 'transparent', color: sp.ink, fontFamily: 'inherit',
        fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        <MEIcon name="filter" size={14} color={sp.sub} />
        {t('biens.filtres.bouton')}
        {actifs > 0 && (
          <span style={{ minWidth: 20, height: 20, padding: '0 var(--crm-space-xs)', boxSizing: 'border-box', borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, fontSize: 'var(--crm-text-xs)', fontWeight: 600, display: 'grid', placeItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{actifs}</span>
        )}
      </button>

      {ouvert && (
        <div role="dialog" aria-label={t('biens.filtres.bouton')} style={panneau}>
          <div style={{ overflowY: 'auto', padding: 'var(--crm-space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)' }}>
            <Section titre={t('biens.filtres.regrouper')} sp={sp}>
              <Puce sp={sp} on={groupe === 'aucun'} onClick={() => setGroupe('aucun')}>{t('biens.filtres.aucun')}</Puce>
              {GROUPES.filter((d) => valeursPresentes(biens, d).size >= 2 || groupe === d).map((d) => (
                <Puce key={d} sp={sp} on={groupe === d} onClick={() => setGroupe(d)}>{t(`biens.filtres.axes.${d}`)}</Puce>
              ))}
            </Section>

            {AXES.map(({ dim, cle }) => {
              const valeurs = presentes(dim)
              const choisis = filtres[cle] as string[]
              if (valeurs.length < 2 && choisis.length === 0) return null
              return (
                <Section key={dim} titre={t(`biens.filtres.axes.${dim}`)} sp={sp}>
                  {valeurs.map(([v, n]) => (
                    <Puce key={v || '∅'} sp={sp} on={choisis.includes(v)} onClick={() => setFiltres({ ...filtres, [cle]: basculer(choisis, v) })}>
                      {libelle(dim, v)}
                      <span style={{ fontWeight: 500, opacity: 0.65, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                    </Puce>
                  ))}
                  {dim === 'mandat' && (
                    <Puce sp={sp} on={filtres.mandatBientot} onClick={() => setFiltres({ ...filtres, mandatBientot: !filtres.mandatBientot })}>
                      <MEIcon name="clock" size={12} />{t('biens.filtres.mandatBientot', { count: JOURS_MANDAT_BIENTOT })}
                    </Puce>
                  )}
                </Section>
              )
            })}

            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>{t('biens.filtres.prix')}</div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
                {champPrix('prixMin', t('biens.filtres.min'))}
                {champPrix('prixMax', t('biens.filtres.max'))}
              </div>
            </section>

            <Section titre={t('biens.filtres.pieces')} sp={sp}>
              {PIECES.map((n) => (
                <Puce key={n} sp={sp} on={filtres.piecesMin === n} onClick={() => setFiltres({ ...filtres, piecesMin: filtres.piecesMin === n ? null : n })}>
                  {t('biens.filtres.piecesMin', { n })}
                </Puce>
              ))}
            </Section>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderTop: `1px solid ${sp.solidBorder}` }}>
            <button type="button" disabled={!actifs && groupe === 'aucun'} onClick={() => { setFiltres(FILTRES_VIDES); setGroupe('aucun') }} style={{
              border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
              color: !actifs && groupe === 'aucun' ? sp.sub : sp.ink, cursor: !actifs && groupe === 'aucun' ? 'default' : 'pointer',
            }}>{t('biens.filtres.reinitialiser')}</button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setOuvert(false)} style={{
              height: 34, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
              background: sp.accent, color: sp.accentInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
            }}>{t('biens.filtres.voir', { count: nbResultats })}</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Les critères posés, chacun retirable d'un clic — ce qu'on regarde, sans rouvrir la palette. */
export function BpFiltresActifs({ filtres, setFiltres, groupe, setGroupe, libelle, sp }: {
  filtres: FiltresBiens
  setFiltres: (f: FiltresBiens) => void
  groupe: GroupeBiens
  setGroupe: (g: GroupeBiens) => void
  libelle: Libelle
  sp: CrmPalette
}) {
  const { t } = useTranslation('listings')
  const pastilles: { cle: string; texte: string; retirer: () => void }[] = []
  if (groupe !== 'aucun') pastilles.push({ cle: 'groupe', texte: t('biens.filtres.groupePar', { axe: t(`biens.filtres.axes.${groupe}`) }), retirer: () => setGroupe('aucun') })
  for (const { dim, cle } of AXES) {
    for (const v of filtres[cle] as string[]) {
      pastilles.push({ cle: `${dim}:${v}`, texte: libelle(dim, v), retirer: () => setFiltres({ ...filtres, [cle]: (filtres[cle] as string[]).filter((x) => x !== v) }) })
    }
  }
  if (filtres.mandatBientot) pastilles.push({ cle: 'bientot', texte: t('biens.filtres.mandatBientot', { count: JOURS_MANDAT_BIENTOT }), retirer: () => setFiltres({ ...filtres, mandatBientot: false }) })
  if (filtres.prixMin != null) pastilles.push({ cle: 'pmin', texte: t('biens.filtres.desPrix', { prix: galFmtCHF(filtres.prixMin) }), retirer: () => setFiltres({ ...filtres, prixMin: null }) })
  if (filtres.prixMax != null) pastilles.push({ cle: 'pmax', texte: t('biens.filtres.jusquaPrix', { prix: galFmtCHF(filtres.prixMax) }), retirer: () => setFiltres({ ...filtres, prixMax: null }) })
  if (filtres.piecesMin != null) pastilles.push({ cle: 'pieces', texte: t('biens.filtres.piecesChip', { n: filtres.piecesMin }), retirer: () => setFiltres({ ...filtres, piecesMin: null }) })
  if (pastilles.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-xs)', padding: '0 var(--crm-space-6xl) var(--crm-space-2xl)', flexShrink: 0 }}>
      {pastilles.map((p) => (
        <span key={p.cle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: 28, padding: '0 var(--crm-space-2xs) 0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: sp.focusSurface, color: sp.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {p.texte}
          <button type="button" onClick={p.retirer} aria-label={t('biens.filtres.retirer', { critere: p.texte })} style={{ width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, padding: 0, background: 'transparent', color: sp.sub, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <MEIcon name="close" size={11} />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => { setFiltres(FILTRES_VIDES); setGroupe('aucun') }} style={{ border: 0, background: 'transparent', padding: '0 var(--crm-space-sm)', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub, cursor: 'pointer' }}>
        {t('biens.filtres.toutEffacer')}
      </button>
    </div>
  )
}
