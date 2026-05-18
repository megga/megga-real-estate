// MEGGA — Templates email contextuels (Tier 2 mail)
// 6 templates pré-faits que l'agent peut pré-remplir dans le composer en 1 click.
// Variables interpolées : {{contact.first_name}}, {{contact.last_name}},
// {{agent.first_name}}, {{property.title}}, {{visit.date}}, {{visit.time}}.

export interface EmailTemplate {
  id: string
  label: string
  description: string
  /** Catégorie pour grouper visuellement dans le menu */
  category: 'visite' | 'kyc' | 'suivi' | 'bien'
  subject: string
  body: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'confirm_visit',
    label: 'Confirmation de visite',
    description: 'Confirme la date/heure d\'une visite avec adresse et infos pratiques.',
    category: 'visite',
    subject: 'Confirmation de votre visite — {{property.title}}',
    body: `Bonjour {{contact.first_name}},

Je vous confirme votre visite pour le bien "{{property.title}}".

📅 Date : {{visit.date}}
🕐 Heure : {{visit.time}}
📍 Lieu : {{property.address}}

Si vous avez la moindre question d'ici là, n'hésitez pas à me joindre.

À très bientôt,`,
  },
  {
    id: 'reschedule_request',
    label: 'Proposer un autre créneau',
    description: 'Suite à un conflit ou indisponibilité, proposer un nouveau créneau.',
    category: 'visite',
    subject: 'Re-planification de votre visite',
    body: `Bonjour {{contact.first_name}},

Suite à un imprévu, je dois reporter notre rendez-vous initialement prévu.

Je vous propose les créneaux suivants :
• Option 1 : (à compléter)
• Option 2 : (à compléter)
• Option 3 : (à compléter)

Faites-moi savoir lequel vous convient le mieux, ou proposez-moi une autre disponibilité.

Cordialement,`,
  },
  {
    id: 'kyc_documents',
    label: 'Demande pièces KYC',
    description: 'Demande les documents manquants pour la conformité LBA/LPD.',
    category: 'kyc',
    subject: 'Documents requis pour finaliser votre dossier',
    body: `Bonjour {{contact.first_name}},

Pour finaliser votre dossier dans le respect de la conformité suisse (LBA), j'ai besoin des documents suivants :

• Pièce d'identité valide (passeport ou carte d'identité, recto/verso)
• Justificatif de domicile de moins de 3 mois
• Attestation de fonds (relevé bancaire ou lettre de financement)

Vous pouvez me les transmettre en réponse à cet email, sécurisé bout en bout.

Merci d'avance,`,
  },
  {
    id: 'post_visit_followup',
    label: 'Suivi post-visite',
    description: 'Recueille les impressions du contact 24h après la visite.',
    category: 'suivi',
    subject: 'Vos impressions sur {{property.title}}',
    body: `Bonjour {{contact.first_name}},

J'espère que vous avez passé un bon moment hier lors de la visite du bien "{{property.title}}".

Auriez-vous quelques minutes pour me partager vos impressions ?
• Le bien correspond-il à vos attentes ?
• Y a-t-il des points qui vous ont marqué — positifs ou négatifs ?
• Souhaitez-vous une seconde visite, ou ce bien n'est pas pour vous ?

Votre retour m'aide à mieux cibler nos prochaines propositions.

Bien à vous,`,
  },
  {
    id: 'new_property_match',
    label: 'Nouveau bien correspondant',
    description: 'Présente un nouveau bien qui correspond aux critères du contact.',
    category: 'bien',
    subject: 'Un bien qui pourrait vous intéresser : {{property.title}}',
    body: `Bonjour {{contact.first_name}},

Je viens de recevoir un nouveau mandat qui correspond à vos critères de recherche :

🏠 {{property.title}}
📍 {{property.address}}

Je vous invite à consulter la fiche complète et, si cela vous parle, à me dire si vous souhaitez planifier une visite.

À votre disposition,`,
  },
  {
    id: 'offer_acknowledgement',
    label: 'Accusé réception offre',
    description: 'Confirme la bonne réception d\'une offre et précise les prochaines étapes.',
    category: 'suivi',
    subject: 'Bien reçu — votre offre pour {{property.title}}',
    body: `Bonjour {{contact.first_name}},

Je vous confirme la bonne réception de votre offre pour le bien "{{property.title}}".

Prochaines étapes :
1. Présentation de votre offre au vendeur
2. Retour sous 48-72h (acceptation, contre-offre ou refus)
3. Si accord : préparation du compromis chez le notaire

Je vous tiens informé dès que j'ai un retour.

Cordialement,`,
  },
]

interface TemplateContext {
  contact?: { first_name?: string | null; last_name?: string | null; email?: string | null }
  agent?: { first_name?: string | null; last_name?: string | null }
  property?: { title?: string | null; address?: string | null }
  visit?: { date?: string | null; time?: string | null }
}

/**
 * Remplace les {{path.field}} dans une string par les valeurs du context.
 * Les chemins non résolus restent tels quels (pour que l'agent sache compléter).
 */
export function interpolateTemplate(text: string, ctx: TemplateContext): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
    const parts = path.split('.')
    let cur: unknown = ctx
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p]
      } else {
        return `{{${path}}}`
      }
    }
    return cur == null ? `{{${path}}}` : String(cur)
  })
}
