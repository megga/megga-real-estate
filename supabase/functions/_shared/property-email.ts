// supabase/functions/_shared/property-email.ts
//
// Envoi d'une fiche de bien à un contact, par son agent.
//
// Sorti de `send-property-email/index.ts` le 15.08.2026. ⛔ Le gabarit d'origine
// n'échappait RIEN : prénom du contact, titre, adresse, agence source, nom et téléphone
// de l'agent, et surtout le MESSAGE libre de l'agent (rendu en `white-space:pre-line`).
// Les deux URL — photo et annonce — partaient elles aussi brutes dans des attributs.
//
// ⚠ CET E-MAIL PORTE UNE DÉSINSCRIPTION, contrairement aux transactionnels du produit :
// il est commercial. Sa mention de pied ne peut donc pas être celle des autres, qui
// affirme l'absence de lien de désinscription. Les deux se choisissent ensemble.

import { INK, MUTED, BODY_INK, CARD_BORDER, FONT, escapeHtml, shell, p, button } from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'

export interface PropertyEmailPayload {
  title?: string | null
  address?: string | null
  city?: string | null
  price: number
  photo_url?: string | null
  source_url: string
}

export interface PropertyEmailInput {
  contactFirstName: string
  agentName: string
  agentPhone?: string | null
  property: PropertyEmailPayload
  /** Mot libre de l'agent. Échappé ici, jamais avant. */
  message?: string | null
  /** Bloc de désinscription, porteur d'un jeton par destinataire. */
  unsubscribeHtml?: string
  /**
   * Langue du CONTACT (`contacts.language`), jamais celle de l'agent. Défaut : français.
   *
   * ⚠ Elle vient de la REQUÊTE et non de la base : `send-property-email` ne reçoit qu'une
   * adresse, sans `contact_id` — l'envoi peut viser quelqu'un qui n'a pas de fiche. C'est
   * l'appelant, qui a le contact sous la main, qui la joint.
   */
  locale?: AppLocale
}

/**
 * Toute la copie, par langue. `Record<AppLocale, …>` : une langue manquante ne compile pas.
 */
const T: Record<AppLocale, {
  prixSurDemande: string
  paysDefaut: string
  altPhoto: string
  voirAnnonce: string
  titre: string
  legal: string
  salutation: (prenom: string) => string
  phraseDefaut: string
}> = {
  fr: {
    prixSurDemande: 'Prix sur demande',
    paysDefaut: 'Suisse',
    altPhoto: 'Bien immobilier',
    voirAnnonce: 'Voir l’annonce',
    titre: 'Un bien qui pourrait vous intéresser',
    legal: 'Vous recevez cet e-mail parce que vous êtes en relation avec cette agence via MEGGA. '
      + 'Les informations sont fournies à titre indicatif et peuvent évoluer sans préavis.',
    salutation: (p_) => `Bonjour ${p_},`,
    phraseDefaut: 'Voici un bien qui pourrait vous intéresser.',
  },
  de: {
    prixSurDemande: 'Preis auf Anfrage',
    paysDefaut: 'Schweiz',
    altPhoto: 'Immobilie',
    voirAnnonce: 'Inserat ansehen',
    titre: 'Eine Immobilie, die Sie interessieren könnte',
    legal: 'Sie erhalten diese E-Mail, weil Sie über MEGGA mit dieser Agentur in Kontakt stehen. '
      + 'Die Angaben sind unverbindlich und können sich ohne Vorankündigung ändern.',
    salutation: (p_) => `Guten Tag ${p_},`,
    phraseDefaut: 'Hier ist eine Immobilie, die Sie interessieren könnte.',
  },
  en: {
    prixSurDemande: 'Price on request',
    paysDefaut: 'Switzerland',
    altPhoto: 'Property',
    voirAnnonce: 'View the listing',
    titre: 'A property that might interest you',
    legal: 'You are receiving this email because you are in contact with this agency via MEGGA. '
      + 'The information is provided for guidance only and may change without notice.',
    salutation: (p_) => `Hello ${p_},`,
    phraseDefaut: 'Here is a property that might interest you.',
  },
  it: {
    prixSurDemande: 'Prezzo su richiesta',
    paysDefaut: 'Svizzera',
    altPhoto: 'Immobile',
    voirAnnonce: 'Veda l’annuncio',
    titre: 'Un immobile che potrebbe interessarLe',
    legal: 'Riceve questa e-mail perché è in contatto con questa agenzia tramite MEGGA. '
      + 'Le informazioni sono fornite a titolo indicativo e possono cambiare senza preavviso.',
    salutation: (p_) => `Buongiorno ${p_},`,
    phraseDefaut: 'Ecco un immobile che potrebbe interessarLe.',
  },
}

/**
 * `CHF 720'000`, apostrophe suisse (règle §6 du CLAUDE.md).
 *
 * ⚠ L'APOSTROPHE EST L'ASCII `U+0027`, PAS LA TYPOGRAPHIQUE `U+2019`. Les deux se
 * ressemblent à l'écran et se distinguent au point de code : cette fonction est née
 * avec `’`, alors que le code de `send-property-email` qu'elle remplace, le
 * `formatCHF` de `weekly-digest.ts`, celui de `src/lib/utils.ts` et l'exemple du
 * CLAUDE.md portent tous `'`. Comme la valeur alimente l'OBJET de l'e-mail, les
 * annonces de bien affichaient `CHF 720’000` quand toutes les autres surfaces du
 * produit écrivaient `CHF 720'000`.
 */
export function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

export function buildPropertyEmail(i: PropertyEmailInput): { subject: string; html: string } {
  const l = i.locale ?? 'fr'
  const t = T[l]
  const b = i.property
  // ⚠ Le PRIX ne suit PAS la langue : `CHF 720'000` est la règle suisse (§6 du CLAUDE.md),
  // pas une préférence régionale de rendu. `Intl.NumberFormat(style:'currency')` déplacerait
  // le symbole selon la locale et casserait l'objet, qui commence par le prix.
  const prix = b.price > 0 ? formatCHF(b.price) : t.prixSurDemande
  const lieu = b.address || b.city || t.paysDefaut

  // La carte du bien : sous-surface CREUSÉE, comme tous les encarts de la coquille.
  const carte = `<div style="margin:0 0 28px;background:#050505;border:1px solid ${CARD_BORDER};border-radius:16px;overflow:hidden;">
      ${b.photo_url
        ? `<img src="${escapeHtml(b.photo_url)}" alt="${escapeHtml(b.title || t.altPhoto)}" width="536" style="width:100%;height:auto;display:block;border:0;" />`
        : ''}
      <div style="padding:20px 22px;">
        <p style="margin:0 0 4px;font-family:${FONT};font-size:24px;font-weight:700;color:${INK};letter-spacing:-0.4px;">${escapeHtml(prix)}</p>
        ${b.title ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;color:${BODY_INK};">${escapeHtml(b.title)}</p>` : ''}
        <p style="margin:0 0 16px;font-family:${FONT};font-size:13px;color:${MUTED};">${escapeHtml(lieu)}</p>
        ${button(b.source_url, t.voirAnnonce)}
      </div>
    </div>`

  return {
    // Le PRIX ouvre l'objet : c'est le seul élément qu'un contact reconnaît d'un coup
    // d'oeil dans sa boîte, et il décide s'il ouvre. Sans tiret cadratin (règle maison).
    subject: `${prix} · ${b.title || lieu}`,
    html: shell({
      lang: l,
      title: t.titre,
      preheader: `${prix} · ${lieu}`,
      // ⚠ Ni « transactionnel », ni « pas de désinscription » : c'est un envoi
      // commercial, et le bloc de désinscription est juste en dessous.
      legalNote: t.legal,
      unsubscribeHtml: i.unsubscribeHtml,
      headerCta: null,
      bodyHtml: `
     ${p(t.salutation(escapeHtml(i.contactFirstName)))}
     ${i.message
        ? `<p style="margin:0 0 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_INK};white-space:pre-line;">${escapeHtml(i.message)}</p>`
        : p(t.phraseDefaut, 28)}
     ${carte}
     <div style="padding:20px 0 0;border-top:1px solid ${CARD_BORDER};">
       <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:600;color:${INK};">${escapeHtml(i.agentName)}</p>
       <p style="margin:4px 0 0;font-family:${FONT};font-size:12px;color:${MUTED};">MEGGA${i.agentPhone ? ` · ${escapeHtml(i.agentPhone)}` : ''}</p>
     </div>`,
    }),
  }
}
