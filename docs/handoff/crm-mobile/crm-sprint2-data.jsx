// MEGGA CRM — Sprint 2 — Données mock (offres, contre-offres, visites)
// ─────────────────────────────────────────────────────────────────────
// S'enrichit sur CRM_DEALS / CRM_BIENS / CRM_CONTACTS sans les modifier.
// Branchés sur window.CRM_OFFERS / CRM_VISITS / sprint2Helpers.

// ─── OFFRES & CONTRE-OFFRES ────────────────────────────────────────────
// Convention :
//   - kind: "offer" | "counter"  (counter = contre-offre du vendeur)
//   - parentOfferId : null pour la première offre, sinon id de l'offre parente
//   - status: "pending" | "accepted" | "rejected" | "expired" | "withdrawn"
//   - expiresAt : ISO; après cette date, l'offre passe automatiquement "expired"
const CRM_OFFERS = [
  // Deal d-5 — Villa Cologny — Antoine Picard
  {
    id: "of-001", dealId: "d-5", parentOfferId: null,
    kind: "offer", from: "buyer",
    by: "c-007", byLabel: "Antoine Picard",
    amount: 3850000, currency: "CHF",
    createdAt: "2026-04-27T14:40:00",
    expiresAt: "2026-05-02T18:00:00",
    status: "pending",
    conditions: {
      financing:    { active: true, days: 45, note: "Sous réserve de financement bancaire (BCGE)." },
      sale:         { active: false },
      diagnostic:   { active: true, note: "Sous réserve d'expertise indépendante du toit." },
      occupancy:    { active: false },
      other:        "Acquisition à titre personnel, paiement comptant à hauteur de 35 %.",
    },
    deposit: 100000,
    closingDate: "2026-07-31",
    attachments: [
      { id: "att-1", name: "Attestation de financement BCGE.pdf", size: "245 Ko" },
      { id: "att-2", name: "Pièce identité — A. Picard.pdf", size: "1.2 Mo" },
    ],
    notes: "Acheteur très motivé, a déjà visité 2 fois.",
  },
  {
    id: "of-002", dealId: "d-5", parentOfferId: "of-001",
    kind: "counter", from: "seller",
    by: "agt-1", byLabel: "MEGGA · Grégory L.",
    amount: 3950000, currency: "CHF",
    createdAt: "2026-04-28T11:15:00",
    expiresAt: "2026-05-03T12:00:00",
    status: "pending",
    conditions: {
      financing:    { active: true, days: 30, note: "Délai de financement réduit à 30 jours." },
      diagnostic:   { active: false, note: "Diagnostics du vendeur fournis et acceptés." },
      other:        "Acompte 10 % à la signature du compromis.",
    },
    deposit: 395000,
    closingDate: "2026-07-15",
    notes: "Le vendeur souhaite signer rapidement.",
  },

  // Deal d-3 — 4p Eaux-Vives — Élodie Schmidt (offre acceptée, jamais signée car KYC pending)
  {
    id: "of-003", dealId: "d-3", parentOfferId: null,
    kind: "offer", from: "buyer",
    by: "c-003", byLabel: "Élodie Schmidt",
    amount: 820000, currency: "CHF",
    createdAt: "2026-04-29T16:00:00",
    expiresAt: "2026-05-05T18:00:00",
    status: "pending",
    conditions: {
      financing:  { active: true, days: 60, note: "Financement à 80 %." },
      diagnostic: { active: false },
      other:      "Primo-accédante, premier achat.",
    },
    deposit: 50000,
    closingDate: "2026-08-30",
    notes: "KYC non finalisé — bloque la signature.",
  },
];

// ─── VISITES — bons + rapports ─────────────────────────────────────────
// kind: "scheduled" | "done" | "no-show" | "cancelled"
const CRM_VISITS = [
  {
    id: "vi-001", bienId: "b-103", contactId: "c-001", dealId: "d-1",
    scheduledAt: "2026-04-29T17:00:00", duration: 45,
    kind: "done",
    agentId: "agt-1",
    bon: {
      generatedAt: "2026-04-28T09:00:00",
      signedAt: "2026-04-29T16:55:00",
      docId: "doc-vi-001",
      visitorNames: ["Marie Bertrand"],
      visitorIds: ["c-001"],
    },
    rapport: {
      savedAt: "2026-04-29T18:14:00",
      sentiment: "warm", // hot | warm | cool | cold
      interestLevel: 7,
      highlights: ["Exposition sud appréciée", "Cuisine à revoir"],
      objections: ["Cuisine date des années 2000"],
      nextSteps: "Recontacter sous 48h avec une simulation de rénovation cuisine.",
      photos: 3,
      voiceNote: { duration: 142, transcribed: true },
      followUpScheduledAt: "2026-05-01T10:00:00",
    },
  },
  {
    id: "vi-002", bienId: "b-106", contactId: "c-005", dealId: "d-4",
    scheduledAt: "2026-05-03T16:00:00", duration: 30,
    kind: "scheduled",
    agentId: "agt-1",
    bon: {
      generatedAt: "2026-04-25T10:00:00",
      signedAt: null,
      docId: "doc-vi-002",
      visitorNames: ["Sarah Müller"],
      visitorIds: ["c-005"],
    },
    rapport: null,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────
function crmOffersByDeal(dealId) {
  return (window.CRM_OFFERS || []).filter(o => o.dealId === dealId);
}
function crmOfferChain(dealId) {
  // Trie chronologique : offre racine → contre-offres → contre-contre…
  const list = crmOffersByDeal(dealId).slice();
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return list;
}
function crmVisitsByContact(cid) {
  return (window.CRM_VISITS || []).filter(v => v.contactId === cid);
}
function crmVisitsByBien(bid) {
  return (window.CRM_VISITS || []).filter(v => v.bienId === bid);
}

window.CRM_OFFERS = CRM_OFFERS;
window.CRM_VISITS = CRM_VISITS;
window.crmOffersByDeal = crmOffersByDeal;
window.crmOfferChain = crmOfferChain;
window.crmVisitsByContact = crmVisitsByContact;
window.crmVisitsByBien = crmVisitsByBien;
