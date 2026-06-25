// MEGGA CRM — Responsive · Écran « Pipeline » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Le kanban horizontal desktop devient
// des ONGLETS d'étape (scroll horizontal des 6 phases MEGGA) + une LISTE verticale
// des affaires de l'étape active ; total CHF de l'étape en sous-titre.
// Réutilise les atomes/données partagés (window.MTCtx / MIcon / MAv / MEGGAWordmark).
// Données : pipeline CHF 7.6M · 22 affaires · 1 à risque. KYC = rappel doux non-bloquant.

const PIPE_useMT = () => React.useContext(window.MTCtx);

// ─── 6 phases MEGGA (couleurs fonctionnelles CLAUDE.md) ─────────────────
// color = clair · darkColor = sombre (Acte près-noir s'inverse en clair).
const PIPE_PHASES = [
  { id: "mandat",    label: "Mandat",      color: "#1E5BC6", darkColor: "#7FA6EE", count: 6, totalM: 0.40 },
  { id: "prep",      label: "Préparation", color: "#0891B2", darkColor: "#56C4DC", count: 4, totalM: 0.50 },
  { id: "visites",   label: "Visites",     color: "#0E7490", darkColor: "#52B4CC", count: 5, totalM: 1.10 },
  { id: "offre",     label: "Offre",       color: "#C45A00", darkColor: "#F0A862", count: 3, totalM: 4.80 },
  { id: "compromis", label: "Compromis",   color: "#059669", darkColor: "#34C796", count: 2, totalM: 0.50 },
  { id: "acte",      label: "Acte",        color: "#0B0C0E", darkColor: "#D7D9E2", count: 2, totalM: 0.30 },
];

// ─── Affaires visibles par phase (le reste agrégé en « +N autres ») ─────
const PIPE_DEALS = [
  // MANDAT
  { id: "p-1", phase: "mandat", name: "Catherine Loreau", initials: "CL", av: "#E53935",
    bien: "Maison · Carouge — succession", value: 400000, prob: 15, icon: "phone", note: "Premier contact vendeur", due: "Auj. 15:00" },
  { id: "p-2", phase: "mandat", name: "Jean-Marc Aebischer", initials: "JA", av: "#F59E0B",
    bien: "4 pièces · Eaux-Vives", value: null, prob: 30, icon: "file", note: "Mandat exclusif à signer", due: "Jeu." },
  { id: "p-3", phase: "mandat", name: "Léa Fontaine", initials: "LF", av: "#8B5CF6",
    bien: "3 pièces · Plainpalais", value: null, prob: 10, icon: "cal", note: "RDV estimation à fixer", due: "Sem. 24" },
  // PRÉPARATION
  { id: "p-4", phase: "prep", name: "Sophie Renaud", initials: "SR", av: "#0041D9",
    bien: "3 pièces standing · Champel", value: 500000, prob: 45, icon: "file", note: "Reportage photo C2PA", due: "Demain" },
  { id: "p-5", phase: "prep", name: "Nadia Berset", initials: "NB", av: "#06B6D4",
    bien: "3 pièces meublé · Pâquis — loc.", value: 38400, prob: 35, icon: "bolt", note: "Diffusion annonce MEGGA", due: "Auj." },
  // VISITES
  { id: "p-6", phase: "visites", name: "Marie Bertrand", initials: "MB", av: "#0041D9",
    bien: "5 pièces familial · Carouge", value: 1100000, prob: 65, icon: "phone", note: "Relancer après visite", due: "Auj. 10:00", live: true },
  { id: "p-7", phase: "visites", name: "Olivier Marchand", initials: "OM", av: "#6366F1",
    bien: "4 pièces · Servette", value: 720000, prob: 45, icon: "clock", note: "Visite sans suite · 9 j", due: "En retard", risk: true },
  { id: "p-8", phase: "visites", name: "Camille Rougier", initials: "CR", av: "#06B6D4",
    bien: "3 pièces meublé · Pâquis — loc.", value: 38400, prob: 55, icon: "cal", note: "Visite 16:00 aujourd'hui", due: "Auj. 16:00" },
  // OFFRE
  { id: "p-9", phase: "offre", name: "Antoine Picard", initials: "AP", av: "#0041D9",
    bien: "Villa contemporaine · Cologny", value: 3850000, prob: 70, icon: "bank", note: "Réponse vendeur attendue", due: "Auj. 18:00" },
  { id: "p-10", phase: "offre", name: "Élodie Schmidt", initials: "ES", av: "#10B981",
    bien: "4 pièces · Eaux-Vives", value: 850000, prob: 80, icon: "shield", note: "KYC à compléter — optionnel", due: "Demain", kyc: true },
  // COMPROMIS
  { id: "p-11", phase: "compromis", name: "Béatrice Nussbaum", initials: "BN", av: "#0041D9",
    bien: "3 pièces · Champel", value: 500000, prob: 92, icon: "file", note: "Compromis chez le notaire", due: "10 juin" },
  // ACTE
  { id: "p-12", phase: "acte", name: "Henri Délèze", initials: "HD", av: "#0E7490",
    bien: "2 pièces · Plainpalais", value: 300000, prob: 100, icon: "bank", note: "Signature acte authentique", due: "12 juin" },
];

// ─── Format CHF suisse (apostrophes) ────────────────────────────────────
const pipeCHF = (n) => "CHF " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
const pipeM = (m) => `CHF ${m.toFixed(2)}M`;
const pipeColor = (p, dark) => (dark ? p.darkColor : p.color);

// ─── Mini-jauge de probabilité ──────────────────────────────────────────
const PipeRing = ({ pct, color, size = 38 }) => {
  const T = PIPE_useMT();
  const r = (size - 5) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.hair} strokeWidth={3.5} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3.5} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>{pct}</div>
    </div>
  );
};

// ─── Carte affaire ──────────────────────────────────────────────────────
const PipeDealCard = ({ d, phase, dark, i, onMenu }) => {
  const T = PIPE_useMT();
  const col = pipeColor(phase, dark);
  return (
    <div style={{
      position: "relative", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 18,
      boxShadow: T.shadowSm, padding: "14px 15px 13px", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <window.MAv bg={d.av} ink="#fff" size={36}>{d.initials}</window.MAv>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
            {d.live && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#34C796", flexShrink: 0, boxShadow: "0 0 0 3px rgba(52,199,150,.22)" }} />}
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.bien}</div>
        </div>
        <PipeRing pct={d.prob} color={col} />
        <button
          onClick={(e) => { e.stopPropagation(); onMenu && onMenu(d); }}
          aria-label="Actions"
          style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0, marginRight: -4 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill={T.muted} aria-hidden="true">
            <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
          </svg>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {d.value == null ? <span style={{ fontSize: 13.5, fontWeight: 700, color: T.muted, letterSpacing: 0, whiteSpace: "nowrap" }}>À estimer</span> : pipeCHF(d.value)}
        </div>
        {d.risk && <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, color: T.riskFg, background: T.riskBg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>À RISQUE</span>}
      </div>
      <div style={{
        marginTop: 11, display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12,
        background: d.kyc ? (dark ? "rgba(14,116,144,.18)" : "#E0F1F5") : T.cardSubtle,
      }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: d.kyc ? "transparent" : T.card, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: d.kyc ? "none" : T.shadowSm }}>
          <window.MIcon name={d.icon} size={12} sw={2} color={d.kyc ? (dark ? "#7FCFE0" : "#0E7490") : T.inkSoft} />
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: d.kyc ? (dark ? "#9FD8E6" : "#0E6580") : T.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.note}</span>
      </div>
    </div>
  );
};

// ─── Onglets d'étape (scroll horizontal) ────────────────────────────────
const PipeStageTabs = ({ phases, active, onPick, dark }) => {
  const T = PIPE_useMT();
  return (
    <div style={{ display: "flex", gap: 9, overflowX: "auto", padding: "2px 18px 4px", margin: "0 -18px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      <style>{`.pipeTabs::-webkit-scrollbar{display:none}`}</style>
      {phases.map((p) => {
        const on = p.id === active;
        const col = pipeColor(p, dark);
        return (
          <button key={p.id} onClick={() => onPick(p.id)} style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px",
            borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
            background: on ? T.accent : T.card, boxShadow: on ? T.shadow : "none",
            transition: "background .2s ease",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? T.accentInk : T.ink, whiteSpace: "nowrap" }}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ─── Header + titre ─────────────────────────────────────────────────────
const PipeHeader = ({ onOpenSearch }) => {
  const T = PIPE_useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <window.MEGGAWordmark color={T.ink} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onOpenSearch} aria-label="Recherche & MEGGA AI" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}><window.MIcon name="search" size={18} sw={2} color={T.ink} /></button>
      </div>
    </header>
  );
};

// ─── Barre d'onglets du bas ─────────────────────────────────────────────
const PIPE_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const PipeTabBar = () => {
  const T = PIPE_useMT();
  const active = "pipeline";
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {PIPE_TABS.map((tb) => {
        const on = tb.id === active;
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <window.MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? T.ink : T.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? T.ink : T.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN PIPELINE MOBILE
// ═══════════════════════════════════════════════════════════════════════
const MobilePipelineScreen = ({ dark = false, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const [active, setActive] = React.useState("offre");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuDeal, setMenuDeal] = React.useState(null);
  const [confirmLost, setConfirmLost] = React.useState(null);
  const [stagePick, setStagePick] = React.useState(null);
  const [dealList, setDealList] = React.useState(window.PIPE_DEALS);
  const [pipeToast, setPipeToast] = React.useState(null);
  const [pipeToastDanger, setPipeToastDanger] = React.useState(false);
  const pipeToastRef = React.useRef(null);
  const showPipeToast = (t, danger = false) => { setPipeToast(t); setPipeToastDanger(danger); clearTimeout(pipeToastRef.current); pipeToastRef.current = setTimeout(() => setPipeToast(null), 2200); };
  const handleDealAction = (id) => {
    const deal = menuDeal;
    const name = menuDeal?.name || "l'affaire";
    setMenuDeal(null);
    if (id === "lost") { setConfirmLost(deal); return; }
    if (id === "rdv") { window.__agendaOpenCreate = true; if (onGo) onGo("agenda"); return; }
    if (id === "stage") { setStagePick(deal); return; }
    showPipeToast("");
  };
  const moveStage = (newPhase) => {
    const deal = stagePick;
    const ph = PIPE_PHASES.find((p) => p.id === newPhase);
    setDealList((prev) => prev.map((x) => (x.id === deal.id ? { ...x, phase: newPhase } : x)));
    setStagePick(null);
    setActive(newPhase);
    showPipeToast(`${deal.name} déplacée vers « ${ph.label} »`);
  };
  const phase = PIPE_PHASES.find((p) => p.id === active);
  const deals = dealList.filter((d) => d.phase === active);
  const hidden = phase.count - deals.length;
  const col = pipeColor(phase, dark);

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
        <style>{`.pipeTabs::-webkit-scrollbar{display:none}`}</style>
        <PipeHeader onOpenSearch={() => setSearchOpen(true)} />
        <main className="pipeMain" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
          <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Pipeline</h1>
          {/* bandeau valeur */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>CHF 7.6M</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.inkSoft }}>22 affaires</span>
          </div>

          {/* onglets d'étape */}
          <div style={{ marginTop: 18 }} className="pipeTabs">
            <PipeStageTabs phases={PIPE_PHASES} active={active} onPick={setActive} dark={dark} />
          </div>

          {/* sous-titre étape */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 18, padding: "0 2px" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>{phase.label}</h2>
          </div>

          {/* liste verticale */}
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 13 }}>
            {deals.map((d, i) => <PipeDealCard key={d.id} d={d} phase={phase} dark={dark} i={i} onMenu={setMenuDeal} />)}
          </div>
        </main>
        <PipeTabBar />
        {menuDeal && window.SgActionMenu && (
          <window.SgActionMenu
            mode="sheet"
            dark={dark}
            pal={{ card: T.card, ink: T.ink, inkSoft: T.inkSoft, hair: T.cardBorder, overlay: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.32)" }}
            items={[
              { id: "stage",  icon: "stage", label: "Changer d'étape" },
              { id: "rdv",    icon: "cal",   label: "Programmer un RDV" },
              { id: "lost",   icon: "ban",   label: "Marquer perdue", danger: true, divider: true },
            ]}
            sheetStyle={{ margin: "0 10px 96px" }}
            onAction={handleDealAction}
            onClose={() => setMenuDeal(null)}
          />
        )}
        {confirmLost && (
          <div style={{ position: "absolute", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setConfirmLost(null)} style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)", animation: "sgamFade .18s ease both" }}></div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", margin: "0 10px 96px", background: T.card, borderRadius: 26, boxShadow: "0 24px 60px rgba(15,23,42,0.22), 0 4px 14px rgba(15,23,42,0.10)", overflow: "hidden", padding: "22px 20px 18px", animation: "pipeConfirm .26s cubic-bezier(.2,.9,.3,1.1) both" }}>
              <style>{`@keyframes pipeConfirm{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Marquer cette affaire perdue&nbsp;?</div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: T.inkSoft, marginTop: 6, lineHeight: 1.45 }}>
                <b style={{ fontWeight: 700, color: T.ink }}>{confirmLost.name}</b> sortira du pipeline actif. Tu pourras la retrouver dans les affaires perdues.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setConfirmLost(null)} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: T.ink, background: T.cardSubtle }}>Annuler</button>
                <button onClick={() => { const d = confirmLost; setConfirmLost(null); showPipeToast(`${d.name} marquée perdue`, true); }} style={{ flex: 1, height: 48, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, color: "#fff", background: dark ? "#E0738C" : "#8E1F3D" }}>Marquer perdue</button>
              </div>
            </div>
          </div>
        )}
        {stagePick && (
          <div style={{ position: "absolute", inset: 0, zIndex: 46, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setStagePick(null)} style={{ position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,0.5)" : "rgba(11,12,14,0.34)", animation: "sgamFade .18s ease both" }}></div>
            <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", margin: "0 10px 96px", background: T.card, borderRadius: 26, boxShadow: "0 24px 60px rgba(15,23,42,0.22), 0 4px 14px rgba(15,23,42,0.10)", overflow: "hidden", padding: "20px 16px 14px", animation: "pipeConfirm .26s cubic-bezier(.2,.9,.3,1.1) both" }}>
              <div style={{ padding: "0 4px 4px" }}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Changer d'étape</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 3 }}>{stagePick.name}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
                {PIPE_PHASES.map((p) => {
                  const cur = p.id === stagePick.phase;
                  return (
                    <button key={p.id} onClick={() => { if (!cur) moveStage(p.id); }} disabled={cur} style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 12px", borderRadius: 14,
                      border: 0, cursor: cur ? "default" : "pointer", fontFamily: "inherit", textAlign: "left",
                      background: cur ? T.cardSubtle : "transparent", opacity: cur ? 0.6 : 1,
                    }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: pipeColor(p, dark), flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>{p.label}</span>
                      {cur
                        ? <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: 0.2 }}>ACTUELLE</span>
                        : <window.MIcon name="arrow" size={16} sw={2} color={T.muted} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {pipeToast && (
          <div style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 40, background: pipeToastDanger ? "#8E1F3D" : (dark ? "#ECEDF3" : "#0B0C0E"), color: pipeToastDanger ? "#fff" : (dark ? "#0B0C0E" : "#fff"), fontSize: 13, fontWeight: 700, padding: "11px 18px", borderRadius: 999, boxShadow: "0 12px 30px rgba(15,23,42,0.25)", whiteSpace: "nowrap", animation: "sgamFade .2s ease both" }}>{pipeToast}</div>
        )}
        {searchOpen && window.MTCommand && <window.MTCommand dark={dark} onGo={onGo} onClose={() => setSearchOpen(false)} />}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobilePipelineScreen = MobilePipelineScreen;
Object.assign(window, { PIPE_PHASES, PIPE_DEALS, pipeCHF, pipeM, pipeColor, PipeRing });
