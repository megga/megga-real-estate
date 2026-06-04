// i18n du copilote WhatsApp (FR/EN — les 2 langues du CRM). PUR : aucun I/O, testable Node.
//
// Pourquoi ce module : la PLUPART des réponses de MEGGA sont générées par DeepSeek et se
// localisent via une seule consigne du system prompt (« réponds dans la langue de l'agent »).
// MAIS les messages de CONFIRMATION + de contrôle sont renvoyés VERBATIM (court-circuitent
// DeepSeek pour que l'agent confirme une phrase stable et exacte). Ceux-là se traduisent ici.
//
// La langue est DÉTECTÉE depuis le message déclencheur de l'agent (detectLang), puis portée
// par ActionCtx.lang et figée sur l'action en attente (args.__lang) pour le résultat post-« oui ».

export type WaLang = 'fr' | 'en'

// Mots-outils (function words) = discriminant FR/EN fiable. Défaut FR (langue par défaut CRM).
// « on » exclu de FR (ambigu avec la préposition EN « on ») ; FR garde assez d'autres mots-outils.
const FR_HINTS =
  /\b(le|la|les|un|une|des|du|de|est|sont|pour|avec|et|ou|mon|ma|mes|ton|ta|tes|son|sa|ce|cette|je|tu|il|elle|nous|vous|au|aux|dans|sur|que|qui|ne|pas|oui|non|merci|demain|aujourd|hier|ouvre|crée|ajoute|envoie|déplace|cherche|trouve|fais|peux|veux|faut|dossier|bien|rappel)\b/gi
const EN_HINTS =
  /\b(the|a|an|is|are|was|were|for|with|from|as|about|and|or|my|our|your|his|her|this|that|i|you|he|she|we|they|to|of|in|on|at|do|does|can|could|would|want|need|please|not|yes|no|thanks|tomorrow|today|yesterday|open|create|add|send|move|search|find|make|new|file|listing|reminder)\b/gi

/** Détecte FR/EN sur le message déclencheur de l'agent. Égalité ou vide → 'fr'. */
export function detectLang(text: string | null | undefined): WaLang {
  if (!text) return 'fr'
  const fr = (text.match(FR_HINTS) || []).length
  const en = (text.match(EN_HINTS) || []).length
  return en > fr ? 'en' : 'fr'
}

/** Normalise une valeur de langue (ex. depuis args.__lang) en WaLang sûr. */
export function asWaLang(v: unknown): WaLang {
  return v === 'en' ? 'en' : 'fr'
}

// ── Chaînes statiques (confirmation générique + contrôle) ───────────────────
const STR = {
  confirmGeneric: {
    fr: 'Je vais effectuer cette action. Tu confirmes ? (« oui » / « non »)',
    en: "I'll carry out this action. Confirm? (reply « yes » / « no »)",
  },
  fallbackConfirm: {
    fr: 'Tu confirmes ? (« oui » / « non »)',
    en: 'Confirm? (reply « yes » / « no »)',
  },
  busy: {
    fr: 'Tu as déjà une action en attente. Réponds « oui » pour la confirmer ou « non » pour l’annuler avant d’en lancer une autre.',
    en: 'You already have a pending action. Reply « yes » to confirm it or « no » to cancel it before starting another.',
  },
  prepFail: {
    fr: 'Je ne peux pas préparer cette action pour le moment.',
    en: "I can't prepare this action right now.",
  },
  cancelled: {
    fr: "C'est annulé, je n'ai rien envoyé.",
    en: "Cancelled — I didn't send anything.",
  },
  expired: {
    fr: 'La demande en attente a expiré. Redis-moi ce que tu veux faire.',
    en: 'The pending request expired. Tell me again what you want to do.',
  },
  setAside: {
    fr: "(J'ai mis de côté l'action en attente, non confirmée.)",
    en: '(I set the pending action aside — not confirmed.)',
  },
  iaDown: {
    fr: 'Service IA momentanément indisponible.',
    en: 'AI service temporarily unavailable.',
  },
  cantProcess: {
    fr: "Désolé, je n'ai pas pu traiter ta demande.",
    en: "Sorry, I couldn't handle your request.",
  },
  cantProcessNow: {
    fr: "Désolé, je n'ai pas pu traiter ta demande pour le moment.",
    en: "Sorry, I couldn't handle your request right now.",
  },
  tooLarge: {
    fr: 'Ta demande est trop large pour un seul message. Peux-tu la découper ?',
    en: 'Your request is too broad for a single message. Can you break it up?',
  },
  reformulate: {
    fr: "Je n'ai pas réussi à finaliser ta demande. Peux-tu la reformuler plus simplement ?",
    en: "I couldn't finalise your request. Can you rephrase it more simply?",
  },
  complexRetry: {
    fr: "Ta demande est un peu chargée — je m'en occupe par étapes, redonne-moi un instant.",
    en: "Your request is a bit heavy — I'm handling it in steps, give me a moment.",
  },
  // Garde anti-fabrication KYC : remplace une fausse affirmation d'action (DeepSeek a prétendu
  // un screening/rapport lancé sans appeler l'outil). On NE confirme JAMAIS une action non faite.
  kycNotRun: {
    fr: "Petit raccroc de ma part : je n'ai pas réellement lancé cette action KYC. Redis-moi le contact (« screen Dupont » ou « envoie le rapport de Dupont ») et je l'exécute pour de bon.",
    en: "My bad — I didn't actually run that KYC action. Tell me the contact again (« screen Dupont » / « send Dupont's report ») and I'll run it for real.",
  },
  ok: { fr: 'OK.', en: 'OK.' },
  noAgencySend: {
    fr: "Ton compte n'a pas d'agence, envoi impossible.",
    en: "Your account has no agency — can't send.",
  },
  actionIncompleteSend: {
    fr: "Action incomplète, je n'ai rien envoyé.",
    en: "Incomplete action — I didn't send anything.",
  },
  contactNotFoundSend: {
    fr: 'Contact introuvable dans ton agence, rien envoyé.',
    en: 'Contact not found in your agency — nothing sent.',
  },
  sendFail24h: {
    fr: "L'envoi au client a échoué (fenêtre 24h ou numéro non autorisé ?).",
    en: 'Sending to the client failed (24h window or number not allowed?).',
  },
  sendFailNet: {
    fr: "L'envoi au client a échoué (réseau).",
    en: 'Sending to the client failed (network).',
  },
  clientMsgSent: {
    fr: '✅ Message envoyé au client.',
    en: '✅ Message sent to the client.',
  },
  selectionIncomplete: {
    fr: 'La sélection était incomplète, rien envoyé.',
    en: 'The selection was incomplete — nothing sent.',
  },
  listingsSent: {
    fr: '✅ Sélection envoyée au client.',
    en: '✅ Selection sent to the client.',
  },
  unknownAction: {
    fr: "Type d'action inconnu, rien fait.",
    en: 'Unknown action type — nothing done.',
  },
} as const

export type WaStringKey = keyof typeof STR
export function t(lang: WaLang, key: WaStringKey): string {
  return STR[key][lang]
}

/** Suffixe de confirmation, réutilisé par les prompts paramétrés. */
export function confirmSuffix(lang: WaLang): string {
  return lang === 'en' ? 'Confirm? (reply « yes » / « no »)' : 'Tu confirmes ? (« oui » / « non »)'
}

// ── Libellés métier bilingues ───────────────────────────────────────────────
export type KycPersonType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
const KYC_TYPE_LABELS: Record<WaLang, Record<KycPersonType, string>> = {
  fr: {
    buyer_pp: 'acheteur, personne physique',
    buyer_pm: 'acheteur, personne morale',
    seller_pp: 'vendeur, personne physique',
    seller_pm: 'vendeur, personne morale',
  },
  en: {
    buyer_pp: 'buyer, individual',
    buyer_pm: 'buyer, company',
    seller_pp: 'seller, individual',
    seller_pm: 'seller, company',
  },
}
export function kycTypeLabel(lang: WaLang, type: KycPersonType): string {
  return KYC_TYPE_LABELS[lang][type]
}
export function vigilanceLabel(lang: WaLang, vigilance: string): string {
  if (vigilance === 'renforced') return lang === 'en' ? 'enhanced' : 'renforcée'
  return 'standard'
}

// ── Prompts/résultats paramétrés (confirmation + post-« oui ») ───────────────

/** open_kyc_case — prompt de confirmation. */
export function confirmOpenKyc(lang: WaLang, name: string, type: KycPersonType, vigilance: string): string {
  const tl = kycTypeLabel(lang, type)
  const vl = vigilanceLabel(lang, vigilance)
  if (lang === 'en') return `I'm opening a KYC file for ${name} (${tl}, ${vl} due diligence). ${confirmSuffix('en')}`
  return `J'ouvre un dossier KYC pour ${name} (${tl}, vigilance ${vl}). ${confirmSuffix('fr')}`
}

/** open_kyc_case — résultat post-« oui ». */
export function openKycResult(lang: WaLang, vigilance: string): string {
  const renf = vigilance === 'renforced'
  if (lang === 'en') {
    return `KYC file opened. Whenever you like, you can forward me whatever documents you have — ID, proof of address${renf ? ', source of funds' : ''} — nothing is required, it's an optional assist. I can also run the PEP/sanctions screening whenever you want.`
  }
  return `Dossier KYC ouvert. Tu peux me transférer les pièces que tu as quand tu veux — pièce d’identité, justificatif de domicile${renf ? ', source des fonds' : ''} — rien n’est obligatoire, c’est une aide facultative. Je peux aussi lancer le screening PEP/sanctions dès que tu me le dis.`
}

/** send_client_message — prompt de confirmation WYSIWYG (corps complet + destinataire). */
export function confirmSendClient(lang: WaLang, who: string, body: string): string {
  if (lang === 'en') return `Here's what I'd send to ${who}:\n\n${body}\n\nSend it? ${confirmSuffix('en')}`
  return `Voici ce que je propose d'envoyer à ${who} :\n\n${body}\n\nJ'envoie ? ${confirmSuffix('fr')}`
}

/** update_pipeline — prompt de confirmation. `who` = « le dossier de X » / « X's file ». */
export function confirmUpdatePipeline(lang: WaLang, who: string, stageLabel: string): string {
  if (lang === 'en') return `I'll move ${who} to « ${stageLabel} ». ${confirmSuffix('en')}`
  return `Je vais déplacer ${who} en « ${stageLabel} ». ${confirmSuffix('fr')}`
}
/** « le dossier » / « the file » (défaut quand le contact n'est pas résolu). */
export function pipelineWhoDefault(lang: WaLang): string {
  return lang === 'en' ? 'the file' : 'le dossier'
}
/** « le dossier de Jean » / « Jean's file ». */
export function pipelineWhoNamed(lang: WaLang, name: string): string {
  return lang === 'en' ? `${name}'s file` : `le dossier de ${name}`
}

/** update_pipeline — résultat post-« oui ». stageLabel déjà résolu dans la bonne langue. */
export function pipelineMoved(lang: WaLang, dealLabel: string, stageLabel: string): string {
  if (lang === 'en') return `File « ${dealLabel} » moved to « ${stageLabel} ».`
  return `Dossier « ${dealLabel} » déplacé en « ${stageLabel} ».`
}
/** update_pipeline — déjà à cette étape. */
export function pipelineAlreadyAt(lang: WaLang, dealLabel: string, stageLabel: string): string {
  if (lang === 'en') return `File « ${dealLabel} » is already at « ${stageLabel} ».`
  return `Le dossier « ${dealLabel} » est déjà à l’étape « ${stageLabel} ».`
}
/** update_pipeline — aucun dossier dans le pipeline pour ce contact. */
export function pipelineNoDeal(lang: WaLang): string {
  if (lang === 'en') return "This contact has no pipeline file yet (no transaction). The file must be created in the CRM first."
  return "Ce contact n’a pas encore de dossier dans le pipeline (aucune transaction). Le dossier doit d’abord être créé dans le CRM."
}

/** Confirmation d'un déplacement pipeline AUTO + fenêtre d'undo. */
export function pipelineAutoMoved(lang: WaLang, who: string, label: string): string {
  return lang === 'en'
    ? `Done — ${who} moved to ${label}. Reply /annuler within 60s to undo.`
    : `C’est fait — ${who} passé en ${label}. Tape /annuler dans les 60 s pour revenir en arrière.`
}
/** Confirmation d'un undo réussi. */
export function undoneStage(lang: WaLang, label: string): string {
  return lang === 'en' ? `Rolled back — back to ${label}.` : `Annulé — c’est revenu en ${label}.`
}
/** Rien à annuler dans la fenêtre. */
export function nothingToUndo(lang: WaLang): string {
  return lang === 'en' ? "Nothing to undo (the window has passed)." : "Rien à annuler (la fenêtre est passée)."
}

/** Suffixe « /annuler » à coller à un message d'action auto réversible (Palier 3b, 30 s). */
export function undoHint(lang: WaLang, seconds = 30): string {
  return lang === 'en'
    ? ` · /annuler within ${seconds}s to undo.`
    : ` · /annuler dans les ${seconds} s pour revenir en arrière.`
}
/** Nom de ce qui a été défait, par outil. */
export function undoNoun(lang: WaLang, tool: string): string {
  const fr: Record<string, string> = { create_contact: 'contact créé', schedule_visit: 'visite', create_reminder: 'rappel', qualify_lead: 'qualification' }
  const en: Record<string, string> = { create_contact: 'created contact', schedule_visit: 'visit', create_reminder: 'reminder', qualify_lead: 'qualification' }
  return (lang === 'en' ? en : fr)[tool] ?? 'action'
}
/** Confirmation d'un undo générique (outil auto). */
export function undoneAuto(lang: WaLang, noun: string): string {
  return lang === 'en' ? `Rolled back — ${noun} undone.` : `Annulé — ${noun} défait.`
}

/** ACK renvoyé à DeepSeek quand un outil lent part en file (le résultat suivra,
 *  livré à l’agent par le worker). `name` = nom humain du contact (jamais un id). */
export function asyncAck(lang: WaLang, kind: 'screening' | 'report', name: string): string {
  const n = name && name.trim() ? name.trim() : ''
  if (lang === 'en') {
    const who = n ? ` for ${n}` : ''
    return kind === 'screening'
      ? `I'm running the screening${who} — I'll send you the result in ~15s.`
      : `I'm preparing the KYC report${who} — you'll get the PDF in ~15s.`
  }
  const who = n ? ` de ${n}` : ''
  return kind === 'screening'
    ? `Je lance le screening${who}, je te donne le résultat dans ~15 s.`
    : `Je prépare le rapport KYC${who}, tu reçois le PDF dans ~15 s.`
}

/** Message d'échec livré à l'AGENT par le worker async quand un outil lent n'aboutit
 *  pas après ses tentatives — pour ne JAMAIS le laisser sans réponse après l'ACK. */
export function asyncFailed(lang: WaLang, kind: 'screening' | 'report'): string {
  if (lang === 'en') {
    return kind === 'screening'
      ? "The screening couldn't be completed — try again, or check the case in the CRM."
      : "The KYC report couldn't be generated — try again in a moment."
  }
  return kind === 'screening'
    ? "Le screening n'a pas pu aboutir — réessaie, ou vérifie le dossier dans le CRM."
    : "Le rapport KYC n'a pas pu être généré — réessaie dans un instant."
}
