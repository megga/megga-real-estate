// MEGGA CRM — Console admin · COPILOTE IA (concept F acté : B + bascule D)
// ─────────────────────────────────────────────────────────────────────
// Même grammaire que SÉCURITÉ (`admin-security.jsx`) : pas de cards empilées —
// KPI nus 31/800/-1.4, chips, lignes séparées par un filet, déplié en place.
// Accent NOIR seul ; err/warn uniquement en pastille de sévérité ou dépassement
// de jauge (donnée métier), jamais en fond d'UI.
// CONSOMMATION mensuelle, aucune projection (acté juil. 2026). Le quota est une
// alerte à 80 %, jamais un blocage. Mois consultables : juillet (en cours),
// juin, mai. Les dérives n'existent que sur le mois en cours — on n'agit pas
// sur un mois clos. Données : VRAIES tables ADMIN_AGENCIES + ADMIN_USERS.
(function () {
  const { AdmIcon, AdmGhostBtn, AdmSolidBtn, AdmChip, AdmSearch, AdmGroupTitle,
    admTones, admNum, ADM_R } = window;

  const AG = window.ADMIN_AGENCIES || [];
  const US = window.ADMIN_USERS || [];
  const agBy = (id) => AG.find((a) => a.id === id) || { name: id, city: "" };
  const usBy = (id) => US.find((u) => u.id === id) || { name: id };

  // ─── Mois consultables (index 0 = le plus récent) ───────────────────────
  const CO_MONTHS = [
    { k: "07", label: "Juillet", note: "au 29", total: 1847, median: 9, live: true },
    { k: "06", label: "Juin", total: 1694, median: 8 },
    { k: "05", label: "Mai", total: 1521, median: 8 },
  ];

  // cost / calls : [juillet, juin, mai] · quota = plafond mensuel USD (null = sans)
  const CO_AGENCY = [
    { id: "ag12", quota: 550, cost: [412, 378, 350], calls: [14820, 13600, 12590] },
    { id: "ag1",  quota: 400, cost: [388, 296, 268], calls: [12240, 9340, 8460] },
    { id: "ag5",  quota: 400, cost: [217, 221, 208], calls: [7810, 7950, 7480] },
    { id: "ag8",  quota: 400, cost: [186, 189, 174], calls: [6690, 6800, 6260] },
    { id: "ag4",  quota: 200, cost: [148, 143, 131], calls: [5320, 5140, 4710] },
    { id: "ag11", quota: 200, cost: [121, 118, 109], calls: [4350, 4240, 3920] },
    { id: "ag2",  quota: null, cost: [118, 126, 118], calls: [4240, 4530, 4240] },
    { id: "ag3",  quota: 200, cost: [96, 99, 92], calls: [3450, 3560, 3310] },
    { id: "ag13", quota: 200, cost: [84, 79, 61], calls: [3020, 2840, 2190] },
    { id: "ag10", quota: 60,  cost: [50, 45, 10], calls: [1800, 1620, 360] },
    { id: "ag7",  quota: 200, cost: [27, 0, 0], calls: [970, 0, 0], since: "créée le 21.07" },
  ];

  // Comptes nommés (le reste des agents est agrégé)
  const CO_USER = [
    { id: "u2",  ag: "ag1",  mod: "Rédaction",         cost: [142, 103, 96], calls: [4820, 3500, 3260] },
    { id: "u14", ag: "ag12", mod: "Matching",          cost: [118, 111, 104], calls: [3950, 3720, 3480] },
    { id: "u3",  ag: "ag1",  mod: "WhatsApp copilote", cost: [96, 86, 78], calls: [3120, 2790, 2530] },
    { id: "u11", ag: "ag5",  mod: "Rédaction",         cost: [87, 91, 88], calls: [2840, 2970, 2870] },
    { id: "u15", ag: "ag12", mod: "Qualification",     cost: [74, 73, 70], calls: [2440, 2410, 2310] },
    { id: "u7",  ag: "ag8",  mod: "Matching",          cost: [71, 65, 61], calls: [2310, 2110, 1980] },
    { id: "u13", ag: "ag2",  mod: "Rédaction",         cost: [62, 58, 55], calls: [2020, 1890, 1790] },
    { id: "u9",  ag: "ag4",  mod: "Matching",          cost: [58, 56, 52], calls: [1910, 1840, 1710] },
    { id: "u5",  ag: "ag3",  mod: "Rédaction",         cost: [51, 52, 50], calls: [1680, 1710, 1650] },
    { id: "u16", ag: "ag11", mod: "WhatsApp copilote", cost: [49, 47, 44], calls: [1610, 1540, 1450] },
    { id: "u8",  ag: "ag8",  mod: "Documents",         cost: [46, 46, 43], calls: [1480, 1480, 1390] },
    { id: "u12", ag: "ag5",  mod: "Matching",          cost: [41, 40, 38], calls: [1350, 1320, 1250] },
    { id: "u17", ag: "ag7",  mod: "Rédaction",         cost: [27, 0, 0], calls: [890, 0, 0] },
  ];

  // Comptes à zéro appel — le relevé les assume au lieu de les cacher
  const CO_ZERO = [
    { id: "u4",  why: "inactive depuis 47 jours" },
    { id: "u6",  why: "inactive depuis 38 jours" },
    { id: "u10", why: "compte suspendu" },
    { id: "u18", why: "jamais connecté" },
  ];

  const coPct = (cost, quota) => (quota ? Math.round((cost / quota) * 100) : null);
  const coDelta = (arr, m) => (m >= arr.length - 1 || !arr[m + 1] ? null : Math.round(((arr[m] - arr[m + 1]) / arr[m + 1]) * 100));
  const coTrend = (n) => (n == null ? "—" : (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(n) + " %");

  // Jauge de quota : repère à 80 % (l'alerte prévient, ne coupe jamais)
  const CoQuota = ({ r, sp, dark }) => {
    const T = admTones(dark);
    if (r.pct == null) return <span style={{ width: 200, flexShrink: 0, textAlign: "right", fontSize: 11.5, fontWeight: 600, color: sp.ghost || sp.sub }}>sans plafond</span>;
    const hot = r.pct >= 95, warm = r.pct >= 80;
    return (
      <span style={{ width: 200, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, height: 5, borderRadius: 999, position: "relative", background: dark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)" }}>
          <span style={{ position: "absolute", inset: "0 auto 0 0", width: Math.min(100, r.pct) + "%", borderRadius: 999, background: hot ? T.err : warm ? T.warn : sp.ink }} />
          <span style={{ position: "absolute", top: -2, bottom: -2, left: "80%", width: 1.5, background: dark ? "rgba(255,255,255,0.28)" : "rgba(15,23,42,0.26)" }} />
        </span>
        <span style={{ width: 92, textAlign: "right", fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: hot ? T.err : warm ? T.warn : sp.sub }}>{r.pct} % de {r.quota}/mois</span>
      </span>
    );
  };

  const CoAgencyRow = ({ r, sp, dark, open, onToggle }) => {
    const T = admTones(dark);
    return (
      <button onClick={onToggle} className="adm-nav" style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%", minHeight: 48, padding: "0 4px",
        border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: ADM_R.row,
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.15, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
          <span style={{ display: "block", marginTop: 2, fontSize: 11, fontWeight: 500, color: sp.sub }}>{r.city} · {r.agents} comptes</span>
        </span>
        <span style={{ width: 104, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{admNum(r.mCalls)} appels</span>
        <span style={{ width: 62, flexShrink: 0, textAlign: "right", fontSize: 13, fontWeight: 800, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums", color: r.pct >= 95 ? T.err : sp.ink }}>{r.mCost}</span>
        <span style={{ width: 58, flexShrink: 0, textAlign: "right", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: r.delta >= 30 ? T.warn : sp.sub }}>{coTrend(r.delta)}</span>
        <CoQuota r={r} sp={sp} dark={dark} />
        <AdmIcon name="chevronR" size={14} color={sp.ghost || sp.sub} style={{ transform: open ? "rotate(90deg)" : "none" }} />
      </button>
    );
  };

  const CoUserRow = ({ u, sp, dark, showAgency, onClick }) => {
    const T = admTones(dark);
    const hot = u.share >= 40;
    return (
      <div onClick={onClick} className={onClick ? "adm-nav" : undefined} style={{
        display: "flex", alignItems: "center", gap: 13, minHeight: 42, padding: "0 4px",
        borderRadius: ADM_R.row, cursor: onClick ? "pointer" : undefined,
      }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.15, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
          {showAgency && <span style={{ display: "block", marginTop: 1, fontSize: 11, fontWeight: 500, color: sp.sub }}>{u.agName} · {u.agCity}</span>}
        </span>
        <span style={{ width: 150, flexShrink: 0, fontSize: 12, fontWeight: 500, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.mod}</span>
        <span style={{ width: 104, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{admNum(u.mCalls)} appels</span>
        <span style={{ width: 62, flexShrink: 0, textAlign: "right", fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: sp.ink }}>{u.mCost}</span>
        <span style={{ width: 58, flexShrink: 0, textAlign: "right", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: u.delta >= 30 ? T.warn : sp.sub }}>{coTrend(u.delta)}</span>
        <span style={{ width: 200, flexShrink: 0, textAlign: "right", fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: hot ? T.warn : sp.sub }}>{u.share} % de l'agence</span>
      </div>
    );
  };

  const CoFold = ({ label, summary, open, onToggle, children, sp, dark }) => (
    <>
      <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />
      <button onClick={onToggle} className="adm-nav" style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 46, padding: "0 4px",
        border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: ADM_R.row,
      }}>
        <AdmIcon name="chevronR" size={15} color={sp.sub} style={{ transform: open ? "rotate(90deg)" : "none" }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, flexShrink: 0 }}>{label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</span>
      </button>
      {open && <div style={{ padding: "2px 4px 14px 30px" }}>{children}</div>}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════
  const AdminCopilotSection = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark);
    const [m, setM] = React.useState(0);
    const [view, setView] = React.useState("agency");
    const [openAg, setOpenAg] = React.useState(null);
    const [q, setQ] = React.useState("");
    const [dismissed, setDismissed] = React.useState(false);
    const [zeroOpen, setZeroOpen] = React.useState(false);
    const [restOpen, setRestOpen] = React.useState(false);

    const M = CO_MONTHS[m];
    const live = !!M.live;

    // ─── Le mois sélectionné, remis au propre ────────────────────────────
    const rows = CO_AGENCY.filter((a) => a.cost[m] > 0).map((a) => ({
      ...a, ...agBy(a.id), mCost: a.cost[m], mCalls: a.calls[m],
      pct: coPct(a.cost[m], a.quota), delta: coDelta(a.cost, m),
    })).sort((x, y) => y.mCost - x.mCost);

    const users = CO_USER.filter((u) => u.cost[m] > 0).map((u) => {
      const a = CO_AGENCY.find((x) => x.id === u.ag);
      return { ...u, ...usBy(u.id), agName: agBy(u.ag).name, agCity: agBy(u.ag).city,
        mCost: u.cost[m], mCalls: u.calls[m], delta: coDelta(u.cost, m),
        share: Math.round((u.cost[m] / a.cost[m]) * 100) };
    }).sort((x, y) => y.mCost - x.mCost);

    const activeAccounts = rows.reduce((s, r) => s + r.agents, 0);
    const namedCost = users.reduce((s, u) => s + u.mCost, 0);
    const alerts = rows.filter((r) => r.pct != null && r.pct >= 80).length;
    const silent = CO_AGENCY.length - rows.length + (AG.length - CO_AGENCY.length);

    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const match = (hay) => !q.trim() || norm(q).split(/\s+/).every((w) => norm(hay).includes(w));
    const agRows = rows.filter((r) => match(r.name + " " + r.city));
    const usRows = users.filter((u) => match(u.name + " " + u.agName + " " + u.agCity + " " + u.mod));
    const usersOf = (id) => users.filter((u) => u.ag === id);

    // ─── Dérives : mois en cours seulement ───────────────────────────────
    const top = users[0], worst = rows.find((r) => r.pct != null && r.pct >= 95);
    const devs = [];
    if (live) {
      if (worst) devs.push({ id: "d1", sev: "crit", title: worst.name + " à " + worst.pct + " % de son plafond mensuel",
        actions: <AdmGhostBtn sp={sp} surf={surf} style={{ height: 32 }} onClick={() => { setView("agency"); setQ(""); setOpenAg(worst.id); }}>Son relevé</AdmGhostBtn> });
      if (!dismissed && top) devs.push({ id: "d2", sev: "warn", title: top.name + " pèse " + Math.round(top.mCost / M.median) + "× la médiane — " + top.share + " % de son agence",
        actions: <>
          <AdmGhostBtn sp={sp} surf={surf} style={{ height: 32 }} onClick={() => { setView("account"); setQ(top.name.split(" ")[0]); }}>Son détail</AdmGhostBtn>
          <AdmSolidBtn sp={sp} style={{ height: 32 }} onClick={() => setDismissed(true)}>Rien à signaler</AdmSolidBtn>
        </> });
      devs.push({ id: "d3", sev: "warn", title: "« Synchroniser le calendrier » échoue une fois sur neuf",
        actions: <AdmSolidBtn sp={sp} style={{ height: 32 }} onClick={() => onGo && onGo("monitoring")}>Ouvrir dans Monitoring</AdmSolidBtn> });
    }

    const kpi = [
      { v: "USD " + admNum(M.total), l: "consommé en " + M.label.toLowerCase() + (M.note ? " (" + M.note + ")" : "") },
      { v: "USD " + M.median, l: "médiane par compte" },
      { v: alerts, l: alerts === 1 ? "alerte quota" : "alertes quota", tone: alerts ? "warn" : null },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* Mois + recherche */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
          {CO_MONTHS.map((mo, i) => (
            <AdmChip key={mo.k} label={mo.label} on={m === i} onClick={() => { setM(i); setOpenAg(null); }} sp={sp} surf={surf} />
          ))}
          <span style={{ marginLeft: "auto" }}>
            <AdmSearch value={q} onChange={setQ} placeholder="Agence, compte…" sp={sp} surf={surf} dark={dark} width={220} />
          </span>
        </div>

        {/* KPI */}
        <div style={{ display: "flex", gap: 42, flexWrap: "wrap", marginBottom: live ? 20 : 22 }}>
          {kpi.map((n) => (
            <div key={n.l}>
              <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: n.tone ? T[n.tone] : sp.ink }}>{n.v}</div>
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{n.l}</div>
            </div>
          ))}
        </div>

        {/* Dérives — mois en cours seulement */}
        {devs.map((d, i) => (
          <React.Fragment key={d.id}>
            {i > 0 && <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 13, minHeight: 50, padding: "4px 4px" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: d.sev === "crit" ? T.err : T.warn }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: -0.15, color: sp.ink }}>{d.title}</span>
              <span style={{ display: "flex", gap: 8, flexShrink: 0 }}>{d.actions}</span>
            </div>
          </React.Fragment>
        ))}

        {/* Bascule B / D */}
        <AdmGroupTitle sp={sp} dark={dark} label={"Le relevé de " + M.label.toLowerCase()} padding="24px 4px 10px"
          right={!live ? <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub }}>mois clos</span> : null} />
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
          <AdmChip label="Par agence" count={rows.length} on={view === "agency"} onClick={() => setView("agency")} sp={sp} surf={surf} />
          <AdmChip label="Par compte" count={activeAccounts} on={view === "account"} onClick={() => setView("account")} sp={sp} surf={surf} />
        </div>

        <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />

        {/* ── Par agence — le déplié montre ses comptes ── */}
        {view === "agency" && (agRows.length === 0
          ? <div style={{ padding: "26px 4px", fontSize: 12.5, fontWeight: 600, color: sp.sub }}>Aucune agence pour « {q} ».</div>
          : <>
            {agRows.map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 && <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />}
                <CoAgencyRow r={r} sp={sp} dark={dark} open={openAg === r.id} onToggle={() => setOpenAg(openAg === r.id ? null : r.id)} />
                {openAg === r.id && (
                  <div style={{ padding: "2px 4px 12px 16px" }}>
                    {usersOf(r.id).map((u) => <CoUserRow key={u.id} u={u} sp={sp} dark={dark} />)}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "0 4px", fontSize: 11.5, fontWeight: 500, color: sp.sub }}>
                      {Math.max(0, r.agents - usersOf(r.id).length)} autres comptes — USD {r.mCost - usersOf(r.id).reduce((s, u) => s + u.mCost, 0)}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
            {!q.trim() && (
              <>
                <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 46, padding: "0 4px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.soft }}>{silent} agences sans aucun appel</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>Total USD {admNum(M.total)}</span>
                </div>
              </>
            )}
          </>)}

        {/* ── Par compte (D intégré) ── */}
        {view === "account" && (usRows.length === 0
          ? <div style={{ padding: "26px 4px", fontSize: 12.5, fontWeight: 600, color: sp.sub }}>Aucun compte pour « {q} ».</div>
          : <>
            {usRows.map((u, i) => (
              <React.Fragment key={u.id}>
                {i > 0 && <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />}
                <CoUserRow u={u} sp={sp} dark={dark} showAgency onClick={() => { setView("agency"); setQ(""); setOpenAg(u.ag); }} />
              </React.Fragment>
            ))}
            {!q.trim() && (
              <CoFold sp={sp} dark={dark} label={activeAccounts - users.length + " autres comptes"}
                summary={"USD " + admNum(M.total - namedCost) + " · médiane USD " + M.median}
                open={restOpen} onToggle={() => setRestOpen(!restOpen)}>
                <div style={{ fontSize: 12, fontWeight: 500, color: sp.sub, lineHeight: 1.55, textWrap: "pretty" }}>
                  La moitié des comptes actifs consomme moins de USD 5 dans le mois.
                </div>
              </CoFold>
            )}
            {!q.trim() && (
              <CoFold sp={sp} dark={dark} label={CO_ZERO.length + " comptes à zéro appel"}
                summary="inactivité, suspension, invitation jamais ouverte"
                open={zeroOpen} onToggle={() => setZeroOpen(!zeroOpen)}>
                {CO_ZERO.map((z, i) => {
                  const u = usBy(z.id);
                  return (
                    <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 38, padding: "0 4px", borderTop: i ? `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}` : "none" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: sp.soft }}>{u.name}<span style={{ fontWeight: 500, color: sp.sub }}> — {u.agency || "sans agence"}</span></span>
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub }}>{z.why}</span>
                    </div>
                  );
                })}
              </CoFold>
            )}
          </>)}
      </div>
    );
  };

  Object.assign(window, { AdminCopilotSection });
})();
