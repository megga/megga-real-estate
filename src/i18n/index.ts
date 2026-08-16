/**
 * Configuration i18next (FR/DE/EN/IT, 13 namespaces).
 *
 * FR est bundlé synchronement (fallback + langue par défaut) ; DE/EN/IT sont
 * lazy-loadés à la demande (~420KB hors du main bundle). Détection de langue
 * limitée à localStorage (`megga-language`) — jamais le navigateur (charte FR-first).
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// FR est chargé synchronement (fallback + langue par défaut)
import frCommon from './locales/fr/common.json'
import frDashboard from './locales/fr/dashboard.json'
import frSettings from './locales/fr/settings.json'
import frContacts from './locales/fr/contacts.json'
import frPipeline from './locales/fr/pipeline.json'
import frListings from './locales/fr/listings.json'
import frKyc from './locales/fr/kyc.json'
import frMessages from './locales/fr/messages.json'
import frCalendar from './locales/fr/calendar.json'
import frMatching from './locales/fr/matching.json'
import frAdmin from './locales/fr/admin.json'
import frAuth from './locales/fr/auth.json'
import frOnboarding from './locales/fr/onboarding.json'

const NAMESPACES = [
  'common', 'dashboard', 'settings', 'contacts', 'pipeline', 'listings',
  'kyc', 'messages', 'calendar', 'matching',
  'admin', 'auth', 'onboarding',
] as const

type Namespace = typeof NAMESPACES[number]
type SupportedLang = 'fr' | 'de' | 'en' | 'it'

// DE/EN/IT sont lazy-loadés à la demande (évite ~420KB dans le main bundle)
async function loadDe() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, admin, auth, onboarding] = await Promise.all([
    import('./locales/de/common.json'),
    import('./locales/de/dashboard.json'),
    import('./locales/de/settings.json'),
    import('./locales/de/contacts.json'),
    import('./locales/de/pipeline.json'),
    import('./locales/de/listings.json'),
    import('./locales/de/kyc.json'),
    import('./locales/de/messages.json'),
    import('./locales/de/calendar.json'),
    import('./locales/de/matching.json'),
    import('./locales/de/admin.json'),
    import('./locales/de/auth.json'),
    import('./locales/de/onboarding.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, admin: admin.default, auth: auth.default, onboarding: onboarding.default }
}

async function loadEn() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, admin, auth, onboarding] = await Promise.all([
    import('./locales/en/common.json'),
    import('./locales/en/dashboard.json'),
    import('./locales/en/settings.json'),
    import('./locales/en/contacts.json'),
    import('./locales/en/pipeline.json'),
    import('./locales/en/listings.json'),
    import('./locales/en/kyc.json'),
    import('./locales/en/messages.json'),
    import('./locales/en/calendar.json'),
    import('./locales/en/matching.json'),
    import('./locales/en/admin.json'),
    import('./locales/en/auth.json'),
    import('./locales/en/onboarding.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, admin: admin.default, auth: auth.default, onboarding: onboarding.default }
}

async function loadIt() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, admin, auth, onboarding] = await Promise.all([
    import('./locales/it/common.json'),
    import('./locales/it/dashboard.json'),
    import('./locales/it/settings.json'),
    import('./locales/it/contacts.json'),
    import('./locales/it/pipeline.json'),
    import('./locales/it/listings.json'),
    import('./locales/it/kyc.json'),
    import('./locales/it/messages.json'),
    import('./locales/it/calendar.json'),
    import('./locales/it/matching.json'),
    import('./locales/it/admin.json'),
    import('./locales/it/auth.json'),
    import('./locales/it/onboarding.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, admin: admin.default, auth: auth.default, onboarding: onboarding.default }
}

/** Dispatch vers le loader lazy voulu ; FR renvoie directement les bundles déjà importés. */
async function loadLanguage(lng: SupportedLang): Promise<Record<Namespace, unknown>> {
  if (lng === 'de') return loadDe()
  if (lng === 'en') return loadEn()
  if (lng === 'it') return loadIt()
  return {
    common: frCommon, dashboard: frDashboard, settings: frSettings, contacts: frContacts,
    pipeline: frPipeline, listings: frListings, kyc: frKyc, messages: frMessages,
    calendar: frCalendar, matching: frMatching,
    admin: frAdmin, auth: frAuth, onboarding: frOnboarding,
  }
}

/** Clé du détecteur, partagée avec la vitrine (même nom, autre origine). */
const LANG_KEY = 'megga-language'

/**
 * Langue transmise dans l'URL par la vitrine (`?lang=de`), validée.
 *
 * ⚠ Valeur venue de l'URL : jamais utilisée telle quelle, seulement si elle
 * figure dans les langues du produit. La forme régionale est acceptée
 * (`de-CH` → `de`).
 */
export function languageFromUrl(search?: string): string | null {
  if (typeof window === 'undefined' && search === undefined) return null
  const asked = new URLSearchParams(search ?? window.location.search).get('lang')
  if (!asked) return null
  const lng = asked.slice(0, 2).toLowerCase()
  return ['fr', 'de', 'en', 'it'].includes(lng) ? lng : null
}

/**
 * Reprise de la langue de la vitrine — AVANT `init()`, à dessein.
 *
 * megga.ch et app.megga.ch sont deux origines : leurs stockages locaux sont
 * cloisonnés, un agent qui lisait la vitrine en allemand atterrissait donc dans
 * un CRM en français — ou en anglais si un vieux réglage traînait. La langue
 * voyage par l'URL de reprise, comme la session (`goToCrm`,
 * sites/megga-vitrine/js/megga-auth.js).
 *
 * On l'écrit dans la clé du détecteur plutôt que d'appeler `changeLanguage()`
 * après coup : semée avant, la langue de l'URL EST la langue détectée, et tout
 * ce qui suit (chargement du bundle au démarrage, mise en cache) en découle
 * d'une seule pièce. Basculer après l'init laisserait deux bascules
 * asynchrones se croiser — celle de la langue détectée, déclenchée par
 * `languageChanged` à l'init, et la nôtre — sans ordre garanti entre elles.
 *
 * Elle prime sur la valeur stockée : c'est celle que l'agent lisait il y a
 * trois secondes. Le réglage de Réglages reste maître ensuite — jusqu'à la
 * prochaine arrivée depuis la vitrine, qui re-synchronise.
 */
function seedLanguageFromUrl(): void {
  const lng = languageFromUrl()
  if (!lng) return
  try {
    window.localStorage.setItem(LANG_KEY, lng)
  } catch {
    // Stockage refusé (navigation privée stricte) : le détecteur retombera sur
    // le français, ce qui reste un CRM utilisable.
  }
}

/**
 * L'agent avait-il DÉJÀ une langue au moment où ce module s'est chargé ?
 *
 * ⚠ Se lit ici et nulle part ailleurs, parce qu'`init()` détruit la réponse une
 * ligne plus bas. i18next appelle `changeLanguage(options.lng)` pendant son
 * initialisation, ce qui déclenche `cacheUserLanguage()` du détecteur, qui écrit
 * `localStorage['megga-language']` — la valeur détectée, donc `'fr'` par repli.
 * Après l'init, la clé est TOUJOURS remplie : demander « a-t-il une préférence »
 * répondrait oui à tout le monde, y compris à quelqu'un qui n'a jamais rien
 * choisi. C'est la même raison qui fait vivre `seedLanguageFromUrl` avant
 * `init()`, et le piège est le même.
 *
 * Ce que la valeur veut dire : `false` = tout premier contact d'un navigateur
 * avec le CRM, sans passage par la vitrine (qui, elle, joint toujours `?lang=`).
 * C'est la seule situation où deviner la langue est légitime — partout ailleurs
 * il existe un choix, explicite ou hérité, et deviner reviendrait à l'écraser.
 */
export const hasExplicitLanguage: boolean = (() => {
  if (languageFromUrl() !== null) return true
  try {
    return window.localStorage.getItem(LANG_KEY) !== null
  } catch {
    // Stockage refusé : on ne peut ni lire une préférence ni en poser une.
    // Traité comme « préférence existante » pour ne rien tenter d'automatique
    // à chaque chargement de page.
    return true
  }
})()

seedLanguageFromUrl()
persisterLangueDArrivee()

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        common: frCommon, dashboard: frDashboard, settings: frSettings, contacts: frContacts,
        pipeline: frPipeline, listings: frListings, kyc: frKyc, messages: frMessages,
        calendar: frCalendar, matching: frMatching,
        admin: frAdmin, auth: frAuth, onboarding: frOnboarding,
      },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'de', 'en', 'it'],
    defaultNS: 'common',
    ns: NAMESPACES as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      // FR par défaut (charte produit) : on n'honore QUE le choix explicite de
      // l'agent (toggle Réglages → localStorage). Pas de 'navigator' : un
      // navigateur en-US/de-DE ne doit pas basculer l'UI tout seul (et DE/IT
      // n'ont aujourd'hui qu'un fallback EN). Sans préférence → fallbackLng 'fr'.
      order: ['localStorage'],
      lookupLocalStorage: 'megga-language',
      caches: ['localStorage'],
    },
    // Évite que i18next bloque le rendu en attendant le chargement async.
    //
    // ⚠ INVARIANT à ne pas casser : AUCUN backend i18next n'est branché (pas de
    // `i18next-http-backend`), et c'est ce qui rend `hasLoadedNamespace()` vrai
    // même quand le bundle d'une langue n'est pas encore là. Sans cette
    // propriété, `useTranslation` re-suspendrait à chaque bascule, le
    // `<Suspense>` d'App.tsx démonterait l'arbre — et le wizard KYB
    // (`IdentityShell`), dont les brouillons ne vivent qu'en `useState`,
    // perdrait la saisie en cours. Monter un backend un jour exigerait donc de
    // sortir ce wizard du périmètre suspendable, ou de persister ses brouillons.
    partialBundledLanguages: true,
  })

/**
 * Dernière langue explicitement demandée — garde de fraîcheur des chargements.
 *
 * Deux bascules peuvent être en vol en même temps : le chargement d'un bundle
 * passe par un `import()` dynamique de plusieurs centaines de millisecondes, et
 * rien n'empêche l'agent de re-choisir pendant ce temps. Sans ce témoin, la
 * requête la plus LENTE gagnait — et se persistait dans `localStorage`. Le cas
 * n'était pas théorique : la détection géographique (`src/lib/geoLanguage.ts`)
 * démarre une bascule au chargement de la page, précisément quand l'agent peut
 * en demander une autre depuis le sélecteur du wizard d'onboarding.
 */
let langueDemandee: string = i18n.language

/**
 * Enregistre à la volée les bundles d'une langue non-FR puis bascule dessus ;
 * idempotent (no-op si déjà chargée).
 *
 * Exporté pour la bascule géographique (`src/lib/geoLanguage.ts`) : appeler
 * `changeLanguage()` directement basculerait AVANT que le bundle n'existe, et
 * l'agent verrait l'interface en français le temps du téléchargement, puis un
 * second rendu. Ici la ressource est chargée d'abord, la bascule vient après —
 * un seul `languageChanged`, un seul rendu.
 */
export async function ensureLanguageLoaded(lng: string) {
  if (lng === 'fr' || !['de', 'en', 'it'].includes(lng)) return
  if (i18n.hasResourceBundle(lng, 'common')) return
  // Un appel direct (géographie) est une demande au même titre qu'un clic ;
  // l'écouteur ci-dessous couvre le cas où la demande vient de changeLanguage().
  langueDemandee = lng
  const bundle = await loadLanguage(lng as SupportedLang)
  for (const ns of NAMESPACES) {
    i18n.addResourceBundle(lng, ns, bundle[ns], true, true)
  }
  // Une autre langue a été demandée pendant le téléchargement : les ressources
  // restent enregistrées (elles resserviront), mais basculer maintenant
  // reviendrait à annuler le choix le plus récent de l'agent.
  if (langueDemandee !== lng) return
  // Notifie React de re-render avec les nouvelles ressources
  await i18n.changeLanguage(lng)
}

/**
 * LA bascule de langue déclenchée par un humain — sélecteur du wizard, Réglages,
 * Réglages mobile, écran « Plus » mobile. Tous passent par ici ; aucun n'appelle
 * plus `i18n.changeLanguage()` en direct.
 *
 * POURQUOI ELLE EXISTE. Les quatre sélecteurs appelaient `changeLanguage(lng)`
 * tel quel, c'est-à-dire exactement ce contre quoi `ensureLanguageLoaded`
 * ci-dessus met en garde depuis toujours. Déroulé mesuré le 3 août 2026 sur une
 * bascule vers l'italien :
 *
 *   1. `changeLanguage('it')` bascule AVANT que le bundle existe → premier
 *      `languageChanged`, premier rendu — en FRANÇAIS, par `fallbackLng` ;
 *   2. l'écouteur plus bas rattrape et lance le téléchargement (13 imports
 *      dynamiques, ~140 Ko) ;
 *   3. arrivé, il rebascule → SECOND `languageChanged`, second rendu, en italien.
 *
 * Deux `languageChanged` pour un seul choix, séparés par toute la durée du
 * téléchargement — d'où le passage par le français au milieu, et le voile plein
 * écran qui s'ouvrait deux fois (LanguageChangeOverlay, retiré au même moment :
 * il masquait ce défaut au lieu de le corriger, ~1 s de veille opaque pour 60 ms
 * de travail réel).
 *
 * Ici : on charge, PUIS on bascule. Un seul événement, un seul rendu, jamais de
 * détour par le français. La promesse ne se résout qu'une fois la bascule faite
 * — c'est elle que l'appelant attend pour savoir quand relâcher son squelette.
 */
export async function switchLanguage(lng: string): Promise<void> {
  if (lng === i18n.language) return
  // Posé AVANT le premier await : deux clics rapprochés doivent se départager
  // sur le dernier demandé, pas sur le téléchargement le plus rapide.
  langueDemandee = lng
  await ensureLanguageLoaded(lng)
  // `ensureLanguageLoaded` a déjà basculé pour une langue non-FR fraîchement
  // chargée. Restent : le français (aucun bundle à charger) et une langue déjà
  // en cache (sortie anticipée) — d'où cette bascule, sans quoi rien ne se
  // passerait. Le garde de fraîcheur vaut ici aussi : pendant l'await, l'agent
  // a pu choisir autre chose.
  if (langueDemandee !== lng) return
  if (i18n.language !== lng) await i18n.changeLanguage(lng)
  void persisterLangueDeCorrespondance(lng)
}

/**
 * Écrit la langue choisie sur `profiles.language` — la langue d'interface EST la
 * langue de correspondance (règle du 15.08.2026).
 *
 * ⚠ ICI et pas sur l'événement `languageChanged` : celui-ci part aussi pendant
 * `init()`, à chaque démarrage, avec la langue DÉTECTÉE. L'enregistrer reviendrait à
 * inscrire un choix que personne n'a fait — et à écraser une préférence réelle par un
 * repli au premier chargement depuis un autre poste. `switchLanguage` est la porte du
 * choix DÉLIBÉRÉ : les sélecteurs passent tous par elle.
 *
 * Sans session, il n'y a rien à écrire : un visiteur anonyme n'a pas de profil. Sa
 * langue est recueillie à l'inscription, où la vitrine la joint aux métadonnées
 * (`sites/megga-vitrine/js/megga-auth.js`).
 *
 * L'import est dynamique pour ne pas tirer le client Supabase dans le graphe de l'i18n,
 * qui se charge au tout premier octet de l'application. L'écriture n'est jamais
 * attendue : une bascule de langue ne doit pas dépendre du réseau, et une préférence
 * perdue se repose au clic suivant.
 */
/**
 * La langue ARRIVÉE DE LA VITRINE (`?lang=`) rejoint elle aussi `profiles.language`.
 *
 * ⛔ LE TROU QUE CECI FERME, ET POURQUOI CE N'EST PAS CELUI QU'ON CROYAIT. Le point de
 * reprise décrivait le trou côté VITRINE : un agent qui bascule la langue sur megga.ch ne
 * l'enregistre pas, faute de session sur cette origine. La correction annoncée était d'y
 * brancher un client Supabase. Mesuré le 16.08.2026, elle n'aurait presque jamais écrit :
 * seul quelqu'un connecté PAR MOT DE PASSE sur megga.ch même y a un jeton — ni les arrivées
 * de Google, ni les inscriptions (la confirmation par e-mail ne rend aucune session), ni
 * OAuth (les jetons naissent sur app.megga.ch), ni surtout l'agent connecté sur l'app qui
 * revient sur la vitrine, qui EST le cas décrit. Et l'échec aurait été SILENCIEUX : sans
 * session l'appel part en `anon`, dont l'UPDATE ne matche aucune ligne et rend `200 []`.
 *
 * Le vrai trou est ici : la langue TRAVERSE déjà par `?lang=`, mais `seedLanguageFromUrl`
 * l'écrit dans la clé du détecteur et s'arrête là. `persisterLangueDeCorrespondance` n'est
 * appelée que par `switchLanguage`, donc une langue venue de la vitrine n'atteignait jamais
 * la base. Deux lignes ici valent 200 Ko de SDK sur 32 pages de la vitrine.
 *
 * ⚠ POURQUOI PAS D'`await` NI D'`onAuthStateChange`. L'écriture n'est jamais attendue : le
 * premier rendu ne doit pas dépendre du réseau. Et écouter `onAuthStateChange` pour y
 * awaiter Supabase est l'interblocage déjà payé sur l'onboarding.
 *
 * ✅ ET L'ARRIVÉE PAR LE CALLBACK D'AUTHENTIFICATION EST COUVERTE — vérifié dans le SDK,
 * pas supposé : `getSession()` fait `await this.initializePromise` (auth-js,
 * `GoTrueClient.js:2217-2218`), et cette initialisation comprend la détection de la session
 * dans l'URL (`_initialize`, `:283-297`). La session née des jetons du fragment est donc
 * déjà là quand `persisterLangueDeCorrespondance` interroge. C'est précisément le chemin
 * `goToCrm` de la vitrine, celui qui compte.
 */
function persisterLangueDArrivee(): void {
  const lng = languageFromUrl()
  if (lng) void persisterLangueDeCorrespondance(lng)
}

async function persisterLangueDeCorrespondance(lng: string): Promise<void> {
  if (!['fr', 'de', 'en', 'it'].includes(lng)) return
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) return
    await supabase.from('profiles').update({ language: lng }).eq('id', userId)
  } catch {
    // Muet par conception : l'interface a déjà basculé, et c'est ce que l'agent voit.
  }
}

/**
 * Aligne `<html lang>` sur la langue affichée.
 *
 * `index.html` l'écrit « fr » en dur et personne ne le rtouchait ensuite : un
 * CRM affiché en allemand se DÉCLARAIT donc français, dans les quatre langues
 * sauf une. Trois conséquences, dont une visible :
 *
 *  1. la CÉSURE. `hyphens: auto` choisit son dictionnaire d'après `lang` :
 *     annoncer « fr » sur un texte allemand donne des coupures fausses, ou
 *     aucune. C'est ce qui faisait déborder « Kollektivzeichnungsberechtigung »
 *     (31 caractères, 241 px pour une boîte de 208) hors de sa tuile ;
 *  2. les lecteurs d'écran prononcent tout avec la phonétique française ;
 *  3. WCAG 3.1.1 (Langue de la page) n'est pas satisfait.
 *
 * Deux lettres seulement (`de`, pas `de-CH`) : c'est la granularité des
 * ressources du produit, et une forme régionale inventée serait une déclaration
 * fausse de plus.
 */
function syncDocumentLang(lng: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lng.slice(0, 2)
}

// Au démarrage : charge la langue détectée si ≠ fr, et déclare-la.
syncDocumentLang(i18n.language)
void ensureLanguageLoaded(i18n.language)

// À chaque changement de langue : charge à la volée
i18n.on('languageChanged', (lng) => {
  // Hors du `if` : une bascule vers le français ne charge rien, mais elle reste
  // une demande, et elle doit périmer un chargement encore en vol.
  langueDemandee = lng
  syncDocumentLang(lng)
  if (!i18n.hasResourceBundle(lng, 'common')) {
    void ensureLanguageLoaded(lng)
  }
})

export default i18n
