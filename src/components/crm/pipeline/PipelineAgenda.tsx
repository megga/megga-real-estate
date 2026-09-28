/**
 * Timeline du Pipeline à cinq phases — l'AGENDA des affaires (proposition du 27.09.2026).
 *
 * Elle répond à « QUAND dois-je agir ? », comme la Timeline d'avant, et en garde le meilleur :
 * les groupes par urgence, le repère du jour, la replanification en glissant (persistée, heure
 * conservée). Ce qu'elle change, chaque point mesuré sur le banc :
 *
 * ⛔ 1. ELLE NE CACHE PLUS LES AFFAIRES SANS ACTION. L'ancienne filtrait sur `nextAction` :
 *    Philippe, sans nouvelle depuis 130 jours, n'y apparaissait pas — l'affaire qu'il fallait
 *    justement rattraper. Elles ont leur groupe, « À planifier », avec une pastille qu'on glisse
 *    sur un jour pour poser une relance.
 * ⛔ 2. L'AXE PORTE SES JOURS. 702 px de piste pour ~14 jours sans une seule date : la position
 *    d'un point ne se lisait pas, et la date était répétée à droite. Ici une grille FIXE de
 *    quatorze jours, le jour marqué, les week-ends grisés. L'en-tête est celui d'un calendrier :
 *    l'initiale du jour sur son numéro, aujourd'hui dans une pastille, le mois là seulement où il
 *    change — « Lun. 28 » répété quatorze fois et trois libellés (« Affaire », « Retard »,
 *    « Après ») chargeaient la ligne sans rien apprendre (Julien, « règle numéro 1 »).
 * ⛔ 3. L'ÉCHELLE NE BOUGE PLUS. L'ancienne fenêtre se recalculait sur les données (de la plus
 *    vieille activité à la plus lointaine échéance) : un même jour ne tombait pas au même endroit
 *    d'une visite à l'autre. Au-delà de la grille, deux gouttières : « Retard » et « Après ».
 * ⛔ 4. LA LIGNE DIT QUOI FAIRE. « Note · 19h51 » devient « Signature chez le notaire » ; sous le
 *    nom, l'étape se lit en mots (et plus seulement en couleur) — et elle seule.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EtatVide from '@/components/crm/EtatVide'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmMix, crmVoileEncre, type CrmPalette } from '../tokens'
import type { CrmBien, CrmContact, CrmDeal } from '../mockData'
import { useEcranActif } from '@/hooks/useEcranActif'
import { amenerALaVue, iconeAction, jourCourt, type Arrivee } from './affaire'
import { ATTR_FLOTTANT, Flottant } from './Flottant'
import { joursJusqua, montantCourt, phase, phaseDe, stadeDuDeal } from './phases'
import { ton, type Ton } from './tons'

/** Quatorze jours : deux semaines à l'écran, ce qu'un agent planifie d'un regard. */
const JOURS = 14
/** La colonne de l'affaire, puis « Retard », les quatorze jours, « Après ». */
const COLONNES = `minmax(200px, 240px) 64px repeat(${JOURS}, minmax(0, 1fr)) 64px`
/** En deçà, un geste est un CLIC (il ouvre les options) ; au-delà, un glisser. */
const SEUIL_GLISSER = 4
/** Les jours que propose le menu d'une pastille : quatre gestes, pas un calendrier. */
const CHOIX: { cle: 'aujourdhui' | 'demain' | 'apresDemain' | 'lundi' | 'semaine'; jours: () => number }[] = [
  { cle: 'aujourdhui', jours: () => 0 },
  { cle: 'demain', jours: () => 1 },
  { cle: 'apresDemain', jours: () => 2 },
  { cle: 'lundi', jours: () => { const j = new Date().getDay(); return ((8 - j) % 7) || 7 } },
  { cle: 'semaine', jours: () => 7 },
]

type Groupe = 'retard' | 'aujourdhui' | 'semaine' | 'plusTard' | 'aPlanifier'
const ORDRE: Groupe[] = ['retard', 'aujourdhui', 'semaine', 'plusTard', 'aPlanifier']

interface Ligne {
  deal: CrmDeal
  contact: CrmContact
  bien: CrmBien | null
  /** Jours civils jusqu'à l'échéance ; `null` sans prochaine action. */
  j: number | null
  echeance: string | null
}

interface Props {
  sp: CrmPalette
  dark: boolean
  deals: CrmDeal[]
  contactsById: Map<string, CrmContact>
  biensById: Map<string, CrmBien>
  onOpenDeal: (id: string) => void
  /** Persiste la replanification (reminder → trigger_at). Un rejet annule le déplacement. */
  onReschedule: (reminderId: string, triggerAtIso: string) => Promise<void>
  /** Pose une première action sur une affaire qui n'en avait pas, au jour choisi. */
  onPlanifier: (deal: CrmDeal, jour: Date) => Promise<void>
  /** Marque l'action faite (menu de la pastille). */
  onFait: (reminderId: string) => Promise<void>
  /** L'affaire qu'on vient de créer : sa ligne est amenée à l'écran et marquée un instant. */
  nouveauId?: string | null
  /** L'arrivée d'une affaire née de « Nouveau deal » : sa ligne attend la modale, puis se pose. */
  arriveeDe?: (id: string) => Arrivee | undefined
}

export function PipelineAgenda({ sp, dark, deals, contactsById, biensById, onOpenDeal, onReschedule, onPlanifier, onFait, nouveauId, arriveeDe }: Props) {
  const { t, i18n } = useTranslation('pipeline')
  const [deplace, setDeplace] = useState<Record<string, string>>({})
  const [glisse, setGlisse] = useState<{ id: string; jour: number } | null>(null)
  const [fermes, setFermes] = useState<Partial<Record<Groupe, boolean>>>({})
  const aGlisse = useRef(false)

  const aujourdhui = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const jours = useMemo(() => Array.from({ length: JOURS }, (_, i) => {
    const d = new Date(aujourdhui); d.setDate(d.getDate() + i); return d
  }), [aujourdhui])

  const lignes = useMemo<Ligne[]>(() => deals.flatMap((deal) => {
    const contact = contactsById.get(deal.contactId)
    if (!contact) return []
    const bien = deal.bienId ? biensById.get(deal.bienId) ?? null : null
    const echeance = deal.nextAction ? deplace[deal.id] ?? deal.nextAction.dueAt : null
    return [{ deal, contact, bien, echeance, j: echeance ? joursJusqua(echeance) : null }]
  }), [deals, contactsById, biensById, deplace])

  const groupeDe = (l: Ligne): Groupe =>
    l.j === null ? 'aPlanifier' : l.j < 0 ? 'retard' : l.j === 0 ? 'aujourdhui' : l.j <= 6 ? 'semaine' : 'plusTard'

  const groupes = ORDRE.map((g) => {
    const du = lignes.filter((l) => groupeDe(l) === g)
    du.sort((a, b) => g === 'aPlanifier'
      // Les plus vieux silences d'abord : ce sont eux qui refroidissent.
      ? a.deal.updatedAt.localeCompare(b.deal.updatedAt)
      : (a.echeance ?? '').localeCompare(b.echeance ?? ''))
    const ventes = du.reduce((s, l) => s + (l.bien?.transaction === 'location' ? 0 : l.deal.value || 0), 0)
    return { id: g, lignes: du, ventes }
  }).filter((g) => g.lignes.length > 0)

  /** Le glisser d'une pastille : jour par jour, jamais avant aujourd'hui. */
  /** Replanifie (ou planifie) l'affaire au jour donné, l'heure gardée : le glisser ET le menu. */
  const deplacerVers = (l: Ligne, jour: Date) => {
    const cible = new Date(jour)
    if (l.deal.nextAction && l.echeance) {
      const avant = new Date(l.echeance)
      cible.setHours(avant.getHours(), avant.getMinutes(), 0, 0)
      const iso = cible.toISOString()
      const id = l.deal.id
      setDeplace((d) => ({ ...d, [id]: iso }))
      if (l.deal.nextAction.reminderId) {
        onReschedule(l.deal.nextAction.reminderId, iso).catch(() => {
          setDeplace((d) => { const n = { ...d }; delete n[id]; return n })
        })
      }
    } else {
      cible.setHours(10, 0, 0, 0)
      void onPlanifier(l.deal, cible)
    }
  }

  const commencer = (e: React.PointerEvent, l: Ligne, piste: HTMLElement | null) => {
    if (!piste) return
    e.stopPropagation(); e.preventDefault()
    const r = piste.getBoundingClientRect()
    const x0 = e.clientX
    let demarre = false
    let dernier: number | null = null
    aGlisse.current = false
    const bouger = (ev: PointerEvent) => {
      // ⚠ Un seuil : sans lui, la moindre secousse d'un clic devenait un glisser, qui réécrivait
      // l'échéance au même jour — et le clic n'ouvrait jamais les options.
      if (!demarre && Math.abs(ev.clientX - x0) < SEUIL_GLISSER) return
      demarre = true
      const jour = Math.max(0, Math.min(JOURS - 1, Math.floor(((ev.clientX - r.left) / r.width) * JOURS)))
      if (jour !== dernier) { dernier = jour; aGlisse.current = true; setGlisse({ id: l.deal.id, jour }) }
    }
    const lacher = () => {
      window.removeEventListener('pointermove', bouger); window.removeEventListener('pointerup', lacher)
      setGlisse(null)
      // Le clic qui suit le lâcher (s'il tombe sur une ligne) doit être ignoré, puis plus aucun.
      setTimeout(() => { aGlisse.current = false }, 0)
      // Lâchée sur son propre jour, rien ne change : rien ne s'écrit.
      if (dernier === null || dernier === l.j) return
      deplacerVers(l, jours[dernier]!)
    }
    window.addEventListener('pointermove', bouger); window.addEventListener('pointerup', lacher)
  }

  // Les deux gouttières (« Retard », « Après ») : une colonne à peine grisée, pas un voile — elle
  // ne recouvre rien, elle dit « hors de la grille ».
  const fondGouttiere = crmVoileEncre(dark, dark ? 0.02 : 0.015)
  // L'axe : une initiale (L, M, M, J…) et le mois abrégé, dans la langue de l'écran.
  const initiale = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }), [i18n.language])
  const moisCourt = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short' }), [i18n.language])
  const fondJour = (i: number) => {
    const d = jours[i]!
    if (i === 0) return crmMix(sp.accent, sp.cardBg, sp.isDark ? 0.9 : 0.95)
    return d.getDay() === 0 || d.getDay() === 6 ? crmVoileEncre(dark, dark ? 0.03 : 0.025) : 'transparent'
  }

  if (lignes.length === 0) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><EtatVide dark={dark} titre={t('timeline.emptySearch')} /></div>
  }

  return (
    <div style={{ minWidth: 820, display: 'flex', flexDirection: 'column', paddingBottom: 'var(--crm-space-6xl)' }}>
      {/* L'axe reste en haut pendant qu'on défile : on ne perd jamais le jour. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: sp.pageBg,
        display: 'grid', gridTemplateColumns: COLONNES, alignItems: 'end',
        padding: 'var(--crm-space-md) var(--crm-space-2xl)',
        borderBottom: `1px solid ${sp.cardBorder}`,
      }}>
        <span />
        <span />
        {jours.map((d, i) => {
          const weekend = d.getDay() === 0 || d.getDay() === 6
          const nouveauMois = d.getDate() === 1
          return (
            <span key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-2xs)' }}>
              <span style={{ fontSize: 'var(--crm-text-xs)', lineHeight: 1, fontWeight: nouveauMois ? 600 : 500, color: nouveauMois ? sp.ink : sp.sub }}>
                {nouveauMois ? moisCourt.format(d) : initiale.format(d)}
              </span>
              <span style={{
                width: 24, height: 24, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center',
                fontSize: 'var(--crm-text-md)', fontWeight: i === 0 ? 600 : 500, fontVariantNumeric: 'tabular-nums',
                background: i === 0 ? sp.accent : 'transparent',
                color: i === 0 ? sp.accentInk : glisse?.jour === i ? ton('aujourdhui', sp).encre : weekend ? sp.sub : sp.ink,
                // Pendant un glisser, le jour visé s'entoure : on voit où la pastille va tomber.
                boxShadow: glisse?.jour === i && i !== 0 ? `inset 0 0 0 1.5px ${ton('aujourdhui', sp).encre}` : 'none',
              }}>{d.getDate()}</span>
            </span>
          )
        })}
        <span />
      </div>

      {groupes.map((g) => {
        const ferme = !!fermes[g.id]
        return (
          <section key={g.id} style={{ padding: '0 var(--crm-space-2xl)' }}>
            <button
              type="button"
              onClick={() => setFermes((f) => ({ ...f, [g.id]: !f[g.id] }))}
              style={{
                display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', border: 0, background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', padding: 'var(--crm-space-2xl) 0 var(--crm-space-md)',
              }}
            >
              <span style={{ display: 'inline-flex', transform: ferme ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>
                <MEIcon name="chevron-down" size={12} color={sp.ink} />
              </span>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: g.id === 'retard' ? ton('retard', sp).encre : sp.ink }}>
                {g.id === 'aPlanifier' ? t('phases.agenda.aPlanifier') : t(`timeline.groups.${g.id === 'plusTard' ? 'later' : g.id === 'aujourdhui' ? 'today' : g.id === 'semaine' ? 'week' : 'late'}`)}
              </span>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                {g.lignes.length}{g.ventes > 0 ? ` · CHF ${montantCourt(g.ventes, i18n.language)}` : ''}
              </span>
            </button>

            {!ferme && (
              <div style={{
                position: 'relative', background: sp.cardBg, borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden',
                boxShadow: sp.isDark ? `inset 0 0 0 1px ${sp.cardBorder}` : sp.shadowSm,
              }}>
                {/* Le fond des jours : aujourd'hui teinté, les week-ends grisés — sous les lignes. */}
                <div aria-hidden style={{
                  position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: COLONNES, pointerEvents: 'none',
                }}>
                  <span />
                  <span style={{ background: fondGouttiere }} />
                  {jours.map((_, i) => <span key={i} style={{ background: fondJour(i) }} />)}
                  <span style={{ background: fondGouttiere }} />
                </div>
                {g.lignes.map((l, n) => (
                  <LigneAgenda
                    key={l.deal.id} l={l} n={n} sp={sp}
                    nouvelle={l.deal.id === nouveauId} arrivee={arriveeDe?.(l.deal.id)}
                    glisseVers={glisse?.id === l.deal.id ? glisse.jour : null}
                    onOpen={() => { if (aGlisse.current) { aGlisse.current = false; return } onOpenDeal(l.deal.id) }}
                    onCommencer={commencer}
                    estUnGlisser={() => aGlisse.current}
                    onDeplacer={(jour) => deplacerVers(l, jour)}
                    onFait={onFait}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function LigneAgenda({ l, n, sp, nouvelle, arrivee, glisseVers, onOpen, onCommencer, estUnGlisser, onDeplacer, onFait }: {
  l: Ligne
  n: number
  sp: CrmPalette
  nouvelle: boolean
  arrivee?: Arrivee
  glisseVers: number | null
  onOpen: () => void
  onCommencer: (e: React.PointerEvent, l: Ligne, piste: HTMLElement | null) => void
  /** Le geste qui vient de finir était-il un glisser ? Son clic n'ouvre alors rien. */
  estUnGlisser: () => boolean
  onDeplacer: (jour: Date) => void
  onFait: (reminderId: string) => Promise<void>
}) {
  const { t, i18n } = useTranslation('pipeline')
  const piste = useRef<HTMLDivElement>(null)
  const rangee = useRef<HTMLDivElement>(null)
  const pastille = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [survol, setSurvol] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (nouvelle || arrivee === 'attente') amenerALaVue(rangee.current)
  }, [nouvelle, arrivee])

  // Le menu se ferme dehors, à Échap, au défilement — et se tait sur un écran d'onglet caché.
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!menu || !ecranActif) return
    // ⚠ En CAPTURE : la pastille d'une autre ligne arrête la propagation de son `pointerdown`
    // (elle commence un glisser), et deux menus seraient restés ouverts.
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node
      if (pastille.current?.contains(cible) || menuRef.current?.contains(cible)) return
      setMenu(false)
    }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    const defiler = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(`[${ATTR_FLOTTANT}]`)) return
      setMenu(false)
    }
    document.addEventListener('pointerdown', dehors, true)
    document.addEventListener('keydown', echap)
    window.addEventListener('scroll', defiler, true)
    window.addEventListener('resize', defiler)
    return () => {
      document.removeEventListener('pointerdown', dehors, true)
      document.removeEventListener('keydown', echap)
      window.removeEventListener('scroll', defiler, true)
      window.removeEventListener('resize', defiler)
    }
  }, [menu, ecranActif])

  const stade = stadeDuDeal(l.deal)
  const idPhase = phaseDe(stade)
  const laPhase = idPhase ? phase(idPhase) : null
  // ⛔ UNE SEULE INFORMATION sous le nom (Julien, 28.09.2026 : « pas besoin de l'intérêt ET de la
  // ville ») : l'étape, teintée de sa phase par la pastille. Rangée par date et non par colonne, la
  // Timeline ne la dit nulle part ailleurs ; le bien, lui, se lit sur la fiche.
  const etape = laPhase && laPhase.stades.length > 1 ? t(`phases.stades.${stade}`) : laPhase ? t(`phases.noms.${laPhase.id}`) : ''
  const na = l.deal.nextAction

  // La colonne de la pastille : sa journée, ou une gouttière. Pendant un glisser, le jour visé.
  const j = glisseVers ?? l.j
  const colonne = j === null ? 3 : j < 0 ? 2 : j >= JOURS ? JOURS + 3 : j + 3
  const tonPastille: Ton = j === null ? 'aPlanifier' : j < 0 ? 'retard' : j === 0 ? 'aujourdhui' : 'neutre'
  const tp = ton(tonPastille, sp)
  // Près du bord droit, la pastille s'étend vers la gauche : elle n'est jamais coupée par la fin de la grille.
  const versLaGauche = colonne >= JOURS - 1
  const libelle = !na
    ? t('phases.agenda.planifier')
    : `${na.note || t(`timeline.kind.${na.kind}`, { defaultValue: t('timeline.kind.fallback') })}`
  const jourDe = (plus: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + plus); return d }
  // ⛔ PAS D'HEURE (Julien, 27.09.2026 : « est-ce que l'heure c'est indispensable ? »). La colonne dit
  // déjà le jour, et l'heure d'une relance est presque toujours celle de sa CRÉATION reportée de N
  // jours (« 0h04 », « 23h04 ») : elle ne disait rien. Restent ce que la grille ne montre pas — le
  // retard, et le jour d'une action au-delà des deux semaines — et, pendant un glisser, le jour visé.
  const quand = glisseVers !== null ? jourCourt(jourDe(glisseVers).toISOString(), i18n.language)
    : !na || !l.echeance ? null
      : l.j !== null && l.j < 0 ? (l.j === -1 ? t('phases.agenda.hier') : t('phases.agenda.ilYA', { count: -l.j }))
        : l.j !== null && l.j >= JOURS ? jourCourt(l.echeance, i18n.language)
          : null
  const actif = survol || menu || glisseVers !== null
  const bord = tonPastille === 'neutre' ? (actif ? sp.sub : sp.cardBorder) : actif ? tp.encre : tp.filet

  const choisir = (plus: number) => { setMenu(false); onDeplacer(jourDe(plus)) }
  const ligneMenu = (cle: string, icone: MEIconName, libelleMenu: string, onClick: () => void, droite?: string) => (
    <button key={cle} type="button" role="menuitem" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', width: '100%', textAlign: 'left',
      padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0,
      background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', color: sp.ink,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = sp.focusSurface }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <MEIcon name={icone} size={14} color={sp.sub} />
      <span style={{ flex: 1 }}>{libelleMenu}</span>
      {droite && <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{droite}</span>}
    </button>
  )

  return (
    <div
      ref={rangee}
      onClick={onOpen}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={{
        position: 'relative', display: 'grid', gridTemplateColumns: COLONNES, alignItems: 'center',
        minHeight: 52, cursor: 'pointer',
        borderTop: n === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
        // La ligne neuve : un filet d'accent à gauche et une teinte, qui s'éteignent lentement.
        background: nouvelle ? ton('aujourdhui', sp).fond : 'transparent',
        boxShadow: nouvelle ? `inset 3px 0 0 ${sp.accent}` : 'none',
        transition: 'background .8s ease, box-shadow .8s ease',
        // Née de « Nouveau deal » : invisible sous la modale, elle descend à sa place quand celle-ci part.
        opacity: arrivee === 'attente' ? 0 : undefined,
        animation: arrivee === 'atterrit' ? 'crm-ligne-arrivee .4s cubic-bezier(.2,.8,.2,1) both' : undefined,
      }}
    >
      <div style={{ gridColumn: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-md) var(--crm-space-lg)' }}>
        <span style={{
          fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{`${l.contact.firstName} ${l.contact.lastName}`.trim()}</span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', minWidth: 0,
          fontSize: 'var(--crm-text-sm)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden',
        }}>
          {laPhase && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: laPhase.teinte, flexShrink: 0 }} />}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{etape}</span>
        </span>
      </div>

      {/* La piste : les quatorze jours, où se mesure un glisser. */}
      <div ref={piste} aria-hidden style={{ gridColumn: `3 / ${JOURS + 3}`, gridRow: 1, alignSelf: 'stretch' }} />

      {/* ⛔ LA PASTILLE EST UN OBJET QU'ON SAISIT (Julien, 27.09.2026 : sans elle, « l'utilisateur ne sait
          même pas s'il peut le dropper », ni ce qu'il peut en faire). Lisible d'abord : fond plein,
          texte en encre, la teinte sur l'icône et la bordure — plus jamais rouge sur rouge ni tronquée.
          Au survol elle se soulève et son icône devient une POIGNÉE (on la glisse) ; un clic ouvre ses
          options, un glisser la replanifie. ⚠ Pas de « ⋯ » à côté : la pastille EST le bouton, un
          second déclencheur le redisait (Julien, 27.09.2026 : « ça fait redondance »). */}
      <div style={{
        gridColumn: versLaGauche ? `3 / ${colonne + 1}` : `${colonne} / ${JOURS + 4}`,
        gridRow: 1, justifySelf: versLaGauche ? 'end' : 'start', minWidth: 0, maxWidth: '100%', zIndex: 1,
        padding: '0 var(--crm-space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
        flexDirection: versLaGauche ? 'row-reverse' : 'row',
      }}>
        <span
          ref={pastille}
          role="button"
          tabIndex={0}
          aria-haspopup="menu"
          aria-expanded={menu}
          title={na ? t('phases.agenda.replanifier') : t('phases.agenda.planifierAide')}
          onPointerDown={(e) => onCommencer(e, l, piste.current)}
          onClick={(e) => { e.stopPropagation(); if (!estUnGlisser()) setMenu((o) => !o) }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenu((o) => !o) } }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', minWidth: 0, maxWidth: '100%', height: 28,
            padding: '0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            background: sp.cardBg, border: `1px ${na ? 'solid' : 'dashed'} ${bord}`,
            boxShadow: glisseVers !== null ? sp.solidShadow : actif && !sp.isDark ? sp.shadowSm : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', outline: 'none',
            cursor: glisseVers !== null ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none',
            transition: 'border-color .15s, box-shadow .15s',
          }}
        >
          <MEIcon name={actif ? 'grip' : na ? iconeAction(na.kind) : 'plus'} size={12} color={actif ? sp.sub : tp.encre} />
          <span style={{
            minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--crm-text-md)', fontWeight: 500,
            color: na ? sp.ink : tp.encre,
          }}>{libelle}</span>
          {quand && (
            <span style={{
              flexShrink: 0, fontSize: 'var(--crm-text-sm)', fontVariantNumeric: 'tabular-nums',
              fontWeight: tonPastille === 'retard' || glisseVers !== null ? 600 : 400,
              color: glisseVers !== null ? ton('aujourdhui', sp).encre : tonPastille === 'retard' ? tp.encre : sp.sub,
            }}>{quand}</span>
          )}
        </span>
      </div>

      {menu && (
        <Flottant ancre={pastille} aligner="debut">
          <div ref={menuRef} role="menu" onClick={(e) => e.stopPropagation()} style={{
            minWidth: 200, display: 'flex', flexDirection: 'column', padding: 'var(--crm-space-2xs)',
            background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-lg)', boxShadow: sp.solidShadow,
            fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
          }}>
            {na?.reminderId && ligneMenu('fait', 'check', t('fiche.fait'), () => { setMenu(false); void onFait(na.reminderId!) })}
            {/* Un même jour ne se propose qu'une fois : un dimanche, « Lundi » EST « Demain ». */}
            {CHOIX.filter((c) => !na || c.cle !== 'aujourdhui')
              .filter((c, i, tous) => tous.findIndex((x) => x.jours() === c.jours()) === i)
              .map((c) => ligneMenu(
              c.cle, 'calendar', c.cle === 'aujourdhui' ? t('board.card.today') : t(`fiche.quand.${c.cle}`),
              () => choisir(c.jours()),
            ))}
            <span aria-hidden style={{ height: 1, background: sp.cardBorder, margin: 'var(--crm-space-2xs) 0' }} />
            {ligneMenu('ouvrir', 'arrow-right', t('phases.agenda.ouvrir'), () => { setMenu(false); onOpen() })}
          </div>
        </Flottant>
      )}
    </div>
  )
}
