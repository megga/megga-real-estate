import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// FR
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

// DE
import deCommon from './locales/de/common.json'
import deDashboard from './locales/de/dashboard.json'
import deSettings from './locales/de/settings.json'
import deContacts from './locales/de/contacts.json'
import dePipeline from './locales/de/pipeline.json'
import deListings from './locales/de/listings.json'
import deKyc from './locales/de/kyc.json'
import deMessages from './locales/de/messages.json'
import deCalendar from './locales/de/calendar.json'
import deMatching from './locales/de/matching.json'
import deAutomation from './locales/de/automation.json'
import deDocuments from './locales/de/documents.json'

// EN
import enCommon from './locales/en/common.json'
import enDashboard from './locales/en/dashboard.json'
import enSettings from './locales/en/settings.json'
import enContacts from './locales/en/contacts.json'
import enPipeline from './locales/en/pipeline.json'
import enListings from './locales/en/listings.json'
import enKyc from './locales/en/kyc.json'
import enMessages from './locales/en/messages.json'
import enCalendar from './locales/en/calendar.json'
import enMatching from './locales/en/matching.json'
import enAutomation from './locales/en/automation.json'
import enDocuments from './locales/en/documents.json'

// IT
import itCommon from './locales/it/common.json'
import itDashboard from './locales/it/dashboard.json'
import itSettings from './locales/it/settings.json'
import itContacts from './locales/it/contacts.json'
import itPipeline from './locales/it/pipeline.json'
import itListings from './locales/it/listings.json'
import itKyc from './locales/it/kyc.json'
import itMessages from './locales/it/messages.json'
import itCalendar from './locales/it/calendar.json'
import itMatching from './locales/it/matching.json'
import itAutomation from './locales/it/automation.json'
import itDocuments from './locales/it/documents.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { common: frCommon, dashboard: frDashboard, settings: frSettings, contacts: frContacts, pipeline: frPipeline, listings: frListings, kyc: frKyc, messages: frMessages, calendar: frCalendar, matching: frMatching, automation: frAutomation, documents: frDocuments },
      de: { common: deCommon, dashboard: deDashboard, settings: deSettings, contacts: deContacts, pipeline: dePipeline, listings: deListings, kyc: deKyc, messages: deMessages, calendar: deCalendar, matching: deMatching, automation: deAutomation, documents: deDocuments },
      en: { common: enCommon, dashboard: enDashboard, settings: enSettings, contacts: enContacts, pipeline: enPipeline, listings: enListings, kyc: enKyc, messages: enMessages, calendar: enCalendar, matching: enMatching, automation: enAutomation, documents: enDocuments },
      it: { common: itCommon, dashboard: itDashboard, settings: itSettings, contacts: itContacts, pipeline: itPipeline, listings: itListings, kyc: itKyc, messages: itMessages, calendar: itCalendar, matching: itMatching, automation: itAutomation, documents: itDocuments },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'megga-language',
      caches: ['localStorage'],
    },
  })

export default i18n
