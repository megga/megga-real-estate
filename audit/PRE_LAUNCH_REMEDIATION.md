# Note de remédiation sécurité — pré-lancement (pour Julien)

> **⚠️ Correctifs PROPOSÉS, NON APPLIQUÉS.** Aucun fichier source, migration, secret ou déploiement n'a été
> modifié. Ce document accompagne `PRE_LAUNCH_AUDIT.md` : pour chaque bloquant, le correctif recommandé + un
> patch/migration *de départ* à **relire, tester et appliquer par Julien** (maître des versions).
> Les snippets sont indicatifs (chemins/lignes peuvent avoir bougé). À valider en local + tests backend/RLS avant deploy.

## Ordre d'attaque recommandé

1. **R0 (racine)** — les 2 postures « ouvertes par défaut ». Corrigent des dizaines de findings d'un coup.
2. **R1 `send-email`** (P0) — relais ouvert, exploitable *maintenant* en prod.
3. **R2 JWT forgeable** (P0) — `photo-processor` + `backfill-cf-images`.
4. **R3 `join_agency`** (ÉLEVÉ) — brèche multi-tenant.
5. **R4 coût/DoS**, **R5 SSRF** (ÉLEVÉ).
6. **R6 quick-wins MOYEN**.

---

## R0 — Causes racines (transverses)

### R0-A · Imposer une authentification à CHAQUE Edge Function

Cause : déploiement `--no-verify-jwt` (`.github/workflows/deploy.yml:215,225-228`) → aucune vérif plateforme.
Trois profils d'auth selon le déclencheur :

| Type de fonction | Garde à imposer |
|---|---|
| Front (agent) | `await requireAgentAuth(req)` — helper existant `_shared/require-agent-auth.ts` |
| Cron / interne | secret partagé en `Authorization`, comparé **constant-time** (pattern déjà utilisé par `whatsapp-agent`, `idx-syndicate`, `learn-agent-style`) |
| Webhook public | signature fournisseur (déjà OK : Stripe/WhatsApp/Intercom) |

Helper cron proposé — `supabase/functions/_shared/require-service-secret.ts` :
```ts
import { timingSafeEqual } from "https://deno.land/std/crypto/timing_safe_equal.ts";
export function requireServiceSecret(req: Request) {
  const provided = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const a = new TextEncoder().encode(provided), b = new TextEncoder().encode(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Response("forbidden", { status: 403 });
  }
}
```
Appliquer : `dashboard-ai-hint` → `requireAgentAuth` ; `flatfox-sync`/`realadvisor-sync`/`market-scraper(-batch)`/
`search-alert`/`send-reminder-email`/`send-visit-email` → `requireServiceSecret`. Le sous-appel cron doit déjà
envoyer le service key en `Authorization` (c'est le cas de `market-scraper-batch`).

**Filet CI** (empêche la récidive) — refuser un `index.ts` sans garde d'auth :
```bash
# scripts/check-edge-auth.sh (proposé) — échoue si une fonction ne référence aucun guard
for f in supabase/functions/*/index.ts; do
  grep -qE "requireAgentAuth|requireServiceSecret|constructEvent|verifyHmac|magic-link-token|verify_token" "$f" \
    || echo "NO-AUTH: $f"
done
```

### R0-B · Révoquer l'`EXECUTE` par défaut sur les fonctions `SECURITY DEFINER`

Cause : Postgres accorde `EXECUTE` à `PUBLIC` (donc `anon`) par défaut → 53 fonctions SECURITY DEFINER
exposées à `anon`. Migration proposée `supabase/migrations/<ts>_lockdown_secdef_grants.sql` :
```sql
-- Révoquer l'accès anonyme aux RPC de maintenance/cross-agence (S2, S17)
do $$
declare fn text;
begin
  foreach fn in array array[
    'get_agency_stats(uuid[])','get_onboarding_milestones(uuid[])',
    'mark_stale_kyc_dossiers()','unpublish_expired_mandates()','purge_expired_import_raw_text()',
    'cleanup_orphan_property_drafts()','accept_followup_suggestion(uuid)',
    'realadvisor_probe_fire(text,integer)','realadvisor_probe_sweep(text,integer,integer,integer,numeric,boolean)',
    'realadvisor_sweep_enum(text,integer,integer,numeric,boolean)','realadvisor_health_check()'
  ] loop
    execute format('revoke execute on function public.%s from anon, public;', fn);
  end loop;
end $$;
-- Les RPC d'admin restent accessibles à authenticated MAIS doivent re-vérifier le rôle en interne (R0-B bis).
```

**R0-B bis** — ajouter une garde de rôle interne aux RPC admin (défense en profondeur, ne pas dépendre du seul REVOKE) :
```sql
-- get_agency_stats / get_onboarding_milestones : réservées au super-admin
create or replace function public.get_agency_stats(agency_ids uuid[]) returns table(...) 
language sql stable security definer set search_path = public, pg_temp as $$
  -- ⬇️ ajouter en tête (variante plpgsql) : if not public.is_super_admin() then raise exception 'forbidden'; end if;
  select ... ; -- corps inchangé
$$;
```
`check_email_exists` (S10) : sert au signup (avant auth) → ne pas exposer une énumération brute. Option recommandée :
la garder mais derrière **captcha** (déjà activé côté Auth) / rate-limit, ou renvoyer un résultat générique côté UI.

### R0-C · Durcir `search_path` des 7 fonctions flaggées (S14)
`alter function public.<fn>() set search_path = public, pg_temp;` sur les 7 (dont `tg_profiles_guard_role_agency`).

---

## R1 · `send-email` — relais email ouvert (P0)

Problème : `startsWith('Bearer ')` (`send-email/index.ts:340`) ne valide pas le token ; templates `contact_*`
publics ; template `default` accepte `data.html` arbitraire vers `to` arbitraire.

Correctif proposé :
```ts
// 1) Supprimer le faux contrôle Bearer. Séparer explicitement les 2 mondes :
const PUBLIC_TEMPLATES = new Set(['contact_confirmation','contact_notification_admin']);
if (PUBLIC_TEMPLATES.has(template)) {
  // destinataire NON piloté par le client : dérivé serveur (agence/admin en DB), rendu serveur, pas de data.html
  const to = await resolveRecipientFromDb(supabase, template, data);   // jamais body.to
  await verifyCaptcha(data.captchaToken);                              // anti-abus
  await rateLimit(req);                                                // par IP
  html = renderServerTemplate(template, sanitize(data));              // aucun HTML client
} else {
  await requireAgentAuth(req);   // tout le reste = agent authentifié
  // to autorisé mais loggé ; data.html échappé/validé
}
```
Sans dev serveur : a minima **`requireAgentAuth` sur TOUS les templates non-`contact_*`**, et pour `contact_*`
forcer `to` = adresse DB (pas `body.to`) + captcha.

---

## R2 · JWT `service_role` forgeable — `photo-processor` + `backfill-cf-images` (P0)

Problème : `decodeJwtRole()` décode le payload **sans vérifier la signature** et accepte `role==='service_role'`.
Sous `--no-verify-jwt`, un JWT forgé passe.

Correctif : **exiger l'égalité constant-time avec le vrai service key** (comme whatsapp-*), supprimer la branche `role===` :
```ts
// AVANT (photo-processor/index.ts:210) :
//   if (role === 'service_role' || token === SERVICE_ROLE_KEY) { ...ok... }
// APRÈS :
import { timingSafeEqual } from "https://deno.land/std/crypto/timing_safe_equal.ts";
const ok = provided.length === SERVICE_ROLE_KEY.length &&
           timingSafeEqual(enc(provided), enc(SERVICE_ROLE_KEY));
if (!ok) return new Response("forbidden", { status: 403 });
```
+ Valider `listingId` et `style` contre `^[A-Za-z0-9_-]+$` (anti path-traversal sur la clé R2). Même patch pour
`backfill-cf-images` (`decodeJwtRole` l.34-43,70-71). Supprimer le commentaire trompeur « signature checked by gateway ».

---

## R3 · `join_agency` — brèche multi-tenant (ÉLEVÉ)

Problème : `join_agency(p_agency_id)` change `agency_id`/`role` sans **aucun contrôle d'invitation** (le trigger
de garde est contourné car SECURITY DEFINER/postgres). Un flux `accept-team-invite` existe déjà et devrait être le
seul chemin.

Correctif proposé (migration) — exiger une invitation valide :
```sql
create or replace function public.join_agency(p_agency_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  -- ⬇️ NOUVEAU : n'autoriser que si une invitation valide existe pour cet utilisateur/agence
  if not exists (
    select 1 from team_invites ti
    where ti.agency_id = p_agency_id
      and lower(ti.email) = lower((select email from profiles where id = v_uid))
      and ti.status = 'pending' and ti.expires_at > now()
  ) then
    raise exception 'no_valid_invitation';
  end if;
  update profiles set agency_id = p_agency_id,
         role = case when role in ('agent','manager','admin','assistant') then role else 'agent' end
   where id = v_uid;
end $$;
revoke execute on function public.join_agency(uuid) from anon, public;
```
(Adapter au vrai schéma d'invitations — vérifier le nom exact de la table utilisée par `send-team-invite`/`accept-team-invite`.)

---

## R4 · Coût/DoS non authentifié (ÉLEVÉ)

- `dashboard-ai-hint` : `await requireAgentAuth(req)` en tête ; **dériver `agency_id` du profil authentifié**, ignorer `body.agency_id` (stoppe l'injection cross-tenant dans `activity_events`).
- `flatfox-sync`, `realadvisor-sync`, `market-scraper`, `market-scraper-batch`, `search-alert` : `requireServiceSecret(req)` (R0-A) en tête — ce sont des fonctions cron.
- `translate-on-demand`, `speech-to-text` : `requireAgentAuth` + borne de taille sur l'entrée (texte/audio) + rate-limit.

---

## R5 · SSRF (ÉLEVÉ / MOYEN) — `c2pa-sign`, `virtual-staging`, `c2pa-verify`

Correctif : helper partagé `_shared/safe-fetch.ts` (le repo a déjà le bon patron dans `extract-property-url`) :
```ts
const BLOCKED = [/^127\./,/^10\./,/^172\.(1[6-9]|2\d|3[01])\./,/^192\.168\./,/^169\.254\./,/^0\./];
export async function safeFetch(rawUrl: string, { maxBytes = 8_000_000, timeoutMs = 8000 } = {}) {
  const u = new URL(rawUrl);
  if (u.protocol !== "https:") throw new Error("https_only");
  // résoudre l'hôte et refuser IP privées/link-local (bloque aussi le DNS-rebinding basique)
  const { address } = await Deno.resolveDns(u.hostname, "A").then(a => ({address:a[0]}));
  if (BLOCKED.some(r => r.test(address))) throw new Error("blocked_ip");
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u, { redirect: "manual", signal: ctrl.signal });
    // + plafonner la taille de lecture à maxBytes
    return res;
  } finally { clearTimeout(t); }
}
```
+ **Lier les `photoUrls` aux photos réelles du bien** : n'accepter que des URLs présentes dans `property.photos`
(c2pa-sign, virtual-staging). + `virtual-staging` : valider `style` contre l'enum `StagingStyle` au runtime avant
de l'interpoler dans la clé Storage (anti-injection de chemin).

---

## R6 · Quick-wins MOYEN

- **S12** policies anon larges (migration) : scoper au token, pas `USING (true)` :
  ```sql
  alter policy anon_select_own_ticket on support_tickets using (access_token = current_setting('request.jwt.claims',true)::json->>'ticket_token'); -- ou via RPC tokenisée
  alter policy anon_select_visit_by_token on visits using (manage_token = (current_setting('request.headers',true)::json->>'x-visit-token')); -- ne plus exposer toutes les visites
  ```
  (Adapter au mécanisme de token réel ; l'idée = ne jamais renvoyer toutes les lignes à `anon`.)
- **S27 Sentry** (`src/lib/sentry.ts`) : `sendDefaultPii:false` ; ajouter `beforeSend`/`beforeSendTransaction` qui
  **drop les URLs `/kyc/`** et scrub les messages ; `denyUrls`/masquage replay explicite ; réduire `tracesSampleRate`.
- **S28 MFA** : rendre le gate **fail-closed** (`useMfaGate.ts:56-59` : sur exception → `setNeedsMfa(true)`), et
  **exiger `aal2` en RLS** sur les tables sensibles (KYC) — aujourd'hui 0 policy ne le fait :
  `... using (... and (auth.jwt()->>'aal') = 'aal2')` sur `kyc_cases`/`kyc_documents`.
- **S30 plan facturation** : restreindre les colonnes `plan`/`billing` de `agencies` au owner/admin (policy dédiée
  ou `revoke update (plan, billing_...) ... ; grant` conditionnel), au lieu de `agencies_members_update` global.
- **S20 deps** : `npm audit fix` (revue), supprimer deps mortes (`react-use`, `@giphy/react-components`, `langsmith`,
  doublon `motion`), traiter `protobufjs` (critique) / `hono` / `undici`.
- **S31** : ajouter `agency_id`-scoping au `with_check` de `contacts_anon_onboarding_insert`.

---

## Rappel cadre
Rien de ci-dessus n'a été appliqué. Prochaine étape = **Julien** relit, teste (tests backend/RLS existants), et
déploie via le pipeline habituel. Je peux préparer les migrations/patches complets finding par finding sur demande.
