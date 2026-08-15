// scripts/email-preview.ts — banc de rendu des e-mails MEGGA.
//
// `npm run email:preview` puis ouvrir `.email-preview/index.html`.
//
// POURQUOI CE BANC EXISTE. Douze gabarits fabriquent encore leur propre coquille (cf.
// `scripts/check-email-shell.mjs`), et AUCUN n'est couvert par un test de rendu. Les
// migrer à l'aveugle changerait l'apparence d'e-mails que des gens reçoivent déjà, sans
// que personne ne le voie avant l'envoi. Ce banc rend tout d'un coup, hors ligne, pour
// qu'on relise AVANT de livrer plutôt qu'après s'être plaint.
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
  buildReminderEmail,
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
  { id: 'appel-rappel-fr', nom: 'Appel d’accueil · rappel J-1 (FR)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildReminderEmail(appel) },
  { id: 'appel-rappel-en', nom: 'Appel d’accueil · rappel J-1 (EN)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildReminderEmail({ ...appel, locale: 'en' }) },
  { id: 'appel-hote-nouveau', nom: 'Appel d’accueil · avis à l’hôte (interne)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildHostEmail(appel, 'booked') },
  { id: 'appel-hote-annule', nom: 'Appel d’accueil · annulation (interne)', source: '_shared/onboarding-email.ts', migre: true, rendu: buildHostEmail({ ...appel, meetingUrl: null }, 'cancelled') },

  // Commerciaux — migrés le 15.08.2026. Les SEULS à porter une désinscription : leur
  // mention de pied diffère donc de tous les autres, et c'est ce qu'il faut regarder ici.
  {
    id: 'fiche-de-bien',
    nom: 'Fiche de bien envoyée à un contact',
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
        rooms: 3.5,
        surface_m2: 92,
        type: 'Appartement',
        photo_url: null,
        source_url: 'https://www.example.ch/annonce/12345',
        source_agency: 'Régie du Rhône',
        source_portal: 'Homegate',
      },
      unsubscribeHtml: '<p style="margin:0;font-family:\'Inter Tight\',Arial,sans-serif;font-size:11px;color:#8a8a8f;">'
        + '<a href="https://app.megga.ch/desinscription/jeton" style="color:#8a8a8f;">Se désinscrire de ces envois</a></p>',
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
      unsubscribeHtml: '<p style="margin:0;font-family:\'Inter Tight\',Arial,sans-serif;font-size:11px;color:#8a8a8f;">'
        + '<a href="https://app.megga.ch/desinscription/jeton" style="color:#8a8a8f;">Se désinscrire de ces envois</a></p>',
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

await Deno.mkdir(SORTIE, { recursive: true })
for (const c of CAS) {
  await Deno.writeTextFile(`${SORTIE}/${c.id}.html`, c.rendu.html)
}
await Deno.writeTextFile(`${SORTIE}/index.html`, planche(CAS))

const migres = CAS.filter((c) => c.migre).length
console.log(`✓ ${CAS.length} gabarits rendus dans ${SORTIE}/ (${migres} MEGGA X, ${CAS.length - migres} à migrer).`)
console.log(`  Ouvrir : ${SORTIE}/index.html`)
