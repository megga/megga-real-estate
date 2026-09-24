/**
 * Données de démonstration partagées par les harnais d'aperçu (`/dev/*`).
 *
 * ⛔ Rien ici ne vient de la base et rien ne doit y ressembler à un vrai bien
 * d'agence : ces objets servent à vérifier une composition sans session, pas à
 * simuler un portefeuille.
 *
 * ⚠ Une SEULE fixture partagée. `DEMO_LISTING` vivait dans
 * `MobileShowcasePage.tsx` ; l'aperçu bureau en aurait recopié une variante, et
 * les deux auraient divergé au premier champ ajouté — c'est exactement ce qui
 * est arrivé à la carte des types du wizard (`villa` valait `'villa'` d'un côté
 * et `'house'` de l'autre).
 */
import type { Property } from '@/types/listing'
import { CRM_CONTACTS, type CrmContact } from '@/components/crm/mockData'
import type { FicheContact } from '@/components/crm/contacts-pager/ContactDetailPager'
import { construireSaBoucle, type LigneBoucleContact, type SaBoucle } from '@/components/crm/contacts-pager/saBoucle'
import type { SearchCriteria } from '@/types/contact'
import type { KycCase, KycDocument } from '@/types/kyc'
import type { ContactNoteView } from '@/hooks/useContactNotes'

export const DEMO_LISTING: Property = {
  id: 'p3', agency_id: 'ag', title: 'Villa contemporaine', description: 'Villa lumineuse de 240 m² avec piscine, vue dégagée, finitions haut de gamme. Quartier résidentiel calme à Cologny, proche des écoles internationales.',
  type: 'villa', status: 'active', price: 3850000, currency: 'CHF', rooms: 7, bedrooms: 5, bathrooms: 3, surface_m2: 240,
  year_built: 2019, charges_monthly: 0, mandate_type: 'Exclusif', energy_class: 'A', mandate_commission_pct: 3, mandate_signed_at: '2026-05-02', mandate_expires_at: '2026-11-02',
  transaction_type: 'buy', address: 'Route de la Capite 12', city: 'Cologny', canton: 'GE', postal_code: '1223', lat: 46.22, lng: 6.18,
  photos: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80'],
  c2pa_verified: true, features: ['Piscine', 'Jardin', 'Garage', 'Cave'], created_by: 'u', created_at: '2026-05-02', published_at: '2026-05-04',
}

/**
 * Contacts de démonstration — `CRM_CONTACTS` COMPLÉTÉ pour que le banc montre
 * les éléments FRAGILES.
 *
 * ⛔ C'est la leçon de `/dev/biens`, qui n'affichait aucune pastille de score
 * faute de `health` dans ses données : un harnais qui cache précisément
 * l'élément défectueux coûte plus cher qu'il ne rapporte. Ici les deux éléments
 * à mesurer sont l'AVATAR (huit teintes de `pickAvatarBg`, dont cinq échouent
 * l'AA sous encre blanche) et la PASTILLE de rôle — `CTP_FN` n'en peint que
 * TROIS, sa quatrième valeur (`ok`) étant le vert du KYC.
 *
 * `CRM_CONTACTS` seul en montre l'essentiel mais pas tout — mesuré, pas supposé :
 * sept teintes d'avatar sur huit (#EC4899 manque), et trois KYC sur quatre
 * (`stale` manque). Côté appartenance, c'est le RÔLE qui range depuis l'étape 3
 * (22.09.2026) : un contact paraît sous CHACUN des siens, et les comptes se
 * chevauchent. ⛔ `audienceOf` n'existe plus — elle rangeait chaque contact dans
 * UNE audience et tirait la pilule `tenant` de `criteria.transaction ===
 * 'location'`, si bien qu'un acheteur cherchant en location comptait pour un
 * locataire sans porter ce rôle. Mesuré sur ces huit contacts : `buyer` ×4,
 * `seller` ×2, `tenant` ×1 (c-005, déclarée `buyer` alors que ses critères
 * disaient location — accordée à ses rôles), et c-008 SANS rôle, le seul à
 * exercer ce chemin. `investor` n'est porté que par c-002, à côté de `buyer` :
 * c'est le SEUL contact à DEUX rôles, donc le seul qui rende le « +1 » et le
 * chevauchement des comptes. ⚠ Les sept rôles de réseau, eux, ne sont portés
 * par aucun de ces contacts : ce banc-ci ne les montre pas.
 *
 * Les deux contacts ajoutés ferment ce qui reste : la huitième teinte, le KYC
 * `stale`, et le rôle `landlord` — qui ne retombe PLUS sur `seller` : le bailleur
 * porte son propre rôle, et la liste range par RÔLE, non plus par audience.
 */
const DEMO_CONTACTS_COMPLEMENT: CrmContact[] = [
  // Locataire — elle porte le rôle `tenant`, comme c-005 ; elle vient pour les deux
  // manques de `CRM_CONTACTS` : la huitième teinte d'avatar (#EC4899) et le KYC `stale`.
  {
    id: 'c-d01', type: 'tenant', roles: ['tenant'], firstName: 'Sofia', lastName: 'Marchetti',
    email: 's.marchetti@bluewin.ch', phone: '+41 76 318 40 55', lang: 'it',
    status: 'qualified', score: 66, source: 'website', assignedTo: 'agt-1',
    createdAt: '2026-05-04T10:15:00', lastActivityAt: '2026-06-02T16:40:00',
    kyc: { status: 'stale', riskLevel: 'low', expiresAt: '2026-05-20' },
    criteria: { transaction: 'location', types: ['appartement'], cantons: ['VD'], cities: ['Lausanne'], budgetMax: 3200, roomsMin: 3 },
    tags: ['mobilité pro'], notes: 'Arrive de Milan pour un poste à l’EPFL. Bail souhaité au 1er septembre.',
    avatarBg: '#EC4899',
  },
  // Bailleur — il porte son rôle `landlord`, et la liste rangeant par rôle, il a
  // son entrée à lui au lieu de retomber sur `seller`. La teinte reprend #F59E0B
  // À DESSEIN : c'est la pire du jeu sous encre blanche (2,15:1), autant
  // qu'elle soit visible deux fois.
  {
    id: 'c-d02', type: 'landlord', roles: ['landlord'], firstName: 'Bernard', lastName: 'Held',
    email: 'b.held@swissonline.ch', phone: '+41 79 604 27 18', lang: 'de',
    status: 'active', score: 78, source: 'referral', assignedTo: 'agt-1',
    createdAt: '2026-02-11T08:30:00', lastActivityAt: '2026-06-05T09:05:00',
    kyc: { status: 'verified', riskLevel: 'low', expiresAt: '2027-02-11' },
    tags: ['multi-lots'], notes: 'Propriétaire de trois lots à Nyon. Souhaite déléguer la gérance complète.',
    avatarBg: '#F59E0B',
  },
]

export const DEMO_CONTACTS: CrmContact[] = [...CRM_CONTACTS, ...DEMO_CONTACTS_COMPLEMENT]

/**
 * Fiche contact de démonstration — l'entrée de `ContactDetailPager`, qui est
 * purement présentationnel (le conteneur porte les requêtes). Le harnais peut
 * donc l'alimenter directement, sans échafaudage dans le code de production.
 *
 * `verified: true` pour que le bluecheck soit rendu, et une identité LBA
 * complète pour que les neuf lignes du bloc Coordonnées portent une valeur —
 * un « — » partout ne dit rien de la composition.
 */
export const DEMO_FICHE: FicheContact = {
  id: 'c-001', firstName: 'Marie', lastName: 'Bertrand', verified: true,
  email: 'm.bertrand@bluewin.ch', phone: '+41 79 412 88 02',
  lang: 'fr', civ: 'mrs', canal: 'whatsapp',
  // Étape 3 (22.09.2026) : un seul rôle, celui qu'elle a déjà — ses critères sont ceux d'une
  // acquéreuse, et `coteDemande` s'accorde avec eux (le banc n'a pas de conteneur pour le
  // dériver). Sans rôle, la fiche du banc ne montrerait AUCUNE pastille et on lirait un
  // défaut d'affichage là où il n'y a qu'une fixture muette.
  audience: 'Acheteur', roles: ['buyer'], coteDemande: true, isTenant: false, avatarBg: '#0041D9',
  birth: '14.03.1986', nationality: 'CH', residence: 'CH',
  homeAddress: 'Rue du Rhône 42, 1204 Genève',
  photo: null,
  crit: {
    transaction: 'vente', types: ['appartement'], cantons: ['GE'],
    cities: ['Genève', 'Carouge'], budgetMin: 900000, budgetMax: 1300000,
    areaMin: 90, roomsMin: 4, mustHave: ['balcon', 'ascenseur'],
  },
  notes: 'Recherche un 4-5p pour la rentrée scolaire. Décision d’achat en couple, mari basé à Lausanne en semaine.',
  kycStatus: 'verified',
  lastContactAt: new Date(Date.now() - 86_400_000).toISOString(),
}

const JOUR_DEMO = 86_400_000
/**
 * L'instant UNIQUE de la démonstration : il date les lignes (`ilYAJours`) ET sert d'heure de lecture à
 * `construireSaBoucle`, comme `chargeLe` en production. Deux `Date.now()` distincts jugeraient un report contre
 * une autre heure que celle qui a daté les lignes.
 */
const MAINTENANT_DEMO = Date.now()
const ilYAJours = (j: number) => new Date(MAINTENANT_DEMO - j * JOUR_DEMO).toISOString()
/** Une annonce de démonstration, jointe à sa ligne comme PostgREST la rend. */
const annonceDemo = (titre: string, adresse: string, prix: number, photo: string | null | undefined) => ({
  title: titre, address: adresse, city: 'Genève', price: prix, current_price: prix, transaction_type: 'buy',
  photos: photo ? [photo] : null,
})
/**
 * La recherche de l'acheteuse de démonstration, d'où viennent toutes ses lignes. Ses critères sont ceux que corrige
 * « Apprendre » (`construireCorrections`) : deux refus « prix » non encore pris en compte, sur CETTE recherche, sous un
 * budget maximum qui reste au-dessus d'eux.
 */
const RECHERCHE_DEMO = 'cs-demo'
const CRITERES_DEMO = new Map<string, SearchCriteria | null>([
  [RECHERCHE_DEMO, { transaction_type: 'buy', budget_min: 900_000, budget_max: 1_300_000, zones: ['Genève', 'Carouge'] }],
])
const ligneDemo = (id: string, status: string, champs: Partial<LigneBoucleContact>): LigneBoucleContact => ({
  id, status, score: 90, sent_at: ilYAJours(4), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, apprentissage_at: null, client_search_id: RECHERCHE_DEMO, snoozed_until: null, property_id: null,
  market_listing_id: `ml-${id}`, ...champs,
})
const ACHETEUR_DEMO = { id: DEMO_FICHE.id, prenom: DEMO_FICHE.firstName, nom: DEMO_FICHE.lastName, telephone: null, email: null, kyc: 'none' as const }

/**
 * Boucle de match — page 1 de la fiche (« Sa boucle »). Les cinq états y sont : proposé (dont un en baisse depuis),
 * intéressé, visite planifiée, pas intéressé (motif et note) et un bien revenu par une baisse — plus une correction de
 * recherche, que fondent les deux refus « prix » (m7, m8).
 */
export const DEMO_FICHE_LOOP: SaBoucle = construireSaBoucle([
  ligneDemo('m1', 'sent', { prix_propose: 1_290_000, market_listing: annonceDemo('Appartement 4.5p — Eaux-Vives', 'Rue des Eaux-Vives 18', 1_250_000, DEMO_LISTING.photos?.[0]) }),
  ligneDemo('m2', 'sent', { sent_at: ilYAJours(6), prix_propose: 1_180_000, market_listing: annonceDemo('Duplex 5p — Carouge', 'Rue Ancienne 7', 1_180_000, DEMO_LISTING.photos?.[1]) }),
  ligneDemo('m3', 'interested', { sent_at: ilYAJours(8), response_at: ilYAJours(2), prix_propose: 1_350_000, market_listing: annonceDemo('Attique 4p — Plainpalais', 'Boulevard du Pont-d’Arve 5', 1_350_000, DEMO_LISTING.photos?.[2]) }),
  ligneDemo('m6', 'visit_planned', { sent_at: ilYAJours(10), response_at: ilYAJours(5), prix_propose: 1_150_000, market_listing: annonceDemo('Appartement 4p — Servette', 'Rue de la Servette 42', 1_150_000, null) }),
  ligneDemo('m4', 'rejected', { sent_at: ilYAJours(12), response_at: ilYAJours(10), reaction_motif: 'etat', reaction_note: 'Étage trop bas', prix_propose: 990_000, market_listing: annonceDemo('Appartement 3.5p — Champel', 'Avenue de Champel 30', 990_000, null) }),
  ligneDemo('m7', 'rejected', { sent_at: ilYAJours(14), response_at: ilYAJours(13), reaction_motif: 'prix', prix_propose: 1_280_000, market_listing: annonceDemo('Appartement 4.5p — Petit-Saconnex', 'Avenue Trembley 12', 1_280_000, null) }),
  ligneDemo('m8', 'rejected', { sent_at: ilYAJours(16), response_at: ilYAJours(15), reaction_motif: 'prix', prix_propose: 1_260_000, market_listing: annonceDemo('Appartement 4p — Jonction', 'Boulevard Carl-Vogt 70', 1_260_000, null) }),
  ligneDemo('m5', 'suggested', { sent_at: ilYAJours(20), response_at: ilYAJours(18), reaction_motif: 'prix', prix_propose: 1_450_000, market_listing: annonceDemo('Appartement 5p — Florissant', 'Route de Florissant 60', 1_390_000, null) }),
], CRITERES_DEMO, ACHETEUR_DEMO, MAINTENANT_DEMO)

/** La même fiche, boucle jamais démarrée. */
export const DEMO_FICHE_LOOP_VIDE: SaBoucle = construireSaBoucle([], new Map(), ACHETEUR_DEMO, MAINTENANT_DEMO)

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures du banc des modales (`/dev/modales`).
//
// ⚠ Elles n'existent QUE pour éprouver un piège de focus et un rendu. Aucune
// ne doit se mettre à ressembler à un jeu de données réaliste : dès qu'une
// fixture devient crédible, quelqu'un finit par lire son contenu comme un fait.
// ─────────────────────────────────────────────────────────────────────────────

/** Brouillon d'e-mail relu par `EmailReviewModal` (l'agent valide avant envoi). */
export const DEMO_AI_EMAIL = {
  subject: 'Suite à votre visite de l’attique de Plainpalais',
  body: 'Bonjour Marie,\n\nMerci pour votre visite de mardi. Comme convenu, je vous joins le dossier complet du bien : plans, charges détaillées et procès-verbal de la dernière assemblée.\n\nJe reste à disposition pour une seconde visite.\n\nBien à vous,\nGregory Lyonnet',
}

/** Texte d'annonce relu par `AnnonceReviewModal` avant enregistrement sur le bien. */
export const DEMO_AI_ANNONCE =
  'Attique de 4,5 pièces au dernier étage d’un immeuble de 2019, à deux pas de la plaine de Plainpalais. ' +
  'Séjour traversant ouvert sur une terrasse de 28 m² exposée sud-ouest, cuisine entièrement équipée, ' +
  'trois chambres dont une suite parentale. Cave et place de parc en sous-sol comprises.'

/** Courrier relu par `LetterReviewModal` (lettre papier, pas d'envoi automatisé). */
export const DEMO_AI_LETTER =
  'Genève, le 12 août 2026\n\nMadame, Monsieur,\n\n' +
  'Faisant suite à notre entretien téléphonique, je vous confirme la mise en vente du bien sis ' +
  'route de Chêne 44, et vous prie de trouver ci-joint le mandat de courtage pour signature.\n\n' +
  'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\nGregory Lyonnet'

/**
 * Carte d'action en attente, telle que le copilote la produit. `kind` décide du
 * verbe du bouton (« Publier » / « Retirer »), d'où deux fixtures et non une.
 */
export const DEMO_AI_PENDING_PUBLISH = {
  id: 'demo-pending-1', kind: 'publish', title: 'Attique · Plainpalais',
  portals: ['Homegate', 'ImmoScout24'],
  preview: 'Attique de 4,5 pièces, 118 m², terrasse 28 m² — CHF 1’950’000',
}
export const DEMO_AI_PENDING_DELETE = {
  id: 'demo-pending-2', kind: 'delete_contact', title: 'Marie Bertrand',
  portals: [],
  preview: 'Acheteuse · aucun deal ouvert · dernière activité il y a 8 mois',
}

/**
 * Dossier LAB/KYC minimal — il n'alimente que `SourceOfFundsOverlay`, qui n'en
 * lit QUE les trois champs « source des fonds ». Le reste est là parce que le
 * type l'exige, pas parce que l'écran s'en sert : ne pas y chercher un dossier
 * cohérent.
 */
export const DEMO_KYC_CASE: KycCase = {
  id: 'demo-kyc-banc', agency_id: 'demo-ag', transaction_id: 'demo-tx', contact_id: 'demo-c1',
  type: 'buyer_pp', risk_level: 'medium', status: 'in_progress', completion_pct: 60,
  validated_by: null, validated_at: null, created_at: '2026-07-01T09:00:00.000Z',
  pep_status: 'clear', pep_details: null, sanctions_status: 'clear', sanctions_details: null,
  last_screening_at: '2026-07-02T09:00:00.000Z', contact_nationality: 'CH',
  transaction_amount: 1950000, risk_score: 42, risk_factors: null, notes: null,
  vigilance: 'standard', expires_at: null, dossier_status: 'pending',
  source_of_funds_type: null, source_of_funds_description: null, source_of_funds_doc_id: null,
  ai_analysis: null,
}

/**
 * ⚠ DEUX documents, et un seul éligible. L'aperçu filtre sur
 * `document_category` (`financial` | `compliance`) : avec une liste homogène,
 * un filtre cassé rendrait exactement le même écran qu'un filtre correct.
 */
export const DEMO_KYC_DOCS: KycDocument[] = [
  {
    id: 'demo-doc-fin', agency_id: 'demo-ag', kyc_case_id: 'demo-kyc-banc', transaction_id: null,
    contact_id: 'demo-c1', property_id: null, name: 'Attestation de vente — étude Vermeil.pdf',
    type: 'pdf', storage_path: 'demo/attestation.pdf', size_bytes: 184320, uploaded_by: null,
    status: 'validated', created_at: '2026-07-03T10:00:00.000Z', issued_at: null, expires_at: null,
    document_category: 'financial', sha256_hash: null,
  },
  {
    id: 'demo-doc-id', agency_id: 'demo-ag', kyc_case_id: 'demo-kyc-banc', transaction_id: null,
    contact_id: 'demo-c1', property_id: null, name: 'Passeport.pdf',
    type: 'pdf', storage_path: 'demo/passeport.pdf', size_bytes: 92160, uploaded_by: null,
    status: 'validated', created_at: '2026-07-03T10:05:00.000Z', issued_at: null, expires_at: null,
    document_category: 'identity', sha256_hash: null,
  },
]

/**
 * Le fil de notes de la fiche de démonstration — les trois auteurs possibles, une note
 * modifiée, une note de l'agent connecté (la seule à porter Modifier / Supprimer).
 */
export const DEMO_NOTES: ContactNoteView[] = [
  { id: 'n3', body: 'Rappelée ce matin : visite confirmée jeudi 10h, elle viendra avec son mari.', authorKind: 'user', authorName: 'Gregory Lyonnet', mine: true, createdAt: '2026-09-16T08:12:00Z', updatedAt: '2026-09-16T08:20:00Z' },
  { id: 'n2', body: 'Financement confirmé par la BCGE, apport de 25 %.', authorKind: 'ai', authorName: null, mine: false, createdAt: '2026-09-14T17:40:00Z', updatedAt: null },
  { id: 'n1', body: 'Cherche un 4,5 pièces lumineux, proche des écoles de Champel.\nPas de rez-de-chaussée.', authorKind: 'user', authorName: 'Sophie Keller', mine: false, createdAt: '2026-09-02T09:05:00Z', updatedAt: null },
]
