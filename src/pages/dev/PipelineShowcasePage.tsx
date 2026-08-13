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
 * ⚠ La MÉCANIQUE n'est pas recopiée : `PipelineSugarV2Page` est montée telle
 * quelle et reçoit ses données par le slot `banc`. Un banc qui dupliquerait
 * l'agrégation des 9 colonnes, le drag-drop HTML5 ou les filtres mesurerait sa
 * copie. Les trois vues se changent avec le SÉLECTEUR DE LA PAGE, dans son
 * en-tête — le banc n'en propose pas de second.
 *
 * ⛔ UNE SEULE VUE À LA FOIS, ET C'EST UNE CONTRAINTE, PAS UN CHOIX DE CONFORT.
 * `SugarDealCard` porte `layoutId={`sgdeal-${deal.id}`}` : l'identité de FLIP est
 * GLOBALE à l'arbre `motion`. Deux vues montées ensemble — ou deux instances de
 * la page côte à côte pour comparer les thèmes — partageraient l'identité de
 * chaque carte, et `motion` les ferait s'aspirer d'un conteneur à l'autre :
 * les colonnes jumelles se vident. La page ne rend qu'une vue à la fois ; ce
 * banc ne monte qu'une page. On bascule, on ne juxtapose pas.
 *
 * ⚠ Le thème est POSSÉDÉ par la page (bouton du rail, clé `megga.sugar.dark` —
 * '1'/'0', **pas** 'true'). Le banc le REÇOIT et ne le relit jamais pour son
 * compte, sinon ses propres commandes seraient peintes dans le thème d'avant la
 * dernière bascule — un banc qui fabrique lui-même une incohérence de thème.
 *
 * ⛔ Données de DÉMONSTRATION. Rien ne vient de la base, aucun geste n'écrit :
 * les écritures de la page sont inertes sous `banc` (voir son en-tête).
 */
import { createContext, useContext, useMemo, useState } from 'react'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { CRM_BIENS, CRM_CONTACTS } from '@/components/crm-sugar/mockData'
import PipelineSugarV2Page, {
  type PipelineBanc, type PipelineBancGestes,
} from '@/pages/agent/PipelineSugarV2Page'
import {
  PIPELINE_BIENS, PIPELINE_CONTACTS, PIPELINE_DEALS,
  PIPELINE_DEAL_PERDU, PIPELINE_DEAL_SIGNE, PIPELINE_STAGE_INLINE,
  type PipelineBancEtat,
} from './pipelineFixtures'

const ETATS: { id: PipelineBancEtat; label: string; titre: string }[] = [
  { id: 'nominal', label: 'Nominal', titre: '12 deals actifs sur 8 colonnes' },
  { id: 'vide-filtre', label: 'Vide · filtré', titre: 'Des deals existent, aucun ne passe — carte « affinez »' },
  { id: 'vide-total', label: 'Vide · total', titre: 'Aucun deal actif — carte « créez votre premier deal »' },
  { id: 'erreur', label: 'Échec', titre: 'Bandeau d’erreur NON bloquant, colonnes conservées' },
]

interface BancEtat {
  etat: PipelineBancEtat
  setEtat: (e: PipelineBancEtat) => void
}
const BancCtx = createContext<BancEtat | null>(null)
function useBanc(): BancEtat {
  const v = useContext(BancCtx)
  if (!v) throw new Error('BancCtx manquant')
  return v
}

/**
 * Commandes du banc — identité de MODULE.
 *
 * ⚠ Un composant redéfini à chaque rendu du banc change d'identité d'élément,
 * donc React démonte et remonte son sous-arbre : le repli ci-dessous se
 * rouvrirait à chaque clic. Même raison que les slots du pager Matching.
 *
 * ⛔ Et un banc qui CACHE une surface ne la vérifie pas : posées à demeure, ces
 * commandes recouvrent le coin bas-droit du board — la dernière colonne et le
 * toast. Elles se replient.
 */
function Chrome({ dark, gestes }: { dark: boolean; gestes: PipelineBancGestes }) {
  const { etat, setEtat } = useBanc()
  const [replie, setReplie] = useState(false)
  const sp = crmSugarPalette(dark)
  const pilule = (actif: boolean) => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    padding: 'var(--crm-space-xs) var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    whiteSpace: 'nowrap' as const,
  })
  const groupe = {
    display: 'inline-flex', gap: 'var(--crm-space-2xs)',
    background: sp.solidBg, borderRadius: 'var(--crm-radius-pill)',
    padding: 'var(--crm-space-2xs)', border: `1px solid ${sp.cardBorder}`,
  }
  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: 'var(--crm-space-2xs)',
    }}>
      {!replie && (
        <>
          <div style={groupe}>
            {ETATS.map((e) => (
              <button key={e.id} type="button" title={e.titre}
                onClick={() => setEtat(e.id)} aria-pressed={etat === e.id}
                style={pilule(etat === e.id)}>{e.label}</button>
            ))}
          </div>
          {/* Les modales. « Perdu » ne s'atteint que par un survol suivi d'un
              menu, et le bento « Signé » qu'après un drag et 1 750 ms
              d'animation — deux gestes qu'une capture ne peut pas tenir. Les
              poignées sont celles de la page, pas des raccourcis. */}
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
        </>
      )}
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

/** Vide sans jamais mentir sur la CAUSE — voir `PipelineBancEtat`. */
const VIDE = new Map<string, never>()

export default function PipelineShowcasePage() {
  const [etat, setEtat] = useState<PipelineBancEtat>('nominal')
  const ctx = useMemo<BancEtat>(() => ({ etat, setEtat }), [etat])

  const banc = useMemo<PipelineBanc>(() => ({
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
    // Les deux surfaces de création gardent leurs listes dans TOUS les états :
    // l'état « vide · filtré » parle du board, pas du portefeuille.
    creation: { contacts: CRM_CONTACTS, biens: CRM_BIENS },
    Chrome,
  }), [etat])

  return (
    <BancCtx.Provider value={ctx}>
      <PipelineSugarV2Page banc={banc} />
    </BancCtx.Provider>
  )
}
