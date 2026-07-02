// MEGGA CRM — Parcours module data
// Équipe MEGGA fictive + 5 dossiers immobiliers actifs avec workflow par étapes.
// Pensé réutilisable pour le futur module Réseau d'agences (mêmes primitives).

// ─── Équipe MEGGA ─────────────────────────────────────────────────────
// 7 membres pour démo — couleurs cohérentes avec le design system Sugar Pure.
const PARCOURS_TEAM = [
  { id:"t-greg",    firstName:"Grégory", lastName:"Lyonnet",  initials:"GR", role:"Directeur",            avatarBg:"#0B0C0E" },
  { id:"t-sophie",  firstName:"Sophie",  lastName:"Martin",   initials:"SO", role:"Courtière senior",     avatarBg:"#1E5BC6" },
  { id:"t-marc",    firstName:"Marc",    lastName:"Dubois",   initials:"MA", role:"Courtier",             avatarBg:"#0891B2" },
  { id:"t-lea",     firstName:"Léa",     lastName:"Berger",   initials:"LE", role:"Assistante admin.",    avatarBg:"#C45A00" },
  { id:"t-antoine", firstName:"Antoine", lastName:"Picard",   initials:"AN", role:"Photographe / Visites",avatarBg:"#059669" },
  { id:"t-camille", firstName:"Camille", lastName:"Roy",      initials:"CA", role:"Marketing",            avatarBg:"#7C3AED" },
  { id:"t-julien",  firstName:"Julien",  lastName:"Schmidt",  initials:"JU", role:"KYC / Conformité",     avatarBg:"#374151" },
];

const parcoursAgentById = (id) => PARCOURS_TEAM.find(a => a.id === id);

// ─── Étapes immobilières ──────────────────────────────────────────────
// 4 colonnes du workflow MEGGA (cohérent avec CRM_STAGES mais simplifié).
const PARCOURS_STAGES = [
  { id:"mandat",   label:"Réception mandat", color:"#1E5BC6" },
  { id:"market",   label:"Mise en marché",   color:"#0891B2" },
  { id:"nego",     label:"Négociation",      color:"#C45A00" },
  { id:"closing",  label:"Closing",          color:"#059669" },
];

// ─── Dossiers actifs ──────────────────────────────────────────────────
// Chaque dossier = 1 bento avec colonnes de tâches.
// `active` = id de la tâche en cours (carte noire mise en avant).
// Connecteurs : la 1ère colonne lie ses cartes en pointillé vertical;
// les colonnes 2/3/4 reçoivent une dépendance horizontale depuis la précédente.
const PARCOURS_DOSSIERS = [
  {
    id:"d-champel",
    title:"Champel — Müller",
    subtitle:"4.5 p · 156 m² · CHF 2'650'000",
    urgency:"high",            // 🔴 Haute
    stageActive:"nego",        // colonne courante
    activeTaskId:"t-cm-3",     // la tâche en noir
    team:[
      { agentId:"t-greg",    count:3, badgeColor:"#E53935" },
      { agentId:"t-sophie",  count:5, badgeColor:"#1E5BC6" },
      { agentId:"t-antoine", count:2, badgeColor:"#059669" },
      { agentId:"t-camille", count:1, badgeColor:"#C45A00" },
      { agentId:"t-julien",  count:1, badgeColor:"#7C3AED" },
    ],
    columns:{
      mandat:[
        { id:"t-cm-1", agentId:"t-greg",    label:"Mandat exclusif signé",   sub:"15 mars 2026", state:"done",    big:true },
        { id:"t-cm-2", agentId:"t-lea",     label:"Briefer le propriétaire", sub:"Premier RDV",  state:"done",    big:true },
      ],
      market:[
        { id:"t-mk-1", agentId:"t-antoine", label:"Photos HD",       sub:"Shooting fait",   state:"done" },
        { id:"t-mk-2", agentId:"t-camille", label:"Annonce diffusée",sub:"4 portails",      state:"done" },
        { id:"t-mk-3", agentId:"t-sophie",  label:"Visites planifiées",                     state:"done" },
        { id:"t-mk-4", agentId:"t-greg",    label:"Premiers retours acquéreurs",            state:"done" },
      ],
      nego:[
        { id:"t-ng-1", agentId:"t-sophie",  label:"Offre Müller reçue",      sub:"CHF 2'520'000", state:"done" },
        { id:"t-ng-2", agentId:"t-greg",    label:"Contre-proposition envoyée",                  state:"done" },
        { id:"t-cm-3", agentId:"t-greg",    label:"Négocier offre acquéreur",sub:"Cursor ici",    state:"active", big:true },
        { id:"t-ng-3", agentId:"t-sophie",  label:"Choix final acquéreur",                       state:"todo" },
      ],
      closing:[
        { id:"t-cl-1", agentId:"t-julien",  label:"KYC acquéreur", state:"todo", grid:true },
        { id:"t-cl-2", agentId:"t-lea",     label:"Compromis",     state:"todo", grid:true },
        { id:"t-cl-3", agentId:"t-julien",  label:"LBA / origine fonds", state:"todo", grid:true },
        { id:"t-cl-4", agentId:"t-greg",    label:"Acte notarié",  state:"todo", grid:true },
      ],
    },
  },
  {
    id:"d-carouge",
    title:"Carouge — Martinez",
    subtitle:"3.5 p · 92 m² · CHF 1'380'000",
    urgency:"medium",
    stageActive:"market",
    activeTaskId:"t-ca-mk-3",
    team:[
      { agentId:"t-marc",    count:4, badgeColor:"#0891B2" },
      { agentId:"t-antoine", count:2, badgeColor:"#059669" },
      { agentId:"t-camille", count:3, badgeColor:"#C45A00" },
      { agentId:"t-lea",     count:1, badgeColor:"#7C3AED" },
    ],
    columns:{
      mandat:[
        { id:"t-ca-md-1", agentId:"t-marc", label:"Mandat signé",  sub:"22 mars 2026", state:"done", big:true },
        { id:"t-ca-md-2", agentId:"t-lea",  label:"Fixation prix", sub:"Avis estimation", state:"done", big:true },
      ],
      market:[
        { id:"t-ca-mk-1", agentId:"t-antoine", label:"Photos & visite virtuelle",    state:"done" },
        { id:"t-ca-mk-2", agentId:"t-camille", label:"Annonce premium",   sub:"Homegate, Immo24", state:"done" },
        { id:"t-ca-mk-3", agentId:"t-marc",    label:"Visite groupée samedi",   sub:"6 candidats", state:"active", big:true },
        { id:"t-ca-mk-4", agentId:"t-camille", label:"Relance qualifiés",                          state:"todo" },
      ],
      nego:[
        { id:"t-ca-ng-1", agentId:"t-marc", label:"Recevoir offres", state:"todo" },
        { id:"t-ca-ng-2", agentId:"t-marc", label:"Comparer dossiers",  state:"todo" },
        { id:"t-ca-ng-3", agentId:"t-marc", label:"Validation propriétaire", state:"todo" },
      ],
      closing:[
        { id:"t-ca-cl-1", agentId:"t-julien", label:"KYC",          state:"todo", grid:true },
        { id:"t-ca-cl-2", agentId:"t-lea",    label:"Compromis",    state:"todo", grid:true },
        { id:"t-ca-cl-3", agentId:"t-julien", label:"LBA",          state:"todo", grid:true },
        { id:"t-ca-cl-4", agentId:"t-marc",   label:"Acte",         state:"todo", grid:true },
      ],
    },
  },
  {
    id:"d-florissant",
    title:"Florissant — Dubois",
    subtitle:"5.5 p · 198 m² · CHF 3'950'000",
    urgency:"low",
    stageActive:"closing",
    activeTaskId:"t-fl-cl-2",
    team:[
      { agentId:"t-greg",   count:2, badgeColor:"#0E9F6E" },
      { agentId:"t-julien", count:3, badgeColor:"#7C3AED" },
      { agentId:"t-lea",    count:2, badgeColor:"#1E5BC6" },
    ],
    columns:{
      mandat:[
        { id:"t-fl-md-1", agentId:"t-greg", label:"Mandat exclusif",     sub:"4 fév. 2026",   state:"done", big:true },
        { id:"t-fl-md-2", agentId:"t-lea",  label:"Briefing & pricing",  sub:"Validé",        state:"done", big:true },
      ],
      market:[
        { id:"t-fl-mk-1", agentId:"t-antoine", label:"Photos HD",     state:"done" },
        { id:"t-fl-mk-2", agentId:"t-camille", label:"Diffusion off-market", state:"done" },
        { id:"t-fl-mk-3", agentId:"t-greg",    label:"5 visites privées", state:"done" },
      ],
      nego:[
        { id:"t-fl-ng-1", agentId:"t-greg", label:"Offre acceptée",    sub:"CHF 3'820'000", state:"done" },
        { id:"t-fl-ng-2", agentId:"t-greg", label:"Acquéreur validé",                       state:"done" },
      ],
      closing:[
        { id:"t-fl-cl-1", agentId:"t-julien", label:"KYC vérifié",  state:"done", grid:true },
        { id:"t-fl-cl-2", agentId:"t-julien", label:"Origine fonds — relance", sub:"Cursor", state:"active", grid:true },
        { id:"t-fl-cl-3", agentId:"t-lea",    label:"Compromis",    state:"todo", grid:true },
        { id:"t-fl-cl-4", agentId:"t-greg",   label:"Notaire — 12 mai",  state:"todo", grid:true },
      ],
    },
  },
  {
    id:"d-eauxvives",
    title:"Eaux-Vives — Lambert",
    subtitle:"4 p · 118 m² · CHF 1'890'000",
    urgency:"medium",
    stageActive:"mandat",
    activeTaskId:"t-ev-md-2",
    team:[
      { agentId:"t-sophie", count:3, badgeColor:"#1E5BC6" },
      { agentId:"t-lea",    count:2, badgeColor:"#C45A00" },
    ],
    columns:{
      mandat:[
        { id:"t-ev-md-1", agentId:"t-sophie", label:"Premier RDV propriétaire", sub:"Fait", state:"done", big:true },
        { id:"t-ev-md-2", agentId:"t-sophie", label:"Signer le mandat exclusif", sub:"Cursor ici", state:"active", big:true },
        { id:"t-ev-md-3", agentId:"t-lea",    label:"Photos d'estimation",                          state:"todo", big:true },
      ],
      market:[
        { id:"t-ev-mk-1", agentId:"t-antoine", label:"Shooting pro",  state:"todo" },
        { id:"t-ev-mk-2", agentId:"t-camille", label:"Rédaction annonce", state:"todo" },
        { id:"t-ev-mk-3", agentId:"t-sophie",  label:"Mise en ligne",     state:"todo" },
      ],
      nego:[
        { id:"t-ev-ng-1", agentId:"t-sophie", label:"Recevoir offres",  state:"todo" },
        { id:"t-ev-ng-2", agentId:"t-sophie", label:"Choix acquéreur",  state:"todo" },
      ],
      closing:[
        { id:"t-ev-cl-1", agentId:"t-julien", label:"KYC",       state:"todo", grid:true },
        { id:"t-ev-cl-2", agentId:"t-lea",    label:"Compromis", state:"todo", grid:true },
        { id:"t-ev-cl-3", agentId:"t-julien", label:"LBA",       state:"todo", grid:true },
        { id:"t-ev-cl-4", agentId:"t-sophie", label:"Acte",      state:"todo", grid:true },
      ],
    },
  },
  {
    id:"d-plainpalais",
    title:"Plainpalais — Roy",
    subtitle:"2.5 p · 68 m² · CHF 890'000",
    urgency:"high",
    stageActive:"market",
    activeTaskId:"t-pp-mk-2",
    team:[
      { agentId:"t-marc",    count:2, badgeColor:"#E53935" },
      { agentId:"t-camille", count:3, badgeColor:"#C45A00" },
      { agentId:"t-antoine", count:1, badgeColor:"#059669" },
    ],
    columns:{
      mandat:[
        { id:"t-pp-md-1", agentId:"t-marc",    label:"Mandat signé", sub:"10 avr. 2026", state:"done", big:true },
        { id:"t-pp-md-2", agentId:"t-lea",     label:"Briefing prix",                    state:"done", big:true },
      ],
      market:[
        { id:"t-pp-mk-1", agentId:"t-antoine", label:"Photos faites",    state:"done" },
        { id:"t-pp-mk-2", agentId:"t-camille", label:"Booster annonce — urgent",  sub:"Cursor",  state:"active", big:true },
        { id:"t-pp-mk-3", agentId:"t-marc",    label:"3 visites cette semaine", state:"todo" },
        { id:"t-pp-mk-4", agentId:"t-camille", label:"Reportage Insta",         state:"todo" },
      ],
      nego:[
        { id:"t-pp-ng-1", agentId:"t-marc", label:"Premières offres",    state:"todo" },
        { id:"t-pp-ng-2", agentId:"t-marc", label:"Négocier",            state:"todo" },
      ],
      closing:[
        { id:"t-pp-cl-1", agentId:"t-julien", label:"KYC",       state:"todo", grid:true },
        { id:"t-pp-cl-2", agentId:"t-lea",    label:"Compromis", state:"todo", grid:true },
        { id:"t-pp-cl-3", agentId:"t-julien", label:"LBA",       state:"todo", grid:true },
        { id:"t-pp-cl-4", agentId:"t-marc",   label:"Acte",      state:"todo", grid:true },
      ],
    },
  },
];

window.PARCOURS_TEAM = PARCOURS_TEAM;
window.PARCOURS_STAGES = PARCOURS_STAGES;
window.PARCOURS_DOSSIERS = PARCOURS_DOSSIERS;
window.parcoursAgentById = parcoursAgentById;
