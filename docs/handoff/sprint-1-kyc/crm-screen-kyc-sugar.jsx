// MEGGA CRM — Écran KYC / Conformité LBA (Sugar Pure)
// Direction artistique conforme à crm-wizard-sugar-v2.jsx (Step 0).
// — Surfaces blanches, radius 28px, ombres douces, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E
// — Beaucoup d'air, hiérarchie par l'espace et l'ombre
//
// Pattern : liste de dossiers ↔ vue détail (toggle dans le même écran)
// Prérequis : window.SugarV2Palette, window.KYC_DOSSIERS, window.SugarTopNav

const KycSP = window.SugarV2Palette || {
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",
  card: "#FFFFFF", cardSubtle: "#F7F8FA",
  black: "#0B0C0E", blackHover: "#1F2024",
  ink: "#0B0C0E", inkSoft: "#3A3D44", muted: "#7A8088", ghost: "#B5BAC2",
  shadowSm: "0 4px 16px rgba(15,23,42,0.04)",
  shadow: "0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)",
  shadowLg: "0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
  shadowHover: "0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)"
};

// ─── Icônes minimales (style Sugar — line, simple) ──────────────────────
const KycIcon = ({ name, size = 22, stroke = "currentColor", sw = 1.6 }) => {
  const p = {
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /></>,
    id: <><rect x="3" y="6" width="18" height="13" rx="2" /><circle cx="9" cy="12" r="2.5" /><path d="M14 10h4M14 14h4" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v9h14v-9" /></>,
    flag: <><path d="M4 21V4" /><path d="M4 5h13l-2 4 2 4H4" /></>,
    ban: <><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>,
    coins: <><circle cx="9" cy="9" r="6" /><circle cx="15" cy="15" r="6" /></>,
    check: <><path d="m5 13 4 4 10-12" /></>,
    checkAll: <><path d="m2 13 4 4 10-12" /><path d="m9 15 3 3 10-12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>,
    x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    arrowL: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
    arrowR: <><path d="M5 12h14M12 5l7 7-7 7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
    upload: <><path d="M12 20V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    dot: <><circle cx="12" cy="12" r="3" /></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>);

};

const KYC_CHECK_ICONS = { id: "id", address: "home", pep: "flag", sanctions: "ban", funds: "coins" };

// ─── Primitives Sugar Pure (locales pour ne pas collisionner) ───────────
const KycBlackPill = ({ children, onClick, icon, size = "md", disabled }) => {
  const [hover, setHover] = React.useState(false);
  const h = size === "lg" ? 50 : 40;
  return (
    <button onClick={onClick} disabled={disabled}
    onMouseEnter={() => !disabled && setHover(true)} onMouseLeave={() => setHover(false)}
    style={{
      height: h, padding: size === "lg" ? "0 26px" : "0 18px", borderRadius: 999, border: 0,
      background: disabled ? KycSP.ghost : hover ? KycSP.blackHover : KycSP.black,
      color: "#fff", fontFamily: "inherit", fontSize: size === "lg" ? 14.5 : 13,
      fontWeight: 600, letterSpacing: 0.1, cursor: disabled ? "not-allowed" : "pointer",
      display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
      boxShadow: disabled ? "none" : hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)",
      transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
      transition: "all .18s ease"
    }}>
      {icon}{children}
    </button>);

};

const KycGhostPill = ({ children, onClick, icon, active }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    style={{
      height: 40, padding: "0 18px", borderRadius: 999, border: 0,
      background: active ? KycSP.black : hover ? KycSP.card : "transparent",
      color: active ? "#fff" : KycSP.inkSoft, fontFamily: "inherit",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
      boxShadow: active ? "0 6px 16px rgba(11,12,14,0.18)" : hover ? KycSP.shadow : "none",
      transition: "all .18s ease"
    }}>
      {icon}{children}
    </button>);

};

const KycCircleBtn = ({ icon, onClick, title, size = 44 }) =>
<button onClick={onClick} title={title} style={{
  width: size, height: size, borderRadius: 999, border: 0,
  background: KycSP.cardSubtle, color: KycSP.inkSoft, cursor: "pointer",
  display: "grid", placeItems: "center", boxShadow: KycSP.shadowSm,
  transition: "all .18s ease"
}}
onMouseEnter={(e) => {e.currentTarget.style.background = KycSP.card;e.currentTarget.style.boxShadow = KycSP.shadow;}}
onMouseLeave={(e) => {e.currentTarget.style.background = KycSP.cardSubtle;e.currentTarget.style.boxShadow = KycSP.shadowSm;}}>
    {icon}
  </button>;


// Anneau de progression (style Sugar — fin, noir)
const KycRing = ({ pct, size = 56, stroke = 3 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(11,12,14,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={KycSP.black} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: size >= 56 ? 14 : 11, fontWeight: 700, color: KycSP.ink,
        fontVariantNumeric: "tabular-nums", letterSpacing: -0.3
      }}>{pct}%</div>
    </div>);

};

// Pilule de statut (Sugar — gris très neutre, jamais coloré sauf petite pastille)
const KycStatusPill = ({ status }) => {
  const meta = (window.KYC_STATUS_LABELS || {})[status] || { label: status, tone: KycSP.muted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "5px 11px 5px 9px", borderRadius: 999,
      background: KycSP.cardSubtle, color: KycSP.ink,
      fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: meta.tone, flexShrink: 0 }} />
      {meta.label}
    </span>);

};

const KycRiskPill = ({ risk }) => {
  const meta = (window.KYC_RISK_LABELS || {})[risk] || { label: risk, tone: KycSP.muted };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "5px 11px 5px 9px", borderRadius: 999,
      background: KycSP.cardSubtle, color: KycSP.ink,
      fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap"
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: meta.tone }} />
      {meta.label}
    </span>);

};

// ─── Carte stat (bento header) ─────────────────────────────────────────
const KycStatCard = ({ label, value, sub, accent }) =>
<div style={{
  background: KycSP.card, borderRadius: 22, padding: "22px 24px",
  boxShadow: KycSP.shadow, minHeight: 124,
  display: "flex", flexDirection: "column", justifyContent: "space-between"
}}>
    <div style={{
    fontSize: 11, fontWeight: 600, letterSpacing: 1.1,
    textTransform: "uppercase", color: KycSP.muted
  }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
      <span style={{
      fontSize: 44, fontWeight: 700, letterSpacing: -1.4, lineHeight: 1,
      color: KycSP.ink, fontVariantNumeric: "tabular-nums"
    }}>{value}</span>
      {accent &&
    <span style={{
      width: 8, height: 8, borderRadius: 999, background: accent, marginBottom: 6
    }} />
    }
    </div>
    <div style={{ fontSize: 12.5, fontWeight: 500, color: KycSP.muted, marginTop: 8 }}>
      {sub}
    </div>
  </div>;


// ─── Ligne dossier (vue liste) ─────────────────────────────────────────
const KycDossierRow = ({ dossier, contact, onOpen }) => {
  const [hover, setHover] = React.useState(false);
  const pct = window.kycCompletionPct(dossier);
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const expiresIn = dossier.expiresAt ? Math.round((new Date(dossier.expiresAt) - new Date()) / (1000 * 3600 * 24 * 30)) : null;
  const isBlocking = dossier.status !== "verified";

  return (
    <button onClick={onOpen}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    style={{
      display: "grid", gridTemplateColumns: "56px 1fr 200px 160px 64px",
      gap: 24, alignItems: "center", width: "100%",
      padding: "22px 28px", background: KycSP.card,
      border: 0, borderRadius: 22, fontFamily: "inherit", textAlign: "left",
      cursor: "pointer", boxShadow: hover ? KycSP.shadowHover : KycSP.shadow,
      transform: hover ? "translateY(-2px)" : "translateY(0)",
      transition: "all .22s cubic-bezier(.2,.8,.2,1)"
    }}>
      {/* Avatar */}
      <div style={{
        width: 56, height: 56, borderRadius: 999, color: "#fff",
        background: contact.avatarBg || KycSP.black,
        display: "grid", placeItems: "center",
        fontSize: 17, fontWeight: 700, letterSpacing: -0.3,
        boxShadow: "0 4px 12px rgba(11,12,14,0.12)"
      }}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</div>

      {/* Nom + type contact + meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: KycSP.ink, letterSpacing: -0.3,
          marginBottom: 4, display: "flex", alignItems: "center", gap: 10
        }}>
          {contact.firstName} {contact.lastName}
          {isBlocking &&
          <span title="Ce dossier bloque l'avancement du deal en pipeline"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 999,
            background: "rgba(239,68,68,0.10)", color: "#B91C1C",
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2
          }}>
              <KycIcon name="lock" size={10} stroke="#B91C1C" sw={2} />
              Bloque pipeline
            </span>
          }
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12.5, fontWeight: 500, color: KycSP.muted
        }}>
          <span style={{ textTransform: "capitalize" }}>{contact.type === "buyer" ? "Acheteur" : contact.type === "seller" ? "Vendeur" : "Locataire"}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: KycSP.ghost }} />
          <span>Dossier ouvert {fmtDate(dossier.createdAt) === "—" ? "—" : "le " + fmtDate(dossier.createdAt)}</span>
          {dossier.expiresAt &&
          <>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: KycSP.ghost }} />
              <span>Échéance {expiresIn > 0 ? `dans ${expiresIn} mois` : "passée"}</span>
            </>
          }
        </div>
      </div>

      {/* Status + Risk pills */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <KycStatusPill status={dossier.status} />
        <KycRiskPill risk={dossier.riskLevel} />
      </div>

      {/* Ring de progression */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <KycRing pct={pct} />
        <div style={{ fontSize: 11.5, fontWeight: 500, color: KycSP.muted, lineHeight: 1.4 }}>
          {Object.values(dossier.checks).filter((c) => c.status === "verified" || c.status === "na").length}<br />
          sur {Object.keys(dossier.checks).length} contrôles
        </div>
      </div>

      {/* CTA chevron */}
      <div style={{
        width: 40, height: 40, borderRadius: 999,
        background: hover ? KycSP.black : KycSP.cardSubtle,
        color: hover ? "#fff" : KycSP.inkSoft,
        display: "grid", placeItems: "center", justifySelf: "end",
        transition: "all .18s ease",
        transform: hover ? "translateX(4px)" : "translateX(0)"
      }}>
        <KycIcon name="arrowR" size={16} />
      </div>
    </button>);

};

// ─── Carte check (vue détail) ──────────────────────────────────────────
const KycCheckCard = ({ checkKey, check, onMarkVerified }) => {
  const label = window.KYC_CHECK_LABELS[checkKey] || { title: checkKey, sub: "" };
  const status = check.status;
  const meta = (window.KYC_STATUS_LABELS || {})[status] || { label: status, tone: KycSP.muted };
  const verified = status === "verified" || status === "na";
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div style={{
      background: KycSP.card, borderRadius: 22, padding: "26px 28px",
      boxShadow: KycSP.shadow, display: "flex", flexDirection: "column", gap: 16,
      animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Icône */}
        <div style={{
          width: 48, height: 48, borderRadius: 16,
          background: verified ? KycSP.black : KycSP.cardSubtle,
          color: verified ? "#fff" : KycSP.black,
          display: "grid", placeItems: "center", flexShrink: 0
        }}>
          <KycIcon name={KYC_CHECK_ICONS[checkKey] || "shield"} size={22}
          stroke={verified ? "#fff" : KycSP.black} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h4 style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: KycSP.ink, letterSpacing: -0.2
            }}>{label.title}</h4>
            <KycStatusPill status={status} />
          </div>
          <p style={{
            margin: 0, fontSize: 13, color: KycSP.inkSoft, fontWeight: 500, lineHeight: 1.55
          }}>{label.sub}</p>
        </div>
      </div>

      {check.note &&
      <div style={{
        background: KycSP.cardSubtle, borderRadius: 14, padding: "12px 14px",
        fontSize: 12.5, color: KycSP.inkSoft, fontWeight: 500, lineHeight: 1.5
      }}>{check.note}</div>
      }

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 11.5, color: KycSP.muted, fontWeight: 500,
        paddingTop: 4
      }}>
        <span>
          {check.at ? fmtTime(check.at) : "En attente"}
          {check.by && check.by !== "system" && " · " + (check.by === "agt-1" ? "Gregory" : check.by)}
          {check.by === "system" && " · Système"}
        </span>
        {!verified &&
        <button onClick={onMarkVerified} style={{
          border: 0, background: KycSP.black, color: "#fff",
          fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 999, letterSpacing: 0.1,
          boxShadow: "0 4px 12px rgba(11,12,14,0.18)",
          transition: "all .18s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = KycSP.blackHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = KycSP.black; e.currentTarget.style.transform = "translateY(0)"; }}>
          <KycIcon name="check" size={12} stroke="#fff" sw={2.2} />
          Marquer vérifié
        </button>
        }
      </div>
    </div>);

};

// ─── Hero du dossier (vue détail) ──────────────────────────────────────
const KycDossierHero = ({ dossier, contact, onBack }) => {
  const pct = window.kycCompletionPct(dossier);
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  return (
    <div style={{
      background: KycSP.card, borderRadius: 28, padding: "36px 40px",
      boxShadow: KycSP.shadowLg, marginBottom: 24,
      animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both"
    }}>
      <button onClick={onBack} style={{
        border: 0, background: "transparent", color: KycSP.muted,
        fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        marginBottom: 24, padding: 0, letterSpacing: 0.2
      }}>
        <KycIcon name="arrowL" size={14} stroke={KycSP.muted} />
        Retour aux dossiers
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 999, color: "#fff",
            background: contact.avatarBg || KycSP.black,
            display: "grid", placeItems: "center",
            fontSize: 28, fontWeight: 700, letterSpacing: -0.5,
            boxShadow: "0 8px 24px rgba(11,12,14,0.18)"
          }}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</div>

          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: KycSP.muted,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8
            }}>Dossier KYC · LBA</div>
            <h1 style={{
              margin: "0 0 10px", fontSize: 34, fontWeight: 700,
              color: KycSP.ink, letterSpacing: -0.6, lineHeight: 1.1
            }}>{contact.firstName} {contact.lastName}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KycStatusPill status={dossier.status} />
              <KycRiskPill risk={dossier.riskLevel} />
              {dossier.expiresAt &&
              <span style={{
                fontSize: 12, color: KycSP.muted, fontWeight: 500, marginLeft: 6
              }}>Échéance : {fmtDate(dossier.expiresAt)}</span>
              }
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <KycRing pct={pct} size={88} stroke={4} />
        </div>
      </div>
    </div>);

};

// ─── Section documents joints ──────────────────────────────────────────
const KycDocsSection = ({ docs }) => {
  const fmtTime = (iso) => new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div style={{
      background: KycSP.card, borderRadius: 22, padding: "26px 28px",
      boxShadow: KycSP.shadow, animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both"
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: docs.length ? 20 : 0
      }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: KycSP.muted,
            letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4
          }}>Pièces du dossier</div>
          <h3 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: KycSP.ink, letterSpacing: -0.3
          }}>Documents joints</h3>
        </div>
        <KycGhostPill icon={<KycIcon name="upload" size={14} stroke={KycSP.inkSoft} />}>
          Téléverser
        </KycGhostPill>
      </div>

      {docs.length === 0 ?
      <div style={{
        padding: "32px 20px", textAlign: "center",
        background: KycSP.cardSubtle, borderRadius: 16,
        color: KycSP.muted, fontSize: 13, fontWeight: 500
      }}>
          Aucun document joint pour l'instant.<br />
          Demandez les pièces au contact pour démarrer la vérification.
        </div> :

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) =>
        <div key={d.id} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 14px", borderRadius: 14,
          background: KycSP.cardSubtle
        }}>
              <div style={{
            width: 36, height: 36, borderRadius: 12, background: KycSP.card,
            display: "grid", placeItems: "center", flexShrink: 0
          }}>
                <KycIcon name="file" size={18} stroke={KycSP.inkSoft} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
              fontSize: 13.5, fontWeight: 700, color: KycSP.ink, letterSpacing: -0.2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>{d.name}</div>
                <div style={{ fontSize: 11, color: KycSP.muted, fontWeight: 500, marginTop: 1 }}>
                  {d.size} · Ajouté le {fmtTime(d.uploadedAt)}
                </div>
              </div>
              <KycCircleBtn size={36} title="Aperçu"
          icon={<KycIcon name="eye" size={14} stroke={KycSP.inkSoft} />} />
              <KycCircleBtn size={36} title="Télécharger"
          icon={<KycIcon name="download" size={14} stroke={KycSP.inkSoft} />} />
            </div>
        )}
        </div>
      }
    </div>);

};

// ─── Piste d'audit du dossier (mini) ───────────────────────────────────
const KycAuditTrail = ({ dossier, contact }) => {
  // Construit une timeline à partir des checks + audit events liés
  const events = [];
  if (dossier.createdAt) events.push({ at: dossier.createdAt, label: "Dossier ouvert", actor: "Gregory" });
  Object.entries(dossier.checks).forEach(([key, check]) => {
    if (check.at) {
      const lab = window.KYC_CHECK_LABELS[key]?.title || key;
      const action = check.status === "verified" ? "validé" : check.status === "na" ? "non applicable" : "marqué " + check.status;
      events.push({ at: check.at, label: `${lab} ${action}`, actor: check.by === "system" ? "Système" : "Gregory", note: check.note });
    }
  });
  if (dossier.verifiedAt) events.push({ at: dossier.verifiedAt, label: "Dossier clôturé — risque " + (window.KYC_RISK_LABELS[dossier.riskLevel]?.label?.toLowerCase() || dossier.riskLevel), actor: "Gregory" });
  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  const fmt = (iso) => new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: KycSP.card, borderRadius: 22, padding: "26px 28px",
      boxShadow: KycSP.shadow, animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both"
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: KycSP.muted,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4
        }}>Conformité nLPD · LBA</div>
        <h3 style={{
          margin: 0, fontSize: 20, fontWeight: 700, color: KycSP.ink, letterSpacing: -0.3
        }}>Piste d'audit</h3>
      </div>

      {events.length === 0 ?
      <div style={{
        padding: "32px 20px", textAlign: "center",
        background: KycSP.cardSubtle, borderRadius: 16,
        color: KycSP.muted, fontSize: 13, fontWeight: 500
      }}>Aucune action enregistrée — dossier non démarré.</div> :

      <div style={{ display: "flex", flexDirection: "column" }}>
          {events.map((ev, i) =>
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 16,
          paddingBottom: i === events.length - 1 ? 0 : 18,
          position: "relative"
        }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
              width: 10, height: 10, borderRadius: 999, background: KycSP.black, flexShrink: 0,
              boxShadow: "0 0 0 4px rgba(11,12,14,0.06)"
            }} />
                {i < events.length - 1 &&
            <div style={{ width: 2, flex: 1, background: KycSP.cardSubtle, marginTop: 4 }} />
            }
              </div>
              <div>
                <div style={{
              fontSize: 13.5, fontWeight: 700, color: KycSP.ink,
              letterSpacing: -0.1, marginBottom: 2
            }}>{ev.label}</div>
                <div style={{ fontSize: 11.5, color: KycSP.muted, fontWeight: 500 }}>
                  {fmt(ev.at)} · {ev.actor}
                </div>
                {ev.note &&
            <div style={{
              fontSize: 12, color: KycSP.inkSoft, fontWeight: 500, marginTop: 6, lineHeight: 1.5
            }}>{ev.note}</div>
            }
              </div>
            </div>
        )}
        </div>
      }

      <div style={{
        marginTop: 24, paddingTop: 18, borderTop: `1px solid ${KycSP.cardSubtle}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 12, color: KycSP.muted, fontWeight: 500
      }}>
        <span>Traçabilité conservée 10 ans (art. 7 LBA)</span>
        <KycGhostPill icon={<KycIcon name="download" size={14} stroke={KycSP.inkSoft} />}>
          Exporter PDF horodaté
        </KycGhostPill>
      </div>
    </div>);

};

// ─── Vue détail (dossier sélectionné) ──────────────────────────────────
const KycDossierDetail = ({ dossier, contact, onBack, onMarkVerified, onMarkAll }) => {
  const checkKeys = ["id", "address", "pep", "sanctions", "funds"];
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <KycDossierHero dossier={dossier} contact={contact} onBack={onBack} />

      <div style={{
        fontSize: 11, fontWeight: 600, color: KycSP.muted,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14
      }}>5 contrôles obligatoires (LBA art. 3-7)</div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24
      }}>
        {checkKeys.map((k) =>
        <KycCheckCard key={k} checkKey={k} check={dossier.checks[k] || { status: "pending" }}
          onMarkVerified={() => onMarkVerified && onMarkVerified(k)} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <KycDocsSection docs={dossier.documents || []} />
        <KycAuditTrail dossier={dossier} contact={contact} />
      </div>

      {/* Actions principales bas de page */}
      <div style={{
        marginTop: 32, padding: "24px 32px",
        background: KycSP.card, borderRadius: 22,
        boxShadow: KycSP.shadow,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: KycSP.ink }}>
            {dossier.status === "verified" ? "Dossier vérifié — transaction autorisée" : "Compléter pour débloquer les étapes du pipeline"}
          </div>
          <div style={{ fontSize: 12, color: KycSP.muted, fontWeight: 500, marginTop: 2 }}>
            {dossier.status === "verified" ?
            "Un re-screening est conseillé dans les 12 mois." :
            "Le contact ne pourra pas passer en \"Intérêt confirmé\" tant que ce dossier n'est pas validé."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <KycGhostPill icon={<KycIcon name="refresh" size={14} stroke={KycSP.inkSoft} />}>
            Re-screener
          </KycGhostPill>
          {dossier.status !== "verified" ?
          <KycBlackPill size="md" onClick={onMarkAll} icon={<KycIcon name="checkAll" size={14} stroke="#fff" />}>
              Tout marquer vérifié
            </KycBlackPill> :

          <KycBlackPill size="md" icon={<KycIcon name="download" size={14} stroke="#fff" />}>
              Exporter dossier complet
            </KycBlackPill>
          }
        </div>
      </div>
    </div>);

};

// ─── Vue liste (par défaut) ────────────────────────────────────────────
const KycListView = ({ onOpen, filter, setFilter, onNewDossier }) => {
  const dossiers = window.KYC_DOSSIERS || [];
  const contacts = window.CRM_CONTACTS || [];

  const stats = {
    verified: dossiers.filter((d) => d.status === "verified").length,
    pending: dossiers.filter((d) => d.status === "pending").length,
    none: dossiers.filter((d) => d.status === "none").length,
    risk: dossiers.filter((d) => d.riskLevel === "high" || d.riskLevel === "medium").length
  };

  const filtered = dossiers.filter((d) => {
    if (filter === "all") return true;
    if (filter === "blocking") return d.status !== "verified";
    if (filter === "verified") return d.status === "verified";
    if (filter === "pending") return d.status === "pending";
    if (filter === "none") return d.status === "none";
    if (filter === "risk") return d.riskLevel === "high";
    return true;
  });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end",
        marginBottom: 36, animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both"
      }}>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: KycSP.muted,
            letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14
          }}></div>
          <h1 style={{
            margin: "0 0 12px", fontSize: 40, fontWeight: 700,
            color: KycSP.ink, letterSpacing: -0.8, lineHeight: 1.05
          }}>Dossiers KYC.</h1>
          <p style={{
            margin: 0, fontSize: 15, color: KycSP.inkSoft, fontWeight: 500,
            lineHeight: 1.55, maxWidth: 580
          }}>
            Toute transaction immobilière en Suisse exige une vérification documentée de l'identité, du domicile et de l'origine des fonds.
            Un dossier non-vérifié bloque automatiquement la progression dans le pipeline.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <KycGhostPill icon={<KycIcon name="download" size={14} stroke={KycSP.inkSoft} />}>
            Exporter
          </KycGhostPill>
          <KycBlackPill size="lg" onClick={onNewDossier} icon={<KycIcon name="plus" size={16} stroke="#fff" sw={2} />}>
            Nouveau dossier
          </KycBlackPill>
        </div>
      </div>

      {/* STATS BENTO */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 36,
        animation: "sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both"
      }}>
        <KycStatCard label="Vérifiés" value={stats.verified} accent="#10B981"
        sub="Transactions autorisées" />
        <KycStatCard label="En cours" value={stats.pending} accent="#F59E0B"
        sub="Pièces manquantes ou screening en attente" />
        <KycStatCard label="À démarrer" value={stats.none} accent="#7A8088"
        sub="Aucun document collecté" />
        <KycStatCard label="Vigilance" value={stats.risk} accent="#EF4444"
        sub="Risque modéré ou élevé identifié" />
      </div>

      {/* FILTRES */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap",
        animation: "sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both"
      }}>
        <KycGhostPill active={filter === "all"} onClick={() => setFilter("all")}>Tous · {dossiers.length}</KycGhostPill>
        <KycGhostPill active={filter === "blocking"} onClick={() => setFilter("blocking")}
        icon={<KycIcon name="lock" size={13} stroke={filter === "blocking" ? "#fff" : KycSP.inkSoft} />}>
          Bloquants pipeline · {dossiers.filter((d) => d.status !== "verified").length}
        </KycGhostPill>
        <KycGhostPill active={filter === "pending"} onClick={() => setFilter("pending")}>En cours · {stats.pending}</KycGhostPill>
        <KycGhostPill active={filter === "none"} onClick={() => setFilter("none")}>À démarrer · {stats.none}</KycGhostPill>
        <KycGhostPill active={filter === "verified"} onClick={() => setFilter("verified")}>Vérifiés · {stats.verified}</KycGhostPill>
        <KycGhostPill active={filter === "risk"} onClick={() => setFilter("risk")}>Risque élevé · {dossiers.filter((d) => d.riskLevel === "high").length}</KycGhostPill>
      </div>

      {/* LISTE */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        animation: "sgFadeUp .65s cubic-bezier(.2,.8,.2,1) both"
      }}>
        {filtered.map((d) => {
          const contact = contacts.find((c) => c.id === d.contactId);
          if (!contact) return null;
          return <KycDossierRow key={d.id} dossier={d} contact={contact} onOpen={() => onOpen(d.id)} />;
        })}
        {filtered.length === 0 &&
        <div style={{
          padding: "60px 32px", textAlign: "center",
          background: KycSP.card, borderRadius: 22, boxShadow: KycSP.shadow,
          color: KycSP.muted, fontSize: 14, fontWeight: 500
        }}>Aucun dossier ne correspond à ce filtre.</div>
        }
      </div>
    </div>);

};

// ─── ÉCRAN PRINCIPAL ───────────────────────────────────────────────────
const CRMScreenKycSugar = ({ t, dense, aiLevel, dark, darkTone, setDark, onNavigate, onCmd, screen }) => {
  const sp = window.crmSugarPalette && window.crmSugarPalette(t, dark, darkTone) || {
    pageBg: KycSP.bg, ink: KycSP.ink, soft: KycSP.inkSoft, sub: KycSP.muted,
    iconBtnBg: KycSP.card, shadow: KycSP.shadow, frameBg: KycSP.card
  };

  const [selectedId, setSelectedId] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardInitialContact, setWizardInitialContact] = React.useState(null);
  const [, setRev] = React.useState(0);
  const bump = () => setRev(x => x + 1);

  // ─── Deep-link depuis la fiche contact ────────────────────────────────
  // window.__kycOpenForContactId est posé par la KYC card de la fiche
  // contact. À l'arrivée sur cet écran : on ouvre directement le dossier
  // existant, ou le wizard pré-rempli si le contact n'a pas encore de dossier.
  React.useEffect(() => {
    const cid = window.__kycOpenForContactId;
    if (!cid) return;
    window.__kycOpenForContactId = null;
    const existing = (window.KYC_DOSSIERS || []).find(d => d.contactId === cid && d.status !== "none");
    if (existing) {
      setSelectedId(existing.id);
    } else {
      setWizardInitialContact(cid);
      setWizardOpen(true);
    }
  }, []);

  // ─── Marquer un contrôle comme vérifié ────────────────────────────────
  const markVerified = (checkKey) => {
    if (!selectedId) return;
    const dossier = (window.KYC_DOSSIERS || []).find(d => d.id === selectedId);
    if (!dossier) return;
    const now = new Date().toISOString();
    const prevNote = dossier.checks[checkKey]?.note;
    dossier.checks[checkKey] = {
      status: "verified", at: now, by: "agt-1",
      note: prevNote || "Vérifié manuellement par l'agent.",
    };
    // Mise à jour automatique du statut du dossier
    const allChecks = Object.values(dossier.checks);
    const allDone = allChecks.every(c => c.status === "verified" || c.status === "na");
    if (allDone) {
      dossier.status = "verified";
      dossier.verifiedAt = now;
      // expire dans 12 mois
      const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
      dossier.expiresAt = exp.toISOString();
    } else if (dossier.status === "none") {
      dossier.status = "pending";
      dossier.createdAt = dossier.createdAt || now;
    }
    bump();
  };

  const markAll = () => {
    if (!selectedId) return;
    const dossier = (window.KYC_DOSSIERS || []).find(d => d.id === selectedId);
    if (!dossier) return;
    Object.keys(dossier.checks).forEach(k => {
      const c = dossier.checks[k];
      if (c.status !== "verified" && c.status !== "na") {
        markVerified(k);
      }
    });
    // markVerified appelle bump à chaque fois, mais la mutation est synchrone
    // donc le dernier bump suffira à re-render avec le statut final "verified".
  };

  const selected = selectedId ? (window.KYC_DOSSIERS || []).find((d) => d.id === selectedId) : null;
  const selectedContact = selected ? (window.CRM_CONTACTS || []).find((c) => c.id === selected.contactId) : null;

  return (
    <div data-screen-label="CRM KYC (sugar)" style={{
      minHeight: "100vh", width: "100%",
      background: KycSP.bgGradient,
      fontFamily: "Manrope, system-ui, sans-serif", color: KycSP.ink
    }}>
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {window.SugarTopNav &&
      <window.SugarTopNav active="kyc" t={t} sp={sp} dark={dark}
      onNavigate={onNavigate} onCmd={onCmd} />
      }

      <main style={{ padding: "32px 40px 120px" }}>
        {selected && selectedContact ?
        <KycDossierDetail dossier={selected} contact={selectedContact}
          onBack={() => setSelectedId(null)}
          onMarkVerified={markVerified}
          onMarkAll={markAll} /> :

        <KycListView onOpen={setSelectedId} filter={filter} setFilter={setFilter}
          onNewDossier={() => setWizardOpen(true)} />
        }
      </main>

      {wizardOpen && window.CRMKycWizard && (
        <window.CRMKycWizard
          initialContactId={wizardInitialContact}
          onClose={() => { setWizardOpen(false); setWizardInitialContact(null); }}
          onCreated={(id) => { setSelectedId(id); setWizardOpen(false); setWizardInitialContact(null); }} />
      )}
    </div>);

};

window.CRMScreenKycSugar = CRMScreenKycSugar;