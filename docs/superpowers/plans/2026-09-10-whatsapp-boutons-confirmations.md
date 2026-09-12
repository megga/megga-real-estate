# WhatsApp — Boutons de réponse et confirmations du copilote — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Avant de commencer** : lire la spec
> [2026-09-10-whatsapp-boutons-confirmations-design.md](../specs/2026-09-10-whatsapp-boutons-confirmations-design.md)
> en entier — §2 (pourquoi le bouton porte l'identifiant de son action) et §4 (les deux pièges)
> surtout. Ce plan ne les répète pas.
>
> Branche : `claude/whatsapp-no-response-diagnostic-fd6bd7`. Un commit par tâche.
> Toute commande se lance depuis la racine du worktree.

**Goal:** Quand le copilote WhatsApp demande une confirmation, l'agent reçoit [Oui] [Non] ; chaque bouton porte l'identifiant de l'action qu'il confirme, et un bouton périmé est refusé sans rien consommer.

**Architecture:** Un constructeur Meta `interactive/button` et la lecture de `replyId` dans la gateway ; un module PUR `whatsapp-confirm-buttons.ts` (identifiant `pa:<uuid>:yes|no`, découpage à 1024 caractères, décision à la réception) ; un type d'envoi `buttons` dans la garde ; le copilote renvoie l'identifiant de l'action stockée, et le webhook rend la question avec ses boutons puis décide sur l'appui. Aucune migration.

**Tech Stack:** Deno (edge functions Supabase), TypeScript, Vitest (modules `_shared` purs), `deno check`, API WhatsApp Cloud (Meta) v22.0.

---

## Règles du lot (elles viennent de pièges déjà payés)

1. **Tests d'abord.** Chaque tâche de module pur commence par un test qui rougit.
2. ⚠ **Vitest ne découvre PAS les tests de `supabase/functions/_shared/`** : ils sont listés en dur
   dans `vitest.config.ts`. Un nouveau fichier de test non ajouté à la liste ne tourne jamais — et la
   suite reste verte. Task 4 l'ajoute.
3. ⚠ **`tsc -b` ne vérifie pas les edge functions.** Le seul filet de type côté Deno est `deno check`
   (bloquant en CI, `unit-tests.yml`). Toute tâche qui touche un `index.ts` d'edge function se termine
   par un `deno check`.
4. ⛔ **Aucun libellé de bouton ne doit être un mot-clé STOP** (`whatsapp-stop-keywords.ts`) : un appui
   dessus vaut désinscription par bouton, avant même la branche agent. « Cancel » en est un. Task 3 le
   verrouille par un test.
5. **Tout envoi passe par `sendOutboundGuarded`, avec un littéral d'objet et une finalité littérale**
   (`purpose: 'service'`) : la porte `npm run lint:whatsapp-outbound` refuse le reste.
6. **Le texte des questions ne change pas.** On ne touche à aucun prompt de confirmation existant : les
   boutons s'AJOUTENT, et le même texte sert de repli.
7. **Ne pas merger.** Merger `main` déploie les fonctions edge en production ; c'est la décision de Julien.

## Fichiers du lot

| Fichier | Rôle dans ce lot |
|---|---|
| `supabase/functions/_shared/whatsapp-gateway.ts` | Modifié — `OutboundButtonsMessage`, limites Meta, `buildSendButtonsRequest` ; `replyId` à la réception |
| `supabase/functions/_shared/whatsapp-gateway.test.ts` | Modifié — constructeur, limites, `replyId` |
| `supabase/functions/_shared/whatsapp-i18n.ts` | Modifié — `btnYes`, `btnNo`, `confirmShort`, `staleButton` |
| `supabase/functions/_shared/whatsapp-i18n.test.ts` | Modifié — longueur, parité, **garde STOP** |
| `supabase/functions/_shared/whatsapp-confirm-buttons.ts` | **Créé** — identifiant, découpage, décision (pur) |
| `supabase/functions/_shared/whatsapp-confirm-buttons.test.ts` | **Créé** |
| `vitest.config.ts` | Modifié — inclusion du nouveau test |
| `supabase/functions/_shared/whatsapp-outbound-guard.ts` | Modifié — type d'envoi `buttons` |
| `supabase/functions/_shared/whatsapp-outbound-guard.test.ts` | Modifié — fenêtre, construction, corps journalisé |
| `scripts/check-whatsapp-outbound.mjs` | Modifié — `buildSend\w*Request`, sans point (revue 6 à 9) |
| `supabase/functions/whatsapp-agent/index.ts` | Modifié — `confirmPendingId` dans la réponse |
| `supabase/functions/whatsapp-webhook/index.ts` | Modifié — `sendConfirmation`, décision sur l'appui |
| `.claude-flow/knowledge/megga-memory.seed.json` | Modifié — entrée cerveau `megga/whatsapp-confirm-buttons` |

---

### Task 1 : Gateway — message sortant à boutons

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-gateway.ts`
- Test: `supabase/functions/_shared/whatsapp-gateway.test.ts`

- [ ] **Step 1 : écrire le test qui rougit**

Dans `whatsapp-gateway.test.ts`, remplacer la ligne d'import (ligne 2) :

```ts
import { getProvider, verifyHmac, constantTimeEqual, allowedPriorStatuses, isDialablePhone, PHONE_MIN_DIGITS, PHONE_MAX_DIGITS, type NormalizedInboundMessage } from './whatsapp-gateway'
```

par :

```ts
import {
  getProvider, verifyHmac, constantTimeEqual, allowedPriorStatuses, isDialablePhone, PHONE_MIN_DIGITS, PHONE_MAX_DIGITS,
  BUTTONS_MAX, BUTTON_TITLE_MAX, BUTTON_ID_MAX, BUTTONS_BODY_MAX,
  type NormalizedInboundMessage, type OutboundButtonsMessage,
} from './whatsapp-gateway'
```

Puis ajouter à la FIN du fichier :

```ts
describe('Meta buildSendButtonsRequest — boutons de réponse', () => {
  const meta = getProvider('meta')
  const config = { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' }
  const OUI_NON = [{ id: 'pa:x:yes', title: 'Oui' }, { id: 'pa:x:no', title: 'Non' }]
  const build = (over: Partial<OutboundButtonsMessage> = {}) =>
    meta.buildSendButtonsRequest!({ toPhone: '41791112233', body: 'Tu confirmes ?', buttons: OUI_NON, ...over }, config)

  it('construit un message interactif de type button, boutons dans l’ordre', () => {
    expect(meta.buildSendButtonsRequest).toBeDefined()
    const req = build()
    expect(req.url).toBe('https://graph.facebook.com/v22.0/PNID/messages')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    expect(JSON.parse(req.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '41791112233',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Tu confirmes ?' },
        action: { buttons: [
          { type: 'reply', reply: { id: 'pa:x:yes', title: 'Oui' } },
          { type: 'reply', reply: { id: 'pa:x:no', title: 'Non' } },
        ] },
      },
    })
  })

  it('accepte exactement les bornes de Meta', () => {
    const buttons = Array.from({ length: BUTTONS_MAX }, (_, i) => ({
      id: `${i}`.padEnd(BUTTON_ID_MAX, 'x'), title: `${i}`.padEnd(BUTTON_TITLE_MAX, 'y'),
    }))
    expect(() => build({ body: 'z'.repeat(BUTTONS_BODY_MAX), buttons })).not.toThrow()
  })

  // Lever ICI plutôt que laisser Meta répondre 400 : la garde rend un échec de construction,
  // et l'appelant retombe sur le texte sans aller-retour réseau.
  it('refuse ce que Meta refuserait', () => {
    const trop = Array.from({ length: BUTTONS_MAX + 1 }, (_, i) => ({ id: `b${i}`, title: `B${i}` }))
    expect(() => build({ buttons: [] })).toThrow(RangeError)
    expect(() => build({ buttons: trop })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: 'a', title: 'y'.repeat(BUTTON_TITLE_MAX + 1) }] })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: 'a', title: '' }] })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: 'x'.repeat(BUTTON_ID_MAX + 1), title: 'A' }] })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: '', title: 'A' }] })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: 'a', title: 'A' }, { id: 'a', title: 'B' }] })).toThrow(RangeError)
    expect(() => build({ buttons: [{ id: 'a', title: 'A' }, { id: 'b', title: 'A' }] })).toThrow(RangeError)
    expect(() => build({ body: '' })).toThrow(RangeError)
    expect(() => build({ body: 'z'.repeat(BUTTONS_BODY_MAX + 1) })).toThrow(RangeError)
  })
})
```

- [ ] **Step 2 : le lancer, il doit rougir**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: FAIL — les 3 nouveaux tests échouent (`buildSendButtonsRequest` indéfini, constantes `undefined`).

- [ ] **Step 3 : l'implémentation**

Dans `whatsapp-gateway.ts`, insérer entre la fin de `OutboundTemplateMessage` et `export interface SendConfig {` — remplacer :

```ts
  otpButtonCode?: string
}

export interface SendConfig {
```

par :

```ts
  otpButtonCode?: string
}

/**
 * Message à BOUTONS DE RÉPONSE (Meta `interactive` / `button`) : jusqu'à trois boutons sous
 * un texte. Message libre, donc réservé à la fenêtre de service 24 h — comme un texte.
 *
 * `id` revient tel quel dans la réponse (`button_reply.id`) quand la personne appuie : c'est
 * lui, et non le libellé, qui dit à quoi le bouton se rapporte. Un bouton reste dans la
 * conversation ; son libellé seul ne dit pas sous quelle question il a été touché.
 */
export interface OutboundButtonsMessage {
  toPhone: string                                  // digits only, international sans +
  body: string                                     // texte affiché au-dessus des boutons
  buttons: Array<{ id: string; title: string }>
}

/** Limites Meta d'un message à boutons. Au-delà, l'API refuse l'envoi. */
export const BUTTONS_MAX = 3
export const BUTTON_TITLE_MAX = 20
export const BUTTON_ID_MAX = 256
export const BUTTONS_BODY_MAX = 1024

export interface SendConfig {
```

Dans l'interface `WhatsAppProvider`, remplacer :

```ts
  buildSendTemplateRequest?(msg: OutboundTemplateMessage, config: SendConfig): SendHttpRequest
```

par :

```ts
  buildSendTemplateRequest?(msg: OutboundTemplateMessage, config: SendConfig): SendHttpRequest
  /** Envoi d'un message à boutons de réponse (fenêtre 24 h obligatoire, comme un texte). */
  buildSendButtonsRequest?(msg: OutboundButtonsMessage, config: SendConfig): SendHttpRequest
```

Juste avant `const META_TYPE_TO_MEDIA: Record<string, NormalizedMediaType> = {`, insérer :

```ts
/**
 * Refuse un message à boutons que Meta refuserait. Lever ICI plutôt que laisser l'API
 * répondre 400 : la garde rend alors un échec de construction, et l'appelant retombe sur le
 * texte au lieu d'attendre un aller-retour réseau pour apprendre la même chose.
 */
function assertButtonsMessage(msg: OutboundButtonsMessage): void {
  if (!msg.body || msg.body.length > BUTTONS_BODY_MAX) {
    throw new RangeError(`buttons: corps de 1 à ${BUTTONS_BODY_MAX} caractères (${msg.body?.length ?? 0})`)
  }
  if (msg.buttons.length < 1 || msg.buttons.length > BUTTONS_MAX) {
    throw new RangeError(`buttons: 1 à ${BUTTONS_MAX} boutons (${msg.buttons.length})`)
  }
  for (const b of msg.buttons) {
    if (!b.title || b.title.length > BUTTON_TITLE_MAX) {
      throw new RangeError(`buttons: libellé de 1 à ${BUTTON_TITLE_MAX} caractères (« ${b.title} »)`)
    }
    if (!b.id || b.id.length > BUTTON_ID_MAX) {
      throw new RangeError(`buttons: identifiant de 1 à ${BUTTON_ID_MAX} caractères`)
    }
  }
  if (new Set(msg.buttons.map((b) => b.id)).size !== msg.buttons.length) {
    throw new RangeError('buttons: identifiants en double')
  }
  if (new Set(msg.buttons.map((b) => b.title)).size !== msg.buttons.length) {
    throw new RangeError('buttons: libellés en double')
  }
}

```

Dans `class MetaProvider`, juste avant le commentaire `  // Marque le message entrant comme lu (coches bleues).`, insérer :

```ts
  // Boutons de réponse (message INTERACTIF). Libre, donc réservé à la fenêtre 24 h — c'est la
  // garde qui l'impose, pas ce constructeur. Les limites de Meta, elles, sont vérifiées ici.
  buildSendButtonsRequest(msg: OutboundButtonsMessage, config: SendConfig): SendHttpRequest {
    assertButtonsMessage(msg)
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: msg.body },
          action: {
            buttons: msg.buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
          },
        },
      }),
    }
  }

```

- [ ] **Step 4 : relancer, il doit passer**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: PASS — 42 tests (39 existants + 3).

- [ ] **Step 5 : commit**

```bash
git add supabase/functions/_shared/whatsapp-gateway.ts supabase/functions/_shared/whatsapp-gateway.test.ts
git commit -m "feat(whatsapp): la gateway sait envoyer un message à boutons de réponse

buildSendButtonsRequest (Meta interactive/button) et les limites de Meta, vérifiées
avant l'envoi : 1 à 3 boutons, libellé de 20 caractères, identifiant de 256, corps de
1024. Au-delà, le constructeur lève et la garde rend un échec de construction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

> ✅ **Fait (`c942111a`), puis corrigé en revue (`4bb1625f`)** : la constante s'appelle
> `BUTTONS_BODY_MAX` (1024 ne vaut que pour les boutons, une liste en admet 4096) ; l'unité
> est écrite (unités UTF-16, `.length`) ; body, libellé et id blancs sont refusés, un id
> entouré d'espaces aussi ; le message d'erreur donne la POSITION du bouton, jamais son
> libellé (il finit en log et porte souvent un nom de client) ; bornes basses éprouvées.
> Le code ci-dessus est l'état d'origine ; celui du dépôt fait foi.

---

### Task 2 : Gateway — `replyId` à la réception

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-gateway.ts`
- Test: `supabase/functions/_shared/whatsapp-gateway.test.ts`

- [ ] **Step 1 : écrire le test qui rougit**

Dans `whatsapp-gateway.test.ts`, dans le `describe('whatsapp-gateway — réponses à un bouton (opt-out Meta)', …)`,
juste APRÈS le test `it('aucun corps exploitable → body reste null (pas de chaîne vide fabriquée)', …)` et
AVANT le `})` qui ferme le `describe`, insérer :

```ts
  // L'identifiant vit À CÔTÉ du corps, jamais dedans : `body` alimente le corpus de voix et
  // la compréhension. Mais c'est l'identifiant qui dit à quoi la réponse se rapporte.
  it('replyId porte l’identifiant technique, body garde le libellé', () => {
    const m = inbound({ type: 'interactive', interactive: {
      type: 'button_reply', button_reply: { id: 'pa:0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b:yes', title: 'Oui' },
    } })
    expect(m?.replyId).toBe('pa:0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b:yes')
    expect(m?.body).toBe('Oui')
  })

  it('replyId lit aussi une entrée de liste et le payload d’un bouton de template', () => {
    expect(inbound({ type: 'interactive', interactive: { list_reply: { id: 'row_3', title: 'Me désinscrire' } } })?.replyId).toBe('row_3')
    expect(inbound({ type: 'button', button: { text: 'Stop promotions', payload: 'STOP_PROMO' } })?.replyId).toBe('STOP_PROMO')
  })

  it('replyId est null quand personne n’a appuyé sur rien', () => {
    expect(inbound({ type: 'text', text: { body: 'oui' } })?.replyId).toBeNull()
    expect(inbound({ type: 'interactive', interactive: { button_reply: { id: '', title: 'Oui' } } })?.replyId).toBeNull()
  })
```

- [ ] **Step 2 : le lancer, il doit rougir**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: FAIL — les 3 nouveaux tests (`replyId` vaut `undefined`).

- [ ] **Step 3 : l'implémentation**

Dans l'interface `NormalizedInboundMessage`, remplacer :

```ts
  bodySource: InboundBodySource | null
  mediaType: NormalizedMediaType | null
```

par :

```ts
  bodySource: InboundBodySource | null
  /**
   * Identifiant technique du bouton ou de l'entrée de liste touché : `button_reply.id`,
   * `list_reply.id`, ou `payload` d'un bouton de template. `null` pour tout le reste.
   *
   * ⚠ SÉPARÉ de `body`, qui garde le LIBELLÉ : `body` alimente le corpus de voix et la
   * compréhension, un identifiant technique les polluerait. Mais c'est l'identifiant, pas le
   * libellé, qui dit à quoi la réponse se rapporte — un bouton reste dans la conversation, et
   * un vieux [Oui] ressemble trait pour trait à un neuf.
   */
  replyId: string | null
  mediaType: NormalizedMediaType | null
```

Dans `parseInbound`, remplacer :

```ts
      bodySource: hit?.[0] ?? null,
```

par :

```ts
      bodySource: hit?.[0] ?? null,
      replyId: firstNonEmpty(interactive?.button_reply?.id, interactive?.list_reply?.id, button?.payload) ?? null,
```

- [ ] **Step 4 : relancer, il doit passer**

Run: `npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts`
Expected: PASS — 45 tests.

- [ ] **Step 5 : `deno check` (le type `NormalizedInboundMessage` est lu par le webhook)**

Run: `deno check --no-lock supabase/functions/_shared/whatsapp-gateway.ts supabase/functions/whatsapp-webhook/index.ts`
Expected: aucune erreur (sortie `Check …` sans `error:`).

- [ ] **Step 6 : commit**

```bash
git add supabase/functions/_shared/whatsapp-gateway.ts supabase/functions/_shared/whatsapp-gateway.test.ts
git commit -m "feat(whatsapp): l'entrant porte l'identifiant du bouton touché (replyId)

À côté du corps, jamais dedans : body garde le libellé (corpus de voix, compréhension),
replyId dit à quoi la réponse se rapporte — un vieux [Oui] ressemble à un neuf.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3 : i18n — libellés et textes des boutons

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-i18n.ts`
- Test: `supabase/functions/_shared/whatsapp-i18n.test.ts`

- [ ] **Step 1 : écrire le test qui rougit**

Dans `whatsapp-i18n.test.ts`, juste après la ligne 2 (`import { refusalText } from './whatsapp-i18n'`), ajouter :

```ts
import { detectStopRequest } from './whatsapp-stop-keywords'
import { parseConfirmation } from './whatsapp-agent-router'
import { BUTTON_TITLE_MAX } from './whatsapp-gateway'
```

Puis ajouter à la FIN du fichier (`t` est déjà importé plus haut dans le fichier) :

```ts
describe('boutons de confirmation — libellés et textes', () => {
  const LANGS = ['fr', 'en'] as const
  const BUTTON_KEYS = ['btnYes', 'btnNo'] as const

  // La borne vient de la gateway, pas d'un 20 recopié : si Meta la change, un seul endroit.
  it('tiennent dans la limite Meta d’un libellé, et diffèrent l’un de l’autre', () => {
    for (const lang of LANGS) {
      for (const k of BUTTON_KEYS) {
        expect(t(lang, k).length, `${lang}/${k}`).toBeGreaterThan(0)
        expect(t(lang, k).length, `${lang}/${k}`).toBeLessThanOrEqual(BUTTON_TITLE_MAX)
      }
      expect(t(lang, 'btnYes')).not.toBe(t(lang, 'btnNo'))
    }
  })

  // ⛔ LE PIÈGE. Un appui sur un bouton dont le libellé est un mot-clé STOP est traité comme
  // un opt-out par bouton, AVANT la bifurcation agent/client du webhook. « Cancel » est dans
  // la liste internationale : un bouton [Cancel] désinscrirait l'agent de son brief du matin.
  it('aucun libellé de bouton n’est un mot-clé de désinscription', () => {
    for (const lang of LANGS) {
      for (const k of BUTTON_KEYS) {
        expect(detectStopRequest(t(lang, k)), `${lang}/${k} = « ${t(lang, k)} »`).toBeNull()
      }
    }
  })

  // Repli : si Meta ne renvoyait pas l'identifiant, le libellé passerait par le chemin tapé.
  it('les libellés sont compris par parseConfirmation', () => {
    for (const lang of LANGS) {
      expect(parseConfirmation(t(lang, 'btnYes'))).toBe('yes')
      expect(parseConfirmation(t(lang, 'btnNo'))).toBe('no')
    }
  })

  it('les textes de contrôle existent dans les deux langues, et diffèrent', () => {
    for (const k of ['confirmShort', 'staleButton'] as const) {
      expect(t('fr', k)).not.toBe(t('en', k))
      for (const lang of LANGS) expect(t(lang, k).length, `${lang}/${k}`).toBeGreaterThan(5)
    }
  })
})
```

- [ ] **Step 2 : le lancer, il doit rougir**

Run: `npx vitest run supabase/functions/_shared/whatsapp-i18n.test.ts`
Expected: FAIL — les 4 nouveaux tests (`STR[key]` indéfini → `TypeError`).

- [ ] **Step 3 : l'implémentation**

Dans `whatsapp-i18n.ts`, remplacer :

```ts
  unknownAction: {
    fr: "Type d'action inconnu, rien fait.",
    en: 'Unknown action type — nothing done.',
  },
} as const
```

par :

```ts
  unknownAction: {
    fr: "Type d'action inconnu, rien fait.",
    en: 'Unknown action type — nothing done.',
  },
  // ── Boutons de confirmation (spec 2026-09-10) ──────────────────────────────
  // ⛔ Un libellé de bouton ne doit JAMAIS être un mot-clé STOP : le webhook traite un appui
  // dont le libellé en est un comme un opt-out par BOUTON, avant même de savoir que
  // l'expéditeur est un agent. « Cancel » est dans la liste internationale — un bouton
  // [Cancel] désinscrirait l'agent de son brief. Verrouillé par whatsapp-i18n.test.ts.
  // ⚠ 20 caractères au plus (limite Meta d'un libellé).
  btnYes: {
    fr: 'Oui',
    en: 'Yes',
  },
  btnNo: {
    fr: 'Non',
    en: 'No',
  },
  // Corps du message à boutons quand la question complète est partie à part (> 1024 car.).
  confirmShort: {
    fr: 'Tu confirmes ?',
    en: 'Confirm?',
  },
  staleButton: {
    fr: "Ce bouton concerne une action qui n'est plus en attente : rien n'a été fait.",
    en: 'This button is for an action that is no longer pending: nothing was done.',
  },
} as const
```

- [ ] **Step 4 : relancer, il doit passer**

Run: `npx vitest run supabase/functions/_shared/whatsapp-i18n.test.ts supabase/functions/_shared/whatsapp-stop-keywords.test.ts`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add supabase/functions/_shared/whatsapp-i18n.ts supabase/functions/_shared/whatsapp-i18n.test.ts
git commit -m "feat(whatsapp): libellés [Oui] [Non] et textes des boutons de confirmation

Un test verrouille qu'aucun libellé n'est un mot-clé STOP : un appui sur un bouton
qui en porte un vaut désinscription par bouton, et « Cancel » en est un.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4 : Module pur `whatsapp-confirm-buttons.ts`

**Files:**
- Create: `supabase/functions/_shared/whatsapp-confirm-buttons.ts`
- Create: `supabase/functions/_shared/whatsapp-confirm-buttons.test.ts`
- Modify: `vitest.config.ts` (liste d'inclusion)

- [ ] **Step 1 : inscrire le test dans Vitest AVANT de l'écrire**

Sinon il ne tournerait jamais, et l'étape 3 « rougit » passerait pour un vert. Dans `vitest.config.ts`,
remplacer la sous-chaîne :

```ts
'supabase/functions/_shared/whatsapp-outbound-guard.test.ts', 
```

par :

```ts
'supabase/functions/_shared/whatsapp-outbound-guard.test.ts', 'supabase/functions/_shared/whatsapp-confirm-buttons.test.ts', 
```

- [ ] **Step 2 : écrire le test**

Créer `supabase/functions/_shared/whatsapp-confirm-buttons.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import {
  confirmReplyId, parseConfirmReplyId, resolveButtonDecision, planConfirmation,
} from './whatsapp-confirm-buttons'
import { BUTTONS_BODY_MAX } from './whatsapp-gateway'
import { t } from './whatsapp-i18n'

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
      'pa:pas-un-uuid:yes', `xx:${PA}:yes`, ` pa:${PA}:yes`, `pa:${PA}:yes `]) {
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
    expect(plan[1]).toMatchObject({ type: 'buttons', body: t('fr', 'confirmShort') })
  })

  it('mesure le texte tel qu’il PART, après la mise en forme de la garde', () => {
    // 1026 caractères bruts, 1024 une fois le gras Markdown converti en gras WhatsApp.
    const brut = `**${'a'.repeat(BUTTONS_BODY_MAX - 2)}**`
    expect(brut.length).toBe(BUTTONS_BODY_MAX + 2)
    expect(planConfirmation(brut, PA, 'fr')).toHaveLength(1)
  })

  it('une question vide ne produit jamais un message à boutons sans corps', () => {
    expect(planConfirmation('', PA, 'fr')).toEqual([expect.objectContaining({
      type: 'buttons', body: t('fr', 'confirmShort'),
    })])
  })
})
```

- [ ] **Step 3 : le lancer, il doit rougir**

Run: `npx vitest run supabase/functions/_shared/whatsapp-confirm-buttons.test.ts`
Expected: FAIL — `Failed to resolve import "./whatsapp-confirm-buttons"`.

- [ ] **Step 4 : l'implémentation**

Créer `supabase/functions/_shared/whatsapp-confirm-buttons.ts` :

```ts
// Boutons de confirmation du copilote WhatsApp — PUR (aucun I/O), testable Node et Deno.
//
// POURQUOI LE BOUTON PORTE L'IDENTIFIANT DE SON ACTION.
// Un « oui » tapé répond toujours à la question du moment. Un bouton, lui, RESTE dans la
// conversation : [Oui] peut être touché une semaine plus tard, sous une question périmée.
// Lire son seul libellé confirmerait l'action en attente AU MOMENT DE L'APPUI — une
// publication sur les portails, par exemple, quand l'agent avait sous les yeux un
// déplacement de deal. L'identifiant `pa:<uuid>:yes|no` lie chaque bouton à UNE action.
// Spec : docs/superpowers/specs/2026-09-10-whatsapp-boutons-confirmations-design.md

import { BUTTONS_BODY_MAX } from './whatsapp-gateway.ts'
import { toWhatsAppText } from './whatsapp-format.ts'
import { meggaProse } from './megga-prose.ts'
import { t, type WaLang } from './whatsapp-i18n.ts'
import type { OutboundPayload } from './whatsapp-outbound-guard.ts'

export type ConfirmChoice = 'yes' | 'no'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(`^${UUID}$`, 'i')
const REPLY_ID_RE = new RegExp(`^pa:(${UUID}):(yes|no)$`, 'i')

/** Identifiant porté par un bouton : `pa:<uuid de whatsapp_pending_actions>:yes|no`. */
export function confirmReplyId(pendingId: string, choice: ConfirmChoice): string {
  // Un identifiant qu'on ne saurait pas relire ferait de chaque appui un bouton « périmé ».
  if (!UUID_RE.test(pendingId)) throw new RangeError(`confirmReplyId: uuid attendu (${pendingId})`)
  return `pa:${pendingId.toLowerCase()}:${choice}`
}

/** Relit un identifiant de bouton de confirmation ; `null` pour tout le reste. */
export function parseConfirmReplyId(
  replyId: string | null | undefined,
): { pendingId: string; choice: ConfirmChoice } | null {
  const m = REPLY_ID_RE.exec(replyId ?? '')
  if (!m) return null
  return { pendingId: m[1].toLowerCase(), choice: m[2].toLowerCase() as ConfirmChoice }
}

/**
 * Ce qu'un appui décide, face à l'action qui attend VRAIMENT.
 *
 * - `null`  : la réponse n'est pas un bouton de confirmation, le chemin tapé s'applique ;
 * - `stale` : le bouton vise une autre action, ou aucune n'attend. On le dit, sans rien
 *   consommer ni rien envoyer au copilote ;
 * - `yes` / `no` : le bouton vise l'action en attente.
 */
export function resolveButtonDecision(
  replyId: string | null | undefined,
  currentPendingId: string | null | undefined,
): ConfirmChoice | 'stale' | null {
  const parsed = parseConfirmReplyId(replyId)
  if (!parsed) return null
  if (!currentPendingId || parsed.pendingId !== currentPendingId.toLowerCase()) return 'stale'
  return parsed.choice
}

/**
 * Les messages à envoyer pour une demande de confirmation, dans l'ORDRE.
 *
 * ⚠ La limite de 1024 caractères se mesure sur le texte qui PART, c'est-à-dire après la mise
 * en forme que la garde appliquera (`meggaProse` puis `toWhatsAppText`). Au-delà, la question
 * complète part en texte, puis un court « Tu confirmes ? » porte les boutons : un brouillon
 * n'est jamais tronqué, l'agent valide exactement ce qui partira.
 */
export function planConfirmation(prompt: string, pendingId: string, lang: WaLang): OutboundPayload[] {
  const buttons = [
    { id: confirmReplyId(pendingId, 'yes'), title: t(lang, 'btnYes') },
    { id: confirmReplyId(pendingId, 'no'), title: t(lang, 'btnNo') },
  ]
  const formatted = toWhatsAppText(meggaProse(prompt))
  // Meta refuse un message à boutons sans corps : une question vide garde la formule courte.
  if (!formatted.trim()) return [{ type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
  if (formatted.length <= BUTTONS_BODY_MAX) return [{ type: 'buttons', body: prompt, buttons }]
  return [{ type: 'text', body: prompt }, { type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
}
```

⚠ `OutboundPayload` n'a pas encore de membre `buttons` : c'est Task 5. Vitest n'effectue pas de
contrôle de type, donc ce test passe dès maintenant ; le `deno check` de Task 5 le confirmera.

- [ ] **Step 5 : relancer, il doit passer**

Run: `npx vitest run supabase/functions/_shared/whatsapp-confirm-buttons.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 6 : commit**

```bash
git add supabase/functions/_shared/whatsapp-confirm-buttons.ts supabase/functions/_shared/whatsapp-confirm-buttons.test.ts vitest.config.ts
git commit -m "feat(whatsapp): module pur des boutons de confirmation

Identifiant pa:<uuid>:yes|no (aller-retour, rejets), décision face à l'action qui
attend vraiment (yes/no/stale/null), et découpage à 1024 caractères mesurés sur le
texte qui PART : un brouillon n'est jamais tronqué.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5 : Garde — type d'envoi `buttons`

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-outbound-guard.ts`
- Test: `supabase/functions/_shared/whatsapp-outbound-guard.test.ts`

- [ ] **Step 1 : écrire le test qui rougit**

Dans `whatsapp-outbound-guard.test.ts`, dans `fakeProvider`, remplacer :

```ts
    buildSendTemplateRequest: () => { built.push('template'); return REQ },
```

par :

```ts
    buildSendTemplateRequest: () => { built.push('template'); return REQ },
    buildSendButtonsRequest: () => { built.push('buttons'); return REQ },
```

Puis ajouter à la FIN du fichier :

```ts
describe('sendOutboundGuarded — message à boutons', () => {
  const buttons = {
    type: 'buttons' as const,
    body: 'Tu confirmes ?',
    buttons: [{ id: 'pa:x:yes', title: 'Oui' }, { id: 'pa:x:no', title: 'Non' }],
  }

  it('exige la fenêtre par défaut : ce n’est pas un template', () => {
    expect(needsOpenWindow('buttons', undefined)).toBe(true)
  })

  it('hors fenêtre, il est refusé comme un texte', async () => {
    const h = harness({ verdict: { ...OK_VERDICT, in_24h_window: false } })
    const provider = fakeProvider()
    const r = await sendOutboundGuarded(baseArgs(h, { provider, payload: buttons }))
    expect(blockedResult(r).reason).toBe('window_closed')
    expect(provider.built).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('dans la fenêtre, il est construit par buildSendButtonsRequest et journalise la question', async () => {
    const h = harness()
    const provider = fakeProvider()
    const r = await sendOutboundGuarded(baseArgs(h, { provider, payload: buttons }))
    expect(r.ok).toBe(true)
    expect(provider.built).toEqual(['buttons'])
    expect(h.upserted[0].row.body).toBe('Tu confirmes ?')
    expect(h.upserted[0].row.media_type).toBeNull()
  })

  it('un constructeur qui lève rend un échec, pas une exception : l’appelant retombe sur le texte', async () => {
    const h = harness()
    const provider = {
      ...fakeProvider(),
      buildSendButtonsRequest: () => { throw new RangeError('buttons: 1 à 3 boutons (4)') },
    } as unknown as WhatsAppProvider
    const r = await sendOutboundGuarded(baseArgs(h, { provider, payload: buttons }))
    expect(r.ok).toBe(false)
    expect((r as Extract<SendOutboundResult, { blocked: false }>).blocked).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2 : le lancer, il doit rougir**

Run: `npx vitest run supabase/functions/_shared/whatsapp-outbound-guard.test.ts`
Expected: FAIL — « dans la fenêtre… » (`built` vaut `[]`, `buildRequest` ne connaît pas `buttons` et rend `undefined` → `unsupported_payload`).

- [ ] **Step 3 : l'implémentation**

Dans `whatsapp-outbound-guard.ts`, remplacer :

```ts
export type OutboundPayload =
  | { type: 'text'; body: string }
```

par :

```ts
export type OutboundPayload =
  | { type: 'text'; body: string }
  /**
   * Message à BOUTONS DE RÉPONSE. Un message libre comme un autre : il exige la fenêtre 24 h
   * (`needsOpenWindow`) et son corps reçoit la même mise en forme que le texte.
   */
  | { type: 'buttons'; body: string; buttons: Array<{ id: string; title: string }> }
```

Dans `outboundBody`, remplacer :

```ts
    case 'text': return p.body
```

par :

```ts
    case 'text': return p.body
    case 'buttons': return p.body
```

Dans `buildRequest`, remplacer :

```ts
    case 'text':
      return provider.buildSendTextRequest({ toPhone: to, body: toWhatsAppText(meggaProse(p.body)) }, config)
```

par :

```ts
    case 'text':
      return provider.buildSendTextRequest({ toPhone: to, body: toWhatsAppText(meggaProse(p.body)) }, config)
    case 'buttons':
      // Les limites Meta sont vérifiées par le constructeur : s'il lève, `sendOutboundGuarded`
      // rend un échec de construction et l'appelant retombe sur le texte.
      return provider.buildSendButtonsRequest?.({
        toPhone: to, body: toWhatsAppText(meggaProse(p.body)), buttons: p.buttons,
      }, config) ?? null
```

- [ ] **Step 4 : relancer, il doit passer**

Run: `npx vitest run supabase/functions/_shared/whatsapp-outbound-guard.test.ts supabase/functions/_shared/whatsapp-confirm-buttons.test.ts`
Expected: PASS.

- [ ] **Step 5 : `deno check`**

Run: `deno check --no-lock supabase/functions/_shared/whatsapp-outbound-guard.ts supabase/functions/_shared/whatsapp-confirm-buttons.ts`
Expected: aucune erreur.

- [ ] **Step 6 : commit**

```bash
git add supabase/functions/_shared/whatsapp-outbound-guard.ts supabase/functions/_shared/whatsapp-outbound-guard.test.ts
git commit -m "feat(whatsapp): la garde connaît le message à boutons

Même régime qu'un texte : fenêtre 24 h exigée, même mise en forme du corps, la
question journalisée. Un constructeur qui lève rend un échec de construction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

> ✅ **Tâches 2 à 5 faites** (`08dc6aec`, `1bf86b4d`, `1be838d6`, `88f4501f`), **puis corrigées
> en revue (`0b689e2e`)** :
> - `staleButton` parle de l'APPUI, jamais de l'action : « Ce bouton ne correspond plus à une
>   action en attente (déjà traitée, annulée ou expirée) : cet appui n'a rien déclenché. » (un
>   double appui pouvait faire croire qu'un envoi n'avait pas eu lieu → doublon au client) ;
> - une seule mise en forme sortante, `formatOutboundText` (`_shared/whatsapp-format.ts`),
>   appelée par la garde ET par `planConfirmation` : l'invariant de mesure devient structurel ;
> - la garde est éprouvée avec le VRAI provider Meta (le faux ignorait les arguments) ;
> - l'identifiant de bouton n'accepte que sa forme exacte (`pa:` et `yes|no` en minuscules) ;
> - un sortant à boutons garde `raw = { interactive_buttons }`, pour que la preuve de prod
>   distingue un message à boutons de son repli texte ;
> - tests resserrés (découpage complet, question blanche, texte qui GRANDIT à la mise en
>   forme, libellés réellement émis vs mots-clés STOP).
> Les blocs de code ci-dessus sont l'état d'origine ; le dépôt fait foi.
> ⚠ `1be838d6` seul ne passe pas `deno check` (le membre `buttons` arrive au commit suivant) :
> sans conséquence en fusion écrasée, à savoir pour un `git bisect`.

---

### Task 6 : Porte CI — reconnaître tout constructeur `buildSend*Request`

**Files:**
- Modify: `scripts/check-whatsapp-outbound.mjs`

- [ ] **Step 1 : prouver le trou (la sonde doit PASSER à tort)**

```bash
mkdir -p supabase/functions/_sonde-porte
cat > supabase/functions/_sonde-porte/index.ts <<'EOF'
declare const provider: { buildSendButtonsRequest(m: unknown, c: unknown): unknown }
provider.buildSendButtonsRequest({}, {})
EOF
npm run lint:whatsapp-outbound; echo "exit=$?"
```

Expected: `exit=0` — un constructeur appelé hors de la gateway et de la garde passe la porte. C'est le défaut.

- [ ] **Step 2 : la correction**

Dans `scripts/check-whatsapp-outbound.mjs`, remplacer :

```js
    for (const m of txt.matchAll(/\.buildSend(Text|Image|Document|Template)Request\b/g)) {
```

par :

```js
    // ⚠ `\w+` et non l'alternative fermée d'origine (Text|Image|Document|Template) : une porte
    // qui ÉNUMÈRE les constructeurs devient aveugle au premier qu'on ajoute — et
    // `buildSendButtonsRequest` aurait pu s'appeler n'importe où sans passer par la garde.
    for (const m of txt.matchAll(/\.buildSend(\w+)Request\b/g)) {
```

- [ ] **Step 3 : la sonde doit maintenant ROUGIR**

Run: `npm run lint:whatsapp-outbound; echo "exit=$?"`
Expected: `exit=1`, avec une ligne `supabase/functions/_sonde-porte/index.ts:2 … buildSendButtonsRequest hors de la gateway et de la garde`.

- [ ] **Step 4 : retirer la sonde, la porte redevient verte**

```bash
rm -r supabase/functions/_sonde-porte
npm run lint:whatsapp-outbound; echo "exit=$?"
```

Expected: `exit=0`, `✓ Chemin sortant WhatsApp — 14 appel(s) à la garde, tous à finalité lisible.`

- [ ] **Step 5 : commit**

```bash
git add scripts/check-whatsapp-outbound.mjs
git commit -m "fix(ci): la porte du sortant WhatsApp reconnaît tout constructeur buildSend*Request

Elle les énumérait (Text|Image|Document|Template) : un constructeur ajouté lui
échappait, et pouvait s'appeler n'importe où sans passer par la garde. Prouvé par
une sonde verte avant, rouge après.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7 : Copilote — l'identifiant de l'action en attente dans la réponse

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts`

Pas de test unitaire : la fonction n'a pas de banc (elle appelle DeepSeek et la base). Le filet est
`deno check`, puis la preuve en production (Task 12).

- [ ] **Step 1 : `stashPending` rend l'identifiant — et, en `busy`, la question qui attend**

Remplacer :

```ts
async function stashPending(
  ctx: ActionCtx, waNumber: string, tool: string, args: Record<string, unknown>,
): Promise<{ status: 'created' | 'busy' | 'error'; prompt?: string; error?: string }> {
  const { data: existing } = await ctx.supabase
    .from('whatsapp_pending_actions')
    .select('expires_at')
    .eq('profile_id', ctx.profileId)
    .maybeSingle()
  if (existing && Date.parse(existing.expires_at) > Date.now()) {
    return { status: 'busy' }
  }
```

par :

```ts
async function stashPending(
  ctx: ActionCtx, waNumber: string, tool: string, args: Record<string, unknown>,
): Promise<{ status: 'created' | 'busy' | 'error'; prompt?: string; error?: string; pendingId?: string }> {
  const { data: existing } = await ctx.supabase
    .from('whatsapp_pending_actions')
    .select('id, expires_at, summary')
    .eq('profile_id', ctx.profileId)
    .maybeSingle()
  if (existing && Date.parse(existing.expires_at) > Date.now()) {
    // L'identifiant ET la question de l'action qui attend : le rappel `busy` les reprend.
    return { status: 'busy', pendingId: existing.id as string, prompt: existing.summary as string }
  }
```

Puis remplacer :

```ts
  const { error: insErr } = await ctx.supabase.from('whatsapp_pending_actions').insert({
    profile_id: ctx.profileId,
    agency_id: ctx.agencyId,
    wa_number: waNumber,
    tool,
    args: { ...storeArgs, __lang: ctx.lang ?? 'fr' },
    summary: prompt,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })
  if (insErr) {
    // 23505 = unique_violation → un pending valide a gagné la course concurrente.
    if ((insErr as { code?: string }).code === '23505') return { status: 'busy' }
    return { status: 'error', error: insErr.message }
  }
  return { status: 'created', prompt }
}
```

par :

```ts
  const { data: inserted, error: insErr } = await ctx.supabase.from('whatsapp_pending_actions').insert({
    profile_id: ctx.profileId,
    agency_id: ctx.agencyId,
    wa_number: waNumber,
    tool,
    args: { ...storeArgs, __lang: ctx.lang ?? 'fr' },
    summary: prompt,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }).select('id').single()
  if (insErr) {
    // 23505 = unique_violation → un pending valide a gagné la course concurrente. Sans son
    // identifiant sous la main, le rappel part en texte seul, jamais avec des boutons devinés.
    if ((insErr as { code?: string }).code === '23505') return { status: 'busy' }
    return { status: 'error', error: insErr.message }
  }
  // L'identifiant de la ligne : les boutons [Oui] [Non] le porteront (spec 2026-09-10).
  return { status: 'created', prompt, pendingId: (inserted as { id: string } | null)?.id }
}
```

- [ ] **Step 2 : la réponse HTTP porte `confirmPendingId`**

Remplacer :

```ts
        const stash = await stashPending(ctx, waNumber, name, args)
        if (stash.status === 'busy') {
          logTool('busy')
          return json({ reply: t(lang, 'busy'), isError: true }, 200)
        }
        if (stash.status === 'error') {
          logTool('error')
          return json({ reply: stash.error ?? t(lang, 'prepFail'), isError: true }, 200)
        }
        logTool('confirm_pending')
        return json({ reply: stash.prompt ?? t(lang, 'fallbackConfirm') }, 200)
```

par :

```ts
        const stash = await stashPending(ctx, waNumber, name, args)
        if (stash.status === 'busy') {
          logTool('busy')
          // Le rappel reprend la question de l'action QUI ATTEND, avec SES boutons : sans elle,
          // [Oui] confirmerait une action que l'agent n'a plus sous les yeux.
          const busyReply = stash.prompt ? `${t(lang, 'busy')}\n\n${stash.prompt}` : t(lang, 'busy')
          return json({ reply: busyReply, isError: true, confirmPendingId: stash.pendingId ?? null }, 200)
        }
        if (stash.status === 'error') {
          logTool('error')
          return json({ reply: stash.error ?? t(lang, 'prepFail'), isError: true }, 200)
        }
        logTool('confirm_pending')
        // `confirmPendingId` : le webhook rend la question avec [Oui] [Non] liés à CETTE action.
        return json({ reply: stash.prompt ?? t(lang, 'fallbackConfirm'), confirmPendingId: stash.pendingId ?? null }, 200)
```

- [ ] **Step 3 : `deno check`**

Run: `deno check --no-lock supabase/functions/whatsapp-agent/index.ts`
Expected: aucune erreur.

- [ ] **Step 4 : commit**

```bash
git add supabase/functions/whatsapp-agent/index.ts
git commit -m "feat(whatsapp): le copilote renvoie l'identifiant de l'action à confirmer

confirmPendingId sur une action stockée ; en busy, l'identifiant ET la question de
l'action qui attend, que le rappel reprend. Sans identifiant (course perdue), le
rappel part en texte seul.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8 : Webhook — envoyer la confirmation avec ses boutons

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : imports**

Remplacer :

```ts
import { sendOutboundGuarded, type PublicReason } from '../_shared/whatsapp-outbound-guard.ts'
```

par :

```ts
import { sendOutboundGuarded, type PublicReason, type OutboundPayload } from '../_shared/whatsapp-outbound-guard.ts'
import { planConfirmation } from '../_shared/whatsapp-confirm-buttons.ts'
```

- [ ] **Step 2 : `callAgentBrain` propage `confirmPendingId`**

Remplacer :

```ts
): Promise<{ reply: string; isError: boolean }> {
```

par :

```ts
): Promise<{ reply: string; isError: boolean; confirmPendingId: string | null }> {
```

Puis remplacer :

```ts
    const data = await r.json().catch(() => ({}))
    const reply = (data?.reply as string) || t(lang, 'cantProcess')
    // isError si l'agent l'a flaggé OU s'il n'a renvoyé aucun reply (échec/HTTP KO) :
    // dans les deux cas la réponse est dégradée → exclue de la mémoire C1 (anti-écho).
    return { reply, isError: !!data?.isError || !data?.reply }
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return { reply: t(lang, 'cantProcessNow'), isError: true }
  }
```

par :

```ts
    const data = await r.json().catch(() => ({}))
    const reply = (data?.reply as string) || t(lang, 'cantProcess')
    // Des boutons seulement si le cerveau a VRAIMENT stocké une action, et qu'il a répondu :
    // une question sans action derrière ne doit pas porter de [Oui].
    const confirmPendingId =
      data?.reply && typeof data?.confirmPendingId === 'string' ? data.confirmPendingId as string : null
    // isError si l'agent l'a flaggé OU s'il n'a renvoyé aucun reply (échec/HTTP KO) :
    // dans les deux cas la réponse est dégradée → exclue de la mémoire C1 (anti-écho).
    return { reply, isError: !!data?.isError || !data?.reply, confirmPendingId }
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return { reply: t(lang, 'cantProcessNow'), isError: true, confirmPendingId: null }
  }
```

- [ ] **Step 3 : `sendConfirmation`**

Juste avant la ligne `// Envoi d'un texte WhatsApp à un numéro (fenêtre 24h requise, sinon template Meta).`, insérer :

```ts
/**
 * Envoie une demande de confirmation avec ses boutons [Oui] [Non].
 * Spec : docs/superpowers/specs/2026-09-10-whatsapp-boutons-confirmations-design.md §5.5.
 *
 * ⛔ Dans le cas découpé (question trop longue pour un message à boutons), les boutons ne
 * partent QUE si le texte complet est parti : on ne fait jamais confirmer un brouillon que
 * l'agent n'a pas reçu. Un message à boutons refusé par Meta retombe sur la question en
 * texte ; un refus de GARDE n'a pas de repli, le texte serait refusé pour la même raison.
 */
async function sendConfirmation(a: {
  admin: SupabaseClient
  provider: ReturnType<typeof getProvider>
  to: string
  prompt: string
  pendingId: string
  lang: WaLang
  agentLink: { profile_id: string; agency_id: string | null }
  isAgentError: boolean
}): Promise<void> {
  let plan: OutboundPayload[]
  try {
    plan = planConfirmation(a.prompt, a.pendingId, a.lang)
  } catch {
    // Identifiant d'action illisible : pas de boutons devinés, la question part en texte.
    console.error('whatsapp confirmation: identifiant d’action illisible, question en texte')
    plan = [{ type: 'text', body: a.prompt }]
  }
  for (const payload of plan) {
    // Destinataire = l'AGENT, fenêtre ouverte par son propre message : un doublon y est
    // inoffensif, d'où `retry`.
    const sent = await sendOutboundGuarded({
      admin: a.admin, provider: a.provider, to: a.to,
      purpose: 'service',
      payload,
      profileId: a.agentLink.profile_id, agencyId: a.agentLink.agency_id,
      isAutomated: true,
      isAgentError: a.isAgentError,
      retry: true,
    })
    if (sent.ok) continue
    if (!sent.blocked) {
      // Tracé, parce que le repli est MUET pour l'agent : il reçoit sa question en texte et ne
      // voit rien. Sans cette ligne, un constructeur qui refuserait tout ferait passer chaque
      // confirmation en texte sans qu'aucun journal ne le dise (la garde n'audite que les
      // envois échoués chez Meta, pas un échec de construction).
      console.error('whatsapp confirmation: envoi en échec:', payload.type, String(sent.error ?? '').slice(0, 120))
    }
    if (!sent.blocked && payload.type === 'buttons' && plan.length === 1) {
      await sendOutboundGuarded({
        admin: a.admin, provider: a.provider, to: a.to,
        purpose: 'service',
        payload: { type: 'text', body: a.prompt },
        profileId: a.agentLink.profile_id, agencyId: a.agentLink.agency_id,
        isAutomated: true,
        isAgentError: a.isAgentError,
        retry: true,
      })
    }
    return
  }
}

```

- [ ] **Step 4 : la proposition de template rend aussi l'identifiant de son action**

Juste avant le commentaire `// Fenêtre 24h fermée : PROPOSE (HITL) l'envoi d'un template de relance approuvé. Renvoie le`,
insérer :

```ts
/**
 * Réponse qui DEMANDE une confirmation : son texte, et l'identifiant de l'action stockée
 * dont les boutons [Oui] [Non] porteront la référence.
 */
type ConfirmReply = { reply: string; confirmPendingId: string }

```

Le commentaire d'en-tête de `offerTemplateFallback` décrit son retour : remplacer

```ts
// message de proposition (et stashe la pending send_template) si un template est configuré,
```

par :

```ts
// message de proposition ET l'identifiant de la pending send_template stockée (ses boutons
// [Oui] [Non] en dépendent) si un template est configuré,
```

Puis remplacer (⚠ `): Promise<string | null> {` apparaît deux fois dans le fichier — le contexte des
lignes voisines est ce qui désigne la bonne) :

```ts
  lang: WaLang,
): Promise<string | null> {
  if (!agentLink.agency_id) return null
```

par :

```ts
  lang: WaLang,
): Promise<ConfirmReply | null> {
  if (!agentLink.agency_id) return null
```

Puis remplacer :

```ts
  const { error } = await admin.from('whatsapp_pending_actions').insert({
    profile_id: agentLink.profile_id, agency_id: agentLink.agency_id, wa_number: agentNumber,
    tool: 'send_template',
    args: { contact_id: contactId, __template_key: 'followup', __lang: lang },
    summary: t(lang, 'templateOffer'),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })
  if (error) return null
  return t(lang, 'templateOffer')
}
```

par :

```ts
  const { data: inserted, error } = await admin.from('whatsapp_pending_actions').insert({
    profile_id: agentLink.profile_id, agency_id: agentLink.agency_id, wa_number: agentNumber,
    tool: 'send_template',
    args: { contact_id: contactId, __template_key: 'followup', __lang: lang },
    summary: t(lang, 'templateOffer'),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }).select('id').single()
  if (error || !inserted) return null
  return { reply: t(lang, 'templateOffer'), confirmPendingId: (inserted as { id: string }).id }
}
```

Dans `executePending`, remplacer :

```ts
  pending: { tool: string; args: Record<string, unknown> },
  lang: WaLang,
): Promise<string> {
```

par :

```ts
  pending: { tool: string; args: Record<string, unknown> },
  lang: WaLang,
): Promise<string | ConfirmReply> {
```

Puis remplacer :

```ts
    let fallbackOffer: string | null = null
```

par :

```ts
    // `null as …` et non `: … | null = null` : l'affectation vit dans le crochet, que l'analyse
    // de flux ne suit pas — elle figerait sinon la variable à `null`.
    let fallbackOffer = null as ConfirmReply | null
```

(La ligne `if (sent.reason === 'window_closed') return fallbackOffer ?? t(lang, 'sendFail24h')` reste telle quelle.)

- [ ] **Step 5 : `processAgentMessage` rend la question avec ses boutons**

Remplacer :

```ts
  // Action en attente de confirmation ? Chargée AVANT l'undo différé pour lever l'ambiguïté
```

par :

```ts
  // Demande de confirmation à rendre avec [Oui] [Non] : l'identifiant de l'action stockée, et
  // la langue de ses libellés. Null ⇒ réponse ordinaire, en texte, comme avant.
  let confirmPendingId: string | null = null
  let confirmLang: WaLang = detectLang(userText)

  // Action en attente de confirmation ? Chargée AVANT l'undo différé pour lever l'ambiguïté
```

Remplacer :

```ts
      const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
      reply = brain.reply
      replyIsError = brain.isError
    } else if (decision === 'yes' && valid) {
```

par :

```ts
      const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
      reply = brain.reply
      replyIsError = brain.isError
      confirmPendingId = brain.confirmPendingId
    } else if (decision === 'yes' && valid) {
```

Remplacer :

```ts
      reply = await executePending(admin, provider, agentLink, pendingAction, lang)
```

par :

```ts
      const done = await executePending(admin, provider, agentLink, pendingAction, lang)
      if (typeof done === 'string') {
        reply = done
      } else {
        // L'exécution a elle-même PROPOSÉ une action (template hors fenêtre 24 h) : elle a ses
        // boutons, dans la langue figée sur l'action d'origine.
        reply = done.reply
        confirmPendingId = done.confirmPendingId
        confirmLang = lang
      }
```

Remplacer :

```ts
      reply = `${t(lang, 'setAside')}\n\n${brain.reply}`
      replyIsError = brain.isError
```

par :

```ts
      reply = `${t(lang, 'setAside')}\n\n${brain.reply}`
      replyIsError = brain.isError
      confirmPendingId = brain.confirmPendingId
```

Remplacer :

```ts
    const brain = await callAgentBrain(agentLink, msg, userText, detectLang(userText), inboundDocText)
    reply = brain.reply
    replyIsError = brain.isError
  }
```

par :

```ts
    const brain = await callAgentBrain(agentLink, msg, userText, detectLang(userText), inboundDocText)
    reply = brain.reply
    replyIsError = brain.isError
    confirmPendingId = brain.confirmPendingId
  }
```

Enfin, remplacer :

```ts
  await sendOutboundGuarded({
    admin, provider, to: msg.fromPhone,
    purpose: 'service',
    payload: { type: 'text', body: reply },
    profileId: agentLink.profile_id, agencyId: agentLink.agency_id,
    isAutomated: true, // réponse générée par le copilote (MEGGA→agent) : jamais du corpus de voix
    isAgentError: replyIsError,
    retry: true,
  })
```

par :

```ts
  if (confirmPendingId) {
    await sendConfirmation({
      admin, provider, to: msg.fromPhone, prompt: reply,
      pendingId: confirmPendingId, lang: confirmLang,
      agentLink, isAgentError: replyIsError,
    })
  } else {
    await sendOutboundGuarded({
      admin, provider, to: msg.fromPhone,
      purpose: 'service',
      payload: { type: 'text', body: reply },
      profileId: agentLink.profile_id, agencyId: agentLink.agency_id,
      isAutomated: true, // réponse générée par le copilote (MEGGA→agent) : jamais du corpus de voix
      isAgentError: replyIsError,
      retry: true,
    })
  }
```

- [ ] **Step 6 : `deno check` et porte**

Run: `deno check --no-lock supabase/functions/whatsapp-webhook/index.ts && npm run lint:whatsapp-outbound`
Expected: aucune erreur de type ; `✓ Chemin sortant WhatsApp — 16 appel(s) à la garde, tous à finalité lisible.` (14 + les 2 de `sendConfirmation`).

- [ ] **Step 7 : commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(whatsapp): les demandes de confirmation partent avec [Oui] [Non]

sendConfirmation : un message à boutons, ou le texte complet puis les boutons quand
la question dépasse 1024 caractères — et les boutons seulement si le texte est parti.
Repli texte si Meta refuse le message à boutons. La proposition de template porte
aussi ses boutons.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9 : Webhook — décider sur un appui

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts`

- [ ] **Step 1 : imports**

Remplacer :

```ts
import { planConfirmation } from '../_shared/whatsapp-confirm-buttons.ts'
```

par :

```ts
import { planConfirmation, resolveButtonDecision, parseConfirmReplyId } from '../_shared/whatsapp-confirm-buttons.ts'
```

- [ ] **Step 2 : un bouton MEGGA n'est jamais un opt-out (défense en profondeur)**

Remplacer :

```ts
  if ((msg.bodySource === 'button' || msg.bodySource === 'interactive') && detectStopRequest(msg.body)) {
```

par :

```ts
  // ⛔ Un bouton de confirmation émis par MEGGA n'est JAMAIS un opt-out, quel que soit son
  // libellé. Les libellés sont déjà tenus hors des mots-clés STOP (whatsapp-i18n.test.ts) ;
  // ce test-ci est la défense en profondeur, pour le jour où quelqu'un en ajoute un.
  if ((msg.bodySource === 'button' || msg.bodySource === 'interactive')
    && !parseConfirmReplyId(msg.replyId)
    && detectStopRequest(msg.body)) {
```

- [ ] **Step 3 : `processAgentMessage` reçoit `replyId`**

Remplacer :

```ts
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
): Promise<void> {
```

par :

```ts
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null; replyId: string | null },
): Promise<void> {
```

- [ ] **Step 4 : décoder l'appui AVANT l'undo et le pending**

Remplacer :

```ts
    .select('id, tool, args, summary, expires_at')
    .eq('profile_id', agentLink.profile_id)
    .maybeSingle()

```

par :

```ts
    .select('id, tool, args, summary, expires_at')
    .eq('profile_id', agentLink.profile_id)
    .maybeSingle()

  // Bouton de confirmation MEGGA ? Décodé AVANT l'undo et le pending, parce qu'un bouton porte
  // l'identifiant de SON action : un bouton périmé (action expirée, traitée ou remplacée) ne
  // doit ni consommer l'action qui attend, ni partir au cerveau sous la forme d'un « Oui ».
  // Spec : docs/superpowers/specs/2026-09-10-whatsapp-boutons-confirmations-design.md
  const button = resolveButtonDecision(msg.replyId, (pendingAction?.id as string | undefined) ?? null)
  if (button === 'stale') {
    // Destinataire = l'AGENT, fenêtre ouverte par l'appui qu'il vient de faire.
    await sendOutboundGuarded({
      admin, provider, to: msg.fromPhone,
      purpose: 'service',
      payload: { type: 'text', body: t(detectLang(userText), 'staleButton') },
      profileId: agentLink.profile_id, agencyId: agentLink.agency_id,
      isAutomated: true,
      retry: true,
    })
    return
  }

```

- [ ] **Step 5 : un appui n'est jamais une commande d'annulation différée**

Remplacer :

```ts
  if (isUndoCommand(userText) && !(pendingAction && parseConfirmation(userText) === 'no')) {
```

par :

```ts
  if (!button && isUndoCommand(userText) && !(pendingAction && parseConfirmation(userText) === 'no')) {
```

- [ ] **Step 6 : la décision vient du bouton quand il y en a un**

Remplacer :

```ts
    const decision = parseConfirmation(userText)
```

par :

```ts
    // Un appui sur le bon bouton décide ; sinon, le texte tapé, comme avant.
    const decision = button ?? parseConfirmation(userText)
```

- [ ] **Step 7 : un double appui qui perd la course est périmé, jamais un message au cerveau**

Remplacer :

```ts
    if (!claimed || claimed.length === 0) {
      // Course perdue : une autre invocation a déjà consommé cette attente (gagnant-unique).
      // On n'AVALE PAS notre message — le pending n'existe plus, on le traite comme un message
      // normal (le cerveau répond ; s'il re-stashe, stashPending est atomique → pas de corruption).
      const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
      reply = brain.reply
      replyIsError = brain.isError
      confirmPendingId = brain.confirmPendingId
    } else if (decision === 'yes' && valid) {
```

par :

```ts
    if (!claimed || claimed.length === 0) {
      // Course perdue : une autre invocation a déjà consommé cette attente (gagnant-unique).
      if (button) {
        // Un appui concurrent (double appui) a pris le verrou : CE bouton est périmé. Surtout
        // pas le cerveau — il recevrait « Oui » sans aucune question derrière.
        reply = t(lang, 'staleButton')
      } else {
        // On n'AVALE PAS notre message — le pending n'existe plus, on le traite comme un message
        // normal (le cerveau répond ; s'il re-stashe, stashPending est atomique → pas de corruption).
        const brain = await callAgentBrain(agentLink, msg, userText, lang, inboundDocText)
        reply = brain.reply
        replyIsError = brain.isError
        confirmPendingId = brain.confirmPendingId
      }
    } else if (decision === 'yes' && valid) {
```

- [ ] **Step 8 : `deno check` et porte**

Run: `deno check --no-lock supabase/functions/whatsapp-webhook/index.ts && npm run lint:whatsapp-outbound`
Expected: aucune erreur ; `✓ Chemin sortant WhatsApp — 17 appel(s) à la garde, tous à finalité lisible.`

- [ ] **Step 9 : commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(whatsapp): un appui ne vaut que pour l'action qu'il désigne

Le bouton est décodé avant l'undo et le pending : périmé, il reçoit « plus en
attente » sans rien consommer ni appeler le cerveau ; un double appui qui perd la
course aussi. Un bouton MEGGA n'entre jamais dans la branche opt-out par bouton.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

> ✅ **Tâches 6 à 9 faites** (`6a39219b`, `f0cbf369`, `055900f5`, `5af8985b`), **puis corrigées en
> revue (`4b90006b`)** — aucun défaut de justesse ni de sécurité trouvé ; cinq améliorations :
> - une LECTURE ou un VERROU en échec n'est plus pris pour un bouton périmé : `cantProcessNow`
>   (le motif « `data` sans son `error` » déjà payé ailleurs) ;
> - un appui périmé remet sous les yeux l'action qui attend ENCORE, avec ses boutons ;
> - les règles d'envoi vivent dans `deliverConfirmation` (module pur, expéditeur injecté,
>   7 cas testés), `sendConfirmation` n'y branche que la garde — d'où 17 appels à la garde ;
> - la porte du sortant reconnaît `buildSend\w*Request` SANS point : déstructuration, accès
>   par crochets et `buildSendRequest` nu lui échappaient (sonde verte avant, rouge après) ;
> - contrats de `whatsapp-agent` et `callAgentBrain` remis à jour.

---

### Task 10 : Vérification complète

**Files:** aucun.

- [ ] **Step 1 : les suites WhatsApp**

Run:
```bash
npx vitest run supabase/functions/_shared/whatsapp-gateway.test.ts supabase/functions/_shared/whatsapp-i18n.test.ts supabase/functions/_shared/whatsapp-confirm-buttons.test.ts supabase/functions/_shared/whatsapp-outbound-guard.test.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/whatsapp-stop-keywords.test.ts supabase/functions/_shared/whatsapp-templates.test.ts tests/unit/wa-outbound-purpose.spec.ts
```
Expected: PASS, 0 échec.

- [ ] **Step 2 : toute la suite unitaire**

Run: `npm run test:unit`
Expected: PASS, 0 échec (les specs `tests/backend/*` se sautent sans clés, c'est normal).

- [ ] **Step 3 : `deno check` comme en CI (toutes les fonctions)**

Run: `find supabase/functions -name '*.ts' ! -name '*.test.ts' -print0 | xargs -0 deno check --no-lock`
Expected: aucune ligne `error:`.

- [ ] **Step 4 : porte du sortant et build**

Run: `npm run lint:whatsapp-outbound && npm run build`
Expected: `✓ Chemin sortant WhatsApp — 17 appel(s)…` puis un build Vite réussi.

- [ ] **Step 5 : aucun fichier de sonde oublié**

Run: `git status --short && ls supabase/functions | grep -c _sonde`
Expected: arbre propre ; `0`.

---

### Task 11 : Cerveau

**Files:**
- Modify: `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] **Step 1 : ajouter l'entrée**

Juste APRÈS l'objet dont la clé est `"megga/whatsapp-agent-copilot"` (il se termine par
`"tags": "whatsapp,phase4,agent,copilot,ai,tools,group,doc-generation"` puis `},`), insérer :

```json
    {
      "key": "megga/whatsapp-confirm-buttons",
      "namespace": "megga",
      "value": "Confirmations du copilote WhatsApp en boutons [Oui] [Non] (spec+plan 2026-09-10). Le bouton porte pa:<uuid whatsapp_pending_actions>:yes|no (_shared/whatsapp-confirm-buttons.ts) ; le webhook le compare a l'action qui attend VRAIMENT : perime (expiree, traitee, remplacee, double appui) => staleButton, rien consomme, pas de cerveau. Taper oui/non marche toujours. >1024 car. formates => texte complet PUIS boutons, et les boutons seulement si le texte est parti. Pieges : libelle = mot-cle STOP => opt-out par bouton (Cancel l'est) ; la porte check-whatsapp-outbound enumerait ses constructeurs (desormais buildSend\\w+Request). Socle des questionnaires client (chantier 2).",
      "tags": "whatsapp,copilot,buttons,interactive,confirmation"
    },
```

- [ ] **Step 2 : JSON valide, puis rechargement**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-flow/knowledge/megga-memory.seed.json','utf8')); console.log('json ok')"
npm run ruflo:seed
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "comment le copilote WhatsApp relie un bouton Oui à la bonne action" -n megga
```
Expected: `json ok` ; la recherche remonte `megga/whatsapp-confirm-buttons`.

- [ ] **Step 3 : commit**

```bash
git add .claude-flow/knowledge/megga-memory.seed.json
git commit -m "docs(cerveau): les boutons de confirmation WhatsApp et leurs deux pièges

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

> ✅ **Tâches 10 et 11 faites.** Vérification : 2959 tests verts, `deno check` sur les 200 fichiers
> des fonctions (sortie 0), porte du sortant verte, build OK. Cerveau : l'entrée committée
> (`12f7f1ec`) fait foi — elle intègre la revue 6 à 9 (bouton périmé qui remet l'action en
> attente sous les yeux, panne jamais prise pour « périmé », `deliverConfirmation`,
> `buildSend\w*Request` sans point) ; le bloc JSON ci-dessus est l'état d'origine. Relecture
> finale de l'ensemble : aucun défaut Critical ni Important dans le code ; deux corrections de
> la procédure de preuve (vérifier le déploiement des DEUX fonctions, cas « bouton périmé
> pendant qu'une autre action attend »), reportées dans la Task 12 ; `ConfirmSendOutcome` et
> un commentaire de porte corrigés (`91e3eeaa`).

---

### Task 12 : PR, puis preuve en production après merge

**Files:** aucun.

- [ ] **Step 1 : pousser et ouvrir la PR**

```bash
git push -u origin claude/whatsapp-no-response-diagnostic-fd6bd7
gh pr create --base main --title "WhatsApp : confirmations du copilote en boutons [Oui] [Non]" --body "$(cat <<'EOF'
## Résumé
Quand le copilote WhatsApp demande une confirmation, l'agent reçoit **[Oui] [Non]** au lieu de taper. Chantier 1 sur 2 des questionnaires WhatsApp : il pose le socle (envoyer un message à boutons, savoir lequel a été touché) que les questionnaires client réutiliseront.

Spec : `docs/superpowers/specs/2026-09-10-whatsapp-boutons-confirmations-design.md` · Plan : `docs/superpowers/plans/2026-09-10-whatsapp-boutons-confirmations.md`

## Pourquoi le bouton porte l'identifiant de son action
Un bouton reste dans la conversation. Lire son libellé seul confirmerait l'action en attente *au moment de l'appui*, pas celle que l'agent avait sous les yeux. Chaque bouton porte donc `pa:<uuid>:yes|no`, comparé à l'action qui attend VRAIMENT :
- bouton périmé → « Ce bouton ne correspond plus à une action en attente (déjà traitée, annulée ou expirée) : cet appui n'a rien déclenché. » Rien n'est consommé, le copilote n'est pas appelé. Le texte parle de l'appui, jamais de l'action : sur un double appui, le premier l'a peut-être exécutée ;
- si une autre action attend encore, elle est remise sous les yeux avec SES boutons ;
- une panne (lecture ou verrou en échec) n'est jamais prise pour « périmé ».

Question de plus de 1024 caractères : le texte complet d'abord, puis « Tu confirmes ? » avec les boutons — et les boutons seulement si le texte est parti. Taper « oui » / « non » marche toujours.

## Deux pièges fermés
- **« Cancel » est un mot-clé STOP** : un bouton qui le porterait vaudrait désinscription par bouton. Libellés Oui/Non · Yes/No, verrouillés par test (y compris ceux réellement émis) ; un bouton MEGGA n'entre jamais dans la branche opt-out.
- **La porte `check-whatsapp-outbound` énumérait ses constructeurs** : un nouveau lui échappait. Elle reconnaît désormais `buildSend\w*Request`, sans point — déstructuration, accès par crochets et `buildSendRequest` nu compris (sondes vertes avant, rouges après).

## Ce qui ne change pas
Messages clients, appairage, STOP, vocaux, documents, templates, brief du matin, `whatsapp-agent-async`. Aucune migration. Déploiement sûr dans n'importe quel ordre (ancien agent → questions en texte comme aujourd'hui ; ancien webhook → champ ignoré).

## Tests
Vitest : gateway (constructeur, limites Meta, `replyId`), module pur (identifiant exact, découpage à 1024/1025 dans les deux sens de la mise en forme, décision, `deliverConfirmation` en 7 cas), i18n, garde (fenêtre, vrai provider Meta, corps journalisé, `raw.interactive_buttons`). Suite complète verte (2959), `deno check` sur les 200 fichiers des fonctions, porte du sortant (17 appels), build.

## À savoir avant de merger
- **Fusion écrasée conseillée** : le commit `1be838d6` seul ne passe pas `deno check` (le membre `buttons` arrive au suivant) — sans effet en squash, gênant pour un `git bisect`.
- **Revenir en arrière** : les boutons déjà présents dans les conversations retrouveraient le sens de leur seul libellé (un vieux [Oui] vaudrait un « oui » tapé), borné par l'échéance de 15 minutes des actions en attente.
- **Suites possibles, non faites** : relancer la question en texte si Meta signale plus tard le message à boutons `failed` ; sortir le matcher de la porte dans un module testé ; `learn-agent-style` lit désormais les libellés « Oui » / « Non » des appuis comme du texte de l'agent.

## Preuve en production — à faire APRÈS le merge
Mode d'emploi : Task 12 du plan (vérifier d'abord que les DEUX fonctions ont été déployées).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2 : la PR a bien une CI**

Run: `gh pr view --json mergeable,statusCheckRollup --jq '{mergeable, checks: [.statusCheckRollup[].conclusion]}'`
Expected: `"mergeable": "MERGEABLE"` et des checks présents. ⚠ Une PR en conflit n'a AUCUN run
`pull_request` : elle ne rougit pas, elle disparaît de la CI (CLAUDE.md §8). L'oracle est `mergeable`.

- [ ] **Step 3 : (après merge par Julien) — la preuve**

⛔ **D'abord, les DEUX fonctions sont-elles déployées ?** Un déploiement vert ne le prouve pas :
`deploy.yml` ne rougit que si TOUTES les fonctions échouent, et un 522 esm.sh sur une seule s'est
déjà produit deux fois. Lire le résumé du job (aucune ligne `Failed functions:` nommant
`whatsapp-webhook` ou `whatsapp-agent`), ou vérifier que leur `updated_at` (MCP
`list_edge_functions`) est postérieur au merge. Un ancien `whatsapp-agent` resté en place fait
partir TOUTES les questions en texte, sans la moindre ligne d'échec dans les journaux.

Puis, depuis le WhatsApp relié, dans cet ordre :

1. « Crée le contact Test Boutons » → créé (outil `create_contact`, tier auto).
2. « **Envoie** à Test Boutons un message de relance très détaillé, d'au moins 1200 caractères »
   → **deux messages** : le brouillon complet, puis « Tu confirmes ? » avec [Oui] [Non]. Appuyer
   sur **[Non]** → « C'est annulé ». (« Rédige » laisserait DeepSeek répondre un brouillon sans
   appeler `send_client_message` : pas d'action, donc pas de boutons, et un faux diagnostic.)
3. « Supprime la fiche de Test Boutons » → la question arrive avec [Oui] [Non] (message **A**).
   Appuyer sur **[Non]** → « C'est annulé ». Appuyer ensuite sur le **[Oui] de A** → « Ce bouton ne
   correspond plus à une action en attente (déjà traitée, annulée ou expirée) : cet appui n'a rien
   déclenché. », SEUL (rien n'attend). Le contact existe toujours.
4. Redemander « Supprime la fiche de Test Boutons » → nouvelle question avec ses boutons
   (message **B**). Appuyer d'abord sur le **vieux [Oui] de A** → le texte périmé SUIVI de la
   question de B, avec ses PROPRES boutons (message **C**) ; rien n'est supprimé. Appuyer enfin
   sur **[Oui] de C** → le contact est supprimé.

Vérifier en base (remplacer `<4 derniers chiffres>` par ceux du numéro de l'agent) :

```sql
select created_at, direction, left(body, 50) as body,
       raw #>> '{entry,0,changes,0,value,messages,0,interactive,button_reply,id}' as reply_id,
       jsonb_array_length(raw -> 'interactive_buttons') as nb_boutons_envoyes
from whatsapp_messages
where created_at > now() - interval '30 minutes'
  and (wa_from like '%<4 derniers chiffres>' or wa_to like '%<4 derniers chiffres>')
order by created_at;

select created_at, tool, tier, outcome
from whatsapp_tool_usage
where created_at > now() - interval '30 minutes'
order by created_at;
```

Expected :
- chaque message à boutons SORTANT porte `nb_boutons_envoyes = 2`. Dans le cas découpé (étape 2),
  la première ligne, le brouillon long, est un texte et porte légitimement NULL ; c'est la seconde
  (« Tu confirmes ? ») qui doit porter 2 ;
- une question COURTE à NULL a trois causes possibles, dans cet ordre : fonction non déployée (voir
  le ⛔ ci-dessus), outil jamais appelé (aucune ligne `outcome = 'confirm_pending'` dans
  `whatsapp_tool_usage`), ou vrai repli texte (journaux `whatsapp confirmation: envoi en échec`) ;
- les entrants « Oui » / « Non » portent un `reply_id` de la forme `pa:<uuid>:yes|no` ;
- à l'étape 4, le message C porte `nb_boutons_envoyes = 2` et des identifiants égaux à ceux de B ;
- aucun appel `/functions/v1/whatsapp-agent` dans les journaux pour les appuis périmés.

- [ ] **Step 4 : consigner le résultat**

Cocher les preuves ci-dessus dans ce plan (ou noter l'écart et sa cause), puis commit
`docs(whatsapp): preuve en production des boutons de confirmation`.
