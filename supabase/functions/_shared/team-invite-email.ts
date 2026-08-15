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

import { INK, MUTED, FONT, escapeHtml, shell, p, row, button } from './email-shell.ts'

/** Libellés des quatre rôles que le CRM connaît (profiles.role). */
const ROLES: Record<string, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  agent: 'Agent',
  assistant: 'Assistant',
}

export interface TeamInviteInput {
  inviterName: string
  agencyName: string
  role: string
  acceptUrl: string
}

export function buildTeamInviteEmail(i: TeamInviteInput): { subject: string; html: string } {
  return {
    // L'AGENCE ouvre l'objet : c'est elle que le destinataire reconnaît, pas l'outil
    // qu'elle utilise. Même règle que sur les e-mails destinés aux clients d'agence.
    subject: `${i.agencyName} · invitation à rejoindre l’équipe`,
    html: shell({
      title: 'Vous êtes invité à rejoindre une équipe',
      // Dit ce que le message contient de décisif : qui invite, et que le lien périme.
      preheader: 'Votre rôle et le lien pour créer votre accès sont dans ce message.',
      legalNote: 'Cet e-mail vous a été envoyé parce qu’une agence vous a invité à la rejoindre sur '
        + 'MEGGA. Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas '
        + 'de lien de désinscription.',
      headerCta: null,
      bodyHtml: `
     ${p(`<strong style="color:${INK};">${escapeHtml(i.inviterName)}</strong> vous invite à rejoindre `
        + `<strong style="color:${INK};">${escapeHtml(i.agencyName)}</strong> sur MEGGA.`, 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row('Agence', escapeHtml(i.agencyName))}
       ${row('Votre rôle', escapeHtml(ROLES[i.role] ?? i.role))}
     </table>
     <div style="margin:0 0 10px;">${button(i.acceptUrl, 'Accepter l’invitation')}</div>
     <p style="margin:0 0 28px;font-family:${FONT};font-size:11.5px;color:${MUTED};font-weight:500;">
       Cette invitation expire dans 7 jours.
     </p>
     <p style="margin:0;font-family:${FONT};font-size:11.5px;color:${MUTED};line-height:1.5;">
       Si vous n’attendiez pas cette invitation, ignorez ce message : le lien expirera de lui-même.
     </p>`,
    }),
  }
}
