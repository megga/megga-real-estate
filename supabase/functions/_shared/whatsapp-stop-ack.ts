// Accusé de désinscription WhatsApp, en quatre langues.
//
// POURQUOI IL NE PEUT PAS SE RÉDUIRE À « c'est noté ». Pour une personne dont le PREMIER
// message est « stop », c'est le SEUL message qu'elle recevra jamais de nous : l'avis de
// traitement (art. 19 nLPD) que le cron envoie d'ordinaire au premier contact est
// justement supprimé pour elle — `whatsapp_pending_notices` exclut les numéros bloqués
// par `stop_keyword`/`meta_block`, sans quoi MEGGA répondrait à un STOP par un message
// commercial dans l'heure. L'obligation d'information doit donc être portée ICI, ou
// nulle part.
//
// Il part UNE fois par suppression, pas « une fois par 24 h » : l'unicité de la ligne
// active de `contact_suppressions` EST le plafond, et `ack_sent_at` la consomme.
//
// PUR : aucun I/O, testable sous Node comme sous Deno.

import type { AckLang } from './whatsapp-stop-keywords.ts'

/** Contact du responsable de traitement. Canon du dépôt (PrivacyPage, consents.ts). */
const PRIVACY_EMAIL = 'privacy@megga.ch'
const PRIVACY_URL = 'https://megga.ch/privacy'

export interface StopAckContext {
  lang: AckLang
  /**
   * Raison sociale de l'agence CONSTATANTE. Absente quand le numéro est inconnu du CRM ou
   * que l'agence est indéterminable — `pickTriageAgency` rend délibérément `null` dès
   * qu'il y a ≥ 2 agences vérifiées, plutôt que de deviner. On nomme alors MEGGA, qui est
   * l'exploitant du numéro : c'est vrai dans tous les cas, là où nommer une agence au
   * hasard serait faux dans un cas sur deux.
   */
  agencyName?: string | null
}

/**
 * Six informations, dans cet ordre : le retrait est acté · qui traite · quelles données ·
 * pourquoi · combien de temps · comment exercer ses droits.
 *
 * ⚠ Aucun tiret cadratin : `meggaProse` les convertit en virgules sur le chemin d'envoi.
 * Écrire le texte déjà normalisé évite qu'il diffère de ce qui part réellement.
 *
 * ⚠ La formulation de la DURÉE reste volontairement qualitative (« le temps requis par nos
 * obligations légales ») : le dépôt ne fixe aujourd'hui aucun délai de conservation pour
 * `whatsapp_messages.body`, que la purge quotidienne ne touche pas (elle ne vide que
 * `raw`). Annoncer un nombre d'années que rien n'applique serait une promesse fausse, et
 * une promesse fausse sur la conservation est précisément ce que la LPD sanctionne.
 */
const ACK: Record<AckLang, (who: string) => string> = {
  fr: (who) =>
    `C'est noté : nous ne vous enverrons plus de messages sur ce numéro.\n\n` +
    `Responsable du traitement : ${who}. Nous conservons votre numéro dans un registre de ` +
    `désinscription, précisément pour ne plus vous écrire. Les messages déjà échangés sont ` +
    `conservés le temps requis par nos obligations légales, dans le cadre de notre activité ` +
    `immobilière.\n\n` +
    `Vous pouvez demander l'accès à vos données, leur rectification ou leur effacement : ` +
    `${PRIVACY_EMAIL}. Détail : ${PRIVACY_URL}`,

  de: (who) =>
    `Notiert: Wir senden Ihnen keine Nachrichten mehr an diese Nummer.\n\n` +
    `Verantwortlich für die Bearbeitung: ${who}. Wir bewahren Ihre Nummer in einem ` +
    `Abmeldeverzeichnis auf, gerade damit wir Ihnen nicht mehr schreiben. Bereits ` +
    `ausgetauschte Nachrichten bewahren wir so lange auf, wie es unsere gesetzlichen ` +
    `Pflichten im Rahmen unserer Immobilientätigkeit verlangen.\n\n` +
    `Sie können Auskunft, Berichtigung oder Löschung Ihrer Daten verlangen: ` +
    `${PRIVACY_EMAIL}. Einzelheiten: ${PRIVACY_URL}`,

  en: (who) =>
    `Noted: we will not send you any further messages on this number.\n\n` +
    `Data controller: ${who}. We keep your number in an unsubscribe register, precisely so ` +
    `that we do not write to you again. Messages already exchanged are kept for as long as ` +
    `our legal obligations require, as part of our real estate activity.\n\n` +
    `You can request access to your data, its correction or its deletion: ${PRIVACY_EMAIL}. ` +
    `Details: ${PRIVACY_URL}`,

  it: (who) =>
    `Preso nota: non le invieremo più messaggi a questo numero.\n\n` +
    `Titolare del trattamento: ${who}. Conserviamo il suo numero in un registro di ` +
    `cancellazione, proprio per non scriverle più. I messaggi già scambiati sono conservati ` +
    `per il tempo richiesto dai nostri obblighi di legge, nell'ambito della nostra attività ` +
    `immobiliare.\n\n` +
    `Può chiedere l'accesso ai suoi dati, la loro rettifica o cancellazione: ` +
    `${PRIVACY_EMAIL}. Dettagli: ${PRIVACY_URL}`,
}

/** Accusé de désinscription portant l'avis LPD, dans la langue demandée. */
export function buildStopAck(ctx: StopAckContext): string {
  const who = (ctx.agencyName ?? '').trim() || 'MEGGA'
  return (ACK[ctx.lang] ?? ACK.fr)(who)
}
