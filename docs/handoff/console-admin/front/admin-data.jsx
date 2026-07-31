// MEGGA CRM — Console admin · DONNÉES DE DÉMONSTRATION
// ─────────────────────────────────────────────────────────────────────
// Jeu de données plausible pour la Suisse romande, calé sur les champs réels du
// backend (cf. AUDIT_ADMIN_CONSOLE.md) : agencies, profiles, kyc_cases,
// activity_events, platform_metrics, subscriptions.
// Montants en CHF avec apostrophes ; coûts IA en USD (comme le repo).
(function () {
  const ADMIN_KPIS = {
    activeAgencies: 38, newAgenciesThisMonth: 3,
    totalUsers: 214, newUsersThisMonth: 17,
    activeProperties: 1284,
    activeTransactions: 176,
    highRiskKyc: 3,
  };

  // Aucune alerte KYC/PEP ici : une correspondance PEP se traite dans le CRM de
  // l'agence (assujettie LBA) — la plateforme ne surveille que la santé du
  // service de screening (ComplyAdvantage), en agrégé, dans Monitoring.
  const ADMIN_ALERTS = [
    { id: "a2", action: "edge_function_error", tone: "err", label: "Erreur Edge Function", detail: "realadvisor-sync · timeout sur le bucket VD", when: "il y a 52 min" },
    { id: "a3", action: "ticket_created", tone: "info", label: "Nouveau ticket support", detail: "Alpes & Rives · « Export des mandats »", when: "il y a 2 h" },
    { id: "a4", action: "agency_created", tone: "ok", label: "Nouvelle agence inscrite", detail: "Grangier Immobilier · Morges · plan Pro", when: "il y a 5 h" },
    { id: "a5", action: "subscription_cancelled", tone: "warn", label: "Abonnement annulé", detail: "Vallée Verte Immobilier · fin de période le 31.08", when: "hier, 18:22" },
    { id: "a6", action: "kyc_screening_match", tone: "err", label: "Alerte PEP/Sanctions", detail: "Dossier KYC · Sté Helvetia Holding SA · Rive Droite", when: "hier, 09:07" },
  ];

  const ADMIN_ACTIVITY = [
    { id: "e1", cat: "pipeline", icon: "pipeline", label: "Étape pipeline changée", who: "Nadia Overney", agency: "Régie Lacustre", target: "Deal · Chemin de Beau-Site 12", when: "il y a 3 min" },
    { id: "e2", cat: "properties", icon: "home", label: "Bien créé", who: "Luc Bosson", agency: "Bosson & Filles", target: "Attique 4.5 pces · Nyon", when: "il y a 11 min" },
    { id: "e3", cat: "kyc", icon: "shield", label: "KYC validé", who: "Nadia Overney", agency: "Régie Lacustre", target: "Sophie Marchand", when: "il y a 26 min" },
    { id: "e4", cat: "contacts", icon: "users", label: "Contact créé", who: "Jean-Marc Praz", agency: "Lémanic Property", target: "Olivier Dufour", when: "il y a 34 min" },
    { id: "e5", cat: "emails", icon: "mail", label: "Email envoyé", who: "MEGGA AI", agency: "Alpes & Rives", target: "Relance visite · 4 destinataires", when: "il y a 48 min" },
    { id: "e6", cat: "properties", icon: "home", label: "Bien modifié", who: "Claire Bosson", agency: "Bosson & Filles", target: "Prix CHF 1'450'000 → CHF 1'390'000", when: "il y a 1 h" },
    { id: "e7", cat: "pipeline", icon: "pipeline", label: "Transaction créée", who: "Luc Bosson", agency: "Bosson & Filles", target: "Compromis · Villa Rive-Est", when: "il y a 1 h" },
    { id: "e8", cat: "errors", icon: "alert", label: "Erreur système", who: "—", agency: "Plateforme", target: "realadvisor-sync · HTTP 504", when: "il y a 52 min" },
    { id: "e9", cat: "kyc", icon: "shield", label: "Dossier KYC créé", who: "Aline Wyss", agency: "Cantonale Habitat", target: "Helvetia Holding SA", when: "il y a 2 h" },
    { id: "e10", cat: "contacts", icon: "users", label: "Contact modifié", who: "Jean-Marc Praz", agency: "Lémanic Property", target: "Critères de recherche · budget", when: "il y a 2 h" },
    { id: "e11", cat: "emails", icon: "mail", label: "Email envoyé", who: "Aline Wyss", agency: "Cantonale Habitat", target: "Sélection de 6 biens", when: "il y a 3 h" },
    { id: "e12", cat: "properties", icon: "home", label: "Bien créé", who: "Nadia Overney", agency: "Régie Lacustre", target: "Loft 3.5 pces · Carouge", when: "il y a 4 h" },
  ];

  // ═══ LIVE — journal d'exploitation (concept D) ══════════════════════════
  // Types = couleurs fonctionnelles MEGGA, pilule pleine + texte blanc.
  const ADMIN_LIVE_TYPES = {
    Pipeline: "warn", KYC: "ok", Match: "cyan", Visite: "cyan", Erreur: "err",
    Agence: "info", Abonnement: "warn", Bien: null, Contact: null, Email: null, Document: null,
  };

  const ADMIN_LIVE_STATS = { day: 1284, hour: 96, actions: 12, agencies: 11, clock: "14:12" };

  const ADMIN_LIVE_CATS = [
    { id: "all", label: "Tous", count: 1284 },
    { id: "contacts", label: "Contacts", count: 214 },
    { id: "properties", label: "Biens", count: 308 },
    { id: "pipeline", label: "Pipeline", count: 176 },
    { id: "kyc", label: "KYC", count: 42 },
    { id: "emails", label: "Emails", count: 395 },
    { id: "visits", label: "Visites", count: 88 },
    { id: "matching", label: "Matchs", count: 55 },
    { id: "errors", label: "Erreurs", count: 6 },
  ];

  const ADMIN_LIVE = [
    { id: "l1", t: "14:12", cat: "pipeline", action: "Étape pipeline changée", type: "Pipeline", detail: "Chemin de Beau-Site 12 → Offre", agency: "Régie Lacustre", who: "Nadia Overney" },
    { id: "l2", t: "14:09", cat: "properties", action: "Bien créé", type: "Bien", detail: "Attique 4.5 pces · Nyon", agency: "Bosson & Filles", who: "Luc Bosson" },
    { id: "l3", t: "14:04", cat: "emails", action: "Email envoyé", type: "Email", detail: "Relance visite · 4 destinataires", agency: "Alpes & Rives", who: "MEGGA AI" },
    { id: "l4", t: "13:58", cat: "kyc", action: "KYC validé", type: "KYC", detail: "Sophie Marchand", agency: "Régie Lacustre", who: "Nadia Overney" },
    { id: "l5", t: "13:47", cat: "contacts", action: "Contact créé", type: "Contact", detail: "Olivier Dufour", agency: "Lémanic Property", who: "Jean-Marc Praz" },
    { id: "l6", t: "13:41", cat: "properties", action: "Prix modifié", type: "Bien", detail: "CHF 1'450'000 → CHF 1'390'000", agency: "Bosson & Filles", who: "Claire Bosson" },
    { id: "l7", t: "13:35", cat: "matching", action: "Dossier transmis", type: "Match", detail: "6 biens · Helvetia Holding SA", agency: "Cantonale Habitat", who: "Aline Wyss" },
    { id: "l8", t: "13:20", cat: "errors", action: "Erreur système", type: "Erreur", detail: "realadvisor-sync · HTTP 504", agency: "Plateforme", who: "—" },
    { id: "l9", t: "13:12", cat: "visits", action: "Visite planifiée", type: "Visite", detail: "Villa Rive-Est · 31.07 à 10:00", agency: "Rive Droite Estates", who: "Marc Dubois" },
    { id: "l10", t: "12:58", cat: "properties", action: "Document généré", type: "Document", detail: "Bon de visite · Beau-Site 12", agency: "Régie Lacustre", who: "Nadia Overney" },
    { id: "l11", t: "12:44", cat: "pipeline", action: "Transaction créée", type: "Pipeline", detail: "Compromis · Villa Rive-Est", agency: "Bosson & Filles", who: "Luc Bosson" },
    { id: "l12", t: "12:30", cat: "contacts", action: "Contact modifié", type: "Contact", detail: "Critères de recherche · budget", agency: "Lémanic Property", who: "Jean-Marc Praz" },
    { id: "l13", t: "12:22", cat: "matching", action: "Bien liké", type: "Match", detail: "Loft 3.5 pces · Carouge", agency: "Régie Lacustre", who: "Sophie Marchand" },
    { id: "l14", t: "12:15", cat: "emails", action: "Email envoyé", type: "Email", detail: "Sélection de 6 biens", agency: "Cantonale Habitat", who: "Aline Wyss" },
    { id: "l15", t: "12:07", cat: "kyc", action: "Dossier KYC créé", type: "KYC", detail: "Helvetia Holding SA", agency: "Cantonale Habitat", who: "Aline Wyss" },
    { id: "l16", t: "11:56", cat: "properties", action: "Photos publiées", type: "Bien", detail: "12 photos C2PA · Villa Rive-Est", agency: "Rive Droite Estates", who: "Marc Dubois" },
    { id: "l17", t: "11:48", cat: "pipeline", action: "Étape pipeline changée", type: "Pipeline", detail: "Attique Nyon → Visites", agency: "Bosson & Filles", who: "Claire Bosson" },
    { id: "l18", t: "11:41", cat: "visits", action: "Visite confirmée", type: "Visite", detail: "Loft Carouge · 29.07 à 17:30", agency: "Régie Lacustre", who: "Nadia Overney" },
    { id: "l19", t: "11:33", cat: "contacts", action: "Contact créé", type: "Contact", detail: "Isabelle Pittet · lead vendeur", agency: "Lémanic Property", who: "Jean-Marc Praz" },
    { id: "l20", t: "11:26", cat: "errors", action: "Cron en retard", type: "Erreur", detail: "diffusion-immobilier · +38 min", agency: "Plateforme", who: "—" },
    { id: "l21", t: "11:19", cat: "properties", action: "Annonce publiée", type: "Bien", detail: "Immobilier.ch · Attique Nyon", agency: "Bosson & Filles", who: "Luc Bosson" },
    { id: "l22", t: "11:08", cat: "emails", action: "Email envoyé", type: "Email", detail: "Compte rendu de visite", agency: "Alpes & Rives", who: "Sandra Meylan" },
    { id: "l23", t: "10:57", cat: "pipeline", action: "Offre reçue", type: "Pipeline", detail: "CHF 1'340'000 · Villa Rive-Est", agency: "Rive Droite Estates", who: "Marc Dubois" },
    { id: "l24", t: "10:44", cat: "kyc", action: "Documents déposés", type: "KYC", detail: "Passeport + justificatif · O. Dufour", agency: "Lémanic Property", who: "Olivier Dufour" },
    { id: "l25", t: "10:31", cat: "contacts", action: "Contact modifié", type: "Contact", detail: "Téléphone · canal WhatsApp", agency: "Cantonale Habitat", who: "Aline Wyss" },
    { id: "l26", t: "10:18", cat: "matching", action: "Dossier transmis", type: "Match", detail: "4 biens · Julien Favre", agency: "Bosson & Filles", who: "Claire Bosson" },
    { id: "l27", t: "10:05", cat: "properties", action: "Bien retiré", type: "Bien", detail: "Duplex Ouchy · mandat échu", agency: "Lémanic Property", who: "Jean-Marc Praz" },
    { id: "l28", t: "09:52", cat: "pipeline", action: "Mandat signé", type: "Pipeline", detail: "Grangier Immobilier · Morges", agency: "Grangier Immobilier", who: "Paul Grangier" },
  ];

  // Réserve d'événements injectés tant que le flux n'est pas en pause
  const ADMIN_LIVE_POOL = [
    { cat: "emails", action: "Email envoyé", type: "Email", detail: "Relance mandat · 2 destinataires", agency: "Régie Lacustre", who: "MEGGA AI" },
    { cat: "contacts", action: "Contact créé", type: "Contact", detail: "Nathalie Borel", agency: "Alpes & Rives", who: "Sandra Meylan" },
    { cat: "properties", action: "Prix modifié", type: "Bien", detail: "CHF 890'000 → CHF 865'000", agency: "Lémanic Property", who: "Jean-Marc Praz" },
    { cat: "matching", action: "Bien liké", type: "Match", detail: "Villa 5.5 pces · Pully", agency: "Cantonale Habitat", who: "Helvetia Holding SA" },
    { cat: "pipeline", action: "Étape pipeline changée", type: "Pipeline", detail: "Loft Carouge → Préparation", agency: "Régie Lacustre", who: "Nadia Overney" },
    { cat: "visits", action: "Visite planifiée", type: "Visite", detail: "Attique Nyon · 30.07 à 14:00", agency: "Bosson & Filles", who: "Luc Bosson" },
    { cat: "kyc", action: "Parcours KYC envoyé", type: "KYC", detail: "Roger Aeschlimann · autonome", agency: "Bosson & Filles", who: "Claire Bosson" },
    { cat: "properties", action: "Bien créé", type: "Bien", detail: "Maison 6.5 pces · Gland", agency: "Rive Droite Estates", who: "Marc Dubois" },
  ];

  const ADMIN_ACTIVITY_FILTERS = [
    { id: "all", label: "Tous" },
    { id: "contacts", label: "Contacts" },
    { id: "properties", label: "Biens" },
    { id: "pipeline", label: "Pipeline" },
    { id: "kyc", label: "KYC" },
    { id: "emails", label: "Emails" },
    { id: "errors", label: "Erreurs" },
  ];

  // Activation des agences — 6 jalons (inscrit → contact → bien → KYC → transaction → match)
  const ADMIN_ONBOARDING_STEPS = ["Inscrit", "Contact", "Bien", "KYC", "Transaction", "Match"];
  const ADMIN_ONBOARDING = [
    { id: "o1", agency: "Grangier Immobilier", city: "Morges", done: 2, status: "atRisk", last: "il y a 5 h" },
    { id: "o2", agency: "Aare Wohnen", city: "Berne", done: 1, status: "dormant", last: "il y a 9 jours" },
    { id: "o3", agency: "Rive Droite Estates", city: "Genève", done: 5, status: "active", last: "il y a 20 min" },
    { id: "o4", agency: "Cantonale Habitat", city: "Fribourg", done: 6, status: "active", last: "il y a 2 h" },
    { id: "o5", agency: "Vallée Verte Immobilier", city: "Sion", done: 3, status: "dormant", last: "il y a 12 jours" },
    { id: "o6", agency: "Lémanic Property", city: "Lausanne", done: 6, status: "active", last: "il y a 34 min" },
  ];

  const ADMIN_BILLING = {
    mrr: 47880, revenue30d: 52140, subscriptions: 38, arpu: 1260, churn: 1.8, failed: 2,
    mrrTrend: [41200, 41800, 42400, 42100, 43600, 44050, 44300, 45100, 45400, 45200, 46100, 46800, 47100, 47880],
    plans: [
      { plan: "Starter", count: 11, mrr: 4290 },
      { plan: "Pro", count: 19, mrr: 22610 },
      { plan: "Agency", count: 7, mrr: 16380 },
      { plan: "Entreprise", count: 1, mrr: 4600 },
    ],
    renewals: [
      { agency: "Régie Lacustre", plan: "Agency", amount: 2340, when: "29 juil." },
      { agency: "Bosson & Filles", plan: "Pro", amount: 1190, when: "1 août" },
      { agency: "Cantonale Habitat", plan: "Pro", amount: 1190, when: "3 août" },
      { agency: "Rive Droite Estates", plan: "Agency", amount: 2340, when: "5 août" },
    ],
  };

  // Santé plateforme (bandeau de la Vue d'ensemble)
  const ADMIN_HEALTH = {
    dbPct: 34, functionsOk: 41, functionsErr: 1, errors24h: 6, requests24h: 128400,
    emailsToday: 312, storagePct: 22, cronsLate: 1,
  };

  // Agences — champs de `useAdminAgencies` (+ score de santé `agencyHealthScore`)
  const ADMIN_AGENCIES = [
    { id: "ag1",  name: "Régie Lacustre", email: "contact@regie-lacustre.ch", city: "Genève", canton: "GE", plan: "Agency", agents: 14, properties: 186, deals: 31, mrr: 2340, status: "active", score: 92, health: "ok", since: "12.03.2025", last: "il y a 20 min" },
    { id: "ag2",  name: "Alpes & Rives Immobilier", email: "info@alpesrives.ch", city: "Vevey", canton: "VD", plan: "Pro", agents: 6, properties: 74, deals: 12, mrr: 1190, status: "active", score: 84, health: "ok", since: "04.06.2025", last: "il y a 1 h" },
    { id: "ag3",  name: "Bosson & Filles", email: "contact@bosson-filles.ch", city: "Nyon", canton: "VD", plan: "Pro", agents: 5, properties: 61, deals: 9, mrr: 1190, status: "active", score: 63, health: "warn", since: "22.09.2025", last: "il y a 11 min" },
    { id: "ag4",  name: "Cantonale Habitat", email: "admin@cantonale-habitat.ch", city: "Fribourg", canton: "FR", plan: "Pro", agents: 8, properties: 96, deals: 17, mrr: 1190, status: "active", score: 88, health: "ok", since: "15.01.2026", last: "il y a 2 h" },
    { id: "ag5",  name: "Rive Droite Estates", email: "office@rivedroite.ch", city: "Genève", canton: "GE", plan: "Agency", agents: 11, properties: 142, deals: 24, mrr: 2340, status: "active", score: 90, health: "ok", since: "28.02.2026", last: "il y a 35 min" },
    { id: "ag6",  name: "Vallée Verte Immobilier", email: "contact@valleeverte.ch", city: "Sion", canton: "VS", plan: "Starter", agents: 2, properties: 18, deals: 2, mrr: 390, status: "suspended", score: 22, health: "err", since: "09.05.2026", sub: "past_due", last: "il y a 12 jours" },
    { id: "ag7",  name: "Grangier Immobilier", email: "marc@grangier-immo.ch", city: "Morges", canton: "VD", plan: "Pro", agents: 3, properties: 7, deals: 0, mrr: 1190, status: "active", score: 41, health: "warn", since: "21.07.2026", sub: "trialing", last: "il y a 5 h" },
    { id: "ag8",  name: "Lémanic Property", email: "hello@lemanic-property.ch", city: "Lausanne", canton: "VD", plan: "Agency", agents: 9, properties: 118, deals: 21, mrr: 2340, status: "active", score: 87, health: "ok", since: "18.11.2025", last: "il y a 34 min" },
    { id: "ag9",  name: "Aare Wohnen", email: "info@aare-wohnen.ch", city: "Berne", canton: "BE", plan: "Starter", agents: 1, properties: 6, deals: 0, mrr: 390, status: "active", score: 18, health: "err", since: "02.07.2026", sub: "trialing", last: "il y a 9 jours" },
    { id: "ag10", name: "Jura Habitat", email: "contact@jurahabitat.ch", city: "Delémont", canton: "JU", plan: "Starter", agents: 2, properties: 21, deals: 3, mrr: 390, status: "active", score: 57, health: "warn", since: "30.04.2026", last: "hier, 16:40" },
    { id: "ag11", name: "Montreux Riviera Immobilier", email: "office@montreux-riviera.ch", city: "Montreux", canton: "VD", plan: "Pro", agents: 7, properties: 88, deals: 14, mrr: 1190, status: "active", score: 81, health: "ok", since: "07.08.2025", last: "il y a 3 h" },
    { id: "ag12", name: "Helvetia Prime SA", email: "admin@helvetiaprime.ch", city: "Zurich", canton: "ZH", plan: "Entreprise", agents: 23, properties: 264, deals: 48, mrr: 4600, status: "active", score: 95, health: "ok", since: "21.01.2025", last: "il y a 8 min" },
    { id: "ag13", name: "Neuchâtel & Lac", email: "contact@neuchatel-lac.ch", city: "Neuchâtel", canton: "NE", plan: "Pro", agents: 4, properties: 43, deals: 6, mrr: 1190, status: "active", score: 74, health: "ok", since: "12.02.2026", last: "il y a 4 h" },
    { id: "ag14", name: "Valais Alpes Immo", email: "info@valais-alpes.ch", city: "Sierre", canton: "VS", plan: "Starter", agents: 2, properties: 15, deals: 1, mrr: 390, status: "suspended", score: 31, health: "err", since: "16.06.2026", last: "il y a 21 jours" },
  ];

  const ADMIN_PLANS = ["Starter", "Pro", "Agency", "Entreprise"];
  const ADMIN_CANTONS = ["AG", "BE", "BS", "FR", "GE", "JU", "NE", "TI", "VD", "VS", "ZG", "ZH"];

  // Comptes auth (profiles) — champs de `useAdminUsers`
  const ADMIN_USERS = [
    { id: "u1",  name: "Yann Rossier", email: "yann@megga.ch", role: "super_admin", agencyId: null, agency: null, phone: "+41 79 412 08 55", since: "04.11.2024", last: "il y a 2 min" },
    { id: "u2",  name: "Nadia Overney", email: "nadia.overney@regie-lacustre.ch", role: "admin", agencyId: "ag1", agency: "Régie Lacustre", phone: "+41 22 316 44 08", since: "12.03.2025", last: "il y a 3 min" },
    { id: "u3",  name: "Karim Berset", email: "k.berset@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", phone: "+41 22 316 44 12", marketing: false, since: "20.03.2025", last: "il y a 20 min" },
    { id: "u4",  name: "Élodie Fournier", email: "e.fournier@regie-lacustre.ch", role: "assistant", agencyId: "ag1", agency: "Régie Lacustre", marketing: false, since: "08.09.2025", last: "12.06.2026", staleDays: 47 },
    { id: "u5",  name: "Luc Bosson", email: "luc@bosson-filles.ch", role: "admin", agencyId: "ag3", agency: "Bosson & Filles", phone: "+41 22 361 77 20", since: "22.09.2025", last: "il y a 11 min" },
    { id: "u6",  name: "Claire Bosson", email: "claire@bosson-filles.ch", role: "agent", agencyId: "ag3", agency: "Bosson & Filles", since: "22.09.2025", last: "21.06.2026", staleDays: 38 },
    { id: "u7",  name: "Jean-Marc Praz", email: "jm.praz@lemanic-property.ch", role: "manager", agencyId: "ag8", agency: "Lémanic Property", phone: "+41 21 544 19 03", since: "18.11.2025", last: "il y a 34 min" },
    { id: "u8",  name: "Sophie Rey", email: "s.rey@lemanic-property.ch", role: "agent", agencyId: "ag8", agency: "Lémanic Property", since: "02.12.2025", last: "hier, 18:05" },
    { id: "u9",  name: "Aline Wyss", email: "a.wyss@cantonale-habitat.ch", role: "admin", agencyId: "ag4", agency: "Cantonale Habitat", phone: "+41 26 305 62 41", since: "15.01.2026", last: "il y a 2 h" },
    { id: "u10", name: "Thomas Girard", email: "t.girard@cantonale-habitat.ch", role: "agent", agencyId: "ag4", agency: "Cantonale Habitat", since: "29.01.2026", suspended: true, last: "il y a 6 jours" },
    { id: "u11", name: "Vera Ilic", email: "v.ilic@rivedroite.ch", role: "manager", agencyId: "ag5", agency: "Rive Droite Estates", phone: "+41 22 700 31 88", since: "28.02.2026", last: "il y a 35 min" },
    { id: "u12", name: "Antoine Delacroix", email: "a.delacroix@rivedroite.ch", role: "agent", agencyId: "ag5", agency: "Rive Droite Estates", since: "10.03.2026", last: "hier, 16:12" },
    { id: "u13", name: "Chloé Meunier", email: "c.meunier@alpesrives.ch", role: "admin", agencyId: "ag2", agency: "Alpes & Rives Immobilier", phone: "+41 21 925 40 17", since: "04.06.2025", last: "il y a 1 h" },
    { id: "u14", name: "Sandra Kunz", email: "s.kunz@helvetiaprime.ch", role: "manager", agencyId: "ag12", agency: "Helvetia Prime SA", phone: "+41 44 218 90 24", since: "21.01.2025", last: "il y a 8 min" },
    { id: "u15", name: "Daniel Frei", email: "d.frei@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "17.02.2025", last: "il y a 25 min" },
    { id: "u16", name: "Camille Perret", email: "c.perret@montreux-riviera.ch", role: "agent", agencyId: "ag11", agency: "Montreux Riviera Immobilier", since: "07.08.2025", last: "il y a 3 h" },
    { id: "u17", name: "Marc Grangier", email: "marc@grangier-immo.ch", role: "admin", agencyId: "ag7", agency: "Grangier Immobilier", phone: "+41 21 802 55 60", since: "21.07.2026", last: "il y a 5 h" },
    { id: "u18", name: "Peter Aebi", email: "p.aebi@aare-wohnen.ch", role: "admin", agencyId: "ag9", agency: "Aare Wohnen", since: "02.07.2026", never: true, invited: "il y a 27 jours" },

    // Équipes complètes (3 agences de référence : ag1 Genève · ag4 Fribourg · ag12 Zurich)
    { id: "u19", name: "Béatrice Cornaz", email: "b.cornaz@regie-lacustre.ch", role: "manager", agencyId: "ag1", agency: "Régie Lacustre", phone: "+41 22 316 44 21", since: "04.04.2025", last: "il y a 12 min" },
    { id: "u20", name: "Olivier Reymond", email: "o.reymond@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "19.04.2025", last: "il y a 41 min" },
    { id: "u21", name: "Naïma Benali", email: "n.benali@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "02.06.2025", last: "hier, 17:48" },
    { id: "u22", name: "Grégoire Aubert", email: "g.aubert@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", phone: "+41 22 316 44 33", since: "14.07.2025", last: "il y a 2 h" },
    { id: "u23", name: "Séverine Jaquet", email: "s.jaquet@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "28.08.2025", last: "il y a 5 h" },
    { id: "u24", name: "Damien Rochat", email: "d.rochat@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "11.10.2025", last: "hier, 09:22" },
    { id: "u25", name: "Laetitia Morand", email: "l.morand@regie-lacustre.ch", role: "assistant", agencyId: "ag1", agency: "Régie Lacustre", since: "03.11.2025", last: "il y a 3 h" },
    { id: "u26", name: "Bruno Salamin", email: "b.salamin@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "16.01.2026", last: "19.06.2026", staleDays: 40 },
    { id: "u27", name: "Marie Chappuis", email: "m.chappuis@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "27.02.2026", last: "il y a 1 h" },
    { id: "u28", name: "Fabio Storelli", email: "f.storelli@regie-lacustre.ch", role: "agent", agencyId: "ag1", agency: "Régie Lacustre", since: "09.04.2026", last: "il y a 26 min" },
    { id: "u29", name: "Anne-Sophie Bovay", email: "as.bovay@regie-lacustre.ch", role: "assistant", agencyId: "ag1", agency: "Régie Lacustre", since: "22.05.2026", last: "hier, 14:05" },
    { id: "u30", name: "Pascal Guillet", email: "p.guillet@cantonale-habitat.ch", role: "manager", agencyId: "ag4", agency: "Cantonale Habitat", phone: "+41 26 305 62 55", since: "15.01.2026", last: "il y a 47 min" },
    { id: "u31", name: "Sarah Baeriswyl", email: "s.baeriswyl@cantonale-habitat.ch", role: "agent", agencyId: "ag4", agency: "Cantonale Habitat", since: "22.01.2026", last: "il y a 1 h" },
    { id: "u32", name: "Nicolas Riedo", email: "n.riedo@cantonale-habitat.ch", role: "agent", agencyId: "ag4", agency: "Cantonale Habitat", since: "06.02.2026", last: "hier, 16:40" },
    { id: "u33", name: "Emilie Progin", email: "e.progin@cantonale-habitat.ch", role: "agent", agencyId: "ag4", agency: "Cantonale Habitat", since: "24.03.2026", last: "il y a 4 h" },
    { id: "u34", name: "Yves Deillon", email: "y.deillon@cantonale-habitat.ch", role: "agent", agencyId: "ag4", agency: "Cantonale Habitat", since: "12.05.2026", last: "il y a 2 h" },
    { id: "u35", name: "Nathalie Bulliard", email: "n.bulliard@cantonale-habitat.ch", role: "assistant", agencyId: "ag4", agency: "Cantonale Habitat", since: "28.06.2026", last: "il y a 25 min" },
    { id: "u36", name: "Andreas Zollinger", email: "a.zollinger@helvetiaprime.ch", role: "admin", agencyId: "ag12", agency: "Helvetia Prime SA", phone: "+41 44 218 90 11", since: "21.01.2025", last: "il y a 6 min" },
    { id: "u37", name: "Beatrice Hauser", email: "b.hauser@helvetiaprime.ch", role: "manager", agencyId: "ag12", agency: "Helvetia Prime SA", phone: "+41 44 218 90 14", since: "28.01.2025", last: "il y a 19 min" },
    { id: "u38", name: "Simon Brunner", email: "s.brunner@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "04.02.2025", last: "il y a 33 min" },
    { id: "u39", name: "Nadine Steiger", email: "n.steiger@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "11.02.2025", last: "il y a 52 min" },
    { id: "u40", name: "Lukas Egger", email: "l.egger@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "25.02.2025", last: "il y a 1 h" },
    { id: "u41", name: "Corinne Baumgartner", email: "c.baumgartner@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "18.03.2025", last: "il y a 2 h" },
    { id: "u42", name: "Reto Bachmann", email: "r.bachmann@helvetiaprime.ch", role: "manager", agencyId: "ag12", agency: "Helvetia Prime SA", phone: "+41 44 218 90 27", since: "08.04.2025", last: "il y a 2 h" },
    { id: "u43", name: "Fabienne Wenger", email: "f.wenger@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "29.04.2025", last: "il y a 3 h" },
    { id: "u44", name: "Marco Schaufelberger", email: "m.schaufelberger@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "20.05.2025", last: "hier, 18:32" },
    { id: "u45", name: "Jana Widmer", email: "j.widmer@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "10.06.2025", last: "hier, 15:10" },
    { id: "u46", name: "Philippe Odermatt", email: "p.odermatt@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "01.07.2025", last: "il y a 4 h" },
    { id: "u47", name: "Silvia Meili", email: "s.meili@helvetiaprime.ch", role: "assistant", agencyId: "ag12", agency: "Helvetia Prime SA", since: "19.08.2025", last: "il y a 1 h" },
    { id: "u48", name: "Tobias Kern", email: "t.kern@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "09.09.2025", last: "24.06.2026", staleDays: 35 },
    { id: "u49", name: "Alina Furrer", email: "a.furrer@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "30.09.2025", last: "il y a 5 h" },
    { id: "u50", name: "Christoph Rüegg", email: "c.rueegg@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "21.10.2025", last: "hier, 11:47" },
    { id: "u51", name: "Miriam Studer", email: "m.studer@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "11.11.2025", last: "il y a 38 min" },
    { id: "u52", name: "David Hofmann", email: "d.hofmann@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "02.12.2025", last: "il y a 3 h" },
    { id: "u53", name: "Céline Baur", email: "c.baur@helvetiaprime.ch", role: "assistant", agencyId: "ag12", agency: "Helvetia Prime SA", since: "13.01.2026", last: "hier, 09:05" },
    { id: "u54", name: "Patrick Suter", email: "p.suter@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "24.02.2026", suspended: true, last: "il y a 9 jours" },
    { id: "u55", name: "Ramona Gerber", email: "r.gerber@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "07.04.2026", last: "il y a 15 min" },
    { id: "u56", name: "Nicolas Brügger", email: "n.bruegger@helvetiaprime.ch", role: "agent", agencyId: "ag12", agency: "Helvetia Prime SA", since: "18.06.2026", never: true, invited: "il y a 12 jours" },
  ];

  // Activité récente par compte (timeline du drawer) — défaut si non listé
  const ADMIN_USER_ACTIVITY = {
    u2: [
      { id: "ua1", action: "Étape pipeline changée", entity: "Deal · Chemin de Beau-Site 12", when: "il y a 3 min" },
      { id: "ua2", action: "KYC validé", entity: "Contact · Sophie Marchand", when: "il y a 26 min" },
      { id: "ua3", action: "Bien créé", entity: "Loft 3.5 pces · Carouge", when: "il y a 4 h" },
      { id: "ua4", action: "Connexion", entity: null, when: "aujourd'hui, 07:52" },
      { id: "ua9", action: "Sélection transmise", entity: "Contact · Fam. Perrin — 4 biens", when: "hier, 17:40" },
      { id: "ua10", action: "Document déposé", entity: "Mandat signé · Villa Cologny", when: "hier, 15:02" },
      { id: "ua11", action: "Membre invité", entity: "e.fournier@regie-lacustre.ch", when: "hier, 11:18" },
      { id: "ua12", action: "Visite planifiée", entity: "Contact · L. Meier", when: "hier, 09:34" },
      { id: "ua13", action: "Connexion", entity: null, when: "hier, 08:05" },
      { id: "ua14", action: "Annonce publiée", entity: "Immobilier.ch · Route de Berne 4", when: "27.07.2026, 16:20" },
      { id: "ua15", action: "Prix modifié", entity: "Villa Cologny — CHF 2'950'000", when: "27.07.2026, 10:11" },
    ],
    u10: [
      { id: "ua5", action: "Compte suspendu par un super-admin", entity: null, when: "il y a 6 jours" },
      { id: "ua6", action: "Connexion refusée", entity: null, when: "il y a 6 jours" },
    ],
    u1: [
      { id: "ua7", action: "Entrée dans la console admin", entity: "Audit · admin_console_entry", when: "il y a 2 min" },
      { id: "ua8", action: "Plan modifié manuellement", entity: "Agence · Helvetia Prime SA", when: "hier, 15:10" },
    ],
    _default: [
      { id: "ud1", action: "Connexion", entity: null, when: "hier, 09:14" },
      { id: "ud2", action: "Contact modifié", entity: "Critères de recherche", when: "il y a 2 jours" },
      { id: "ud3", action: "Visite planifiée", entity: "Contact · A. Bovet", when: "il y a 3 jours" },
      { id: "ud4", action: "Document déposé", entity: "Bon de visite", when: "il y a 4 jours" },
      { id: "ud5", action: "Connexion", entity: null, when: "il y a 5 jours" },
      { id: "ud6", action: "Étape pipeline changée", entity: "Deal · Appt. Eaux-Vives", when: "il y a 6 jours" },
      { id: "ud7", action: "Connexion", entity: null, when: "il y a 8 jours" },
    ],
  };

  // Tunnel des liens KYC publics — AGRÉGAT SEUL (santé du lien magique, pas
  // de la conformité : celle-ci appartient à l'agence). Affiché en pied de
  // Vue d'ensemble ; aucune page ne parcourt les clients finaux.
  const ADMIN_KYC_FUNNEL = {
    sent30d: 96, opened: 78, uploaded: 61, confirmed: 52, conversion: 54,
  };

  // Liens KYC — jamais listés : uniquement RÉSOLUS par recherche exacte
  // depuis Support, quand une agence signale un lien non reçu (RPC
  // `admin_kyc_link_lookup`, ni jeton ni IP dans la réponse).
  const ADMIN_KYC_LINKS = [
    { id: "k1", contact: "Sophie Marchand", email: "s.marchand@bluewin.ch", phone: "+41 79 412 08 51", agency: "Régie Lacustre", status: "submitted", mode: "Autonome", when: "il y a 2 h" },
    { id: "k2", contact: "Helvetia Holding SA", email: "admin@helvetia-holding.ch", phone: "+41 22 731 44 10", agency: "Cantonale Habitat", status: "verifying", mode: "Assisté", when: "il y a 5 h" },
    { id: "k3", contact: "Olivier Dufour", email: "olivier.dufour@gmail.com", phone: "+41 78 220 91 06", agency: "Lémanic Property", status: "uploading", mode: "Autonome", when: "hier, 14:20" },
    { id: "k4", contact: "Anaïs Berisha", email: "anais.berisha@proton.me", phone: "+41 76 508 33 27", agency: "Régie Lacustre", status: "opened", mode: "Autonome", when: "hier, 09:05" },
    { id: "k5", contact: "Frédéric Nussbaum", email: "f.nussbaum@sunrise.ch", phone: "+41 79 655 12 84", agency: "Rive Droite Estates", status: "pending", mode: "Assisté", when: "il y a 2 jours" },
    { id: "k6", contact: "Martine Chappuis", email: "m.chappuis@bluewin.ch", phone: "+41 79 301 77 45", agency: "Alpes & Rives Immobilier", status: "submitted", mode: "Assisté", when: "il y a 3 jours" },
    { id: "k7", contact: "Immo Riviera Sàrl", email: "contact@immo-riviera.ch", phone: "+41 21 963 08 22", agency: "Montreux Riviera Immobilier", status: "expired", mode: "Autonome", when: "il y a 9 jours" },
    { id: "k8", contact: "Beat Zimmermann", email: "b.zimmermann@swissonline.ch", phone: "+41 79 118 62 03", agency: "Helvetia Prime SA", status: "submitted", mode: "Autonome", when: "il y a 4 jours" },
    { id: "k9", contact: "Laure Chevalley", email: "laure.chevalley@gmail.com", phone: "+41 78 447 25 90", agency: "Bosson & Filles", status: "opened", mode: "Assisté", when: "il y a 6 jours" },
    { id: "k10", contact: "Pascal Roulin", email: "p.roulin@netplus.ch", phone: "+41 79 833 51 17", agency: "Neuchâtel & Lac", status: "pending", mode: "Autonome", when: "il y a 7 jours" },
  ];

  // Cohérence : les agrégats de la Vue d'ensemble dérivent des tables ci-dessus
  const activeAg = ADMIN_AGENCIES.filter((a) => a.status === "active");
  ADMIN_KPIS.activeAgencies = ADMIN_AGENCIES.length;
  ADMIN_KPIS.totalUsers = ADMIN_USERS.length;
  ADMIN_KPIS.activeProperties = ADMIN_AGENCIES.reduce((s, a) => s + a.properties, 0);
  ADMIN_KPIS.activeTransactions = ADMIN_AGENCIES.reduce((s, a) => s + a.deals, 0);
  const mrrNow = activeAg.reduce((s, a) => s + a.mrr, 0);
  ADMIN_BILLING.mrrTrend = ADMIN_BILLING.mrrTrend.map((v) => Math.round((v / 47880) * mrrNow));
  ADMIN_BILLING.mrr = mrrNow;
  ADMIN_BILLING.revenue30d = Math.round(mrrNow * 1.09);
  ADMIN_BILLING.subscriptions = activeAg.length;
  ADMIN_BILLING.arpu = Math.round(mrrNow / activeAg.length);
  ADMIN_BILLING.plans = ["Starter", "Pro", "Agency", "Entreprise"].map((plan) => {
    const list = activeAg.filter((a) => a.plan === plan);
    return { plan, count: list.length, mrr: list.reduce((s, a) => s + a.mrr, 0) };
  });

  Object.assign(window, {
    ADMIN_KPIS, ADMIN_ALERTS, ADMIN_ACTIVITY, ADMIN_ACTIVITY_FILTERS,
    ADMIN_LIVE, ADMIN_LIVE_POOL, ADMIN_LIVE_CATS, ADMIN_LIVE_TYPES, ADMIN_LIVE_STATS,
    ADMIN_ONBOARDING, ADMIN_ONBOARDING_STEPS, ADMIN_BILLING, ADMIN_HEALTH, ADMIN_AGENCIES,
    ADMIN_PLANS, ADMIN_CANTONS, ADMIN_USERS, ADMIN_USER_ACTIVITY,
    ADMIN_KYC_FUNNEL, ADMIN_KYC_LINKS,
  });
})();
