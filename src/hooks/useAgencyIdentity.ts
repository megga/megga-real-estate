/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — accès aux données.
 *
 * Lit ET écrit `agencies` (via useAgencySettings, déjà câblé sur les colonnes KYB —
 * on ne réécrit pas un second chemin ; saveAgency délègue directement à son save())
 * et `agency_related_persons` + `agency_person_roles` (personnes liées à l'agence et
 * leurs rôles signatory/ubo), écrit ces deux dernières, et déclenche la RPC de
 * soumission. Sous RLS `is_agency_admin()` (20260726130200) : un agent simple qui
 * appellerait ceci recevrait 42501.
 *
 * ⚠ N'écrit JAMAIS dans agency_verification_checks ni
 * agency_person_verification_checks — ces tables n'ont aucune policy INSERT
 * côté client (20260726130300), délibérément : seule une RPC SECURITY DEFINER
 * peut y poser un verdict, pour qu'un inscrit ne fabrique pas sa propre preuve
 * de vérification. Contrat écrit à la tâche 3 du plan étape 2, étendu par les
 * tâches 4 à 7 — les six champs d'origine (agency, persons, isLoading, savePerson,
 * removePerson, submit) ne changent jamais de signature ; la tâche 4 y ajoute
 * saveAgency (écriture agence, étape 2) et legalFormCategory (catégorie de la forme
 * juridique COURANTE de l'agence, dérivée ici pour que la tâche 5 — étape 3,
 * bénéficiaires effectifs — n'ait qu'à la lire plutôt que de refaire la résolution
 * pays -> useLegalForms -> option elle-même).
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
  persons: IdentityPersonWithRoles[]
  isLoading: boolean
  /** Insère (id=null) ou met à jour une personne + ses rôles. Renvoie l'id. */
  savePerson: (p: IdentityPerson, roles: IdentityRole[]) => Promise<string>
  removePerson: (id: string) => Promise<void>
  /** Appelle submit_agency_identity() (RPC, tâche 1). */
  submit: () => Promise<void>
  /**
   * Persiste l'étape 2 (agence) — délègue à useAgencySettings().save(), donc AUCUN
   * second chemin d'écriture vers `agencies`. L'appelant doit fournir l'objet complet
   * (étaler `agency` courant puis écraser les champs édités), pas un patch partiel :
   * save() écrit toutes les colonnes de AgencySettingsData à chaque appel.
   */
  saveAgency: (next: AgencySettingsData) => Promise<void>
  /**
   * Catégorie de la forme juridique COURANTE (agency.legalFormId), ou null tant
   * qu'aucune forme n'est choisie / pas encore chargée. La tâche 5 (étape 3) la lit
   * pour décider si l'étape bénéficiaires effectifs doit s'afficher :
   * sole_proprietorship = le signataire EST l'entité, aucun tiers à déclarer.
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
 * (supabase/migrations/20260727100000_submit_agency_identity.sql, comparaison
 * stricte). `valid_to` est une colonne `date`, pas `timestamptz` : comparaison sur
 * la date seule, jamais l'heure.
 *
 * mapPersonRow et findActiveRoleId (ci-dessous) passent TOUS DEUX par cette fonction
 * plutôt que de retester `valid_to === null` chacun de leur côté — c'était déjà le
 * bug (revue tâche 3) : un rôle à valid_to futur (que le schéma autorise
 * explicitement) était invisible ici alors que la RPC le compte comme actif.
 * Conséquence concrète : savePerson ne retrouvait pas la ligne active existante, en
 * insérait une seconde, que l'index partiel idx_agency_person_roles_active_unique ne
 * bloque pas puisqu'il ne couvre que `valid_to is null` (20260726130200) — deux
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
 * Personnes liées à l'agence courante, avec leurs rôles courants (étape 2 KYB).
 * `agencyId` vient de profile.agency_id — RLS (is_agency_admin()) refuse de toute
 * façon la lecture à un agent simple, mais on évite déjà la requête inutile.
 */
export function useAgencyIdentity(): UseAgencyIdentityReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const queryClient = useQueryClient()
  const agencySettings = useAgencySettings()
  // Pays COURANT (persisté), pas le brouillon en cours de saisie à l'étape 2 :
  // legalFormCategory doit refléter ce qui est réellement en base, exactement ce
  // que la tâche 5 lira. StepAgence appelle useLegalForms(country) séparément pour
  // peupler son propre menu sur le brouillon live — les deux appels partagent le
  // cache React Query dès que les codes pays coïncident.
  const legalForms = useLegalForms(agencySettings.agency.country)
  const legalFormCategory = resolveLegalFormCategory(agencySettings.agency.legalFormId, legalForms.options)

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
      // que `valid_to is null` (20260726130200), donc rien n'empêche en base deux
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
    saveAgency: agencySettings.save,
    legalFormCategory,
  }
}
