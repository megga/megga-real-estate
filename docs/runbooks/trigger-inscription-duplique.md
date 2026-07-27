# Runbook — inscriptions cassées après le versionnage du trigger `auth.users`

> **Statut : historique, plus un risque ouvert.** Depuis la mise à jour du 27.07.2026
> de `20260726140000_auth_user_created_trigger.sql`, la migration ne supprime plus le
> trigger par son seul nom canonique : elle interroge `pg_trigger` et supprime TOUS les
> triggers non-internes de `auth.users` dont la fonction est `handle_new_user()`, quel
> que soit leur nom, avant de reposer `on_auth_user_created`. Le scénario décrit
> ci-dessous — un doublon qui survit à un DROP nommé — ne peut donc plus se produire
> par cette migration, sur aucun nom. Ce document reste utile pour deux cas : (a) un
> doublon qui existait déjà en production avant ce correctif, jamais nettoyé depuis, et
> (b) un doublon futur créé par un mécanisme totalement différent (ex. re-création
> manuelle en console Supabase après coup). Le contrôle pré-merge décrit plus bas n'est
> plus une condition bloquante — il reste une vérification de confiance, optionnelle.

**Objet :** procédure de détection et de rétablissement si `auth.users` porte un
trigger en double appelant `handle_new_user()`, quelle qu'en soit l'origine.

**Propriétaire :** Dev backend (Julien)
**Dernière revue :** 27.07.2026
**Version :** 1.1 — risque neutralisé par la migration elle-même (voir statut ci-dessus)

---

## Pourquoi ce risque existe

`public.handle_new_user()` est définie dans les migrations depuis la baseline et a été
modifiée deux fois (`20260627120000` clamp du rôle, `20260718130000` provisioning
d'agence). Le **trigger** qui l'appelle, lui, n'a jamais figuré dans aucune migration :
il a été créé hors du contrôle de version, probablement depuis la console Supabase.

La migration `20260726140000` le fait entrer au contrôle de version. **Dans sa version
d'origine** (avant le 27.07.2026), elle faisait `drop trigger if exists
on_auth_user_created on auth.users` puis le recréait — un DROP qui ne couvrait que le
nom canonique. Si le trigger de production portait un autre nom, il survivait, et la
migration en ajoutait un second qui appelait la même fonction. C'est ce scénario que le
reste de ce document détaille. **Depuis le 27.07.2026**, la migration supprime par
requête sur `pg_trigger` (et non plus par nom fixe) tout trigger appelant
`handle_new_user()` : ce mode de défaillance précis est fermé.

---

## Le contrôle qui évite tout ce runbook

**Historique.** Ce contrôle était la seule parade avant le 27.07.2026 : il fallait le
faire manuellement, **avant** de merger la migration, dans le SQL editor du projet de
production. Il n'est plus bloquant — la migration s'auto-corrige quel que soit le nom
du trigger existant — mais reste une vérification de confiance rapide, ou un point de
départ pour diagnostiquer un doublon apparu par un autre mécanisme.

```sql
select t.tgname            as trigger_name,
       p.proname           as fonction_appelee,
       t.tgenabled         as actif,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class     c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc      p on p.oid = t.tgfoid
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
order by t.tgname;
```

| Résultat | Lecture |
|---|---|
| 1 ligne, `trigger_name = on_auth_user_created` | Cas nominal. |
| 1 ligne, **autre nom**, `fonction_appelee = handle_new_user` | Cas géré automatiquement depuis le 27.07.2026 : le prochain rejeu de `20260726140000` (tant qu'elle est encore rejouée le même jour que sa création) le supprime et repose le canonique. Hors de cette fenêtre, appliquer la résolution ci-dessous. |
| 0 ligne | Le trigger n'existe pas non plus en prod. Les inscriptions ne créent donc aucun profil : c'est un autre problème, plus grave, à traiter avant. |
| 2 lignes ou plus | Le doublon existe déjà (état hérité d'avant le 27.07.2026, ou créé par un autre mécanisme). Appliquer la résolution ci-dessous sans attendre. |

---

## Symptôme de l'incident

**Toutes les inscriptions échouent.** Ce n'est pas une corruption silencieuse, c'est une
panne franche et immédiate.

- Le formulaire de la vitrine affiche une erreur au lieu de « Compte créé ».
- Les logs d'auth Supabase montrent un `POST /auth/v1/signup` en `500`, message
  `Database error saving new user`.
- Aucun compte n'est créé : la transaction est annulée en entier.

**Mécanisme.** Les deux triggers sont `AFTER INSERT ... FOR EACH ROW` et se déclenchent
dans l'ordre alphabétique de leur nom. Le premier insère la ligne dans `profiles`. Le
second réexécute le même `INSERT` avec le même `NEW.id`, qui est la clé primaire de
`profiles` : violation d'unicité `23505`. Aucun gestionnaire d'exception n'entoure cet
insert (seul l'appel à `provision_solo_agency` en a un). L'erreur remonte, l'`INSERT`
dans `auth.users` est annulé, et l'inscription échoue.

C'est une bonne nouvelle sur un point : la panne est bruyante. Personne ne se retrouve
avec des données à moitié écrites.

---

## Diagnostic, 1 minute

Exécuter la requête du contrôle ci-dessus sur la production. Deux lignes citant
`handle_new_user` confirment l'incident, et donnent le nom du doublon à supprimer.

Vérifier ensuite si des comptes sont restés sans profil, ce qui signalerait un mode de
défaillance différent de celui décrit ici :

```sql
select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at desc
limit 50;
```

Attendu dans cet incident : **aucune ligne**. Les inscriptions ayant échoué ont été
annulées en entier, elles n'ont donc rien laissé derrière elles. Des lignes ici
voudraient dire que le trigger ne s'exécute pas du tout, et non qu'il s'exécute deux
fois : ce runbook ne s'applique alors pas.

---

## Résolution immédiate

Supprimer le trigger en trop, en gardant `on_auth_user_created`. Remplacer
`<nom_du_doublon>` par le nom relevé au diagnostic.

```sql
drop trigger if exists <nom_du_doublon> on auth.users;
```

Vérifier qu'il n'en reste qu'un, en réexécutant la requête du contrôle. Attendu : une
seule ligne, `on_auth_user_created`.

Puis prouver que l'inscription refonctionne, avec un compte jetable :

```sql
select count(*) from auth.users where email like '%@megga-verif.local';
```

Créer un compte depuis la vitrine avec une adresse en `@megga-verif.local`, relancer la
requête, et vérifier qu'exactement un profil lui correspond :

```sql
select u.email, count(p.id) as profils
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@megga-verif.local'
group by u.email;
```

Attendu : `profils = 1`. Supprimer ensuite le compte de test depuis la console Auth.

---

## Rendre le correctif durable

Le `DROP` ci-dessus répare la production, mais les migrations de ce dépôt sont **en
avant seulement** : rien ne se déroule, tout se corrige par une migration suivante. Sans
cette étape, une base reconstruite depuis les migrations recréerait le doublon.

Ajouter le nom réel au `DROP` de la migration d'origine si elle n'est pas encore mergée.
Si elle l'est déjà, écrire une migration corrective datée du jour :

```sql
-- Supprime le trigger d'inscription hérité, laissé en place par 20260726140000.
-- Son nom n'était pas connu au moment d'écrire cette migration-là : le DROP ne
-- couvrait que le nom canonique, et les deux triggers coexistaient, faisant échouer
-- toute inscription sur une violation de clé primaire dans profiles.
--
-- Idempotente : DROP IF EXISTS.

drop trigger if exists <nom_du_doublon> on auth.users;
```

---

## Prévention

La vraie parade est désormais dans la migration elle-même : `20260726140000` supprime
tout trigger de `auth.users` dont la fonction est `handle_new_user()`, quel que soit
son nom, avant de reposer le canonique — aucune étape manuelle n'est plus requise pour
ce cas précis. Le contrôle en tête de ce document reste une vérification de confiance
de trente secondes, utile en défense en profondeur ou face à un doublon d'une autre
origine ; il n'est plus inscrit comme condition de merge (il l'était dans
[le plan des étapes 0 et 1](../superpowers/plans/2026-07-26-onboarding-kyb-etapes-0-1.md),
tâche 2, avant ce correctif).

Plus largement, cet incident vient d'un objet de base créé hors migration. Tout objet
qui gouverne un comportement produit et qui ne vit que dans la console de production est
invisible à la relecture, absent des environnements de développement, et perdu en cas de
restauration. La migration `20260726140000` referme ce cas précis ; il vaut la peine de
vérifier qu'il n'y en a pas d'autres.

```sql
select n.nspname as schema, c.relname as table, t.tgname as trigger_name, p.proname as fonction
from pg_trigger t
join pg_class     c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc      p on p.oid = t.tgfoid
where not t.tgisinternal
  and n.nspname in ('auth', 'storage')
order by n.nspname, c.relname, t.tgname;
```

Tout trigger listé ici sur les schémas gérés par Supabase mérite d'être comparé au
contenu de `supabase/migrations/`.

---

## Ce que ce runbook ne couvre pas

Le rétablissement de la production en général. Il n'existe aujourd'hui aucune procédure
d'incident pour l'infrastructure (Supabase Pro, Cloudflare Pages, Resend, Stripe) : ce
document traite un seul mode de défaillance, celui qu'introduit une migration précise et
identifiée. Les autres restent à écrire.
