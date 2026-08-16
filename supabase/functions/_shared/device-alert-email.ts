// supabase/functions/_shared/device-alert-email.ts
//
// Alerte « nouvelle connexion depuis un appareil inconnu ». E-mail de SÉCURITÉ, envoyé à
// un agent qui a un compte MEGGA.
//
// Sorti de `detect-new-device/index.ts` le 15.08.2026 pour être pur, donc testable et
// visible au banc de rendu. Trois défauts corrigés au passage, tous constatés dans le
// gabarit d'origine :
//
//   1. ⛔ LE BOUTON ÉTAIT MORT. Il pointait sur `megga.ch/security/sessions`, or la
//      vitrine est derrière un mot de passe : mesuré le 15.08, cette adresse rend 401 en
//      text/plain. Un e-mail de sécurité dont le bouton « Sécuriser mon compte » mène à
//      une page verrouillée est pire qu'inutile. `app.megga.ch/security/sessions` rend
//      200 — même confusion d'hôte que le logo cassé de l'ancienne coquille.
//   2. Les champs venant de l'extérieur n'étaient PAS échappés (`name` du profil, ville,
//      pays, IP d'en-tête). Le navigateur et le système, eux, sont sûrs par construction :
//      `parseUA` ne les recopie pas, il les compose à partir de captures numériques.
//   3. TUTOIEMENT, seul de tout le produit (« ton compte », « change ton mot de passe »).
//      Passé au vouvoiement, comme partout ailleurs.
//   4. FRANÇAIS SEUL (16.08.2026). Le produit annonce quatre langues et cet e-mail n'en
//      parlait qu'une. Une alerte de sécurité que le destinataire ne lit pas est une
//      alerte perdue : c'est le gabarit où la langue compte le PLUS, pas le moins.

import {
  MUTED, INK, FONT,
  escapeHtml, shell, p, row, button,
} from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'
import { appDashboardUrl } from './app-url.ts'

/**
 * ⚠ FONCTION, PAS CONSTANTE : une `const` de module fige la base au chargement de
 * l'isolat, donc avant qu'un test puisse poser `MEGGA_APP_URL`. Même raison que
 * l'en-tête d'`app-url.ts` donne pour ne pas exporter `appBaseUrl`.
 */
const urlSecurite = () => appDashboardUrl('/security/sessions')

export interface DeviceAlertInput {
  name: string | null
  /** Langue de correspondance du destinataire (profiles.language). Défaut : français. */
  locale?: AppLocale
  /** Composé par `parseUA` — jamais la chaîne User-Agent brute. */
  browser: string
  os: string
  city: string | null
  country: string | null
  ip: string | null
  /** Déjà formaté par l'appelant, dans le fuseau du destinataire. */
  when: string
}

/**
 * Le texte de l'alerte, dans les quatre langues du produit.
 *
 * ⛔ LA MENTION LÉGALE EST PROPRE À CE GABARIT et doit le rester : sa seconde moitié
 * (« même si vous vous êtes désabonné ») n'existe dans aucun autre e-mail. Elle dit
 * pourquoi ce message arrive sans action ni abonnement, et c'est vrai ici seulement.
 * La remplacer par la mention transactionnelle des autres gabarits serait un mensonge.
 *
 * ⚠ « Vai al mio spazio » a été écarté pour l'italien, bien que ce soit l'étiquette de
 * l'interface : « Vai » est un impératif de deuxième personne, donc un tutoiement, seul
 * de tout le produit italien qui emploie partout ailleurs la forme de courtoisie ou
 * l'infinitif (« Prenoti », « Partecipare », « Scegliere »). L'infinitif s'aligne sur
 * cette grammaire-là plutôt que sur une chaîne isolée.
 */
const T: Record<AppLocale, {
  objet: string
  titre: string
  apercu: string
  legal: string
  ctaEntete: string
  bonjour: (nom: string) => string
  corps1: string
  navigateur: string
  systeme: string
  localisation: string
  ip: string
  date: string
  lieuInconnu: string
  ipInconnue: string
  corps2: string
  ctaSecuriser: string
  noteDetection: string
  signature: string
}> = {
  fr: {
    objet: 'Nouvelle connexion sur votre compte MEGGA',
    titre: 'Nouvelle connexion détectée',
    apercu: 'Si ce n’était pas vous, changez votre mot de passe maintenant.',
    legal: 'Cet e-mail est une notification de sécurité liée à votre compte. Il ne s’agit pas '
      + 'd’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription '
      + 'et vous le recevez même si vous vous êtes désabonné de nos communications.',
    ctaEntete: 'Ouvrir mon espace',
    bonjour: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    corps1: 'Une connexion vient d’être effectuée sur votre compte MEGGA depuis un appareil que nous ne reconnaissons pas.',
    navigateur: 'Navigateur', systeme: 'Système', localisation: 'Localisation', ip: 'Adresse IP', date: 'Date',
    lieuInconnu: 'Localisation inconnue',
    ipInconnue: 'Inconnue',
    corps2: 'Si vous reconnaissez cette connexion, vous pouvez ignorer ce message. Sinon, changez votre mot de passe sans attendre.',
    ctaSecuriser: 'Sécuriser mon compte',
    noteDetection: 'Vous recevez cet e-mail parce que la détection d’appareils est active sur votre compte.',
    signature: 'Merci,',
  },
  de: {
    objet: 'Neue Anmeldung in Ihrem MEGGA Konto',
    titre: 'Neue Anmeldung erkannt',
    apercu: 'Wenn Sie das nicht waren, ändern Sie jetzt Ihr Passwort.',
    legal: 'Diese E-Mail ist eine Sicherheitsbenachrichtigung zu Ihrem Konto. Es handelt sich nicht '
      + 'um eine Werbenachricht: deshalb enthält sie keinen Abmeldelink, und Sie erhalten sie auch '
      + 'dann, wenn Sie sich von unseren Mitteilungen abgemeldet haben.',
    ctaEntete: 'Zu meinem Bereich',
    bonjour: (n) => (n ? `Guten Tag ${n},` : 'Guten Tag,'),
    corps1: 'Soeben wurde in Ihrem MEGGA Konto eine Anmeldung von einem Gerät vorgenommen, das wir nicht wiedererkennen.',
    navigateur: 'Browser', systeme: 'System', localisation: 'Standort', ip: 'IP-Adresse', date: 'Datum',
    lieuInconnu: 'Unbekannter Standort',
    ipInconnue: 'Unbekannt',
    corps2: 'Wenn Sie diese Anmeldung wiedererkennen, können Sie diese Nachricht ignorieren. Andernfalls ändern Sie Ihr Passwort umgehend.',
    ctaSecuriser: 'Mein Konto sichern',
    noteDetection: 'Sie erhalten diese E-Mail, weil die Geräteerkennung in Ihrem Konto aktiv ist.',
    signature: 'Danke,',
  },
  en: {
    objet: 'New sign-in on your MEGGA account',
    titre: 'New sign-in detected',
    apercu: 'If this was not you, change your password now.',
    legal: 'This email is a security notification about your account. It is not a marketing '
      + 'message: that is why it carries no unsubscribe link, and you receive it even if you have '
      + 'unsubscribed from our communications.',
    ctaEntete: 'Go to my workspace',
    bonjour: (n) => (n ? `Hello ${n},` : 'Hello,'),
    corps1: 'A sign-in to your MEGGA account has just been made from a device we do not recognise.',
    navigateur: 'Browser', systeme: 'System', localisation: 'Location', ip: 'IP address', date: 'Date',
    lieuInconnu: 'Unknown location',
    ipInconnue: 'Unknown',
    corps2: 'If you recognise this sign-in, you can ignore this message. Otherwise, change your password without delay.',
    ctaSecuriser: 'Secure my account',
    noteDetection: 'You are receiving this email because device detection is active on your account.',
    signature: 'Thank you,',
  },
  it: {
    objet: 'Nuovo accesso al suo account MEGGA',
    titre: 'Nuovo accesso rilevato',
    apercu: 'Se non è stato Lei, cambi ora la sua password.',
    legal: 'Questa e-mail è una notifica di sicurezza relativa al suo account. Non è una '
      + 'comunicazione commerciale: per questo non contiene alcun link di disiscrizione e la riceve '
      + 'anche se si è disiscritto dalle nostre comunicazioni.',
    ctaEntete: 'Aprire il mio spazio',
    bonjour: (n) => (n ? `Buongiorno ${n},` : 'Buongiorno,'),
    corps1: 'Un accesso al suo account MEGGA è appena stato effettuato da un dispositivo che non riconosciamo.',
    navigateur: 'Browser', systeme: 'Sistema', localisation: 'Posizione', ip: 'Indirizzo IP', date: 'Data',
    lieuInconnu: 'Posizione sconosciuta',
    ipInconnue: 'Sconosciuto',
    corps2: 'Se riconosce questo accesso, può ignorare questo messaggio. Altrimenti cambi la sua password senza attendere.',
    ctaSecuriser: 'Proteggere il mio account',
    noteDetection: 'Riceve questa e-mail perché il rilevamento dei dispositivi è attivo sul suo account.',
    signature: 'Grazie,',
  },
}

/** Le nom d'équipe ne se traduit pas ; sa ligne d'introduction, si. */
const EQUIPE: Record<AppLocale, string> = {
  fr: 'L’équipe MEGGA', de: 'Ihr MEGGA Team', en: 'The MEGGA team', it: 'Il team MEGGA',
}

/**
 * Pictogramme d'alerte : triangle ambre, tracé sur fond sombre.
 *
 * ⚠ `#f0b357` et non l'ambre pâle de la vitrine : CLAUDE.md §3 rappelle que les couleurs
 * de système y sont réglées pour un canvas clair et tombent à 1,7:1 sous encre blanche.
 * Ici le trait doit se voir sur `#090909`.
 */
function glypheAlerte(): string {
  return `<div style="margin:0 0 20px;">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f0b357" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    </div>`
}

export function buildDeviceAlertEmail(a: DeviceAlertInput): { subject: string; html: string } {
  const t = T[a.locale ?? 'fr']
  const lieu = [a.city, a.country].filter(Boolean).join(', ') || t.lieuInconnu

  return {
    subject: t.objet,
    html: shell({
      lang: a.locale ?? 'fr',
      title: t.titre,
      // L'aperçu porte l'ACTION à mener si ce n'était pas vous : c'est la seule raison
      // d'ouvrir ce message dans la seconde.
      preheader: t.apercu,
      // ⛔ JAMAIS la mention transactionnelle des autres e-mails : celle-ci dit pourquoi
      // le message arrive même sans action du destinataire, et ce fait-là est vrai.
      legalNote: t.legal,
      headerCta: { href: appDashboardUrl(), label: t.ctaEntete },
      bodyHtml: `
     ${glypheAlerte()}
     ${p(t.bonjour(escapeHtml(a.name ?? '')))}
     ${p(t.corps1, 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row(t.navigateur, escapeHtml(a.browser))}
       ${row(t.systeme, escapeHtml(a.os))}
       ${row(t.localisation, escapeHtml(lieu))}
       ${row(t.ip, `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(a.ip || t.ipInconnue)}</span>`)}
       ${row(t.date, escapeHtml(a.when))}
     </table>
     ${p(t.corps2, 28)}
     <div style="margin:0 0 8px;">${button(urlSecurite(), t.ctaSecuriser)}</div>
     <p style="margin:32px 0 0;font-family:${FONT};font-size:11.5px;color:${MUTED};line-height:1.5;">
       ${t.noteDetection}
     </p>
     <div style="padding:24px 0 0;">${p(`${t.signature}<br /><span style="color:${INK};">${EQUIPE[a.locale ?? 'fr']}</span>`, 0)}</div>`,
    }),
  }
}
