// MEGGA CRM mobile — Nouvelle recherche acheteur (Sugar Pure, theme-aware)
// ═════════════════════════════════════════════════════════════════
// Formulaire plein écran ouvert depuis le menu ••• du Matching.
// Rattache toujours la recherche à un CONTACT (existant ou créé à la volée),
// pose les critères du moteur, puis lance un matching réel sur window.CRM_BIENS.
// Exposé : window.MmNewSearch  +  window.mmQuickMatch
// ═════════════════════════════════════════════════════════════════

const NS_TYPES = [
  { id: "appartement", label: "Appartement" },
  { id: "maison",      label: "Maison" },
  { id: "terrain",     label: "Terrain" },
  { id: "commercial",  label: "Commercial" },
];

// Cantons romands en tête (marché MEGGA), le reste sous "Plus"
const NS_CANTONS = [
  ["GE", "Genève"], ["VD", "Vaud"], ["VS", "Valais"], ["FR", "Fribourg"], ["NE", "Neuchâtel"], ["JU", "Jura"],
  ["ZH", "Zürich"], ["BE", "Berne"], ["TI", "Tessin"], ["ZG", "Zoug"], ["BS", "Bâle-Ville"], ["SG", "St-Gall"],
];

const NS_AVATAR_BG = ["#0041D9", "#8B5CF6", "#10B981", "#06B6D4", "#F59E0B", "#E53935", "#0EA5E9", "#7C3AED"];

// ─── Matcher réel (simplifié, fidèle aux axes du moteur) ─────────────────────
function mmQuickMatch(criteria) {
  const biens = (window.CRM_BIENS || []).filter((b) => b.status === "active");
  const tx = criteria.transaction || "vente";
  const cantons = criteria.cantons || [];
  const types = criteria.types || [];
  const bMax = criteria.budgetMax || null;
  const roomsMin = criteria.roomsMin || null;
  const areaMin = criteria.areaMin || null;

  const scored = biens
    .filter((b) => b.transaction === tx)
    .map((b) => {
      let s = 0;
      const val = tx === "location" ? (b.rent || b.price) : b.price;
      // Budget 32
      if (bMax) {
        if (val <= bMax) s += 32;
        else if (val <= bMax * 1.15) s += Math.round(32 * (1 - (val - bMax) / (bMax * 0.15)));
      } else s += 16;
      // Zone 24
      if (cantons.length === 0) s += 12;
      else if (cantons.includes(b.canton)) s += 24;
      // Type 12
      if (types.length === 0 || types.includes(b.type)) s += 12;
      // Pièces 12
      if (!roomsMin) s += 6;
      else if ((b.rooms || 0) >= roomsMin) s += 12;
      else if ((b.rooms || 0) >= roomsMin - 1) s += 6;
      // Surface 10
      if (!areaMin) s += 5;
      else if ((b.area || 0) >= areaMin) s += 10;
      else if ((b.area || 0) >= areaMin * 0.8) s += 5;
      // Équipements 10 (neutre, données absentes)
      s += 6;
      return { bien: b, score: Math.min(100, s) };
    })
    .filter((x) => x.score >= 55)
    .sort((a, b) => b.score - a.score);
  return scored;
}

const NS_useMT = () => React.useContext(window.MTCtx);

// ─── Glyphes ─────────────────────────────────────────────────────────────────
const NsGlyph = ({ name, size = 18, sw = 1.9, color = "currentColor" }) => {
  const P = {
    back:   "M15 5l-7 7 7 7",
    search: "M11 4a7 7 0 105.2 11.7L21 20 M11 4a7 7 0 010 14",
    plus:   "M12 5v14 M5 12h14",
    check:  "M5 13l4 4 10-12",
    spark:  "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
    chev:   "M9 6l6 6-6 6",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d={P[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const NsLabel = ({ children, opt }) => {
  const T = NS_useMT();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 4px 10px" }}>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>{children}</span>
      {opt && <span style={{ fontSize: 11, fontWeight: 600, color: T.ghost }}>facultatif</span>}
    </div>
  );
};

const NsCard = ({ children, pad = 16 }) => {
  const T = NS_useMT();
  return <div style={{ background: T.card, borderRadius: 18, boxShadow: T.shadowSm, padding: pad }}>{children}</div>;
};

// Chip sélectionnable
const NsChip = ({ on, onClick, children }) => {
  const T = NS_useMT();
  return (
    <button type="button" onClick={onClick} style={{
      height: 40, padding: "0 16px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
      fontSize: 13.5, fontWeight: on ? 800 : 700, letterSpacing: -0.2, whiteSpace: "nowrap",
      color: on ? T.accentInk : T.ink, background: on ? T.ink : T.cardSubtle,
      transition: "background .16s ease",
    }}>{children}</button>
  );
};

// Input CHF / nombre
const NsField = ({ value, onChange, placeholder, prefix, suffix, mono }) => {
  const T = NS_useMT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 14px", borderRadius: 13, background: T.cardSubtle }}>
      {prefix && <span style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>{prefix}</span>}
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="numeric"
        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", fontFamily: "inherit",
          fontSize: 15.5, fontWeight: 700, color: T.ink, letterSpacing: mono ? 0.2 : -0.2,
          fontVariantNumeric: mono ? "tabular-nums" : "normal" }}
      />
      {suffix && <span style={{ fontSize: 13, fontWeight: 700, color: T.muted }}>{suffix}</span>}
    </div>
  );
};

const NsStepRow = ({ label, value, display, onStep, last }) => {
  const T = NS_useMT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 4px", borderBottom: last ? "none" : `1px solid ${T.hair}` }}>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.ink }}>{label}</span>
      <button type="button" onClick={() => onStep(-1)} aria-label="−" style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontSize: 19, fontWeight: 700, display: "grid", placeItems: "center" }}>−</button>
      <span style={{ minWidth: 56, textAlign: "center", fontSize: 14.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      <button type="button" onClick={() => onStep(1)} aria-label="+" style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: "pointer", background: T.ink, color: T.accentInk, fontSize: 19, fontWeight: 700, display: "grid", placeItems: "center" }}>+</button>
    </div>
  );
};

const nsGroupCHF = (v) => {
  const d = String(v).replace(/\D/g, "");
  return d ? Number(d).toLocaleString("fr-CH").replace(/\s|\u202f|,/g, "'") : "";
};
const nsNum = (v) => { const d = String(v).replace(/\D/g, ""); return d ? Number(d) : null; };

// ═════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═════════════════════════════════════════════════════════════════
const MmNewSearch = ({ dark = false, onClose, onCreate }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };

  // — Acheteur —
  const allBuyers = (window.CRM_CONTACTS || []).filter((c) => c.type === "buyer");
  const [buyer, setBuyer] = React.useState(null);    // contact existant choisi
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [nc, setNc] = React.useState({ firstName: "", lastName: "", phone: "" });

  // — Critères —
  const [transaction, setTransaction] = React.useState("vente");
  const [budget, setBudget] = React.useState("");
  const [types, setTypes] = React.useState(["appartement"]);
  const [cantons, setCantons] = React.useState([]);
  const [showAllCantons, setShowAllCantons] = React.useState(false);
  const [roomsMin, setRoomsMin] = React.useState(0);
  const [areaMin, setAreaMin] = React.useState(0);

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = q.trim()
    ? allBuyers.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q.toLowerCase()))
    : allBuyers;

  const buyerReady = buyer || (creating && nc.firstName.trim() && nc.lastName.trim());
  const ready = buyerReady && (budget || types.length);

  const visibleCantons = showAllCantons ? NS_CANTONS : NS_CANTONS.slice(0, 6);

  const submit = () => {
    if (!ready) return;
    const criteria = {
      transaction,
      budgetMax: nsNum(budget),
      types,
      cantons,
      roomsMin: roomsMin || undefined,
      areaMin: areaMin || undefined,
    };
    const person = buyer || {
      id: "c-new-" + Date.now(),
      firstName: nc.firstName.trim(),
      lastName: nc.lastName.trim(),
      phone: nc.phone.trim(),
      type: "buyer",
      avatarBg: NS_AVATAR_BG[Math.floor(Math.random() * NS_AVATAR_BG.length)],
    };
    const newBuyer = { ...person, criteria };
    const matches = mmQuickMatch(criteria).map((x, i) => ({
      id: `nm-${person.id}-${i}`, contactId: person.id, bienId: x.bien.id,
      score: x.score, status: "to-send", bien: x.bien,
    }));
    onCreate && onCreate({ buyer: newBuyer, matches, topScore: matches[0]?.score || 0 });
  };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden", animation: "nsIn .32s cubic-bezier(.2,.8,.2,1) both" }}>
        <style>{`
          @keyframes nsIn { from { opacity:0; transform: translateX(16px); } to { opacity:1; transform:none; } }
          .nsScroll::-webkit-scrollbar{ display:none; }
        `}</style>

        {/* Header */}
        <header style={{ paddingTop: 52, paddingLeft: 14, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} aria-label="Retour" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: T.card, boxShadow: T.shadowSm, cursor: "pointer", display: "grid", placeItems: "center" }}>
            <NsGlyph name="back" size={20} sw={2.1} color={T.ink} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Nouvelle recherche</div>
          </div>
        </header>

        {/* Corps */}
        <main className="nsScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 18px 130px", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

            {/* 1 — Acheteur */}
            <div>
              <NsLabel>Acheteur</NsLabel>
              {buyer ? (
                <NsCard pad={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <window.MAv bg={buyer.avatarBg} ink="#fff" size={42}>{mmInitials(buyer)}</window.MAv>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>{buyer.firstName} {buyer.lastName}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{buyer.phone || "Contact existant"}</div>
                    </div>
                    <button onClick={() => setBuyer(null)} style={{ height: 34, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.ink, background: T.cardSubtle }}>Changer</button>
                  </div>
                </NsCard>
              ) : creating ? (
                <NsCard pad={14}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <NsField value={nc.firstName} onChange={(v) => setNc({ ...nc, firstName: v })} placeholder="Prénom" />
                      <NsField value={nc.lastName} onChange={(v) => setNc({ ...nc, lastName: v })} placeholder="Nom" />
                    </div>
                    <NsField value={nc.phone} onChange={(v) => setNc({ ...nc, phone: v })} placeholder="Téléphone" prefix="+41" />
                    <button onClick={() => { setCreating(false); setNc({ firstName: "", lastName: "", phone: "" }); }} style={{ alignSelf: "flex-start", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.muted, padding: "2px 4px" }}>← Choisir un contact existant</button>
                  </div>
                </NsCard>
              ) : (
                <NsCard pad={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 12px", borderRadius: 13, background: T.cardSubtle, marginBottom: 8 }}>
                    <NsGlyph name="search" size={17} sw={2} color={T.muted} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un acheteur…" style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, color: T.ink }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", maxHeight: 196, overflowY: "auto" }} className="nsScroll">
                    {filtered.slice(0, 6).map((c) => (
                      <button key={c.id} onClick={() => setBuyer(c)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 6px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                        <window.MAv bg={c.avatarBg} ink="#fff" size={34}>{mmInitials(c)}</window.MAv>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{c.firstName} {c.lastName}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted }}>{mmBuyerType(c)}</div>
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && <div style={{ padding: "10px 6px", fontSize: 13, fontWeight: 600, color: T.muted }}>Aucun contact.</div>}
                  </div>
                  <button onClick={() => setCreating(true)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 6, height: 46, padding: "0 12px", borderRadius: 13, border: 0, cursor: "pointer", fontFamily: "inherit", background: T.ink, color: T.accentInk }}>
                    <NsGlyph name="plus" size={17} sw={2.4} color={T.accentInk} />
                    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2 }}>Nouveau contact</span>
                  </button>
                </NsCard>
              )}
            </div>

            {/* 2 — Transaction */}
            <div>
              <NsLabel>Transaction</NsLabel>
              <div style={{ display: "flex", gap: 9 }}>
                {[["vente", "Achat"], ["location", "Location"]].map(([id, lab]) => {
                  const on = transaction === id;
                  return (
                    <button key={id} onClick={() => setTransaction(id)} style={{ flex: 1, height: 50, borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? T.accentInk : T.ink, background: on ? T.ink : T.card, boxShadow: on ? T.shadow : T.shadowSm, transition: "background .16s ease" }}>{lab}</button>
                  );
                })}
              </div>
            </div>

            {/* 3 — Budget */}
            <div>
              <NsLabel>{transaction === "location" ? "Loyer max" : "Budget max"}</NsLabel>
              <NsField value={budget} onChange={(v) => setBudget(nsGroupCHF(v))} placeholder={transaction === "location" ? "3'500" : "1'200'000"} prefix="CHF" suffix={transaction === "location" ? "/ mois" : ""} mono />
            </div>

            {/* 4 — Type de bien */}
            <div>
              <NsLabel>Type de bien</NsLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {NS_TYPES.map((t) => <NsChip key={t.id} on={types.includes(t.id)} onClick={() => toggle(types, setTypes, t.id)}>{t.label}</NsChip>)}
              </div>
            </div>

            {/* 5 — Zone */}
            <div>
              <NsLabel opt>Zone</NsLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                <NsChip on={cantons.length === 0} onClick={() => setCantons([])}>Toute la Suisse</NsChip>
                {visibleCantons.map(([code, name]) => <NsChip key={code} on={cantons.includes(code)} onClick={() => toggle(cantons, setCantons, code)}>{name}</NsChip>)}
                {!showAllCantons && (
                  <button onClick={() => setShowAllCantons(true)} style={{ height: 40, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: T.muted, background: T.card, boxShadow: T.shadowSm, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    Plus<NsGlyph name="chev" size={13} sw={2.2} color={T.muted} />
                  </button>
                )}
              </div>
            </div>

            {/* 6 — Pièces & surface */}
            <div>
              <NsLabel opt>Minimums</NsLabel>
              <NsCard pad={8}>
                <NsStepRow label="Pièces" value={roomsMin} display={roomsMin ? `${roomsMin}+` : "—"} onStep={(d) => setRoomsMin(Math.max(0, Math.min(10, roomsMin + d)))} />
                <NsStepRow label="Surface" value={areaMin} display={areaMin ? `${areaMin} m²` : "—"} onStep={(d) => setAreaMin(Math.max(0, Math.min(400, areaMin + d * 10)))} last />
              </NsCard>
            </div>

          </div>
        </main>

        {/* Footer CTA */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "14px 18px calc(18px + env(safe-area-inset-bottom))", background: `linear-gradient(to top, ${T.canvas} 70%, transparent)` }}>
          <button onClick={submit} disabled={!ready} style={{
            width: "100%", height: 52, borderRadius: 999, border: 0, cursor: ready ? "pointer" : "default", fontFamily: "inherit",
            fontSize: 15.5, fontWeight: 800, letterSpacing: -0.2, color: T.accentInk, background: ready ? T.ink : T.ghost,
            boxShadow: ready ? T.shadowLg : "none", opacity: ready ? 1 : 0.85, transition: "background .2s ease",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
          }}>
            <NsGlyph name="spark" size={18} sw={1.7} color={T.accentInk} />Lancer la recherche
          </button>
        </div>
      </div>
    </window.MTCtx.Provider>
  );
};

window.MmNewSearch = MmNewSearch;
window.mmQuickMatch = mmQuickMatch;
