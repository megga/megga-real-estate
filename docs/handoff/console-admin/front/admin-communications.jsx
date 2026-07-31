// MEGGA CRM — Console admin · COMMUNICATIONS (changelog « What's new »)
// ─────────────────────────────────────────────────────────────────────
// Concept C retenu — « Écrire d'abord » : la page EST la feuille. Le vrai usage
// est d'écrire une nouveauté deux fois par mois, pas de gérer un catalogue :
// zéro clic avant la première lettre, la consigne rédactionnelle vit dans le
// placeholder, l'historique passe dessous en une ligne par entrée.
// Le défaut du concept (publier à l'aveugle) est corrigé au seul endroit qui
// compte : la confirmation de publication montre la carte telle que l'agent la
// lira dans « What's new » (cf. HL_NEWS de today-h-live.jsx).
// Un seul objet ici : le changelog. Pas d'annonce in-app, pas de segmentation.
(function () {
  const { AdmIcon, AdmCard, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmModal, AdmConfirm,
    ADM_R, admTones, admFieldStyle, admFloatSurf } = window;

  const COMM_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const commDay = (iso) => { if (!iso) return null; const [y, m, d] = iso.split("-").map(Number); return { d, m: COMM_MONTHS[m - 1], y }; };
  const commLong = (iso) => { const p = commDay(iso); return p ? p.d + " " + p.m + " " + p.y : "sans date"; };
  const commShort = (iso) => { const p = commDay(iso); return p ? p.d + " " + p.m : "—"; };
  const commToday = () => new Date().toISOString().slice(0, 10);

  // Les 5 publiées reprennent mot pour mot HL_NEWS (page Aujourd'hui).
  const COMM_SEED = [
    { id: "c7", state: "scheduled", date: "2026-08-04", title: "Signature électronique des mandats",
      desc: "Faites signer un mandat depuis la fiche du bien : envoi du lien, suivi de la signature, dépôt automatique dans Documents." },
    { id: "c6", state: "draft", date: "", title: "Recherche par carte",
      desc: "Dessinez une zone sur la carte pour filtrer les biens." },
    { id: "c5", state: "published", date: "2026-07-18", title: "Tableau de bord fusionné",
      desc: "Performance et analyse réunies sur un seul écran : trajectoire immersive, cône d'incertitude et composition en treemap." },
    { id: "c4", state: "published", date: "2026-07-12", title: "Boucle de match",
      desc: "Transmettez une sélection de biens par lien privé — les réactions de l'acheteur remontent automatiquement dans sa fiche." },
    { id: "c3", state: "published", date: "2026-07-05", title: "Calendrier synchronisé",
      desc: "Vues Jour, Semaine et Mois façon agenda, avec synchronisation Google et Outlook affichée en « Occupé »." },
    { id: "c2", state: "published", date: "2026-06-28", title: "KYC non-bloquant",
      desc: "Le contrôle LBA n'empêche plus un dossier d'avancer : rappel doux à compléter, jamais un verrou." },
    { id: "c1", state: "published", date: "2026-06-20", title: "Diffusion Immobilier.ch",
      desc: "Publiez vos annonces sur Immobilier.ch directement depuis Mes biens, en un geste." },
  ];

  const COMM_ORDER = { scheduled: 0, draft: 1, published: 2 };
  const commSort = (a, b) => (COMM_ORDER[a.state] - COMM_ORDER[b.state]) || (b.date || "").localeCompare(a.date || "");

  // Aperçu fidèle de la carte « What's new » — même gouttière de date, même
  // pilule noire « Nouveau ». C'est le garde-fou avant publication.
  const CommPreview = ({ entry, sp, dark, bg }) => {
    const p = commDay(entry.date || commToday());
    return (
      <div style={{ background: bg, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: sp.ink, lineHeight: 1.3 }}>{p.d} {p.m}</div>
            <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 700, color: sp.ghost || sp.sub }}>{p.y}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: -0.25, color: sp.ink }}>{entry.title || "Titre de la nouveauté"}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", flexShrink: 0,
                background: sp.accent || sp.ink, color: sp.accentInk || (dark ? "#0B0C0E" : "#FFFFFF"), borderRadius: 999, padding: "2px 7px" }}>Nouveau</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: sp.soft, lineHeight: 1.5, textWrap: "pretty" }}>
              {entry.desc || "Une ou deux phrases, du point de vue de l'agent."}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Bascule de calendrier : maintenant / à une date — sélection = ring noir
  const CommWhen = ({ value, onChange, sp, surf, dark }) => (
    <div style={{ display: "flex", gap: 6 }}>
      {[["now", "Publier maintenant", "check"], ["later", "Programmer", "clock"]].map(([k, label, icon]) => {
        const on = value === k;
        return (
          <button key={k} className="adm-chip" onClick={() => onChange(k)} style={{
            display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px", borderRadius: ADM_R.pill,
            border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: sp.ink,
            background: on ? surf.card : "transparent", boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset` : "none",
          }}>
            <AdmIcon name={icon} size={14} color={on ? sp.ink : sp.sub} />{label}
          </button>
        );
      })}
    </div>
  );

  const CommRow = ({ e, sp, surf, dark, onClick }) => {
    const T = admTones(dark);
    return (
      <div className="comm-row" onClick={onClick} style={{
        display: "grid", gridTemplateColumns: "104px 1fr auto", alignItems: "center", gap: 18,
        minHeight: 48, padding: "0 12px", borderRadius: ADM_R.row, cursor: "pointer",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: sp.sub }}>{commShort(e.date)}</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {e.state === "scheduled" && <AdmPill sp={sp} surf={surf} dark={dark} tone="cyan" label="Programmée" />}
          {e.state === "draft" && <AdmPill sp={sp} surf={surf} dark={dark} label="Brouillon" />}
          {e.state === "published" && <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>Publiée</span>}
          <AdmIcon name="chevronR" size={15} color={sp.ghost || sp.sub} />
        </span>
      </div>
    );
  };

  const AdminCommunicationsSection = ({ sp, surf, dark }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark);
    const [list, setList] = React.useState(COMM_SEED);
    const [editing, setEditing] = React.useState(null);   // id en cours de modification
    const [title, setTitle] = React.useState("");
    const [desc, setDesc] = React.useState("");
    const [when, setWhen] = React.useState("now");
    const [at, setAt] = React.useState("");
    const [confirmPub, setConfirmPub] = React.useState(false);
    const [pullOff, setPullOff] = React.useState(false);
    const [flash, setFlash] = React.useState(null);

    React.useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4200); return () => clearTimeout(t); }, [flash]);

    const reset = () => { setEditing(null); setTitle(""); setDesc(""); setWhen("now"); setAt(""); };
    const ready = title.trim().length > 2;
    const current = editing ? list.find((e) => e.id === editing) : null;
    const draft = { title: title.trim(), desc: desc.trim(), date: when === "later" && at ? at : commToday() };
    const counts = list.reduce((a, e) => { a[e.state] = (a[e.state] || 0) + 1; return a; }, {});

    const open = (e) => {
      setEditing(e.id); setTitle(e.title); setDesc(e.desc);
      setWhen(e.state === "scheduled" ? "later" : "now"); setAt(e.state === "scheduled" ? e.date : "");
      if (window.scrollTo) { /* le bento scrolle, pas la fenêtre */ }
    };

    const commit = (state) => {
      const date = state === "draft" ? (when === "later" ? at : "") : draft.date;
      setList((prev) => {
        const next = { id: editing || "c" + Date.now(), state, date, title: draft.title, desc: draft.desc };
        const base = editing ? prev.map((e) => (e.id === editing ? next : e)) : [next].concat(prev);
        return base.slice().sort(commSort);
      });
      setFlash(state === "published" ? "Publiée — visible dans « What's new » sur la page Aujourd'hui."
        : state === "scheduled" ? "Programmée pour le " + commLong(date) + "."
        : "Brouillon enregistré — rien n'est visible côté agent.");
      reset();
    };

    const publish = () => { setConfirmPub(false); commit(when === "later" && at ? "scheduled" : "published"); };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <style>{`.comm-f{font-family:inherit;border:0;outline:none;background:transparent;width:100%;resize:none;color:${sp.ink}}
.comm-f::placeholder{color:${sp.ghost || sp.sub};opacity:1}
.comm-row:hover{background:${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.035)"}}`}</style>

        {/* ── La feuille ─────────────────────────────────────────────── */}
        <AdmCard sp={sp} surf={surf} padding="22px 26px 18px"
          style={{ background: dark ? (window.crmStep ? window.crmStep("s0", "#12161C") : "#12161C") : surf.card }}>
          {current && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub }}>
                Modification d'une entrée {current.state === "published" ? "publiée" : current.state === "scheduled" ? "programmée" : "en brouillon"}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {current.state === "published" && <AdmGhostBtn sp={sp} surf={{ card: surf.cardSub }} onClick={() => setPullOff(true)} style={{ height: 30, fontSize: 12 }}>Retirer</AdmGhostBtn>}
                <AdmGhostBtn sp={sp} surf={{ card: surf.cardSub }} onClick={reset} style={{ height: 30, fontSize: 12 }}>Annuler</AdmGhostBtn>
              </div>
            </div>
          )}
          <input className="comm-f" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la nouveauté" aria-label="Titre de la nouveauté"
            style={{ height: 44, fontSize: 19, fontWeight: 800, letterSpacing: -0.5 }} />
          <textarea className="comm-f" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
            placeholder="Ce que l'agent peut faire maintenant, en une phrase."
            aria-label="Description" style={{ marginTop: 2, fontSize: 13.5, fontWeight: 500, lineHeight: 1.6, minHeight: 74, paddingBottom: 12 }} />
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 15, flexWrap: "wrap" }}>
            <CommWhen value={when} onChange={setWhen} sp={sp} surf={surf} dark={dark} />
            {when === "later" && (
              <input type="date" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Date de publication"
                style={{ ...admFieldStyle(sp, surf, dark, 32), width: 156, fontSize: 12.5 }} />
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
              <AdmGhostBtn sp={sp} surf={surf} disabled={!ready} onClick={() => commit("draft")}>Enregistrer le brouillon</AdmGhostBtn>
              <AdmSolidBtn sp={sp} disabled={!ready || (when === "later" && !at)} onClick={() => setConfirmPub(true)}>
                {when === "later" ? "Programmer" : "Publier"}
              </AdmSolidBtn>
            </div>
          </div>
        </AdmCard>

        {flash && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px 0" }}>
            <AdmIcon name="check" size={15} color={T.ok} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.soft }}>{flash}</span>
          </div>
        )}

        {/* ── L'historique, une ligne par entrée ─────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 12px 8px" }}>
          <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: sp.ink }}>Déjà publiées</h3>
          <div style={{ flex: 1, height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>
            {(counts.scheduled || 0)} programmée{(counts.scheduled || 0) > 1 ? "s" : ""}, {(counts.draft || 0)} brouillon{(counts.draft || 0) > 1 ? "s" : ""}
          </span>
        </div>
        <div>
          {list.slice().sort(commSort).map((e, i) => (
            <div key={e.id} style={{ borderTop: i === 0 ? 0 : `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}` }}>
              <CommRow e={e} sp={sp} surf={surf} dark={dark} onClick={() => open(e)} />
            </div>
          ))}
        </div>

        {/* ── Garde-fou : on voit la carte avant qu'elle ne part ─────── */}
        {confirmPub && (
          <AdmModal sp={sp} dark={dark} width={520} onClose={() => setConfirmPub(false)}
            title={when === "later" ? "Programmer cette nouveauté ?" : "Publier cette nouveauté ?"}
            subtitle={when === "later"
              ? "Elle apparaîtra le " + commLong(at) + " dans « What's new », sur la page Aujourd'hui des 240 agents."
              : "Elle apparaîtra dans « What's new », sur la page Aujourd'hui des 240 agents. Voici ce qu'ils liront."}
            footer={<>
              <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={() => setConfirmPub(false)}>Annuler</AdmGhostBtn>
              <AdmSolidBtn sp={sp} onClick={publish}>{when === "later" ? "Programmer" : "Publier"}</AdmSolidBtn>
            </>}>
            <CommPreview entry={draft} sp={sp} dark={dark} bg={F.cardSub} />
          </AdmModal>
        )}

        <AdmConfirm open={pullOff} sp={sp} dark={dark} tone="danger"
          title="Retirer cette nouveauté ?"
          message={"Elle disparaîtra de « What's new » pour tous les agents et repassera en brouillon. Le texte est conservé."}
          confirmLabel="Retirer"
          onClose={() => setPullOff(false)}
          onConfirm={() => { setPullOff(false); commit("draft"); }} />
      </div>
    );
  };

  Object.assign(window, { AdminCommunicationsSection, COMM_SEED });
})();
