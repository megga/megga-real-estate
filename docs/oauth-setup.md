# OAuth Setup — Google + Microsoft

Le code MEGGA appelle déjà `supabase.auth.signInWithOAuth({ provider: 'google' | 'azure' })`
côté front (boutons « Continuer avec Google / Microsoft » dans le bento auth).
Pour que les boutons fassent quelque chose en prod, il faut **activer les providers
côté Supabase** avec un Client ID + Secret obtenus chez Google / Microsoft.

> **Sans cette config** : les boutons affichent une erreur silencieuse
> (`oauth.signin.failure` loggé dans `auth_events`) et redirigent vers
> `/auth/connexion?error=provider_not_enabled`.

---

## 🔵 Google

### 1. Créer un projet Google Cloud (si pas encore fait)

1. Va sur https://console.cloud.google.com
2. Top bar → **Select a project** → **New Project**
3. Name : `MEGGA Auth` (ou réutilise un projet existant)
4. **Create**

### 2. Configurer l'écran de consentement OAuth

1. Menu de gauche → **APIs & Services** → **OAuth consent screen**
2. **User Type** : **External** (pour accepter les emails Gmail + Workspace tiers)
3. Remplis :
   - App name : `MEGGA`
   - User support email : `support@megga.ch` (ou ton email)
   - Authorized domains : `megga.ch`, `eayczugyrvmtqnnmvjod.supabase.co`
   - Logo : 120×120 (logo MEGGA)
   - Privacy policy URL : `https://megga.ch/privacy`
   - Terms of service URL : `https://megga.ch/cgu`
   - Developer contact : ton email
4. Scopes : laisser les 3 par défaut (`openid`, `email`, `profile`)
5. Save and continue → **Publish App** (sinon tu es limité à 100 testeurs)

### 3. Créer le Client ID OAuth 2.0

1. **APIs & Services** → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
2. Application type : **Web application**
3. Name : `MEGGA Supabase`
4. **Authorized JavaScript origins** : `https://megga.ch`, `https://eayczugyrvmtqnnmvjod.supabase.co`
5. **Authorized redirect URIs** : **`https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback`**
   ⚠️ Cette URL doit être **exactement celle-ci**, sans trailing slash, sans variation.
6. **Create**
7. Copie le **Client ID** et le **Client Secret** qui s'affichent dans la modal.

### 4. Coller dans Supabase

1. https://supabase.com/dashboard/project/eayczugyrvmtqnnmvjod/auth/providers
2. Trouve **Google** dans la liste → clique pour ouvrir
3. Toggle **Enable Sign in with Google** → ON
4. Colle :
   - **Client ID (for OAuth)** : `<Client ID Google>`
   - **Client Secret (for OAuth)** : `<Client Secret Google>`
5. Note la **Callback URL** affichée par Supabase — elle doit matcher celle que tu as
   mise dans Google (`https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback`).
6. **Save**

### 5. Test

1. Va sur `https://megga.ch/auth/connexion?pro`
2. Clique **« Continuer avec Google »**
3. Tu dois être redirigé vers `accounts.google.com/o/oauth2/...` (écran de choix de compte)
4. Choisis un compte → autorise → tu reviens sur `/auth/callback` → onboarding ou dashboard

---

## 🟦 Microsoft (Azure AD)

### 1. Créer une App Registration Azure

1. https://portal.azure.com → **Azure Active Directory** → **App registrations**
2. **+ New registration**
3. Remplis :
   - Name : `MEGGA Auth`
   - **Supported account types** : sélectionne
     **« Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox) »**
     → permet de se loguer avec n'importe quelle adresse Microsoft (perso ou pro).
   - **Redirect URI** :
     - Platform : **Web**
     - URI : **`https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback`**
4. **Register**
5. Sur la page de l'app, note l'**Application (client) ID** affiché en haut.

### 2. Créer un Client Secret

1. Menu de gauche de l'app → **Certificates & secrets**
2. Onglet **Client secrets** → **+ New client secret**
3. Description : `Supabase Auth`
4. Expires : `24 months` (recommandé)
5. **Add**
6. **⚠️ Copie immédiatement la valeur** du secret affiché — elle ne sera plus
   visible ensuite (Microsoft la masque dès qu'on quitte la page).

> Note : copie **la valeur** (colonne « Value »), pas l'ID du secret (colonne « Secret ID »).

### 3. (Optionnel mais recommandé) Configurer les permissions

1. Menu de l'app → **API permissions**
2. **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Coche : `openid`, `email`, `profile`, `offline_access`, `User.Read`
4. **Add permissions**
5. **Grant admin consent for <tenant>** (bouton bleu en haut de la liste)
   → permet à tes users de se loguer sans voir l'écran « request approval » Microsoft.

### 4. Coller dans Supabase

1. https://supabase.com/dashboard/project/eayczugyrvmtqnnmvjod/auth/providers
2. Trouve **Azure** dans la liste (Microsoft = Azure côté Supabase) → clique
3. Toggle **Enable Sign in with Azure** → ON
4. Colle :
   - **Application (client) ID** : `<Application ID Azure>`
   - **Client Secret** : `<la valeur du secret>`
   - **Azure Tenant URL** : `https://login.microsoftonline.com/common/v2.0`
     ⚠️ Garder `common` pour accepter tous les comptes (perso + work).
     Si tu veux restreindre à ton organisation, remplace `common` par le `Tenant ID`.
5. Note la **Callback URL** affichée par Supabase — elle doit matcher celle que tu
   as mise dans Azure.
6. **Save**

### 5. Test

1. Va sur `https://megga.ch/auth/connexion?pro`
2. Clique **« Continuer avec Microsoft »**
3. Tu dois être redirigé vers `login.microsoftonline.com/common/oauth2/v2.0/authorize?...`
4. Choisis un compte → autorise → retour sur `/auth/callback`

---

## 🔍 Debug en cas d'échec

### Erreur « redirect_uri_mismatch »

L'URI de redirection que tu as configurée chez Google / Azure ne correspond pas
à celle de Supabase. Compare-les caractère par caractère :
- ✅ `https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback`
- ❌ `https://eayczugyrvmtqnnmvjod.supabase.co/auth/v1/callback/` (trailing slash)
- ❌ `http://...` (pas https)

### Erreur « invalid_client »

Le Client ID ou le Secret collé dans Supabase est faux. Recopie depuis le
provider source (Google ou Azure).

### Le bouton ne fait rien (ne redirige pas)

Ouvre la DevTools console — tu devrais voir le message d'erreur de Supabase
(`provider not enabled`, `invalid grant`, etc.). Le détail est aussi loggé dans
`auth_events` (action = `oauth.signin.failure`, detail contient le message).

```sql
SELECT action, severity, detail, created_at
FROM auth_events
WHERE action LIKE 'oauth%' AND created_at > now() - interval '1 hour'
ORDER BY created_at DESC LIMIT 10;
```

### Le user revient sur `/auth/callback` puis sur la page d'accueil sans être connecté

`AuthCallbackPage.tsx` n'a pas pu créer la session — vérifie :
1. Le provider est activé côté Supabase (Toggle ON visible)
2. La callback URL est exacte
3. L'onglet **Logs** dans Supabase Dashboard → Auth → Logs (filtre par error)

---

## 📋 Checklist de déploiement

- [ ] Google : projet créé, OAuth consent screen publié, Client ID + Secret créés, redirect URI = Supabase callback
- [ ] Google : Client ID + Secret collés dans Supabase, provider activé
- [ ] Microsoft : app registration créée, multi-tenant + personal accounts, redirect URI = Supabase callback
- [ ] Microsoft : Client Secret généré (valeur copiée), permissions Graph accordées
- [ ] Microsoft : App ID + Secret + Tenant URL = `common/v2.0` collés dans Supabase, provider activé
- [ ] Smoke test : bouton Google sur `/auth/connexion?pro` → redirection Google → retour authentifié
- [ ] Smoke test : bouton Microsoft idem
- [ ] `auth_events` : voir des `oauth.signin.success` arriver après chaque connexion réussie

Une fois ces 8 cases cochées, le pack auth est 100 % opérationnel : magic link
+ password + OAuth Google + OAuth Microsoft, tous protégés par Turnstile invisible
et loggués dans `auth_events` avec IP hashée.
