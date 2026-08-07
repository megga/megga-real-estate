import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PERSONAL_DATA_ESTATE,
  ACCESS_TABLES,
  ERASURE_TABLES,
  undeclaredDivergences,
} from '../../supabase/functions/_shared/personal-data-estate'

// Garde-fou du constat F2 de l'audit RGPD du 06.08.2026 : `admin-dsar-export`
// (droit d'accès) et `delete-account` (droit à l'effacement) énuméraient leurs
// tables chacune de son côté et avaient DIVERGÉ — recoupement sur deux tables,
// désaccord sur tout le reste. Rien ne le montrait.
//
// Ce test ne demande PAS que les deux listes soient égales : certaines
// divergences sont correctes (la preuve d'effacement s'exporte mais ne s'efface
// pas). Il demande que chaque écart soit ÉCRIT, et que la déclaration ne dérive
// pas de ce que les deux fonctions font vraiment.

const ROOT = join(__dirname, '..', '..')

/** CRLF normalisé à la LECTURE — leçon de la PR #1177, où trois gardes
 *  rougissaient à tort sous Windows faute de l'avoir fait. */
function readSource(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8').replace(/\r\n/g, '\n')
}

const DSAR_SOURCE = readSource('supabase', 'functions', 'admin-dsar-export', 'index.ts')
const DELETE_SOURCE = readSource('supabase', 'functions', 'delete-account', 'index.ts')

/**
 * Cherche un ACCÈS RÉEL à la table, `.from('x')`, et non la simple présence du
 * nom : les deux fichiers citent ces tables dans leurs commentaires, et un garde
 * que satisfait un commentaire ne garde rien. Il resterait vert le jour où la
 * requête disparaît en laissant la prose derrière elle.
 */
function queriesTable(source: string, table: string): boolean {
  return source.includes(`.from('${table}')`)
}

describe('périmètre des données personnelles — accès et effacement', () => {
  it('déclare une raison écrite pour chaque écart entre accès et effacement', () => {
    const silent = undeclaredDivergences()
    expect(
      silent.map((e) => e.table),
      "Une table exportable mais jamais effacée doit dire au nom de quoi elle est conservée. " +
        "L'écart reste permis ; le silence ne l'est pas.",
    ).toEqual([])
  })

  it('exporte réellement chaque table déclarée accessible', () => {
    const missing = ACCESS_TABLES
      .map((e) => e.table)
      .filter((table) => !queriesTable(DSAR_SOURCE, table))
    expect(
      missing,
      'Déclarée exportable mais absente de admin-dsar-export : le registre promettrait un ' +
        "droit d'accès que le code ne rend pas.",
    ).toEqual([])
  })

  it('efface réellement chaque table déclarée effaçable', () => {
    const missing = ERASURE_TABLES
      .map((e) => e.table)
      .filter((table) => !queriesTable(DELETE_SOURCE, table))
    expect(
      missing,
      'Déclarée effaçable mais absente de delete-account : la PII survivrait au compte.',
    ).toEqual([])
  })

  it('couvre les deux tables dont l\'omission était le constat F2', () => {
    // Régression nommée : ce sont elles qui portaient la date de naissance, la
    // nationalité et le NUMÉRO de pièce d'un dirigeant, dans NI l'un NI l'autre
    // chemin. Un refactor qui les reperdrait doit échouer ici, pas en production.
    for (const table of ['agency_related_persons', 'onboarding_calls']) {
      const entry = PERSONAL_DATA_ESTATE.find((e) => e.table === table)
      expect(entry, `${table} doit être déclarée`).toBeDefined()
      expect(entry!.access, `${table} doit être exportable`).toBe(true)
      expect(entry!.erasure, `${table} ne doit pas être seulement conservée`).not.toBe('retain')
      expect(queriesTable(DSAR_SOURCE, table), `${table} doit être LU par admin-dsar-export`).toBe(true)
      expect(queriesTable(DELETE_SOURCE, table), `${table} doit être TRAITÉ par delete-account`).toBe(true)
    }
  })

  it('ne déclare aucune table dont MEGGA est sous-traitante', () => {
    // La ligne de partage est le RÔLE, pas « compte vs métier ». Les contacts CRM
    // et les dossiers KYC des parties appartiennent à l'agence : la personne y
    // exerce ses droits auprès d'elle (registre, activité n°2). Les faire entrer
    // ici ferait répondre MEGGA à la place du responsable du traitement.
    const processorEntries = PERSONAL_DATA_ESTATE.filter((e) => e.role === 'processor')
    expect(processorEntries.map((e) => e.table)).toEqual([])
  })

  it('ne conserve jamais la preuve d\'effacement comme une donnée effaçable', () => {
    const proof = PERSONAL_DATA_ESTATE.find((e) => e.table === 'agency_id_document_purges')
    expect(proof, 'le journal de purge doit être déclaré').toBeDefined()
    expect(proof!.access, 'la personne doit pouvoir apprendre que sa pièce a été détruite').toBe(true)
    expect(
      proof!.erasure,
      "Effacer la preuve d'effacement la supprime en tant que preuve — et c'est au moment où le " +
        'compte disparaît qu\'elle doit pouvoir être produite.',
    ).toBe('retain')
  })

  it('nomme une colonne de rattachement pour chaque table', () => {
    const orphans = PERSONAL_DATA_ESTATE.filter((e) => !e.subjectColumn?.trim())
    expect(
      orphans.map((e) => e.table),
      'Sans colonne de rattachement, une table est déclarée mais introuvable pour un sujet donné.',
    ).toEqual([])
  })
})
