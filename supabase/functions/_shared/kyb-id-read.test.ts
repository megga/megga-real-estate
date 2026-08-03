// Tests de la logique pure de la lecture assistée d'une pièce d'identité KYB.
// Aucun réseau, aucune clé, aucune horloge : `buildReadRecord` reçoit sa date du
// jour en paramètre, précisément pour que ces cas ne pourrissent pas tout seuls.

import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  compareName,
  compareBirthDate,
  normalizeExpiry,
  parseKybIdExtraction,
  mergeExtractions,
  deriveVerdict,
  buildReadRecord,
  KYB_ID_PROMPT,
  type KybIdExtraction,
} from './kyb-id-read.ts'

const DECLARED = { firstName: 'Grégory', lastName: 'Lyonnet', dateOfBirth: '1980-05-12' }

const FULL: KybIdExtraction = {
  lastName: 'LYONNET',
  firstName: 'GREGORY',
  dateOfBirth: '1980-05-12',
  expiresOn: '2030-04-30',
  documentType: 'id_card',
}

describe('KYB_ID_PROMPT — ce que le modèle a le droit de rendre', () => {
  it('interdit explicitement le numéro du document : c\'est la PII que le dépôt désigne comme sensible et que rien ne consomme', () => {
    expect(KYB_ID_PROMPT).toContain('Ne renvoie JAMAIS le numéro du document')
  })

  it('demande une sortie JSON stricte et interdit d\'inventer', () => {
    expect(KYB_ID_PROMPT).toContain('UNIQUEMENT un objet JSON valide')
    expect(KYB_ID_PROMPT).toContain('N\'invente jamais')
  })
})

describe('normalizeName — comparer des noms tels qu\'ils sont imprimés sur une pièce suisse', () => {
  it('retire les accents : la zone lisible par machine translittère, la zone imprimée non', () => {
    expect(normalizeName('Müller')).toBe('MULLER')
    expect(normalizeName('Grégory')).toBe('GREGORY')
    expect(normalizeName('Nuñez')).toBe('NUNEZ')
  })

  it('ramène tiret, apostrophe et points à l\'espace', () => {
    expect(normalizeName('Jean-Pierre')).toBe('JEAN PIERRE')
    expect(normalizeName("D'Amico")).toBe('D AMICO')
  })

  it('compacte les espaces et met en majuscules', () => {
    expect(normalizeName('  van   der  Berg ')).toBe('VAN DER BERG')
  })

  it('chaîne vide -> vide, jamais une exception', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName('   ')).toBe('')
  })
})

describe('compareName — exact / approx / differs / unreadable', () => {
  it('même nom à la casse et aux accents près -> exact', () => {
    expect(compareName('LYONNET', 'Lyonnet')).toBe('exact')
    expect(compareName('MULLER', 'Müller')).toBe('exact')
    expect(compareName('JEAN PIERRE', 'Jean-Pierre')).toBe('exact')
  })

  it('prénom composé dont un seul élément est déclaré -> approx, jamais differs : c\'est le cas le plus fréquent, pas une anomalie', () => {
    expect(compareName('JEAN PIERRE', 'Jean')).toBe('approx')
    expect(compareName('Jean', 'JEAN PIERRE')).toBe('approx')
  })

  it('nom double dont la pièce ne porte qu\'une partie (nom de naissance vs alliance) -> approx', () => {
    expect(compareName('DUPONT MARTIN', 'Dupont')).toBe('approx')
  })

  it('deux noms sans aucun mot commun -> differs', () => {
    expect(compareName('DUPONT', 'Lyonnet')).toBe('differs')
  })

  it('rien de lu, ou rien de déclaré -> unreadable : une absence n\'est pas un désaccord', () => {
    expect(compareName('', 'Lyonnet')).toBe('unreadable')
    expect(compareName('LYONNET', '')).toBe('unreadable')
    expect(compareName('---', 'Lyonnet')).toBe('unreadable')
  })
})

describe('compareBirthDate — aucune tolérance sur le jour', () => {
  it('dates identiques -> exact', () => {
    expect(compareBirthDate('1980-05-12', '1980-05-12')).toBe('exact')
  })

  it('jour différent -> differs : ce n\'est pas la même personne, jamais un « à peu près »', () => {
    expect(compareBirthDate('1980-05-13', '1980-05-12')).toBe('differs')
    expect(compareBirthDate('1981-05-12', '1980-05-12')).toBe('differs')
  })

  it('lecture au mois seul dont le mois concorde -> approx : le modèle n\'a pas pu trancher le jour', () => {
    expect(compareBirthDate('1980-05', '1980-05-12')).toBe('approx')
  })

  it('lecture au mois seul dont le mois diffère -> differs', () => {
    expect(compareBirthDate('1980-06', '1980-05-12')).toBe('differs')
  })

  it('date absente d\'un côté ou de l\'autre -> unreadable', () => {
    expect(compareBirthDate(null, '1980-05-12')).toBe('unreadable')
    expect(compareBirthDate('1980-05-12', null)).toBe('unreadable')
  })
})

describe('normalizeExpiry — une échéance au mois vaut jusqu\'à la FIN du mois', () => {
  it('date complète -> inchangée', () => {
    expect(normalizeExpiry('2030-04-17')).toBe('2030-04-17')
  })

  it('mois seul -> dernier jour du mois, jamais le premier : arrondir au premier déclarerait périmée une pièce encore valable un mois', () => {
    expect(normalizeExpiry('2030-04')).toBe('2030-04-30')
    expect(normalizeExpiry('2030-01')).toBe('2030-01-31')
  })

  it('février d\'une année bissextile -> 29, non bissextile -> 28', () => {
    expect(normalizeExpiry('2028-02')).toBe('2028-02-29')
    expect(normalizeExpiry('2030-02')).toBe('2030-02-28')
  })

  it('forme inexploitable ou mois hors bornes -> null, jamais une date reconstruite', () => {
    expect(normalizeExpiry('')).toBeNull()
    expect(normalizeExpiry('avril 2030')).toBeNull()
    expect(normalizeExpiry('2030-13')).toBeNull()
    expect(normalizeExpiry('2030-00')).toBeNull()
  })
})

describe('parseKybIdExtraction — tolérant : une lecture ratée dégrade, elle ne casse jamais un dépôt', () => {
  it('réponse complète', () => {
    const parsed = parseKybIdExtraction(
      '{"nom":"LYONNET","prenom":"GREGORY","naissance":"1980-05-12","expiration":"2030-04","type":"id_card"}',
    )
    expect(parsed).toEqual({
      lastName: 'LYONNET', firstName: 'GREGORY', dateOfBirth: '1980-05-12',
      expiresOn: '2030-04-30', documentType: 'id_card',
    })
  })

  it('champs vides (face qui ne les porte pas) -> chaînes vides et null, pas une erreur', () => {
    const parsed = parseKybIdExtraction('{"nom":"","prenom":"","naissance":"","expiration":"2030-04-17","type":""}')
    expect(parsed?.lastName).toBe('')
    expect(parsed?.dateOfBirth).toBeNull()
    expect(parsed?.expiresOn).toBe('2030-04-17')
    expect(parsed?.documentType).toBeNull()
  })

  it('{} (image qui n\'est pas une pièce d\'identité) -> tous les champs vides', () => {
    const parsed = parseKybIdExtraction('{}')
    expect(parsed).toEqual({ lastName: '', firstName: '', dateOfBirth: null, expiresOn: null, documentType: null })
  })

  it('type hors du vocabulaire du CHECK -> null, jamais une valeur que la colonne refuserait', () => {
    expect(parseKybIdExtraction('{"type":"permis_de_conduire"}')?.documentType).toBeNull()
    expect(parseKybIdExtraction('{"type":"other"}')?.documentType).toBeNull()
  })

  it('JSON invalide, tableau, ou null -> null (et non une exception)', () => {
    expect(parseKybIdExtraction('pas du json')).toBeNull()
    expect(parseKybIdExtraction('[]')).toBeNull()
    expect(parseKybIdExtraction('null')).toBeNull()
    expect(parseKybIdExtraction('')).toBeNull()
  })

  it('date de naissance de forme inattendue -> null, jamais reconstruite', () => {
    expect(parseKybIdExtraction('{"naissance":"12.05.1980"}')?.dateOfBirth).toBeNull()
  })
})

describe('mergeExtractions — sur une carte suisse, le nom est au recto et l\'échéance au dos', () => {
  const recto: KybIdExtraction = {
    lastName: 'LYONNET', firstName: 'GREGORY', dateOfBirth: '1980-05-12',
    expiresOn: null, documentType: 'id_card',
  }
  const verso: KybIdExtraction = {
    lastName: '', firstName: '', dateOfBirth: null, expiresOn: '2030-04-30', documentType: null,
  }

  it('complète les champs manquants d\'une face avec ceux de l\'autre', () => {
    expect(mergeExtractions([recto, verso])).toEqual({
      lastName: 'LYONNET', firstName: 'GREGORY', dateOfBirth: '1980-05-12',
      expiresOn: '2030-04-30', documentType: 'id_card',
    })
  })

  it('la PREMIÈRE face non vide gagne : deux faces qui se contredisent sont un cas pour l\'œil humain, pas pour une règle de départage', () => {
    const contradictory: KybIdExtraction = { ...verso, lastName: 'DUPONT' }
    expect(mergeExtractions([recto, contradictory])?.lastName).toBe('LYONNET')
  })

  it('faces illisibles (null) ignorées', () => {
    expect(mergeExtractions([null, verso])?.expiresOn).toBe('2030-04-30')
  })

  it('aucune face exploitable -> null', () => {
    expect(mergeExtractions([null, null])).toBeNull()
    expect(mergeExtractions([])).toBeNull()
  })
})

describe('deriveVerdict — l\'ordre des règles est le sujet', () => {
  it('les trois exacts -> match', () => {
    expect(deriveVerdict({ firstName: 'exact', lastName: 'exact', dateOfBirth: 'exact' })).toBe('match')
  })

  it('un seul differs suffit à faire mismatch, même entouré d\'exacts : un nom qui ne correspond pas n\'est pas rattrapé par une date qui correspond', () => {
    expect(deriveVerdict({ firstName: 'exact', lastName: 'differs', dateOfBirth: 'exact' })).toBe('mismatch')
  })

  it('un champ illisible empêche le match : une absence de preuve n\'est pas une concordance', () => {
    expect(deriveVerdict({ firstName: 'exact', lastName: 'exact', dateOfBirth: 'unreadable' })).toBe('partial')
  })

  it('un approx suffit à faire partial', () => {
    expect(deriveVerdict({ firstName: 'approx', lastName: 'exact', dateOfBirth: 'exact' })).toBe('partial')
  })

  it('tout illisible -> unreadable, distinct de mismatch : rien n\'a été lu, rien ne contredit', () => {
    expect(deriveVerdict({ firstName: 'unreadable', lastName: 'unreadable', dateOfBirth: 'unreadable' })).toBe('unreadable')
  })
})

describe('buildReadRecord — la ligne persistée', () => {
  it('pièce concordante et encore valable', () => {
    const record = buildReadRecord(FULL, DECLARED, 'id_card', '2026-08-03')
    expect(record.verdict).toBe('match')
    expect(record.expiresOn).toBe('2030-04-30')
    expect(record.expired).toBe(false)
    expect(record.documentTypeMatches).toBe(true)
    expect(record.model).toBe('gemini-2.5-flash-lite')
  })

  it('pièce PÉRIMÉE : signalée, mais le verdict de concordance reste indépendant — une pièce expirée peut appartenir à la bonne personne', () => {
    const record = buildReadRecord({ ...FULL, expiresOn: '2024-01-31' }, DECLARED, 'id_card', '2026-08-03')
    expect(record.expired).toBe(true)
    expect(record.verdict).toBe('match')
  })

  it('le jour de l\'échéance lui-même compte comme valable', () => {
    expect(buildReadRecord({ ...FULL, expiresOn: '2026-08-03' }, DECLARED, 'id_card', '2026-08-03').expired).toBe(false)
    expect(buildReadRecord({ ...FULL, expiresOn: '2026-08-02' }, DECLARED, 'id_card', '2026-08-03').expired).toBe(true)
  })

  it('aucune échéance lisible -> expired null, jamais false : ne pas savoir n\'est pas « valable »', () => {
    const record = buildReadRecord({ ...FULL, expiresOn: null }, DECLARED, 'id_card', '2026-08-03')
    expect(record.expiresOn).toBeNull()
    expect(record.expired).toBeNull()
  })

  it('nature lue différente de la nature déclarée -> documentTypeMatches false (un passeport déposé sous « carte d\'identité »)', () => {
    const record = buildReadRecord({ ...FULL, documentType: 'passport' }, DECLARED, 'id_card', '2026-08-03')
    expect(record.documentTypeMatches).toBe(false)
  })

  it('nature illisible, ou dossier antérieur au 03.08.2026 sans nature déclarée -> null, jamais false', () => {
    expect(buildReadRecord({ ...FULL, documentType: null }, DECLARED, 'id_card', '2026-08-03').documentTypeMatches).toBeNull()
    expect(buildReadRecord(FULL, DECLARED, null, '2026-08-03').documentTypeMatches).toBeNull()
  })

  it('pièce d\'une AUTRE personne -> mismatch, le cas que toute cette lecture existe pour attraper', () => {
    const record = buildReadRecord(
      { ...FULL, lastName: 'DUPONT', firstName: 'JEAN', dateOfBirth: '1975-11-02' },
      DECLARED, 'id_card', '2026-08-03',
    )
    expect(record.verdict).toBe('mismatch')
    expect(record.fields).toEqual({ firstName: 'differs', lastName: 'differs', dateOfBirth: 'differs' })
  })

  it('extraction nulle (photo floue, document non reconnu) -> unreadable de bout en bout, jamais un mismatch accusateur', () => {
    const record = buildReadRecord(null, DECLARED, 'id_card', '2026-08-03')
    expect(record.verdict).toBe('unreadable')
    expect(record.expired).toBeNull()
  })

  it('la ligne persistée ne contient AUCUN nom ni prénom lu : minimisation LPD, le relecteur a l\'image', () => {
    const record = buildReadRecord(FULL, DECLARED, 'id_card', '2026-08-03')
    const serialized = JSON.stringify(record)
    expect(serialized).not.toContain('LYONNET')
    expect(serialized).not.toContain('GREGORY')
    expect(serialized).not.toContain('1980-05-12')
  })
})
