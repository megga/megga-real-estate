// MEGGA CRM — Responsive · Écran « Parcours » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Portage de crm-screen-parcours-sugar.jsx.
// Desktop = vue panoramique 5 dossiers × 4 colonnes d'étape. Mobile :
//   1) LISTE — bandeau équipe (scroll avatars) + filtres urgence + cartes dossier
//      (progression 4 étapes + tâche en cours « cursor »).
//   2) DÉTAIL (drill-in) — workflow vertical : 4 sections d'étape empilées,
//      cartes de tâches done/active/todo, check togglable.
// Données partagées : window.PARCOURS_TEAM / PARCOURS_STAGES / PARCOURS_DOSSIERS /
//   parcoursAgentById · atomes window.MTCtx / MIcon / MAv / MEGGAWordmark.

const PK_useMT = () => React.useContext(window.MTCtx);

// ─── Urgence (pills opaques pleines, texte blanc — cf. CLAUDE.md) ───────
const PK_URGENCY = {
  high:   { label: "Urgence haute", short: "Haute",   bg: "#8E1F3D", dot: "#F0A1B5" },
  medium: { label: "Moyenne",       short: "Moyenne", bg: "#A0521E", dot: "#F5C58A" },
  low:    { label: "Sereine",       short: "Sereine", bg: "#15643F", dot: "#7CD8A6" },
};

// ─── Icônes complémentaires (back, plus, share, users) ──────────────────
const PK_ICONS = {
  back:  "M15 5l-7 7 7 7",
  plus:  "M12 5v14 M5 12h14",
  share: "M16 6l-4-3-4 3 M12 3v12 M5 11v8h14v-8",
  users: "M8.5 11a3 3 0 100-6 3 3 0 000 6z M3 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5 M16 13c2.5 0 4.5 1.8 4.5 5 M15 5.2a3 3 0 010 5.6",
  dot:   "",
};
const PkIcon = ({ name, size = 18, sw = 2, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
    <path d={PK_ICONS[name]} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Helpers ────────────────────────────────────────────────────────────
const pkStageIdx = (id) => window.PARCOURS_STAGES.findIndex((s) => s.id === id);
const pkAllTasks = (d) => Object.values(d.columns).reduce((a, arr) => a.concat(arr), []);
const pkTaskById = (d, id) => pkAllTasks(d).find((t) => t.id === id);

// Compteur de tâches actives/à-faire par agent (tous dossiers) — bandeau équipe
const pkAgentLoad = () => {
  const map = {};
  window.PARCOURS_DOSSIERS.forEach((d) =>
    pkAllTasks(d).forEach((t) => {
      if (!t.agentId || t.state === "done") return;
      map[t.agentId] = (map[t.agentId] || 0) + 1;
    })
  );
  return map;
};

// ═══════════════════════════════════════════════════════════════════════
//  BANDEAU ÉQUIPE — scroll horizontal d'avatars (filtre agent)
// ═══════════════════════════════════════════════════════════════════════
const PkTeamStrip = ({ agentFilter, onPick }) => {
  const T = PK_useMT();
  const load = React.useMemo(pkAgentLoad, []);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 20, boxShadow: T.shadowSm, padding: "15px 4px 14px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PkIcon name="users" size={15} sw={1.9} color={T.muted} />
          <span style={{ fontSize: 13, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>Suivi de l'équipe</span>
        </div>
        {agentFilter !== "all" && (
          <button onClick={() => onPick("all")} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: T.muted, padding: 0 }}>Tous</button>
        )}
      </div>
      <div className="pkTeam" style={{ display: "flex", gap: 16, overflowX: "auto", padding: "2px 14px 4px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {window.PARCOURS_TEAM.map((a) => {
          const n = load[a.id] || 0;
          const on = agentFilter === a.id;
          const badge = n >= 3 ? "#E53935" : n > 0 ? "#1E5BC6" : T.ghost;
          return (
            <button key={a.id} onClick={() => onPick(on ? "all" : a.id)} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 0, flexShrink: 0, width: 54 }}>
              <div style={{ position: "relative", width: 48, height: 52 }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: a.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, boxShadow: on ? `0 0 0 2.5px ${T.ink}, 0 0 0 5px ${T.card}` : "0 2px 8px rgba(0,0,0,.14)", transition: "box-shadow .2s ease" }}>{a.initials}</div>
                <div style={{ position: "absolute", bottom: -1, left: "50%", transform: "translateX(-50%)", background: badge, color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 999, border: `2px solid ${T.card}`, minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums", opacity: n ? 1 : 0.75 }}>{n || "+"}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600, color: on ? T.ink : T.muted, whiteSpace: "nowrap", letterSpacing: -0.1 }}>{a.firstName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  STEPPER 4 ÉTAPES (carte dossier)
// ═══════════════════════════════════════════════════════════════════════
const PkStepper = ({ dossier }) => {
  const T = PK_useMT();
  const activeIdx = pkStageIdx(dossier.stageActive);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginTop: 14 }}>
      {window.PARCOURS_STAGES.map((s, i) => {
        const status = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
        const col = s.color;
        return (
          <div key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {/* connecteur gauche */}
            {i > 0 && (
              <span style={{ position: "absolute", top: 11, right: "50%", width: "100%", height: 2.5, borderRadius: 2, background: i <= activeIdx ? col : "transparent", borderTop: i <= activeIdx ? "none" : `2px dashed ${T.hair}` }} />
            )}
            {/* nœud */}
            <span style={{ position: "relative", zIndex: 1, width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: status === "done" ? col : status === "active" ? T.card : T.card, boxShadow: status === "active" ? `0 0 0 2.5px ${col}, ${T.shadowSm}` : status === "todo" ? `inset 0 0 0 2px ${T.hair}` : "none", color: "#fff" }}>
              {status === "done" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4 10-12" /></svg>
              ) : status === "active" ? (
                <span style={{ width: 9, height: 9, borderRadius: 999, background: col }} />
              ) : null}
            </span>
            <span style={{ marginTop: 7, fontSize: 9.5, fontWeight: status === "active" ? 800 : 600, color: status === "todo" ? T.ghost : status === "active" ? T.ink : T.muted, whiteSpace: "nowrap", letterSpacing: -0.1, textAlign: "center" }}>{s.label.split(" ").pop()}</span>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  CARTE DOSSIER (liste)
// ═══════════════════════════════════════════════════════════════════════
const PkDossierCard = ({ dossier, onOpen }) => {
  const T = PK_useMT();
  const u = PK_URGENCY[dossier.urgency];
  const active = pkTaskById(dossier, dossier.activeTaskId);
  const agent = active ? window.parcoursAgentById(active.agentId) : null;
  const stage = window.PARCOURS_STAGES.find((s) => s.id === dossier.stageActive);

  return (
    <button onClick={() => onOpen(dossier.id)} style={{ textAlign: "left", width: "100%", border: `1px solid ${T.cardBorder}`, background: T.card, borderRadius: 22, boxShadow: T.shadowSm, padding: "16px 16px 15px", cursor: "pointer", fontFamily: "inherit", display: "block" }}>
      {/* titre + urgence */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.4, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dossier.title}</div>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>{dossier.subtitle}</div>
        </div>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: u.bg, color: "#fff", fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: u.dot }} />{u.short}
        </span>
      </div>

      {/* équipe + compteur */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 13 }}>
        {dossier.team.slice(0, 5).map((m, i) => {
          const a = window.parcoursAgentById(m.agentId);
          if (!a) return null;
          return <div key={m.agentId} style={{ width: 30, height: 30, borderRadius: 999, background: a.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, border: `2px solid ${T.card}`, marginLeft: i === 0 ? 0 : -9, flexShrink: 0 }}>{a.initials}</div>;
        })}
        <span style={{ marginLeft: 10, fontSize: 11.5, fontWeight: 600, color: T.muted, whiteSpace: "nowrap" }}>{dossier.team.length} membres</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>
          Ouvrir <window.MIcon name="arrow" size={14} sw={2} color={T.muted} />
        </span>
      </div>

      {/* stepper */}
      <PkStepper dossier={dossier} />

      {/* tâche en cours (cursor) */}
      {active && (
        <div style={{ marginTop: 15, display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 15, background: T.accent, color: T.accentInk }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: agent ? agent.avatarBg : "#555", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, boxShadow: "0 0 0 2px rgba(255,255,255,.18)" }}>{agent ? agent.initials : "+"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: T.mode === "dark" ? "rgba(11,12,14,.55)" : "rgba(255,255,255,.6)", whiteSpace: "nowrap" }}>En cours · {stage ? stage.label : ""}</div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.2, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.label}</div>
          </div>
          <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: T.mode === "dark" ? "rgba(11,12,14,.12)" : "rgba(255,255,255,.16)", display: "grid", placeItems: "center" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill={T.accentInk} stroke="none"><path d="m3 3 7 18 2.5-7.5L20 11Z" /></svg>
          </span>
        </div>
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  DÉTAIL — carte de tâche (workflow vertical)
// ═══════════════════════════════════════════════════════════════════════
const PkTaskRow = ({ task, displayState, onToggle }) => {
  const T = PK_useMT();
  const agent = window.parcoursAgentById(task.agentId);
  const isActive = displayState === "active";
  const isDone = displayState === "done";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 16, background: isActive ? T.accent : T.card, color: isActive ? T.accentInk : T.ink, border: isActive ? 0 : `1px solid ${T.cardBorder}`, boxShadow: isActive ? T.shadow : T.shadowSm, opacity: isDone ? 0.72 : 1, position: "relative" }}>
      {/* avatar */}
      <div style={{ width: 34, height: 34, borderRadius: 999, background: agent ? agent.avatarBg : (isActive ? "rgba(255,255,255,.16)" : T.cardSubtle), color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: isActive ? "0 0 0 2px rgba(255,255,255,.18)" : "none" }}>{agent ? agent.initials : "+"}</div>
      {/* libellé */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.25, color: isActive ? T.accentInk : T.ink, textDecoration: isDone ? "line-through" : "none", textDecorationColor: T.ghost }}>{task.label}</div>
        {task.sub && <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: isActive ? (T.mode === "dark" ? "rgba(11,12,14,.6)" : "rgba(255,255,255,.66)") : T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.sub}</div>}
      </div>
      {/* check toggle */}
      <button onClick={() => onToggle(task.id)} title={isDone ? "Rouvrir" : "Marquer exécutée"} style={{ width: 28, height: 28, borderRadius: 999, border: 0, padding: 0, cursor: "pointer", flexShrink: 0, display: "grid", placeItems: "center", background: isDone ? "#0E9F6E" : isActive ? "rgba(255,255,255,.16)" : T.cardSubtle }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDone ? "#fff" : isActive ? T.accentInk : "#0E9F6E"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4L19 6.5" /></svg>
      </button>
    </div>
  );
};

// ─── Section d'étape (détail) ──────────────────────────────────────────
const PkStageSection = ({ stage, tasks, overrides, onToggle }) => {
  const T = PK_useMT();
  const dispState = (t) => overrides[t.id] || t.state;
  const total = tasks.length;
  const done = tasks.filter((t) => dispState(t) === "done").length;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11, padding: "0 2px" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: stage.color, flexShrink: 0 }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink, whiteSpace: "nowrap" }}>{stage.label}</h3>
        <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: T.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{done}/{total}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {tasks.map((t) => <PkTaskRow key={t.id} task={t} displayState={dispState(t)} onToggle={onToggle} />)}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  VUE DÉTAIL (drill-in)
// ═══════════════════════════════════════════════════════════════════════
const PkDetail = ({ dossier, onBack }) => {
  const T = PK_useMT();
  const u = PK_URGENCY[dossier.urgency];
  const [overrides, setOverrides] = React.useState({});
  const toggle = (id) => setOverrides((o) => {
    const cur = o[id] || pkTaskById(dossier, id).state;
    return { ...o, [id]: cur === "done" ? "todo" : "done" };
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, color: T.ink }}>
      {/* top bar */}
      <header style={{ paddingTop: 54, paddingLeft: 14, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><PkIcon name="back" size={20} sw={2.1} color={T.ink} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: T.muted }}>Dossier</div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dossier.title}</div>
        </div>
        <button style={{ width: 40, height: 40, borderRadius: 999, border: `1px solid ${T.cardBorder}`, background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><PkIcon name="share" size={18} sw={1.9} color={T.ink} /></button>
      </header>

      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 18px 28px", WebkitOverflowScrolling: "touch" }}>
        {/* hero dossier */}
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 22, boxShadow: T.shadow, padding: "18px 18px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.6, color: T.ink, lineHeight: 1.12 }}>{dossier.title}</h1>
              <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 600, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{dossier.subtitle}</div>
            </div>
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: u.bg, color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: u.dot }} />{u.label}
            </span>
          </div>
          {/* équipe */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
            {dossier.team.map((m, i) => {
              const a = window.parcoursAgentById(m.agentId);
              if (!a) return null;
              return (
                <div key={m.agentId} title={`${a.firstName} ${a.lastName}`} style={{ position: "relative", marginLeft: i === 0 ? 0 : -10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 999, background: a.avatarBg, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, border: `2.5px solid ${T.card}`, flexShrink: 0 }}>{a.initials}</div>
                  {m.count != null && <span style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", background: m.badgeColor || T.ghost, color: "#fff", fontSize: 9, fontWeight: 800, padding: "0px 5px", borderRadius: 999, border: `1.5px solid ${T.card}`, minWidth: 15, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{m.count}</span>}
                </div>
              );
            })}
            <div style={{ width: 38, height: 38, borderRadius: 999, marginLeft: -10, background: T.cardSubtle, border: `2px dashed ${T.mode === "dark" ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.16)"}`, display: "grid", placeItems: "center", flexShrink: 0 }}><PkIcon name="plus" size={15} sw={2} color={T.muted} /></div>
          </div>
          {/* actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            <button style={{ height: 44, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, background: T.accent, color: T.accentInk, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><PkIcon name="plus" size={16} sw={2.2} color={T.accentInk} />Ajouter</button>
            <button style={{ height: 44, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, background: T.card, color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: T.shadowSm }}><PkIcon name="share" size={15} sw={1.9} color={T.ink} />Partager</button>
          </div>
        </div>

        {/* workflow vertical */}
        {window.PARCOURS_STAGES.map((s) => (
          <PkStageSection key={s.id} stage={s} tasks={dossier.columns[s.id] || []} overrides={overrides} onToggle={toggle} />
        ))}
      </main>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  CHROME — header liste + tab bar
// ═══════════════════════════════════════════════════════════════════════
const PkHeader = () => {
  const T = PK_useMT();
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <window.MEGGAWordmark color={T.ink} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}><window.MIcon name="search" size={18} sw={2} color={T.ink} /></button>
        <window.MAv bg={T.accent} ink={T.accentInk} size={38}>GL</window.MAv>
      </div>
    </header>
  );
};

const PK_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const PkTabBar = () => {
  const T = PK_useMT();
  const active = "more";
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {PK_TABS.map((tb) => {
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
//  ÉCRAN PARCOURS MOBILE
// ═══════════════════════════════════════════════════════════════════════
const MobileParcoursScreen = ({ dark = false }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const [openId, setOpenId] = React.useState(null);
  const [agentFilter, setAgentFilter] = React.useState("all");
  const [urgency, setUrgency] = React.useState("all");

  const dossiers = React.useMemo(() => window.PARCOURS_DOSSIERS.filter((d) => {
    if (urgency !== "all" && d.urgency !== urgency) return false;
    if (agentFilter !== "all") {
      const has = d.team.some((m) => m.agentId === agentFilter) || pkAllTasks(d).some((t) => t.agentId === agentFilter);
      if (!has) return false;
    }
    return true;
  }), [agentFilter, urgency]);

  const open = openId ? window.PARCOURS_DOSSIERS.find((d) => d.id === openId) : null;

  return (
    <window.MTCtx.Provider value={T}>
      <style>{`.pkTeam::-webkit-scrollbar{display:none}.pkUrg::-webkit-scrollbar{display:none}@keyframes pkFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
      {open ? (
        <PkDetail dossier={open} onBack={() => setOpenId(null)} />
      ) : (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink }}>
          <PkHeader />
          <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
            <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Parcours équipe</h1>
            <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 600, marginTop: 5 }}>Suivi temps réel · {window.PARCOURS_DOSSIERS.length} dossiers actifs</div>

            {/* bandeau équipe (filtre agent) */}
            <PkTeamStrip agentFilter={agentFilter} onPick={setAgentFilter} />

            {/* filtre urgence */}
            <div className="pkUrg" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 18px 2px", margin: "18px -18px 0", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {[{ id: "all", label: "Toutes" }, { id: "high", label: "Haute" }, { id: "medium", label: "Moyenne" }, { id: "low", label: "Sereine" }].map((f) => {
                const on = urgency === f.id;
                const c = f.id !== "all" ? PK_URGENCY[f.id] : null;
                return (
                  <button key={f.id} onClick={() => setUrgency(f.id)} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? T.accentInk : T.ink, background: on ? T.accent : T.card, boxShadow: on ? T.shadow : T.shadowSm, transition: "background .2s ease", whiteSpace: "nowrap" }}>
                    {c && <span style={{ width: 8, height: 8, borderRadius: 999, background: c.bg }} />}{f.label}
                  </button>
                );
              })}
            </div>

            {/* compteur */}
            <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, margin: "18px 2px 0", whiteSpace: "nowrap" }}>{dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} {dossiers.length > 1 ? "affichés" : "affiché"}</div>

            {/* liste */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 12 }}>
              {dossiers.length === 0 ? (
                <div style={{ padding: "44px 20px", textAlign: "center", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 20, color: T.muted, fontSize: 13.5, fontWeight: 600, boxShadow: T.shadowSm }}>Aucun dossier ne correspond aux filtres.</div>
              ) : dossiers.map((d) => (
                <PkDossierCard key={d.id} dossier={d} onOpen={setOpenId} />
              ))}
            </div>
          </main>
          <PkTabBar />
        </div>
      )}
    </window.MTCtx.Provider>
  );
};

window.MobileParcoursScreen = MobileParcoursScreen;
