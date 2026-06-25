// MEGGA CRM — Mock dataset for the agent prototype.
// Realistic Swiss real-estate context: Genève / Lausanne / Vaud, CHF, FR-CH naming.

const CRM_AGENT = {
  id: "agt-1",
  name: "Gregory Lyonnet",
  role: "Agent principal",
  agency: "MEGGA Genève",
  email: "gregory@megga.ch",
  phone: "+41 22 555 01 02",
  initials: "GL",
};

const CRM_TEAM = [
  CRM_AGENT,
  { id: "agt-2", name: "Sophie Martin",  role: "Agent senior",       agency: "MEGGA Genève",   initials: "SM" },
  { id: "agt-3", name: "Marc Dubois",    role: "Agent",              agency: "MEGGA Lausanne", initials: "MD" },
  { id: "agt-4", name: "Laure Berger",   role: "Agent · Valais",     agency: "MEGGA Sion",     initials: "LB" },
];

// ─── Contacts ────────────────────────────────────────────────────────────
const CRM_CONTACTS = [
  { id:"c-001", type:"buyer",  firstName:"Marie",     lastName:"Bertrand",  email:"m.bertrand@bluewin.ch",  phone:"+41 79 412 88 02", lang:"fr",
    status:"active", score:84, source:"website", assignedTo:"agt-1",
    createdAt:"2026-04-02T09:00:00", lastActivityAt:"2026-04-29T15:32:00",
    kyc:{ status:"verified", riskLevel:"low",  expiresAt:"2027-04-02" },
    criteria:{ transaction:"vente", types:["appartement"], cantons:["GE"], cities:["Genève","Carouge"], budgetMin:900000, budgetMax:1300000, areaMin:90, roomsMin:4, mustHave:["balcon","ascenseur"], niceToHave:["vue lac"] },
    tags:["famille","priorité haute"], notes:"Recherche un 4-5p pour la rentrée scolaire. Décision d'achat en couple, mari basé à Lausanne en semaine.",
    avatarBg:"#0041D9" },

  { id:"c-002", type:"buyer",  firstName:"Pierre",    lastName:"Vionnet",   email:"pvionnet@gmail.com",     phone:"+41 78 211 04 91", lang:"fr",
    status:"active", score:71, source:"referral", assignedTo:"agt-1",
    createdAt:"2026-03-18T11:30:00", lastActivityAt:"2026-04-21T10:11:00",
    kyc:{ status:"pending", riskLevel:"medium" },
    criteria:{ transaction:"vente", types:["maison","appartement"], cantons:["VD"], cities:["Lausanne","Pully","Lutry"], budgetMin:1400000, budgetMax:2200000, areaMin:140, roomsMin:5, mustHave:["jardin"], niceToHave:["vue lac","piscine"] },
    tags:["investisseur"], notes:"Cherche à investir, profite de la vente de son entreprise. Pas pressé.",
    avatarBg:"#8B5CF6" },

  { id:"c-003", type:"buyer",  firstName:"Élodie",    lastName:"Schmidt",   email:"elodie.s@protonmail.com",phone:"+41 79 808 12 24", lang:"fr",
    status:"active", score:92, source:"AI", assignedTo:"agt-1",
    createdAt:"2026-04-25T14:20:00", lastActivityAt:"2026-04-30T08:45:00",
    kyc:{ status:"none" },
    criteria:{ transaction:"vente", types:["appartement"], cantons:["GE"], cities:["Eaux-Vives","Champel","Plainpalais"], budgetMin:750000, budgetMax:1100000, areaMin:75, roomsMin:3, mustHave:["balcon"] },
    tags:["primo-accédant","urgent"], notes:"Lead extrait d'un email transféré. Pré-qualifié par MEGGA AI.",
    avatarBg:"#10B981" },

  { id:"c-004", type:"seller", firstName:"Jean-Marc", lastName:"Aebischer", email:"jm.aebischer@gmail.com",phone:"+41 79 222 14 87", lang:"fr",
    status:"active", score:68, source:"call", assignedTo:"agt-1",
    createdAt:"2026-02-11T08:00:00", lastActivityAt:"2026-04-28T17:00:00",
    kyc:{ status:"verified", riskLevel:"low", expiresAt:"2027-02-11" },
    notes:"Vendeur 4p Eaux-Vives. Mandat exclusif signé. Photos C2PA prises le 14 mars.",
    tags:["mandat exclusif"],
    avatarBg:"#F59E0B" },

  { id:"c-005", type:"buyer",  firstName:"Camille",   lastName:"Rougier",   email:"crougier@swissquote.ch", phone:"+41 78 332 99 11", lang:"fr",
    status:"active", score:55, source:"walk-in", assignedTo:"agt-1",
    createdAt:"2026-04-14T16:30:00", lastActivityAt:"2026-04-22T09:00:00",
    kyc:{ status:"none" },
    criteria:{ transaction:"location", types:["appartement"], cantons:["GE"], cities:["Genève"], budgetMax:3500, areaMin:80, roomsMin:3 },
    tags:["location"], notes:"Locataire, expat US, arrive en juillet.",
    avatarBg:"#06B6D4" },

  { id:"c-006", type:"seller", firstName:"Catherine", lastName:"Loreau",    email:"c.loreau@hotmail.fr",   phone:"+41 79 605 11 03", lang:"fr",
    status:"qualified", score:48, source:"website", assignedTo:"agt-1",
    createdAt:"2026-04-26T10:00:00", lastActivityAt:"2026-04-26T10:00:00",
    kyc:{ status:"none" },
    notes:"Soumission depuis MEGGA Vendre. À contacter sous 48h. Maison Carouge, succession.",
    tags:["nouveau","succession"],
    avatarBg:"#E53935" },

  { id:"c-007", type:"buyer",  firstName:"Antoine",   lastName:"Picard",    email:"a.picard@bluewin.ch",   phone:"+41 76 414 22 18", lang:"fr",
    status:"active", score:78, source:"website", assignedTo:"agt-1",
    createdAt:"2026-03-30T13:00:00", lastActivityAt:"2026-04-27T14:40:00",
    kyc:{ status:"verified", riskLevel:"low", expiresAt:"2027-03-30" },
    criteria:{ transaction:"vente", types:["maison"], cantons:["GE"], cities:["Cologny","Vandœuvres","Vésenaz"], budgetMin:2500000, budgetMax:4000000, areaMin:200, roomsMin:6, mustHave:["jardin","garage"], niceToHave:["piscine","vue lac"] },
    tags:["haute valeur","famille"], notes:"Famille 4 enfants, vit actuellement à Cologny en location.",
    avatarBg:"#0041D9" },

  { id:"c-008", type:"buyer",  firstName:"Linda",     lastName:"Okafor",    email:"l.okafor@gmail.com",    phone:"+41 78 909 33 12", lang:"en",
    status:"lead", score:32, source:"csv", assignedTo:"agt-1",
    createdAt:"2026-04-29T17:00:00", lastActivityAt:"2026-04-29T17:00:00",
    kyc:{ status:"none" },
    notes:"Importée du CSV salon SIMI 2026. À qualifier.",
    tags:["salon"],
    avatarBg:"#6366F1" },
];

// ─── Biens (vue agent — différent de la fiche publique) ──────────────────
const CRM_BIENS = [
  { id:"b-101", ref:"MG-2026-101", status:"active",
    type:"appartement", transaction:"vente",
    title:"4 pièces lumineux Eaux-Vives", addr:"Rue du Lac 15, Genève", canton:"GE",
    price:850000, charges:340, area:85, rooms:4, beds:2, baths:1, year:1972, energy:"D",
    ownerContactId:"c-004",
    mandat:{ type:"exclusif", signedAt:"2026-02-22", expiresAt:"2026-08-22", commission:3.0 },
    visibility:"public", publishedTo:["MEGGA","Homegate","ImmoScout"],
    stats:{ views:1245, favorites:38, visitRequests:7 },
    photoCount:18, signedPhotoCount:18,
    desc:"Quatre pièces traversant au cœur des Eaux-Vives, à deux pas du lac et des quais. Séjour lumineux, cuisine ouverte récemment rénovée, deux chambres calmes sur cour. Immeuble soigné, ascenseur et cave. Une adresse recherchée, idéale premier achat ou pied-à-terre.",
    features:["Balcon","Ascenseur","Cave","Traversant","Proche lac","Proche écoles"],
    accent:"#0041D9" },

  { id:"b-102", ref:"MG-2026-102", status:"active",
    type:"appartement", transaction:"vente",
    title:"3 pièces standing Champel", addr:"Avenue de Champel 42, Genève", canton:"GE",
    price:780000, charges:280, area:75, rooms:3, beds:1, baths:1, year:2008, energy:"B",
    ownerContactId:null,
    mandat:{ type:"simple", signedAt:"2026-03-08", expiresAt:"2026-09-08", commission:3.0 },
    visibility:"public", publishedTo:["MEGGA","Homegate"],
    stats:{ views:892, favorites:24, visitRequests:5 },
    photoCount:14, signedPhotoCount:14,
    desc:"Trois pièces de standing à Champel, dans une résidence récente. Belles prestations, cuisine équipée, séjour ouvert sur balcon. Quartier résidentiel prisé, proche hôpital et transports. Classe énergétique B.",
    features:["Balcon","Ascenseur","Parking","Cave","Résidence récente","Proche transports"],
    accent:"#10B981" },

  { id:"b-103", ref:"MG-2026-103", status:"active",
    type:"appartement", transaction:"vente",
    title:"5 pièces familial Carouge", addr:"Rue Ancienne 6, Carouge", canton:"GE",
    price:1100000, charges:420, area:120, rooms:5, beds:3, baths:2, year:1996, energy:"C",
    ownerContactId:null,
    mandat:{ type:"exclusif", signedAt:"2026-03-25", expiresAt:"2026-09-25", commission:3.5 },
    visibility:"public", publishedTo:["MEGGA","Homegate","ImmoScout"],
    stats:{ views:1502, favorites:51, visitRequests:11 },
    photoCount:22, signedPhotoCount:20,
    desc:"Spacieux cinq pièces familial au cœur de la vieille ville de Carouge. Vaste séjour, trois chambres, deux salles d'eau, cuisine conviviale. Quartier vivant et recherché, commerces et écoles à pied. Parfait pour une famille.",
    features:["Balcon","Ascenseur","Cave","2 salles d'eau","Proche écoles","Proche commerces"],
    accent:"#8B5CF6" },

  { id:"b-104", ref:"MG-2026-104", status:"reserved",
    type:"maison", transaction:"vente",
    title:"Villa contemporaine Cologny", addr:"Chemin du Levant 8, Cologny", canton:"GE",
    price:3850000, charges:null, area:240, rooms:7, beds:4, baths:3, year:2019, energy:"A",
    ownerContactId:null,
    mandat:{ type:"exclusif", signedAt:"2026-01-30", expiresAt:"2026-07-30", commission:3.0 },
    visibility:"private",
    stats:{ views:421, favorites:18, visitRequests:3 },
    photoCount:24, signedPhotoCount:24,
    desc:"Villa d'architecte contemporaine à Cologny. 240 m² baignés de lumière, vastes volumes, sept pièces dont quatre chambres. Jardin paysager, piscine et vue dégagée. Prestations d'exception, classe énergétique A. Bien off-market.",
    features:["Piscine","Jardin","Vue lac","Garage","Domotique","Cave à vin"],
    accent:"#F59E0B" },

  { id:"b-105", ref:"MG-2026-105", status:"draft",
    type:"appartement", transaction:"vente",
    title:"2 pièces Plainpalais (brouillon)", addr:"Rue de Carouge 78, Genève", canton:"GE",
    price:680000, charges:220, area:55, rooms:2, beds:1, baths:1, year:1985, energy:"D",
    ownerContactId:null,
    mandat:{ type:"simple" },
    visibility:"private",
    stats:{ views:0, favorites:0, visitRequests:0 },
    photoCount:0, signedPhotoCount:0,
    desc:"Deux pièces à rénover à Plainpalais, idéal investisseur ou premier achat. Annonce en préparation.",
    features:["Cave","Proche transports"],
    accent:"#7A8079" },

  { id:"b-106", ref:"MG-2026-106", status:"active",
    type:"appartement", transaction:"location",
    title:"3 pièces meublé Pâquis", addr:"Rue de Berne 22, Genève", canton:"GE",
    price:null, rent:3200, charges:180, area:78, rooms:3, beds:2, baths:1, year:2010, energy:"C",
    ownerContactId:null,
    mandat:{ type:"simple", signedAt:"2026-04-12" },
    visibility:"public", publishedTo:["MEGGA","Homegate"],
    stats:{ views:340, favorites:12, visitRequests:4 },
    photoCount:11, signedPhotoCount:11,
    desc:"Trois pièces meublé aux Pâquis, disponible immédiatement. Entièrement équipé et décoré, deux chambres, séjour cosy, cuisine moderne. Idéal expatrié ou séjour professionnel, à deux pas de la gare et du lac. Location.",
    features:["Meublé","Ascenseur","Proche gare","Proche lac","Internet inclus"],
    accent:"#06B6D4" },
];

// ─── Deals (pipeline) ────────────────────────────────────────────────────
const CRM_DEALS = [
  { id:"d-1", contactId:"c-001", bienId:"b-103", stage:"visit-done",
    value:1100000, probability:65, ownerAgentId:"agt-1",
    nextAction:{ kind:"call", dueAt:"2026-05-02T10:00", note:"Recueillir intérêt après visite" },
    risk:"healthy", updatedAt:"2026-04-29T15:32:00" },
  { id:"d-1b", contactId:"c-001", bienId:"b-101", stage:"offer",
    value:850000, probability:48, ownerAgentId:"agt-1",
    nextAction:{ kind:"call", dueAt:"2026-05-03T09:30", note:"Confirmer le financement avant l'offre" },
    risk:"at-risk", updatedAt:"2026-04-28T11:10:00" },
  { id:"d-2", contactId:"c-002", bienId:null, stage:"searching",
    value:1800000, probability:35, ownerAgentId:"agt-1",
    nextAction:{ kind:"match", dueAt:"2026-05-01T14:00", note:"Envoyer 3 nouveaux matchs" },
    risk:"at-risk", updatedAt:"2026-04-21T10:11:00" },
  { id:"d-3", contactId:"c-003", bienId:"b-101", stage:"interest-confirmed",
    value:850000, probability:80, ownerAgentId:"agt-1",
    nextAction:{ kind:"kyc", dueAt:"2026-05-01T09:00", note:"Lancer dossier KYC" },
    risk:"healthy", updatedAt:"2026-04-30T08:45:00" },
  { id:"d-4", contactId:"c-005", bienId:"b-106", stage:"visit-scheduled",
    value:38400, probability:55, ownerAgentId:"agt-1",
    nextAction:{ kind:"visit", dueAt:"2026-05-03T16:00", note:"Visite Pâquis 16h" },
    risk:"healthy", updatedAt:"2026-04-22T09:00:00" },
  { id:"d-5", contactId:"c-007", bienId:"b-104", stage:"offer",
    value:3850000, probability:70, ownerAgentId:"agt-1",
    nextAction:{ kind:"offer", dueAt:"2026-05-02T18:00", note:"Réponse vendeur attendue" },
    risk:"healthy", updatedAt:"2026-04-27T14:40:00" },
  { id:"d-6", contactId:"c-008", bienId:null, stage:"to-qualify",
    value:0, probability:10, ownerAgentId:"agt-1",
    nextAction:{ kind:"call", dueAt:"2026-04-30T11:00", note:"Premier appel de qualification" },
    risk:"stalled", updatedAt:"2026-04-29T17:00:00" },
  { id:"d-7", contactId:"c-006", bienId:null, stage:"new-lead",
    value:0, probability:0, ownerAgentId:"agt-1",
    nextAction:{ kind:"call", dueAt:"2026-04-30T15:00", note:"Premier contact vendeur Carouge" },
    risk:"healthy", updatedAt:"2026-04-26T10:00:00" },
];

// ─── Activity (timeline) ────────────────────────────────────────────────
const CRM_ACTIVITY = [
  { id:"a-1", at:"2026-04-30T09:00:00", kind:"ai-action", contactId:"c-003",
    text:"MEGGA AI a extrait Élodie Schmidt depuis un email transféré. 4 critères détectés." },
  { id:"a-2", at:"2026-04-30T08:45:00", kind:"email-open", contactId:"c-003",
    text:"Élodie Schmidt a ouvert l'envoi de matchs (3/3 biens vus)." },
  { id:"a-3", at:"2026-04-29T17:32:00", kind:"visit", contactId:"c-001", bienId:"b-103",
    text:"Visite effectuée — 5 pièces familial Carouge avec Marie Bertrand." },
  { id:"a-4", at:"2026-04-29T15:32:00", kind:"note", contactId:"c-001",
    text:"Marie a apprécié l'exposition mais souhaite revoir la cuisine. À recontacter sous 48h." },
  { id:"a-5", at:"2026-04-29T11:10:00", kind:"doc-signed", contactId:"c-007", bienId:"b-104",
    text:"Antoine Picard a signé le bon de visite (signature électronique)." },
  { id:"a-6", at:"2026-04-28T17:00:00", kind:"call", contactId:"c-004",
    text:"Appel vendeur Aebischer — point hebdo, 5 demandes de visite cette semaine." },
  { id:"a-7", at:"2026-04-27T14:40:00", kind:"offer", contactId:"c-007", bienId:"b-104",
    text:"Offre déposée — CHF 3'850'000 pour la villa Cologny." },
  { id:"a-8", at:"2026-04-26T10:00:00", kind:"lead-in", contactId:"c-006",
    text:"Nouveau dossier vendeur reçu via MEGGA Vendre — Catherine Loreau, Carouge." },
];

// ─── Matchs IA ──────────────────────────────────────────────────────────
const CRM_MATCHES = [
  { contactId:"c-001", bienId:"b-103", score:94, reasons:["Budget +25","Surface +20","Canton +15","Type +15","Pièces +10","Quartier favori +9"], status:"viewed" },
  { contactId:"c-001", bienId:"b-101", score:78, reasons:["Budget +20","Canton +15","Type +15","Pièces +10","Surface −10","Année −12"], status:"sent" },
  { contactId:"c-003", bienId:"b-101", score:88, reasons:["Budget +25","Quartier +20","Type +15","Pièces +15","Année −5"], status:"liked" },
  { contactId:"c-003", bienId:"b-102", score:81, reasons:["Budget +25","Quartier +20","Type +15","Pièces +10","Surface +5","Année +6"], status:"sent" },
  { contactId:"c-002", bienId:"b-104", score:73, reasons:["Type +15","Canton −5","Budget +25","Pièces +10","Vue lac +8","Surface +20"], status:"to-send" },
  { contactId:"c-007", bienId:"b-104", score:96, reasons:["Type +20","Canton +15","Quartier +20","Budget +25","Surface +20","Pièces +15","Vue lac +5","Piscine +5","Année +6"], status:"liked" },
  { contactId:"c-005", bienId:"b-106", score:82, reasons:["Transaction +15","Budget +20","Quartier +15","Pièces +15","Type +15","Surface +2"], status:"viewed" },
];

// ─── AI Suggestions (today screen) ──────────────────────────────────────
const CRM_AI_SUGGESTIONS = [
  { id:"s-1", contactId:"c-001", priority:"high",
    title:"Relancer Marie Bertrand",
    body:"Visite il y a 36h sans suivi. Le bien b-103 a un score de match de 94% avec ses critères.",
    cta:"Rédiger une relance" },
  { id:"s-2", contactId:"c-003", priority:"high",
    title:"Lancer le KYC pour Élodie Schmidt",
    body:"Deal en intérêt confirmé — KYC obligatoire avant l'offre. Documents requis : pièce d'identité + justificatif d'adresse.",
    cta:"Démarrer KYC" },
  { id:"s-3", contactId:"c-002", priority:"medium",
    title:"3 nouveaux biens correspondent à Pierre Vionnet",
    body:"Le matching a trouvé 3 biens >70% sur le marché public MEGGA depuis hier soir.",
    cta:"Voir les matchs" },
  { id:"s-4", bienId:"b-104", priority:"low",
    title:"Le mandat exclusif Cologny expire dans 12 jours",
    body:"Pensez à renouveler ou à passer en mandat simple si la vente n'aboutit pas avant le 12 mai.",
    cta:"Préparer renouvellement" },
];

// helpers
function crmContactById(id) { return CRM_CONTACTS.find(c => c.id === id); }
function crmBienById(id) { return CRM_BIENS.find(b => b.id === id); }
function crmDealsByStage(stage) { return CRM_DEALS.filter(d => d.stage === stage); }

window.CRM_AGENT = CRM_AGENT;
window.CRM_TEAM = CRM_TEAM;
window.CRM_CONTACTS = CRM_CONTACTS;
window.CRM_BIENS = CRM_BIENS;
window.CRM_DEALS = CRM_DEALS;
window.CRM_ACTIVITY = CRM_ACTIVITY;
window.CRM_MATCHES = CRM_MATCHES;
window.CRM_AI_SUGGESTIONS = CRM_AI_SUGGESTIONS;
window.crmContactById = crmContactById;
window.crmBienById = crmBienById;
window.crmDealsByStage = crmDealsByStage;
