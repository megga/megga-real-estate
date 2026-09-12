/**
 * Un outil confirm DÉCLARÉ a sa préparation et son exécuteur — sinon sa confirmation reste
 * promise à l'échec.
 *
 * POURQUOI CETTE PORTE. `CONFIRM_TOOLS` (dérivé du registre des tiers) est ce que stashPending
 * accepte de proposer à la confirmation ; un nom hors de ce registre est refusé avant la question.
 * Ce registre ne dit vrai que si les deux edge functions le suivent : un outil déclaré confirm
 * sans branche dans stashPending recevrait la question générique « Je vais effectuer cette
 * action », et sans branche dans executePending l'agent lirait unknownAction APRÈS avoir appuyé
 * sur [Oui]. Les deux fichiers montent `serve()` à l'import : on les lit, on ne les importe pas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFIRM_TOOLS } from '../../supabase/functions/_shared/whatsapp-agent-router'

/** Commentaires blanchis : un nom d'outil CITÉ dans une note n'est pas une branche. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/\/\/.*$/, (m) => ' '.repeat(m.length))).join('\n')
}

/** Corps d'une fonction de premier niveau : de sa signature à l'accolade fermante en colonne 0. */
function corps(fichier: string, signature: string): string {
  const src = sansCommentaires(readFileSync(join(process.cwd(), fichier), 'utf8'))
  const debut = src.indexOf(signature)
  if (debut < 0) throw new Error(`${signature} introuvable dans ${fichier}`)
  const fin = src.indexOf('\n}\n', debut)
  return src.slice(debut, fin < 0 ? undefined : fin + 2)
}

/** Une branche sur l'outil, en if/else (`=== 'x'`) comme en switch (`case 'x'`). */
const branche = (outil: string) => new RegExp(`(?:===\\s*|case\\s+)'${outil}'`)

describe('outils confirm déclarés — une préparation et un exécuteur chacun', () => {
  const stash = corps('supabase/functions/whatsapp-agent/index.ts', 'async function stashPending(')
  const execute = corps('supabase/functions/whatsapp-webhook/index.ts', 'async function executePending(')

  it('chaque outil confirm déclaré a sa préparation dans stashPending', () => {
    expect([...CONFIRM_TOOLS].filter((o) => !branche(o).test(stash))).toEqual([])
  })

  it('chaque outil confirm déclaré a son exécuteur dans executePending', () => {
    expect([...CONFIRM_TOOLS].filter((o) => !branche(o).test(execute))).toEqual([])
  })

  it('stashPending écarte un outil non déclaré AVANT de lire ou d’écrire une action en attente', () => {
    // Après l'INSERT, l'action aurait un identifiant, donc des boutons [Oui] [Non].
    const garde = stash.indexOf('CONFIRM_TOOLS.has(tool)')
    expect(garde).toBeGreaterThan(-1)
    expect(stash.indexOf('whatsapp_pending_actions')).toBeGreaterThan(garde)
  })
})
