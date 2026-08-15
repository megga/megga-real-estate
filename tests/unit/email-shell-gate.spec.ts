// La porte de la coquille d'e-mail, éprouvée comme du code.
//
// ⚠ Elle a laissé passer une coquille pendant tout le chantier : `useSendAgentEmail`
// fabriquait un document HTML d'e-mail dans le bundle NAVIGATEUR, et la porte ne scannait
// que `supabase/functions/`. Ces tests figent le périmètre corrigé — sans quoi rien
// n'empêche de le rétrécir à nouveau au premier faux positif venu.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function porte(): { code: number; sortie: string } {
  try {
    return { code: 0, sortie: execFileSync('node', ['scripts/check-email-shell.mjs'], { encoding: 'utf8' }) }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { code: err.status, sortie: `${err.stdout}${err.stderr}` }
  }
}

describe('lint:email-shell', () => {
  it('passe sur le dépôt, migration terminée', () => {
    const { code, sortie } = porte()
    expect(sortie).toContain('Migration terminée')
    expect(code).toBe(0)
  })

  it('⛔ scanne AUSSI src/ — c’est le trou qui a laissé vivre la quatorzième coquille', () => {
    const script = readFileSync('scripts/check-email-shell.mjs', 'utf8')
    expect(script).toContain("const SRC_DIR = 'src'")
    expect(script).toContain('fichiersTs(SRC_DIR)')
  })

  it('couvre les .tsx, pas seulement les .ts : le front compose en composants', () => {
    const script = readFileSync('scripts/check-email-shell.mjs', 'utf8')
    expect(script).toMatch(/\\\.tsx\?\$/)
  })

  it('la seule exception de src/ est la lettre A4, et elle porte sa raison', () => {
    const script = readFileSync('scripts/check-email-shell.mjs', 'utf8')
    expect(script).toContain('LetterReviewModal.tsx')
    expect(script).toContain('IMPRIMABLE')
  })

  it('⛔ le front n’envoie plus de HTML : il envoie le texte', () => {
    // La bascule qui rend la porte tenable côté navigateur. Si quelqu'un remet un
    // gabarit ici, la porte crie — mais autant dire aussi pourquoi.
    const hook = readFileSync('src/hooks/useSendAgentEmail.ts', 'utf8')
    expect(hook).toContain('data: { body }')
    expect(hook).not.toContain('DOCTYPE')
  })
})
