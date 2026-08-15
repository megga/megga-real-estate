// supabase/functions/_shared/booking-email.ts
// Courriels du rendez-vous de vérification KYC : confirmation, report, annulation.
//
// Dates formatées dans le fuseau de l'AGENT, explicitement.
// `send-visit-email` s'appuie sur `getHours()` du runtime — donc sur UTC en edge
// function, ce qui annonce au client une heure décalée d'une à deux heures selon
// la saison. Une convocation à une vérification d'identité ne peut pas se
// permettre ça, d'où le formatage par Intl avec `timeZone` ici.
//
// Meilleur effort : un échec d'envoi ne remet jamais en cause la réservation
// elle-même (la page de confirmation affiche le rendez-vous de toute façon).

import {
  BRAND, BODY_INK, INK, FONT,
  escapeHtml, shell, p as p_, h2, row, button, note,
} from './email-shell.ts'

const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'MEGGA <noreply@megga.ch>'

export type BookingEmailKind = 'confirmed' | 'rescheduled' | 'cancelled'

export interface BookingEmailParams {
  kind: BookingEmailKind
  to: string
  contactName: string | null
  startIso: string
  timeZone: string
  mode: 'sur_place' | 'video'
  location?: string | null
  videoLink?: string | null
  agencyName?: string | null
  agentName?: string | null
  /** Lien de gestion (report / annulation) — omis sur une annulation. */
  manageUrl?: string | null
}

/** « lundi 1 septembre 2026 à 10:00 » dans le fuseau donné. */
function formatFr(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('fr-CH', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat('fr-CH', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${date} à ${time}`
}

/** Neutralise le HTML : ces valeurs viennent de la base et finissent dans un e-mail. */
const esc = escapeHtml

/**
 * Compose sujet et corps. PUR — d'où sa séparation d'avec `sendBookingEmail` : le banc
 * de rendu (`npm run email:preview`) l'importe pour montrer les trois cas sans réseau, ce
 * que l'ancienne version, dont la coquille était privée, rendait impossible.
 *
 * ARCHITECTURE, ET NON SEULEMENT COULEURS (refonte du 15.08.2026). L'ancienne version
 * empilait cinq paragraphes de prose : la date, le lieu, la consigne de pièce d'identité
 * et le lien de report s'y lisaient au même niveau, donc aucun ne se voyait. Ici :
 *   · les FAITS passent en tableau (quand, comment, avec) — c'est ce qu'on relit la veille ;
 *   · l'action devient un BOUTON, plus un lien noyé dans une phrase.
 *
 * ⚠ LA PIÈCE D'IDENTITÉ EST UN RAPPEL, PAS UNE CONDITION. Le client l'a DÉJÀ transmise
 * par le lien magique (`kyc_magic_link_uploads`, extraction avant réservation) : son
 * identité est au dossier quand ce message part. Une première version de cette refonte
 * l'annonçait en bloc encadré avec « la séance ne peut pas se tenir sans elle » — une
 * conséquence qu'aucun code ni aucun processus ne garantit, écrite sur un registre
 * inquiétant à quelqu'un qui a déjà fait ce qu'on lui demandait. La phrase reste au ras
 * du texte, au conditionnel, ou disparaît : elle ne doit jamais reprendre du poids sans
 * qu'une règle métier écrite la justifie.
 *
 * ⚠ AUCUNE PILULE D'EN-TÊTE (`headerCta: null`), contrairement aux e-mails d'agence : le
 * destinataire est le CLIENT d'une agence, il n'a pas de compte MEGGA. Lui proposer
 * « Ouvrir mon espace » l'enverrait sur une porte qui ne s'ouvre pas pour lui.
 */
export function buildBookingEmail(p: BookingEmailParams): { subject: string; html: string } {
  const when = formatFr(p.startIso, p.timeZone)
  const who = p.agentName ? esc(p.agentName) : 'votre conseiller'
  const agency = p.agencyName ? esc(p.agencyName) : 'MEGGA'
  const salutation = p.contactName ? `Bonjour ${esc(p.contactName)},` : 'Bonjour,'

  // Le nom de L'AGENCE ouvre l'objet, jamais MEGGA : le destinataire connaît son agence,
  // pas l'outil qu'elle utilise. Un objet qui s'annonce au nom d'un tiers inconnu se lit
  // comme un message non sollicité.
  const titres: Record<BookingEmailKind, { objet: string; titre: string; apercu: string }> = {
    confirmed: {
      objet: `${p.agencyName ?? 'MEGGA'} · rendez-vous de vérification confirmé`,
      titre: 'Votre rendez-vous de vérification est confirmé',
      apercu: 'La date, le lieu et ce qu’il faut apporter sont dans ce message.',
    },
    rescheduled: {
      objet: `${p.agencyName ?? 'MEGGA'} · rendez-vous de vérification déplacé`,
      titre: 'Votre rendez-vous a été déplacé',
      apercu: 'La nouvelle date est dans ce message.',
    },
    cancelled: {
      objet: `${p.agencyName ?? 'MEGGA'} · rendez-vous de vérification annulé`,
      titre: 'Votre rendez-vous a été annulé',
      apercu: 'Aucune démarche de votre part n’est nécessaire.',
    },
  }
  const t = titres[p.kind]

  // Une annulation n'a ni faits à relire, ni consigne, ni action : ce qui reste est de
  // savoir quoi faire ensuite, et cela tient en une phrase.
  if (p.kind === 'cancelled') {
    return {
      subject: t.objet,
      html: shell({
        title: t.titre,
        preheader: t.apercu,
        legalNote: LEGAL_NOTE,
        headerCta: null,
        bodyHtml: `
     ${p_(salutation)}
     ${p_(`Votre rendez-vous de vérification d’identité du <strong style="color:${INK};">${when}</strong> a bien été annulé.`, 28)}
     ${p_(`Pour en fixer un nouveau, contactez ${who} chez ${agency}.`, 0)}
     ${signature()}`,
      }),
    }
  }

  const modeLigne = p.mode === 'video'
    ? (p.videoLink ? 'En visioconférence' : 'En visioconférence, lien à venir')
    : (p.location ? esc(p.location) : 'Sur place')

  return {
    subject: t.objet,
    html: shell({
      title: t.titre,
      preheader: t.apercu,
      legalNote: LEGAL_NOTE,
      headerCta: null,
      bodyHtml: `
     ${p_(salutation)}
     ${p_(p.kind === 'rescheduled'
        ? 'Votre rendez-vous de vérification d’identité a été déplacé. Voici les nouvelles informations.'
        : 'Votre rendez-vous de vérification d’identité est confirmé. Voici les informations à retenir.', 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row('Quand', esc(when))}
       ${row(p.mode === 'video' ? 'Comment' : 'Où', modeLigne)}
       ${row('Avec', `${who} · ${agency}`)}
     </table>
     ${p_('Gardez votre pièce d’identité à portée de main : votre conseiller peut avoir à la voir.', 28)}
     ${p.mode === 'video' && p.videoLink
        ? `<div style="margin:0 0 32px;">${button(p.videoLink, 'Rejoindre la visioconférence')}</div>`
        : ''}
     ${p.manageUrl
        ? `${h2('Un empêchement ?')}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${BODY_INK};">
       <a href="${esc(p.manageUrl)}" style="color:${BRAND};">Déplacez ou annulez ce rendez-vous</a> en un clic, sans avoir à vous connecter.
     </p>`
        : ''}
     ${signature()}`,
    }),
  }
}

/**
 * Mention de pied. Le destinataire n'est pas client de MEGGA mais de l'agence : la
 * mention doit nommer la raison de l'envoi sans lui attribuer une relation qu'il n'a pas.
 */
const LEGAL_NOTE = 'Cet e-mail concerne un rendez-vous de vérification d’identité pris avec votre agence. '
  + 'Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.'

/** Signature : MEGGA est l'outil, la relation appartient à l'agence. */
function signature(): string {
  return `<div style="padding:32px 0 0;">${p_('À bientôt,<br />L’équipe MEGGA', 0)}</div>`
}

/**
 * Envoie le courriel correspondant. Renvoie `false` sur échec — l'appelant
 * n'en fait rien d'autre que le journaliser : la réservation prime.
 */
export async function sendBookingEmail(p: BookingEmailParams): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey || !p.to) return false

  const { subject, html } = buildBookingEmail(p)

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: p.to, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
