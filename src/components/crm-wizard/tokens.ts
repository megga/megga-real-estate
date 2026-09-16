/**
 * Le MODÈLE de saisie d'un bien — partagé par « Nouveau bien » (bureau), le wizard mobile,
 * le brouillon automatique (`useWizardDraft`) et la publication (`usePublierWizard`).
 *
 * ⚠ Ce fichier portait aussi la palette, les étapes et les animations de l'ancien wizard
 * de bureau (`WizardShell` et ses sept étapes). Ils sont partis avec lui le 16.09.2026,
 * remplacés par « Nouveau bien » (`components/crm/biens/nouveau/`), qui peint avec la
 * palette du CRM. Il ne reste ici que ce qui décrit un BIEN EN COURS DE SAISIE — pas un écran.
 */

// ─── Wizard data shape ──────────────────────────────────────────────────
export interface WizardMandate {
  type: 'exclusive' | 'simple' | 'co'
  duration: number
  commission: number
  signed: boolean
  signedAt?: string
  fees: 'owner' | 'buyer'
  importedFile?: string | null
  extractedFields?: { key: string; label: string; value: string }[] | null
}

export interface WizardPhoto {
  id: string
  label: string
  kind: 'interior' | 'exterior' | 'plan'
  tone: string
  uploadedAt?: string
  // Vraie photo ajoutée par l'agent (dropzone PC). `file` est consommé à la
  // publication (upload bucket + miroir R2) ; `previewUrl` (object URL) sert
  // à l'aperçu dans le wizard ; `url` = URL persistée après upload réel. Une
  // tuile sans `file` ni `url` (placeholder mobile/drive) n'est JAMAIS
  // persistée — aucune photo fabriquée sur l'annonce.
  file?: File
  previewUrl?: string
  url?: string
}

export interface WizardOptions {
  featured: boolean
  videoTour: boolean
}

// Détails du bien — Q7 « Les détails du bien » (accordéon Step 3b). Sections
// STRICTEMENT conditionnelles au type (familles apt/house/terrain/commerce). Tous
// les champs sauf `ref`/`ext`/`equip`/`lux` sont optionnels (remplis au fil de l'eau).
// `ref` (MEG-2026-XXXX) est un IDENTIFIANT D'AFFICHAGE, pas la référence réelle du bien.
export interface WizardDetails {
  ref: string
  // Surfaces (m²), par famille
  sPPE?: number | null
  sHab?: number | null
  sUtile?: number | null
  sPond?: number | null
  sBalc?: number | null
  sTerr?: number | null
  sJard?: number | null
  sTerrain?: number | null
  // Informations générales
  standing?: string | null
  dispo?: string | null           // date « JJ.MM.AAAA » ou « À convenir »
  renovYear?: number | null
  charges?: number | null         // house / commerce
  // Pièces
  chambres?: number | null
  sdb?: number | null
  wc?: number | null
  // Extérieurs
  ext: string[]
  expo?: string | null
  // Stationnement
  pInt?: number | null
  pExt?: number | null
  pGarage?: number | null
  pBox?: number | null
  pVisit?: number | null
  borne?: boolean
  // Équipements
  equip: string[]
  // Immeuble (apt)
  etage?: number | null
  floors?: number | null
  chargesPPE?: number | null
  fondsReno?: number | null
  // Chauffage & énergie
  heat?: string | null
  floorHeat?: boolean
  pv?: boolean
  solarTherm?: boolean
  glazing?: string | null
  // Prestations de luxe (standing Luxe/Ultra-luxe)
  lux: string[]
}

export interface WizardData {
  // ⛔ `source`, `fromSubmissionId`, `importUrl` et `importFile` sont partis avec
  // l'étape « Démarrer » (12 août 2026) : elle était leur unique écrivain, et
  // les branches qui les lisaient — raccourcis vers le Mandat, retour arrière
  // vers la porte d'entrée — n'avaient plus de porte où retourner.
  ownerContactId: string | null
  /** Titre saisi par l'agent (« Nouveau bien ») ; vide = titre synthétisé (`wizardTitre`). */
  title?: string
  /** Agence partenaire en co-mandat (`naef` · `cardis` · `bernard`) ; NULL = l'agence du compte. */
  partnerAgency?: string | null
  _newContact: { id: string; firstName: string; lastName: string; email: string; phone: string; type: string; kyc: { status: string }; avatarBg: string } | null
  // Snapshot d'affichage du vendeur EXISTANT sélectionné (nom/avatar/kyc), figé
  // au moment du choix. Indispensable car les étapes aval (Mandat/Adresse/
  // Publication) ne peuvent PAS re-résoudre le contact par id : le registry
  // runtime (useContactsScreen) est vidé au démontage de Step1Vendor. Distinct
  // de _newContact (brouillon à créer) : ici le contact existe déjà (UUID réel).
  _ownerContact: { id: string; firstName: string; lastName: string; email: string; phone: string; type: string; kyc: { status: string }; avatarBg: string } | null
  mandate: WizardMandate
  addr: string
  addrConfirmed?: boolean
  addrStreet?: string
  addrHouseNumber?: string
  postCode: string
  city?: string
  canton: string
  cantonShort?: string
  country: string
  coords?: [number, number] | null
  unit?: string
  floor?: number | null
  floorsTotal?: number | null
  cadastralId?: string
  // 10 types (liste Gregory) regroupés en familles apt/house/terrain/commerce par
  // sp4bFamily (Step 3b). Le mapping vers l'enum DB `property_type` vit dans
  // TYPE_TO_ENUM (WizardShell) — étendre les DEUX ensemble.
  type: 'appartement' | 'attique' | 'duplex' | 'triplex' | 'loft' | 'maison' | 'villa' | 'chalet' | 'terrain' | 'commerce'
  area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  year: number | null
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  features: string[]
  /** Sous-parcours guidé de l'étape Caractéristiques (0→6 ; Q7 = accordéon détails). */
  specsQ?: number
  /** Détails du bien (Q7) — conditionnels au type, initialisés au montage du Step 3b. */
  det?: WizardDetails
  photos: WizardPhoto[]
  description: string
  aiAssist: boolean
  descTone?: 'neutre' | 'premium' | 'famille' | 'invest'
  transaction: 'vente' | 'location'
  /** Phase de l'étape Prix & Description (0 = prix en grand, 1 = description). */
  priceStep?: number
  price: number | null
  rent: number | null
  charges: number | null
  options: WizardOptions
  visibility: 'public' | 'network' | 'private'
  /**
   * Id de la ligne `properties` créée par le brouillon automatique
   * (`useWizardDraft`), posé dès la première adresse saisie. La publication met
   * cette ligne à jour au lieu d'en créer une seconde.
   *
   * ⚠ Remplace `publishMode` ('now' | 'schedule' | 'draft'), retiré le 11 août
   * 2026. Deux de ses trois valeurs écrivaient le MÊME `status: 'draft'` :
   * « Programmer » promettait une mise en ligne différée qu'aucun cron n'a
   * jamais assurée, et « Brouillon » demandait à l'agent de choisir, à la
   * dernière étape, l'état dans lequel son travail se trouvait déjà.
   */
  _draftId?: string
}

export const EMPTY_WIZARD: WizardData = {
  ownerContactId: null, _newContact: null, _ownerContact: null,
  mandate: { type: 'exclusive', duration: 6, commission: 3.5, signed: false, fees: 'owner' },
  addr: '', canton: 'Vaud', postCode: '', country: 'Suisse',
  type: 'appartement', area: null, rooms: null, bedrooms: null, bathrooms: null,
  year: null, energy: null, features: [],
  photos: [], description: '', aiAssist: false,
  transaction: 'vente', price: null, rent: null, charges: null,
  options: { featured: false, videoTour: false },
  visibility: 'public',
}
