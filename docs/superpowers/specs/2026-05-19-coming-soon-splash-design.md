# Coming Soon Splash — Design

**Date :** 2026-05-19
**Branche :** `claude/install-coming-soon-page-nmeVJ`
**Statut :** Validé en brainstorming

## Contexte

Le site MEGGA n'est pas encore prêt pour le public. Aujourd'hui, un splash très basique (`PasswordGate`) affiche "MEGGA — Site en cours de développement" et demande un mot de passe (`gg`) avant de révéler n'importe quelle route. Une page Coming Soon Property X esthétiquement aboutie existe déjà à `/coming-soon` (`PxComingSoonHero` + `PxFooterV3`, Figma node `9552:21496`) mais elle est elle-même cachée derrière le `PasswordGate`, donc invisible des visiteurs.

L'objectif : utiliser cette page Coming Soon Property X comme nouveau splash universel pour TOUS les visiteurs, intégrer un mécanisme d'accès interne discret pour l'équipe, et collecter les emails d'une waitlist publique en base.

## Objectifs

1. **Public** voit la page Coming Soon Property X au lieu du splash basique actuel
2. **Équipe** peut accéder au site via un lien discret + modal mot de passe
3. **Waitlist** : les emails saisis sont sauvegardés en DB
4. Page **i18n** (FR / DE / EN / IT) — texte actuel en anglais hardcodé
5. Aucune régression sur le mécanisme `PasswordGate` existant (bypass dev, routes `/kyc/*` exemptées)

## Hors scope

- Refonte visuelle de la page Coming Soon (on garde le Figma node `9552:21496` fidèle)
- Envoi automatique d'email de confirmation au subscriber (pas de Resend transactional pour cette itération)
- Page admin pour gérer la liste des subscribers (export SQL suffisant pour cette itération)
- Rate-limiting sophistiqué sur l'insert anon (RLS suffit pour un splash temporaire)

## Architecture

### Avant

```
PasswordGate (App.tsx wrapper)
├── if authorized → <children> (le site complet)
└── else → splash basique inline ("MEGGA — Site en cours de développement" + input mdp)
```

### Après

```
PasswordGate
├── if authorized → <children>
└── else → <ComingSoonSplash />
            ├── <PxComingSoonHero />        (Figma 9552:21496, form Subscribe branché)
            ├── <ComingSoonFooter />        (footer simplifié : logo + © + "Accès équipe")
            └── <PasswordModal />           (créé via createPortal, ouvert au clic sur "Accès équipe")
```

`PropertyXComingSoonPage` (route `/coming-soon`) reste inchangée — elle utilise `PxFooterV3` (footer complet) et redevient une vraie page publique une fois le `PasswordGate` retiré.

## Composants

### Nouveau : `src/components/layout/ComingSoonSplash.tsx`

Container du splash. Affiche `PxComingSoonHero` + footer simplifié + modal mdp. Prop `onUnlock: () => void` pour signaler à `PasswordGate` que l'utilisateur a entré le bon mot de passe.

État local :
- `modalOpen: boolean` — ouvre/ferme le `PasswordModal`

### Nouveau : `src/components/layout/PasswordModal.tsx`

Modal centré (`createPortal(document.body)`, `z-[100]`). Champ password, bouton "Entrer", état erreur. Esc / clic backdrop ferme. Prop `onSuccess: () => void` appelée si mdp correct.

Validation : compare avec `SITE_PASSWORD = 'gg'` (importé/dupliqué de `PasswordGate.tsx`). Si OK → `sessionStorage.setItem('megga-site-access', 'true')` puis `onSuccess()`.

Design (tokens Property X) :
- Backdrop : `rgba(0,0,0,0.5)` blur léger
- Card : `bg-neutral200`, `rounded-large` (24px), padding 32, max-width 380
- Titre : `font-display 24 500 neutral700` — "Accès interne"
- Input : style identique au pill Property X (neutral300, rounded-pill, h-52)
- Bouton : `bg-neutral700 text-neutral100 rounded-pill h-52` — "Entrer"
- Erreur : `text-red-500 text-12` sous l'input

### Refactor : `src/components/layout/PasswordGate.tsx`

- Supprimer la JSX du splash inline (lignes 42-77)
- Garder toute la logique (`useState authorized`, `BYPASS_GATE`, `isPublicRoute`, `sessionStorage`)
- Remplacer le retour non-authorized par `<ComingSoonSplash onUnlock={() => setAuthorized(true)} />`
- Le state `password` / `error` / `handleSubmit` migrent dans `PasswordModal`

### Refactor : `src/components/propertyx/sections/PxComingSoonHero.tsx`

- Remplacer le `<form onSubmit={e => e.preventDefault()}>` par un vrai handler asynchrone
- Hook `useState` pour les états `idle | loading | success | error`
- Hook `useTranslation('comingSoon')` pour tous les textes
- Validation email côté client : regex simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Insert via `supabase.from('coming_soon_subscribers').insert({ email, locale: i18n.language, source: 'coming_soon_splash', user_agent: navigator.userAgent })`
- Sur succès : remplace le `<form>` par un message `"✓ Merci ! On vous notifiera."` (même pill, même couleurs, juste le contenu change)
- Sur unique-violation (Postgres code `23505`) : message "Cet email est déjà dans la liste."
- Sur autre erreur : "Une erreur est survenue, réessayez."

## Schema DB

### Migration : `supabase/migrations/20260519_001_coming_soon_subscribers.sql`

```sql
-- Coming Soon waitlist : emails collectés via le splash public.
CREATE TABLE coming_soon_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'fr',
  source text NOT NULL DEFAULT 'coming_soon_splash',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coming_soon_subscribers_created_at
  ON coming_soon_subscribers (created_at DESC);

ALTER TABLE coming_soon_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon (visiteurs publics du splash) : INSERT only, jamais SELECT.
CREATE POLICY "anon_insert_email"
  ON coming_soon_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admin authentifié : SELECT pour exporter la liste.
CREATE POLICY "admin_select_all"
  ON coming_soon_subscribers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE coming_soon_subscribers IS
  'Waitlist publique collectée via la page Coming Soon (splash) avant lancement.';
```

Contrainte unique sur `email` → un même email ne s'inscrit qu'une fois. L'erreur `23505` (unique violation) est gérée côté front pour afficher un message neutre.

## i18n

### Nouveau namespace : `comingSoon`

Quatre fichiers dans `src/i18n/locales/{fr,de,en,it}/comingSoon.json` :

**FR (par défaut) :**
```json
{
  "title": "On vous prévient au lancement.",
  "paragraph": "MEGGA arrive bientôt. Laissez-nous votre email pour être les premiers informés du lancement de notre plateforme immobilière nouvelle génération.",
  "emailPlaceholder": "Votre adresse email",
  "subscribe": "S'inscrire",
  "successMessage": "✓ Merci ! On vous notifiera.",
  "errorAlreadySubscribed": "Cet email est déjà dans la liste.",
  "errorGeneric": "Une erreur est survenue, réessayez.",
  "errorInvalidEmail": "Adresse email invalide.",
  "teamAccess": "Accès équipe",
  "modalTitle": "Accès interne",
  "modalPlaceholder": "Mot de passe",
  "modalSubmit": "Entrer",
  "modalError": "Mot de passe incorrect",
  "copyright": "© 2026 MEGGA. Tous droits réservés."
}
```

**DE, EN, IT** : traductions équivalentes (l'EN reprend en partie le wording Figma original quand pertinent).

Le namespace `comingSoon` doit être déclaré dans la config i18next (chargement lazy si applicable, ou ajouté à la liste des namespaces statiques selon la convention du projet).

## Flow utilisateur

### Visiteur public (1ère visite)

1. Arrive sur `https://megga.ch/n'importe-quoi`
2. `PasswordGate` détecte `sessionStorage.megga-site-access !== 'true'`
3. Rendu : `<ComingSoonSplash />` — page Coming Soon Property X complète
4. Visiteur peut :
   - Lire le hero
   - Saisir son email → "✓ Merci ! On vous notifiera."
   - Cliquer "Accès équipe" en bas → modal mdp (mais il ne connaît pas le mdp → ferme)

### Équipe MEGGA

1. Arrive sur `https://megga.ch/`
2. Voit la page Coming Soon
3. Scrolle, clique "Accès équipe" en bas
4. Saisit `gg` dans le modal → success
5. `sessionStorage.setItem('megga-site-access', 'true')`
6. `PasswordGate` re-render avec `authorized = true` → site normal apparaît
7. Plus de splash tant que la session est ouverte

### Client KYC magic link

1. Arrive sur `https://megga.ch/kyc/abc123`
2. `PasswordGate.isPublicRoute()` retourne `true` (préfixe `/kyc/`)
3. Splash bypassé → KYC page directement (comportement actuel inchangé)

### Dev local

1. `.env.local` contient `VITE_PASSWORD_GATE_BYPASS=true`
2. `BYPASS_GATE = true` → splash bypassé en permanence
3. Comportement actuel inchangé

## Gestion d'erreurs

| Scénario | Handling |
|---|---|
| Email invalide (regex échoue) | Erreur inline "Adresse email invalide.", pas d'appel réseau |
| Insert Supabase échoue (réseau) | Message générique "Une erreur est survenue, réessayez." |
| Insert Supabase unique violation (`23505`) | "Cet email est déjà dans la liste." (UX positive, pas vu comme erreur) |
| Modal mdp : mot de passe vide | Bouton submit disabled |
| Modal mdp : mauvais mdp | "Mot de passe incorrect" inline rouge, input se vide pas |

## Sécurité

- **Mot de passe `gg` hardcodé côté client** : c'est une obscurité (suffisante pour un splash "site en construction"), pas de la sécurité. Pas de changement ici.
- **RLS sur `coming_soon_subscribers`** : `anon` peut INSERT mais jamais SELECT. Un attaquant peut spammer la table avec des emails arbitraires (rate-limiting non implémenté pour cette itération) mais ne peut pas extraire la liste.
- **PII** : l'email est une donnée personnelle (LPD/RGPD). L'usage est explicite (waitlist annoncée au lancement). Pas besoin de consent explicite pour une simple notification de lancement, mais on stockera `created_at` + `locale` pour traçabilité.
- **`user_agent`** stocké pour audit léger anti-spam — pas de PII supplémentaire.

## Tests manuels

- [ ] Visiter `/` en navigation privée → voir la page Coming Soon Property X
- [ ] Cliquer "Accès équipe" → modal s'ouvre
- [ ] Esc / clic backdrop → modal se ferme
- [ ] Mauvais mdp → message d'erreur, input reste rempli
- [ ] Bon mdp `gg` → site révélé, plus de splash
- [ ] Refresh → site reste accessible (sessionStorage)
- [ ] Fermer le tab + rouvrir → splash revient
- [ ] Email valide → "Merci !" affiché, row en DB
- [ ] Même email 2× → "Cet email est déjà dans la liste."
- [ ] Email invalide → erreur inline sans appel réseau
- [ ] `/kyc/xyz` en navigation privée → splash bypassé
- [ ] Langue FR / DE / EN / IT → textes traduits, locale en DB
- [ ] Responsive mobile : hero, footer, modal fonctionnent

## Fichiers touchés

**Nouveaux :**
- `src/components/layout/ComingSoonSplash.tsx`
- `src/components/layout/PasswordModal.tsx`
- `supabase/migrations/20260519_001_coming_soon_subscribers.sql`
- `src/i18n/locales/fr/comingSoon.json`
- `src/i18n/locales/de/comingSoon.json`
- `src/i18n/locales/en/comingSoon.json`
- `src/i18n/locales/it/comingSoon.json`

**Modifiés :**
- `src/components/layout/PasswordGate.tsx` — délègue le rendu non-authorized à `ComingSoonSplash`
- `src/components/propertyx/sections/PxComingSoonHero.tsx` — form branché Supabase + i18n + états
- `src/i18n/index.ts` (ou `i18n.ts`) — déclarer le namespace `comingSoon`

**Inchangés :**
- `src/pages/public/PropertyXComingSoonPage.tsx` (route `/coming-soon`)
- `src/components/propertyx/sections/PxFooterV3.tsx`
- Toute la logique App.tsx (routing, ProtectedRoute, etc.)
