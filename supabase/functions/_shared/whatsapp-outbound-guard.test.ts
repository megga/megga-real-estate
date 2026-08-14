// La garde d'envoi, éprouvée SANS base ni réseau.
//
// Ce qui se teste ici, et que seul un banc TS peut tenir : l'ORDRE des vérifications, ce
// que la garde JOURNALISE, le crochet de repli, et le sens dans lequel elle échoue quand
// elle ne sait pas. La décision de conformité elle-même vit en SQL et a son propre banc
// (tests/backend/whatsapp-consent-registry.spec.ts) — la dupliquer ici ne prouverait que
// la fidélité du mock.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendOutboundGuarded, needsOpenWindow, normalizeOutboundPhone, WINDOW_MARGIN_MINUTES,
  type SendOutboundArgs, type SendOutboundResult,
} from './whatsapp-outbound-guard'
import type { SendHttpRequest, WhatsAppProvider } from './whatsapp-gateway'

type Verdict = {
  allowed: boolean; reason: string; public_reason: string
  in_24h_window: boolean; legal_basis: string | null; subject_kind: string | null
}

const OK_VERDICT: Verdict = {
  allowed: true, reason: 'ok', public_reason: 'ok',
  in_24h_window: true, legal_basis: 'legitimate_interest', subject_kind: 'contact',
}

interface Harness {
  admin: SendOutboundArgs['admin']
  rpc: ReturnType<typeof vi.fn>
  inserted: Array<{ table: string; row: Record<string, unknown> }>
  upserted: Array<{ table: string; row: Record<string, unknown> }>
}

/** Faux client Supabase : seulement ce que la garde touche réellement. */
function harness(opts?: { verdict?: Verdict; killed?: boolean; rpcError?: string }): Harness {
  const inserted: Harness['inserted'] = []
  const upserted: Harness['upserted'] = []
  const rpc = vi.fn(async (name: string) => {
    if (name === 'whatsapp_send_allowed') {
      if (opts?.rpcError) return { data: null, error: { message: opts.rpcError } }
      return { data: [opts?.verdict ?? OK_VERDICT], error: null }
    }
    return { data: null, error: null }
  })
  const from = (table: string) => ({
    // isWhatsAppEnabled : app_config.whatsapp_enabled
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: opts?.killed ? 'false' : 'true' } }) }) }),
    insert: async (row: Record<string, unknown>) => { inserted.push({ table, row }); return { error: null } },
    upsert: async (row: Record<string, unknown>) => { upserted.push({ table, row }); return { error: null } },
  })
  return { admin: { from, rpc } as unknown as SendOutboundArgs['admin'], rpc, inserted, upserted }
}

const REQ: SendHttpRequest = {
  url: 'https://graph.facebook.com/v22.0/PNID/messages', method: 'POST', headers: {}, body: '{}',
}

function fakeProvider(sendOk = true): WhatsAppProvider & { built: string[] } {
  const built: string[] = []
  return {
    name: 'meta',
    built,
    parseInbound: () => null,
    buildSendTextRequest: () => { built.push('text'); return REQ },
    buildSendImageRequest: () => { built.push('image'); return REQ },
    buildSendDocumentRequest: () => { built.push('document'); return REQ },
    buildSendTemplateRequest: () => { built.push('template'); return REQ },
    parseSendResult: () => sendOk
      ? { ok: true, providerMessageId: 'wamid.OUT1' }
      : { ok: false, providerMessageId: null, error: 'Meta 131047' },
  } as unknown as WhatsAppProvider & { built: string[] }
}

const baseArgs = (h: Harness, over: Partial<SendOutboundArgs> = {}): SendOutboundArgs => ({
  admin: h.admin,
  provider: fakeProvider(),
  config: { metaToken: 'T', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
  to: '41791112233',
  purpose: 'service',
  payload: { type: 'text', body: 'bonjour' },
  contactId: 'c-1',
  agencyId: 'a-1',
  ...over,
})

const blockedResult = (r: SendOutboundResult) => r as Extract<SendOutboundResult, { blocked: true }>

beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 }))) })

describe('normalizeOutboundPhone / needsOpenWindow', () => {
  it('ne garde que les chiffres', () => {
    expect(normalizeOutboundPhone('+41 79 111 22 33')).toBe('41791112233')
    expect(normalizeOutboundPhone(null)).toBe('')
  })

  it('la fenêtre est exigée PAR DÉFAUT pour tout ce qui n’est pas un template', () => {
    // Un défaut qui échoue OUVERT sur une garde de conformité est le mauvais sens :
    // l'appelant distrait doit obtenir la règle, pas l'exception.
    expect(needsOpenWindow('text', undefined)).toBe(true)
    expect(needsOpenWindow('image', undefined)).toBe(true)
    expect(needsOpenWindow('document', undefined)).toBe(true)
    expect(needsOpenWindow('text', false)).toBe(false)   // levée EXPLICITE seulement
    // Le template EST le mécanisme prévu par Meta pour sortir de la fenêtre.
    expect(needsOpenWindow('template', undefined)).toBe(false)
    expect(needsOpenWindow('template', true)).toBe(false)
  })
})

describe('sendOutboundGuarded — l’ordre des vérifications', () => {
  it('un numéro hors bornes est refusé SANS aucun appel réseau ni RPC', async () => {
    const h = harness()
    const r = await sendOutboundGuarded(baseArgs(h, { to: '120363123456789012' }))
    expect(blockedResult(r).reason).toBe('invalid_phone')
    // La barrière la moins chère passe en premier : ni verdict, ni POST.
    expect(h.rpc).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('le kill-switch passe AVANT le registre', async () => {
    const h = harness({ killed: true })
    const r = await sendOutboundGuarded(baseArgs(h))
    expect(blockedResult(r).reason).toBe('kill_switch')
    // Gain réel du passage par la garde : whatsapp-agent-async et kyc-report-pdf sont les
    // deux seules fonctions du dépôt qui ne vérifiaient PAS le kill-switch.
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('le verdict du registre est demandé avec la marge de fenêtre', async () => {
    const h = harness()
    await sendOutboundGuarded(baseArgs(h))
    expect(h.rpc).toHaveBeenCalledWith('whatsapp_send_allowed', expect.objectContaining({
      p_wa_phone: '41791112233', p_purpose: 'service',
      p_contact_id: 'c-1', p_agency_id: 'a-1',
      p_window_margin_minutes: WINDOW_MARGIN_MINUTES,
    }))
  })

  it('un refus du registre ne devient JAMAIS un envoi', async () => {
    const h = harness({ verdict: {
      allowed: false, reason: 'phone_suppressed', public_reason: 'not_contactable',
      in_24h_window: false, legal_basis: null, subject_kind: 'contact',
    } })
    const r = await sendOutboundGuarded(baseArgs(h))
    const b = blockedResult(r)
    expect(b.blocked).toBe(true)
    expect(b.reason).toBe('phone_suppressed')
    // Le motif PRÉCIS est journalisé, l'EXPOSABLE est rendu : dire « phone_suppressed » à
    // l'agence B lui apprendrait qu'un numéro a écrit STOP à l'agence A.
    expect(b.publicReason).toBe('not_contactable')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('sendOutboundGuarded — la fenêtre 24 h et le repli', () => {
  const closed: Verdict = { ...OK_VERDICT, in_24h_window: false }

  it('hors fenêtre, un texte est refusé — et le repli template est PROPOSÉ avant le refus', async () => {
    // Sans ce crochet, refuser en amont du POST rendrait offerTemplateFallback du code
    // MORT : c'est le 131047 renvoyé par Meta qui le déclenche aujourd'hui, et l'agent
    // recevrait un refus sec à la place de la proposition.
    const h = harness({ verdict: closed })
    const onWindowClosed = vi.fn(async () => true)
    const r = await sendOutboundGuarded(baseArgs(h, { onWindowClosed }))
    const b = blockedResult(r)
    expect(b.reason).toBe('window_closed')
    expect(onWindowClosed).toHaveBeenCalledOnce()
    expect(b.fallbackOffered).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('un repli qui jette ne fait pas échouer la garde', async () => {
    const h = harness({ verdict: closed })
    const r = await sendOutboundGuarded(baseArgs(h, {
      onWindowClosed: async () => { throw new Error('boom') },
    }))
    expect(blockedResult(r).reason).toBe('window_closed')
    expect(blockedResult(r).fallbackOffered).toBe(false)
  })

  it('un TEMPLATE part hors fenêtre — c’est sa raison d’être', async () => {
    const h = harness({ verdict: closed })
    const provider = fakeProvider()
    const r = await sendOutboundGuarded(baseArgs(h, {
      provider, purpose: 'utility',
      payload: { type: 'template', message: { toPhone: '', templateName: 'megga_followup', languageCode: 'fr' } },
    }))
    expect(r.ok).toBe(true)
    expect(provider.built).toEqual(['template'])
  })

  it('requireWindow:false laisse passer un texte hors fenêtre, mais il faut l’ÉCRIRE', async () => {
    const h = harness({ verdict: closed })
    const r = await sendOutboundGuarded(baseArgs(h, { requireWindow: false }))
    expect(r.ok).toBe(true)
  })
})

describe('sendOutboundGuarded — ce qu’elle journalise', () => {
  it('un refus écrit une ligne d’audit, en category messaging et sans le numéro complet', async () => {
    // ⚠ L'assertion n'est PAS « ça ne jette pas » : le code d'origine avalait ses
    // violations de contrainte dans un catch, ce qui rendait l'audit silencieusement
    // inexistant. On compte les lignes.
    const h = harness({ verdict: {
      allowed: false, reason: 'do_not_contact', public_reason: 'not_contactable',
      in_24h_window: false, legal_basis: 'consent', subject_kind: 'contact',
    } })
    await sendOutboundGuarded(baseArgs(h))
    const events = h.inserted.filter((i) => i.table === 'activity_events')
    expect(events).toHaveLength(1)
    const e = events[0].row
    expect(e.action).toBe('whatsapp_send_blocked')
    expect(e.category).toBe('messaging')
    expect(e.severity).toBe('warn')
    expect(e.actor_kind).toBe('system')
    expect(e.actor_id).toBeNull()
    const meta = e.metadata as Record<string, unknown>
    expect(meta.reason).toBe('do_not_contact')
    expect(meta.purpose).toBe('service')
    expect(meta.payload_type).toBe('text')
    // activity_events est append-only et conservé dix ans : y recopier un numéro créerait
    // une seconde rétention, hors registre et hors DSAR.
    expect(meta.phone_tail).toBe('2233')
    expect(JSON.stringify(e)).not.toContain('41791112233')
  })

  it('un échec Meta est journalisé COMME UN ÉCHEC, pas comme un refus', async () => {
    // La distinction n'est pas cosmétique : l'alerte de livraison préviendrait l'agent d'un
    // « échec de livraison » pour un refus de consentement — un mensonge.
    const h = harness()
    const r = await sendOutboundGuarded(baseArgs(h, { provider: fakeProvider(false) }))
    expect(r.ok).toBe(false)
    expect((r as { blocked: boolean }).blocked).toBe(false)
    const events = h.inserted.filter((i) => i.table === 'activity_events')
    expect(events).toHaveLength(1)
    expect(events[0].row.action).toBe('whatsapp_send_failed')
  })

  it('un envoi réussi ne journalise RIEN — l’événement métier appartient au site d’appel', async () => {
    const h = harness()
    const r = await sendOutboundGuarded(baseArgs(h))
    expect(r.ok).toBe(true)
    expect(h.inserted.filter((i) => i.table === 'activity_events')).toHaveLength(0)
  })
})

describe('sendOutboundGuarded — persistance et jeton d’accusé', () => {
  it('le sortant est enregistré en « received », jamais en « sent »', async () => {
    // L'échelle est MONOTONE et allowedPriorStatuses('sent') vaut ['received'] : un sortant
    // inséré en 'sent' ne matcherait plus l'event `sent` de Meta.
    const h = harness()
    await sendOutboundGuarded(baseArgs(h))
    const rows = h.upserted.filter((u) => u.table === 'whatsapp_messages')
    expect(rows).toHaveLength(1)
    expect(rows[0].row).toMatchObject({
      direction: 'outbound', status: 'received', wa_to: '41791112233',
      contact_id: 'c-1', agency_id: 'a-1', provider_message_id: 'wamid.OUT1',
    })
  })

  it('isAgentError traverse jusqu’à la ligne — l’alerte de livraison le relit', async () => {
    const h = harness()
    await sendOutboundGuarded(baseArgs(h, { isAgentError: true, profileId: 'p-1', contactId: null }))
    expect(h.upserted[0].row).toMatchObject({ is_agent_error: true, contact_id: null })
  })

  it('un payload document non supporté par le provider est une ERREUR, pas un refus', async () => {
    // La distinction compte : « le provider ne sait pas » n'est pas « la personne a dit non ».
    const h = harness()
    const noDoc = { ...fakeProvider(), buildSendDocumentRequest: undefined } as unknown as WhatsAppProvider
    const r = await sendOutboundGuarded(baseArgs(h, {
      provider: noDoc, payload: { type: 'document', mediaId: 'M1', filename: 'r.pdf' },
    }))
    expect(r.ok).toBe(false)
    expect((r as { blocked: boolean }).blocked).toBe(false)
  })

  it('l’accusé de désinscription consomme son jeton, et SEULEMENT s’il est parti', async () => {
    const ok = harness({ verdict: { ...OK_VERDICT, reason: 'ok_opt_out_ack' } })
    await sendOutboundGuarded(baseArgs(ok, { purpose: 'opt_out_ack' }))
    expect(ok.rpc).toHaveBeenCalledWith('mark_suppression_ack_sent', { p_wa_phone: '41791112233' })

    // Envoi échoué : le jeton reste, pour qu'un second STOP puisse obtenir l'accusé.
    const ko = harness({ verdict: { ...OK_VERDICT, reason: 'ok_opt_out_ack' } })
    await sendOutboundGuarded(baseArgs(ko, { purpose: 'opt_out_ack', provider: fakeProvider(false) }))
    expect(ko.rpc).not.toHaveBeenCalledWith('mark_suppression_ack_sent', expect.anything())
  })
})

describe('sendOutboundGuarded — elle échoue FERMÉ', () => {
  it('un verdict indisponible n’autorise pas l’envoi', async () => {
    // Une garde qui laisse passer quand elle ne sait pas ne garde rien : la panne
    // deviendrait le chemin d'attaque.
    const h = harness({ rpcError: 'connection reset' })
    const r = await sendOutboundGuarded(baseArgs(h))
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('un verdict vide n’autorise pas l’envoi non plus', async () => {
    const h = harness()
    h.rpc.mockImplementation(async () => ({ data: [], error: null }))
    const r = await sendOutboundGuarded(baseArgs(h))
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
