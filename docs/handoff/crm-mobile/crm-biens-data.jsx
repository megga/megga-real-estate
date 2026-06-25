// MEGGA CRM — Données spécifiques à l'écran "Mes biens"
// Soumissions vendeurs (provenant du wizard MEGGA Vendre.html), historique de
// publication, validations et alertes propres au studio bien.

// ─── Soumissions vendeurs en attente de validation ─────────────────────
// Statut "submission" : un particulier a soumis une annonce via MEGGA Vendre.
// L'agent doit vérifier le dossier, contacter, signer un mandat puis publier.
const CRM_SUBMISSIONS = [
  {
    id: "sub-001",
    submittedAt: "2026-04-30T08:14:00",
    contactId: "c-006",     // Catherine Loreau (déjà dans les contacts, status "qualified")
    sla: "À contacter sous 48h",
    type: "maison", transaction: "vente",
    title: "Maison familiale Carouge — succession",
    addr: "Avenue Cardinal-Mermillod 22, Carouge", canton: "GE",
    rooms: 6, beds: 4, baths: 2, area: 165, year: 1968, energy: "D",
    floor: null, floorsTotal: 2,
    askingPrice: 1850000,
    priceMode: "owner",     // owner | agent (agent à estimer)
    motive: "succession",
    deadline: "6-12mois",
    condition: "to-refresh",
    photoCount: 12,
    desc: "Maison de 6 pièces sur deux étages avec jardin sud, garage double et grande cave. Quartier calme et résidentiel, proche commerces et écoles. Bien à rafraîchir mais structure saine.",
    features: ["jardin","garage","cave","cheminée"],
    accent: "#E53935",
    autoChecks: {
      addressMatch: "ok",
      photosCount: "warn",     // 12 photos — limite basse
      duplicates: "ok",
      cantonalRegistry: "ok",
    },
  },
  {
    id: "sub-002",
    submittedAt: "2026-04-29T17:42:00",
    contactId: null,            // Pas encore créé en contact
    contactDraft: { firstName: "Hugo", lastName: "Beretta", email: "h.beretta@gmail.com", phone: "+41 79 514 22 08", lang: "fr" },
    sla: "À contacter sous 24h",
    type: "appartement", transaction: "vente",
    title: "3.5 pièces Rive droite",
    addr: "Rue de Lausanne 110, Genève", canton: "GE",
    rooms: 3.5, beds: 2, baths: 1, area: 78, year: 2003, energy: "C",
    floor: 4, floorsTotal: 6,
    askingPrice: null,
    priceMode: "agent",
    motive: "changement de vie",
    deadline: "3-6mois",
    condition: "good",
    photoCount: 6,
    desc: "Appartement traversant en bon état, balcon donnant sur la cour intérieure, ascenseur, cave. Proche transports.",
    features: ["balcon","ascenseur","cave"],
    accent: "#0041D9",
    autoChecks: {
      addressMatch: "ok",
      photosCount: "warn",
      duplicates: "warn",       // adresse déjà active sur Homegate par un autre agent
      cantonalRegistry: "ok",
    },
  },
  {
    id: "sub-003",
    submittedAt: "2026-04-28T11:05:00",
    contactId: null,
    contactDraft: { firstName: "Sandrine", lastName: "Veuthey", email: "s.veuthey@bluewin.ch", phone: "+41 78 902 11 87", lang: "fr" },
    sla: "À contacter sous 48h",
    type: "appartement", transaction: "location",
    title: "2 pièces Pâquis (location)",
    addr: "Rue de Berne 41, Genève", canton: "GE",
    rooms: 2, beds: 1, baths: 1, area: 48, year: 1970, energy: "E",
    floor: 2, floorsTotal: 5,
    askingRent: 1850,
    priceMode: "owner",
    motive: "investissement",
    deadline: "urgent",
    condition: "to-refresh",
    photoCount: 4,
    desc: "Studio amélioré louable rapidement, idéal investisseur ou expat. Quartier vivant.",
    features: ["cave"],
    accent: "#06B6D4",
    autoChecks: {
      addressMatch: "ok",
      photosCount: "error",     // 4 photos — bloquant pour publier
      duplicates: "ok",
      cantonalRegistry: "ok",
    },
  },
];

// ─── Historique de publication par bien ────────────────────────────────
// Permet au studio bien d'afficher la timeline : créé → mandat signé → publié → mis à jour.
const CRM_BIEN_HISTORY = {
  "b-101": [
    { at:"2026-02-22T10:00:00", kind:"mandate-signed", text:"Mandat exclusif signé avec Jean-Marc Aebischer (commission 3.0%, expire le 22/08)." },
    { at:"2026-02-25T09:30:00", kind:"photos",         text:"Shooting photo C2PA — 18 photos signées par MEGGA." },
    { at:"2026-02-26T14:00:00", kind:"published",      text:"Publié sur MEGGA, Homegate et ImmoScout." },
    { at:"2026-04-15T11:20:00", kind:"price-change",   text:"Prix ajusté de CHF 880'000 à CHF 850'000 après 7 semaines." },
    { at:"2026-04-29T15:32:00", kind:"visit",          text:"Visite avec Marie Bertrand — feedback positif sur l'exposition." },
  ],
  "b-103": [
    { at:"2026-03-25T15:00:00", kind:"mandate-signed", text:"Mandat exclusif signé (commission 3.5%, expire le 25/09)." },
    { at:"2026-03-28T10:15:00", kind:"photos",         text:"22 photos prises, 20 signées C2PA (2 à signer)." },
    { at:"2026-03-30T09:00:00", kind:"published",      text:"Publié sur MEGGA, Homegate et ImmoScout." },
    { at:"2026-04-29T17:32:00", kind:"visit",          text:"Visite effectuée — Marie Bertrand." },
  ],
  "b-104": [
    { at:"2026-01-30T11:00:00", kind:"mandate-signed", text:"Mandat exclusif signé (commission 3.0%)." },
    { at:"2026-02-05T10:00:00", kind:"photos",         text:"24 photos signées C2PA." },
    { at:"2026-02-08T14:00:00", kind:"published",      text:"Publié — visibilité privée (off-market)." },
    { at:"2026-04-27T14:40:00", kind:"offer",          text:"Offre déposée — CHF 3'850'000 par Antoine Picard." },
  ],
  "b-105": [
    { at:"2026-04-26T16:00:00", kind:"draft-created",  text:"Brouillon créé manuellement par l'agent." },
  ],
};

// ─── Alertes par bien (calculées côté front pour la démo) ──────────────
// Type "blocker" empêche la publication ; "warn" est une recommandation.
function crmBienAlerts(bien) {
  const alerts = [];
  if (!bien.price && !bien.rent) alerts.push({ level: "blocker", text: "Prix non renseigné — requis avant publication." });
  if (bien.photoCount < 8) alerts.push({ level: "blocker", text: `${bien.photoCount} photos — minimum 8 pour publier.` });
  if (bien.signedPhotoCount < bien.photoCount) {
    const missing = bien.photoCount - bien.signedPhotoCount;
    alerts.push({ level: "warn", text: `${missing} photo(s) non signée(s) C2PA.` });
  }
  if (bien.mandat && bien.mandat.expiresAt) {
    const exp = new Date(bien.mandat.expiresAt);
    const days = Math.round((exp - new Date()) / 86400000);
    if (days >= 0 && days <= 30) alerts.push({ level: "warn", text: `Mandat expire dans ${days} jours.` });
    if (days < 0) alerts.push({ level: "blocker", text: `Mandat expiré depuis ${Math.abs(days)} jours.` });
  }
  if (!bien.ownerContactId && bien.status !== "draft") alerts.push({ level: "warn", text: "Vendeur non rattaché à un contact CRM." });
  if (!bien.energy) alerts.push({ level: "warn", text: "Classe énergétique manquante (CECB)." });
  return alerts;
}

window.CRM_SUBMISSIONS = CRM_SUBMISSIONS;
window.CRM_BIEN_HISTORY = CRM_BIEN_HISTORY;
window.crmBienAlerts = crmBienAlerts;
