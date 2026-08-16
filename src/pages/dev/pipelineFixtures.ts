/**
 * Fixtures du banc `/dev/pipeline` — voir `PipelineShowcasePage`.
 *
 * POURQUOI CE FICHIER EXISTE. `PipelinePage` tire toutes ses données
 * d'`usePipelineSugar()`, gaté sur la session (`profile.agency_id`). Sans banc,
 * les trois vues, les neuf colonnes, les modales et les états d'exception ne
 * sont regardables NULLE PART — et `ProtectedRoute` renvoie sur la production,
 * donc on croit relire localhost en relisant `main`.
 *
 * ⛔ Rien ici ne vient de la base et rien n'écrit. Les valeurs sont plausibles
 * mais inventées : c'est un banc visuel, pas un aperçu du portefeuille.
 *
 * ⚠ LES IDENTIFIANTS SONT CEUX DE `mockData` (`c-001…c-008`, `b-101…b-106`), et
 * c'est délibéré. `SugarDealCard` ne lit PAS la map `contactsById` que la page
 * lui passe : il appelle `crmContactById()`, le registre global — et fait
 * `if (!c) return null`. Une carte dont le contact n'est pas résolu ne rend donc
 * RIEN, silencieusement. Comme `crmContactById` retombe sur `CRM_CONTACTS`,
 * pointer les fixtures dessus fait rendre les cartes sans que le banc ait à
 * écrire dans le registre — donc sans fuite d'état vers le reste de l'app
 * (`registerLiveContact` est un Map de module, il survit au démontage).
 */
import { CRM_BIENS, CRM_CONTACTS, type CrmBien, type CrmContact, type CrmDeal } from '@/components/crm-sugar/mockData'
import type { StageId } from '@/components/crm-sugar/tokens'
import { EMPTY_OFFER_CONDITIONS, type Offer, type OfferStatus } from '@/types/offer'

/**
 * Les quatre états que le banc doit pouvoir montrer.
 *
 * ⚠ `vide-filtre` et `vide-total` sont DEUX écrans distincts et la page les dit
 * autrement (`board.emptyState.filtered.*` contre `board.emptyState.none.*`) :
 * le premier propose de retirer les filtres, le second de créer un deal. Un banc
 * qui n'en montre qu'un laisse l'autre invérifié — c'est ce qui a fait passer la
 * pastille de score de `/dev/biens` faute de donnée pour la déclencher.
 *
 * ⛔ PAS d'état « premier lancement » : la couverture de premier lancement du
 * Pipeline est écartée définitivement (verbatim Julien, 21 juillet 2026) et son
 * asset n'existera pas. Il n'y a rien à montrer.
 */
export type PipelineBancEtat = 'nominal' | 'vide-filtre' | 'vide-total' | 'erreur'

/** `dueAt` relatif au jour réel — la carte compare au vrai « aujourd'hui ». */
const jour = (delta: number, heure = 9): string => {
  const d = new Date()
  d.setDate(d.getDate() + delta)
  d.setHours(heure, 0, 0, 0)
  return d.toISOString()
}

/** `updatedAt` : recule dans le passé, pour que le filtre de période morde. */
const maj = (joursEnArriere: number): string => jour(-joursEnArriere, 14)

type Fixture = Omit<CrmDeal, 'ownerAgentId'> & { ownerAgentId?: string }

const d = (f: Fixture): CrmDeal => ({ ownerAgentId: 'agt-1', ...f })

/**
 * Quatorze deals, choisis pour couvrir ce que la carte SAIT afficher et qui,
 * autrement, ne se voit jamais en même temps :
 *
 * - les DEUX gabarits de carte — avec prochaine action (icône + note + échéance)
 *   et sans (la ligne « Planifier une action ») ;
 * - les QUATRE branches d'échéance : en retard, aujourd'hui, demain, date ;
 * - les CINQ icônes de `nextActionIcon` : call · visit · kyc · match · note ;
 * - les TROIS risques, sinon le filtre de risque n'a rien à filtrer ;
 * - une valeur à zéro, qui rend le repli « — » de la carte sans action ;
 * - une colonne VIDE (`visit-done`), pour voir une colonne sans carte ;
 * - un deal PERDU et un deal RANGÉ, que le board doit exclure — les inclure est
 *   la seule façon de vérifier qu'il les exclut.
 */
export const PIPELINE_DEALS: CrmDeal[] = [
  d({ id: 'dv-01', contactId: 'c-001', bienId: 'b-101', stage: 'new-lead', value: 850_000, probability: 10,
      nextAction: { kind: 'call', dueAt: jour(-2), note: 'Rappeler après la visite libre', reminderId: 'r-01' },
      risk: 'at-risk', updatedAt: maj(3) }),
  d({ id: 'dv-02', contactId: 'c-002', bienId: null, stage: 'new-lead', value: 0, probability: 10,
      nextAction: null, risk: 'healthy', updatedAt: maj(1) }),
  d({ id: 'dv-03', contactId: 'c-003', bienId: 'b-102', stage: 'to-qualify', value: 1_240_000, probability: 20,
      nextAction: { kind: 'kyc', dueAt: jour(0), note: 'Relancer pour la pièce d’identité', reminderId: 'r-03' },
      risk: 'healthy', updatedAt: maj(0) }),
  d({ id: 'dv-04', contactId: 'c-004', bienId: null, stage: 'to-qualify', value: 620_000, probability: 20,
      nextAction: { kind: 'note', dueAt: jour(1), note: 'Confirmer le budget avec la banque', reminderId: 'r-04' },
      risk: 'stalled', updatedAt: maj(42) }),
  d({ id: 'dv-05', contactId: 'c-005', bienId: 'b-103', stage: 'searching', value: 980_000, probability: 35,
      nextAction: { kind: 'match', dueAt: jour(2), note: 'Envoyer la sélection Champel', reminderId: 'r-05' },
      risk: 'healthy', updatedAt: maj(2) }),
  d({ id: 'dv-06', contactId: 'c-006', bienId: null, stage: 'searching', value: 445_000, probability: 35,
      nextAction: null, risk: 'stalled', updatedAt: maj(61) }),
  d({ id: 'dv-07', contactId: 'c-007', bienId: 'b-104', stage: 'visit-scheduled', value: 1_650_000, probability: 50,
      nextAction: { kind: 'visit', dueAt: jour(1, 14), note: 'Visite Rue de Lausanne', reminderId: 'r-07' },
      risk: 'healthy', updatedAt: maj(1) }),
  d({ id: 'dv-08', contactId: 'c-008', bienId: 'b-105', stage: 'visit-scheduled', value: 720_000, probability: 50,
      nextAction: { kind: 'visit', dueAt: jour(4, 11), note: 'Seconde visite avec l’architecte', reminderId: 'r-08' },
      risk: 'at-risk', updatedAt: maj(9) }),
  // `visit-done` reste VIDE — une colonne sans carte est un état de rendu.
  d({ id: 'dv-09', contactId: 'c-001', bienId: 'b-106', stage: 'interest-confirmed', value: 1_120_000, probability: 65,
      nextAction: { kind: 'call', dueAt: jour(0, 16), note: 'Point sur la contre-proposition', reminderId: 'r-09' },
      risk: 'healthy', updatedAt: maj(0) }),
  d({ id: 'dv-10', contactId: 'c-003', bienId: null, stage: 'interest-confirmed', value: 890_000, probability: 65,
      nextAction: { kind: 'kyc', dueAt: jour(-6), note: 'Dossier LAB incomplet', reminderId: 'r-10' },
      risk: 'stalled', updatedAt: maj(28) }),
  d({ id: 'dv-11', contactId: 'c-005', bienId: 'b-101', stage: 'offer', value: 830_000, probability: 80,
      nextAction: { kind: 'offer', dueAt: jour(3), note: 'Réponse du vendeur attendue', reminderId: 'r-11' },
      risk: 'at-risk', updatedAt: maj(4) }),
  d({ id: 'dv-12', contactId: 'c-002', bienId: 'b-102', stage: 'signed', value: 1_240_000, probability: 95,
      nextAction: { kind: 'note', dueAt: jour(7), note: 'Rendez-vous notaire à confirmer', reminderId: 'r-12' },
      risk: 'healthy', updatedAt: maj(5) }),
  // Exclus du board — présents pour vérifier qu'ils le sont.
  d({ id: 'dv-13', contactId: 'c-006', bienId: null, stage: 'lost', value: 510_000, probability: 0,
      nextAction: null, risk: 'stalled', updatedAt: maj(35) }),
  d({ id: 'dv-14', contactId: 'c-007', bienId: 'b-103', stage: 'searching', value: 760_000, probability: 35,
      nextAction: null, risk: 'healthy', archived: true, updatedAt: maj(19) }),
]

/**
 * Index passés à la page. Ils ne servent PAS à la carte (qui lit le registre
 * global) mais au filtrage par recherche et aux libellés de la page — les deux
 * lisent bien `contactsById` / `biensById`.
 */
export const PIPELINE_CONTACTS: Map<string, CrmContact> =
  new Map(CRM_CONTACTS.map((c) => [c.id, c]))
export const PIPELINE_BIENS: Map<string, CrmBien> =
  new Map(CRM_BIENS.map((b) => [b.id, b]))

/** Le deal montré par le bento « Signé » quand le banc le force. */
export const PIPELINE_DEAL_SIGNE = 'dv-12'

/** Le deal montré par la modale « Marquer perdu » quand le banc la force. */
export const PIPELINE_DEAL_PERDU = 'dv-11'

/** Étape ouverte par le banc pour la création inline (carte fantôme). */
export const PIPELINE_STAGE_INLINE: StageId = 'to-qualify'

// ═══════════════════════════════════════════════════════════════════════
// FICHE DEAL — `DealDetailPage`
//
// ⚠ Vue-modèle, pas des lignes de base : la page lit une projection étroite de
// cinq types DB. Voir `DealDetailBanc` pour le pourquoi.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Les quatre états de la fiche, et pourquoi chacun.
 *
 * ⛔ `lead` et `nego` ne sont pas deux jeux de données : ce sont les DEUX MOITIÉS
 * de la page, et `isLead = !property && offers.length === 0` les sépare. En
 * `lead` la colonne droite rend `dsMatches` (le score de proximité) ; en `nego`
 * elle rend la chaîne d'offres. Un banc qui n'en montrerait qu'une laisserait la
 * moitié des 62 marqueurs de ce fichier invérifiés.
 */
export type FicheEtat = 'lead' | 'nego' | 'signe' | 'erreur'

export const FICHE_ETATS: { id: FicheEtat; label: string; titre: string }[] = [
  { id: 'lead', label: 'Lead', titre: 'Sans bien ni offre — colonne droite = matching de proximité' },
  { id: 'nego', label: 'Négociation', titre: 'Bien + chaîne de 3 offres, la dernière en attente' },
  { id: 'signe', label: 'Signé', titre: 'Étape terminale — barre pleine, compteur masqué' },
  { id: 'erreur', label: 'Échec', titre: 'La transaction n’a pas pu être chargée' },
]

const DEAL_BASE = {
  status: 'active',
  updated_at: maj(1),
  property: null,
}

/** `ContactTransaction` — 7 champs, le vrai type du hook. */
export const FICHE_DEAL: Record<FicheEtat, {
  id: string; stage: string; status: string
  price_offered: number | null; price_final: number | null; updated_at: string
  property: { title: string; address: string; city: string; price: number; photos: string[] } | null
}> = {
  lead: { ...DEAL_BASE, id: 'dv-05', stage: 'active_search', price_offered: null, price_final: null },
  nego: { ...DEAL_BASE, id: 'dv-11', stage: 'offer', price_offered: 830_000, price_final: null },
  signe: { ...DEAL_BASE, id: 'dv-12', stage: 'signed', status: 'completed', price_offered: 1_240_000, price_final: 1_240_000 },
  erreur: { ...DEAL_BASE, id: 'dv-11', stage: 'offer', price_offered: 830_000, price_final: null },
}

/**
 * Acheteur. ⚠ `search_criteria` est renseigné pour que les pastilles de critères
 * rendent : sans lui la colonne gauche perd son bloc entier, et `dsMatches`
 * retombe sur « les trois premiers biens, sans pourcentage » — ce qui ferait
 * croire que le score n'est pas implémenté.
 */
export const FICHE_CONTACT = {
  id: 'c-005',
  first_name: 'Camille',
  last_name: 'Rougier',
  phone: '+41 79 224 61 07',
  email: 'c.rougier@bluewin.ch',
  search_criteria: {
    type: 'apartment',
    transaction_type: 'buy' as const,
    budget_min: 700_000,
    budget_max: 1_000_000,
    zones: ['Carouge', 'Genève', 'GE'],
    rooms_min: 4,
    surface_min: 90,
    features: ['balcon'],
  },
  form_data: { lang: 'fr' },
}

/** Le bien de la moitié « négociation ». `null` en mode lead — c'est ce qui le définit. */
export const FICHE_BIEN = {
  id: 'b-101',
  title: '4 pièces lumineux Eaux-Vives',
  address: 'Rue du Lac 15',
  city: 'Genève',
  surface_m2: 85,
  rooms: 4,
  price: 850_000,
}

const offre = (
  id: string, kind: 'offer' | 'counter', from: 'buyer' | 'seller',
  label: string, amount: number, status: OfferStatus, jours: number, parent: string | null,
): Offer => ({
  id, deal_id: 'dv-11', agency_id: 'ag-demo', parent_offer_id: parent,
  kind, from_party: from, by_id: null, by_label: label,
  amount, currency: 'CHF', conditions: EMPTY_OFFER_CONDITIONS,
  deposit: Math.round(amount * 0.1), closing_date: null, expires_at: jour(jours + 14),
  attachments: [], notes: null, status,
  created_at: jour(jours), responded_at: status === 'pending' ? null : jour(jours + 1),
})

/**
 * Trois tours, et l'ordre compte : la page marque `current` le DERNIER et
 * n'offre « Accepter / Refuser » que si son statut est `pending`. Une chaîne
 * dont le dernier tour serait déjà tranché cacherait les deux boutons.
 */
export const FICHE_OFFRES: Offer[] = [
  // ⚠ Les statuts sont les CINQ réels (`pending`/`accepted`/`rejected`/
  // `expired`/`withdrawn`) : il n'existe pas de `countered`. Un tour auquel on a
  // contre-offert est `rejected`, et c'est la contre-offre qui porte la suite.
  offre('of-1', 'offer', 'buyer', 'Camille Rougier', 790_000, 'rejected', -21, null),
  offre('of-2', 'counter', 'seller', 'MEGGA · Agent', 845_000, 'rejected', -14, 'of-1'),
  offre('of-3', 'offer', 'buyer', 'Camille Rougier', 830_000, 'pending', -4, 'of-2'),
]

/** Le seul champ de `KycCase` que la page lit. `verified` masque le lien KYC. */
export const FICHE_KYC: Record<FicheEtat, string> = {
  lead: 'pending', nego: 'pending', signe: 'verified', erreur: 'none',
}

export const FICHE_NEXT_ACTION: Record<FicheEtat, { kind: string; note: string } | null> = {
  lead: { kind: 'match', note: 'Envoyer la sélection Champel' },
  nego: { kind: 'offer', note: 'Réponse du vendeur attendue' },
  // ⚠ Terminal : la page MASQUE la prochaine action sur signed/lost. Lui en
  // donner une quand même est ce qui prouve que le masquage marche.
  signe: { kind: 'note', note: 'Rendez-vous notaire à confirmer' },
  erreur: null,
}
