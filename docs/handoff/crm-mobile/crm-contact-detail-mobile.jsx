// MEGGA CRM — Responsive · Fiche détail Contact · MOBILE (390×844)
// Portage Sugar Pure de crm-screen-contact-detail-sugar.jsx.
// Drill-in : header sticky + parcours vertical de cards (hero, KYC doux,
// activité, biens proposés, critères, deals, notes, documents).
// Réutilise window.* : MTCtx, MT_LIGHT/DARK, MT_STAGE, MEIcon, MAv,
//   CRM_CONTACTS, CRM_BIENS, CRM_DEALS, CRM_STAGES.
// KYC = rappel doux NON-bloquant (CLAUDE.md, mai 2026) — jamais "bloqué".

const CDM_useMT = () => React.useContext(window.MTCtx);
const CdmIcon = ({ name, size = 18, color = "currentColor", sw = 1.7 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

const cdmFmtCHF = (n) => n == null ? "—" : "CHF " + (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'"));

// ─── Primitives ──────────────────────────────────────────────────────────
const CdmCard = ({ title, eyebrow, action, children, pad = 18, style }) => {
  const T = CDM_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: pad, animation: "cdmUp .5s cubic-bezier(.2,.8,.2,1) both", ...style }}>
      {(title || action || eyebrow) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: children ? 15 : 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {eyebrow && <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{eyebrow}</div>}
            {title && <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
};

// Pilule neutre — texte seul, AUCUN dot (CLAUDE.md)
const CdmPill = ({ children }) => {
  const T = CDM_useMT();
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{children}</span>;
};

// Pilule de statut fonctionnelle — fond teinté ~14 %, texte coloré, sans dot
const CdmStatusPill = ({ label, color }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: `${color}22`, color, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{label}</span>
);

const CdmGhostBtn = ({ children, onClick, icon }) => {
  const T = CDM_useMT();
  return (
    <button onClick={onClick} style={{ height: 34, padding: "0 13px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
      {icon}{children}
    </button>
  );
};

const CdmCircle = ({ icon, onClick, title, size = 44 }) => {
  const T = CDM_useMT();
  return (
    <button onClick={onClick} title={title} style={{ width: size, height: size, borderRadius: 999, border: 0, background: T.cardSubtle, color: T.inkSoft, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: T.shadowSm, flexShrink: 0 }}>{icon}</button>
  );
};

// ─── HERO ──────────────────────────────────────────────────────────────
const CdmHero = ({ contact }) => {
  const T = CDM_useMT();
  const typeLabel = { buyer: "Acheteur", seller: "Vendeur", tenant: "Locataire", landlord: "Propriétaire", mixed: "Mixte" }[contact.type] || contact.type;
  const statusLabel = { lead: "Lead", qualified: "Qualifié", active: "Actif", archived: "Archivé" }[contact.status] || contact.status;
  const sourceLabel = { website: "Site web", referral: "Recommandation", csv: "Import CSV", call: "Appel entrant", "walk-in": "Visite agence", AI: "Extraction IA", vcard: "vCard" }[contact.source] || contact.source;
  const langLabel = { fr: "Français", en: "English", de: "Deutsch", it: "Italiano" }[contact.lang] || contact.lang;

  const info = [
    { label: "E-mail", value: contact.email, icon: "mail" },
    { label: "Téléphone", value: contact.phone, icon: "phone", num: true },
    { label: "Langue", value: langLabel, icon: "message" },
    { label: "Agent référent", value: "Gregory Lyonnet", icon: "user" },
  ];
  const actions = [
    { t: "Appeler", icon: "phone" }, { t: "E-mail", icon: "mail" },
    { t: "Message", icon: "message" }, { t: "Planifier", icon: "calendar" },
  ];

  return (
    <div style={{ background: T.card, borderRadius: 24, boxShadow: T.shadowLg, padding: 20, animation: "cdmUp .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={64}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</window.MAv>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>{typeLabel} · {statusLabel}</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: T.ink, letterSpacing: -0.6, lineHeight: 1.05 }}>{contact.firstName} {contact.lastName}</h1>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        <CdmPill>Score {contact.score}</CdmPill>
        <CdmPill>Source · {sourceLabel}</CdmPill>
        {(contact.tags || []).slice(0, 2).map(tg => <CdmPill key={tg}>{tg}</CdmPill>)}
      </div>

      {/* Actions rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 18 }}>
        {actions.map(a => (
          <button key={a.t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 0", borderRadius: 16, border: 0, cursor: "pointer", background: T.cardSubtle, fontFamily: "inherit" }}>
            <CdmIcon name={a.icon} size={20} color={T.ink} sw={1.7} />
            <span style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, letterSpacing: -0.1 }}>{a.t}</span>
          </button>
        ))}
      </div>

      {/* Coordonnées */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        {info.map(it => (
          <div key={it.label} style={{ padding: "12px 13px", borderRadius: 14, background: T.cardSubtle, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>{it.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: it.num ? "tabular-nums" : "normal" }}>{it.value}</div>
          </div>
        ))}
      </div>

      <button style={{ width: "100%", marginTop: 14, height: 48, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: T.shadowSm }}>
        <CdmIcon name="plus" size={17} color={T.accentInk} sw={2.2} />Nouvelle action
      </button>
    </div>
  );
};

// ─── KYC (rappel doux, NON bloquant) ────────────────────────────────────
const CdmKyc = ({ contact }) => {
  const T = CDM_useMT();
  const k = contact.kyc || { status: "none" };
  const verified = k.status === "verified";
  const meta = {
    verified: { label: "Vérifié", sub: ({ low: "Risque faible", medium: "Risque modéré", high: "Risque élevé" }[k.riskLevel] || "Conforme"), tone: "#059669" },
    pending: { label: "En cours", sub: "Pièces à compléter · optionnel", tone: "#C45A00" },
    none: { label: "À démarrer", sub: "Aucune pièce collectée · optionnel", tone: "#7A8088" },
  }[k.status] || { label: "À démarrer", sub: "Optionnel", tone: "#7A8088" };

  return (
    <CdmCard title="Conformité KYC" eyebrow="LBA · non bloquant"
      action={<CdmGhostBtn icon={<CdmIcon name="arrow-right" size={13} color={T.inkSoft} sw={2} />}>{verified ? "Voir" : "Ouvrir"}</CdmGhostBtn>}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 16px", borderRadius: 16, background: verified ? `${meta.tone}14` : T.cardSubtle }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: verified ? meta.tone : T.card, display: "grid", placeItems: "center", boxShadow: verified ? "none" : T.shadowSm }}>
          <CdmIcon name={verified ? "check" : "shield"} size={20} color={verified ? "#fff" : T.ink} sw={verified ? 2.4 : 1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{meta.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>{meta.sub}</div>
        </div>
        {!verified && <CdmPill>Optionnel</CdmPill>}
      </div>
    </CdmCard>
  );
};

// ─── ACTIVITÉ (timeline) ─────────────────────────────────────────────────
const CDM_TIMELINE = [
  { at: "2026-05-15T15:32:00", by: "system", title: "3 nouveaux biens proposés", detail: "MEGGA AI · b-103, b-101, b-102 — score moyen 78/100", icon: "sparkle" },
  { at: "2026-05-12T10:15:00", by: "agt-1", title: "Appel sortant · 12 min", detail: "Pré-qualification critères. Insiste sur balcon et ascenseur.", icon: "phone" },
  { at: "2026-05-08T17:00:00", by: "agt-1", title: "Bon de visite signé", detail: "Carouge 5p · 2 mai 2026 · signature électronique acheteur", icon: "file" },
  { at: "2026-05-02T14:30:00", by: "agt-1", title: "Visite physique · Carouge", detail: "Rue Ancienne 6 — feedback positif sur volumes, réserves sur cuisine.", icon: "home" },
  { at: "2026-04-22T11:00:00", by: "agt-1", title: "E-mail · proposition de 3 biens", detail: "Marie ouvre 2/3, clique sur Carouge (b-103) deux fois.", icon: "mail" },
  { at: "2026-04-02T09:00:00", by: "agt-1", title: "Contact créé", detail: "Source : formulaire site web · transmise à Gregory.", icon: "edit" },
];
const CdmTimeline = () => {
  const T = CDM_useMT();
  const fmt = (iso) => new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <CdmCard title="Activité" eyebrow="Timeline unifiée"
      action={<CdmGhostBtn icon={<CdmIcon name="sparkle" size={13} color={T.inkSoft} sw={1.8} />}>Résumer</CdmGhostBtn>}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {CDM_TIMELINE.map((ev, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 13, paddingBottom: i === CDM_TIMELINE.length - 1 ? 0 : 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <CdmIcon name={ev.icon} size={15} color={T.ink} sw={1.7} />
              </div>
              {i < CDM_TIMELINE.length - 1 && <div style={{ width: 2, flex: 1, background: T.hair, marginTop: 4 }} />}
            </div>
            <div style={{ paddingTop: 3, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2, marginBottom: 2 }}>{ev.title}</div>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 5 }}>{fmt(ev.at)} · {ev.by === "system" ? "MEGGA AI" : "Gregory Lyonnet"}</div>
              <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{ev.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </CdmCard>
  );
};

// ─── BIENS PROPOSÉS ──────────────────────────────────────────────────────
const CdmBiens = ({ matches }) => {
  const T = CDM_useMT();
  const statusMeta = {
    sent: { label: "Envoyé", tone: "#7A8088" }, viewed: { label: "Vu", tone: "#0891B2" },
    liked: { label: "Favori", tone: "#059669" }, visited: { label: "Visité", tone: "#1E5BC6" },
    rejected: { label: "Refusé", tone: "#EF4444" },
  };
  return (
    <CdmCard title="Biens proposés" eyebrow={`${matches.length} envois`}
      action={<CdmGhostBtn icon={<CdmIcon name="plus" size={13} color={T.inkSoft} sw={2} />}>Proposer</CdmGhostBtn>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map(({ bien, score, status }) => {
          const sm = statusMeta[status] || statusMeta.sent;
          return (
            <div key={bien.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: 12, borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0, background: `linear-gradient(135deg, ${bien.accent}40, ${bien.accent}1A)`, display: "grid", placeItems: "center", color: bien.accent, fontWeight: 800, fontSize: 11, letterSpacing: 0.3, fontVariantNumeric: "tabular-nums" }}>{bien.ref.split("-").pop()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{bien.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: T.muted, fontWeight: 600 }}>
                  <span style={{ color: T.ink, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{cdmFmtCHF(bien.price)}</span>
                  <span>· {bien.area} m² · {bien.rooms} p.</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: T.card, display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", boxShadow: T.shadowSm }}>{score}</div>
                <CdmStatusPill label={sm.label} color={sm.tone} />
              </div>
            </div>
          );
        })}
      </div>
    </CdmCard>
  );
};

// ─── CRITÈRES ────────────────────────────────────────────────────────────
const CdmCriteria = ({ criteria }) => {
  const T = CDM_useMT();
  if (!criteria) return null;
  const items = [
    { label: "Transaction", value: criteria.transaction === "vente" ? "Achat" : "Location", icon: "refresh" },
    { label: "Types", value: (criteria.types || []).join(", ") || "—", icon: "home" },
    { label: "Cantons", value: (criteria.cantons || []).join(", ") || "—", icon: "location" },
    { label: "Villes", value: (criteria.cities || []).join(", ") || "—", icon: "target" },
    { label: "Budget", value: criteria.budgetMin || criteria.budgetMax ? `${cdmFmtCHF(criteria.budgetMin)} – ${cdmFmtCHF(criteria.budgetMax)}` : "—", icon: "credit-card" },
    { label: "Surface", value: criteria.areaMin ? `dès ${criteria.areaMin} m²` : "—", icon: "ruler" },
    { label: "Pièces", value: criteria.roomsMin ? `dès ${criteria.roomsMin}` : "—", icon: "bed" },
  ];
  return (
    <CdmCard title="Critères de recherche" eyebrow="Matching IA"
      action={<CdmGhostBtn icon={<CdmIcon name="edit" size={13} color={T.inkSoft} sw={1.8} />}>Modifier</CdmGhostBtn>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {items.map(it => (
          <div key={it.label} style={{ background: T.cardSubtle, borderRadius: 14, padding: "12px 13px", display: "flex", alignItems: "flex-start", gap: 11, minWidth: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: T.card, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <CdmIcon name={it.icon} size={14} color={T.inkSoft} sw={1.7} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>{it.label}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, lineHeight: 1.3 }}>{it.value}</div>
            </div>
          </div>
        ))}
      </div>
      {(criteria.mustHave || []).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Indispensable</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{criteria.mustHave.map(m => <CdmPill key={m}>{m}</CdmPill>)}</div>
        </div>
      )}
    </CdmCard>
  );
};

// ─── DEALS ───────────────────────────────────────────────────────────────
const CdmDeals = ({ deals, biens }) => {
  const T = CDM_useMT();
  if (!deals.length) return null;
  return (
    <CdmCard title="Deals en cours" eyebrow={`${deals.length} actif${deals.length > 1 ? "s" : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map(d => {
          const bien = d.bienId ? biens.find(b => b.id === d.bienId) : null;
          const stage = (window.CRM_STAGES || {})[d.stage] || { label: d.stage, color: T.muted };
          return (
            <div key={d.id} style={{ padding: "13px 15px", borderRadius: 14, background: T.cardSubtle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.1, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien ? bien.title : "Recherche active"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CdmStatusPill label={stage.label} color={stage.color} />
                  <span style={{ fontSize: 12, color: T.ink, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{cdmFmtCHF(d.value)}</span>
                </div>
              </div>
              <CdmCircle size={32} icon={<CdmIcon name="arrow-right" size={14} color={T.inkSoft} sw={2} />} />
            </div>
          );
        })}
      </div>
    </CdmCard>
  );
};

// ─── NOTES ───────────────────────────────────────────────────────────────
const CdmNotes = ({ notes }) => {
  const T = CDM_useMT();
  return (
    <CdmCard title="Notes internes" eyebrow="Privé · équipe MEGGA"
      action={<CdmGhostBtn icon={<CdmIcon name="edit" size={13} color={T.inkSoft} sw={1.8} />}>Modifier</CdmGhostBtn>}>
      <div style={{ padding: "15px 16px", borderRadius: 16, background: T.cardSubtle, fontSize: 13.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.55, letterSpacing: -0.1 }}>{notes || "Aucune note pour ce contact."}</div>
    </CdmCard>
  );
};

// ─── DOCUMENTS ─────────────────────────────────────────────────────────────
const CdmDocs = () => {
  const T = CDM_useMT();
  const docs = [
    { name: "Bon de visite Carouge — signé.pdf", date: "08 mai" },
    { name: "Mandat de recherche acheteur.pdf", date: "12 avril" },
    { name: "Pré-qualification financière UBS.pdf", date: "04 avril" },
  ];
  return (
    <CdmCard title="Documents" eyebrow={`${docs.length} pièces`}
      action={<CdmGhostBtn icon={<CdmIcon name="upload" size={13} color={T.inkSoft} sw={1.8} />}>Téléverser</CdmGhostBtn>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, background: T.cardSubtle }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: T.card, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: T.shadowSm }}>
              <CdmIcon name="file" size={15} color={T.inkSoft} sw={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 1 }}>{d.name}</div>
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 600 }}>Ajouté le {d.date}</div>
            </div>
            <CdmCircle size={32} icon={<CdmIcon name="download" size={14} color={T.inkSoft} sw={1.8} />} />
          </div>
        ))}
      </div>
    </CdmCard>
  );
};

// ─── ÉCRAN ───────────────────────────────────────────────────────────────
const MobileContactScreen = ({ dark = false }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const contacts = window.CRM_CONTACTS || [];
  const [contactId, setContactId] = React.useState("c-001");
  const contact = contacts.find(c => c.id === contactId) || contacts[0];
  if (!contact) return null;

  const deals = (window.CRM_DEALS || []).filter(d => d.contactId === contact.id);
  const biensAll = window.CRM_BIENS || [];
  const matches = contact.type === "buyer" ? [
    { bien: biensAll.find(b => b.id === "b-103"), score: 91, status: "visited" },
    { bien: biensAll.find(b => b.id === "b-101"), score: 84, status: "viewed" },
    { bien: biensAll.find(b => b.id === "b-102"), score: 72, status: "sent" },
  ].filter(m => m.bien) : [];

  const others = contacts.filter(c => c.id !== contact.id).slice(0, 5);

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
        <style>{`@keyframes cdmUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } } .cdmScroll::-webkit-scrollbar { display: none; }`}</style>

        {/* Header sticky frosté */}
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: T.headerBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 -1px 0 ${T.hair}`, position: "relative", zIndex: 5 }}>
          <button style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CdmIcon name="arrow-left" size={19} color={T.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>Fiche contact</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.firstName} {contact.lastName}</div>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CdmIcon name="edit" size={17} color={T.ink} sw={1.8} />
          </button>
        </header>

        {/* Corps scrollable */}
        <main className="cdmScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 40px", display: "flex", flexDirection: "column", gap: 14, WebkitOverflowScrolling: "touch" }}>
          {/* Switcher démo */}
          <div className="cdmScroll" style={{ display: "flex", gap: 7, overflowX: "auto", margin: "0 -4px", padding: "0 4px 2px", flexShrink: 0 }}>
            {[contact, ...others].map(c => {
              const on = c.id === contact.id;
              return (
                <button key={c.id} onClick={() => setContactId(c.id)} style={{ flexShrink: 0, height: 32, padding: "0 13px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: -0.1, background: on ? T.accent : T.card, color: on ? T.accentInk : T.inkSoft, boxShadow: T.shadowSm, whiteSpace: "nowrap" }}>
                  {c.firstName} {c.lastName[0]}.
                </button>
              );
            })}
          </div>

          <CdmHero contact={contact} />
          <CdmKyc contact={contact} />
          <CdmTimeline />
          {contact.type === "buyer" && matches.length > 0 && <CdmBiens matches={matches} />}
          {contact.criteria && <CdmCriteria criteria={contact.criteria} />}
          <CdmDeals deals={deals} biens={biensAll} />
          <CdmNotes notes={contact.notes} />
          <CdmDocs />
        </main>
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileContactScreen = MobileContactScreen;
