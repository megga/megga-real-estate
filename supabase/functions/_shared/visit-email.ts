// supabase/functions/_shared/visit-email.ts
//
// Les trois courriels d'une visite de bien : confirmation à l'acheteur, notification à
// l'agent, rappel de la veille.
//
// Sorti de `send-visit-email/index.ts` le 15.08.2026. Pur, donc testable et visible au
// banc de rendu — ce qui compte d'autant plus ici que la migration corrige TROIS défauts
// réels, dont deux invisibles à la relecture :
//
//   1. ⛔ LA DATE ET L'HEURE ÉTAIENT FAUSSES. L'ancien gabarit lisait `getHours()`,
//      `getDate()`, `getMonth()` et `getDay()` du runtime — donc UTC en edge function.
//      Une visite à 14:00 à Genève s'annonçait à 12:00 (13:00 l'hiver), et une visite en
//      soirée changeait carrément de JOUR : 00:30 à Genève, c'est 22:30 UTC la veille.
//      C'est le défaut exact qui avait fait naître `booking-email` ; il vivait encore ici.
//   2. ⛔ RIEN N'ÉTAIT ÉCHAPPÉ. Titre du bien, nom, téléphone, pré-qualification, et
//      surtout `buyer_message` : du TEXTE LIBRE saisi par un visiteur du site public.
//      C'est le champ le plus exposé de tous les e-mails du dépôt.
//   3. Les objets portaient un tiret cadratin, interdit par la règle maison.
//
// ⚠ FUSEAU : `Europe/Zurich`, en dur et assumé. Le produit sert les 26 cantons, qui
// partagent un seul fuseau ; `visits` ne porte aucune colonne de fuseau, et inventer un
// réglage pour une valeur constante compliquerait sans rien corriger. À revoir le jour
// d'une ouverture hors de Suisse — c'est écrit dans l'audit France.

import { INK, MUTED, FONT, escapeHtml, shell, p, h2, row, button, note } from './email-shell.ts'

const FUSEAU = 'Europe/Zurich'

/** « lundi 17 août 2026 » dans le fuseau suisse, jamais dans celui du serveur. */
export function formatVisitDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}

/** « 14:00 » dans le fuseau suisse. */
export function formatVisitTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: FUSEAU, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

export type VisitEmailKind = 'confirmation_buyer' | 'notification_agent' | 'reminder'

export interface VisitEmailInput {
  kind: VisitEmailKind
  /** ISO de `visits.scheduled_at`. Formaté ici, jamais par l'appelant. */
  scheduledAt: string
  propertyTitle: string
  propertyAddress: string
  isVideo: boolean
  /** « Google Meet » ou « FaceTime ». */
  videoLabel: string
  videoLink: string | null
  manageUrl: string
  /** Acheteur : confirmation et rappel. */
  buyerName: string | null
  /** Agent : notification seule. */
  agentName?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  buyerMessage?: string | null
  /** Pré-qualification, déjà mise en phrase par l'appelant. */
  qualification?: string | null
}

/** Mention de pied des e-mails ACHETEUR : il n'est pas client de MEGGA mais de l'agence. */
const LEGAL_ACHETEUR = 'Cet e-mail concerne une visite que vous avez demandée. Il ne s’agit pas d’une '
  + 'communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.'

/** Le lieu, ou le mode quand la visite est à distance. */
function ligneLieu(i: VisitEmailInput): string {
  if (!i.isVideo) return row('Adresse', escapeHtml(i.propertyAddress))
  return row('Mode', i.videoLink
    ? `${escapeHtml(i.videoLabel)}`
    : `${escapeHtml(i.videoLabel)}, lien à venir`)
}

export function buildVisitEmail(i: VisitEmailInput): { subject: string; html: string } {
  const date = formatVisitDate(i.scheduledAt)
  const heure = formatVisitTime(i.scheduledAt)
  const bien = escapeHtml(i.propertyTitle)

  if (i.kind === 'notification_agent') {
    // Notification de TRAVAIL à l'agent, qui a un compte : pilule utile, aucune mention
    // légale — elle parle de son activité, pas d'une sollicitation qu'il pourrait refuser.
    return {
      subject: `Nouvelle demande de visite · ${i.propertyTitle}`,
      html: shell({
        title: i.isVideo ? `Nouvelle visite vidéo (${i.videoLabel})` : 'Nouvelle demande de visite',
        preheader: `${i.propertyTitle} · ${date} à ${heure}`,
        legalNote: null,
        headerCta: { href: 'https://app.megga.ch/dashboard', label: 'Ouvrir mon espace' },
        bodyHtml: `
     ${p(i.agentName ? `Bonjour ${escapeHtml(i.agentName)},` : 'Bonjour,')}
     ${p('Une nouvelle demande de visite a été reçue via le site.', 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row('Bien', bien)}
       ${row('Adresse', escapeHtml(i.propertyAddress))}
       ${i.isVideo ? row('Mode', escapeHtml(i.videoLabel)) : ''}
       ${row('Souhaité', escapeHtml(`${date} à ${heure}`))}
       ${row('Contact', [
          escapeHtml(i.buyerName ?? '—'),
          i.buyerEmail ? `<a href="mailto:${escapeHtml(i.buyerEmail)}" style="color:${MUTED};">${escapeHtml(i.buyerEmail)}</a>` : '',
          escapeHtml(i.buyerPhone ?? ''),
        ].filter(Boolean).join('<br />'))}
       ${i.qualification ? row('Qualification', escapeHtml(i.qualification)) : ''}
     </table>
     ${i.buyerMessage ? note('Message du visiteur', escapeHtml(i.buyerMessage)) : ''}
     ${p('La visite apparaît dans votre calendrier MEGGA.', 0)}`,
      }),
    }
  }

  const rappel = i.kind === 'reminder'
  const titre = rappel
    ? 'Votre visite a lieu demain'
    : i.isVideo ? 'Votre visite vidéo est confirmée' : 'Votre visite est confirmée'

  return {
    // L'ÉTAT avant le bien : un objet se lit tronqué, et ce qui compte est que la visite
    // est actée (ou imminente). Le bien suit, comme repère.
    subject: rappel ? `Visite demain · ${i.propertyTitle}` : `Visite confirmée · ${i.propertyTitle}`,
    html: shell({
      title: titre,
      preheader: rappel
        ? 'L’heure et l’adresse sont dans ce message.'
        : 'Le détail de votre visite, et de quoi la déplacer si besoin.',
      legalNote: LEGAL_ACHETEUR,
      headerCta: null,
      bodyHtml: `
     ${p(i.buyerName ? `Bonjour ${escapeHtml(i.buyerName)},` : 'Bonjour,')}
     ${p(rappel
        ? 'Petit rappel : votre visite a lieu demain.'
        : `Votre demande de visite pour <strong style="color:${INK};">${bien}</strong> a bien été enregistrée.`, 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row('Bien', bien)}
       ${row('Quand', escapeHtml(rappel ? `Demain à ${heure}` : `${date} à ${heure}`))}
       ${ligneLieu(i)}
     </table>
     ${i.isVideo && i.videoLink
        ? `<div style="margin:0 0 28px;">${button(i.videoLink, 'Rejoindre la visite vidéo')}</div>`
        : ''}
     ${h2('Un empêchement ?')}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${MUTED};">
       <a href="${escapeHtml(i.manageUrl)}" style="color:${INK};">Déplacez ou annulez cette visite</a> en un clic, sans avoir à vous connecter.
     </p>
     ${!rappel ? p('Vous recevrez un rappel la veille.', 0) : ''}`,
    }),
  }
}
