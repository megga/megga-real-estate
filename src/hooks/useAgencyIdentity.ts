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
 * pays -> useLegalForms -> option elle-même).
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
 * ⚠ Bénéficiaires effectifs — ce hook n'en porte PLUS aucune machinerie. L'étape a été
 * retirée du wizard le 3 août 2026 (décision client, 5 étapes -> 4), et le 3 août au
 * soir les helpers qu'elle seule appelait ont suivi : `ubosToRemove`, `ubosToRevoke`,
 * `ubosToRevokeOnSkip`, `revokeUboRole` et `buildRoleRevocationPayload` n'avaient plus
 * un seul appelant hors de leurs propres tests. Le SCHÉMA, lui, est intact — le rôle
 * `ubo` reste une valeur de `agency_person_roles.role`, la console admin continue
 * d'afficher les bénéficiaires d'un dossier, et rien n'exige de migration pour
 * réactiver l'étape. Ces cinq fonctions se relisent dans l'historique git si le besoin
 * revient ; les garder « au cas où » aurait été du code mort, ce que le dépôt interdit.
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
import { Sentry } from '@/lib/sentry'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'
import { useLegalForms, type LegalFormOption, type LegalFormCategory } from '@/hooks/useLegalForms'
import { isKybIdReadRecord, type KybIdReadRecord } from '@/types/kybIdRead'

/**
 * Rôle DÉCLARÉ dans l'organisation — les quatre rôles que le CRM connaît déjà
 * (`profiles.role`, `useTeam.ts`), demandés à l'étape 1 du wizard depuis le
 * 4 août 2026 à la place du pouvoir de signature.
 *
 * À ne PAS confondre avec `IdentityRole.role` juste en dessous, qui porte la
 * qualité de CONFORMITÉ (signatory | ubo) : celle-là décide qui doit être
 * identifié au titre de la LBA, celle-ci décide de quels droits la personne
 * dispose dans le produit. Une même personne porte les deux.
 */
export type AgencyDeclaredRole = 'admin' | 'manager' | 'agent' | 'assistant'

/** Les quatre rôles, dans l'ordre décroissant de droits — l'ordre des cartes à l'écran. */
export const AGENCY_DECLARED_ROLES: readonly AgencyDeclaredRole[] = [
  'admin', 'manager', 'agent', 'assistant',
] as const

/** Identité d'une personne liée à l'agence — indépendante de son/ses rôle(s) de conformité. */
export interface IdentityPerson {
  /** null = pas encore enregistrée (savePerson l'insère et renvoie l'id réel). */
  id: string | null
  firstName: string
  lastName: string
  /** ISO court, 'YYYY-MM-DD'. */
  dateOfBirth: string | null
  /** ISO 3166-1 alpha-2. */
  nationality: string | null
  /**
   * Rôle déclaré dans l'organisation. Persisté ici dès l'étape 1, mais appliqué à
   * `profiles.role` seulement à la soumission, par submit_agency_identity() — le
   * client n'a aucun droit d'écriture sur cette colonne-là (verrou anti-escalade
   * 20260627120000). Voir la migration 20260804170100 pour les trois raisons du
   * délai et pour le garde-fou « dernier administrateur ».
   */
  agencyRole: AgencyDeclaredRole | null
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

/**
 * Une personne liée à l'agence, avec la liste de ses rôles courants et la nature de
 * la pièce d'identité déposée pour elle.
 *
 * `idDocumentType` est délibérément HORS d'`IdentityPerson` : cette dernière est ce
 * que `buildPersonPayload` écrit d'un bloc à l'étape 1, alors que la nature de la
 * pièce se choisit à l'étape 3. L'y mettre ferait écraser le choix par `null` au
 * moindre retour en arrière sur l'étape signataire. Lue ici, écrite seulement par
 * saveIdentityDocumentType.
 */
export type IdentityPersonWithRoles = IdentityPerson & {
  roles: IdentityRole[]
  idDocumentType: IdentityDocumentType | null
  /**
   * État de la vérification Stripe Identity de cette personne. Écrit par le webhook
   * (service_role seul, trigger enforce_agency_person_id_read_writer) : le client le
   * LIT, il ne peut pas le poser — sans quoi un dirigeant se déclarerait vérifié.
   * `null` = aucune vérification jamais lancée.
   */
  /**
   * Verdict de la dernière lecture/vérification, relu depuis la BASE et non depuis un
   * état React : sans lui, recharger la page effaçait le verdict à l'écran alors qu'il
   * était bien écrit en base, et le chemin Stripe (dont le verdict arrive par webhook,
   * jamais par une réponse à l'onglet) n'en affichait aucun.
   */
  idDocumentRead: KybIdReadRecord | null
  verificationStatus: IdentityVerificationStatus | null
  /** `last_error.code` de Stripe — décide s'il faut proposer le dépôt manuel. */
  verificationErrorCode: string | null
  verifiedAt: string | null
}

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
  /**
   * Une lecture est EN COURS, cache déjà servi compris. Distinct de `isLoading`,
   * qui ne vaut vrai qu'au tout premier chargement : React Query sert d'abord un
   * cache périmé (`isLoading` faux) puis revalide. Qui décide quelque chose sur
   * « la liste est vide » doit attendre cette revalidation, sinon il tranche sur
   * un état qui va changer sous lui.
   */
  isRevalidating: boolean
  /** Insère (id=null) ou met à jour une personne + ses rôles. Renvoie l'id. */
  savePerson: (p: IdentityPerson, roles: IdentityRole[]) => Promise<string>
  removePerson: (id: string) => Promise<void>
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
   * Ouvre (ou reprend) une vérification Stripe Identity pour cette personne et rend
   * l'URL de la page hébergée, vers laquelle l'appelant doit NAVIGUER.
   *
   * Sans URL, dit POURQUOI (cf. IdentityVerificationStart) : le prestataire refuse
   * d'ouvrir (clé absente, compte non activé) ou la requête n'est jamais partie. Dans
   * les deux cas l'appelant propose le dépôt manuel — mais il doit pouvoir le DIRE, et
   * dire quoi. Une bascule muette a fait conclure à un dirigeant que la vérification
   * n'existait pas (04.08.2026).
   *
   * Le résultat de la vérification n'arrive JAMAIS par cet appel : il vient du webhook
   * `identity.verification_session.*`. L'utilisateur peut fermer l'onglet chez Stripe.
   */
  startIdentityVerification: (relatedPersonId: string) => Promise<IdentityVerificationStart>
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
  /** CHECK en base : admin | manager | agent | assistant — d'où `string`, validé à la lecture par isAgencyDeclaredRole. */
  agency_role: string | null
  /** CHECK en base : passport | id_card | residence_permit | other — d'où `string` et non IdentityDocumentType, le parcours n'écrivant que trois des quatre. */
  id_document_type: string | null
  id_document_read: unknown
  identity_verification_status: string | null
  identity_verification_error_code: string | null
  identity_verified_at: string | null
  roles: PersonRoleRow[]
}

const PERSON_SELECT =
  'id, first_name, last_name, date_of_birth, nationality, agency_role, id_document_type, id_document_read, identity_verification_status, identity_verification_error_code, identity_verified_at, roles:agency_person_roles(id, role, signature_power, ownership_pct, pep_self_declared, valid_to)'

/** Garde de type sur la colonne `agency_role`, lue en `string` (le CHECK vit en base). */
export function isAgencyDeclaredRole(value: string | null): value is AgencyDeclaredRole {
  return value != null && (AGENCY_DECLARED_ROLES as readonly string[]).includes(value)
}

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
    // Même traitement que idDocumentType juste en dessous : une valeur hors des quatre
    // rôles connus est ramenée à null plutôt qu'affichée comme une carte sélectionnée
    // qui n'existe pas. La colonne est nullable — tout dossier saisi avant le 4 août
    // 2026 la porte vide, et se relit sans rôle plutôt qu'avec un rôle inventé.
    agencyRole: isAgencyDeclaredRole(row.agency_role) ? row.agency_role : null,
    // `other` (quatrième valeur du CHECK, jamais écrite par ce parcours) est ramenée
    // à null : le wizard n'a pas de case pour elle, et l'afficher comme un choix
    // sélectionné qui n'existe dans aucune option serait un état impossible à
    // corriger sans en choisir un autre.
    idDocumentType: isIdentityDocumentType(row.id_document_type) ? row.id_document_type : null,
    idDocumentRead: isKybIdReadRecord(row.id_document_read) ? row.id_document_read : null,
    verificationStatus: isIdentityVerificationStatus(row.identity_verification_status)
      ? row.identity_verification_status
      : null,
    verificationErrorCode: row.identity_verification_error_code,
    verifiedAt: row.identity_verified_at,
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
    agency_role: p.agencyRole,
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

const IDENTITY_DOCUMENT_SIDES: readonly IdentityDocumentSide[] = ['recto', 'verso']

/**
 * Nature de la pièce déposée — écrite dans `agency_related_persons.id_document_type`,
 * colonne et CHECK posés dès l'origine (`20260729150200`) et restés vides jusqu'ici.
 *
 * Le CHECK en base accepte une QUATRIÈME valeur, `other`, que ce parcours n'offre
 * délibérément pas : le wizard doit pouvoir déduire de ce choix combien de faces
 * demander (identityDocumentSidesFor ci-dessous), ce qu'`other` rend impossible. La
 * valeur reste disponible pour un autre chemin d'écriture, elle n'est simplement pas
 * proposée à un dirigeant.
 */
export type IdentityDocumentType = 'passport' | 'id_card' | 'residence_permit'

/**
 * Statut d'une vérification d'identité Stripe, recopié depuis Stripe par le webhook.
 *
 * Miroir client du CHECK de `agency_related_persons.identity_verification_status`
 * (migration 20260803160000) et de STRIPE_VERIFICATION_STATUSES
 * (supabase/functions/_shared/kyb-identity-stripe.ts). Copie et non import : `src/` est
 * le bundle navigateur et `supabase/functions/` tourne sous Deno — deux runtimes qu'on
 * ne fait pas s'importer (règle §4 du CLAUDE.md).
 */
export type IdentityVerificationStatus = 'requires_input' | 'processing' | 'verified' | 'canceled'

const IDENTITY_VERIFICATION_STATUSES: readonly IdentityVerificationStatus[] = [
  'requires_input', 'processing', 'verified', 'canceled',
]

/** Vrai si cette valeur de colonne est un statut de vérification connu. */
export function isIdentityVerificationStatus(value: string | null): value is IdentityVerificationStatus {
  return value != null && (IDENTITY_VERIFICATION_STATUSES as readonly string[]).includes(value)
}

/**
 * Vrai si l'identité est suffisamment établie pour laisser AVANCER dans le wizard.
 *
 * `processing` compte, et c'est un arbitrage : Stripe met de quelques secondes à
 * quelques minutes à rendre son verdict, et bloquer l'onboarding entier sur un
 * traitement asynchrone échouerait au pire moment — juste après que le dirigeant a
 * fait tout le travail. Le dossier part de toute façon en revue humaine, et le webhook
 * écrira le verdict avant que le relecteur ne l'ouvre. `identity_submitted_at`
 * n'affirme d'ailleurs pas que l'identité est vérifiée : il date une soumission.
 */
export function isIdentityVerificationSufficient(status: IdentityVerificationStatus | null): boolean {
  return status === 'verified' || status === 'processing'
}

/**
 * Pourquoi l'ouverture d'une vérification n'a pas abouti.
 *
 * `unavailable` : le prestataire a RÉPONDU non (clé absente, compte non activé, refus
 * de création, personne hors agence). C'est un état prévu du parcours.
 * `unexpected` : la requête n'est jamais arrivée jusqu'à lui (réseau, blocage côté
 * poste). Rien ne dit que la vérification serait indisponible pour un autre visiteur,
 * donc l'écran doit proposer de RÉESSAYER en plus du dépôt.
 *
 * La distinction n'est pas cosmétique : elle décide de la phrase affichée ET de la
 * journalisation. Une bascule muette vers le dépôt a fait conclure à un dirigeant que
 * la vérification n'existait pas dans le produit (04.08.2026).
 */
export type VerificationStartFailure = 'unavailable' | 'unexpected'

/**
 * Résultat de startIdentityVerification : une URL où aller, ou la raison du refus.
 *
 * Un enregistrement plat et non une union discriminée : sur une union, `url: string |
 * null` ne rétrécit pas au test de vérité (une chaîne vide est fausse sans être `null`),
 * et l'appelant devait ruser pour lire `failure`. Ici les deux champs existent toujours,
 * exactement l'un des deux est renseigné, et l'appelant lit ce qu'il veut sans garde.
 */
export interface IdentityVerificationStart {
  /** L'URL de la page hébergée du prestataire, ou `null` si rien n'a pu s'ouvrir. */
  url: string | null
  /** Renseigné si et seulement si `url` est `null`. */
  failure: VerificationStartFailure | null
}

/**
 * Range l'erreur de `functions.invoke` dans l'une des deux causes.
 *
 * `FunctionsFetchError` est le seul cas où supabase-js dit que la requête n'a pas
 * abouti (réseau, DNS, blocage). Tout le reste — statut non-2xx, relais — signifie que
 * le serveur a été atteint et a répondu non. Pure et testée directement, même motif que
 * les autres règles de ce fichier.
 */
export function classifyVerificationStartError(error: unknown): VerificationStartFailure {
  return (error as { name?: string })?.name === 'FunctionsFetchError' ? 'unexpected' : 'unavailable'
}

/**
 * Refus SANS RECOURS de Stripe : réessayer ne changera rien, il faut ouvrir le dépôt
 * manuel. Miroir de requiresManualFallback (kyb-identity-stripe.ts) — insister sur ces
 * codes enfermerait l'utilisateur dans une boucle.
 *
 * ⛔ `consent_declined` en est SORTI le 04.08.2026, après vérification à la source.
 * Stripe ne déclare aucun code de refus terminal (le seul état terminal est `canceled`,
 * produit par l'intégrateur) : refuser le consentement est un GESTE de l'utilisateur sur
 * l'écran de Stripe, parfaitement rejouable, et notre edge sait déjà REPRENDRE une
 * session `requires_input`. Le traiter comme définitif privait donc du bouton
 * « Réessayer » quelqu'un dont le seul tort était d'avoir cliqué « Refuser » — et le
 * poussait vers un dépôt de pièce qu'il ne voulait peut-être pas faire.
 *
 * Restent deux codes réellement sans recours : `country_not_supported` (la liste des
 * pays émetteurs compte 110 entrées, Kosovo/Bosnie/Monténégro absents) et
 * `under_supported_age`. Aucun réessai ne les lève.
 */
export function verificationNeedsManualFallback(errorCode: string | null): boolean {
  return errorCode === 'country_not_supported'
    || errorCode === 'under_supported_age'
}

/**
 * Les codes de refus qui ont une phrase traduite — tout le reste retombe sur `unknown`.
 *
 * Voisine de verificationNeedsManualFallback À DESSEIN : les trois refus définitifs
 * qu'elle désigne DOIVENT figurer ici. Ce sont les seuls dont le message est lu depuis
 * la branche du dépôt manuel, où il n'y a plus rien à reprendre — or `unknown` propose
 * justement de « reprendre la vérification », un conseil impossible à suivre puisque
 * réessayer rendrait le même refus. Les séparer laisserait la divergence s'installer
 * sans que personne ne la voie ; tests/unit/identity-verification-refusal-copy.spec.ts
 * la fait échouer.
 */
export const KNOWN_VERIFICATION_ERRORS = [
  'consent_declined', 'under_supported_age', 'country_not_supported',
  'document_expired', 'document_type_not_supported', 'document_unverified_other',
  'selfie_face_mismatch', 'selfie_manipulated', 'selfie_document_missing_photo',
  'selfie_unverified_other', 'abandoned',
]

/** Le code tel que la clé de traduction l'attend : lui-même, ou `unknown`. */
export function knownVerificationError(code: string | null): string {
  return code && KNOWN_VERIFICATION_ERRORS.includes(code) ? code : 'unknown'
}

/** Les trois natures proposées par le wizard, dans l'ordre d'affichage. */
export const IDENTITY_DOCUMENT_TYPES: readonly IdentityDocumentType[] = [
  'passport', 'id_card', 'residence_permit',
]

/** Vrai si cette valeur de colonne est l'une des trois natures que le wizard sait afficher (donc `other` exclue). */
export function isIdentityDocumentType(value: string | null): value is IdentityDocumentType {
  return value != null && (IDENTITY_DOCUMENT_TYPES as readonly string[]).includes(value)
}

/**
 * Les faces à fournir pour cette nature de pièce.
 *
 * Un passeport n'a qu'une page de données ; exiger un « verso » revenait à faire
 * photographier une couverture vierge pour débloquer le bouton Continuer. Une carte
 * d'identité et un titre de séjour, eux, portent des informations des deux côtés —
 * sur la carte suisse, la date d'expiration est au DOS.
 *
 * Le repli `null` (aucune nature encore choisie) rend les deux faces : jamais un
 * dossier réputé complet parce qu'une question n'a pas encore été posée.
 */
export function identityDocumentSidesFor(
  type: IdentityDocumentType | null,
): readonly IdentityDocumentSide[] {
  return type === 'passport' ? ['recto'] : IDENTITY_DOCUMENT_SIDES
}

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

/**
 * Durée de vie des URL signées d'aperçu, et fréquence à laquelle on les renouvelle.
 *
 * Ces deux valeurs vont ENSEMBLE et l'écart entre elles est la marge de sécurité. Le
 * motif habituel du dépôt (KycDocViewer : signer 60-120 s au CLIC, ouvrir tout de
 * suite) ne s'applique pas ici : cette query est montée par IdentityShell dès que
 * l'agence et le signataire sont connus, donc potentiellement à l'étape 1, alors que
 * les aperçus ne sont rendus qu'aux étapes 3 et 4. Avec 300 s et aucun
 * renouvellement, tout parcours de plus de cinq minutes affichait des images mortes
 * — le cas exact de la boucle de correction (admin_request_agency_correction remet
 * identity_submitted_at à NULL et renvoie le dirigeant sur des pièces DÉJÀ déposées),
 * et celui du relecteur qui revient à la photo après avoir lu le reste du dossier.
 *
 * Renouveler ne suffirait pas seul : chaque signature change le jeton, donc l'URL,
 * donc l'image est retéléchargée. D'où un intervalle large (10 min) sous une durée
 * plus large encore (15 min) plutôt qu'un rafraîchissement serré.
 */
const IDENTITY_DOCUMENT_SIGNED_URL_TTL_SECONDS = 900
const IDENTITY_DOCUMENT_REFRESH_MS = 10 * 60 * 1000

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
        const { data: signed, error: signError } = await supabase.storage
          .from('documents')
          .createSignedUrl(path, IDENTITY_DOCUMENT_SIGNED_URL_TTL_SECONDS)
        if (signError) throw signError
        previews[side] = { path, signedUrl: signed.signedUrl }
      }
      return previews
    },
    enabled: !!agencyId && !!relatedPersonId,
    // Une URL signée périme : la donnée de cette query VIEILLIT toute seule, sans
    // qu'aucune écriture ne la change. D'où un staleTime aligné sur la signature
    // plutôt que le défaut global de 2 min (App.tsx), et un renouvellement pendant
    // que l'écran reste ouvert. `refetchIntervalInBackground` reste à son défaut
    // (false) : un onglet en arrière-plan ne signe rien, le retour au premier plan
    // est déjà couvert par refetchOnWindowFocus.
    staleTime: IDENTITY_DOCUMENT_REFRESH_MS,
    refetchInterval: IDENTITY_DOCUMENT_REFRESH_MS,
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

  const { data: persons, isLoading: personsLoading, isFetching: personsFetching } = useQuery({
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
      // L'erreur de ce retrait ne peut PAS être avalée. `list()` trie par nom en
      // ordre croissant, et findIdentityDocumentPath prend le premier match : si le
      // retrait échoue, `recto.jpg` continue de gagner sur le `recto.pdf` qui vient
      // d'être déposé. L'écran afficherait « Téléversé » et le récapitulatif
      // partirait en conformité avec l'ANCIENNE pièce, celle que l'utilisateur
      // croyait avoir remplacée. Mieux vaut un échec visible (l'appelant montre déjà
      // errors.generic) qu'un remplacement silencieusement sans effet.
      const { error: removeError } = await supabase.storage.from('documents').remove([existingPath])
      if (removeError) throw removeError
    }

    const { error } = await supabase.storage.from('documents').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw error

    await queryClient.invalidateQueries({ queryKey: identityDocumentsQueryKey(agencyId, relatedPersonId) })
    return path
  }


  /** Voir le contrat dans UseAgencyIdentityReturn. */
  const startIdentityVerification = async (relatedPersonId: string): Promise<IdentityVerificationStart> => {
    const { data, error } = await supabase.functions.invoke<{ url?: unknown }>('kyb-identity-verify', {
      body: { related_person_id: relatedPersonId },
    })
    // Aucune erreur remontée en rouge : dans tous les cas l'appelant bascule sur le
    // dépôt manuel. Mais il doit savoir LAQUELLE des deux situations il annonce.
    if (error) {
      const failure = classifyVerificationStartError(error)
      // Journalisé pour le cas INATTENDU seulement : une indisponibilité annoncée par
      // le serveur est un état prévu du parcours, pas un incident. Sans cette trace,
      // un échec de départ ne laissait rien nulle part (constat du 04.08.2026).
      if (failure === 'unexpected') {
        Sentry.captureMessage('kyb-identity-verify: la requête n\'est jamais partie', {
          level: 'warning',
          extra: { errorName: (error as { name?: string })?.name ?? null },
        })
      }
      return { url: null, failure }
    }
    // L'edge a noté l'identifiant de session sur la personne : la relire garde le
    // wizard cohérent si l'utilisateur revient sans passer par le return_url.
    await queryClient.invalidateQueries({ queryKey: personsQueryKey })
    // Une réponse 2xx sans URL ne devrait pas exister ; la traiter comme une
    // indisponibilité laisse le parcours continuer plutôt que de rendre un bouton mort.
    return typeof data?.url === 'string'
      ? { url: data.url, failure: null }
      : { url: null, failure: 'unavailable' }
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
    isRevalidating: personsFetching,
    savePerson,
    removePerson,
    uploadIdentityDocument,
    startIdentityVerification,
    submit,
    saveAgency,
    legalFormCategory,
  }
}
