// supabase/functions/_shared/reminder-templates.ts
//
// La COPIE des rappels automatiques envoyés au contact, dans les quatre langues.
//
// POURQUOI ELLE EST ICI ET PLUS DANS L'EDGE FUNCTION. Elle vivait dans
// `send-reminder-email/index.ts`, donc hors de portée du banc de rendu
// (`npm run email:preview`) et de tout test : le banc montait la coquille avec un corps
// inventé, et personne ne regardait jamais le texte qui part réellement. C'est le même
// motif que l'extraction du gabarit lui-même vers `reminder-email.ts` le 15.08.2026.
//
// ⚠ CES TEXTES PARTENT PAR CRON, sans aucune requête d'où lire une langue :
// `automation-engine` déclenche `send-reminder-email` depuis `hourly_automation_scan()`.
// La langue ne peut donc venir que de `contacts.language` — la colonne, jamais
// `profiles.language` (qui est celle de l'agent) ni une préférence de navigateur.
//
// ⚠ CE SONT DES GABARITS, PAS DU TEXTE FINI : les `{{variable}}` sont résolues à l'envoi
// par `resolveTemplate`. Elles doivent être identiques d'une langue à l'autre, sinon une
// langue perdrait silencieusement le nom de l'agent ou celui de l'agence. C'est
// `reminder-templates.test.ts` qui le vérifie, pas la relecture.

import type { AppLocale } from './recipient-language.ts'

/**
 * Les types de rappel qui portent une copie par défaut.
 *
 * ⚠ Sous-ensemble VOLONTAIRE de `reminders.type`, qui en compte huit. Les trois autres
 * (`price_change`, `deal_stagnant`, `match_ignored`) ne sont jamais écrits avec
 * `channel: 'email'` par `automation-engine` : `deal_stagnant` et `match_ignored` naissent
 * en `notification`, et `price_change` n'a aucun producteur dans le dépôt. Leur donner une
 * copie ici laisserait croire qu'ils s'envoient.
 */
export type ReminderTemplateKind =
  | 'follow_up_sent_property'
  | 'post_visit_feedback'
  | 'dormant_lead'
  | 'missing_document'
  | 'custom'

export interface ReminderTemplate {
  subject: string
  body: string
}

/**
 * Copie par défaut, par langue puis par type de rappel.
 *
 * `Record<AppLocale, …>` et non un objet libre : c'est ce qui fait ÉCHOUER LA COMPILATION
 * quand une langue manque. Un ternaire `locale === 'en' ? … : …` avalait `de` et `it` en
 * silence, ce qui est exactement le défaut que ce chantier ferme.
 */
export const REMINDER_TEMPLATES: Record<
  AppLocale,
  Record<ReminderTemplateKind, ReminderTemplate>
> = {
  fr: {
    follow_up_sent_property: {
      subject: 'Suite à notre sélection de biens',
      body: `Bonjour {{contact.first_name}},

Je vous ai envoyé récemment une sélection de biens qui correspond à vos critères de recherche.

Avez-vous eu l'occasion de la consulter ? Je reste à votre disposition pour organiser des visites ou répondre à vos questions.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
    },
    post_visit_feedback: {
      subject: 'Votre avis suite à la visite',
      body: `Bonjour {{contact.first_name}},

Suite à notre visite récente, j'aimerais connaître votre impression.

Quels sont les points qui vous ont plu ? Y a-t-il des éléments qui ne correspondent pas à vos attentes ?

Votre retour m'aidera à affiner ma recherche pour mieux répondre à vos critères.

Cordialement,
{{agent.full_name}}`,
    },
    dormant_lead: {
      subject: 'Des nouvelles de votre projet immobilier',
      body: `Bonjour {{contact.first_name}},

Je me permets de prendre de vos nouvelles concernant votre projet immobilier.

De nouveaux biens sont disponibles qui pourraient correspondre à vos critères. Souhaitez-vous que je vous envoie une sélection actualisée ?

N'hésitez pas à me contacter si votre projet a évolué.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
    },
    missing_document: {
      subject: 'Document requis pour votre dossier',
      body: `Bonjour {{contact.first_name}},

Afin de poursuivre le traitement de votre dossier, il nous manque encore certains documents.

Pourriez-vous nous les transmettre à votre meilleure convenance ? Cela nous permettra d'avancer rapidement.

Je reste disponible si vous avez des questions.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
    },
    custom: {
      subject: 'Point sur votre projet immobilier',
      body: `Bonjour {{contact.first_name}},

Je souhaitais faire un point avec vous concernant votre projet immobilier.

N'hésitez pas à me contacter pour en discuter. Je suis à votre disposition.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
    },
  },

  // Allemand de SUISSE : « ss » partout, jamais d'eszett (Grüsse, et non Grüße). La
  // formule de politesse est « Freundliche Grüsse » et non « Mit freundlichen Grüßen »,
  // qui est la forme d'Allemagne.
  de: {
    follow_up_sent_property: {
      subject: 'Zu unserer Immobilienauswahl',
      body: `Guten Tag {{contact.first_name}},

Ich habe Ihnen kürzlich eine Auswahl an Immobilien gesendet, die Ihren Suchkriterien entspricht.

Hatten Sie bereits Gelegenheit, diese anzusehen? Gerne organisiere ich Besichtigungen oder beantworte Ihre Fragen.

Freundliche Grüsse,
{{agent.full_name}}
{{agency.name}}`,
    },
    post_visit_feedback: {
      subject: 'Ihre Rückmeldung zur Besichtigung',
      body: `Guten Tag {{contact.first_name}},

Nach unserer letzten Besichtigung würde mich Ihr Eindruck interessieren.

Welche Punkte haben Ihnen gefallen? Gibt es Aspekte, die Ihren Erwartungen nicht entsprechen?

Ihre Rückmeldung hilft mir, die Suche noch genauer auf Ihre Kriterien abzustimmen.

Freundliche Grüsse,
{{agent.full_name}}`,
    },
    dormant_lead: {
      subject: 'Neuigkeiten zu Ihrem Immobilienprojekt',
      body: `Guten Tag {{contact.first_name}},

Ich melde mich, um mich nach Ihrem Immobilienprojekt zu erkundigen.

Es sind neue Immobilien verfügbar, die Ihren Kriterien entsprechen könnten. Soll ich Ihnen eine aktualisierte Auswahl senden?

Melden Sie sich gerne bei mir, falls sich Ihr Projekt verändert hat.

Freundliche Grüsse,
{{agent.full_name}}
{{agency.name}}`,
    },
    missing_document: {
      subject: 'Erforderliches Dokument für Ihr Dossier',
      body: `Guten Tag {{contact.first_name}},

Um die Bearbeitung Ihres Dossiers fortzusetzen, fehlen uns noch einige Dokumente.

Könnten Sie uns diese bei Gelegenheit zukommen lassen? So können wir zügig weiterarbeiten.

Bei Fragen stehe ich Ihnen gerne zur Verfügung.

Freundliche Grüsse,
{{agent.full_name}}
{{agency.name}}`,
    },
    custom: {
      subject: 'Stand Ihres Immobilienprojekts',
      body: `Guten Tag {{contact.first_name}},

Ich wollte mit Ihnen den Stand Ihres Immobilienprojekts durchgehen.

Melden Sie sich gerne bei mir, wenn Sie das besprechen möchten. Ich stehe Ihnen zur Verfügung.

Freundliche Grüsse,
{{agent.full_name}}
{{agency.name}}`,
    },
  },

  en: {
    follow_up_sent_property: {
      subject: 'Following up on our property selection',
      body: `Hello {{contact.first_name}},

I recently sent you a selection of properties matching your search criteria.

Have you had a chance to look through it? I remain available to arrange viewings or answer your questions.

Kind regards,
{{agent.full_name}}
{{agency.name}}`,
    },
    post_visit_feedback: {
      subject: 'Your feedback following the viewing',
      body: `Hello {{contact.first_name}},

Following our recent viewing, I would like to hear your impressions.

Which aspects did you like? Are there any that do not match your expectations?

Your feedback will help me refine my search to better match your criteria.

Kind regards,
{{agent.full_name}}`,
    },
    dormant_lead: {
      subject: 'News about your property project',
      body: `Hello {{contact.first_name}},

I am writing to check in on your property project.

New properties are available that could match your criteria. Would you like me to send you an updated selection?

Feel free to contact me if your project has changed.

Kind regards,
{{agent.full_name}}
{{agency.name}}`,
    },
    missing_document: {
      subject: 'Document required for your file',
      // ⚠ « at your convenience » et non « at your earliest convenience » : le français
      // « à votre meilleure convenance » ne met aucune pression de délai, et l'idiome
      // anglais en ajoute une. Écarté par la relecture adverse.
      body: `Hello {{contact.first_name}},

In order to continue processing your file, we are still missing some documents.

Could you send them to us at your convenience? This will allow us to move forward quickly.

I remain available if you have any questions.

Kind regards,
{{agent.full_name}}
{{agency.name}}`,
    },
    custom: {
      subject: 'An update on your property project',
      body: `Hello {{contact.first_name}},

I wanted to review your property project with you.

Feel free to contact me to discuss it. I remain at your disposal.

Kind regards,
{{agent.full_name}}
{{agency.name}}`,
    },
  },

  // Italien : forme de courtoisie « Lei » côté CLIENT (Suoi, Le, Sua), jamais le tutoiement
  // qui est la convention côté agent.
  it: {
    follow_up_sent_property: {
      subject: 'In merito alla nostra selezione di immobili',
      body: `Buongiorno {{contact.first_name}},

Le ho inviato di recente una selezione di immobili in linea con i Suoi criteri di ricerca.

Ha avuto modo di consultarla? Resto a Sua disposizione per organizzare delle visite o per rispondere alle Sue domande.

Cordiali saluti,
{{agent.full_name}}
{{agency.name}}`,
    },
    post_visit_feedback: {
      subject: 'Il Suo parere dopo la visita',
      body: `Buongiorno {{contact.first_name}},

Dopo la nostra recente visita, vorrei conoscere la Sua impressione.

Quali aspetti Le sono piaciuti? Ci sono elementi che non corrispondono alle Sue aspettative?

Il Suo riscontro mi aiuterà ad affinare la ricerca per rispondere meglio ai Suoi criteri.

Cordiali saluti,
{{agent.full_name}}`,
    },
    dormant_lead: {
      subject: 'Notizie sul Suo progetto immobiliare',
      body: `Buongiorno {{contact.first_name}},

Mi permetto di chiederLe notizie in merito al Suo progetto immobiliare.

Sono disponibili nuovi immobili che potrebbero corrispondere ai Suoi criteri. Desidera che Le invii una selezione aggiornata?

Non esiti a contattarmi se il Suo progetto è cambiato.

Cordiali saluti,
{{agent.full_name}}
{{agency.name}}`,
    },
    missing_document: {
      subject: 'Documento necessario per la Sua pratica',
      body: `Buongiorno {{contact.first_name}},

Per poter proseguire con la gestione della Sua pratica, ci mancano ancora alcuni documenti.

Potrebbe trasmetterceli quando Le è più comodo? Questo ci permetterà di procedere rapidamente.

Resto a disposizione se ha domande.

Cordiali saluti,
{{agent.full_name}}
{{agency.name}}`,
    },
    custom: {
      subject: 'Aggiornamento sul Suo progetto immobiliare',
      body: `Buongiorno {{contact.first_name}},

Desideravo fare il punto con Lei sul Suo progetto immobiliare.

Non esiti a contattarmi per parlarne. Sono a Sua disposizione.

Cordiali saluti,
{{agent.full_name}}
{{agency.name}}`,
    },
  },
}

/**
 * La copie d'un rappel, dans la langue du contact.
 *
 * Un `type` hors des cinq couverts retombe sur `custom` : c'est le comportement historique
 * de `send-reminder-email`, conservé parce qu'un rappel sans copie ne doit pas faire
 * échouer l'envoi. ⚠ Il reste un repli, pas une traduction : voir la note de
 * `ReminderTemplateKind`.
 */
export function reminderTemplate(type: string, locale: AppLocale): ReminderTemplate {
  const parLangue = REMINDER_TEMPLATES[locale] ?? REMINDER_TEMPLATES.fr
  return parLangue[type as ReminderTemplateKind] ?? parLangue.custom
}
