// MEGGA CRM — Console admin · AGENCES (concept A « la liste nue », juillet 2026)
// ─────────────────────────────────────────────────────────────────────
// Profondeur 1 : chips + recherche + CTA et le tableau sont posés À MÊME le
// fond du bento — plus de barre d'outils encardrée, plus de card de tableau.
//   • la colonne « Statut » disparaît : « Active » sur 12 lignes sur 14
//     n'informe personne. Seule l'exception s'affiche, en pilule sur le nom ;
//   • les trois compteurs fusionnent en une ligne de PORTEFEUILLE ;
//   • la santé n'est plus un score de 0 à 100 mais un MOT (Saine · À réveiller
//     · Activation en panne · Dormante · Impayé) ;
//   • aucune animation de survol ; réactivation possible en ligne, la
//     suspension vit dans la fiche agence.
(function () {
  const { AdmPill, AdmGhostBtn, AdmSolidBtn, AdmIcon, AdmAvatar, AdmChip, AdmSearch,
          AdmTh, AdmTd, AdmEmpty, AdmModal, AdmSwitch, AdmLabel,
          admTones, admCHF, admFieldStyle, admFloatSurf } = window;

  const AGX_SHOW = 20;
  const AGX_SUB = { trialing: { label: "Essai", tone: "cyan" }, past_due: { label: "Impayé", tone: "err" } };

  // Santé : un mot, jamais un score nu (+ la même chose en phrase, pour la fiche)
  const agxHealth = (a) => {
    if (a.status === "suspended") return a.sub === "past_due"
      ? { word: "Impayé", tone: "err", sentence: "la facture est restée impayée" }
      : { word: "Dormante", tone: "err", sentence: "le compte est suspendu" };
    if (a.score == null) return { word: "Nouvelle", tone: "mute", sentence: "le compte vient d'être créé" };
    if (a.sub === "trialing" && a.deals === 0 && a.score < 45) return { word: "Activation en panne", tone: "err", sentence: "l'activation est en panne" };
    if (a.score < 45) return { word: "Dormante", tone: "err", sentence: "le compte est dormant" };
    if (a.score < 75) return { word: "À réveiller", tone: "warn", sentence: "l'activité faiblit" };
    return { word: "Saine", tone: "ok", sentence: "le compte est sain" };
  };

  // Actives d'abord, puis MRR décroissant
  const agxSort = (a, b) =>
    (a.status === "suspended" ? 1 : 0) - (b.status === "suspended" ? 1 : 0) ||
    b.mrr - a.mrr || a.name.localeCompare(b.name, "fr");

  // ─── Modale de création (le propriétaire est invité séparément) ─────────
  const AgxCreateModal = ({ onClose, onCreate, sp, dark }) => {
    const F = admFloatSurf(sp, dark);
    const [name, setName] = React.useState("");
    const [city, setCity] = React.useState("");
    const [canton, setCanton] = React.useState("");
    const [plan, setPlan] = React.useState("Starter");
    const [solo, setSolo] = React.useState(false);
    const [note, setNote] = React.useState("");
    const [dupe, setDupe] = React.useState(false);

    const submit = () => {
      const clean = name.trim();
      if (clean.length < 2) return;
      if (window.ADMIN_AGENCIES.some((a) => a.name.toLowerCase() === clean.toLowerCase())) { setDupe(true); return; }
      onCreate({ name: clean, city: city.trim(), canton, plan, solo, note: note.trim() });
    };

    return (
      <AdmModal sp={sp} dark={dark} onClose={onClose} width={540}
        title="Créer une agence"
        subtitle="La création ne rattache personne : le propriétaire est invité dans un second temps."
        footer={<>
          <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={onClose}>Annuler</AdmGhostBtn>
          <AdmSolidBtn sp={sp} onClick={submit} disabled={name.trim().length < 2}>Créer l'agence</AdmSolidBtn>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <AdmLabel sp={sp}>Nom de l'agence</AdmLabel>
            <input value={name} onChange={(e) => { setName(e.target.value); setDupe(false); }} autoFocus style={admFieldStyle(sp, F, dark)} />
            {dupe && <p style={{ margin: "7px 0 0", fontSize: 11.5, fontWeight: 700, color: admTones(dark).err }}>Une agence porte déjà ce nom.</p>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
            <div>
              <AdmLabel sp={sp}>Ville</AdmLabel>
              <input value={city} onChange={(e) => setCity(e.target.value)} style={admFieldStyle(sp, F, dark)} />
            </div>
            <div>
              <AdmLabel sp={sp}>Canton</AdmLabel>
              <select value={canton} onChange={(e) => setCanton(e.target.value)} style={admFieldStyle(sp, F, dark)}>
                <option value="">—</option>
                {window.ADMIN_CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <AdmLabel sp={sp}>Plan</AdmLabel>
            <div role="group" aria-label="Plan" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {window.ADMIN_PLANS.map((p) => (
                <AdmChip key={p} label={p} on={plan === p} onClick={() => setPlan(p)} sp={sp} surf={F} />
              ))}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: sp.ink }}>Agent indépendant</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: sp.sub }}>Une seule personne — l'onglet Équipe reste masqué.</span>
            </span>
            <AdmSwitch on={solo} onClick={() => setSolo(!solo)} sp={sp} dark={dark} />
          </label>
          <div>
            <AdmLabel sp={sp}>Note interne</AdmLabel>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible des super-admins uniquement" style={admFieldStyle(sp, F, dark)} />
          </div>
        </div>
      </AdmModal>
    );
  };

  // ─── Modale de réactivation (ce que la remise en service déclenche) ─────
  const AgxReactivateModal = ({ agency, onClose, onConfirm, sp, dark }) => {
    const F = admFloatSurf(sp, dark), T = admTones(dark);
    const overdue = agency.sub === "past_due";
    const [settle, setSettle] = React.useState(overdue);
    const lines = [
      { k: "Facturation", v: `reprise le 1er août · ${admCHF(agency.mrr)} / mois` },
      { k: "Accès", v: agency.agents ? `${agency.agents} agent${agency.agents > 1 ? "s" : ""} retrouvent leur session` : "aucun agent rattaché pour l'instant" },
      { k: "Annonces", v: agency.properties ? `${agency.properties} bien${agency.properties > 1 ? "s" : ""} repassent en ligne` : "aucun bien à republier" },
    ];
    return (
      <AdmModal sp={sp} dark={dark} onClose={onClose} width={480}
        title={"Réactiver " + agency.name}
        subtitle="L'agence retrouve son plan et son historique — rien n'a été supprimé pendant la suspension."
        footer={<>
          <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={onClose}>Annuler</AdmGhostBtn>
          <AdmSolidBtn sp={sp} onClick={() => onConfirm({ settle })}>Réactiver l'agence</AdmSolidBtn>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 16px", borderRadius: 14, background: F.cardSub }}>
          {lines.map((l) => (
            <div key={l.k} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ width: 92, flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", color: sp.sub }}>{l.k}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: sp.soft, fontVariantNumeric: "tabular-nums", textWrap: "pretty" }}>{l.v}</span>
            </div>
          ))}
        </div>
        {overdue && (
          <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, cursor: "pointer" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: sp.ink }}>Régulariser l'impayé</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 11.5, lineHeight: 1.45, color: sp.sub, textWrap: "pretty" }}>
                Sans cela, l'agence redevient active mais la pilule <span style={{ fontWeight: 700, color: T.err }}>Impayé</span> reste affichée jusqu'au règlement.
              </span>
            </span>
            <AdmSwitch on={settle} onClick={() => setSettle(!settle)} sp={sp} dark={dark} />
          </label>
        )}
      </AdmModal>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  const AdminAgenciesSection = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark);
    const [rows, setRows] = React.useState(() => window.ADMIN_AGENCIES.slice());
    const [q, setQ] = React.useState("");
    const [filt, setFilt] = React.useState("");
    const [shown, setShown] = React.useState(AGX_SHOW);
    const [creating, setCreating] = React.useState(false);
    const [reviving, setReviving] = React.useState(null);
    const [openId, setOpenId] = React.useState(() => {
      const id = window.__adminAgencyId;
      if (id) { delete window.__adminAgencyId; return id; }
      return null;
    });

    const counts = {
      "": rows.length,
      active: rows.filter((a) => a.status === "active").length,
      suspended: rows.filter((a) => a.status === "suspended").length,
      trialing: rows.filter((a) => a.sub === "trialing").length,
    };
    const chips = [
      { id: "", label: "Toutes" }, { id: "active", label: "Actives" },
      { id: "suspended", label: "Suspendues" }, { id: "trialing", label: "Essai" },
    ];

    const filtered = React.useMemo(() => {
      const needle = q.trim().toLowerCase();
      return rows.filter((a) =>
        (!filt || (filt === "trialing" ? a.sub === "trialing" : a.status === filt)) &&
        (!needle || [a.name, a.email, a.city, a.canton].join(" ").toLowerCase().includes(needle))
      ).sort(agxSort);
    }, [rows, q, filt]);
    const visible = filtered.slice(0, shown);

    const create = (payload) => {
      const mrr = { Starter: 390, Pro: 1190, Agency: 2340, Entreprise: 4600 }[payload.plan];
      setRows((list) => [{
        id: "ag" + (list.length + 1) + "n", name: payload.name, email: null, city: payload.city, canton: payload.canton,
        plan: payload.plan, agents: 0, properties: 0, deals: 0, mrr, status: "active", score: null,
        since: "29.07.2026", sub: "trialing", last: "à l'instant", solo: payload.solo, note: payload.note,
      }, ...list]);
      setCreating(false);
      setQ(""); setFilt(""); setShown(AGX_SHOW);
    };

    const healthColor = { ok: sp.soft, warn: T.warn, err: T.err, mute: sp.sub };
    const thSp = { ...sp, tableHeadBg: sp.pageBg };
    const opened = openId && rows.find((a) => a.id === openId);

    // Fiche agence plein cadre (concept B) — la liste s'effface, le fond reste
    if (opened) return (
      <>
        <window.AdmAgencyDetail a={opened} sp={sp} surf={surf} dark={dark} health={agxHealth(opened)}
          onBack={() => setOpenId(null)}
          onSuspend={(a) => setRows((l) => l.map((x) => (x.id === a.id ? { ...x, status: "suspended", last: "à l'instant" } : x)))}
          onGoUser={(u) => { window.__adminUserId = u.id; if (onGo) onGo("users"); }}
          onReactivate={(a) => setReviving(a)} />
        {reviving && (
          <AgxReactivateModal sp={sp} dark={dark} agency={reviving} onClose={() => setReviving(null)}
            onConfirm={({ settle }) => {
              setRows((l) => l.map((x) => (x.id === reviving.id
                ? { ...x, status: "active", sub: settle && x.sub === "past_due" ? "active" : x.sub, last: "à l'instant" }
                : x)));
              setReviving(null);
            }} />
        )}
      </>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Outils posés sur le fond — aucune card */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
            {chips.map((c) => (
              <AdmChip key={c.id || "all"} label={c.label} count={counts[c.id]}
                on={filt === c.id} onClick={() => { setFilt(c.id); setShown(AGX_SHOW); }} sp={sp} surf={surf} />
            ))}
          </div>
          <AdmSearch value={q} onChange={(v) => { setQ(v); setShown(AGX_SHOW); }} placeholder="Nom, ville ou e-mail" sp={sp} surf={surf} dark={dark} width={236} />
          <AdmSolidBtn sp={sp} onClick={() => setCreating(true)}>Créer une agence</AdmSolidBtn>
        </div>

        {visible.length === 0 ? (
          <AdmEmpty sp={sp} icon="building" title={q || filt ? "Aucune agence ne correspond" : "Aucune agence"} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <AdmTh sp={thSp}>Agence</AdmTh>
                <AdmTh sp={thSp} width={96}>Plan</AdmTh>
                <AdmTh sp={thSp} width={214}>Portefeuille</AdmTh>
                <AdmTh sp={thSp} width={108} align="right">MRR</AdmTh>
                <AdmTh sp={thSp} width={152}>Santé</AdmTh>
                <AdmTh sp={thSp} width={132}>Vue</AdmTh>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const h = agxHealth(a);
                const sub = a.status === "suspended" ? { label: "Suspendue", tone: "err" } : AGX_SUB[a.sub];
                return (
                  <tr key={a.id} className="adm-row" role="button" tabIndex={0} aria-label={a.name}
                    onClick={() => setOpenId(a.id)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpenId(a.id); } }}
                    style={{ cursor: "pointer" }}>
                    <AdmTd sp={sp} dark={dark}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                        <AdmAvatar initials={a.name[0].toUpperCase()} size={30} sp={sp} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                            {sub && <AdmPill sp={sp} surf={surf} dark={dark} tone={sub.tone} label={sub.label} style={{ padding: "3px 9px", fontSize: 10.5 }} />}
                          </div>
                          <div style={{ fontSize: 11.5, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.city}{a.canton ? " · " + a.canton : ""}
                          </div>
                        </div>
                      </div>
                    </AdmTd>
                    <AdmTd sp={sp} dark={dark} style={{ color: sp.soft, fontWeight: 600 }}>{a.plan}</AdmTd>
                    <AdmTd sp={sp} dark={dark} style={{ color: sp.sub, fontWeight: 500, whiteSpace: "nowrap" }}>
                      {a.agents} agent{a.agents > 1 ? "s" : ""} · {a.properties} bien{a.properties > 1 ? "s" : ""} · {a.deals} deal{a.deals > 1 ? "s" : ""}
                    </AdmTd>
                    <AdmTd sp={sp} dark={dark} numeric align="right" style={{ whiteSpace: "nowrap", color: a.status === "suspended" ? sp.sub : sp.soft, fontWeight: a.status === "suspended" ? 500 : 600 }}>
                      {a.status === "suspended" ? "non facturée" : admCHF(a.mrr)}
                    </AdmTd>
                    <AdmTd sp={sp} dark={dark} style={{ color: healthColor[h.tone], fontWeight: 700, fontSize: 12 }}>{h.word}</AdmTd>
                    <AdmTd sp={sp} dark={dark}>
                      {a.status === "suspended" ? (
                        <button onClick={(e) => { e.stopPropagation(); setReviving(a); }} style={{
                          height: 28, padding: "0 12px", borderRadius: 999, border: 0, cursor: "pointer",
                          fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                          background: surf.card, boxShadow: sp.shadowSm, color: T.ok,
                        }}>Réactiver</button>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap" }}>{a.last}</span>
                      )}
                    </AdmTd>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {shown < filtered.length && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}` }}>
            <button onClick={() => setShown(shown + AGX_SHOW)} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft,
            }}>
              Voir les {filtered.length - shown} autres
              <AdmIcon name="chevronR" size={14} color={sp.sub} />
            </button>
          </div>
        )}

        {creating && <AgxCreateModal sp={sp} dark={dark} onClose={() => setCreating(false)} onCreate={create} />}
        {reviving && (
          <AgxReactivateModal sp={sp} dark={dark} agency={reviving} onClose={() => setReviving(null)}
            onConfirm={({ settle }) => {
              setRows((l) => l.map((x) => (x.id === reviving.id
                ? { ...x, status: "active", sub: settle && x.sub === "past_due" ? "active" : x.sub, last: "à l'instant" }
                : x)));
              setReviving(null);
            }} />
        )}
      </div>
    );
  };

  Object.assign(window, { AdminAgenciesSection });
})();
