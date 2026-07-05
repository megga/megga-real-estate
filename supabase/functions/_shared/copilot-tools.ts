// Catalogue d'outils du copilote WEB (ai-copilot) — module PUR, testable vitest.
//
// v1 = LECTURE SEULE : un sous-ensemble read du catalogue WhatsApp (réutilisé tel
// quel, exécuteurs canal-agnostiques de whatsapp-actions.ts) + 3 outils web
// spécifiques branchés sur les RPC/vues déjà en production (focus_top_matches,
// analytics_*, market_rent_stats / match_candidate_listings).
//
// Le tier vit dans webToolTier() : les 3 outils web sont 'read', tout le reste
// hérite de toolTier() (fail-safe : inconnu = confirm = refusé par la boucle).

import { WHATSAPP_TOOLS, type DeepSeekTool } from './whatsapp-tools.ts'
import { toolTier } from './whatsapp-agent-router.ts'

export type { DeepSeekTool }

// Sous-ensemble WhatsApp réutilisé (tous tier 'read' — vérifié par un test).
export const SHARED_READ_TOOLS = [
  'get_my_agenda',
  'search_contacts',
  'get_contact_brief',
  'list_followups',
  'get_matches',
  'get_daily_brief',
  'search_listings',
  'get_kyc_status',
  'get_publication_status',
  'prepare_meeting',
  'draft_listing_copy',
] as const

// Descriptions à ajuster pour le web : on retire les références aux outils
// WhatsApp absents du catalogue web (ex. send_listings) pour ne pas inviter le
// modèle à appeler un outil qui n'existe pas ici.
const WEB_DESCRIPTION_OVERRIDES: Record<string, string> = {
  search_listings:
    "Recherche des biens sur le marché (annonces) par critères. Pour « trouve un 3,5 pièces à Carouge en location sous 2500 », « des bureaux à Lausanne », « combien d'appartements à Lausanne ». Interroge l'inventaire MARCHÉ réel (les annonces du marché, PAS le CRM de l'agence). Renvoie le NOMBRE TOTAL ESTIMÉ de biens correspondants (champ `total`) en plus d'un échantillon de biens réels (`biens`) ; annonce ce total à l'agent. N'invente jamais de bien.",
  // Réécrits pour le web : sur WhatsApp l'agent envoie les photos dans le message
  // (attach_property_photos) ; sur le web, les photos se gèrent dans la fiche du bien.
  create_property:
    "Crée un NOUVEAU bien (brouillon) dans le CRM de l'agence à partir de ce que l'agent DICTE. Pour « crée un 3 pièces aux Eaux-Vives en location à 2400 », « ajoute une villa à Cologny en vente ». NE remplis QUE les champs donnés par l'agent — n'invente JAMAIS. Sans titre, il est composé du type + pièces + localité. Le bien est créé en BROUILLON : l'agent complète ensuite les champs manquants (update_property), ajoute les photos dans la fiche du bien, puis le publie.",
  update_property:
    "Met à jour ou complète les champs d'un bien de l'agence (finir une annonce avant publication, corriger une info). NE passe QUE les champs que l'agent te donne EXPLICITEMENT — n'invente JAMAIS de valeur. Le bien est cherché par titre/adresse. Ex. « pour le 3 pièces des Eaux-Vives, NPA 1207 et loyer 2400 », « corrige la surface du bien de Champel à 95 m² ». Utile quand publier échoue faute d'une info : l'agent la donne, tu complètes, puis il republie.",
  draft_listing_copy:
    "Rédige le CONTENU d'une annonce immobilière (titre marketing + description + grille de détails) pour un bien des mandats de l'agence, à partir de ses VRAIES données. Deux variantes : 'confidential' (sans coordonnées ni adresse exacte) ou 'public'. Si la variante n'est pas précisée, DEMANDE-la. C'est pour l'agent, pas pour un client. Pour ENREGISTRER la copie sur le bien, appelle ensuite update_property avec le titre et la description rédigés.",
  // Publication : action SORTANTE. Le modèle appelle l'outil ; la validation est une
  // CARTE dans le panneau, jamais un « oui » texte. On lui interdit de se confirmer.
  publish_to_portals:
    "Publie un bien de l'agence sur immobilier.ch (syndication IDX). Pour « publie le 3 pièces des Eaux-Vives sur immobilier.ch », « mets ce bien en ligne ». Le bien est cherché dans les biens de l'agence (titre/adresse). Il faut un bien avec des données complètes (titre, prix, adresse, ≥1 photo). Appelle directement l'outil : l'agent verra une CARTE d'aperçu de l'annonce et devra cliquer « Publier » pour valider. NE te confirme JAMAIS toi-même et ne prétends pas que c'est en ligne tant que l'agent n'a pas validé.",
  withdraw_from_portals:
    "Retire un bien de la publication sur immobilier.ch (il disparaîtra au prochain import du portail). Pour « retire le bien de Champel d'immobilier.ch », « dépublie ce bien ». Le bien est cherché dans les biens de l'agence. Appelle directement l'outil : l'agent devra valider le retrait dans une carte. Ne te confirme pas toi-même.",
}

const WEB_ONLY_TOOLS: DeepSeekTool[] = [
  {
    type: 'function',
    function: {
      name: 'suggest_priorities_today',
      description:
        "File de priorités RÉELLE de l'agent aujourd'hui : meilleurs matches actionnables (score de bien + score de lead, raisons explicables, signaux KYC non bloquants) + rappels du jour. Pour « par quoi je commence ? », « mes priorités du jour », « quel client relancer en premier ? ». Les scores sont des ESTIMATIONS internes : présente-les comme telles ou tais-les.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Nombre de priorités à renvoyer (défaut 8, max 15).' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_analytics_snapshot',
      description:
        "Chiffres RÉELS du cockpit de l'agent : commission projetée vs objectif, funnel, deltas vs période précédente. Pour « où j'en suis sur mon objectif ? », « combien j'ai signé ce trimestre ? », « mon pipeline vaut combien ? ». Cite les montants EXACTS renvoyés (format CHF 720'000), jamais de chiffre inventé.",
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['month', 'quarter', 'year'], description: 'Période (défaut month).' },
          scope: { type: 'string', enum: ['me', 'agency'], description: "Périmètre : moi seul ou toute l'agence (défaut me)." },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_market_stats',
      description:
        "Statistiques de marché RÉELLES calculées sur les annonces actives (~dizaines de milliers, sync quotidienne) : médiane et fourchette du prix ou du loyer au m² pour une zone (NPA/ville/canton), nombre de comparables, et position d'un bien si prix+surface fournis. Pour « ce loyer est-il correct ? », « le prix au m² à Carouge ? », « ce bien est-il au-dessus du marché ? ». Chiffres 100% calculés (jamais estimés par toi) ; si l'échantillon est insuffisant, l'outil le dit — relaie-le honnêtement.",
      parameters: {
        type: 'object',
        properties: {
          transaction_type: { type: 'string', enum: ['rent', 'buy'], description: 'location (rent) ou achat/vente (buy).' },
          property_type: { type: 'string', description: 'Type en français : appartement, maison, villa… (défaut appartement).' },
          canton: { type: 'string', description: 'Canton (ex. GE, VD). Obligatoire si pas de ville.' },
          city: { type: 'string', description: 'Localité (ex. Carouge).' },
          postal_code: { type: 'string', description: 'NPA suisse (4 chiffres) — affine le locatif.' },
          surface_m2: { type: 'number', description: 'Surface du bien à positionner (optionnel).' },
          amount: { type: 'number', description: 'Loyer mensuel (rent) ou prix (buy) du bien à positionner (optionnel).' },
          rooms: { type: 'number', description: 'Nombre de pièces (optionnel, filtre indicatif).' },
        },
        required: ['transaction_type'],
      },
    },
  },
]

const WEB_ONLY_NAMES = new Set(WEB_ONLY_TOOLS.map((t) => t.function.name))

// Outils d'ÉCRITURE (tier 'auto' — écritures CRM internes réversibles, jamais un
// envoi client ni une publication externe) : create_reminder/add_note (Phase 4a) +
// create_property/update_property (monter une annonce = brouillon de bien + champs,
// avant publication). Exposés QUE si les écritures sont activées (copilot_writes_enabled).
export const SHARED_WRITE_TOOLS = ['create_reminder', 'add_note', 'create_property', 'update_property'] as const

// Outils de PUBLICATION externe (tier 'confirm' — action SORTANTE vers immobilier.ch).
// JAMAIS exécutés dans la boucle : préparés (aperçu de l'annonce) puis VALIDÉS par
// l'agent via une carte HITL (copilot_pending_actions → execute_pending). Exposés QUE
// si copilot_publish_enabled. get_publication_status (lecture) reste dans les read.
export const PUBLISH_TOOLS = ['publish_to_portals', 'withdraw_from_portals'] as const

// Applique l'override de description web s'il existe (sinon garde l'outil tel quel).
// Appliqué aux DEUX catalogues (read ET write) : sinon un outil d'écriture réutilisé
// garderait sa description WhatsApp (ex. create_property renvoyant vers un outil photo
// WhatsApp inexistant côté web).
const withWebDescription = (t: DeepSeekTool): DeepSeekTool =>
  WEB_DESCRIPTION_OVERRIDES[t.function.name]
    ? { ...t, function: { ...t.function, description: WEB_DESCRIPTION_OVERRIDES[t.function.name] } }
    : t

const READ_CATALOG: DeepSeekTool[] = [
  ...WHATSAPP_TOOLS
    .filter((t) => (SHARED_READ_TOOLS as readonly string[]).includes(t.function.name))
    .map(withWebDescription),
  ...WEB_ONLY_TOOLS,
]
const WRITE_CATALOG: DeepSeekTool[] = WHATSAPP_TOOLS
  .filter((t) => (SHARED_WRITE_TOOLS as readonly string[]).includes(t.function.name))
  .map(withWebDescription)
const PUBLISH_CATALOG: DeepSeekTool[] = WHATSAPP_TOOLS
  .filter((t) => (PUBLISH_TOOLS as readonly string[]).includes(t.function.name))
  .map(withWebDescription)

/** Catalogue read-only (compat) — équivaut à copilotTools(false). */
export const COPILOT_TOOLS: DeepSeekTool[] = READ_CATALOG

/** Catalogue function-calling passé à DeepSeek.
 *  `writesEnabled` ajoute les écritures internes réversibles (create_reminder,
 *  add_note, create_property, update_property — tier auto). `publishEnabled` ajoute
 *  la publication externe (publish_to_portals, withdraw_from_portals — tier confirm,
 *  JAMAIS exécutée dans la boucle : validée par carte HITL). */
export function copilotTools(writesEnabled: boolean, publishEnabled = false): DeepSeekTool[] {
  const tools = [...READ_CATALOG]
  if (writesEnabled) tools.push(...WRITE_CATALOG)
  if (publishEnabled) tools.push(...PUBLISH_CATALOG)
  return tools
}

/** Tier web : outils web = read ; le reste hérite du registre WhatsApp
 *  (fail-safe : inconnu = confirm → refusé par la boucle). create_reminder/add_note
 *  y sont déjà 'auto'. */
export function webToolTier(name: string): string {
  if (WEB_ONLY_NAMES.has(name)) return 'read'
  return toolTier(name)
}

// Bloc system ajouté quand les outils sont actifs. Complète MEGGA_SYSTEM sans le
// contredire : chiffres exacts, anti-fabrication ciblée, périmètre d'écriture
// explicite selon le mode.
const TOOLS_BLOCK_BASE = `

OUTILS (accès CRM en direct) :
Tu disposes d'outils sur le vrai CRM de l'agent (contacts, agenda, matches, KYC, marché, chiffres). Règles :
- Pour toute question sur SES données (contacts, dossiers, agenda, priorités, objectif, marché local), appelle l'outil approprié au lieu de deviner. Cite les chiffres EXACTS renvoyés, n'invente JAMAIS une donnée de portefeuille.
- N'appelle pas plus d'outils que nécessaire (souvent 1 à 2 suffisent) ; ne rappelle jamais un outil déjà utilisé ce tour : avec les résultats en main, rédige ta réponse.
- search_contacts : si plusieurs contacts correspondent, liste les noms et demande lequel — ne devine JAMAIS avant d'écrire quoi que ce soit.
- get_contact_brief / suggest_priorities_today : les scores sont des ESTIMATIONS internes — présente-les comme telles ou tais-les. N'expose jamais la mécanique interne du scoring.
- get_market_stats : relaie la médiane, la fourchette et le NOMBRE de comparables tels quels ; si l'outil dit « échantillon insuffisant », dis-le honnêtement au lieu d'improviser un chiffre.
- Ne montre jamais d'identifiants techniques bruts (UUID) à l'agent — utilise les noms.`

const TOOLS_BLOCK_READONLY = `
- Tu n'as AUCUN outil d'écriture ni d'envoi : si l'agent demande une action (créer un rappel, envoyer un message, déplacer un dossier), prépare le contenu si utile et indique où le faire dans le CRM. Ne prétends JAMAIS avoir effectué une action.`

const TOOLS_BLOCK_WRITES = `
- Tu peux effectuer des écritures internes réversibles quand l'agent te le demande explicitement : create_reminder (rappel/tâche), add_note (note sur une fiche contact), create_property (créer un bien en BROUILLON) et update_property (compléter/corriger les champs d'un bien). Ce sont des actions INTERNES au CRM — aucun message envoyé à un client, aucune publication externe. Appelle directement l'outil ; confirme en une phrase après coup.
- create_property / update_property : ne remplis QUE les champs que l'agent DICTE (type, prix, pièces, surface, adresse, NPA…) — n'invente JAMAIS de valeur. Le bien reste un BROUILLON non publié ; la mise en ligne sur un portail est une étape séparée, validée à part.
- Tu n'as AUCUN autre pouvoir d'action : tu ne contactes JAMAIS un client, tu n'envoies aucun email/message, tu ne déplaces aucun dossier dans le pipeline, tu ne valides aucun KYC. Pour ça, prépare le contenu et dis à l'agent de le faire lui-même.
- Avant add_note/create_reminder sur un contact, obtiens son id via search_contacts ; si plusieurs correspondent, demande lequel — n'écris jamais sur un contact deviné.`

const TOOLS_BLOCK_PUBLISH = `
- PUBLICATION (immobilier.ch) : tu peux publier un bien de l'agence (publish_to_portals) ou l'en retirer (withdraw_from_portals). Action SORTANTE vers un portail externe, donc JAMAIS immédiate : tu la PRÉPARES en appelant l'outil, puis l'agent voit une carte d'aperçu de l'annonce et clique « Publier » (ou « Annuler ») pour valider. NE dis jamais qu'un bien est publié/retiré tant que l'agent n'a pas validé, et ne te confirme jamais toi-même. Publier exige un bien complet (titre, prix, adresse, au moins une photo).`

// Suffixe « info manquante » : ne mentionne update_property QUE si les écritures sont
// actives (sinon le prompt inviterait à un outil absent du catalogue — cf. revue).
const PUBLISH_MISSING_WITH_WRITES = ` S'il manque une info, complète-la (update_property) ou fais ajouter les photos dans la fiche du bien, puis relance la publication.`
const PUBLISH_MISSING_NO_WRITES = ` S'il manque une info, dis à l'agent de compléter la fiche du bien (champs + photos), puis relance la publication.`

/** Bloc system selon le mode. `writesEnabled` bascule le périmètre d'écriture interne ;
 *  `publishEnabled` ajoute le volet publication externe (validée par carte HITL). Composé
 *  pour ne jamais se contredire (pas de « aucune écriture » quand la publication est on ;
 *  pas de mention update_property quand les écritures sont coupées). */
export function copilotToolsBlock(writesEnabled: boolean, publishEnabled = false): string {
  let block = TOOLS_BLOCK_BASE
  if (writesEnabled) block += TOOLS_BLOCK_WRITES
  else if (!publishEnabled) block += TOOLS_BLOCK_READONLY
  if (publishEnabled) block += TOOLS_BLOCK_PUBLISH + (writesEnabled ? PUBLISH_MISSING_WITH_WRITES : PUBLISH_MISSING_NO_WRITES)
  return block
}

/** Compat (mode lecture seule). */
export const COPILOT_TOOLS_BLOCK = copilotToolsBlock(false)
