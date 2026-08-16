# WhatsApp — Afficher la compréhension de MEGGA dans la fiche contact (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**Goal:** Rendre VISIBLE dans la fiche contact ce que MEGGA comprend déjà des conversations WhatsApp — résumé, intention, sentiment, critères captés, engagements, prochaine action suggérée — et afficher le transcript des notes vocales dans le fil. Tout est déjà calculé et stocké ; il manque l'écran.

**Architecture :** Pur frontend (display layer). La compréhension est produite par le cron `whatsapp-process` (DeepSeek) et stockée dans `whatsapp_conversation_insights` (un row par contact, RLS = lecture par l'agence). Le hook `useConversationInsight(contactId)` existe déjà et renvoie la bonne forme. On ajoute une carte `CdConversationInsight` dans la colonne principale de la fiche (après la carte WhatsApp), et on affiche le `transcript` des vocaux dans `CdWhatsAppCard`. **Aucune migration, aucune edge function, aucun changement de RLS.**

**Tech Stack :** React 18 + Vite + React Query (hook existant), design-system Sugar v3 (`KycSection` + tokens `DossierTokens.*` inline + `SgIcon`). DeepSeek côté backend (déjà en place, hors périmètre ici).

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp conversation intelligence comprehension insights contact fiche sugar v3 transcript" -n megga
npx ruflo memory get -k "megga/whatsapp-data" -n megga
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures

- **Pas de backend** : lecture seule via le hook existant. Aucune migration (donc pas de date-gate ici). Aucune écriture.
- **Cadre IA (CLAUDE.md)** : la compréhension et la « prochaine action » sont une **assistance / estimation**, JAMAIS « automatique » ni « garantie ». Marqueur sparkle/IA + libellé « suggérée »/« estimation IA ». MEGGA propose, l'agent décide (la `next_action` est `proposé, jamais exécuté` — cf. commentaire de la migration).
- **Design-system Sugar v3** : mirror EXACT du pattern des autres cartes `Cd*` (carte `KycSection`, tokens `DossierTokens.*` inline, `SgIcon`, pills « soft » comme `CdKycCard`). PAS de `bg-white`/`text-gray-*`/`shadow-*` Tailwind, PAS de valeurs hardcodées hors tokens. Capitalize, pas d'UPPERCASE dans les titres (l'eyebrow uppercase est le pattern maison existant — OK).
- **i18n — décision assumée** : TOUTES les cartes `Cd*` de la fiche contact sont en **français codé en dur** (aucune n'utilise `useTranslation`). Pour rester cohérent avec le surface, `CdConversationInsight` et l'ajout transcript suivent la même convention (FR inline). L'i18n de tout le surface contact-detail est un refactor séparé, hors périmètre. (Documenté pour la revue : ce n'est pas un oubli.)
- **États obligatoires** : loading, vide, erreur. Si aucune compréhension n'existe pour le contact → ne RIEN afficher (ne pas encombrer la fiche d'un contact sans conversation WhatsApp).
- `npm run build` passe avant tout push (le vrai build, pas seulement `tsc --noEmit`).

## Périmètre

**FAIT (ce plan) :** carte `CdConversationInsight` (résumé/intention/sentiment/critères/engagements/prochaine action suggérée) câblée dans la fiche ; rendu du `transcript` des vocaux dans `CdWhatsAppCard` ; helpers purs testés (TDD) ; cerveau ; PR.

**PAS fait :** purge L3 des audios R2 après transcription ; les 3 outils manquants de la C3 (`get_listing`/`get_estimate`/`send_relance`) ; i18n du surface contact-detail ; afficher le `lead`/4B (pas de colonne ni de champ exposé par le hook). Ces points sont notés mais hors périmètre.

---

## File Structure

**Créer :**
- `src/components/crm-dossiers/contact-detail/conversationInsight.helpers.ts` — fonctions PURES (libellés FR de `next_action.type`, ton du sentiment, libellés des critères).
- `tests/unit/conversation-insight-helpers.test.ts` — tests des helpers (dans le glob `tests/unit/**`).
- `src/components/crm-dossiers/contact-detail/CdConversationInsight.tsx` — la carte.

**Modifier :**
- `src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx` — rendu transcript des vocaux.
- `src/pages/agent/ContactDetailPage.tsx` — rendre `<CdConversationInsight contactId={contact.id} />` après `<CdWhatsAppCard .../>`.

**Réutilisé sans changement :**
- `src/hooks/useConversationInsight.ts` — renvoie déjà `{ contact_id, summary, intent, entities, commitments, sentiment, next_action, source_message_count, generated_at }`.
- `src/hooks/useWhatsAppMessages.ts` — expose déjà `transcript`, `transcript_lang`, `processing_status`, `media_type`, `body`, `direction`.

**Contrat de données (déjà en place — NE PAS le recréer) :**
```ts
// useConversationInsight → ConversationInsightRow
{ contact_id: string
  summary: string | null
  intent: string | null
  entities: Record<string, unknown>     // { budget, zones, type, pieces, dates }
  commitments: string[]                 // engagements
  sentiment: 'positif' | 'neutre' | 'tendu' | null
  next_action: { type: string; label: string } | null   // type ∈ planifier_visite|envoyer_biens|relancer|qualifier_lead|repondre|rien
  source_message_count: number
  generated_at: string }
```

---

## Task 1 : Helpers purs (TDD)

**Files:** Create `src/components/crm-dossiers/contact-detail/conversationInsight.helpers.ts` + `tests/unit/conversation-insight-helpers.test.ts`

- [ ] **Step 1 : Test (échoue)** — `tests/unit/conversation-insight-helpers.test.ts` (mirror l'import des autres tests `tests/unit/*` — vérifier `import { describe, it, expect } from 'vitest'`)
```ts
import { nextActionLabel, sentimentTone, entityChips } from '@/components/crm-dossiers/contact-detail/conversationInsight.helpers'

describe('nextActionLabel', () => {
  it('mappe les types connus en libellés FR', () => {
    expect(nextActionLabel('planifier_visite')).toBe('Planifier une visite')
    expect(nextActionLabel('envoyer_biens')).toBe('Envoyer des biens')
    expect(nextActionLabel('relancer')).toBe('Relancer')
    expect(nextActionLabel('qualifier_lead')).toBe('Qualifier le lead')
    expect(nextActionLabel('repondre')).toBe('Répondre')
    expect(nextActionLabel('rien')).toBe('Rien à faire')
  })
  it('renvoie le type brut capitalisé si inconnu', () => {
    expect(nextActionLabel('autre_chose')).toBe('Autre chose')
    expect(nextActionLabel('')).toBe('')
  })
})

describe('sentimentTone', () => {
  it('mappe le sentiment en libellé + ton', () => {
    expect(sentimentTone('positif')).toEqual({ label: 'Positif', tone: 'ok' })
    expect(sentimentTone('tendu')).toEqual({ label: 'Tendu', tone: 'err' })
    expect(sentimentTone('neutre')).toEqual({ label: 'Neutre', tone: 'neutral' })
    expect(sentimentTone(null)).toBeNull()
    expect(sentimentTone('xxx')).toEqual({ label: 'xxx', tone: 'neutral' })
  })
})

describe('entityChips', () => {
  it('extrait des puces lisibles depuis entities (clés connues, ignore le vide)', () => {
    const chips = entityChips({ budget: '1.2M', zones: ['Eaux-Vives', 'Champel'], type: 'appartement', pieces: 4, dates: null })
    expect(chips).toContain('Budget : 1.2M')
    expect(chips).toContain('Zones : Eaux-Vives, Champel')
    expect(chips).toContain('Type : appartement')
    expect(chips).toContain('Pièces : 4')
    expect(chips).not.toContain('Dates')           // null → ignoré
  })
  it('renvoie [] pour entities vide/sans clé connue', () => {
    expect(entityChips({})).toEqual([])
    expect(entityChips({ inconnu: 'x' })).toEqual([])
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run tests/unit/conversation-insight-helpers.test.ts`.

- [ ] **Step 3 : Implémenter** `conversationInsight.helpers.ts`
```ts
const NEXT_ACTION_LABELS: Record<string, string> = {
  planifier_visite: 'Planifier une visite',
  envoyer_biens: 'Envoyer des biens',
  relancer: 'Relancer',
  qualifier_lead: 'Qualifier le lead',
  repondre: 'Répondre',
  rien: 'Rien à faire',
}

function capitalize(s: string): string {
  if (!s) return ''
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function nextActionLabel(type: string): string {
  return NEXT_ACTION_LABELS[type] ?? capitalize(type)
}

export type SentimentTone = 'ok' | 'err' | 'neutral'
export function sentimentTone(s: string | null | undefined): { label: string; tone: SentimentTone } | null {
  if (!s) return null
  if (s === 'positif') return { label: 'Positif', tone: 'ok' }
  if (s === 'tendu') return { label: 'Tendu', tone: 'err' }
  if (s === 'neutre') return { label: 'Neutre', tone: 'neutral' }
  return { label: s, tone: 'neutral' }
}

const ENTITY_LABELS: Array<{ key: string; label: string }> = [
  { key: 'budget', label: 'Budget' },
  { key: 'zones', label: 'Zones' },
  { key: 'type', label: 'Type' },
  { key: 'pieces', label: 'Pièces' },
  { key: 'dates', label: 'Dates' },
]

/** Transforme entities (jsonb libre) en puces "Label : valeur" pour les clés connues non vides. */
export function entityChips(entities: Record<string, unknown> | null | undefined): string[] {
  if (!entities || typeof entities !== 'object') return []
  const chips: string[] = []
  for (const { key, label } of ENTITY_LABELS) {
    const v = (entities as Record<string, unknown>)[key]
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    const val = Array.isArray(v) ? v.join(', ') : String(v)
    if (!val.trim()) continue
    chips.push(`${label} : ${val}`)
  }
  return chips
}
```

- [ ] **Step 4 : Run → PASS.** `npx vitest run tests/unit/conversation-insight-helpers.test.ts`.

- [ ] **Step 5 : Commit**
```bash
git add src/components/crm-dossiers/contact-detail/conversationInsight.helpers.ts tests/unit/conversation-insight-helpers.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(crm): helpers purs pour la carte compréhension WhatsApp (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Carte `CdConversationInsight` + câblage dans la fiche

> Mirror EXACT du pattern visuel de `CdKycCard` (même `KycSection`, mêmes tokens `DossierTokens.*`, mêmes pills « soft », même usage `SgIcon`). LÉGER : une carte qui lit le hook existant et rend les champs.

**Files:** Create `src/components/crm-dossiers/contact-detail/CdConversationInsight.tsx` ; Modify `src/pages/agent/ContactDetailPage.tsx`

- [ ] **Step 1 : Lire d'abord** `src/components/crm-dossiers/contact-detail/CdKycCard.tsx` et `src/components/crm-dossiers/primitives.tsx` (exports `KycSection`, `DossierTokens`) et `src/components/crm-dossiers/icons.tsx` (`SgIcon`, vérifier `name="sparkle"`). Copier les imports + le pattern de header (eyebrow/title/icon) + le pattern de pill exactement.

- [ ] **Step 2 : Implémenter** `CdConversationInsight.tsx` (adapter les imports/le header au pattern réel de `CdKycCard` lu au Step 1 ; le squelette ci-dessous est la logique de données + les états, à habiller avec `KycSection`/`DossierTokens` exactement comme les cartes voisines) :
```tsx
import { useConversationInsight } from '@/hooks/useConversationInsight'
import { KycSection, DossierTokens } from '@/components/crm-dossiers/primitives'      // ← aligner sur l'import réel de CdKycCard
import { SgIcon } from '@/components/crm-dossiers/icons'                         // ← idem
import { nextActionLabel, sentimentTone, entityChips } from './conversationInsight.helpers'

function Pill({ label, tone }: { label: string; tone: 'ok' | 'err' | 'neutral' }) {
  // Mirror le pill "soft" de CdKycCard : fond doux + texte coloré, jamais de bg plein.
  const map = {
    ok: { bg: DossierTokens.okSoft, fg: DossierTokens.ok },
    err: { bg: DossierTokens.errSoft, fg: DossierTokens.errDarker },
    neutral: { bg: DossierTokens.cardSubtle, fg: DossierTokens.inkSoft },
  } as const
  const c = map[tone]
  return (
    <span style={{ padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  )
}

export function CdConversationInsight({ contactId }: { contactId: string }) {
  const { data: insight, isLoading, error } = useConversationInsight(contactId)

  // Aucune conversation comprise → on n'encombre pas la fiche.
  if (!isLoading && !error && !insight) return null

  const sent = insight ? sentimentTone(insight.sentiment) : null
  const chips = insight ? entityChips(insight.entities) : []

  return (
    <KycSection eyebrow="Assistance IA" title="Compréhension MEGGA">
      {/* Si possible, ajouter <SgIcon name="sparkle" .../> dans le header comme CdKycCard place son icône. */}
      {isLoading && <div style={{ color: DossierTokens.muted, fontSize: 13 }}>Analyse de la conversation…</div>}
      {error && <div style={{ color: DossierTokens.errDarker, fontSize: 13 }}>Compréhension indisponible pour le moment.</div>}
      {insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {insight.summary && (
            <p style={{ color: DossierTokens.inkSoft, fontSize: 14, lineHeight: 1.5, margin: 0 }}>{insight.summary}</p>
          )}

          {(insight.intent || sent) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {insight.intent && <Pill label={insight.intent} tone="neutral" />}
              {sent && <Pill label={sent.label} tone={sent.tone} />}
            </div>
          )}

          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {chips.map((c) => (
                <span key={c} style={{ padding: '4px 10px', borderRadius: 999, background: DossierTokens.cardSubtle, color: DossierTokens.inkSoft, fontSize: 11, fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          )}

          {Array.isArray(insight.commitments) && insight.commitments.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: DossierTokens.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Engagements</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: DossierTokens.inkSoft, fontSize: 13, lineHeight: 1.5 }}>
                {insight.commitments.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {insight.next_action && insight.next_action.type !== 'rien' && (
            <div style={{ borderRadius: 14, background: DossierTokens.cardSubtle, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: DossierTokens.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Prochaine action suggérée</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: DossierTokens.ink, fontSize: 14, fontWeight: 600 }}>
                <SgIcon name="sparkle" size={14} stroke={DossierTokens.ink} sw={1.8} />
                {insight.next_action.label || nextActionLabel(insight.next_action.type)}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: DossierTokens.muted }}>
            Estimation IA · {insight.source_message_count} message(s) analysé(s) · {new Date(insight.generated_at).toLocaleDateString('fr-CH')}
          </div>
        </div>
      )}
    </KycSection>
  )
}
```
> Cadre IA respecté : eyebrow « Assistance IA », icône sparkle, « action suggérée », footer « Estimation IA ». Jamais « automatique »/« garanti ». La carte ne déclenche AUCUNE action (lecture seule).

- [ ] **Step 3 : Câbler dans la fiche** — `src/pages/agent/ContactDetailPage.tsx` : importer `{ CdConversationInsight }` et le rendre dans la **colonne principale** juste après `<CdWhatsAppCard contactId={contact.id} />` :
```tsx
    <CdWhatsAppCard contactId={contact.id} />
    <CdConversationInsight contactId={contact.id} />
```

- [ ] **Step 4 : Vérifier** `npm run build` → vert. Relire : tokens `DossierTokens.*` (pas de Tailwind `bg-white`/`text-gray-*`/`shadow-*`), états loading/vide(=null)/erreur, cadre IA présent.

- [ ] **Step 5 : Commit**
```bash
git add src/components/crm-dossiers/contact-detail/CdConversationInsight.tsx src/pages/agent/ContactDetailPage.tsx
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(crm): carte « Compréhension MEGGA » dans la fiche contact (insights WhatsApp)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Transcript des vocaux dans `CdWhatsAppCard`

**Files:** Modify `src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx`

- [ ] **Step 1 : Remplacer** le bloc média + corps (≈ l.53-56 : le `[{m.media_type}]` + `{m.body || ...}`) par un rendu qui, pour un vocal (`media_type === 'audio'`), montre 🎤 + le transcript (ou l'état de traitement), et garde le comportement actuel pour les autres types :
```tsx
{m.media_type === 'audio' ? (
  <span className="block">
    <span className="text-xs opacity-70">🎤 </span>
    {m.transcript
      ? <span>{m.transcript}</span>
      : <span className="opacity-60 italic">
          {m.processing_status === 'pending' || m.processing_status === 'processing'
            ? 'transcription en cours…'
            : 'transcription indisponible'}
        </span>}
  </span>
) : (
  <>
    {m.media_type && <span className="block text-xs opacity-70 mb-0.5">[{m.media_type}]</span>}
    {m.body || <span className="opacity-60 italic">(sans texte)</span>}
  </>
)}
```
> `m.transcript` et `m.processing_status` sont déjà fournis par `useWhatsAppMessages` (aucun changement de hook). Si le type `WhatsAppMessageRow` n'inclut pas déjà `transcript`/`processing_status` au point d'usage, vérifier l'import du type (ils SONT dans l'interface du hook). Garde le style de bulle existant (classes `theme-*` de cette carte — c'est l'exception du surface, ne pas la convertir).

- [ ] **Step 2 : Vérifier** `npm run build` → vert.

- [ ] **Step 3 : Commit**
```bash
git add src/components/crm-dossiers/contact-detail/CdWhatsAppCard.tsx
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(crm): afficher le transcript des notes vocales dans la carte WhatsApp

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Cerveau + build final + PR

- [ ] **Step 1 : Build + tests** — `npm run build && npx vitest run` (build vert ; unit verts dont les helpers de la Task 1).

- [ ] **Step 2 : Cerveau** — éditer `.claude-flow/knowledge/megga-memory.seed.json` (édition JSON-safe via node, valider le parse) :
  - Nœud WhatsApp conversation-intelligence (chercher `megga/whatsapp-data` ou le nœud décrivant la compréhension/`whatsapp_conversation_insights`) : noter que la compréhension est désormais **VISIBLE côté agent** — carte `CdConversationInsight` dans la fiche contact (résumé/intention/sentiment/critères/engagements/prochaine action suggérée, cadre « assistance/estimation IA »), + transcript des vocaux affiché dans `CdWhatsAppCard`. Le dernier kilomètre de la boucle « le CRM se remplit tout seul » est livré (l'intelligence n'est plus muette côté CRM).
  Puis `npm run ruflo:seed` ; valider (`node -e "require('./.claude-flow/knowledge/megga-memory.seed.json')"`).

- [ ] **Step 3 : Commit + PR**
```bash
git add .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "docs(cerveau): compréhension WhatsApp visible dans la fiche contact (dernier km livré)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Ouvrir la PR vers `main`. (Aucune migration → pas de date-gate.) NE PAS merger sans accord humain (CI verte d'abord). Le contrôleur ouvre la PR et confirme quand c'est vert.

---

## Self-Review (vérifié contre l'audit/les contraintes)

- ✅ Affiche ce qui est déjà calculé : `useConversationInsight` (existant) + `useWhatsAppMessages` (existant) — zéro backend, zéro migration, zéro RLS.
- ✅ Cadre IA : eyebrow « Assistance IA », sparkle, « action suggérée », « Estimation IA » ; aucune action déclenchée (lecture seule).
- ✅ Design-system : `KycSection` + tokens `DossierTokens.*` + `SgIcon`, mirror de `CdKycCard` ; pills soft ; pas de Tailwind interdit. `CdWhatsAppCard` garde son style `theme-*` existant (exception assumée du surface).
- ✅ États : loading, erreur, et vide = ne rien afficher (pas de clutter).
- ✅ i18n : FR inline, cohérent avec TOUTES les cartes `Cd*` (décision documentée ; i18n du surface = refactor séparé).
- ✅ TDD sur les helpers purs (Task 1) ; le reste vérifié via `npm run build` (comme la page admin T1).
- ✅ Léger : 1 carte + 1 helper + 1 retouche de bulle + 1 câblage. 4 tâches, pur frontend.

**Cohérence des noms :** `whatsapp_conversation_insights` (table) ↔ `useConversationInsight`/`ConversationInsightRow` (hook) ↔ `CdConversationInsight` (carte) ↔ `conversationInsight.helpers` (`nextActionLabel`/`sentimentTone`/`entityChips`).

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité (comme T1). Consulter le cerveau au début de chaque tâche. Exécuter dans un **worktree frais branché sur le main à jour** (qui contient la T1). Mettre le cerveau à jour à la Task 4. Attention de revue : fidélité design-system (mirror `CdKycCard`), cadre IA (assistance/estimation, jamais « automatique »), et l'état vide qui n'affiche rien.
