// supabase/functions/_shared/app-url.ts
//
// Construction des URL publiques que les edge functions envoient à des tiers
// (client KYC, destinataire d'un e-mail). Une seule source pour un lien donné.
//
// POURQUOI CE MODULE. Le lien magique KYC était bâti deux fois — une fois pour la
// réponse rendue à l'agent (`magic-link-create`), une fois pour le bouton de
// l'e-mail (`magic-link-send-email`) — à partir d'une constante recopiée dans les
// deux fichiers. C'est pourtant le MÊME lien : deux copies n'apportent qu'une
// occasion de divergence, et la divergence serait invisible (personne ne compare
// l'URL affichée à l'agent avec celle du bouton reçu par le client).
//
// POURQUOI `MEGGA_KYC_PUBLIC_DOMAIN` A DISPARU. Ce réglage promettait un DOMAINE
// (`kyc.megga.ch`) alors que le parcours client est une route de l'app CRM,
// `/kyc/:token` (src/App.tsx) : le segment de chemin `/kyc` fait partie de
// l'adresse. Le poser à `app.megga.ch` aurait donc produit un lien tout aussi mort
// que son repli — lequel désignait un hôte sans aucun enregistrement DNS. Il
// n'était par ailleurs déclaré nulle part (ni config.toml, ni workflow, ni
// inventaire des secrets) : un réglage jamais posé dont le défaut ne résout même
// pas n'est pas un réglage, c'est une panne en attente.
//
// Ce qui le remplace porte une URL de BASE complète, schéma compris, et son repli
// est la valeur qui marche aujourd'hui. Le jour où un domaine dédié servira le
// même SPA, poser `MEGGA_APP_URL` sur CE domaine suffit : le segment `/kyc` reste
// attaché à la route, pas au réglage.
//
// ⚠ CE RÉGLAGE DOIT DÉSIGNER L'APP, PAS LA VITRINE. Mesuré le 03.08.2026 :
// `app.megga.ch/kyc/<jeton>` rend 200, `megga.ch/kyc/<jeton>` rend 401 — la vitrine
// est protégée par mot de passe et ne connaît aucune de ces routes. Un plan archivé
// du dépôt (`docs/superpowers/plans/2026-06-02-whatsapp-kyc-report-pdf.md`) donne
// pourtant `MEGGA_APP_URL=https://megga.ch` en exemple : le suivre remplacerait une
// panne visible (hôte sans DNS) par une panne qui ressemble à un site vivant.
// Aucune porte ne peut lire la valeur réelle d'un secret — c'est la seule chose ici
// qu'un test ne couvre pas, et elle se vérifie à la main au déploiement.

/**
 * Base de l'app CRM, sans slash final.
 *
 * L'environnement est lu à CHAQUE appel, pas dans une `const` de module : une
 * constante fige la valeur au démarrage de l'isolat et rend le réglage intestable.
 *
 * Même variable et même repli que `kyc-report-pdf` et `send-team-invite` — ces
 * deux-là gardent leur propre lecture, épinglée par
 * `tests/unit/invite-link-origin-guard.spec.ts`.
 */
function appBaseUrl(): string {
  return (Deno.env.get('MEGGA_APP_URL') ?? 'https://app.megga.ch').replace(/\/+$/, '')
}

/**
 * URL du parcours client KYC pour un jeton signé.
 *
 * Le segment `/kyc/` correspond à la route `/kyc/:token` déclarée dans
 * `src/App.tsx` ; c'est ce que verrouille `tests/unit/kyc-magic-link-url.spec.ts`.
 */
export function kycMagicLinkUrl(token: string): string {
  return `${appBaseUrl()}/kyc/${token}`
}

/**
 * URL de gestion publique d'une visite (report / annulation) pour un capability token.
 *
 * Même panne que le lien KYC, et elle vivait dans `send-visit-email` : l'adresse était
 * bâtie sur `megga.ch`, la VITRINE, alors que `/visite/:id/modifier` est une route de
 * l'app. Mesuré — `megga.ch` rend 401 sur ce chemin, `app.megga.ch` rend 200. Tous les
 * liens de gestion déjà envoyés menaient donc à une page d'authentification : l'acheteur
 * ne pouvait ni reporter ni annuler, et le durcissement du jeton de visite (#1114)
 * protégeait un parcours que personne ne pouvait atteindre.
 *
 * Le jeton reste en QUERY : c'est la forme que la route publique lit
 * (`VisitManagePage`, `searchParams.get('token')`), la changer casserait les liens
 * déjà en circulation.
 */
export function visitManageUrl(visitId: string, manageToken: string): string {
  return `${appBaseUrl()}/visite/${visitId}/modifier?token=${manageToken}`
}
