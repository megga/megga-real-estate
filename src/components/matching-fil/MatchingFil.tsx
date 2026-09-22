/**
 * Matching — le FIL DE MATCHS (refonte de la page 0 du pager, lots 1 et 2).
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md`. Il remplacera l'atelier
 * (`MatchingAtelierPage`) à la fin du lot 3 ; d'ici là il ne vit que sur le banc `/dev/crm`.
 *
 * Ce conteneur porte les données (`useMatchingFil`, `useSelectionMarche`), les filtres, la sélection,
 * les gestes, et le CLAVIER du fil entier.
 *
 * ⚠ Le clavier est posé sur la RACINE du fil (`onKeyDown`), pas sur `window` : le fil est la page 0
 * d'un pager dont la page 1 reste montée, et plusieurs écrans d'onglet restent vivants. Un écouteur
 * global agirait depuis une page ou un onglet qu'on ne regarde pas ; celui-ci n'entend que ce qui a
 * le focus dedans. D'où, après chaque geste, le focus rendu à une ligne (ou à la racine).
 *
 * ⚠ Les trois gestes passent par la fenêtre d'annulation (`PendingRegistry`), « Je l'ai proposé »
 * compris : il n'envoie rien à l'acheteur (décision du 21.09.2026, le matching reste chez l'agent), il
 * consigne ce que l'agent a fait lui-même, donc il s'annule comme Plus tard et Écarter.
 *
 * ⚠ Un match qu'un geste fait sortir est MASQUÉ localement (`masques`) jusqu'à ce que les données le
 * reflètent : la valeur est `null` tant que l'écriture n'a pas fini, puis l'heure où elle a fini. Une
 * lecture COMMENCÉE après cette heure fait foi — un reporté reparaît sous « Reportés », un match
 * encore à traiter reparaît à sa place. Sans cette levée, un reporté restait caché jusqu'au
 * rechargement.
 *
 * ⚠ Lot 2 : une ligne « Marché » par acheteur (`cleSelection`) suit les biens en mandat dans l'ordre de
 * lecture. Choisie, elle charge ses biens et montre la sélection à droite ; `E` y consigne les biens
 * cochés comme proposés, en UN geste. `P` et `X` n'y font rien : ils visent UN match, et la ligne en
 * porte plusieurs. Un « Écarter » dans la sélection ne déplace pas la sélection du fil : le focus passe à la
 * case du bien voisin.
 *
 * ⚠ Les cases cochées d'office sont FIGÉES par acheteur (`coches`), et le focus perdu sous un élément
 * démonté revient à la ligne courante (`reprendreFocus`) : voir les deux blocs plus bas.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useCrmTabsOptionnel, useTabScopedState } from '@/hooks/useCrmTabs'
import {
  execDismiss, execProposer, execProposerSelection, execSnooze, execWake, type GesteContext,
} from '@/hooks/useAtelierMatching'
import { useMatchingFil, versGeste } from '@/hooks/useMatchingFil'
import { PAS_SELECTION, useSelectionMarche } from '@/hooks/useSelectionMarche'
import { PendingRegistry, UNDO_WINDOW_MS } from '@/components/matching-atelier/pendingTriage'
import {
  cleSelection, construireFil, construireSelections, contactDeSelection, optionsFiltres, precoches,
  type FilFiltres, type FilMatch,
} from './filModele'
import FilAnnulation from './FilAnnulation'
import FilEnTete from './FilEnTete'
import FilListe from './FilListe'
import FilPanneau from './FilPanneau'
import FilSelection from './FilSelection'

const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }
const COLONNES = 'minmax(300px, 380px) minmax(0, 1fr)'
const nomComplet = (m: FilMatch): string => `${m.acheteur.prenom} ${m.acheteur.nom}`

/** Un geste différé DANS une sélection : il ne déplace pas le fil, et `rendre` défait ce qu'il a retiré. */
interface DansSelection { rendre: () => void }

/** Un match masqué par un geste redevient visible quand une lecture COMMENCÉE après l'écriture le dit. */
function visibleSelon(masques: ReadonlyMap<string, number | null>, id: string, chargeLe: number): boolean {
  const fin = masques.get(id)
  // ⚠ `>=` et non `>` : `rafraichir` lance la lecture dans le même tour que la fin de l'écriture, donc
  // souvent dans la même milliseconde. Une lecture partie AVANT est annulée par cette invalidation.
  return fin === undefined || (fin !== null && chargeLe >= fin)
}

export default function MatchingFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche?: () => void }) {
  const { t } = useTranslation('matching')
  const sp = crmPalette(dark)
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { user, profile } = useAuth()
  const { isLoading, isError, aDesDonnees, erreurLe, matchs, selections, historique, chargeLe, rafraichir } = useMatchingFil()

  // Les liens entrants de l'atelier gardent leur sens (§3.4) : `?contact=` filtre sur l'acheteur,
  // `?annonce=p:<uuid>` sur le bien. Lus une fois, à l'arrivée.
  const [filtresArrivee] = useState<FilFiltres | null>(() => {
    const annonce = params.get('annonce')
    const contact = params.get('contact')
    if (!annonce && !contact) return null
    return { bienId: annonce?.startsWith('p:') ? annonce.slice(2) : null, acheteurId: contact, texte: '' }
  })
  // Les filtres sont rangés dans l'ONGLET : ils survivent à un aller-retour entre onglets. La
  // sélection, elle, reste LOCALE (§2 des retours de revue) — la ranger dans l'onglet écrivait sur
  // le serveur à CHAQUE flèche du clavier, pour une position qui n'a jamais eu besoin de survivre.
  // Même règle pour les cases cochées et le pas de chargement d'une sélection du marché (lot 2).
  const [filtresRetenus, setFiltres] = useTabScopedState<FilFiltres>('fil.filtres', filtresArrivee ?? SANS_FILTRE)
  const [choix, setChoix] = useState<string | null>(null)
  // ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus — même règle et même
  // mécanique que le pivot du pager (`MatchingPage`) : lu au rendu, écrit dans un effet.
  const [pivotConsomme, setPivotConsomme] = useState(filtresArrivee == null)
  const filtres = pivotConsomme || !filtresArrivee ? filtresRetenus : filtresArrivee
  // ⛔ TANT QUE LA PILE D'ONGLETS CHARGE, ON N'ÉCRIT PAS. L'hydratation de `CrmTabsProvider` REMPLACE
  // la tranche de l'onglet une fois la pile serveur arrivée (`reconcilier`) : un pivot consommé avant
  // cette arrivée écrivait dans un onglet qui n'existait pas encore, et l'hydratation l'effaçait
  // aussitôt — le lien d'arrivée perdait son filtre sur un chargement à froid.
  const chargementOnglets = useCrmTabsOptionnel()?.chargement ?? false
  useEffect(() => {
    if (pivotConsomme || !filtresArrivee || chargementOnglets) return
    setFiltres(filtresArrivee)
    setPivotConsomme(true)
  }, [pivotConsomme, filtresArrivee, setFiltres, chargementOnglets])

  const [masques, setMasques] = useState<ReadonlyMap<string, number | null>>(() => new Map())
  const [coches, setCoches] = useState<Readonly<Record<string, readonly string[]>>>({})
  const [limites, setLimites] = useState<Readonly<Record<string, number>>>({})
  const [enAttente, setEnAttente] = useState<{ id: string; texte: string; annuler: () => void } | null>(null)
  const [registre] = useState(() => new PendingRegistry())
  const racine = useRef<HTMLDivElement>(null)
  const reveils = useRef(new Set<string>())

  // L'agent n'a pas annulé : ce qui attend part quand le fil se ferme.
  useEffect(() => () => registre.flushAll(), [registre])

  const ctx = useMemo<GesteContext | null>(() => (profile?.agency_id
    ? { agencyId: profile.agency_id, userId: profile.id ?? user?.id ?? '' }
    : null), [profile, user])

  const visibles = useMemo(() => matchs.filter((m) => visibleSelon(masques, m.id, chargeLe)), [matchs, masques, chargeLe])
  const options = useMemo(() => optionsFiltres(matchs, selections), [matchs, selections])
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
  const vue = useMemo(() => construireFil(visibles, filtresValides, chargeLe), [visibles, filtresValides, chargeLe])
  const selectionsVues = useMemo(() => construireSelections(selections, filtresValides), [selections, filtresValides])
  const ordre = useMemo(
    () => [...vue.ordre, ...selectionsVues.map((s) => cleSelection(s.acheteur.id))],
    [vue.ordre, selectionsVues],
  )
  const compte = vue.compte + selectionsVues.length
  const filtreActif = Boolean(filtresValides.bienId || filtresValides.acheteurId || filtresValides.texte)
  // Sélection DÉRIVÉE : une ligne qui sort du fil (geste, filtre) cède la place à la première restante.
  const courant = choix && ordre.includes(choix) ? choix : (ordre[0] ?? null)
  const contactSelection = courant ? contactDeSelection(courant) : null
  const match = courant && !contactSelection ? visibles.find((m) => m.id === courant) ?? null : null
  const resumeSelection = contactSelection ? selectionsVues.find((s) => s.acheteur.id === contactSelection) ?? null : null

  const limite = contactSelection ? (limites[contactSelection] ?? PAS_SELECTION) : PAS_SELECTION
  const selection = useSelectionMarche(contactSelection, limite)
  const matchsSelection = useMemo(
    // ⛔ En défense : jamais le bien d'un autre acheteur sous le nom de celui-ci (`useSelectionMarche`
    // ne garde déjà ses données provisoires que pour le même acheteur).
    () => selection.matchs.filter((m) => m.acheteur.id === contactSelection && visibleSelon(masques, m.id, selection.chargeLe)),
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
  /** La case d'un bien de la sélection ; `false` si elle n'est pas (ou plus) à l'écran. */
  const focaliserBien = useCallback((id: string): boolean => {
    const caseBien = racine.current?.querySelector<HTMLElement>(`[data-bien="${CSS.escape(id)}"]`)
    caseBien?.focus()
    return caseBien != null
  }, [])

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
  const ceder = useCallback((id: string): string | null => {
    const liste = ordreRef.current
    const i = liste.indexOf(id)
    const suivant = liste[i + 1] ?? liste[i - 1] ?? null
    setChoix(suivant)
    return suivant
  }, [])

  /**
   * Un geste différé sur un ou plusieurs matchs : ils sortent tout de suite, l'écriture part à la fin de la
   * fenêtre d'annulation. Plusieurs matchs : les biens cochés d'une sélection, proposés en UN geste — une
   * seule écriture, une seule annulation pour tous.
   */
  const differer = useCallback((
    ms: readonly FilMatch[], texte: string, ecrire: (c: GesteContext) => Promise<unknown>, dansSelection?: DansSelection,
  ) => {
    const premier = ms[0]
    if (!ctx || !premier) return
    const ids = ms.map((m) => m.id)
    // Dans une sélection, le bien n'est pas une ligne du fil : la sélection du fil ne bouge pas.
    if (!dansSelection) focaliser(ceder(premier.id))
    setMasques((s) => { const n = new Map(s); for (const id of ids) n.set(id, null); return n })
    const poignee = registre.defer(async () => { await ecrire(ctx); return null }, {
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
      onError: () => { montrer(ids); dansSelection?.rendre(); toast.error(t('fil.erreurGeste')) },
    })
    setEnAttente({
      id: premier.id,
      texte,
      annuler: () => {
        poignee.cancel()
        montrer(ids)
        setEnAttente(null)
        if (dansSelection) {
          dansSelection.rendre()
          // Le bien revient au rendu suivant : sa case reprend le focus après lui.
          setTimeout(() => { if (!focaliserBien(premier.id)) focaliser(courantRef.current) }, 0)
          return
        }
        setChoix(premier.id)
        // La ligne revient au rendu suivant : le focus la suit après lui.
        setTimeout(() => focaliser(premier.id), 0)
      },
    })
  }, [ctx, ceder, registre, rafraichir, montrer, focaliser, focaliserBien, toast, t])

  // « Annuler » disparaît AVANT que l'écriture parte : passé ce délai, il n'annulerait plus rien.
  useEffect(() => {
    if (!enAttente) return
    const minuteur = setTimeout(() => setEnAttente((e) => (e === enAttente ? null : e)), UNDO_WINDOW_MS - 400)
    return () => clearTimeout(minuteur)
  }, [enAttente])

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
        rendre: () => {
          if (!etaitCoche) return
          setCoches((c) => {
            const actuels = c[contact] ?? []
            return actuels.includes(m.id) ? c : { ...c, [contact]: [...actuels, m.id] }
          })
        },
      })
  }, [ctx, differer, t, matchsSelection, cochesSelection, focaliser, focaliserBien])
  const reactiver = useCallback((id: string) => {
    // Un double clic ne réveille pas deux fois (deux écritures, deux annulations de rappel).
    if (reveils.current.has(id)) return
    reveils.current.add(id)
    // ⚠ `rafraichir` rend la promesse d'invalidation : `.then(rafraichir)` l'ADOPTE, donc `.finally`
    // n'ouvre le verrou qu'une fois le rafraîchissement retombé — pas dès l'écriture de `execWake`.
    // Sans ça, un second clic pendant le rafraîchissement encore en vol rouvrait une seconde écriture.
    execWake(id).then(rafraichir)
      .catch(() => toast.error(t('fil.erreurGeste')))
      .finally(() => reveils.current.delete(id))
  }, [rafraichir, toast, t])

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
      { rendre: () => setCoches((c) => ({ ...c, [acheteur.id]: avant })) })
  }, [ctx, resumeSelection, cochesSelection, matchsSelection, differer, t])

  // Un rafraîchissement en échec garde la liste chargée, et le dit UNE fois par échec.
  const echecSignale = useRef(0)
  useEffect(() => {
    if (!isError || !aDesDonnees || erreurLe === echecSignale.current) return
    echecSignale.current = erreurLe
    toast.error(t('fil.erreurRafraichir'))
  }, [isError, aDesDonnees, erreurLe, toast, t])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const cible = e.target as HTMLElement
    const fleche = e.key === 'ArrowDown' || e.key === 'ArrowUp'
    const caseACocher = cible instanceof HTMLInputElement && cible.type === 'checkbox'
    // ↑/↓ sur la case d'un bien parcourent les CASES de la sélection, pas le fil : descendre la liste des
    // biens au clavier changeait sinon d'acheteur. Aux extrémités, on reste sur place.
    if (fleche && caseACocher && cible.dataset.bien !== undefined) {
      e.preventDefault()
      const cases = [...(racine.current?.querySelectorAll<HTMLElement>('[data-bien]') ?? [])]
      cases[cases.indexOf(cible) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
      return
    }
    // Une case à cocher n'est pas une saisie POUR E SEULEMENT : E doit proposer depuis la case qu'on vient
    // de cocher. Toute autre touche y garde son sens natif.
    const saisie = cible instanceof HTMLInputElement ? !(caseACocher && e.key.toLowerCase() === 'e')
      : /^(TEXTAREA|SELECT)$/.test(cible.tagName)
    if (saisie || cible.isContentEditable) return
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
  const connu = !isLoading && !enEchec
  const rienDuTout = visibles.length === 0 && selections.length === 0
  return (
    <div ref={racine} tabIndex={-1} onKeyDown={onKeyDown}
      onFocus={(e) => { dernierFocus.current = e.target }}
      onBlur={() => { setTimeout(reprendreFocus, 0) }} style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', outline: 'none', background: sp.frameBg, color: sp.ink,
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <FilEnTete sp={sp} compte={connu ? compte : null} filtres={filtresValides} options={options} onFiltres={setFiltres} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isLoading ? <Squelette sp={sp} />
          : enEchec ? <Etat sp={sp} alerte titre={t('fil.erreur')} action={{ libelle: t('fil.reessayer'), faire: rafraichir }} />
            // ⚠ Un FILTRE actif qui ne retient rien passe AVANT le constat « aucune donnée du tout » :
            // sinon le seul match d'un acheteur filtré, une fois proposé, fait lire « Tout est à jour »
            // (vrai pour l'agence entière, faux pour ce filtre) au lieu de « Rien ne correspond ».
            : filtreActif && compte === 0 && vue.reportes.length === 0 ? (
              <Etat sp={sp} titre={t('fil.filtreVide')} action={{ libelle: t('fil.filtres.retirer'), faire: () => setFiltres(SANS_FILTRE) }} />
            ) : rienDuTout ? (
              <Etat sp={sp} titre={t('fil.vide.titre')} texte={t('fil.vide.texte')}
                action={{ libelle: t('fil.vide.contacts'), faire: () => navigate('/dashboard/contacts') }}
                secondaire={onOpenRecherche ? { libelle: t('fil.vide.marche'), faire: onOpenRecherche } : undefined} />
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: COLONNES, borderTop: `1px solid ${sp.cardBorder}` }}>
                {/* `paddingBottom` : la barre d'annulation est un OVERLAY ancré bas-gauche (§ci-dessous) —
                    sans réserve, elle couvre les dernières lignes pendant toute la fenêtre d'annulation. */}
                <div style={{ minHeight: 0, overflowY: 'auto', borderRight: `1px solid ${sp.cardBorder}`, paddingBottom: 'calc(var(--crm-space-7xl) * 3)' }}>
                  <FilListe sp={sp} vue={vue} selections={selectionsVues} courant={courant} onChoisir={setChoix} onReactiver={reactiver} />
                </div>
                {/* La clé remet le défilement en haut quand on change de ligne. */}
                <div key={courant ?? 'aucun'} style={{ minHeight: 0, overflowY: 'auto' }}>
                  {contactSelection && resumeSelection ? (
                    <FilSelection sp={sp} resume={resumeSelection} matchs={matchsSelection} coches={cochesSelection}
                      aPlus={selection.aPlus} isLoading={selection.isLoading} isError={selection.isError}
                      aDesDonnees={selection.aDesDonnees} isFetching={selection.isFetching}
                      onCocher={cocher} onEcarter={ecarterDeSelection} onProposer={proposerSelection}
                      onVoirPlus={() => setLimites((l) => ({ ...l, [contactSelection]: limite + PAS_SELECTION }))}
                      onReessayer={() => { void selection.refetch() }}
                      onVoirContact={() => navigate(`/dashboard/contacts/${contactSelection}`)} />
                  ) : match ? (
                    <FilPanneau sp={sp} m={match} historique={historique.get(match.acheteur.id)}
                      onProposer={() => proposer(match)}
                      onPlusTard={() => plusTard(match)} onEcarter={() => ecarter(match)}
                      onVoirBien={() => navigate(`/dashboard/listings/${match.bien.id}`)}
                      onVoirContact={() => navigate(`/dashboard/contacts/${match.acheteur.id}`)} />
                  ) : (
                    <Etat sp={sp} titre={compte === 0 ? t('fil.vide.titre') : t('fil.choisir')} />
                  )}
                </div>
              </div>
            )}
      </div>
      {/* ⛔ HORS des états : Plus tard ou Écarter sur la DERNIÈRE ligne fait basculer l'écran sur « Tout est
          à jour », et la barre partait avec la liste alors que l'écriture attendait encore. */}
      {enAttente && <FilAnnulation sp={sp} texte={enAttente.texte} onAnnuler={enAttente.annuler} />}
      {/* Région vivante montée en PERMANENCE : une région qui apparaît avec son texte n'est pas annoncée
          de façon fiable. */}
      <div role="status" aria-live="polite" className="sr-only">{enAttente?.texte ?? ''}</div>
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
