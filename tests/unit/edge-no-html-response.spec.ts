/**
 * Aucune edge function ne sert de `text/html` — la plateforme le réécrirait en silence.
 *
 * POURQUOI CETTE PORTE. Sur le domaine par défaut `<ref>.supabase.co`, le gateway Supabase
 * réécrit tout `text/html` en `text/plain` et ajoute `content-security-policy: default-src
 * 'none'; sandbox` (« Serving of HTML content is only supported with custom domains »).
 * RIEN N'ÉCHOUE : la fonction rend 200, le déploiement est vert, les tests passent — et la
 * personne reçoit le SOURCE HTML en clair. C'est arrivé à `email-unsubscribe`, sur une page
 * légalement exigée, et seule une mesure du `content-type` en production l'a montré.
 *
 * Le jour où quelqu'un branchera un domaine personnalisé sur les edge functions, cette porte
 * devra être levée EXPLICITEMENT — c'est le but : que ce soit une décision, pas un oubli.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(process.cwd(), 'supabase/functions')

function sources(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...sources(p))
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p)
  }
  return out
}

/** Commentaires blanchis : `text/html` CITÉ dans une note n'est pas un en-tête servi. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/\/\/.*$/, (m) => ' '.repeat(m.length))).join('\n')
}

describe('edge functions — aucune ne prétend servir du HTML', () => {
  it('aucun `Content-Type: text/html` dans une réponse d’edge function', () => {
    const fautes: string[] = []
    for (const f of sources(RACINE)) {
      const txt = sansCommentaires(readFileSync(f, 'utf8'))
      for (const m of txt.matchAll(/['"]?[Cc]ontent-[Tt]ype['"]?\s*:\s*['"`]text\/html/g)) {
        fautes.push(`${f.slice(f.indexOf('supabase/'))}:${txt.slice(0, m.index).split('\n').length}`)
      }
    }
    // Le gateway le réécrirait en text/plain sans rien signaler : la fonction croirait
    // servir une page, la personne lirait du code source.
    expect(fautes, 'text/html servi depuis une edge function (réécrit en text/plain par la plateforme)')
      .toEqual([])
  })

  it('la page de désinscription sert du texte, et le dit', () => {
    const f = join(RACINE, 'email-unsubscribe/index.ts')
    const src = readFileSync(f, 'utf8')
    expect(src).toContain("'Content-Type': 'text/plain; charset=utf-8'")
    // La page reste CLOSE : celui qui vient de dire « ne m'écrivez plus » n'est pas
    // réengagé. Aucun lien de retour vers l'app dans le corps rendu.
    expect(sansCommentaires(src)).not.toMatch(/https?:\/\/(app\.)?megga\.ch/)
  })
})
