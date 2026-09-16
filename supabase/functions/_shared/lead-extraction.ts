// Extraction de lead — prompt et lecture de la réponse du modèle. Pur : aucun I/O,
// aucune clé, testable sans réseau. L'exécuteur est supabase/functions/extract-lead.
//
// POURQUOI CE MODULE (16.09.2026). La fiche express des Contacts préremplit désormais
// TOUTE la fiche client depuis un message collé — civilité, langue, canal, budget
// min/max, surface, types de bien, cantons, communes, indispensables, nationalité,
// résidence, adresses. Julien : « ce n'est pas une note : plus il y a d'éléments dans
// la fiche, mieux c'est ». Le schéma passe de 11 à 25 champs ; il sort de l'edge pour
// être éprouvé champ par champ, ce que personne ne faisait (aucun test n'existait).
//
// ⚠ RÉTROCOMPATIBLE. Les 11 champs d'origine gardent leur nom, leur type et leur sens
// (`budget` = le MAXIMUM, `rooms`, `zone`) : « Importer des leads » les lit tels quels.
// Tout champ ajouté a une valeur neutre ('' / null / []).
//
// ⛔ CE QUI NE S'EXTRAIT PAS, PAR CONSTRUCTION : la DATE DE NAISSANCE. `redactPII` la
// masque avant l'appel au modèle (motif DOB), et c'est voulu — elle n'a pas à quitter la
// Suisse pour préremplir une case. Le modèle ne la voit jamais ; ne pas l'ajouter ici.
//
// ⛔ ANTI-HALLUCINATION. E-mail et téléphone doivent apparaître tels quels dans le texte
// (A4). Les ADRESSES aussi, mot à mot au sens large : chaque mot porteur doit figurer
// dans le message, accents ignorés — une rue « plausible » inventée ne passe pas.
// Cantons, types, langue, canal et indispensables sont bornés à un vocabulaire fermé.

export type LeadIntent = 'buyer' | 'seller' | 'tenant'
export type LeadUrgency = 'high' | 'medium' | 'normal'
export type LeadNextAction = 'call' | 'visit' | 'match' | 'kyc'
export type LeadCivility = 'mr' | 'mrs' | ''
export type LeadLanguage = 'fr' | 'de' | 'en' | 'it' | ''
export type LeadChannel = 'whatsapp' | 'sms' | 'call' | 'email' | ''
export type LeadPropertyType = 'apartment' | 'house' | 'land' | 'commercial'

/** Les indispensables que la fiche contact sait afficher (`CD_MUSTHAVE`) et le matching lire. */
export const LEAD_FEATURES = ['balcon', 'ascenseur', 'parking', 'jardin', 'terrasse', 'cave', 'garage', 'vue lac'] as const

const CANTONS = new Set([
  'GE', 'VD', 'VS', 'NE', 'FR', 'JU', 'BE', 'ZH', 'LU', 'ZG', 'SO', 'BS', 'BL',
  'AG', 'SZ', 'UR', 'OW', 'NW', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
])

export interface ExtractedLeadFields {
  // ── Les 11 champs d'origine (contrat d'« Importer des leads ») ──
  firstName: string
  lastName: string
  email: string
  phone: string
  intent: LeadIntent
  /** CHF entier — le MAXIMUM (loyer mensuel si locataire, prix si vendeur). */
  budget: number | null
  rooms: number | null
  /** Lieux cités, joints — conservé pour « Importer des leads ». */
  zone: string
  urgency: LeadUrgency
  nextAction: LeadNextAction
  /** 0-1, jamais affiché en UI, audit seulement. */
  confidence: number
  // ── Ajoutés le 16.09.2026 ──
  civility: LeadCivility
  /** Langue dans laquelle le message est ÉCRIT. */
  language: LeadLanguage
  /** Canal de contact que l'auteur DEMANDE explicitement, sinon ''. */
  preferredChannel: LeadChannel
  budgetMin: number | null
  surfaceMin: number | null
  propertyTypes: LeadPropertyType[]
  /** Codes de canton (GE, VD…), y compris déduits d'une commune suisse citée. */
  cantons: string[]
  /** Communes ou quartiers cités, sans les noms de canton. */
  cities: string[]
  features: string[]
  /** ISO 3166-1 alpha-2, seulement si le message la DIT. */
  nationality: string
  residenceCountry: string
  /** Adresse de DOMICILE de l'auteur, pas celle d'un bien. */
  homeAddress: string
  /** Adresse du bien qu'un vendeur ou un bailleur propose. */
  propertyAddress: string
}

export const LEAD_SYSTEM_PROMPT = `Tu reçois un message brut (email, SMS, formulaire web, transcription WhatsApp) envoyé à une agence immobilière suisse.
Extrais les champs suivants au format JSON strict (uniquement du JSON, aucun texte avant ou après).
Si un champ est absent du message, renvoie "" , null ou [] selon son type.

Schéma exact attendu :
{
  "firstName": string,
  "lastName": string,
  "email": string,              // adresse email valide OU "" si absente
  "phone": string,              // numéro tel quel (avec espaces/préfixe) OU "" si absent
  "intent": "buyer" | "seller" | "tenant",
  "budget": number | null,      // CHF entier, le MAXIMUM (loyer mensuel si tenant, prix souhaité si seller)
  "budgetMin": number | null,   // CHF entier, seulement si une fourchette est donnée ("entre 900k et 1.2M")
  "rooms": number | null,       // nombre de pièces minimum, ex. 4, 3.5, 2.5
  "surfaceMin": number | null,  // m² minimum
  "propertyTypes": ["apartment" | "house" | "land" | "commercial"],
  "zone": string,               // lieux cités, séparés par des virgules
  "cantons": [string],          // codes à 2 lettres des cantons suisses cités OU dont une commune est citée (Carouge → GE, Pully → VD)
  "cities": [string],           // communes ou quartiers cités, orthographe correcte avec accents, SANS les noms de canton
  "features": [string],         // UNIQUEMENT parmi : ${LEAD_FEATURES.map((f) => `"${f}"`).join(', ')}
  "civility": "mr" | "mrs" | "", // seulement si Monsieur/Madame/M./Mme ou une signature l'indique
  "language": "fr" | "de" | "en" | "it" | "", // langue dans laquelle le message est écrit
  "preferredChannel": "whatsapp" | "sms" | "call" | "email" | "", // seulement si l'auteur demande explicitement ce canal
  "nationality": string,        // code ISO 3166-1 alpha-2 (CH, FR…) seulement si la nationalité est dite
  "residenceCountry": string,   // code ISO 3166-1 alpha-2 seulement si le pays de résidence est dit
  "homeAddress": string,        // adresse de domicile de l'auteur telle qu'écrite, sinon ""
  "propertyAddress": string,    // adresse du bien qu'il vend ou loue telle qu'écrite, sinon ""
  "urgency": "high" | "medium" | "normal",
  "nextAction": "call" | "visit" | "match" | "kyc",
  "confidence": number          // 0.0 à 1.0 — TON estimation de la qualité d'extraction
}

RÈGLES :
- intent : 'buyer' si l'auteur cherche à ACHETER ; 'seller' si "vendre / mandat / mon appartement / ma maison" ; 'tenant' si "louer / loyer / charges comprises".
- propertyTypes : appartement, studio, attique, duplex → "apartment" ; maison, villa, chalet → "house" ; terrain → "land" ; bureau, arcade, local commercial → "commercial".
- features : "balcon" aussi pour loggia ; "vue lac" pour toute vue sur un lac ; "parking" pour place de parc extérieure ; "garage" pour box ou parking couvert.
- urgency : 'high' si "rapidement / urgent / cette semaine / asap / fin du mois" ; 'medium' si "dans X mois / au printemps / cet été" ; 'normal' sinon.
- nextAction : 'visit' si urgency=high et intent=buyer ; 'call' si intent=seller ou premier contact ; 'match' si critères clairs (budget+pièces+zone) ; 'kyc' si offre/signature/compromis mentionnés.
- confidence : sois honnête. Court message ambigu = 0.3-0.5. Email détaillé avec nom complet, email valide, budget précis = 0.85-1.0.

AUCUNE INVENTION : si une info n'est pas dans le texte, laisse vide/null/[]. Tu ne devines pas un email, une adresse, une nationalité ni une civilité plausibles.
Si le texte contient des marqueurs [REDACTED:XXX], traite-les comme des trous neutres — ne tente PAS de reconstruire la donnée.`

/** Minuscules sans diacritiques ni espaces superflus. */
function plier(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Double-pass (A4) : un e-mail ou un téléphone extrait doit apparaître dans le texte
 * source (casse et espaces ignorés). Sinon '' — anti-hallucination.
 */
export function verifyVerbatim(extractedValue: string, sourceText: string): string {
  if (!extractedValue) return ''
  const v = extractedValue.toLowerCase().replace(/\s+/g, '')
  const s = sourceText.toLowerCase().replace(/\s+/g, '')
  return s.includes(v) ? extractedValue : ''
}

/**
 * Une adresse extraite passe si CHAQUE mot porteur (lettres ≥ 3, ou nombre) figure
 * dans le texte, accents et casse ignorés. Plus souple que le verbatim — le modèle
 * peut remettre une virgule ou une majuscule —, assez strict pour refuser une rue
 * qu'il aurait complétée de lui-même.
 */
export function verifyAddress(extractedValue: string, sourceText: string): string {
  const v = extractedValue.trim()
  if (!v) return ''
  const source = plier(sourceText)
  const mots = plier(v).split(/[^\p{L}\p{N}]+/u).filter((m) => /\d/.test(m) || m.length >= 3)
  if (mots.length === 0) return ''
  return mots.every((m) => source.includes(m)) ? v.slice(0, 160) : ''
}

const montant = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : null)
const chaine = (x: unknown, max = 80): string => (typeof x === 'string' ? x.trim().slice(0, max) : '')
const liste = (x: unknown): string[] => (Array.isArray(x) ? x.filter((e): e is string => typeof e === 'string').map((e) => e.trim()).filter(Boolean) : [])

export interface LeadParseResult {
  fields: ExtractedLeadFields
  /**
   * Valeurs d'énumération rejetées par le narrowing (ex. intent='investor' → 'buyer').
   * Journalisées pour tracer les divergences modèle ↔ contrat (audit Sprint 3a §C.3).
   * ⚠ Seulement des énumérations : aucune valeur libre (nom, adresse) n'y entre.
   */
  coercions: Array<{ field: string; rawValue: unknown; coercedTo: string }>
}

/** Lit la réponse JSON du modèle et la borne au contrat ; `null` si ce n'est pas du JSON. */
export function parseLeadExtraction(rawJson: string, sourceText: string): LeadParseResult | null {
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    const brut: unknown = JSON.parse(cleaned)
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
    parsed = brut as Record<string, unknown>
  } catch {
    return null
  }

  const coercions: LeadParseResult['coercions'] = []
  /** Borne une énumération ; une valeur non vide hors liste est tracée puis remplacée. */
  function enumere<T extends string>(field: string, valeurs: readonly T[], repli: T): T {
    const x = parsed[field]
    if (typeof x === 'string' && (valeurs as readonly string[]).includes(x)) return x as T
    if (x !== undefined && x !== null && x !== '') coercions.push({ field, rawValue: x, coercedTo: repli })
    return repli
  }

  const intent = enumere<LeadIntent>('intent', ['buyer', 'seller', 'tenant'], 'buyer')
  const urgency = enumere<LeadUrgency>('urgency', ['high', 'medium', 'normal'], 'normal')
  const nextAction = enumere<LeadNextAction>('nextAction', ['call', 'visit', 'match', 'kyc'], 'call')
  const civility = enumere<LeadCivility>('civility', ['mr', 'mrs', ''], '')
  const language = enumere<LeadLanguage>('language', ['fr', 'de', 'en', 'it', ''], '')
  const preferredChannel = enumere<LeadChannel>('preferredChannel', ['whatsapp', 'sms', 'call', 'email', ''], '')

  const budget = montant(parsed.budget)
  let budgetMin = montant(parsed.budgetMin)
  // Une fourchette à l'envers n'est pas une fourchette : on garde le maximum seul.
  if (budgetMin !== null && budget !== null && budgetMin > budget) budgetMin = null

  // ⚠ Contrôlé sur la valeur ENTIÈRE : couper d'abord à deux lettres ferait de « France » un
  // « FR » et de « CHE » un « CH » — un code plausible fabriqué par la lecture elle-même.
  const iso = (x: unknown) => { const c = typeof x === 'string' ? x.trim().toUpperCase() : ''; return /^[A-Z]{2}$/.test(c) ? c : '' }
  const typesValides: LeadPropertyType[] = ['apartment', 'house', 'land', 'commercial']

  const fields: ExtractedLeadFields = {
    firstName: chaine(parsed.firstName),
    lastName: chaine(parsed.lastName),
    email: verifyVerbatim(chaine(parsed.email, 120), sourceText),
    phone: verifyVerbatim(chaine(parsed.phone, 40), sourceText),
    intent,
    budget,
    rooms: typeof parsed.rooms === 'number' && parsed.rooms > 0 && parsed.rooms < 50 ? parsed.rooms : null,
    zone: chaine(parsed.zone, 160),
    urgency,
    nextAction,
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    civility,
    language,
    preferredChannel,
    budgetMin,
    surfaceMin: montant(parsed.surfaceMin),
    propertyTypes: [...new Set(liste(parsed.propertyTypes).filter((t): t is LeadPropertyType => (typesValides as string[]).includes(t)))],
    cantons: [...new Set(liste(parsed.cantons).map((c) => c.toUpperCase()).filter((c) => CANTONS.has(c)))],
    cities: [...new Set(liste(parsed.cities).map((c) => c.slice(0, 60)))]
      // Un nom de canton rangé en commune (« Genève » ville ET canton) reste une commune ;
      // un CODE (« GE ») n'en est pas une.
      .filter((c) => !CANTONS.has(c.toUpperCase())).slice(0, 8),
    features: [...new Set(liste(parsed.features).map((f) => f.toLowerCase()).filter((f) => (LEAD_FEATURES as readonly string[]).includes(f)))],
    nationality: iso(parsed.nationality),
    residenceCountry: iso(parsed.residenceCountry),
    homeAddress: verifyAddress(chaine(parsed.homeAddress, 200), sourceText),
    propertyAddress: verifyAddress(chaine(parsed.propertyAddress, 200), sourceText),
  }

  return { fields, coercions }
}
