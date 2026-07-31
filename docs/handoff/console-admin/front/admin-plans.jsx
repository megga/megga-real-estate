// MEGGA CRM — Console admin · PLANS & ABONNEMENTS (poste de triage, juil. 2026)
// ─────────────────────────────────────────────────────────────────────
// Refonte (option A de l'audit « faut-il garder Plans ? ») : la page ne répond
// plus « où en est cette agence ? » — c'est le travail de la FICHE AGENCE, qui
// porte déjà Plan · Sièges · Renouvellement · Paiement. Le déplié de ligne, qui
// recopiait cette section plus un mini-Stripe, est SUPPRIMÉ.
// Ce que la page répond, et qu'aucune fiche ne peut répondre : « où en est le
// revenu ? » — le MRR réel, et les trois files qui le menacent :
//   • Impayés (MRR gelé) · Essais qui finissent · Sièges saturés.
// Une file vide disparaît (grammaire Monitoring). Le portefeuille suit, en
// table nue : un clic ouvre la FICHE AGENCE.
// ⚠️ ACTÉ juil. 2026 — la console NE CHANGE PAS de plan. La montée ou la
// descente de forfait est un geste de l'AGENCE (self-service Stripe) ; MEGGA
// constate et alerte, elle ne décide pas à leur place. Aucun bouton d'upgrade.
// Règle de comptage : un ESSAI ou un IMPAYÉ compte pour ZÉRO MRR.
// Les prix vivent dans Stripe — la console les lit.
(function () {
  const { AdmIcon, AdmPill, AdmGhostBtn, AdmChip, AdmSearch, AdmEmpty, AdmMeter,
          ADM_R, admTones, admCHF, admNum } = window;

  const PLN_PRICE = { Starter: 390, Pro: 1190, Agency: 2340, Entreprise: 4600 };
  const PLN_SEATS = { Starter: 2, Pro: 8, Agency: 20, Entreprise: null };
  const PLN_ORDER = ["Starter", "Pro", "Agency", "Entreprise"];
  // Échéances de facturation (absentes du jeu de données agences).
  // Pour une agence en essai, la date est la FIN D'ESSAI.
  const PLN_RENEW = {
    ag1: "aujourd'hui", ag2: "04.08.2026", ag3: "01.08.2026", ag4: "03.08.2026", ag5: "05.08.2026",
    ag6: "30.07.2026", ag7: "04.08.2026", ag8: "18.08.2026", ag9: "demain", ag10: "30.08.2026",
    ag11: "07.08.2026", ag12: "21.01.2027", ag13: "12.08.2026", ag14: "—",
  };

  // État d'abonnement dérivé : essai · impayé · actif (+ sièges saturés)
  const plnState = (a) => {
    if (a.sub === "trialing") return "trial";
    if (a.sub === "past_due" || a.status === "suspended") return "unpaid";
    return "active";
  };
  const plnMrr = (a) => (plnState(a) === "active" ? PLN_PRICE[a.plan] || a.mrr : 0);
  const plnFull = (a) => {
    const cap = PLN_SEATS[a.plan];
    return plnState(a) === "active" && cap != null && a.agents >= cap;
  };
  const plnFlag = (a) => {
    const s = plnState(a);
    if (s === "unpaid") return { tone: "err", label: "Impayé" };
    if (s === "trial") return { tone: "warn", label: "Essai" };
    if (plnFull(a)) return { tone: "info", label: "Sièges pleins" };
    return { tone: "ok", label: "Actif" };
  };
  const plnTodo = (a) => plnState(a) !== "active" || plnFull(a);

  // ─── Une file de triage : disparaît quand elle est vide ────────────────
  const PlnQueue = ({ title, rows, sp, surf, onOpen }) => {
    if (rows.length === 0) return null;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "0 2px 8px" }}>
          <h3 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: sp.sub }}>{title}</h3>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub }}>{rows.length}</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.a.id} className="adm-row" onClick={() => onOpen(r.a)} style={{
            display: "flex", alignItems: "center", gap: 14, minHeight: 46, padding: "0 12px 0 2px", cursor: "pointer",
            borderTop: i === 0 ? 0 : surf.hairline,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: r.dot, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{r.a.name}</div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.soft, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.amount}</span>
            <AdmIcon name="chevronR" size={15} color={sp.ghost || sp.sub} />
          </div>
        ))}
      </div>
    );
  };

  // ═══ Section ══════════════════════════════════════════════════════════
  const AdminPlansSection = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark);
    const [filter, setFilter] = React.useState("all");
    const [q, setQ] = React.useState("");

    const all = window.ADMIN_AGENCIES || [];

    // Ouvrir la fiche agence — c'est elle qui porte le détail de l'abonnement
    const openAgency = (a) => {
      window.__adminAgencyId = a.id;
      if (onGo) onGo("agencies");
    };

    const nq = q.trim().toLowerCase();
    const rows = all
      .filter((a) => (filter === "all" ? true : filter === "todo" ? plnTodo(a) : a.plan === filter))
      .filter((a) => !nq || a.name.toLowerCase().includes(nq) || (a.city || "").toLowerCase().includes(nq))
      .sort((a, b) => plnMrr(b) - plnMrr(a) || a.name.localeCompare(b.name));

    const mrrTotal = all.reduce((s, a) => s + plnMrr(a), 0);
    const seats = all.reduce((s, a) => s + a.agents, 0);
    const props = all.reduce((s, a) => s + a.properties, 0);
    const unpaid = all.filter((a) => plnState(a) === "unpaid");
    const trials = all.filter((a) => plnState(a) === "trial");
    const full = all.filter(plnFull);
    const counts = { all: all.length, todo: all.filter(plnTodo).length };
    PLN_ORDER.forEach((p) => { counts[p] = all.filter((a) => a.plan === p).length; });
    const calm = unpaid.length === 0 && trials.length === 0 && full.length === 0;

    const th = (label, extra) => (
      <th style={{ textAlign: (extra && extra.align) || "left", width: extra && extra.width, padding: "9px 12px", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: sp.sub }}>{label}</th>
    );
    const td = (children, extra) => (
      <td style={{
        padding: "11px 12px", fontSize: 12.5, fontWeight: 600, color: sp.ink, whiteSpace: "nowrap",
        borderTop: surf.hairline, textAlign: (extra && extra.align) || "left", fontVariantNumeric: "tabular-nums",
        ...(extra && extra.style),
      }}>{children}</td>
    );
    const totalBorder = `1px solid ${dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.16)"}`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {/* MRR — le seul chiffre que la fiche agence ne peut pas donner */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: sp.ink }}>{admCHF(mrrTotal)}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: sp.sub, marginBottom: 5 }}>de MRR</span>
          </div>
        </div>

        {/* Les files : ce qui menace le revenu, rien d'autre */}
        {calm ? (
          <div style={{ padding: "6px 2px 0", fontSize: 13, fontWeight: 600, color: sp.sub }}>
            Rien à traiter — aucun impayé, aucun essai en cours, aucun forfait saturé.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <PlnQueue title="Impayés" sp={sp} surf={surf} onOpen={openAgency}
              rows={unpaid.map((a) => ({ a, dot: T.err, amount: admCHF(PLN_PRICE[a.plan] || a.mrr) + " / mois" }))} />
            <PlnQueue title="Essais qui finissent" sp={sp} surf={surf} onOpen={openAgency}
              rows={trials.map((a) => ({ a, dot: T.warn, amount: admCHF(PLN_PRICE[a.plan] || a.mrr) + " / mois" }))} />
            <PlnQueue title="Sièges saturés" sp={sp} surf={surf} onOpen={openAgency}
              rows={full.map((a) => ({ a, dot: T.info, amount: `${a.agents} / ${PLN_SEATS[a.plan]} sièges` }))} />
          </div>
        )}

        {/* Le portefeuille — une ligne par agence, le détail vit dans sa fiche */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 2px 10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <AdmChip sp={sp} surf={surf} label="Tous" count={counts.all} on={filter === "all"} onClick={() => setFilter("all")} />
              {PLN_ORDER.map((p) => (
                <AdmChip key={p} sp={sp} surf={surf} label={p} count={counts[p]} on={filter === p} onClick={() => setFilter(p)} />
              ))}
              <AdmChip sp={sp} surf={surf} label="À traiter" count={counts.todo} on={filter === "todo"} onClick={() => setFilter("todo")} />
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <AdmSearch sp={sp} surf={surf} dark={dark} width={200} value={q} onChange={setQ} placeholder="Agence ou ville" />
            </div>
          </div>

          {rows.length === 0 ? (
            <AdmEmpty sp={sp} icon="search" title="Aucune agence" hint="Change de filtre ou efface la recherche." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {th("Agence", { width: 236 })}
                {th("Plan", { width: 108 })}
                {th("Sièges", { width: 132 })}
                {th("Biens", { width: 78, align: "right" })}
                {th("MRR", { width: 104, align: "right" })}
                {th("Renouvellement", { width: 132 })}
                {th("Statut")}
                {th("", { width: 34 })}
              </tr></thead>
              <tbody>
                {rows.map((a) => {
                  const flag = plnFlag(a), cap = PLN_SEATS[a.plan], m = plnMrr(a);
                  return (
                    <tr key={a.id} className="adm-row" onClick={() => openAgency(a)} style={{ cursor: "pointer" }}>
                      {td(<>
                        <div style={{ fontWeight: 700, letterSpacing: -0.2 }}>{a.name}</div>
                        <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: sp.sub }}>{a.city}</div>
                      </>)}
                      {td(a.plan)}
                      {td(<span style={{ display: "inline-flex", alignItems: "center" }}>
                        {cap == null ? a.agents : `${a.agents} / ${cap}`}
                        <AdmMeter value={cap == null ? 46 : Math.min(a.agents / cap, 1) * 100} width={58}
                          color={plnFull(a) ? T.info : sp.ink} track={dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)"} />
                      </span>, { style: { paddingRight: 4 } })}
                      {td(admNum(a.properties), { align: "right" })}
                      {td(m ? admCHF(m) : "—", { align: "right", style: { color: m ? sp.ink : sp.sub } })}
                      {td(PLN_RENEW[a.id] || "—")}
                      {td(<AdmPill sp={sp} surf={surf} dark={dark} tone={flag.tone} label={flag.label} />)}
                      {td(<AdmIcon name="chevronR" size={15} color={sp.ghost || sp.sub} />)}
                    </tr>
                  );
                })}
                <tr>
                  {td(<span style={{ fontWeight: 800 }}>{rows.length === all.length ? `${all.length} agences` : `${rows.length} sur ${all.length}`}</span>, { style: { borderTop: totalBorder, paddingTop: 13 } })}
                  {td("", { style: { borderTop: totalBorder } })}
                  {td(<span style={{ fontWeight: 800 }}>{admNum(seats)} sièges</span>, { style: { borderTop: totalBorder } })}
                  {td(<span style={{ fontWeight: 800 }}>{admNum(props)}</span>, { align: "right", style: { borderTop: totalBorder } })}
                  {td(<span style={{ fontWeight: 800 }}>{admCHF(mrrTotal)}</span>, { align: "right", style: { borderTop: totalBorder } })}
                  {td("", { style: { borderTop: totalBorder } })}
                  {td("", { style: { borderTop: totalBorder } })}
                  {td("", { style: { borderTop: totalBorder } })}
                </tr>
              </tbody>
            </table>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 26, margin: "14px 2px 0", paddingTop: 14, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: sp.sub }}>Grille en vigueur</span>
            {PLN_ORDER.map((p) => (
              <span key={p} style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>
                {p} <span style={{ fontWeight: 600, color: sp.sub }}>{admCHF(PLN_PRICE[p])}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  Object.assign(window, { AdminPlansSection, PLN_PRICE, PLN_SEATS, PLN_RENEW, plnState, plnMrr });
})();
