# Patch 07 — Resserrer les policies `anon` trop larges (S12, S31)

**Type** : migration SQL. Nouveau fichier `supabase/migrations/<ts>_tighten_anon_policies.sql`.

## Problème (vérifié live)
- `support_tickets` · policy `anon_select_own_ticket` = **`USING (true)`** → un anon lit **tous** les tickets.
- `ticket_events` · `anon_select_events` = `USING (true)` ; `ticket_messages` · `anon_select_messages` =
  `USING (is_internal_note = false)` → lecture large.
- `visits` · `anon_select_visit_by_token` = **`USING (manage_token IS NOT NULL)`** → un anon lit **toutes** les
  visites tokenisées **sans connaître le token**.
- `contacts` · `contacts_anon_onboarding_insert` = `WITH CHECK (source = 'onboarding')` **sans** contrainte
  d'`agency_id` → un anon injecte des leads onboarding dans n'importe quelle agence (S31).

Le fond du problème : une policy RLS ne peut pas « connaître » le token détenu par l'appelant — donc `USING (true)`
a été utilisé faute de mieux. La bonne architecture = **ne pas exposer ces tables en SELECT à `anon`** et passer par
une **RPC `SECURITY DEFINER` tokenisée** (la fonction reçoit le token en paramètre et ne renvoie que la ligne
correspondante), comme le fait déjà `seller-portal-action`.

## Correctif recommandé (direction)

### (a) `visits` — remplacer la policy par une RPC tokenisée
```sql
-- 1) Retirer l'accès anon en lecture directe
drop policy if exists anon_select_visit_by_token on public.visits;

-- 2) RPC qui exige le token exact (retourne 0 ou 1 ligne)
create or replace function public.get_visit_by_token(p_token uuid)
returns setof public.visits
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.visits where manage_token = p_token
$$;
revoke execute on function public.get_visit_by_token(uuid) from public;
grant  execute on function public.get_visit_by_token(uuid) to anon, authenticated;
```
Puis migrer le front (page publique de gestion de visite) pour appeler `rpc('get_visit_by_token', { p_token })`
au lieu d'un `select` filtré côté client.

### (b) `support_tickets` / `ticket_events` / `ticket_messages`
Même schéma : `drop policy` des SELECT anon `USING (true)`, exposer une RPC `get_ticket_by_token(p_token)` qui
renvoie le ticket + ses messages non-internes pour le token fourni. (Nécessite une colonne token/reference sur
`support_tickets` — **vérifier son existence** ; si le suivi public passe déjà par un token, réutiliser cette colonne.)

### (c) S31 — borner l'insert onboarding anonyme
Si l'`agency_id` de destination est connu au moment du formulaire (slug d'agence), le valider ; sinon router les
leads publics vers une **agence système / file de tri** plutôt que d'accepter un `agency_id` arbitraire :
```sql
alter policy contacts_anon_onboarding_insert on public.contacts
  with check (
    source = 'onboarding'
    and agency_id in (select id from public.agencies where accepts_public_leads is true)  -- ou une agence système fixe
  );
```
(Adapter au modèle réel ; l'objectif = un anon ne choisit pas librement l'`agency_id`.)

## Interim (si le refactor RPC ne peut pas être fait avant lancement)
A minima, restreindre les SELECT anon à `false` (désactive la fonctionnalité publique concernée mais **stoppe la
fuite**) le temps de livrer les RPC :
```sql
alter policy anon_select_own_ticket on public.support_tickets using (false);
```

## Test
- Anon `select * from visits` → 0 ligne (avant : toutes les visites tokenisées) ; `rpc('get_visit_by_token', bon_token)` → 1 ligne.
- Anon `select * from support_tickets` → 0 ligne.
- Anon insert contact `source='onboarding'` avec `agency_id` arbitraire → refusé/redirigé.
