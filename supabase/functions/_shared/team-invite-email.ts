// supabase/functions/_shared/team-invite-email.ts
//
// Invitation à rejoindre une agence sur MEGGA. Premier contact du destinataire avec la
// marque : il n'a PAS encore de compte, c'est cet e-mail qui lui en ouvre un.
//
// Sorti de `send-team-invite/index.ts` le 15.08.2026 pour être pur, donc testable et
// visible au banc de rendu.
//
// ⛔ AUCUNE pilule « Ouvrir mon espace » dans l'en-tête, et pour une raison différente des
// e-mails clients : ici le destinataire n'a pas encore de compte du tout. L'y envoyer le
// ferait buter sur une page de connexion avec des identifiants qui n'existent pas, alors
// que le bouton du corps est précisément ce qui les lui crée.
//
// ⚠ ÉCHAPPEMENT AJOUTÉ. Le gabarit d'origine interpolait `inviterName` et `agencyName`
// BRUTS dans le HTML. Les deux viennent d'une saisie (nom de profil, nom d'agence) : un
// chevron y cassait la mise en page, une balise la rendait injectable.
//
// ⛔ AUCUN ACCORD DE GENRE, dans aucune langue (16.08.2026). Le gabarit ne connaît PAS le
// genre du destinataire — il n'a même pas encore de compte. Une première traduction disait
// « Lei è invitatO » dans le titre et « L'ha invitatA » quinze lignes plus bas : l'un des
// deux était faux quel que soit le lecteur. Le défaut n'était pas le choix, c'était d'en
// faire deux. La sortie n'est donc pas de trancher un genre mais de formuler SANS accord :
// « Invitation à rejoindre une équipe », « Invito a unirsi a un team ». Le français avait
// le même défaut, moins visible (« invité »). L'allemand et l'anglais l'ignorent.

import { INK, MUTED, FONT, escapeHtml, shell, p, row, button } from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'

/**
 * Le texte de l'invitation, dans les quatre langues du produit.
 *
 * ⚠ LA LANGUE VIENT DE CELLE QUI INVITE, faute de mieux : le destinataire n'a pas de
 * compte, donc aucune préférence enregistrée. C'est une approximation assumée — un
 * confrère invité par une agence genevoise lira le français — et la seule information
 * dont on dispose au moment de l'envoi.
 */
const T: Record<AppLocale, {
  objet: (agence: string) => string
  titre: string
  apercu: string
  legal: string
  invitation: (invitant: string, agence: string) => string
  ligneAgence: string
  ligneRole: string
  roles: Record<string, string>
  ctaAccepter: string
  expiration: string
  ignorer: string
}> = {
  fr: {
    objet: (a) => `${a} · invitation à rejoindre l’équipe`,
    titre: 'Invitation à rejoindre une équipe',
    apercu: 'Votre rôle et le lien pour créer votre accès sont dans ce message.',
    legal: 'Cet e-mail vous a été envoyé parce qu’une agence vous a adressé une invitation à la '
      + 'rejoindre sur MEGGA. Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne '
      + 'contient pas de lien de désinscription.',
    invitation: (i, a) => `<strong style="color:${INK};">${i}</strong> vous invite à rejoindre `
      + `<strong style="color:${INK};">${a}</strong> sur MEGGA.`,
    ligneAgence: 'Agence', ligneRole: 'Votre rôle',
    roles: { admin: 'Administrateur', manager: 'Manager', agent: 'Agent', assistant: 'Assistant' },
    ctaAccepter: 'Accepter l’invitation',
    expiration: 'Cette invitation expire dans 7 jours.',
    ignorer: 'Si vous n’attendiez pas cette invitation, ignorez ce message : le lien expirera de lui-même.',
  },
  de: {
    objet: (a) => `${a} · Einladung, dem Team beizutreten`,
    titre: 'Einladung, einem Team beizutreten',
    apercu: 'Ihre Rolle und der Link zum Erstellen Ihres Zugangs stehen in dieser Nachricht.',
    legal: 'Diese E-Mail wurde Ihnen gesendet, weil eine Agentur Sie eingeladen hat, ihr auf MEGGA '
      + 'beizutreten. Es handelt sich nicht um eine Werbenachricht, deshalb enthält sie keinen Abmeldelink.',
    invitation: (i, a) => `<strong style="color:${INK};">${i}</strong> lädt Sie ein, `
      + `<strong style="color:${INK};">${a}</strong> auf MEGGA beizutreten.`,
    ligneAgence: 'Agentur', ligneRole: 'Ihre Rolle',
    roles: { admin: 'Administrator', manager: 'Manager', agent: 'Makler', assistant: 'Assistent' },
    ctaAccepter: 'Einladung annehmen',
    expiration: 'Diese Einladung läuft in 7 Tagen ab.',
    ignorer: 'Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie diese Nachricht: Der Link läuft von selbst ab.',
  },
  en: {
    objet: (a) => `${a} · invitation to join the team`,
    titre: 'Invitation to join a team',
    apercu: 'Your role and the link to create your access are in this message.',
    legal: 'This email was sent to you because an agency invited you to join it on MEGGA. It is not '
      + 'a marketing message, which is why it carries no unsubscribe link.',
    invitation: (i, a) => `<strong style="color:${INK};">${i}</strong> invites you to join `
      + `<strong style="color:${INK};">${a}</strong> on MEGGA.`,
    ligneAgence: 'Agency', ligneRole: 'Your role',
    roles: { admin: 'Administrator', manager: 'Manager', agent: 'Agent', assistant: 'Assistant' },
    ctaAccepter: 'Accept invitation',
    expiration: 'This invitation expires in 7 days.',
    ignorer: 'If you were not expecting this invitation, ignore this message: the link will expire on its own.',
  },
  it: {
    objet: (a) => `${a} · invito a unirsi al team`,
    titre: 'Invito a unirsi a un team',
    apercu: 'Il Suo ruolo e il link per creare il Suo accesso sono in questo messaggio.',
    legal: 'Questa e-mail Le è stata inviata perché un’agenzia Le ha rivolto un invito a farne parte '
      + 'su MEGGA. Non è una comunicazione commerciale: per questo non contiene alcun link di disiscrizione.',
    invitation: (i, a) => `<strong style="color:${INK};">${i}</strong> La invita a unirsi a `
      + `<strong style="color:${INK};">${a}</strong> su MEGGA.`,
    ligneAgence: 'Agenzia', ligneRole: 'Il Suo ruolo',
    roles: { admin: 'Amministratore', manager: 'Manager', agent: 'Agente', assistant: 'Assistente' },
    ctaAccepter: 'Accettare l’invito',
    expiration: 'Questo invito scade tra 7 giorni.',
    ignorer: 'Se non si aspettava questo invito, ignori questo messaggio: il link scadrà da solo.',
  },
}

export interface TeamInviteInput {
  inviterName: string
  agencyName: string
  role: string
  acceptUrl: string
  /** Langue de celle ou celui qui invite : le destinataire n'a pas encore de compte. */
  locale?: AppLocale
}

export function buildTeamInviteEmail(i: TeamInviteInput): { subject: string; html: string } {
  const l = i.locale ?? 'fr'
  const t = T[l]
  return {
    // L'AGENCE ouvre l'objet : c'est elle que le destinataire reconnaît, pas l'outil
    // qu'elle utilise. Même règle que sur les e-mails destinés aux clients d'agence.
    subject: t.objet(i.agencyName),
    html: shell({
      lang: l,
      title: t.titre,
      // Dit ce que le message contient de décisif : qui invite, et que le lien périme.
      preheader: t.apercu,
      legalNote: t.legal,
      headerCta: null,
      bodyHtml: `
     ${p(t.invitation(escapeHtml(i.inviterName), escapeHtml(i.agencyName)), 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row(t.ligneAgence, escapeHtml(i.agencyName))}
       ${row(t.ligneRole, escapeHtml(t.roles[i.role] ?? i.role))}
     </table>
     <div style="margin:0 0 10px;">${button(i.acceptUrl, t.ctaAccepter)}</div>
     <p style="margin:0 0 28px;font-family:${FONT};font-size:11.5px;color:${MUTED};font-weight:500;">
       ${t.expiration}
     </p>
     <p style="margin:0;font-family:${FONT};font-size:11.5px;color:${MUTED};line-height:1.5;">
       ${t.ignorer}
     </p>`,
    }),
  }
}
