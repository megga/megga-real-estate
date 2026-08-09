/**
 * MEGGA CRM — Comparateur de direction artistique (route /design-system/da-compare).
 *
 * Outil de DÉCISION, temporaire : il rend le MÊME composant dense du CRM
 * (`SugarStageColumn` du Pipeline v2) sous trois directions, côte à côte, pour
 * trancher le débat « étendre MEGGA X au CRM » avec Thomas sur pièces plutôt que
 * sur intentions. À supprimer une fois la direction retenue — ce fichier et sa
 * route sont les deux seuls points à retirer.
 *
 * Pourquoi ce montage est possible sans toucher au CRM : dans tout l'arbre Sugar
 * la palette voyage en PROP (`sp: SugarPalette`), jamais par un contexte ni un
 * global. On peut donc monter deux fois les mêmes composants avec deux palettes
 * différentes dans un seul arbre React, sans drapeau ni rechargement.
 *
 * Zéro invention de couleur : les valeurs de la colonne « MEGGA X littéral »
 * sortent telles quelles de `megga-x.generated.css` (`--neutral-colors--*`,
 * `--primary-colors--100`), la feuille transcrite verbatim depuis la vitrine.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import MeggaX from '@/components/megga-x/MeggaX'
import { SugarDealCard } from '@/components/crm-sugar/pipeline/SugarDealCard'
import {
  MXC_COLOR, MXC_FONT, MXC_RADIUS, MXC_SPACE, MXC_TYPE, mxCrmPalette,
} from '@/components/megga-x-crm/tokens'
import {
  crmSugarPalette,
  sugarThemeTokens,
  type StageId,
  type SugarPalette,
} from '@/components/crm-sugar/tokens'
import type { CrmDeal } from '@/components/crm-sugar/mockData'
import { SugarStageColumn } from '@/components/crm-sugar/pipeline/SugarStageColumn'
import { SugarSegmentedView } from '@/components/crm-sugar/pipeline/PipelineFilters'

/** Police de la vitrine. Cascade réellement : 206 des 242 `fontFamily` de
 *  `crm-sugar/` valent `'inherit'`. */
const MX_FONT = "'Inter Tight', system-ui, sans-serif"

type Direction = 'sugar' | 'absorbed' | 'literal'

/**
 * Décalage relatif au jour courant — la carte deal calcule « Retard /
 * Aujourd'hui / Demain » contre la date réelle, et ces trois états portent
 * chacun leur couleur : les figer perdrait ce qu'on vient comparer.
 *
 * L'heure est poussée en fin de journée, sinon l'échéance « aujourd'hui » tombe
 * à l'instant du rendu — donc déjà passée — et la carte s'affiche « En retard ».
 */
function inDays(days: number, hour = 23): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}

/**
 * Trois deals sur des contacts qui existent dans `mockData` (`crmContactById`
 * doit résoudre, sinon la carte rend un gabarit dégradé).
 *
 * ⚠ `ns` n'est pas cosmétique : `SugarDealCard` pose `layoutId={`sgdeal-${id}`}`,
 * et un layoutId est GLOBAL à la page. Trois panneaux portant les mêmes ids se
 * disputent le même nœud framer-motion — seul le dernier monté garde ses cartes,
 * les deux autres colonnes se vident. Un jeu d'ids par panneau les sépare.
 */
function demoDeals(ns: string): CrmDeal[] {
  return [
    {
      id: `${ns}-1`, contactId: 'c-001', bienId: null, stage: 'searching',
      value: 1_180_000, probability: 60, ownerAgentId: 'agt-1',
      nextAction: { kind: 'visit', dueAt: inDays(-2), note: 'Confirmer la visite de samedi' },
      risk: 'at-risk', updatedAt: inDays(-2),
    },
    {
      id: `${ns}-2`, contactId: 'c-003', bienId: null, stage: 'searching',
      value: 890_000, probability: 45, ownerAgentId: 'agt-1',
      nextAction: { kind: 'call', dueAt: inDays(0), note: 'Rappeler après la contre-visite' },
      risk: 'healthy', updatedAt: inDays(0),
    },
    {
      id: `${ns}-3`, contactId: 'c-002', bienId: null, stage: 'searching',
      value: 1_750_000, probability: 30, ownerAgentId: 'agt-1',
      nextAction: null,
      risk: 'stalled', updatedAt: inDays(-9),
    },
  ]
}

/**
 * Palette d'une direction, dérivée de la palette Sugar du moment.
 *
 * `absorbed` ne touche QUE l'accent : c'est tout ce que la direction vitrine
 * change en tokens, et ça marche en clair comme en sombre.
 * `literal` repose les surfaces de la vitrine, dans les deux modes : la source
 * porte bien un vocabulaire clair (74 règles `light-mode`), dont
 * `.section.light-mode-section` (#f9f9f9) et `.card-light-mode` (blanc).
 */
function paletteFor(direction: Direction, base: SugarPalette, dark: boolean): SugarPalette {
  if (direction === 'sugar') return base

  const withAccent: SugarPalette = {
    ...base,
    accent: MXC_COLOR.accent,
    accentInk: MXC_COLOR.n1000,
    focusBg: MXC_COLOR.accent,
    focusInk: MXC_COLOR.n1000,
  }
  if (direction === 'absorbed') return withAccent

  // `literal` = EXACTEMENT ce que l'application rendra une fois la direction
  // basculée. Cette colonne construisait sa palette à la main jusqu'au 9 août ;
  // les deux ont divergé sans que rien le signale (elle posait `sub: #686868`
  // en sombre là où la vraie palette est passée à `#a3a3a3` pour l'AA). Un
  // comparateur qui montre autre chose que la production ne compare rien.
  return mxCrmPalette(dark)
}

/**
 * Carte deal en grammaire MEGGA X — maquette, PAS un composant de la source.
 *
 * La vitrine n'a pas de carte deal : `kanban` compte 0 occurrence dans
 * `megga-x.generated.css`. Ce qui est assemblé ici, ce sont ses classes réelles
 * (`.card`, `.pd---content-inside-card`, `.badge-light`, `.paragraph-small`,
 * `.secondary-button.small`) — donc AUCUNE valeur visuelle inventée : rayons,
 * paddings, tailles de texte et couleurs viennent tous de la feuille transcrite.
 * Seule la disposition (flex, ordre des lignes) est composée ici, faute de
 * modèle dans la source. C'est exactement la part qu'il faudrait inventer pour
 * de vrai, et c'est ce que la comparaison rend visible.
 */
function MxDealCardMockup({ light }: { light: boolean }) {
  // Chaque encre vient d'un utilitaire de la source (`.text-color-neutral-*`),
  // jamais d'une opacité bricolée : en clair le titre passe en neutral-100
  // (#030303, l'encre que `.card.empty-state.light-mode` emploie déjà) et le
  // sous-titre en neutral-500.
  const titleInk = light ? 'text-color-neutral-100' : ''
  const subInk = light ? 'text-color-neutral-500' : 'text-color-neutral-600'

  return (
    <div className={light ? 'card-light-mode pd---content-inside-card' : 'card pd---content-inside-card'}>
      <div style={{ marginBottom: 16 }}>
        <div className="badge-light small">En retard</div>
      </div>
      <div className={titleInk} style={{ fontWeight: 500, marginBottom: 6 }}>
        Confirmer la visite de samedi
      </div>
      <div className={`paragraph-small ${subInk}`}>Marie Bertrand</div>
      <div
        style={{
          marginTop: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}
      >
        <span className={titleInk} style={{ fontWeight: 500 }}>CHF 1'180'000</span>
        <button
          type="button"
          className={light ? 'secondary-button light-mode small' : 'secondary-button small'}
        >
          Ouvrir
        </button>
      </div>
    </div>
  )
}

/**
 * Carte deal en grammaire MEGGA X « resserrée » — l'ADN vitrine à la densité du CRM.
 *
 * Principe : on ne change pas d'échelle, on descend d'un cran. Chaque valeur est
 * un barreau de l'échelle de la vitrine, simplement plus bas que celui de ses
 * pages marketing — `br-small` (16 px) au lieu de `br-large` (24), `2x-extra-small`
 * (16 px) de padding au lieu de `regular` (32), et 12 px de texte, la taille que
 * `h6` et `.badge-light.small` emploient déjà. Aucune valeur inventée.
 *
 * Ce qui reste de l'ADN : Inter Tight, l'accent #424bfb via `.badge-light`, la
 * carte claire à ombre SANS bordure, la pilule du bouton.
 */
function MxDealCardTight({ dark }: { dark: boolean }) {
  const p = mxCrmPalette(dark)
  return (
    <div
      style={{
        borderRadius: MXC_RADIUS.md,
        padding: MXC_SPACE.lg,
        background: p.cardBg,
        border: `1px solid ${p.cardBorder}`,
        boxShadow: p.shadow,
        display: 'grid',
        gap: MXC_SPACE.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: MXC_SPACE.sm }}>
        <span style={{ fontSize: MXC_TYPE.sm, fontWeight: 500, color: p.ink }}>
          Confirmer la visite de samedi
        </span>
        <span
          style={{
            fontSize: MXC_TYPE.xs, lineHeight: 1, padding: MXC_SPACE.sm,
            borderRadius: MXC_RADIUS.pill, background: p.accent, color: p.accentInk,
            whiteSpace: 'nowrap',
          }}
        >
          En retard
        </span>
      </div>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: MXC_SPACE.sm, fontSize: MXC_TYPE.xs,
        }}
      >
        <span style={{ color: p.sub }}>Marie Bertrand</span>
        <span style={{ fontWeight: 500, color: p.ink }}>CHF 1'180'000</span>
      </div>
    </div>
  )
}

/**
 * Canvas MEGGA X pour une carte isolée.
 *
 * `<MeggaX>` porte le scope `.megga-x` — hors de lui aucune classe ni variable
 * de la vitrine ne résout. Il peint aussi son fond en dur (#030303 + encre
 * blanche) : en clair on le repeint avec les DEUX valeurs de
 * `.section.light-mode-section`, ses variables et non la classe, dont le gabarit
 * marketing pose 140 px de padding.
 */
function MxCanvas({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  return (
    <MeggaX>
      <div
        style={{
          padding: 12,
          ...(dark ? null : {
            background: 'var(--neutral-colors--900)',
            color: 'var(--neutral-colors--500)',
          }),
        }}
      >
        {children}
      </div>
    </MeggaX>
  )
}

const PANELS: ReadonlyArray<{
  id: Direction
  title: string
  note: string
}> = [
  {
    id: 'sugar',
    title: 'Sugar — actuel',
    note: 'Accent noir, DM Sans, échelle Graphite. Le CRM d’aujourd’hui.',
  },
  {
    id: 'absorbed',
    title: 'DA MEGGA X absorbée dans Sugar',
    note: 'Accent #424bfb et Inter Tight. 2 tokens, une font-family.',
  },
  {
    id: 'literal',
    title: 'MEGGA X littéral',
    note: 'Palette et grammaire de la vitrine. Ce que l’app rendra, basculée.',
  },
]

/** Comparateur de DA — trois rendus du même composant dense du Pipeline. */
export default function DaComparePage() {
  const [dark, setDark] = useState(true)
  const [font, setFont] = useState(true)
  const dealsByPanel = useMemo(
    () => PANELS.reduce<Record<Direction, CrmDeal[]>>(
      (acc, p) => { acc[p.id] = demoDeals(p.id); return acc },
      {} as Record<Direction, CrmDeal[]>,
    ),
    [],
  )

  // `'sugar'` explicite : la colonne de référence doit rester Sugar même quand
  // la préférence de direction est basculée sur MEGGA X, sinon les trois
  // colonnes deviennent identiques et le comparateur ne compare plus rien.
  const base = useMemo(() => {
    const t = sugarThemeTokens(dark)
    return crmSugarPalette(t, dark, undefined, 'sugar')
  }, [dark])

  const stage: StageId = 'searching'
  const noop = () => {}

  // Hauteurs réelles des deux cartes : c'est la densité, mesurée plutôt
  // qu'affirmée.
  //
  // Un ResizeObserver plutôt qu'une mesure ponctuelle : Inter Tight arrive par
  // @import, donc une mesure au montage capterait les métriques de la police de
  // repli. L'observateur re-mesure à l'arrivée de la police comme au changement
  // de thème — et évite le setState posé directement dans l'effet.
  const sugarCardRef = useRef<HTMLDivElement>(null)
  const mxCardRef = useRef<HTMLDivElement>(null)
  const tightCardRef = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState<{ sugar: number; mx: number; tight: number } | null>(null)
  useEffect(() => {
    const nodes = [sugarCardRef.current, mxCardRef.current, tightCardRef.current]
    if (nodes.some((n) => !n)) return
    const [s, m, t] = nodes as HTMLDivElement[]
    const ro = new ResizeObserver(() => setHeights({
      sugar: Math.round(s.getBoundingClientRect().height),
      mx: Math.round(m.getBoundingClientRect().height),
      tight: Math.round(t.getBoundingClientRect().height),
    }))
    nodes.forEach((n) => ro.observe(n as HTMLDivElement))
    return () => ro.disconnect()
  }, [])

  const grammarDeal = useMemo(() => demoDeals('grammar')[0], [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: dark ? '#0B0C0E' : '#E7EBF0',
        color: dark ? '#ECEDF3' : '#0E1410',
        padding: '28px 32px 56px',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <header style={{ maxWidth: 1240, margin: '0 auto 26px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>
          Direction artistique du CRM — comparateur
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.72, margin: '8px 0 0', maxWidth: 760 }}>
          Le même composant dense du Pipeline, sous trois directions. Données de
          démonstration, aucun appel Supabase.
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <Toggle label={dark ? 'Sombre' : 'Clair'} on={dark} onClick={() => setDark((v) => !v)} dark={dark} />
          <Toggle label="Inter Tight" on={font} onClick={() => setFont((v) => !v)} dark={dark} />
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          maxWidth: 1240,
          margin: '0 auto',
          alignItems: 'start',
        }}
      >
        {PANELS.map((panel) => {
          const sp = paletteFor(panel.id, base, dark)
          const useMxFont = font && panel.id !== 'sugar'

          return (
            <section key={panel.id}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>{panel.title}</h2>
              {/* Les trois notes tiennent en UNE ligne pleine à la largeur de
                  référence (~62 signes) : calibrées plus long, elles débordaient
                  sur une seconde ligne remplie à 13-35 % — trois orphelines de
                  deux mots, que `minHeight` alignait sans les corriger. */}
              <p style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.62, margin: '0 0 12px', minHeight: 18 }}>
                {panel.note}
              </p>

              {/* `data-crm-da` sur la SEULE colonne littérale : les barreaux de
                  grammaire sont des propriétés personnalisées, donc ils
                  descendent par héritage. La colonne montre ainsi exactement ce
                  que l'application rendra — palette ET grammaire —, pendant que
                  les deux autres restent sur les barreaux de Sugar. */}
              <div
                data-crm-da={panel.id === 'literal' ? 'meggax' : undefined}
                style={{
                  background: sp.pageBg,
                  border: `1px solid ${sp.frameBorder}`,
                  borderRadius: 14,
                  padding: 12,
                  fontFamily: useMxFont ? MX_FONT : "'DM Sans', system-ui, sans-serif",
                }}
              >
                  {/* Le sélecteur de vue est le seul atome dense où `sp.accent`
                      atterrit vraiment (onglet actif) — sans lui, la colonne
                      seule ne montre PAS le changement d'accent. */}
                  <div style={{ display: 'flex', marginBottom: 12 }}>
                    <SugarSegmentedView value="kanban" sp={sp} />
                  </div>
                  <SugarStageColumn
                    stage={stage}
                    deals={dealsByPanel[panel.id]}
                    sp={sp}
                    dark={dark}
                    onOpenDeal={noop}
                    draggingId={null}
                    dragOver={false}
                    onDragOver={noop}
                    onDrop={noop}
                    onDragLeave={noop}
                    onDragStart={noop}
                    onDragEnd={noop}
                    onInlineOpen={null}
                    onReassign={noop}
                    onArchive={noop}
                    onMarkLost={noop}
                    onScheduleVisit={noop}
                  onAskAiVisit={noop}
                />
              </div>
            </section>
          )
        })}
      </div>

      <section style={{ maxWidth: 1240, margin: '44px auto 0' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
          La grammaire, pas seulement la couleur
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.68, margin: '0 0 18px', maxWidth: 820 }}>
          La même carte deal dans trois grammaires. La troisième descend d’un cran
          sur les échelles de la vitrine, sans en sortir.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>
              Sugar {heights ? `— ${heights.sugar} px de haut` : ''}
            </h3>
            <div
              ref={sugarCardRef}
              style={{ background: base.pageBg, border: `1px solid ${base.frameBorder}`, borderRadius: 14, padding: 12 }}
            >
              <SugarDealCard
                deal={grammarDeal}
                sp={base}
                dark={dark}
                isDragging={false}
                signing={false}
                signExit={false}
                onClick={noop}
                onDragStart={noop}
                onDragEnd={noop}
                onReassign={noop}
                onArchive={noop}
                onMarkLost={noop}
                onScheduleVisit={noop}
                onAskAiVisit={noop}
              />
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>
              MEGGA X {heights ? `— ${heights.mx} px de haut` : ''}
            </h3>
            <div ref={mxCardRef}>
              <MxCanvas dark={dark}><MxDealCardMockup light={!dark} /></MxCanvas>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>
              MEGGA X resserré {heights ? `— ${heights.tight} px de haut` : ''}
            </h3>
            {/* Pas de `<MxCanvas>` ici, volontairement : la carte resserrée se
                rend hors du scope `.megga-x`, sur les seuls tokens du module.
                C'est ce qui prouve qu'ils se suffisent — donc qu'ils sont
                utilisables dans le CRM, qui ne peut pas vivre dans ce scope. */}
            <div
              ref={tightCardRef}
              style={{
                padding: 12,
                background: mxCrmPalette(dark).pageBg,
                fontFamily: MXC_FONT,
              }}
            >
              <MxDealCardTight dark={dark} />
            </div>
          </div>
        </div>

        {heights && (
          <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.72, margin: '16px 0 0' }}>
            Pour la même information :{' '}
            <strong style={{ fontWeight: 600 }}>
              +{Math.round((heights.mx / heights.sugar) * 100 - 100)} % en MEGGA X littéral
            </strong>
            , mais{' '}
            <strong style={{ fontWeight: 600 }}>
              {heights.tight > heights.sugar ? '+' : ''}
              {Math.round((heights.tight / heights.sugar) * 100 - 100)} % une fois resserré
            </strong>
            . Sur une colonne de 900 px : {Math.floor(900 / heights.sugar)} cartes en Sugar,{' '}
            {Math.floor(900 / heights.mx)} en littéral, {Math.floor(900 / heights.tight)} en resserré.
          </p>
        )}
      </section>

      <footer
        style={{
          maxWidth: 1240,
          margin: '34px auto 0',
          fontSize: 12.5,
          lineHeight: 1.65,
          opacity: 0.66,
        }}
      >
        <strong style={{ fontWeight: 600, opacity: 0.9 }}>Où en est la migration.</strong>{' '}
Les 5 dossiers de composants sont faits : 161 fichiers, la grammaire est en
        variables CSS, l’échelle normalisée à 13 barreaux de texte. La colonne du
        milieu est une simulation ; celle de droite est ce que l’application rendra,
        elle lit la même palette. Basculer se fait par la préférence de direction.
      </footer>
    </div>
  )
}

/** Bascule de la barre d'outils — locale, la page ne touche pas au thème de l'app. */
function Toggle({ label, on, onClick, dark }: { label: string; on: boolean; onClick: () => void; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 500,
        padding: '7px 14px',
        borderRadius: 999,
        border: `1px solid ${dark ? '#2A2D36' : '#C3CAD4'}`,
        background: on ? (dark ? '#21242F' : '#FFFFFF') : 'transparent',
        color: 'inherit',
        opacity: on ? 1 : 0.6,
      }}
    >
      {label}
    </button>
  )
}
