// MEGGA CRM — Console admin · SÉCURITÉ (« le registre »)
// ─────────────────────────────────────────────────────────────────────
// Concept A de `Console - Sécurité (concepts).html` : le journal des actions
// sensibles remis au propre — 4 KPI, recherche par acteur/entité, filtres par
// famille, une ligne par événement (horodatage · sévérité · action · entité ·
// acteur), metadata au déplié de la ligne, routine repliée en pied.
// L'export produit un extrait daté et signé (chaîne de hash) — et s'auto-journalise.
(function () {
  const { AdmIcon, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmChip, AdmSearch, AdmModal, AdmGroupTitle,
    admFloatSurf, admTones, admNum, ADM_R } = window;

  // ─── Journal du jour ───────────────────────────────────────────────────
  // fam : impers · identity · plans · deploy · session · export · link
  const SEC_EVENTS = [
    {
      id: "e1", ts: "13:52:07", sev: "warn", fam: "deploy",
      action: "Retour de déploiement v2.41.0 → v2.40.3", entity: "Plateforme · edge functions", actor: "Loïc Perret",
      meta: [["Motif", "realadvisor-sync en échec depuis 09:12"], ["Portée", "42 fonctions redéployées"], ["Origine", "Console · Monitoring"], ["Réversible", "oui — v2.41.0 conservée"]],
    },
    {
      id: "e2", ts: "11:20:41", sev: "crit", fam: "identity",
      action: "Vérification LBA invalidée — identité modifiée", entity: "Contact · Sophie Marchand · Régie Lacustre", actor: "Yann Rossier",
      meta: [["Champ modifié", "date de naissance · 14.03.1981 → 14.03.1982"], ["Conséquence", "bluecheck retiré, procédure LBA à recommencer"], ["Agence prévenue", "oui — 11:20, Nadia Overney"], ["Confirmation", "modale d'avertissement acceptée"]],
    },
    {
      id: "e3", ts: "11:02:16", sev: "warn", fam: "impers",
      action: "Connexion en tant que — session 4 min", entity: "Compte · Fabienne Girod · Alpes & Rives", actor: "Camille Aebi",
      meta: [["Motif", "ticket #4182 — « export des mandats »"], ["Vu", "1 écran Mes biens, 1 export rejoué"], ["Modifications", "aucune"], ["Fin de session", "11:06 · manuelle"]],
    },
    {
      id: "e4", ts: "10:53:02", sev: "warn", fam: "export",
      action: "Export DSAR (JSON) — 1 compte", entity: "Console · Utilisateurs", actor: "Camille Aebi",
      meta: [["3ᵉ export en 9 min", "10:44 · 10:49 · 10:53"], ["Portée", "compte, consentements, activité"], ["Destination", "téléchargement navigateur"], ["Moyenne du compte", "2 exports par mois"]],
    },
    {
      id: "e5", ts: "10:33:55", sev: "info", fam: "link",
      action: "Lien KYC régénéré et remis à l'agence", entity: "Lien · Bosson & Filles", actor: "Camille Aebi",
      meta: [["Signalé par", "l'agence — lien expiré"], ["Ancien lien", "invalidé immédiatement"], ["Remis à", "l'agence, jamais au client final"], ["Client final", "aucun nom consulté"]],
    },
    {
      id: "e6", ts: "09:41:08", sev: "warn", fam: "impers",
      action: "Connexion en tant que — session 12 min", entity: "Compte · Nadia Overney · Régie Lacustre", actor: "Yann Rossier",
      meta: [["Motif", "reproduction d'un bug de matching"], ["Vu", "3 fiches contact"], ["Modifications", "aucune"], ["Fin de session", "09:53 · expiration"]],
    },
    {
      id: "e7", ts: "09:12:44", sev: "info", fam: "session",
      action: "Entrée dans la console admin", entity: "Session · IP 46.14.··· · Genève", actor: "Yann Rossier",
      meta: [["Appareil", "macOS · Safari 18"], ["Durée", "en cours"], ["Habituel", "oui — 187 entrées depuis cette IP"]],
    },
    {
      id: "e8", ts: "02:14:19", sev: "crit", fam: "session",
      action: "Entrée dans la console admin — hors heures", entity: "Session · IP 85.195.··· · Zurich", actor: "Yann Rossier",
      meta: [["Écart", "aucune connexion entre 22 h et 7 h en 9 mois"], ["IP", "jamais vue"], ["Session", "9 min · 4 lectures · aucune modification"], ["Appareil", "macOS · Safari 18"]],
    },
  ];

  const SEC_ROUTINE = [
    { id: "r1", ts: "13:41:00", action: "Diffusion — 3 annonces poussées vers Immobilier.ch", entity: "Cron · diffusion-immobilier", actor: "Système" },
    { id: "r2", ts: "12:03:11", action: "Webhook Stripe reçu — paiement mensuel", entity: "Abonnement · Helvetia Prime SA", actor: "Système" },
    { id: "r3", ts: "10:49:20", action: "Export DSAR (JSON) — 1 compte", entity: "Console · Utilisateurs", actor: "Camille Aebi" },
    { id: "r4", ts: "10:44:02", action: "Export DSAR (JSON) — 1 compte", entity: "Console · Utilisateurs", actor: "Camille Aebi" },
    { id: "r5", ts: "08:30:07", action: "Rapport hebdomadaire envoyé — 14 agences", entity: "Cron · rapport-hebdo", actor: "Système" },
  ];

  const SEC_FILTERS = [
    { k: "all", label: "Tout", n: 340 },
    { k: "crit", label: "Critique", n: 2 },
    { k: "warn", label: "Avertissement", n: 5 },
    { k: "impers", label: "Impersonation", n: 2 },
    { k: "identity", label: "Identité & KYC", n: 4 },
    { k: "plans", label: "Abonnements", n: 1 },
    { k: "deploy", label: "Déploiements", n: 1 },
  ];

  const SEC_CHAIN = { sealed: 128642, last: "13:52:07", head: "4f9e2c··· c21", checked: "13:55" };

  const secSevColor = (sev, T, dark) => (sev === "crit" ? T.err : sev === "warn" ? T.warn
    : (dark ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.16)"));

  // ─── Ligne d'événement ─────────────────────────────────────────────────
  const SecRow = ({ e, sp, dark, open, onToggle, dim }) => {
    const T = admTones(dark);
    return (
      <>
        <button onClick={onToggle} className="adm-nav" style={{
          display: "flex", alignItems: "center", gap: 13, width: "100%", minHeight: 46, padding: "0 4px",
          border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: ADM_R.row,
        }}>
          <span style={{ width: 64, flexShrink: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 700, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{e.ts}</span>
          <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: secSevColor(e.sev, T, dark) }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: dim ? 600 : 700, letterSpacing: -0.15, color: dim ? sp.soft : sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.action}</span>
          <span style={{ width: 280, flexShrink: 0, fontSize: 12, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.entity}</span>
          <span style={{ width: 132, flexShrink: 0, fontSize: 12, fontWeight: 600, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.actor}</span>
          <AdmIcon name="chevronR" size={14} color={sp.ghost || sp.sub} style={{ transform: open ? "rotate(90deg)" : "none" }} />
        </button>
        {open && e.meta && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "13px 40px", padding: "6px 4px 16px 85px" }}>
            {e.meta.map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>{l}</div>
                <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 700, color: sp.ink, textWrap: "pretty" }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // ─── Extrait pour un audit ─────────────────────────────────────────────
  const SEC_PERIODS = ["Aujourd'hui", "7 derniers jours", "Ce mois", "01.07 → 29.07.2026"];
  const SEC_SCOPES = ["Critique + avertissement", "Tout le registre"];
  const SEC_VOL = { "Aujourd'hui": { c: 7, a: 340 }, "7 derniers jours": { c: 41, a: 2380 }, "Ce mois": { c: 184, a: 9640 }, "01.07 → 29.07.2026": { c: 184, a: 9640 } };

  const SecExportModal = ({ sp, dark, onClose }) => {
    const F = admFloatSurf(sp, dark), chipSurf = { ...F, card: F.cardSub };
    const [period, setPeriod] = React.useState("Ce mois");
    const [scope, setScope] = React.useState("Critique + avertissement");
    const [done, setDone] = React.useState(false);
    const vol = SEC_VOL[period] || SEC_VOL["Ce mois"];
    const n = scope === "Tout le registre" ? vol.a : vol.c;
    return (
      <AdmModal sp={sp} dark={dark} width={620} onClose={onClose} title="Extrait du registre"
        subtitle="PDF horodaté, empreinte de chaîne en pied de chaque page. L'export est lui-même journalisé."
        footer={done
          ? <AdmPill label={"Extrait produit · " + admNum(n) + " événements · journalisé"} sp={sp} surf={chipSurf} dark={dark} />
          : <>
            <AdmGhostBtn sp={sp} surf={chipSurf} onClick={onClose}>Annuler</AdmGhostBtn>
            <AdmSolidBtn sp={sp} icon="download" onClick={() => setDone(true)}>Produire l'extrait</AdmSolidBtn>
          </>}>
        <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub, marginBottom: 8 }}>Période</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 18 }}>
          {SEC_PERIODS.map((p) => <AdmChip key={p} label={p} on={period === p} onClick={() => setPeriod(p)} sp={sp} surf={chipSurf} />)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub, marginBottom: 8 }}>Sévérité</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 18 }}>
          {SEC_SCOPES.map((s) => <AdmChip key={s} label={s} on={scope === s} onClick={() => setScope(s)} sp={sp} surf={chipSurf} />)}
        </div>
        <div style={{ background: F.cardSub, borderRadius: 16, padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 40px" }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>Volume</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>{admNum(n)} événements</div></div>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>Portée</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: sp.ink }}>Toutes agences</div></div>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>Empreinte de tête</div><div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 700, color: sp.ink, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{SEC_CHAIN.head}</div></div>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>Rétention</div><div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: sp.ink }}>10 ans · LBA art. 7</div></div>
        </div>
        <p style={{ margin: "14px 2px 0", fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, color: sp.sub, textWrap: "pretty" }}>
          3 extraits produits cette année — dernier le 12.04 par Yann Rossier.
        </p>
      </AdmModal>
    );
  };

  // ─── Section ───────────────────────────────────────────────────────────
  const AdminSecuritySection = ({ sp, surf, dark }) => {
    const T = admTones(dark);
    const [q, setQ] = React.useState("");
    const [filter, setFilter] = React.useState("all");
    const [openRow, setOpenRow] = React.useState(null);
    const [routineOpen, setRoutineOpen] = React.useState(false);

    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const rows = SEC_EVENTS.filter((e) => {
      const byFilter = filter === "all" ? true : (e.sev === filter || e.fam === filter);
      if (!byFilter) return false;
      if (!q.trim()) return true;
      const hay = norm(e.action + " " + e.entity + " " + e.actor);
      return norm(q).split(/\s+/).every((w) => hay.includes(w));
    });

    const kpi = [
      { v: 2, l: "critiques", tone: "err" },
      { v: 5, l: "avertissements", tone: "warn" },
      { v: 340, l: "événements 24 h" },
      { v: 3, l: "comptes MEGGA actifs" },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 42, flexWrap: "wrap", flex: 1 }}>
            {kpi.map((n) => (
              <div key={n.l}>
                <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: n.tone ? T[n.tone] : sp.ink }}>{admNum(n.v)}</div>
                <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{n.l}</div>
              </div>
            ))}
          </div>
          <AdmSearch value={q} onChange={setQ} placeholder="Acteur, entité…" sp={sp} surf={surf} dark={dark} width={230} />
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
          {SEC_FILTERS.map((f) => <AdmChip key={f.k} label={f.label} count={f.n} on={filter === f.k} onClick={() => setFilter(f.k)} sp={sp} surf={surf} />)}
        </div>

        <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
        {rows.length === 0
          ? <div style={{ padding: "26px 4px", fontSize: 12.5, fontWeight: 600, color: sp.sub }}>Aucun événement pour ce filtre.</div>
          : rows.map((e, i) => (
            <React.Fragment key={e.id}>
              {i > 0 && <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />}
              <SecRow e={e} sp={sp} dark={dark} open={openRow === e.id} onToggle={() => setOpenRow(openRow === e.id ? null : e.id)} />
            </React.Fragment>
          ))}

        <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }} />
        <button onClick={() => setRoutineOpen(!routineOpen)} className="adm-nav" style={{
          display: "flex", alignItems: "center", gap: 9, width: "100%", minHeight: 46, padding: "0 4px",
          border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          <AdmIcon name="chevronR" size={15} color={sp.sub} style={{ transform: routineOpen ? "rotate(90deg)" : "none" }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.soft }}>332 événements de routine — lectures, connexions, envois planifiés</span>
        </button>
        {routineOpen && (
          <div style={{ paddingBottom: 6 }}>
            {SEC_ROUTINE.map((e) => (
              <SecRow key={e.id} e={{ ...e, sev: "info" }} sp={sp} dark={dark} dim open={false} onToggle={() => {}} />
            ))}
            <div style={{ fontSize: 12, fontWeight: 600, color: sp.sub, padding: "6px 4px 0 85px" }}>327 autres — non listées, scellées dans la chaîne</div>
          </div>
        )}

      </div>
    );
  };

  Object.assign(window, { AdminSecuritySection });
})();
