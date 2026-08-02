# Notifier `manual_review` et alerter la console — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les étapes sont en cases à cocher (`- [ ]`).

**Objectif :** Un dossier KYB qui part en revue cesse d'être silencieux des deux côtés — le dirigeant reçoit un accusé de réception, et MEGGA apprend qu'un dossier attend sans avoir à y penser.

**Architecture :** Trois leviers, indépendants et livrables séparément. (1) `manual_review` rejoint la liste blanche du module de composition et du trigger déjà en place — aucun nouveau chemin d'envoi. (2) Un badge sur l'entrée de nav « Revue KYB », alimenté par une lecture étroite de `get_admin_agency_review_queue`. (3) Un digest quotidien : une RPC de charge utile, une edge function, un cron — le patron exact de `sweep_pending_agency_verifications`.

**Pile :** PostgreSQL 15 (migrations Supabase, pg_cron, pg_net), Deno (edge functions), React 18 + TypeScript + React Query, vitest (unit jsdom + backend live), Resend.

---

## Décisions prises faute de réponse

La question posée n'a pas reçu de réponse ; ces deux choix sont donc les miens, et ils sont réversibles à peu de frais :

1. **Compteur ET digest quotidien.** Un compteur seul n'aide que quelqu'un qui ouvre déjà la console tous les jours — or le constat de l'audit est précisément que personne ne sait qu'il faut aller regarder. Pour ne garder que le compteur : livrer les tâches 1 à 3 et s'arrêter là ; les tâches 4 et 5 ne sont référencées par aucune des précédentes.
2. **Destinataires du digest = `super_admin_allowlist()`.** La liste existe déjà en base (`hello@juarts.com`, `ttaillefer.dev@gmail.com`), elle est la même que celle qui autorise à trancher un dossier, et elle évite une seconde liste à tenir à jour à la main.

## Correction à l'audit du 01.08

L'audit affirmait « la console n'affiche aucun compteur ». C'est trop fort, et le plan en tient compte :

- `admin_overview()` **calcule déjà** un signal `{id:'kyb', kind:'kyb_review', count, go:'kyb'}` depuis `get_admin_agency_review_queue(1,0).total_count`. Mais **aucun fichier de `src/` n'appelle `admin_overview`** (vérifié : `grep -rn "admin_overview" src` ne renvoie rien) — la RPC est déployée et non consommée. `AdminDashboardPage` lit `useAdminStats`.
- `useAdminStats.alerts` remonte les `activity_events` de sévérité `warn`, dont `agency_verification_recomputed` — un dossier qui part en revue **apparaît donc déjà** dans la liste d'alertes du tableau de bord admin, sous la forme d'une ligne d'événement brute dans un flux de 10, qui défile.

Ce qui manque n'est donc pas « un signal » mais **un compteur persistant et nommé** (« 3 dossiers attendent, le plus ancien depuis 6 jours ») et **un signal qui va chercher le relecteur**. Le plan ne rebranche pas `admin_overview` : ce serait un chantier de la console Lot 1, hors périmètre ici.

## Contraintes globales

- **Date des migrations = le jour du merge, jamais le jour de l'écriture.** `deploy.yml` n'applique que les migrations dont le préfixe est `>= TODAY` (UTC) ; une migration mergée après sa propre date est sautée **définitivement**. Re-dater APRÈS le dernier rebase, par liste nommée — jamais un glob sur la date. Cf. `docs/superpowers/plans/` et le garde-fou `npm run check:drift`.
- **Migrations idempotentes obligatoires** (`npm run lint:migrations`) : `create or replace`, `drop … if exists` avant `create`, `do $$ … exception when others then null; end $$` autour de `cron.unschedule`. Une migration mergée le jour de sa date est rejouée à **chaque** push de la journée.
- **`deno check --no-lock <fichier>` sur toute edge function touchée, AVANT de pousser.** `tsconfig` ne couvre ni `tests/` ni `supabase/functions/` : `tsc -b` ne verra rien, et c'est le job « Vitest unit (jsdom) » qui casse.
- **Jamais `ReturnType<typeof createClient>` pour annoter un paramètre** — ce type instancie le schéma à `never` et casse toute lecture.
- **Les chaînes du module `agency-verification-notice.ts` sont SANS ACCENTS** (« validee », « refuse », « Verification »). Convention du fichier, à respecter pour les nouvelles entrées. Le reste du dépôt (i18n, UI) garde ses accents.
- **Pas de tiret cadratin dans les nouvelles chaînes** (`npm run lint:prose`).
- **Toute nouvelle clé i18n dans les 4 langues** FR/DE/EN/IT (`npm run lint:i18n`).
- **`activity_events` est append-only 10 ans.** Les tests backend laissent des traces ineffaçables : utiliser exclusivement les fixtures `@megga-test.local` déjà en place dans `tests/backend/`.
- Aucun `console.log` en production ; `console.error` seulement, comme les edge functions existantes.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `supabase/functions/_shared/agency-verification-notice.ts` | **Modifier** — `manual_review` entre dans la liste blanche + ses 3 libellés + pied de page conditionnel | 1 |
| `tests/unit/agency-verification-notice.spec.ts` | **Modifier** — inverser l'assertion « manual_review n'est pas notifiable » | 1 |
| `supabase/migrations/<DATE>_kyb_notify_manual_review.sql` | **Créer** — le trigger laisse passer `manual_review` | 2 |
| `tests/backend/agency-verification-notify.spec.ts` | **Modifier** — inverser le test qui assert 0 événement sur `manual_review` | 2 |
| `src/hooks/useKybReviewCount.ts` | **Créer** — lecture étroite du nombre de dossiers en attente | 3 |
| `src/components/admin/AdminShell.tsx` | **Modifier** — pastille de compte sur `nav.adminKybReview` | 3 |
| `src/i18n/locales/{fr,de,en,it}/admin.json` | **Modifier** — libellé accessible de la pastille | 3 |
| `tests/unit/kyb-review-badge.spec.ts` | **Créer** — la fonction pure de formatage de la pastille | 3 |
| `supabase/functions/_shared/kyb-review-digest.ts` | **Créer** — module PUR : destinataires + composition HTML | 4 |
| `tests/unit/kyb-review-digest.spec.ts` | **Créer** — libellés, ancienneté, cas vide | 4 |
| `supabase/functions/kyb-review-digest/index.ts` | **Créer** — l'envoi (Resend), garde service-role | 5 |
| `supabase/migrations/<DATE>_kyb_review_digest.sql` | **Créer** — RPC de charge utile + fonction de dispatch + cron | 5 |
| `src/lib/edgeFunctionRoster.ts`, `supabase/config.toml` | **Régénérés** par `node scripts/check-edge-roster.mjs --write` | 5 |
| `tests/backend/kyb-review-digest.spec.ts` | **Créer** — la RPC de charge utile contre la vraie base | 5 |

---

## Tâche 1 : `manual_review` devient notifiable (module pur)

**Fichiers :**
- Modifier : `supabase/functions/_shared/agency-verification-notice.ts`
- Test : `tests/unit/agency-verification-notice.spec.ts`

**Interfaces :**
- Consomme : rien (première tâche).
- Produit : `NOTIFIABLE_STATUSES` gagne `'manual_review'` ; le type `NotifiableStatus` s'élargit d'autant. `isNotifiableStatus('manual_review')` renvoie `true`. `buildVerificationNotice({status:'manual_review', agencyName, reason, appUrl})` renvoie `{subject, html}` sans bloc « Motif » ni bouton d'action. Consommé par la tâche 2 (le trigger) et par `supabase/functions/agency-verification-notify/index.ts`, **qui n'a besoin d'aucune modification** : il relit le statut en base, appelle `isNotifiableStatus`, et son `REASON_ACTIONS` ne contient pas d'action de mise en revue — `reason` restera donc `null`, ce que `buildVerificationNotice` traite déjà.

- [ ] **Étape 1 : écrire les tests qui échouent**

Dans `tests/unit/agency-verification-notice.spec.ts`, **remplacer** le test existant :

```ts
  it('les états d\'attente ne le sont pas — prévenir à chaque passage du moteur ferait du bruit', () => {
    expect(isNotifiableStatus('pending')).toBe(false)
    expect(isNotifiableStatus('manual_review')).toBe(false)
  })
```

par :

```ts
  it('manual_review est notifiable : c\'est un accusé de réception, pas un verdict', () => {
    // Le dirigeant qui soumet ne recevait RIEN — ni à la soumission, ni au passage en revue.
    // Or une agence suisse finit toujours là (le véto id_document exige un humain), donc
    // « état d'attente » décrivait en réalité l'issue NORMALE du parcours, pas un cas de bord.
    expect(isNotifiableStatus('manual_review')).toBe(true)
  })

  it('pending reste muet : c\'est l\'instant entre la soumission et le premier passage du moteur', () => {
    // Quelques centaines de ms en usage normal. Notifier ici enverrait deux courriels
    // pour une seule soumission.
    expect(isNotifiableStatus('pending')).toBe(false)
  })
```

Puis **ajouter**, à la fin du fichier :

```ts
describe('buildVerificationNotice — accusé de réception de mise en revue', () => {
  const base = { agencyName: 'Agence Test SA', reason: null, appUrl: 'https://app.megga.ch' }

  it('annonce un examen en cours, jamais une décision', () => {
    const { subject, html } = buildVerificationNotice({ ...base, status: 'manual_review' })
    expect(subject).toBe("Verification d'identite : dossier recu")
    expect(html).toContain('en cours d&#39;examen')
    expect(html).toContain('Agence Test SA')
  })

  it('ne promet aucun délai — on ne tient pas ce qu\'on ne mesure pas', () => {
    const { html } = buildVerificationNotice({ ...base, status: 'manual_review' })
    expect(html).not.toMatch(/\d+\s*(heures?|jours?|ouvrés?)/i)
  })

  it('n\'affiche ni bloc Motif ni bouton : il n\'y a rien à corriger et rien à reprendre', () => {
    const { html } = buildVerificationNotice({
      ...base, status: 'manual_review', reason: 'un motif qui traine d\'une decision anterieure',
    })
    expect(html).not.toContain('Motif')
    expect(html).not.toContain('Reprendre le formulaire')
    expect(html).not.toContain('un motif qui traine')
  })

  it('le pied de page ne parle pas de décision pour un dossier simplement reçu', () => {
    const recu = buildVerificationNotice({ ...base, status: 'manual_review' })
    const decide = buildVerificationNotice({ ...base, status: 'validated' })
    expect(recu.html).not.toContain('une decision a ete prise')
    expect(decide.html).toContain('une decision a ete prise')
  })
})
```

- [ ] **Étape 2 : lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run tests/unit/agency-verification-notice.spec.ts
```

Attendu : ÉCHEC. `isNotifiableStatus('manual_review')` renvoie `false`, et l'appel à `buildVerificationNotice` avec `status: 'manual_review'` ne compile pas (`'manual_review'` n'appartient pas à `NotifiableStatus`).

- [ ] **Étape 3 : élargir la liste blanche et les trois tables de libellés**

Dans `supabase/functions/_shared/agency-verification-notice.ts` :

```ts
export const NOTIFIABLE_STATUSES = [
  'validated',
  'auto_validated',
  'rejected',
  'correction_requested',
  'manual_review',
] as const
```

Les trois `Record<NotifiableStatus, string>` deviennent alors incomplets — le compilateur les signale, c'est voulu. Ajouter à chacun (**sans accents**, convention du fichier) :

```ts
const HEADLINE: Record<NotifiableStatus, string> = {
  // … entrées existantes inchangées …
  manual_review: "Votre dossier d'identite est en cours d'examen",
}

const SUBJECT: Record<NotifiableStatus, string> = {
  // … entrées existantes inchangées …
  manual_review: "Verification d'identite : dossier recu",
}

const BODY: Record<NotifiableStatus, string> = {
  // … entrées existantes inchangées …
  manual_review:
    'Nous avons bien recu votre formulaire. Un examen par nos equipes est necessaire avant '
    + "d'ouvrir des dossiers KYC clients et de lancer des signatures electroniques. Vous serez "
    + "prevenu des qu'une decision aura ete prise ; aucune action n'est attendue de votre part "
    + 'd\'ici la.',
}
```

- [ ] **Étape 4 : rendre le pied de page conditionnel**

Dans `buildVerificationNotice`, remplacer le paragraphe de pied de page :

```ts
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
      Message automatique, envoye parce qu'une decision a ete prise sur le dossier d'identite de votre agence.
    </p>
```

par une valeur calculée juste avant la construction du `html` :

```ts
  // Le pied de page disait « une decision a ete prise » — faux pour une mise en revue, qui
  // est justement l'ABSENCE de decision. Un accuse de reception qui s'annonce comme un
  // verdict ferait chercher au dirigeant un verdict qui n'y est pas.
  const footer = input.status === 'manual_review'
    ? "Message automatique, envoye parce que votre dossier d'identite a bien ete recu."
    : "Message automatique, envoye parce qu'une decision a ete prise sur le dossier d'identite de votre agence."
```

et dans le gabarit :

```ts
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
      ${escapeHtml(footer)}
    </p>
```

- [ ] **Étape 5 : mettre l'en-tête du fichier d'accord avec le code**

L'en-tête affirme aujourd'hui, en toutes lettres, que `manual_review` n'est pas notifié. Remplacer le dernier paragraphe :

```ts
// LES CINQ STATUTS NOTIFIES. `validated` et `auto_validated` ouvrent les gardes LAB : c'est la
// bonne nouvelle, et elle est inutile si personne ne la lit. `rejected` ferme le dossier
// definitivement. `correction_requested` attend un geste. `manual_review` n'annonce AUCUNE
// decision -- c'est un accuse de reception, et il a ete ajoute le 01.08.2026 parce que
// l'audit d'onboarding a montre que « etat d'attente » decrivait en fait l'issue NORMALE du
// parcours : le veto `id_document` n'accepte que `match`, aucun connecteur ne le produit, donc
// TOUT dossier passe par un humain. Un dirigeant qui soumet ne recevait rien et n'avait aucun
// moyen de savoir que son dossier etait parti, ni qu'il devait attendre.
// `pending` reste seul hors liste : c'est l'instant entre la soumission et le premier passage
// du moteur, quelques centaines de ms -- y notifier ferait deux courriels pour une soumission.
```

- [ ] **Étape 6 : lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run tests/unit/agency-verification-notice.spec.ts
```

Attendu : PASS, tous les tests du fichier (les anciens comme les nouveaux).

- [ ] **Étape 7 : type-check Deno**

```bash
deno check --no-lock supabase/functions/_shared/agency-verification-notice.ts supabase/functions/agency-verification-notify/index.ts
```

Attendu : aucune erreur. `agency-verification-notify/index.ts` est inclus parce qu'il consomme le type élargi.

- [ ] **Étape 8 : commit**

```bash
git add supabase/functions/_shared/agency-verification-notice.ts tests/unit/agency-verification-notice.spec.ts
git commit -m "feat(kyb): un dossier parti en revue cesse d'etre un silence pour le dirigeant"
```

---

## Tâche 2 : le trigger laisse passer `manual_review`

**Fichiers :**
- Créer : `supabase/migrations/<DATE-DU-MERGE>_kyb_notify_manual_review.sql`
- Modifier : `tests/backend/agency-verification-notify.spec.ts`

**Interfaces :**
- Consomme : la liste blanche élargie de la tâche 1 (le trigger porte sa propre copie de la liste — les deux doivent rester d'accord, cf. le commentaire existant : une divergence ne peut produire qu'un appel sans effet, jamais un courriel qu'aucune des deux n'a voulu).
- Produit : `public.agencies_notify_verification_decision()` redéfinie. Aucune signature ne change ; le trigger `agencies_notify_verification_decision` reste attaché tel quel à `agencies` (`create or replace function` suffit, ne pas recréer le trigger).

- [ ] **Étape 1 : inverser le test backend qui verrouille le comportement actuel**

⚠️ **Ce test existe et il assert exactement le contraire de ce qu'on veut.** Sans cette étape, la CI backend casse avec un message trompeur. Dans `tests/backend/agency-verification-notify.spec.ts`, le premier `it(...)` (vers la ligne 185) enchaîne `pending -> manual_review` puis `manual_review -> validated`. Remplacer son titre et son bloc 1 :

```ts
  it(
    'une transition vers manual_review declenche un accuse de reception, et la decision qui suit ' +
      '(validated) declenche son propre courriel -- deux transitions notifiables, deux evenements',
    async () => {
      const urlBefore = await readConfig('supabase_url')
      const keyBefore = await readConfig('service_role_key')
      try {
        await setConfig('supabase_url', PG_NET_LOCAL_FUNCTIONS_URL)
        await setConfig('service_role_key', SERVICE_ROLE_JWT)

        const agencyId = await createAgency('validated', 'dirigeant-notify@megga-test.local')

        // 1) pending -> manual_review : ACCUSÉ DE RÉCEPTION (01.08.2026). Ce test assertait
        // l'inverse jusqu'ici — « état d'attente, donc muet ». L'audit d'onboarding a montré
        // que cette attente EST l'issue normale : le véto id_document n'accepte que 'match'
        // et aucun connecteur ne le produit, donc tout dossier passe par un humain.
        await setStatus(agencyId, 'manual_review')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 0)
        const recu = await getNoticeEvents(agencyId)
        expect(recu).toHaveLength(1)
        expect(recu[0].metadata).toMatchObject({ status: 'manual_review' })

        // 2) manual_review -> validated : la DÉCISION, son propre courriel.
        await setStatus(agencyId, 'validated')
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 1)

        const events = await getNoticeEvents(agencyId)
        expect(events, 'deux transitions notifiables, deux evenements').toHaveLength(2)
        expect(events.some((e) => (e.metadata as { status?: string }).status === 'validated')).toBe(true)
        // Sans RESEND_API_KEY en local, l'Edge Function va jusqu'au bout de sa logique et
        // s'arrête honnêtement au dernier geste : jamais un `_sent` fabriqué.
        for (const e of events) {
          expect(e.action).toBe('agency_verification_notice_undeliverable')
          expect(e.metadata).toMatchObject({ cause: 'resend_key_missing' })
        }
      } finally {
        await restoreConfig('supabase_url', urlBefore)
        await restoreConfig('service_role_key', keyBefore)
      }
    },
    20_000
  )
```

⚠️ Le deuxième `it(...)` (« un second statut notifiable (rejected) ») enchaîne lui aussi `manual_review` puis `rejected` et assert `toHaveLength(1)`. Il en attend désormais **2**. Corriger de la même façon :

```ts
        await waitUntil(async () => (await getNoticeEvents(agencyId)).length > 1)
        const events = await getNoticeEvents(agencyId)
        expect(events).toHaveLength(2)
        expect(events.some((e) => (e.metadata as { status?: string }).status === 'rejected')).toBe(true)
```

⚠️ Le troisième (« une réécriture qui NE CHANGE PAS verification_status ») passe par `manual_review` puis `validated` et compte 1 : il en attend désormais 2, **et 2 encore après la réécriture** — c'est précisément ce qu'il vérifie. Corriger les trois `toHaveLength(1)` en `toHaveLength(2)` et le premier `waitUntil` en `.length > 1`.

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
npm run test:backend -- tests/backend/agency-verification-notify.spec.ts
```

Attendu : ÉCHEC sur `waitUntil: condition jamais vraie après 10000ms` au premier bloc — le trigger filtre encore `manual_review`.

> Si la suite est **skippée** (`describe.skipIf(!HAS_KEYS)`), la pile Supabase locale n'est pas démarrée. Ce test ne prouve rien tant qu'il ne tourne pas : gater le merge sur la CI backend, jamais sur un vert local.

- [ ] **Étape 3 : écrire la migration**

Créer `supabase/migrations/<DATE-DU-MERGE>_kyb_notify_manual_review.sql`. Le corps est celui de la fonction **en production** (`pg_get_functiondef`), à un littéral près :

```sql
-- Le dirigeant dont le dossier part en revue cesse d'etre laisse sans nouvelles.
--
-- LE DEFAUT. La liste blanche du trigger (20260731160000) ecartait 'manual_review' comme un
-- « etat d'attente » dont prevenir ferait du bruit. Le raisonnement tenait tant qu'on croyait
-- l'auto-validation atteignable. L'audit d'onboarding du 01.08.2026 a montre qu'elle ne l'est
-- pour AUCUN dossier, dans AUCUN pays : le veto `id_document` n'accepte que 'match', aucun
-- connecteur ne le produit, et seule admin_resolve_agency_id_document (humaine) le pose. Le
-- passage en revue n'est donc pas un cas de bord, c'est l'ISSUE NORMALE du parcours -- et
-- personne ne prevenait le dirigeant qu'il devait attendre, ni combien de temps, ni de quoi.
--
-- CE QUI NE CHANGE PAS. La detection reste sur la TRANSITION (`is distinct from`), donc une
-- reecriture de la ligne agencies ne renvoie rien ; un dossier deja en manual_review que le
-- moteur recalcule sans changer son statut n'emet rien non plus. 'pending' reste hors liste :
-- c'est l'instant entre la soumission et le premier passage du moteur, quelques centaines de
-- ms -- y notifier ferait deux courriels pour une seule soumission.
--
-- L'edge function n'a AUCUNE modification a recevoir : elle relit le statut en base et
-- appelle isNotifiableStatus, elargie du meme statut dans le meme lot.
--
-- Idempotente : create or replace seul, le trigger reste attache tel quel.

begin;

create or replace function public.agencies_notify_verification_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base_url text;
  v_svc_key  text;
begin
  -- Une TRANSITION, jamais un état. Sans le `is distinct from`, toute écriture sur la ligne
  -- agencies d'une agence déjà validée renverrait le courriel -- un changement d'adresse
  -- ferait re-annoncer une validation vieille de six mois.
  if new.verification_status is not distinct from old.verification_status then
    return new;
  end if;

  -- Liste BLANCHE. 'pending' reste seul dehors (cf. l'en-tête de cette migration). Un statut
  -- futur n'envoie rien tant que personne n'a écrit ce qu'il faut en dire (même liste que
  -- NOTIFIABLE_STATUSES dans _shared/agency-verification-notice.ts ; l'edge function
  -- revérifie de son côté, donc une divergence entre les deux ne peut produire qu'un appel
  -- sans effet, jamais un courriel qu'aucune des deux n'a voulu).
  if new.verification_status not in
     ('validated', 'auto_validated', 'rejected', 'correction_requested', 'manual_review') then
    return new;
  end if;

  v_base_url := public.get_app_config('supabase_url');
  v_svc_key  := public.get_app_config('service_role_key');

  if v_base_url is not null and v_base_url <> '' and v_svc_key is not null and v_svc_key <> '' then
    begin
      perform net.http_post(
        url := v_base_url || '/functions/v1/agency-verification-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_svc_key
        ),
        -- Le statut voyage à titre indicatif : l'edge function le RELIT en base, parce que le
        -- worker pg_net traite la file avec du retard et qu'un second relecteur a pu trancher
        -- autrement entre-temps.
        body := jsonb_build_object('agency_id', new.id, 'status', new.verification_status),
        timeout_milliseconds := 15000
      );
    exception when others then
      raise warning 'agencies_notify_verification_decision: dispatch echoue pour %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.agencies_notify_verification_decision() is
  'Déclenche agency-verification-notify sur toute TRANSITION de agencies.verification_status vers un statut notifiable : validated, auto_validated, rejected, correction_requested, et depuis le 01.08.2026 manual_review (accusé de réception, pas un verdict -- l''audit d''onboarding a montré que le passage en revue est l''issue normale de TOUT dossier, le véto id_document n''ayant aucun connecteur). ''pending'' reste hors liste : c''est l''instant entre la soumission et le premier passage du moteur. Best-effort : un dispatch en échec journalise un warning et ne bloque jamais l''écriture.';

commit;
```

- [ ] **Étape 4 : vérifier l'idempotence et relancer le test backend**

```bash
npm run lint:migrations
```

Attendu : PASS.

```bash
npm run test:backend -- tests/backend/agency-verification-notify.spec.ts
```

Attendu : PASS (suite non skippée, pile locale démarrée).

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations tests/backend/agency-verification-notify.spec.ts
git commit -m "feat(kyb): le trigger annonce aussi la mise en revue, pas seulement les verdicts"
```

---

## Tâche 3 : la file cesse d'être invisible dans la console (pastille de nav)

**Fichiers :**
- Créer : `src/hooks/useKybReviewCount.ts`
- Créer : `tests/unit/kyb-review-badge.spec.ts`
- Modifier : `src/components/admin/AdminShell.tsx`
- Modifier : `src/i18n/locales/{fr,de,en,it}/admin.json`

**Interfaces :**
- Consomme : `get_admin_agency_review_queue(p_limit integer, p_offset integer)` → `TABLE(agency_id uuid, agency_name text, country text, verification_status text, verification_score numeric, identity_submitted_at timestamptz, verification_sweep_attempts smallint, total_count bigint)`. Existe déjà, garde `is_super_admin() or is_service_role()`. Appelée avec `(1, 0)` : une seule ligne, `total_count` porte le total.
- Produit : `useKybReviewCount(): { count: number }` (0 tant que la lecture n'a pas abouti, jamais `undefined`) et la fonction pure `formatReviewBadge(count: number): string | null` (`null` = pas de pastille).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/unit/kyb-review-badge.spec.ts` :

```ts
// Unitaire — la pastille de la file de revue KYB.
//
// CE QUI EST EN JEU. Un dossier qui part en revue produit déjà un activity_events `warn`, donc
// une ligne dans le flux d'alertes du tableau de bord admin — une ligne dans un flux de 10, qui
// défile. Ce que personne n'avait, c'est un compte PERSISTANT : « il y en a 3 » reste vrai tant
// que les 3 n'ont pas été traités, là où un événement passe.

import { describe, it, expect } from 'vitest'
// `@/` (et non un chemin relatif) : c'est l'alias que suivent les specs unitaires qui
// visent `src/` — cf. tests/unit/identity-gate.spec.ts. Les specs qui visent
// `supabase/functions/` passent en revanche par un chemin relatif, l'alias ne couvrant
// que `src/`.
import { formatReviewBadge } from '@/hooks/useKybReviewCount'

describe('formatReviewBadge', () => {
  it('aucune pastille quand la file est vide — une pastille « 0 » serait un bruit permanent', () => {
    expect(formatReviewBadge(0)).toBeNull()
  })

  it('le compte exact tant qu\'il tient sur deux chiffres', () => {
    expect(formatReviewBadge(1)).toBe('1')
    expect(formatReviewBadge(99)).toBe('99')
  })

  it('plafonne à 99+ — au-delà, le chiffre exact ne change plus la décision et casse le rail', () => {
    expect(formatReviewBadge(100)).toBe('99+')
    expect(formatReviewBadge(4200)).toBe('99+')
  })

  it('un compte négatif ou absurde ne rend rien plutôt qu\'une pastille fausse', () => {
    expect(formatReviewBadge(-1)).toBeNull()
    expect(formatReviewBadge(Number.NaN)).toBeNull()
  })
})
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
npx vitest run tests/unit/kyb-review-badge.spec.ts
```

Attendu : ÉCHEC — `Failed to resolve import "../../src/hooks/useKybReviewCount"`.

- [ ] **Étape 3 : écrire le hook**

Créer `src/hooks/useKybReviewCount.ts` :

```ts
/**
 * Nombre de dossiers KYB en attente de revue — alimente la pastille du rail de la console
 * super-admin (AdminShell).
 *
 * POURQUOI UNE LECTURE DÉDIÉE plutôt que admin_overview(). Cette RPC calcule déjà le même
 * signal (`signals[].kind === 'kyb_review'`), mais elle rend TOUT le tableau de bord — pouls,
 * KPI, journal de 40 lignes, activation — et aucun fichier de src/ ne l'appelle aujourd'hui.
 * La brancher ici la ferait tourner à chaque montage du rail, sur toutes les pages de la
 * console, pour en lire un entier. `get_admin_agency_review_queue(1, 0)` rend une ligne.
 *
 * Renvoie 0 (jamais undefined) tant que la lecture n'a pas abouti : une pastille absente est
 * la seule affirmation sûre en l'absence de réponse — annoncer un nombre faux dans un rail
 * permanent serait pire que ne rien annoncer.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Au-delà de 99, le chiffre exact ne change plus aucune décision et déborde du rail. */
const BADGE_CEILING = 99

/**
 * Compte -> texte de la pastille, ou null quand il n'y a rien à montrer. Pure et testée
 * directement (tests/unit/kyb-review-badge.spec.ts), même motif que resolveIdentityGateStatus.
 */
export function formatReviewBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null
  return count > BADGE_CEILING ? `${BADGE_CEILING}+` : String(count)
}

interface ReviewQueueHead {
  total_count: number
}

export function useKybReviewCount(): { count: number } {
  const { data } = useQuery({
    queryKey: ['kyb-review-count'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_admin_agency_review_queue', {
        p_limit: 1,
        p_offset: 0,
      })
      if (error) throw error
      const head = (data as ReviewQueueHead[] | null)?.[0]
      return head ? Number(head.total_count) : 0
    },
    // Une file de revue humaine ne bouge pas à la seconde ; 5 min évitent une requête à
    // chaque navigation dans la console, où le rail est monté en permanence.
    staleTime: 5 * 60_000,
  })

  return { count: data ?? 0 }
}
```

- [ ] **Étape 4 : lancer le test pour le voir passer**

```bash
npx vitest run tests/unit/kyb-review-badge.spec.ts
```

Attendu : PASS (4 tests).

- [ ] **Étape 5 : rendre la pastille dans le rail**

Dans `src/components/admin/AdminShell.tsx` :

1. Importer le hook, à côté des imports existants :

```tsx
import { useKybReviewCount, formatReviewBadge } from '@/hooks/useKybReviewCount'
```

2. Marquer l'entrée de nav concernée — remplacer sa ligne dans `NAV_SECTIONS` :

```tsx
    { labelKey: 'nav.adminKybReview', href: '/kyb-review', icon: 'eye', badge: 'kybReview' },
```

et élargir le type des entrées (là où il est déclaré, au-dessus de `NAV_SECTIONS`) d'un champ optionnel :

```tsx
  /** Seule valeur admise aujourd'hui. Un littéral plutôt qu'un booléen : le jour où une
   *  seconde file mérite une pastille, le compilateur exigera de dire laquelle. */
  badge?: 'kybReview'
```

3. Dans `ShellNav` (vers la ligne 110), lire le compte une seule fois — jamais dans la boucle de rendu — et récupérer `onTone`, qui manque à la déstructuration actuelle :

```tsx
  const { sp, surf, tones, onTone } = useAdminSugar()
  const { count: kybReviewCount } = useKybReviewCount()
```

4. Dans le rendu de chaque entrée, après le libellé, insérer :

```tsx
              {item.badge === 'kybReview' && formatReviewBadge(kybReviewCount) && (
                <span
                  aria-label={t('admin:nav.adminKybReviewPending', { count: kybReviewCount })}
                  style={{
                    marginLeft: 'auto',
                    minWidth: 20,
                    padding: '1px 6px',
                    borderRadius: ADMIN_RADII.pill,
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: 'center',
                    background: tones.warn,
                    color: onTone,
                  }}
                >
                  {formatReviewBadge(kybReviewCount)}
                </span>
              )}
```

> `AdminTones.warn` est **une chaîne de couleur** (`'#E08A2E'` en sombre, `'#C45A00'` en clair), pas un objet `{bg, fg}` — c'est le patron `toneColor()` d'`adminKit.tsx`. Le texte posé sur une pilule pleine vient de `onTone`, jamais d'un `#fff` en dur (`useAdminSugar.ts`). `ADMIN_RADII` est déjà importé par `AdminShell.tsx` (ligne 32) ; ne pas ajouter de second import, ni de couleur en dur (CLAUDE.md §3).

- [ ] **Étape 6 : ajouter la clé i18n dans les 4 langues**

⚠️ Suffixes `_one` / `_other`, **jamais une clé nue** : i18next v25 (JSON v4) résout les pluriels par suffixe, et une clé nue ne serait qu'un repli jamais atteint. Convention déjà en place — cf. `timelineCount_one` / `timelineCount_other` dans `src/i18n/locales/fr/calendar.json`.

Dans `src/i18n/locales/fr/admin.json`, sous `nav` :

```json
    "adminKybReviewPending_one": "{{count}} dossier en attente de revue",
    "adminKybReviewPending_other": "{{count}} dossiers en attente de revue",
```

`de` :

```json
    "adminKybReviewPending_one": "{{count}} Dossier wartet auf Prüfung",
    "adminKybReviewPending_other": "{{count}} Dossiers warten auf Prüfung",
```

`en` :

```json
    "adminKybReviewPending_one": "{{count}} file awaiting review",
    "adminKybReviewPending_other": "{{count}} files awaiting review",
```

`it` :

```json
    "adminKybReviewPending_one": "{{count}} pratica in attesa di revisione",
    "adminKybReviewPending_other": "{{count}} pratiche in attesa di revisione",
```

- [ ] **Étape 7 : vérifier la chaîne complète**

```bash
npm run lint:i18n && npm run lint:prose && npx tsc -b && npm run lint
```

Attendu : aucune erreur sur les quatre.

- [ ] **Étape 8 : commit**

```bash
git add src/hooks/useKybReviewCount.ts src/components/admin/AdminShell.tsx src/i18n/locales tests/unit/kyb-review-badge.spec.ts
git commit -m "feat(console-admin): la file de revue KYB se compte dans le rail, elle ne se devine plus"
```

---

## Tâche 4 : le digest quotidien — module de composition (pur)

**Fichiers :**
- Créer : `supabase/functions/_shared/kyb-review-digest.ts`
- Créer : `tests/unit/kyb-review-digest.spec.ts`

**Interfaces :**
- Consomme : rien (module pur, aucun import, aucun `Deno.env.get`, aucun `fetch` — même discipline que `_shared/agency-verification-notice.ts`, et pour la même raison : importable tel quel depuis vitest).
- Produit :
  - `export interface PendingDossier { agency_id: string; agency_name: string; country: string | null; score: number | null; submitted_at: string; age_days: number }`
  - `export function buildReviewDigest(input: { dossiers: PendingDossier[]; appUrl: string }): { subject: string; html: string } | null` — `null` quand `dossiers` est vide (le jour où il n'y a rien, on n'envoie rien).
  - `export function digestSubject(count: number, oldestAgeDays: number): string`
  Consommés par la tâche 5.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/unit/kyb-review-digest.spec.ts` :

```ts
// Unitaire — composition du digest quotidien des dossiers KYB en attente de revue.
//
// CE QUI EST EN JEU. L'audit du 01.08.2026 : 100 % des dossiers exigent un passage humain
// (le véto id_document n'accepte que 'match' et aucun connecteur ne le produit), et rien
// n'allait chercher ce relecteur. Un client réel pouvait soumettre et attendre indéfiniment
// un examen que personne ne savait devoir faire.

import { describe, it, expect } from 'vitest'
import { buildReviewDigest, digestSubject, type PendingDossier } from '../../supabase/functions/_shared/kyb-review-digest'

const dossier = (over: Partial<PendingDossier> = {}): PendingDossier => ({
  agency_id: '11111111-1111-1111-1111-111111111111',
  agency_name: 'Agence Test SA',
  country: 'CH',
  score: null,
  submitted_at: '2026-08-01T10:00:00Z',
  age_days: 0,
  ...over,
})

describe('buildReviewDigest', () => {
  it('rien à signaler = aucun courriel — un digest quotidien vide se fait ignorer, puis filtrer', () => {
    expect(buildReviewDigest({ dossiers: [], appUrl: 'https://app.megga.ch' })).toBeNull()
  })

  it('nomme chaque dossier et son ancienneté', () => {
    const out = buildReviewDigest({
      dossiers: [dossier({ agency_name: 'Regie du Lac SA', age_days: 6 })],
      appUrl: 'https://app.megga.ch',
    })
    expect(out).not.toBeNull()
    expect(out!.html).toContain('Regie du Lac SA')
    expect(out!.html).toContain('6')
  })

  it('mene droit a la file, jamais a la racine de la console', () => {
    const out = buildReviewDigest({ dossiers: [dossier()], appUrl: 'https://app.megga.ch' })
    expect(out!.html).toContain('https://app.megga.ch/dashboard/admin/kyb-review')
  })

  it('echappe le nom d\'agence — texte libre saisi a l\'inscription, rendu dans du HTML', () => {
    const out = buildReviewDigest({
      dossiers: [dossier({ agency_name: '<script>alert(1)</script>' })],
      appUrl: 'https://app.megga.ch',
    })
    expect(out!.html).not.toContain('<script>')
    expect(out!.html).toContain('&lt;script&gt;')
  })

  it('un score absent se lit « non calcule », jamais « 0 » — la nuance decide de la priorite', () => {
    const out = buildReviewDigest({ dossiers: [dossier({ score: null })], appUrl: 'https://app.megga.ch' })
    expect(out!.html).not.toMatch(/>\s*0\s*</)
    expect(out!.html).toContain('non calcule')
  })
})

describe('digestSubject', () => {
  it('porte le nombre ET l\'anciennete du plus vieux : c\'est ce qui fait ouvrir ou non', () => {
    expect(digestSubject(1, 0)).toBe('Revue KYB : 1 dossier en attente')
    expect(digestSubject(3, 6)).toBe('Revue KYB : 3 dossiers en attente, le plus ancien depuis 6 jours')
  })

  it('un seul jour se dit au singulier', () => {
    expect(digestSubject(2, 1)).toBe('Revue KYB : 2 dossiers en attente, le plus ancien depuis 1 jour')
  })
})
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
npx vitest run tests/unit/kyb-review-digest.spec.ts
```

Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : écrire le module**

Créer `supabase/functions/_shared/kyb-review-digest.ts` :

```ts
// supabase/functions/_shared/kyb-review-digest.ts
//
// Composition du digest quotidien des dossiers KYB en attente de revue humaine.
//
// POURQUOI CE FICHIER EXISTE SEPAREMENT de l'edge function qui envoie. Module PUR : aucun
// import, aucun Deno.env.get, aucun fetch -- meme discipline que
// _shared/agency-verification-notice.ts, donc les libelles se verifient depuis vitest sans
// pile Deno ni cle Resend.
//
// POURQUOI UN DIGEST, ET PAS UNE ALERTE PAR DOSSIER. Un courriel par soumission ferait du
// bruit a l'echelle ou l'on veut arriver, et se ferait filtrer. Un point par jour, qui ne
// part QUE s'il y a quelque chose a dire, reste lisible et garde sa valeur de signal.
//
// POURQUOI CE SIGNAL EXISTE. Audit d'onboarding du 01.08.2026 : le veto `id_document`
// n'accepte que 'match', aucun connecteur ne le produit, seule admin_resolve_agency_id_document
// (humaine) le pose -- donc AUCUN dossier, d'AUCUN pays, ne peut s'auto-valider. Le passage
// humain n'est pas un cas de bord, c'est le chemin unique. Rien n'allait chercher le relecteur.

/** Un dossier en attente, tel que le rend la RPC kyb_review_digest_payload(). */
export interface PendingDossier {
  agency_id: string
  agency_name: string
  country: string | null
  /** null = le moteur n'a pu scorer aucun check (cas courant : les sources scorables sortent
   *  toutes 'unavailable'). Distinct d'un score de 0, qui serait un verdict defavorable. */
  score: number | null
  submitted_at: string
  age_days: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Le sujet porte le nombre ET l'anciennete du plus ancien : c'est ce qui decide de l'ouverture
 *  d'un courriel quotidien. « Revue KYB : 3 dossiers » sans anciennete se lit pareil le premier
 *  jour et le dixieme. */
export function digestSubject(count: number, oldestAgeDays: number): string {
  const dossiers = count === 1 ? '1 dossier' : `${count} dossiers`
  if (oldestAgeDays < 1) return `Revue KYB : ${dossiers} en attente`
  const jours = oldestAgeDays === 1 ? '1 jour' : `${oldestAgeDays} jours`
  return `Revue KYB : ${dossiers} en attente, le plus ancien depuis ${jours}`
}

/**
 * Compose sujet et corps. `null` quand il n'y a rien a signaler : un digest quotidien qui
 * arrive tous les jours pour dire « rien » se fait ignorer, puis filtrer, et n'est plus lu le
 * jour ou il compte.
 *
 * Le nom d'agence est ECHAPPE : texte libre saisi a l'inscription, rendu dans du HTML.
 */
export function buildReviewDigest(input: {
  dossiers: PendingDossier[]
  appUrl: string
}): { subject: string; html: string } | null {
  if (input.dossiers.length === 0) return null

  const oldest = Math.max(...input.dossiers.map((d) => d.age_days))
  const subject = digestSubject(input.dossiers.length, oldest)

  const lignes = input.dossiers
    .map((d) => {
      const score = d.score === null ? 'non calcule' : d.score.toFixed(3)
      const anciennete = d.age_days < 1 ? "aujourd'hui" : d.age_days === 1 ? 'depuis 1 jour' : `depuis ${d.age_days} jours`
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">
            ${escapeHtml(d.agency_name)}
            <span style="color:#9ca3af;font-size:12px;"> ${escapeHtml(d.country ?? '--')}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">
            ${escapeHtml(anciennete)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap;">
            ${escapeHtml(score)}
          </td>
        </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Console super-admin</span>
    </div>

    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:28px;">
      <h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 8px 0;">${escapeHtml(subject)}</h2>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px 0;">
        Ces agences ne peuvent ouvrir aucun dossier KYC client tant que leur identite n'a pas ete tranchee.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 22px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">Agence</th>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">En attente</th>
            <th style="text-align:left;padding:0 12px 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;">Score</th>
          </tr>
        </thead>
        <tbody>${lignes}
        </tbody>
      </table>

      <a href="${escapeHtml(input.appUrl)}/dashboard/admin/kyb-review"
         style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;">
        Ouvrir la file de revue
      </a>
    </div>

    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
      Message automatique, envoye une fois par jour uniquement lorsqu'au moins un dossier attend.
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}
```

- [ ] **Étape 4 : lancer le test et le type-check**

```bash
npx vitest run tests/unit/kyb-review-digest.spec.ts && deno check --no-lock supabase/functions/_shared/kyb-review-digest.ts
```

Attendu : PASS (7 tests) puis aucune erreur Deno.

- [ ] **Étape 5 : commit**

```bash
git add supabase/functions/_shared/kyb-review-digest.ts tests/unit/kyb-review-digest.spec.ts
git commit -m "feat(kyb): composition du digest quotidien des dossiers en attente de revue"
```

---

## Tâche 5 : le digest quotidien — RPC, edge function et cron

**Fichiers :**
- Créer : `supabase/functions/kyb-review-digest/index.ts`
- Créer : `supabase/migrations/<DATE-DU-MERGE>_kyb_review_digest.sql`
- Créer : `tests/backend/kyb-review-digest.spec.ts`
- Régénérés : `src/lib/edgeFunctionRoster.ts`, `supabase/config.toml`

**Interfaces :**
- Consomme : `buildReviewDigest`, `digestSubject`, `PendingDossier` (tâche 4) ; `public.super_admin_allowlist()` → `text[]` ; `public.is_service_role()` → `boolean` ; `public.get_app_config(text)` → `text`.
- Produit : `public.kyb_review_digest_payload()` → `jsonb` de forme `{recipients: text[], dossiers: PendingDossier[]}`, service_role seul ; `public.dispatch_kyb_review_digest()` → `void`, service_role seul ; le job cron `kyb-review-digest-daily` ; l'endpoint `POST /functions/v1/kyb-review-digest`.

- [ ] **Étape 1 : écrire le test backend qui échoue**

Créer `tests/backend/kyb-review-digest.spec.ts`. Les fixtures suivent `tests/backend/agency-review-queue.spec.ts` — les helpers `anonClient`/`serviceRoleClient` sont les **seuls** exports de `tests/backend/helpers/supabase.ts`, tout le reste (utilisateur ordinaire, agences) se construit dans le fichier :

```ts
// Backend live — la charge utile du digest quotidien de revue KYB.
//
// Ce que ce test verrouille : le digest ne peut pas mentir sur QUI attend. Il lit la même
// vérité que la file de la console (verification_status = 'manual_review'), et il ne s'ouvre
// qu'au service_role — c'est un cron qui l'appellera, jamais un navigateur.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local seedé et
// DOIVENT réellement passer. Un vert local sans pile démarrée ne prouve rien.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

interface DigestRow {
  agency_id: string
  agency_name: string
  country: string | null
  score: number | string | null
  submitted_at: string
  age_days: number
}

interface DigestPayload {
  recipients: string[]
  dossiers: DigestRow[]
}

describe.skipIf(!HAS_KEYS)('kyb_review_digest_payload() — la charge utile du digest quotidien', () => {
  const agencyIds: string[] = []
  const userIds: string[] = []
  let ordinaryUser: SupabaseClient

  beforeAll(async () => {
    ordinaryUser = await createOrdinaryUser()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // Best-effort HONNÊTE : une agence sur laquelle un activity_events a été écrit est
    // indéletable (append-only, LBA art. 7). Ce fichier n'appelle aucune RPC qui journalise,
    // donc la suppression devrait aboutir — on rapporte nommément si ce n'est pas le cas
    // plutôt que d'avaler l'échec.
    const undeletable: { id: string; reason: string }[] = []
    for (const id of agencyIds) {
      const { error } = await svc.from('agencies').delete().eq('id', id)
      if (error) undeletable.push({ id, reason: `${error.code ?? '?'} ${error.message}` })
    }
    for (const id of userIds) {
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    }
    if (undeletable.length > 0) {
      console.warn(
        `[kyb-review-digest.spec.ts] ${undeletable.length}/${agencyIds.length} agence(s) non supprimée(s) :\n` +
        undeletable.map((u) => `  - ${u.id} : ${u.reason}`).join('\n')
      )
    }
  })

  async function createOrdinaryUser(): Promise<SupabaseClient> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `digest-agent-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Testeur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser agent: ${error.message}`)
    userIds.push(data.user!.id)
    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin agent: ${signInErr.message}`)
    return client
  }

  /** Écrit directement les colonnes de vérification par le service_role — même patron de
   *  fixture que agency-review-queue.spec.ts, qui n'appelle ni submit_agency_identity() ni
   *  recompute_agency_verification() pour poser un état. */
  async function createAgency(opts: {
    label: string
    status: string
    submittedDaysAgo: number | null
  }): Promise<string> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}-${opts.label}`
    const submittedAt = opts.submittedDaysAgo === null
      ? null
      // +1 h pour ne jamais tomber pile sur la frontière du jour : floor(6j 1h) = 6, stable.
      : new Date(Date.now() - (opts.submittedDaysAgo * 86_400 + 3_600) * 1000).toISOString()

    const { data, error } = await svc
      .from('agencies')
      .insert({
        name: `Agence Digest ${stamp}`,
        slug: `agence-digest-${stamp}`,
        country: 'CH',
        verification_status: opts.status,
        identity_submitted_at: submittedAt,
      })
      .select('id')
      .single()
    if (error) throw new Error(`createAgency ${opts.label}: ${error.message}`)
    agencyIds.push(data.id as string)
    return data.id as string
  }

  const payload = async (): Promise<DigestPayload> => {
    const { data, error } = await serviceRoleClient().rpc('kyb_review_digest_payload')
    expect(error).toBeNull()
    return data as unknown as DigestPayload
  }

  it('ne rend que les dossiers en manual_review, jamais un dossier tranché ni jamais soumis', async () => {
    const enAttente = await createAgency({ label: 'attente', status: 'manual_review', submittedDaysAgo: 0 })
    const valide = await createAgency({ label: 'valide', status: 'validated', submittedDaysAgo: 0 })
    const jamaisSoumis = await createAgency({ label: 'neuf', status: 'pending', submittedDaysAgo: null })

    const ids = (await payload()).dossiers.map((d) => d.agency_id)
    expect(ids).toContain(enAttente)
    expect(ids).not.toContain(valide)
    expect(ids).not.toContain(jamaisSoumis)
  })

  it('un manual_review sans identity_submitted_at est écarté — sans quoi son ancienneté serait NULL', async () => {
    // Cas atteignable : admin_request_agency_correction remet la colonne à NULL. Le dossier
    // repasse par 'correction_requested', mais la garde vaut pour tout chemin futur.
    const bancal = await createAgency({ label: 'sans-date', status: 'manual_review', submittedDaysAgo: null })
    expect((await payload()).dossiers.map((d) => d.agency_id)).not.toContain(bancal)
  })

  it('porte l\'ancienneté en JOURS PLEINS depuis identity_submitted_at', async () => {
    const id = await createAgency({ label: 'vieux', status: 'manual_review', submittedDaysAgo: 6 })
    const ligne = (await payload()).dossiers.find((d) => d.agency_id === id)
    expect(ligne?.age_days).toBe(6)
  })

  it('trie du plus ancien au plus récent — c\'est l\'ordre dans lequel on veut les traiter', async () => {
    const dossiers = (await payload()).dossiers
    const ages = dossiers.map((d) => d.age_days)
    expect([...ages].sort((a, b) => b - a)).toEqual(ages)
  })

  it('rend toujours un tableau de destinataires non vide — un digest sans adresse ne part nulle part', async () => {
    // On n'assert PAS l'égalité avec super_admin_allowlist() : cette fonction n'est pas
    // exposée à PostgREST, et la rejouer ici en dupliquerait la définition. L'invariant qui
    // compte est que le digest a où aller.
    const { recipients } = await payload()
    expect(Array.isArray(recipients)).toBe(true)
    expect(recipients.length).toBeGreaterThan(0)
    for (const r of recipients) expect(r).toContain('@')
  })

  it('`dossiers` est toujours un tableau, jamais null', async () => {
    // Le cas VIDE lui-même se teste au niveau unitaire (buildReviewDigest([]) === null) :
    // le forcer ici exigerait de vider la file d'une base partagée, ce qu'un test n'a pas
    // à faire. Ici on verrouille seulement le coalesce.
    expect(Array.isArray((await payload()).dossiers)).toBe(true)
  })

  it('refuse un appelant authentifié — un cron l\'appelle, jamais un navigateur', async () => {
    const { data, error } = await ordinaryUser.rpc('kyb_review_digest_payload')
    // Le CODE n'est pas épinglé, et c'est délibéré. Contrairement au patron P3 (EXECUTE
    // accordé à `authenticated` + garde interne is_super_admin(), qui rend bien 42501),
    // cette RPC a EXECUTE *révoqué* pour `authenticated` : PostgREST échoue alors AVANT
    // d'entrer dans la fonction, et le code rendu dépend de sa version (42883 / PGRST202
    // selon que la fonction est masquée du cache de schéma ou refusée à l'exécution).
    // Épingler une de ces valeurs rendrait le test faux à la première montée de version,
    // sur un comportement par ailleurs correct. Ce qui compte : rien ne sort.
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('refuse l\'anonyme', async () => {
    const { data, error } = await anonClient().rpc('kyb_review_digest_payload')
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
```

> Si l'implémenteur observe que le code rendu est stable, resserrer en `expect(error?.code).toBe('42501')` (en déclarant alors la constante `DENIED` comme dans les specs voisines) : une assertion plus serrée vaut mieux, mais seulement une fois le code OBSERVÉ, jamais supposé. Ne pas déclarer `DENIED` avant de l'utiliser — `npm run lint` couvre `tests/` et refuse une constante inutilisée.

- [ ] **Étape 2 : lancer pour voir échouer**

```bash
npm run test:backend -- tests/backend/kyb-review-digest.spec.ts
```

Attendu : ÉCHEC — `Could not find the function public.kyb_review_digest_payload`.

- [ ] **Étape 3 : écrire la migration**

Créer `supabase/migrations/<DATE-DU-MERGE>_kyb_review_digest.sql` :

```sql
-- Le relecteur cesse d'avoir a penser a regarder.
--
-- POURQUOI. Audit d'onboarding du 01.08.2026 : aucun dossier, d'aucun pays, ne peut
-- s'auto-valider (le veto `id_document` n'accepte que 'match' et aucun connecteur ne le
-- produit). Le passage humain est le chemin UNIQUE, et rien n'allait chercher l'humain :
-- la file ne se decouvrait qu'en ouvrant sa page.
--
-- CE QUE CE N'EST PAS. Pas une alerte par dossier -- elle se ferait filtrer. Un point par
-- jour, qui ne part QUE s'il y a quelque chose a dire (l'edge function s'arrete d'elle-meme
-- sur une file vide).
--
-- POURQUOI UNE RPC DE CHARGE UTILE plutot que des lectures directes depuis l'edge function :
-- la liste des destinataires vit deja en base (super_admin_allowlist()), la file aussi. Une
-- seule RPC les rend ensemble, sous une seule garde, et le jour ou l'allowlist change, le
-- digest suit sans redeploiement.
--
-- Idempotente : create or replace, cron.unschedule garde par un bloc exception.

begin;

create or replace function public.kyb_review_digest_payload()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_dossiers jsonb;
begin
  -- service_role SEUL : un cron appelle ceci, jamais un navigateur. Pas de branche
  -- is_super_admin() -- la console a deja get_admin_agency_review_queue pour le meme besoin,
  -- et deux portes sur la meme donnee sont deux portes a garder d'accord.
  if not public.is_service_role() then
    raise exception 'forbidden: service_role only' using errcode = '42501';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'agency_id',    a.id,
               'agency_name',  coalesce(nullif(btrim(a.legal_name), ''), a.name),
               'country',      a.country,
               'score',        a.verification_score,
               'submitted_at', a.identity_submitted_at,
               -- Jours PLEINS ecoules. floor et non round : un dossier de 30 heures se dit
               -- « depuis 1 jour », jamais « depuis 2 ».
               'age_days',     floor(extract(epoch from (now() - a.identity_submitted_at)) / 86400)::int
             )
             order by a.identity_submitted_at
           ),
           '[]'::jsonb)
    into v_dossiers
    from public.agencies a
   where a.verification_status = 'manual_review'
     and a.identity_submitted_at is not null;

  return jsonb_build_object(
    'recipients', to_jsonb(public.super_admin_allowlist()),
    'dossiers',   v_dossiers
  );
end;
$$;

comment on function public.kyb_review_digest_payload() is
  'Charge utile du digest quotidien de revue KYB (01.08.2026) : les agences en verification_status=''manual_review'' avec leur ancienneté en jours pleins, et les destinataires lus dans super_admin_allowlist() -- une seule liste, jamais une seconde à tenir à jour. Rend toujours un tableau (vide si rien n''attend) : c''est l''edge function qui décide de ne pas envoyer. service_role uniquement.';

revoke all on function public.kyb_review_digest_payload() from public, anon, authenticated;
grant execute on function public.kyb_review_digest_payload() to service_role;

-- ─── Le dispatch, meme patron que sweep_pending_agency_verifications ────────────────
create or replace function public.dispatch_kyb_review_digest()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base_url text := public.get_app_config('supabase_url');
  v_svc_key  text := public.get_app_config('service_role_key');
begin
  -- Environnement non configure (local/CI sans app_config seede) -> no-op silencieux plutot
  -- qu'une violation NOT NULL sur http_request_queue.url. Meme garde que le filet horaire.
  if v_base_url is null or v_base_url = '' or v_svc_key is null or v_svc_key = '' then
    return;
  end if;

  -- Aucun filtre sur la file ICI : l'edge function lit la charge utile et s'arrete si elle
  -- est vide. Un second endroit qui deciderait « y a-t-il quelque chose a dire » serait un
  -- second endroit a tenir d'accord avec le premier.
  begin
    perform net.http_post(
      url := v_base_url || '/functions/v1/kyb-review-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_svc_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'dispatch_kyb_review_digest: dispatch echoue: %', sqlerrm;
  end;
end;
$$;

comment on function public.dispatch_kyb_review_digest() is
  'Déclenche l''edge function kyb-review-digest via net.http_post (best-effort, jamais bloquant). Planifiée une fois par jour à 08:00 UTC via cron.schedule si pg_cron est présent (absent en local/CI). service_role uniquement.';

revoke all on function public.dispatch_kyb_review_digest() from public, anon, authenticated;
grant execute on function public.dispatch_kyb_review_digest() to service_role;

commit;

-- ─── Planification (hors transaction, meme idiome que le filet horaire) ─────────────
do $$ begin perform cron.unschedule('kyb-review-digest-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- 08:00 UTC : le matin en Suisse (09h ou 10h selon la saison), avant la journee de
    -- travail plutot qu'au milieu.
    perform cron.schedule('kyb-review-digest-daily', '0 8 * * *',
      $cron$ select public.dispatch_kyb_review_digest(); $cron$);
  end if;
end $$;
```

- [ ] **Étape 4 : lancer le test backend pour le voir passer**

```bash
npm run lint:migrations && npm run test:backend -- tests/backend/kyb-review-digest.spec.ts
```

Attendu : `lint:migrations` PASS, puis les 5 tests PASS.

- [ ] **Étape 5 : écrire l'edge function**

Créer `supabase/functions/kyb-review-digest/index.ts` :

```ts
// supabase/functions/kyb-review-digest/index.ts
//
// Envoie aux super-admins le point quotidien des dossiers KYB en attente de revue.
//
// POURQUOI CETTE FONCTION EXISTE. Audit d'onboarding du 01.08.2026 : aucun dossier ne peut
// s'auto-valider, donc chacun attend un humain -- et rien n'allait chercher cet humain. La
// console montre la file a qui l'ouvre ; ce courriel s'adresse a qui ne l'a pas ouverte.
//
// POURQUOI ELLE NE DECIDE PAS QUI ATTEND. Toute la lecture vit dans kyb_review_digest_payload()
// : une seule definition de « en attente », une seule liste de destinataires. Cette fonction
// compose et envoie, rien d'autre.
//
// Auth : Bearer == cle service-role, comparaison a temps constant, meme motif que
// agency-verification-notify et agency-verification-run. Aucun chemin utilisateur.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildReviewDigest, type PendingDossier } from '../_shared/kyb-review-digest.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface DigestPayload {
  recipients: string[]
  dossiers: PendingDossier[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!serviceRoleKey || !safeEqual(provided, serviceRoleKey)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const { data, error } = await supabase.rpc('kyb_review_digest_payload')
    if (error) throw error
    const payload = data as DigestPayload

    const notice = buildReviewDigest({
      dossiers: payload.dossiers ?? [],
      appUrl: Deno.env.get('APP_URL') ?? 'https://app.megga.ch',
    })

    // Rien a dire = rien envoye. Un digest quotidien qui arrive tous les jours pour dire
    // « rien » se fait ignorer, puis filtrer, et n'est plus lu le jour ou il compte.
    if (!notice) return json({ ok: true, skipped: 'empty_queue' })

    const recipients = (payload.recipients ?? []).filter((e) => typeof e === 'string' && e.includes('@'))
    if (recipients.length === 0) {
      // Dit, jamais tu : une allowlist vide est un fait qu'on doit pouvoir constater.
      console.error('[kyb-review-digest] aucun destinataire dans super_admin_allowlist')
      return json({ ok: true, skipped: 'no_recipient', pending: payload.dossiers.length })
    }

    // Sans cle Resend, on ne pretend pas avoir envoye -- meme discipline que
    // agency-verification-notify.
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendKey) {
      console.error('[kyb-review-digest] RESEND_API_KEY absente, digest non envoye')
      return json({ ok: true, skipped: 'resend_key_missing', pending: payload.dossiers.length })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'MEGGA Console <noreply@megga.ch>',
        to: recipients,
        subject: notice.subject,
        html: notice.html,
      }),
    })
    // Le statut seul, jamais le corps : il peut contenir un echo de la requete, donc des
    // adresses.
    if (!res.ok) throw new Error(`Resend a repondu ${res.status}`)

    // PAS d'activity_events ici, contrairement a agency-verification-notify : cet envoi ne
    // concerne AUCUNE agence (agency_id serait null) et n'est pas un acte de conformite. Le
    // journaliser dans une table append-only conservee dix ans y ajouterait du bruit
    // d'exploitation ineffacable.
    return json({ ok: true, recipients: recipients.length, pending: payload.dossiers.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[kyb-review-digest]', message)
    return json({ error: message }, 500)
  }
})
```

- [ ] **Étape 6 : enregistrer la fonction dans le roster et type-checker**

```bash
node scripts/check-edge-roster.mjs --write && node scripts/check-edge-roster.mjs
```

Attendu : régénération de `src/lib/edgeFunctionRoster.ts` et du bloc généré de `supabase/config.toml`, puis le second appel sort en 0.

⚠️ Vérifier ensuite à la main, dans `supabase/config.toml`, que l'entrée `[functions.kyb-review-digest]` porte `verify_jwt = false` (comme `agency-verification-notify`) : l'appelant est pg_net avec un Bearer service-role, pas un JWT utilisateur, et la garde est faite dans le code.

```bash
deno check --no-lock supabase/functions/kyb-review-digest/index.ts
```

Attendu : aucune erreur.

- [ ] **Étape 7 : vérifier l'ensemble**

```bash
npx tsc -b && npm run lint && npm run test:unit && npm run lint:migrations
```

Attendu : les quatre passent.

- [ ] **Étape 8 : commit**

```bash
git add supabase/functions/kyb-review-digest supabase/migrations supabase/config.toml src/lib/edgeFunctionRoster.ts tests/backend/kyb-review-digest.spec.ts
git commit -m "feat(console-admin): un digest quotidien va chercher le relecteur, il ne l'attend plus"
```

---

## Après le merge

- [ ] **Re-dater les migrations au jour du merge**, par liste nommée (`<DATE>_kyb_notify_manual_review.sql`, `<DATE>_kyb_review_digest.sql`) — APRÈS le dernier rebase, jamais par un glob sur la date.
- [ ] **Vérifier l'application réelle** : `npm run check:drift` doit sortir vert, et en base `select jobname, active from cron.job where jobname = 'kyb-review-digest-daily'` doit rendre une ligne active.
- [ ] **Confirmer que `RESEND_API_KEY` et `APP_URL` sont posés** dans les secrets Supabase. Sans `RESEND_API_KEY`, les deux courriels de ce plan s'arrêtent honnêtement (`skipped: resend_key_missing`) — la chaîne est complète mais muette. Ce point n'a pas été vérifié pendant l'audit : les secrets ne sont pas listables par le MCP.
- [ ] **Exercer la chaîne une fois en production** : soumettre un dossier de test, vérifier l'arrivée de l'accusé de réception, puis `select public.dispatch_kyb_review_digest();` et vérifier l'arrivée du digest. Rien de ce plan n'est « terminé » avant de l'avoir vu fonctionner.
- [ ] **Mettre le cerveau à jour** : éditer `.claude-flow/knowledge/megga-memory.seed.json` (entrées `megga/onboarding-*` et `megga/pg-cron`, qui liste les jobs) puis `npm run ruflo:seed`.
