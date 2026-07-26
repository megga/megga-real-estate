# Runbook — inscriptions cassées après le versionnage du trigger `auth.users`

**Objet :** procédure de détection et de rétablissement si la migration
`20260726140000_auth_user_created_trigger.sql` crée un trigger en double sur
`auth.users`, au lieu de remplacer celui qui existe en production.

**Propriétaire :** Dev backend (Julien)
**Dernière revue :** 26.07.2026
**Version :** 1.0

---

## Pourquoi ce risque existe

`public.handle_new_user()` est définie dans les migrations depuis la baseline et a été
modifiée deux fois (`20260627120000` clamp du rôle, `20260718130000` provisioning
d'agence). Le **trigger** qui l'appelle, lui, n'a jamais figuré dans aucune migration :
il a été créé hors du contrôle de version, probablement depuis la console Supabase.

La migration `20260726140000` le fait entrer au contrôle de version. Elle fait
`drop trigger if exists on_auth_user_created on auth.users` puis le recrée. **Ce DROP ne
couvre que le nom canonique.** Si le trigger de production porte un autre nom, il
survit, et la migration en ajoute un second qui appelle la même fonction.

---

## Le contrôle qui évite tout ce runbook

À faire **avant** de merger la migration, dans le SQL editor du projet de production.

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
| 1 ligne, `trigger_name = on_auth_user_created` | Cas nominal. La migration remplace proprement, aucun risque. |
| 1 ligne, **autre nom**, `fonction_appelee = handle_new_user` | **Ne pas merger tel quel.** Ajouter le nom réel au `DROP TRIGGER IF EXISTS` de la migration, sinon on tombe dans l'incident ci-dessous. |
| 0 ligne | Le trigger n'existe pas non plus en prod. Les inscriptions ne créent donc aucun profil : c'est un autre problème, plus grave, à traiter avant. |
| 2 lignes ou plus | Le doublon existe déjà. Appliquer la résolution ci-dessous sans attendre. |

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

Le contrôle en tête de ce document est la seule parade réelle, et il prend trente
secondes. Il est inscrit comme condition de merge dans
[le plan des étapes 0 et 1](../superpowers/plans/2026-07-26-onboarding-kyb-etapes-0-1.md),
tâche 2.

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
