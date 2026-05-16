// MEGGA CRM — KYC / LBA + Audit log data layer (mock)
// Étend les contacts existants avec des dossiers KYC structurés (LBA suisse)
// + génère un journal d'audit nLPD réaliste pour les 30 derniers jours.

// ─── KYC DOSSIERS ──────────────────────────────────────────────────────
// Un dossier KYC = 5 contrôles obligatoires (LBA art. 3-7) :
//   id        — pièce d'identité officielle scannée
//   address   — justificatif de domicile < 3 mois
//   pep       — screening Personne Exposée Politiquement
//   sanctions — listes OFAC / SECO / ONU
//   funds     — déclaration source des fonds (> CHF 100k)
//
// Chaque contrôle a un status : pending / verified / failed / na

const KYC_CHECK_LABELS = {
  id:        { title: "Pièce d'identité",       sub: "Passeport ou carte d'identité officielle, recto-verso." },
  address:   { title: "Justificatif de domicile", sub: "Facture nominative < 3 mois (loyer, électricité, banque)." },
  pep:       { title: "Screening PEP",           sub: "Vérification listes Personnes Exposées Politiquement." },
  sanctions: { title: "Listes de sanctions",     sub: "Croisement OFAC, SECO, ONU, Union Européenne." },
  funds:     { title: "Source des fonds",        sub: "Déclaration et preuve d'origine pour transactions > CHF 100'000." },
};

const KYC_RISK_LABELS = {
  low:    { label: "Risque faible",  tone: "#10B981" },
  medium: { label: "Risque modéré",  tone: "#F59E0B" },
  high:   { label: "Risque élevé",   tone: "#EF4444" },
};

const KYC_STATUS_LABELS = {
  none:     { label: "À démarrer",     tone: "#7A8088" },
  pending:  { label: "En cours",       tone: "#F59E0B" },
  verified: { label: "Vérifié",        tone: "#10B981" },
  failed:   { label: "Échec",          tone: "#EF4444" },
  stale:    { label: "À re-screener",  tone: "#F59E0B" },
};

// Dossiers liés aux contacts existants (cf. crm-data.jsx)
const KYC_DOSSIERS = [
  {
    id: "kyc-001", contactId: "c-001", agentId: "agt-1",
    status: "verified", riskLevel: "low",
    createdAt: "2026-04-02T10:14:00", verifiedAt: "2026-04-04T16:22:00",
    expiresAt: "2027-04-02",
    checks: {
      id:        { status: "verified", at: "2026-04-02T11:00:00", by: "agt-1", note: "Passeport CH n° X1234567 — RegisterMe OK" },
      address:   { status: "verified", at: "2026-04-03T09:14:00", by: "agt-1", note: "Facture SIG 03/2026" },
      pep:       { status: "verified", at: "2026-04-03T09:18:00", by: "system", note: "ComplyAdvantage — 0 match" },
      sanctions: { status: "verified", at: "2026-04-03T09:18:00", by: "system", note: "ComplyAdvantage — 0 match" },
      funds:     { status: "verified", at: "2026-04-04T16:22:00", by: "agt-1", note: "Attestation bancaire UBS — fonds propres + emprunt 80%" },
    },
    documents: [
      { id: "d-1", name: "Passeport recto.pdf",        size: "1.2 MB", uploadedAt: "2026-04-02T11:00:00" },
      { id: "d-2", name: "Passeport verso.pdf",        size: "1.1 MB", uploadedAt: "2026-04-02T11:00:00" },
      { id: "d-3", name: "Facture SIG mars 2026.pdf",  size: "0.4 MB", uploadedAt: "2026-04-03T09:14:00" },
      { id: "d-4", name: "Attestation UBS.pdf",        size: "0.8 MB", uploadedAt: "2026-04-04T16:22:00" },
    ],
  },
  {
    id: "kyc-002", contactId: "c-002", agentId: "agt-1",
    status: "pending", riskLevel: "medium",
    createdAt: "2026-04-15T08:30:00", verifiedAt: null, expiresAt: null,
    checks: {
      id:        { status: "verified", at: "2026-04-15T09:00:00", by: "agt-1", note: "Carte ID française scannée" },
      address:   { status: "verified", at: "2026-04-15T09:05:00", by: "agt-1", note: "Bail Lausanne 03/2025" },
      pep:       { status: "pending",  at: "2026-04-15T09:10:00", by: "system", note: "Match partiel — Vionnet (homonyme politicien) à valider manuellement" },
      sanctions: { status: "verified", at: "2026-04-15T09:10:00", by: "system", note: "0 match" },
      funds:     { status: "pending",  at: null,                  by: null,     note: "Attestation source des fonds demandée — relance 22/04" },
    },
    documents: [
      { id: "d-5", name: "ID française.jpg",   size: "0.9 MB", uploadedAt: "2026-04-15T09:00:00" },
      { id: "d-6", name: "Bail Lausanne.pdf",  size: "0.3 MB", uploadedAt: "2026-04-15T09:05:00" },
    ],
  },
  {
    id: "kyc-003", contactId: "c-004", agentId: "agt-1",
    status: "verified", riskLevel: "low",
    createdAt: "2026-02-12T14:00:00", verifiedAt: "2026-02-14T11:30:00",
    expiresAt: "2027-02-11",
    checks: {
      id:        { status: "verified", at: "2026-02-12T14:30:00", by: "agt-1", note: "Passeport CH" },
      address:   { status: "verified", at: "2026-02-12T14:35:00", by: "agt-1", note: "Acte de propriété Eaux-Vives" },
      pep:       { status: "verified", at: "2026-02-12T14:40:00", by: "system", note: "0 match" },
      sanctions: { status: "verified", at: "2026-02-12T14:40:00", by: "system", note: "0 match" },
      funds:     { status: "na",       at: "2026-02-14T11:30:00", by: "agt-1", note: "Vendeur — pas requis (LBA art. 6 al. 2)" },
    },
    documents: [
      { id: "d-7", name: "Passeport JM Aebischer.pdf", size: "1.0 MB", uploadedAt: "2026-02-12T14:30:00" },
      { id: "d-8", name: "Acte propriété 2018.pdf",     size: "2.4 MB", uploadedAt: "2026-02-12T14:35:00" },
    ],
  },
  {
    id: "kyc-004", contactId: "c-007", agentId: "agt-1",
    status: "verified", riskLevel: "medium",
    createdAt: "2026-03-31T10:00:00", verifiedAt: "2026-04-02T15:00:00",
    expiresAt: "2027-03-30",
    checks: {
      id:        { status: "verified", at: "2026-03-31T10:30:00", by: "agt-1", note: "Passeport CH" },
      address:   { status: "verified", at: "2026-03-31T10:35:00", by: "agt-1", note: "Bail Cologny" },
      pep:       { status: "verified", at: "2026-03-31T10:40:00", by: "system", note: "0 match" },
      sanctions: { status: "verified", at: "2026-03-31T10:40:00", by: "system", note: "0 match" },
      funds:     { status: "verified", at: "2026-04-02T15:00:00", by: "agt-1", note: "Apport CHF 1.5M — attestation Pictet + cession de parts" },
    },
    documents: [
      { id: "d-9",  name: "Passeport Picard.pdf",  size: "1.1 MB", uploadedAt: "2026-03-31T10:30:00" },
      { id: "d-10", name: "Bail Cologny.pdf",       size: "0.5 MB", uploadedAt: "2026-03-31T10:35:00" },
      { id: "d-11", name: "Attestation Pictet.pdf", size: "0.9 MB", uploadedAt: "2026-04-02T15:00:00" },
    ],
  },
  {
    id: "kyc-005", contactId: "c-003", agentId: "agt-1",
    status: "none", riskLevel: "medium",
    createdAt: null, verifiedAt: null, expiresAt: null,
    checks: {
      id:        { status: "pending", at: null, by: null, note: "Demande envoyée par email le 28/04" },
      address:   { status: "pending", at: null, by: null, note: null },
      pep:       { status: "pending", at: null, by: null, note: null },
      sanctions: { status: "pending", at: null, by: null, note: null },
      funds:     { status: "pending", at: null, by: null, note: null },
    },
    documents: [],
  },
  {
    id: "kyc-006", contactId: "c-005", agentId: "agt-1",
    status: "none", riskLevel: "low",
    createdAt: null, verifiedAt: null, expiresAt: null,
    checks: {
      id: { status: "pending" }, address: { status: "pending" },
      pep: { status: "pending" }, sanctions: { status: "pending" }, funds: { status: "na" },
    },
    documents: [],
  },
  {
    id: "kyc-007", contactId: "c-006", agentId: "agt-1",
    status: "none", riskLevel: "high",
    createdAt: null, verifiedAt: null, expiresAt: null,
    checks: {
      id: { status: "pending" }, address: { status: "pending" },
      pep: { status: "pending", note: "Vigilance accrue — succession à l'international" },
      sanctions: { status: "pending" }, funds: { status: "pending" },
    },
    documents: [],
  },
  {
    id: "kyc-008", contactId: "c-008", agentId: "agt-1",
    status: "none", riskLevel: "medium",
    createdAt: null, verifiedAt: null, expiresAt: null,
    checks: {
      id: { status: "pending" }, address: { status: "pending" },
      pep: { status: "pending" }, sanctions: { status: "pending" }, funds: { status: "pending" },
    },
    documents: [],
  },
];

// Helpers KYC
function kycByContactId(cid) {
  return KYC_DOSSIERS.find(k => k.contactId === cid) || null;
}
function kycCompletionPct(dossier) {
  if (!dossier) return 0;
  const checks = Object.values(dossier.checks);
  const done = checks.filter(c => c.status === "verified" || c.status === "na").length;
  return Math.round((done / checks.length) * 100);
}
function kycCountByStatus(status) {
  return KYC_DOSSIERS.filter(k => k.status === status).length;
}

// ─── AUDIT LOG (nLPD / LBA piste d'audit) ───────────────────────────────
// Catégories : kyc / deal / contact / bien / doc / auth / settings / ai
// Sévérité (pour le filtre rapide) : info / warn / critical

const AUDIT_CATEGORIES = {
  kyc:      { label: "KYC",        tone: "#1E5BC6" },
  deal:     { label: "Pipeline",   tone: "#0891B2" },
  contact:  { label: "Contact",    tone: "#7A8088" },
  bien:     { label: "Bien",       tone: "#C45A00" },
  doc:      { label: "Document",   tone: "#059669" },
  auth:     { label: "Connexion",  tone: "#0B0C0E" },
  settings: { label: "Réglages",   tone: "#7A8088" },
  ai:       { label: "MEGGA AI",   tone: "#7A4FD8" },
};

const AUDIT_EVENTS = [
  // 16 mai
  { id:"a-1",  at:"2026-05-16T11:42:00", actor:"agt-1", category:"deal",     severity:"info",
    action:"Étape changée",    object:{ kind:"deal", id:"d-3", label:"Marie Bertrand · Eaux-Vives 4p" },
    detail:"recherche → visite-planifiée", ip:"81.92.144.21" },
  { id:"a-2",  at:"2026-05-16T11:40:00", actor:"agt-1", category:"kyc",      severity:"critical",
    action:"Verrou KYC déclenché", object:{ kind:"deal", id:"d-7", label:"Élodie Schmidt · Champel 3p" },
    detail:"Tentative de passage en \"Intérêt confirmé\" bloquée — dossier KYC manquant", ip:"81.92.144.21" },
  { id:"a-3",  at:"2026-05-16T10:58:00", actor:"system",category:"ai",       severity:"info",
    action:"Suggestion générée", object:{ kind:"contact", id:"c-003", label:"Élodie Schmidt" },
    detail:"3 biens correspondent à ses critères — proposition de relance" },
  { id:"a-4",  at:"2026-05-16T09:15:00", actor:"agt-1", category:"auth",     severity:"info",
    action:"Connexion réussie", object:{ kind:"agent", id:"agt-1", label:"Gregory Lyonnet" },
    detail:"MFA TOTP validé", ip:"81.92.144.21" },

  // 15 mai
  { id:"a-5",  at:"2026-05-15T17:30:00", actor:"agt-1", category:"doc",      severity:"info",
    action:"Document signé",    object:{ kind:"doc", id:"doc-12", label:"Bon de visite · Cologny" },
    detail:"Signature électronique acheteur (Antoine Picard)", ip:"81.92.144.21" },
  { id:"a-6",  at:"2026-05-15T16:12:00", actor:"agt-1", category:"bien",     severity:"info",
    action:"Photos publiées",   object:{ kind:"bien", id:"b-103", label:"MG-2026-103 · Maison Cologny" },
    detail:"18 photos signées C2PA poussées vers Homegate + ImmoScout" },
  { id:"a-7",  at:"2026-05-15T14:00:00", actor:"agt-1", category:"contact",  severity:"info",
    action:"Contact créé",      object:{ kind:"contact", id:"c-009", label:"Nadia Hess" },
    detail:"Source : import vCard salon SIMI" },
  { id:"a-8",  at:"2026-05-15T11:22:00", actor:"system",category:"kyc",      severity:"warn",
    action:"Re-screening planifié", object:{ kind:"contact", id:"c-007", label:"Antoine Picard" },
    detail:"PEP à re-vérifier dans 11 mois (échéance 2027-03-30)" },

  // 14 mai
  { id:"a-9",  at:"2026-05-14T18:04:00", actor:"agt-1", category:"deal",     severity:"info",
    action:"Deal créé",         object:{ kind:"deal", id:"d-9", label:"Pierre Vionnet · Pully" },
    detail:"Valeur estimée CHF 1'850'000 · étape : nouveau lead" },
  { id:"a-10", at:"2026-05-14T15:30:00", actor:"agt-1", category:"kyc",      severity:"info",
    action:"Dossier KYC validé", object:{ kind:"contact", id:"c-007", label:"Antoine Picard" },
    detail:"5 contrôles validés — risque faible" },
  { id:"a-11", at:"2026-05-14T14:15:00", actor:"system",category:"kyc",      severity:"info",
    action:"Screening sanctions automatique", object:{ kind:"contact", id:"c-007", label:"Antoine Picard" },
    detail:"ComplyAdvantage — 0 match sur OFAC, SECO, ONU, UE" },
  { id:"a-12", at:"2026-05-14T10:00:00", actor:"agt-1", category:"settings", severity:"info",
    action:"Préférence mise à jour", object:{ kind:"agent", id:"agt-1", label:"Gregory Lyonnet" },
    detail:"Activation des notifications push pour les visites" },

  // 13 mai
  { id:"a-13", at:"2026-05-13T16:48:00", actor:"agt-1", category:"contact",  severity:"warn",
    action:"Données contact exportées", object:{ kind:"contact", id:"c-001", label:"Marie Bertrand" },
    detail:"Export CSV demandé — droit d'accès nLPD art. 25", ip:"81.92.144.21" },
  { id:"a-14", at:"2026-05-13T14:20:00", actor:"agt-1", category:"bien",     severity:"info",
    action:"Bien créé",         object:{ kind:"bien", id:"b-105", label:"MG-2026-105 · Studio Plainpalais" },
    detail:"Source : soumission marketplace publique" },
  { id:"a-15", at:"2026-05-13T11:00:00", actor:"agt-1", category:"doc",      severity:"info",
    action:"Mandat exclusif signé", object:{ kind:"doc", id:"doc-08", label:"Mandat exclusif · b-103" },
    detail:"Durée 6 mois, commission 3.0%" },

  // 12 mai
  { id:"a-16", at:"2026-05-12T17:00:00", actor:"system",category:"ai",       severity:"info",
    action:"Matching auto exécuté", object:{ kind:"contact", id:"c-001", label:"Marie Bertrand" },
    detail:"Top 5 biens calculés — score moyen 78/100" },
  { id:"a-17", at:"2026-05-12T09:30:00", actor:"agt-1", category:"auth",     severity:"warn",
    action:"Tentative connexion échouée", object:{ kind:"agent", id:"agt-1", label:"Gregory Lyonnet" },
    detail:"Mot de passe incorrect (tentative 1/5)", ip:"185.220.101.42" },
  { id:"a-18", at:"2026-05-12T08:45:00", actor:"agt-1", category:"auth",     severity:"info",
    action:"Connexion réussie", object:{ kind:"agent", id:"agt-1", label:"Gregory Lyonnet" },
    detail:"MFA TOTP validé", ip:"81.92.144.21" },

  // 10 mai
  { id:"a-19", at:"2026-05-10T15:22:00", actor:"agt-1", category:"deal",     severity:"info",
    action:"Étape changée",     object:{ kind:"deal", id:"d-1", label:"Marie Bertrand · Eaux-Vives 4p" },
    detail:"à-qualifier → recherche active" },
  { id:"a-20", at:"2026-05-10T11:00:00", actor:"system",category:"kyc",      severity:"warn",
    action:"Dossier KYC à re-vérifier", object:{ kind:"contact", id:"c-001", label:"Marie Bertrand" },
    detail:"Échéance dans < 12 mois — re-screening conseillé" },
];

// Helpers Audit
function auditFilterByDate(events, days = 30) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 3600 * 1000);
  return events.filter(e => new Date(e.at) >= cutoff);
}

window.KYC_DOSSIERS = KYC_DOSSIERS;
window.KYC_CHECK_LABELS = KYC_CHECK_LABELS;
window.KYC_RISK_LABELS = KYC_RISK_LABELS;
window.KYC_STATUS_LABELS = KYC_STATUS_LABELS;
window.kycByContactId = kycByContactId;
window.kycCompletionPct = kycCompletionPct;
window.kycCountByStatus = kycCountByStatus;

window.AUDIT_EVENTS = AUDIT_EVENTS;
window.AUDIT_CATEGORIES = AUDIT_CATEGORIES;
window.auditFilterByDate = auditFilterByDate;
