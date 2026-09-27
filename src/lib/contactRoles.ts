/**
 * Les rôles d'un contact (étape 3, 22.09.2026) — vocabulaire, familles, ordre et dérivations.
 * Module PUR : ni React, ni Supabase, ni traduction.
 *
 * Un contact porte PLUSIEURS rôles. `contacts.roles` fait foi ; `contacts.type` en dérive et
 * reste écrit, parce que le reste du CRM le lit (KYC, pipeline, relances, trois politiques RLS).
 *
 * ⛔ CE MODULE EST LE MIROIR DU SQL : `contacts_roles_ordonnes` et `contacts_roles_sync`
 * (migration `20260922180000_contacts_roles.sql`) appliquent les mêmes règles, dans le même
 * ordre. `contacts-roles-vocabulaire.spec.ts` confronte les deux listes, plus les 4 langues.
 */
import type { ContactType } from '@/types/contact'

/**
 * Les douze rôles, dans l'ORDRE QUI FAIT FOI : c'est lui qui choisit le type dérivé et la
 * pastille d'une ligne. Cinq rôles de transaction d'abord, sept rôles de réseau ensuite.
 */
export const ROLES_CONTACT = [
  'buyer', 'seller', 'tenant', 'landlord', 'investor',
  'family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect',
] as const

export type RoleContact = (typeof ROLES_CONTACT)[number]

/**
 * Ce qu'on FAIT avec cette personne : ces rôles commandent les écrans.
 *
 * ⚠ Type ÉTROIT, et non `readonly RoleContact[]` : ces cinq rôles sont exactement ceux qui
 * sont AUSSI un `ContactType`, ce dont `typeDeRoles` a besoin pour rendre le type dérivé.
 * Annotée large, la liste laissait croire à `tsc` qu'un `lawyer` pouvait sortir de `.find()`.
 */
export type RoleTransaction = Extract<RoleContact, 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor'>
export const ROLES_TRANSACTION: readonly RoleTransaction[] = ['buyer', 'seller', 'tenant', 'landlord', 'investor']
/** Qui elle EST : ces rôles décrivent, filtrent, et alimenteront les relations (étape 6). */
export const ROLES_RESEAU: readonly RoleContact[] = ['family_office', 'referrer', 'private_banker', 'lawyer', 'trustee', 'broker', 'architect']
/**
 * Côté DEMANDE : ceux dont les critères partent dans `search_criteria`, donc dans le matching.
 *
 * ⛔ Pas de `ROLES_OFFRE` en pendant, et ce n'est PAS un oubli à réparer : ce que confie un
 * vendeur ou un bailleur se range dans `form_data.offer`, sans matching. La règle côté offre
 * s'écrit donc par la négation de `porteDemande` ; une seconde liste ne serait qu'un doublon
 * à tenir en phase avec celle-ci.
 */
export const ROLES_DEMANDE: readonly RoleContact[] = ['buyer', 'tenant', 'investor']

/**
 * ⚠ Prend `unknown`, et non `string` : il filtre le `text[]` BRUT que rend Postgres, où peut
 * traîner un ancien `both` / `lead` ou un rôle retiré du vocabulaire depuis l'écriture.
 */
export const estRole = (v: unknown): v is RoleContact =>
  typeof v === 'string' && (ROLES_CONTACT as readonly string[]).includes(v)

/** Ne garde que des rôles connus, sans doublon, dans l'ordre du vocabulaire. */
export function rolesOrdonnes(roles: readonly unknown[] | null | undefined): RoleContact[] {
  const vus = new Set(roles?.filter(estRole) ?? [])
  return ROLES_CONTACT.filter((r) => vus.has(r))
}

/** L'ancien type, en rôles. ⛔ `lead` n'est pas un rôle : un contact sans rôle est un lead. */
export function rolesDeType(type: ContactType | null | undefined): RoleContact[] {
  if (type === 'both') return ['buyer', 'seller']
  if (type === 'lead' || !type) return []
  return estRole(type) ? [type] : []
}

/**
 * Le type dérivé des rôles — la règle du déclencheur : `both` si acquéreur ET côté offre,
 * sinon le premier rôle de transaction dans l'ordre du vocabulaire, sinon `lead`.
 */
export function typeDeRoles(roles: readonly RoleContact[]): ContactType {
  const a = (r: RoleContact) => roles.includes(r)
  if (a('buyer') && (a('seller') || a('landlord'))) return 'both'
  const premier = ROLES_TRANSACTION.find(a)
  return premier ?? 'lead'
}

/** Le rôle qui peint la pastille : transaction d'abord, sinon le premier rôle de réseau. */
export function roleDominant(roles: readonly RoleContact[]): RoleContact | null {
  return ROLES_TRANSACTION.find((r) => roles.includes(r)) ?? ROLES_RESEAU.find((r) => roles.includes(r)) ?? null
}

/**
 * Le contact cherche quelque chose : ses critères partent dans `search_criteria`.
 *
 * ⚠ MOITIÉ de la règle seulement. La conception est une DISJONCTION : ce rôle OU des critères
 * déjà saisis. L'autre moitié vit au site d'appel — un écran qui teste `porteDemande(roles)`
 * SEUL masquerait les critères d'un contact repassé en `{seller}`, qui les a pourtant.
 */
export const porteDemande = (roles: readonly RoleContact[]): boolean => ROLES_DEMANDE.some((r) => roles.includes(r))

const plier = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Les rôles qu'une recherche libre désigne : « private banker » rend `private_banker`.
 *
 * Les libellés sont INJECTÉS (`libelle`) : ce module ne connaît pas i18n, et la recherche doit
 * suivre la langue de l'agent. On compare sur le libellé ET sur le slug (les deux pliés), parce
 * qu'une URL ou un collage porte parfois le slug.
 *
 * ⛔ Deux lettres au moins : à une lettre, « e » désignerait la moitié du vocabulaire et toute
 * recherche de nom se mettrait à filtrer par rôle.
 */
export function rolesDepuisTexte(q: string, libelle: (r: RoleContact) => string): RoleContact[] {
  const m = plier(q)
  if (m.length < 2) return []
  return ROLES_CONTACT.filter((r) => plier(libelle(r)).includes(m) || plier(r.replace(/_/g, ' ')).includes(m) || r === m)
}
