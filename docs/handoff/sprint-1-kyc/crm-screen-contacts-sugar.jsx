// MEGGA CRM — Contacts screen, Sugar visual style.
// Split view : liste à gauche (segments + filtres + lignes denses) + fiche scrollable à droite.
// Reprend exactement le vocabulaire Sugar : palette sp, glass cards, animations sobres.

// ─── Helpers ────────────────────────────────────────────────────────────
function ctScoreColor(score) {
  if (score >= 80) return "#0E9F6E";
  if (score >= 60) return "#0041D9";
  if (score >= 40) return "#F59E0B";
  return "#E53935";
}
function ctTypeLabel(type) {
  return { buyer:"Acheteur", seller:"Vendeur", tenant:"Locataire", landlord:"Propriétaire", mixed:"Mixte" }[type] || type;
}
function ctRelativeTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso), n = new Date();
  const ms = n - d, h = ms / 3600000;
  if (h < 1) return "il y a " + Math.max(1, Math.round(ms/60000)) + " min";
  if (h < 24) return "il y a " + Math.round(h) + " h";
  const j = Math.round(h/24);
  if (j < 7) return "il y a " + j + " j";
  if (j < 30) return "il y a " + Math.round(j/7) + " sem";
  return "il y a " + Math.round(j/30) + " mois";
}
function ctFmtCHF(n) {
  if (n == null) return "—";
  if (n >= 1e6) return "CHF " + (n/1e6).toFixed(n >= 1e7 ? 1 : 2) + "M";
  if (n >= 1e3) return "CHF " + (n/1e3).toFixed(0) + "k";
  return "CHF " + n;
}

const CT_SEGMENTS = [
  { id:"all",     label:"Tous" },
  { id:"buyer",   label:"Acheteurs" },
  { id:"seller",  label:"Vendeurs" },
  { id:"tenant",  label:"Locataires" },
  { id:"hot",     label:"Leads chauds" },
  { id:"kyc",     label:"KYC à compléter" },
  { id:"stale",   label:"Sans activité 14j+" },
];

// ─── Liste — segments ─────────────────────────────────────────────────
const CtSegment = ({ id, label, count, active, onClick, sp }) => (
  <button onClick={onClick} style={{
    height: 30, padding: "0 12px", borderRadius: 999,
    border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
    background: active ? sp.ink : sp.cardBg,
    color: active ? sp.pageBg : sp.ink,
    fontSize: 12, fontWeight: active ? 700 : 500,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 6,
    flexShrink: 0,
  }}>
    {label}
    <span style={{
      fontSize: 10, fontWeight: 700,
      background: active ? "rgba(255,255,255,.2)" : sp.cardSubBg,
      color: active ? sp.pageBg : sp.sub,
      padding: "1px 6px", borderRadius: 999,
      fontVariantNumeric: "tabular-nums",
    }}>{count}</span>
  </button>
);

// ─── Liste — ligne contact ─────────────────────────────────────────────
const CtRow = ({ contact, deal, selected, onSelect, sp, dark }) => {
  const [hov, setHov] = React.useState(false);
  const score = contact.score || 0;
  const scoreColor = ctScoreColor(score);
  const kycMap = {
    none:     { color:"#F59E0B", label:"KYC à démarrer" },
    pending:  { color:"#F59E0B", label:"KYC en cours" },
    verified: { color:"#0E9F6E", label:"KYC vérifié" },
    stale:    { color:"#F59E0B", label:"KYC à re-screener" },
  };
  const kyc = kycMap[contact.kyc?.status || "none"];
  const stage = deal ? CRM_STAGES[deal.stage] : null;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", textAlign: "left",
        padding: "12px 14px",
        background: selected
          ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,65,217,.06)")
          : (hov ? sp.cardSubBg : "transparent"),
        border: 0,
        borderLeft: `3px solid ${selected ? "#0041D9" : "transparent"}`,
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 12,
        transition: "background .12s, border-color .12s",
      }}>
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 999,
        background: contact.avatarBg || "#0041D9", color: "#fff",
        fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center",
        border: `2px solid ${sp.avatarBorder}`,
        flexShrink: 0,
      }}>{crmInitials(contact.firstName + " " + contact.lastName)}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: 13.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0,
          }}>{contact.firstName} {contact.lastName}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: scoreColor,
            fontVariantNumeric: "tabular-nums", flexShrink: 0,
          }}>{score}</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: sp.sub, fontWeight: 500,
        }}>
          <span style={{
            color: contact.type === "buyer" ? "#0041D9" : contact.type === "seller" ? "#B45309" : sp.soft,
            fontWeight: 600,
          }}>{ctTypeLabel(contact.type)}</span>
          <span style={{ color: sp.sub }}>·</span>
          <span style={{
            display:"inline-flex", alignItems:"center", gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: kyc.color, flexShrink: 0 }} />
            <span style={{ color: sp.sub }}>{ctRelativeTime(contact.lastActivityAt)}</span>
          </span>
        </div>
        {stage && (
          <div style={{
            marginTop: 4,
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10.5, color: sp.soft, fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: stage.color }} />
            {stage.label}
          </div>
        )}
      </div>
    </button>
  );
};

// ─── AI suggestion bubble (Sugar) ──────────────────────────────────────
const CtAiBubble = ({ title, body, cta, sp, dark }) => (
  <div style={{
    padding: "12px 14px", borderRadius: 14,
    background: dark
      ? "linear-gradient(135deg, rgba(74,120,240,.12), rgba(139,92,246,.06))"
      : "linear-gradient(135deg, rgba(0,65,217,.06), rgba(139,92,246,.04))",
    border: `1px solid ${dark ? "rgba(74,120,240,.25)" : "rgba(0,65,217,.18)"}`,
    display: "flex", gap: 12, alignItems: "flex-start",
    marginBottom: 14,
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 9, flexShrink: 0,
      background: "linear-gradient(135deg, #0041D9, #8B5CF6)",
      display: "grid", placeItems: "center",
    }}>
      <CRMIcon name="spark" size={13} stroke="#fff" />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: sp.soft, lineHeight: 1.5, marginBottom: 8 }}>{body}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={{
          height: 26, padding: "0 12px", borderRadius: 8,
          background: sp.ink, color: sp.pageBg, border: 0,
          fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{cta}</button>
        <button style={{
          height: 26, padding: "0 12px", borderRadius: 8,
          background: "transparent", color: sp.sub,
          border: `1px solid ${sp.cardBorder}`,
          fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>Plus tard</button>
      </div>
    </div>
  </div>
);

// ─── Section card ──────────────────────────────────────────────────────
// Bento Sugar : container glass + titre interne + action.
// Toute carte d'info dans la fiche détail utilise ce pattern pour cohérence visuelle.
const CtBento = ({ title, action, children, sp, padding = "18px 20px", noTitle, style, span }) => (
  <section style={{
    background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
    borderRadius: 20, boxShadow: sp.shadowSm,
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    padding,
    display: "flex", flexDirection: "column",
    gridColumn: span === 2 ? "span 2" : undefined,
    boxSizing: "border-box",
    ...style,
  }}>
    {!noTitle && (
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <h3 style={{
          margin: 0, fontSize: 11, fontWeight: 700, color: sp.sub,
          letterSpacing: 0.6, textTransform: "uppercase",
        }}>{title}</h3>
        <div style={{ flex: 1, height: 1, background: sp.cardBorder }} />
        {action}
      </header>
    )}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {children}
    </div>
  </section>
);

// Inner card (sous-bloc dans un bento) — bordure légère, pas de shadow
const CtCard = ({ children, sp, padding = "12px 14px", style, fill }) => (
  <div style={{
    background: sp.cardSubBg || "transparent",
    border: `1px solid ${sp.cardBorder}`,
    borderRadius: 12,
    padding,
    height: fill ? "100%" : "auto",
    boxSizing: "border-box",
    ...style,
  }}>{children}</div>
);

// Backwards-compat alias (les autres composants utilisent CtSection)
const CtSection = ({ title, action, children, sp }) => (
  <CtBento title={title} action={action} sp={sp}>{children}</CtBento>
);

const CtKv = ({ label, value, mono, sp }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 0", minWidth: 0 }}>
    <span style={{ width: 72, fontSize: 11, color: sp.sub, fontWeight: 600, flexShrink: 0 }}>{label}</span>
    <span style={{
      fontSize: 12.5, color: sp.ink, fontWeight: 600,
      fontFamily: mono ? "JetBrains Mono, monospace" : "inherit",
      fontVariantNumeric: mono ? "tabular-nums" : "normal",
      minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      flex: 1,
    }}>{value}</span>
  </div>
);

const CtChip = ({ children, color, sp, dark }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 10px", borderRadius: 999,
    background: color ? color + (dark ? "33" : "1A") : sp.cardSubBg,
    color: color || sp.soft,
    fontSize: 11, fontWeight: 600,
    border: `1px solid ${color ? color + (dark ? "55" : "33") : sp.cardBorder}`,
  }}>{children}</span>
);

// ─── Critères acheteur ────────────────────────────────────────────────
const CtCriteria = ({ contact, sp, dark }) => {
  const c = contact.criteria;
  if (!c) return null;
  const budgetLabel = c.budgetMin
    ? `${ctFmtCHF(c.budgetMin)} – ${ctFmtCHF(c.budgetMax)}`
    : `≤ ${ctFmtCHF(c.budgetMax)}`;
  return (
    <CtCard sp={sp} padding="6px 16px">
      <CtKv sp={sp} label="Transaction" value={c.transaction === "vente" ? "Achat" : "Location"} />
      <CtKv sp={sp} label="Type" value={(c.types || []).map(t => t[0].toUpperCase()+t.slice(1)).join(", ") || "—"} />
      <CtKv sp={sp} label="Zones" value={[...(c.cities || []), ...(c.cantons || [])].join(" · ") || "—"} />
      <CtKv sp={sp} label="Budget" value={budgetLabel} mono />
      <CtKv sp={sp} label="Surface" value={c.areaMin ? `≥ ${c.areaMin} m²` : "—"} mono />
      <CtKv sp={sp} label="Pièces" value={c.roomsMin ? `≥ ${c.roomsMin}` : "—"} mono />
      {(c.mustHave?.length > 0 || c.niceToHave?.length > 0) && (
        <div style={{ padding: "10px 0 12px", borderTop: `1px solid ${sp.cardBorder}` }}>
          {c.mustHave?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Indispensable</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.mustHave.map(m => <CtChip key={m} sp={sp} dark={dark} color="#0041D9">{m}</CtChip>)}
              </div>
            </div>
          )}
          {c.niceToHave?.length > 0 && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Souhaité</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.niceToHave.map(m => <CtChip key={m} sp={sp} dark={dark}>{m}</CtChip>)}
              </div>
            </div>
          )}
        </div>
      )}
    </CtCard>
  );
};

// ─── Matchs liste ─────────────────────────────────────────────────────
const CtMatches = ({ contact, sp, dark }) => {
  const matches = CRM_MATCHES.filter(m => m.contactId === contact.id).sort((a,b) => b.score - a.score);
  if (matches.length === 0) {
    return <CtCard sp={sp} padding="20px 16px">
      <div style={{ fontSize: 12.5, color: sp.sub, textAlign: "center" }}>
        Aucun match calculé pour ce contact.
      </div>
    </CtCard>;
  }
  return (
    <CtCard sp={sp} padding="6px 8px">
      {matches.map((m, i) => {
        const b = crmBienById(m.bienId);
        if (!b) return null;
        const dot = m.score >= 85 ? "#0E9F6E" : m.score >= 70 ? "#F59E0B" : "#E53935";
        const statusLabel = { "to-send":"À envoyer", "sent":"Envoyé", "viewed":"Vu", "liked":"Aimé", "rejected":"Rejeté" }[m.status] || "—";
        return (
          <div key={i} style={{
            padding: "10px 10px",
            borderBottom: i < matches.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: 56, flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flexShrink: 0 }} />
              <span style={{
                fontSize: 16, fontWeight: 800, color: sp.ink,
                letterSpacing: -0.4, fontVariantNumeric: "tabular-nums",
              }}>{m.score}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 700, color: sp.ink,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{b.title}</div>
              <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                {b.rooms}p · {b.area}m² · {b.price ? ctFmtCHF(b.price) : ctFmtCHF(b.rent) + "/mois"}
              </div>
            </div>
            <span style={{ fontSize: 11, color: sp.sub, fontWeight: 600, flexShrink: 0 }}>{statusLabel}</span>
            <button style={{
              height: 28, padding: "0 12px", borderRadius: 8,
              background: m.status === "to-send" ? "#0041D9" : sp.cardBg,
              color: m.status === "to-send" ? "#fff" : sp.ink,
              border: `1px solid ${m.status === "to-send" ? "#0041D9" : sp.cardBorder}`,
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              flexShrink: 0,
            }}>{m.status === "to-send" ? "Envoyer" : "Ouvrir"}</button>
          </div>
        );
      })}
    </CtCard>
  );
};

// ─── Activity timeline ────────────────────────────────────────────────
const CtActivity = ({ contact, sp, fill }) => {
  const items = CRM_ACTIVITY.filter(a => a.contactId === contact.id);
  // Mock fallback si peu d'activité
  const all = items.length > 0 ? items : [
    { id:"mock-1", at:"2026-04-29T15:32:00", kind:"note", text:"Notes synchronisées depuis l'agenda." },
    { id:"mock-2", at:"2026-04-25T11:00:00", kind:"call", text:"Premier appel de qualification — 12 min." },
    { id:"mock-3", at:"2026-04-20T09:00:00", kind:"lead-in", text:"Contact créé via " + (contact.source || "import") + "." },
  ];
  const iconFor = (k) => ({
    "ai-action":"spark", "email-open":"mail", "visit":"home", "note":"file",
    "doc-signed":"check", "call":"phone", "offer":"flag", "lead-in":"plus",
    "match-sent":"matching",
  }[k] || "msg");
  const colorFor = (k) => ({
    "ai-action":"#8B5CF6", "visit":"#0041D9", "doc-signed":"#0E9F6E",
    "offer":"#8B5CF6", "lead-in":"#10B981", "call":"#06B6D4", "email-open":"#F59E0B",
  }[k] || "#7A8079");

  return (
    <CtCard sp={sp} padding="6px 14px" fill={fill} style={fill ? { overflowY: "auto" } : null}>
      {all.map((a, i) => (
        <div key={a.id} style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "10px 0",
          borderBottom: i < all.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, flexShrink: 0,
            background: colorFor(a.kind) + "1A",
            display: "grid", placeItems: "center",
          }}>
            <CRMIcon name={iconFor(a.kind)} size={12} stroke={colorFor(a.kind)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: sp.ink, lineHeight: 1.45 }}>{a.text}</div>
            <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 2, fontWeight: 600 }}>
              {ctRelativeTime(a.at)}
            </div>
          </div>
        </div>
      ))}
    </CtCard>
  );
};

// ─── Activity composer ───────────────────────────────────────────────
const CtComposer = ({ sp, dark, fill }) => {
  const [tab, setTab] = React.useState("note");
  const [val, setVal] = React.useState("");
  const tabs = [
    { k:"note",  label:"Note",   icon:"file" },
    { k:"call",  label:"Appel",  icon:"phone" },
    { k:"email", label:"Email",  icon:"mail" },
    { k:"task",  label:"Tâche",  icon:"check" },
  ];
  const placeholders = {
    note:  "Ajouter une note rapide…",
    call:  "Résumer un appel — points clés, prochaine étape…",
    email: "Sujet + corps de l'email…",
    task:  "Tâche à faire — date, qui ?",
  };
  return (
    <CtCard sp={sp} padding="10px 12px" fill={fill}
      style={fill ? { display: "flex", flexDirection: "column" } : { marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexShrink: 0 }}>
        {tabs.map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)} style={{
            height: 28, padding: "0 10px", borderRadius: 8,
            background: tab === tb.k ? sp.ink : "transparent",
            color: tab === tb.k ? sp.pageBg : sp.soft,
            border: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: 11.5, fontWeight: tab === tb.k ? 700 : 500,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <CRMIcon name={tb.icon} size={11} stroke={tab === tb.k ? sp.pageBg : sp.soft} />
            {tb.label}
          </button>
        ))}
      </div>
      <textarea
        value={val} onChange={e => setVal(e.target.value)}
        placeholder={placeholders[tab]}
        style={{
          width: "100%",
          flex: fill ? 1 : "none",
          minHeight: fill ? 0 : 56, resize: fill ? "none" : "vertical",
          background: "transparent", border: 0, outline: "none",
          color: sp.ink, fontSize: 12.5, fontFamily: "inherit", lineHeight: 1.5,
          padding: 0,
        }} />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: `1px solid ${sp.cardBorder}`, paddingTop: 8, marginTop: 6, flexShrink: 0,
      }}>
        <button style={{
          height: 26, padding: "0 10px", borderRadius: 8,
          background: "transparent", color: sp.sub,
          border: `1px solid ${sp.cardBorder}`,
          fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <CRMIcon name="spark" size={11} stroke={sp.sub} />
          Suggérer avec MEGGA AI
        </button>
        <button style={{
          height: 28, padding: "0 14px", borderRadius: 8,
          background: "#0041D9", color: "#fff", border: 0,
          fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Enregistrer</button>
      </div>
    </CtCard>
  );
};

// ─── Deals liés ────────────────────────────────────────────────────
const CtDeals = ({ contact, sp, fill }) => {
  const deals = CRM_DEALS.filter(d => d.contactId === contact.id);
  if (deals.length === 0) {
    return <CtCard sp={sp} padding="20px 16px">
      <div style={{ fontSize: 12.5, color: sp.sub, textAlign: "center" }}>
        Aucun deal en cours pour ce contact.
        <button style={{
          marginTop: 10, height: 28, padding: "0 14px", borderRadius: 8,
          background: sp.ink, color: sp.pageBg, border: 0,
          fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          display: "block", margin: "10px auto 0",
        }}>+ Nouveau deal</button>
      </div>
    </CtCard>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: fill ? "100%" : "auto" }}>
      {deals.map(d => {
        const stage = CRM_STAGES[d.stage];
        const b = d.bienId ? crmBienById(d.bienId) : null;
        const riskColor = d.risk === "at-risk" ? "#F59E0B" : d.risk === "stalled" ? "#E53935" : "#0E9F6E";
        return (
          <CtCard key={d.id} sp={sp} padding="12px 14px">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: stage.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: sp.soft }}>{stage.label}</span>
                  <span style={{ fontSize: 10, color: sp.sub }}>· {d.probability}%</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, color: riskColor,
                    padding: "2px 8px", borderRadius: 999,
                    background: riskColor + "1A",
                  }}>{d.risk === "at-risk" ? "À risque" : d.risk === "stalled" ? "Bloqué" : "Sain"}</span>
                </div>
                <div style={{
                  fontSize: 13.5, fontWeight: 700, color: sp.ink, marginBottom: 4,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{b ? b.title : "Recherche active"}</div>
                <div style={{
                  fontSize: 17, fontWeight: 800, color: sp.ink, letterSpacing: -0.4,
                  fontVariantNumeric: "tabular-nums", marginBottom: 8,
                }}>{d.value ? ctFmtCHF(d.value) : "—"}</div>
                {d.nextAction && (
                  <div style={{
                    padding: "6px 10px", borderRadius: 8,
                    background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
                    fontSize: 11, color: sp.soft, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <CRMIcon name={d.nextAction.kind === "call" ? "phone" : d.nextAction.kind === "visit" ? "home" : d.nextAction.kind === "kyc" ? "kyc" : "flag"} size={11} stroke={sp.soft} />
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nextAction.note}</span>
                    <span style={{ fontSize: 10, color: sp.sub, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {d.nextAction.dueAt.slice(5,10).split("-").reverse().join("/")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CtCard>
        );
      })}
    </div>
  );
};

// ─── Stats vendeur (au lieu de critères) ─────────────────────────────
const CtSellerStats = ({ contact, sp }) => {
  const biens = CRM_BIENS.filter(b => b.ownerContactId === contact.id);
  if (biens.length === 0) {
    return <CtCard sp={sp} padding="20px 16px">
      <div style={{ fontSize: 12.5, color: sp.sub, textAlign: "center" }}>
        Aucun bien actif sous mandat.
      </div>
    </CtCard>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {biens.map(b => (
        <CtCard key={b.id} sp={sp} padding="12px 14px">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: b.accent + "1A", display: "grid", placeItems: "center",
            }}>
              <CRMIcon name="bien" size={16} stroke={b.accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: sp.ink,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{b.title}</div>
              <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1 }}>
                {b.ref} · Mandat {b.mandat?.type} · {b.mandat?.commission}%
              </div>
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: sp.ink, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {ctFmtCHF(b.price)}
            </span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
            paddingTop: 10, borderTop: `1px solid ${sp.cardBorder}`,
          }}>
            {[
              { label: "Vues",   value: b.stats.views, icon: "eye" },
              { label: "Favoris", value: b.stats.favorites, icon: "star" },
              { label: "Visites", value: b.stats.visitRequests, icon: "home" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: sp.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: sp.sub, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </CtCard>
      ))}
    </div>
  );
};

// ─── KYC card ─────────────────────────────────────────────────────────
// Mode non-bloquant : affiche l'état du dossier sans jamais empêcher d'action.
// Mini-stepper 6 étapes (Identité → Béné. → Fonds → Screening → Risque → Validation)
// + 3 KPIs (Risque, Pièces, Dernier screening) + CTA contextuel.
const CtKyc = ({ contact, sp, fill }) => {
  const status = contact.kyc?.status || "none";
  const k = contact.kyc || {};

  // Inférence de progression : pour la démo on dérive un step actif du status
  const stepByStatus = {
    none: 0,        // rien démarré
    pending: 3,     // screening en cours
    stale: 5,       // tout fait mais à re-screener
    verified: 6,    // tout fait
  };
  const activeStep = k.activeStep != null ? k.activeStep : (stepByStatus[status] ?? 0);
  const STEPS = ["Identité", "Béné.", "Fonds", "Screening", "Risque", "Validation"];

  const header = {
    none:     { tone:"#F59E0B", soft:"#FFF4E0", label:"À démarrer", hint:"Vous pouvez continuer à travailler ce dossier — pensez à le compléter avant la signature." },
    pending:  { tone:"#F59E0B", soft:"#FFF4E0", label:"En cours",   hint:"Vérifications en attente · délai habituel 24-48h." },
    verified: { tone:"#0E9F6E", soft:"#E5F4EC", label:"Validé",     hint:`Risque ${k.riskLevel || "Faible"} · dernier screening ${k.lastScreenedAt || "—"}.` },
    stale:    { tone:"#F59E0B", soft:"#FFF4E0", label:"À re-screener", hint:"Sanctions/PEP à rafraîchir — recommandé après 12 mois ou changement de situation." },
  };
  const h = header[status];

  const cta = {
    none:     "Démarrer le dossier KYC",
    pending:  "Voir le dossier",
    verified: "Consulter le dossier",
    stale:    "Relancer le screening",
  }[status];

  // KPIs
  const docsTotal = 6;
  const docsDone = k.docsDone != null ? k.docsDone : { none:0, pending:3, verified:6, stale:6 }[status];
  const riskValue = k.riskScore != null ? k.riskScore : (status === "verified" || status === "stale" ? 14 : null);
  const riskLabel = k.riskLevel || (riskValue != null ? (riskValue < 25 ? "Faible" : riskValue < 60 ? "Modéré" : "Élevé") : "—");
  const riskColor = riskValue == null ? sp.sub : riskValue < 25 ? "#0E9F6E" : riskValue < 60 ? "#F59E0B" : "#E53935";
  const lastScreen = k.lastScreenedAt || (status === "verified" ? "12.04.26" : status === "stale" ? "03.02.25" : "—");

  return (
    <CtCard sp={sp} padding="14px 16px" fill={fill}>
      {/* Header : statut + hint */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: h.soft, display: "grid", placeItems: "center",
        }}>
          <CRMIcon name="kyc" size={14} stroke={h.tone} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, display: "flex", alignItems: "center", gap: 8 }}>
            Conformité KYC / LBA
            <span style={{
              padding: "2px 8px", borderRadius: 999, background: h.soft, color: h.tone,
              fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2,
            }}>{h.label}</span>
          </div>
          <div style={{ fontSize: 11, color: sp.soft, marginTop: 2, lineHeight: 1.45 }}>{h.hint}</div>
        </div>
      </div>

      {/* Mini-stepper horizontal */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 14 }}>
        {STEPS.map((l, i) => {
          const done = i < activeStep;
          const active = i === activeStep && status !== "verified";
          return (
            <React.Fragment key={l}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 999,
                  background: done ? "#0E9F6E" : active ? sp.ink : sp.cardSubBg,
                  color: "#fff", display: "grid", placeItems: "center",
                  boxShadow: active ? `0 0 0 3px ${sp.cardSubBg}` : "none",
                  border: !done && !active ? `1px solid ${sp.cardBorder}` : 0,
                }}>
                  {done && <CRMIcon name="check" size={8} stroke="#fff" />}
                </div>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, textAlign: "center",
                  color: done || active ? sp.ink : sp.sub,
                  whiteSpace: "nowrap",
                }}>{l}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  height: 2, flex: 0.5, alignSelf: "center", marginTop: -14,
                  marginLeft: -2, marginRight: -2,
                  background: i < activeStep - 1 ? "#0E9F6E" : sp.cardSubBg,
                }}/>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 3 KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: sp.cardSubBg }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: sp.sub }}>Risque</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: riskColor, marginTop: 2 }}>
            {riskValue != null ? riskValue : "—"}
            <span style={{ fontSize: 10, color: sp.sub, fontWeight: 600, marginLeft: 4 }}>{riskValue != null ? `/ ${riskLabel}` : ""}</span>
          </div>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: sp.cardSubBg }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: sp.sub }}>Pièces</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink, marginTop: 2 }}>
            {docsDone}<span style={{ fontSize: 10, color: sp.sub, fontWeight: 600 }}> / {docsTotal}</span>
          </div>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: sp.cardSubBg }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: sp.sub }}>Dernier screening</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, marginTop: 2 }}>{lastScreen}</div>
        </div>
      </div>

      {/* CTA */}
      <button style={{
        width: "100%", height: 32, borderRadius: 8,
        background: status === "verified" ? "transparent" : "#0041D9",
        color: status === "verified" ? sp.ink : "#fff",
        border: status === "verified" ? `1px solid ${sp.cardBorder}` : 0,
        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <CRMIcon name="kyc" size={12} stroke={status === "verified" ? sp.ink : "#fff"} />
        {cta}
      </button>
    </CtCard>
  );
};

// ─── Modal "Planifier RDV" ────────────────────────────────────────────
// Modal centré glass Sugar. Démo : pas de persistence, juste un toast au save.
const CT_RDV_TYPES = [
  { id: "visit",    label: "Visite",            icon: "home",  color: "#0041D9" },
  { id: "phone",    label: "Téléphone",         icon: "phone", color: "#06B6D4" },
  { id: "video",    label: "Visio",             icon: "msg",   color: "#8B5CF6" },
  { id: "notary",   label: "Signature notaire", icon: "check", color: "#0E9F6E" },
  { id: "other",    label: "Autre",             icon: "cal",   color: "#7A8079" },
];
const CT_RDV_DURATIONS = [15, 30, 45, 60, 90, 120];
const CT_RDV_AGENTS = [
  { id: "gl",  name: "Gregory Lyonnet" },
  { id: "ml",  name: "Mathilde Laurent" },
  { id: "rs",  name: "Romain Saulnier" },
  { id: "ec",  name: "Élodie Chen" },
];

const CtModalPlanRdv = ({ contact, sp, dark, onClose, onSave }) => {
  const [type, setType] = React.useState("visit");
  const today = React.useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [date, setDate] = React.useState(today);
  const [time, setTime] = React.useState("10:00");
  const [duration, setDuration] = React.useState(60);
  const [location, setLocation] = React.useState("");
  const [bienId, setBienId] = React.useState("");
  const [agents, setAgents] = React.useState(["gl"]);
  const [notes, setNotes] = React.useState("");

  // Biens liés au contact (pour acheteur : matchs ; pour vendeur : ses propres biens)
  const linkedBiens = React.useMemo(() => {
    if (contact?.type === "seller" || contact?.type === "landlord") {
      return CRM_BIENS.filter(b => b.ownerContactId === contact.id);
    }
    const matchedIds = CRM_MATCHES.filter(m => m.contactId === contact?.id).map(m => m.bienId);
    return CRM_BIENS.filter(b => matchedIds.includes(b.id));
  }, [contact]);

  const close = (e) => { e?.stopPropagation?.(); onClose(); };
  const onBackdrop = (e) => { if (e.target === e.currentTarget) close(); };
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    onSave?.({ type, date, time, duration, location, bienId, agents, notes });
    onClose();
  };

  const labelStyle = { fontSize: 11, fontWeight: 700, color: sp.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "block" };
  const inputStyle = {
    width: "100%", height: 38, padding: "0 12px", boxSizing: "border-box",
    background: sp.pageBg, border: `1px solid ${sp.cardBorder}`,
    borderRadius: 10, color: sp.ink, fontSize: 13, fontFamily: "inherit", outline: "none",
  };

  const fullName = contact ? contact.firstName + " " + contact.lastName : "";

  return (
    <div
      onMouseDown={onBackdrop}
      role="dialog" aria-modal="true" aria-labelledby="ct-rdv-title"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: dark ? "rgba(0,0,0,0.55)" : "rgba(15,23,42,0.35)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "grid", placeItems: "center", padding: 32,
        animation: "ctModalFade 220ms cubic-bezier(.22,1,.36,1)",
      }}>
      <style>{`
        @keyframes ctModalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctModalLift { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
      `}</style>
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", maxHeight: "calc(100vh - 64px)",
          background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
          borderRadius: 24, boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          display: "flex", flexDirection: "column",
          animation: "ctModalLift 280ms cubic-bezier(.22,1,.36,1)",
          overflow: "hidden",
        }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${sp.cardBorder}`,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: sp.ink, color: sp.pageBg,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <CRMIcon name="cal" size={16} stroke={sp.pageBg} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="ct-rdv-title" style={{
              margin: 0, fontSize: 18, fontWeight: 800, color: sp.ink, letterSpacing: -0.4,
            }}>Planifier un rendez-vous</h2>
            <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>
              avec <strong style={{ color: sp.soft, fontWeight: 700 }}>{fullName}</strong>
            </div>
          </div>
          <button onClick={close} aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 999,
            background: "transparent", border: 0, cursor: "pointer",
            color: sp.sub, fontSize: 20, lineHeight: 1, fontFamily: "inherit",
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Type */}
          <div>
            <label style={labelStyle}>Type de rendez-vous</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {CT_RDV_TYPES.map(rt => {
                const active = type === rt.id;
                return (
                  <button key={rt.id} onClick={() => setType(rt.id)} style={{
                    padding: "10px 6px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                    background: active ? sp.ink : sp.pageBg,
                    border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
                    color: active ? sp.pageBg : sp.ink,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600,
                  }}>
                    <CRMIcon name={rt.icon} size={14} stroke={active ? sp.pageBg : rt.color} />
                    {rt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + heure + durée */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Heure</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Durée</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} style={inputStyle}>
                {CT_RDV_DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Bien associé (si visite ou notaire) */}
          {(type === "visit" || type === "notary") && linkedBiens.length > 0 && (
            <div>
              <label style={labelStyle}>Bien associé</label>
              <select value={bienId} onChange={e => setBienId(e.target.value)} style={inputStyle}>
                <option value="">— Aucun —</option>
                {linkedBiens.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title || b.address || b.id} {b.price ? `· ${ctFmtCHF(b.price)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lieu */}
          {(type === "visit" || type === "notary" || type === "other") && (
            <div>
              <label style={labelStyle}>Lieu</label>
              <input
                type="text" value={location} onChange={e => setLocation(e.target.value)}
                placeholder={type === "visit" ? "Adresse du bien…" : type === "notary" ? "Étude notariale…" : "Adresse ou lieu…"}
                style={inputStyle} />
            </div>
          )}

          {/* Agents */}
          <div>
            <label style={labelStyle}>Agents invités</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CT_RDV_AGENTS.map(a => {
                const active = agents.includes(a.id);
                return (
                  <button key={a.id}
                    onClick={() => setAgents(prev => active ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                    style={{
                      height: 32, padding: "0 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                      background: active ? sp.ink : sp.pageBg,
                      border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
                      color: active ? sp.pageBg : sp.ink,
                      fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                    {active && <span style={{ fontSize: 10 }}>✓</span>}
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes / agenda</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Points à aborder, documents à apporter…"
              style={{
                ...inputStyle, height: 80, padding: "10px 12px",
                resize: "vertical", lineHeight: 1.5,
              }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: `1px solid ${sp.cardBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: dark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)",
        }}>
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 500 }}>
            Esc pour fermer · ⌘⏎ pour enregistrer
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={close} style={{
              height: 38, padding: "0 16px", borderRadius: 999,
              background: "transparent", border: `1px solid ${sp.cardBorder}`,
              color: sp.ink, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Annuler</button>
            <button onClick={handleSave} style={{
              height: 38, padding: "0 18px", borderRadius: 999,
              background: sp.ink, border: 0, color: sp.pageBg,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              boxShadow: sp.focusShadow,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <CRMIcon name="check" size={12} stroke={sp.pageBg} />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Toast minimal ────────────────────────────────────────────────────
const CtToast = ({ message, sp, dark }) => (
  <div style={{
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
    background: sp.ink, color: sp.pageBg,
    padding: "12px 18px", borderRadius: 999,
    fontSize: 13, fontWeight: 600, fontFamily: "inherit",
    boxShadow: "0 12px 32px rgba(15,23,42,0.25)",
    display: "flex", alignItems: "center", gap: 8,
    zIndex: 1100,
    animation: "ctToastIn 280ms cubic-bezier(.22,1,.36,1)",
  }}>
    <style>{`@keyframes ctToastIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    <CRMIcon name="check" size={13} stroke={sp.pageBg} />
    {message}
  </div>
);

// ─── Empty state ──────────────────────────────────────────────────────
const CtEmptyDetail = ({ sp }) => (
  <div style={{
    flex: 1, display: "grid", placeItems: "center",
    padding: 40, color: sp.sub, fontSize: 13,
  }}>
    <div style={{ textAlign: "center", maxWidth: 320 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999, margin: "0 auto 14px",
        background: sp.cardSubBg, display: "grid", placeItems: "center",
        border: `1px solid ${sp.cardBorder}`,
      }}>
        <CRMIcon name="contacts" size={22} stroke={sp.sub} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: sp.ink, marginBottom: 6 }}>Aucun contact sélectionné</div>
      <div style={{ lineHeight: 1.5 }}>Choisissez un contact dans la liste pour voir sa fiche détaillée.</div>
    </div>
  </div>
);

// ─── Détail contact (right pane) ──────────────────────────────────────
const CtDetail = ({ contact, sp, dark }) => {
  const [rdvOpen, setRdvOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const onSaveRdv = (data) => {
    const typeLabel = (CT_RDV_TYPES.find(t => t.id === data.type) || {}).label || "RDV";
    const dt = new Date(data.date + "T" + data.time);
    const fmt = dt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " + data.time;
    setToast(`${typeLabel} planifié — ${fmt}`);
  };

  if (!contact) return <CtEmptyDetail sp={sp} />;

  const fullName = contact.firstName + " " + contact.lastName;
  const initials = crmInitials(fullName);
  const score = contact.score || 0;
  const scoreColor = ctScoreColor(score);
  const isBuyer = contact.type === "buyer" || contact.type === "tenant";
  const isSeller = contact.type === "seller" || contact.type === "landlord";

  const aiSugForContact = CRM_AI_SUGGESTIONS.find(s => s.contactId === contact.id);
  const matchCount = CRM_MATCHES.filter(m => m.contactId === contact.id).length;
  const dealCount = CRM_DEALS.filter(d => d.contactId === contact.id).length;

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header bento — full width */}
      <CtBento sp={sp} noTitle padding="22px 24px">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 999,
            background: contact.avatarBg || "#0041D9", color: "#fff",
            fontSize: 18, fontWeight: 800, display: "grid", placeItems: "center",
            border: `2px solid ${sp.avatarBorder}`,
            boxShadow: `0 6px 18px ${(contact.avatarBg || "#0041D9")}55`,
            flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: sp.ink, letterSpacing: -0.7, lineHeight: 1.05 }}>{fullName}</h1>
              <CtChip sp={sp} dark={dark} color={contact.type === "buyer" ? "#0041D9" : contact.type === "seller" ? "#B45309" : "#06B6D4"}>
                {ctTypeLabel(contact.type)}
              </CtChip>
              <CtChip sp={sp} dark={dark}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: scoreColor }} />
                Score {score}
              </CtChip>
            </div>
            <div style={{ fontSize: 12.5, color: sp.soft, fontWeight: 500 }}>
              <a href={`mailto:${contact.email}`} style={{ color: sp.soft, textDecoration: "none" }}
                onMouseEnter={e => e.currentTarget.style.color = sp.ink}
                onMouseLeave={e => e.currentTarget.style.color = sp.soft}>
                {contact.email}
              </a>
              {" · "}
              <a href={`tel:${(contact.phone || "").replace(/\s/g, "")}`} style={{ color: sp.soft, textDecoration: "none", fontFamily: "JetBrains Mono, monospace" }}
                onMouseEnter={e => e.currentTarget.style.color = sp.ink}
                onMouseLeave={e => e.currentTarget.style.color = sp.soft}>
                {contact.phone}
              </a>
              {" · "}{contact.lang?.toUpperCase()}
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 4 }}>
              Source : {contact.source} · Créé le {(contact.createdAt || "").slice(0,10)} · Dernière activité {ctRelativeTime(contact.lastActivityAt)}
            </div>
            {contact.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {contact.tags.map(tag => <CtChip key={tag} sp={sp} dark={dark}>#{tag}</CtChip>)}
                <button style={{
                  padding: "3px 10px", borderRadius: 999,
                  background: "transparent", border: `1px dashed ${sp.cardBorder}`,
                  color: sp.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>+ Tag</button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setRdvOpen(true)}
              title="Planifier un rendez-vous" aria-label="Planifier un rendez-vous"
              style={{
                height: 36, padding: "0 14px", borderRadius: 999,
                background: dark ? "#FFFFFF" : sp.ink,
                border: 0,
                color: dark ? "#0A0A0F" : sp.pageBg,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                boxShadow: sp.focusShadow, fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 700,
              }}>
              <CRMIcon name="cal" size={13} stroke={dark ? "#0A0A0F" : sp.pageBg} />
              Planifier
            </button>
            <button title="Plus d'actions" aria-label="Plus d'actions" style={{
              width: 36, height: 36, borderRadius: 999,
              background: dark ? "rgba(255,255,255,0.06)" : sp.pageBg,
              border: `1px solid ${sp.cardBorder}`,
              cursor: "pointer", display: "grid", placeItems: "center",
              boxShadow: sp.shadowSm, fontFamily: "inherit",
              color: sp.soft, fontSize: 18, lineHeight: 0,
            }}>···</button>
          </div>
        </div>
      </CtBento>

      {/* AI bubble standalone si dispo */}
      {aiSugForContact && (
        <CtAiBubble sp={sp} dark={dark}
          title={aiSugForContact.title} body={aiSugForContact.body} cta={aiSugForContact.cta} />
      )}

      {/* Première rangée : Activité + Saisie — même hauteur (stretch) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch" }}>
        <CtBento sp={sp} title="Activité récente"
          action={<button style={{ background: "transparent", border: 0, color: sp.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Tout voir</button>}>
          <CtActivity contact={contact} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title="Saisie rapide">
          <CtComposer sp={sp} dark={dark} fill />
        </CtBento>
      </div>

      {/* Grille 2 colonnes — bentos denses, alignés */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Row 1 : Critères (G, hauteur = KYC + Notes) | KYC + Notes (D, empilés) */}
        {isBuyer && contact.criteria && (
          <CtBento sp={sp} title="Critères de recherche"
            style={{ height: "100%" }}
            action={<button style={{ background: "transparent", border: 0, color: sp.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Modifier</button>}>
            <CtCriteria contact={contact} sp={sp} dark={dark} />
          </CtBento>
        )}
        {isSeller && (
          <CtBento sp={sp} title="Mandats & diffusion" style={{ height: "100%" }}>
            <CtSellerStats contact={contact} sp={sp} />
          </CtBento>
        )}

        {/* Colonne droite empilée : KYC + Notes (chacun ~moitié de Critères) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, height: "100%" }}>
          <CtBento sp={sp} title="Conformité KYC / LBA" style={{ flex: 1 }}>
            <CtKyc contact={contact} sp={sp} fill />
          </CtBento>
          <CtBento sp={sp} title="Notes internes" style={{ flex: 1 }}
            action={<button style={{ background: "transparent", border: 0, color: sp.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Modifier</button>}>
            <div style={{ fontSize: 13, color: sp.soft, lineHeight: 1.65 }}>
              {contact.notes || <span style={{ color: sp.sub, fontStyle: "italic" }}>Aucune note pour ce contact.</span>}
            </div>
          </CtBento>
        </div>

        {/* Row 2 : Deals (G) | Préférences (D) */}
        <CtBento sp={sp} title={`Deals · ${dealCount}`}
          action={<button style={{ background: "transparent", border: 0, color: sp.sub, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Nouveau</button>}>
          <CtDeals contact={contact} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title="Préférences" padding="14px 20px">
          <CtKv sp={sp} label="Langue" value={contact.lang?.toUpperCase()} />
          <CtKv sp={sp} label="Canal" value="Email + Tél." />
          <CtKv sp={sp} label="Moment" value="9h–12h sem." />
          <CtKv sp={sp} label="Agent" value="Gregory Lyonnet" />
        </CtBento>

        {/* Row 3 : Matchs span 2 — tableau dense en pleine largeur */}
        {isBuyer && (
          <CtBento sp={sp} span={2} title={`Matchs · ${matchCount}`}
            action={<button style={{ background: "transparent", border: 0, color: "#0041D9", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Tout voir →</button>}>
            <CtMatches contact={contact} sp={sp} dark={dark} />
          </CtBento>
        )}
      </div>

      {rdvOpen && (
        <CtModalPlanRdv contact={contact} sp={sp} dark={dark}
          onClose={() => setRdvOpen(false)}
          onSave={onSaveRdv} />
      )}
      {toast && <CtToast message={toast} sp={sp} dark={dark} />}
    </div>
  );
};

// ─── Liste pane ───────────────────────────────────────────────────────
const CtListPane = ({ contacts, selectedId, onSelect, segment, setSegment, search, setSearch, sort, setSort, sp, dark, onNewContact }) => {
  const segmentCounts = React.useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    return {
      all:    CRM_CONTACTS.length,
      buyer:  CRM_CONTACTS.filter(c => c.type === "buyer").length,
      seller: CRM_CONTACTS.filter(c => c.type === "seller").length,
      tenant: CRM_CONTACTS.filter(c => c.type === "tenant" || c.criteria?.transaction === "location").length,
      hot:    CRM_CONTACTS.filter(c => (c.score || 0) >= 75).length,
      kyc:    CRM_CONTACTS.filter(c => !c.kyc || c.kyc.status === "none" || c.kyc.status === "stale").length,
      stale:  CRM_CONTACTS.filter(c => c.lastActivityAt && new Date(c.lastActivityAt) < cutoff).length,
    };
  }, []);

  return (
    <aside style={{
      width: 360, flexShrink: 0,
      position: "sticky", top: 32,
      maxHeight: "calc(100vh - 64px - 56px)",
      display: "flex", flexDirection: "column",
      background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
      borderRadius: 20, boxShadow: sp.shadowSm,
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      overflow: "hidden",
    }}>
      {/* Header interne du bento liste */}
      <div style={{ padding: "20px 20px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14 }}>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 800, color: sp.ink,
            letterSpacing: -0.6, lineHeight: 1,
          }}>Contacts</h2>
          <span style={{ fontSize: 12, color: sp.sub, fontWeight: 600, marginBottom: 2, fontVariantNumeric: "tabular-nums" }}>
            {contacts.length}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onNewContact}
            style={{
              width: 30, height: 30, borderRadius: 999, border: 0,
              background: sp.ink, color: sp.pageBg, cursor: "pointer",
              display: "grid", placeItems: "center", fontFamily: "inherit",
              boxShadow: sp.focusShadow,
            }} title="Nouveau contact">
            <CRMIcon name="plus" size={13} stroke={sp.pageBg} />
          </button>
        </div>

        {/* Search */}
        <div style={{
          height: 38, padding: "0 12px",
          background: dark ? "rgba(255,255,255,0.04)" : sp.pageBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 12,
        }}>
          <CRMIcon name="search" size={13} stroke={sp.sub} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, email, tag…"
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              color: sp.ink, fontSize: 12.5, fontFamily: "inherit",
            }} />
          {search && (
            <button onClick={() => setSearch("")} style={{
              background: "none", border: 0, cursor: "pointer", color: sp.sub, fontFamily: "inherit", fontSize: 14,
            }}>×</button>
          )}
        </div>

        {/* Segments scrollable */}
        <div className="ct-seg-row" style={{
          display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4,
          scrollbarWidth: "none", msOverflowStyle: "none",
        }}>
          <style>{`.ct-seg-row::-webkit-scrollbar { display: none; }`}</style>
          {CT_SEGMENTS.map(s => (
            <CtSegment key={s.id} id={s.id} label={s.label}
              count={segmentCounts[s.id]} active={segment === s.id}
              onClick={() => setSegment(s.id)} sp={sp} />
          ))}
        </div>

        {/* Sort + count */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 12, fontSize: 11, color: sp.sub, fontWeight: 600,
        }}>
          <span>{contacts.length} résultat{contacts.length > 1 ? "s" : ""}</span>
          <button onClick={() => setSort(sort === "activity" ? "score" : sort === "score" ? "name" : "activity")} style={{
            background: "transparent", border: 0, color: sp.soft,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            Tri : {sort === "activity" ? "Activité" : sort === "score" ? "Score" : "Nom"}
            <CRMIcon name="chevronUD" size={10} stroke={sp.soft} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "0 8px 12px",
        borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        {contacts.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: sp.sub, fontSize: 12.5 }}>
            Aucun contact ne correspond aux filtres.
          </div>
        ) : contacts.map(c => {
          const deal = CRM_DEALS.find(d => d.contactId === c.id);
          return (
            <CtRow key={c.id} contact={c} deal={deal}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c.id)}
              sp={sp} dark={dark} />
          );
        })}
      </div>
    </aside>
  );
};

// ─── Écran principal ──────────────────────────────────────────────────
const CRMScreenContactsSugar = ({ t, dark, darkTone, setDark, onNavigate, onCmd }) => {
  const sp = crmSugarPalette(t, dark, darkTone);
  const [selectedId, setSelectedId] = React.useState("c-001");
  const [segment, setSegment] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("activity");
  const [newContactOpen, setNewContactOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const handleNewContactSave = (data) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim();
    setToast(`Contact créé — ${fullName}`);
  };

  const filtered = React.useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
    let list = CRM_CONTACTS.slice();

    // Segment
    if (segment === "buyer")  list = list.filter(c => c.type === "buyer");
    if (segment === "seller") list = list.filter(c => c.type === "seller");
    if (segment === "tenant") list = list.filter(c => c.type === "tenant" || c.criteria?.transaction === "location");
    if (segment === "hot")    list = list.filter(c => (c.score || 0) >= 75);
    if (segment === "kyc")    list = list.filter(c => !c.kyc || c.kyc.status === "none" || c.kyc.status === "stale");
    if (segment === "stale")  list = list.filter(c => c.lastActivityAt && new Date(c.lastActivityAt) < cutoff);

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.firstName + " " + c.lastName).toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === "activity") list.sort((a,b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
    if (sort === "score")    list.sort((a,b) => (b.score || 0) - (a.score || 0));
    if (sort === "name")     list.sort((a,b) => (a.lastName || "").localeCompare(b.lastName || ""));

    return list;
  }, [segment, search, sort]);

  // Auto-select first if current isn't in filtered
  React.useEffect(() => {
    if (filtered.length > 0 && !filtered.find(c => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = crmContactById(selectedId);

  return (
    <div style={{
      background: sp.pageBg, minHeight: "100vh",
      fontFamily: "Manrope, system-ui, sans-serif", color: sp.ink,
    }}>
      <SugarTopNav active="contacts" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <SugarIconRail active="contacts" onNavigate={onNavigate} onCmd={onCmd}
          dark={dark} setDark={setDark} sp={sp} />
        <main style={{
          flex: 1, minWidth: 0,
          padding: "112px 40px 80px 0",
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 24,
          alignItems: "start",
        }}>
          <CtListPane
            contacts={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            segment={segment} setSegment={setSegment}
            search={search} setSearch={setSearch}
            sort={sort} setSort={setSort}
            sp={sp} dark={dark}
            onNewContact={() => setNewContactOpen(true)} />
          <CtDetail contact={selected} sp={sp} dark={dark} />
        </main>
      </div>
      {newContactOpen && (
        <CtModalNewContact
          sp={sp} dark={dark}
          onClose={() => setNewContactOpen(false)}
          onSave={handleNewContactSave} />
      )}
      {toast && <CtToast message={toast} sp={sp} dark={dark} />}
    </div>
  );
};

window.CRMScreenContactsSugar = CRMScreenContactsSugar;
