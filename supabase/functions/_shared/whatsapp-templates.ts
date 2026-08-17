// Templates Meta — écrire à un client HORS de la fenêtre de service 24h.
//
// Hors fenêtre, Meta refuse le texte libre (erreur 131047) ; seuls des TEMPLATES
// pré-approuvés (Meta Business Manager) passent. Ce module est le registre CÔTÉ CODE :
// il déclare les templates que MEGGA sait envoyer et remplit leurs variables — mais les
// NOMS approuvés viennent de l'env (posés une fois le template validé par Meta), pour que
// le code n'invente JAMAIS un nom non approuvé (l'API le rejetterait).
//
// ── Activation (étapes EXTERNES, hors code) ──────────────────────────────────
//  1. Compte Meta Business vérifié (débridage — cf. system-map §6bis « roadmap »).
//  2. Soumettre chaque template dans Meta Business Manager avec le corps EXACT décrit
//     ci-dessous (mêmes {{1}}, {{2}}… dans le même ordre) → attendre l'APPROBATION Meta.
//  3. Poser l'env WA_TEMPLATE_<KEY> = <nom_approuvé> (+ WA_TEMPLATE_<KEY>_LANG si ≠ défaut).
// Tant que l'env n'est pas posé, buildTemplateMessage() renvoie null → repli GRACIEUX
// (aucun envoi, l'agent est informé), jamais d'appel Meta avec un nom bidon.
//
// Contrainte produit : ces templates sont NEUTRES et courtois (pas le style appris de
// l'agent — un template figé ne peut pas l'être). Ils servent seulement à ROUVRIR la
// conversation ; la réponse du client rouvre la fenêtre 24h pour un échange libre.

import type { OutboundTemplateMessage } from './whatsapp-gateway.ts'

export type WaTemplateKey =
  | 'followup'
  | 'availability'
  | 'new_listings'
  | 'agent_daily_brief'
  | 'kyc_documents_missing'
  | 'number_verification'

export const WA_TEMPLATE_KEYS: WaTemplateKey[] = [
  'followup',
  'availability',
  'new_listings',
  'agent_daily_brief',
  'kyc_documents_missing',
  'number_verification',
]

export interface WaTemplateContext {
  clientFirstName?: string   // {{1}} — prénom du client (repli « Bonjour »)
  agentName?: string         // {{2}} — nom de l'agent/agence
  count?: number             // new_listings : nombre de biens ({{2}})
  extra?: string             // availability : objet du créneau (ex. « une visite »)
  agentFirstName?: string    // agent_daily_brief : prénom de l'AGENT destinataire ({{1}})
  itemCount?: number         // agent_daily_brief : nombre d'éléments à traiter ({{2}})
  verificationCode?: string  // number_verification : le code à 6 chiffres ({{1}}, seule variable)
  /** Langue du DESTINATAIRE. Prime sur la surcharge d'env. Valeur inconnue = ignorée. */
  lang?: string
}

/** Les 4 langues du CRM. Meta n'expose pas de_CH/it_CH : on dépose sous `de`/`it`. */
export type WaTemplateLang = 'fr' | 'de' | 'en' | 'it'

export const WA_TEMPLATE_LANGS: WaTemplateLang[] = ['fr', 'de', 'en', 'it']

interface WaTemplateDef {
  /**
   * Template de catégorie AUTHENTICATION : Meta écrit et traduit le corps lui-même, et
   * exige un composant `button` à l'envoi (le code y est répété pour le presse-papier).
   * Les templates ordinaires n'ont ni l'un ni l'autre.
   */
  authentication?: boolean
  /** Env var portant le nom Meta APPROUVÉ (vide/absent = template non activé). */
  nameEnv: string
  /** Env var pour surcharger la langue ; sinon defaultLang. */
  langEnv: string
  defaultLang: WaTemplateLang
  /**
   * Corps soumis à Meta, PAR LANGUE. Un même nom de template porte plusieurs
   * traductions côté Meta ; `language.code` choisit à l'envoi.
   *
   * ⚠ L'ordre des `{{n}}` est IDENTIQUE dans toutes les langues, parce que
   * `bodyParams` produit un seul tableau ordonné pour toutes. Une traduction qui
   * inverserait {{1}} et {{2}} — tentant en allemand — enverrait le nom de
   * l'agence à la place du prénom du client.
   */
  bodyTexts: Record<WaTemplateLang, string>
  /** Paramètres du corps dans l'ordre {{1}}, {{2}}… Chaîne non vide garantie (Meta rejette
   *  un paramètre vide). `lang` sert aux replis : voir FALLBACK. */
  bodyParams: (ctx: WaTemplateContext, lang: WaTemplateLang) => string[]
}

/**
 * Replis quand le CRM ne connaît pas la valeur — PAR LANGUE.
 *
 * ⛔ Ils étaient en français en dur, et faux même en français : le repli du prénom
 * valait `'Bonjour'` dans un corps qui commence par « Bonjour {{1}} », soit
 * « Bonjour Bonjour, ». En allemand cela donnait « Guten Tag Bonjour, hier meldet
 * sich votre agent … für une visite » — trois langues dans une phrase, livrée au
 * client. Un repli est du texte visible : il appartient à la langue du message.
 *
 * `slot` est à l'ACCUSATIF en allemand (« für » le régit) et féminin partout, pour
 * rester grammatical dans la phrase d'origine.
 */
const FALLBACK: Record<WaTemplateLang, { person: string; agent: string; agency: string; slot: string }> = {
  fr: { person: 'Madame, Monsieur', agent: 'votre agent', agency: 'votre agence', slot: 'une visite' },
  de: { person: 'geschätzte Kundin, geschätzter Kunde', agent: 'Ihr Ansprechpartner', agency: 'Ihre Immobilienagentur', slot: 'eine Besichtigung' },
  en: { person: 'there', agent: 'your agent', agency: 'your agency', slot: 'a viewing' },
  it: { person: 'Gentile Cliente', agent: 'il Suo consulente', agency: 'la Sua agenzia', slot: 'una visita' },
}

const nonEmpty = (v: string | undefined | null, fallback: string): string => {
  const s = (v ?? '').trim()
  return s.length > 0 ? s : fallback
}

const REGISTRY: Record<WaTemplateKey, WaTemplateDef> = {
  // « Bonjour {{1}}, {{2}} revient vers vous au sujet de votre projet immobilier.
  //   Souhaitez-vous qu'on en reparle ? »
  followup: {
    nameEnv: 'WA_TEMPLATE_FOLLOWUP', langEnv: 'WA_TEMPLATE_FOLLOWUP_LANG', defaultLang: 'fr',
    bodyTexts: {
      fr: 'Bonjour {{1}}, {{2}} revient vers vous au sujet de votre projet immobilier. Souhaitez-vous qu’on en reparle ?',
      de: 'Guten Tag {{1}}, hier meldet sich {{2}} erneut wegen Ihres Immobilienprojekts. Möchten Sie darüber sprechen?',
      en: 'Hello {{1}}, this is {{2}} getting back to you about your property plans. Would you like to discuss them further?',
      it: 'Buongiorno {{1}}, La ricontatta {{2}} in merito al Suo progetto immobiliare. Desidera riparlarne?',
    },
    bodyParams: (c, l) => [nonEmpty(c.clientFirstName, FALLBACK[l].person), nonEmpty(c.agentName, FALLBACK[l].agent)],
  },
  // « Bonjour {{1}}, {{2}} vous propose un créneau pour {{3}}. Êtes-vous disponible ? »
  //
  // ⚠ DE : « für » régit l'accusatif, donc {{3}} doit arriver à l'accusatif
  // (« eine Besichtigung »). Et la question porte sur la disponibilité, pas sur
  // un horaire : le corps ne contient AUCUNE date, seulement l'objet du créneau.
  availability: {
    nameEnv: 'WA_TEMPLATE_AVAILABILITY', langEnv: 'WA_TEMPLATE_AVAILABILITY_LANG', defaultLang: 'fr',
    bodyTexts: {
      fr: 'Bonjour {{1}}, {{2}} vous propose un créneau pour {{3}}. Êtes-vous disponible ?',
      de: 'Guten Tag {{1}}, hier meldet sich {{2}} mit einem Terminvorschlag für {{3}}. Hätten Sie dafür Zeit?',
      en: 'Hello {{1}}, this is {{2}} getting in touch to suggest a time for {{3}}. Are you available?',
      it: 'Buongiorno {{1}}, La contatta {{2}} per proporLe un orario per {{3}}. È disponibile?',
    },
    bodyParams: (c, l) => [
      nonEmpty(c.clientFirstName, FALLBACK[l].person),
      nonEmpty(c.agentName, FALLBACK[l].agent),
      nonEmpty(c.extra, FALLBACK[l].slot),
    ],
  },
  // « Bonjour {{1}}, {{2}} nouveau(x) bien(s) correspondant à votre recherche viennent
  //   d'arriver. Voulez-vous les découvrir ? »
  // ⚠ {{2}} est un NOMBRE : chaque traduction doit rester grammaticale avec 1
  // comme avec 12. D'où « Treffer » (invariable) en allemand et « listing(s) » en
  // anglais, sur le modèle du « bien(s) » français.
  new_listings: {
    nameEnv: 'WA_TEMPLATE_NEW_LISTINGS', langEnv: 'WA_TEMPLATE_NEW_LISTINGS_LANG', defaultLang: 'fr',
    bodyTexts: {
      fr: 'Bonjour {{1}}, {{2}} nouveau(x) bien(s) correspondant à votre recherche viennent d’arriver. Voulez-vous les découvrir ?',
      de: 'Guten Tag {{1}}, zu Ihrer Suche gibt es neu {{2}} Treffer. Möchten Sie mehr dazu erfahren?',
      en: 'Hello {{1}}, we have found {{2}} new listing(s) matching your search. Would you like to take a look?',
      it: 'Buongiorno {{1}}, Le segnaliamo {{2}} proprietà di recente pubblicazione in linea con la Sua ricerca. Desidera riceverne i dettagli?',
    },
    bodyParams: (c, l) => [nonEmpty(c.clientFirstName, FALLBACK[l].person), String(Math.max(1, c.count ?? 1))],
  },

  // ── Agent-facing ───────────────────────────────────────────────────────────
  // Le SEUL template dont le destinataire a un consentement tracé en base
  // (`whatsapp_agent_links.verified` + opt-out par `morning_brief_enabled`) :
  // l'agent est utilisateur du service, pas un contact démarché.
  //
  // Le corps PORTE le décompte au lieu de demander la permission de l'envoyer.
  // Une formule du type « votre brief est prêt, souhaitez-vous le recevoir ? »
  // n'énonce aucun fait et se fait reclasser en MARKETING — en plus de marquer
  // la journée comme livrée alors que rien d'utile n'a été dit.
  //
  // ⚠ MESURÉ le 14.08.2026 : soumis en UTILITY, Meta l'a APPROUVÉ en **MARKETING**.
  // La dernière phrase (« Répondez … pour recevoir le détail ») se lit comme un
  // réengagement. Conséquence : tarif marketing et opt-in marketing pour un
  // message destiné à l'AGENT lui-même. Ne jamais déduire le coût ni la règle de
  // consentement de la catégorie DEMANDÉE — relire celle rendue par l'API.
  // Contestable dans WhatsApp Manager (statut IN_APPEAL) si on veut UTILITY.
  //
  // ⚠ La commande entre guillemets reste « mon point du jour » DANS TOUTES LES
  // LANGUES, volontairement : le routage vers `get_daily_brief` est sémantique et
  // les descriptions d'outils sont en français, et `detectLang` ne connaît que
  // fr/en (`whatsapp-i18n.ts`). Conséquence à connaître avant d'activer le DE ou
  // l'IT : l'agent recevra le détail EN FRANÇAIS, parce que sa réponse « mon point
  // du jour » sera détectée comme française.
  agent_daily_brief: {
    nameEnv: 'WA_TEMPLATE_AGENT_DAILY_BRIEF', langEnv: 'WA_TEMPLATE_AGENT_DAILY_BRIEF_LANG', defaultLang: 'fr',
    bodyTexts: {
      fr: 'Bonjour {{1}}, votre point du jour MEGGA compte {{2}} élément(s) à traiter : visites, relances, offres à échéance et nouveaux leads. Répondez « mon point du jour » pour recevoir le détail ici.',
      de: 'Guten Tag {{1}}, Ihr MEGGA-Tagesüberblick enthält heute {{2}} Pendenz(en): Besichtigungen, Wiedervorlagen, auslaufende Angebote und neue Leads. Antworten Sie mit dem Stichwort «mon point du jour», um die Details hier zu erhalten.',
      en: 'Hello {{1}}, your MEGGA daily brief lists {{2}} item(s) to handle: viewings, follow-ups, expiring offers and new leads. Reply "my daily brief" to receive the details here.',
      it: 'Buongiorno {{1}}, il Suo riepilogo MEGGA di oggi conta {{2}} attività da gestire: visite, solleciti, offerte in scadenza e nuovi lead. Risponda «mon point du jour» per ricevere qui il dettaglio.',
    },
    bodyParams: (c, l) => [
      nonEmpty(c.agentFirstName, FALLBACK[l].person),
      // Meta rejette un paramètre vide, et un décompte à 0 n'a aucune raison
      // d'être poussé : l'appelant ne doit pas déclencher le template dans ce cas.
      String(Math.max(1, c.itemCount ?? 1)),
    ],
  },

  // ── Client ─────────────────────────────────────────────────────────────────
  // ⚠ Le corps ne dit PAS « vérification » ni « KYC » : ce canal est grand public
  // (aperçu sur écran verrouillé, WhatsApp Web partagé, sauvegardes cloud) et le
  // statut LAB/KYC d'une personne n'a pas à y transiter. « une ou plusieurs
  // pièces à votre dossier » suffit à rouvrir la conversation.
  //
  // ⛔ NE PAS ACTIVER tant que `executeSendKycLink` fige `channels: ['email']` et
  // refuse un contact sans e-mail : un « oui » ouvrirait une fenêtre 24 h sur une
  // impasse. Le lien de dépôt n'a encore jamais été émis (0 ligne).
  kyc_documents_missing: {
    nameEnv: 'WA_TEMPLATE_KYC_DOCUMENTS_MISSING', langEnv: 'WA_TEMPLATE_KYC_DOCUMENTS_MISSING_LANG', defaultLang: 'fr',
    bodyTexts: {
      fr: 'Bonjour {{1}}, il manque encore une ou plusieurs pièces à votre dossier chez {{2}}. Souhaitez-vous recevoir le lien de dépôt sécurisé ?',
      de: 'Guten Tag {{1}}, in Ihrem Dossier bei {{2}} fehlen noch eine oder mehrere Unterlagen. Möchten Sie den Link zum sicheren Upload erhalten?',
      en: 'Hello {{1}}, one or more documents are still missing from your file with {{2}}. Would you like to receive the secure upload link?',
      it: 'Buongiorno {{1}}, alla Sua pratica presso {{2}} mancano ancora uno o più documenti. Desidera ricevere il link sicuro per il caricamento?',
    },
    bodyParams: (c, l) => [nonEmpty(c.clientFirstName, FALLBACK[l].person), nonEmpty(c.agentName, FALLBACK[l].agency)],
  },
  // Code de vérification d'un numéro que l'AGENT vient de saisir dans ses réglages.
  //
  // ⛔ CATÉGORIE **AUTHENTICATION**, ET C'EST UNE CORRECTION. Ce commentaire disait
  // l'inverse — « soumettre en UTILITY, jamais AUTHENTICATION » — en raisonnant à
  // l'envers : il déduisait la catégorie de ce que notre passerelle savait construire,
  // alors que la catégorie est imposée par la POLITIQUE de Meta. Vérifié le 17.08.2026
  // dans la documentation Meta : seuls les templates d'authentification peuvent porter un
  // code à usage unique, et un template UTILITY qui en contient un est REFUSÉ. Le
  // correctif n'était donc pas de choisir la catégorie que le code supportait, mais
  // d'apprendre à la passerelle à envoyer un bouton OTP (fait : `otpButtonCode`).
  //
  // ⚠ CONSÉQUENCE SUR CE REGISTRE : le corps d'un template d'authentification n'est PAS
  // le nôtre. Meta le génère, traduit, dans chaque langue — texte figé
  // « <CODE> is your verification code. » plus, en option, l'avertissement de sécurité et
  // le délai d'expiration. Les `bodyTexts` ci-dessous ne sont donc PAS soumis : ils
  // DOCUMENTENT ce que le destinataire lira, pour que le reste du dépôt (revue, support,
  // capture d'écran) sache à quoi s'attendre. Ne pas les « corriger » en croyant changer
  // le message : seuls `add_security_recommendation` et `code_expiration_minutes`, posés
  // à la création, en modifient quoi que ce soit.
  number_verification: {
    nameEnv: 'WA_TEMPLATE_NUMBER_VERIFICATION', langEnv: 'WA_TEMPLATE_NUMBER_VERIFICATION_LANG', defaultLang: 'fr',
    authentication: true,
    bodyTexts: {
      fr: '{{1}} est votre code de vérification. Pour votre sécurité, ne le partagez pas.',
      de: '{{1}} ist Ihr Bestätigungscode. Teilen Sie ihn zu Ihrer Sicherheit nicht.',
      en: '{{1}} is your verification code. For your security, do not share this code.',
      it: '{{1}} è il Suo codice di verifica. Per la Sua sicurezza, non lo condivida.',
    },
    bodyParams: (c) => [nonEmpty(c.verificationCode, '------')],
  },
}

/** Corps d'un template dans une langue donnée (documentation + soumission Meta). */
export function templateBodyText(key: WaTemplateKey, lang: WaTemplateLang = 'fr'): string {
  return REGISTRY[key].bodyTexts[lang]
}

/** Une langue connue du registre, ou `null` si la valeur ne correspond à rien. */
const asLang = (v: string): WaTemplateLang | null =>
  (WA_TEMPLATE_LANGS as string[]).includes(v) ? (v as WaTemplateLang) : null

/**
 * Construit le message template à envoyer, ou `null` si le template n'est pas configuré
 * (nom approuvé absent de l'env) → le caller applique un repli gracieux (pas d'envoi).
 * `env` est injecté (Deno.env.get) pour rester PUR et testable.
 *
 * LANGUE, par ordre de priorité : celle du destinataire (`ctx.lang`), sinon la
 * surcharge d'environnement, sinon `defaultLang`.
 *
 * ⚠ La surcharge d'env est GLOBALE : la poser à `de` bascule TOUS les destinataires
 * en allemand, francophones compris. Elle sert à corriger un déploiement, pas à
 * faire du multilingue — pour ça, c'est `ctx.lang` qu'il faut renseigner, et il ne
 * l'est nulle part aujourd'hui (aucune colonne de langue sur `contacts`).
 */
export function buildTemplateMessage(
  key: WaTemplateKey,
  toPhone: string,
  ctx: WaTemplateContext,
  env: (k: string) => string | undefined,
): OutboundTemplateMessage | null {
  const def = REGISTRY[key]
  if (!def) return null
  const name = (env(def.nameEnv) ?? '').trim()
  if (!name) return null // template non approuvé/configuré → repli
  const lang =
    asLang((ctx.lang ?? '').trim()) ??
    asLang((env(def.langEnv) ?? '').trim()) ??
    def.defaultLang
  const bodyParams = def.bodyParams(ctx, lang)
  return {
    toPhone,
    templateName: name,
    languageCode: lang,
    bodyParams,
    // Le code répété pour le bouton « Copier ». Il vient du PREMIER paramètre de corps,
    // et non d'un champ à part : un template d'authentification n'a qu'une variable, et
    // les faire diverger afficherait un code et en copierait un autre.
    ...(def.authentication ? { otpButtonCode: bodyParams[0] } : {}),
  }
}

/** Liste des clés de template ACTIVÉES (nom approuvé présent dans l'env). */
export function configuredTemplateKeys(env: (k: string) => string | undefined): WaTemplateKey[] {
  return WA_TEMPLATE_KEYS.filter((k) => (env(REGISTRY[k].nameEnv) ?? '').trim().length > 0)
}
