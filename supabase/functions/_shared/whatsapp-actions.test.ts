/**
 * Préparation des deux actions confirm qui visent une fiche — message client et pipeline —,
 * éprouvée sans base ni réseau.
 *
 * POURQUOI CE BANC EXISTE. Le 10.09.2026, le copilote a appelé send_client_message avec un
 * contact_id INVENTÉ (search_contacts sauté). La préparation ne lisait que le NOM de la fiche,
 * retombait sur « ce client » et stockait l'action ; l'agent a appuyé sur [Oui], l'exécuteur a
 * répondu « Contact introuvable dans ton agence ». Une préparation qui refuse ne rend ni
 * prompt ni payload : stashPending sort avant l'INSERT, il n'existe donc aucun identifiant
 * d'action auquel lier des boutons.
 *
 * La lecture passe par le client service-role (RLS contournée) : le `.eq('agency_id', …)` est
 * la seule garde de tenant. Le faux client ENREGISTRE chaque filtre pour qu'un test puisse la voir.
 */
import { describe, it, expect } from 'vitest'
import { prepareSendClientMessage, prepareUpdatePipeline, type ActionCtx } from './whatsapp-actions'
import { t, confirmSendClient, confirmUpdatePipeline, pipelineWhoNamed, type WaLang } from './whatsapp-i18n'
import { stageLabel } from './whatsapp-agent-router'

const AGENCY = 'a0000000-0000-4000-8000-000000000001'
const CONTACT = 'd166c3e7-0000-4000-8000-000000000002'

interface Harness {
  ctx: ActionCtx
  /** Chaque table interrogée, dans l'ordre. */
  tables: string[]
  /** Chaque `.eq(col, val)` observé, par table. */
  filtres: Array<{ table: string; col: string; val: unknown }>
}

/**
 * Faux client. `readError` RETOURNE `{ error }` — `supabase-js` ne jette pas, et un faux qui ne
 * sait que lever ne reproduirait pas la confusion panne/absence qu'on éprouve ici.
 */
function harness(o: {
  contact?: Record<string, unknown> | null
  readError?: string
  agencyId?: string | null
  lang?: WaLang
} = {}): Harness {
  const tables: string[] = []
  const filtres: Harness['filtres'] = []
  const contact = 'contact' in o
    ? o.contact
    : { id: CONTACT, first_name: 'Test', last_name: 'Boutous', phone: '+41 79 111 22 33' }
  const from = (table: string) => {
    tables.push(table)
    const self: Record<string, unknown> = {}
    self.select = () => self
    self.eq = (col: string, val: unknown) => { filtres.push({ table, col, val }); return self }
    self.maybeSingle = async () => (o.readError
      ? { data: null, error: { message: o.readError } }
      : { data: contact ?? null, error: null })
    return self
  }
  const ctx: ActionCtx = {
    supabase: { from } as never,
    profileId: 'p-1',
    agencyId: 'agencyId' in o ? (o.agencyId ?? null) : AGENCY,
    lang: o.lang ?? 'fr',
  }
  return { ctx, tables, filtres }
}

describe('prepareSendClientMessage — refuse avant la question ce que l’exécuteur refuserait après', () => {
  it('⛔ le cas du 10.09 : un contact_id qui ne désigne aucune fiche de l’agence ne produit plus de question', async () => {
    const h = harness({ contact: null })
    const p = await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'Bonjour, je me présente…' })
    // Ni prompt ni payload : stashPending sort sur `!p.ok`, avant l'INSERT — pas d'action, pas de bouton.
    expect(p).toEqual({ ok: false, error: t('fr', 'contactNotFoundSend') })
  })

  it('⛔ la lecture est FILTRÉE par agence — sans ce filtre, l’id d’une autre agence se ferait confirmer', async () => {
    const h = harness()
    await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'x' })
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'agency_id', val: AGENCY })
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'id', val: CONTACT })
  })

  it('un id vide, ou un nom passé en guise d’id, est refusé sans interroger la base', async () => {
    for (const contact_id of [undefined, '', '   ', 'Test Boutous', 42]) {
      const h = harness()
      const p = await prepareSendClientMessage(h.ctx, { contact_id, body: 'x' })
      expect(p, String(contact_id)).toEqual({ ok: false, error: t('fr', 'contactNotFoundSend') })
      expect(h.tables, String(contact_id)).toEqual([])
    }
  })

  it('une lecture EN ÉCHEC n’est pas une absence : « pas pour le moment », jamais « introuvable »', async () => {
    const h = harness({ readError: 'canceling statement due to statement timeout' })
    const p = await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'x' })
    expect(p).toEqual({ ok: false, error: t('fr', 'prepFail') })
  })

  it('une fiche sans numéro est refusée pour ce qu’elle est — pas « introuvable », elle existe', async () => {
    for (const phone of [null, '', '  ']) {
      const h = harness({ contact: { id: CONTACT, first_name: 'Test', last_name: 'Boutous', phone } })
      const p = await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'x' })
      expect(p, String(phone)).toEqual({ ok: false, error: t('fr', 'contactNoPhoneSend') })
    }
  })

  it('sans agence, rien n’est lu', async () => {
    const h = harness({ agencyId: null })
    const p = await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'x' })
    expect(p.ok).toBe(false)
    expect(h.tables).toEqual([])
  })

  it('une fiche joignable : la question nomme le prénom et montre le corps ENTIER, le payload est figé', async () => {
    const h = harness()
    const body = 'Bonjour Test, je suis votre agent chez MEGGA Agence.'
    // L'id tel que le modèle l'a écrit (espaces compris) : c'est celui de la FICHE qui est figé.
    const p = await prepareSendClientMessage(h.ctx, { contact_id: ` ${CONTACT} `, body, extra: 'ignoré' })
    expect(p).toEqual({ ok: true, prompt: confirmSendClient('fr', 'Test', body), payload: { contact_id: CONTACT, body } })
  })

  it('parle la langue de l’agent', async () => {
    const h = harness({ contact: null, lang: 'en' })
    const p = await prepareSendClientMessage(h.ctx, { contact_id: CONTACT, body: 'x' })
    expect(p).toEqual({ ok: false, error: t('en', 'contactNotFoundSend') })
  })
})

describe('prepareUpdatePipeline — même garde, pour un geste qui n’envoie rien', () => {
  it('⛔ un contact_id qui ne désigne aucune fiche de l’agence ne produit plus de question', async () => {
    const h = harness({ contact: null })
    const p = await prepareUpdatePipeline(h.ctx, { contact_id: CONTACT, stage: 'visit_planned' })
    expect(p).toEqual({ ok: false, error: t('fr', 'contactNotFoundPipeline') })
  })

  it('⛔ la lecture est FILTRÉE par agence', async () => {
    const h = harness()
    await prepareUpdatePipeline(h.ctx, { contact_id: CONTACT, stage: 'visit_planned' })
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'agency_id', val: AGENCY })
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'id', val: CONTACT })
  })

  it('un id vide ou qui n’est pas un uuid est refusé sans interroger la base', async () => {
    for (const contact_id of [undefined, '', 'Test Boutous']) {
      const h = harness()
      const p = await prepareUpdatePipeline(h.ctx, { contact_id, stage: 'visit_planned' })
      expect(p, String(contact_id)).toEqual({ ok: false, error: t('fr', 'contactNotFoundPipeline') })
      expect(h.tables, String(contact_id)).toEqual([])
    }
  })

  it('une lecture en échec n’est pas une absence', async () => {
    const h = harness({ readError: 'network' })
    const p = await prepareUpdatePipeline(h.ctx, { contact_id: CONTACT, stage: 'visit_planned' })
    expect(p).toEqual({ ok: false, error: t('fr', 'prepFail') })
  })

  it('une fiche sans numéro se déplace quand même : le pipeline n’écrit à personne', async () => {
    const h = harness({ contact: { id: CONTACT, first_name: 'Test', last_name: 'Boutous', phone: null } })
    const p = await prepareUpdatePipeline(h.ctx, { contact_id: CONTACT, stage: 'visit_planned' })
    expect(p.ok).toBe(true)
  })

  it('la question nomme le dossier et l’étape, le payload est figé', async () => {
    const h = harness()
    const p = await prepareUpdatePipeline(h.ctx, { contact_id: CONTACT, stage: 'visit_planned' })
    const prompt = confirmUpdatePipeline('fr', pipelineWhoNamed('fr', 'Test Boutous'), stageLabel('visit_planned', 'fr'))
    expect(p).toEqual({ ok: true, prompt, payload: { contact_id: CONTACT, stage: 'visit_planned' } })
  })
})
