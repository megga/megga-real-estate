# Patch 01 — `send-email` : fermer le relais email ouvert (P0, S1a)

**Fichier** : `supabase/functions/send-email/index.ts`

## Problème
Le contrôle d'auth `if (!authHeader?.startsWith('Bearer '))` (l.340) **ne valide jamais le token** : n'importe
quel `Bearer x` passe. De plus le case `default` (l.411-417) envoie `data.html` **arbitraire** vers un `to`
**arbitraire** depuis `noreply@megga.ch`. → relais ouvert / phishing sous domaine de confiance.

## Correctif
1. Auth **réelle** (`requireAgentAuth`) sur tout template non explicitement public.
2. Réduire la liste publique aux templates à **contenu figé rendu serveur**.
3. `contact_notification_admin` : destinataire **forcé serveur** (jamais `body.to`).
4. Valider le format de `to`.

### (a) Ajouter l'import (en tête, après la ligne 5)
```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'   // ⬅️ AJOUT
```

### (b) Remplacer le bloc auth du handler

**AVANT** (l.335-346) :
```ts
    // ── Auth check (skip for public templates) ──────────────────────────────
    const PUBLIC_TEMPLATES = ['ticket_confirmation', 'visit_confirmation_buyer', 'contact_confirmation', 'contact_notification_admin']
    const isPublicTemplate = PUBLIC_TEMPLATES.includes(template)
    if (!isPublicTemplate) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
```

**APRÈS** :
```ts
    // ── Auth ────────────────────────────────────────────────────────────────
    // Templates PUBLICS = contenu 100% rendu serveur, destinataire = le visiteur
    // du formulaire. Tout le reste (dont le case `default` avec data.html) exige
    // une vraie session agent — sous --no-verify-jwt, `startsWith('Bearer ')` ne
    // prouvait RIEN (relais ouvert). cf. audit S1a.
    const PUBLIC_TEMPLATES = ['ticket_confirmation', 'contact_confirmation']
    const isPublicTemplate = PUBLIC_TEMPLATES.includes(template)
    if (!isPublicTemplate) {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
    }

    const isEmail = (s: unknown): s is string =>
      typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
    if (!isEmail(to)) {
      return new Response(JSON.stringify({ error: 'Invalid "to" address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
```
> `visit_confirmation_buyer` sort de la liste publique (il n'a pas de case → tombait sur `default`/`data.html`).
> Les confirmations de visite passent déjà par `send-visit-email`. Si un flux public l'utilisait encore, le
> re-router vers un template dédié rendu serveur plutôt que de rouvrir le `default`.

### (c) Forcer le destinataire admin (juste avant l'envoi Resend, ~l.420)

**AVANT** (l.420-435, extrait) :
```ts
    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    ...
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [to],
```

**APRÈS** :
```ts
    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    ...
    // La notification admin ne doit JAMAIS partir vers un `to` fourni par l'appelant.
    const recipient = template === 'contact_notification_admin'
      ? (Deno.env.get('CONTACT_NOTIFICATION_TO') ?? 'contact@megga.ch')
      : to
    ...
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [recipient],
```

## Durcissement complémentaire (recommandé, non bloquant)
- **Rate-limit** par IP sur les templates publics (`contact_confirmation`, `ticket_confirmation`) + captcha token
  (le captcha Auth est déjà activé côté projet) — empêche l'usage en envoyeur de spam à contenu figé.
- Optionnel : restreindre le case `default`/`data.html` (même authentifié) à une allowlist de templates connus,
  pour couper tout envoi de HTML arbitraire même par un agent.

## Test
- Sans `Authorization` valide + `template:'seller_estimation'` → doit renvoyer 401 (avant : 200).
- `template:'default'` + faux `Bearer x` + `data.html:'<script>…'` → 401 (avant : email envoyé).
- `template:'contact_notification_admin'` + `to:'attacker@evil.com'` → email part vers `CONTACT_NOTIFICATION_TO`, pas vers l'attaquant.
- `contact_confirmation` avec `to` valide → OK (flux public préservé).
- Ajouter un test backend `tests/backend/send-email-auth.spec.ts` couvrant ces cas.
