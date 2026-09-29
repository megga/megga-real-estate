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
  // Garde LAB plein (étape 5, tâche 4) sur open_kyc_case : ouvrir un dossier KYC
  // client reste interdit tant que l'identité de l'agence n'a pas été validée. Dit
  // POURQUOI et QUOI FAIRE — un simple « impossible » enverrait l'agent réessayer.
  // Jamais le statut brut (auto_validated, manual_review…) : notion interne.
  kycAgencyNotVerified: {
    fr: "Je ne peux pas ouvrir de dossier KYC tant que l'identité de ton agence n'a pas été validée par l'équipe MEGGA. Termine la vérification depuis le CRM, je m'en occupe juste après.",
    en: "I can't open a KYC file until your agency's identity has been validated by the MEGGA team. Finish the verification from the CRM and I'll take care of it right after.",
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
  // Refus À LA PRÉPARATION d'update_pipeline, avant toute question : le geste n'envoie rien,
  // « rien envoyé » y serait faux.
  contactNotFoundPipeline: {
    fr: 'Contact introuvable dans ton agence, rien déplacé.',
    en: 'Contact not found in your agency — nothing moved.',
  },
  // La fiche existe mais ne porte aucun numéro. L'exécuteur range encore ce cas sous
  // contactNotFoundSend, qui dit « introuvable » d'un contact bien présent : la préparation,
  // qui le refuse désormais avant le « oui », dit la vraie raison et quoi faire.
  contactNoPhoneSend: {
    fr: "Ce contact n'a pas de numéro, rien envoyé. Ajoute-le sur sa fiche.",
    en: 'This contact has no phone number — nothing sent. Add it to their record.',
  },
  sendFail24h: {
    fr: "L'envoi au client a échoué (fenêtre 24h ou numéro non autorisé ?).",
    en: 'Sending to the client failed (24h window or number not allowed?).',
  },
  sendFailNet: {
    fr: "L'envoi au client a échoué (réseau).",
    en: 'Sending to the client failed (network).',
  },
  templateOffer: {
    fr: "Sa fenêtre 24h est fermée. Je peux lui envoyer le message de relance approuvé (template) à la place — réponds « oui » pour l'envoyer, « non » sinon.",
    en: 'Their 24h window is closed. I can send the approved re-engagement template instead — reply “yes” to send it, “no” otherwise.',
  },
  templateSent: {
    fr: '✅ Relance approuvée (template) envoyée. Sa réponse rouvrira la conversation pour un échange libre.',
    en: '✅ Approved re-engagement template sent. Their reply will reopen the conversation for free-form messaging.',
  },
  clientMsgSent: {
    fr: '✅ Message envoyé au client.',
    en: '✅ Message sent to the client.',
  },
  // Deux lecteurs : stashPending, qui refuse AVANT toute question un outil que le registre ne
  // déclare pas (un nom inventé par le modèle) ; executePending, filet pour une action en attente
  // dont le webhook ne connaît pas l'outil. Rien n'est fait dans les deux cas — le dire, et dire
  // quoi faire : « Type d'action inconnu » ne parlait qu'au code. « Pas trouvé comment » et non
  // « je ne sais pas » : le modèle a pu se tromper de nom pour une action qui existe.
  unknownAction: {
    fr: "Je n'ai pas trouvé comment faire ça depuis WhatsApp, je n'ai rien fait. Reformule ta demande, ou passe par le CRM.",
    en: "I couldn't find a way to do that from WhatsApp — nothing done. Rephrase your request, or use the CRM.",
  },
  // ── Boutons de confirmation (spec 2026-09-10) ──────────────────────────────
  // ⛔ Un libellé de bouton ne doit JAMAIS être un mot-clé STOP : le webhook traite un appui
  // dont le libellé en est un comme un opt-out par BOUTON, avant même de savoir que
  // l'expéditeur est un agent. « Cancel » est dans la liste internationale — un bouton
  // [Cancel] désinscrirait l'agent de son brief. Verrouillé par whatsapp-i18n.test.ts.
  // ⚠ 20 caractères au plus (limite Meta d'un libellé).
  btnYes: {
    fr: 'Oui',
    en: 'Yes',
  },
  btnNo: {
    fr: 'Non',
    en: 'No',
  },
  // Corps du message à boutons quand la question complète est partie à part (> 1024 car.).
  confirmShort: {
    fr: 'Tu confirmes ?',
    en: 'Confirm?',
  },
  // Parle de l'APPUI, jamais de l'action. Sur un double appui, le PREMIER a déjà exécuté
  // l'action (ex. message envoyé au client) — seul le SECOND devient « périmé ». Dire
  // « rien n'a été fait » à ce second appui ferait croire à l'agent que l'envoi n'a jamais eu
  // lieu, et il le relancerait : un doublon vers le client. Le texte dit donc que CET APPUI
  // n'a rien déclenché, sans jamais se prononcer sur l'action elle-même — qui a pu aboutir.
  staleButton: {
    fr: "Ce bouton ne correspond plus à une action en attente (déjà traitée, annulée ou expirée) : cet appui n'a rien déclenché.",
    en: 'This button no longer matches a pending action (already handled, cancelled or expired): this tap did nothing.',
  },
  // Réponse honnête quand DeepSeek a simulé une confirmation deux fois d'affilée (garde
  // `whatsapp-phantom-action.ts`). Elle dit qu'AUCUNE action n'attend, pour que l'agent ne
  // réponde pas « oui » à une question qui n'a jamais rien préparé.
  phantomAction: {
    fr: "Je n'ai pas réussi à préparer cette action : elle n'est ni faite, ni en attente de ta confirmation. Redis-la-moi (par exemple « supprime la fiche de Dubois ») et je te la soumets avec les boutons Oui et Non.",
    en: "I couldn't prepare that action: it is neither done nor waiting for your confirmation. Ask me again (e.g. “delete Dubois's record”) and you'll get Yes and No buttons to confirm it.",
  },
} as const

export type WaStringKey = keyof typeof STR
export function t(lang: WaLang, key: WaStringKey): string {
  return STR[key][lang]
}

/**
 * Ce qu'on dit à l'AGENT quand la garde d'envoi refuse.
 *
 * ⛔ Le paramètre est le motif EXPOSABLE, jamais le motif précis. Dire « phone_suppressed »
 * apprendrait à l'agence B qu'un numéro a écrit STOP à l'agence A — l'oracle exact que la
 * policy RLS cache. `not_contactable` est le seul mot juste quand la personne n'est pas la
 * nôtre.
 *
 * Chaque message dit aussi QUOI FAIRE : un refus qu'on ne sait pas lever se solde par un
 * agent qui réessaie en boucle, puis qui contourne.
 */
export function refusalText(lang: WaLang, publicReason: string): string {
  const FR: Record<string, string> = {
    do_not_contact: "Cette personne a demandé à ne plus être contactée. Je n'envoie rien.",
    opted_out: "Cette personne s'est désinscrite. Je n'envoie rien.",
    phone_suppressed: 'Ce numéro est bloqué (désinscription). Rien envoyé.',
    not_contactable: "Ce contact n'est pas joignable par WhatsApp. Rien envoyé.",
    no_opt_in: "Pas de consentement pour écrire en premier à ce contact, et sa fenêtre 24h est fermée. Rien envoyé.",
    marketing_requires_consent: "Ce message est promotionnel : il demande un consentement explicite, que ce contact n'a pas donné. Rien envoyé.",
    invalid_phone: "Le numéro de ce contact est inexploitable. Corrige-le sur sa fiche.",
    kill_switch: 'MEGGA WhatsApp est coupé pour le moment. Rien envoyé.',
    agent_link_unverified: "Ce numéro n'est pas un agent vérifié. Rien envoyé.",
    window_closed: "Sa fenêtre 24h est fermée. Rien envoyé.",
  }
  const EN: Record<string, string> = {
    do_not_contact: "This person asked not to be contacted again. I'm not sending anything.",
    opted_out: "This person unsubscribed. I'm not sending anything.",
    phone_suppressed: 'This number is blocked (unsubscribed). Nothing sent.',
    not_contactable: 'This contact cannot be reached on WhatsApp. Nothing sent.',
    no_opt_in: "No consent to message this contact first, and their 24h window is closed. Nothing sent.",
    marketing_requires_consent: 'This message is promotional: it needs explicit consent, which this contact has not given. Nothing sent.',
    invalid_phone: "This contact's number is unusable. Fix it on their record.",
    kill_switch: 'MEGGA WhatsApp is switched off right now. Nothing sent.',
    agent_link_unverified: 'This number is not a verified agent. Nothing sent.',
    window_closed: 'Their 24h window is closed. Nothing sent.',
  }
  const table = lang === 'en' ? EN : FR
  // Un motif inconnu ne doit pas produire un message vide : mieux vaut le générique que rien.
  return table[publicReason] ?? table.not_contactable
}

/** Suffixe de confirmation, réutilisé par les prompts paramétrés. */
export function confirmSuffix(lang: WaLang): string {
  return lang === 'en' ? 'Confirm? (reply « yes » / « no »)' : 'Tu confirmes ? (« oui » / « non »)'
}

/** Suffixe pour les BROUILLONS CLIENT (message/email) : en plus de oui/non, invite l'agent à
 *  corriger en texte libre (« non, plutôt… »). Rend découvrable le chemin set-aside→re-rédaction
 *  existant (le cerveau retraite la correction). NE PAS utiliser pour les actions discrètes
 *  (pipeline/KYC) où une « correction » en texte libre n'a pas de sens. */
export function confirmSuffixCorrectable(lang: WaLang): string {
  return lang === 'en'
    ? 'Confirm? (« yes » / « no », or tell me what to change)'
    : 'Tu confirmes ? (« oui » / « non », ou dis-moi quoi changer)'
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
  if (lang === 'en') return `Here's what I'd send to ${who}:\n\n${body}\n\nSend it? ${confirmSuffixCorrectable('en')}`
  return `Voici ce que je propose d'envoyer à ${who} :\n\n${body}\n\nJ'envoie ? ${confirmSuffixCorrectable('fr')}`
}

/** update_pipeline — prompt de confirmation. `who` = « le dossier de X » / « X's file ». */
export function confirmUpdatePipeline(lang: WaLang, who: string, stageLabel: string): string {
  if (lang === 'en') return `I'll move ${who} to « ${stageLabel} ». ${confirmSuffix('en')}`
  return `Je vais déplacer ${who} en « ${stageLabel} ». ${confirmSuffix('fr')}`
}

/** delete_contact — prompt de confirmation (DESTRUCTIF + IRRÉVERSIBLE, jamais auto). */
export function confirmDeleteContact(lang: WaLang, name: string): string {
  if (lang === 'en') {
    return `⚠ I'll permanently delete ${name}'s record, along with their matches and visits. KYC files and transactions are kept (unlinked), as the law requires. This can't be undone. ${confirmSuffix('en')}`
  }
  return `⚠ Je vais supprimer définitivement la fiche de ${name}, avec ses correspondances et visites. Ses dossiers KYC et transactions sont conservés (déliés), comme la loi l'exige. C'est irréversible. ${confirmSuffix('fr')}`
}

/** delete_contact — aperçu déterministe pour la carte de validation du copilote web. */
export function deleteContactPreview(lang: WaLang, name: string): string {
  if (lang === 'en') {
    return `Delete ${name} from the CRM.\n\nRemoved with the contact: matches, visits, scores, WhatsApp insights.\nKept (unlinked, legal retention): KYC files, transactions, sent messages.\n\nThis is permanent and can't be undone.`
  }
  return `Supprimer ${name} du CRM.\n\nSupprimé avec le contact : correspondances, visites, scores, analyses WhatsApp.\nConservé (délié, rétention légale) : dossiers KYC, transactions, messages envoyés.\n\nAction définitive et irréversible.`
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
/** L'état a changé depuis l'action auto → on n'annule pas (sinon on écraserait un changement plus récent). */
export function undoStateChanged(lang: WaLang): string {
  return lang === 'en'
    ? "I didn't undo it — the deal has moved since. Tell me the exact stage you want."
    : "Je n’annule pas — le dossier a changé d’étape depuis. Dis-moi l’étape exacte que tu veux."
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

// ── Matching (lot D2) : `record_match_outcome` ──────────────────────────────
// Rendus VERBATIM à l'agent : la question [Oui] [Non], puis le compte rendu de l'exécuteur. « pour Julie », jamais
// « de Julie » : une interpolation ne sait pas élider (« d'Emma »). ⚠ Les comptes rendus commencent par « ✅ Consigné »
// / « ✅ Recorded », que SEUL l'exécuteur écrit, après le « oui » : la garde des confirmations simulées
// (whatsapp-phantom-action.ts) les reconnaît à leur FORME exacte (`CONSIGNE_ECHO`), pas à un simple préfixe — un
// préfixe prenait aussi un relais d'add_note portant le même « ✅ Consigné ». Les questions `confirmConsigner` de
// « propose » et « pas_encore » disent « Je consigne que » et non « Je note que » pour la même raison : sans mot
// d'action, leur imitation SANS le suffixe « (« oui » / « non ») » passait la garde.

/** Les motifs d'un refus, en toutes lettres — ceux du fil (`fil.motifs.*` de matching.json). */
const MOTIFS: Record<WaLang, Record<string, string>> = {
  fr: { prix: 'prix', quartier: 'quartier', surface: 'surface', pieces: 'pièces', type: 'type de bien', equipements: 'équipements', etat: 'état du bien', autre: 'autre' },
  en: { prix: 'price', quartier: 'neighbourhood', surface: 'floor area', pieces: 'rooms', type: 'property type', equipements: 'features', etat: 'condition', autre: 'other' },
}
export function motifLabel(lang: WaLang, motif: string | null | undefined): string {
  return (motif && MOTIFS[lang][motif]) || (lang === 'en' ? 'other' : 'autre')
}

/** Ce qui sera consigné : l'acheteur, le bien retrouvé, la réponse. */
export interface Consignation {
  reponse: 'propose' | 'interesse' | 'pas_interesse' | 'pas_encore'
  nom: string
  bien: string
  motif?: string | null
  note?: string | null
}

/** La question [Oui] [Non] : ce qui s'écrira, bien retrouvé compris — c'est là qu'un bien mal retrouvé se voit. */
export function confirmConsigner(lang: WaLang, c: Consignation): string {
  const note = c.note ? ` (« ${c.note} »)` : ''
  if (lang === 'en') {
    switch (c.reponse) {
      case 'propose': return `I'll record that you proposed « ${c.bien} » to ${c.nom}, with a follow-up in 3 days. Confirm? ("yes" / "no")`
      case 'interesse': return `I'll record for ${c.nom}: « ${c.bien} » — interested. Confirm? ("yes" / "no")`
      case 'pas_interesse': return `I'll record for ${c.nom}: « ${c.bien} » — not interested, reason: ${motifLabel('en', c.motif)}${note}. Confirm? ("yes" / "no")`
      case 'pas_encore': return `I'll record that ${c.nom} hasn't answered yet about « ${c.bien} »: the follow-up moves 3 days later. Confirm? ("yes" / "no")`
    }
  }
  switch (c.reponse) {
    // Lot D2 : « Je consigne que » et non « Je note que » — sans mot d'action, une imitation de cette question SANS
    // le suffixe « (« oui » / « non ») » (relu dans la mémoire de conversation) passait la garde des confirmations
    // simulées. L'anglais n'a pas ce défaut : ses quatre gabarits disent déjà « I'll record … ».
    case 'propose': return `Je consigne que tu as proposé « ${c.bien} » à ${c.nom}, avec une relance dans 3 jours. Tu confirmes ? (« oui » / « non »)`
    case 'interesse': return `Je consigne pour ${c.nom} : « ${c.bien} » — intéressé·e. Tu confirmes ? (« oui » / « non »)`
    case 'pas_interesse': return `Je consigne pour ${c.nom} : « ${c.bien} » — pas intéressé·e, motif ${motifLabel('fr', c.motif)}${note}. Tu confirmes ? (« oui » / « non »)`
    case 'pas_encore': return `Je consigne que ${c.nom} n'a pas encore répondu pour « ${c.bien} » : la relance est repoussée de 3 jours. Tu confirmes ? (« oui » / « non »)`
  }
}

/** Le compte rendu, après le « oui » : ce qui A été écrit. */
export function consigne(lang: WaLang, c: Consignation): string {
  if (lang === 'en') {
    switch (c.reponse) {
      case 'propose': return `✅ Recorded: « ${c.bien} » proposed to ${c.nom}, follow-up in 3 days.`
      case 'interesse': return `✅ Recorded for ${c.nom}: « ${c.bien} » — interested.`
      case 'pas_interesse': return `✅ Recorded for ${c.nom}: « ${c.bien} » — not interested (${motifLabel('en', c.motif)}).`
      case 'pas_encore': return `✅ Recorded: ${c.nom} hasn't answered about « ${c.bien} » yet — follow-up in 3 days.`
    }
  }
  switch (c.reponse) {
    case 'propose': return `✅ Consigné : « ${c.bien} » proposé à ${c.nom}, relance dans 3 jours.`
    case 'interesse': return `✅ Consigné pour ${c.nom} : « ${c.bien} » — intéressé·e.`
    case 'pas_interesse': return `✅ Consigné pour ${c.nom} : « ${c.bien} » — pas intéressé·e (${motifLabel('fr', c.motif)}).`
    case 'pas_encore': return `✅ Consigné : ${c.nom} n'a pas encore répondu pour « ${c.bien} » — relance dans 3 jours.`
  }
}

/** Un collègue a consigné entre le « oui » et l'écriture : rien n'est réécrit. */
export function consignationDeja(lang: WaLang, nom: string, bien: string): string {
  return lang === 'en'
    ? `Nothing was written: ${nom}'s answer about « ${bien} » was already recorded in the meantime.`
    : `Rien n'a été écrit : la réponse pour ${nom} sur « ${bien} » a déjà été consignée entre-temps.`
}

/**
 * Entre la question et le « oui », le bien a quitté le statut que la réponse suppose SANS porter cette réponse (un
 * proposé refusé, un intéressé revenu en arrière ; tout mouvement, pour « pas encore », qui n'écrit aucun statut) :
 * rien n'est écrit, et « déjà consignée » serait faux.
 */
export function consignationChangee(lang: WaLang, nom: string, bien: string): string {
  return lang === 'en'
    ? `Nothing was written: « ${bien} » is no longer waiting for this answer from ${nom} — it changed in the meantime.`
    : `Rien n'a été écrit : « ${bien} » n'attend plus cette réponse pour ${nom}, il a changé entre-temps.`
}

/** Le match n'est plus dans l'agence (supprimé, ou jamais le sien). */
export function consignationImpossible(lang: WaLang): string {
  return lang === 'en'
    ? 'Nothing was written: this property is no longer in your agency’s loop.'
    : "Rien n'a été écrit : ce bien n'est plus dans la boucle de ton agence."
}

/** L'écriture a échoué : rien n'est écrit, l'agent peut réessayer. */
export function consignationEchec(lang: WaLang): string {
  return lang === 'en'
    ? 'Recording failed — nothing was written. Try again in a moment.'
    : "La consignation a échoué — rien n'a été écrit. Réessaie dans un instant."
}

/** Une panne de TRANSPORT (l'erreur ne porte pas de `code` Postgres) : la base a pu écrire avant que la réponse ne se
 *  perde. « Rien n'a été écrit » serait parfois faux — la phrase reste honnête sur ce qu'on ignore. */
export function consignationNonConfirmee(lang: WaLang): string {
  return lang === 'en'
    ? 'Not confirmed — check the record before trying again.'
    : 'Non confirmée — vérifie la fiche avant de réessayer.'
}

/** Un refus sans motif ne se consigne pas : le motif nourrit « Apprendre ». */
export function consignerMotifManquant(lang: WaLang): string {
  return lang === 'en'
    ? 'To record "not interested", I need the reason: price, neighbourhood, floor area, rooms, property type, features, condition or other.'
    : 'Pour « pas intéressé », il me faut le motif : prix, quartier, surface, pièces, type de bien, équipements, état du bien ou autre.'
}

/** La réponse manque, ou n'est pas l'une des quatre : rien ne se prépare. */
export function consignerQuelleReponse(lang: WaLang): string {
  return lang === 'en'
    ? 'Which answer? propose, interesse, pas_interesse or pas_encore.'
    : 'Quelle réponse ? propose, interesse, pas_interesse ou pas_encore.'
}

/** L'acheteur n'est pas résolu (aucun identifiant, mal formé, hors de l'agence) : le modèle le retrouve d'abord. */
export function consignerQuelAcheteur(lang: WaLang): string {
  return lang === 'en'
    ? 'Which buyer? Find them first with search_contacts.'
    : 'Quel acheteur ? Retrouve-le d’abord avec search_contacts.'
}

/** Ce que la réponse suppose du bien, pour dire où on l'a cherché. */
function ouCherche(lang: WaLang, reponse: Consignation['reponse']): string {
  if (lang === 'en') return reponse === 'propose' ? 'to propose' : reponse === 'pas_interesse' ? 'proposed or interested' : 'proposed and awaiting an answer'
  return reponse === 'propose' ? 'à proposer' : reponse === 'pas_interesse' ? 'proposé ou intéressé' : 'proposé en attente de réponse'
}

/** Les biens qu'un refus nomme, au plus : au-delà, « (5 sur N) » dit le reste. */
const BIENS_NOMMES_MAX = 5

const nommer = (titres: readonly string[]): string => titres.slice(0, BIENS_NOMMES_MAX).map((t) => `« ${t} »`).join(', ')

/**
 * Le total en clair d'une liste réduite à cinq. Lecture complète (`plancher` nul) : rien à cinq biens ou moins, sinon
 * « (5 sur N) ». Lecture COUPÉE (`plancher` : les lignes qu'elle a gardées, un minimum de ce que l'acheteur a) :
 * « (n sur plus de P) » TOUJOURS, même pour deux biens nommés — une liste courte tirée d'une page coupée passerait
 * sinon pour tout ce qu'il a.
 */
function compteEnClair(lang: WaLang, nommes: number, plancher: number | null): string {
  if (plancher != null) {
    const n = Math.min(nommes, BIENS_NOMMES_MAX)
    return lang === 'en' ? ` (${n} of over ${plancher})` : ` (${n} sur plus de ${plancher})`
  }
  if (nommes <= BIENS_NOMMES_MAX) return ''
  return lang === 'en' ? ` (${BIENS_NOMMES_MAX} of ${nommes})` : ` (${BIENS_NOMMES_MAX} sur ${nommes})`
}

/**
 * Aucun bien ne répond au texte : le copilote nomme ceux qu'il a regardés, sans rien écrire. `plancher` : la page lue
 * pour les nommer avait elle-même mordu sa limite (`LIMITE_DEPART`) — `titres` n'en est qu'un extrait, jamais le
 * compte réel de ce que l'acheteur a ; et une page coupée où rien ne se nommait ne prouve pas qu'il n'a « aucun
 * bien ».
 */
export function consignerAucunBien(
  lang: WaLang, reponse: Consignation['reponse'], nom: string, titres: readonly string[], plancher: number | null = null,
): string {
  const liste = nommer(titres)
  const compte = compteEnClair(lang, titres.length, plancher)
  const coupe = plancher != null
  if (lang === 'en') {
    if (titres.length) return `No property ${ouCherche('en', reponse)} for ${nom} matches. Those I found${compte}: ${liste}. Which one?`
    return coupe ? `No property ${ouCherche('en', reponse)} for ${nom} matches.` : `${nom} has no property ${ouCherche('en', reponse)}.`
  }
  if (titres.length) return `Aucun bien ${ouCherche('fr', reponse)} pour ${nom} ne correspond. Ceux que je vois${compte} : ${liste}. Lequel ?`
  return coupe ? `Aucun bien ${ouCherche('fr', reponse)} pour ${nom} ne correspond.` : `${nom} n'a aucun bien ${ouCherche('fr', reponse)}.`
}

/** Plusieurs biens répondent au texte (ou son absence) : le copilote ne choisit pas. `plancher` : voir `consignerAucunBien`. */
export function consignerPlusieursBiens(lang: WaLang, nom: string, titres: readonly string[], plancher: number | null = null): string {
  const liste = nommer(titres)
  const compte = compteEnClair(lang, titres.length, plancher)
  return lang === 'en'
    ? `Several properties for ${nom} match${compte}: ${liste}. Which one?`
    : `Plusieurs biens pour ${nom} correspondent${compte} : ${liste}. Lequel ?`
}

/**
 * Sans texte, la page des matchs de l'acheteur a été coupée et aucun de ses biens ne se nomme (mandats supprimés,
 * annonces retirées pour « propose ») : ni « aucun bien » (il y en a plus d'une page), ni une liste vide
 * (« correspondent : . »). Le copilote demande lequel.
 */
export function consignerTropDeBiens(lang: WaLang, reponse: Consignation['reponse'], nom: string): string {
  return lang === 'en'
    ? `Which property ${ouCherche('en', reponse)} for ${nom}? There are too many for me to list: give its name, address or town, or its identifier (via get_matches).`
    : `Quel bien ${ouCherche('fr', reponse)} pour ${nom} ? Il y en a trop pour que je les nomme : donne son nom, son adresse ou sa ville, ou son identifiant (via get_matches).`
}

/**
 * La désignation par texte a mordu sur SA PROPRE limite (`wa_matching_biens_de_l_acheteur`, LIMITE_DESIGNES+1
 * lignes) : un bien de l'acheteur répondant au texte peut exister au-delà de ce qu'elle a rendu — ni un bien seul, ni
 * « aucun » ne seraient fondés. Sur le modèle de la « recherche trop large » de `execGetBuyersForProperty`, mais pour
 * un acheteur : nomme aussi le texte cherché, pour qu'un « trop large » répété avec le même mot ne surprenne pas
 * l'agent.
 */
export function consignerTropLarge(lang: WaLang, nom: string, texte: string): string {
  return lang === 'en'
    ? `For ${nom}, the search "${texte}" is too broad to settle: give the address, or the property's identifier (via get_matches).`
    : `Pour ${nom}, la recherche « ${texte} » est trop large pour trancher : donne l'adresse, ou l'identifiant du bien (via get_matches).`
}

/**
 * L'ÉCHO d'un libellé (le texte porte son « · ») : relue jusqu'au plafond de `wa_matching_biens_de_l_acheteur`, sa
 * désignation reste coupée — la base ne reçoit que ses MOTS, et trop de biens de l'acheteur y répondent. Pas « donne
 * l'adresse » : le texte EST déjà un libellé, et 252 des 1 800 annonces que suit l'agence WhatsApp n'ont pas
 * d'adresse (mesuré le 25.09.2026). La réponse se consigne depuis le CRM.
 */
export function consignerEchoTropLarge(lang: WaLang, nom: string, texte: string): string {
  return lang === 'en'
    ? `Too many of ${nom}'s properties match the words of « ${texte} » for me to settle this over WhatsApp: record the answer from the CRM.`
    : `Trop de biens de ${nom} répondent aux mots de « ${texte} » pour que je tranche par WhatsApp : consigne cette réponse depuis le CRM.`
}

/**
 * `propose` sur une annonce RETIRÉE du marché consignerait un deal et une relance sur un bien parti : elle ne se
 * propose plus, ni dans le fil ni selon `NOTE_MODELE` (whatsapp-matching.ts). Nomme ce qui a été écarté, cinq au
 * plus ; rien n'est consigné. Les MANDATS n'ont pas cette règle ici : la consignation ne lit pas leur `occasion`
 * (`proposable`, whatsapp-matching-outils.ts).
 */
export function consignerAnnonceRetiree(lang: WaLang, titres: readonly string[]): string {
  const liste = nommer(titres) + compteEnClair(lang, titres.length, null)
  const pluriel = titres.length > 1
  if (lang === 'en') {
    return pluriel
      ? `${liste} are no longer on the market: they can't be proposed any more. Nothing recorded.`
      : `${liste} is no longer on the market: it can't be proposed any more. Nothing recorded.`
  }
  return pluriel
    ? `${liste} sont retirées du marché : elles ne se proposent plus. Rien n'est consigné.`
    : `${liste} est retirée du marché : elle ne se propose plus. Rien n'est consigné.`
}
