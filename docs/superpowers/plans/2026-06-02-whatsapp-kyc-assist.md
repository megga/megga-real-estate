# KYC par WhatsApp — Assist optionnel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'agent immobilier, depuis sa conversation WhatsApp avec MEGGA, trois outils pour ouvrir un dossier KYC, y joindre une pièce lue (OCR Gemini), et lancer le screening Dilisense — en réutilisant le moteur KYC existant, sans jamais valider à la place du MLRO.

**Architecture :** Fine couche WhatsApp par-dessus le moteur KYC. Trois nouveaux outils copilote (`open_kyc_case` confirm, `attach_kyc_document` auto, `run_kyc_screening` auto) câblés dans l'infra `whatsapp-tools`/`toolTier`/`whatsapp-actions` existante. Une migration légère généralise `kyc_magic_link_uploads` (canal `whatsapp`). Le screening est réutilisé via un **branchement d'auth service-à-service** sur l'edge `kyc-screening` (l'agent WhatsApp n'a pas de JWT utilisateur — voir Décision D6). Aucun nouveau chemin ne peut mettre `dossier_status='verified'` : le trigger `guard_manual_kyc_verified` reste l'unique gardien, et un test source-guard (Tâche 1) le prouve avant tout le reste.

**Tech Stack :** Supabase Edge Functions (Deno/TypeScript), PostgreSQL 15 (triggers LBA), DeepSeek (function calling, texte), Gemini Vision (`read_document` OCR), Dilisense (screening), Vitest (unit + backend).

---

## Décisions verrouillées (tranchées avec Gregory, 2 juin 2026)

| # | Question | Décision |
|---|----------|----------|
| D1 | Phasage | **Phase 1 agent-facing d'abord.** L'agent transfère lui-même les pièces. Phase 2 (collecte client par WhatsApp) = différée, gated mode test Meta. Hors périmètre de ce plan. |
| D2 | Checklist | **`is_completed` reste au MLRO.** Les outils n'écrivent JAMAIS `is_completed`. Cocher déclencherait `auto_verify_kyc_dossier` → voie autonome vers `verified` = interdit. |
| D3 | Stockage | **Réutiliser `kyc_magic_link_uploads`** (migration légère). |
| D4 | Tier screening | **`run_kyc_screening` = tier `auto`.** |
| D5 | Déclencheur attach | **Explicite.** `attach_kyc_document` n'est appelé que quand l'agent désigne la pièce ; l'OCR structuré ne tourne que sur action explicite. |

**Tiers des 3 outils :** `open_kyc_case` = **confirm** (création de dossier + machinerie LBA → l'agent valide le contact/vigilance dérivés). `attach_kyc_document` = **auto**. `run_kyc_screening` = **auto** (D4). Le caractère « explicite » de attach (D5) est porté par le modèle (il n'appelle l'outil que sur intention de l'agent), pas par le tier.

### D6 — Auth screening (déviation assumée vs « aucun changement à kyc-screening »)

La spec disait « edge `kyc-screening` : aucun changement ». Impossible tel quel : `kyc-screening` exige `requireAgentAuth` (JWT utilisateur Supabase), or l'agent WhatsApp tourne en **service-role + identité re-dérivée du lien vérifié**, sans JWT. On ajoute donc à `kyc-screening` un **branchement d'auth service-à-service** (≈15 lignes, additif, zéro logique déplacée) : si l'`Authorization` est la clé service-role (comparée à temps constant, comme `whatsapp-agent` le fait déjà), on fait confiance à un `agency_id` passé dans le body. La garde cross-agency (`case.agency_id !== callerAgencyId → 403`) **reste** et protège même ce chemin. C'est le pattern de confiance interne déjà utilisé par `whatsapp-agent`. *(Alternative écartée : extraire un `_shared/kyc-screening-core.ts` — plus DRY mais déplace ~250 lignes, risque de régression supérieur. Si tu préfères, c'est un swap local à la Tâche 5.)*

## Corrections au spec (constats de la cartographie live)

Le spec a été écrit de mémoire ; la cartographie a révélé :

1. **`kyc_cases.type`** (pas `case_type`). Enum `kyc_person_type` = `buyer_pp|buyer_pm|seller_pp|seller_pm`. **Pas de colonne `entity_type` ni `created_by`** sur `kyc_cases`.
2. **pp/pm est dérivable server-side** : `contacts.entity_type` existe (`text`, défaut `'pp'`, CHECK `pp|pm`). `contacts.type` ∈ `buyer|seller|tenant|landlord|investor|both|lead`. → on dérive le `kyc_person_type` sans demander à l'agent (mieux que le wizard front qui ignorait `contact.entity_type`).
3. **`kyc_checklist_items`** : la clé est **`category`** (`id|address|pep|sanctions|funds`), pas `kind`. Flag = `is_completed`. `document_id` est un `uuid` **sans FK** (lien souple vers `documents`).
4. **`kyc_magic_link_uploads.document_id` → `documents(id)`** (FK `ON DELETE SET NULL`). `documents` a `kyc_case_id`, et `trg_set_kyc_document_retention` (BEFORE INSERT) **pose la rétention 10 ans tout seul** — on ne renseigne pas `retention_until`.
5. **`kyc-screening` body** : `entity_type ∈ 'individual'|'entity'` (≠ `type` de la colonne). On dérive : `type` finit par `_pm` → `'entity'`, sinon `'individual'`. Nom/nationalité dérivés server-side du contact (jamais du body).
6. **`activity_events`** : catégories autorisées incluent déjà **`'kyc'`** et **`'doc'`** → aucune migration de CHECK. Contrainte de cohérence : `actor_kind='ai'` ⇒ `actor_id` NULL (agent en `metadata.profile_id`).
7. **Les bytes du média vivent dans le webhook**, pas dans `whatsapp-agent`. L'agent ne voit que le texte OCR. → `attach_kyc_document` (auto, même tour que le média) nécessite de **threader une référence média** webhook → whatsapp-agent → `ActionCtx` (Tâche 6). L'exécuteur re-fetch les bytes via `fetchMetaMedia(mediaId)` puis re-OCR en mode structuré.
8. **`kyc-screening` appelle l'API Anthropic (`claude-sonnet-4-6`)** pour la couche d'analyse. C'est de l'existant ; il entre en tension avec la règle `feedback_deepseek_not_claude` mais **on n'y touche pas** (hors périmètre, comportement préservé). À signaler, pas à corriger ici.

---

## File Structure

**Créés :**
- `supabase/migrations/20260602140000_kyc_wa_uploads_generalize.sql` — généralise `kyc_magic_link_uploads`.
- `supabase/functions/_shared/kyc-extract.ts` — **pur** : prompt OCR KYC + `parseKycOcr` + dérivations (`deriveKycType`, `kycTypeToEntityType`, `kycCategoryMaps`). Testable Node.
- `supabase/functions/_shared/kyc-extract.test.ts` — unit tests du module pur.
- `tests/backend/kyc-verified-guard.spec.ts` — P0 : prouve qu'aucun chemin ne force `verified`.
- `tests/backend/kyc-wa-uploads-rls.spec.ts` — RLS + forme de la table généralisée.

**Modifiés :**
- `supabase/functions/_shared/whatsapp-tools.ts` — +3 définitions d'outils (catalogue DeepSeek).
- `supabase/functions/_shared/whatsapp-agent-router.ts` — +3 entrées `TOOL_TIERS`.
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — +3 assertions de tier.
- `supabase/functions/_shared/whatsapp-actions.ts` — exécuteurs + `ActionCtx.inboundMedia` + helpers KYC.
- `supabase/functions/whatsapp-agent/index.ts` — `runTool` (+2 cas auto), `stashPending` (prompt open_kyc_case), parse `inboundMedia`, `ctx.inboundMedia`.
- `supabase/functions/whatsapp-webhook/index.ts` — `executePending` (branche open_kyc_case), `callAgentBrain` (thread média).
- `supabase/functions/kyc-screening/index.ts` — branche auth service-à-service (D6).
- `vitest.config.ts` — ajoute `kyc-extract.test.ts` à `include`.

---

## Task 1 : P0 — filet de sécurité « aucun chemin ne force verified »

**Pourquoi en premier :** c'est l'invariant non négociable (règle d'or KYC). On le verrouille AVANT d'ajouter des chemins d'écriture KYC. Deux niveaux : un **source-guard pur** (toujours exécutable, grep du repo) + un **backend** (RAISE réel, si DB locale dispo).

**Files:**
- Create: `tests/unit/kyc-verified-source-guard.test.ts`
- Create: `tests/backend/kyc-verified-guard.spec.ts`

- [ ] **Step 1 : Écrire le source-guard pur (échoue si un writer rogue existe)**

`tests/unit/kyc-verified-source-guard.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Invariant règle d'or : la SEULE ÉCRITURE de dossier_status='verified' vit dans la
// fonction trigger auto_verify_kyc_dossier (baseline). Tout autre WRITE = bug LBA.
// On ne flague QUE les écritures — jamais les comparaisons (===, WHERE, CHECK, IS DISTINCT
// FROM) ni les CHECK d'enum — sinon le guard 20260522_003 (qui lit 'verified') ferait un
// faux positif.
const ROOTS = ['supabase/functions', 'supabase/migrations', 'src']
const TS_WRITE = /dossier_status\s*:\s*['"]verified['"]/      // .update({ dossier_status: 'verified' })
const SQL_SET = /set\s+dossier_status\s*=\s*'verified'/i      // UPDATE ... SET dossier_status='verified'
const SQL_ASSIGN = /dossier_status\s*:=\s*'verified'/i        // affectation plpgsql

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '_archived') continue
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|sql)$/.test(entry)) out.push(p)
  }
  return out
}

describe('KYC règle d’or — dossier_status=verified', () => {
  it("n'est écrit nulle part hors la fonction auto_verify_kyc_dossier", () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8')
        const writes = TS_WRITE.test(src) || SQL_SET.test(src) || SQL_ASSIGN.test(src)
        if (!writes) continue
        // Allowlist : tout fichier qui mentionne la fonction trigger légitime, sous
        // TOUTES ses formes — le baseline l'écrit en identifiant quoté
        // "public"."auto_verify_kyc_dossier"(), le guard 20260522_003 la cite en commentaire.
        // Un writer rogue (edge/app) ne référencerait jamais ce trigger SQL.
        if (src.includes('auto_verify_kyc_dossier')) continue
        offenders.push(file)
      }
    }
    expect(offenders, `Writers verified interdits: ${offenders.join(', ')}`).toEqual([])
  })
})
```

- [ ] **Step 2 : Lancer — doit PASSER sur le code actuel (l'invariant tient déjà)**

Run: `npx vitest run tests/unit/kyc-verified-source-guard.test.ts`
Expected: PASS (1 test). Le seul writer `SET dossier_status='verified'` est dans `auto_verify_kyc_dossier` (baseline), allowlisté. Si FAIL, lire la liste `offenders` : soit un writer interdit existe (bug LBA → stop, investiguer), soit un nouveau fichier légitime lit 'verified' d'une façon que les regex confondent avec une écriture (affiner l'allowlist).

- [ ] **Step 3 : Écrire le backend (RAISE réel via le guard)**

`tests/backend/kyc-verified-guard.spec.ts` :

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('KYC — guard_manual_kyc_verified', () => {
  let setup: TwoAgenciesSetup
  let caseId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data: contact } = await service.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Guard', last_name: `Test ${setup.stamp}`,
      entity_type: 'pp', type: 'buyer', source: 'manual',
    }).select('id').single()
    const { data: kc, error } = await service.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: contact!.id, type: 'buyer_pp', vigilance: 'standard',
    }).select('id').single()
    if (error) throw new Error(`kyc_cases insert: ${error.message}`)
    caseId = kc!.id
  })

  it("refuse un UPDATE direct dossier_status='verified' (check_violation)", async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_cases')
      .update({ dossier_status: 'verified' }).eq('id', caseId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/Bypass manuel refusé|check/i)
  })

  it('a écrit un activity_events critical (tentative bloquée)', async () => {
    const service = serviceRoleClient()
    const { data } = await service.from('activity_events')
      .select('severity, metadata').eq('entity_id', caseId).eq('severity', 'critical')
    const blocked = (data ?? []).some(
      (e) => (e.metadata as Record<string, unknown>)?.reason === 'manual_verified_bypass_blocked',
    )
    expect(blocked).toBe(true)
  })
})
```

- [ ] **Step 4 : Lancer le backend (si DB locale ; sinon skip auto)**

Run: `npm run test:backend -- kyc-verified-guard`
Expected: PASS si `supabase start` + clés présentes ; sinon `skipped` (pas d'échec CI).

- [ ] **Step 5 : Commit**

```bash
git add tests/unit/kyc-verified-source-guard.test.ts tests/backend/kyc-verified-guard.spec.ts
git commit -m "test(kyc): P0 guard — aucun chemin ne force dossier_status=verified"
```

---

## Task 2 : Migration — généraliser `kyc_magic_link_uploads`

**Files:**
- Create: `supabase/migrations/20260602140000_kyc_wa_uploads_generalize.sql`

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/20260602140000_kyc_wa_uploads_generalize.sql` :

```sql
-- KYC par WhatsApp — généralise kyc_magic_link_uploads pour accueillir le canal WhatsApp.
-- D3 : on réutilise la table (déjà ocr_fields/ocr_provider/storage_path/sha256/document_id)
-- au lieu d'en créer une dédiée. magic_link_id devient nullable ; +source/kyc_case_id/wa_message_id.

-- 1. magic_link_id nullable (uploads WhatsApp n'ont pas de magic link)
ALTER TABLE public.kyc_magic_link_uploads ALTER COLUMN magic_link_id DROP NOT NULL;

-- 2. Provenance du canal
ALTER TABLE public.kyc_magic_link_uploads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'magic_link',
  ADD COLUMN IF NOT EXISTS kyc_case_id uuid REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wa_message_id text;

ALTER TABLE public.kyc_magic_link_uploads
  ADD CONSTRAINT kyc_magic_link_uploads_source_check
  CHECK (source IN ('magic_link', 'whatsapp'));

-- 3. Cohérence : un upload a SOIT un magic_link, SOIT un kyc_case (jamais ni l'un ni l'autre).
ALTER TABLE public.kyc_magic_link_uploads
  ADD CONSTRAINT kyc_magic_link_uploads_origin_check
  CHECK (magic_link_id IS NOT NULL OR kyc_case_id IS NOT NULL);

-- 4. Index pour lister les pièces d'un dossier
CREATE INDEX IF NOT EXISTS idx_kyc_ml_uploads_case
  ON public.kyc_magic_link_uploads (kyc_case_id, uploaded_at)
  WHERE kyc_case_id IS NOT NULL;

-- 5. RLS : les policies SELECT/UPDATE existantes scopent déjà sur agency_id = get_my_agency_id()
--    → restent valides (agency_id est NOT NULL et fourni à l'insert service-role). Rien à changer.
COMMENT ON COLUMN public.kyc_magic_link_uploads.source IS 'Canal : magic_link (client) ou whatsapp (agent transfère la pièce).';
COMMENT ON COLUMN public.kyc_magic_link_uploads.kyc_case_id IS 'FK directe au dossier (canal whatsapp). NULL pour magic_link (lien via magic_link_id).';
```

- [ ] **Step 2 : NE PAS appliquer en prod — la migration se déploie via CI**

Les migrations sont poussées par `.github/workflows/deploy.yml` (`supabase db push`) au merge sur `main`. **N'applique JAMAIS cette migration à la base distante depuis ici** (ni MCP `apply_migration`, ni `db push`). Le fichier committé suffit.
Si (et seulement si) une stack Supabase locale tourne (`supabase status` répond), tu peux la tester : `supabase migration up`. Sinon, saute — le backend test (Step 4) couvre la vérification quand une DB locale existe.

- [ ] **Step 3 : Mettre à jour les types TS à la main (pas de DB locale pour régénérer)**

`src/types/database.ts` est généré mais on ne peut pas le régénérer sans DB locale. Édition bornée : localiser le bloc `kyc_magic_link_uploads:` (sections `Row`, `Insert`, `Update`).
- `Row` : `magic_link_id: string` → `magic_link_id: string | null` ; ajouter `source: string`, `kyc_case_id: string | null`, `wa_message_id: string | null`.
- `Insert` : `magic_link_id?: string | null` ; ajouter `source?: string`, `kyc_case_id?: string | null`, `wa_message_id?: string | null`.
- `Update` : idem en optionnel.
Expected: `npm run build` passe. Non bloquant si le bloc est introuvable — le signaler (les edge functions ne sont pas typées via ce fichier).

- [ ] **Step 4 : Écrire le backend RLS/forme**

`tests/backend/kyc-wa-uploads-rls.spec.ts` :

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClientFor } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('kyc_magic_link_uploads — canal whatsapp', () => {
  let setup: TwoAgenciesSetup
  let caseId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data: contact } = await service.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Wa', last_name: `Up ${setup.stamp}`,
      entity_type: 'pp', type: 'buyer', source: 'manual',
    }).select('id').single()
    const { data: kc } = await service.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: contact!.id, type: 'buyer_pp', vigilance: 'standard',
    }).select('id').single()
    caseId = kc!.id
  })

  it('accepte un upload whatsapp sans magic_link_id', async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_magic_link_uploads').insert({
      agency_id: setup.agencyAId, kyc_case_id: caseId, source: 'whatsapp',
      wa_message_id: 'wamid.TEST', type: 'identity', filename: 'cni.jpg',
      size_bytes: 1234, mime_type: 'image/jpeg', storage_path: `${setup.agencyAId}/${caseId}/cni.jpg`,
    })
    expect(error).toBeNull()
  })

  it('rejette un upload sans magic_link NI kyc_case (origin_check)', async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_magic_link_uploads').insert({
      agency_id: setup.agencyAId, source: 'whatsapp', type: 'other', filename: 'x.pdf',
      size_bytes: 1, storage_path: 'x',
    })
    expect(error).not.toBeNull()
  })

  it("l'agence B ne voit pas l'upload de l'agence A (RLS)", async () => {
    const b = anonClientFor(setup.agentBToken)
    const { data } = await b.from('kyc_magic_link_uploads').select('id').eq('kyc_case_id', caseId)
    expect(data ?? []).toEqual([])
  })
})
```

> Note : `anonClientFor` / `setup.agentBToken` suivent le pattern de `tests/backend/documents-storage-rls.spec.ts`. Si le helper diffère, calquer sur ce fichier.

- [ ] **Step 5 : Lancer + commit**

Run: `npm run test:backend -- kyc-wa-uploads-rls`
Expected: 3 PASS (ou skipped sans DB).

```bash
git add supabase/migrations/20260602140000_kyc_wa_uploads_generalize.sql tests/backend/kyc-wa-uploads-rls.spec.ts src/types/database.ts
git commit -m "feat(kyc): migration — kyc_magic_link_uploads accueille le canal whatsapp"
```

---

## Task 3 : Module pur `kyc-extract.ts` (prompt + parser + dérivations)

**Files:**
- Create: `supabase/functions/_shared/kyc-extract.ts`
- Create: `supabase/functions/_shared/kyc-extract.test.ts`
- Modify: `vitest.config.ts` (ajouter au `include`)

- [ ] **Step 1 : Écrire les tests d'abord**

`supabase/functions/_shared/kyc-extract.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import {
  parseKycOcr, deriveKycType, kycTypeToEntityType, kycCategoryMaps, KYC_DOC_PROMPT,
} from './kyc-extract'

describe('deriveKycType', () => {
  it('seller/landlord → seller, sinon buyer', () => {
    expect(deriveKycType('seller', 'pp')).toBe('seller_pp')
    expect(deriveKycType('landlord', 'pm')).toBe('seller_pm')
    expect(deriveKycType('buyer', 'pp')).toBe('buyer_pp')
    expect(deriveKycType('tenant', 'pm')).toBe('buyer_pm')
    expect(deriveKycType('investor', null)).toBe('buyer_pp') // entity null → pp
    expect(deriveKycType(null, 'pm')).toBe('buyer_pm')
  })
})

describe('kycTypeToEntityType', () => {
  it('_pm → entity, sinon individual', () => {
    expect(kycTypeToEntityType('buyer_pm')).toBe('entity')
    expect(kycTypeToEntityType('seller_pm')).toBe('entity')
    expect(kycTypeToEntityType('buyer_pp')).toBe('individual')
    expect(kycTypeToEntityType('seller_pp')).toBe('individual')
  })
})

describe('kycCategoryMaps', () => {
  it('mappe identity/address/funds vers checklist/upload/document', () => {
    expect(kycCategoryMaps('identity')).toEqual({ checklist: 'id', upload: 'identity', document: 'identity' })
    expect(kycCategoryMaps('address')).toEqual({ checklist: 'address', upload: 'address', document: 'domicile' })
    expect(kycCategoryMaps('funds')).toEqual({ checklist: 'funds', upload: 'funds', document: 'financial' })
  })
  it('retourne null pour une catégorie hors documents (pep/sanctions/inconnu)', () => {
    expect(kycCategoryMaps('pep')).toBeNull()
    expect(kycCategoryMaps('zzz')).toBeNull()
  })
})

describe('parseKycOcr', () => {
  it('parse un bloc JSON propre', () => {
    const out = parseKycOcr('{"nom":"Vaucher","prenom":"Enora","numero":"X123","expiration":"2028-08"}')
    expect(out).toMatchObject({ nom: 'Vaucher', prenom: 'Enora', numero: 'X123' })
  })
  it('extrait le JSON même entouré de texte/markdown', () => {
    const out = parseKycOcr('Voici les champs:\n```json\n{"montant":"850000","devise":"CHF"}\n```\nmerci')
    expect(out).toEqual({ montant: '850000', devise: 'CHF' })
  })
  it('retourne {} (jamais throw) sur texte non-JSON', () => {
    expect(parseKycOcr('aucune donnée lisible')).toEqual({})
    expect(parseKycOcr('')).toEqual({})
    expect(parseKycOcr(null)).toEqual({})
  })
  it('ignore un JSON non-objet (array, scalaire)', () => {
    expect(parseKycOcr('[1,2,3]')).toEqual({})
    expect(parseKycOcr('"juste une string"')).toEqual({})
  })
})

describe('KYC_DOC_PROMPT', () => {
  it('demande une sortie JSON stricte', () => {
    expect(KYC_DOC_PROMPT).toMatch(/JSON/)
  })
})
```

- [ ] **Step 2 : Lancer — doit échouer (module absent)**

Run: `npx vitest run supabase/functions/_shared/kyc-extract.test.ts`
Expected: FAIL — `Failed to resolve import './kyc-extract'`.

- [ ] **Step 3 : Implémenter le module pur**

`supabase/functions/_shared/kyc-extract.ts` :

```ts
// Pur (testable Node) : prompt OCR KYC, parser tolérant, et dérivations de typage.
// Aucun I/O, aucune clé. L'exécuteur impur (whatsapp-actions.ts) importe d'ici.

export type KycPersonType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycDocCategory = 'identity' | 'address' | 'funds'

/** Prompt passé à read_document (Gemini) pour une extraction STRUCTURÉE en JSON.
 *  Champs PROPOSÉS, jamais traités comme vérité (validation humaine MLRO). */
export const KYC_DOC_PROMPT = `Tu es un OCR de conformité. Lis ce document et renvoie UNIQUEMENT un objet JSON valide (aucun texte autour, pas de markdown).
Si le document est une pièce d'identité : {"doc":"identite","type":"...","nom":"...","prenom":"...","numero":"...","naissance":"AAAA-MM-JJ","nationalite":"...","expiration":"AAAA-MM"}.
Si c'est un justificatif de fonds : {"doc":"fonds","montant":"...","devise":"CHF","date":"AAAA-MM-JJ","institution":"...","nature":"..."}.
Si c'est un justificatif de domicile : {"doc":"domicile","nom":"...","adresse":"...","date":"AAAA-MM-JJ"}.
Mets une chaîne vide pour tout champ illisible. Ne devine jamais. Réponds par {} si le document est inexploitable.`

/** Dérive le kyc_person_type depuis le contact (contacts.type + contacts.entity_type). */
export function deriveKycType(
  contactType: string | null | undefined,
  entityType: string | null | undefined,
): KycPersonType {
  const side = contactType === 'seller' || contactType === 'landlord' ? 'seller' : 'buyer'
  const company = entityType === 'pm'
  if (side === 'seller') return company ? 'seller_pm' : 'seller_pp'
  return company ? 'buyer_pm' : 'buyer_pp'
}

/** Body kyc-screening : entité morale (_pm) → 'entity', sinon 'individual'. */
export function kycTypeToEntityType(type: KycPersonType): 'individual' | 'entity' {
  return type.endsWith('_pm') ? 'entity' : 'individual'
}

/** Mappe une catégorie de pièce vers les 3 enums : checklist_items.category,
 *  kyc_magic_link_uploads.type, documents.document_category.
 *  Retourne null pour les catégories non-documentaires (pep/sanctions) ou inconnues. */
export function kycCategoryMaps(
  category: string,
): { checklist: string; upload: string; document: string } | null {
  switch (category) {
    case 'identity': return { checklist: 'id', upload: 'identity', document: 'identity' }
    case 'address': return { checklist: 'address', upload: 'address', document: 'domicile' }
    case 'funds': return { checklist: 'funds', upload: 'funds', document: 'financial' }
    default: return null
  }
}

/** Extrait un objet JSON d'une sortie OCR (tolérant : markdown, texte autour).
 *  Ne throw JAMAIS — renvoie {} si rien d'exploitable. */
export function parseKycOcr(text: string | null | undefined): Record<string, unknown> {
  if (!text) return {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return {}
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
```

- [ ] **Step 4 : Enregistrer le test dans vitest**

Dans `vitest.config.ts`, ajouter `'supabase/functions/_shared/kyc-extract.test.ts'` à la fin du tableau `include` (juste après `'supabase/functions/_shared/whatsapp-format.test.ts'`).

- [ ] **Step 5 : Lancer — doit passer**

Run: `npx vitest run supabase/functions/_shared/kyc-extract.test.ts`
Expected: PASS (tous les `describe`).

- [ ] **Step 6 : Commit**

```bash
git add supabase/functions/_shared/kyc-extract.ts supabase/functions/_shared/kyc-extract.test.ts vitest.config.ts
git commit -m "feat(kyc): module pur kyc-extract (prompt OCR + parser + dérivations)"
```

---

## Task 4 : Outil `open_kyc_case` (tier confirm)

Flow confirm : catalogue → tier `confirm` → `stashPending` appelle `prepareOpenKycCase` (résout le contact, dérive type/vigilance, construit le prompt humain) → l'agent dit « oui » → `executePending` appelle `executeOpenKycCase` (INSERT).

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-tools.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.ts` (+ `.test.ts`)
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`
- Modify: `supabase/functions/whatsapp-agent/index.ts` (stashPending)
- Modify: `supabase/functions/whatsapp-webhook/index.ts` (executePending)

- [ ] **Step 1 : Tier — test d'abord**

Dans `supabase/functions/_shared/whatsapp-agent-router.test.ts`, ajouter dans le bloc tiers :

```ts
  it('open_kyc_case est confirm (création de dossier LBA → validation agent)', () => {
    expect(toolTier('open_kyc_case')).toBe('confirm')
  })
```

- [ ] **Step 2 : Lancer — doit échouer (défaut 'confirm' fortuit ? non : la clé n'existe pas encore, mais toolTier renvoie 'confirm' par défaut)**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: PASS *par défaut* (unknown ⇒ confirm). On rend l'intention explicite à l'étape suivante (le test documente le contrat).

- [ ] **Step 3 : Déclarer le tier explicitement**

Dans `whatsapp-agent-router.ts`, dans `TOOL_TIERS`, ajouter après `record_offer: 'confirm',` :

```ts
  open_kyc_case: 'confirm',
  attach_kyc_document: 'auto',
  run_kyc_screening: 'auto',
```

(On déclare les 3 d'un coup — Tâches 5/6 ajoutent leurs assertions de tier.)

- [ ] **Step 4 : Catalogue — définir l'outil**

Dans `whatsapp-tools.ts`, avant le `]` fermant de `WHATSAPP_TOOLS`, ajouter :

```ts
  {
    type: 'function',
    function: {
      name: 'open_kyc_case',
      description: "Ouvre un dossier KYC (LBA) pour un contact. Le système retrouve le contact, déduit le type (acheteur/vendeur, personne physique/morale) et confirme avant de créer. Appelle directement l'outil sans rien vérifier avant. Exemples : « ouvre un KYC pour Dubois », « lance la conformité de Mme Vaucher en vigilance renforcée ». contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' },
          vigilance: { type: 'string', enum: ['standard', 'renforced'], description: "Défaut 'standard'. 'renforced' si l'agent le demande (PEP, montant élevé…)." },
          entity: { type: 'string', enum: ['pp', 'pm'], description: "Optionnel. Personne physique (pp) ou morale (pm). Défaut = celui du contact." },
        },
        required: ['contact_id'],
      },
    },
  },
```

- [ ] **Step 5 : Exécuteurs — `prepareOpenKycCase` + `executeOpenKycCase`**

Dans `whatsapp-actions.ts`, importer en tête (avec les autres imports `_shared`) :

```ts
import { deriveKycType, type KycPersonType } from './kyc-extract.ts'
```

Puis ajouter (après `executeRecordOffer`, près des autres `prepare*`/`execute*`) :

```ts
const KYC_TYPE_LABELS: Record<KycPersonType, string> = {
  buyer_pp: 'acheteur, personne physique',
  buyer_pm: 'acheteur, personne morale',
  seller_pp: 'vendeur, personne physique',
  seller_pm: 'vendeur, personne morale',
}

/** Confirm-tier : valide le contact + dérive le typage, construit le prompt + payload figé. */
export async function prepareOpenKycCase(ctx: ActionCtx, a: Args): Promise<Prepared> {
  if (!hasAgency(ctx)) return { ok: false, error: NO_AGENCY }
  const contactId = s(a.contact_id)
  if (!contactId) return { ok: false, error: 'Erreur: contact_id requis (via search_contacts).' }
  const { data: contact } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name, type, entity_type')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (!contact) return { ok: false, error: 'Erreur: contact introuvable dans ton agence.' }

  const vigilance = a.vigilance === 'renforced' ? 'renforced' : 'standard'
  const entity = a.entity === 'pm' ? 'pm' : a.entity === 'pp' ? 'pp' : (contact.entity_type ?? 'pp')
  const type = deriveKycType(contact.type, entity)
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'
  const vigLabel = vigilance === 'renforced' ? 'renforcée' : 'standard'

  return {
    ok: true,
    prompt: `J'ouvre un dossier KYC pour ${name} (${KYC_TYPE_LABELS[type]}, vigilance ${vigLabel}). Tu confirmes ? (« oui » / « non »)`,
    payload: { contact_id: contactId, type, vigilance },
  }
}

/** Post-« oui » : INSERT kyc_cases (le trigger seed_kyc_lba_checks crée les 5 checks). */
export async function executeOpenKycCase(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), type = s(a.type), vigilance = s(a.vigilance) ?? 'standard'
  if (!contactId || !type) return 'Action incomplète, dossier non créé.'
  if (!(await contactInAgency(ctx, contactId))) return 'Erreur: contact introuvable dans ton agence.'

  const { data, error } = await ctx.supabase.from('kyc_cases').insert({
    agency_id: ctx.agencyId,
    contact_id: contactId,
    type,
    vigilance,
    risk_level: vigilance === 'renforced' ? 'medium' : 'low',
  }).select('id').single()
  if (error) return `Erreur ouverture KYC: ${error.message}`

  // Audit IA (le seed trigger écrit déjà 'Dossier KYC ouvert' avec actor 'user'/NULL ;
  // on ajoute la trace canal whatsapp côté IA pour la timeline contact).
  await logTimeline(ctx, 'Dossier KYC ouvert', 'via WhatsApp', contactId)
  return `Dossier KYC ouvert. Les pièces à fournir : identité, domicile, screening PEP, sanctions${vigilance === 'renforced' ? ', source des fonds' : ''}. Tu peux me transférer les documents.`
}
```

- [ ] **Step 6 : Câbler `stashPending` (prompt) dans whatsapp-agent**

Dans `whatsapp-agent/index.ts`, importer `prepareOpenKycCase` dans le bloc d'import depuis `whatsapp-actions.ts`. Puis, dans `stashPending`, ajouter une branche (avant le `else if (tool === 'send_client_message')`) :

```ts
  if (tool === 'open_kyc_case') {
    const p = await prepareOpenKycCase(ctx, args)
    if (!p.ok) return { status: 'error', error: p.error }
    prompt = p.prompt; storeArgs = p.payload
  } else if (tool === 'send_listings') {
```

(transformer le `if (tool === 'send_listings')` existant en `} else if (tool === 'send_listings') {` — il devient le 2ᵉ maillon de la chaîne.)

- [ ] **Step 7 : Câbler `executePending` (exécution) dans whatsapp-webhook**

Dans `whatsapp-webhook/index.ts`, importer `executeOpenKycCase` (ajouter au `import { execUpdatePipeline, executeRecordOffer, type ActionCtx } from '../_shared/whatsapp-actions.ts'`). Puis dans `executePending`, avant le `return "Type d'action inconnu, rien fait."` final :

```ts
  if (pending.tool === 'open_kyc_case') {
    const ctx: ActionCtx = { supabase: admin, profileId: agentLink.profile_id, agencyId: agentLink.agency_id }
    return executeOpenKycCase(ctx, pending.args)
  }
```

- [ ] **Step 8 : Vérifier (tier + build)**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: PASS (dont la nouvelle assertion open_kyc_case).
Run: `npm run build`
Expected: build OK (tsc + vite), zéro erreur de type.

- [ ] **Step 9 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-tools.ts supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/whatsapp-actions.ts supabase/functions/whatsapp-agent/index.ts supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat(kyc): outil WhatsApp open_kyc_case (confirm) — ouvre un dossier LBA"
```

---

## Task 5 : Outil `run_kyc_screening` (tier auto) + branche auth service-à-service

**Files:**
- Modify: `supabase/functions/kyc-screening/index.ts` (D6 — branche service)
- Modify: `supabase/functions/_shared/whatsapp-tools.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.test.ts`
- Modify: `supabase/functions/_shared/whatsapp-actions.ts`
- Modify: `supabase/functions/whatsapp-agent/index.ts` (runTool)

- [ ] **Step 1 : Tier — assertion**

Dans `whatsapp-agent-router.test.ts` :

```ts
  it('run_kyc_screening est auto (read-only externe, aucun contact client)', () => {
    expect(toolTier('run_kyc_screening')).toBe('auto')
  })
```

(Le tier `auto` a déjà été déclaré Tâche 4 Step 3.)

- [ ] **Step 2 : `kyc-screening` — ajouter la branche d'auth service (D6)**

Dans `supabase/functions/kyc-screening/index.ts` :

(a) En tête, ajouter l'import `createClient` (s'il n'est pas déjà importé) et un comparateur à temps constant. Si `safeEqual` n'existe pas localement, ajouter après les imports :

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Comparaison à temps constant (anti timing-attack sur le secret service-role).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
```

(b) Remplacer le bloc d'auth (actuellement `const auth = await requireAgentAuth(...)` + l'usage de `auth.supabase` / `auth.profile.agency_id`) par une résolution à deux chemins. Concrètement, juste après le `OPTIONS` handler et AVANT le parse `kyc_case_id`/`entity_type`, insérer :

```ts
    // Deux chemins d'auth :
    //  - service-à-service (whatsapp-agent) : Authorization = clé service-role → agency depuis le body (fiable, seul notre backend a la clé). Garde cross-agency conservée plus bas.
    //  - utilisateur (CRM) : requireAgentAuth (JWT).
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const isServiceCall = serviceKey !== '' && safeEqual(providedKey, serviceKey)

    const reqBody = (await req.json()) as { kyc_case_id?: string; entity_type?: string; agency_id?: string }

    let admin: ReturnType<typeof createClient>
    let callerAgencyId: string
    if (isServiceCall) {
      if (!reqBody.agency_id) {
        return new Response(JSON.stringify({ error: 'agency_id required for service call' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)
      callerAgencyId = reqBody.agency_id
    } else {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
      admin = auth.supabase
      callerAgencyId = auth.profile.agency_id
    }
    const { kyc_case_id, entity_type } = reqBody
```

(c) Remplacer dans le reste du handler : `auth.supabase` → `admin`, et `profile.agency_id` → `callerAgencyId`. **Conserver impérativement** la garde cross-agency (`if (preScreenCase.agency_id !== callerAgencyId) → 403`). Supprimer l'ancien `const { kyc_case_id, entity_type } = await req.json()` (le body est maintenant lu une seule fois plus haut).

> ⚠️ Le body ne doit être lu qu'UNE fois (`req.json()` n'est consommable qu'une fois). Vérifier qu'il ne reste pas un second `await req.json()`.

- [ ] **Step 3 : Catalogue — `run_kyc_screening`**

Dans `whatsapp-tools.ts`, avant le `]` fermant :

```ts
  {
    type: 'function',
    function: {
      name: 'run_kyc_screening',
      description: "Lance le screening LBA (PEP + listes de sanctions) sur le dossier KYC d'un contact. Read-only côté client, aucun message envoyé. Appelle directement. Exemples : « screen Dubois », « vérifie les sanctions pour Mme Vaucher ». contact_id via search_contacts. Il faut un dossier KYC déjà ouvert (open_kyc_case).",
      parameters: {
        type: 'object',
        properties: { contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' } },
        required: ['contact_id'],
      },
    },
  },
```

- [ ] **Step 4 : Exécuteur `execRunKycScreening` + helper `findOpenKycCase`**

Dans `whatsapp-actions.ts`, ajouter l'import :

```ts
import { kycTypeToEntityType, type KycPersonType } from './kyc-extract.ts'
```

(fusionner avec l'import `kyc-extract.ts` du Task 4). Puis ajouter :

```ts
/** Dernier dossier KYC d'un contact dans l'agence (ou null). */
async function findOpenKycCase(
  ctx: ActionCtx, contactId: string,
): Promise<{ id: string; type: KycPersonType; dossier_status: string } | null> {
  const { data } = await ctx.supabase
    .from('kyc_cases').select('id, type, dossier_status')
    .eq('contact_id', contactId).eq('agency_id', ctx.agencyId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as { id: string; type: KycPersonType; dossier_status: string } | null) ?? null
}

export async function execRunKycScreening(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id)
  if (!contactId) return 'Erreur: contact_id requis (via search_contacts).'
  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans ton agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Tu veux que j'en ouvre un ?`

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kyc-screening`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        kyc_case_id: kc.id,
        entity_type: kycTypeToEntityType(kc.type),
        agency_id: ctx.agencyId,
      }),
      signal: AbortSignal.timeout(40_000),
    })
  } catch {
    return 'Le screening a échoué (réseau). Réessaie dans un instant.'
  }
  if (res.status === 429) return 'Screening déjà lancé il y a quelques secondes — patiente un instant avant de relancer.'
  if (!res.ok) return `Le screening n'a pas pu aboutir (code ${res.status}).`
  const r = (await res.json().catch(() => ({}))) as {
    pep_status?: string; sanctions_status?: string; risk_level?: string
  }
  const pep = r.pep_status === 'match' ? 'PEP détecté ⚠️' : 'pas de PEP'
  const sanc = r.sanctions_status === 'match' ? 'correspondance sanctions ⚠️' : 'pas de sanction'
  const riskFr: Record<string, string> = { low: 'faible', medium: 'moyen', high: 'élevé' }
  const risk = riskFr[r.risk_level ?? ''] ?? r.risk_level ?? '—'
  return `Screening de ${name} : ${pep}, ${sanc}, risque ${risk}. Le dossier est prêt à valider dans le CRM (à toi de cocher les pièces et valider — je ne valide jamais à ta place).`
}
```

- [ ] **Step 5 : Dispatch `runTool` (auto)**

Dans `whatsapp-agent/index.ts`, importer `execRunKycScreening`, puis ajouter dans le `switch` de `runTool` (avant `default:`) :

```ts
    case 'run_kyc_screening': return execRunKycScreening(ctx, args)
```

- [ ] **Step 6 : Vérifier**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: PASS (assertion run_kyc_screening).
Run: `deno check supabase/functions/kyc-screening/index.ts supabase/functions/whatsapp-agent/index.ts` (si Deno dispo) — sinon `npm run build`.
Expected: pas d'erreur de type.

- [ ] **Step 7 : Commit**

```bash
git add supabase/functions/kyc-screening/index.ts supabase/functions/_shared/whatsapp-tools.ts supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/whatsapp-actions.ts supabase/functions/whatsapp-agent/index.ts
git commit -m "feat(kyc): outil WhatsApp run_kyc_screening (auto) + auth service-à-service kyc-screening"
```

---

## Task 6 : Outil `attach_kyc_document` (tier auto) + threading média

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts` (`ActionCtx.inboundMedia` + `execAttachKycDocument`)
- Modify: `supabase/functions/whatsapp-agent/index.ts` (parse `inboundMedia`, `ctx`)
- Modify: `supabase/functions/whatsapp-webhook/index.ts` (`callAgentBrain` thread média)
- Modify: `supabase/functions/_shared/whatsapp-tools.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 1 : Tier — assertion**

Dans `whatsapp-agent-router.test.ts` :

```ts
  it('attach_kyc_document est auto (joint une pièce, aucun envoi client)', () => {
    expect(toolTier('attach_kyc_document')).toBe('auto')
  })
```

- [ ] **Step 2 : Threader la référence média webhook → agent**

Dans `whatsapp-webhook/index.ts`, fonction `callAgentBrain` : élargir le type `msg` et ajouter `inboundMedia` au body POST :

```ts
async function callAgentBrain(
  agentLink: { profile_id: string; agency_id: string | null },
  msg: { fromPhone: string; body: string | null; providerMessageId: string; mediaId: string | null; mediaType: string | null },
  messageText: string,
): Promise<string> {
  try {
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        profileId: agentLink.profile_id,
        waNumber: msg.fromPhone,
        message: messageText,
        currentMessageId: msg.providerMessageId,
        inboundMedia:
          msg.mediaId && (msg.mediaType === 'image' || msg.mediaType === 'document')
            ? { mediaId: msg.mediaId, messageId: msg.providerMessageId }
            : null,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const data = await r.json().catch(() => ({}))
    return (data?.reply as string) || "Désolé, je n'ai pas pu traiter ta demande."
  } catch (err) {
    console.error('whatsapp-agent call failed:', (err as Error)?.name ?? 'error')
    return "Désolé, je n'ai pas pu traiter ta demande pour le moment."
  }
}
```

> Le `msg` passé à `callAgentBrain` (dans `processAgentMessage`) porte déjà `mediaId`/`mediaType` (cf. le type du paramètre `msg` de `processAgentMessage`). Si l'appel `callAgentBrain(agentLink, msg, userText)` ne compile pas, vérifier que `msg` inclut bien `mediaId`/`mediaType` (sinon les ajouter à la destructuration en amont).

- [ ] **Step 3 : Recevoir `inboundMedia` côté agent + `ActionCtx`**

Dans `whatsapp-agent/index.ts`, élargir le type du body et la destructuration :

```ts
  let body: { profileId?: string; waNumber?: string; message?: string; currentMessageId?: string; inboundMedia?: { mediaId: string; messageId: string } | null }
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, 400) }
  const { profileId, waNumber = '', message, currentMessageId, inboundMedia } = body
```

Et à la construction du `ctx` :

```ts
  const ctx: ActionCtx = { supabase, profileId, agencyId: link.agency_id ?? null, inboundMedia: inboundMedia ?? null }
```

Dans `whatsapp-actions.ts`, élargir l'interface `ActionCtx` :

```ts
export interface ActionCtx {
  supabase: SupabaseClient
  profileId: string
  agencyId: string | null
  inboundMedia?: { mediaId: string; messageId: string } | null
}
```

> Champ optionnel → rétro-compatible : `executePending` (webhook) construit `ActionCtx` sans lui, c'est `undefined`, OK.

- [ ] **Step 4 : Catalogue — `attach_kyc_document`**

Dans `whatsapp-tools.ts`, avant le `]` fermant :

```ts
  {
    type: 'function',
    function: {
      name: 'attach_kyc_document',
      description: "Joint au dossier KYC d'un contact la pièce que TU VIENS d'envoyer dans ce message (photo/scan/PDF). À n'appeler QUE si tu désignes explicitement la pièce (« c'est la pièce d'identité de Dubois », « justif de domicile de Mme Vaucher »). Le système lit la pièce et la joint — il ne coche jamais la case (réservé au validateur). contact_id via search_contacts.",
      parameters: {
        type: 'object',
        properties: {
          contact_id: { type: 'string', description: 'ID du contact (via search_contacts).' },
          category: { type: 'string', enum: ['identity', 'address', 'funds'], description: "Type de pièce : identity (pièce d'identité), address (justif. domicile), funds (justif. fonds)." },
        },
        required: ['contact_id', 'category'],
      },
    },
  },
```

- [ ] **Step 5 : Exécuteur `execAttachKycDocument`**

Dans `whatsapp-actions.ts`, importer les helpers média/vision/extraction (fusionner avec l'import `kyc-extract.ts`) :

```ts
import { fetchMetaMedia, extFromMime } from './whatsapp-media.ts'
import { readDocument } from './vision.ts'
import { KYC_DOC_PROMPT, parseKycOcr, kycCategoryMaps } from './kyc-extract.ts'
```

Puis :

```ts
export async function execAttachKycDocument(ctx: ActionCtx, a: Args): Promise<string> {
  if (!hasAgency(ctx)) return NO_AGENCY
  const contactId = s(a.contact_id), category = s(a.category)
  if (!contactId || !category) return 'Erreur: contact_id et category requis.'
  const maps = kycCategoryMaps(category)
  if (!maps) return "Erreur: catégorie invalide (identity, address ou funds)."
  if (!ctx.inboundMedia) return "Je ne vois pas de document dans ce message. Envoie-moi la pièce (photo ou PDF) avec ta consigne."

  const contact = await contactInAgency(ctx, contactId)
  if (!contact) return 'Erreur: contact introuvable dans ton agence.'
  const name = `${(contact.first_name ?? '').trim()} ${(contact.last_name ?? '').trim()}`.trim() || 'ce contact'

  const kc = await findOpenKycCase(ctx, contactId)
  if (!kc) return `Aucun dossier KYC ouvert pour ${name}. Ouvre-le d'abord (« ouvre un KYC pour ${name} »).`

  // 1. Re-fetch des bytes (le webhook les a lâchés après l'OCR générique) + OCR structuré KYC.
  let bytes: Uint8Array, mime: string | null
  try {
    const media = await fetchMetaMedia(ctx.inboundMedia.mediaId, {
      metaToken: Deno.env.get('META_WHATSAPP_TOKEN') ?? '',
      apiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
    })
    bytes = media.bytes; mime = media.mime
  } catch {
    return "Je n'ai pas pu récupérer le document (lien Meta expiré ?). Renvoie-le."
  }
  const ocr = await readDocument(bytes, mime, Deno.env.get('GEMINI_API_KEY') ?? '', { prompt: KYC_DOC_PROMPT })
  const ocrFields = ocr.ok ? parseKycOcr(ocr.text) : {}

  // 2. Upload Storage (bucket privé kyc-magic-link, même que le canal magic link)
  const ext = extFromMime(mime)
  const path = `${ctx.agencyId}/${kc.id}/${ctx.inboundMedia.messageId}.${ext}`
  const { error: upErr } = await ctx.supabase.storage
    .from('kyc-magic-link')
    .upload(path, bytes, { contentType: mime ?? 'application/octet-stream', upsert: true })
  if (upErr) return `Erreur de stockage de la pièce: ${upErr.message}`

  // 3. SHA-256 (preuve d'intégrité FINMA)
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')

  // 4. Row documents (canonique, kyc_case_id → rétention 10 ans auto via trigger)
  const filename = `${category}_${ctx.inboundMedia.messageId}.${ext}`
  const { data: docRow, error: docErr } = await ctx.supabase.from('documents').insert({
    agency_id: ctx.agencyId,
    kyc_case_id: kc.id,
    name: filename,
    type: `kyc_${category}`,
    storage_path: path,
    size_bytes: bytes.byteLength,
    status: 'available',
    document_category: maps.document,
    sha256_hash: sha256,
    uploaded_by: null,
  }).select('id').single()
  if (docErr) {
    await ctx.supabase.storage.from('kyc-magic-link').remove([path])
    return `Erreur d'enregistrement du document: ${docErr.message}`
  }

  // 5. Row kyc_magic_link_uploads (canal whatsapp + OCR)
  await ctx.supabase.from('kyc_magic_link_uploads').insert({
    agency_id: ctx.agencyId,
    kyc_case_id: kc.id,
    source: 'whatsapp',
    wa_message_id: ctx.inboundMedia.messageId,
    type: maps.upload,
    filename,
    size_bytes: bytes.byteLength,
    mime_type: mime,
    storage_path: path,
    sha256_hash: sha256,
    ocr_fields: ocrFields,
    ocr_provider: 'gemini',
    ocr_completed_at: ocr.ok ? new Date().toISOString() : null,
    document_id: docRow.id,
  })

  // 6. Lier la pièce à l'item de checklist (document_id) — JAMAIS is_completed (D2 : réservé MLRO)
  await ctx.supabase.from('kyc_checklist_items')
    .update({ document_id: docRow.id })
    .eq('kyc_case_id', kc.id).eq('category', maps.checklist)

  // 7. Audit IA
  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: null, actor_kind: 'ai',
    action: 'kyc_document_attached', entity_type: 'kyc_case', entity_id: kc.id,
    category: 'kyc', severity: 'info',
    metadata: { via: 'whatsapp', profile_id: ctx.profileId, contact_id: contactId, category, document_id: docRow.id },
  }).then(({ error }) => { if (error) console.error('kyc attach audit failed') })

  // 8. Restituer ce qui a été lu (humain, jamais d'ID brut)
  const read = summarizeKycOcr(ocrFields)
  const catLabel = category === 'identity' ? "pièce d'identité" : category === 'address' ? 'justificatif de domicile' : 'justificatif de fonds'
  return `${catLabel.charAt(0).toUpperCase() + catLabel.slice(1)} de ${name} jointe au dossier${read ? ` — ${read}` : ''}. (Je ne coche pas la case : c'est à toi de valider dans le CRM.)`
}

/** Résumé humain des champs OCR (best-effort, jamais d'erreur). */
function summarizeKycOcr(f: Record<string, unknown>): string {
  const parts: string[] = []
  const get = (k: string) => (typeof f[k] === 'string' && (f[k] as string).trim() ? (f[k] as string).trim() : null)
  const nom = [get('prenom'), get('nom')].filter(Boolean).join(' ')
  if (nom) parts.push(nom)
  if (get('numero')) parts.push(`n° ${get('numero')}`)
  if (get('expiration')) parts.push(`expire ${get('expiration')}`)
  if (get('montant')) parts.push(`${get('montant')} ${get('devise') ?? ''}`.trim())
  if (get('adresse')) parts.push(get('adresse')!)
  return parts.join(', ')
}
```

- [ ] **Step 6 : Dispatch `runTool` (auto)**

Dans `whatsapp-agent/index.ts`, importer `execAttachKycDocument`, puis ajouter dans `runTool` (avant `default:`) :

```ts
    case 'attach_kyc_document': return execAttachKycDocument(ctx, args)
```

- [ ] **Step 7 : Vérifier**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts supabase/functions/_shared/kyc-extract.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 8 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-actions.ts supabase/functions/whatsapp-agent/index.ts supabase/functions/whatsapp-webhook/index.ts supabase/functions/_shared/whatsapp-tools.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
git commit -m "feat(kyc): outil WhatsApp attach_kyc_document (auto) + threading média webhook→agent"
```

---

## Task 7 : Intégration finale — build, lint, déploiement

**Files:** aucun nouveau code ; vérifications globales.

- [ ] **Step 1 : Suite unitaire complète**

Run: `npm run test:unit`
Expected: PASS, dont `kyc-extract.test.ts`, `whatsapp-agent-router.test.ts` (3 nouvelles assertions de tier), `kyc-verified-source-guard.test.ts`.

- [ ] **Step 2 : Lint + build**

Run: `npm run lint && npm run build`
Expected: zéro erreur ESLint, build tsc+vite OK.

- [ ] **Step 3 : Backend (si DB locale)**

Run: `npm run test:backend -- kyc`
Expected: `kyc-verified-guard` + `kyc-wa-uploads-rls` PASS (ou skipped sans clés).

- [ ] **Step 4 : Déploiement edge functions**

Les fonctions modifiées (`whatsapp-agent`, `whatsapp-webhook`, `kyc-screening`) se déploient via le pipeline existant (GitHub Actions → Supabase Edge Functions auto-deploy) au merge. Aucune nouvelle variable secrète : `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `META_WHATSAPP_TOKEN`, `DILISENSE_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sont déjà en place.
Vérifier que `whatsapp-agent` a bien `verify_jwt = false` (déjà le cas — il s'auto-protège via le secret service-role). Vérifier que `kyc-screening` garde son `verify_jwt` actuel (le chemin service compare le token lui-même, indépendant de la plateforme).

- [ ] **Step 5 : Smoke test manuel (post-déploiement, conversation WhatsApp réelle)**

1. « ouvre un KYC pour <contact de test> » → MEGGA confirme avec type/vigilance dérivés → « oui » → « Dossier KYC ouvert… ».
2. Envoyer une photo d'une fausse CNI + « c'est la pièce d'identité de <contact> » → « Pièce d'identité de … jointe au dossier — … (Je ne coche pas la case…) ».
3. « screen <contact> » → « Screening de … : pas de PEP, pas de sanction, risque faible. … prêt à valider … ».
4. Dans le CRM, ouvrir le dossier → la pièce est visible, la case **n'est pas** cochée, `dossier_status` ≠ `verified`.

- [ ] **Step 6 : Mettre à jour le cerveau système**

Éditer `.claude-flow/knowledge/megga-memory.seed.json` : marquer `megga/kyc-whatsapp-spec` comme livré (Phase 1), ajouter les 3 outils et la décision D6 (auth service-à-service). Puis `npm run ruflo:seed`. Mettre à jour `docs/system-map.md` (section KYC + WhatsApp) et `docs/CHANGELOG.md`.

```bash
git add .claude-flow/knowledge/megga-memory.seed.json docs/system-map.md docs/CHANGELOG.md
git commit -m "docs(kyc): cerveau + system-map — KYC par WhatsApp Phase 1 livrée"
```

---

## Self-Review

**1. Couverture du spec :**
- Outil `open_kyc_case` (confirm, dérive type/vigilance, INSERT, seed auto) → Tâche 4. ✅
- Outil `attach_kyc_document` (OCR KYC structuré, stockage, lien checklist sans `is_completed`, restitution) → Tâche 6. ✅
- Outil `run_kyc_screening` (auto, Dilisense, résultat en clair + « prêt à valider ») → Tâche 5. ✅
- Prompt KYC `read_document` → `KYC_DOC_PROMPT` (Tâche 3). ✅
- Migration légère `kyc_magic_link_uploads` (source/kyc_case_id/wa_message_id + magic_link_id nullable) → Tâche 2. ✅
- Notif « prêt à valider » → repliée dans la réponse de `run_kyc_screening` (Phase 1 = tout en conversation, pas d'outbound séparé). ✅ *(Déviation justifiée : le screening ne met PAS `dossier_status='pending'` — c'est le 1ᵉʳ tick MLRO qui le fait ; le message est donc informatif, pas couplé au statut.)*
- Aucun chemin ne force `verified` → Tâche 1 (source-guard + backend). ✅
- 5 questions tranchées → D1–D5. ✅
- Phase 2 (collecte client) → explicitement hors périmètre (D1). ✅

**2. Placeholders :** aucun « TBD/TODO ». Tout INSERT/UPDATE liste des colonnes réelles (vérifiées sur le schéma live). Les exécuteurs sont complets.

**3. Cohérence des types :** `KycPersonType` (kyc-extract.ts) réutilisé par `prepareOpenKycCase`/`findOpenKycCase`/`kycTypeToEntityType`. `Prepared` (existant) réutilisé par `prepareOpenKycCase`. `ActionCtx.inboundMedia` ajouté une fois (whatsapp-actions.ts) et peuplé une fois (whatsapp-agent). Les 3 enums distincts (checklist `category`, upload `type`, document `document_category`) sont mappés par `kycCategoryMaps` — testé.

**Risques connus / à surveiller :**
- **Double OCR** (générique webhook + structuré exécuteur) et **double fetch média** : coût accepté en Phase 1 (volume agent faible, action intentionnelle). Optimisation différée.
- **D6** : `kyc-screening` lit `req.json()` une seule fois après la refonte d'auth — bug classique si un `await req.json()` résiduel subsiste. Vérifié au Step 2.
- **`kyc-screening` appelle Anthropic** (tension `feedback_deepseek_not_claude`) : existant, non touché. Signalé, pas corrigé ici.
- `kyc_checklist_items.document_id` est sans FK : l'UPDATE de lien est sûr ; le backend de la Tâche 2 + le smoke test (Tâche 7 Step 5.4) confirment le rendu CRM.
