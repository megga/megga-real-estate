// MEGGA CRM — Console admin · DIAGNOSTIC D'UN LIEN KYC (modale, 3 temps)
// ─────────────────────────────────────────────────────────────────────
// Option B de l'audit « Support », forme C : la page Support quitte le rail
// (13 entrées) et le diagnostic descend là où la question se pose — la ligne
// « Liens KYC publics » en pied de Vue d'ensemble.
// Pourquoi une modale et pas un dépliant : c'est la seule forme où le MOTIF
// est structurellement impossible à sauter. On ne cherche pas le nom d'une
// cliente sans avoir dit de quelle agence et de quel signalement il s'agit.
// Le flux se ferme et ne laisse rien derrière lui (aucun résultat conservé).
// Périmètre inchangé : étape atteinte du lien, jamais les pièces, jamais un
// jeton, plafond de 3 correspondances, consultation journalisée dans Sécurité.
(function () {
  const { AdmIcon, AdmModal, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmEmpty,
    ADM_R, admTones, admFieldStyle, admFloatSurf } = window;

  const KYD_STEPS = ["Envoyé", "Ouvert", "Documents déposés", "Complet"];
  const KYD_REACH = { pending: 0, opened: 1, uploading: 2, verifying: 2, submitted: 3, expired: 0 };
  const KYD_LABEL = { pending: "Envoyé", opened: "Ouvert", uploading: "Dépôt en cours", verifying: "Vérification", submitted: "Complet", expired: "Expiré" };
  const KYD_TONE = { pending: "neutral", opened: "info", uploading: "cyan", verifying: "warn", submitted: "ok", expired: "err" };
  const KYD_MAX = 3;

  const kydNorm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s.'’-]/g, "");

  // Étape atteinte — ce que la plateforme voit, et rien d'autre
  const KydTrail = ({ status, sp, dark }) => {
    const T = admTones(dark), reach = KYD_REACH[status] ?? 0, dead = status === "expired";
    return (
      <div style={{ display: "flex", alignItems: "center" }}>
        {KYD_STEPS.map((label, i) => {
          const on = i <= reach, err = dead && i === reach;
          return (
            <React.Fragment key={label}>
              {i > 0 && <span style={{ flex: 1, height: 1.5, margin: "0 8px", borderRadius: 2, background: i <= reach ? sp.ink : (dark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)") }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                <span style={{ width: on ? 9 : 7, height: on ? 9 : 7, borderRadius: 999, background: on ? (err ? T.err : sp.ink) : (dark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)") }} />
                <span style={{ fontSize: 11.5, fontWeight: on ? 700 : 500, color: on ? (err ? T.err : sp.ink) : sp.sub, whiteSpace: "nowrap" }}>{label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const KydStep = ({ n, label, done, sp, surf }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 9px" }}>
      <span style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
        background: done ? (sp.accent || sp.ink) : surf.cardSub, color: done ? (sp.accentInk || "#FFFFFF") : sp.sub,
        fontSize: 10.5, fontWeight: 800 }}>{n}</span>
      <span style={{ fontSize: 12.5, fontWeight: done ? 700 : 600, color: done ? sp.ink : sp.sub }}>{label}</span>
    </div>
  );

  const KydField = ({ value, onChange, placeholder, sp, surf, dark, icon, autoFocus, list }) => (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      {icon && (
        <span style={{ position: "absolute", left: 12, top: 0, bottom: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <AdmIcon name={icon} size={15} color={sp.sub} />
        </span>
      )}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        autoFocus={autoFocus} list={list}
        style={{ ...admFieldStyle(sp, surf, dark, 38), paddingLeft: icon ? 35 : 12,
          boxShadow: value ? `0 0 0 1.5px ${sp.ink} inset` : admFieldStyle(sp, surf, dark, 38).boxShadow }} />
    </div>
  );

  const KydResult = ({ k, sp, surf, dark, onRegen, onJournal }) => (
    <div style={{ background: surf.cardSub, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px 13px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.35, color: sp.ink }}>{k.contact}</div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: sp.sub }}>{k.email} — {k.phone}</div>
        </div>
        <AdmPill sp={sp} surf={surf} dark={dark} tone={KYD_TONE[k.status]} label={KYD_LABEL[k.status]} />
      </div>
      <div style={{ padding: "0 18px 15px" }}><KydTrail status={k.status} sp={sp} dark={dark} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "12px 18px",
        borderTop: dark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)" }}>
        {[["Agence", k.agency], ["Mode", k.mode], ["Envoyé", k.when]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.2, color: sp.sub }}>{l}</div>
            <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 700, color: sp.ink }}>{v}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <AdmGhostBtn sp={sp} surf={surf} icon="clock" onClick={() => onRegen(k)} style={{ height: 32, fontSize: 12 }}>Régénérer le lien</AdmGhostBtn>
          <AdmGhostBtn sp={sp} surf={surf} onClick={onJournal} style={{ height: 32, fontSize: 12 }}>Journal</AdmGhostBtn>
        </div>
      </div>
    </div>
  );

  // ═════════════════════════════════════════════════════════════════════
  const AdmKycDiagnostic = ({ open, onClose, sp, dark, onGo }) => {
    const F = admFloatSurf(sp, dark), T = admTones(dark);
    const [agency, setAgency] = React.useState("");
    const [ref, setRef] = React.useState("");
    const [q, setQ] = React.useState("");
    const [searched, setSearched] = React.useState(false);
    const [flash, setFlash] = React.useState(null);

    React.useEffect(() => {
      if (open) return;
      setAgency(""); setRef(""); setQ(""); setSearched(false); setFlash(null);
    }, [open]);
    React.useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4600); return () => clearTimeout(t); }, [flash]);

    if (!open) return null;

    const nq = kydNorm(q);
    const motive = agency.trim().length > 1 && ref.trim().length > 1;
    const canSearch = motive && nq.length >= 3;
    const hits = searched
      ? (window.ADMIN_KYC_LINKS || []).filter((k) => kydNorm(k.contact).includes(nq) || kydNorm(k.email).includes(nq) || kydNorm(k.phone).includes(nq))
      : [];

    return (
      <AdmModal sp={sp} dark={dark} width={568} onClose={onClose}
        title="Diagnostiquer un lien KYC"
        subtitle="Une agence signale un lien non reçu. La plateforme voit l'étape atteinte, jamais les pièces — le dossier LBA reste chez l'agence."
        footer={searched ? (
          <>
            <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={() => { setSearched(false); setQ(""); }}>Nouvelle recherche</AdmGhostBtn>
            <AdmSolidBtn sp={sp} onClick={onClose}>Terminer</AdmSolidBtn>
          </>
        ) : (
          <>
            <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={onClose}>Annuler</AdmGhostBtn>
            <AdmSolidBtn sp={sp} disabled={!canSearch} onClick={() => setSearched(true)}>Chercher</AdmSolidBtn>
          </>
        )}>

        <KydStep n="1" label="Qui signale, et pourquoi" done={motive} sp={sp} surf={F} />
        <div style={{ display: "flex", gap: 9 }}>
          <KydField sp={sp} surf={F} dark={dark} value={agency} onChange={setAgency} placeholder="Agence qui signale" list="kyd-agencies" autoFocus />
          <div style={{ width: 200, flexShrink: 0, display: "flex" }}>
            <KydField sp={sp} surf={F} dark={dark} value={ref} onChange={setRef} placeholder="Référence du signalement" />
          </div>
        </div>
        <datalist id="kyd-agencies">
          {(window.ADMIN_AGENCIES || []).map((a) => <option key={a.id} value={a.name} />)}
        </datalist>

        <KydStep n="2" label="Le lien à diagnostiquer" done={searched} sp={sp} surf={F} />
        <div style={{ display: "flex", gap: 9, opacity: motive ? 1 : 0.5, pointerEvents: motive ? "auto" : "none" }}>
          <KydField sp={sp} surf={F} dark={dark} value={q} onChange={(v) => { setQ(v); setSearched(false); }}
            placeholder="E-mail, téléphone ou nom exact" icon="search" />
        </div>
        <p style={{ margin: "8px 2px 0", fontSize: 11.5, fontWeight: 500, lineHeight: 1.5, color: sp.sub }}>
          {motive
            ? "Trois caractères minimum. Au-delà de 3 correspondances, la recherche demande de préciser — aucune liste de clients ne se déroule ici."
            : "Renseignez d'abord l'agence et la référence : le motif part dans le journal Sécurité avec la consultation."}
        </p>

        <KydStep n="3" label="Résultat et régénération" done={searched && hits.length > 0 && hits.length <= KYD_MAX} sp={sp} surf={F} />
        {!searched ? (
          <div style={{ background: F.cardSub, borderRadius: 18, padding: "26px 20px", textAlign: "center",
            fontSize: 12.5, fontWeight: 600, color: sp.sub }}>
            L'étape atteinte par le lien s'affichera ici.
          </div>
        ) : hits.length === 0 ? (
          <div style={{ background: F.cardSub, borderRadius: 18 }}>
            <AdmEmpty sp={sp} icon="alert" title="Aucun lien ne correspond"
              hint="Vérifiez l'orthographe auprès de l'agence — ou le lien n'a jamais été émis." />
          </div>
        ) : hits.length > KYD_MAX ? (
          <div style={{ background: F.cardSub, borderRadius: 18 }}>
            <AdmEmpty sp={sp} icon="search" title={hits.length + " liens correspondent"}
              hint="Précisez : e-mail ou téléphone complet. On ne déroule pas une liste de clients finaux." />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hits.map((k) => (
              <KydResult key={k.id} k={k} sp={sp} surf={F} dark={dark}
                onRegen={(x) => setFlash("Nouveau lien généré pour " + x.contact + " — remis à " + x.agency + ", à transmettre par WhatsApp.")}
                onJournal={() => { onClose(); onGo && onGo("security"); }} />
            ))}
          </div>
        )}

        {flash && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
            <AdmIcon name="check" size={15} color={T.ok} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.soft }}>{flash}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 18 }}>
          <AdmIcon name="shield" size={14} color={sp.sub} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.55, color: sp.sub }}>
            Consultation journalisée dans Sécurité — acteur, motif, lien consulté. Ni jeton, ni adresse IP, ni document dans la réponse. Rien n'est conservé à la fermeture.
          </span>
        </div>
      </AdmModal>
    );
  };

  Object.assign(window, { AdmKycDiagnostic });
})();
