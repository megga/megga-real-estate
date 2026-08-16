// scripts/email-preview.ts — banc de rendu des e-mails MEGGA.
//
// `npm run email:preview` puis ouvrir `.email-preview/index.html`.
//
// POURQUOI CE BANC EXISTE. Il est né quand douze gabarits fabriquaient encore leur
// propre coquille et qu'aucun n'était couvert par un test de rendu : les migrer à
// l'aveugle aurait changé l'apparence d'e-mails que des gens reçoivent déjà, sans que
// personne ne le voie avant l'envoi. La migration est faite (`A_MIGRER` est vide dans
// `scripts/check-email-shell.mjs`), et le banc garde tout son emploi : il rend tout
// d'un coup, hors ligne, pour qu'on relise AVANT de livrer plutôt qu'après s'être
// plaint.
//
// ⚠ CE QUI EST RENDU DOIT ÊTRE CE QUI PART. Un banc qui approxime un bloc ne le
// couvre pas — il donne à croire qu'il le couvre, ce qui est pire que de l'omettre.
//
// Il sert aussi de constat : la planche de contact met côte à côte ce qui est passé à
// MEGGA X et ce qui ne l'est pas. La dette cesse d'être un chiffre dans un script.
//
// ⚠ DENO, ET NON NODE — exception assumée à la règle « scripts/ = Node », au même titre
// que `scripts/realadvisor-agencies/` est en Python. La raison est contrainte, pas
// esthétique : les gabarits SONT des modules Deno en TypeScript, et `scripts/` n'a aucun
// chargeur TS. Les réécrire en `.mjs` reviendrait à dupliquer les gabarits, donc à
// prévisualiser autre chose que ce qui part réellement — le contraire du but.
//
// ⚠ AUCUN ENVOI, AUCUN RÉSEAU, AUCUNE BASE : le banc n'écrit que des fichiers.

import {
  buildAttendeeEmail,
  buildHostEmail,
  buildCancellationEmail,
  buildReminderEmail as buildOnboardingReminderEmail,
  type OnboardingCallEmailData,
} from '../supabase/functions/_shared/onboarding-email.ts'
import { buildVerificationNotice } from '../supabase/functions/_shared/agency-verification-notice.ts'
import { buildBookingEmail } from '../supabase/functions/_shared/booking-email.ts'
import { buildMagicLinkEmail, type MagicLinkLocale } from '../supabase/functions/_shared/magic-link-email.ts'
import { buildDeviceAlertEmail } from '../supabase/functions/_shared/device-alert-email.ts'
import { buildTeamInviteEmail } from '../supabase/functions/_shared/team-invite-email.ts'
import { buildVisitEmail } from '../supabase/functions/_shared/visit-email.ts'
import { buildPropertyEmail } from '../supabase/functions/_shared/property-email.ts'
import { buildRelanceEmail } from '../supabase/functions/_shared/relance-email.ts'
import { buildContactReminderEmail } from '../supabase/functions/_shared/reminder-email.ts'
import { reminderTemplate } from '../supabase/functions/_shared/reminder-templates.ts'
import type { AppLocale } from '../supabase/functions/_shared/recipient-language.ts'

/** Valeurs de démonstration des `{{variable}}` du rappel, mêmes clés que `send-reminder-email`. */
const VARS_RAPPEL_DEMO: Record<string, string> = {
  'contact.first_name': 'Marie',
  'agent.full_name': 'Gregory Lyonnet',
  'agency.name': 'Régie du Rhône',
}
import { buildOptinInviteEmail } from '../supabase/functions/_shared/whatsapp-optin-send.ts'
import { optinCopy } from '../supabase/functions/_shared/whatsapp-optin-copy.ts'
import { buildWeeklyReportEmail } from '../supabase/functions/_shared/weekly-report-email.ts'
import { digestHtml } from '../supabase/functions/_shared/weekly-digest.ts'
import { unsubscribeFooterHtml } from '../supabase/functions/_shared/email-guard.ts'

/**
 * ⛔ LE PIED DE DÉSINSCRIPTION EST LE VRAI, pas une imitation.
 *
 * Ce banc en fabriquait un à la main — autre police, autre taille, autres couleurs,
 * autre texte — c'est-à-dire qu'il falsifiait le SEUL bloc légalement requis de
 * l'e-mail, celui qu'on a le plus de raisons de relire. Le vrai part bien en
 * production (`send-reminder-email`, `send-property-email`, `send-relance-email`
 * appellent tous `unsubscribeFooterHtml`) : quelqu'un aurait pu le casser sans que
 * le banc le montre.
 *
 * ⚠ L'hôte de démonstration est celui des EDGE FUNCTIONS, jamais `app.megga.ch` —
 * l'en-tête d'`email-guard.ts` explique pourquoi : le repli SPA de l'app rend 200
 * sur n'importe quel chemin et simulerait une désinscription réussie.
 */
const URL_DESINSCRIPTION_DEMO =
  'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/unsubscribe?token=jeton-de-demo'
import { buildAdminAlertEmail } from '../supabase/functions/_shared/admin-alert-email.ts'

const SORTIE = '.email-preview'

/** Instant fixe : un banc dont la sortie change à chaque exécution ne se compare pas. */
const QUAND = Date.parse('2026-08-17T07:00:00.000Z')

const appel: OnboardingCallEmailData = {
  callId: '00000000-0000-4000-8000-000000000001',
  attendeeName: 'Julien',
  attendeeEmail: 'julien@example.ch',
  agencyName: 'Régie du Rhône',
  hostName: 'l’équipe MEGGA',
  startMs: QUAND,
  durationMinutes: 30,
  timezone: 'Europe/Zurich',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  manageUrl: 'https://app.megga.ch/rendez-vous/jeton-de-demonstration',
  locale: 'fr',
}

/** Réponses de calibrage, telles que le wizard les poste (codes, pas libellés). */
const reponsesCalibrage = {
  portfolio: '6-20',
  business: 'both',
  team: '2-5',
  priority: 'mandates',
  cantons: 'Genève, Vaud',
}

interface Cas {
  id: string
  nom: string
  /** Fichier d'où sort le gabarit, pour savoir quoi ouvrir quand quelque chose cloche. */
  source: string
  /** Passé à la coquille commune ? Ce qui reste à `false` est la dette à résorber. */
  migre: boolean
  rendu: { subject: string; html: string }
}

const CAS: Cas[] = [
  // ── Passés à MEGGA X ──────────────────────────────────────────────────────
  { id: 'appel-confirmation-fr', nom: 'Appel d’accueil · confirmation (FR)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildAttendeeEmail(appel) },
  { id: 'appel-confirmation-en', nom: 'Appel d’accueil · confirmation (EN)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildAttendeeEmail({ ...appel, locale: 'en' }) },
  // Le cas SANS lien de visioconférence est réel (agenda d'hôte injoignable) et c'est
  // celui qu'on oublie de regarder : il doit rester lisible, sans bouton mort.
  { id: 'appel-confirmation-sans-lien', nom: 'Appel d’accueil · confirmation, sans lien Meet', source: '_shared/onboarding-email.ts', migre: true, rendu: buildAttendeeEmail({ ...appel, meetingUrl: null }) },
  { id: 'appel-rappel-fr', nom: 'Appel d’accueil · rappel J-1 (FR)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildOnboardingReminderEmail(appel) },
  { id: 'appel-rappel-en', nom: 'Appel d’accueil · rappel J-1 (EN)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildOnboardingReminderEmail({ ...appel, locale: 'en' }) },
  { id: 'appel-confirmation-de', nom: 'Appel d’accueil · confirmation (DE)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildAttendeeEmail({ ...appel, locale: 'de' }) },
  { id: 'appel-confirmation-it', nom: 'Appel d’accueil · confirmation (IT)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildAttendeeEmail({ ...appel, locale: 'it' }) },
  { id: 'appel-annulation-client', nom: 'Appel d’accueil · annulation (client)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildCancellationEmail(appel) },
  { id: 'appel-hote-nouveau', nom: 'Appel d’accueil · avis à l’équipe (interne)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildHostEmail(appel, 'booked', reponsesCalibrage) },
  { id: 'appel-hote-annule', nom: 'Appel d’accueil · annulation (interne)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildHostEmail({ ...appel, meetingUrl: null }, 'cancelled') },

  // Alerte plateforme — elle partait en TEXTE SEUL jusqu'au 15.08.2026. Le cas montré
  // porte deux alertes : c'est celui où la mise en page compte vraiment.
  {
    id: 'alerte-plateforme',
    nom: 'Alertes plateforme (interne MEGGA)',
    source: '_shared/admin-alert-email.ts',
    migre: true,
    rendu: buildAdminAlertEmail([
      { key: 'cron:weekly-digest-friday', subject: 'Cron weekly-digest-friday en retard', body: 'Le job pg_cron « weekly-digest-friday » est sans exécution depuis plus de 25h. Dernier run : 14.08.2026 19:00.' },
      { key: 'kyb:regie', subject: 'Dossier KYB à valider · Régie du Rhône', body: 'L’agence « Régie du Rhône » (CH) attend une revue humaine depuis 3 jours.' },
    ], new Date(QUAND)),
  },

  // Rapport hebdomadaire — migré le 15.08.2026. INTERNE à l'équipe MEGGA : aucune mention
  // légale, et une pilule qui mène à la console. Le cas montré porte des alertes non nulles,
  // celui qu'on veut regarder.
  // ⛔ LE BILAN DU VENDREDI MANQUAIT À CE BANC, et c'est ce qui a permis à son
  // ancien design de survivre à toute la migration : ni la porte (qui cherchait un
  // `<!DOCTYPE>` absent d'un fragment) ni la relecture ne le regardaient. Un gabarit
  // vivant qu'aucun des deux filets ne couvre finit par diverger en silence.
  {
    id: 'bilan-hebdomadaire-agent',
    nom: 'Bilan de la semaine (agent)',
    source: '_shared/weekly-digest.ts',
    migre: true,
    rendu: {
      subject: 'Ton bilan de la semaine',
      html: digestHtml(
        'Cette semaine, trois dossiers ont avancé et tu as rencontré deux nouveaux vendeurs.\n'
          + 'Deux correspondances attendent encore d\'être envoyées : c\'est le geste qui rapporte le plus la semaine prochaine.\n\n'
          + 'Bon week-end.',
        'Semaine au 15 août 2026',
        'https://app.megga.ch/dashboard',
      ),
    },
  },
  {
    id: 'rapport-hebdomadaire',
    nom: 'Rapport hebdomadaire (interne MEGGA)',
    source: '_shared/weekly-report-email.ts',
    migre: true,
    rendu: buildWeeklyReportEmail({
      periode: '08.08.2026 au 15.08.2026',
      rows: [
        { label: 'Agences totales', value: 13, delta: 2 },
        { label: 'Utilisateurs', value: 8, delta: 1 },
        { label: 'Biens actifs', value: 6 },
        { label: 'Transactions actives', value: 4, delta: 1 },
        { label: 'KYC à risque', value: 2, alertIfPositive: true },
        { label: 'Événements (7 j)', value: 1284 },
        { label: 'Erreurs système (7 j)', value: 0, alertIfPositive: true },
      ],
    }),
  },

  // Rappel automatique et consentement WhatsApp — migrés le 15.08.2026.
  //
  // ⚠ La copie ne vient PAS d'ici : elle est montée depuis `reminder-templates.ts`, la même
  // source que l'envoi réel. Le banc montrait auparavant un corps inventé, ce qui donnait à
  // croire qu'il couvrait un texte que personne n'avait jamais relu.
  ...(['fr', 'de', 'en', 'it'] as AppLocale[]).map((locale) => {
    // Les `{{variable}}` sont résolues à l'envoi par `send-reminder-email`. Les laisser
    // brutes ici montrerait un message que personne ne reçoit : le banc doit rendre ce qui
    // part, jusqu'au prénom.
    const t = reminderTemplate('dormant_lead', locale)
    const resolu = (s: string) =>
      s.replace(/\{\{(\w+\.\w+)\}\}/g, (_m, k: string) => VARS_RAPPEL_DEMO[k] ?? '')
    return {
      id: `rappel-automatique-${locale}`,
      nom: `Rappel automatique · relance dormante (${locale.toUpperCase()})`,
      source: '_shared/reminder-email.ts + _shared/reminder-templates.ts',
      migre: true,
      rendu: buildContactReminderEmail({
        subject: resolu(t.subject),
        body: resolu(t.body),
        agentName: 'Gregory Lyonnet',
        locale,
        unsubscribeHtml: unsubscribeFooterHtml(URL_DESINSCRIPTION_DEMO, locale),
      }),
    }
  }),
  {
    id: 'consentement-whatsapp',
    nom: 'Consentement WhatsApp',
    source: '_shared/whatsapp-optin-send.ts',
    migre: true,
    rendu: buildOptinInviteEmail({
      lang: 'fr',
      // ⚠ La VRAIE copie, pas une paraphrase : c'est la pièce juridique du parcours
      // (`whatsapp-optin-copy.ts`), archivée mot pour mot comme preuve du
      // consentement. Un banc qui en montre une version approchée ne permet pas de
      // relire ce qui part — et ne verrait pas non plus l'aperçu ni la mention légale.
      copy: optinCopy('fr', 'Régie du Rhône'),
      agencyName: 'Régie du Rhône',
      lien: 'https://wa.me/41225551010?text=OPTIN%20jeton-de-demonstration',
    }),
  },

  // Commerciaux — migrés le 15.08.2026. Les SEULS à porter une désinscription : leur
  // mention de pied diffère donc de tous les autres, et c'est ce qu'il faut regarder ici.
  {
    id: 'fiche-de-bien',
    // ⚠ La forme SANS photo est un cas réel (annonce sans cliché), mais ce n'est pas le cas
    // dominant : en production `photo_url` vaut `listing.gallery[0]?.url`. Le nom le dit
    // désormais, parce que ce banc a longtemps rendu cette seule forme — donc l'élément le
    // plus grand de cet e-mail n'avait jamais été relu. Voir `fiche-de-bien-photo`.
    nom: 'Fiche de bien · sans photo (annonce sans cliché)',
    source: '_shared/property-email.ts',
    migre: true,
    rendu: buildPropertyEmail({
      contactFirstName: 'Marie',
      agentName: 'Gregory Lyonnet',
      agentPhone: '+41 22 555 10 10',
      message: 'Vu ce matin, il correspond à ce dont nous parlions : proche du parc et sans travaux.',
      property: {
        title: '3.5 pièces avec terrasse',
        address: 'Rue Ancienne 12, 1227 Carouge',
        city: 'Carouge',
        price: 1_190_000,
        photo_url: null,
        source_url: 'https://www.example.ch/annonce/12345',
      },
      unsubscribeHtml: unsubscribeFooterHtml(URL_DESINSCRIPTION_DEMO),
    }),
  },
  {
    id: 'relance-agent',
    nom: 'Relance écrite par l’agent',
    source: '_shared/relance-email.ts',
    migre: true,
    rendu: buildRelanceEmail({
      subject: 'Une visite la semaine prochaine ?',
      body: 'Bonjour Marie,\n\nJe reviens vers vous au sujet du 3.5 pièces de Carouge. Il reste disponible, et deux visites sont prévues jeudi.\n\nSouhaitez-vous que je vous réserve un créneau ?',
      agentName: 'Gregory Lyonnet',
      agentSignature: null,
      unsubscribeHtml: unsubscribeFooterHtml(URL_DESINSCRIPTION_DEMO),
    }),
  },

  // Visite de bien — migrée le 15.08.2026. Les trois cas, et la variante vidéo : c'est
  // celle qui porte un bouton et dont le « lien à venir » se lit facilement de travers.
  ...([
    ['confirmation', { kind: 'confirmation_buyer', isVideo: false }],
    ['confirmation-video', { kind: 'confirmation_buyer', isVideo: true, videoLink: 'https://meet.google.com/abc-defg-hij' }],
    ['rappel-veille', { kind: 'reminder', isVideo: false }],
    ['notification-agent', { kind: 'notification_agent', isVideo: false }],
  ] as const).map(([id, patch]) => ({
    id: `visite-${id}`,
    nom: `Visite de bien · ${id.replace(/-/g, ' ')}`,
    source: '_shared/visit-email.ts',
    migre: true,
    rendu: buildVisitEmail({
      kind: 'confirmation_buyer',
      // 22:30 UTC = le LENDEMAIN 00:30 à Genève : le cas qui prouve la correction du
      // fuseau. L'ancien gabarit annonçait ici le 16 août à 22:30.
      scheduledAt: '2026-08-16T22:30:00.000Z',
      propertyTitle: '3.5 pièces, Carouge',
      propertyAddress: 'Rue Ancienne 12, 1227 Carouge',
      isVideo: false,
      videoLabel: 'Google Meet',
      videoLink: null,
      manageUrl: 'https://app.megga.ch/visite/jeton/modifier',
      buyerName: 'Marie Favre',
      agentName: 'Gregory Lyonnet',
      buyerEmail: 'marie@example.ch',
      buyerPhone: '+41 79 123 45 67',
      buyerMessage: 'Je serais intéressée par une visite en fin de journée si possible.',
      qualification: 'Budget : 1.2M · Financement : accord de principe',
      ...patch,
    }),
  })),

  // Les trois autres langues, sur les DEUX populations : la confirmation parle au CLIENT
  // (`contacts.language`), la notification à l'AGENT (`profiles.language`). Les registres
  // diffèrent, et c'est précisément ce qu'on vient regarder ici.
  ...(['de', 'en', 'it'] as AppLocale[]).flatMap((locale) =>
    ([
      ['confirmation', { kind: 'confirmation_buyer' as const }],
      ['notification-agent', { kind: 'notification_agent' as const }],
    ] as const).map(([id, patch]) => ({
      id: `visite-${id}-${locale}`,
      nom: `Visite de bien · ${id.replace(/-/g, ' ')} (${locale.toUpperCase()})`,
      source: '_shared/visit-email.ts',
      migre: true,
      rendu: buildVisitEmail({
        kind: 'confirmation_buyer',
        // 22:30 UTC = le LENDEMAIN 00:30 à Genève. Le cas est gardé dans chaque langue :
        // c'est lui qui prouve que le fuseau n'a pas suivi la locale.
        scheduledAt: '2026-08-16T22:30:00.000Z',
        propertyTitle: '3.5 pièces, Carouge',
        propertyAddress: 'Rue Ancienne 12, 1227 Carouge',
        isVideo: false,
        videoLabel: 'Google Meet',
        videoLink: null,
        manageUrl: 'https://app.megga.ch/visite/jeton/modifier',
        buyerName: 'Marie Favre',
        agentName: 'Gregory Lyonnet',
        buyerEmail: 'marie@example.ch',
        buyerPhone: '+41 79 123 45 67',
        buyerMessage: 'Je serais intéressée par une visite en fin de journée si possible.',
        qualification: 'Budget : 1.2M · Financement : accord de principe',
        locale,
        ...patch,
      }),
    })),
  ),

  // La forme AVEC photo, dans les quatre langues : c'est le cas dominant en production, et
  // la photo est le plus grand élément de cet e-mail.
  //
  // ⚠ URL RÉELLE, tirée de `market_listings.photos[1]` — c'est exactement ce que le front
  // passe (`photo_url: listing.gallery[0]?.url`), donc un CDN externe. Elle peut se périmer :
  // une image cassée ici signale une URL morte, pas un gabarit cassé. Ne pas la remplacer par
  // une `data:` URI, qui masquerait le comportement réel (la plupart des clients de messagerie
  // bloquent les images distantes par défaut, et c'est cela qu'on vient regarder).
  ...(['fr', 'de', 'en', 'it'] as AppLocale[]).map((locale) => ({
    id: `fiche-de-bien-photo${locale === 'fr' ? '' : `-${locale}`}`,
    nom: `Fiche de bien · avec photo (${locale.toUpperCase()})`,
    source: '_shared/property-email.ts',
    migre: true,
    rendu: buildPropertyEmail({
      contactFirstName: 'Marie',
      agentName: 'Gregory Lyonnet',
      agentPhone: '+41 22 555 10 10',
      // Sans message de l'agent : c'est la phrase par défaut du gabarit qu'on veut voir
      // traduite, le mot libre restant dans la langue où l'agent l'a écrit.
      property: {
        title: '3.5 pièces avec terrasse',
        address: 'Rue Ancienne 12, 1227 Carouge',
        city: 'Carouge',
        price: 1_190_000,
        photo_url: 'https://cdn.flatfox.ch/listings/v2/p149/4003361478/image/b67c9aa2de1d07a6f6c7f543d3335415.jpg',
        source_url: 'https://www.example.ch/annonce/12345',
      },
      locale,
      unsubscribeHtml: unsubscribeFooterHtml(URL_DESINSCRIPTION_DEMO, locale),
    }),
  })),

  // Sécurité et invitation — migrés le 15.08.2026. Le premier est le SEUL e-mail de
  // sécurité du produit : sa mention de pied diffère de toutes les autres, et c'est
  // délibéré. Le second est le seul dont le destinataire n'a pas encore de compte.
  {
    id: 'securite-nouvel-appareil',
    nom: 'Sécurité · nouvelle connexion',
    source: '_shared/device-alert-email.ts',
    migre: true,
    rendu: buildDeviceAlertEmail({
      name: 'Julien',
      browser: 'Chrome 131',
      os: 'macOS',
      city: 'Genève',
      country: 'Suisse',
      ip: '85.218.12.44',
      when: '15.08.2026 à 17:42',
    }),
  },
  {
    id: 'invitation-equipe',
    nom: 'Invitation à rejoindre l’équipe',
    source: '_shared/team-invite-email.ts',
    migre: true,
    rendu: buildTeamInviteEmail({
      inviterName: 'Gregory Lyonnet',
      agencyName: 'Régie du Rhône',
      role: 'manager',
      acceptUrl: 'https://app.megga.ch/accept-invite/jeton-de-demonstration',
    }),
  },

  // Lien magique KYC — migré le 15.08.2026. LES QUATRE LANGUES, parce que c'est le seul
  // gabarit multilingue et que l'allemand est celui qui déborde : s'il tient, les autres
  // tiennent. Le message personnalisé de l'agent est montré à part, il change la hauteur.
  ...(['fr', 'de', 'en', 'it'] as MagicLinkLocale[]).map((locale) => ({
    id: `lien-magique-${locale}`,
    nom: `Lien magique KYC (${locale.toUpperCase()})`,
    source: '_shared/magic-link-email.ts',
    migre: true,
    rendu: buildMagicLinkEmail({
      locale,
      firstName: 'Marie',
      agentFullName: 'Gregory Lyonnet',
      agencyName: 'Régie du Rhône',
      url: 'https://app.megga.ch/kyc/jeton-de-demonstration',
      customMessage: null,
    }),
  })),
  {
    id: 'lien-magique-message-agent',
    nom: 'Lien magique KYC · message de l’agent',
    source: '_shared/magic-link-email.ts',
    migre: true,
    rendu: buildMagicLinkEmail({
      locale: 'fr',
      firstName: 'Marie',
      agentFullName: 'Gregory Lyonnet',
      agencyName: 'Régie du Rhône',
      url: 'https://app.megga.ch/kyc/jeton-de-demonstration',
      customMessage: 'Comme convenu au téléphone, voici le lien. N’hésitez pas si une question se pose.',
    }),
  },

  // Convocation KYC — migrée le 15.08.2026. Les trois modes, parce qu'ils ne montrent pas
  // la même chose : la visio porte un bouton, le sur-place une adresse, l'annulation ni
  // faits ni consigne. Le cas « visio sans lien » est celui qu'on oublie de regarder.
  ...([
    ['confirmee-visio', { kind: 'confirmed', mode: 'video', videoLink: 'https://meet.google.com/abc-defg-hij' }],
    ['confirmee-sur-place', { kind: 'confirmed', mode: 'sur_place', location: 'Rue du Rhône 14, 1204 Genève' }],
    ['confirmee-visio-sans-lien', { kind: 'confirmed', mode: 'video', videoLink: null }],
    ['deplacee', { kind: 'rescheduled', mode: 'video', videoLink: 'https://meet.google.com/abc-defg-hij' }],
    ['annulee', { kind: 'cancelled', mode: 'video', manageUrl: null }],
  ] as const).map(([id, patch]) => ({
    id: `kyc-rdv-${id}`,
    nom: `Rendez-vous KYC · ${id.replace(/-/g, ' ')}`,
    source: '_shared/booking-email.ts',
    migre: true,
    rendu: buildBookingEmail({
      to: 'client@example.ch',
      contactName: 'Marie Favre',
      startIso: new Date(QUAND).toISOString(),
      timeZone: 'Europe/Zurich',
      agencyName: 'Régie du Rhône',
      agentName: 'Gregory Lyonnet',
      manageUrl: 'https://app.megga.ch/visite/jeton/modifier',
      location: null,
      videoLink: null,
      ...patch,
    }),
  })),

  // Décision KYB — migrée le 15.08.2026, premier des treize à rejoindre la coquille.
  // Les trois décisions, parce qu'elles ne se ressemblent pas : seule la correction porte
  // un bouton, seul le rejet est terminal, seule la validation n'a pas de motif.
  ...(['validated', 'rejected', 'correction_requested'] as const).map((status) => {
    const notice = buildVerificationNotice({
      status,
      agencyName: 'Régie du Rhône',
      reason: status === 'validated' ? null : 'Le numéro de registre ne correspond pas à la raison sociale déclarée.',
      appUrl: 'https://app.megga.ch',
    })
    return {
      id: `kyb-${status}`,
      nom: `Décision KYB · ${status}`,
      source: '_shared/agency-verification-notice.ts',
      migre: true,
      rendu: { subject: notice.subject, html: notice.html },
    }
  }),
]

function echappe(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Planche de contact : tout voir d'un coup.
 *
 * Chaque gabarit est rendu dans un `<iframe srcdoc>` et non injecté dans la page : un
 * e-mail porte son propre `<html>`, ses styles et ses media queries, et les fondre dans
 * une page hôte donnerait un aperçu qui n'est celui de personne.
 */
function planche(cas: Cas[]): string {
  const cartes = cas.map((c) => `
    <figure class="carte">
      <figcaption>
        <span class="pastille ${c.migre ? 'ok' : 'dette'}">${c.migre ? 'MEGGA X' : 'à migrer'}</span>
        <strong>${echappe(c.nom)}</strong>
        <span class="objet">${echappe(c.rendu.subject)}</span>
        <span class="source">${echappe(c.source)}</span>
        <a href="./${c.id}.html" target="_blank" rel="noreferrer">ouvrir en grand</a>
      </figcaption>
      <iframe title="${echappe(c.nom)}" srcdoc="${echappe(c.rendu.html)}" loading="lazy"></iframe>
    </figure>`).join('\n')

  const migres = cas.filter((c) => c.migre).length
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Banc de rendu des e-mails MEGGA</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:32px; background:#0A0A0F; color:#E7E9EE;
         font:14px/1.5 'Inter Tight', system-ui, sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sous { color:#8a8a8f; margin:0 0 28px; font-size:13px; }
  .grille { display:grid; gap:24px; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); }
  .carte { margin:0; background:#111117; border:1px solid #23232D; border-radius:14px; overflow:hidden; }
  figcaption { display:grid; gap:3px; padding:14px 16px; border-bottom:1px solid #23232D; }
  .pastille { justify-self:start; font-size:10px; letter-spacing:.06em; text-transform:uppercase;
              padding:3px 8px; border-radius:999px; }
  .pastille.ok { background:#424bfb; color:#fff; }
  .pastille.dette { background:#3a2a10; color:#f0b357; }
  .objet, .source { color:#8a8a8f; font-size:12px; }
  .source { font-family:ui-monospace,monospace; font-size:11px; }
  figcaption a { color:#8dc1ff; font-size:12px; justify-self:start; }
  iframe { width:100%; height:520px; border:0; background:#fff; display:block; }
</style></head>
<body>
  <h1>Banc de rendu des e-mails MEGGA</h1>
  <p class="sous">${cas.length} gabarits — ${migres} à la coquille commune, ${cas.length - migres} encore sur leur propre design.
     Données de démonstration, aucun envoi. Régénérer : <code>npm run email:preview</code></p>
  <div class="grille">${cartes}</div>
</body></html>`
}

// ⚠ ON PURGE AVANT D'ÉCRIRE. Le banc se contentait de `mkdir` : un cas renommé ou retiré
// laissait son ancien rendu sur le disque, et rien ne le distinguait d'un rendu courant.
// Mesuré le 16.08.2026 : 52 fichiers pour 49 gabarits annoncés — trois fiches de bien d'une
// génération précédente traînaient, dont le nom promettait un contenu qu'elles n'avaient plus.
// Un banc de relecture qui sert du périmé est pire qu'un banc absent : on y croit.
await Deno.remove(SORTIE, { recursive: true }).catch(() => {})
await Deno.mkdir(SORTIE, { recursive: true })
for (const c of CAS) {
  await Deno.writeTextFile(`${SORTIE}/${c.id}.html`, c.rendu.html)
}
await Deno.writeTextFile(`${SORTIE}/index.html`, planche(CAS))

const migres = CAS.filter((c) => c.migre).length
console.log(`✓ ${CAS.length} gabarits rendus dans ${SORTIE}/ (${migres} MEGGA X, ${CAS.length - migres} à migrer).`)
console.log(`  Ouvrir : ${SORTIE}/index.html`)
