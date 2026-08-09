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
 * Elle n'est PAS exportée, et c'est le point du module. Rendre la base nue à
 * l'appelant lui rend aussi le segment de chemin, or c'est précisément le segment
 * qui s'est perdu dans chacune des pannes de liens de ce dépôt : `/kyc` promu au
 * rang de domaine, `/accept-invite` et `/visite/…/modifier` accrochés à la
 * vitrine. Un nouveau parcours public ajoute donc un constructeur ici plutôt que
 * d'emprunter la base.
 */
function appBaseUrl(): string {
  // `??` ne retombe que sur null/undefined, PAS sur la chaîne vide — or vider un secret est
  // la façon la plus courante de le « désactiver » côté Supabase. Sans ce `||`, une valeur
  // posée-mais-vide donnait une base `''`, donc des URL RELATIVES dans un e-mail : le lien
  // ne mène nulle part, et la panne a exactement la signature de celle qu'on vient de fermer.
  const brut = (Deno.env.get('MEGGA_APP_URL') ?? '').trim()
  return (brut || 'https://app.megga.ch').replace(/\/+$/, '')
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

/**
 * URL d'acceptation d'une invitation d'équipe (route `/accept-invite/:token`).
 *
 * `send-team-invite` la bâtissait depuis l'en-tête `Origin` de la requête, avec
 * `https://megga.ch` en repli — deux défauts d'un coup.
 *
 * 1. SÉCURITÉ. `Origin` est choisi par l'appelant. Un dirigeant postant avec
 *    `Origin: https://evil.tld` faisait partir un e-mail MEGGA authentique, signé
 *    DKIM, dont le bouton « Accepter l'invitation » pointait chez lui — jeton
 *    d'invitation compris. Or ce jeton vaut attribution de rôle au moment du
 *    claim : hameçonnage sur notre propre domaine, doublé d'une exfiltration de
 *    capacité.
 * 2. CORRECTION. Le repli désignait la vitrine, qui ne sert pas cette route :
 *    tout envoi dépourvu d'en-tête `Origin` produisait un lien mort.
 *
 * Épinglé par `tests/unit/invite-link-origin-guard.spec.ts`.
 */
export function teamInviteAcceptUrl(token: string): string {
  return `${appBaseUrl()}/accept-invite/${token}`
}

/**
 * URL de gestion publique d'un appel d'accueil (route `/rendez-vous-accueil/:token`),
 * celle que porte le bouton « Replanifier / Annuler » des e-mails de l'appel.
 *
 * MÊME DÉFAUT QUE `teamInviteAcceptUrl`, RÉAPPARU. `onboarding-call-book` et
 * `onboarding-call-manage` bâtissaient chacun cette adresse depuis un `appOrigin(req)`
 * local, lui-même tiré de l'en-tête `Origin` — que l'appelant choisit. Un appelant
 * postant avec `Origin: https://evil.tld` faisait partir un e-mail MEGGA authentique,
 * signé DKIM, dont le bouton pointait chez lui, `manage_token` compris. Ce jeton vaut
 * annulation et replanification du rendez-vous sans aucune autre preuve : hameçonnage
 * sur notre propre domaine, doublé d'une exfiltration de capacité.
 *
 * `onboarding-call-reminder`, lui, figeait `https://app.megga.ch` en dur — juste
 * aujourd'hui, mais c'était une QUATRIÈME copie de la même adresse, qui aurait survécu
 * en silence à un changement de domaine. Les trois passent maintenant par ici.
 *
 * Épinglé par `tests/unit/invite-link-origin-guard.spec.ts`.
 */
export function onboardingCallManageUrl(token: string): string {
  return `${appBaseUrl()}/rendez-vous-accueil/${token}`
}

/**
 * URL de la page qui REND le rapport KYC (route `/kyc-report/:token`), celle que
 * Cloudflare Browser Rendering charge pour fabriquer le PDF.
 *
 * Seul lien du module qui ne s'adresse à personne : il est chargé par un
 * navigateur headless, son jeton vit 5 minutes, et l'adresse ressort dans les
 * erreurs de Cloudflare (d'où le caviardage côté `kyc-report-pdf`). Il passe
 * quand même par ici parce qu'une base divergente y échouerait en SILENCE — un
 * PDF blanc envoyé à l'agent, pas une erreur.
 */
export function kycReportRenderUrl(token: string): string {
  return `${appBaseUrl()}/kyc-report/${token}`
}
