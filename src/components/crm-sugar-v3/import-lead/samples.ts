// Sprint 3 — Exemples de messages pré-mâchés pour l'Import Lead.
// Port pixel-près de IL_SAMPLES dans crm-import-lead-modal.jsx (handoff).
// Permettent à l'agent de tester le wizard sans coller un vrai message.

export interface LeadSample {
  label: string
  text: string
}

export const LEAD_SAMPLES: LeadSample[] = [
  {
    label: 'Email acheteur',
    text: `Bonjour Marie,

Je m'appelle Sophie Marchand, on s'est croisées à la visite portes ouvertes de Carouge dimanche dernier. Je cherche un 4 pièces dans les Eaux-Vives ou aux alentours, avec si possible un balcon et un parking. Budget aux alentours de 1.5M CHF.

Je suis avec mon mari Thomas, on a deux enfants en bas âge. On aimerait visiter rapidement, idéalement avant fin mai.

Mon mobile : +41 79 555 12 34
Email : sophie.marchand@example.com

Bien à vous,
Sophie`,
  },
  {
    label: 'SMS vendeur',
    text: `Bonjour, je suis Jean-Marc Aebischer, j'ai vu votre annonce MEGGA. Je souhaite vendre mon appartement à Plainpalais, 3.5 pces 92m2 au 4ème avec ascenseur, refait à neuf en 2022. J'attends environ CHF 950'000. Pouvez-vous me rappeler ? Tel +41 78 244 91 03. Merci`,
  },
  {
    label: 'WhatsApp locataire',
    text: `Salut, c'est Léa Roulin. Mon copain et moi cherchons un 2.5 pces à louer à Pâquis, max 2400.- charges comprises, dispo dès le 1er juillet. On sommes tous les deux salariés (UBS et HUG). Léa: leasmile@proton.me / 076 412 88 17. Merci !`,
  },
]
