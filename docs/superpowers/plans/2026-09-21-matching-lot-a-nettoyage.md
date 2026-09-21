# Matching — lot A : rien ne sort vers le client (plan de réalisation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Retirer du CRM tout ce qui, dans le matching, part vers l'acheteur (lien de réception, e-mails de bien et de relance, outil WhatsApp `send_listings`, relance e-mail automatique), et remplacer chaque « Envoyer » par un geste interne de l'agent, « Je l'ai proposé ».

**Architecture :** Les exécuteurs de `useAtelierMatching.ts` restent la source unique des écritures : `execSendDossier` / `execEnvoyerSelection` deviennent `execProposer` / `execProposerSelection` (`sent_via = 'agent'`, une relance interne à +3 jours, aucun envoi). Les surfaces (atelier, Recherche, mobile, fil, fiche contact, Aujourd'hui) perdent leurs feuilles d'envoi et appellent ces gestes. Le public, les fonctions serveur, la table et les RPC de réception disparaissent ; une garde de test interdit leur retour.

**Tech Stack :** React 19 + TypeScript, TanStack Query v5, react-i18next (FR/DE/EN/IT), Supabase (SQL, edge functions Deno), Vitest.

**Conception :** [docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md](../specs/2026-09-21-matching-boucle-agent-design.md) §1-§3, §4.3, §6, §7 (lot A), §9. **Inventaire détaillé (chemins et lignes) :** l'annexe en fin de ce plan.

---

## Règles de ce chantier

- **Commits : AU SIGNAL de Julien seulement** (« committe »), un commit PAR SUJET, jamais de push. Les lots 1 et 2 du fil (non commités, même worktree) passent AVANT ce lot : ce plan modifie des fichiers qu'ils créent.
- **Production : aucune écriture.** La migration part à la fusion (`deploy.yml`). La dépublication des fonctions (Task 12) est un geste manuel, **sur accord explicite de Julien**, après la fusion.
- **Mesuré le 21.09.2026 en production :** 0 lien de réception, 0 match envoyé, 0 événement d'envoi. Retirer ne perd aucune donnée et ne casse aucun lien.
- Grammaire MEGGA X (jetons `var(--crm-*)`, aucune couleur en dur, graisse ≤ 600, aucune chaîne hors `t()`), i18n dans les 4 langues par script python qui vérifie d'abord le format `json.dumps(d, ensure_ascii=False, indent=2) + '\n'`, sans tiret cadratin ni demi-cadratin, sans ß, italien au « Lei ».
- **Les libellés historiques du journal restent** (`common:audit.action.reception_link_created`, `dossier_envoye`, `whatsapp_ai_send_listings`) : `activity_events` est conservé dix ans.
- Aucun export mort (`npm run lint:deadcode`). Specs ciblées seulement ; la suite complète SEULE, à la fin.
- Lire chaque fichier avant de le modifier ; l'annexe donne les lignes au 21.09.2026, elles ont pu bouger.

## Décisions de ce plan

1. **Le geste s'appelle « Je l'ai proposé »** (touche E) : le libellé dit que c'est l'agent qui a proposé, et que le CRM n'envoie rien. Pluriel : « J'ai proposé 2 biens à Julie ».
2. **`sent_via = 'agent'`** (nouvelle valeur du CHECK) ; les valeurs historiques restent acceptées.
3. **Une relance à +3 jours**, canal `task`, par geste (un bien ou une sélection). La relance J+3 automatique d'`automation-engine` (§1) est retirée : elle doublait la relance du geste et pouvait écrire au client.
4. **Journal :** nouvelle action `match_propose` (metadata `match_ids`, `deal_id`, `bien_refs`, `nombre`). `dossier_envoye` n'est plus écrit.
5. **La Recherche ajoute, elle n'envoie plus :** « Ajouter à la sélection de Julie » crée les matchs `suggested` (`insert_market_matches`) ; ils apparaissent dans l'atelier et dans le fil.
6. **Atelier :** R devient « J'ai relancé » (la relance interne est repoussée de 3 jours, rien n'est envoyé) ; nouvelle touche **N** « Pas intéressé » (`execReact(…, 'rejected')`, sans motif : les motifs viennent au lot B).
7. **« Pendant votre absence » d'Aujourd'hui garde son groupe « Retours acheteurs »** : il lit les réponses posées sur les matchs, qui seront désormais consignées par l'équipe. Seule la mention de la page de l'acheteur disparaît.
8. **La fiche d'une annonce du marché perd son « Envoyer par e-mail »** (et `useSendEmail`, sans autre appelant).
9. **`_shared/pii-redaction.ts` garde le masquage des jetons `/reception/`** (défensif, sans coût) ; les expressions de `sentry.ts` / `index.html` le perdent (aucun lien n'a jamais circulé).

---

## Carte des fichiers

| Zone | Fichiers |
|---|---|
| Données | `supabase/migrations/20260921130000_matching_sans_sortie.sql` (créé), `src/types/database.ts`, `scripts/check-privilege-drift.mjs` |
| Exécuteurs | `src/hooks/useAtelierMatching.ts`, `src/hooks/useMatching.ts`, `tests/unit/matching-fil-gestes.spec.ts` |
| Atelier | `src/pages/agent/MatchingAtelierPage.tsx`, `src/components/matching-atelier/{AtelierStage,AtlAcheteurMode,AtlConfirm,AtlWhy,pendingTriage}.tsx/ts`, `AtlSendSheet.tsx` (supprimé) |
| Recherche | `src/components/matching-recherche/{MatchingRechercheHybride,mrhDemo}.tsx/ts`, `MrhSendSheet.tsx` (supprimé), `src/hooks/useSendReceptionSelection.ts` (supprimé), `src/hooks/useAjouterSelection.ts` (créé), `src/pages/agent/ExternalListingDetailPage.tsx`, `src/hooks/useSendEmail.ts` (supprimé) |
| Mobile | `src/components/crm-mobile/matching/{MmMatchingScreen,MmSendModal,MmFocus,MmMatchCard}.tsx` |
| Fil (banc) | `src/components/matching-fil/{MatchingFil,FilPanneau,FilSelection}.tsx`, `FilFeuilleEnvoi.tsx` (supprimé) |
| Contact, Aujourd'hui, notifications | `src/hooks/useContactSentMatches.ts`, `src/hooks/useReceptionLinks.ts` (supprimé), `src/pages/agent/ContactDetailPage.tsx`, `src/components/crm/contacts-pager/ContactDetailPager.tsx`, `src/components/crm/today/{PageCatalogue.tsx,useAbsenceSignals.ts}`, `src/hooks/useAgentNotifications.ts` |
| Face publique | `src/App.tsx`, `src/pages/public/BuyerReceptionPage.tsx` (supprimé), `src/components/buyer-reception/` (supprimé), `src/hooks/useBuyerReception.ts` (supprimé), `src/pages/dev/{PublicShowcasePage.tsx,publicFixtures.ts}`, `src/lib/sentry.ts`, `index.html` |
| Fonctions serveur | `supabase/functions/buyer-reception-{create,get,react}/` (supprimés), `supabase/functions/send-property-email/` (supprimé), `supabase/functions/_shared/property-email.ts` (supprimé), `supabase/config.toml`, `src/lib/edgeFunctionRoster.ts` (régénéré), `scripts/email-preview.ts` |
| WhatsApp, automatisations | `supabase/functions/_shared/{whatsapp-tools,whatsapp-agent-router,whatsapp-actions,whatsapp-i18n}.ts`, `supabase/functions/whatsapp-agent/index.ts`, `supabase/functions/whatsapp-webhook/index.ts`, leurs tests Deno ; `supabase/functions/automation-engine/index.ts`, `supabase/functions/send-reminder-email/index.ts` |
| Gardes et tests | `tests/unit/matching-sans-sortie.spec.ts` (créé) et les gardes listées Task 10 |
| i18n | `src/i18n/locales/{fr,de,en,it}/{matching,contacts,common}.json` |
| Docs | `CLAUDE.md`, `docs/system-map.md`, `docs/pages.md`, `scripts/_data/intercom-articles*.json`, `scripts/_data/claude-md-claims.json`, les conceptions et plans du fil, `.claude-flow/knowledge/megga-memory.seed.json` |

---

### Task 0 : La migration

**Files :**
- Create : `supabase/migrations/20260921130000_matching_sans_sortie.sql`
- Modify : `src/types/database.ts`, `scripts/check-privilege-drift.mjs`

- [ ] **Step 1 : Vérifier qu'aucun objet SQL vivant ne lit `buyer_reception_links`**

Run : `grep -ln "buyer_reception_links" supabase/migrations/*.sql`
Expected : seulement `20260707120000_buyer_reception_links.sql`, `20260802231604_reception_link_revocation.sql`, `20260802223756_visit_token_lifecycle.sql`. Pour tout AUTRE fichier, lire la fonction qui le cite : si elle est encore vivante (redéfinie plus tard ou jamais), la réécrire dans la migration sans la table, et le signaler.

- [ ] **Step 2 : Écrire la migration**

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Le matching reste chez l'agent : rien ne sort plus vers l'acheteur (21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md.
-- Décision de Julien : « le matching doit exclusivement rester à l'agent ».
--
-- Mesuré en production le 21.09.2026 : 0 lien de réception jamais créé, 0 match
-- envoyé, 0 événement d'envoi. Retirer la table ne perd aucune donnée.
--
-- 1. La page publique de réception, ses fonctions serveur et leur table partent.
--    `record_buyer_reaction` était le seul écrivain de `matches.status` côté
--    acheteur ; l'agent consigne désormais la réponse lui-même (les triggers
--    `set_match_response_at` et `log_match_reaction` restent et le tracent).
-- 2. `sent_via` gagne 'agent' : « je l'ai proposé » est un geste de l'agent, pas
--    un envoi. Les valeurs historiques restent acceptées.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au
-- jour UTC de la fusion. Renommer au jour de la fusion si elle a lieu plus tard.

begin;

drop function if exists public.record_buyer_reaction(uuid, uuid, text, text, text);
drop function if exists public.revoke_reception_link(uuid);
drop table if exists public.buyer_reception_links;

alter table public.matches drop constraint if exists matches_sent_via_check;
alter table public.matches add constraint matches_sent_via_check
  check (sent_via = any (array['email'::text, 'whatsapp'::text, 'both'::text, 'reception'::text, 'agent'::text]));

comment on column public.matches.sent_via is
  'Comment le bien a été proposé. ''agent'' : l''agent l''a présenté lui-même et l''a consigné (seule valeur écrite depuis le 21.09.2026). email / whatsapp / both / reception : valeurs historiques, le CRM n''envoie plus rien à l''acheteur.';

commit;
```

- [ ] **Step 3 : Les types**

Dans `src/types/database.ts` : retirer l'entrée `buyer_reception_links` (bloc `Tables`) et les entrées `record_buyer_reaction` et `revoke_reception_link` (bloc `Functions`). Ne rien changer d'autre.

- [ ] **Step 4 : La garde de privilèges**

Dans `scripts/check-privilege-drift.mjs`, retirer `buyer_reception_links` de `TABLES_A_CAPACITE` (~l. 92).

- [ ] **Step 5 : Vérifier**

Run : `npm run lint:migrations && npm run lint:types-freshness && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c error`
Expected : les deux lints verts ; tsc peut signaler les lecteurs de la table retirée (`useReceptionLinks`, `useContactSentMatches`…) : ils partent aux Tasks 5 et 6.

- [ ] **Point de commit (au signal)** : avec la Task 1.

---

### Task 1 : Les exécuteurs — « Je l'ai proposé »

**Files :**
- Modify : `src/hooks/useAtelierMatching.ts`, `src/hooks/useMatching.ts`, `tests/unit/matching-fil-gestes.spec.ts`
- Modify : `src/i18n/locales/{fr,de,en,it}/common.json` (libellé d'audit `match_propose`), `src/hooks/useAgentNotifications.ts`

- [ ] **Step 1 : Les tests**

Dans `tests/unit/matching-fil-gestes.spec.ts` (mock fidèle à supabase-js, déjà en place) :
- renommer les appels `execSendDossier` → `execProposer` (sans 4ᵉ argument) et `execEnvoyerSelection` → `execProposerSelection` ;
- retirer les tests du plafond `MAX_BIENS_LIEN` et celui qui lit `buyer-reception-create/index.ts` ;
- **ajouter** :

```ts
describe('rien ne sort vers l’acheteur', () => {
  it('Je l’ai proposé : sent_via agent, une relance à +3 j, aucun appel de fonction', async () => {
    const invoke = vi.fn()
    h.invoke = invoke
    await execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    const maj = h.ecritures.find((e) => e.cle === 'update:matches')!
    expect(maj.valeurs).toMatchObject({ status: 'sent', sent_via: 'agent' })
    const relance = h.ecritures.find((e) => e.cle === 'insert:reminders')!
    expect(relance.valeurs).toMatchObject({ type: 'follow_up_sent_property', channel: 'task', trigger_days: 3 })
    expect(h.ecritures.find((e) => e.cle === 'insert:activity_events')!.valeurs).toMatchObject({ action: 'match_propose' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('J’ai relancé : repousse la relance de 3 jours, n’appelle aucune fonction', async () => {
    const invoke = vi.fn()
    h.invoke = invoke
    h.lectures.reminders = [{ id: 'r-1' }]
    await execRelance(CTX, { ...ACHETEUR, email: 'julie@example.ch' }, annonce('ml-1', 'MG-MK-1'))
    expect(h.ecritures.find((e) => e.cle === 'update:reminders')!.valeurs).toMatchObject({ status: 'pending' })
    expect(invoke).not.toHaveBeenCalled()
  })
})
```

Adapter le mock pour que `functions.invoke` délègue à `h.invoke` (défaut : `vi.fn()` résolvant `{ error: null }`), et les noms de champs (`e.cle`, `h.lectures`) à ceux du mock réel. `ACHETEUR` / `annonce` / `CTX` : ceux du fichier. `execRelance` prend un `AtelierBuyer` et un `AtelierListing` complets : compléter les objets de test en conséquence.

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts` → FAIL (noms inexistants).

- [ ] **Step 2 : `useAtelierMatching.ts`**

1. `execSendDossier(ctx, buyer, listing, channel)` devient :

```ts
/**
 * « Je l'ai proposé » (E) — l'agent a présenté le bien à l'acheteur, par ses propres moyens.
 *
 * ⛔ LE CRM N'ENVOIE RIEN À L'ACHETEUR (décision de Julien, 21.09.2026 : le matching reste chez
 * l'agent). Le geste consigne : le match passe `sent` avec `sent_via = 'agent'`, le deal est
 * rattaché (ou créé en `new_lead`), une ligne `match_propose` au journal, et UNE relance interne
 * à +3 jours (canal `task`) pour que l'agent consigne la réponse.
 */
export async function execProposer(ctx: GesteContext, buyer: AcheteurGeste, listing: BienGeste): Promise<{ dealId: string }>
```

Corps : le marquage (`status: 'sent', sent_via: 'agent', sent_at`), le jalon Intercom, `rattacherDeal`, le journal `match_propose` (metadata `{ match_ids: [buyer.matchId], deal_id, bien_refs: [listing.ref], nombre: 1, score: buyer.score }`), la relance (`trigger_days: 3`, `trigger_at: inDays(3)`, `channel: 'task'`, `message_template: \`Retour de ${buyer.first} ${buyer.last} sur ${listing.ref}\``). **Plus d'appel `send-property-email`.** `SendResult` disparaît s'il n'a plus de lecteur.

2. `execEnvoyerSelection` devient `execProposerSelection` : mêmes gardes (matchs `suggested` de cet acheteur), `sent_via: 'agent'`, journal `match_propose` (plus `dossier_envoye`), relance à +3 jours (`Retour de ${first} ${last} sur ${n} bien(s) proposé(s)`). **`MAX_BIENS_LIEN` disparaît** (plus de lien) ; docstring réécrite sur le modèle du point 1.

3. `execRelance` : retirer l'envoi `send-relance-email` (bloc « 4. Relance douce par e-mail ») ; la relance interne passe à +3 jours ; journal `relance` avec `canal: 'agent'` ; retour `Promise<void>`. Docstring : « J'ai relancé (R) — l'agent a relancé l'acheteur lui-même ; le CRM repousse la relance interne. »

4. En-tête du fichier (contrat des gestes, l. 8-21) : réécrire les lignes `send` / `envoyerSelection` / `relance` en conséquence, et ajouter une ligne `⛔ aucun geste n'écrit à l'acheteur`.

5. `refAnnonceMarche`, `rattacherDeal`, `execSnooze`, `execDismiss`, `execWake`, `execReact` : inchangés.

- [ ] **Step 3 : `useMatching.ts`**

`sendMatch(matchId, via)` (l. ~271-285) : le type de `via` devient `'agent'` seulement (ou le paramètre disparaît, `sent_via: 'agent'` écrit en dur). Mettre à jour son seul appelant, `src/components/crm/today/PageCatalogue.tsx` (~l. 909) : `sendMatch(m.matchId)` et un libellé « Je l'ai proposé » s'il affichait « Envoyer ». Lire le composant ; ne pas en changer autre chose.

- [ ] **Step 4 : Libellé d'audit et notifications**

- `common.json` (4 langues), bloc `audit.action` : `match_propose` → FR « Bien proposé par l'agent », DE « Objekt vom Makler vorgeschlagen », EN « Property proposed by the agent », IT « Immobile proposto dall'agente ».
- `useAgentNotifications.ts` : `match_propose: 'matching'` ; retirer `reception_link_created` et `whatsapp_ai_send_listings` de la table de catégories (~l. 89) s'ils n'y servent qu'au rangement de notifications désormais impossibles (les libellés de `common.json` restent).

- [ ] **Step 5 : Vérifier**

Run : `npx vitest run tests/unit/matching-fil-gestes.spec.ts` → PASS.
Les appelants (atelier, mobile, fil) ne compilent plus : Tasks 2, 4, 5.

- [ ] **Point de commit (au signal)** : Tasks 0 à 5 forment un seul sujet (« le matching ne sort plus : gestes internes »).

---

### Task 2 : L'atelier

**Files :** `src/pages/agent/MatchingAtelierPage.tsx`, `src/components/matching-atelier/{AtelierStage.tsx,AtlAcheteurMode.tsx,AtlConfirm.tsx,AtlWhy.tsx,pendingTriage.ts}`, `AtlSendSheet.tsx` (supprimé), `src/i18n/locales/*/matching.json`

- [ ] **Step 1** : `git rm src/components/matching-atelier/AtlSendSheet.tsx`.
- [ ] **Step 2** : `pendingTriage.ts` : le type d'action `send(matchId, 'email'|'reception')` devient `send(matchId)`.
- [ ] **Step 3** : `MatchingAtelierPage.tsx` (l. 22-31, 105-133) : le geste `send` appelle `execProposer(ctx, buyer, listing)` ; `relance` appelle `execRelance` (sans e-mail) ; ajouter le geste `rejeter` → `execReact(matchId, 'rejected')` (lire la signature réelle de `execReact`).
- [ ] **Step 4** : `AtelierStage.tsx` : `requestSend` n'ouvre plus de feuille ; E déclenche directement le triage `sent` (avec sa fenêtre d'annulation existante) ; R « J'ai relancé » ; **N** « Pas intéressé » sur les mêmes onglets que I ; retirer `AtlSendSheet` et son état. Mettre à jour le commentaire l. 399-402 (la réponse est consignée par l'agent).
- [ ] **Step 5** : `AtlAcheteurMode.tsx` : « Envoyer » → « Je l'ai proposé » ; `AtlConfirm` n'annonce plus de notification ni d'e-mail (« Consigner : proposé à Julie · rappel dans 3 jours »). `AtlWhy.tsx` (l. 72, 157) : « Envoyer le dossier » → « Je l'ai proposé », « Relancer · autre canal » → « J'ai relancé ».
- [ ] **Step 6 : i18n `matching`**
  - Retirer `sendSheet.*`, `mobile.channelEmail`, `recherche.sendSoon` et les `recherche.send_*` devenus sans lecteur (vérifier chaque clé par grep).
  - Réécrire `atelier.sendDossier`, `confirm.*`, `atelier.toast.sent`, `atelier.toastSentBuyer` :
    - bouton : FR « Je l'ai proposé » · DE « Ich habe es vorgeschlagen » · EN « I proposed it » · IT « L'ho proposto » ;
    - toast : FR « Proposé à {{prenom}} · rappel dans 3 jours » · DE « {{prenom}} vorgeschlagen · Erinnerung in 3 Tagen » · EN « Proposed to {{prenom}} · reminder in 3 days » · IT « Proposto a {{prenom}} · promemoria tra 3 giorni » ;
    - relance : FR « J'ai relancé » · DE « Ich habe nachgefasst » · EN « I followed up » · IT « Ho ricontattato ».
  - Réemployer `atelier.interested` / `atelier.notInterested` (clés orphelines existantes) pour I et N.
- [ ] **Step 7 : Vérifier** : `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "matching-atelier|MatchingAtelierPage"` vide ; `npm run i18n:parity:ci`.

---

### Task 3 : La Recherche et la fiche d'une annonce du marché

**Files :** `src/hooks/useAjouterSelection.ts` (créé), `src/hooks/useSendReceptionSelection.ts` (supprimé), `src/components/matching-recherche/{MatchingRechercheHybride.tsx,mrhDemo.ts}`, `MrhSendSheet.tsx` (supprimé), `src/pages/agent/ExternalListingDetailPage.tsx`, `src/hooks/useSendEmail.ts` (supprimé), `src/hooks/useExternalListingActions.ts`, `src/lib/stockageParCompte.ts`

- [ ] **Step 1 : Le nouveau hook**

```ts
/**
 * Matching · Recherche — « Ajouter à la sélection de … » : les biens du marché choisis entrent
 * dans les matchs à proposer de l'acheteur (`suggested`), où l'atelier et le fil les montrent.
 *
 * ⛔ Rien ne part vers l'acheteur (décision du 21.09.2026). C'est l'agent qui proposera ces biens,
 * par ses propres moyens, puis le consignera (« Je l'ai proposé »).
 *
 * `insert_market_matches` (SECURITY INVOKER, RLS de l'agence) est idempotent : un bien déjà
 * dans les matchs de l'acheteur n'est pas dupliqué.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface AjoutSelectionItem { marketListingId: string; score: number; reasons?: string[] }
export interface AjoutSelectionInput { contactId: string; agencyId: string; clientSearchId?: string | null; items: AjoutSelectionItem[] }

export function useAjouterSelection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, agencyId, clientSearchId, items }: AjoutSelectionInput): Promise<number> => {
      if (!items.length) throw new Error('no_selection')
      const rows = items.map((it) => ({
        agency_id: agencyId,
        contact_id: contactId,
        market_listing_id: it.marketListingId,
        client_search_id: clientSearchId ?? null,
        score: Math.max(0, Math.min(100, Math.round(it.score))),
        reasons: it.reasons?.length ? { keys: it.reasons } : {},
        status: 'suggested',
      }))
      const { error } = await supabase.rpc('insert_market_matches', { p_rows: rows as unknown as Json })
      if (error) throw error
      return items.length
    },
    // L'atelier et le fil relisent leurs matchs : les biens ajoutés y apparaissent.
    onSuccess: () => client.invalidateQueries(),
  })
}
```

Remplacer `client.invalidateQueries()` par l'invalidation ciblée des clés réellement lues par l'atelier (`useAtelierMatching`) et le fil (`CLE_FIL`) : lire leurs `queryKey`.

- [ ] **Step 2** : `git rm src/hooks/useSendReceptionSelection.ts src/components/matching-recherche/MrhSendSheet.tsx`.
- [ ] **Step 3** : `MatchingRechercheHybride.tsx` : `onSendSelection` (l. ~289-310) appelle `useAjouterSelection` ; la barre « Envoyer N biens » (l. ~621-631) devient « Ajouter à la sélection de {{prenom}} » ; toast de réussite ; retirer le branchement de `MrhSendSheet` (l. 22, 28, 94, 633-640). `mrhDemo.ts` : retirer `MRH_DEMO_SEND` (l. 23, 269-280) et l'adapter si le mode démo simule l'ajout.
  - i18n : FR « Ajouter à la sélection de {{prenom}} » · DE « Zur Auswahl von {{prenom}} hinzufügen » · EN « Add to {{prenom}}'s selection » · IT « Aggiungi alla selezione di {{prenom}} » ; toast `_one`/`_other` : FR « {{count}} bien ajouté à la sélection de {{prenom}} » / « {{count}} biens ajoutés à la sélection de {{prenom}} » (DE « … Objekt(e) zur Auswahl von {{prenom}} hinzugefügt », EN « … added to {{prenom}}'s selection », IT « … aggiunto/i alla selezione di {{prenom}} », accordés).
- [ ] **Step 4** : `ExternalListingDetailPage.tsx` : retirer « Envoyer par e-mail » (l. ~20, 84, 157-181, 442-480) et son état ; `git rm src/hooks/useSendEmail.ts` (vérifier par grep qu'il n'a pas d'autre appelant). `useExternalListingActions.ts` : retirer le type d'action « e-mail envoyé » s'il existe ; si l'historique local `megga_external_listing_actions` n'a plus aucun type écrit, retirer le hook et sa clé de `stockageParCompte.ts` (la garde `stockage-inventaire.spec.ts` suit).
- [ ] **Step 5 : Vérifier** : tsc filtré sur ces fichiers, `npm run i18n:parity:ci`, `npx vitest run tests/unit/redirection-ouverte.spec.ts` (retirer l'exception `MrhSendSheet`, l. ~249-253 ; `MrhExtDetail` reste).

---

### Task 4 : Le mobile

**Files :** `src/components/crm-mobile/matching/{MmMatchingScreen,MmSendModal,MmFocus,MmMatchCard}.tsx`, `src/i18n/locales/*/matching.json`

- [ ] **Step 1** : `MmMatchingScreen.tsx` : `confirmSend` (l. ~198-224) appelle `execProposer` par `gestes.send` ; la modale confirme « Je l'ai proposé à {{prenom}} ? » et annonce le rappel à 3 jours.
- [ ] **Step 2** : `MmSendModal.tsx` : retirer « Par e-mail · … » (`mobile.channelEmail`) et `mobile.channelNone` s'il n'a plus de sens ; titre et bouton : « Je l'ai proposé ». Renommer le fichier en `MmProposeModal.tsx` avec `git mv` si son nom trompe (corriger l'import).
- [ ] **Step 3** : `MmFocus.tsx:175`, `MmMatchCard.tsx:145` : bouton « Je l'ai proposé ».
- [ ] **Step 4 : Vérifier** : tsc filtré, parité i18n.

---

### Task 5 : Le fil (banc)

**Files :** `src/components/matching-fil/{MatchingFil,FilPanneau,FilSelection}.tsx`, `FilFeuilleEnvoi.tsx` (supprimé), `src/i18n/locales/*/matching.json`, `tests/unit/redirection-ouverte.spec.ts`

- [ ] **Step 1** : `git rm src/components/matching-fil/FilFeuilleEnvoi.tsx` ; retirer son entrée de `tests/unit/redirection-ouverte.spec.ts`.
- [ ] **Step 2** : `MatchingFil.tsx` : plus de feuille. E (ou le bouton) sur un bien en mandat : `differer(m, t('fil.propose', { prenom }), (c) => execProposer(c, …))` — le même chemin que Plus tard et Écarter, donc **annulable** pendant `UNDO_WINDOW_MS`. Sur une ligne « Marché » : `execProposerSelection` sur les biens cochés, par la même fenêtre d'annulation (masquer les biens cochés, les rendre si annulé). Retirer `Envoi`, `envoi`, `consignerEnvoi`, `fermerEnvoi`, `MAX_BIENS_LIEN` et leur câblage ; la garde de focus qui ignorait la feuille portée dans `<body>` devient sans objet : la simplifier.
- [ ] **Step 3** : `FilPanneau.tsx:111` : « Proposer à {{prenom}} » → « Je l'ai proposé à {{prenom}} » ; `FilSelection.tsx` : « Envoyer N biens à … » → « J'ai proposé N biens à … », `envoyerAucun` → « Je les ai proposés à {{prenom}} » (désactivé tant qu'aucun bien n'est coché), la raison `tropDeBiens` disparaît.
- [ ] **Step 4 : i18n `matching`** : retirer `fil.envoi.*` et `fil.selection.tropDeBiens` ; ajouter :
  - `fil.propose` : FR « Proposé à {{prenom}} · rappel dans 3 jours » (DE/EN/IT : ceux de la Task 2) ;
  - `fil.proposeSelection_one/_other` : FR « {{count}} bien proposé à {{prenom}} · rappel dans 3 jours » / « {{count}} biens proposés à … » ; DE « {{count}} Objekt(e) {{prenom}} vorgeschlagen · Erinnerung in 3 Tagen » ; EN « {{count}} propert(y/ies) proposed to {{prenom}} · reminder in 3 days » ; IT « {{count}} immobile/i proposto/i a {{prenom}} · promemoria tra 3 giorni » (accordés) ;
  - `fil.actions.proposer` : FR « Je l'ai proposé à {{prenom}} » · DE « Ich habe es {{prenom}} vorgeschlagen » · EN « I proposed it to {{prenom}} » · IT « L'ho proposto a {{prenom}} » ;
  - `fil.selection.envoyer_one/_other` → « J'ai proposé {{count}} bien à {{prenom}} » / « J'ai proposé {{count}} biens à {{prenom}} » (DE « Ich habe {{prenom}} {{count}} Objekt(e) vorgeschlagen », EN « I proposed {{count}} propert(y/ies) to {{prenom}} », IT « Ho proposto {{count}} immobile/i a {{prenom}} »).
- [ ] **Step 5 : Banc** : dans `src/pages/dev/crmFixtures.ts`, le stub `buyer-reception-create` (l. ~908-913) et les lignes `buyer_reception_links` (l. ~876-877) partent ; m1 garde `sent_via: 'reception'` (valeur historique) ; le lien `rl1` part avec la table.
- [ ] **Step 6 : Vérifier** : `npx vitest run tests/unit/matching-fil-modele.spec.ts tests/unit/matching-fil-gestes.spec.ts tests/unit/redirection-ouverte.spec.ts tests/unit/megga-x-grammar.spec.ts` ; tsc complet (`npx tsc --noEmit -p tsconfig.app.json`) : 0 erreur à ce stade si les Tasks 0-4 sont faites, hors fiche contact (Task 6).

---

### Task 6 : Fiche contact, Aujourd'hui, notifications

**Files :** `src/hooks/useContactSentMatches.ts`, `src/hooks/useReceptionLinks.ts` (supprimé), `src/pages/agent/ContactDetailPage.tsx`, `src/components/crm/contacts-pager/ContactDetailPager.tsx`, `src/components/crm/today/useAbsenceSignals.ts`, `src/i18n/locales/*/{contacts,common}.json`, `src/pages/dev/{demoFixtures.ts,ContactsShowcasePage.tsx}`

- [ ] **Step 1** : `git rm src/hooks/useReceptionLinks.ts`.
- [ ] **Step 2** : `useContactSentMatches.ts` : retirer la lecture de `buyer_reception_links.viewed_at` (l. ~87-97) et l'état « vu » ; garder la liste, `pendingLikes` et l'abonnement Realtime sur `matches` (une réponse consignée par un collègue doit apparaître) ; réécrire son commentaire (« réactions du portail » → « réponses consignées »).
- [ ] **Step 3** : `ContactDetailPage.tsx` (l. 23-24, 59-61, 169-170, 237-246) et `ContactDetailPager.tsx` : retirer `FicheReceptionLink`, `LINK_STATE`, la fenêtre de retrait (~l. 1717-1750), `CdLinks` (~l. 1754-1830) ; `CdBoucle` (~l. 1836-1950) garde « Proposés », « Intéressé », « Pas intéressé » (avec motif s'il existe), perd « Vu » / « Ouverts ».
- [ ] **Step 4 : i18n `contacts`** : retirer `fiche.links.*` ; réécrire `loop.*` et `fiche.loop.*` sans « Sa réception », « Vu », « ouvert », « liké » (FR : « Sa boucle », « Proposé », « Intéressé », « Pas intéressé » ; DE « Sein Verlauf », « Vorgeschlagen », « Interessiert », « Nicht interessiert » ; EN « Loop », « Proposed », « Interested », « Not interested » ; IT « Il suo percorso », « Proposto », « Interessato », « Non interessato »). Lire les clés existantes et garder leur structure.
- [ ] **Step 5** : `useAbsenceSignals.ts` : le groupe « Retours acheteurs » reste (décision 7) ; retirer toute mention de la page de l'acheteur dans ses textes (`dashboard.today.h.absence.*`) s'il y en a.
- [ ] **Step 6** : bancs : `demoFixtures.ts` perd `DEMO_FICHE_LINKS` (l. ~108-140) et garde `DEMO_FICHE_LOOP` adapté ; `ContactsShowcasePage.tsx:161` suit.
- [ ] **Step 7 : Vérifier** : tsc complet 0 erreur ; `npm run i18n:parity:ci` ; `npx vitest run tests/unit/contacts-contraste.spec.ts tests/unit/megga-x-grammar.spec.ts` (et les specs de la fiche contact que `ls tests/unit | grep -i contact` révèle).

---

### Task 7 : La face publique

**Files :** `src/App.tsx`, `src/pages/public/BuyerReceptionPage.tsx`, `src/components/buyer-reception/`, `src/hooks/useBuyerReception.ts`, `src/pages/dev/{PublicShowcasePage.tsx,publicFixtures.ts,bancSupabase.ts}`, `src/lib/sentry.ts`, `index.html`, gardes

- [ ] **Step 1** : `git rm -r src/pages/public/BuyerReceptionPage.tsx src/components/buyer-reception src/hooks/useBuyerReception.ts tests/unit/rc-contraste.spec.ts`.
- [ ] **Step 2** : `App.tsx` (l. 53, 564-565) : retirer l'import et la route `/reception/:token`.
- [ ] **Step 3** : banc `/dev/public` : `PublicShowcasePage.tsx` (l. 39, 44, 62, 110-111, 176) perd la surface « Réception acheteur » et ses stubs ; `publicFixtures.ts` perd `receptionVue()` (l. 3, 22, 97-131) ; `bancSupabase.ts:93` : commentaire à jour.
- [ ] **Step 4** : `src/lib/sentry.ts` (l. 36, 59) et `index.html` (l. 34, 63) : retirer `reception` des expressions jumelles des routes à jeton ; `tests/unit/token-routes.spec.ts` (l. 31, 77) suit. `_shared/pii-redaction.ts` et son test : inchangés (décision 9).
- [ ] **Step 5 : les gardes qui listent la face publique** : `tests/unit/megga-x-grammar.spec.ts` (l. 178, 193, 418, 602, 2266 : entrées `buyer-reception`), `tests/unit/couleur-barreaux.spec.ts:200`, `tests/unit/polices-domaines.spec.ts:47`, `tests/unit/mlk-contraste.spec.ts:660` (commentaire), `tests/unit/magic-link-public-surface.spec.ts:30-31`, `tests/unit/dev-bancs-frontiere.spec.ts:67` (si la surface y est nommée).
- [ ] **Step 6 : Vérifier** : `npx vitest run` sur ces gardes ; `npx tsc --noEmit -p tsconfig.app.json`.

---

### Task 8 : Les fonctions serveur

**Files :** `supabase/functions/buyer-reception-{create,get,react}/`, `supabase/functions/send-property-email/`, `supabase/functions/_shared/property-email.ts`, `supabase/config.toml`, `src/lib/edgeFunctionRoster.ts`, `scripts/email-preview.ts`, tests

- [ ] **Step 1** : `git rm -r supabase/functions/buyer-reception-create supabase/functions/buyer-reception-get supabase/functions/buyer-reception-react supabase/functions/send-property-email supabase/functions/_shared/property-email.ts`.
- [ ] **Step 2** : `supabase/config.toml` : retirer les blocs `[functions.buyer-reception-*]` (l. ~560-567) et `[functions.send-property-email]` (l. ~692-693).
- [ ] **Step 3** : `node scripts/check-edge-roster.mjs --write` (régénère `src/lib/edgeFunctionRoster.ts`).
- [ ] **Step 4** : `scripts/email-preview.ts:1` : retirer l'aperçu du gabarit « fiche bien ».
- [ ] **Step 5 : tests** :
  - `git rm tests/backend/buyer-reception-loop.spec.ts` ;
  - `tests/backend/edge-functions-integrations.spec.ts` (l. 23, 137) : retirer `send-property-email` ;
  - `tests/backend/atelier-matching-loop.spec.ts` (l. 211-290) : le chemin `sent_via = 'email'` devient `'agent'`, sans e-mail ;
  - `tests/unit/email-senders-scope.spec.ts` (l. 31, 100-120), `tests/unit/edge-guard-order.spec.ts:584`, `tests/unit/commercial-emails.spec.ts:8`, `tests/unit/edge-corps-erreur.spec.ts:60` : retirer les entrées des fonctions supprimées.
- [ ] **Step 6 : Vérifier** : `npx vitest run tests/unit/email-senders-scope.spec.ts tests/unit/edge-guard-order.spec.ts tests/unit/commercial-emails.spec.ts tests/unit/edge-corps-erreur.spec.ts tests/unit/magic-link-public-surface.spec.ts` ; `node scripts/check-edge-roster.mjs` (sans `--write`) vert.

⚠ Un déploiement ne retire PAS une fonction : les quatre restent en ligne jusqu'à la Task 12.

---

### Task 9 : WhatsApp et les automatisations

**Files :** `supabase/functions/_shared/{whatsapp-tools,whatsapp-agent-router,whatsapp-actions,whatsapp-i18n}.ts`, `supabase/functions/whatsapp-agent/index.ts`, `supabase/functions/whatsapp-webhook/index.ts`, leurs tests Deno, `supabase/functions/automation-engine/index.ts`, `supabase/functions/send-reminder-email/index.ts`

- [ ] **Step 1 : `send_listings`** — retirer l'outil (`whatsapp-tools.ts:213-225`, et sa mention l. 263 dans la description de `search_listings`), son routage (`whatsapp-agent-router.ts:76`), son niveau (`whatsapp-agent/index.ts:24, 602-605`), sa préparation (`whatsapp-actions.ts`, `prepareSendListings` ~l. 1000-1090), son exécution (`whatsapp-webhook/index.ts:1446-1540`, y compris le passage des matchs en `sent` `whatsapp`), ses chaînes (`whatsapp-i18n.ts:147-153`) et ses tests (`whatsapp-agent-router.test.ts:130, 173, 246, 308`, `whatsapp-phantom-action.test.ts:101`, `copilot-tools.test.ts:49, 62-64, 90`). `get_matches` et `schedule_visit` restent. Dans le prompt du copilote (chercher `send_listings` et « envoyer des biens » dans `supabase/functions/`), retirer la consigne d'envoyer des biens au client et ajouter : « Le matching reste chez l'agent : tu ne proposes jamais d'envoyer un bien à un client. »
- [ ] **Step 2 : `automation-engine`** (§1, l. ~232-270, et l. ~219-225 / `shouldAutoSend` / `sendAutoEmail`) : retirer la création de la relance J+3 des matchs `sent` et l'envoi automatique `property_sent`. Garder le §4 (acheteur chaud, canal `notification`). Commentaire : la relance du geste « Je l'ai proposé » remplace le §1.
- [ ] **Step 3 : `send-reminder-email`** (l. 29-40) : retirer le gabarit par défaut `follow_up_sent_property` (« Suite à notre sélection de biens ») ; si la fonction reçoit ce type, elle refuse (400) au lieu d'écrire au client.
- [ ] **Step 4 : Vérifier** : `deno test supabase/functions/_shared/ supabase/functions/whatsapp-agent/ --allow-all` si `deno` est installé (sinon, `npx vitest run` sur les specs qui importent ces fichiers, et le signaler) ; `grep -rn "send_listings" supabase/ src/` → seules les lignes de journal historiques (`whatsapp_ai_send_listings`, libellés).

---

### Task 10 : La garde « rien ne sort »

**Files :** Create `tests/unit/matching-sans-sortie.spec.ts`

- [ ] **Step 1 : Écrire la garde**

```ts
/**
 * Garde : le matching reste chez l'agent (décision de Julien, 21.09.2026). Rien de ce qu'il produit
 * ne part vers l'acheteur par le CRM — ni lien de réception, ni e-mail de bien ou de relance, ni
 * message WhatsApp. Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()

/** Le code du matching, côté agent. */
const MATCHING = [
  'src/components/matching-atelier',
  'src/components/matching-fil',
  'src/components/matching-recherche',
  'src/components/crm-mobile/matching',
  'src/hooks/useAtelierMatching.ts',
  'src/hooks/useMatching.ts',
  'src/hooks/useMatchingFil.ts',
  'src/hooks/useSelectionMarche.ts',
  'src/hooks/useAjouterSelection.ts',
  'src/hooks/useContactSentMatches.ts',
  'src/pages/agent/MatchingPage.tsx',
  'src/pages/agent/MatchingAtelierPage.tsx',
  'src/pages/agent/ExternalListingDetailPage.tsx',
  'src/components/crm/today/PageCatalogue.tsx',
]

/** Ce qui, appelé depuis le matching, écrirait à l'acheteur. */
const INTERDITS: [RegExp, string][] = [
  [/send-property-email/, 'e-mail « fiche bien »'],
  [/send-relance-email/, 'e-mail de relance'],
  [/buyer-reception-/, 'lien de réception'],
  [/useCreateReceptionLink|useSendReceptionSelection|useReceptionLinks|useBuyerReception/, 'hook de réception'],
  [/buildWaMeUrl|wa\.me\//, 'message WhatsApp à l’acheteur'],
]

function fichiers(chemin: string): string[] {
  const abs = join(R, chemin)
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [chemin]
  return readdirSync(abs).flatMap((f) => fichiers(join(chemin, f)))
}

describe('le matching n’écrit jamais à l’acheteur', () => {
  const tous = MATCHING.flatMap(fichiers).filter((f) => /\.(ts|tsx)$/.test(f))

  it('le périmètre est lu (une garde vide ne garde rien)', () => {
    expect(tous.length).toBeGreaterThan(20)
  })

  it.each(INTERDITS)('aucun fichier du matching n’appelle %s', (motif, quoi) => {
    const fautifs = tous.filter((f) => motif.test(readFileSync(join(R, f), 'utf8')))
    expect(fautifs, `${quoi} appelé depuis le matching`).toEqual([])
  })

  it('les fonctions serveur qui écrivaient à l’acheteur n’existent plus', () => {
    for (const f of ['buyer-reception-create', 'buyer-reception-get', 'buyer-reception-react', 'send-property-email']) {
      expect(existsSync(join(R, 'supabase/functions', f)), f).toBe(false)
    }
  })

  it('la page publique de réception n’existe plus', () => {
    expect(readFileSync(join(R, 'src/App.tsx'), 'utf8')).not.toMatch(/\/reception\//)
  })

  it('le copilote WhatsApp n’a plus d’outil pour envoyer des biens au client', () => {
    expect(readFileSync(join(R, 'supabase/functions/_shared/whatsapp-tools.ts'), 'utf8')).not.toMatch(/['"]send_listings['"]/)
  })
})
```

⚠ Si `MrhExtDetail.tsx` (ou un autre fichier du périmètre) utilise légitimement `wa.me` pour écrire à **l'agence qui vend** (pas à l'acheteur), le lire, puis restreindre le motif `wa.me` aux fichiers qui adressent l'acheteur plutôt que d'exclure tout le fichier ; le signaler.

- [ ] **Step 2** : `npx vitest run tests/unit/matching-sans-sortie.spec.ts` → PASS une fois les Tasks 1-9 faites. Contre-épreuve : réintroduire temporairement `supabase.functions.invoke('send-property-email')` dans `useAtelierMatching.ts`, constater le rouge, retirer.

---

### Task 11 : La documentation et le cerveau

**Files :** `CLAUDE.md`, `docs/system-map.md`, `docs/pages.md`, `scripts/_data/intercom-articles-content.json`, `scripts/_data/intercom-articles-v2.json`, `scripts/_data/claude-md-claims.json`, `docs/superpowers/specs/2026-09-17-matching-fil-design.md`, `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] **Step 1 : CLAUDE.md** — §3 « La face publique » : les surfaces passent de SIX à CINQ (retirer `/reception/:token` des listes l. ~386-388, 429 ; « six fichiers » l. ~412 ; `RC` l. ~417-421 ; banc « SIX surfaces » l. ~452) ; §7 Realtime (l. ~615) : `useContactSentMatches` reste, avec « réponses consignées » ; secrets (l. ~851-856) : `MEGGA_MAGIC_LINK_HMAC_SECRET` ne signe plus de lien de réception. Puis `npm run lint:claude-md` et corriger selon le skill `claude-md-freshness` (compte des fonctions serveur, des hooks : `scripts/_data/claude-md-claims.json`).
- [ ] **Step 2 : docs** — `docs/system-map.md` (l. ~155, 484, 532-533, 543, 606, 638) et `docs/pages.md:119` : retirer la réception et l'envoi au client ; ajouter une phrase « le matching reste chez l'agent » là où le matching est décrit.
- [ ] **Step 3 : articles d'aide (données locales)** — `scripts/_data/intercom-articles-content.json` (l. ~3-7) et `intercom-articles-v2.json` (l. ~8, 11, 140) : réécrire « Proposer un bien à un client… notification au contact » et le paragraphe `send_listings` sur le modèle « l'agent propose, le CRM consigne ». ⚠ **Ne rien publier** vers Intercom : la publication est un geste externe, sur accord de Julien.
- [ ] **Step 4 : conception du fil** — le renvoi du 21.09.2026 est en place ; rien de plus.
- [ ] **Step 5 : cerveau** — dans `megga-memory.seed.json` (format vérifié par script), mettre à jour les entrées qui décrivent la réception ou l'envoi : `megga/matching-fil`, `megga/matching-refonte`, `megga/face-publique-meggax`, `megga/capability-tokens`, `megga/matching-lifecycle`, `megga/match-reaction-producer`, `megga/email-channel-guard`, `megga/edge-fn-email-stripe`, `megga/whatsapp-agent-copilot`, `megga/whatsapp-outbound-flow` ; ajouter `megga/matching-sans-sortie` (la décision, les mesures, ce qui est retiré, la garde, les gestes « Je l'ai proposé » / « J'ai relancé » / « Pas intéressé », la dépublication manuelle). Puis `npm run ruflo:seed` et une recherche de contrôle : `CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "le matching reste chez l'agent rien ne sort vers l'acheteur" -n megga`.

---

### Task 12 : Les portes, le banc, puis la production

- [ ] **Step 1 : portes** (séquentielles) : `npx tsc -b && npm run lint` ; `npm run lint:deadcode && npm run i18n:parity:ci && npm run lint:prose && npm run lint:i18n && npm run lint:migrations && npm run lint:types-freshness && npm run lint:claude-md` ; `node scripts/check-edge-roster.mjs` ; puis `npm run test:unit` SEUL (les trois échecs connus sans lien peuvent subsister : deux specs de messagerie sur `npm:postal-mime@3.0.0`, `safe-internal-path` sur `javascript:`).
- [ ] **Step 2 : banc** (`http://localhost:5173/dev/crm?entree=/dashboard/matching`, puis `/dev/public`) :
  - fil : E sur un bien en mandat → « Proposé à Emma · rappel dans 3 jours », annulable ; E sur la sélection de Julie → « 2 biens proposés à Julie » ; aucune feuille, aucun appel réseau vers une fonction (`read_network_requests`) ;
  - atelier (page 0 de production, banc « Matching » si monté, sinon la route réelle du banc) : E, R, I, N ;
  - Recherche : « Ajouter à la sélection de … » → les biens apparaissent dans la sélection du fil ;
  - fiche contact : plus de liens, « Sa boucle » lisible ;
  - `/dev/public` : cinq surfaces, plus de « Réception acheteur » ;
  - aucune erreur en console.
- [x] **Fait le 21.09.2026, sur accord de Julien : `send-property-email` NEUTRALISÉE en production** (version 104 : répond 410 à tout appel, n'envoie rien), déployée par le MCP Supabase — le workflow de purge refuse une fonction encore présente sur `main`. ⚠ `deploy.yml` redéploie toutes les fonctions de `main` à chaque fusion : une fusion sur `main` AVANT celle du lot A remet l'ancienne version en ligne ; la neutraliser de nouveau dans ce cas.
- [ ] **Step 3 : après la fusion, SUR ACCORD EXPLICITE DE JULIEN** — dépublier les quatre fonctions restées en ligne (`buyer-reception-create`, `buyer-reception-get`, `buyer-reception-react`, `send-property-email`) par le workflow manuel `.github/workflows/purge-orphan-functions.yml` (lire le workflow avant : entrées, mode d'essai). Vérifier ensuite : chacune rend **404** (et non 401) sur `https://api.getmegga.com/functions/v1/<nom>`. Vérifier aussi que la migration est appliquée (`buyer_reception_links` absente : PostgREST rend `PGRST205`).

---

## Annexe : l'inventaire (21.09.2026)

Classement : (a) à retirer · (b) partagé, à garder · (c) côté agent, à adapter. Lignes au 21.09.2026.

- **Page publique** : `src/App.tsx:53, 564-565` (a) ; `src/pages/public/BuyerReceptionPage.tsx` (a) ; `src/components/buyer-reception/receptionTokens.ts` (a) ; `src/hooks/useBuyerReception.ts` (a) ; aucune i18n (texte en dur) ; banc `PublicShowcasePage.tsx:39, 44, 62, 110-111, 176` et `publicFixtures.ts:3, 22, 97-131` (a) ; aucune capture E2E.
- **Fonctions serveur** : `buyer-reception-create` (passe les matchs en `sent` `reception`, audit `reception_link_created`), `buyer-reception-get` (publique, marque « vu » avec IP et user-agent), `buyer-reception-react` (publique, `record_buyer_reaction`) (a) ; `send-property-email` + `_shared/property-email.ts` (a, avec son appelant de la fiche d'annonce du marché) ; `send-relance-email` (b : Aujourd'hui, copilote) ; `send-reminder-email` gabarit `follow_up_sent_property` (c) ; `_shared/magic-link-token.ts`, `require-agent-auth.ts` (b) ; `config.toml:560-567, 692-693` (a) ; `edgeFunctionRoster.ts` (régénéré) ; `purge-orphan-functions.yml` (geste manuel).
- **SQL** : `buyer_reception_links` + policy + index (20260707120000) (a) ; `revoked_at`, `revoke_reception_link` (20260802231604) (a) ; `record_buyer_reaction` (a) ; grants (20260802223756:259, 264) (a) ; `matches.reaction_motif` / `reaction_note` (c, gardées) ; `matches_sent_via_check` (c) ; `sent_via` / `sent_at` / `response_at` (b) ; triggers `set_match_response_at`, `log_match_reaction` (b) ; `insert_market_matches` (b) ; publication Realtime de `matches` (b) ; `today_absence()` (c, inchangé).
- **Côté agent** : `useAtelierMatching.ts` (`execSendDossier` l. 535-615 avec l'e-mail l. 586-612, `MAX_BIENS_LIEN` l. 620-625, `execEnvoyerSelection` l. 640-689, `execRelance` l. 692-756 avec l'e-mail l. 739-753, `execReact` l. 807-816) ; atelier (`MatchingAtelierPage.tsx:22-31, 105-133`, `pendingTriage.ts:21-28`, `AtelierStage.tsx` l. 210-213, 276-280, 399-402, 408, 447-457, 476, `AtlSendSheet.tsx`, `AtlAcheteurMode.tsx:10, 160, 222, 245-248, 389, 405-412`, `AtlConfirm.tsx`, `AtlWhy.tsx:72, 157`) ; Recherche (`useSendReceptionSelection.ts`, `MatchingRechercheHybride.tsx:22, 28, 94, 289-310, 621-640`, `MrhSendSheet.tsx`, `mrhDemo.ts:23, 269-280`) ; fiche d'annonce (`ExternalListingDetailPage.tsx:20, 84, 157-181, 442-480`, `useSendEmail.ts`, `useExternalListingActions.ts:124`, `stockageParCompte.ts:47`) ; mobile (`MmMatchingScreen.tsx:93-119, 198-224, 488-497`, `MmSendModal.tsx`, `MmFocus.tsx:175`, `MmMatchCard.tsx:145`) ; fil (`FilFeuilleEnvoi.tsx`, `MatchingFil.tsx` l. 41, 52, 344-383, 437, 484, 501-504, `FilPanneau.tsx:111`, `FilSelection.tsx:177-187`) ; `useCreateReceptionLink.ts` ; fiche contact (`useContactSentMatches.ts:87-97, 102-111`, `useReceptionLinks.ts`, `ContactDetailPage.tsx:23-24, 59-61, 169-170, 237-246`, `ContactDetailPager.tsx:86-97, 284-290, 1717-1950`, i18n `contacts` `fiche.links.*` l. 1083, `loop.*` l. 2-26, `fiche.loop.*` l. 1073) ; Aujourd'hui (`PageCatalogue.tsx:890-911`, `useAbsenceSignals.ts:95, 193-210`) ; notifications (`useAgentNotifications.ts:89, 430`) ; i18n `matching` (`sendSheet.*` l. 170 FR / 508 DE-IT, `fil.envoi.*` l. 660, `recherche.send_*` / `sendSoon` l. 68-70, `mobile.channelEmail` l. 518, `confirm.*` l. 466, `atelier.toast.sent` / `toastSentBuyer` l. 391, 437, `atelier.sendDossier` l. 443, `atelier.interested` / `notInterested` l. 368-369).
- **Automatisations et WhatsApp** : `automation-engine/index.ts` §1 l. 232-270, 219-225, 118-156 ; règle `property_sent` amorcée à `false` (20260618090000:22-33) ; `send_listings` : `whatsapp-tools.ts:213-225, 263`, `whatsapp-agent-router.ts:76`, `whatsapp-agent/index.ts:24, 602-605`, `whatsapp-actions.ts:~1000-1090`, `whatsapp-webhook/index.ts:1446-1540`, `whatsapp-i18n.ts:147-153`, tests Deno.
- **Ailleurs** : libellés d'audit historiques (b) ; `redirection-ouverte.spec.ts:249-253`, `magic-link-public-surface.spec.ts:30-31`, `edge-corps-erreur.spec.ts:60`, `matching-fil-gestes.spec.ts:96-200`, `email-senders-scope.spec.ts:31, 100-120`, `edge-guard-order.spec.ts:584`, `commercial-emails.spec.ts:8`, `token-routes.spec.ts:31, 77`, gardes de la face publique ; backend `buyer-reception-loop.spec.ts`, `edge-functions-integrations.spec.ts:23, 137`, `atelier-matching-loop.spec.ts:211-290` ; docs (CLAUDE.md, system-map, pages, conceptions, `MATCHING_SPEC.md:107-108`, `today-v2-backend-notes.md:100-111`, `migration-getmegga.md:593`, audit blast-radius:388, face publique design) ; articles Intercom ; registre `claude-md-claims.json:641-676` ; entrées du cerveau.
