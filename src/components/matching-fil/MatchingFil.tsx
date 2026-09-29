/**
 * Matching — le FIL DE MATCHS, la page 0 du pager de `/dashboard/matching` au bureau (`MatchingPage`), sur laquelle
 * « Matching » s'ouvre (lots 1 et 2, puis la boucle, lot B).
 *
 * Conceptions : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, pour la boucle
 * `docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md`, et pour le bureau
 * `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md`. Au téléphone, la route rend l'écran mobile
 * (`MobileMatchingPage`), qui ne monte pas le fil.
 *
 * Ce conteneur porte les données (`useMatchingFil`, `useSelectionMarche`), l'onglet, les filtres, la
 * sélection, les gestes, et le CLAVIER du fil entier.
 *
 * ⚠ TROIS ONGLETS, un par temps de la boucle (§5) : « À proposer » (les recherches à ajuster, les biens en
 * mandat, une ligne « Marché » par acheteur), « En attente » (une ligne par acheteur ; le panneau est la
 * feuille « Retours de … »), « À conclure » (une ligne par bien qui intéresse ; le panneau planifie la
 * visite). L'onglet est rangé dans l'ONGLET du CRM, comme les filtres ; la sélection reste locale.
 *
 * ⚠ Lot E1 (décision 12a) : un mandat qui n'est plus en vente (`horsVente`) sort d'« À proposer », son en-tête et
 * donc « Qui pour ce bien ? » avec lui ; « En attente » et « À conclure » le gardent, son état écrit.
 *
 * ⚠ Lot E1 (conception §5.1) : sans recherche d'acheteur active et sans match, la page 0 est la couverture de premier
 * lancement (`MatchingFirstRun`) ; avec des recherches mais aucun match, un état sobre qui mène au marché — « Tout est à
 * jour » ne se dit qu'à une agence qui a des matchs (`ecranDuFil`).
 *
 * ⚠ Le clavier est posé sur la RACINE du fil (`onKeyDown`), pas sur `window` : le fil est la page 0
 * d'un pager dont la page 1 reste montée, et plusieurs écrans d'onglet restent vivants. Un écouteur
 * global agirait depuis une page ou un onglet qu'on ne regarde pas ; celui-ci n'entend que ce qui a
 * le focus dedans. D'où, après chaque geste, le focus rendu à une ligne (ou à la racine) ; et à l'ouverture, un focus
 * perdu pris par la racine.
 *
 * ⚠ Les gestes qui font SORTIR un match passent par la fenêtre d'annulation (`PendingRegistry`) : « Je
 * l'ai proposé », Plus tard, Écarter, Intéressé, Pas intéressé. Ils consignent ce que l'agent a fait
 * lui-même — rien ne part vers l'acheteur (décision du 21.09.2026) —, donc ils s'annulent. « Pas encore »,
 * « Planifier la visite » et les deux gestes d'une correction écrivent tout de suite : le premier ne fait
 * rien sortir, les autres sont des formulaires validés. Après « Intéressé », la barre d'annulation offre
 * « Planifier la visite » sous la touche V (`TOUCHE_SUITE`), que sa région vivante annonce ; Échap referme
 * les motifs d'un refus, même depuis le bouton « Pas intéressé ».
 *
 * ⚠ Un match qu'un geste fait sortir est MASQUÉ localement (`masques`) jusqu'à ce que les données le
 * reflètent : la valeur est `null` tant que l'écriture n'a pas fini, puis l'heure où elle a fini. Une
 * lecture COMMENCÉE après cette heure fait foi — un reporté reparaît sous « Reportés », un match
 * encore à traiter reparaît à sa place. Sans cette levée, un reporté restait caché jusqu'au
 * rechargement. Une correction validée ou ignorée sort de même : ce sont ses refus qui sont masqués.
 *
 * ⚠ Lot 2 : une ligne « Marché » par acheteur (`cleSelection`) suit les biens en mandat dans l'ordre de
 * lecture. Choisie, elle charge ses biens et montre la sélection à droite ; `E` y consigne les biens
 * cochés comme proposés, en UN geste. `P` et `X` n'y font rien : ils visent UN match, et la ligne en
 * porte plusieurs. Un « Écarter » dans la sélection ne déplace pas la sélection du fil : le focus passe à la
 * case du bien voisin.
 *
 * ⚠ Lot C : l'en-tête de chaque bien en mandat est une ligne (`cleBien`) ; choisi, il montre « Qui pour ce
 * bien ? » (`FilQuiPourCeBien`). Il n'est jamais choisi D'OFFICE : on arrive sur le premier match. À score égal,
 * ce qui porte un signal « pourquoi maintenant » passe devant (`aUnSignal`, mesuré à l'heure de la lecture).
 *
 * ⚠ Les cases cochées d'office sont FIGÉES par acheteur (`coches`), et le focus perdu sous un élément
 * démonté revient à la ligne courante (`reprendreFocus`) : voir les deux blocs plus bas.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useEcranActif } from '@/hooks/useEcranActif'
import { modaleOuverte } from '@/lib/modaleOuverte'
import { useArrivee } from '@/hooks/useArrivee'
import { avecArrivee } from '@/lib/jetonArrivee'
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execRepondre, execSnooze, execWake,
  type CorrectionGeste, type GesteContext, type ReponseAcheteur, type VisiteAPlanifier,
} from '@/lib/matchingGestes'
import { useMatchingFil, useRecherchesActives, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/lib/matchingAnnulation'
import {
  bienDeCle, cleSelection, construireFil, construireSelections, contactDeSelection, horsVente, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
import { cleAttente, construireAConclure, construireAttente, idsOnglets, ongletValide, type FilOnglet } from './filBoucle'
import { estArriveeFil, ligneCourante, lireArrivee } from './filLiens'
import { construireCorrections, filtrerCorrections, type Correction, type CorrectionChangement } from './filApprendre'
import { ecranDuFil } from './filDemarrage'
import { compatiblesDuFil } from './filQuiPour'
import { aUnSignal } from './filSignaux'
import { FilStyleLignes } from './filAtomes'
import FilAnnulation from './FilAnnulation'
import FilConclure from './FilConclure'
import FilCorrection from './FilCorrection'
import FilEnTete from './FilEnTete'
import FilListe from './FilListe'
import FilListeBoucle from './FilListeBoucle'
import FilOnglets from './FilOnglets'
import FilPanneau from './FilPanneau'
import FilQuiPourCeBien from './FilQuiPourCeBien'
import FilRetours from './FilRetours'
import FilSelection from './FilSelection'
import MatchingFirstRun from './MatchingFirstRun'

const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const COLONNES = 'minmax(300px, 380px) minmax(0, 1fr)'
const nomComplet = (m: FilMatch): string => `${m.acheteur.prenom} ${m.acheteur.nom}`
/**
 * La touche du second geste de la barre d'annulation (« Planifier la visite », après « Intéressé ») : la barre
 * est un overlay en fin de DOM, qu'on n'atteint sinon au clavier qu'en traversant tout le panneau. V comme
 * dans « À conclure », où la même touche mène à la date de la visite.
 */
const TOUCHE_SUITE = 'V'

/** L'état vide des deux onglets de la boucle ; « À proposer » garde le sien, et ses deux chemins. */
const VIDE_BOUCLE = {
  enAttente: { titre: 'fil.vide.attenteTitre', texte: 'fil.vide.attenteTexte' },
  aConclure: { titre: 'fil.vide.conclureTitre', texte: 'fil.vide.conclureTexte' },
} as const

/** Ce qu'un geste différé fait d'autre que masquer ses matchs. */
interface OptionsGeste {
  /**
   * La LIGNE du fil qu'il fait sortir — par défaut, celle du premier match. `null` : aucune ; un bien d'une
   * sélection du marché ou de « Retours de … » n'est pas une ligne, et la sélection du fil ne bouge pas.
   */
  ligneQuiSort?: string | null
  /** Défait, sur un échec ou une annulation, ce qu'il a retiré d'autre (les cases cochées d'une sélection). */
  rendre?: () => void
  /** Un second geste offert par la barre : l'écriture part tout de suite, puis `apres`, les données relues. */
  suite?: { libelle: string; apres: () => void }
}

interface BarreAnnulation {
  id: string; texte: string; annuler: () => void; action?: { libelle: string; touche: string; faire: () => void }
}

/** Un match masqué par un geste redevient visible quand une lecture COMMENCÉE après l'écriture le dit. */
function visibleSelon(masques: ReadonlyMap<string, number | null>, id: string, chargeLe: number): boolean {
  const fin = masques.get(id)
  // ⚠ `>=` et non `>` : `rafraichir` lance la lecture dans le même tour que la fin de l'écriture, donc
  // souvent dans la même milliseconde. Une lecture partie AVANT est annulée par cette invalidation.
  return fin === undefined || (fin !== null && chargeLe >= fin)
}

/** Ce que les deux gestes d'une correction lisent d'elle. */
const versCorrectionGeste = (c: Correction): CorrectionGeste => ({
  contactId: c.acheteur.id, nom: `${c.acheteur.prenom} ${c.acheteur.nom}`, rechercheId: c.rechercheId, motif: c.motif,
  refusIds: c.refus.map((m) => m.id),
})

export default function MatchingFil({ dark, onOpenRecherche, montre = true }: {
  dark: boolean
  onOpenRecherche?: () => void
  /** Sa page du pager est celle qu'on regarde (`MatchingPage`) ; hors du pager, toujours. */
  montre?: boolean
}) {
  const { t } = useTranslation('matching')
  const sp = crmPalette(dark)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const {
    isLoading, isError, aDesDonnees, erreurLe, matchs, selections, boucle, relances, historique, chargeLe, rafraichir,
  } = useMatchingFil()
  const recherches = useRecherchesActives()

  // Les liens d'arrivée (`filLiens.ts`, conception de D1 §4) : `?contact=` (le fil filtré sur l'acheteur),
  // `?annonce=p:<uuid>` (filtré sur le bien), `?onglet=`, `?ligne=<clé>`, `?attente=<contact>`. Une arrivée
  // s'applique UNE fois par navigation (`useArrivee`) : revenir sur l'onglet, un retour arrière, une éviction au-delà
  // de six écrans vivants ou un rechargement ne la rejouent pas ; un nouveau clic sur le même lien, si. ⛔ L'adresse
  // n'est jamais réécrite.
  const arrivee = useMemo(() => lireArrivee(params), [params])
  const {
    neuve: arriveeNeuve, aAppliquer: arriveeAAppliquer, id: arriveeId, marquerAppliquee,
  } = useArrivee('fil.arrivee', estArriveeFil(params))
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', SANS_FILTRE)
  // L'onglet aussi (lot B) : ce qu'on y relit peut venir d'un schéma antérieur, d'où `ongletValide`.
  const [ongletRetenu, setOngletRetenu] = useTabScopedState<FilOnglet>('fil.onglet', 'aProposer')
  // ⚠ Une arrivée NEUVE l'emporte sur les filtres et l'onglet retenus — même règle et même mécanique que le pager
  // (`MatchingPage`) : lue au rendu, rangée dans l'onglet par un effet, qui attend la pile d'onglets (`useArrivee`).
  const filtres = arriveeNeuve && arrivee.filtres ? arrivee.filtres : filtresRetenus
  const onglet = ongletValide(arriveeNeuve && arrivee.onglet ? arrivee.onglet : ongletRetenu)
  useEffect(() => {
    if (!arriveeAAppliquer) return
    if (arrivee.filtres) setFiltres(arrivee.filtres)
    if (arrivee.onglet) setOngletRetenu(arrivee.onglet)
    marquerAppliquee()
  }, [arriveeAAppliquer, arrivee, setFiltres, setOngletRetenu, marquerAppliquee])
  const [choix, setChoix] = useState<string | null>(null)
  // La ligne d'une arrivée neuve est le premier choix ; absente de la première lecture complète, elle est abandonnée
  // (plus bas). Posée PENDANT LE RENDU, comme `coches`, une fois par arrivée : celle d'un nouveau clic sur le même lien,
  // l'écran déjà monté, remplace la précédente.
  const [ligneArrivee, setLigneArrivee] = useState<{ id: string; ligne: string | null; resolue: boolean } | null>(null)
  if (arriveeNeuve && arriveeId && ligneArrivee?.id !== arriveeId) {
    setLigneArrivee({ id: arriveeId, ligne: arrivee.ligne, resolue: arrivee.ligne == null })
    setChoix(arrivee.ligne)
  }

  const [masques, setMasques] = useState<ReadonlyMap<string, number | null>>(() => new Map())
  const [coches, setCoches] = useState<Readonly<Record<string, readonly string[]>>>({})
  const [limites, setLimites] = useState<Readonly<Record<string, number>>>({})
  const [annulation, setAnnulation] = useState<BarreAnnulation | null>(null)
  /** Le bien dont on choisit le motif de refus (« Retours de … », « À conclure »). */
  const [motifsPour, setMotifsPour] = useState<string | null>(null)
  /** Le bien dont la visite vient d'être demandée depuis la barre d'annulation : sa date prend le focus. */
  const [visitePour, setVisitePour] = useState<string | null>(null)
  /** Une visite ou une correction s'écrit : leurs boutons se grisent. */
  const [occupe, setOccupe] = useState(false)
  const [registre] = useState(() => new PendingRegistry())
  const racine = useRef<HTMLDivElement>(null)
  // Les onglets désignent leur panneau (`aria-controls`), et lui se nomme par l'onglet actif.
  const baseIds = useId()
  const ids = idsOnglets(baseIds)
  const reveils = useRef(new Set<string>())
  /** « Pas encore » en vol, par match : un second appui ne repousse pas la relance deux fois. */
  const reports = useRef(new Set<string>())

  // L'agent n'a pas annulé : ce qui attend part quand le fil se ferme.
  useEffect(() => () => registre.flushAll(), [registre])

  const ctx = useMemo<GesteContext | null>(() => (profile?.agency_id
    ? { agencyId: profile.agency_id, userId: profile.id ?? user?.id ?? '' }
    : null), [profile, user])

  const visibles = useMemo(() => matchs.filter((m) => visibleSelon(masques, m.id, chargeLe)), [matchs, masques, chargeLe])
  const visiblesBoucle = useMemo(() => boucle.filter((m) => visibleSelon(masques, m.id, chargeLe)), [boucle, masques, chargeLe])
  // Les acheteurs de la boucle comptent aussi, même sans rien à proposer ; le filtre Bien ne vise que les
  // biens en mandat (`optionsFiltres`). Un mandat qui n'est plus en vente n'y entre que par la boucle : ses matchs à
  // proposer ne sont plus des lignes, un choix qui ne mènerait qu'à eux ne mènerait à rien.
  const options = useMemo(() => optionsFiltres(
    [...matchs.filter((m) => !horsVente(m.bien)), ...boucle.filter((m) => !m.bien.marche)], selections,
    boucle.filter((m) => m.bien.marche).map((m) => m.acheteur),
  ), [matchs, boucle, selections])
  // ⚠ CE QUE L'ONGLET RESTITUE PEUT ÊTRE PÉRIMÉ OU MALFORMÉ : un schéma antérieur, une écriture
  // interrompue. `texte` redevient une chaîne, `bienId`/`acheteurId` une chaîne ou `null` — mais un id
  // qui ne correspond plus à AUCUN match connu (bien vendu, acheteur supprimé, ou son SEUL match
  // proposé à l'instant) N'EST PAS effacé : un filtre qu'on efface tout seul rouvre le fil à tout le
  // monde sans le dire. `construireFil` ne trouve alors rien, et c'est l'état « Rien ne correspond à
  // ces filtres » qui doit paraître — jamais la liste entière.
  const filtresValides = useMemo<FilFiltres>(() => ({
    texte: typeof filtres.texte === 'string' ? filtres.texte : '',
    bienId: typeof filtres.bienId === 'string' ? filtres.bienId : null,
    acheteurId: typeof filtres.acheteurId === 'string' ? filtres.acheteurId : null,
  }), [filtres])
  // À score égal, ce qui porte un signal passe devant (lot C) ; mesuré à l'heure de la lecture, stable d'un rendu à l'autre.
  const vue = useMemo(
    () => construireFil(visibles, filtresValides, chargeLe, (m) => aUnSignal(m, chargeLe)),
    [visibles, filtresValides, chargeLe],
  )
  const selectionsVues = useMemo(() => construireSelections(selections, filtresValides), [selections, filtresValides])
  const toutesCorrections = useMemo(() => construireCorrections(visiblesBoucle), [visiblesBoucle])
  const corrections = useMemo(() => filtrerCorrections(toutesCorrections, filtresValides), [toutesCorrections, filtresValides])
  const attentes = useMemo(
    () => construireAttente(visiblesBoucle, relances, filtresValides, chargeLe),
    [visiblesBoucle, relances, filtresValides, chargeLe],
  )
  const conclure = useMemo(() => construireAConclure(visiblesBoucle, filtresValides), [visiblesBoucle, filtresValides])
  // Le compte d'un onglet est celui de ses LIGNES (conception du fil, §3.1).
  const comptes: Record<FilOnglet, number> = {
    aProposer: corrections.length + vue.compte + selectionsVues.length,
    enAttente: attentes.length,
    aConclure: conclure.length,
  }
  const ordre = useMemo(() => (
    onglet === 'enAttente' ? attentes.map((a) => cleAttente(a.acheteur.id))
      : onglet === 'aConclure' ? conclure.map((m) => m.id)
        : [...corrections.map((c) => c.cle), ...vue.ordre, ...selectionsVues.map((s) => cleSelection(s.acheteur.id))]
  ), [onglet, attentes, conclure, corrections, vue.ordre, selectionsVues])
  // ⚠ L'ARRIVÉE SE RÉSOUT UNE FOIS, à la première lecture complète du fil. Une ligne demandée absente (déjà traitée,
  // hors du filtre) est ABANDONNÉE, pas attendue — une clé absente ne choisit rien (conception de D1 §4) : gardée en
  // choix, elle reprenait la sélection, et le focus, dès qu'un filtre élargi la faisait paraître. Posé PENDANT LE
  // RENDU, comme `coches`, et une fois par arrivée : dans un effet, `react-hooks/set-state-in-effect` le refuse.
  if (ligneArrivee && !ligneArrivee.resolue && aDesDonnees && !isLoading) {
    const { ligne } = ligneArrivee
    setLigneArrivee({ ...ligneArrivee, resolue: true })
    if (ligne && !ordre.includes(ligne)) setChoix((c) => (c === ligne ? null : c))
  }
  const filtreActif = Boolean(filtresValides.bienId || filtresValides.acheteurId || filtresValides.texte)
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre, onglet) cède la place à la première restante —
  // la première LIGNE À TRAITER, pas l'en-tête d'un bien (« Qui pour ce bien ? », lot C) : on arrive sur un match.
  const courant = ligneCourante(choix, ordre)
  // Le panneau de la ligne courante : une seule de ces valeurs est posée.
  const correction = onglet === 'aProposer' && courant ? corrections.find((c) => c.cle === courant) ?? null : null
  const contactSelection = onglet === 'aProposer' && courant ? contactDeSelection(courant) : null
  // « Qui pour ce bien ? » : l'en-tête d'un bien, choisi.
  const bienQuiPour = onglet === 'aProposer' && courant ? bienDeCle(courant) : null
  const groupeQuiPour = bienQuiPour ? vue.groupes.find((g) => g.bien.id === bienQuiPour) ?? null : null
  const match = onglet === 'aProposer' && courant && !contactSelection && !correction && !bienQuiPour
    ? visibles.find((m) => m.id === courant) ?? null : null
  const resumeSelection = contactSelection ? selectionsVues.find((s) => s.acheteur.id === contactSelection) ?? null : null
  const attente = onglet === 'enAttente' && courant ? attentes.find((a) => cleAttente(a.acheteur.id) === courant) ?? null : null
  const aConclure = onglet === 'aConclure' && courant ? conclure.find((m) => m.id === courant) ?? null : null
  // Ses acquéreurs compatibles (lot E1, décision 13a) : ses matchs que le fil connaît, comptés comme sur les fiches
  // (`STATUTS_COMPATIBLES`) — à proposer (reportés et revenus compris), proposés, intéressés, en visite. Ses refus, que la
  // boucle porte pour « Apprendre », sortent du compte et de la liste.
  const compatibles = useMemo(
    () => (bienQuiPour ? compatiblesDuFil([...visibles, ...visiblesBoucle], bienQuiPour) : []),
    [bienQuiPour, visibles, visiblesBoucle],
  )

  const limite = contactSelection ? (limites[contactSelection] ?? PAS_SELECTION) : PAS_SELECTION
  const selection = useSelectionMarche(contactSelection, limite)
  const matchsSelection = useMemo(
    // ⛔ En défense : jamais le bien d'un autre acheteur sous le nom de celui-ci (`useSelectionMarche`
    // ne garde déjà ses données provisoires que pour le même acheteur).
    () => selection.matchs
      .filter((m) => m.acheteur.id === contactSelection && visibleSelon(masques, m.id, selection.chargeLe))
      // À score égal, un bien à signal passe devant (lot C) ; le tri est stable : l'ordre de la base départage le reste.
      .sort((a, b) => b.score - a.score || Number(aUnSignal(b, selection.chargeLe)) - Number(aUnSignal(a, selection.chargeLe))),
    [selection.matchs, selection.chargeLe, masques, contactSelection],
  )
  // ⚠ LES CASES COCHÉES D'OFFICE SONT FIGÉES : calculées UNE fois par acheteur, sur sa première lecture
  // RÉELLE — ni pendant le squelette, ni sur les données provisoires d'un « Voir plus » —, rangées dans
  // `coches` et jamais recalculées. Recalculées à chaque rendu, elles recochaient ce que l'agent venait
  // de décocher dès que la liste bougeait, cochaient un bien arrivé par « Voir 20 de plus », et
  // recochaient tout après une proposition. Posées PENDANT LE RENDU (l'ajustement d'état que React documente),
  // gardées par `coches[…] === undefined` donc une seule fois : un effet les poserait un rendu trop tard
  // — la liste paraîtrait un instant sans ses cases —, et `react-hooks/set-state-in-effect` le refuse.
  // ⚠ Figées aussi sur un CACHE : revenu à un acheteur après un remontage du fil, `coches` est vide et
  // la « première lecture réelle » peut être la liste gardée par TanStack (jusqu'à `gcTime`), relue
  // avant son actualisation. Assumé : un bien disparu depuis est filtré par `cochesSelection`, et un
  // bien devenu éligible entre-temps n'est simplement pas coché — jamais coché à tort.
  if (contactSelection && coches[contactSelection] === undefined
    && !selection.isLoading && !selection.isPlaceholderData && selection.aDesDonnees) {
    setCoches((c) => (c[contactSelection] !== undefined ? c : { ...c, [contactSelection]: precoches(matchsSelection) }))
  }
  const cochesSelection = useMemo(() => {
    if (!contactSelection) return []
    return (coches[contactSelection] ?? []).filter((id) => matchsSelection.some((m) => m.id === id))
  }, [contactSelection, coches, matchsSelection])

  // Lus APRÈS un `await` ou un minuteur, où la valeur du rendu qui a créé la fonction serait périmée.
  // Posés dans un effet : une ref écrite pendant le rendu est refusée par `react-hooks/refs`.
  const ordreRef = useRef(ordre)
  const courantRef = useRef(courant)
  useLayoutEffect(() => {
    ordreRef.current = ordre
    courantRef.current = courant
  })

  const focaliser = useCallback((id: string | null) => {
    const ligne = id ? racine.current?.querySelector<HTMLElement>(`[data-match="${CSS.escape(id)}"]`) : null
    if (ligne) ligne.focus()
    else racine.current?.focus()
  }, [])
  /** L'élément d'un bien dans le panneau (case d'une sélection, « Intéressé » d'un retour) ; `false` s'il n'est pas (ou plus) à l'écran. */
  const focaliserBien = useCallback((id: string): boolean => {
    const element = racine.current?.querySelector<HTMLElement>(`[data-bien="${CSS.escape(id)}"]`)
    element?.focus()
    return element != null
  }, [])
  // La ligne d'un lien d'arrivée prend le focus UNE fois par arrivée, à sa résolution : le fil défile jusqu'à elle et son
  // clavier est prêt. Ce focus unique se dépense dans tous les cas, et ne se prend que PERDU (`<body>`, la racine) :
  // posé ailleurs — un champ de filtre, pourtant dans la racine —, il reste à l'agent, comme dans `reprendreFocus`, et
  // la ligne reste choisie ; sa frappe suivante partirait sinon sur la ligne (dans « En attente », `p` écrit aussitôt
  // « Pas encore »). Abandonnée ou plus choisie, la ligne ne le prend pas. ⛔ Un écran caché ne le dépense pas
  // (`useEcranActif`) : il l'attend jusqu'à être montré.
  const ecranActif = useEcranActif()
  /** L'arrivée dont la ligne a déjà eu son focus unique, pris ou laissé. */
  const focusDepense = useRef<string | null>(null)
  useEffect(() => {
    if (!ligneArrivee?.resolue || !ecranActif || focusDepense.current === ligneArrivee.id) return
    focusDepense.current = ligneArrivee.id
    const { ligne } = ligneArrivee
    if (!ligne || choix !== ligne || !ordre.includes(ligne)) return
    const actif = document.activeElement
    if (actif == null || actif === document.body || actif === racine.current) focaliser(ligne)
  }, [ligneArrivee, ecranActif, ordre, choix, focaliser])

  // ⛔ LE CLAVIER DU FIL VIT SUR SA RACINE : un focus retombé sur `<body>` le rend sourd. Or une ligne ou
  // une case peut être démontée SOUS le focus — la ligne « Marché » qu'une proposition complète retire, un
  // bien qu'une actualisation fait sortir —, et aucun navigateur ne rend alors le focus (Chrome émet un
  // `blur`, sur un élément encore attaché ; Firefox rien). D'où le dernier élément focalisé DANS le fil, relu
  // après chaque rendu et à chaque sortie : démonté sous un focus perdu, la ligne courante le reprend ;
  // encore attaché et actif, c'est l'agent qui est allé ailleurs, et on l'oublie — sans quoi un démontage
  // plus tardif ramènerait le focus dans un fil qu'il a quitté.
  // ⚠ Le fil ne porte plus rien dans `<body>` depuis le retrait de sa feuille d'envoi (21.09.2026) : tout
  // `focus` et `blur` qui remonte ici vient de son DOM. Une portée ajoutée demain ferait remonter par
  // l'arbre React les siens, et devrait les filtrer (`racine.contains`).
  const dernierFocus = useRef<HTMLElement | null>(null)
  const reprendreFocus = useCallback(() => {
    const el = dernierFocus.current
    const boite = racine.current
    if (!el || !boite) return
    const actif = document.activeElement
    if (actif && boite.contains(actif)) return
    dernierFocus.current = null
    // Démonté, ou désactivé sous le focus (un navigateur peut alors le rendre à `<body>`).
    const perdu = !el.isConnected || el.matches(':disabled')
    if (perdu && (actif == null || actif === document.body)) focaliser(courantRef.current)
  }, [focaliser])
  // Après `courantRef` (effet déclaré plus haut, donc joué avant) : la ligne courante est celle de CE rendu.
  useLayoutEffect(() => { reprendreFocus() })

  const montrer = useCallback((ids: readonly string[]) => {
    setMasques((s) => {
      if (!ids.some((id) => s.has(id))) return s
      const n = new Map(s)
      for (const id of ids) n.delete(id)
      return n
    })
  }, [])

  /** Une ligne sort du fil : la sélection passe à la suivante, ou à la précédente si c'était la dernière. */
  // Après un geste, la ligne suivante À TRAITER — jamais l'en-tête d'un bien (« Qui pour ce bien ? », lot C) : on
  // enchaîne les matchs sans s'arrêter sur un panneau qu'on n'a pas demandé. Sans suivante, la précédente.
  const ceder = useCallback((id: string): string | null => {
    const liste = ordreRef.current
    const i = liste.indexOf(id)
    const aTraiter = (k: string): boolean => bienDeCle(k) == null
    const suivant = liste.slice(i + 1).find(aTraiter) ?? liste.slice(0, Math.max(i, 0)).reverse().find(aTraiter) ?? null
    setChoix(suivant)
    return suivant
  }, [])

  /**
   * Un geste différé sur un ou plusieurs matchs : ils sortent tout de suite, l'écriture part à la fin de la
   * fenêtre d'annulation. Plusieurs matchs : les biens cochés d'une sélection, proposés en UN geste — une
   * seule écriture, une seule annulation pour tous.
   */
  const differer = useCallback((
    ms: readonly FilMatch[], texte: string, ecrire: (c: GesteContext) => Promise<unknown>, options: OptionsGeste = {},
  ) => {
    const premier = ms[0]
    if (!ctx || !premier) return
    const ids = ms.map((m) => m.id)
    const ligne = options.ligneQuiSort === undefined ? premier.id : options.ligneQuiSort
    if (ligne) focaliser(ceder(ligne))
    setMasques((s) => { const n = new Map(s); for (const id of ids) n.set(id, null); return n })
    // `flushNow` rend `null` après un échec comme après une réussite : la suite lit ce drapeau.
    let ecrit = false
    const poignee = registre.defer(async () => { await ecrire(ctx); ecrit = true; return null }, {
      onSettled: () => {
        // Après un échec, `onError` a déjà rendu les matchs : rien à dater.
        const fin = Date.now()
        setMasques((s) => {
          if (!ids.some((id) => s.has(id))) return s
          const n = new Map(s)
          for (const id of ids) if (n.has(id)) n.set(id, fin)
          return n
        })
        void rafraichir()
      },
      // Le geste n'a pas eu lieu : les biens reviennent comme ils étaient, cases comprises.
      onError: () => { montrer(ids); options.rendre?.(); toast.error(t('fil.erreurGeste')) },
    })
    const { suite } = options
    setAnnulation({
      id: premier.id,
      texte,
      action: suite && {
        libelle: suite.libelle,
        touche: TOUCHE_SUITE,
        faire: () => {
          setAnnulation(null)
          // L'écriture part tout de suite ; un échec a déjà été dit (`onError`), et rien ne suit.
          void poignee.flushNow().then(() => (ecrit ? rafraichir().then(suite.apres) : undefined))
        },
      },
      annuler: () => {
        poignee.cancel()
        montrer(ids)
        setAnnulation(null)
        options.rendre?.()
        if (ligne) setChoix(ligne)
        // Le bien (sa case, son bouton) ou la ligne revient au rendu suivant : le focus le suit après lui.
        setTimeout(() => { if (!focaliserBien(premier.id)) focaliser(ligne ?? courantRef.current) }, 0)
      },
    })
  }, [ctx, ceder, registre, rafraichir, montrer, focaliser, focaliserBien, toast, t])

  // « Annuler » disparaît AVANT que l'écriture parte : passé ce délai, il n'annulerait plus rien.
  useEffect(() => {
    if (!annulation) return
    const minuteur = setTimeout(() => setAnnulation((e) => (e === annulation ? null : e)), UNDO_WINDOW_MS - 400)
    return () => clearTimeout(minuteur)
  }, [annulation])

  // « Je l'ai proposé » (E) : l'agent a présenté le bien lui-même ; le CRM consigne et pose la relance.
  const proposer = useCallback((m: FilMatch) => {
    differer([m], t('fil.propose', { prenom: m.acheteur.prenom }), (c) => {
      const { acheteur, bien } = versGeste(m)
      return execProposer(c, acheteur, bien)
    })
  }, [differer, t])
  const plusTard = useCallback((m: FilMatch) => {
    differer([m], t('fil.reporte', { nom: nomComplet(m) }), (c) => execSnooze(c, versGeste(m).acheteur))
  }, [differer, t])
  const ecarter = useCallback((m: FilMatch) => {
    differer([m], t('fil.ecarte', { nom: nomComplet(m) }), (c) => execDismiss(c, versGeste(m).acheteur))
  }, [differer, t])
  const ecarterDeSelection = useCallback((m: FilMatch) => {
    // Sans contexte d'agent, `differer` n'écrira rien : ni la case ni le focus ne doivent bouger.
    if (!ctx) return
    // Le bouton cliqué part avec son bien : le focus passe AVANT à la case voisine (la suivante, sinon la
    // précédente, sinon la ligne du fil), qui, elle, reste montée — sinon il tombait sur `<body>`.
    const i = matchsSelection.findIndex((x) => x.id === m.id)
    const voisin = matchsSelection[i + 1] ?? matchsSelection[i - 1] ?? null
    if (!voisin || !focaliserBien(voisin.id)) focaliser(courantRef.current)
    const contact = m.acheteur.id
    const etaitCoche = cochesSelection.includes(m.id)
    setCoches((c) => {
      const actuels = c[contact]
      return actuels ? { ...c, [contact]: actuels.filter((id) => id !== m.id) } : c
    })
    differer([m], t('fil.ecarteSelection', { titre: m.bien.titre, prenom: m.acheteur.prenom }),
      (c) => execDismiss(c, versGeste(m).acheteur), {
        ligneQuiSort: null,
        rendre: () => {
          if (!etaitCoche) return
          setCoches((c) => {
            const actuels = c[contact] ?? []
            return actuels.includes(m.id) ? c : { ...c, [contact]: [...actuels, m.id] }
          })
        },
      })
  }, [ctx, differer, t, matchsSelection, cochesSelection, focaliser, focaliserBien])
  const reactiver = useCallback((m: FilMatch) => {
    // La ligne de journal nomme l'agence et l'agent : sans contexte d'agent, rien ne s'écrit. Un double clic ne
    // réveille pas deux fois (deux écritures, deux annulations de rappel, deux lignes de journal).
    if (!ctx || reveils.current.has(m.id)) return
    reveils.current.add(m.id)
    // ⚠ `rafraichir` rend la promesse d'invalidation : `.then(rafraichir)` l'ADOPTE, donc `.finally`
    // n'ouvre le verrou qu'une fois le rafraîchissement retombé — pas dès l'écriture de `execWake`.
    // Sans ça, un second clic pendant le rafraîchissement encore en vol rouvrait une seconde écriture.
    execWake(ctx, versGeste(m).acheteur).then(rafraichir)
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reveils.current.delete(m.id))
  }, [ctx, rafraichir, toast, t])

  const cocher = useCallback((id: string, coche: boolean) => {
    if (!contactSelection) return
    setCoches((c) => {
      const actuels = c[contactSelection] ?? []
      return { ...c, [contactSelection]: coche ? [...new Set([...actuels, id])] : actuels.filter((x) => x !== id) }
    })
  }, [contactSelection])

  // « J'ai proposé N biens » (E sur une ligne « Marché ») : les biens cochés sortent de la sélection, UNE
  // écriture pour tous (`execProposerSelection` : un deal, une ligne de journal, une relance), annulable.
  const proposerSelection = useCallback(() => {
    // Sans contexte d'agent, `differer` n'écrira rien : les cases ne doivent pas se vider pour rien.
    if (!ctx || !resumeSelection || cochesSelection.length === 0) return
    const { acheteur } = resumeSelection
    const proposes = matchsSelection.filter((m) => cochesSelection.includes(m.id))
    if (proposes.length === 0) return
    const avant = cochesSelection
    // Décision : pas de recochage après une proposition. Effacer l'entrée rouvrait le pré-cochage, qui
    // aurait coché EN SILENCE les biens suivants ; l'agent choisit lui-même la prochaine.
    setCoches((c) => ({ ...c, [acheteur.id]: [] }))
    differer(proposes, t('fil.proposeSelection', { count: proposes.length, prenom: acheteur.prenom }),
      (c) => execProposerSelection(
        c,
        { id: acheteur.id, first: acheteur.prenom, last: acheteur.nom },
        proposes.map((m) => ({ matchId: m.id, score: m.score, bien: versGeste(m).bien })),
      ),
      { ligneQuiSort: null, rendre: () => setCoches((c) => ({ ...c, [acheteur.id]: avant })) })
  }, [ctx, resumeSelection, cochesSelection, matchsSelection, differer, t])

  /** Changer d'onglet : sa première ligne est choisie, les motifs ouverts se referment. */
  const choisirOnglet = useCallback((o: FilOnglet) => {
    setOngletRetenu(o)
    setChoix(null)
    setMotifsPour(null)
    setVisitePour(null)
  }, [setOngletRetenu])

  /**
   * « Intéressé » / « Pas intéressé » — la réponse de l'acheteur, consignée (§4.4), depuis « Retours de … »
   * ou « À conclure ». Dans « Retours de … », seule la réponse au DERNIER bien fait sortir la ligne de
   * l'acheteur ; sinon le focus passe AVANT au bien voisin, qui reste monté.
   */
  const repondre = useCallback((m: FilMatch, reponse: ReponseAcheteur) => {
    if (!ctx) return
    setMotifsPour(null)
    let ligneQuiSort: string | null = m.id
    if (onglet === 'enAttente') {
      const biens = attentes.find((a) => a.acheteur.id === m.acheteur.id)?.matchs ?? []
      const i = biens.findIndex((x) => x.id === m.id)
      const voisin = biens[i + 1] ?? biens[i - 1] ?? null
      if (voisin && voisin.id !== m.id) {
        if (!focaliserBien(voisin.id)) focaliser(courantRef.current)
        ligneQuiSort = null
      } else ligneQuiSort = cleAttente(m.acheteur.id)
    }
    const texte = reponse.genre === 'interested'
      ? t('fil.repondu.interesse', { prenom: m.acheteur.prenom, titre: m.bien.titre })
      : t('fil.repondu.refuse', { titre: m.bien.titre, motif: t(`fil.motifs.${reponse.motif}`) })
    differer([m], texte, () => execRepondre(versGeste(m).acheteur, reponse), {
      ligneQuiSort,
      // §4.4 : « Intéressé » propose tout de suite la visite — « À conclure », ce bien choisi, sa date prête.
      suite: reponse.genre === 'interested'
        ? { libelle: t('fil.repondu.planifier'), apres: () => { choisirOnglet('aConclure'); setChoix(m.id); setVisitePour(m.id) } }
        : undefined,
    })
  }, [ctx, onglet, attentes, focaliser, focaliserBien, differer, choisirOnglet, t])

  /**
   * « Pas encore » : rien ne sort du fil ; la relance de la proposition est repoussée de trois jours (§4.4).
   * `deja` : le bien a été répondu entre-temps, rien n'a été repoussé — pas de toast, la relecture le montre.
   */
  const pasEncore = useCallback((m: FilMatch) => {
    if (!ctx || reports.current.has(m.id)) return
    reports.current.add(m.id)
    const { acheteur, bien } = versGeste(m)
    execPasEncore(ctx, acheteur, bien)
      .then(({ deja }) => {
        if (!deja) toast.success(t('fil.repondu.pasEncore', { prenom: m.acheteur.prenom }))
        return rafraichir()
      })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reports.current.delete(m.id))
  }, [ctx, rafraichir, toast, t])

  /** Les motifs se referment : le focus revient au bien (son « Intéressé »), sinon à la ligne. */
  const fermerMotifs = useCallback(() => {
    const id = motifsPour
    setMotifsPour(null)
    if (id) setTimeout(() => { if (!focaliserBien(id)) focaliser(courantRef.current) }, 0)
  }, [motifsPour, focaliser, focaliserBien])

  /**
   * « Planifier la visite » (§4.5) : écrite tout de suite (un formulaire validé). La ligne sort d'« À
   * conclure », masquée jusqu'à la lecture qui le dit, comme après un geste différé.
   */
  const planifier = useCallback((m: FilMatch, visite: VisiteAPlanifier) => {
    if (!ctx || occupe) return
    setOccupe(true)
    const { acheteur, bien } = versGeste(m)
    execPlanifierVisite(ctx, acheteur, bien, visite)
      .then(({ deja }) => {
        // `deja` : un collègue a répondu entre-temps, rien n'a été planifié ; la relecture le montrera.
        if (!deja) {
          toast.success(t('fil.conclure.planifiee', { prenom: m.acheteur.prenom, date: format(new Date(visite.debut), 'dd.MM.yyyy HH:mm') }))
        }
        const fin = Date.now()
        setMasques((s) => new Map(s).set(m.id, fin))
        setVisitePour(null)
        focaliser(ceder(m.id))
        return rafraichir()
      })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => setOccupe(false))
  }, [ctx, occupe, ceder, focaliser, rafraichir, toast, t])

  /** Une correction validée ou ignorée sort de la liste : ses refus sont masqués jusqu'à la lecture qui les dit pris en compte. */
  const sortirCorrection = useCallback((c: Correction) => {
    const fin = Date.now()
    setMasques((s) => { const n = new Map(s); for (const m of c.refus) n.set(m.id, fin); return n })
    focaliser(ceder(c.cle))
  }, [ceder, focaliser])

  // « Ajuster la recherche » (§4.6) : UN appel au moteur, qui renote, pose et journalise — la seule clé
  // corrigée. Un échec laisse la correction à l'écran, et la même validation se rejoue.
  const ajuster = useCallback((c: Correction, changement: CorrectionChangement) => {
    if (occupe) return
    setOccupe(true)
    execAjusterRecherche(versCorrectionGeste(c), changement)
      .then(({ ecartes }) => {
        toast.success(ecartes > 0
          ? t('fil.corrections.fait', { prenom: c.acheteur.prenom, count: ecartes })
          : t('fil.corrections.faitAucun', { prenom: c.acheteur.prenom }))
        sortirCorrection(c)
        return rafraichir()
      })
      .catch(() => toast.error(t('fil.corrections.erreur')))
      .finally(() => setOccupe(false))
  }, [occupe, sortirCorrection, rafraichir, toast, t])
  const ignorer = useCallback((c: Correction) => {
    if (!ctx || occupe) return
    setOccupe(true)
    execIgnorerCorrection(ctx, versCorrectionGeste(c))
      .then(() => { toast.info(t('fil.corrections.ignoree')); sortirCorrection(c); return rafraichir() })
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => setOccupe(false))
  }, [ctx, occupe, sortirCorrection, rafraichir, toast, t])

  // « Apprendre » s'annonce UNE fois, où qu'on soit (décision 6 du plan du lot B) : une correction qui paraît
  // après le premier chargement — un deuxième refus pour un même motif vient d'être consigné.
  const correctionsConnues = useRef<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (!aDesDonnees) return
    const connues = correctionsConnues.current
    correctionsConnues.current = new Set(toutesCorrections.map((c) => c.cle))
    const nouvelle = connues ? toutesCorrections.find((c) => !connues.has(c.cle)) : undefined
    if (nouvelle) toast.info(t('fil.corrections.nouvelle', { prenom: nouvelle.acheteur.prenom }))
  }, [aDesDonnees, toutesCorrections, toast, t])

  // Un rafraîchissement en échec garde la liste chargée, et le dit UNE fois par échec.
  const echecSignale = useRef(0)
  useEffect(() => {
    if (!isError || !aDesDonnees || erreurLe === echecSignale.current) return
    echecSignale.current = erreurLe
    toast.error(t('fil.erreurRafraichir'))
  }, [isError, aDesDonnees, erreurLe, toast, t])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Déjà traité plus bas dans l'arbre : ←/→ des onglets, chiffres et Échap des motifs.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const cible = e.target as HTMLElement
    const fleche = e.key === 'ArrowDown' || e.key === 'ArrowUp'
    const caseACocher = cible instanceof HTMLInputElement && cible.type === 'checkbox'
    // ↑/↓ sur la case d'un bien parcourent les CASES de la sélection, pas le fil : descendre la liste des
    // biens au clavier changeait sinon d'acheteur. Aux extrémités, on reste sur place.
    if (fleche && caseACocher && cible.dataset.bien !== undefined) {
      e.preventDefault()
      // Les cases SEULES : « Intéressé » d'un retour porte aussi `data-bien` (le focus y revient).
      const cases = [...(racine.current?.querySelectorAll<HTMLElement>('input[type="checkbox"][data-bien]') ?? [])]
      cases[cases.indexOf(cible) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
      return
    }
    // Une case à cocher n'est pas une saisie POUR E SEULEMENT : E doit proposer depuis la case qu'on vient
    // de cocher. Toute autre touche y garde son sens natif.
    const saisie = cible instanceof HTMLInputElement ? !(caseACocher && e.key.toLowerCase() === 'e')
      : /^(TEXTAREA|SELECT)$/.test(cible.tagName)
    if (saisie || cible.isContentEditable) return
    // Échap referme les motifs d'un refus où que soit le focus dans le fil : leur groupe (`FilMotifs`) ne
    // l'entend que du dedans, et le focus reste souvent sur « Pas intéressé », qui les a ouverts. Il reste là.
    if (e.key === 'Escape') {
      if (motifsPour) { e.preventDefault(); setMotifsPour(null) }
      return
    }
    if (fleche) {
      if (!courant) return
      e.preventDefault()
      const i = ordre.indexOf(courant)
      const suivant = ordre[Math.min(ordre.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (!suivant) return
      setChoix(suivant)
      focaliser(suivant)
      return
    }
    // ⛔ La répétition automatique d'une touche tenue trierait une ligne par répétition.
    if (e.repeat) return
    const touche = e.key.toLowerCase()
    // Le second geste de la barre d'annulation l'emporte tant qu'elle est là : c'est elle qui l'affiche.
    if (annulation?.action && touche === annulation.action.touche.toLowerCase()) {
      e.preventDefault()
      annulation.action.faire()
      return
    }
    if (attente) {
      // Les touches visent le bien qui a le focus dans « Retours de … », sinon le premier.
      const id = cible.closest<HTMLElement>('[data-retour]')?.dataset.retour
      const m = attente.matchs.find((x) => x.id === id) ?? attente.matchs[0]
      if (!m) return
      if (touche === 'i') { e.preventDefault(); repondre(m, { genre: 'interested' }) }
      else if (touche === 'n') { e.preventDefault(); setMotifsPour(m.id) }
      else if (touche === 'p') { e.preventDefault(); pasEncore(m) }
      return
    }
    if (aConclure) {
      if (touche === 'v') { e.preventDefault(); racine.current?.querySelector<HTMLElement>('[data-visite-date]')?.focus() }
      else if (touche === 'n') { e.preventDefault(); setMotifsPour(aConclure.id) }
      return
    }
    // Une correction se valide par un BOUTON, jamais par une touche : elle renote toute une recherche.
    if (correction) return
    if (contactSelection) {
      if (touche === 'e' && cochesSelection.length > 0) { e.preventDefault(); proposerSelection() }
      return
    }
    if (!match) return
    if (touche === 'e') { e.preventDefault(); proposer(match) }
    else if (touche === 'p') { e.preventDefault(); plusTard(match) }
    else if (touche === 'x') { e.preventDefault(); ecarter(match) }
  }

  const enEchec = isError && !aDesDonnees
  // La page 0 (conception E1 §5.1) : la couverture, l'état « aucun match », ou le fil. `matchs` compte ce que le fil a
  // LU — à proposer, du marché, de la boucle —, avant masques et filtres : c'est l'agence qu'on juge, pas l'écran.
  const ecran = ecranDuFil(recherches, {
    chargement: isLoading, erreur: enEchec, matchs: matchs.length + selections.length + boucle.length,
  })
  const connu = ecran !== 'chargement' && ecran !== 'erreur'
  // ⛔ LE FOCUS D'OUVERTURE. Le clavier vit sur la racine, et le focus est PERDU quand le fil s'ouvre : la destination
  // cliquée part avec la page qu'on quitte, une page du pager devenue inerte rend le sien, et la puce d'onglet cliquée
  // reste dans l'écran qu'on cache — `aria-hidden` dès ce rendu, alors que le navigateur ne rend le focus à `<body>`
  // qu'au suivant. Sans ce focus, le fil resterait sourd jusqu'au premier clic. La racine le prend donc quand le fil
  // est montré — son écran, sa page du pager — et à chaque arrivée neuve, perdu seulement ; jamais sous une modale
  // (`modaleOuverte`), où E, P et X agiraient sur un match qu'on ne voit pas. La ligne d'une arrivée le reprend ensuite
  // à la racine. `ecran` : la couverture n'a pas de racine, le fil qui lui succède la prend. `preventScroll` : la
  // racine ne fait rien défiler.
  useEffect(() => {
    const boite = racine.current
    if (!ecranActif || !montre || !boite || modaleOuverte()) return
    const actif = document.activeElement
    if (actif == null || actif === document.body || actif.closest('[inert], [aria-hidden="true"]')) {
      boite.focus({ preventScroll: true })
    }
  }, [ecranActif, montre, arriveeId, ecran])
  // Les reportés vivent dans « À proposer » : ils le gardent ouvert, même sans ligne à traiter.
  const ongletVide = comptes[onglet] === 0 && (onglet !== 'aProposer' || vue.reportes.length === 0)
  const rienDuTout = !filtreActif && vue.reportes.length === 0
    && comptes.aProposer + comptes.enAttente + comptes.aConclure === 0
  const avecOnglets = connu && !rienDuTout
  const etatAProposer = (
    <Etat sp={sp} titre={t('fil.vide.titre')} texte={t('fil.vide.texte')}
      action={{ libelle: t('fil.vide.contacts'), faire: () => navigate('/dashboard/contacts') }}
      secondaire={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
  )
  const panneau = attente ? (
    <FilRetours sp={sp} attente={attente} motifsPour={motifsPour}
      onInteresse={(m) => repondre(m, { genre: 'interested' })}
      onPasInteresse={(m) => setMotifsPour((x) => (x === m.id ? null : m.id))}
      onMotif={(m, motif, note) => repondre(m, { genre: 'rejected', motif, note })}
      onFermerMotifs={fermerMotifs} onPasEncore={pasEncore}
      onVoirContact={() => navigate(`/dashboard/contacts/${attente.acheteur.id}`)} />
  ) : aConclure ? (
    <FilConclure sp={sp} m={aConclure} motifsOuverts={motifsPour === aConclure.id} occupe={occupe}
      focusDate={visitePour === aConclure.id}
      onPlanifier={(visite) => planifier(aConclure, visite)}
      onPasInteresse={() => setMotifsPour((x) => (x === aConclure.id ? null : aConclure.id))}
      onMotif={(motif, note) => repondre(aConclure, { genre: 'rejected', motif, note })}
      onFermerMotifs={fermerMotifs}
      onVoirBien={() => navigate(`/dashboard/listings/${aConclure.bien.id}`)}
      onVoirContact={() => navigate(`/dashboard/contacts/${aConclure.acheteur.id}`)} />
  ) : correction ? (
    <FilCorrection sp={sp} correction={correction} occupe={occupe}
      onAjuster={(changement) => ajuster(correction, changement)} onIgnorer={() => ignorer(correction)}
      onVoirContact={() => navigate(`/dashboard/contacts/${correction.acheteur.id}`)} />
  ) : contactSelection && resumeSelection ? (
    <FilSelection sp={sp} resume={resumeSelection} matchs={matchsSelection} coches={cochesSelection} maintenant={selection.chargeLe}
      aPlus={selection.aPlus} isLoading={selection.isLoading} isError={selection.isError}
      aDesDonnees={selection.aDesDonnees} isFetching={selection.isFetching}
      onCocher={cocher} onEcarter={ecarterDeSelection} onProposer={proposerSelection}
      onVoirPlus={() => setLimites((l) => ({ ...l, [contactSelection]: limite + PAS_SELECTION }))}
      onReessayer={() => { void selection.refetch() }}
      onVoirContact={() => navigate(`/dashboard/contacts/${contactSelection}`)} />
  ) : groupeQuiPour ? (
    <FilQuiPourCeBien sp={sp} bien={groupeQuiPour.bien} compatibles={compatibles} maintenant={chargeLe}
      peutOuvrir={(id) => ordre.includes(id)} onChoisir={(id) => { setChoix(id); focaliser(id) }}
      onVoirBien={() => navigate(`/dashboard/listings/${groupeQuiPour.bien.id}`)}
      onVoirContact={(id) => navigate(`/dashboard/contacts/${id}`)} />
  ) : match ? (
    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)} maintenant={chargeLe}
      onProposer={() => proposer(match)}
      onPlusTard={() => plusTard(match)} onEcarter={() => ecarter(match)}
      onVoirBien={() => navigate(`/dashboard/listings/${match.bien.id}`)}
      onVoirContact={() => navigate(`/dashboard/contacts/${match.acheteur.id}`)} />
  ) : (
    <Etat sp={sp} titre={onglet === 'aProposer' && comptes.aProposer === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
  )
  // La couverture remplace la page 0 ENTIÈRE, en-tête compris : il n'y a encore rien à filtrer. Son bouton ouvre la
  // création d'un contact : la page Contacts l'ouvre sur cette arrivée, une fois par navigation (`useArrivee`).
  if (ecran === 'couverture') return <MatchingFirstRun onAjouterAcheteur={() => navigate('/dashboard/contacts?nouveau=1', avecArrivee())} />
  return (
    <div ref={racine} tabIndex={-1} onKeyDown={onKeyDown}
      onFocus={(e) => { dernierFocus.current = e.target }}
      onBlur={() => { setTimeout(reprendreFocus, 0) }} style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', outline: 'none', background: sp.frameBg, color: sp.ink,
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <FilStyleLignes sp={sp} />
      <FilEnTete sp={sp} filtres={filtresValides} options={options} onFiltres={setFiltres} />
      {avecOnglets && <FilOnglets sp={sp} onglet={onglet} comptes={comptes} ids={ids} onChoisir={choisirOnglet} />}
      {/* Le panneau des onglets quand ils sont là : un seul, qui ne monte que le contenu de l'actif. */}
      <div role={avecOnglets ? 'tabpanel' : undefined} id={avecOnglets ? ids.panneau : undefined}
        aria-labelledby={avecOnglets ? ids.onglet(onglet) : undefined}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {ecran === 'chargement' ? <Squelette sp={sp} />
          // « Réessayer » relit le fil ET les recherches actives, rangées sous son préfixe.
          : ecran === 'erreur' ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois proposé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && ongletVide ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : ecran === 'sansMatch' ? (
              <Etat sp={sp} titre={t('fil.vide.sansMatch')}
                action={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
            ) : rienDuTout || (onglet === 'aProposer' && ongletVide) ? etatAProposer
              : onglet !== 'aProposer' && ongletVide ? (
                <Etat sp={sp} titre={t(VIDE_BOUCLE[onglet].titre)} texte={t(VIDE_BOUCLE[onglet].texte)} />
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}` }}>
                  {/* `paddingBottom` : la barre d'annulation est un OVERLAY ancré bas-gauche (§ci-dessous) —
                      sans réserve, elle couvre les dernières lignes pendant toute la fenêtre d'annulation. */}
                  <div style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${sp.cardBorder}`, paddingBottom: 'calc(var(--crm-space-7xl) * 3)' }}>
                    {onglet === 'aProposer' ? (
                      <FilListe sp={sp} vue={vue} selections={selectionsVues} corrections={corrections} courant={courant}
                        onChoisir={setChoix} onReactiver={reactiver} maintenant={chargeLe} />
                    ) : (
                      <FilListeBoucle sp={sp} onglet={onglet} attentes={attentes} conclure={conclure} courant={courant} onChoisir={setChoix} />
                    )}
                  </div>
                  {/* La clé remet le défilement en haut quand on change de ligne. */}
                  <div key={`${onglet}:${courant ?? 'aucun'}`} style={{ minHeight: 0, overflowY: 'auto' }}>
                    {panneau}
                  </div>
                </div>
              )}
      </div>
      {/* ⛔ HORS des états : Plus tard ou Écarter sur la DERNIÈRE ligne fait basculer l'écran sur « Tout est
          à jour », et la barre partait avec la liste alors que l'écriture attendait encore. */}
      {annulation && <FilAnnulation sp={sp} texte={annulation.texte} action={annulation.action} onAnnuler={annulation.annuler} />}
      {/* Région vivante montée en PERMANENCE : une région qui apparaît avec son texte n'est pas annoncée
          de façon fiable. Elle dit aussi le second geste et sa touche : la barre est hors d'atteinte au Tab. */}
      <div role="status" aria-live="polite" className="sr-only">
        {annulation ? [
          annulation.texte,
          annulation.action && `${annulation.action.libelle} · ${t('fil.actions.raccourci', { touche: annulation.action.touche })}`,
        ].filter(Boolean).join('. ') : ''}
      </div>
    </div>
  )
}

function Etat({ sp, titre, texte, action, secondaire, alerte = false }: {
  sp: CrmPalette; titre: string; texte?: string
  action?: { libelle: string; faire: () => void }; secondaire?: { libelle: string; faire: () => void }
  /** Un échec : le titre est annoncé dès qu'il paraît. */
  alerte?: boolean
}) {
  const bouton = (principal: boolean) => ({
    height: 38, paddingLeft: 'var(--crm-space-2xl)', paddingRight: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
    border: principal ? 0 : `1px solid ${sp.cardBorder}`, background: principal ? sp.accent : 'transparent',
    color: principal ? sp.accentInk : sp.ink,
  }) as const
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-6xl)' }}>
      <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-md)', textAlign: 'center' }}>
        <p role={alerte ? 'alert' : undefined} style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{titre}</p>
        {texte && <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.sub }}>{texte}</p>}
        {(action || secondaire) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-sm)' }}>
            {action && <button type="button" onClick={action.faire} style={bouton(true)}>{action.libelle}</button>}
            {secondaire && <button type="button" onClick={secondaire.faire} style={bouton(false)}>{secondaire.libelle}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function Squelette({ sp }: { sp: CrmPalette }) {
  const { t } = useTranslation('matching')
  // ⛔ Pas d'`aria-busy` : posé sur l'élément qui porte le libellé, il empêche certains lecteurs
  // d'écran d'annoncer ce même libellé — l'un neutralisait l'autre.
  return (
    <div role="status" style={{
      flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}`,
    }}>
      <span className="sr-only">{t('fil.chargement')}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-lg)', borderRight: `1px solid ${sp.cardBorder}` }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ height: 48, borderRadius: 'var(--crm-radius-md)', background: sp.cardSubBg }} />)}
      </div>
      <div style={{ padding: 'var(--crm-space-6xl)' }}>
        <div style={{ height: 220, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} />
      </div>
    </div>
  )
}
