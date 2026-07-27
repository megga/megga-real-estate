/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — accès aux données.
 *
 * Lit `agencies` (via useAgencySettings, déjà câblé sur les colonnes KYB — on ne
 * réécrit pas un second chemin) et `agency_related_persons` + `agency_person_roles`
 * (personnes liées à l'agence et leurs rôles signatory/ubo), écrit les deux
 * dernières, et déclenche la RPC de soumission. Sous RLS `is_agency_admin()`
 * (20260726130200) : un agent simple qui appellerait ceci recevrait 42501.
 *
 * ⚠ N'écrit JAMAIS dans agency_verification_checks ni
 * agency_person_verification_checks — ces tables n'ont aucune policy INSERT
 * côté client (20260726130300), délibérément : seule une RPC SECURITY DEFINER
 * peut y poser un verdict, pour qu'un inscrit ne fabrique pas sa propre preuve
 * de vérification. Contrat écrit à la tâche 3 du plan étape 2, étendu par les
 * tâches 4 à 7 — les cinq champs ci-dessous (agency, persons, isLoading,
 * savePerson, removePerson, submit) ne changent jamais de signature.
 *
 * Toute la logique de décision (mapping des lignes DB, construction des payloads
 * d'écriture) vit dans des fonctions pures exportées ci-dessous, testées dans
 * tests/unit/useAgencyIdentity.spec.ts sans mock Supabase — même motif que
 * resolveIdentityGateStatus dans useIdentityGate.ts.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'

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
  persons: IdentityPersonWithRoles[]
  isLoading: boolean
  /** Insère (id=null) ou met à jour une personne + ses rôles. Renvoie l'id. */
  savePerson: (p: IdentityPerson, roles: IdentityRole[]) => Promise<string>
  removePerson: (id: string) => Promise<void>
  /** Appelle submit_agency_identity() (RPC, tâche 1). */
  submit: () => Promise<void>
}

// ─── Forme des lignes lues depuis Supabase (snake_case, roles imbriqués) ───────
export interface PersonRoleRow {
  id: string
  role: 'signatory' | 'ubo'
  signature_power: 'individual' | 'joint' | null
  ownership_pct: number | null
  pep_self_declared: boolean
  /** null = rôle courant. Une date passée = historisé (cf. valid_from/valid_to). */
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

/**
 * Ligne DB (personne + ses rôles imbriqués) -> forme du contrat du hook.
 * Ne garde QUE les rôles courants (valid_to null) : un rôle historisé n'est plus
 * ce que le wizard doit relire ou proposer de modifier — l'historique existe pour
 * l'audit LAB (agency_person_roles), pas pour l'écran de saisie.
 */
export function mapPersonRow(row: PersonRow): IdentityPersonWithRoles {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    roles: row.roles
      .filter((r) => r.valid_to === null)
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
 * Personnes liées à l'agence courante, avec leurs rôles courants (étape 2 KYB).
 * `agencyId` vient de profile.agency_id — RLS (is_agency_admin()) refuse de toute
 * façon la lecture à un agent simple, mais on évite déjà la requête inutile.
 */
export function useAgencyIdentity(): UseAgencyIdentityReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const queryClient = useQueryClient()
  const agencySettings = useAgencySettings()

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

  /** related_person_id + type de rôle -> id de la ligne agency_person_roles COURANTE, ou null. */
  const findActiveRoleId = async (relatedPersonId: string, role: IdentityRole['role']): Promise<string | null> => {
    const { data, error } = await supabase
      .from('agency_person_roles')
      .select('id')
      .eq('related_person_id', relatedPersonId)
      .eq('role', role)
      .is('valid_to', null)
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

  const submit = async (): Promise<void> => {
    const { error } = await supabase.rpc('submit_agency_identity')
    if (error) throw error
    // Contrat documenté dans useIdentityGate.ts : invalider CETTE clé avant toute
    // navigation vers /dashboard, sinon le gate relit l'ancien identity_submitted_at
    // (null) et renvoie l'utilisateur droit au gate qu'il vient de quitter — la
    // classe de bug de l'incident P0 c830f9a9.
    await queryClient.invalidateQueries({ queryKey: ['agency-identity-status', agencyId] })
  }

  return {
    agency: agencySettings.agency,
    persons: persons ?? [],
    isLoading: agencySettings.isLoading || personsLoading,
    savePerson,
    removePerson,
    submit,
  }
}
