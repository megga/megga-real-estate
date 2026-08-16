/**
 * La copie de la page publique de préférences d'e-mail, dans les quatre langues.
 *
 * ⛔ PAS DE `react-i18next` ICI, ET C'EST LE POINT. i18next rend la langue de l'INTERFACE,
 * c'est-à-dire celle de l'agent connecté. Cette page s'adresse à un CLIENT qui n'a pas de
 * compte, et sa langue vient de `contacts.language`, rendue par l'edge `email-preferences`.
 * Passer par i18next afficherait la page dans la langue du navigateur de qui clique — ce qui
 * marche par hasard, et se trompe dès qu'il consulte ses e-mails ailleurs.
 *
 * Même raison qu'ailleurs dans ce chantier : la langue de correspondance suit la personne à
 * qui l'on écrit, jamais celle qui écrit.
 */

/** Les quatre langues du produit (CLAUDE.md §6). */
export type LangueDesinscription = 'fr' | 'de' | 'en' | 'it'

export interface CopieDesinscription {
  /** titre */
  T1: string
  /** intro */
  T2: string
  /** case 1 — relances écrites par le courtier */
  T3: string
  /** aide de la case 1 */
  T4: string
  /** case 2 — fiches de bien */
  T5: string
  /** aide de la case 2 */
  T6: string
  /** case 3 — suivis automatiques */
  T7: string
  /** aide de la case 3 */
  T8: string
  /** case « tout couper » */
  T9: string
  /** aide du « tout couper » */
  T10: string
  /** mention de conformité : le transactionnel continue, et ne se coupe pas ici */
  T11: string
  /** bouton */
  T12: string
  /** succès */
  T13: string
  /** aide du succès */
  T14: string
  /** erreur */
  T15: string
  /** aide de l'erreur */
  T16: string
  /** jeton refusé */
  T17: string
  /** aide du jeton refusé */
  T18: string
  /** mention nLPD */
  T19: string
  /** chargement */
  T20: string
}

export const DESINSCRIPTION_COPIE: Record<LangueDesinscription, CopieDesinscription> = {
  // français
  fr: {
    T1: "Vos préférences d'e-mail",
    T2: "Choisissez ce que vous souhaitez continuer de recevoir. Vos préférences prennent effet immédiatement.",
    T3: "Relances de votre courtier",
    T4: "Les messages que votre courtier vous écrit personnellement pour reprendre contact.",
    T5: "Biens qui pourraient vous intéresser",
    T6: "Les fiches de bien que votre courtier vous transmet.",
    T7: "Suivis automatiques",
    T8: "Les rappels envoyés sans intervention de votre courtier : avis après une visite, document manquant, nouvelles de votre projet.",
    T9: "Ne plus rien recevoir",
    T10: "Coupe les trois catégories ci-dessus, d'un seul geste.",
    T11: "Vous continuerez de recevoir les messages qui répondent à une démarche de votre part : confirmation d'une visite que vous avez demandée, convocation à une vérification d'identité. Ce ne sont pas des sollicitations, et ils ne peuvent pas être désactivés ici.",
    T12: "Enregistrer mes préférences",
    T13: "C'est enregistré.",
    T14: "Vos préférences ont été prises en compte.",
    T15: "Nous n'avons pas pu enregistrer votre demande.",
    T16: "Écrivez-nous à privacy@megga.ch et nous le ferons à la main.",
    T17: "Ce lien n'est plus valide.",
    T18: "Écrivez-nous à privacy@megga.ch et nous vous désinscrirons à la main.",
    T19: "Pour accéder à vos données, les corriger ou les supprimer : privacy@megga.ch",
    T20: "Chargement de vos préférences…",
  },
  // allemand de Suisse : « ss », jamais d'eszett
  de: {
    T1: "Ihre E-Mail-Einstellungen",
    T2: "Wählen Sie, was Sie weiterhin erhalten möchten. Ihre Einstellungen gelten sofort.",
    T3: "Nachfassen Ihres Maklers",
    T4: "Nachrichten, die Ihr Makler Ihnen persönlich schreibt, um wieder Kontakt aufzunehmen.",
    T5: "Immobilien, die Sie interessieren könnten",
    T6: "Die Immobilienangebote, die Ihr Makler Ihnen weiterleitet.",
    T7: "Automatische Erinnerungen",
    T8: "Erinnerungen, die ohne Zutun Ihres Maklers versendet werden: Rückmeldung nach einer Besichtigung, fehlendes Dokument, Neuigkeiten zu Ihrem Vorhaben.",
    T9: "Nichts mehr erhalten",
    T10: "Schaltet die drei Kategorien oben mit einem einzigen Klick aus.",
    T11: "Sie erhalten weiterhin Nachrichten, die auf eine Handlung Ihrerseits folgen: Bestätigung einer von Ihnen angefragten Besichtigung, Einladung zu einer Identitätsprüfung. Das sind keine Werbenachrichten, und sie lassen sich hier nicht abschalten.",
    T12: "Einstellungen speichern",
    T13: "Gespeichert.",
    T14: "Ihre Einstellungen wurden übernommen.",
    T15: "Wir konnten Ihre Anfrage nicht speichern.",
    T16: "Schreiben Sie uns an privacy@megga.ch, und wir erledigen es von Hand.",
    T17: "Dieser Link ist nicht mehr gültig.",
    T18: "Schreiben Sie uns an privacy@megga.ch, und wir melden Sie von Hand ab.",
    T19: "Zugang zu Ihren Daten, Berichtigung oder Löschung: privacy@megga.ch",
    T20: "Ihre Einstellungen werden geladen…",
  },
  // anglais
  en: {
    T1: "Your email preferences",
    T2: "Choose what you want to keep receiving. Your preferences take effect immediately.",
    T3: "Follow-ups from your agent",
    T4: "Messages your agent writes to you personally to get back in touch.",
    T5: "Properties that might interest you",
    T6: "Property listings your agent sends you.",
    T7: "Automatic follow-ups",
    T8: "Reminders sent without any action from your agent: feedback after a viewing, a missing document, news about your project.",
    T9: "Stop receiving anything",
    T10: "Turns off the three categories above, in one go.",
    T11: "You will continue to receive messages that respond to an action you have taken: confirmation of a viewing you requested, a request to complete an identity verification. These are not solicitations, and they cannot be turned off here.",
    T12: "Save my preferences",
    T13: "Saved.",
    T14: "Your preferences have been applied.",
    T15: "We could not save your request.",
    T16: "Write to us at privacy@megga.ch and we will do it manually.",
    T17: "This link is no longer valid.",
    T18: "Write to us at privacy@megga.ch and we will unsubscribe you manually.",
    T19: "To access, correct or delete your data: privacy@megga.ch",
    T20: "Loading your preferences…",
  },
  // italien, forme de courtoisie « Lei »
  it: {
    T1: "Le Sue preferenze e-mail",
    T2: "Scelga che cosa desidera continuare a ricevere. Le Sue preferenze hanno effetto immediato.",
    T3: "Solleciti del Suo agente immobiliare",
    T4: "I messaggi che il Suo agente immobiliare Le scrive personalmente per riprendere contatto.",
    T5: "Immobili che potrebbero interessarLe",
    T6: "Le schede degli immobili che il Suo agente immobiliare Le trasmette.",
    T7: "Messaggi automatici",
    T8: "I promemoria inviati senza l'intervento del Suo agente immobiliare: parere dopo una visita, documento mancante, aggiornamenti sul Suo progetto.",
    T9: "Non ricevere più nulla",
    T10: "Disattiva le tre categorie qui sopra, con un solo gesto.",
    T11: "Continuerà a ricevere i messaggi che rispondono a una Sua iniziativa: la conferma di una visita che ha richiesto, la convocazione a una verifica d'identità. Non sono sollecitazioni e non possono essere disattivati qui.",
    T12: "Salva le mie preferenze",
    T13: "Salvato.",
    T14: "Le Sue preferenze sono state registrate.",
    T15: "Non abbiamo potuto registrare la Sua richiesta.",
    T16: "Ci scriva a privacy@megga.ch e provvederemo manualmente.",
    T17: "Questo link non è più valido.",
    T18: "Ci scriva a privacy@megga.ch e La cancelleremo manualmente.",
    T19: "Per accedere ai Suoi dati, correggerli o cancellarli: privacy@megga.ch",
    T20: "Caricamento delle Sue preferenze…",
  },
}
