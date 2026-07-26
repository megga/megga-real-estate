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
})
