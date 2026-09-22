/**
 * Le Matching du banc `/dev/crm` : le FIL DE MATCHS (lot 1) en page 0, sur les fixtures de ce banc.
 *
 * ⚠ Le vrai `MatchingPage` est monté — molette, clavier, points de page et thème viennent de la
 * production. Seules les deux pages passent par le slot `banc` : le fil y est le vrai composant (ses
 * lectures traversent l'interception comme Contacts et Mes biens), la Recherche reste en démo, faute
 * de fixtures du marché ici. L'atelier actuel garde son propre banc, `/dev/matching-atelier`.
 *
 * ⚠ Composants de MODULE : une identité recréée à chaque rendu remonterait le fil et viderait sa
 * sélection (cf. `MatchingPagerBanc`).
 */
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'
import MatchingFil from '@/components/matching-fil/MatchingFil'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'

function PageFil({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche: () => void }) {
  return <MatchingFil dark={dark} onOpenRecherche={onOpenRecherche} />
}

function PageRecherche({ dark }: { dark: boolean }) {
  return <MatchingRechercheHybride dark={dark} demo="ok" />
}

const BANC_FIL: MatchingPagerBanc = { Page0: PageFil, Page1: PageRecherche }

export default function MatchingFilBanc() {
  return <MatchingPage banc={BANC_FIL} atterrissage="score" />
}
