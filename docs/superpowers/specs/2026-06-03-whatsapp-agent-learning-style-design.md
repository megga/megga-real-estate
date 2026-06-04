# Agent WhatsApp — Couche d'apprentissage, Tranche 1 : profil de style par agent (design)

**Statut :** design validé en brainstorm (3 juin 2026), en attente de relecture avant plan.

## But (une phrase)

MEGGA apprend le **style de communication de chaque agent** (langue, registre, emoji, tournures) à partir des messages que l'agent lui écrit, et l'**adopte sur WhatsApp** — un profil **par `profile_id`** (un vrai cerveau par agent), revu par un humain avant d'être appliqué.

## Contexte & pourquoi maintenant

Directive produit `megga/megga-ai-agent-learning` (Gregory) : MEGGA doit *apprendre l'agent avec qui elle travaille pour devenir plus humaine et performante — un vrai cerveau par agent*. Les Paliers 3 / 3b ont posé les **briques d'observation** (journal `whatsapp_confirmation_log` + UI de suggestion d'autonomie). Cette tranche est la première qui transforme l'observation en **adaptation réelle** du comportement de l'agent.

Aujourd'hui le prompt système de `whatsapp-agent` est **figé** (`const SYSTEM`, identique pour tous — `supabase/functions/whatsapp-agent/index.ts:29,111`). La table `agent_ai_profiles` (Day 0, `brief.system_addendum`) personnalise le **copilote web**, mais **pas** l'agent WhatsApp. Ce design ajoute un profil *appris* et le branche dans le prompt de l'agent WhatsApp.

## Périmètre

**Dans cette tranche :** le profil de **style** (langue, registre formel/direct, emoji oui/non, 1-2 tournures distinctives), distillé par DeepSeek depuis les messages de l'agent, stocké sur `agent_ai_profiles`, **activé par un humain**, puis injecté dans le prompt système de `whatsapp-agent`.

**Hors périmètre (tranches suivantes, MÊME pipeline réutilisé) :** corrections passées (« non, plutôt… »), patterns récurrents (jours/horaires de visite, formulations métier), contacts fréquents. L'auto-activation sans revue (si Gregory veut moins de friction plus tard). L'auto-revue par l'agent lui-même (vs super-admin).

## Contraintes dures

- **DeepSeek uniquement** pour la distillation (jamais Claude — cerveau `deepseek-not-claude`).
- **Human-in-the-loop** : un profil appris n'est JAMAIS injecté tant qu'un humain ne l'a pas **activé**. MEGGA observe et propose, elle ne change pas sa persona toute seule (cohérent avec P3/P3b « MEGGA observe, n'élève rien »).
- **Le style est ADDITIF et tonal uniquement** : il s'ajoute APRÈS le `SYSTEM` figé et ne peut JAMAIS écraser les garde-fous (socle légal, human-in-the-loop, persona « employée modèle »). Le bloc de style parle de TON, pas de règles.
- **Pas de fuite de PII** : la distillation extrait le STYLE, pas le contenu — le prompt DeepSeek interdit d'inclure noms/adresses/montants/specifics. Le profil stocké est de la métadonnée de style, pas des messages bruts.
- Migrations additives + idempotentes, datées du jour de merge (`deploy-migrations-gate`). `npm run build` passe avant push. i18n 4 langues si UI.

## Architecture — pipeline capture → distille → stocke → (revue) → injecte

```
whatsapp_messages (msgs de l'agent)
   │  (cron quotidien, par agent ayant ≥N nouveaux msgs)
   ▼
edge: learn-agent-style ──DeepSeek──►  profil de style court
   │
   ▼
agent_ai_profiles.learned_style  (status 'suggested')
   │  ◄── super-admin revoit/édite/ACTIVE (toggle)  [human-in-the-loop]
   ▼ (status 'active')
whatsapp-agent : lit learned_style 'active' → append au SYSTEM prompt → réponses sur-mesure
```

C'est le **même pipeline** que toutes les tranches suivantes réutiliseront (changer la source du signal + le prompt de distillation).

## Composants (unités à frontière claire)

### 1. Migration — `agent_ai_profiles.learned_style` + cron
- **Quoi :** ajoute une colonne `learned_style jsonb NULL` à `agent_ai_profiles` (additif). Forme : `{ language: 'fr'|'en'|'mixed', formality: 'tu'|'vous'|'direct', emoji: boolean, traits: text, status: 'suggested'|'active'|'off', updated_at: timestamptz, sample_count: int }`. Planifie un cron quotidien (`learn-agent-style`, pattern des crons existants).
- **Interface :** lecture par `whatsapp-agent` (status='active') + par l'UI super-admin (toute). Écriture par l'edge `learn-agent-style` (service_role) + l'UI (activation/édition via RPC gardée `is_super_admin`).
- **Dépend de :** `agent_ai_profiles` (Day 0), pg_cron.

### 2. Edge `learn-agent-style` (cron) — capture + distille + stocke
- **Quoi :** worker périodique (CLONE du pattern `whatsapp-process`/`whatsapp-agent-async` : garde `app_config.service_role_key`, BATCH borné). Pour chaque agent ayant **≥ N (ex. 10) messages** depuis le dernier `learned_style.updated_at` : échantillonne ses derniers messages (`whatsapp_messages` où `wa_from = waNumber de l'agent`), appelle **DeepSeek** (« résume le STYLE de communication en 2-3 lignes : langue, registre tu/vous/direct, emoji, tournures ; AUCUN nom/specific »), écrit `learned_style` avec `status='suggested'` (sauf si déjà `'active'`/`'off'` → ne réécrit que les champs de style, garde le status choisi par l'humain).
- **Interface :** déclenché par cron ; aucune entrée HTTP publique (`verify_jwt=false` + service-role comme les autres workers). Idempotent par agent (re-distille sans effet de bord).
- **Dépend de :** `whatsapp_messages`, `agent_ai_profiles`, DeepSeek, `app_config`.
- **Erreurs :** échec DeepSeek → on NE touche pas le profil existant (best-effort) ; agent sans assez de messages → skip.

### 3. Injection dans `whatsapp-agent`
- **Quoi :** au montage du message système (`index.ts:111`), si l'agent a un `learned_style.status = 'active'`, on **append** un bloc court : `\n\nStyle de cet agent (adapte ton TON, jamais tes règles) : <traits + langue + registre + emoji>.` Sinon → `SYSTEM` figé seul.
- **Interface :** lecture seule de `agent_ai_profiles.learned_style` (déjà un fetch par profil au début du tour ; on enrichit ou on ajoute un select léger).
- **Dépend de :** `agent_ai_profiles`. **Dégrade proprement** : pas de profil actif → comportement actuel inchangé.

### 4. UI super-admin — revue & activation
- **Quoi :** une nouvelle page super-admin `/dashboard/admin/learning` (distincte de `autonomy` : l'autonomie = élévation de droits, le style = ton) qui liste par agent le `learned_style` proposé : champs lisibles + **toggle Activer/Désactiver** + édition du texte `traits`. Lecture seule par défaut, l'action d'activation/édition passe par une **RPC `SECURITY DEFINER` gardée `is_super_admin()`** (leçon P3b : garde serveur, pas seulement le `SuperAdminGuard` frontend). Accent violet, i18n 4 langues.
- **Interface :** `useAdminLearning` (React Query) → RPC de lecture ; mutation → RPC d'activation/édition gardée.
- **Dépend de :** `agent_ai_profiles`, le pattern super-admin (P3b).

### 5. Spec backend live
- Couvre : la distillation écrit bien `learned_style` `status='suggested'` ; l'activation requiert super-admin (rejet non-admin) ; l'injection n'a lieu QUE sur `status='active'` ; un profil `'off'`/absent → prompt figé. (Tourne live en CI, pattern P3b.)

## Flux de données & modèle d'activation

1. L'agent écrit à MEGGA (normal). 2. Cron quotidien : assez de nouveaux messages → DeepSeek distille → `learned_style` `status='suggested'`. 3. Le super-admin voit la suggestion, l'édite si besoin, l'**active** (toggle → `status='active'`). 4. Dès lors `whatsapp-agent` injecte le style ; le cron continue de rafraîchir les champs de style mais respecte le `status` choisi. 5. Le super-admin peut éditer/désactiver à tout moment.

## Gestion d'erreurs & dégradation

- DeepSeek indisponible → profil inchangé (best-effort, jamais de profil vide écrit).
- Migration sautée (date-gate) → la colonne absente : `whatsapp-agent` ne trouve pas `learned_style` → prompt figé (dégrade proprement, comme P3b).
- Profil `status` non `'active'` → jamais injecté.
- Le bloc de style est borné (≤ ~300 caractères) pour ne pas gonfler le prompt ni le coût.

## Tests

- Unit purs si extraction/format pur (ex. une fonction `formatStyleBlock(learned_style): string` testable).
- Backend live : distillation → suggested ; activation gardée super-admin ; injection conditionnelle au status.
- `npm run build` vert ; `deno check` sur les edge functions.

## Tranches suivantes (réutilisent ce pipeline)

- **Corrections** : source = tours où l'agent corrige MEGGA (« non, plutôt… ») → distille des préférences/correctifs.
- **Patterns** : jours/horaires de visite, formulations métier récurrentes.
- **Contacts fréquents** : raccourcis sur les contacts/dossiers les plus touchés.
Chacune = nouvelle source de signal + nouveau prompt de distillation, MÊME table/injection/revue.
