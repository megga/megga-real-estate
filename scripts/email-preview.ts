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
