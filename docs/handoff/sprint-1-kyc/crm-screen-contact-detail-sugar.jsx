// MEGGA CRM — Fiche détail Contact (Sugar Pure)
// Direction artistique conforme à crm-wizard-sugar-v2.jsx (Step 0).
// — Page complète, scrollable, hero + grid 2 colonnes (main / sidebar)
// — Surfaces blanches, radius 28px, ombres douces, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E ; titres en noir franc
// — Si KYC non vérifié : bannière persistante haut de page (verrou pipeline)
//
// Prérequis : window.SugarV2Palette, window.SugarTopNav,
//             window.CRM_CONTACTS, window.CRM_BIENS, window.CRM_DEALS,
//             window.KYC_DOSSIERS (cf. crm-kyc-data.jsx)

const CdSP = window.SugarV2Palette || {
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",
  card: "#FFFFFF", cardSubtle: "#F7F8FA",
  black: "#0B0C0E", blackHover: "#1F2024",
  ink: "#0B0C0E", inkSoft: "#3A3D44", muted: "#7A8088", ghost: "#B5BAC2",
  shadowSm: "0 4px 16px rgba(15,23,42,0.04)",
  shadow:   "0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)",
  shadowLg: "0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
  shadowHover: "0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)",
};

// ─── Icônes ────────────────────────────────────────────────────────────
const CdIcon = ({ name, size = 18, stroke = "currentColor", sw = 1.6 }) => {
  const p = {
    arrowL:   <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    arrowR:   <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    phone:    <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.06.37 2.1.72 3.11a2 2 0 0 1-.45 2.11L8.09 10.1a16 16 0 0 0 6 6l1.16-1.27a2 2 0 0 1 2.11-.45c1 .35 2.05.59 3.11.72A2 2 0 0 1 22 16.92Z"/></>,
    mail:     <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    msg:     <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.4-.7L3 21l1.7-6.1a8.5 8.5 0 0 1-.7-3.4 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z"/></>,
    cal:      <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    plus:     <><path d="M12 5v14M5 12h14"/></>,
    star:     <><polygon points="12 2 15 8.5 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 8.5"/></>,
    pencil:   <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></>,
    shield:   <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/></>,
    check:    <><path d="m5 13 4 4 10-12"/></>,
    lock:     <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
    home:     <><path d="m3 11 9-8 9 8"/><path d="M5 10v9h14v-9"/></>,
    map:      <><path d="m3 7 6-2 6 2 6-2v12l-6 2-6-2-6 2Z"/><path d="M9 5v14M15 7v14"/></>,
    target:   <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    coins:    <><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></>,
    file:     <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></>,
    sparkle:  <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></>,
    chat:     <><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.4-.7L3 21l1.7-6.1a8.5 8.5 0 0 1-.7-3.4 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z"/></>,
    eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    bed:      <><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10"/><path d="M3 14h18M7 11h3"/></>,
    bath:     <><path d="M5 10V5a2 2 0 0 1 2-2h2"/><path d="M3 10h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3Z"/><path d="M7 21v-1M17 21v-1"/></>,
    flame:    <><path d="M12 2s3 4 3 8a3 3 0 0 1-6 0c0-1 .5-2 1-3 0-2-1-4-1-4-2 3-4 5-4 9a6 6 0 0 0 12 0c0-5-5-10-5-10Z"/></>,
    dot:      <><circle cx="12" cy="12" r="3"/></>,
    note:     <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
    upload:   <><path d="M12 20V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    download: <><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></>,
    swap:     <><path d="m7 4 4 4-4 4M17 20l-4-4 4-4"/><path d="M7 8h14M3 16h14"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>
  );
};

// ─── Primitives Sugar Pure (préfixées Cd) ──────────────────────────────
const CdBlackPill = ({ children, onClick, icon, size = "md", disabled }) => {
  const [hover, setHover] = React.useState(false);
  const h = size === "lg" ? 50 : 40;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === "lg" ? "0 26px" : "0 18px", borderRadius: 999, border: 0,
        background: disabled ? CdSP.ghost : (hover ? CdSP.blackHover : CdSP.black),
        color: "#fff", fontFamily: "inherit", fontSize: size === "lg" ? 14.5 : 13,
        fontWeight: 600, letterSpacing: 0.1, cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
        boxShadow: disabled ? "none" : (hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)"),
        transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
        transition: "all .18s ease",
      }}>
      {icon}{children}
    </button>
  );
};

const CdGhostPill = ({ children, onClick, icon, active }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 40, padding: "0 18px", borderRadius: 999, border: 0,
        background: active ? CdSP.black : (hover ? CdSP.card : "transparent"),
        color: active ? "#fff" : CdSP.inkSoft, fontFamily: "inherit",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
        boxShadow: active ? "0 6px 16px rgba(11,12,14,0.18)" : (hover ? CdSP.shadow : "none"),
        transition: "all .18s ease",
      }}>
      {icon}{children}
    </button>
  );
};

const CdCircleBtn = ({ icon, onClick, title, size = 44 }) => (
  <button onClick={onClick} title={title} style={{
    width: size, height: size, borderRadius: 999, border: 0,
    background: CdSP.cardSubtle, color: CdSP.inkSoft, cursor: "pointer",
    display: "grid", placeItems: "center", boxShadow: CdSP.shadowSm,
    transition: "all .18s ease",
  }}
    onMouseEnter={e => { e.currentTarget.style.background = CdSP.card; e.currentTarget.style.boxShadow = CdSP.shadow; }}
    onMouseLeave={e => { e.currentTarget.style.background = CdSP.cardSubtle; e.currentTarget.style.boxShadow = CdSP.shadowSm; }}>
    {icon}
  </button>
);

// Pilule neutre (statut, tag) — gris très sobre, accent par pastille
const CdNeutralPill = ({ label, tone, icon }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "5px 11px 5px 9px", borderRadius: 999,
    background: CdSP.cardSubtle, color: CdSP.ink,
    fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1, whiteSpace: "nowrap",
  }}>
    {tone && <span style={{ width: 7, height: 7, borderRadius: 999, background: tone, flexShrink: 0 }} />}
    {icon}
    {label}
  </span>
);

// Petite card section générique
const CdSection = ({ title, eyebrow, action, children, padded = true }) => (
  <div style={{
    background: CdSP.card, borderRadius: 22, padding: padded ? "26px 28px" : 0,
    boxShadow: CdSP.shadow,
    animation: "sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both",
  }}>
    {(title || action || eyebrow) && (
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        marginBottom: children ? 18 : 0, padding: padded ? 0 : "26px 28px 0",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {eyebrow && (
            <div style={{
              fontSize: 11, fontWeight: 600, color: CdSP.muted,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{eyebrow}</div>
          )}
          {title && (
            <h3 style={{
              margin: 0, fontSize: 18, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.3,
            }}>{title}</h3>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>{action}</div>
      </div>
    )}
    <div style={{ padding: padded ? 0 : "0 28px 26px" }}>{children}</div>
  </div>
);

// ─── KYC BANNER (verrou pipeline) ──────────────────────────────────────
// Affichée en haut de la fiche tant que le dossier KYC n'est pas "verified".
const CdKycBanner = ({ contact, dossier, onOpenKyc }) => {
  if (dossier && dossier.status === "verified") return null;

  const statusText = !dossier || dossier.status === "none"
    ? "Aucun dossier KYC n'a été ouvert"
    : dossier.status === "pending"
      ? "Le dossier KYC est en cours — pièces manquantes"
      : "Le dossier KYC doit être re-vérifié";

  const pct = window.kycCompletionPct ? window.kycCompletionPct(dossier) : 0;

  return (
    <div style={{
      background: CdSP.black, color: "#fff",
      borderRadius: 22, padding: "20px 24px",
      marginBottom: 24, boxShadow: "0 12px 32px rgba(11,12,14,0.18)",
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center",
      animation: "sgFadeUp .45s cubic-bezier(.2,.8,.2,1) both",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: "rgba(255,255,255,0.10)", display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <CdIcon name="lock" size={20} stroke="#fff" sw={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, marginBottom: 2 }}>
          Pipeline bloqué — {statusText}.
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
          Ce contact ne pourra pas passer en <em>Intérêt confirmé</em> tant que le KYC n'est pas validé.
          {dossier && dossier.status === "pending" && pct > 0 && ` Avancement : ${pct} %.`}
        </div>
      </div>
      <button onClick={onOpenKyc} style={{
        height: 40, padding: "0 18px", borderRadius: 999, border: 0,
        background: "#fff", color: CdSP.ink, fontFamily: "inherit",
        fontSize: 13, fontWeight: 700, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
        boxShadow: "0 6px 16px rgba(0,0,0,0.20)",
      }}>
        {!dossier || dossier.status === "none" ? "Lancer le KYC" : "Continuer le dossier"}
        <CdIcon name="arrowR" size={14} stroke={CdSP.ink} sw={2} />
      </button>
    </div>
  );
};

// ─── HERO ──────────────────────────────────────────────────────────────
const CdHero = ({ contact, onBack }) => {
  const typeLabel = { buyer: "Acheteur", seller: "Vendeur", tenant: "Locataire", landlord: "Propriétaire", mixed: "Mixte" }[contact.type] || contact.type;
  const statusLabel = { lead: "Lead", qualified: "Qualifié", active: "Actif", archived: "Archivé" }[contact.status] || contact.status;
  const scoreTone = contact.score >= 80 ? "#10B981" : contact.score >= 60 ? "#0B0C0E" : contact.score >= 40 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{
      background: CdSP.card, borderRadius: 28, padding: "32px 36px",
      boxShadow: CdSP.shadowLg, marginBottom: 24,
      animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
    }}>
      <button onClick={onBack} style={{
        border: 0, background: "transparent", color: CdSP.muted,
        fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        marginBottom: 24, padding: 0, letterSpacing: 0.2,
      }}>
        <CdIcon name="arrowL" size={14} stroke={CdSP.muted} />
        Retour aux contacts
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 999, color: "#fff",
            background: contact.avatarBg || CdSP.black,
            display: "grid", placeItems: "center",
            fontSize: 32, fontWeight: 700, letterSpacing: -0.5,
            boxShadow: "0 8px 24px rgba(11,12,14,0.18)",
            flexShrink: 0,
          }}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</div>

          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: CdSP.muted,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8,
            }}>{typeLabel} · {statusLabel}</div>
            <h1 style={{
              margin: "0 0 12px", fontSize: 36, fontWeight: 700,
              color: CdSP.ink, letterSpacing: -0.7, lineHeight: 1.05,
            }}>{contact.firstName} {contact.lastName}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <CdNeutralPill tone={scoreTone} label={`Score ${contact.score}`} />
              <CdNeutralPill label={`Source : ${({
                website: "Site web", referral: "Recommandation", csv: "Import CSV", call: "Appel entrant",
                "walk-in": "Visite agence", AI: "Extraction IA", vcard: "vCard",
              })[contact.source] || contact.source}`} />
              {(contact.tags || []).slice(0, 3).map(tg => (
                <CdNeutralPill key={tg} label={tg} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <CdCircleBtn title="Appeler"   icon={<CdIcon name="phone" size={17} stroke={CdSP.inkSoft} />} />
          <CdCircleBtn title="E-mail"    icon={<CdIcon name="mail"  size={17} stroke={CdSP.inkSoft} />} />
          <CdCircleBtn title="Message"   icon={<CdIcon name="msg"   size={17} stroke={CdSP.inkSoft} />} />
          <CdCircleBtn title="Planifier" icon={<CdIcon name="cal"   size={17} stroke={CdSP.inkSoft} />} />
          <CdBlackPill size="md" icon={<CdIcon name="plus" size={14} stroke="#fff" sw={2} />}>
            Nouvelle action
          </CdBlackPill>
        </div>
      </div>

      {/* Coordonnées en bas */}
      <div style={{
        marginTop: 28, paddingTop: 22, borderTop: `1px solid ${CdSP.cardSubtle}`,
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
      }}>
        <div>
          <div style={{ fontSize: 11, color: CdSP.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>E-mail</div>
          <div style={{ fontSize: 13.5, color: CdSP.ink, fontWeight: 600 }}>{contact.email}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: CdSP.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Téléphone</div>
          <div style={{ fontSize: 13.5, color: CdSP.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{contact.phone}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: CdSP.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Langue</div>
          <div style={{ fontSize: 13.5, color: CdSP.ink, fontWeight: 600 }}>{({ fr: "Français", en: "English", de: "Deutsch", it: "Italiano" })[contact.lang] || contact.lang}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: CdSP.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>Agent référent</div>
          <div style={{ fontSize: 13.5, color: CdSP.ink, fontWeight: 600 }}>Gregory Lyonnet</div>
        </div>
      </div>
    </div>
  );
};

// ─── CRITÈRES ──────────────────────────────────────────────────────────
const CdCriteriaCard = ({ criteria }) => {
  if (!criteria) return null;
  const fmtCHF = (n) => n == null ? "—" : "CHF " + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  const items = [
    { label: "Transaction", value: criteria.transaction === "vente" ? "Achat" : "Location", icon: "swap" },
    { label: "Types",       value: (criteria.types || []).join(", ") || "—", icon: "home" },
    { label: "Cantons",     value: (criteria.cantons || []).join(", ") || "—", icon: "map" },
    { label: "Villes",      value: (criteria.cities || []).join(", ") || "—", icon: "target" },
    { label: "Budget",      value: criteria.budgetMin || criteria.budgetMax
        ? `${fmtCHF(criteria.budgetMin)} – ${fmtCHF(criteria.budgetMax)}` : "—", icon: "coins" },
    { label: "Surface",     value: criteria.areaMin ? `dès ${criteria.areaMin} m²` : "—", icon: "home" },
    { label: "Pièces",      value: criteria.roomsMin ? `dès ${criteria.roomsMin}` : "—", icon: "bed" },
  ];

  return (
    <CdSection title="Critères de recherche" eyebrow="Matching IA"
      action={<CdGhostPill icon={<CdIcon name="pencil" size={13} stroke={CdSP.inkSoft} />}>Modifier</CdGhostPill>}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {items.map(it => (
          <div key={it.label} style={{
            background: CdSP.cardSubtle, borderRadius: 14, padding: "14px 16px",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, background: CdSP.card,
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <CdIcon name={it.icon} size={14} stroke={CdSP.inkSoft} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: CdSP.muted,
                letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3,
              }}>{it.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.1 }}>
                {it.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(criteria.mustHave || []).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: CdSP.muted,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
          }}>Indispensable</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {criteria.mustHave.map(m => <CdNeutralPill key={m} label={m} tone={CdSP.black} />)}
          </div>
        </div>
      )}
      {(criteria.niceToHave || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: CdSP.muted,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
          }}>Apprécié</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {criteria.niceToHave.map(m => <CdNeutralPill key={m} label={m} />)}
          </div>
        </div>
      )}
    </CdSection>
  );
};

// ─── BIENS PROPOSÉS ────────────────────────────────────────────────────
const CdBienRow = ({ bien, score, status }) => {
  const fmtCHF = (n) => n == null ? "—" : "CHF " + (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'"));
  const statusMeta = {
    sent:    { label: "Envoyé",    tone: "#7A8088" },
    viewed:  { label: "Vu",        tone: "#0891B2" },
    liked:   { label: "Favori",    tone: "#10B981" },
    visited: { label: "Visité",    tone: "#1E5BC6" },
    rejected:{ label: "Refusé",    tone: "#EF4444" },
  }[status] || { label: "Suggéré", tone: "#7A8088" };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 16, alignItems: "center",
      padding: "14px 14px 14px 14px", borderRadius: 16, background: CdSP.cardSubtle,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12,
        background: `linear-gradient(135deg, ${bien.accent}40, ${bien.accent}20)`,
        display: "grid", placeItems: "center", flexShrink: 0,
        color: bien.accent, fontWeight: 700, fontSize: 11, letterSpacing: 0.4,
      }}>{bien.ref.split("-").pop()}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.1,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginBottom: 3,
        }}>{bien.title}</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, fontSize: 11.5,
          color: CdSP.muted, fontWeight: 500,
        }}>
          <span>{bien.addr.split(",")[1]?.trim() || bien.addr}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: CdSP.ghost }} />
          <span style={{ fontVariantNumeric: "tabular-nums", color: CdSP.ink, fontWeight: 700 }}>
            {fmtCHF(bien.price)}
          </span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: CdSP.ghost }} />
          <span>{bien.area} m² · {bien.rooms} p.</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CdNeutralPill tone={statusMeta.tone} label={statusMeta.label} />
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: CdSP.card, display: "grid", placeItems: "center",
          fontSize: 12, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.2,
          fontVariantNumeric: "tabular-nums",
        }}>{score}</div>
      </div>
    </div>
  );
};

const CdBiensProposesCard = ({ matches }) => (
  <CdSection title="Biens proposés" eyebrow={`${matches.length} envois`}
    action={<CdGhostPill icon={<CdIcon name="plus" size={13} stroke={CdSP.inkSoft} sw={2} />}>Proposer un bien</CdGhostPill>}>
    {matches.length === 0 ? (
      <div style={{
        padding: "32px 20px", textAlign: "center", background: CdSP.cardSubtle, borderRadius: 16,
        color: CdSP.muted, fontSize: 13, fontWeight: 500,
      }}>Aucun bien proposé pour l'instant.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map(m => <CdBienRow key={m.bien.id} {...m} />)}
      </div>
    )}
  </CdSection>
);

// ─── DEALS ASSOCIÉS ────────────────────────────────────────────────────
const CdDealsCard = ({ deals, biens }) => {
  const fmtCHF = (n) => n == null ? "—" : "CHF " + (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'"));

  return (
    <CdSection title="Deals en cours" eyebrow={`${deals.length} actif${deals.length > 1 ? "s" : ""}`}>
      {deals.length === 0 ? (
        <div style={{
          padding: "28px 16px", textAlign: "center", background: CdSP.cardSubtle, borderRadius: 14,
          color: CdSP.muted, fontSize: 12.5, fontWeight: 500,
        }}>Aucun deal actif.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deals.map(d => {
            const bien = d.bienId ? biens.find(b => b.id === d.bienId) : null;
            const stage = (window.CRM_STAGES || {})[d.stage] || { label: d.stage, color: "#7A8088" };
            return (
              <div key={d.id} style={{
                padding: "14px 16px", borderRadius: 14, background: CdSP.cardSubtle,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.1,
                    marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{bien ? bien.title : "Recherche active"}</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 11, color: CdSP.muted, fontWeight: 500,
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: stage.color }} />
                      {stage.label}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: CdSP.ghost }} />
                    <span style={{ fontVariantNumeric: "tabular-nums", color: CdSP.ink, fontWeight: 700 }}>
                      {fmtCHF(d.value)}
                    </span>
                  </div>
                </div>
                <CdCircleBtn size={32} icon={<CdIcon name="arrowR" size={13} stroke={CdSP.inkSoft} />} />
              </div>
            );
          })}
        </div>
      )}
    </CdSection>
  );
};

// ─── KYC CARD (résumé sidebar) ─────────────────────────────────────────
const CdKycCard = ({ dossier, onOpenKyc }) => {
  const pct = dossier && window.kycCompletionPct ? window.kycCompletionPct(dossier) : 0;
  const status = dossier?.status || "none";
  const meta = (window.KYC_STATUS_LABELS || {})[status] || { label: "À démarrer", tone: "#7A8088" };
  const verified = status === "verified";

  return (
    <CdSection title="Conformité KYC" eyebrow="LBA · obligatoire"
      action={<CdGhostPill onClick={onOpenKyc}
        icon={<CdIcon name="arrowR" size={13} stroke={CdSP.inkSoft} />}>Ouvrir</CdGhostPill>}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px", borderRadius: 16,
        background: verified ? "rgba(16,185,129,0.06)" : CdSP.cardSubtle,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: verified ? "#10B981" : CdSP.card,
            color: verified ? "#fff" : CdSP.ink,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <CdIcon name={verified ? "check" : "shield"} size={20}
              stroke={verified ? "#fff" : CdSP.ink} sw={verified ? 2.2 : 1.6} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.2, marginBottom: 3 }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 11.5, color: CdSP.muted, fontWeight: 500 }}>
              {verified ? (window.KYC_RISK_LABELS?.[dossier.riskLevel]?.label || "—")
                       : pct > 0 ? `${pct} % complété` : "Aucune pièce collectée"}
            </div>
          </div>
        </div>
        {!verified && (
          <div style={{
            padding: "4px 10px", borderRadius: 999,
            background: "rgba(239,68,68,0.10)", color: "#B91C1C",
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <CdIcon name="lock" size={10} stroke="#B91C1C" sw={2} />
            Bloque pipeline
          </div>
        )}
      </div>
    </CdSection>
  );
};

// ─── TIMELINE ──────────────────────────────────────────────────────────
const CD_TIMELINE = [
  { at: "2026-05-15T15:32:00", kind: "match-sent",  by: "system", title: "3 nouveaux biens proposés", detail: "MEGGA AI · b-103, b-101, b-102 — score moyen 78/100", icon: "sparkle" },
  { at: "2026-05-12T10:15:00", kind: "call",        by: "agt-1",  title: "Appel sortant · 12 min", detail: "Pré-qualification critères. Insiste sur balcon et ascenseur.", icon: "phone" },
  { at: "2026-05-08T17:00:00", kind: "doc-signed",  by: "agt-1",  title: "Bon de visite signé", detail: "Carouge 5p · 2 mai 2026 · signature électronique acheteur", icon: "file" },
  { at: "2026-05-02T14:30:00", kind: "visit",       by: "agt-1",  title: "Visite physique · Carouge", detail: "Rue Ancienne 6 — feedback acheteur positif sur volumes, réserves sur cuisine fermée.", icon: "home" },
  { at: "2026-04-22T11:00:00", kind: "email",       by: "agt-1",  title: "E-mail · proposition de 3 biens", detail: "Marie ouvre 2/3, clique sur Carouge (b-103) deux fois.", icon: "mail" },
  { at: "2026-04-04T16:22:00", kind: "kyc-update",  by: "agt-1",  title: "Dossier KYC validé", detail: "5 contrôles vérifiés · risque faible · valable jusqu'au 02/04/2027", icon: "shield" },
  { at: "2026-04-02T09:00:00", kind: "note",        by: "agt-1",  title: "Contact créé", detail: "Source : formulaire site web · transmise à Gregory.", icon: "note" },
];

const CdTimelineCard = () => {
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("fr-CH", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  return (
    <CdSection title="Activité" eyebrow="Timeline unifiée"
      action={
        <div style={{ display: "flex", gap: 6 }}>
          <CdGhostPill icon={<CdIcon name="sparkle" size={13} stroke={CdSP.inkSoft} />}>Résumer avec MEGGA AI</CdGhostPill>
          <CdGhostPill icon={<CdIcon name="plus" size={13} stroke={CdSP.inkSoft} sw={2} />}>Ajouter</CdGhostPill>
        </div>
      }>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {CD_TIMELINE.map((ev, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "auto 1fr", gap: 16,
            paddingBottom: i === CD_TIMELINE.length - 1 ? 0 : 20,
            position: "relative",
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: CdSP.cardSubtle, color: CdSP.ink,
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <CdIcon name={ev.icon} size={16} stroke={CdSP.ink} />
              </div>
              {i < CD_TIMELINE.length - 1 && (
                <div style={{ width: 2, flex: 1, background: CdSP.cardSubtle, marginTop: 4 }} />
              )}
            </div>
            <div style={{ paddingTop: 4 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: CdSP.ink,
                letterSpacing: -0.2, marginBottom: 3,
              }}>{ev.title}</div>
              <div style={{ fontSize: 12, color: CdSP.muted, fontWeight: 500, marginBottom: 6 }}>
                {fmt(ev.at)} · {ev.by === "system" ? "MEGGA AI" : "Gregory Lyonnet"}
              </div>
              <div style={{
                fontSize: 13, color: CdSP.inkSoft, fontWeight: 500, lineHeight: 1.55,
              }}>{ev.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </CdSection>
  );
};

// ─── NOTES ─────────────────────────────────────────────────────────────
const CdNotesCard = ({ notes }) => (
  <CdSection title="Notes internes" eyebrow="Privé · équipe MEGGA"
    action={<CdGhostPill icon={<CdIcon name="pencil" size={13} stroke={CdSP.inkSoft} />}>Modifier</CdGhostPill>}>
    <div style={{
      padding: "18px 20px", borderRadius: 16, background: CdSP.cardSubtle,
      fontSize: 14, color: CdSP.inkSoft, fontWeight: 500, lineHeight: 1.6, letterSpacing: -0.1,
    }}>{notes || "Aucune note pour ce contact."}</div>
  </CdSection>
);

// ─── DOCUMENTS ─────────────────────────────────────────────────────────
const CdDocsCard = () => {
  const docs = [
    { name: "Bon de visite Carouge — signé.pdf",       date: "08 mai",    icon: "file" },
    { name: "Mandat de recherche acheteur.pdf",        date: "12 avril",  icon: "file" },
    { name: "Pré-qualification financière UBS.pdf",    date: "04 avril",  icon: "file" },
  ];
  return (
    <CdSection title="Documents" eyebrow={`${docs.length} pièces`}
      action={<CdGhostPill icon={<CdIcon name="upload" size={13} stroke={CdSP.inkSoft} />}>Téléverser</CdGhostPill>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {docs.map(d => (
          <div key={d.name} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 14, background: CdSP.cardSubtle,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 11, background: CdSP.card,
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
              <CdIcon name={d.icon} size={15} stroke={CdSP.inkSoft} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: CdSP.ink, letterSpacing: -0.1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 1,
              }}>{d.name}</div>
              <div style={{ fontSize: 11, color: CdSP.muted, fontWeight: 500 }}>
                Ajouté le {d.date}
              </div>
            </div>
            <CdCircleBtn size={32}
              icon={<CdIcon name="download" size={13} stroke={CdSP.inkSoft} />} />
          </div>
        ))}
      </div>
    </CdSection>
  );
};

// ─── SCREEN ────────────────────────────────────────────────────────────
const CRMScreenContactDetailSugar = ({ t, dense, aiLevel, dark, darkTone, setDark, onNavigate, onCmd, screen }) => {
  const sp = (window.crmSugarPalette && window.crmSugarPalette(t, dark, darkTone)) || {
    pageBg: CdSP.bg, ink: CdSP.ink, soft: CdSP.inkSoft, sub: CdSP.muted,
  };

  // On affiche par défaut Marie Bertrand (c-001). Permet à l'utilisateur
  // de tester sans clic dans Contacts. Le `data-contact-id` côté DOM
  // permettrait à un wrapper futur de passer un autre id.
  const contacts = window.CRM_CONTACTS || [];
  const [contactId, setContactId] = React.useState(window.__cdContactId || "c-001");
  React.useEffect(() => {
    if (window.__cdContactId && window.__cdContactId !== contactId) setContactId(window.__cdContactId);
  }, []);
  const contact = contacts.find(c => c.id === contactId) || contacts[0];

  if (!contact) return null;

  const deals    = (window.CRM_DEALS  || []).filter(d => d.contactId === contact.id);
  const biensAll = window.CRM_BIENS  || [];
  const dossier  = window.kycByContactId ? window.kycByContactId(contact.id) : null;

  // Biens proposés (mocked from criteria match)
  const matches = contact.type === "buyer" ? [
    { bien: biensAll.find(b => b.id === "b-103"), score: 91, status: "visited" },
    { bien: biensAll.find(b => b.id === "b-101"), score: 84, status: "viewed" },
    { bien: biensAll.find(b => b.id === "b-102"), score: 72, status: "sent" },
  ].filter(m => m.bien) : [];

  const onOpenKyc = () => {
    // Deep-link : l'écran KYC lira cette variable et ouvrira soit
    // le dossier existant, soit le wizard pré-rempli avec ce contact.
    window.__kycOpenForContactId = contact.id;
    onNavigate && onNavigate("kyc");
  };

  // Sélecteur de contact discret (haut-droite) pour la démo
  const otherContacts = contacts.filter(c => c.id !== contact.id).slice(0, 5);

  return (
    <div data-screen-label="CRM Contact détail (sugar)" style={{
      minHeight: "100vh", width: "100%",
      background: CdSP.bgGradient,
      fontFamily: "Manrope, system-ui, sans-serif", color: CdSP.ink,
    }}>
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {window.SugarTopNav && (
        <window.SugarTopNav active="contacts" t={t} sp={sp} dark={dark}
          onNavigate={onNavigate} onCmd={onCmd} />
      )}

      <main style={{ padding: "32px 40px 120px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          {/* Switcher démo */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            fontSize: 11, color: CdSP.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            <span>Démo · changer de fiche :</span>
            {otherContacts.map(c => (
              <button key={c.id} onClick={() => setContactId(c.id)}
                style={{
                  border: 0, background: "transparent", color: CdSP.inkSoft,
                  fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  padding: "4px 10px", borderRadius: 999, background: CdSP.card,
                  boxShadow: CdSP.shadowSm,
                }}>
                {c.firstName} {c.lastName[0]}.
              </button>
            ))}
          </div>

          <CdKycBanner contact={contact} dossier={dossier} onOpenKyc={onOpenKyc} />
          <CdHero contact={contact} onBack={() => onNavigate && onNavigate("contacts")} />

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
            {/* COLONNE PRINCIPALE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <CdTimelineCard />
              {contact.type === "buyer" && <CdBiensProposesCard matches={matches} />}
              <CdNotesCard notes={contact.notes} />
            </div>

            {/* COLONNE LATÉRALE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <CdKycCard dossier={dossier} onOpenKyc={onOpenKyc} />
              {contact.criteria && <CdCriteriaCard criteria={contact.criteria} />}
              {deals.length > 0 && <CdDealsCard deals={deals} biens={biensAll} />}
              <CdDocsCard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

window.CRMScreenContactDetailSugar = CRMScreenContactDetailSugar;
