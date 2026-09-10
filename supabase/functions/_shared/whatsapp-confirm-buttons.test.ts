import { describe, it, expect } from 'vitest'
import {
  confirmReplyId, parseConfirmReplyId, resolveButtonDecision, planConfirmation,
  deliverConfirmation, type ConfirmSendOutcome,
} from './whatsapp-confirm-buttons'
import { BUTTONS_BODY_MAX } from './whatsapp-gateway'
import { t } from './whatsapp-i18n'
import { detectStopRequest } from './whatsapp-stop-keywords'
import type { OutboundPayload } from './whatsapp-outbound-guard'

const PA = '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b'
const AUTRE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

describe('identifiant de bouton de confirmation', () => {
  it('fait l’aller-retour pour oui comme pour non', () => {
    expect(confirmReplyId(PA, 'yes')).toBe(`pa:${PA}:yes`)
    expect(parseConfirmReplyId(confirmReplyId(PA, 'yes'))).toEqual({ pendingId: PA, choice: 'yes' })
    expect(parseConfirmReplyId(confirmReplyId(PA, 'no'))).toEqual({ pendingId: PA, choice: 'no' })
  })

  it('normalise la casse de l’uuid — Postgres le rend en minuscules', () => {
    expect(parseConfirmReplyId(`pa:${PA.toUpperCase()}:yes`)).toEqual({ pendingId: PA, choice: 'yes' })
  })

  it('refuse de fabriquer un identifiant qu’il ne saurait pas relire', () => {
    expect(() => confirmReplyId('pas-un-uuid', 'yes')).toThrow(RangeError)
  })

  it('rend null pour tout ce qui n’est pas exactement un bouton de confirmation', () => {
    for (const v of [null, undefined, '', 'STOP_PROMO', 'row_3', `pa:${PA}`, `pa:${PA}:maybe`,
      'pa:pas-un-uuid:yes', `xx:${PA}:yes`, ` pa:${PA}:yes`, `pa:${PA}:yes `,
      // Forme exacte seulement : le préfixe `pa:` et le choix `yes|no` sont en minuscules
      // strictes (plus de flag `i`) — un bouton qu'on émet nous-mêmes ne s'écrit jamais
      // autrement, et Meta renvoie l'id VERBATIM.
      `PA:${PA}:yes`, `pa:${PA}:YES`]) {
      expect(parseConfirmReplyId(v), String(v)).toBeNull()
    }
  })
})

describe('resolveButtonDecision — un bouton ne vaut que pour SON action', () => {
  it('le bon bouton décide oui ou non', () => {
    expect(resolveButtonDecision(`pa:${PA}:yes`, PA)).toBe('yes')
    expect(resolveButtonDecision(`pa:${PA}:no`, PA)).toBe('no')
  })

  it('un bouton d’une autre action est périmé : l’action qui attend n’est pas la sienne', () => {
    expect(resolveButtonDecision(`pa:${AUTRE}:yes`, PA)).toBe('stale')
  })

  it('un bouton sans action en attente est périmé (double appui, action expirée puis purgée)', () => {
    expect(resolveButtonDecision(`pa:${PA}:yes`, null)).toBe('stale')
    expect(resolveButtonDecision(`pa:${PA}:no`, undefined)).toBe('stale')
  })

  it('une réponse qui n’est pas un bouton de confirmation laisse le chemin tapé décider', () => {
    expect(resolveButtonDecision(null, PA)).toBeNull()
    expect(resolveButtonDecision('STOP_PROMO', PA)).toBeNull()
  })

  it('compare les uuid sans tenir compte de la casse', () => {
    expect(resolveButtonDecision(`pa:${PA}:yes`, PA.toUpperCase())).toBe('yes')
  })
})

describe('planConfirmation — un brouillon n’est jamais tronqué', () => {
  it('une question courte part en UN message, avec [Oui] [Non] liés à l’action', () => {
    const q = 'Je déplace Dubois en Négociation. Tu confirmes ? (« oui » / « non »)'
    expect(planConfirmation(q, PA, 'fr')).toEqual([{
      type: 'buttons',
      body: q,
      buttons: [{ id: `pa:${PA}:yes`, title: 'Oui' }, { id: `pa:${PA}:no`, title: 'Non' }],
    }])
  })

  it('les libellés suivent la langue', () => {
    const [m] = planConfirmation('Confirm?', PA, 'en')
    expect(m.type === 'buttons' ? m.buttons.map((b) => b.title) : null).toEqual(['Yes', 'No'])
  })

  it('à la limite exacte, un seul message', () => {
    expect(planConfirmation('a'.repeat(BUTTONS_BODY_MAX), PA, 'fr')).toHaveLength(1)
  })

  it('un caractère de trop : le texte complet d’abord, puis les boutons sous une question courte', () => {
    const long = 'a'.repeat(BUTTONS_BODY_MAX + 1)
    const plan = planConfirmation(long, PA, 'fr')
    expect(plan).toHaveLength(2)
    expect(plan[0]).toEqual({ type: 'text', body: long })   // intégral, jamais coupé
    expect(plan[1]).toEqual({
      type: 'buttons',
      body: t('fr', 'confirmShort'),
      buttons: [{ id: `pa:${PA}:yes`, title: 'Oui' }, { id: `pa:${PA}:no`, title: 'Non' }],
    })
  })

  it('mesure le texte tel qu’il PART, après la mise en forme de la garde', () => {
    // 1026 caractères bruts, 1024 une fois le gras Markdown converti en gras WhatsApp.
    const brut = `**${'a'.repeat(BUTTONS_BODY_MAX - 2)}**`
    expect(brut.length).toBe(BUTTONS_BODY_MAX + 2)
    expect(planConfirmation(brut, PA, 'fr')).toHaveLength(1)
  })

  it('mesure le texte FORMATÉ, pas le texte BRUT : un brut à la limite peut grandir en partant', () => {
    // `meggaProse` développe chaque tiret cadratin collé en ", " (2 caractères au lieu d'un) :
    // 512 tirets → +512 caractères. Brut = exactement 1024 (à la limite) ; formaté ≈ 1535
    // (1536 avant le nettoyage de l'espace de fin de chaîne). Une mesure sur le texte BRUT
    // dirait « ça tient » à tort — c'est tout l'objet de la note ⚠ au-dessus de la fonction.
    const brut = 'a—'.repeat(512)
    expect(brut.length).toBe(BUTTONS_BODY_MAX)
    const plan = planConfirmation(brut, PA, 'fr')
    expect(plan).toHaveLength(2)
    expect(plan[0]).toEqual({ type: 'text', body: brut })   // intégral, jamais reformaté ici
  })

  it('une question vide ne produit jamais un message à boutons sans corps', () => {
    expect(planConfirmation('', PA, 'fr')).toEqual([{
      type: 'buttons',
      body: t('fr', 'confirmShort'),
      buttons: [{ id: `pa:${PA}:yes`, title: 'Oui' }, { id: `pa:${PA}:no`, title: 'Non' }],
    }])
  })

  it('une question faite uniquement d’espaces se comporte comme une question vide', () => {
    // `meggaProse`/`toWhatsAppText` ne touchent pas les espaces internes purs : le texte
    // formaté reste non-vide en apparence ('\n\n') mais `.trim()` le révèle vide — même
    // chemin que la question vide, et le même résultat.
    expect(planConfirmation('\n\n', PA, 'fr')).toEqual(planConfirmation('', PA, 'fr'))
  })

  it('ce qui est RÉELLEMENT émis ne porte jamais un mot-clé STOP, dans aucune langue', () => {
    // ⛔ Le garde-fou de whatsapp-i18n.test.ts éprouve les CHAÎNES BRUTES (t(lang, 'btnYes'));
    // celui-ci éprouve la SORTIE de planConfirmation — ce que le webhook reçoit réellement au
    // clic — pour la même raison que §E préfère le vrai provider Meta à un faux qui ignore ses
    // arguments : la production ne roule jamais sur une string isolée.
    for (const lang of ['fr', 'en'] as const) {
      const plan = planConfirmation('Une question quelconque ?', PA, lang)
      for (const m of plan) {
        if (m.type !== 'buttons') continue
        for (const b of m.buttons) {
          expect(detectStopRequest(b.title), `${lang}/${b.title}`).toBeNull()
        }
      }
    }
  })
})

describe('deliverConfirmation — jamais de boutons sans la question', () => {
  const PROMPT = 'Tu confirmes ?'
  const BOUTONS_SEULS: OutboundPayload[] = [{
    type: 'buttons', body: PROMPT,
    buttons: [{ id: `pa:${PA}:yes`, title: 'Oui' }, { id: `pa:${PA}:no`, title: 'Non' }],
  }]
  // Plan DÉCOUPÉ (> BUTTONS_BODY_MAX) : [texte intégral, boutons sous une question courte] —
  // le même plan que produirait sendConfirmation en production pour un brouillon trop long.
  const LONG = 'a'.repeat(BUTTONS_BODY_MAX + 1)
  const DECOUPE = planConfirmation(LONG, PA, 'fr')

  /** Expéditeur factice : rend les issues SCRIPTÉES dans l’ordre des appels, et les enregistre. */
  function fakeSend(outcomes: ConfirmSendOutcome[]) {
    const calls: OutboundPayload[] = []
    let i = 0
    const send = async (payload: OutboundPayload): Promise<ConfirmSendOutcome> => {
      calls.push(payload)
      return outcomes[Math.min(i++, outcomes.length - 1)]
    }
    return { send, calls }
  }

  it('(a) boutons seuls, envoi ok : un seul envoi, aucun échec', async () => {
    const { send, calls } = fakeSend([{ ok: true }])
    const failures = await deliverConfirmation(BOUTONS_SEULS, PROMPT, send)
    expect(calls.map((c) => c.type)).toEqual(['buttons'])
    expect(failures).toEqual([])
  })

  it('(b) boutons seuls, échec HORS garde : repli en texte, l’échec des boutons est rendu', async () => {
    const { send, calls } = fakeSend([{ ok: false, blocked: false, error: 'panne meta' }, { ok: true }])
    const failures = await deliverConfirmation(BOUTONS_SEULS, PROMPT, send)
    expect(calls.map((c) => c.type)).toEqual(['buttons', 'text'])
    expect(calls[1]).toEqual({ type: 'text', body: PROMPT })
    expect(failures).toEqual([{ type: 'buttons', error: 'panne meta' }])
  })

  it('(c) boutons seuls, refusés par la GARDE : aucun repli, aucun échec rendu', async () => {
    const { send, calls } = fakeSend([{ ok: false, blocked: true }])
    const failures = await deliverConfirmation(BOUTONS_SEULS, PROMPT, send)
    expect(calls.map((c) => c.type)).toEqual(['buttons'])
    expect(failures).toEqual([])
  })

  it('(d) question découpée, les deux ok : texte puis boutons, dans l’ordre', async () => {
    const { send, calls } = fakeSend([{ ok: true }, { ok: true }])
    const failures = await deliverConfirmation(DECOUPE, LONG, send)
    expect(calls.map((c) => c.type)).toEqual(['text', 'buttons'])
    expect(failures).toEqual([])
  })

  it('(e) découpée, le texte échoue HORS garde : les boutons ne partent JAMAIS', async () => {
    const { send, calls } = fakeSend([{ ok: false, blocked: false, error: 'panne réseau' }])
    const failures = await deliverConfirmation(DECOUPE, LONG, send)
    expect(calls.map((c) => c.type)).toEqual(['text'])
    expect(failures).toEqual([{ type: 'text', error: 'panne réseau' }])
  })

  it('(f) découpée, texte parti, boutons en échec HORS garde : pas de 3e envoi (question déjà reçue)', async () => {
    const { send, calls } = fakeSend([{ ok: true }, { ok: false, blocked: false, error: 'panne boutons' }])
    const failures = await deliverConfirmation(DECOUPE, LONG, send)
    expect(calls.map((c) => c.type)).toEqual(['text', 'buttons'])
    expect(failures).toEqual([{ type: 'buttons', error: 'panne boutons' }])
  })

  it('(g) découpée, le texte est refusé par la GARDE : rien d’autre ne part', async () => {
    const { send, calls } = fakeSend([{ ok: false, blocked: true }])
    const failures = await deliverConfirmation(DECOUPE, LONG, send)
    expect(calls.map((c) => c.type)).toEqual(['text'])
    expect(failures).toEqual([])
  })
})
