// MEGGA CRM — Console admin · DIFFUSION (ex-« Marketplace »)
// ─────────────────────────────────────────────────────────────────────
// Concepts A + E + B du canvas « Console - Diffusion (concepts) », fondus en
// un écran à DEUX RÉGIMES tirés du même tableau de lignes :
//   • ≤ 40 signaux → file d'ANNONCES groupée par nature (concept A) ;
//   • > 40 signaux → file de CAUSES avec action en lot (concept E) ;
//   • un clic ouvre le POSTE DE CONTRÔLE plein cadre (concept B).
// Règle produit : la publication est AUTOMATIQUE. Cet écran ne valide rien en
// amont — il constate, retire, fait corriger. Pas de C2PA (hors périmètre).
(function () {
  const { AdmIcon, AdmPill, AdmChip, AdmGhostBtn, AdmSolidBtn, AdmModal, AdmConfirm, AdmEmpty, AdmSearch,
    ADM_R, admTones, admCHF, admNum, admFloatSurf } = window;

  const difNorm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ─── Causes : le vocabulaire de l'écran ────────────────────────────────
  // kind "refus"  = le portail a rendu la main, l'annonce n'est PAS en ligne
  // kind "enligne"= l'annonce est publique en ce moment
  const DIF_CAUSES = {
    surface:   { label: "Surface habitable manquante", kind: "refus", tone: "err", why: "Champ exigé par Immobilier.ch", lot: "Prévenir les agences", fix: "Rendre le champ obligatoire" },
    year:      { label: "Année de construction absente", kind: "refus", tone: "err", why: "Champ exigé par Immobilier.ch", lot: "Prévenir les agences", fix: "Rendre le champ obligatoire" },
    media:     { label: "Média refusé par le portail", kind: "refus", tone: "err", why: "Format HEIC non supporté", lot: null, fix: "Convertir automatiquement" },
    nophoto:   { label: "Aucune photo", kind: "refus", tone: "err", why: "Refus automatique du portail", lot: "Prévenir les agences", fix: null },
    mandate:   { label: "Mandat non renseigné", kind: "enligne", tone: "warn", why: "Aucun mandat rattaché au bien", lot: "Demander le mandat", fix: null },
    expired:   { label: "Mandat échu, annonce en ligne", kind: "enligne", tone: "warn", why: "Le mandat a expiré, l'annonce est restée", lot: "Retirer avec motif", fix: null, destructive: true },
    duplicate: { label: "Doublon inter-agences", kind: "enligne", tone: "warn", why: "Même adresse publiée par deux agences", lot: null, fix: null, human: true },
    sold:      { label: "Bien vendu, annonce en ligne", kind: "enligne", tone: "warn", why: "Le CRM dit vendu, le portail dit disponible", lot: "Retirer", fix: null, destructive: true },
    price:     { label: "Prix/m² supérieur à 3× la médiane", kind: "enligne", tone: "warn", why: "Signalement seul — MEGGA ne juge pas un prix", lot: "Signaler aux agences", fix: null },
  };

  const DIF_AGENCIES = ["Cantonale Habitat", "Lémanic Property", "Bosson & Filles", "Régie Lacustre", "Rive Droite Estates",
    "Valais Alpes Immo", "Montreux Riviera Immobilier", "Helvetia Prime SA", "Neuchâtel & Lac", "Alpes & Rives Immobilier",
    "Grangier Immobilier", "Aare Wohnen"];

  // ─── Lignes de démo · échelle 14 agences (régime « annonces ») ─────────
  const DIF_ROWS_14 = [
    { id: "l1", title: "Immeuble de rendement · Yverdon", price: 4150000, m2: 612, agency: "Cantonale Habitat", cause: "surface", when: "il y a 20 min" },
    { id: "l2", title: "Studio · Lausanne, Sous-Gare", price: 420000, m2: 28, agency: "Lémanic Property", cause: "nophoto", when: "il y a 2 h" },
    { id: "l3", title: "Attique 4.5 pces · Nyon", price: 2480000, m2: 128, agency: "Bosson & Filles", cause: "expired", when: "en ligne depuis 41 jours" },
    { id: "l4", title: "Appartement 3.5 pces · Meyrin", price: 985000, m2: 84, agency: "Régie Lacustre", cause: "duplicate", when: "en ligne depuis 4 h" },
    { id: "l5", title: "Villa 6.5 pces · Cologny", price: 6900000, m2: 340, agency: "Rive Droite Estates", cause: "mandate", when: "en ligne depuis hier" },
    { id: "l6", title: "Maison 5.5 pces · Bulle", price: 1240000, m2: 176, agency: "Cantonale Habitat", cause: "year", when: "il y a 3 h" },
    { id: "l7", title: "4.5 pces · Sion, Vissigen", price: 760000, m2: 112, agency: "Valais Alpes Immo", cause: "sold", when: "en ligne depuis 9 jours" },
    { id: "l8", title: "Loft · Zurich Kreis 5", price: 1980000, m2: 146, agency: "Helvetia Prime SA", cause: "price", when: "en ligne depuis 6 jours" },
    { id: "l9", title: "Chalet 5.5 pces · Verbier", price: 3750000, m2: 210, agency: "Valais Alpes Immo", when: "il y a 12 min" },
    { id: "l10", title: "Duplex 4.5 pces · Montreux", price: 1690000, m2: 154, agency: "Montreux Riviera Immobilier", when: "hier, 09:12" },
    { id: "l11", title: "4.5 pces · Neuchâtel, Serrières", price: 890000, m2: 118, agency: "Neuchâtel & Lac", when: "hier, 08:40" },
    { id: "l12", title: "Villa jumelle · Gland", price: 1450000, m2: 168, agency: "Bosson & Filles", when: "il y a 2 jours" },
    { id: "l13", title: "3.5 pces · Fribourg, Bourg", price: 690000, m2: 92, agency: "Alpes & Rives Immobilier", when: "il y a 2 jours" },
    { id: "l14", title: "Terrain à bâtir · Bulle", price: 540000, m2: 780, agency: "Grangier Immobilier", when: "il y a 3 jours" },
  ];

  // ─── Échelle 100 agences : même forme, 98 signaux → 9 causes ───────────
  // Généré pour éprouver le régime volume ; la distribution vient du canvas.
  const DIF_MIX = [["surface", 23], ["year", 14], ["media", 11], ["nophoto", 9],
    ["mandate", 15], ["expired", 9], ["duplicate", 8], ["sold", 5], ["price", 4]];
  const DIF_TITLES = ["3.5 pces · Meyrin", "4.5 pces · Pully", "Villa 5.5 pces · Cologny", "Studio · Lausanne",
    "Attique · Nyon", "Maison 6.5 pces · Bulle", "Immeuble · Yverdon", "Loft · Zurich", "Chalet · Verbier",
    "Duplex · Montreux", "5.5 pces · Sion", "Terrain · Gland", "2.5 pces · Neuchâtel", "Ferme · Delémont"];
  const difBuild100 = () => {
    const out = []; let n = 0;
    DIF_MIX.forEach(([cause, count]) => {
      for (let i = 0; i < count; i++, n++) {
        out.push({
          id: "g" + n, cause,
          title: DIF_TITLES[n % DIF_TITLES.length],
          price: 480000 + ((n * 137) % 62) * 100000,
          m2: 62 + ((n * 29) % 240),
          agency: DIF_AGENCIES[(cause === "surface" && i < 9) ? 0 : (cause === "media" ? 1 : (n * 5) % DIF_AGENCIES.length)],
          when: ["il y a 40 min", "il y a 3 h", "hier", "il y a 2 jours", "il y a 4 jours"][n % 5],
        });
      }
    });
    return out.concat(DIF_ROWS_14.filter((r) => !r.cause));
  };

  const DIF_SETS = { s14: { rows: DIF_ROWS_14, agencies: 14, published: 47, live: 1139 },
    s100: { rows: difBuild100(), agencies: 100, published: 340, live: 8120 } };
  const DIF_THRESHOLD = 40; // au-delà : file de causes

  // ─── Placeholder photo (hachure — l'image vient de l'agence) ───────────
  const DifPhoto = ({ w, h, r = 10, label, dark }) => (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0, display: "grid", placeItems: "center", padding: 4,
      background: `repeating-linear-gradient(135deg, ${dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.055)"} 0 6px, ${dark ? "rgba(255,255,255,.03)" : "rgba(15,23,42,.02)"} 6px 12px)`,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 9.5, fontWeight: 500,
      color: dark ? "rgba(255,255,255,.34)" : "#7A8088", textAlign: "center", lineHeight: 1.3,
    }}>{label}</div>
  );

  // ─── Titre de section (pastille de ton + libellé + contexte à droite) ──
  const DifSect = ({ sp, dark, tone, children, right, top = 0 }) => {
    const T = admTones(dark);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${top}px 2px 8px` }}>
        {tone && <span style={{ width: 8, height: 8, borderRadius: 999, background: tone === "muted" ? (dark ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.14)") : T[tone], flexShrink: 0 }} />}
        <h3 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, letterSpacing: 0.02, color: sp.ink }}>{children}</h3>
        {right && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{right}</span>}
      </div>
    );
  };

  const difHair = (dark) => `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`;

  // ═══ Régime A — file d'annonces ════════════════════════════════════════
  const DifAnnonceRow = ({ r, sp, surf, dark, first, onOpen }) => {
    const c = r.cause ? DIF_CAUSES[r.cause] : null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 58, padding: "9px 4px", borderTop: first ? 0 : difHair(dark) }}>
        <DifPhoto w={56} h={42} label="photo" dark={dark} />
        <div style={{ width: 268, flexShrink: 0, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
        </div>
        <div style={{ width: 158, flexShrink: 0, fontSize: 12, fontWeight: 600, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.agency}</div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: c ? 600 : 500, color: c ? sp.soft : sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c ? c.label : "Aucun signal"}
        </div>
        <div style={{ width: 104, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap" }}>{r.when.replace(/^en ligne depuis /i, "").replace(/^il y a /i, "")}</div>
        {c
          ? (c.kind === "refus"
            ? <AdmGhostBtn sp={sp} surf={surf} style={{ height: 28, padding: "0 12px", fontSize: 11.5 }} onClick={() => onOpen(r)}>Renvoyer à l'agence</AdmGhostBtn>
            : <AdmSolidBtn sp={sp} style={{ height: 28, padding: "0 14px", fontSize: 11.5 }} onClick={() => onOpen(r)}>Ouvrir</AdmSolidBtn>)
          : <AdmPill sp={sp} surf={surf} dark={dark} tone="ok" label="En ligne" />}
      </div>
    );
  };

  const DifAnnonces = ({ rows, sp, surf, dark, onOpen }) => {
    const refus = rows.filter((r) => r.cause && DIF_CAUSES[r.cause].kind === "refus");
    const live = rows.filter((r) => r.cause && DIF_CAUSES[r.cause].kind === "enligne");
    const clean = rows.filter((r) => !r.cause);
    const [allClean, setAllClean] = React.useState(false);
    const cleanShown = allClean ? clean : clean.slice(0, 3);
    const groups = [
      { key: "refus", tone: "err", title: "Refusé par Immobilier.ch", list: refus },
      { key: "live", tone: "warn", title: "Signalé après publication", list: live },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {groups.filter((g) => g.list.length).map((g, gi) => (
          <React.Fragment key={g.key}>
            <DifSect sp={sp} dark={dark} tone={g.tone} top={gi ? 22 : 4}>{g.title}</DifSect>
            {g.list.map((r, i) => <DifAnnonceRow key={r.id} r={r} sp={sp} surf={surf} dark={dark} first={i === 0} onOpen={onOpen} />)}
          </React.Fragment>
        ))}
        <DifSect sp={sp} dark={dark} tone="muted" top={22}>Parti sans réserve</DifSect>
        {cleanShown.map((r, i) => <DifAnnonceRow key={r.id} r={r} sp={sp} surf={surf} dark={dark} first={i === 0} onOpen={onOpen} />)}
        {clean.length > 3 && (
          <button onClick={() => setAllClean(!allClean)} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 46, padding: "0 4px", border: 0, borderTop: difHair(dark), background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft }}>
            {allClean ? "Replier" : `Voir les ${clean.length - 3} autres publications sans réserve`}
            <AdmIcon name="chevronR" size={14} color={sp.sub} />
          </button>
        )}
      </div>
    );
  };

  // ═══ Régime E — file de causes, action en lot ══════════════════════════
  const difGroupByCause = (rows) => {
    const m = new Map();
    rows.filter((r) => r.cause).forEach((r) => {
      const g = m.get(r.cause) || { cause: r.cause, count: 0, agencies: new Map() };
      g.count += 1; g.agencies.set(r.agency, (g.agencies.get(r.agency) || 0) + 1);
      m.set(r.cause, g);
    });
    return [...m.values()].map((g) => {
      const top = [...g.agencies.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ...g, nAgencies: g.agencies.size, topAgency: top[0], topCount: top[1] };
    }).sort((a, b) => b.count - a.count);
  };

  const DifCauseRow = ({ g, sp, surf, dark, first, open, onToggle, onLot, onFix, onArbitrate }) => {
    const c = DIF_CAUSES[g.cause];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 13, minHeight: 50, padding: "6px 4px", borderTop: first ? 0 : difHair(dark) }}>
        <button onClick={onToggle} aria-expanded={open} style={{
          display: "flex", alignItems: "center", gap: 13, flex: 1, minWidth: 0, border: 0, background: "transparent",
          padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          <span style={{ width: 14, flexShrink: 0, display: "grid", placeItems: "center" }}>
            <AdmIcon name={open ? "up" : "chevronR"} size={13} color={sp.sub} />
          </span>
          <span style={{ width: 248, flexShrink: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
          <span style={{ width: 46, flexShrink: 0, fontSize: 14, fontWeight: 800, letterSpacing: -0.4, color: sp.ink, fontVariantNumeric: "tabular-nums" }}>{admNum(g.count)}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {g.nAgencies} agence{g.nAgencies > 1 ? "s" : ""}
            {g.topCount > 2 ? ` · ${g.topAgency} en tête (${g.topCount})` : ` · ${c.why.toLowerCase()}`}
          </span>
        </button>
        <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          {c.human && <AdmSolidBtn sp={sp} style={{ height: 28, padding: "0 14px", fontSize: 11.5 }} onClick={() => onArbitrate(g)}>Arbitrer les {g.count} cas</AdmSolidBtn>}
          {c.lot && <AdmGhostBtn sp={sp} surf={surf} style={{ height: 28, padding: "0 12px", fontSize: 11.5 }} onClick={() => onLot(g)}>{c.lot}{c.destructive ? ` (${g.count})` : ""}</AdmGhostBtn>}
          {c.fix && <AdmSolidBtn sp={sp} style={{ height: 28, padding: "0 14px", fontSize: 11.5 }} onClick={() => onFix(g)}>{c.fix}</AdmSolidBtn>}
        </div>
      </div>
    );
  };

  // Déplié d'une cause : les annonces derrière le compteur
  const DifCauseChildren = ({ list, sp, surf, dark, onOpen }) => {
    const [all, setAll] = React.useState(false);
    const shown = all ? list : list.slice(0, 6);
    return (
      <div style={{ display: "flex", flexDirection: "column", padding: "2px 0 10px 27px" }}>
        {shown.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 4px", borderTop: difHair(dark) }}>
            <DifPhoto w={40} h={30} r={7} label="ph" dark={dark} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, letterSpacing: -0.15, color: sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
            <span style={{ width: 176, flexShrink: 0, fontSize: 12, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.agency}</span>
            <span style={{ width: 76, textAlign: "right", flexShrink: 0, fontSize: 11.5, fontWeight: 500, color: sp.sub, whiteSpace: "nowrap" }}>{r.when.replace(/^en ligne depuis /i, "").replace(/^il y a /i, "")}</span>
            <AdmGhostBtn sp={sp} surf={surf} style={{ height: 26, padding: "0 11px", fontSize: 11 }} onClick={() => onOpen(r)}>Ouvrir</AdmGhostBtn>
          </div>
        ))}
        {list.length > 6 && (
          <button onClick={() => setAll(!all)} style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 4px", border: 0, borderTop: difHair(dark), background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: sp.soft }}>
            {all ? "Replier" : `Voir les ${list.length - 6} autres`}
            <AdmIcon name="chevronR" size={13} color={sp.sub} />
          </button>
        )}
      </div>
    );
  };

  const DifCauses = ({ rows, sp, surf, dark, onLot, onFix, onArbitrate, onOpen }) => {
    const all = difGroupByCause(rows);
    const refus = all.filter((g) => DIF_CAUSES[g.cause].kind === "refus");
    const live = all.filter((g) => DIF_CAUSES[g.cause].kind === "enligne");
    const [open, setOpen] = React.useState(null);
    const block = (list) => list.map((g, i) => (
      <React.Fragment key={g.cause}>
        <DifCauseRow g={g} sp={sp} surf={surf} dark={dark} first={i === 0} open={open === g.cause}
          onToggle={() => setOpen(open === g.cause ? null : g.cause)}
          onLot={onLot} onFix={onFix} onArbitrate={onArbitrate} />
        {open === g.cause && <DifCauseChildren list={rows.filter((r) => r.cause === g.cause)} sp={sp} surf={surf} dark={dark} onOpen={onOpen} />}
      </React.Fragment>
    ));
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <DifSect sp={sp} dark={dark} tone="err" top={4}>Refus du portail — corrigeable à la source</DifSect>
        {block(refus)}
        <DifSect sp={sp} dark={dark} tone="warn" top={24}>Annonces en ligne à reprendre</DifSect>
        {block(live)}
      </div>
    );
  };

  // ═══ Concept B — poste de contrôle, une annonce plein cadre ════════════
  const difChecks = (r) => {
    const base = [
      { k: "mandate", label: "Mandat rattaché", ok: "exclusif" },
      { k: "expired", label: "Validité du mandat", ok: "en cours" },
      { k: "duplicate", label: "Doublon inter-agences", ok: "aucun" },
      { k: "sold", label: "Statut dans le CRM", ok: "disponible" },
      { k: "fields", label: "Champs du portail", ok: "complets" },
    ];
    const bad = { mandate: ["mandate", "non renseigné"], expired: ["expired", "échu le 30.06"],
      duplicate: ["duplicate", "1 correspondance"], sold: ["sold", "vendu le 12.07"],
      surface: ["fields", "surface manquante"], year: ["fields", "année manquante"],
      media: ["fields", "média non supporté"], nophoto: ["fields", "aucune photo"], price: [null, null] };
    const [key, val] = bad[r.cause] || [null, null];
    return base.map((b) => (b.k === key ? { ...b, warn: true, val } : { ...b, val: b.ok }));
  };

  const DIF_MOTIFS = ["Mandat non valide", "Bien vendu", "Doublon inter-agences", "Contenu non conforme", "Autre"];
  const DIF_FIX = {
    surface: "Renseigner la surface habitable", year: "Renseigner l'année de construction",
    media: "Remplacer les photos au format refusé", nophoto: "Ajouter des photos",
    mandate: "Rattacher le mandat au bien", expired: "Renouveler le mandat",
    duplicate: "Confirmer à qui appartient le mandat", sold: "Mettre le statut du bien à jour",
    price: "Vérifier le prix affiché",
  };
  const DIF_FIX_EXTRA = ["Compléter la description", "Corriger l'adresse", "Autre"];

  const DifPickRow = ({ label, on, onClick, sp, dark, F }) => (
    <button onClick={onClick} style={{
      height: 34, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
      fontSize: 12.5, fontWeight: 700, color: sp.ink, background: on ? F.cardSub : "transparent",
      boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset` : `0 0 0 1px ${dark ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.10)"} inset`,
    }}>{label}</button>
  );

  const DifReview = ({ r, sp, dark, onClose, onAct }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark), c = r.cause ? DIF_CAUSES[r.cause] : null;
    const [panel, setPanel] = React.useState(null);
    const [motif, setMotif] = React.useState(null);
    const [points, setPoints] = React.useState(() => (r.cause && DIF_FIX[r.cause] ? [DIF_FIX[r.cause]] : []));
    const [note, setNote] = React.useState("");
    const fixList = (r.cause && DIF_FIX[r.cause] ? [DIF_FIX[r.cause]] : []).concat(DIF_FIX_EXTRA);
    const okRemove = motif && (motif !== "Autre" || note.trim().length > 2);
    const okAsk = points.length > 0 && (!points.includes("Autre") || note.trim().length > 2);
    const toggle = (p) => setPoints((l) => (l.includes(p) ? l.filter((x) => x !== p) : l.concat(p)));
    const reset = () => { setPanel(null); setMotif(null); setNote(""); };
    React.useEffect(() => {
      const k = (e) => {
        if (e.key === "l" || e.key === "L") onAct("keep", r);
        if (e.key === "r" || e.key === "R") setPanel("remove");
      };
      document.addEventListener("keydown", k);
      return () => document.removeEventListener("keydown", k);
    }, [r, onAct]);
    return (
      <AdmModal sp={sp} dark={dark} width={820} onClose={onClose} title={r.title}
        subtitle={<span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 9, fontSize: 12.5 }}>
          <span style={{ fontWeight: 700, color: sp.ink }}>{r.agency}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: sp.ghost || sp.sub }}></span>
          <span style={{ fontWeight: 600, color: sp.soft, fontVariantNumeric: "tabular-nums" }}>{admCHF(r.price)}</span>
          <span style={{ width: 3, height: 3, borderRadius: 999, background: sp.ghost || sp.sub }}></span>
          <span style={{ fontWeight: 500, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{r.m2} m²</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, marginLeft: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: c ? (c.kind === "refus" ? T.err : T.warn) : T.ok }}></span>
            <span style={{ fontWeight: 600, color: c ? (c.kind === "refus" ? T.err : T.warn) : sp.soft }}>
              {c ? (c.kind === "refus" ? "Jamais sortie" : "En ligne") : "En ligne"}
            </span>
            <span style={{ fontWeight: 500, color: sp.sub }}>{r.when.replace(/^en ligne /i, "")}</span>
          </span>
        </span>}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 258px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <DifPhoto w="100%" h={196} r={14} dark={dark} label="photo principale de l'annonce — transmise par l'agence" />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {["02", "03", "04", "05", "+4"].map((n) => <DifPhoto key={n} w={58} h={44} dark={dark} label={n} />)}
            </div>
            {panel === null ? (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 9, marginTop: 18, paddingTop: 16, borderTop: difHair(dark) }}>
                <AdmSolidBtn sp={sp} style={{ height: 42, padding: "0 18px", fontSize: 13 }} onClick={() => onAct("keep", r)}>Laisser en ligne</AdmSolidBtn>
                <AdmGhostBtn sp={sp} surf={F} style={{ height: 42, padding: "0 16px", fontSize: 13 }} onClick={() => setPanel("remove")}>Retirer avec motif</AdmGhostBtn>
                <AdmGhostBtn sp={sp} surf={F} style={{ height: 42, padding: "0 16px", fontSize: 13 }} onClick={() => setPanel("ask")}>Demander une correction</AdmGhostBtn>
              </div>
            ) : panel === "remove" ? (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: difHair(dark) }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sp.sub, marginBottom: 9 }}>Motif du retrait — transmis à {r.agency}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {DIF_MOTIFS.map((m) => <DifPickRow key={m} label={m} on={motif === m} onClick={() => setMotif(m)} sp={sp} dark={dark} F={F} />)}
                </div>
                {motif === "Autre" && (
                  <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="Préciser le motif"
                    style={{ ...window.admFieldStyle(sp, F, dark), marginTop: 10 }} />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
                  <AdmSolidBtn sp={sp} tone={T.danger} disabled={!okRemove} style={{ height: 42, padding: "0 18px", fontSize: 13 }}
                    onClick={okRemove ? () => onAct("remove", r, motif === "Autre" ? note.trim() : motif) : undefined}>Retirer et notifier l'agence</AdmSolidBtn>
                  <AdmGhostBtn sp={sp} surf={F} style={{ height: 42, padding: "0 16px", fontSize: 13 }} onClick={reset}>Annuler</AdmGhostBtn>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub }}>Dépublication immédiate, journalisée dans Sécurité.</span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: difHair(dark) }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sp.sub, marginBottom: 9 }}>À corriger — {r.agency} reçoit la liste{c && c.kind === "enligne" ? " ; l'annonce reste en ligne" : ""}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {fixList.map((p) => <DifPickRow key={p} label={p} on={points.includes(p)} onClick={() => toggle(p)} sp={sp} dark={dark} F={F} />)}
                </div>
                {points.includes("Autre") && (
                  <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="Préciser ce qui doit être corrigé"
                    style={{ ...window.admFieldStyle(sp, F, dark), marginTop: 10 }} />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
                  <AdmSolidBtn sp={sp} disabled={!okAsk} style={{ height: 42, padding: "0 18px", fontSize: 13 }}
                    onClick={okAsk ? () => onAct("ask", r, points.map((p) => (p === "Autre" ? note.trim() : p)).join(" · ")) : undefined}>Envoyer à l'agence</AdmSolidBtn>
                  <AdmGhostBtn sp={sp} surf={F} style={{ height: 42, padding: "0 16px", fontSize: 13 }} onClick={reset}>Annuler</AdmGhostBtn>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub }}>{points.length} point{points.length > 1 ? "s" : ""} sélectionné{points.length > 1 ? "s" : ""}.</span>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: sp.ink, paddingBottom: 8 }}>Contrôles passés après publication</div>
            {difChecks(r).map((ck, i) => (
              <div key={ck.label} style={{ display: "flex", alignItems: "center", gap: 9, minHeight: 42, borderTop: i ? difHair(dark) : 0 }}>
                <AdmIcon name={ck.warn ? "alert" : "check"} size={15} color={ck.warn ? T.warn : T.ok} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: sp.soft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ck.label}</span>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: ck.warn ? T.warn : sp.soft, whiteSpace: "nowrap" }}>{ck.val}</span>
              </div>
            ))}
            {c && (
              <p style={{ margin: "14px 0 0", fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, color: sp.sub }}>
                {c.kind === "refus"
                  ? "Cette annonce n'est jamais sortie : le portail l'a refusée. Seule l'agence peut corriger la fiche."
                  : "Cette annonce est publique en ce moment. La retirer est une dépublication immédiate, journalisée dans Sécurité."}
              </p>
            )}
          </div>
        </div>
      </AdmModal>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  const AdminDiffusionSection = ({ sp, surf, dark, onGo }) => {
    const T = admTones(dark);
    const [scale, setScale] = React.useState("s14");
    const [forced, setForced] = React.useState(null);
    const [review, setReview] = React.useState(null);
    const [confirm, setConfirm] = React.useState(null);
    const [flash, setFlash] = React.useState(null);
    const [q, setQ] = React.useState("");
    const [done, setDone] = React.useState([]);

    const set = DIF_SETS[scale];
    const nq = difNorm(q.trim());
    const rows = React.useMemo(() => set.rows.filter((r) => !done.includes(r.cause) && !done.includes(r.id)
      && (!nq || difNorm(r.agency).includes(nq) || difNorm(r.title).includes(nq))), [set, done, nq]);
    const signals = rows.filter((r) => r.cause);
    const auto = signals.length > DIF_THRESHOLD ? "causes" : "annonces";
    const mode = forced || auto;
    const causes = difGroupByCause(rows);
    const refused = signals.filter((r) => DIF_CAUSES[r.cause].kind === "refus").length;
    const rate = Math.round(((set.published - refused) / set.published) * 100);

    // Concentration : 2-3 agences font souvent l'essentiel des signaux
    const heavies = React.useMemo(() => {
      const m = new Map();
      signals.forEach((r) => m.set(r.agency, (m.get(r.agency) || 0) + 1));
      const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n > 1);
      const share = Math.round((top.reduce((s, [, n]) => s + n, 0) / (signals.length || 1)) * 100);
      return { top, share };
    }, [signals]);

    React.useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4600); return () => clearTimeout(t); }, [flash]);
    const swap = (s) => { setScale(s); setForced(null); setDone([]); };

    const nums = [
      { v: admNum(signals.length), l: "signaux ouverts", tone: signals.length ? "warn" : null },
      { v: causes.length, l: "causes distinctes" },
      { v: admNum(set.published), l: "publications · 7 jours" },
      { v: admNum(refused), l: "refusées par le portail", tone: refused ? "err" : null },
      { v: rate + " %", l: "taux d'aboutissement" },
    ];

    const act = (kind, r, detail) => {
      setReview(null);
      setDone((d) => d.concat(r.id));
      setFlash(kind === "keep" ? `${r.title} — laissée en ligne, signal clos.`
        : kind === "remove" ? `${r.title} — retirée d'Immobilier.ch · motif : ${detail} · ${r.agency} notifiée.`
        : `Correction demandée à ${r.agency} · ${detail}.`);
    };

    const askLot = (g, kind) => {
      const c = DIF_CAUSES[g.cause];
      setConfirm({
        destructive: kind === "lot" && !!c.destructive,
        title: kind === "fix" ? c.fix : c.lot,
        cta: kind === "fix" ? "Rendre obligatoire" : `Traiter les ${g.count}`,
        message: kind === "fix"
          ? `Le formulaire du CRM refusera désormais une publication incomplète. Les ${g.count} annonces concernées repartent dès correction, et la cause ne revient plus.`
          : `${g.count} annonces · ${g.nAgencies} agence${g.nAgencies > 1 ? "s" : ""}. Chaque agence reçoit le détail de ses biens ; l'action est journalisée dans Sécurité.`,
        run: () => {
          setDone((d) => d.concat(g.cause));
          setFlash(kind === "fix"
            ? `Champ rendu obligatoire — ${g.count} signaux ne reviendront plus.`
            : `${g.count} annonces traitées · ${g.nAgencies} agence${g.nAgencies > 1 ? "s" : ""} notifiée${g.nAgencies > 1 ? "s" : ""}.`);
          setConfirm(null);
        },
      });
    };

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <AdmSearch sp={sp} surf={surf} dark={dark} width={272} value={q} onChange={setQ} placeholder="Agence ou annonce" />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <AdmChip sp={sp} surf={surf} label="Causes" count={causes.length} on={mode === "causes"} onClick={() => setForced("causes")} />
              <AdmChip sp={sp} surf={surf} label="Annonces" count={signals.length} on={mode === "annonces"} onClick={() => setForced("annonces")} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub }}>Échelle</span>
              <AdmChip sp={sp} surf={surf} label="14 agences" on={scale === "s14"} onClick={() => swap("s14")} />
              <AdmChip sp={sp} surf={surf} label="100 agences" on={scale === "s100"} onClick={() => swap("s100")} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 42, flexWrap: "wrap", marginBottom: 22 }}>
          {nums.map((n) => (
            <div key={n.l}>
              <div style={{ fontSize: 31, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: n.tone ? T[n.tone] : sp.ink }}>{n.v}</div>
              <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{n.l}</div>
            </div>
          ))}
        </div>

        {flash && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "0 15px", marginBottom: 14, borderRadius: ADM_R.row, background: surf.cardSub }}>
            <AdmIcon name="check" size={16} color={T.ok} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink }}>{flash}</span>
          </div>
        )}

        {!nq && heavies.top.length > 1 && heavies.share >= 25 && (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 9, marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.soft }}>
              {heavies.top.length} agences concentrent {heavies.share} % des signaux
            </span>
            {heavies.top.map(([name, n]) => (
              <button key={name} onClick={() => setQ(name)} style={{
                display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px", borderRadius: 999,
                border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: sp.ink,
                background: surf.card, boxShadow: sp.shadowSm,
              }}>{name}<span style={{ fontWeight: 800, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{n}</span></button>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />

        {signals.length === 0 ? (
          <AdmEmpty sp={sp} icon={nq ? "search" : "check"}
            title={nq ? `Aucun signal pour « ${q.trim()} »` : "Aucun signal ouvert"}
            hint={nq ? "Cette agence n'a rien en attente — ou le nom est mal orthographié."
              : `${admNum(set.published)} publications cette semaine, toutes parties sans réserve.`} />
        ) : mode === "causes" ? (
          <DifCauses rows={rows} sp={sp} surf={surf} dark={dark} onOpen={setReview}
            onArbitrate={(g) => setReview(rows.find((r) => r.cause === g.cause))}
            onLot={(g) => askLot(g, "lot")}
            onFix={(g) => askLot(g, "fix")} />
        ) : (
          <DifAnnonces rows={rows} sp={sp} surf={surf} dark={dark} onOpen={setReview} />
        )}

        <p style={{ margin: "22px 6px 0", fontSize: 11.5, fontWeight: 500, lineHeight: 1.55, color: sp.sub, maxWidth: 760 }}>
          {signals.length > DIF_THRESHOLD
            ? <>Au-delà de {DIF_THRESHOLD} signaux, l'écran groupe par cause : {signals.length} annonces ne sont pas {signals.length} problèmes. Rendre un champ obligatoire dans le CRM ferme la cause pour de bon.</>
            : <>Sous {DIF_THRESHOLD} signaux, l'écran reste au niveau de l'annonce. Chaque retrait est journalisé dans Sécurité.</>}
          {" "}
          <button onClick={() => onGo && onGo("monitoring")} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: sp.soft }}>Santé technique du tuyau →</button>
        </p>

        {review && <DifReview r={review} sp={sp} dark={dark} onClose={() => setReview(null)} onAct={act} />}

        <AdmConfirm open={!!(confirm && confirm.destructive)} sp={sp} dark={dark} tone="danger"
          title={confirm ? confirm.title : ""} message={confirm ? confirm.message : ""} confirmLabel={confirm ? confirm.cta : ""}
          onConfirm={() => confirm && confirm.run()} onClose={() => setConfirm(null)} />

        {confirm && !confirm.destructive && (
          <AdmModal sp={sp} dark={dark} width={470} title={confirm.title} onClose={() => setConfirm(null)}
            footer={<>
              <AdmGhostBtn sp={sp} surf={admFloatSurf(sp, dark)} onClick={() => setConfirm(null)}>Annuler</AdmGhostBtn>
              <AdmSolidBtn sp={sp} onClick={confirm.run}>{confirm.cta}</AdmSolidBtn>
            </>}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: sp.soft, textWrap: "pretty" }}>{confirm.message}</p>
          </AdmModal>
        )}
      </div>
    );
  };

  Object.assign(window, { AdminDiffusionSection });
})();
