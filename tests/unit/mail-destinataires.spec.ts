/**
 * La saisie des destinataires du composeur (`src/lib/mail/compose.ts`) — ce qui décide
 * de ce qui PART quand l'agent pose des capsules (Julien, 14.09.2026, « comme Google »).
 *
 * ⚠ Le cas qui porte ce fichier est l'adresse INVALIDE : `mail-send` l'écarte en silence,
 * donc l'écran doit la garder visible — jamais la jeter, jamais la « corriger » seul.
 */
import { describe, it, expect } from 'vitest'
import {
  adresseValide, ajouterDestinataires, boiteDEnvoi, decouperDestinataires, ecrireDestinataire, lireDestinataire, peutEnvoyerDepuis, scinderSaisie,
} from '@/lib/mail/compose'
import type { MailAccount } from '@/hooks/useMailAccounts'

describe('lireDestinataire', () => {
  it('lit une adresse nue, en minuscules', () => {
    expect(lireDestinataire('  Zoe@Exemple.CH ')).toEqual({ name: null, email: 'zoe@exemple.ch' })
  })
  it('lit « Nom <adresse> », guillemets compris', () => {
    expect(lireDestinataire('Camille Rochat <camille@exemple.ch>')).toEqual({ name: 'Camille Rochat', email: 'camille@exemple.ch' })
    expect(lireDestinataire('"Rochat, Camille" <camille@exemple.ch>')).toEqual({ name: 'Rochat, Camille', email: 'camille@exemple.ch' })
  })
  it('retire le préfixe mailto: d’un lien collé', () => {
    expect(lireDestinataire('mailto:etude@notaire-exemple.ch')?.email).toBe('etude@notaire-exemple.ch')
  })
  it('rend une saisie invalide TELLE QUELLE, casse comprise — c’est ce que la capsule montre', () => {
    expect(lireDestinataire('Camille Rochat')).toEqual({ name: null, email: 'Camille Rochat' })
    expect(adresseValide('Camille Rochat')).toBe(false)
  })
  it('rend null pour une saisie vide', () => {
    expect(lireDestinataire('   ')).toBeNull()
  })
})

describe('decouperDestinataires', () => {
  it('coupe à la virgule, au point-virgule et au retour à la ligne', () => {
    expect(decouperDestinataires('a@exemple.ch, b@exemple.ch; c@exemple.ch\nd@exemple.ch').map((a) => a.email))
      .toEqual(['a@exemple.ch', 'b@exemple.ch', 'c@exemple.ch', 'd@exemple.ch'])
  })
  /** Le carnet d'Outlook écrit « "Nom, Prénom" <adresse> » : la virgule y est un nom. */
  it('ne coupe pas entre guillemets ni entre chevrons', () => {
    expect(decouperDestinataires('"Rochat, Camille" <c@exemple.ch>, zoe@exemple.ch'))
      .toEqual([{ name: 'Rochat, Camille', email: 'c@exemple.ch' }, { name: null, email: 'zoe@exemple.ch' }])
  })
  it('coupe à l’espace entre des adresses nues — une colonne de tableur', () => {
    expect(decouperDestinataires('a@exemple.ch b@exemple.ch').map((a) => a.email)).toEqual(['a@exemple.ch', 'b@exemple.ch'])
  })
  it('garde un nom à espaces d’un seul tenant', () => {
    expect(decouperDestinataires('Camille Rochat')).toEqual([{ name: null, email: 'Camille Rochat' }])
  })
})

// ⛔ Une capsule rouverte se réécrivait « Rochat, Camille <c@…> » : à la validation suivante,
// la virgule la coupait en deux — « Rochat » en alerte, « Camille <c@…> ».
describe('ecrireDestinataire — une capsule rouverte se revalide en UNE capsule', () => {
  it.each([
    [{ name: 'Rochat, Camille', email: 'c@exemple.ch' }, '"Rochat, Camille" <c@exemple.ch>'],
    [{ name: 'Jean "JD" Dupont', email: 'j@exemple.ch' }, '"Jean \\"JD\\" Dupont" <j@exemple.ch>'],
    [{ name: 'Camille Rochat', email: 'c@exemple.ch' }, 'Camille Rochat <c@exemple.ch>'],
    [{ name: null, email: 'c@exemple.ch' }, 'c@exemple.ch'],
  ])('%j', (a, texte) => {
    expect(ecrireDestinataire(a)).toBe(texte)
    expect(decouperDestinataires(ecrireDestinataire(a))).toEqual([a])
  })
  it('un \\" ne ferme pas les guillemets pendant la frappe', () => {
    expect(scinderSaisie('"Jean \\"JD, Dupont" <j@exemple.ch>, z')).toEqual({ complets: [{ name: 'Jean "JD, Dupont', email: 'j@exemple.ch' }], reste: 'z' })
  })
})

describe('scinderSaisie', () => {
  it('ne valide rien tant qu’aucun séparateur n’est tapé', () => {
    expect(scinderSaisie('zoe@exemple.ch')).toBeNull()
  })
  it('valide ce qui précède la virgule et garde la suite', () => {
    expect(scinderSaisie('zoe@exemple.ch, cam')).toEqual({ complets: [{ name: null, email: 'zoe@exemple.ch' }], reste: 'cam' })
  })
  it('attend la fin des guillemets avant de couper', () => {
    expect(scinderSaisie('"Rochat, Cam')).toBeNull()
  })
})

describe('ajouterDestinataires', () => {
  it('ne double pas une adresse, casse ignorée', () => {
    const l = ajouterDestinataires([{ name: null, email: 'zoe@exemple.ch' }], [{ name: null, email: 'ZOE@exemple.ch' }])
    expect(l).toHaveLength(1)
  })
  it('complète le nom qui manquait', () => {
    const l = ajouterDestinataires([{ name: null, email: 'zoe@exemple.ch' }], [{ name: 'Zoé Exemple', email: 'zoe@exemple.ch' }])
    expect(l).toEqual([{ name: 'Zoé Exemple', email: 'zoe@exemple.ch' }])
  })
})

const boite = (id: string, over: Partial<MailAccount> = {}): MailAccount => ({
  id, agency_id: 'ag', owner_id: 'u', provider: 'gmail', email: `${id}@exemple.ch`, display_name: null,
  visibility: 'agency', status: 'active', last_sync_at: null, last_error: null, created_at: '2026-09-01T00:00:00Z', ...over,
})

describe('la boîte d’envoi', () => {
  it('seule une boîte ACTIVE peut envoyer — IMAP compris, qui envoie par SMTP depuis le lot 3', () => {
    expect(peutEnvoyerDepuis({ status: 'active' })).toBe(true)
    expect(peutEnvoyerDepuis({ status: 'reauth_required' })).toBe(false)
    expect(peutEnvoyerDepuis({ status: 'error' })).toBe(false)
    expect(boiteDEnvoi([boite('i', { provider: 'imap' })], [])).toBe('i')
  })
  it('prend le brouillon, puis la boîte ouverte, puis la première qui peut envoyer', () => {
    const b = [boite('a'), boite('b'), boite('c', { status: 'reauth_required' })]
    expect(boiteDEnvoi(b, ['b', 'a'])).toBe('b')
    expect(boiteDEnvoi(b, [null, 'a'])).toBe('a')
    expect(boiteDEnvoi(b, ['c', undefined])).toBe('a')
  })
  /** « De » vide ne dirait pas pourquoi « Envoyer » reste éteint ; la boîte et son motif, si. */
  it('garde la boîte préférée quand AUCUNE ne peut envoyer', () => {
    const b = [boite('a', { status: 'error' }), boite('c', { status: 'reauth_required' })]
    expect(boiteDEnvoi(b, ['c'])).toBe('c')
  })
})
