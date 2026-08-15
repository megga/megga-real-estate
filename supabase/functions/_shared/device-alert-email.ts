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

import {
  MUTED, INK, FONT,
  escapeHtml, shell, p, row, button,
} from './email-shell.ts'

/** ⚠ app.megga.ch, jamais megga.ch : cf. point 1 de l'en-tête. */
const URL_SECURITE = 'https://app.megga.ch/security/sessions'

export interface DeviceAlertInput {
  name: string | null
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
  const lieu = [a.city, a.country].filter(Boolean).join(', ') || 'Localisation inconnue'
  const salutation = a.name ? `Bonjour ${escapeHtml(a.name)},` : 'Bonjour,'

  return {
    subject: 'Nouvelle connexion sur votre compte MEGGA',
    html: shell({
      title: 'Nouvelle connexion détectée',
      // L'aperçu porte l'ACTION à mener si ce n'était pas vous : c'est la seule raison
      // d'ouvrir ce message dans la seconde.
      preheader: 'Si ce n’était pas vous, changez votre mot de passe maintenant.',
      // ⛔ JAMAIS la mention transactionnelle des autres e-mails : celle-ci dit pourquoi
      // le message arrive même sans action du destinataire, et ce fait-là est vrai.
      legalNote: 'Cet e-mail est une notification de sécurité liée à votre compte. Il ne s’agit pas '
        + 'd’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription '
        + 'et vous le recevez même si vous vous êtes désabonné de nos communications.',
      headerCta: { href: 'https://app.megga.ch/dashboard', label: 'Ouvrir mon espace' },
      bodyHtml: `
     ${glypheAlerte()}
     ${p(salutation)}
     ${p('Une connexion vient d’être effectuée sur votre compte MEGGA depuis un appareil que nous ne reconnaissons pas.', 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row('Navigateur', escapeHtml(a.browser))}
       ${row('Système', escapeHtml(a.os))}
       ${row('Localisation', escapeHtml(lieu))}
       ${row('Adresse IP', `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(a.ip || '—')}</span>`)}
       ${row('Date', escapeHtml(a.when))}
     </table>
     ${p('Si vous reconnaissez cette connexion, vous pouvez ignorer ce message. Sinon, changez votre mot de passe sans attendre.', 28)}
     <div style="margin:0 0 8px;">${button(URL_SECURITE, 'Sécuriser mon compte')}</div>
     <p style="margin:32px 0 0;font-family:${FONT};font-size:11.5px;color:${MUTED};line-height:1.5;">
       Vous recevez cet e-mail parce que la détection d’appareils est active sur votre compte.
     </p>
     <div style="padding:24px 0 0;">${p(`Merci,<br /><span style="color:${INK};">L’équipe MEGGA</span>`, 0)}</div>`,
    }),
  }
}
