// Garde anti-CONFIRMATION SIMULÉE du copilote WhatsApp — PUR (aucun I/O), testable Node et Deno.
//
// L'INCIDENT (10.09.2026, 19:38 UTC). L'agent écrit « Supprime la fiche de test boutons ». DeepSeek
// répond en texte libre, SANS appeler aucun outil : « C'est noté, je lance la suppression de *Test
// Boutous*. Confirme quand tu veux, c'est définitif. » Rien n'était préparé : aucune ligne
// `whatsapp_pending_actions`, donc aucun bouton [Oui] [Non] ; un « oui » de l'agent serait reparti
// au cerveau comme un message neuf. Pire, la phrase est entrée dans la mémoire de conversation, et
// huit minutes plus tard le copilote affirmait « sa fiche a été supprimée tout à l'heure » — faux.
//
// Le prompt système l'interdisait déjà en toutes lettres (« Ne demande pas toi-même « tu
// confirmes ? » et n'annonce pas que tu vas le faire »). Même constat que la garde KYC
// (`isFabricatedKycClaim`) : la consigne ne suffit pas, il faut une garde à l'exécution.
//
// CE QUI EST DÉTECTÉ, sur la réponse FINALE d'un tour (aucun appel d'outil) — donc un tour qui, par
// construction, n'a stocké aucune action à confirmer (le stockage rend la main aussitôt) :
//   · `confirm_request` : la réponse demande à l'agent de CONFIRMER (« confirme quand tu veux »,
//     « tu confirmes ? », « réponds oui »…) ET parle d'une action à conséquence (supprimer, envoyer,
//     publier, retirer, offre, KYC, invitation) — ou recopie le suffixe « (« oui » / « non ») » des
//     questions du SYSTÈME, lu dans la mémoire de conversation ;
//   · `action_claim` : la réponse annonce ou revendique une action qui n'existe QU'APRÈS
//     confirmation (« je lance la suppression », « je supprime la fiche », « j'envoie le message »,
//     « j'ai supprimé »), ou recopie un compte rendu que seul l'exécuteur écrit, après le « oui »
//     (« ✅ Message envoyé au client. »).
//
// CE QUI PASSE, volontairement :
//   · une OFFRE ou une question (« tu veux que j'envoie ? », « laquelle je supprime ? », « si tu
//     veux, je supprime la fiche ») : elle n'annonce rien de fait ;
//   · une CLARIFICATION (« tu confirmes que c'est bien Dubois ? ») et un CONSTAT (« je te confirme :
//     … », « c'est confirmé », « Dubois confirme ») : « confirme » n'y est pas une demande à l'agent ;
//   · la retouche d'un BROUILLON (« j'ai supprimé la mention du prix ») ;
//   · ce qui n'est pas la voix de MEGGA : un passage cité (brouillon, pièce lue, message de groupe)
//     et une phrase au VOUVOIEMENT — le copilote tutoie l'agent et vouvoie le client
//     (megga-prose.ts), donc une phrase au « vous » est un texte destiné au client ;
//   · le compte rendu d'une action AUTO réellement faite (« Contact créé », « retiré du pipeline »)
//     ou d'un échange PASSÉ, nommé comme tel dans la même phrase (« envoyé hier »).
//
// C'est une heuristique, et son coût d'erreur est borné : un faux positif coûte UNE relance de
// DeepSeek, et au pire la réponse honnête à la place d'une réponse légitime ; un faux négatif laisse
// passer ce qui passait déjà. Hors de portée, et épinglé comme tel dans les tests : la revendication
// PASSIVE ou sans verbe (« C'est fait, la fiche est supprimée. ») — c'est aussi la forme d'un compte
// rendu légitime (« le message a été envoyé à 14h12 »), et rien dans la phrase ne les sépare.

export type PhantomKind = 'confirm_request' | 'action_claim'

/** Minuscules, accents retirés, apostrophes unifiées, espaces réduits — les retours à la ligne restent : ils séparent les phrases. */
function normalize(raw: string): string {
  return raw
    .normalize('NFD').replace(/[\u0300-\u036f\ufe0f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n\s*/g, '\n')
    .trim()
}

/** Découpe en phrases : ponctuation finale ou retour à la ligne — pas après une initiale (« M. Dubois »). */
function sentences(text: string): string[] {
  return text.split(/\n|(?<=[.!?…])(?<!\b[a-z]\.)\s+/).map((x) => x.trim()).filter(Boolean)
}

/** Une action à conséquence, de celles qui passent par une confirmation (FR/EN, radicaux). */
// ⚠ `suppr` et non `supprim` : « suppression » ne contient pas « supprim » (suppr-ession).
// ⚠ `publi` sauf « public(s) » / « publique » : « la version publique » n'est pas une publication.
const ACTION_WORD = /(suppr|effac|envo[iy]|publi(?!que|cs?\b)|retir|retrait|offre|kyc|invit|delet|remov|\bsend|\bsent\b|withdr|\boffer)/

/**
 * Ce qui précède une demande ADRESSÉE à l'agent : un début de phrase ou de proposition (impératif),
 * ou le tutoiement — « est-ce que tu » compris. Jamais « je (te) confirme », « c'est confirmé »,
 * « Dubois confirme », ni « veut que tu confirmes » (un tiers qui attend quelque chose de l'agent).
 */
const ASK = String.raw`(?:^|\n|[.!?;:,*_(—–-]\s*|\best-ce que tu (?:me |nous )?(?:le |la |les |l')?|(?<!\bque )\btu (?:me |nous )?(?:le |la |les |l')?)`

/** Demandes de confirmation. Chacune n'est retenue qu'avec un ACTION_WORD dans la réponse. */
const CONFIRM_MARKERS: RegExp[] = [
  // « confirme quand tu veux », « valide et je… », « tu confirmes ? », « confirme-moi et je lance »
  // — mais PAS « confirme-moi l'adresse » ni « tu confirmes que c'est bien Dubois » (clarifications).
  // `[*_]?` : le gras ou l'italique WhatsApp (« *Confirme* quand tu veux »).
  new RegExp(ASK + String.raw`(?:confirme|valide)[sz]?(?:-(?:le|la|les|moi|tu))?[*_]?(?: bien)?\s*(?:quand\b|des que\b|et\b|pour\b|si\b|d'abord\b|[,.!?:;\n]|$)`),
  // « tu confirmes la suppression ? », « confirmes-tu bien l'envoi ? », « valide l'envoi »
  new RegExp(ASK + String.raw`(?:confirme|valide)[sz]?(?:-tu)? (?:bien )?(?:la |l'|cette |ce |cet )(?:suppression|envoi|publication|retrait|action|offre|invitation)`),
  // « il ne te reste qu'à confirmer », « je te laisse valider »
  /\b(?:je te laisse|a toi de|(?:il )?(?:ne )?(?:te )?reste (?:plus )?qu'a|tu (?:n'as|as) (?:plus )?qu'a) (?:le |la |les |l')?(?:confirmer|valider)\b/,
  // « j'attends ta confirmation », « je n'attends que ton feu vert »
  /\bj'attends (?:juste |seulement )?(?:ta confirmation|ta validation|ton (?:ok|feu vert|accord|go))\b|\bje n'attends (?:plus )?que (?:ta confirmation|ta validation|ton (?:ok|feu vert|accord|go))\b/,
  // « merci de confirmer la suppression » — sans « l'offre » : confirmer une offre regarde les parties.
  /\b(?:confirmer|valider) (?:la |l'|cette |ce |cet )(?:suppression|envoi|publication|retrait|action|invitation)/,
  // « tu confirmes que tu veux supprimer… » (≠ « tu confirmes que c'est bien Dubois ? »)
  /\bconfirme[sz]?(?:-moi| moi)? que tu (?:veux|souhaites)\b/,
  // « réponds « oui » », « tape oui », « dis-moi oui »
  /\b(?:repond[sz]?|tape[sz]?) (?:par )?[«"“]?\s*oui\b/,
  /\bdis(?:-| )moi [«"“]?\s*oui\b/,
  // « je le supprime dès que tu confirmes », « dès que tu me dis go », « je le lance dès ton ok »
  /\bdes que tu (?:confirmes|valides|(?:me )?dis (?:oui|go|ok))\b/,
  /\bdes ton (?:ok|feu vert|accord|go)\b/,
  // EN : « Confirm? », « confirm when you're ready », « please confirm the deletion » — jamais
  // « I (can) confirm », qui est un constat.
  /(?<!\bi (?:can |could |will )?)(?<!\bi'll )\bconfirm[*_]?\s*(?:[?!.:;,\n]|$|when\b|and i\b|and i'll\b|to (?:proceed|go ahead)\b|if you\b|before i\b)/,
  /(?<!\bi (?:can |could |will )?)(?<!\bi'll )\bconfirm (?:the |this )(?:deletion|removal|sending|withdrawal|publication|action|invitation)\b/,
  /\bconfirm (?:that )?you (?:want|wish|'d like|would like)\b/,
  // « waiting for your confirmation » — pas « neither done nor waiting for your confirmation ».
  /(?<!\b(?:nor|not|no longer) )\b(?:waiting for|awaiting) your (?:confirmation|go-ahead|approval)\b|\bi need your (?:confirmation|go-ahead|approval|ok)\b/,
  /\b(?:reply|answer|say|type) (?:with )?["“]?yes\b/,
]

/**
 * Le suffixe des questions de confirmation du SYSTÈME (« Tu confirmes ? (« oui » / « non ») »), que
 * le copilote relit dans la mémoire de conversation : recopié, il suffit à prouver l'imitation.
 */
const SYSTEM_CONFIRM_SUFFIX = /\(\s*(?:reply\s+)?[«"“]?\s*(?:oui|yes)\s*[»"”]?\s*\/\s*[«"“]?\s*(?:non|no)\b/
/** « Oui / non » nu : retenu seulement avec une action à conséquence. */
const BARE_YES_NO = /\b(?:oui|yes)\s*\/\s*(?:non|no)\b/

/**
 * Comptes rendus que SEUL l'exécuteur écrit, après le « oui » (whatsapp-i18n.ts : `clientMsgSent`,
 * `listingsSent`, `templateSent`). Le cerveau ne peut les produire qu'en les recopiant.
 */
const EXECUTOR_ECHOES = [
  '✅ message envoye au client', '✅ message sent to the client',
  '✅ selection envoyee au client', '✅ selection sent to the client',
  '✅ relance approuvee (template) envoyee', '✅ approved re-engagement template sent',
]

/** L'objet est un morceau de TEXTE (retouche d'un brouillon), pas une fiche : « j'ai supprimé la mention du prix ». */
const TEXT_PART = String.raw`(?!\s*(?:(?:la|le|les|cette|ce|cet|ces|ta|ton|tes|ma|mon|mes|sa|son|ses|the|that|this|its) |l')?(?:\S+ )?(?:mention|phrase|ligne|paragraphe|passage|adresse|formule|signature|emoji|mot|prix|chiffre|detail|partie|question|brouillon|version|texte|titre|line|sentence|paragraph|address|wording|price|part|word|draft|text|title)s?\b)`
/** `que je supprime`, `si je supprime` : une offre ou une hypothèse, pas une annonce. */
const NOT_OFFER = String.raw`(?<!\bque )(?<!\bsi )`
/** Sortir un dossier du pipeline est une action AUTO (update_pipeline, annulable) : ni une suppression ni un retrait. */
const NOT_PIPELINE = String.raw`(?!.*\bpipeline\b)`
/** « retirer » ne vaut que pour une fiche ou une annonce — pas pour « je retire ma question ». */
const CRM_OBJECT = String.raw`(?=.*\b(?:portails?|annonces?|immobilier|homegate|immoscout|anibis|comparis|listing|portal|crm|fiche|contact))` + NOT_PIPELINE
/** Ce qui part chez un client : « le message », « la sélection », « l'invitation »… */
const SENT_OBJECT = String.raw`(?:(?:le|ce|ton|ta|la|les|tes|un|une|cette|ces) |l')(?:message|brouillon|mail|e-mail|email|lien|selection|invitation|sms|documents?|dossier|rapport|biens?)\b`

/** Annonces du tour en cours : rien ne les excuse, pas même un « hier » dans la phrase. */
const PRESENT_CLAIMS: RegExp[] = [
  new RegExp(NOT_OFFER + String.raw`\bje lance (?:la |l'|le )?(?:suppression|envoi|publication|retrait|invitation|ouverture|screening)`),
  new RegExp(NOT_OFFER + String.raw`\bje (?:procede|vais proceder) a (?:la |l')(?:suppression|publication|envoi|retrait)`),
  new RegExp(NOT_OFFER + String.raw`(?:\bje (?:le |la |les |l')?(?:supprime|efface)|\bj'efface)\b` + TEXT_PART),
  new RegExp(NOT_OFFER + String.raw`\bje (?:le |la |les |l')?publie\b`),
  new RegExp(NOT_OFFER + String.raw`\bje (?:le |la |les |l')?retire\b` + CRM_OBJECT + TEXT_PART),
  new RegExp(String.raw`\bje (?:vais|m'apprete a) (?:le |la |les |l')?(?:supprimer|effacer|publier)\b` + TEXT_PART),
  new RegExp(String.raw`\bje (?:vais|m'apprete a) (?:le |la |les |l')?retirer\b` + CRM_OBJECT + TEXT_PART),
  // Envoi AU CLIENT. `je t'envoie` (à l'agent) ne correspond pas : il faut un objet qui part chez lui.
  new RegExp(NOT_OFFER + String.raw`\b(?:j'envoie|je (?:lui|leur) envoie|je (?:lui |leur )?transmets) (?:a \S+ )?` + SENT_OBJECT),
  // « Ok, je l'envoie. » — le pronom tient lieu d'objet. « je te l'envoie » (à l'agent) ne correspond pas.
  new RegExp(NOT_OFFER + String.raw`\bje (?:le |la |les |l')(?:envoie|transmets)\b`),
  new RegExp(String.raw`\bje (?:vais|m'apprete a) (?:lui |leur )?(?:envoyer|transmettre) (?:a \S+ )?` + SENT_OBJECT),
  new RegExp(String.raw`\bje viens d(?:e |')(?:supprimer|effacer|publier)\b` + TEXT_PART),
  new RegExp(String.raw`\bje viens de retirer\b` + CRM_OBJECT + TEXT_PART),
  new RegExp(String.raw`\bje viens d(?:e |')(?:envoyer|transmettre) (?:a \S+ )?` + SENT_OBJECT),
  /\bje m'occupe (?:de la |de l'|du )(?:suppression|envoi|publication|retrait)/,
  // EN — `I'll send you…` (à l'agent) ne correspond pas.
  /\bi(?:'m| am) (?:now )?(?:deleting|publishing|withdrawing)\b/,
  new RegExp(String.raw`\bi(?:'m| am) (?:now )?removing\b` + TEXT_PART + NOT_PIPELINE),
  new RegExp(String.raw`\bi(?:'ll| will) (?:now )?(?:delete|remove)\b` + TEXT_PART + NOT_PIPELINE),
  /\bi(?:'ll| will) (?:now )?(?:publish|withdraw)\b/,
  new RegExp(String.raw`\bi(?:'m| am) going to (?:delete|remove)\b` + TEXT_PART + NOT_PIPELINE),
  /\bi(?:'m| am) going to (?:publish|withdraw|send (?:the|this|your|it|them)\b)/,
  /\bi(?:'ll| will) (?:now )?send (?:(?:the|this|your) (?:message|draft|email|e-mail|link|selection|invitation)\b|(?:it|them) to (?!you\b))/,
  /\bi(?:'m| am) (?:now )?sending (?:(?:the|this|your) (?:message|draft|email|e-mail|link|selection|invitation)\b|(?:it|them) to (?!you\b))/,
  new RegExp(String.raw`\bi(?:'ve| have) just (?:deleted|removed)\b` + TEXT_PART + NOT_PIPELINE),
  /\bi(?:'ve| have) just (?:published|withdrawn|sent (?!you\b))/,
]

/** Revendications au passé : seules à pouvoir rapporter un échange antérieur (« hier », « déjà »…). */
const PAST_CLAIMS: RegExp[] = [
  new RegExp(String.raw`\bj'ai (?:bien )?(?:supprime|efface|publie)\b` + TEXT_PART),
  new RegExp(String.raw`\bj'ai (?:bien )?retire\b` + CRM_OBJECT + TEXT_PART),
  new RegExp(String.raw`\b(?:j'ai|je (?:lui|leur) ai) (?:bien )?(?:envoye|transmis) (?:a \S+ )?` + SENT_OBJECT),
  new RegExp(String.raw`\bi(?:'ve| have) (?:deleted|removed)\b` + TEXT_PART + NOT_PIPELINE),
  /\bi(?:'ve| have) (?:published|withdrawn|sent (?!you\b))/,
]

/** Un échange antérieur nommé comme tel. Il n'excuse qu'une revendication au PASSÉ, et dans SA phrase. */
const HISTORY_MARKER = /\b(?:hier|avant-hier|deja|tout a l'heure|plus tot|ce matin|la semaine (?:derniere|passee)|le mois dernier|yesterday|already|earlier|this morning|last (?:week|month))\b/
/**
 * Une offre conditionnelle : « si tu veux, je supprime la fiche », « si oui, donne-moi le texte et je
 * l'envoie », « let me know and I'll send it ». Pas « dès que tu me dis oui » : ça, c'est demander
 * l'accord (CONFIRM_MARKERS).
 */
const OFFER_CLAUSE = /\bsi (?:tu (?:le |l')?(?:veux|souhaites|preferes)|tu es d'accord|oui|besoin)\b|\bsi (?:ca|cela) te (?:va|convient)\b|\bquand tu (?:le )?(?:veux|voudras|souhaites)\b|\bdes que (?:tu (?:me )?(?:donnes|as|envoies|ecris)|j'ai)\b|\bif you (?:want|like|prefer|wish|'d like)\b|\blet me know\b|\bonce you\b/
/** Une question est une offre ou une clarification, jamais une annonce. */
const QUESTION = /\?[^\p{L}\p{N}]*$/u
/** Vouvoiement : un texte destiné au CLIENT (brouillon), pas la voix de MEGGA à l'agent. */
const VOUS = /(?<!rendez-)\b(?:vous|votre|vos)\b/

/**
 * La réponse finale simule-t-elle une confirmation, ou annonce-t-elle une action qui n'existe
 * qu'après confirmation ? `null` si elle peut partir telle quelle.
 */
export function detectPhantomAction(reply: string | null | undefined): PhantomKind | null {
  if (!reply) return null
  const s = normalize(reply)
  if (!s) return null
  if (SYSTEM_CONFIRM_SUFFIX.test(s)) return 'confirm_request'
  // Une citation longue n'est pas la voix de MEGGA ; une courte (« oui ») reste, les marqueurs en ont besoin.
  const unquoted = s.replace(/«[^»]{20,}»|“[^”]{20,}”|"[^"]{20,}"/g, '« »')
  if (EXECUTOR_ECHOES.some((echo) => unquoted.includes(echo))) return 'action_claim'
  const voice = sentences(unquoted).filter((x) => !VOUS.test(x))
  const voiceText = voice.join('\n')
  // Le mot d'action se cherche dans TOUTE la réponse : un brouillon suivi de « Tu confirmes ? »
  // demande bien de confirmer un envoi, même si le verbe n'est que dans le brouillon.
  if (ACTION_WORD.test(s) && (BARE_YES_NO.test(voiceText) || CONFIRM_MARKERS.some((re) => re.test(voiceText)))) {
    return 'confirm_request'
  }
  for (const sentence of voice) {
    if (QUESTION.test(sentence) || OFFER_CLAUSE.test(sentence)) continue
    if (PRESENT_CLAIMS.some((re) => re.test(sentence))) return 'action_claim'
    if (!HISTORY_MARKER.test(sentence) && PAST_CLAIMS.some((re) => re.test(sentence))) return 'action_claim'
  }
  return null
}

/**
 * Que faire de la réponse finale : la laisser partir, relancer DeepSeek UNE fois avec la consigne
 * corrective, ou renvoyer la réponse honnête. `canRetry` est faux après une première relance, et au
 * dernier tour de la boucle : la passe suivante serait la passe forcée SANS outils (F9), où la
 * consigne « appelle l'outil » ne peut pas être suivie.
 *
 * ⛔ Jamais la fausse revendication : ni envoyée à l'agent, ni stockée dans la mémoire de
 * conversation, où elle ferait croire au copilote qu'une action a eu lieu.
 */
export function phantomNextStep(
  reply: string | null | undefined,
  canRetry: boolean,
): 'pass' | 'retry' | 'fallback' {
  if (!detectPhantomAction(reply)) return 'pass'
  return canRetry ? 'retry' : 'fallback'
}

/**
 * Consigne ajoutée à la FIN du message système pour la relance — pas un message `system` de plus au
 * milieu de la conversation : aucun appel DeepSeek du dépôt n'en envoie, et une relance refusée en
 * 400 ne servirait à rien. Autonome, parce que la réponse rejetée n'est PAS réinjectée (elle
 * ancrerait le modèle sur ce qu'il vient d'inventer). La relance reste en `tool_choice: 'auto'` :
 * forcer un outil sur un faux positif pousserait DeepSeek à en appeler un au hasard. Elle interdit
 * de rappeler un outil déjà abouti (un rappel ou une note AUTO du même échange ne doit pas doubler),
 * et laisse répondre d'après l'historique quand l'agent demande seulement où en est une action.
 */
export const PHANTOM_RETRY_NUDGE = "CONSIGNE STRICTE POUR CETTE RÉPONSE : une première réponse vient d'être rejetée, parce qu'elle annonçait une action ou demandait à l'agent de la confirmer SANS appeler d'outil. Rien n'était préparé, et une confirmation écrite par toi ne vaut rien. Si l'agent demande une action (supprimer, envoyer, publier, retirer, enregistrer une offre, ouvrir un KYC…), appelle l'outil correspondant, en retrouvant d'abord le contact via search_contacts si besoin : le système demandera lui-même la confirmation à l'agent. Ne rappelle pas un outil qui a déjà abouti dans cet échange. S'il manque une information, pose une question courte, sans annoncer d'action ni en demander la confirmation. Si l'agent demande seulement où en est une action, réponds d'après l'historique."
