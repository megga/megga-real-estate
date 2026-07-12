# Runbook — « Impossible de créer un compte » / `422 email_exists`

**Objet :** Procédure de diagnostic et de résolution quand un utilisateur n'arrive
pas à créer son compte MEGGA et/ou qu'une création de compte renvoie
`422 : A user with this email address has already been registered`.

**Propriétaire :** Support / Ops
**Dernière revue :** 12.07.2026
**Version :** 1.0

---

## Symptôme

L'un ou l'autre de :

- L'utilisateur dit « je n'arrive pas à créer mon compte ».
- Le formulaire d'inscription de la vitrine affiche « Compte créé, vérifiez vos
  e-mails » mais **aucun e-mail n'arrive**.
- Les logs d'auth Supabase montrent un `POST /signup` ou `POST /admin/users` avec
  `error_code: email_exists` / `422`.

## Cause racine (la plus fréquente)

**Le compte existe déjà — souvent créé via un provider OAuth (Google/Microsoft),
donc sans mot de passe.** Un tel compte crée une double impasse pour l'utilisateur :

- **inscription e-mail + mot de passe** → « e-mail déjà enregistré » ;
- **connexion e-mail + mot de passe** → échoue (aucun mot de passe n'a été défini).

La seule porte d'entrée est le bouton du provider d'origine (« Continuer avec
Google »).

> ⚠️ Piège d'énumération : quand la protection anti-énumération de Supabase est
> active, `auth.signUp()` sur un e-mail **déjà confirmé** renvoie un **faux succès**
> (`error` nul, `data.user.identities: []`) et **n'envoie aucun e-mail**. La vitrine
> détecte désormais ce cas (`identities.length === 0`) et oriente vers la connexion
> — cf. correctif `549ad6c1` dans `sites/megga-vitrine/js/megga-auth.js`.

## Diagnostic (2 min)

Exécuter dans le SQL editor Supabase (remplacer `<email>`) :

```sql
select
  u.email,
  u.created_at,
  u.email_confirmed_at,
  (u.encrypted_password is not null and u.encrypted_password <> '') as has_password,
  u.raw_app_meta_data->'providers'                                   as providers
from auth.users u
where lower(u.email) = lower('<email>');

-- Providers liés (une ligne par identité) :
select i.provider, i.created_at
from auth.identities i
join auth.users u on u.id = i.user_id
where lower(u.email) = lower('<email>');
```

Interprétation :

| Résultat | Lecture |
|---|---|
| 1 ligne, `has_password = false`, `providers = ["google"]` | Compte **OAuth-only** → cas typique. Voir Résolution 1 ou 2. |
| 1 ligne, `has_password = true` | Le compte peut se connecter en mot de passe → problème ailleurs (mot de passe oublié, e-mail non confirmé). |
| 0 ligne | L'e-mail n'existe pas → la création devrait passer ; chercher un autre blocage (captcha Turnstile, rate limit). |

## Résolution

1. **L'utilisateur veut juste accéder à son compte** → lui dire de cliquer
   **« Continuer avec Google »** (ou Microsoft), **pas** « Créer un compte ». Le
   compte existe déjà et fonctionne.

2. **Il veut un login e-mail + mot de passe** → depuis la page de connexion,
   « **Mot de passe oublié ?** » → le lien de récupération lui permet de **poser un
   mot de passe** sur le compte existant (l'e-mail est déjà confirmé). Ne jamais
   saisir un mot de passe à sa place.

3. **Il lui faut un compte réellement distinct** (ex. tester en agent vierge) →
   son e-mail principal est pris définitivement ; utiliser un **alias**
   (`prenom.nom+test@…`).

## Ce qu'il NE faut PAS faire

- ❌ **Supabase Studio → Authentication → « Add user »** avec l'e-mail existant :
  renvoie `422 email_exists`, n'aide en rien. (C'est précisément ce qui apparaît
  comme `POST /admin/users → 422` dans les logs d'auth.)
- ❌ Recréer via le formulaire vitrine : même échec.
- ❌ Supprimer puis recréer le compte pour « repartir propre » : casse l'historique
  (profil, `agency_id`, audit) et n'est jamais nécessaire.

## Annexe — repères techniques

- **Inscription vitrine** = `auth.signUp()` (clé **anon** + captcha Turnstile) →
  endpoint GoTrue `/signup`. Code : `sites/megga-vitrine/js/megga-auth.js`.
- **`POST /admin/users`** = `admin.createUser` (**service_role uniquement**). Dans
  le code MEGGA, **aucun** chemin applicatif ne l'appelle (app, edge functions et
  vitrine créent des users via `signUp`/OAuth, jamais via l'API admin). Les seuls
  appelants de `createUser` sont les **tests backend**, et ils sont verrouillés sur
  une instance **locale** (garde `assertLocal()` dans `tests/backend/helpers/supabase.ts`)
  avec des e-mails uniques `@megga-test.local` — ils **ne touchent jamais la prod**.
  Donc un `POST /admin/users` en prod = **une action humaine manuelle** (panneau
  Studio « Add user » ou script ad-hoc), pas un automatisme.
- **`auth.audit_log_entries`** est vide sur ce projet (audit GoTrue non conservé) :
  ne pas compter dessus pour retrouver l'auteur d'une action admin.
