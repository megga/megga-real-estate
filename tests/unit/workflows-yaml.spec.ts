/**
 * Garde-fou CI : tout fichier de `.github/workflows/` doit être un YAML valide.
 *
 * Pourquoi un test : `deploy.yml` ne se déclenche QUE sur un push vers `main`.
 * Sa syntaxe n'est donc jamais éprouvée par la CI d'une PR — un fichier invalide
 * passe tous les checks au vert, puis GitHub refuse de le parser au merge et le
 * déploiement (migrations + edge functions) ne tourne plus du tout. C'est arrivé
 * le 25 juil. 2026 : une chaîne shell multi-lignes dont le guillemet fermant
 * retombait en colonne 1 refermait le scalaire de bloc `run: |`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

const DIR = '.github/workflows'

describe('workflows GitHub Actions', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))

  it('le dossier contient bien des workflows (sinon le test ne prouve rien)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  for (const f of files) {
    it(`${f} est un YAML valide`, () => {
      const raw = readFileSync(join(DIR, f), 'utf-8')
      const doc = parse(raw)
      expect(doc, `${f} : document vide`).toBeTruthy()
      expect(doc.jobs, `${f} : aucune clé « jobs » — le fichier a probablement été tronqué par un scalaire de bloc mal fermé`).toBeTruthy()
    })
  }

  /**
   * `supabase/setup-cli` avec `version: latest` résout la dernière release par un appel
   * NON authentifié à l'API GitHub. Sous charge, l'IP partagée des runners atteint la limite
   * et le job meurt AVANT tout travail utile — trois fois le 02.08.2026, dont un déploiement
   * de production. L'action n'accepte pas de `token`, et `supabase` n'est pas une dépendance
   * du dépôt (omettre `version` retomberait donc sur `latest`) : l'épinglage est la seule
   * parade, et rien ne la protégeait.
   *
   * ⚠ Ce test lit l'ARBRE des workflows, pas leur texte : une occurrence dans un commentaire
   * (il y en a une au-dessus de chaque étape, qui explique pourquoi) ne doit pas le faire
   * rougir, et un `latest` réintroduit dans une étape doit le faire rougir même si un
   * commentaire voisin dit le contraire.
   */
  it('aucune étape setup-cli ne résout la version par le réseau', () => {
    const fautifs: string[] = []
    let etapes = 0

    for (const f of files) {
      const doc = parse(readFileSync(join(DIR, f), 'utf-8')) as {
        jobs?: Record<string, { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> }>
      }
      for (const [job, corps] of Object.entries(doc.jobs ?? {})) {
        for (const step of corps.steps ?? []) {
          if (!step.uses?.startsWith('supabase/setup-cli')) continue
          etapes++
          const v = step.with?.version
          if (typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v)) {
            fautifs.push(`${f} › ${job} : version=${JSON.stringify(v)}`)
          }
        }
      }
    }

    // Garde anti-contrôle creux : si plus aucune étape n'utilise l'action, ce test
    // passerait sans rien vérifier — le motif du vert sans assertion.
    expect(etapes, 'aucune étape supabase/setup-cli trouvée — ce contrôle ne prouve plus rien').toBeGreaterThanOrEqual(4)
    expect(
      fautifs,
      `version non épinglée sur ${fautifs.length} étape(s) :\n  ${fautifs.join('\n  ')}\n` +
        'Poser une version fixe (x.y.z) : `latest` résout par un appel API non authentifié qui ' +
        'tombe en rate limit sous charge et tue le job avant le premier test.',
    ).toEqual([])
  })
})
