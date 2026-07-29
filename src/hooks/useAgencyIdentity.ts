/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — accès aux données.
 *
 * Lit ET écrit `agencies` (via useAgencySettings, déjà câblé sur les colonnes KYB —
 * on ne réécrit pas un second chemin ; saveAgency délègue L'ÉCRITURE à son save(), cf.
 * plus bas pour ce qu'il fait EN PLUS) et `agency_related_persons` +
 * `agency_person_roles` (personnes liées à l'agence et leurs rôles signatory/ubo),
 * écrit ces deux dernières, et déclenche la RPC de soumission. Sous RLS
 * `is_agency_admin()` (20260728102000) : un agent simple qui appellerait ceci
 * recevrait 42501.
 *
 * ⚠ N'écrit JAMAIS dans agency_verification_checks ni
 * agency_person_verification_checks — ces tables n'ont aucune policy INSERT
 * côté client (20260728103000), délibérément : seule une RPC SECURITY DEFINER
 * peut y poser un verdict, pour qu'un inscrit ne fabrique pas sa propre preuve
 * de vérification. Contrat écrit à la tâche 3 du plan étape 2, étendu par les
 * tâches 4 à 7 — les six champs d'origine (agency, persons, isLoading, savePerson,
 * removePerson, submit) ne changent jamais de signature ; la tâche 4 y ajoute
 * saveAgency (écriture agence, étape 2) et legalFormCategory (catégorie de la forme
 * juridique COURANTE de l'agence, dérivée ici pour que la tâche 5 — étape 3,
 * bénéficiaires effectifs — n'ait qu'à la lire plutôt que de refaire la résolution
 * pays -> useLegalForms -> option elle-même) ; la tâche 5 y ajoute revokeUboRole
 * (cf. plus bas, correctif revue).
 *
 * ⚠ Correctif revue tâche 5 — fraîcheur de `legalFormCategory` : `agencySettings.agency`
 * vient d'une requête React Query, et `useAgencySettings().save()` invalide cette
 * requête SANS attendre le refetch dans son onSuccess (`queryClient.invalidateQueries(...)`
 * sans `return`/`await`) — un composant qui lisait `legalFormCategory` juste après un
 * `saveAgency()` tout juste résolu pouvait donc encore voir l'ANCIENNE catégorie, le
 * temps que le cache rattrape l'écriture. `saveAgency` (ci-dessous) mémorise donc,
 * dans `lastSavedAgency`, les deux champs (country, legalFormId) du DERNIER payload
 * envoyé — posés de façon SYNCHRONE au retour de `save()`, donc jamais périmés — et
 * `agencyForLegalFormCategory` (pure, testée) préfère cette valeur à
 * `agencySettings.agency` dès qu'elle existe. Le repli sur l'agence persistée ne
 * s'applique donc plus qu'AVANT le tout premier `saveAgency()` de cette instance du
 * hook, où c'est de toute façon la seule source disponible.
 * IdentityShell.tsx continue néanmoins de dériver SA PROPRE décision de saut depuis le
 * BROUILLON `agencyDraft` (voir son en-tête) : ce correctif règle la fraîcheur
 * juste-après-un-save, pas le suivi d'une frappe pas encore sauvegardée, que
 * `legalFormCategory` ne peut par construction pas offrir (il ne reflète que ce qui a
 * été ENVOYÉ à saveAgency, jamais un brouillon en cours d'édition). Les deux
 * consommateurs partagent désormais la MÊME implémentation de la dérivation
 * (country, legalFormId) -> catégorie, `useLegalFormCategory` ci-dessous — chacun avec
 * sa propre paire en entrée, mais plus jamais deux façons séparées de la calculer.
 *
 * Tâche 5 : savePerson/removePerson (déjà génériques sur `role` depuis la tâche 3)
 * suffisent tels quels pour ÉCRIRE un rôle 'ubo' — aucune nouvelle primitive d'écriture
 * n'était nécessaire pour ça. `ubosToRemove` ci-dessous reste le filet de sécurité pure
 * function pour la suppression (cf. son en-tête) : il protège l'identité et le rôle
 * signataire d'une personne qui porte aussi un rôle ubo, en ne la supprimant jamais.
 *
 * ⚠ Correctif revue tâche 5 — révocation du rôle ubo : `ubosToRemove` protège une
 * personne qui porte un autre rôle actif de la SUPPRESSION, mais ne révoquait rien de
 * SON CÔTÉ — son rôle ubo restait actif en base indéfiniment après un retrait à
 * l'écran, ou après un passage à une raison individuelle (l'étape qui permettrait de
 * le retirer un par un cessant alors d'être montée). `revokeUboRole` ci-dessous comble
 * ce trou : il pose `valid_to` sur LA ligne agency_person_roles(role='ubo') ACTIVE de
 * la personne (trouvée par le même `findActiveRoleId` que savePerson), jamais sur
 * agency_related_persons ni sur un rôle signatory. `ubosToRevoke` (complément exact de
 * `ubosToRemove` : mêmes entrées, dernier prédicat inversé) et `ubosToRevokeOnSkip`
 * (nettoyage rétroactif, sans condition de brouillon) décident QUI en a besoin —
 * IdentityShell.tsx appelle les deux, cf. persistCurrentStep.
 *
 * Toute la logique de décision (mapping des lignes DB, construction des payloads
 * d'écriture) vit dans des fonctions pures exportées ci-dessous, testées dans
 * tests/unit/useAgencyIdentity.spec.ts sans mock Supabase — même motif que
 * resolveIdentityGateStatus dans useIdentityGate.ts.
 *
 * Tâche 6 — pièce d'identité : ajoute `agencyId` et `uploadIdentityDocument` au retour
 * (les six champs d'origine restent inchangés, cf. ci-dessus), ainsi qu'un hook
 * AUTONOME `useIdentityDocuments(agencyId, relatedPersonId)` (même précédent que
 * `useLegalFormCategory` : l'appelant fournit sa propre paire plutôt que de dupliquer
 * ici la dérivation « qui est le signataire courant »). `uploadIdentityDocument`
 * dépose le fichier dans Storage (bucket `documents`, préfixe kyb-identity — migration
 * 20260728109000) mais n'écrit AUCUNE ligne DB : la ligne de check
 * (agency_person_verification_checks) reste hors de portée du client pour la même
 * raison que ci-dessus, et ne peut être posée que par submit_agency_identity()
 * (étendue à cette fin par la même tâche, 20260728110000). Voir la section « Tâche 6 »
 * plus bas pour les fonctions pures de chemin/validation, testées sans mock Supabase.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'
import { useLegalForms, type LegalFormOption, type LegalFormCategory } from '@/hooks/useLegalForms'

/** Identité d'une personne liée à l'agence — indépendante de son/ses rôle(s). */
export interface IdentityPerson {
  /** null = pas encore enregistrée (savePerson l'insère et renvoie l'id réel). */
  id: string | null
  firstName: string
  lastName: string
  /** ISO court, 'YYYY-MM-DD'. */
  dateOfBirth: string | null
  /** ISO 3166-1 alpha-2. */
  nationality: string | null
}

/** Un rôle porté par une personne dans l'agence : signataire et/ou UBO. */
export interface IdentityRole {
  role: 'signatory' | 'ubo'
  /** Renseigné seulement si role='signatory'. */
  signaturePower: 'individual' | 'joint' | null
  /** Renseigné seulement si role='ubo'. */
  ownershipPct: number | null
  pepSelfDeclared: boolean
}

/** Une personne liée à l'agence, avec la liste de ses rôles courants. */
export type IdentityPersonWithRoles = IdentityPerson & { roles: IdentityRole[] }

/** Contrat public de useAgencyIdentity(), fixé à la tâche 3, étendu par les tâches 4 à 7 (cf. en-tête). */
export interface UseAgencyIdentityReturn {
  /** Réutilise le type de useAgencySettings — mêmes colonnes agencies.*. */
  agency: AgencySettingsData
  /**
   * Tâche 6 — même valeur que profile.agency_id, déjà calculée en interne pour
   * agencyId/agency_id ci-dessous. Exposée pour composer useIdentityDocuments() (hook
   * autonome, cf. plus haut) depuis IdentityShell sans dupliquer cette lecture de
   * useAuth() — même précédent que useAgencySettings().agencyId.
   */
  agencyId: string | null
  persons: IdentityPersonWithRoles[]
  isLoading: boolean
  /** Insère (id=null) ou met à jour une personne + ses rôles. Renvoie l'id. */
  savePerson: (p: IdentityPerson, roles: IdentityRole[]) => Promise<string>
  removePerson: (id: string) => Promise<void>
  /**
   * Correctif revue tâche 5 — révoque UNIQUEMENT le rôle `ubo` ACTIF d'une personne
   * (pose `valid_to` à aujourd'hui) : jamais `agency_related_persons`, jamais un rôle
   * `signatory` de la même personne. No-op silencieux si elle n'a déjà plus de rôle
   * ubo actif. Voir `ubosToRevoke` / `ubosToRevokeOnSkip` ci-dessous pour qui en a
   * besoin et pourquoi.
   */
  revokeUboRole: (relatedPersonId: string) => Promise<void>
  /**
   * Tâche 6 — téléverse (ou remplace) le recto/verso de la pièce d'identité de
   * `relatedPersonId` dans Storage (bucket `documents`, préfixe kyb-identity,
   * migration 20260728109000). N'écrit AUCUNE ligne DB : la ligne de check
   * (agency_person_verification_checks) ne peut venir que de submit_agency_identity()
   * — cf. l'en-tête de la section Storage plus haut. Renvoie le chemin Storage complet
   * du fichier déposé ; invalide la query de useIdentityDocuments() pour ce
   * `relatedPersonId` une fois l'upload résolu.
   */
  uploadIdentityDocument: (relatedPersonId: string, side: IdentityDocumentSide, file: File) => Promise<string>
  /**
   * Appelle submit_agency_identity() (RPC, tâche 1, étendue par la tâche 6 puis câblée
   * par la tâche 7). `relatedPersonId` DOIT être LE signataire dont la pièce d'identité
   * a été déposée à l'étape précédente (même id que celui déjà utilisé pour le
   * téléversement, IdentityShell.tsx) — jamais une redérivation implicite : plusieurs
   * personnes peuvent porter un rôle signatory actif simultanément
   * (signature_power='joint', cf. le commentaire de la RPC, 20260728110000), donc il
   * n'existe pas « le » signataire en général, seulement celui que CE parcours a fait
   * saisir et dont CE parcours a collecté la pièce. `null` reste accepté (défensif,
   * cf. buildSubmitAgencyIdentityArgs) : la soumission réussit quand même si l'agence
   * est par ailleurs complète, mais aucune ligne de vérification n'est posée.
   */
  submit: (relatedPersonId: string | null) => Promise<void>
  /**
   * Persiste l'étape 2 (agence) — délègue L'ÉCRITURE à useAgencySettings().save(),
   * donc AUCUN second chemin d'écriture vers `agencies` (cf. en-tête du fichier pour
   * ce qu'il fait EN PLUS de save()). L'appelant doit fournir l'objet complet (étaler
   * `agency` courant puis écraser les champs édités), pas un patch partiel : save()
   * écrit toutes les colonnes de AgencySettingsData à chaque appel.
   */
  saveAgency: (next: AgencySettingsData) => Promise<void>
  /**
   * Catégorie de la forme juridique COURANTE : reflète le DERNIER `saveAgency()`
   * résolu dans cette instance du hook, sinon l'agence persistée si aucun n'a encore
   * eu lieu (jamais périmée juste après un save, cf. `agencyForLegalFormCategory` et
   * l'en-tête du fichier — correctif revue tâche 5). `null` tant qu'aucune forme
   * juridique n'est choisie / pas encore chargée. Ne reflète PAS un brouillon en cours
   * d'édition pas encore sauvegardé : IdentityShell.tsx (étape 3, saut de l'étape
   * bénéficiaires) a besoin de ce suivi EN DIRECT et dérive donc sa PROPRE décision
   * depuis son brouillon, via le même `useLegalFormCategory` ci-dessous — voir son
   * en-tête. Cette valeur-ci convient à un usage qui n'a pas cette contrainte de
   * fraîcheur immédiate (ex. un futur récapitulatif, tâche 7).
   */
  legalFormCategory: LegalFormCategory | null
}

/**
 * Résout la catégorie de la forme juridique `legalFormId` dans `options` (celles
 * renvoyées par useLegalForms pour le pays courant) — pure, testée directement, même
 * motif que mapPersonRow/isRoleActive ci-dessous (pas de mock Supabase). null si
 * `legalFormId` est vide (rien choisi) ou absent de `options` (ex. options pas
 * encore rechargées après un changement de pays) : jamais une erreur, l'appelant
 * traite l'absence d'info comme "pas encore su", pas comme un cas exceptionnel.
 */
export function resolveLegalFormCategory(legalFormId: string, options: LegalFormOption[]): LegalFormCategory | null {
  if (!legalFormId) return null
  return options.find((o) => o.id === legalFormId)?.category ?? null
}

/**
 * Les deux champs qui déterminent la catégorie de forme juridique — sous-ensemble de
 * AgencySettingsData partagé par agencyForLegalFormCategory et useLegalFormCategory
 * ci-dessous, pour ne pas leur faire porter tout un AgencySettingsData dont ils
 * n'utilisent que ces deux colonnes.
 */
export type AgencyLegalFormFields = Pick<AgencySettingsData, 'country' | 'legalFormId'>

/**
 * Correctif revue tâche 5 — quelle paire (country, legalFormId) utiliser pour dériver
 * `legalFormCategory` : celle du DERNIER `saveAgency()` résolu (`lastSavedAgency`,
 * mémorisée de façon synchrone dans useAgencyIdentity dès que la mutation revient) a
 * priorité sur l'agence persistée (`agencySettings.agency`), dont le cache React
 * Query peut ne pas avoir encore rattrapé l'écriture — cf. l'en-tête du fichier pour
 * le mécanisme complet. `null` tant qu'aucun `saveAgency()` n'a encore résolu dans
 * cette instance du hook : l'agence persistée est alors la seule source disponible.
 * Pure et testée directement (tests/unit/useAgencyIdentity.spec.ts), même motif que
 * resolveLegalFormCategory ci-dessus.
 */
export function agencyForLegalFormCategory(
  persistedAgency: AgencyLegalFormFields,
  lastSavedAgency: AgencyLegalFormFields | null,
): AgencyLegalFormFields {
  return lastSavedAgency ?? persistedAgency
}

/**
 * Catégorie de la forme juridique `legalFormId` pour le pays `country` — combine
 * useLegalForms(country) et resolveLegalFormCategory en UNE seule implémentation,
 * partagée par useAgencyIdentity() (paire choisie par agencyForLegalFormCategory
 * ci-dessus) et IdentityShell.tsx (paire = le brouillon `agencyDraft` en cours de
 * saisie, cf. son en-tête) : les deux appelants ont une bonne raison de fournir une
 * paire différente, mais plus aucune raison d'implémenter la dérivation elle-même
 * deux fois (correctif revue tâche 5 — « deux sources de vérité »).
 */
export function useLegalFormCategory(country: string, legalFormId: string): LegalFormCategory | null {
  const { options } = useLegalForms(country)
  return resolveLegalFormCategory(legalFormId, options)
}

// ─── Forme des lignes lues depuis Supabase (snake_case, roles imbriqués) ───────
export interface PersonRoleRow {
  id: string
  role: 'signatory' | 'ubo'
  signature_power: 'individual' | 'joint' | null
  ownership_pct: number | null
  pep_self_declared: boolean
  /** null ou date future = rôle actif (mandat qui court encore). Une date passée = historisé (cf. valid_from/valid_to). */
  valid_to: string | null
}

export interface PersonRow {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  nationality: string | null
  roles: PersonRoleRow[]
}

const PERSON_SELECT =
  'id, first_name, last_name, date_of_birth, nationality, roles:agency_person_roles(id, role, signature_power, ownership_pct, pep_self_declared, valid_to)'

/** Date UTC du jour au format 'YYYY-MM-DD' — même format que la colonne `date` valid_to. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * true si un rôle est actif à la date `today` (paramètre injectable pour les tests ;
 * par défaut la date UTC du jour). Même définition d'« actif » que la RPC
 * submit_agency_identity() : `valid_to is null or valid_to > current_date`
 * (supabase/migrations/20260729150800_submit_agency_identity.sql, comparaison
 * stricte). `valid_to` est une colonne `date`, pas `timestamptz` : comparaison sur
 * la date seule, jamais l'heure.
 *
 * mapPersonRow et findActiveRoleId (ci-dessous) passent TOUS DEUX par cette fonction
 * plutôt que de retester `valid_to === null` chacun de leur côté — c'était déjà le
 * bug (revue tâche 3) : un rôle à valid_to futur (que le schéma autorise
 * explicitement) était invisible ici alors que la RPC le compte comme actif.
 * Conséquence concrète : savePerson ne retrouvait pas la ligne active existante, en
 * insérait une seconde, que l'index partiel idx_agency_person_roles_active_unique ne
 * bloque pas puisqu'il ne couvre que `valid_to is null` (20260728102000) — deux
 * lignes actives contradictoires en base, et un signataire invisible dans le wizard
 * alors que la RPC le comptait déjà.
 */
export function isRoleActive(validTo: string | null, today: string = todayIsoDate()): boolean {
  return validTo === null || validTo > today
}

/**
 * Ligne DB (personne + ses rôles imbriqués) -> forme du contrat du hook.
 * Ne garde QUE les rôles actifs (isRoleActive ci-dessus) : un rôle historisé n'est
 * plus ce que le wizard doit relire ou proposer de modifier — l'historique existe
 * pour l'audit LAB (agency_person_roles), pas pour l'écran de saisie.
 */
export function mapPersonRow(row: PersonRow): IdentityPersonWithRoles {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    roles: row.roles
      .filter((r) => isRoleActive(r.valid_to))
      .map((r) => ({
        role: r.role,
        signaturePower: r.signature_power,
        ownershipPct: r.ownership_pct,
        pepSelfDeclared: r.pep_self_declared,
      })),
  }
}

/** IdentityPerson -> ligne à écrire dans agency_related_persons. */
export function buildPersonPayload(agencyId: string, p: IdentityPerson) {
  return {
    agency_id: agencyId,
    first_name: p.firstName.trim(),
    last_name: p.lastName.trim(),
    date_of_birth: p.dateOfBirth,
    nationality: p.nationality,
  }
}

/**
 * IdentityRole -> ligne à écrire dans agency_person_roles. `source` est TOUJOURS
 * 'declared' ici (pas un paramètre) : cette écriture vient du dirigeant qui saisit
 * sa propre identité, jamais d'un rapprochement au registre ou d'une procuration
 * (les deux autres valeurs possibles de la colonne, posées par d'autres chemins).
 */
export function buildRolePayload(relatedPersonId: string, r: IdentityRole) {
  return {
    related_person_id: relatedPersonId,
    role: r.role,
    signature_power: r.signaturePower,
    ownership_pct: r.ownershipPct,
    pep_self_declared: r.pepSelfDeclared,
    source: 'declared' as const,
  }
}

/**
 * Correctif revue tâche 5 — ligne de mise à jour pour révoquer (historiser) un rôle :
 * ne pose QUE `valid_to`, jamais une autre colonne — même convention de « actif » que
 * isRoleActive/la RPC submit_agency_identity (valid_to non nul et non futur = plus
 * actif). `today` injectable pour les tests, comme isRoleActive ; par défaut la date
 * UTC du jour. Consommée par revokeUboRole, ci-dessous dans useAgencyIdentity().
 */
export function buildRoleRevocationPayload(today: string = todayIsoDate()): { valid_to: string } {
  return { valid_to: today }
}

/**
 * Tâche 7 — argument RPC de submit_agency_identity(p_related_person_id). `null` ->
 * objet VIDE, jamais `{ p_related_person_id: null }` : le paramètre généré
 * (src/types/database.ts, reflet de `uuid default null`) est optionnel (`?:`) mais
 * typé `string`, pas `string | null` — seule l'omission de la clé laisse jouer le
 * défaut SQL, une valeur `null` explicite ne passerait pas le typage strict du client.
 * Les deux se comportent identiquement côté serveur (le défaut EST déjà null), cette
 * fonction ne fait donc que choisir la forme que le client TypeScript accepte.
 */
export function buildSubmitAgencyIdentityArgs(relatedPersonId: string | null): { p_related_person_id?: string } {
  return relatedPersonId == null ? {} : { p_related_person_id: relatedPersonId }
}

/**
 * Tâche 5 — quelles personnes `removePerson()` doit effacer pour que la table reflète
 * le retrait d'un bénéficiaire dans le brouillon de l'étape 3 : celles qui portent
 * aujourd'hui un rôle `ubo` actif mais dont l'id n'apparaît plus dans le brouillon
 * courant (`draftPersonIds`, les `personId` — nullables pour les lignes neuves pas
 * encore enregistrées — des entrées de BeneficiaireDraft[]).
 *
 * Garde de sécurité, et raison d'être de cette fonction plutôt qu'un simple filtre
 * inline dans IdentityShell : une personne qui porte AUSSI un autre rôle actif (le cas
 * signataire+UBO explicitement visé par le brief tâche 5, très fréquent en petite SA)
 * n'est JAMAIS renvoyée, même si son id UBO a disparu du brouillon. `removePerson`
 * supprime la ligne `agency_related_persons` entière — `on delete cascade` emporterait
 * alors aussi son rôle signataire (20260728102000), perdant une identité KYB pourtant
 * toujours valide. Retirer quelqu'un de la liste des bénéficiaires ne doit revenir
 * qu'à cesser de déclarer CE rôle-là pour lui, jamais à effacer la personne.
 *
 * Limite assumée : un `ubo` déjà persisté pour une personne qui porte un autre rôle
 * n'est donc jamais révoqué (le rôle reste actif en base) si l'utilisateur la retire
 * du brouillon puis sauvegarde — seule une historisation ciblée de CE rôle le
 * permettrait, hors périmètre ici (la tâche 5 réutilise savePerson/removePerson tels
 * quels, cf. en-tête du fichier). Sans conséquence destructive : aucune identité ni
 * aucun autre rôle n'est jamais perdu.
 */
export function ubosToRemove(existingPersons: IdentityPersonWithRoles[], draftPersonIds: Array<string | null>): string[] {
  const keptIds = new Set(draftPersonIds.filter((id): id is string => id != null))
  return existingPersons
    // IdentityPerson.id est `string | null` dans le type partagé (null = pas encore
    // enregistrée, cf. son JSDoc) — mais tout élément de `persons` vient d'une lecture
    // DB (mapPersonRow) et porte donc toujours un id réel. Ce filtre à predicate narrows
    // `p.id` en `string` pour le reste de la chaîne sans jamais recourir à `any`/`!`.
    .filter((p): p is IdentityPersonWithRoles & { id: string } => p.id != null)
    .filter((p) => p.roles.some((r) => r.role === 'ubo'))
    .filter((p) => !keptIds.has(p.id))
    .filter((p) => p.roles.every((r) => r.role === 'ubo'))
    .map((p) => p.id)
}

/**
 * Correctif revue tâche 5 — complément EXACT de ubosToRemove ci-dessus : personnes
 * qui portent un rôle `ubo` actif retiré du brouillon (même définition que
 * ubosToRemove : id absent de `draftPersonIds`) mais qu'un AUTRE rôle actif protège
 * déjà de la suppression complète (ubosToRemove ne les renvoie jamais, cf. son
 * en-tête) — le dernier filtre est l'exact inverse de celui de ubosToRemove. Ces
 * personnes ne doivent PAS être supprimées, mais leur rôle ubo doit tout de même
 * cesser d'être actif : sans ce complément, il restait actif en base indéfiniment
 * après un retrait à l'écran — le trou signalé en revue. `revokeUboRole`
 * (useAgencyIdentity()) consomme ce résultat : il n'historise QUE la ligne
 * agency_person_roles(role='ubo') de la personne, jamais agency_related_persons ni un
 * rôle signatory.
 */
export function ubosToRevoke(existingPersons: IdentityPersonWithRoles[], draftPersonIds: Array<string | null>): string[] {
  const keptIds = new Set(draftPersonIds.filter((id): id is string => id != null))
  return existingPersons
    .filter((p): p is IdentityPersonWithRoles & { id: string } => p.id != null)
    .filter((p) => p.roles.some((r) => r.role === 'ubo'))
    .filter((p) => !keptIds.has(p.id))
    .filter((p) => p.roles.some((r) => r.role !== 'ubo'))
    .map((p) => p.id)
}

/**
 * Correctif revue tâche 5 — nettoyage RÉTROACTIF : TOUTES les personnes qui portent
 * aujourd'hui un rôle `ubo` actif, sans condition de brouillon (contrairement à
 * ubosToRemove/ubosToRevoke ci-dessus). Appelée quand l'étape bénéficiaires bascule en
 * « sautée » (raison individuelle choisie à l'étape agence, shouldSkipBeneficiairesStep
 * dans IdentityShell.tsx) : l'écran qui permettrait normalement de les retirer un par
 * un ne sera alors plus jamais monté, donc plus jamais l'occasion de les nettoyer par
 * les deux fonctions ci-dessus, qui lisent un brouillon que l'utilisateur ne verra
 * plus. Ne supprime JAMAIS personne (jamais agency_related_persons), même une
 * personne qui ne porte QUE le rôle ubo : contrairement à un retrait explicite à
 * l'écran, un changement de forme juridique n'est pas un signal que l'utilisateur
 * donne sur l'identité de qui que ce soit — seule sa déclaration ubo cesse de
 * s'appliquer. `revokeUboRole` (useAgencyIdentity()) fait le reste : valid_to
 * seulement, jamais l'identité ni un rôle signatory.
 */
export function ubosToRevokeOnSkip(existingPersons: IdentityPersonWithRoles[]): string[] {
  return existingPersons
    .filter((p): p is IdentityPersonWithRoles & { id: string } => p.id != null)
    .filter((p) => p.roles.some((r) => r.role === 'ubo'))
    .map((p) => p.id)
}

// ─── Tâche 6 : pièce d'identité du signataire (Storage, bucket `documents`) ────────
//
// Contrairement aux étapes 0 à 2 (texte, écrit dans agency_related_persons /
// agency_person_roles / agencies sous RLS), cette étape dépose un FICHIER dans
// Storage — préfixe réservé `kyb-identity`, migration 20260728109000
// (documents_kyb_identity_*, is_agency_admin() seul, jamais toute l'agence comme le
// reste du bucket documents). Aucune ligne DB n'est écrite ici : la ligne de check
// (agency_person_verification_checks) ne peut venir QUE de submit_agency_identity()
// (RPC SECURITY DEFINER, 20260728110000) — cf. son en-tête pour la garde anti-fuite
// inter-agences. Cette section ne fait que déposer/lire le fichier lui-même.

/** Les deux faces d'une pièce d'identité — recto puis verso, jamais l'inverse. */
export type IdentityDocumentSide = 'recto' | 'verso'

/** Un fichier déjà téléversé : son chemin Storage complet et une URL signée de prévisualisation. */
export interface IdentityDocumentPreview {
  path: string
  signedUrl: string
}

/** État des deux faces pour une personne — null tant qu'un côté n'a rien reçu. */
export interface IdentityDocumentPreviews {
  recto: IdentityDocumentPreview | null
  verso: IdentityDocumentPreview | null
}

/**
 * Préfixe Storage réservé (bucket `documents`) pour la pièce d'identité de
 * `relatedPersonId` — isolé par AGENCE (premier segment, vérifié par les 4 policies
 * documents_kyb_identity_*) ET par PERSONNE (dernier segment) : une agence peut avoir
 * plus d'un signataire actif (signature_power='joint', cf. le commentaire de
 * submit_agency_identity sur « il n'existe pas "le" signataire »), donc jamais un seul
 * dossier partagé qui mélangerait leurs pièces.
 */
export function identityDocumentFolder(agencyId: string, relatedPersonId: string): string {
  return `${agencyId}/kyb-identity/${relatedPersonId}`
}

/** Nom de fichier stable par côté (`recto.<ext>`/`verso.<ext>`) — l'extension suit le fichier téléversé, jamais figée. */
export function identityDocumentFileName(side: IdentityDocumentSide, extension: string): string {
  return `${side}.${extension}`
}

/**
 * Extension en minuscule, sans le point, déduite du nom de fichier choisi par
 * l'utilisateur — 'bin' si absente (ne devrait jamais arriver via un `<input
 * type=file>`, mais un chemin Storage ne doit jamais porter une extension vide).
 */
export function extensionOfFile(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName)
  return (match?.[1] ?? 'bin').toLowerCase()
}

/**
 * Parmi les fichiers listés à ce préfixe (`storage.list()`), le chemin complet du côté
 * demandé, ou null si ce côté n'a encore rien reçu. Le préfixe de correspondance est
 * `${side}.` (avec le point) et non un simple `startsWith(side)` : un nom de fichier
 * fantaisiste comme `versoTemp.jpg` ne doit jamais être confondu avec `verso`.
 * Au plus un fichier par côté par construction (uploadIdentityDocument retire l'ancien
 * avant d'écrire sous une autre extension, cf. son JSDoc) — `.find` suffit.
 */
export function findIdentityDocumentPath(
  files: Array<{ name: string }>,
  folder: string,
  side: IdentityDocumentSide,
): string | null {
  const match = files.find((f) => f.name.startsWith(`${side}.`))
  return match ? `${folder}/${match.name}` : null
}

/** Formats acceptés : les pièces d'identité suisses sont presque toujours des photos, mais un scan PDF de passeport reste courant. */
const ALLOWED_IDENTITY_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
/** 8 Mo — plus généreux que l'avatar (2 Mo, useAvatar.ts) : une pièce d'identité doit rester lisible en haute résolution. */
const MAX_IDENTITY_DOCUMENT_BYTES = 8 * 1024 * 1024

export interface IdentityDocumentValidationError {
  type: 'format' | 'size'
}

/**
 * Valide un fichier AVANT tout envoi réseau — format et taille, jamais l'un sans
 * l'autre. null = valide. Pure et testée directement (tests/unit/useAgencyIdentity.spec.ts),
 * même motif que le reste de ce fichier.
 */
export function validateIdentityDocumentFile(file: File): IdentityDocumentValidationError | null {
  if (!ALLOWED_IDENTITY_DOCUMENT_TYPES.includes(file.type)) return { type: 'format' }
  if (file.size > MAX_IDENTITY_DOCUMENT_BYTES) return { type: 'size' }
  return null
}

/**
 * Clé React Query partagée par useIdentityDocuments() et uploadIdentityDocument() — une
 * seule source de vérité pour l'invalidation. Correctif revue tâche 6 (point mineur) :
 * porte le couple (agencyId, relatedPersonId), pas relatedPersonId seul — c'est ce
 * couple qui détermine le dossier Storage lu (identityDocumentFolder ci-dessus) ;
 * une clé plus étroite risquerait de servir depuis le cache une réponse résolue sous
 * une AUTRE agence pour le même id de personne. Exportée et testée directement, même
 * motif que le reste de cette section.
 */
export function identityDocumentsQueryKey(agencyId: string | null, relatedPersonId: string | null) {
  return ['agency-identity-documents', agencyId, relatedPersonId] as const
}

const IDENTITY_DOCUMENT_SIDES: readonly IdentityDocumentSide[] = ['recto', 'verso']

/**
 * Les aperçus recto/verso déjà téléversés pour `relatedPersonId`, lus directement dans
 * Storage (`list()` puis `createSignedUrl()` pour chaque côté trouvé) — aucune colonne
 * DB ne les indexe (cf. en-tête de section). Hook AUTONOME plutôt que champ de
 * useAgencyIdentity() : même motif que useLegalFormCategory ci-dessus, l'appelant
 * (IdentityShell) fournit sa propre paire (agencyId, relatedPersonId) plutôt que de
 * dupliquer ici la dérivation « qui est le signataire courant » qu'IdentityShell fait
 * déjà pour ses propres besoins (existingSignatory).
 */
export function useIdentityDocuments(agencyId: string | null, relatedPersonId: string | null) {
  return useQuery({
    queryKey: identityDocumentsQueryKey(agencyId, relatedPersonId),
    queryFn: async (): Promise<IdentityDocumentPreviews> => {
      // Correctif revue tâche 6 (point mineur) : `enabled` ci-dessous empêche déjà cet
      // appel tant que l'un des deux manque, mais TypeScript ne peut pas le déduire à
      // travers la fermeture de useQuery — ce garde narrows les deux valeurs en
      // `string` sans jamais recourir à `as string` (contournement du mode strict).
      if (!agencyId || !relatedPersonId) {
        throw new Error('useIdentityDocuments: agencyId/relatedPersonId manquant')
      }
      const folder = identityDocumentFolder(agencyId, relatedPersonId)
      const { data: files, error } = await supabase.storage.from('documents').list(folder)
      if (error) throw error

      const previews: IdentityDocumentPreviews = { recto: null, verso: null }
      for (const side of IDENTITY_DOCUMENT_SIDES) {
        const path = findIdentityDocumentPath(files ?? [], folder, side)
        if (!path) continue
        const { data: signed, error: signError } = await supabase.storage.from('documents').createSignedUrl(path, 300)
        if (signError) throw signError
        previews[side] = { path, signedUrl: signed.signedUrl }
      }
      return previews
    },
    enabled: !!agencyId && !!relatedPersonId,
  })
}

/**
 * Personnes liées à l'agence courante, avec leurs rôles courants (étape 2 KYB).
 * `agencyId` vient de profile.agency_id — RLS (is_agency_admin()) refuse de toute
 * façon la lecture à un agent simple, mais on évite déjà la requête inutile.
 */
export function useAgencyIdentity(): UseAgencyIdentityReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const queryClient = useQueryClient()
  const agencySettings = useAgencySettings()
  // Correctif revue tâche 5 : mémorise le DERNIER payload envoyé à saveAgency() une
  // fois résolu (seuls les 2 champs utiles ici) — posé de façon SYNCHRONE au retour de
  // save(), donc jamais périmé, contrairement à agencySettings.agency dont le cache
  // React Query peut ne pas avoir encore rattrapé l'écriture (cf. en-tête du fichier).
  // null tant qu'aucun saveAgency() n'a encore résolu dans cette instance du hook.
  const [lastSavedAgency, setLastSavedAgency] = useState<AgencyLegalFormFields | null>(null)
  const agencyForCategory = agencyForLegalFormCategory(agencySettings.agency, lastSavedAgency)
  const legalFormCategory = useLegalFormCategory(agencyForCategory.country, agencyForCategory.legalFormId)

  const personsQueryKey = ['agency-identity-persons', agencyId]

  const { data: persons, isLoading: personsLoading } = useQuery({
    queryKey: personsQueryKey,
    queryFn: async (): Promise<IdentityPersonWithRoles[]> => {
      const { data, error } = await supabase
        .from('agency_related_persons')
        .select(PERSON_SELECT)
        .eq('agency_id', agencyId as string)
        .order('created_at', { ascending: true })
        .returns<PersonRow[]>()
      if (error) throw error
      return data.map(mapPersonRow)
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  /**
   * related_person_id + type de rôle -> id de la ligne agency_person_roles ACTIVE
   * (isRoleActive : valid_to null OU futur, même définition que la RPC
   * submit_agency_identity), ou null. `.or()` est la syntaxe PostgREST pour combiner
   * les deux branches dans un seul filtre (même motif que useRelanceLeads.ts).
   */
  const findActiveRoleId = async (relatedPersonId: string, role: IdentityRole['role']): Promise<string | null> => {
    const { data, error } = await supabase
      .from('agency_person_roles')
      .select('id')
      .eq('related_person_id', relatedPersonId)
      .eq('role', role)
      .or(`valid_to.is.null,valid_to.gt.${todayIsoDate()}`)
      // Défensif : l'index partiel idx_agency_person_roles_active_unique ne couvre
      // que `valid_to is null` (20260728102000), donc rien n'empêche en base deux
      // lignes valid_to futures actives pour la même (personne, rôle) — sans ce
      // .limit(1), .maybeSingle() lèverait PGRST116 sur ce cas au lieu de mettre à
      // jour une ligne existante. Le vrai correctif d'une telle donnée reste en
      // amont (une seule ligne active) ; ceci évite seulement le crash ici.
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }

  const savePerson = async (p: IdentityPerson, roles: IdentityRole[]): Promise<string> => {
    if (!agencyId) throw new Error('Agence non chargée')

    const personPayload = buildPersonPayload(agencyId, p)
    let personId = p.id
    if (personId) {
      const { error } = await supabase.from('agency_related_persons').update(personPayload).eq('id', personId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('agency_related_persons')
        .insert(personPayload)
        .select('id')
        .single()
      if (error) throw error
      personId = data.id as string
    }

    // Un rôle par type et par personne : on retrouve la ligne COURANTE (si elle
    // existe) et on la met à jour plutôt que d'en insérer une seconde, ce qui
    // violerait idx_agency_person_roles_active_unique. `.upsert()` ne convient pas
    // ici : cet index est PARTIEL (where valid_to is null), et l'inférence
    // ON CONFLICT de Postgres pour un upsert par liste de colonnes n'accepte pas
    // un index partiel sans répéter son WHERE — non exprimable via l'API du client.
    for (const role of roles) {
      const rolePayload = buildRolePayload(personId, role)
      const existingRoleId = await findActiveRoleId(personId, role.role)
      if (existingRoleId) {
        const { error } = await supabase.from('agency_person_roles').update(rolePayload).eq('id', existingRoleId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('agency_person_roles').insert(rolePayload)
        if (error) throw error
      }
    }

    await queryClient.invalidateQueries({ queryKey: personsQueryKey })
    return personId
  }

  const removePerson = async (id: string): Promise<void> => {
    // on delete cascade sur agency_person_roles.related_person_id : les rôles
    // suivent, pas besoin de les effacer explicitement.
    const { error } = await supabase.from('agency_related_persons').delete().eq('id', id)
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: personsQueryKey })
  }

  /**
   * Correctif revue tâche 5 — révoque UNIQUEMENT le rôle `ubo` ACTIF d'une personne :
   * jamais agency_related_persons, jamais un rôle signatory. Réutilise
   * findActiveRoleId (ci-dessus, même filtre `.eq('role', 'ubo')` que savePerson) pour
   * cibler LA ligne agency_person_roles à historiser, puis ne pose que `valid_to`
   * (buildRoleRevocationPayload) — jamais une autre colonne. No-op silencieux si la
   * personne n'a déjà plus de rôle ubo actif : rien à révoquer n'est jamais une
   * erreur, mêmes appelants idempotents que removePerson.
   */
  const revokeUboRole = async (relatedPersonId: string): Promise<void> => {
    const activeRoleId = await findActiveRoleId(relatedPersonId, 'ubo')
    if (!activeRoleId) return
    const { error } = await supabase
      .from('agency_person_roles')
      .update(buildRoleRevocationPayload())
      .eq('id', activeRoleId)
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: personsQueryKey })
  }

  /**
   * Tâche 6 — dépose (ou remplace) le fichier `side` de `relatedPersonId` sous le
   * préfixe réservé (identityDocumentFolder). Nom de fichier STABLE par côté
   * (`recto.<ext>`/`verso.<ext>`) : un remplacement écrase la même clé via `upsert`,
   * SAUF si l'extension change (ex. un premier essai en .jpg puis un .pdf) — dans ce
   * cas l'ancien objet est retiré d'abord, sinon les deux coexisteraient sous deux
   * clés distinctes et findIdentityDocumentPath (un seul match attendu par côté)
   * pourrait en exposer un fantôme selon l'ordre renvoyé par `list()`.
   */
  const uploadIdentityDocument = async (
    relatedPersonId: string,
    side: IdentityDocumentSide,
    file: File,
  ): Promise<string> => {
    if (!agencyId) throw new Error('Agence non chargée')

    const folder = identityDocumentFolder(agencyId, relatedPersonId)
    const { data: existingFiles, error: listError } = await supabase.storage.from('documents').list(folder)
    if (listError) throw listError

    const existingPath = findIdentityDocumentPath(existingFiles ?? [], folder, side)
    const path = `${folder}/${identityDocumentFileName(side, extensionOfFile(file.name))}`

    if (existingPath && existingPath !== path) {
      await supabase.storage.from('documents').remove([existingPath])
    }

    const { error } = await supabase.storage.from('documents').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw error

    await queryClient.invalidateQueries({ queryKey: identityDocumentsQueryKey(agencyId, relatedPersonId) })
    return path
  }

  const submit = async (relatedPersonId: string | null): Promise<void> => {
    const { error } = await supabase.rpc('submit_agency_identity', buildSubmitAgencyIdentityArgs(relatedPersonId))
    if (error) throw error
    // Contrat documenté dans useIdentityGate.ts : invalider CETTE clé avant toute
    // navigation vers /dashboard, sinon le gate relit l'ancien identity_submitted_at
    // (null) et renvoie l'utilisateur droit au gate qu'il vient de quitter — la
    // classe de bug de l'incident P0 c830f9a9.
    await queryClient.invalidateQueries({ queryKey: ['agency-identity-status', agencyId] })
  }

  /**
   * Correctif revue tâche 5 — enveloppe agencySettings.save() (AUCUN second chemin
   * d'écriture vers `agencies`, cf. en-tête du fichier) pour mémoriser, une fois la
   * mutation résolue, les deux champs utiles à legalFormCategory :
   * agencyForLegalFormCategory ci-dessus les préfère à agencySettings.agency tant que
   * le cache React Query n'a pas rattrapé l'écriture.
   */
  const saveAgency = async (next: AgencySettingsData): Promise<void> => {
    await agencySettings.save(next)
    setLastSavedAgency({ country: next.country, legalFormId: next.legalFormId })
  }

  return {
    agency: agencySettings.agency,
    agencyId,
    persons: persons ?? [],
    isLoading: agencySettings.isLoading || personsLoading,
    savePerson,
    removePerson,
    revokeUboRole,
    uploadIdentityDocument,
    submit,
    saveAgency,
    legalFormCategory,
  }
}
