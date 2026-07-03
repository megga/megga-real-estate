# Patch 11 — R6 : Sentry (S27) + MFA fail-closed (S28)

## A) Sentry — ne plus fuiter token KYC / PII (`src/lib/sentry.ts`, S27)

**Problème** : `sendDefaultPii: true`, Session Replay + `enableLogs` (forwarde les console logs), `tracesSampleRate: 1.0`,
**aucun `beforeSend`**. Le token secret de `/kyc/:token` (et `/portail/:token`) peut partir dans les URLs de traces,
et des fragments de données Supabase dans les logs — vers un tiers.

**AVANT** (l.16-42) :
```ts
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: [ ... ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: true,
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_DEV === 'true',
    ignoreErrors: [ ... ],
  })
```

**APRÈS** :
```ts
  // Scrub des URLs contenant un token secret (KYC / portail vendeur) avant tout envoi.
  const scrubUrl = (u?: string) =>
    typeof u === 'string'
      ? u.replace(/\/(kyc|portail)\/[^/?#]+/gi, '/$1/[redacted]').replace(/[?#].*$/, '')
      : u

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,                          // ⬅️ ne pas attacher IP/PII par défaut
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.2,                           // ⬅️ suffisant, réduit la captation d'URLs
    tracePropagationTargets: [ /* inchangé */ ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    enableLogs: false,                               // ⬅️ ne plus forwarder les console logs (fragments de données)
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_DEV === 'true',
    ignoreErrors: [ /* inchangé */ ],
    // Drop/masque les tokens secrets dans les événements et transactions.
    beforeSend(event) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => ({
          ...b,
          data: b.data ? { ...b.data, url: scrubUrl(b.data.url as string) } : b.data,
        }))
      }
      return event
    },
    beforeSendTransaction(event) {
      if (event.transaction) event.transaction = scrubUrl(event.transaction)
      if (event.request?.url) event.request.url = scrubUrl(event.request.url)
      return event
    },
  })
```

## B) MFA — fail-closed + enforcement `aal2` (`src/hooks/useMfaGate.ts`, S28)

**Problème** : sur exception de `getAuthenticatorAssuranceLevel()`, le `catch` (l.56-59) fait `setNeedsMfa(false)`
→ un échec réseau **désactive** le step-up. Et **0 policy RLS n'exige `aal2`** → le gate n'est que du rendu client.

### B1. Fail-closed côté client (sauf bypass dev explicite)

**AVANT** (l.56-62) :
```ts
    } catch {
      // Pas de vraie session (ex. bypass dev) ou MFA indispo → on NE bloque PAS.
      satisfiedFor = userId
      setNeedsMfa(false)
    } finally {
      setChecking(false)
    }
```
**APRÈS** :
```ts
    } catch {
      // Bypass dev explicite = ne pas bloquer ; sinon FAIL-CLOSED (un échec réseau
      // ne doit pas désactiver le step-up MFA). cf. S28.
      const devBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
      if (devBypass) {
        satisfiedFor = userId
        setNeedsMfa(false)
      } else {
        setNeedsMfa(true)
      }
    } finally {
      setChecking(false)
    }
```

### B2. Enforcement `aal2` en RLS (migration séparée) — le vrai backing
Le gate client ne protège pas les données : exiger `aal2` dans les policies des tables sensibles (KYC). Exemple :
```sql
-- Migration <ts>_kyc_require_aal2.sql (à adapter aux policies existantes)
alter policy <policy_select_kyc_cases> on public.kyc_cases
  using ( <condition_agence_existante> and (auth.jwt() ->> 'aal') = 'aal2' );
-- idem kyc_documents, kyc_magic_links…
```
> ⚠️ À déployer en cohérence avec l'enrôlement MFA (sinon un agent sans TOTP perd l'accès KYC). Séquencer :
> 1) rendre MFA obligatoire à l'onboarding agent, 2) puis activer l'exigence `aal2` en RLS.

## Test
- Ouvrir `/kyc/<token>` en prod-like → aucun événement Sentry ne contient le token (vérifier dans le projet Sentry).
- Couper le réseau pendant le check MFA (hors bypass dev) → l'app **exige** le step-up (avant : le contournait).
- (B2) Un JWT `aal1` ne peut plus lire `kyc_cases` une fois la policy en place.
