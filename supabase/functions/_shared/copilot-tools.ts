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
] as const

// Descriptions à ajuster pour le web : on retire les références aux outils
// WhatsApp absents du catalogue web (ex. send_listings) pour ne pas inviter le
// modèle à appeler un outil qui n'existe pas ici.
const WEB_DESCRIPTION_OVERRIDES: Record<string, string> = {
  search_listings:
    "Recherche des biens sur le marché (annonces) par critères. Pour « trouve un 3,5 pièces à Carouge en location sous 2500 », « des bureaux à Lausanne », « combien d'appartements à Lausanne ». Interroge l'inventaire MARCHÉ réel (les annonces du marché, PAS le CRM de l'agence). Renvoie le NOMBRE TOTAL ESTIMÉ de biens correspondants (champ `total`) en plus d'un échantillon de biens réels (`biens`) ; annonce ce total à l'agent. N'invente jamais de bien.",
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

// Outils d'ÉCRITURE v1 (tier 'auto' — écritures CRM internes réversibles, jamais
// un envoi client). Volontairement limité aux deux moins ambigus (Phase 4a). Ils
// ne sont exposés QUE si les écritures sont activées (flag copilot_writes_enabled).
export const SHARED_WRITE_TOOLS = ['create_reminder', 'add_note'] as const

const READ_CATALOG: DeepSeekTool[] = [
  ...WHATSAPP_TOOLS
    .filter((t) => (SHARED_READ_TOOLS as readonly string[]).includes(t.function.name))
    .map((t) => (WEB_DESCRIPTION_OVERRIDES[t.function.name]
      ? { ...t, function: { ...t.function, description: WEB_DESCRIPTION_OVERRIDES[t.function.name] } }
      : t)),
  ...WEB_ONLY_TOOLS,
]
const WRITE_CATALOG: DeepSeekTool[] = WHATSAPP_TOOLS
  .filter((t) => (SHARED_WRITE_TOOLS as readonly string[]).includes(t.function.name))

/** Catalogue read-only (compat) — équivaut à copilotTools(false). */
export const COPILOT_TOOLS: DeepSeekTool[] = READ_CATALOG

/** Catalogue function-calling passé à DeepSeek. `writesEnabled` ajoute les outils
 *  d'écriture auto (create_reminder, add_note) ; sinon lecture seule. */
export function copilotTools(writesEnabled: boolean): DeepSeekTool[] {
  return writesEnabled ? [...READ_CATALOG, ...WRITE_CATALOG] : READ_CATALOG
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
- Tu peux effectuer DEUX écritures internes réversibles quand l'agent te le demande explicitement : create_reminder (créer un rappel/tâche) et add_note (ajouter une note à la fiche d'un contact). Ce sont des actions INTERNES au CRM (aucun message n'est envoyé à un client). Appelle directement l'outil ; confirme en une phrase après coup.
- Tu n'as AUCUN autre pouvoir d'action : tu ne contactes JAMAIS un client, tu n'envoies aucun email/message, tu ne modifies ni prix ni étape de pipeline, tu ne valides aucun KYC. Pour ça, prépare le contenu et dis à l'agent de le faire lui-même.
- Avant add_note/create_reminder sur un contact, obtiens son id via search_contacts ; si plusieurs correspondent, demande lequel — n'écris jamais sur un contact deviné.`

/** Bloc system selon le mode. `writesEnabled` bascule le périmètre d'écriture. */
export function copilotToolsBlock(writesEnabled: boolean): string {
  return TOOLS_BLOCK_BASE + (writesEnabled ? TOOLS_BLOCK_WRITES : TOOLS_BLOCK_READONLY)
}

/** Compat (mode lecture seule). */
export const COPILOT_TOOLS_BLOCK = copilotToolsBlock(false)
