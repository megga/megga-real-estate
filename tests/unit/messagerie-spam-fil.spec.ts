/**
 * Un message au spam dans un fil qui n'y est pas (revue de sécurité du 15.09.2026).
 *
 * ⛔ Le spam se jugeait au niveau du FIL : un message signalé au milieu d'une conversation s'y
 * lisait comme les autres — un hameçonnage entre deux vrais messages du notaire, que
 * « Répondre » pouvait viser et dont l'expéditeur était proposé au rattachement. Le serveur ne
 * laisse plus un spam rejoindre une conversation (`cleDeFilSpam`) ; l'écran, lui, tient à part
 * ceux qu'un geste fait ailleurs y laisse, et ne demande de logo pour aucun spam.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { partagerSpam } from '@/lib/mail/format'
import { repoPath } from './helpers/fs-scan'

const m = (id: string, is_spam = false) => ({ id, is_spam })
const lire = (f: string) => readFileSync(repoPath(f), 'utf8')

describe('partagerSpam', () => {
  it('un fil hors spam tient ses messages au spam à part, dans l’ordre du fil', () => {
    expect(partagerSpam([m('a'), m('b', true), m('c')], false)).toEqual({ affiches: [m('a'), m('c')], auSpam: [m('b', true)] })
  })
  it('un fil au spam se lit en entier : son bandeau dit déjà où il est', () => {
    expect(partagerSpam([m('a', true), m('b')], true)).toEqual({ affiches: [m('a', true), m('b')], auSpam: [] })
  })
  it('un fil hors spam dont tous les messages le sont : en entier, plutôt qu’un fil vide', () => {
    expect(partagerSpam([m('a', true)], false)).toEqual({ affiches: [m('a', true)], auSpam: [] })
    expect(partagerSpam([], false)).toEqual({ affiches: [], auSpam: [] })
  })
})

describe('Messagerie — l’écran tient le spam à part', () => {
  it('le lecteur et le mobile lisent le fil par partagerSpam', () => {
    expect(lire('src/components/crm/messagerie/MailReader.tsx')).toMatch(/partagerSpam\(p\.messages, p\.thread\.is_spam\)/)
    expect(lire('src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx')).toMatch(/partagerSpam\(thread\.data \?\? \[\], ligne\?\.is_spam \?\? false\)/)
    // La lecture remonte à chaque fil : ce qu'on y a déplié ne passe pas au suivant.
    expect(lire('src/components/crm/messagerie/MessagerieApp.tsx')).toMatch(/<MailReader[\s\S]{0,200}key=\{filOuvert\.id\}/)
  })

  it('« Répondre » et « Transférer » ne visent jamais un message au spam', () => {
    const reader = lire('src/components/crm/messagerie/MailReader.tsx')
    expect(reader).toContain('const horsSpam = p.messages.filter((m) => !m.is_spam)')
    expect(reader).toMatch(/const inboundLast = \[\.\.\.horsSpam\]\.reverse\(\)/)
  })

  it('aucun logo pour du spam : liste, lecteur, mobile — et le verrou de l’edge', () => {
    // Ni pour un fil qui n'a rien reçu : son adresse est celle du destinataire (revue du 15.09.2026).
    expect(lire('src/components/crm/messagerie/MailList.tsx')).toMatch(/p\.rows\.filter\(\(r\) => !r\.is_spam && r\.last_inbound_at\)\.map\(adresse\)/)
    expect(lire('src/components/crm/messagerie/MailReader.tsx')).toMatch(/first && !p\.thread\.is_spam && !first\.is_spam \? \[first\.from_email\] : \[\]/)
    expect(lire('src/components/crm-mobile/messagerie/MobileMessagerieScreen.tsx')).toMatch(/threads\.rows\.filter\(\(r\) => !r\.is_spam && r\.last_inbound_at\)/)
    const edge = lire('supabase/functions/mail-logos/index.ts')
    // Un MESSAGE reçu, domaine par domaine : plus de fil, plus de `.or(…)` partagé.
    expect(edge.match(/\.eq\('is_spam', false\)\.eq\('direction', 'inbound'\)\.ilike\('from_email'/g)).toHaveLength(1)
    expect(edge).not.toMatch(/\.or\(filtre\)/)
  })

  // ⛔ « Spam » sur un fil qui n'a rien reçu : aucun message à signaler, et le fil passait au
  // Spam pour en ressortir au premier recalcul (revue du 15.09.2026). Le serveur le refuse
  // (`rienASignaler`) ; l'écran ne l'offre qu'à un fil qui a reçu.
  it('« Spam » n’est offert qu’à un fil qui a reçu : lecteur, menu de la ligne, barre de la sélection', () => {
    expect(lire('src/components/crm/messagerie/MailReader.tsx')).toMatch(/p\.thread\.last_inbound_at && btn\(t\('mail\.ctx\.spam'\)/)
    expect(lire('src/components/crm/messagerie/MailContextMenu.tsx')).toMatch(/\(row\.is_spam \|\| row\.last_inbound_at\) && item\(/)
    expect(lire('src/components/crm/messagerie/MessagerieApp.tsx')).toMatch(/selectionVisible\.some\(\(r\) => r\.last_inbound_at\)/)
  })

  it('les textes existent dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const j = JSON.parse(lire(`src/i18n/locales/${langue}/messages.json`)) as { mail: { read: Record<string, string>; mobile: Record<string, string> } }
      for (const cle of ['spamInThread_one', 'spamInThread_other', 'spamShow', 'spamHide']) expect(j.mail.read[cle], `${langue} : mail.read.${cle}`).toBeTruthy()
      for (const cle of ['spamHidden_one', 'spamHidden_other']) expect(j.mail.mobile[cle], `${langue} : mail.mobile.${cle}`).toBeTruthy()
    }
  })
})
