/**
 * `selectReportRecipients` — à qui part le rapport hebdomadaire de la plateforme.
 *
 * POURQUOI CE BANC. Avant l'audit du 13.09.2026 (point S8), `weekly-report` envoyait les
 * métriques de TOUTE la plateforme à `profiles.email` de chaque titulaire du rôle
 * super_admin, allowlisté ou non. La règle est désormais celle d'`is_super_admin()` : rôle
 * ET e-mail d'AUTHENTIFICATION dans l'allowlist, en échouant fermé destinataire par
 * destinataire. Ces cas figent les trois propriétés qui la font tenir : le positif passe,
 * chaque échec écarte sans rien casser, et l'allowlist lit l'e-mail d'auth — jamais un autre.
 */
import { describe, it, expect } from 'vitest'
import { selectReportRecipients, type RecipientDeps } from '../../supabase/functions/_shared/weekly-report-recipients'

/** Quatre titulaires du rôle : A passe, B n'est pas allowlisté, C n'a pas d'e-mail d'auth, D fait lever l'allowlist. */
const AUTH: Record<string, string | null> = {
  a: 'alice@equipe.example',
  b: 'bob@ailleurs.example',
  c: null,
  d: 'dora@equipe.example',
}
const ALLOWLIST = new Set(['alice@equipe.example', 'dora@equipe.example'])

function deps(overrides: Partial<RecipientDeps> = {}): RecipientDeps & { interroges: string[] } {
  const interroges: string[] = []
  return {
    interroges,
    listSuperAdminIds: async () => ['a', 'b', 'c', 'd'],
    authEmailOf: async (id) => AUTH[id] ?? null,
    isAllowlisted: async (email) => {
      interroges.push(email)
      if (email.startsWith('dora@')) throw new Error('allowlist indisponible')
      return ALLOWLIST.has(email)
    },
    ...overrides,
  }
}

describe('selectReportRecipients — rôle ET allowlist, sur l’e-mail d’authentification', () => {
  it('ne retient que le titulaire allowlisté — B, C et D sont écartés, chacun pour sa raison', async () => {
    // A est le CONTRÔLE POSITIF : sans lui, un tableau vide rendrait ce test vert pour rien.
    expect(await selectReportRecipients(deps())).toEqual(['alice@equipe.example'])
  })

  it('interroge l’allowlist avec l’e-mail d’AUTH tel que rendu, jamais une autre valeur', async () => {
    const d = deps()
    await selectReportRecipients(d)
    // C (pas d'e-mail) n'est jamais soumis ; les trois autres le sont avec leur e-mail d'auth exact.
    expect(d.interroges).toEqual(['alice@equipe.example', 'bob@ailleurs.example', 'dora@equipe.example'])
  })

  it('une réponse d’allowlist qui n’est pas exactement `true` n’autorise personne', async () => {
    const vague = deps({ isAllowlisted: async () => 'true' as unknown as boolean })
    expect(await selectReportRecipients(vague)).toEqual([])
    // Contrôle positif : la même liste, avec un vrai `true`, passe.
    expect(await selectReportRecipients(deps({ isAllowlisted: async () => true }))).toEqual([
      'alice@equipe.example', 'bob@ailleurs.example', 'dora@equipe.example',
    ])
  })

  it('un e-mail d’auth introuvable (exception) écarte le titulaire, pas le lot', async () => {
    const d = deps({
      authEmailOf: async (id) => {
        if (id === 'b') throw new Error('auth.admin.getUserById a échoué')
        return AUTH[id] ?? null
      },
    })
    expect(await selectReportRecipients(d)).toEqual(['alice@equipe.example'])
  })

  it('déduplique sans égard à la casse, en gardant la première occurrence', async () => {
    const alias: Record<string, string> = {
      a: 'alice@equipe.example', a2: 'Alice@Equipe.EXAMPLE', a3: 'alice@equipe.example', b: 'bob@ailleurs.example',
    }
    const d = deps({
      listSuperAdminIds: async () => ['a', 'a2', 'a3', 'b'],
      authEmailOf: async (id) => alias[id] ?? null,
      isAllowlisted: async () => true,
    })
    expect(await selectReportRecipients(d)).toEqual(['alice@equipe.example', 'bob@ailleurs.example'])
  })

  it('aucun titulaire retenu ⇒ liste vide : l’appelant n’envoie rien', async () => {
    expect(await selectReportRecipients(deps({ isAllowlisted: async () => false }))).toEqual([])
    expect(await selectReportRecipients(deps({ listSuperAdminIds: async () => [] }))).toEqual([])
    // Contrôle positif : les mêmes accès, allowlist ouverte, retiennent quelqu'un.
    expect(await selectReportRecipients(deps({ isAllowlisted: async () => true }))).not.toEqual([])
  })

  it('une panne de LECTURE des titulaires remonte au lieu de se lire « aucun super-admin »', async () => {
    const d = deps({
      listSuperAdminIds: async () => {
        throw new Error('super_admin profiles: timeout')
      },
    })
    await expect(selectReportRecipients(d)).rejects.toThrow('timeout')
    // Et l'allowlist n'a été interrogée pour personne : rien n'a pu partir.
    expect(d.interroges).toEqual([])
    // Contrôle positif : une lecture qui aboutit interroge bien l'allowlist.
    const sain = deps()
    await selectReportRecipients(sain)
    expect(sain.interroges.length).toBeGreaterThan(0)
  })
})
