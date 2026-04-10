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
import frAutomation from './locales/fr/automation.json'
import frDocuments from './locales/fr/documents.json'
import frAdmin from './locales/fr/admin.json'
import frDirectory from './locales/fr/directory.json'

const NAMESPACES = [
  'common', 'dashboard', 'settings', 'contacts', 'pipeline', 'listings',
  'kyc', 'messages', 'calendar', 'matching', 'automation', 'documents',
  'admin', 'directory',
] as const

type Namespace = typeof NAMESPACES[number]
type SupportedLang = 'fr' | 'de' | 'en' | 'it'

// DE/EN/IT sont lazy-loadés à la demande (évite ~420KB dans le main bundle)
async function loadDe() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, automation, documents, admin, directory] = await Promise.all([
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
    import('./locales/de/automation.json'),
    import('./locales/de/documents.json'),
    import('./locales/de/admin.json'),
    import('./locales/de/directory.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, automation: automation.default, documents: documents.default, admin: admin.default, directory: directory.default }
}

async function loadEn() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, automation, documents, admin, directory] = await Promise.all([
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
    import('./locales/en/automation.json'),
    import('./locales/en/documents.json'),
    import('./locales/en/admin.json'),
    import('./locales/en/directory.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, automation: automation.default, documents: documents.default, admin: admin.default, directory: directory.default }
}

async function loadIt() {
  const [common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, automation, documents, admin, directory] = await Promise.all([
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
    import('./locales/it/automation.json'),
    import('./locales/it/documents.json'),
    import('./locales/it/admin.json'),
    import('./locales/it/directory.json'),
  ])
  return { common: common.default, dashboard: dashboard.default, settings: settings.default, contacts: contacts.default, pipeline: pipeline.default, listings: listings.default, kyc: kyc.default, messages: messages.default, calendar: calendar.default, matching: matching.default, automation: automation.default, documents: documents.default, admin: admin.default, directory: directory.default }
}

async function loadLanguage(lng: SupportedLang): Promise<Record<Namespace, unknown>> {
  if (lng === 'de') return loadDe()
  if (lng === 'en') return loadEn()
  if (lng === 'it') return loadIt()
  return {
    common: frCommon, dashboard: frDashboard, settings: frSettings, contacts: frContacts,
    pipeline: frPipeline, listings: frListings, kyc: frKyc, messages: frMessages,
    calendar: frCalendar, matching: frMatching, automation: frAutomation,
    documents: frDocuments, admin: frAdmin, directory: frDirectory,
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        common: frCommon, dashboard: frDashboard, settings: frSettings, contacts: frContacts,
        pipeline: frPipeline, listings: frListings, kyc: frKyc, messages: frMessages,
        calendar: frCalendar, matching: frMatching, automation: frAutomation,
        documents: frDocuments, admin: frAdmin, directory: frDirectory,
      },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'de', 'en', 'it'],
    defaultNS: 'common',
    ns: NAMESPACES as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'megga-language',
      caches: ['localStorage'],
    },
    // Évite que i18next bloque le rendu en attendant le chargement async
    partialBundledLanguages: true,
  })

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
