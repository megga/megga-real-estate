/**
 * Identité LBA d'un contact — conversion, validation et détection de changement.
 *
 * Ces 4 champs (naissance, nationalité, résidence, adresse) servent à l'identification
 * au sens LBA art. 3. Les modifier sur un contact dont le dossier KYC est `verified`
 * invalide la vérification : `hasIdentityChanged` est le point unique qui déclenche la
 * modale de consentement puis le downgrade verified→pending, côté modale de création
 * comme côté fiche. Ne pas dupliquer cette comparaison ailleurs — c'est elle qui garantit
 * qu'on n'oublie aucun champ (le bug de la v1 : seuls prénom/nom étaient comparés).
 *
 * La saisie se fait au format suisse JJ.MM.AAAA (design + CLAUDE.md §6) ; la base stocke
 * une `date` ISO. Les deux helpers ci-dessous sont la frontière entre les deux.
 */

/** Identité éditable d'un contact, telle que manipulée par l'UI (date au format suisse). */
export interface ContactIdentity {
  firstName: string
  lastName: string
  /** JJ.MM.AAAA, ou chaîne vide si non renseignée. */
  birth: string
  /** ISO 3166-1 alpha-2, ou chaîne vide. */
  nationality: string
  /** ISO 3166-1 alpha-2, ou chaîne vide. */
  residence: string
  homeAddress: string
}

const SWISS_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/

/**
 * JJ.MM.AAAA → `yyyy-mm-dd` pour la colonne `date`.
 * Renvoie `null` si le format est invalide OU si la date n'existe pas (31.02.1990) :
 * la contrainte CHECK en base rejetterait la ligne, autant filtrer côté client.
 */
export function parseSwissDate(input: string): string | null {
  const m = SWISS_DATE.exec(input.trim())
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)
  // Date.UTC normalise silencieusement (32 janvier → 1er février) : on relit les
  // composants pour rejeter ce que l'utilisateur n'a pas vraiment saisi.
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  if (year <= 1900 || d.getTime() > Date.now()) return null
  return `${yyyy}-${mm}-${dd}`
}

/** `yyyy-mm-dd` (ou timestamp) → JJ.MM.AAAA pour l'affichage et les champs de saisie. */
export function formatSwissDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

/** `true` si la saisie est non vide et non convertible — sert à afficher l'anneau d'erreur. */
export function isInvalidSwissDate(input: string): boolean {
  return input.trim().length > 0 && parseSwissDate(input) === null
}

/**
 * Vrai dès qu'un champ d'identification LBA diffère — donc que la vérification KYC
 * existante ne porte plus sur les mêmes données et doit repasser en `pending`.
 */
export function hasIdentityChanged(before: ContactIdentity, after: ContactIdentity): boolean {
  const keys: (keyof ContactIdentity)[] = [
    'firstName',
    'lastName',
    'birth',
    'nationality',
    'residence',
    'homeAddress',
  ]
  return keys.some((k) => (before[k] ?? '').trim() !== (after[k] ?? '').trim())
}

/** Colonnes `contacts` correspondantes, prêtes pour un insert/update Supabase. */
export function identityToColumns(identity: Pick<ContactIdentity, 'birth' | 'nationality' | 'residence' | 'homeAddress'>) {
  return {
    birth_date: parseSwissDate(identity.birth),
    nationality: identity.nationality || null,
    residence_country: identity.residence || null,
    home_address: identity.homeAddress.trim() || null,
  }
}
