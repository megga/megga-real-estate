// supabase/functions/_shared/magic-link-email.ts
//
// L'e-mail du lien magique KYC : celui qu'un client d'agence reçoit pour déposer ses
// pièces. Le plus lu du produit, et le seul à exister en QUATRE langues.
//
// POURQUOI IL SORT DE `magic-link-send-email/index.ts` (15.08.2026). Son gabarit y était
// privé : ni testable, ni visible au banc de rendu, donc modifiable seulement à l'aveugle.
// Même geste que pour `booking-email`, et pour la même raison — la fonction edge garde le
// réseau, le module garde la composition.
//
// CE QUE LA MIGRATION PRÉSERVE, parce que c'était la meilleure idée de l'ancien gabarit :
// la GRILLE DE RÉASSURANCE. Un inconnu demande ses papiers par e-mail à quelqu'un qui ne
// connaît pas MEGGA : dire où vivent les données, qui les voit et combien de temps répond
// à la question que le destinataire se pose vraiment. Elle passe de quatre colonnes à
// 2 × 2 : à 600 px, quatre tuiles tombaient sous 130 px et leur texte se brisait.
//
// ⛔ AUCUNE pilule « Ouvrir mon espace » : le destinataire est le client d'une agence, il
// n'a pas de compte MEGGA (même règle que `booking-email`).

import {
  BODY_INK, MUTED, CARD_BORDER, INK, FONT,
  escapeHtml, shell, p, button, note,
} from './email-shell.ts'

export type MagicLinkLocale = 'fr' | 'de' | 'en' | 'it'

export function normalizeLocale(lang: string | null | undefined): MagicLinkLocale {
  const l = (lang ?? '').toLowerCase().slice(0, 2)
  if (l === 'de' || l === 'en' || l === 'it') return l
  return 'fr'
}

interface TemplateStrings {
  subject: (agencyName: string) => string
  preheader: string
  /**
   * Titre du message. ⚠ C'était la SALUTATION dans l'ancien gabarit (« Bonjour Marie, »
   * en 26 px) : un titre qui ne dit pas de quoi il s'agit, alors que c'est la ligne lue
   * en premier et reprise par les aperçus. La salutation reste, un cran plus bas.
   */
  title: string
  greeting: (firstName: string) => string
  intro: (agentFullName: string, agencyName: string) => string
  cta: string
  expiryNote: string
  reassuranceTitle: string
  reassurance: { title: string; sub: string }[]
  footer: (agencyName: string) => string
  privacyMention: string
}

// ⚠ Les objets portaient un TIRET CADRATIN (« Agence — Finaliser… »), interdit par la
// règle typographique de la maison. Remplacé par le point médian, comme partout ailleurs.
const STRINGS: Record<MagicLinkLocale, TemplateStrings> = {
  fr: {
    subject: (a) => `${a} · Finaliser votre dossier`,
    preheader: 'Environ 5 minutes, depuis votre téléphone si vous préférez.',
    title: 'Vérifions votre identité',
    greeting: (n) => `Bonjour ${n},`,
    intro: (agent, agency) =>
      `Pour finaliser votre dossier avec <strong style="color:${INK};">${agent}</strong> (${agency}), il nous reste à vérifier votre identité. Comptez environ 5 minutes.`,
    cta: 'Déposer mes pièces',
    expiryNote: 'Ce lien est sécurisé et expire dans 7 jours.',
    reassuranceTitle: 'Vos données restent protégées',
    reassurance: [
      { title: 'Données en Suisse', sub: 'Hébergement Genève' },
      { title: 'Chiffré bout-en-bout', sub: 'AES-256 · TLS 1.3' },
      { title: 'Vu par 2 personnes', sub: 'Votre agent + conformité' },
      { title: 'Conservé 10 ans', sub: 'LBA art. 7, puis supprimé' },
    ],
    footer: (a) =>
      `Cet e-mail vous a été envoyé par ${a} via MEGGA. Si vous n’attendiez pas cette demande, ignorez ce message : le lien expirera automatiquement.`,
    privacyMention:
      'Traitement de vos données conforme à la nLPD suisse et à la LBA (art. 7, conservation 10 ans).',
  },
  de: {
    subject: (a) => `${a} · Ihr Dossier vervollständigen`,
    preheader: 'Etwa 5 Minuten, auf Wunsch direkt vom Handy.',
    title: 'Verifizieren wir Ihre Identität',
    greeting: (n) => `Guten Tag ${n},`,
    intro: (agent, agency) =>
      `Um Ihr Dossier mit <strong style="color:${INK};">${agent}</strong> (${agency}) abzuschliessen, müssen wir Ihre Identität verifizieren. Dauer ca. 5 Minuten.`,
    cta: 'Dokumente bereitstellen',
    expiryNote: 'Dieser sichere Link läuft in 7 Tagen ab.',
    reassuranceTitle: 'Ihre Daten bleiben geschützt',
    reassurance: [
      { title: 'Daten in der Schweiz', sub: 'Hosting Genf' },
      { title: 'Ende-zu-Ende verschlüsselt', sub: 'AES-256 · TLS 1.3' },
      { title: 'Eingesehen von 2 Personen', sub: 'Ihr Berater + Compliance' },
      { title: '10 Jahre aufbewahrt', sub: 'GwG Art. 7, dann gelöscht' },
    ],
    footer: (a) =>
      `Diese E-Mail wurde Ihnen von ${a} über MEGGA gesendet. Falls Sie diese Anfrage nicht erwartet haben, ignorieren Sie diese Nachricht: der Link läuft automatisch ab.`,
    privacyMention:
      'Verarbeitung Ihrer Daten gemäss revDSG und GwG (Art. 7, 10 Jahre Aufbewahrung).',
  },
  en: {
    subject: (a) => `${a} · Complete your file`,
    preheader: 'About 5 minutes, from your phone if you prefer.',
    title: 'Let us verify your identity',
    greeting: (n) => `Hello ${n},`,
    intro: (agent, agency) =>
      `To finalize your file with <strong style="color:${INK};">${agent}</strong> (${agency}), we need to verify your identity. About 5 minutes.`,
    cta: 'Upload my documents',
    expiryNote: 'This secure link expires in 7 days.',
    reassuranceTitle: 'Your data stays protected',
    reassurance: [
      { title: 'Data in Switzerland', sub: 'Hosting in Geneva' },
      { title: 'End-to-end encrypted', sub: 'AES-256 · TLS 1.3' },
      { title: 'Seen by 2 people', sub: 'Your agent + compliance' },
      { title: 'Kept 10 years', sub: 'AML Art. 7, then deleted' },
    ],
    footer: (a) =>
      `This email was sent to you by ${a} through MEGGA. If you did not expect this request, please ignore this message: the link will expire automatically.`,
    privacyMention:
      'Your data is processed in accordance with the Swiss FDPA and AML Act (Art. 7, 10-year retention).',
  },
  it: {
    subject: (a) => `${a} · Finalizzare la sua pratica`,
    preheader: 'Circa 5 minuti, anche dal suo telefono.',
    title: 'Verifichiamo la sua identità',
    greeting: (n) => `Buongiorno ${n},`,
    intro: (agent, agency) =>
      `Per finalizzare la sua pratica con <strong style="color:${INK};">${agent}</strong> (${agency}), dobbiamo verificare la sua identità. Circa 5 minuti.`,
    cta: 'Caricare i miei documenti',
    expiryNote: 'Questo link sicuro scade tra 7 giorni.',
    reassuranceTitle: 'I suoi dati restano protetti',
    reassurance: [
      { title: 'Dati in Svizzera', sub: 'Hosting Ginevra' },
      { title: 'Crittografati end-to-end', sub: 'AES-256 · TLS 1.3' },
      { title: 'Visti da 2 persone', sub: 'Il suo agente + compliance' },
      { title: 'Conservati 10 anni', sub: 'LRD art. 7, poi cancellati' },
    ],
    footer: (a) =>
      `Questa email le è stata inviata da ${a} tramite MEGGA. Se non si aspettava questa richiesta, ignori questo messaggio: il link scadrà automaticamente.`,
    privacyMention:
      'Trattamento dei dati conforme alla nLPD svizzera e alla LRD (art. 7, conservazione 10 anni).',
  },
}

/** Une tuile de la grille de réassurance, creusée comme les autres sous-surfaces. */
function tuile(r: { title: string; sub: string }): string {
  return `<td valign="top" width="50%" style="padding:12px 14px;background:#050505;border:1px solid ${CARD_BORDER};border-radius:12px;">
      <div style="font-family:${FONT};font-size:12.5px;font-weight:700;color:${INK};letter-spacing:-0.1px;margin-bottom:2px;">${escapeHtml(r.title)}</div>
      <div style="font-family:${FONT};font-size:11px;color:${MUTED};font-weight:500;line-height:1.4;">${escapeHtml(r.sub)}</div>
    </td>`
}

/**
 * La grille, en 2 × 2. ⚠ Quatre colonnes tenaient dans l'ancien gabarit à 560 px, mais
 * chaque tuile tombait sous 130 px et ses libellés se brisaient en trois lignes. Deux par
 * rangée laissent respirer le texte, y compris sur un téléphone.
 */
function grilleReassurance(items: { title: string; sub: string }[]): string {
  const rangees: string[] = []
  for (let i = 0; i < items.length; i += 2) {
    rangees.push(`<tr>${items.slice(i, i + 2).map(tuile).join('')}</tr>`)
    if (i + 2 < items.length) rangees.push('<tr><td colspan="2" style="height:8px;font-size:0;line-height:0;">&nbsp;</td></tr>')
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:0 0 28px;">
      ${rangees.join('')}
    </table>`
}

export interface MagicLinkEmailInput {
  locale: MagicLinkLocale
  firstName: string
  agentFullName: string
  agencyName: string
  url: string
  customMessage: string | null
}

/** Compose objet et corps. PUR : aucun réseau, donc testable et rendable au banc. */
export function buildMagicLinkEmail(input: MagicLinkEmailInput): { subject: string; html: string } {
  const t = STRINGS[input.locale]

  return {
    subject: t.subject(input.agencyName),
    html: shell({
      lang: input.locale,
      title: t.title,
      preheader: t.preheader,
      // La mention de confidentialité TIENT LIEU de mention de pied : elle dit sous quel
      // régime les données sont traitées, ce qui est exactement la question d'un
      // destinataire à qui l'on demande ses papiers.
      legalNote: t.privacyMention,
      headerCta: null,
      bodyHtml: `
     ${p(`<span style="font-size:11px;font-weight:700;color:${MUTED};letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(input.agencyName)}</span>`, 12)}
     ${p(escapeHtml(t.greeting(input.firstName)))}
     ${p(t.intro(escapeHtml(input.agentFullName), escapeHtml(input.agencyName)), 28)}
     ${input.customMessage ? note(null, escapeHtml(input.customMessage)) : ''}
     <div style="margin:0 0 10px;">${button(input.url, t.cta)}</div>
     <p style="margin:0 0 28px;font-family:${FONT};font-size:11.5px;color:${MUTED};font-weight:500;">${escapeHtml(t.expiryNote)}</p>
     <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;font-weight:700;color:${MUTED};letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(t.reassuranceTitle)}</p>
     ${grilleReassurance(t.reassurance)}
     <p style="margin:0;font-family:${FONT};font-size:11.5px;color:${BODY_INK};line-height:1.5;font-weight:500;">${escapeHtml(t.footer(input.agencyName))}</p>`,
    }),
  }
}
