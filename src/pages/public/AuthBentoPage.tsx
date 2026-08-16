/**
 * MEGGA Auth — l'UNIQUE page encore routée de la coquille `auth-bento`.
 *
 * ⛔ SEPT COQUILLES SUR HUIT ONT ÉTÉ RETIRÉES le 15 août 2026, et l'en-tête qui
 * les annonçait était devenu FAUX. Il listait sept routes — `/auth/login`,
 * `/auth/signup`, `/auth/forgot-password`… — qu'`App.tsx` ne déclare plus :
 * la surface d'authentification est passée à la vitrine, et seul
 * `/auth/forgot-password/reset` est resté ici. Une documentation de routes qui
 * survit à ses routes coûte plus qu'elle ne rend : elle fait chercher un
 * câblage qui n'existe pas.
 *
 * ⚠ AUCUNE GARDE NE POUVAIT LE VOIR, ET C'EST LE FAIT INTÉRESSANT. Les sept
 * exports n'étaient importés NULLE PART — ni route, ni test, ni e2e — et
 * `npm run lint:deadcode` annonçait « baseline propre ». `App.tsx` atteint ce
 * module par un `import()` DYNAMIQUE (`.then((m) => m.AuthSetNewPasswordPage)`),
 * et `ts-prune` compte alors TOUS les exports du module comme vivants : il ne
 * peut pas résoudre quel membre est lu. Vérifié par expérience — un export
 * nommé `ExportManifestementMort` ajouté ici passe la porte au vert.
 *
 * Toute l'architecture de routes en `lazy()` porte cette cécité, donc la
 * « baseline propre » du garde-fou vaut pour les modules importés
 * STATIQUEMENT, pas pour les pages.
 */
import { AuthBentoApp } from '@/components/auth-bento/AuthBentoApp'

/** `/auth/forgot-password/reset` — la seule route de cette coquille (App.tsx). */
export function AuthSetNewPasswordPage() {
  return <AuthBentoApp route={{ portail: 'agent', etat: 'setNewPassword' }} />
}
