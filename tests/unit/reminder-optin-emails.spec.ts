// Rappel automatique et invitation au consentement WhatsApp.
//
// Les deux n'avaient aucun test, et le premier portait un défaut d'échappement sur son
// CORPS ENTIER — celui-là même que le gabarit découpait en paragraphes avant de l'injecter.
import { describe, it, expect } from 'vitest'
import { buildContactReminderEmail } from '../../supabase/functions/_shared/reminder-email'
import { buildOptinInviteEmail } from '../../supabase/functions/_shared/whatsapp-optin-send'

const DESINSCRIPTION = '<a href="https://app.megga.ch/desinscription/jeton">Se désinscrire</a>'

describe('buildContactReminderEmail', () => {
  const base = {
    subject: 'Votre rendez-vous de demain',
    body: 'Bonjour Marie,\n\nNous nous voyons demain à 14:00.\nÀ demain.',
    agentName: 'Gregory Lyonnet',
  }

  it('⛔ échappe le corps — il ne l’était PAS, alors qu’il vient d’un gabarit éditable', () => {
    const html = buildContactReminderEmail({ ...base, body: 'Bonjour <img src=x onerror=alert(1)>' }).html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('échappe aussi l’objet et le nom de l’agent', () => {
    const html = buildContactReminderEmail({ ...base, subject: '<b>Objet</b>', agentName: '<i>Greg</i>' }).html
    expect(html).not.toContain('<b>Objet</b>')
    expect(html).not.toContain('<i>Greg</i>')
  })

  it('garde la structure du texte : paragraphes ET retours simples', () => {
    // C'est ce qui distingue un rappel lisible d'un pavé : le double saut fait un
    // paragraphe, le simple un retour à la ligne. Échapper d'abord, structurer ensuite.
    const html = buildContactReminderEmail(base).html
    expect(html).toContain('<br />')
    expect((html.match(/<p style="margin:0 0 16px/g) ?? []).length).toBe(2)
  })

  it('porte sa désinscription et n’affirme donc PAS le contraire', () => {
    const html = buildContactReminderEmail({ ...base, unsubscribeHtml: DESINSCRIPTION }).html
    expect(html).toContain('desinscription/jeton')
    expect(html).not.toContain('ne contient pas de lien de désinscription')
  })

  it('sans nom d’agent, aucun bloc de signature vide', () => {
    expect(buildContactReminderEmail({ ...base, agentName: '' }).html).not.toContain('MEGGA</p>')
  })
})

describe('buildOptinInviteEmail', () => {
  const base = {
    lang: 'fr',
    copy: {
      subject: 'Recevoir les messages de Régie du Rhône sur WhatsApp',
      body: 'Régie du Rhône souhaite vous écrire sur WhatsApp.',
      cta: 'Accepter sur WhatsApp',
    },
    agencyName: 'Régie du Rhône',
    lien: 'https://wa.me/41225551010?text=OPTIN%20jeton',
  }

  it('déclare la langue du destinataire : la copie existe en quatre langues', () => {
    for (const lang of ['fr', 'de', 'en', 'it']) {
      expect(buildOptinInviteEmail({ ...base, lang }).html).toContain(`lang="${lang}"`)
    }
  })

  it('⛔ le bouton reste VERT WhatsApp, pas l’accent MEGGA', () => {
    // C'est le seul bouton du produit qui ouvre une application tierce : sa couleur dit
    // vers où il mène. Une pilule indigo promettrait une page MEGGA.
    const html = buildOptinInviteEmail(base).html
    expect(html).toContain('#25D366')
    expect(html).toContain('https://wa.me/41225551010')
  })

  it('dit la SORTIE dans l’aperçu : c’est une demande de consentement', () => {
    expect(buildOptinInviteEmail(base).html).toContain('répondre STOP à tout moment')
  })

  it('promet qu’aucun message ne part avant la réponse', () => {
    // C'est l'engagement qui rend la demande acceptable, et il est vrai : l'invitation
    // reste inerte tant qu'elle n'est pas consommée.
    expect(buildOptinInviteEmail(base).html).toContain('aucun message ne vous sera envoyé')
  })

  it('échappe la copie, le nom de l’agence et le lien', () => {
    const html = buildOptinInviteEmail({
      ...base,
      copy: { ...base.copy, body: '<img src=x>', cta: '<b>Oui</b>' },
      agencyName: '<script>alert(1)</script>',
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<b>Oui</b>')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('⛔ aucune pilule : le contact n’a pas de compte MEGGA', () => {
    expect(buildOptinInviteEmail(base).html).not.toContain('Ouvrir mon espace')
  })
})
