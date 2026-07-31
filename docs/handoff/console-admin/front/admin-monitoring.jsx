// MEGGA CRM — Console admin · MONITORING (« le bulletin à file »)
// ─────────────────────────────────────────────────────────────────────
// Implémente le concept F de `Console - Monitoring (concepts).html` :
//   • la FILE en tête — les incidents seuls, une ligne chacun, impact dans le
//     sous-texte, une action ; tout vert → la file disparaît ;
//   • l'ÉTAT DE SERVICE en dessous — 7 lignes, bande 24 h, un mot de statut ;
//     le détail du repo (fonctions, crons, diffusion, WhatsApp, intégrations)
//     vit dans le déplié d'une ligne, jamais sur la page.
// Chiffres alignés sur ADMIN_HEALTH (Vue d'ensemble) : 1 fonction en erreur,
// 1 cron en retard, 34 % base, 22 % stockage, 128'400 req., 312 emails.
(function () {
  const { AdmIcon, AdmCard, AdmGroupTitle, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmChip, AdmModal, admFloatSurf, admTones, admNum, ADM_R } = window;

  // ─── Données de démo ───────────────────────────────────────────────────
  const MON_INCIDENTS = [
    {
      id: "i1", tone: "err", icon: "bolt", since: "depuis 09:12",
      title: "realadvisor-sync en échec",
      sub: "Estimations de prix figées pour les 14 agences · ETIMEDOUT api.realadvisor.ch · coïncide avec le déploiement v2.41.0",
      action: "Rejouer", done: "Relance demandée — prochain passage 15:12",
      logs: [
        ["09:12:04", "FetchError: ETIMEDOUT api.realadvisor.ch (attempt 1/3)"],
        ["10:12:07", "FetchError: ETIMEDOUT api.realadvisor.ch (attempt 2/3)"],
        ["13:12:05", "FetchError: ETIMEDOUT api.realadvisor.ch — giving up"],
      ],
      full: [
        ["09:11:48", "info", "deploy v2.41.0 · edge functions rebuilt (8f4c2d1)"],
        ["09:12:04", "err", "FetchError: ETIMEDOUT api.realadvisor.ch (attempt 1/3)"],
        ["09:12:04", "info", "  at fetchWithRetry (realadvisor-sync/client.ts:41:11)"],
        ["09:12:04", "info", "  timeout=3000ms · agent=keep-alive · pool=4"],
        ["09:12:05", "warn", "retry planifié dans 60 min · 14 agences en attente"],
        ["10:12:07", "err", "FetchError: ETIMEDOUT api.realadvisor.ch (attempt 2/3)"],
        ["10:12:07", "info", "  DNS ok 34 ms · handshake TLS jamais complété"],
        ["11:12:06", "warn", "estimations servies depuis le cache (âge 2 h 00)"],
        ["13:12:05", "err", "FetchError: ETIMEDOUT api.realadvisor.ch — giving up"],
        ["13:12:05", "err", "6 erreurs sur 6 invocations · fonction marquée en échec"],
        ["13:12:06", "info", "prochain passage planifié 15:12"],
      ],
      deploy: {
        version: "v2.41.0", prev: "v2.40.3", at: "09:11:48", by: "Loïc Perret", sha: "8f4c2d1", branch: "main",
        msg: "realadvisor : passer au pool keep-alive partagé",
        gap: "16 s", firstFail: "09:12:04",
        files: [
          { p: "functions/realadvisor-sync/client.ts", d: "+38 −12", hot: true },
          { p: "shared/http/fetch-with-retry.ts", d: "+21 −3", hot: true },
          { p: "functions/realadvisor-sync/index.ts", d: "+6 −4" },
        ],
        more: "4 autres fichiers sans lien avec la fonction",
      },
    },
    {
      id: "i2", tone: "warn", icon: "clock", since: "depuis 11:41",
      title: "Cron diffusion-immobilier en retard de 38 min",
      sub: "4 annonces en attente vers Immobilier.ch · conséquence probable de l'incident ci-dessus",
      action: "Relancer", done: "Relancé — passage en cours",
      logs: [
        ["11:26:00", "run ok · 3 annonces poussées (2'140 ms)"],
        ["11:41:00", "run skipped · lock non libéré par realadvisor-sync"],
      ],
      full: [
        ["11:26:00", "info", "run ok · 3 annonces poussées (2'140 ms)"],
        ["11:26:00", "info", "  lock acquis puis libéré · immobilier.ch 200"],
        ["11:41:00", "warn", "run skipped · lock non libéré par realadvisor-sync"],
        ["11:41:00", "info", "  lock owner=realadvisor-sync · âge 2 h 29"],
        ["12:41:00", "warn", "run skipped · lock non libéré (2/2)"],
        ["13:41:00", "warn", "4 annonces en file · retard cumulé 38 min"],
      ],
    },
  ];

  const MON_WATCHED = [
    { id: "w1", icon: "message", label: "3 entrants WhatsApp non mappés · 2 dead-letters média rejouables", mt: "24 h", action: "Examiner" },
    { id: "w2", icon: "plug", label: "2 calendriers Google en retard de synchro — Bosson & Filles, Cantonale Habitat", mt: "> 6 h", action: "Resynchroniser" },
  ];

  // Bandes 24 h : segments en % de la fenêtre (fin = maintenant)
  const MON_SERVICES = [
    { id: "fn", name: "Edge Functions", segs: [{ l: 82, w: 18, tone: "err" }], status: { label: "1 en erreur", tone: "err" } },
    { id: "cron", name: "Crons", segs: [{ l: 93, w: 7, tone: "warn" }], status: { label: "1 en retard", tone: "warn" } },
    { id: "diff", name: "Diffusion Immobilier.ch", segs: [{ l: 93, w: 7, tone: "warn", soft: true }], status: { label: "4 en file" } },
    { id: "wa", name: "WhatsApp", segs: [{ l: 84, w: 1.4, tone: "warn" }, { l: 88.5, w: 1.4, tone: "warn" }], status: { label: "OK" } },
    { id: "mail", name: "Emails · Resend", segs: [], status: { label: "OK" } },
    { id: "integ", name: "Intégrations", segs: [{ l: 60, w: 2, tone: "mute" }], status: { label: "OK" } },
    { id: "db", name: "Base & stockage", segs: [], status: { label: "34 % · 22 %" } },
  ];

  const MON_FUNCTIONS = [
    { name: "realadvisor-sync", tone: "err", right: "6 erreurs", when: "il y a 18 min" },
    { name: "whatsapp-inbound", right: "1'842 invocations", when: "il y a 1 min" },
    { name: "kyc-analyze", right: "96 invocations", when: "il y a 12 min" },
    { name: "matching-score", right: "418 invocations", when: "il y a 3 min" },
    { name: "email-send", right: "312 invocations", when: "il y a 4 min" },
  ];

  const MON_CRONS = [
    { name: "diffusion-immobilier", tone: "warn", right: "en retard +38 min", when: "dernier passage 11:26" },
    { name: "kyc-relance", right: "à l'heure", when: "13:00" },
    { name: "rapport-hebdo", right: "à l'heure", when: "lundi 08:00" },
  ];

  const MON_INTEGRATIONS = [
    { name: "Resend", right: "OK", when: "il y a 4 min" },
    { name: "Webhooks Stripe", right: "OK · dernier 12:03", when: "il y a 1 h" },
    { name: "Screening PEP · ComplyAdvantage", right: "OK", when: "il y a 18 min" },
    { name: "Calendriers OAuth", tone: "warn", right: "2 synchros en retard", when: "> 6 h" },
    { name: "Realtime", right: "118 ms", when: "continu" },
  ];

  // ─── Atomes locaux ─────────────────────────────────────────────────────
  const MonBand = ({ segs, dark }) => {
    const T = admTones(dark);
    const tone = (s) => (s.tone === "mute" ? (dark ? "rgba(255,255,255,.24)" : "rgba(15,23,42,.18)")
      : s.soft ? (dark ? "rgba(224,138,46,.45)" : "rgba(196,90,0,.35)") : T[s.tone]);
    return (
      <div style={{ position: "relative", flex: 1, minWidth: 0, height: 8, borderRadius: 999, overflow: "hidden", background: dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.06)" }}>
        {segs.map((s, i) => (
          <span key={i} style={{ position: "absolute", top: 0, bottom: 0, left: s.l + "%", width: s.w + "%", borderRadius: 999, background: tone(s) }} />
        ))}
      </div>
    );
  };

  const MonHair = ({ dark, style }) => (
    <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)", ...style }} />
  );

  // Ligne de détail (nom · valeur · quand) — utilisée dans les dépliés
  const MonDetailRow = ({ r, sp, dark }) => {
    const T = admTones(dark);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 38 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: r.tone ? T[r.tone] : (dark ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.14)") }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: r.tone ? 700 : 600, color: r.tone ? sp.ink : sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: r.tone ? T[r.tone] : sp.ink, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.right}</span>
        <span style={{ width: 130, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{r.when}</span>
      </div>
    );
  };

  const MonNums = ({ items, sp, dark }) => {
    const T = admTones(dark);
    return (
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", padding: "6px 0 4px" }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: it.tone ? T[it.tone] : sp.ink, fontVariantNumeric: "tabular-nums" }}>{it.v}</div>
            <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{it.l}</div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Dépliés de l'état de service (la profondeur du repo, à un clic) ───
  const MonServiceDetail = ({ id, sp, surf, dark }) => {
    const T = admTones(dark);
    const [fnFilter, setFnFilter] = React.useState("all");
    const wrap = (children) => (
      <div style={{ padding: "6px 0 14px 30px" }}>{children}</div>
    );
    if (id === "fn") {
      const rows = fnFilter === "err" ? MON_FUNCTIONS.filter((f) => f.tone === "err") : MON_FUNCTIONS;
      return wrap(<>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          <AdmChip label="Toutes" count={42} on={fnFilter === "all"} onClick={() => setFnFilter("all")} sp={sp} surf={surf} />
          <AdmChip label="En erreur" count={1} on={fnFilter === "err"} onClick={() => setFnFilter("err")} sp={sp} surf={surf} />
          <AdmChip label="Sans télémétrie" count={3} on={fnFilter === "mute"} onClick={() => setFnFilter("mute")} sp={sp} surf={surf} />
        </div>
        {fnFilter === "mute"
          ? <div style={{ fontSize: 12.5, color: sp.sub, padding: "10px 0" }}>pdf-render · avatar-resize · geo-import — aucune invocation sur 30 jours.</div>
          : rows.map((r) => <MonDetailRow key={r.name} r={r} sp={sp} dark={dark} />)}
        {fnFilter === "all" && <div style={{ fontSize: 12, fontWeight: 600, color: sp.sub, paddingTop: 8 }}>37 autres fonctions saines</div>}
      </>);
    }
    if (id === "cron") return wrap(<>
      {MON_CRONS.map((r) => <MonDetailRow key={r.name} r={r} sp={sp} dark={dark} />)}
      <div style={{ fontSize: 12, fontWeight: 600, color: sp.sub, paddingTop: 8 }}>6 autres jobs à l'heure</div>
    </>);
    if (id === "diff") return wrap(<>
      <MonNums sp={sp} dark={dark} items={[{ v: 4, l: "en file", tone: "warn" }, { v: 31, l: "publiées 24 h" }, { v: 2, l: "en erreur", tone: "err" }, { v: 1, l: "retirée" }]} />
      <MonHair dark={dark} style={{ margin: "10px 0" }} />
      <MonDetailRow r={{ name: "Jura Habitat — accès portail non configuré", tone: "warn", right: "à configurer", when: "depuis l'inscription" }} sp={sp} dark={dark} />
    </>);
    if (id === "wa") return wrap(
      <MonNums sp={sp} dark={dark} items={[{ v: 214, l: "envois 24 h" }, { v: 3, l: "échecs 24 h" }, { v: "1,8 %", l: "taux d'échec 7 j" }, { v: 3, l: "entrants non mappés", tone: "warn" }, { v: 2, l: "dead-letters", tone: "warn" }]} />
    );
    if (id === "mail") return wrap(
      <MonNums sp={sp} dark={dark} items={[{ v: 312, l: "envoyés aujourd'hui" }, { v: 0, l: "échec de livraison" }, { v: "il y a 4 min", l: "dernier envoi" }]} />
    );
    if (id === "integ") return wrap(<>{MON_INTEGRATIONS.map((r) => <MonDetailRow key={r.name} r={r} sp={sp} dark={dark} />)}</>);
    if (id === "db") return wrap(
      <MonNums sp={sp} dark={dark} items={[{ v: "34 %", l: "base de données" }, { v: "22 %", l: "stockage" }, { v: admNum(128400), l: "requêtes 24 h" }, { v: 6, l: "erreurs 24 h", tone: "err" }]} />
    );
    return null;
  };

  // ─── Journal complet (« Tous les logs ») ───────────────────────────────
  const MON_LVL = [{ k: "all", label: "Tout" }, { k: "err", label: "Erreurs" }, { k: "warn", label: "Avertissements" }];

  const MonLogsModal = ({ inc, sp, dark, onClose }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark);
    const [lvl, setLvl] = React.useState("all");
    const [copied, setCopied] = React.useState(false);
    const all = inc.full || [];
    const rows = lvl === "all" ? all : all.filter((l) => l[1] === lvl);
    const n = (k) => (k === "all" ? all.length : all.filter((l) => l[1] === k).length);
    const chipSurf = { ...F, card: F.cardSub };
    const copy = () => {
      const txt = rows.map((l) => l[0] + "  " + l[1].toUpperCase().padEnd(4) + "  " + l[2]).join("\n");
      try { navigator.clipboard.writeText(txt); } catch (e) { /* presse-papiers indisponible */ }
      setCopied(true); window.setTimeout(() => setCopied(false), 1800);
    };
    return (
      <AdmModal sp={sp} dark={dark} width={780} onClose={onClose} title={inc.title}
        subtitle={"Journal complet · " + all.length + " lignes · fenêtre 24 h · Europe/Zurich"}
        footer={<>
          <AdmGhostBtn sp={sp} surf={chipSurf} icon={copied ? "check" : "file"} onClick={copy}>{copied ? "Copié" : "Copier la sélection"}</AdmGhostBtn>
          <AdmGhostBtn sp={sp} surf={chipSurf} onClick={onClose}>Fermer</AdmGhostBtn>
        </>}>
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {MON_LVL.map((f) => <AdmChip key={f.k} label={f.label} count={n(f.k)} on={lvl === f.k} onClick={() => setLvl(f.k)} sp={sp} surf={chipSurf} />)}
        </div>
        <div className="adm-scroll" style={{ maxHeight: 342, overflowY: "auto", background: F.cardSub, borderRadius: 16, padding: "14px 16px" }}>
          {rows.length === 0
            ? <div style={{ fontSize: 12.5, fontWeight: 600, color: sp.sub, padding: "6px 0" }}>Aucune ligne à ce niveau.</div>
            : rows.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, lineHeight: 1.95, color: l[1] === "info" ? sp.sub : sp.soft }}>
                <span style={{ flexShrink: 0, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: l[1] === "err" ? T.err : l[1] === "warn" ? T.warn : sp.sub }}>{l[0]}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap" }}>{l[2]}</span>
              </div>
            ))}
        </div>
      </AdmModal>
    );
  };

  // ─── Le déploiement suspect (« Voir le déploiement ») ──────────────────
  const MonDeployModal = ({ inc, sp, dark, onClose }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark), d = inc.deploy;
    const [arm, setArm] = React.useState(false);
    const [rolled, setRolled] = React.useState(false);
    const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: "tabular-nums" };
    const meta = [["Déployé à", d.at + " · aujourd'hui"], ["Par", d.by], ["Commit", d.sha + " · " + d.branch], ["Version précédente", d.prev]];
    return (
      <AdmModal sp={sp} dark={dark} width={720} onClose={onClose} title={"Déploiement " + d.version} subtitle={d.msg}
        footer={rolled
          ? <AdmPill label={"Retour à " + d.prev + " lancé · journalisé dans Sécurité"} sp={sp} surf={{ ...F, card: F.cardSub }} dark={dark} />
          : <>
            <AdmGhostBtn sp={sp} surf={{ ...F, card: F.cardSub }} onClick={arm ? () => setArm(false) : onClose}>{arm ? "Annuler" : "Fermer"}</AdmGhostBtn>
            {arm
              ? <AdmSolidBtn sp={sp} tone={T.danger} onClick={() => { setRolled(true); setArm(false); }}>Confirmer le retour à {d.prev}</AdmSolidBtn>
              : <AdmSolidBtn sp={sp} icon="activity" onClick={() => setArm(true)}>Revenir à {d.prev}</AdmSolidBtn>}
          </>}>
        <div style={{ background: F.cardSub, borderRadius: 16, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: dark ? "rgba(255,255,255,.28)" : "rgba(15,23,42,.2)" }} />
            <span style={{ ...mono, fontSize: 11.5, fontWeight: 700, color: sp.sub }}>{d.at}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>déploiement {d.version} en production</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 22, paddingLeft: 3.5 }}>
            <span style={{ width: 1, height: "100%", background: dark ? "rgba(255,255,255,.14)" : "rgba(15,23,42,.12)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>{d.gap} plus tard</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: T.err }} />
            <span style={{ ...mono, fontSize: 11.5, fontWeight: 700, color: T.err }}>{d.firstFail}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink }}>premier ETIMEDOUT — la corrélation s'arrête là, elle ne prouve rien</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 40px", padding: "18px 2px 4px" }}>
          {meta.map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>{l}</div>
              <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
        <MonHair dark={dark} style={{ margin: "14px 0 4px" }} />
        <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub, padding: "8px 2px 4px" }}>Fichiers touchés</div>
        {d.files.map((f) => (
          <div key={f.p} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 34 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: f.hot ? T.err : (dark ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.14)") }} />
            <span style={{ ...mono, flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: f.hot ? sp.ink : sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.p}</span>
            <span style={{ ...mono, fontSize: 11.5, fontWeight: 700, color: sp.sub }}>{f.d}</span>
          </div>
        ))}
        <div style={{ fontSize: 12, fontWeight: 600, color: sp.sub, paddingTop: 8 }}>{d.more}</div>
      </AdmModal>
    );
  };

  // ─── Section ───────────────────────────────────────────────────────────
  const AdminMonitoringSection = ({ sp, surf, dark }) => {
    const T = admTones(dark);
    const [logsOpen, setLogsOpen] = React.useState(null);      // id incident
    const [requeued, setRequeued] = React.useState({});        // id → true
    const [watchedOpen, setWatchedOpen] = React.useState(false);
    const [svcOpen, setSvcOpen] = React.useState(null);        // id service
    const [logsFull, setLogsFull] = React.useState(null);      // incident → journal complet
    const [deployInc, setDeployInc] = React.useState(null);    // incident → déploiement

    const openCount = MON_INCIDENTS.length;

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 42, flexWrap: "wrap", marginBottom: 24 }}>
            {[{ v: openCount, l: "incidents ouverts", tone: "err" }, { v: 2, l: "signaux surveillés", tone: "warn" }, { v: 34, l: "vérifications passées" }, { v: admNum(128400), l: "requêtes 24 h" }].map((n) => (
              <div key={n.l}>
                <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: n.tone ? T[n.tone] : sp.ink }}>{n.v}</div>
                <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{n.l}</div>
              </div>
            ))}
          </div>
          <AdmGroupTitle label="À traiter" tone="err" sp={sp} dark={dark} padding="0 2px 8px"
            right={<span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>ordonné par impact</span>} />
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
          {MON_INCIDENTS.map((inc, i) => (
            <React.Fragment key={inc.id}>
              {i > 0 && <MonHair dark={dark} />}
              <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 64, padding: "10px 2px" }}>
                <AdmIcon name={inc.icon} size={18} color={T[inc.tone]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.25, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inc.title}</div>
                  <div style={{ marginTop: 3, fontSize: 11.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{inc.sub}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{inc.since}</span>
                <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                  <AdmGhostBtn sp={sp} surf={surf} style={{ height: 32, padding: "0 13px", fontSize: 12 }}
                    onClick={() => setLogsOpen(logsOpen === inc.id ? null : inc.id)}>{logsOpen === inc.id ? "Replier" : "Logs"}</AdmGhostBtn>
                  {requeued[inc.id]
                    ? <AdmPill label={inc.done} sp={sp} surf={surf} dark={dark} />
                    : <AdmSolidBtn sp={sp} icon="activity" style={{ height: 32, padding: "0 15px", fontSize: 12 }}
                        onClick={() => setRequeued((r) => ({ ...r, [inc.id]: true }))}>{inc.action}</AdmSolidBtn>}
                </div>
              </div>
              {logsOpen === inc.id && (
                <div style={{ padding: "0 0 14px 32px" }}>
                  {inc.logs.map((l, j) => (
                    <div key={j} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10.5, lineHeight: 1.9, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: T[inc.tone], fontWeight: 700 }}>{l[0]}</span>{"  "}{l[1]}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                    <AdmGhostBtn sp={sp} surf={surf} style={{ height: 28, padding: "0 12px", fontSize: 11.5 }}
                      onClick={() => setLogsFull(inc)}>Tous les logs</AdmGhostBtn>
                    {inc.deploy && (
                      <AdmGhostBtn sp={sp} surf={surf} style={{ height: 28, padding: "0 12px", fontSize: 11.5 }}
                        onClick={() => setDeployInc(inc)}>Voir le déploiement</AdmGhostBtn>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
          <MonHair dark={dark} />
          <button onClick={() => setWatchedOpen(!watchedOpen)} className="adm-nav" style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%", minHeight: 46, padding: "0 2px",
            border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <AdmIcon name="chevronR" size={15} color={sp.sub} style={{ transform: watchedOpen ? "rotate(90deg)" : "none" }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: sp.soft }}>2 signaux surveillés — entrants WhatsApp non mappés, calendriers Google en retard</span>
          </button>
          {watchedOpen && MON_WATCHED.map((w) => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 44, padding: "0 2px 0 26px" }}>
              <AdmIcon name={w.icon} size={16} color={sp.sub} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{w.mt}</span>
              <AdmGhostBtn sp={sp} surf={surf} style={{ height: 28, padding: "0 12px", fontSize: 11.5 }}>{w.action}</AdmGhostBtn>
            </div>
          ))}

          {/* ── L'état de service ── */}
          <AdmGroupTitle label="État de service" sp={sp} dark={dark} padding="30px 2px 8px"
            right={<span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>dernières 24 h · cliquer une ligne pour le détail</span>} />
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
          {MON_SERVICES.map((s, i) => {
            const st = s.status, open = svcOpen === s.id;
            return (
              <React.Fragment key={s.id}>
                {i > 0 && <MonHair dark={dark} />}
                <button onClick={() => setSvcOpen(open ? null : s.id)} className="adm-nav" style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%", minHeight: 48, padding: "0 2px",
                  border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderRadius: ADM_R.row,
                }}>
                  <AdmIcon name="chevronR" size={14} color={sp.sub} style={{ transform: open ? "rotate(90deg)" : "none" }} />
                  <span style={{ width: 190, flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                  <MonBand segs={s.segs} dark={dark} />
                  <span style={{ width: 120, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: st.tone ? 700 : 500, color: st.tone ? T[st.tone] : sp.sub, fontVariantNumeric: "tabular-nums" }}>{st.label}</span>
                </button>
                {open && <MonServiceDetail id={s.id} sp={sp} surf={surf} dark={dark} />}
              </React.Fragment>
            );
          })}

          {logsFull && <MonLogsModal inc={logsFull} sp={sp} dark={dark} onClose={() => setLogsFull(null)} />}
          {deployInc && <MonDeployModal inc={deployInc} sp={sp} dark={dark} onClose={() => setDeployInc(null)} />}
      </div>
    );
  };

  Object.assign(window, { AdminMonitoringSection });
})();
