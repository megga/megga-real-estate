export const PLAN_LIMITS = {
  starter: {
    maxProperties: 10,
    maxContacts: 50,
    features: {
      aiSearch: false,
      aiCopilot: false,
      kycPipeline: false,
      sellerPortal: false,
      prioritySupport: false,
      conversationalSearch: false,
      apiAccess: false,
      customBranding: false,
      dataExport: false,
      maxAgents: 1,
    },
  },
  pro: {
    maxProperties: Infinity,
    maxContacts: Infinity,
    features: {
      aiSearch: true,
      aiCopilot: true,
      kycPipeline: true,
      sellerPortal: true,
      prioritySupport: false,
      conversationalSearch: true,
      apiAccess: false,
      customBranding: false,
      dataExport: false,
      maxAgents: 1,
    },
  },
  entreprise: {
    maxProperties: Infinity,
    maxContacts: Infinity,
    features: {
      aiSearch: true,
      aiCopilot: true,
      kycPipeline: true,
      sellerPortal: true,
      prioritySupport: true,
      conversationalSearch: true,
      apiAccess: true,
      customBranding: true,
      dataExport: true,
      maxAgents: 10,
    },
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
