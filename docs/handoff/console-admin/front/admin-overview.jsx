// MEGGA CRM — Console admin · VUE D'ENSEMBLE (concept A affiné, juillet 2026)
// ─────────────────────────────────────────────────────────────────────
// Refonte : la page ne recopie plus les autres entrées de la console.
//   • profondeur 1 — aucune card empilée ; la tête « À traiter » est la SEULE
//     surface creusée de l'écran (jamais card dans card) ;
//   • une phrase de pouls, six chiffres NUS, une tête de décisions, un journal
//     unique (alertes + activité fusionnées), deux renvois en pied ;
//   • volume-adaptatif : la tête agrège par famille au-delà de 3 signaux, le
//     journal passe en maille groupée au-delà de 40 événements/heure.
// Ce qui a quitté cette page : Activité temps réel → Live · Revenus → Plans &
// abonnements · Activation → Agences · Santé technique → Monitoring.
(function () {
  const { AdmIcon, AdmChip, AdmGhostBtn, AdmSolidBtn, admTones, admCHF, admNum, ADM_R } = window;

  const AOV_GROUP_THRESHOLD = 40; // événements/h au-delà desquels le journal groupe
  const AOV_HEAD_MAX = 3;         // familles de signaux montrées dans la tête

  const aovHair = (dark) => `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`;
  const aovNeutral = (dark) => (dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.12)");

  // ─── Ligne de pouls ───────────────────────────────────────────────────
  const AovPulse = ({ sp, dark, onGo }) => {
    const T = admTones(dark), H = window.ADMIN_HEALTH;
    const woes = [];
    if (H.functionsErr) woes.push(`${H.functionsErr} fonction${H.functionsErr > 1 ? "s" : ""} en erreur`);
    if (H.cronsLate) woes.push(`${H.cronsLate} cron${H.cronsLate > 1 ? "s" : ""} en retard`);
    const healthy = woes.length === 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: healthy ? T.ok : T.warn, flexShrink: 0 }} />
        <strong style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: sp.ink }}>
          {healthy ? "Plateforme saine" : "Attention requise"}
        </strong>
        <span style={{ fontSize: 15, fontWeight: 500, color: sp.sub }}>
          {healthy ? "— aucun incident sur 24 h" : null}
        </span>
        <button onClick={() => onGo && onGo("monitoring")} style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, border: 0, background: "transparent",
          cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: sp.soft,
        }}>Monitoring<AdmIcon name="chevronR" size={14} color={sp.sub} /></button>
      </div>
    );
  };

  // ─── Chiffres NUS (aucune card) ───────────────────────────────────────
  const AovNumbers = ({ sp, dark }) => {
    const T = admTones(dark), K = window.ADMIN_KPIS, B = window.ADMIN_BILLING;
    const items = [
      { v: K.activeAgencies, l: "agences" },
      { v: admNum(K.totalUsers), l: "comptes agents" },
      { v: admNum(K.activeProperties), l: "biens actifs" },
      { v: admNum(K.activeTransactions), l: "transactions" },
      { v: admCHF(B.mrr), l: "MRR" },
    ];
    return (
      <div style={{ display: "flex", gap: 46, flexWrap: "wrap" }}>
        {items.map((it) => (
          <div key={it.l}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 31, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1, color: it.warn ? T.err : sp.ink, fontVariantNumeric: "tabular-nums" }}>
              {it.v}
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>
              {it.l}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Signaux : familles agrégées, triées technique > argent > croissance ─
  // Le KYC/LBA des clients finaux N'EST PAS l'affaire de la plateforme : il
  // appartient à l'agence. Aucun signal, aucun chiffre de conformité ici.
  const aovSignals = () => {
    const A = window.ADMIN_ALERTS, H = window.ADMIN_HEALTH, B = window.ADMIN_BILLING;
    const tickets = A.filter((a) => a.action === "ticket_created");
    const out = [];
    if (H.functionsErr) out.push({
      id: "fn", icon: "alert", tone: "err",
      title: H.functionsErr === 1 ? "realadvisor-sync en erreur" : `${H.functionsErr} fonctions en erreur`,
      cta: "Voir les logs", go: "monitoring", solid: true,
    });
    if (B.failed) out.push({
      id: "pay", icon: "card", tone: "warn",
      title: `${B.failed} paiement${B.failed > 1 ? "s" : ""} échoué${B.failed > 1 ? "s" : ""}`,
      cta: "Revenus", go: "plans",
    });
    if (tickets.length) out.push({
      id: "tk", icon: "message", tone: "info",
      title: tickets.length === 1 ? "Nouveau ticket support" : `${tickets.length} tickets support`,
      cta: "Ouvrir", go: "live",
    });
    return out;
  };

  const AovHead = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark);
    const [all, setAll] = React.useState(false);
    const sig = aovSignals();
    const shown = all ? sig : sig.slice(0, AOV_HEAD_MAX);
    const rest = sig.length - shown.length;
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 10px" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: sig.length ? T.err : T.ok, flexShrink: 0 }} />
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, letterSpacing: 0.1, color: sp.ink }}>À traiter</h3>
          {sig.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 11px", borderRadius: 999, background: T.err, color: "#FFFFFF", fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{sig.length}</span>
          )}
        </div>
        {sig.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 54, padding: "0 15px", borderRadius: ADM_R.row, boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)"} inset` }}>
            <AdmIcon name="check" size={16} color={T.ok} />
            <span style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>Rien à traiter</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: sp.sub }}>— dernier incident il y a 3 jours</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {shown.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 13, minHeight: 60, padding: "0 15px", borderRadius: ADM_R.row, background: surf.cardSub }}>
                <AdmIcon name={s.icon} size={18} color={T[s.tone] || sp.sub} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.25, color: sp.ink }}>{s.title}</div>
                  {s.detail ? <div style={{ marginTop: 3, fontSize: 12, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.detail}</div> : null}
                </div>
                {s.solid
                  ? <AdmSolidBtn sp={sp} onClick={() => onGo && onGo(s.go)}>{s.cta}</AdmSolidBtn>
                  : <AdmGhostBtn sp={sp} surf={surf} onClick={() => onGo && onGo(s.go)}>{s.cta}</AdmGhostBtn>}
              </div>
            ))}
          </div>
        )}
        {(rest > 0 || all) && sig.length > AOV_HEAD_MAX && (
          <button onClick={() => setAll(!all)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px 0", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft }}>
            {all ? "Replier les signaux" : `Voir les ${rest} autres signaux`}
            <AdmIcon name="chevronR" size={14} color={sp.sub} />
          </button>
        )}
      </>
    );
  };

  // ─── Journal unique : alertes + activité, une seule grammaire de ligne ──
  const AOV_ALERT_CAT = {
    kyc_screening_match: "kyc", edge_function_error: "errors",
    ticket_created: "support", agency_created: "agencies", subscription_cancelled: "billing",
  };
  const AOV_CAT_LABEL = { properties: "Biens", pipeline: "Pipeline", contacts: "Contacts", emails: "Emails", errors: "Erreurs", support: "Support", agencies: "Agences", billing: "Abonnements" };
  const AOV_RANK = { err: 0, warn: 1, info: 2, ok: 3, none: 4 };

  const aovJournal = () => {
    const alerts = window.ADMIN_ALERTS.map((a) => ({
      id: a.id, tone: a.tone, label: a.label, detail: a.detail, agency: null,
      cat: AOV_ALERT_CAT[a.action] || "support", when: a.when,
    }));
    const acts = window.ADMIN_ACTIVITY.map((e) => ({
      id: e.id, tone: e.cat === "errors" ? "err" : "none", label: e.label,
      detail: e.target, agency: e.agency, cat: e.cat, when: e.when,
    }));
    // La conformité des clients finaux relève de l'agence : elle ne remonte pas ici.
    return alerts.concat(acts).filter((r) => r.cat !== "kyc")
      .sort((a, b) => (AOV_RANK[a.tone] ?? 4) - (AOV_RANK[b.tone] ?? 4));
  };

  const AovJournal = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark), hair = aovHair(dark);
    const rows = React.useMemo(aovJournal, []);
    const auto = rows.length > AOV_GROUP_THRESHOLD;
    const [cat, setCat] = React.useState("all");
    const [grouped, setGrouped] = React.useState(auto);
    const filtered = cat === "all" ? rows : rows.filter((r) => r.cat === cat);

    const cats = React.useMemo(() => {
      const seen = [];
      rows.forEach((r) => { if (!seen.includes(r.cat)) seen.push(r.cat); });
      return seen.filter((c) => AOV_CAT_LABEL[c]);
    }, [rows]);

    // Maille groupée : une ligne = une famille (compteur, agences, dernier)
    const families = React.useMemo(() => {
      const m = new Map();
      filtered.forEach((r) => {
        const f = m.get(r.label) || { label: r.label, tone: r.tone, count: 0, agencies: new Set(), last: r.when };
        f.count += 1; if (r.agency) f.agencies.add(r.agency);
        if (AOV_RANK[r.tone] < AOV_RANK[f.tone]) f.tone = r.tone;
        m.set(r.label, f);
      });
      return [...m.values()].sort((a, b) => (AOV_RANK[a.tone] - AOV_RANK[b.tone]) || b.count - a.count);
    }, [filtered]);

    const dotOf = (tone) => (tone === "none" ? aovNeutral(dark) : T[tone] || sp.sub);
    const showToggle = rows.length > 15;

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 8px" }}>
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, letterSpacing: 0.1, color: sp.ink }}>Journal</h3>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
            {auto && <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>Groupé au-delà de {AOV_GROUP_THRESHOLD} évén./h</span>}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {showToggle && <>
                <AdmChip sp={sp} surf={surf} label="Familles" count={families.length} on={grouped} onClick={() => setGrouped(true)} />
                <AdmChip sp={sp} surf={surf} label="Détail" count={rows.length} on={!grouped} onClick={() => setGrouped(false)} />
              </>}
              {!grouped && <>
                <AdmChip sp={sp} surf={surf} label="Tous" count={rows.length} on={cat === "all"} onClick={() => setCat("all")} />
                {cats.map((c) => (
                  <AdmChip key={c} sp={sp} surf={surf} label={AOV_CAT_LABEL[c]} count={rows.filter((r) => r.cat === c).length} on={cat === c} onClick={() => setCat(c)} />
                ))}
              </>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {grouped
            ? families.map((f, i) => (
                <div key={f.label} className="adm-row" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 46, padding: "0 4px", borderTop: i ? hair : 0, borderRadius: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: dotOf(f.tone), flexShrink: 0 }} />
                  <span style={{ width: 180, flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{f.label}</span>
                  <span style={{ width: 56, flexShrink: 0, fontSize: 14, fontWeight: 800, letterSpacing: -0.4, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>{admNum(f.count)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {f.agencies.size ? `${f.agencies.size} agence${f.agencies.size > 1 ? "s" : ""}` : "plateforme"}
                  </span>
                  <span style={{ width: 96, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{f.last}</span>
                  <AdmIcon name="chevronR" size={15} color={sp.ghost || sp.sub} />
                </div>
              ))
            : filtered.slice(0, 9).map((r, i) => (
                <div key={r.id} className="adm-row" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 46, padding: "0 4px", borderTop: i ? hair : 0, borderRadius: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: dotOf(r.tone), flexShrink: 0 }} />
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{r.label}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.detail}</span>
                  {r.agency && <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub }}>{r.agency}</span>}
                  <span style={{ width: 96, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{r.when}</span>
                </div>
              ))}
        </div>
        {!grouped && filtered.length > 9 && (
          <button onClick={() => onGo && onGo("live")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 4px 0", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft }}>
            Les {filtered.length - 9} événements plus anciens dans Live<AdmIcon name="chevronR" size={14} color={sp.sub} />
          </button>
        )}
      </>
    );
  };

  // ─── Pied : renvois porteurs de signal, jamais de tableau recopié ──────
  const AovFoot = ({ sp, dark, onGo, onDiagnose }) => {
    const T = admTones(dark), hair = aovHair(dark), B = window.ADMIN_BILLING;
    const O = window.ADMIN_ONBOARDING, F = window.ADMIN_KYC_FUNNEL;
    // Le tunnel des liens KYC est ici comme santé de DÉLIVRANCE (le lien
    // magique passe-t-il ?), agrégé et sans noms — pas comme conformité.
    const dormant = O.filter((o) => o.status === "dormant").length, risk = O.filter((o) => o.status === "atRisk").length;
    const rows = [
      { lb: "Activation", vl: O.length, dt: `${dormant} agence${dormant > 1 ? "s" : ""} dormante${dormant > 1 ? "s" : ""}, ${risk} à risque`, on: dormant + risk > 0, go: "agencies" },
      { lb: "Liens KYC publics", vl: F.sent30d, dt: `${F.opened} ouverts · ${F.confirmed} confirmés · ${F.conversion} % de conversion sur 30 j`, on: F.conversion < 50, diag: true },
      { lb: "Revenus", vl: B.subscriptions, dt: `abonnements actifs · ARPU ${admCHF(B.arpu)} · ${B.failed} paiement${B.failed > 1 ? "s" : ""} échoué${B.failed > 1 ? "s" : ""}`, on: false, go: "plans" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((r) => (
          <button key={r.lb} onClick={() => (r.diag ? onDiagnose && onDiagnose() : onGo && onGo(r.go))} className="adm-row" style={{
            display: "flex", alignItems: "center", gap: 12, minHeight: 48, padding: "0 4px", border: 0, borderTop: hair,
            background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: 8,
          }}>
            <span style={{ width: 120, flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{r.lb}</span>
            <span style={{ width: 88, flexShrink: 0, fontSize: 14, fontWeight: 800, letterSpacing: -0.4, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>{admNum(r.vl)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: r.on ? 700 : 500, color: r.on ? T.warn : sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.dt}</span>
            {r.diag
              ? <span style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 13px", borderRadius: 999, flexShrink: 0, background: surfCard(sp, dark), boxShadow: sp.shadowSm, fontSize: 12, fontWeight: 700, color: sp.ink }}>Diagnostiquer un lien</span>
              : <AdmIcon name="chevronR" size={16} color={sp.ghost || sp.sub} />}
          </button>
        ))}
      </div>
    );
  };

  // Le diagnostic de lien est un OUTIL, pas une destination : plus d'entrée de
  // rail « Support » — la modale s'ouvre depuis la ligne des liens KYC.
  const surfCard = (sp, dark) => (dark ? (window.crmStep ? window.crmStep("s2", "#1A1D26") : "#1A1D26") : "#FFFFFF");

  // ═══════════════════════════════════════════════════════════════════════
  const AdminOverviewSection = ({ sp, surf, dark, onGo }) => {
    const [diag, setDiag] = React.useState(false);
    return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <AovPulse sp={sp} dark={dark} onGo={onGo} />
      <div style={{ margin: "26px 0 24px" }}><AovNumbers sp={sp} dark={dark} /></div>
      <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
      <div style={{ paddingTop: 22 }}><AovHead sp={sp} surf={surf} dark={dark} onGo={onGo} /></div>
      <div style={{ paddingTop: 28 }}><AovJournal sp={sp} surf={surf} dark={dark} onGo={onGo} /></div>
      <div style={{ paddingTop: 26 }}><AovFoot sp={sp} dark={dark} onGo={onGo} onDiagnose={() => setDiag(true)} /></div>
      {window.AdmKycDiagnostic && <window.AdmKycDiagnostic open={diag} onClose={() => setDiag(false)} sp={sp} dark={dark} onGo={onGo} />}
    </div>
    );
  };

  Object.assign(window, { AdminOverviewSection });
})();
