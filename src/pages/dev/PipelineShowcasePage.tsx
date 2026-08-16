/**
 * Harnais d'aperçu du « Pipeline » — `/dev/pipeline`, sans session.
 *
 * POURQUOI CETTE ROUTE EXISTE. Toute surface `/dashboard/*` passe par
 * `ProtectedRoute`, qui sans session fait
 * `window.location.replace('https://megga.ch/login')` — une redirection ABSOLUE
 * vers la production. On est alors déposé sur `app.megga.ch`, qui sert `main`,
 * en croyant regarder localhost : on relit l'ancienne version de son propre
 * travail. Le piège ne ressemble pas à une erreur. Même idiome, mêmes raisons
 * que `/dev/matching-atelier`, `/dev/biens`, `/dev/contacts` et `/dev/mobile` —
 * permanent.
 *
 * ⛔ ET LE BANC LUI-MÊME L'A REPRODUIT. Sa première version laissait
 * `onOpenDeal` appeler `navigate('/dashboard/transactions/…')` : un clic sur
 * n'importe quelle carte éjectait vers `megga.ch`. Mesuré à l'écran, pas déduit.
 * D'où `onNavigate` — les deux pages ne sortent plus que par ce point, et le
 * banc y répond en changeant d'écran au lieu de quitter le domaine.
 *
 * ── DEUX ÉCRANS, UN SEUL BANC ────────────────────────────────────────────────
 * Le board et la fiche deal sont deux routes en production, mais UN chantier
 * (décision du 13 août 2026). Les monter ensemble est ce qui rend le passage de
 * l'un à l'autre — un clic sur une carte, puis « Pipeline » en haut à gauche —
 * vérifiable comme l'agent le vit.
 *
 * ⚠ La MÉCANIQUE n'est recopiée nulle part : les deux pages sont montées telles
 * quelles et reçoivent leurs données par un slot `banc`. Un banc qui
 * dupliquerait l'agrégation des 9 colonnes, le drag-drop HTML5, les filtres ou
 * le calcul `dsMatches` mesurerait sa copie.
 *
 * ⛔ UNE SEULE VUE À LA FOIS, ET C'EST UNE CONTRAINTE, PAS UN CHOIX DE CONFORT.
 * `DealCard` porte `layoutId={`sgdeal-${deal.id}`}` : l'identité de FLIP est
 * GLOBALE à l'arbre `motion`. Deux vues montées ensemble — ou deux instances de
 * la page côte à côte pour comparer les thèmes — partageraient l'identité de
 * chaque carte, et `motion` les ferait s'aspirer d'un conteneur à l'autre :
 * les colonnes jumelles se vident. On bascule, on ne juxtapose pas.
 *
 * ⚠ Le thème est POSSÉDÉ par la page (bouton du rail, clé `megga.sugar.dark` —
 * '1'/'0', **pas** 'true'). Le banc le REÇOIT et ne le relit jamais pour son
 * compte, sinon ses propres commandes seraient peintes dans le thème d'avant la
 * dernière bascule — un banc qui fabrique lui-même une incohérence de thème.
 *
 * ⛔ Données de DÉMONSTRATION. Rien ne vient de la base, aucun geste n'écrit.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { crmPalette } from '@/components/crm/tokens'
import { CRM_BIENS, CRM_CONTACTS } from '@/components/crm/mockData'
import PipelinePage, {
  type PipelineBanc, type PipelineBancGestes,
} from '@/pages/agent/PipelinePage'
import DealDetailPage, { type DealDetailBanc } from '@/pages/agent/DealDetailPage'
import {
  FICHE_BIEN, FICHE_CONTACT, FICHE_DEAL, FICHE_ETATS, FICHE_KYC,
  FICHE_NEXT_ACTION, FICHE_OFFRES,
  PIPELINE_BIENS, PIPELINE_CONTACTS, PIPELINE_DEALS,
  PIPELINE_DEAL_PERDU, PIPELINE_DEAL_SIGNE, PIPELINE_STAGE_INLINE,
  type FicheEtat, type PipelineBancEtat,
} from './pipelineFixtures'

const ETATS: { id: PipelineBancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '12 deals actifs sur 8 colonnes' },
  { id: 'vide-filtre', label: 'Vide · filtré', titre: 'Des deals existent, aucun ne passe — carte « affinez »' },
  { id: 'vide-total', label: 'Vide · total', titre: 'Aucun deal actif — carte « créez votre premier deal »' },
  { id: 'erreur', label: 'Échec', titre: 'Bandeau d’erreur NON bloquant, colonnes conservées' },
]

type Ecran = 'board' | 'fiche'

interface BancEtat {
  ecran: Ecran
  setEcran: (e: Ecran) => void
  etat: PipelineBancEtat
  setEtat: (e: PipelineBancEtat) => void
  fiche: FicheEtat
  setFiche: (e: FicheEtat) => void
}
const BancCtx = createContext<BancEtat | null>(null)
function useBanc(): BancEtat {
  const v = useContext(BancCtx)
  if (!v) throw new Error('BancCtx manquant')
  return v
}

// ── Atomes de commande, partagés par les deux chromes ────────────────────────
function usePilule(dark: boolean) {
  const sp = crmPalette(dark)
  return {
    sp,
    pilule: (actif: boolean) => ({
      border: 0, cursor: 'pointer', fontFamily: 'inherit',
      padding: 'var(--crm-space-xs) var(--crm-space-lg)',
      borderRadius: 'var(--crm-radius-pill)',
      fontSize: 'var(--crm-text-sm)', fontWeight: 600,
      background: actif ? sp.accent : 'transparent',
      color: actif ? sp.accentInk : sp.sub,
      whiteSpace: 'nowrap' as const,
    }),
    groupe: {
      display: 'inline-flex', gap: 'var(--crm-space-2xs)',
      background: sp.solidBg, borderRadius: 'var(--crm-radius-pill)',
      padding: 'var(--crm-space-2xs)', border: `1px solid ${sp.cardBorder}`,
    },
  }
}

/**
 * Coquille repliable des commandes.
 *
 * ⛔ Un banc qui CACHE une surface ne la vérifie pas : posées à demeure, ces
 * commandes recouvrent le coin bas-droit — la dernière colonne du board et le
 * toast des deux écrans. Elles se replient.
 */
function Commandes({ dark, children }: { dark: boolean; children: ReactNode }) {
  const [replie, setReplie] = useState(false)
  const { sp } = usePilule(dark)
  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: 'var(--crm-space-2xs)',
    }}>
      {!replie && children}
      <button
        type="button"
        onClick={() => setReplie((v) => !v)}
        aria-expanded={!replie}
        title={replie ? 'Déplier les commandes du banc' : 'Replier — dégage le coin bas-droit'}
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        }}>
        {replie ? 'Aperçu ▸' : 'Aperçu · données de démonstration'}
      </button>
    </div>
  )
}

/** Sélecteur d'écran — commun aux deux chromes, pour revenir sans geste caché. */
function SelecteurEcran({ dark }: { dark: boolean }) {
  const { ecran, setEcran } = useBanc()
  const { pilule, groupe } = usePilule(dark)
  return (
    <div style={groupe}>
      <button type="button" style={pilule(ecran === 'board')} aria-pressed={ecran === 'board'}
        onClick={() => setEcran('board')}>Board</button>
      <button type="button" style={pilule(ecran === 'fiche')} aria-pressed={ecran === 'fiche'}
        onClick={() => setEcran('fiche')}>Fiche deal</button>
    </div>
  )
}

/**
 * ⚠ IDENTITÉ DE MODULE. Un composant redéfini à chaque rendu du banc change
 * d'identité d'élément, donc React démonte et remonte son sous-arbre : le repli
 * se rouvrirait à chaque clic. Même raison que les slots du pager Matching.
 */
function ChromeBoard({ dark, gestes }: { dark: boolean; gestes: PipelineBancGestes }) {
  const { etat, setEtat } = useBanc()
  const { pilule, groupe } = usePilule(dark)
  return (
    <Commandes dark={dark}>
      <SelecteurEcran dark={dark} />
      <div style={groupe}>
        {ETATS.map((e) => (
          <button key={e.id} type="button" title={e.titre}
            onClick={() => setEtat(e.id)} aria-pressed={etat === e.id}
            style={pilule(etat === e.id)}>{e.label}</button>
        ))}
      </div>
      {/* Les modales. « Perdu » ne s'atteint que par un survol suivi d'un menu,
          et le bento « Signé » qu'après un drag et 1 750 ms d'animation — deux
          gestes qu'une capture ne peut pas tenir. Les poignées sont celles de la
          page, pas des raccourcis. */}
      <div style={groupe}>
        <button type="button" style={pilule(false)}
          onClick={() => gestes.ouvrirNouveauDeal()}>Nouveau deal</button>
        <button type="button" style={pilule(false)}
          onClick={() => gestes.ouvrirInline(PIPELINE_STAGE_INLINE)}>Création inline</button>
        <button type="button" style={pilule(false)}
          onClick={() => gestes.ouvrirPerdu(PIPELINE_DEAL_PERDU)}>Perdu</button>
        <button type="button" style={pilule(false)}
          onClick={() => gestes.ouvrirSigne(PIPELINE_DEAL_SIGNE)}>Bento signé</button>
        <button type="button" style={pilule(false)}
          onClick={() => gestes.fermerTout()}>Fermer</button>
      </div>
    </Commandes>
  )
}

function ChromeFiche({ dark }: { dark: boolean }) {
  const { fiche, setFiche } = useBanc()
  const { pilule, groupe } = usePilule(dark)
  return (
    <Commandes dark={dark}>
      <SelecteurEcran dark={dark} />
      <div style={groupe}>
        {FICHE_ETATS.map((e) => (
          <button key={e.id} type="button" title={e.titre}
            onClick={() => setFiche(e.id)} aria-pressed={fiche === e.id}
            style={pilule(fiche === e.id)}>{e.label}</button>
        ))}
      </div>
    </Commandes>
  )
}

/** Vide sans jamais mentir sur la CAUSE — voir `PipelineBancEtat`. */
const VIDE = new Map<string, never>()

export default function PipelineShowcasePage() {
  const [ecran, setEcran] = useState<Ecran>('board')
  const [etat, setEtat] = useState<PipelineBancEtat>('nominal')
  const [fiche, setFiche] = useState<FicheEtat>('nego')
  const ctx = useMemo<BancEtat>(
    () => ({ ecran, setEcran, etat, setEtat, fiche, setFiche }),
    [ecran, etat, fiche],
  )

  /**
   * Réponse du banc à toute sortie de page. `/dashboard/pipeline` et
   * `/dashboard/transactions/:id` sont les deux écrans qu'il monte : il y va.
   * Le reste (contacts, biens, KYC, matching, calendrier) n'a pas de banc ici —
   * on ne quitte PAS le domaine, on ne fait rien. ⚠ Ne rien faire est le
   * comportement voulu : c'est ce qui manquait, et c'est ce qui éjectait.
   */
  const onNavigate = useMemo(() => (vers: string) => {
    if (vers.startsWith('/dashboard/transactions/')) { setEcran('fiche'); return }
    if (vers === '/dashboard/pipeline') { setEcran('board'); return }
  }, [])

  const bancBoard = useMemo<PipelineBanc>(() => ({
    // ⚠ `vide-total` retire les deals : `pipeHasAnyActive` tombe à faux et la
    // page rend la carte « créez votre premier deal ». `vide-filtre` les GARDE
    // et retire les contacts : les deals restent actifs — donc la page propose
    // de retirer les filtres — mais aucun ne se résout. C'est l'état réel de
    // l'hydratation en retard, et c'est la seule façon d'atteindre cette
    // seconde carte sans piloter les filtres depuis le banc.
    deals: etat === 'vide-total' ? [] : PIPELINE_DEALS,
    contactsById: etat === 'vide-filtre' ? VIDE : PIPELINE_CONTACTS,
    biensById: PIPELINE_BIENS,
    isError: etat === 'erreur',
    onNavigate,
    // Les deux surfaces de création gardent leurs listes dans TOUS les états :
    // l'état « vide · filtré » parle du board, pas du portefeuille.
    creation: { contacts: CRM_CONTACTS, biens: CRM_BIENS },
    Chrome: ChromeBoard,
  }), [etat, onNavigate])

  const bancFiche = useMemo<DealDetailBanc>(() => ({
    deal: fiche === 'erreur' ? null : FICHE_DEAL[fiche],
    contact: FICHE_CONTACT,
    // ⛔ `isLead` se DÉDUIT de l'absence de bien ET d'offre — c'est le mode lead.
    property: fiche === 'lead' ? null : FICHE_BIEN,
    offers: fiche === 'lead' ? [] : FICHE_OFFRES,
    kycStatus: FICHE_KYC[fiche],
    nextAction: FICHE_NEXT_ACTION[fiche],
    biens: CRM_BIENS,
    isLoading: false,
    isError: fiche === 'erreur',
    onNavigate,
    Chrome: ChromeFiche,
  }), [fiche, onNavigate])

  return (
    <BancCtx.Provider value={ctx}>
      {ecran === 'board'
        ? <PipelinePage banc={bancBoard} />
        : <DealDetailPage banc={bancFiche} />}
    </BancCtx.Provider>
  )
}
