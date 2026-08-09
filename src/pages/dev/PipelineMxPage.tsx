/**
 * MEGGA X CRM — le Pipeline en entier (route /design-system/pipeline-mx).
 *
 * Deuxième étape de l'évaluation de direction artistique, après le comparateur
 * `/design-system/da-compare` : une carte isolée ne dit rien des ÉTATS, et c'est
 * là que se cassent les directions. Cet écran montre donc le survol, la
 * sélection, le glisser en cours, le menu ouvert, la colonne vide et la barre
 * d'outils — tout ce dont une maquette de carte ne parle pas.
 *
 * Ce que la page prouve, et qui est son seul intérêt technique : elle se rend
 * **entièrement sur `@/components/megga-x-crm/tokens`**, hors du scope
 * `.megga-x`. Aucune classe de la vitrine, aucun des ~260 Ko de sa feuille. Si
 * un état manque de vocabulaire, il manque ici et se voit.
 *
 * Les teintes d'étape restent celles de Sugar (`sgStageTint`) : elles portent la
 * progression du funnel, ce n'est pas de la décoration, et la question posée
 * porte sur la grammaire — pas sur le codage de l'information.
 *
 * Données de démonstration, aucun appel Supabase. Page temporaire, à retirer avec
 * le comparateur une fois la direction tranchée.
 */

import { useState } from 'react'
import {
  CRM_STAGES, crmFmtCHF, sgStagePillBg, sgStageTint, type StageId,
} from '@/components/crm-sugar/tokens'
import {
  MXC_FONT, MXC_RADIUS, MXC_SPACE, MXC_SYSTEM, MXC_TYPE, mxCrmPalette,
} from '@/components/megga-x-crm/tokens'

type CardState = 'idle' | 'selected' | 'dragging'

interface DemoDeal {
  id: string
  title: string
  contact: string
  value: number
  due: 'retard' | 'aujourdhui' | 'demain' | null
  state: CardState
}

/** Un plateau volontairement inégal : c'est le cas réel, et il révèle les
 *  colonnes trop hautes ou trop vides que des données uniformes cachent. */
const BOARD: ReadonlyArray<{ stage: StageId; deals: DemoDeal[] }> = [
  {
    stage: 'searching',
    deals: [
      { id: 'd1', title: 'Confirmer la visite de samedi', contact: 'Marie Bertrand', value: 1_180_000, due: 'retard', state: 'idle' },
      { id: 'd2', title: 'Rappeler après la contre-visite', contact: 'Élodie Schmidt', value: 890_000, due: 'aujourdhui', state: 'idle' },
      { id: 'd3', title: 'Envoyer les trois biens retenus', contact: 'Pierre Vionnet', value: 1_750_000, due: null, state: 'idle' },
    ],
  },
  {
    stage: 'visit-scheduled',
    deals: [
      { id: 'd4', title: 'Préparer le dossier de visite', contact: 'Sofia Marchand', value: 2_100_000, due: 'demain', state: 'selected' },
      { id: 'd5', title: 'Confirmer l’accès avec la régie', contact: 'Luc Rossier', value: 745_000, due: null, state: 'idle' },
    ],
  },
  {
    stage: 'offer',
    deals: [
      { id: 'd6', title: 'Relancer sur la contre-offre', contact: 'Anaïs Perrin', value: 1_450_000, due: 'retard', state: 'dragging' },
    ],
  },
  { stage: 'signed', deals: [] },
]

const DUE_LABEL: Record<NonNullable<DemoDeal['due']>, string> = {
  retard: 'En retard',
  aujourdhui: 'Aujourd’hui',
  demain: 'Demain',
}

/** Le Pipeline entier dans la grammaire MEGGA X resserrée. */
export default function PipelineMxPage() {
  const [dark, setDark] = useState(true)
  const [menuOn, setMenuOn] = useState<string | null>('d2')
  const [hovered, setHovered] = useState<string | null>('d1')
  const p = mxCrmPalette(dark)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: p.pageBg,
        color: p.ink,
        fontFamily: MXC_FONT,
        padding: `${MXC_SPACE.xxl}px ${MXC_SPACE.xxl}px 64px`,
      }}
    >
      <header style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: MXC_SPACE.lg, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: MXC_TYPE.xl, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' }}>Pipeline</h1>
        <Segmented p={p} />
        <Pill p={p} label="Toutes les étapes" />
        <Pill p={p} label="Tous les risques" />
        <div style={{ flex: 1 }} />
        <Button p={p} onClick={() => setDark((v) => !v)} variant="ghost">
          {dark ? 'Sombre' : 'Clair'}
        </Button>
        <Button p={p}>Nouveau deal</Button>
      </header>

      <div
        style={{
          maxWidth: 1400, margin: `${MXC_SPACE.xxl}px auto 0`,
          display: 'grid', gridTemplateColumns: `repeat(${BOARD.length}, minmax(260px, 1fr))`,
          gap: MXC_SPACE.lg, alignItems: 'start',
        }}
      >
        {BOARD.map(({ stage, deals }) => (
          <Column
            key={stage}
            stage={stage}
            deals={deals}
            dark={dark}
            p={p}
            menuOn={menuOn}
            hovered={hovered}
            onMenu={(id) => setMenuOn((cur) => (cur === id ? null : id))}
            onHover={setHovered}
          />
        ))}
      </div>

      <p style={{ maxWidth: 1400, margin: `${MXC_SPACE.xxl}px auto 0`, fontSize: MXC_TYPE.xs, color: p.sub, lineHeight: 1.6 }}>
        Rendu sans le scope <code>.megga-x</code> : uniquement sur les tokens
        MEGGA X CRM. Données de démonstration.
      </p>
    </div>
  )
}

type Pal = ReturnType<typeof mxCrmPalette>

/** Colonne d'étape : en-tête teinté, pile de cartes, état vide. */
function Column({
  stage, deals, dark, p, menuOn, hovered, onMenu, onHover,
}: {
  stage: StageId
  deals: DemoDeal[]
  dark: boolean
  p: Pal
  menuOn: string | null
  hovered: string | null
  onMenu: (id: string) => void
  onHover: (id: string | null) => void
}) {
  const tint = sgStageTint(stage, dark)
  const total = deals.reduce((s, d) => s + d.value, 0)

  return (
    <section
      style={{
        background: p.frameBg,
        border: `1px solid ${p.frameBorder}`,
        borderRadius: MXC_RADIUS.lg,
        padding: MXC_SPACE.md,
        display: 'grid',
        gap: MXC_SPACE.md,
      }}
    >
      <header style={{ display: 'grid', gap: MXC_SPACE.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: MXC_SPACE.sm }}>
          <span style={{ width: 8, height: 8, borderRadius: MXC_RADIUS.pill, background: tint.hue }} />
          <span style={{ fontSize: MXC_TYPE.sm, fontWeight: 600, flex: 1 }}>{CRM_STAGES[stage].label}</span>
          <span style={{ fontSize: MXC_TYPE.xs, color: tint.tintInk, fontWeight: 600 }}>{deals.length}</span>
        </div>
        <span style={{ fontSize: MXC_TYPE.xs, color: p.sub }}>
          {total ? crmFmtCHF(total) : '—'}
        </span>
      </header>

      {deals.length === 0 ? (
        <Empty p={p} />
      ) : (
        <div style={{ display: 'grid', gap: MXC_SPACE.sm }}>
          {deals.map((d) => (
            <Card
              key={d.id}
              deal={d}
              stage={stage}
              dark={dark}
              p={p}
              menuOpen={menuOn === d.id}
              hovered={hovered === d.id}
              onMenu={() => onMenu(d.id)}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Carte deal — porte les quatre états du plateau.
 *
 * Le glisser (`dragging`) se signale par l'opacité et un liseré d'accent, pas
 * par une ombre : en sombre la direction sépare par la bordure, et une ombre
 * inventée ici mentirait sur ce que la grammaire sait faire.
 */
function Card({
  deal, stage, dark, p, menuOpen, hovered, onMenu, onHover,
}: {
  deal: DemoDeal
  stage: StageId
  dark: boolean
  p: Pal
  menuOpen: boolean
  hovered: boolean
  onMenu: () => void
  onHover: (id: string | null) => void
}) {
  const active = deal.state === 'selected' || menuOpen
  return (
    <article
      onMouseEnter={() => onHover(deal.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'relative',
        background: hovered ? p.cardSubBg : p.cardBg,
        border: `1px solid ${active ? p.accent : p.cardBorder}`,
        borderRadius: MXC_RADIUS.md,
        padding: MXC_SPACE.lg,
        boxShadow: p.shadow,
        opacity: deal.state === 'dragging' ? 0.55 : 1,
        display: 'grid',
        gap: MXC_SPACE.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: MXC_SPACE.sm }}>
        <span style={{ fontSize: MXC_TYPE.sm, fontWeight: 500, lineHeight: 1.35 }}>{deal.title}</span>
        {deal.due && (
          <span
            style={{
              fontSize: MXC_TYPE.xs, lineHeight: 1, whiteSpace: 'nowrap',
              padding: MXC_SPACE.sm, borderRadius: MXC_RADIUS.pill,
              // Une alerte ne peut pas porter l'accent de marque : au premier
              // essai « En retard » était du même bleu que le bouton primaire,
              // et se lisait comme une mise en avant au lieu d'un avertissement.
              background: deal.due === 'retard' ? MXC_SYSTEM.danger : sgStagePillBg(stage, dark),
              color: deal.due === 'retard' ? MXC_SYSTEM.systemInk : p.accentInk,
            }}
          >
            {DUE_LABEL[deal.due]}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: MXC_SPACE.sm, fontSize: MXC_TYPE.xs }}>
        <span style={{ color: p.sub }}>{deal.contact}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: MXC_SPACE.sm }}>
          <span style={{ fontWeight: 500 }}>{crmFmtCHF(deal.value)}</span>
          <button
            type="button"
            onClick={onMenu}
            aria-label="Actions"
            style={{
              appearance: 'none', cursor: 'pointer', lineHeight: 1,
              width: 22, height: 22, borderRadius: MXC_RADIUS.pill,
              border: `1px solid ${menuOpen ? p.accent : 'transparent'}`,
              background: menuOpen ? p.focusSurface : 'transparent',
              color: p.sub, fontSize: MXC_TYPE.xs,
            }}
          >
            ···
          </button>
        </div>
      </div>

      {menuOpen && <Menu p={p} />}
    </article>
  )
}

/** Menu d'actions — surface flottante, la seule qui s'élève au-dessus des cartes. */
function Menu({ p }: { p: Pal }) {
  return (
    <div
      style={{
        position: 'absolute', top: '100%', right: MXC_SPACE.md, zIndex: 2,
        marginTop: MXC_SPACE.xs, minWidth: 176,
        background: p.solidBg,
        border: `1px solid ${p.solidBorder}`,
        borderRadius: MXC_RADIUS.sm,
        boxShadow: p.solidShadow,
        padding: MXC_SPACE.xs,
        display: 'grid',
      }}
    >
      {['Planifier une visite', 'Réattribuer', 'Marquer perdu', 'Archiver'].map((label) => (
        <button
          key={label}
          type="button"
          style={{
            appearance: 'none', cursor: 'pointer', textAlign: 'left',
            padding: `${MXC_SPACE.sm}px ${MXC_SPACE.md}px`,
            borderRadius: MXC_RADIUS.xs, border: 0, background: 'transparent',
            color: p.ink, fontSize: MXC_TYPE.xs, fontFamily: 'inherit',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Colonne sans deal : le seul endroit du plateau qui parle à l'agent. */
function Empty({ p }: { p: Pal }) {
  return (
    <div
      style={{
        border: `1px dashed ${p.cardBorder}`,
        borderRadius: MXC_RADIUS.md,
        padding: `${MXC_SPACE.xxl}px ${MXC_SPACE.lg}px`,
        textAlign: 'center',
        color: p.sub,
        fontSize: MXC_TYPE.xs,
        lineHeight: 1.6,
      }}
    >
      Aucun deal signé ce mois-ci.
    </div>
  )
}

function Segmented({ p }: { p: Pal }) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, background: p.cardBg, border: `1px solid ${p.cardBorder}`, borderRadius: MXC_RADIUS.pill }}>
      {['Kanban', 'Liste', 'Timeline'].map((v, i) => (
        <span
          key={v}
          style={{
            padding: `${MXC_SPACE.sm}px ${MXC_SPACE.lg}px`,
            borderRadius: MXC_RADIUS.pill,
            background: i === 0 ? p.accent : 'transparent',
            color: i === 0 ? p.accentInk : p.sub,
            fontSize: MXC_TYPE.xs,
            fontWeight: i === 0 ? 600 : 500,
          }}
        >
          {v}
        </span>
      ))}
    </div>
  )
}

function Pill({ p, label }: { p: Pal; label: string }) {
  return (
    <span
      style={{
        padding: `${MXC_SPACE.sm}px ${MXC_SPACE.lg}px`,
        borderRadius: MXC_RADIUS.pill,
        border: `1px solid ${p.cardBorder}`,
        background: p.cardBg,
        color: p.sub,
        fontSize: MXC_TYPE.xs,
      }}
    >
      {label}
    </span>
  )
}

function Button({
  p, children, onClick, variant = 'primary',
}: {
  p: Pal
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost'
}) {
  const primary = variant === 'primary'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
        padding: `${MXC_SPACE.sm}px ${MXC_SPACE.xl}px`,
        borderRadius: MXC_RADIUS.pill,
        border: `1px solid ${primary ? p.accent : p.cardBorder}`,
        background: primary ? p.accent : p.cardBg,
        color: primary ? p.accentInk : p.sub,
        fontSize: MXC_TYPE.xs,
        fontWeight: primary ? 600 : 500,
      }}
    >
      {children}
    </button>
  )
}
