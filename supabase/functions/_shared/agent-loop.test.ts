import { describe, it, expect, vi } from 'vitest'
import {
  SseDecoder, StreamAssembler, runAgentLoop,
  type ModelTurn, type LoopEvent, type LoopMessage,
} from './agent-loop'

// ─── SseDecoder ──────────────────────────────────────────────────────────────
describe('SseDecoder', () => {
  it('extrait un payload data: complet', () => {
    const d = new SseDecoder()
    expect(d.push('data: {"a":1}\n')).toEqual(['{"a":1}'])
  })
  it('recolle un payload coupé entre deux chunks', () => {
    const d = new SseDecoder()
    expect(d.push('data: {"a":')).toEqual([])
    expect(d.push('1}\n')).toEqual(['{"a":1}'])
  })
  it('ignore [DONE] et les lignes non-data', () => {
    const d = new SseDecoder()
    expect(d.push(': ping\ndata: [DONE]\ndata: {"b":2}\n')).toEqual(['{"b":2}'])
  })
  it('gère plusieurs événements dans un chunk', () => {
    const d = new SseDecoder()
    expect(d.push('data: {"a":1}\ndata: {"a":2}\n')).toEqual(['{"a":1}', '{"a":2}'])
  })
})

// ─── StreamAssembler ─────────────────────────────────────────────────────────
describe('StreamAssembler — réponse texte', () => {
  it('retient les premiers deltas puis stream (flush après le seuil)', () => {
    const asm = new StreamAssembler(3)
    expect(asm.feed({ content: 'a' })).toEqual([]) // held
    expect(asm.feed({ content: 'b' })).toEqual([]) // held
    const ev = asm.feed({ content: 'c' })           // seuil atteint → flush 'abc'
    expect(ev).toEqual([{ type: 'token', t: 'abc' }])
    expect(asm.feed({ content: 'd' })).toEqual([{ type: 'token', t: 'd' }])
    const fin = asm.finish()
    expect(fin.content).toBe('abcd')
    expect(fin.toolCalls).toEqual([])
    expect(fin.emitted).toBe(true)
  })
  it('texte court sous le seuil : rien émis en flux, tout lâché au finish', () => {
    const asm = new StreamAssembler(12)
    asm.feed({ content: 'court' })
    const fin = asm.finish()
    expect(fin.events).toEqual([{ type: 'token', t: 'court' }])
    expect(fin.content).toBe('court')
  })
})

describe('StreamAssembler — appel d\'outil', () => {
  it('assemble un tool_call fragmenté par index, aucun token émis', () => {
    const asm = new StreamAssembler(1)
    asm.feed({ tool_calls: [{ index: 0, id: 'c1', function: { name: 'get_mat' } }] })
    asm.feed({ tool_calls: [{ index: 0, function: { name: 'ches', arguments: '{"x":' } }] })
    asm.feed({ tool_calls: [{ index: 0, function: { arguments: '1}' } }] })
    const fin = asm.finish()
    expect(fin.toolCalls).toEqual([{ id: 'c1', name: 'get_matches', arguments: '{"x":1}' }])
    expect(fin.events).toEqual([]) // pas de texte
  })
  it('texte PUIS tool_call → événement reset', () => {
    const asm = new StreamAssembler(1)
    asm.feed({ content: 'oops' }) // flush immédiat (seuil 1)
    const ev = asm.feed({ tool_calls: [{ index: 0, id: 'c', function: { name: 'f' } }] })
    expect(ev).toEqual([{ type: 'reset' }])
    const fin = asm.finish()
    expect(fin.emitted).toBe(false) // reset annule l'émission
  })
  it('id manquant → id synthétique basé sur l\'index', () => {
    const asm = new StreamAssembler()
    asm.feed({ tool_calls: [{ index: 2, function: { name: 'f', arguments: '{}' } }] })
    expect(asm.finish().toolCalls[0].id).toBe('call_2')
  })
})

// ─── runAgentLoop ────────────────────────────────────────────────────────────
const READ = () => 'read'

function turn(content: string, toolCalls: ModelTurn['toolCalls'] = [], usage = { prompt_tokens: 5, completion_tokens: 7 }): ModelTurn {
  return { content, toolCalls, emitted: false, usage }
}

describe('runAgentLoop', () => {
  it('exécute un outil read puis rend la réponse finale', async () => {
    const calls: ModelTurn[] = [
      turn('', [{ id: 'c1', name: 'get_matches', arguments: '{"contact_id":"x"}' }]),
      turn('Voici tes 3 correspondances.'),
    ]
    let i = 0
    const runTool = vi.fn(async () => 'RESULTAT_OUTIL')
    const events: LoopEvent[] = []
    const res = await runAgentLoop({
      callModel: async () => calls[i++],
      runTool, tierOf: READ, emit: (e) => events.push(e),
    }, [{ role: 'user', content: 'quels biens pour x' }])

    expect(res.text).toBe('Voici tes 3 correspondances.')
    expect(runTool).toHaveBeenCalledTimes(1)
    expect(res.toolsUsed).toEqual([{ name: 'get_matches', ok: true }])
    expect(events).toContainEqual({ type: 'tool_start', name: 'get_matches', tier: 'read' })
    expect(events).toContainEqual({ type: 'tool_end', name: 'get_matches', ok: true })
    expect(res.usage.input).toBe(10) // 2 tours × 5
  })

  it('REFUSE un outil non-read (fail-safe read-only) sans l\'exécuter', async () => {
    const calls: ModelTurn[] = [
      turn('', [{ id: 'c1', name: 'send_client_message', arguments: '{}' }]),
      turn('Je ne peux pas envoyer, voici le brouillon.'),
    ]
    let i = 0
    const runTool = vi.fn(async () => 'NE_DOIT_PAS_TOURNER')
    const tierOf = (n: string) => (n === 'send_client_message' ? 'confirm' : 'read')
    const res = await runAgentLoop({
      callModel: async () => calls[i++], runTool, tierOf, emit: () => {},
    }, [{ role: 'user', content: 'envoie un message' }])

    expect(runTool).not.toHaveBeenCalled()
    expect(res.toolsUsed).toEqual([{ name: 'send_client_message', ok: false }])
    expect(res.text).toBe('Je ne peux pas envoyer, voici le brouillon.')
  })

  it('dédup : même outil+args deux fois dans le tour → exécuté une seule fois', async () => {
    const calls: ModelTurn[] = [
      turn('', [
        { id: 'a', name: 'get_matches', arguments: '{"contact_id":"x"}' },
        { id: 'b', name: 'get_matches', arguments: '{"contact_id":"x"}' },
      ]),
      turn('ok'),
    ]
    let i = 0
    const runTool = vi.fn(async () => 'R')
    const res = await runAgentLoop({
      callModel: async () => calls[i++], runTool, tierOf: READ, emit: () => {},
    }, [{ role: 'user', content: 'x' }])
    expect(runTool).toHaveBeenCalledTimes(1)
    expect(res.text).toBe('ok')
  })

  it('erreur modèle au 1er appel → degraded model_error', async () => {
    const res = await runAgentLoop({
      callModel: async () => null, runTool: async () => '', tierOf: READ, emit: () => {},
    }, [{ role: 'user', content: 'x' }])
    expect(res.degraded).toBe('model_error')
    expect(res.text).toBe('')
  })

  it('budget dépassé → passe finale forcée sans outils', async () => {
    let clock = 0
    const now = () => clock
    const callModel = vi.fn(async (_m: LoopMessage[], withTools: boolean) => {
      clock += 100 // chaque appel avance l'horloge
      if (withTools) return turn('', [{ id: 'c', name: 'get_matches', arguments: '{}' }])
      return turn('réponse forcée') // passe finale
    })
    const res = await runAgentLoop({
      callModel, runTool: async () => 'R', tierOf: READ, emit: () => {},
      budgetMs: 50, now, // budget minuscule → dépassé dès le 1er overBudget check du tour 2
    }, [{ role: 'user', content: 'x' }])
    expect(res.text).toBe('réponse forcée')
    expect(res.degraded).toBe('budget')
  })

  it('exécuteur qui jette → tool_end ok=false, boucle poursuit', async () => {
    const calls: ModelTurn[] = [
      turn('', [{ id: 'c', name: 'get_matches', arguments: '{}' }]),
      turn('malgré l\'erreur, voici ce que je sais.'),
    ]
    let i = 0
    const events: LoopEvent[] = []
    const res = await runAgentLoop({
      callModel: async () => calls[i++],
      runTool: async () => { throw new Error('boom') },
      tierOf: READ, emit: (e) => events.push(e),
    }, [{ role: 'user', content: 'x' }])
    expect(res.toolsUsed).toEqual([{ name: 'get_matches', ok: false }])
    expect(events).toContainEqual({ type: 'tool_end', name: 'get_matches', ok: false })
    expect(res.text).toContain('voici ce que je sais')
  })
})
