/**
 * Langue devinée d'après le pays du visiteur, au tout premier contact avec le CRM.
 *
 * POURQUOI CE FICHIER. Un agent zurichois qui atterrit directement sur
 * app.megga.ch reçoit un CRM en français, et l'écran qui l'accueille — le
 * wizard « Identité légale » — n'a pas de langue à lui. La détection comble ce
 * seul trou : celui de l'agent qui n'est passé ni par la vitrine (qui joint
 * toujours `?lang=`) ni par les Réglages.
 *
 * CE QU'ELLE NE FAIT PAS, et c'est le cœur du contrat :
 *
 * 1. Elle ne s'exécute JAMAIS si une langue existe déjà (`hasExplicitLanguage`).
 *    Un choix, même hérité de la vitrine, prime toujours sur une déduction.
 * 2. Elle ne s'applique pas en confiance basse. Le bord répond
 *    `confidence: 'low'` quand il ne sait pas — visiteur suisse dont le canton
 *    est inconnu (mobile derrière un CGNAT, relais privé iCloud, VPN). On reste
 *    alors sur le français par défaut, sans rien prétendre.
 * 3. Elle ne bloque pas le rendu. Appelée depuis `main.tsx` en tâche de fond,
 *    elle échoue en silence : réseau coupé, megga.ch indisponible, CORS refusé,
 *    délai dépassé — dans tous les cas le CRM démarre normalement, en français.
 *
 * POURQUOI L'ENDPOINT VIT SUR LA VITRINE. `request.cf` n'existe que dans un
 * worker Cloudflare, et app.megga.ch est un projet Pages sans worker : lui en
 * poser un ferait passer le projet en mode Advanced, où `_redirects` — donc le
 * repli SPA de toutes les routes du CRM — cesse d'être évalué. La requête part
 * donc vers megga.ch, dont le worker traite `/api/geo` avant son gate
 * Basic Auth. Voir `sites/megga-vitrine/_worker.js`.
 */
// `@/i18n/index` et non `@/i18n`, à dessein : ts-prune ne suit pas l'import d'un
// index de DOSSIER, et déclarait donc `hasExplicitLanguage` mort alors qu'il est
// consommé ici — `npm run lint:deadcode` échouait. Nommer le fichier garde le
// garde-fou opérant sur ce symbole, là où une entrée d'allowlist l'aurait
// désarmé pour toujours. Même angle mort que `megga-x/index.ts`, déjà exempté
// dans scripts/check-dead-exports.mjs.
import i18n, { ensureLanguageLoaded, hasExplicitLanguage } from '@/i18n/index'

/** Réponse de `GET /api/geo` (sites/megga-vitrine/_worker.js). */
export interface GeoLanguage {
  /** Code pays ISO 3166-1 alpha-2, ou `null` hors réseau Cloudflare. */
  country: string | null
  /** Subdivision ISO 3166-2 sans préfixe pays — le canton en Suisse. */
  region: string | null
  language: string
  confidence: 'high' | 'medium' | 'low'
  source: string
}

/**
 * Même hôte que `VITRINE_URL` (src/App.tsx), en dur pour la même raison : c'est
 * une constante de déploiement, pas une configuration. Une variable `VITE_*`
 * absente du build produirait ici une URL vide, et la détection échouerait
 * silencieusement au lieu d'échouer à la construction.
 */
const ENDPOINT = 'https://megga.ch/api/geo'

/**
 * Au-delà, on renonce. Le budget est celui d'un confort, pas d'une dépendance :
 * personne ne doit attendre pour utiliser le CRM parce qu'un autre hôte est lent.
 */
const DELAI_MAX_MS = 2000

const LANGUES_PRODUIT = ['fr', 'de', 'en', 'it']

/**
 * Interroge le bord. Rend `null` à la moindre anomalie — c'est un signal de
 * confort, aucune erreur ne mérite de remonter.
 *
 * ⚠ Aucun en-tête n'est posé sur la requête, à dessein : un `GET` sans en-tête
 * personnalisé est une requête « simple » au sens CORS, que le navigateur envoie
 * sans préflight. Ajouter ne serait-ce qu'un `Accept` non standard déclencherait
 * un `OPTIONS` supplémentaire avant chaque détection.
 */
export async function fetchGeoLanguage(): Promise<GeoLanguage | null> {
  if (typeof window === 'undefined') return null
  const abandon = new AbortController()
  const minuterie = window.setTimeout(() => abandon.abort(), DELAI_MAX_MS)
  try {
    const reponse = await fetch(ENDPOINT, { signal: abandon.signal, credentials: 'omit' })
    if (!reponse.ok) return null
    const brut = (await reponse.json()) as Partial<GeoLanguage>
    if (typeof brut?.language !== 'string' || !LANGUES_PRODUIT.includes(brut.language)) return null
    return {
      country: typeof brut.country === 'string' ? brut.country : null,
      region: typeof brut.region === 'string' ? brut.region : null,
      language: brut.language,
      confidence: brut.confidence === 'high' || brut.confidence === 'medium' ? brut.confidence : 'low',
      source: typeof brut.source === 'string' ? brut.source : 'inconnu',
    }
  } catch {
    return null
  } finally {
    window.clearTimeout(minuterie)
  }
}

/**
 * Applique la langue déduite, si et seulement si toutes les conditions sont réunies.
 *
 * Appelée une fois depuis `main.tsx`, au niveau module et non dans un `useEffect` :
 * StrictMode monte les composants deux fois en développement, ce qui ferait
 * partir deux requêtes et deux bascules concurrentes.
 *
 * Rend la langue appliquée, ou `null` si rien n'a été fait — ce que les tests
 * lisent, et ce qui rend l'abstention observable.
 */
export async function applyDetectedLanguage(): Promise<string | null> {
  if (hasExplicitLanguage) return null

  const detection = await fetchGeoLanguage()
  if (!detection) return null
  if (detection.confidence === 'low') return null
  if (detection.language === i18n.language) return null

  // Charge le bundle PUIS bascule : une seule transition, pas de passage par le
  // français pendant le téléchargement de la langue cible.
  await ensureLanguageLoaded(detection.language)

  // La bascule a fait écrire `megga-language` au détecteur d'i18next. C'est
  // voulu : la déduction ne vaut que pour ce premier contact, les visites
  // suivantes repartent de cette valeur, et le sélecteur de langue l'écrase
  // définitivement dès que l'agent en décide autrement.
  return detection.language
}
