/**
 * Le vocabulaire des rôles d'un contact et ses dérivations (étape 3).
 *
 * ⛔ CES RÈGLES SONT CELLES DU DÉCLENCHEUR SQL (`contacts_roles_sync`, migration
 * `20260922180000_contacts_roles.sql`). Deux dérivations qui divergent donneraient un écran
 * qui dit « Vendeur » sur un contact que la base compte comme acheteur.
 */
import { describe, expect, it } from 'vitest'
import {
  ROLES_CONTACT, ROLES_DEMANDE, ROLES_RESEAU, ROLES_TRANSACTION,
  estRole, porteDemande, roleDominant, rolesDeType, rolesDepuisTexte, rolesOrdonnes, typeDeRoles,
  type RoleContact,
} from '@/lib/contactRoles'

describe('le vocabulaire', () => {
  it('douze rôles, dans un ordre qui fait foi', () => {
    expect(ROLES_CONTACT).toEqual([
      'buyer', 'seller', 'tenant', 'landlord', 'investor',
      'family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect',
    ])
    expect(ROLES_TRANSACTION).toEqual(['buyer', 'seller', 'tenant', 'landlord', 'investor'])
    // ⛔ La PARTITION, et non une seconde liste à maintenir : elle verrouille d'un coup
    // l'ordre, la disjonction et l'exhaustivité des deux familles. Une longueur laissait
    // passer une permutation, donc une pastille peinte du mauvais rôle.
    expect([...ROLES_TRANSACTION, ...ROLES_RESEAU]).toEqual([...ROLES_CONTACT])
    expect(ROLES_DEMANDE).toEqual(['buyer', 'tenant', 'investor'])
  })

  it('refuse ce qui n’est pas un rôle', () => {
    expect(estRole('buyer')).toBe(true)
    expect(estRole('both')).toBe(false)
    expect(estRole('lead')).toBe(false)
    expect(estRole('')).toBe(false)
  })

  it('rolesOrdonnes assainit ce que rend la base', () => {
    expect(rolesOrdonnes(null)).toEqual([])
    expect(rolesOrdonnes(['buyer', 'buyer'])).toEqual(['buyer'])
    expect(rolesOrdonnes(['buyer', 'both'])).toEqual(['buyer'])
    expect(rolesOrdonnes(['lawyer', 'buyer'])).toEqual(['buyer', 'lawyer'])
  })
})

describe('l’ancien type devient un rôle', () => {
  it('chaque type donne ses rôles, sans perte', () => {
    expect(rolesDeType('buyer')).toEqual(['buyer'])
    expect(rolesDeType('seller')).toEqual(['seller'])
    expect(rolesDeType('tenant')).toEqual(['tenant'])
    expect(rolesDeType('landlord')).toEqual(['landlord'])
    expect(rolesDeType('investor')).toEqual(['investor'])
    expect(rolesDeType('both')).toEqual(['buyer', 'seller'])
    // ⛔ « Prospect » n’est pas un rôle : c’est un stade. Un contact sans rôle est un lead.
    expect(rolesDeType('lead')).toEqual([])
  })

  it('et l’aller-retour rend le type d’origine', () => {
    for (const t of ['buyer', 'seller', 'tenant', 'landlord', 'investor', 'both', 'lead'] as const) {
      expect(typeDeRoles(rolesDeType(t)), t).toBe(t)
    }
  })
})

describe('typeDeRoles — la règle du déclencheur', () => {
  it('acquéreur ET côté offre donnent « both »', () => {
    expect(typeDeRoles(['buyer', 'seller'])).toBe('both')
    expect(typeDeRoles(['buyer', 'landlord'])).toBe('both')
  })
  it('mais un compagnon qui n’est pas une OFFRE ne suffit pas', () => {
    expect(typeDeRoles(['buyer', 'lawyer'])).toBe('buyer')     // un rôle de réseau n'est pas une offre
    expect(typeDeRoles(['buyer', 'investor'])).toBe('buyer')   // investor est côté DEMANDE
  })
  it('sinon le premier rôle de transaction, dans l’ordre du vocabulaire', () => {
    expect(typeDeRoles(['investor', 'tenant'])).toBe('tenant')
    expect(typeDeRoles(['landlord', 'investor'])).toBe('landlord')
    expect(typeDeRoles(['seller', 'tenant'])).toBe('seller')
  })
  it('aucun rôle de transaction : un lead, même avec des rôles de réseau', () => {
    expect(typeDeRoles([])).toBe('lead')
    expect(typeDeRoles(['lawyer', 'private_banker'])).toBe('lead')
  })
})

describe('les dérivations d’écran', () => {
  it('le rôle dominant peint la pastille : transaction d’abord, sinon réseau', () => {
    expect(roleDominant(['lawyer', 'seller'])).toBe('seller')
    expect(roleDominant(['trustee', 'lawyer'])).toBe('lawyer')
    expect(roleDominant([])).toBeNull()
  })
  it('porteDemande dit si on écrit des critères de recherche', () => {
    expect(porteDemande(['buyer'])).toBe(true)
    expect(porteDemande(['tenant', 'lawyer'])).toBe(true)
    expect(porteDemande(['investor'])).toBe(true)
    expect(porteDemande(['seller', 'landlord'])).toBe(false)
    expect(porteDemande([])).toBe(false)
  })
})

describe('rolesDepuisTexte — taper un rôle le trouve', () => {
  // Les libellés sont injectés : le module reste PUR (aucune traduction dedans).
  const fr: Record<string, string> = {
    buyer: 'Acquéreur', seller: 'Vendeur', tenant: 'Locataire', landlord: 'Bailleur',
    investor: 'Investisseur', family_office: 'Family office', referrer: 'Prescripteur',
    private_banker: 'Private banker', lawyer: 'Avocat', trustee: 'Trustee',
    broker: 'Courtier', architect: 'Architecte',
  }
  const libelle = (r: RoleContact): string => fr[r] ?? r

  it('trouve par le libellé, accents et casse pliés', () => {
    expect(rolesDepuisTexte('private banker', libelle)).toEqual(['private_banker'])
    expect(rolesDepuisTexte('AVOCAT', libelle)).toEqual(['lawyer'])
    expect(rolesDepuisTexte('acquereur', libelle)).toEqual(['buyer'])
  })
  it('trouve par un morceau du libellé, et rend TOUS les rôles qui correspondent', () => {
    expect(rolesDepuisTexte('banker', libelle)).toEqual(['private_banker'])
    expect(rolesDepuisTexte('e', libelle)).toEqual([])        // trop court : deux lettres minimum
    expect(rolesDepuisTexte('  ', libelle)).toEqual([])
  })
  it('trouve aussi par le slug, que l’agent ne voit pas mais que les URL portent', () => {
    expect(rolesDepuisTexte('family_office', libelle)).toEqual(['family_office'])
  })
  it('ne rend rien pour un mot qui n’est pas un rôle — sinon toute recherche filtrerait', () => {
    expect(rolesDepuisTexte('Rochat', libelle)).toEqual([])
  })
})
