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

export interface PropertyEmailPayload {
  title?: string | null
  address?: string | null
  city?: string | null
  price: number
  rooms?: number | null
  surface_m2?: number | null
  type?: string | null
  photo_url?: string | null
  source_url: string
  source_agency?: string | null
  source_portal?: string | null
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
  const b = i.property
  const prix = b.price > 0 ? formatCHF(b.price) : 'Prix sur demande'
  const lieu = b.address || b.city || 'Suisse'
  const faits = [
    b.rooms ? `${b.rooms} pièces` : null,
    b.surface_m2 ? `${b.surface_m2} m²` : null,
    b.type || null,
  ].filter(Boolean).join(' · ')

  // La carte du bien : sous-surface CREUSÉE, comme tous les encarts de la coquille.
  const carte = `<div style="margin:0 0 28px;background:#050505;border:1px solid ${CARD_BORDER};border-radius:16px;overflow:hidden;">
      ${b.photo_url
        ? `<img src="${escapeHtml(b.photo_url)}" alt="${escapeHtml(b.title || 'Bien immobilier')}" width="536" style="width:100%;height:auto;display:block;border:0;" />`
        : ''}
      <div style="padding:20px 22px;">
        <p style="margin:0 0 4px;font-family:${FONT};font-size:24px;font-weight:700;color:${INK};letter-spacing:-0.4px;">${escapeHtml(prix)}</p>
        ${b.title ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:14px;color:${BODY_INK};">${escapeHtml(b.title)}</p>` : ''}
        <p style="margin:0 0 14px;font-family:${FONT};font-size:13px;color:${MUTED};">${escapeHtml(lieu)}</p>
        ${faits ? `<p style="margin:0 0 16px;padding:12px 0;border-top:1px solid ${CARD_BORDER};border-bottom:1px solid ${CARD_BORDER};font-family:${FONT};font-size:13px;color:${BODY_INK};">${escapeHtml(faits)}</p>` : ''}
        ${b.source_agency
          ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:11px;color:${MUTED};">via ${escapeHtml(b.source_agency)}${b.source_portal ? ` · ${escapeHtml(b.source_portal)}` : ''}</p>`
          : ''}
        ${button(b.source_url, 'Voir l’annonce')}
      </div>
    </div>`

  return {
    // Le PRIX ouvre l'objet : c'est le seul élément qu'un contact reconnaît d'un coup
    // d'oeil dans sa boîte, et il décide s'il ouvre. Sans tiret cadratin (règle maison).
    subject: `${prix} · ${b.title || lieu}`,
    html: shell({
      title: 'Un bien qui pourrait vous intéresser',
      preheader: `${prix}${faits ? ` · ${faits}` : ''} · ${lieu}`,
      // ⚠ Ni « transactionnel », ni « pas de désinscription » : c'est un envoi
      // commercial, et le bloc de désinscription est juste en dessous.
      legalNote: 'Vous recevez cet e-mail parce que vous êtes en relation avec cette agence via MEGGA. '
        + 'Les informations sont fournies à titre indicatif et peuvent évoluer sans préavis.',
      unsubscribeHtml: i.unsubscribeHtml,
      headerCta: null,
      bodyHtml: `
     ${p(`Bonjour ${escapeHtml(i.contactFirstName)},`)}
     ${i.message
        ? `<p style="margin:0 0 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BODY_INK};white-space:pre-line;">${escapeHtml(i.message)}</p>`
        : p('Voici un bien qui pourrait vous intéresser.', 28)}
     ${carte}
     <div style="padding:20px 0 0;border-top:1px solid ${CARD_BORDER};">
       <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:600;color:${INK};">${escapeHtml(i.agentName)}</p>
       <p style="margin:4px 0 0;font-family:${FONT};font-size:12px;color:${MUTED};">MEGGA${i.agentPhone ? ` · ${escapeHtml(i.agentPhone)}` : ''}</p>
     </div>`,
    }),
  }
}
