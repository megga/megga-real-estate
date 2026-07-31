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

seedLanguageFromUrl()

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
    // Évite que i18next bloque le rendu en attendant le chargement async
    partialBundledLanguages: true,
  })

/** Enregistre à la volée les bundles d'une langue non-FR puis bascule dessus ; idempotent (no-op si déjà chargée). */
async function ensureLanguageLoaded(lng: string) {
  if (lng === 'fr' || !['de', 'en', 'it'].includes(lng)) return
  if (i18n.hasResourceBundle(lng, 'common')) return
  const bundle = await loadLanguage(lng as SupportedLang)
  for (const ns of NAMESPACES) {
    i18n.addResourceBundle(lng, ns, bundle[ns], true, true)
  }
  // Notifie React de re-render avec les nouvelles ressources
  await i18n.changeLanguage(lng)
}

// Au démarrage : charge la langue détectée si ≠ fr
void ensureLanguageLoaded(i18n.language)

// À chaque changement de langue : charge à la volée
i18n.on('languageChanged', (lng) => {
  if (!i18n.hasResourceBundle(lng, 'common')) {
    void ensureLanguageLoaded(lng)
  }
})

export default i18n
