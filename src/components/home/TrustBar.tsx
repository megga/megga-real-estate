import { useTranslation } from 'react-i18next'

const PARTNERS = [
  { name: 'Google Calendar', logo: '/google-calendar-logo.svg' },
  {
    name: 'Outlook',
    customRender: 'outlook' as const,
  },
  { name: 'C2PA', logo: '/c2pa-logo.svg' },
  {
    name: 'Swiss Made Software',
    customRender: 'sms' as const,
  },
]

export default function TrustBar() {
  const { t } = useTranslation('common')

  return (
    <section className="py-10 md:py-12">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <p className="text-xs text-gray-400 text-center mb-8 tracking-wide">
          {t('home.integrationsPartners')}
        </p>

        <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
          {PARTNERS.map((partner) => {
            if (partner.customRender === 'outlook') {
              return (
                <div key={partner.name} className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity duration-300 select-none">
                  <img src="/outlook-icon-2025.svg" alt="" className="h-8 w-8 object-contain" loading="lazy" decoding="async" />
                  <img src="/outlook-wordmark.svg" alt="Outlook" className="h-7 w-auto object-contain" loading="lazy" decoding="async" />
                </div>
              )
            }
            if (partner.customRender === 'sms') {
              return (
                <div key={partner.name} className="flex items-center gap-2.5 opacity-40 hover:opacity-70 transition-opacity duration-300 select-none">
                  <svg viewBox="4 7 44 38" className="h-8 w-auto flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                    <path d="M45.28,42.51H9.24c-1.76,0-3.18-1.43-3.18-3.18v-20.16c0-.43.09-.86.26-1.26l3.07-7.15c.5-1.17,1.65-1.92,2.92-1.92h13.36c1.3,0,2.47.79,2.95,2,0,0,.51,1.26,1,2.5h15.66c1.76,0,3.18,1.42,3.18,3.18v22.81c0,1.76-1.42,3.18-3.18,3.18M21.43,25.97c-1.03,0-1.57.79-1.57,1.57s.54,1.57,1.57,1.57h4.33v4.34c0,1.03.78,1.57,1.57,1.57s1.57-.54,1.57-1.57v-4.34h4.33c1.03,0,1.57-.79,1.57-1.57s-.54-1.57-1.57-1.57h-4.33v-4.34c0-1.03-.78-1.57-1.57-1.57s-1.57.54-1.57,1.57v4.34h-4.33" fill="#E42321"/>
                  </svg>
                  <img src="/sms-wordmark.svg" alt="Swiss Made Software" className="h-8 w-auto object-contain" loading="lazy" decoding="async" />
                </div>
              )
            }
            return (
              <img
                key={partner.name}
                src={partner.logo!}
                alt={partner.name}
                className="h-8 w-auto object-contain opacity-40 hover:opacity-70 transition-opacity duration-300 select-none"
                loading="lazy"
                decoding="async"
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
