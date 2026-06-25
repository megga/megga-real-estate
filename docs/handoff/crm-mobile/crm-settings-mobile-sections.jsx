// MEGGA CRM — Paramètres MOBILE · Primitives partagées + 7 sections de détail
// Sugar Pure, theme-aware. Réutilise window.* : MTCtx, MEIcon, MAv. Zéro emoji.
// Chargé AVANT crm-settings-mobile.jsx (le hub/shell consomme window.SM* + window.SettingsSection*).

const SM_useMT = () => React.useContext(window.MTCtx);
const SmGlyph = ({ name, size = 20, color = "currentColor", sw = 1.85 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

// ─── En-tête de détail : retour + titre centré ──────────────────────────
const SmHeader = ({ title, onBack }) => {
  const T = SM_useMT();
  return (
    <header style={{
      flexShrink: 0, paddingTop: 52, paddingBottom: 12, paddingLeft: 14, paddingRight: 14,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <button onClick={onBack} style={{
        width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer",
        background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <SmGlyph name="chevron-left" size={20} color={T.ink} sw={2.1} />
      </button>
      <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 17.5, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>{title}</h1>
      <div style={{ width: 40, flexShrink: 0 }} />
    </header>
  );
};

// ─── Carte Sugar ────────────────────────────────────────────────────────
const SmCard = ({ title, sub, children, pad = 18, style }) => {
  const T = SM_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadowSm, overflow: "hidden", ...style }}>
      {(title || sub) && (
        <div style={{ padding: `${pad}px ${pad}px 0` }}>
          {title && <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: T.ink }}>{title}</h2>}
          {sub && <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>{sub}</p>}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
};

// ─── Label de section ───────────────────────────────────────────────────
const SmLabel = ({ children }) => {
  const T = SM_useMT();
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, padding: "0 4px 10px" }}>{children}</div>;
};

// ─── Champ texte ────────────────────────────────────────────────────────
const SmInput = ({ label, value, onChange, type = "text", placeholder, disabled, hint }) => {
  const T = SM_useMT();
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      {label && <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted, marginBottom: 7 }}>{label}</div>}
      <div style={{
        display: "flex", alignItems: "center", height: 46, padding: "0 14px", borderRadius: 13,
        background: T.cardSubtle, opacity: disabled ? 0.55 : 1,
        boxShadow: focus ? `0 0 0 2px ${T.accent}` : `inset 0 0 0 1px ${T.hair}`,
        transition: "box-shadow .18s ease",
      }}>
        <input type={type} value={value || ""} disabled={disabled} placeholder={placeholder}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, color: T.ink }} />
      </div>
      {hint && <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: T.muted }}>{hint}</div>}
    </label>
  );
};

const SmTextarea = ({ label, value, onChange, placeholder, rows = 5 }) => {
  const T = SM_useMT();
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "block" }}>
      {label && <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted, marginBottom: 7 }}>{label}</div>}
      <div style={{ padding: "11px 14px", borderRadius: 13, background: T.cardSubtle, boxShadow: focus ? `0 0 0 2px ${T.accent}` : `inset 0 0 0 1px ${T.hair}`, transition: "box-shadow .18s ease" }}>
        <textarea value={value || ""} rows={rows} placeholder={placeholder}
          onChange={e => onChange && onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ width: "100%", border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: T.ink, resize: "none", lineHeight: 1.5 }} />
      </div>
    </label>
  );
};

// ─── Interrupteur ───────────────────────────────────────────────────────
const SmToggle = ({ on, onChange }) => {
  const T = SM_useMT();
  return (
    <button onClick={() => onChange && onChange(!on)} style={{
      width: 46, height: 28, borderRadius: 999, border: 0, position: "relative", cursor: "pointer", flexShrink: 0,
      background: on ? T.accent : T.ghost, transition: "background .2s",
    }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 999, background: on ? T.accentInk : "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", transition: "left .2s cubic-bezier(.2,.8,.2,1)" }} />
    </button>
  );
};

// ─── Segment (pilule multi-options) ─────────────────────────────────────
const SmSegment = ({ options, value, onChange, full }) => {
  const T = SM_useMT();
  return (
    <div style={{ display: full ? "grid" : "inline-flex", gridTemplateColumns: full ? `repeat(${options.length}, 1fr)` : undefined, gap: 4, padding: 4, borderRadius: 999, background: T.cardSubtle }}>
      {options.map(o => {
        const sel = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, padding: o.icon ? "0 13px 0 11px" : "0 15px",
            borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: -0.1, whiteSpace: "nowrap",
            background: sel ? T.accent : "transparent", color: sel ? T.accentInk : T.muted, boxShadow: sel ? T.shadowSm : "none", transition: "background .18s, color .18s",
          }}>
            {o.icon && <SmGlyph name={o.icon} size={15} color={sel ? T.accentInk : T.muted} sw={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Ligne icône + libellé + contrôle (liste dense) ─────────────────────
const SmRow = ({ icon, img, logo, title, sub, right, onClick, last, danger }) => {
  const T = SM_useMT();
  return (
    <div onClick={onClick} style={{
      width: "100%", textAlign: "left", cursor: onClick ? "pointer" : "default", fontFamily: "inherit",
      background: "transparent", display: "flex", alignItems: "center", gap: 13, padding: "13px 16px",
      boxShadow: last ? "none" : `inset 0 -1px 0 ${T.hair}`,
    }}>
      {(icon || img || logo) && (
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: logo ? "#FFFFFF" : T.cardSubtle, boxShadow: logo ? T.shadowSm : "none" }}>
          {logo ? logo : img ? <img src={img} alt="" width="22" height="22" style={{ width: 22, height: 22, display: "block" }} /> : <SmGlyph name={icon} size={19} color={danger ? "#E0533F" : T.ink} sw={1.9} />}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: danger ? "#E0533F" : T.ink }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>{sub}</span>}
      </span>
      {right}
    </div>
  );
};

// ─── Bouton noir (CTA) ──────────────────────────────────────────────────
const SmBlackBtn = ({ children, onClick, icon, full }) => {
  const T = SM_useMT();
  return (
    <button onClick={onClick} style={{
      height: 50, width: full ? "100%" : undefined, padding: "0 22px", borderRadius: 999, border: 0, cursor: "pointer",
      background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: T.shadowSm,
    }}>{icon}{children}</button>
  );
};

// ─── Pilule de statut (état « rempli ») ─────────────────────────────────
const SmStatus = ({ tone = "muted", children }) => {
  const T = SM_useMT();
  const tones = {
    ok:    { bg: T.goal, fg: "#FFFFFF" },
    warn:  { bg: "#B4570A", fg: "#FFFFFF" },
    muted: { bg: T.cardSubtle, fg: T.muted },
  }[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: tones.bg, color: tones.fg, fontSize: 11.5, fontWeight: 800, letterSpacing: -0.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{children}</span>;
};

// ─── Anneau de complétude (count-up) ────────────────────────────────────
const SmRing = ({ value, size = 64, sw = 7, showLabel = true, tone: toneOverride }) => {
  const T = SM_useMT();
  const anim = value;
  const r = (size - sw) / 2, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, anim / 100));
  const TONES = {
    ok:   { a: "#10B981", b: "#059669" },
    warn: { a: "#F59E0B", b: "#C45A00" },
    bad:  { a: "#F87171", b: "#DC2626" },
    info: { a: "#22B8CF", b: "#0891B2" },
  };
  const tone = toneOverride ? TONES[toneOverride]
    : value >= 100 ? TONES.ok : value >= 50 ? TONES.info : TONES.warn;
  const gid = React.useId ? React.useId().replace(/:/g, "") : "smring" + Math.round(value * 1000 + size);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={tone.a} /><stop offset="100%" stopColor={tone.b} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.hair} strokeWidth={sw} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={sw} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      {showLabel && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: size * 0.26, fontWeight: 800, letterSpacing: -0.5, color: T.ink, fontVariantNumeric: "tabular-nums" }}><span style={{ display: "inline-flex", alignItems: "baseline" }}>{Math.round(anim)}<span style={{ fontSize: size * 0.16, marginLeft: 1 }}>%</span></span></div>}
    </div>
  );
};

// ─── Layout commun d'une section (header + scroll) ──────────────────────
const SmSection = ({ title, onBack, children }) => {
  const T = SM_useMT();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas }}>
      <SmHeader title={title} onBack={onBack} />
      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 16px 28px", WebkitOverflowScrolling: "touch", animation: "smIn .4s cubic-bezier(.2,.8,.2,1) both" }}>
        {children}
      </main>
    </div>
  );
};

// ─── Feuille modale — Photo de profil (import réel + aperçu) ────────────
const SmPhotoSheet = ({ current, onApply, onRemove, onClose }) => {
  const T = SM_useMT();
  const [pending, setPending] = React.useState(null); // data URL en attente de validation
  const [err, setErr] = React.useState("");
  const fileRef = React.useRef(null);
  const src = pending || current;

  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { setErr("Choisissez un fichier image (JPG ou PNG)."); return; }
    if (f.size > 8 * 1024 * 1024) { setErr("Image trop lourde — 8 Mo maximum."); return; }
    setErr("");
    const r = new FileReader();
    r.onload = () => setPending(r.result);
    r.readAsDataURL(f);
  };

  const ghostBtn = {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
    background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
  };
  const blackBtn = (enabled = true) => ({
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? T.accent : T.ghost, color: enabled ? T.accentInk : T.card,
    fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: enabled ? T.shadowSm : "none", transition: "background .2s, color .2s",
  });
  const optBtn = {
    display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "14px 16px", borderRadius: 16,
    border: 0, cursor: "pointer", background: T.cardSubtle, fontFamily: "inherit", textAlign: "left",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes smPhUp { from { transform: translateY(100%); } to { transform: none; } } @keyframes smPhStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderRadius: "28px 28px 0 0",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.25)", padding: "10px 20px 32px",
        animation: "smPhUp .42s cubic-bezier(.2,.8,.2,1) both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
            <SmGlyph name="camera" size={20} color={T.ink} sw={1.9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Photo de profil</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>Format carré recommandé<br />JPG ou PNG, 8 Mo max.</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <SmGlyph name="close" size={17} color={T.muted} sw={2.2} />
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />

        {/* Aperçu */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, animation: "smPhStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ position: "relative" }}>
            {src
              ? <img src={src} alt="" style={{ width: 128, height: 128, borderRadius: 999, objectFit: "cover", display: "block", boxShadow: T.shadowSm }} />
              : <div style={{ width: 128, height: 128, borderRadius: 999, background: T.accent, color: T.accentInk, display: "grid", placeItems: "center", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>GL</div>}
            {pending && <span style={{ position: "absolute", bottom: 2, right: 2, width: 32, height: 32, borderRadius: 999, background: T.goal, border: `3px solid ${T.card}`, display: "grid", placeItems: "center" }}>
              <SmGlyph name="check" size={15} color="#fff" sw={2.4} />
            </span>}
          </div>
        </div>

        {err && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 13px", borderRadius: 12, background: "rgba(224,83,63,0.1)", color: "#E0533F", fontSize: 12, fontWeight: 700 }}>
          <SmGlyph name="alert" size={14} color="#E0533F" sw={2} />{err}
        </div>}

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => fileRef.current && fileRef.current.click()} style={optBtn}>
            <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
              <SmGlyph name="upload" size={19} color={T.ink} sw={1.9} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>Importer un fichier</span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Depuis votre appareil</span>
            </span>
            <SmGlyph name="chevron-right" size={18} color={T.ghost} sw={2} />
          </button>
          {(current || pending) && (
            <button onClick={() => { setPending(null); onRemove && onRemove(); onClose(); }} style={optBtn}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <SmGlyph name="trash" size={18} color="#E0533F" sw={1.9} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: "#E0533F" }}>Retirer la photo</span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Revenir aux initiales</span>
              </span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button onClick={onClose} style={ghostBtn}>Annuler</button>
          <button onClick={() => { if (pending) { onApply && onApply(pending); onClose(); } }} disabled={!pending} style={blackBtn(!!pending)}>
            Utiliser cette photo
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  1 · PROFIL
// ═══════════════════════════════════════════════════════════════════════
const SM_PROFILE_DEFAULT = { firstName: "Gregory", lastName: "Lyonnet", title: "Agent principal", rcc: "RCC-2018-GE-4421", email: "gregory@megga.ch", mobile: "+41 79 412 88 21", phone: "+41 22 555 01 02", bio: "Spécialiste du marché genevois depuis 12 ans. Mandats exclusifs, conformité C2PA sur l'ensemble du portefeuille.", photo: false };
const SM_PROFILE_FIELDS = ["firstName", "lastName", "title", "rcc", "email", "mobile", "phone", "bio", "photo"];
const smProfileCompletion = (d) => {
  if (!d) return 0;
  const filled = SM_PROFILE_FIELDS.filter(k => k === "photo" ? !!d.photo : ((d[k] || "").toString().trim().length > 0)).length;
  return Math.round((filled / SM_PROFILE_FIELDS.length) * 100);
};

const SettingsSectionProfil = ({ onBack, data, onChange, onSave }) => {
  const T = SM_useMT();
  const [local, setLocal] = React.useState(SM_PROFILE_DEFAULT);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const d = data || local;
  const set = p => { if (onChange) onChange({ ...d, ...p }); else setLocal(s => ({ ...s, ...p })); };
  const pct = smProfileCompletion(d);
  return (
   <React.Fragment>
    <SmSection title="Mon profil" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SmCard pad={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button type="button" onClick={() => setPhotoOpen(true)} style={{ position: "relative", flexShrink: 0, border: 0, background: "transparent", padding: 0, cursor: "pointer", borderRadius: 999 }}>
              {d.photoSrc
                ? <img src={d.photoSrc} alt="" style={{ width: 68, height: 68, borderRadius: 999, objectFit: "cover", display: "block" }} />
                : <window.MAv bg={T.accent} ink={T.accentInk} size={68}>GL</window.MAv>}
              <span style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 999, background: d.photo ? T.accent : T.cardSubtle, border: `3px solid ${T.card}`, display: "grid", placeItems: "center" }}>
                <SmGlyph name={d.photo ? "check" : "camera"} size={13} color={d.photo ? T.accentInk : T.ink} sw={1.9} />
              </span>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, color: T.ink, lineHeight: 1.1 }}>{`${d.firstName} ${d.lastName}`.trim() || "Sans nom"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 3, whiteSpace: "pre-line" }}>{[d.title, "MEGGA Genève"].filter(Boolean).join("\n")}</div>
            </div>
            <SmRing value={pct} size={62} showLabel={false} />
          </div>
        </SmCard>

        <SmCard title="Identité" pad={18}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SmInput label="Prénom" value={d.firstName} onChange={v => set({ firstName: v })} />
            <SmInput label="Nom" value={d.lastName} onChange={v => set({ lastName: v })} />
            <SmInput label="Fonction" value={d.title} onChange={v => set({ title: v })} />
            <SmInput label="N° RCC" value={d.rcc} onChange={v => set({ rcc: v })} />
          </div>
        </SmCard>

        <SmCard title="Contact" pad={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SmInput label="Email professionnel" type="email" value={d.email} onChange={v => set({ email: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SmInput label="Mobile" type="tel" value={d.mobile} onChange={v => set({ mobile: v })} />
              <SmInput label="Fixe" type="tel" value={d.phone} onChange={v => set({ phone: v })} />
            </div>
          </div>
        </SmCard>

        <SmCard title="Présentation" pad={18}>
          <SmTextarea value={d.bio} onChange={v => set({ bio: v })} rows={5} placeholder="Présentez-vous…" />
        </SmCard>

        <SmBlackBtn full onClick={onSave}>Enregistrer</SmBlackBtn>
      </div>
    </SmSection>
    {photoOpen && <SmPhotoSheet
      current={d.photoSrc || null}
      onApply={(src) => set({ photo: true, photoSrc: src })}
      onRemove={() => set({ photo: false, photoSrc: null })}
      onClose={() => setPhotoOpen(false)} />}
   </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  2 · AGENCE
// ═══════════════════════════════════════════════════════════════════════
const SettingsSectionAgence = ({ onBack, onSave }) => {
  const T = SM_useMT();
  const [d, setD] = React.useState({ legal: "MEGGA Genève SA", ide: "CHE-409.118.221", tva: "CHE-409.118.221 TVA", year: "2014", phone: "+41 22 555 01 00", email: "contact@megga.ch", web: "megga.ch" });
  const set = p => setD(s => ({ ...s, ...p }));
  const [logoSrc, setLogoSrc] = React.useState(null);
  const logoInputRef = React.useRef(null);
  const onLogoFile = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setLogoSrc(ev.target.result);
    r.readAsDataURL(f);
    e.target.value = "";
  };
  return (
    <SmSection title="Mon agence" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SmCard pad={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => logoInputRef.current && logoInputRef.current.click()}
              style={{ position: "relative", flexShrink: 0, border: 0, background: "transparent", padding: 0, cursor: "pointer", borderRadius: 18 }}
              aria-label="Changer le logo de l'agence"
            >
              <div style={{ width: 64, height: 64, borderRadius: 18, background: T.cardSubtle, display: "grid", placeItems: "center", overflow: "hidden" }}>
                {logoSrc
                  ? <img src={logoSrc} alt="Logo agence" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <SmGlyph name="building" size={28} color={T.ink} sw={1.7} />}
              </div>
              <span style={{ position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: 99, background: T.accent, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <SmGlyph name="camera" size={14} color="#FFFFFF" sw={2} />
              </span>
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoFile} style={{ display: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>MEGGA Genève</div>
              <button type="button" onClick={() => logoInputRef.current && logoInputRef.current.click()} style={{ marginTop: 3, border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: T.muted }}>
                {logoSrc ? "Changer le logo" : "Ajouter un logo"}
              </button>
            </div>
          </div>
        </SmCard>

        <SmCard title="Identité légale" pad={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SmInput label="Raison sociale" value={d.legal} onChange={v => set({ legal: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SmInput label="N° IDE" value={d.ide} onChange={v => set({ ide: v })} />
              <SmInput label="Année" value={d.year} onChange={v => set({ year: v })} />
            </div>
            <SmInput label="N° TVA" value={d.tva} onChange={v => set({ tva: v })} />
          </div>
        </SmCard>

        <SmCard title="Coordonnées publiques" pad={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SmInput label="Téléphone" type="tel" value={d.phone} onChange={v => set({ phone: v })} />
            <SmInput label="Email" type="email" value={d.email} onChange={v => set({ email: v })} />
            <SmInput label="Site web" value={d.web} onChange={v => set({ web: v })} />
          </div>
        </SmCard>

        <SmBlackBtn full onClick={onSave}>Enregistrer</SmBlackBtn>
      </div>
    </SmSection>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  3 · NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════
const SettingsSectionNotifications = ({ onBack }) => {
  const T = SM_useMT();
  const [s, setS] = React.useState({ email: true, sms: false, crm: true });
  const CH = [
    { id: "email", icon: "mail", title: "Email", sub: "Récapitulatifs & alertes" },
    { id: "sms", icon: "message", title: "SMS", sub: "Urgences uniquement" },
    { id: "crm", icon: "bell", title: "Dans le CRM", sub: "Bannières & badge" },
  ];
  const activeCh = Object.values(s).filter(Boolean).length;
  return (
    <SmSection title="Notifications" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Résumé */}
        <SmCard pad={18}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: T.accent, display: "grid", placeItems: "center", boxShadow: `0 8px 20px ${T.accent}33` }}>
              <SmGlyph name="bell" size={22} color={T.accentInk} sw={1.8} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: T.ink, lineHeight: 1.1 }}>Vous êtes à jour</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 3 }}>{activeCh} canaux actifs</div>
            </div>
          </div>
        </SmCard>

        {/* Canaux */}
        <div>
          <SmCard pad={0}>
            <div style={{ padding: "6px 2px 2px" }}>
              {CH.map((c, i) => (
                <SmRow key={c.id} icon={c.icon} title={c.title} sub={c.sub} last={i === CH.length - 1}
                  right={<SmToggle on={s[c.id]} onChange={v => setS(p => ({ ...p, [c.id]: v }))} />} />
              ))}
            </div>
          </SmCard>
        </div>
      </div>
    </SmSection>
  );
};

// ─── Logos partenaires (réutilisés dans la feuille de connexion) ────────
const SM_GoogleG = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);
const SM_MsLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
  </svg>
);

// ─── Feuille de connexion OAuth (compte → permissions → connexion) ──────
const SmOAuthSheet = ({ service, onConnected, onClose }) => {
  const T = SM_useMT();
  const isGoogle = service.id === "google";
  const Logo = isGoogle ? SM_GoogleG : SM_MsLogo;
  const brand = isGoogle ? "Google Workspace" : "Microsoft 365";
  const accounts = isGoogle ? [
    { email: "gregory@megga.ch", name: "Grégory Lyonnet", initial: "G", color: "#1A73E8" },
    { email: "g.lyonnet@gmail.com", name: "Grégory Lyonnet", initial: "G", color: "#34A853" },
  ] : [
    { email: "gregory@megga.ch", name: "Grégory Lyonnet", initial: "G", color: "#0067B8" },
  ];
  const allScopes = isGoogle ? [
    { key: "calendar", icon: "calendar", title: "Google Calendar", sub: "Lire votre agenda et y ajouter visites & rendez-vous." },
    { key: "gmail", icon: "mail", title: "Gmail", sub: "Lier les conversations clients aux deals du CRM." },
    { key: "contacts", icon: "users", title: "Google Contacts", sub: "Synchroniser le carnet d'adresses." },
  ] : [
    { key: "calendar", icon: "calendar", title: "Outlook Calendar", sub: "Ajouter et synchroniser visites & rendez-vous." },
    { key: "mail", icon: "mail", title: "Outlook Mail", sub: "Lier les conversations clients aux deals." },
    { key: "contacts", icon: "users", title: "Carnet Exchange", sub: "Synchroniser les contacts." },
  ];

  const [step, setStep] = React.useState("choose"); // choose · consent · loading · done
  const [account, setAccount] = React.useState(null);
  const [scopes, setScopes] = React.useState(isGoogle ? ["calendar", "gmail"] : ["calendar", "mail"]);
  const toggle = (k) => setScopes(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);

  const allow = () => { setStep("loading"); setTimeout(() => setStep("done"), 1200); };

  const ghostBtn = {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
    background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
  };
  const blackBtn = (enabled = true) => ({
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? T.accent : T.ghost, color: enabled ? T.accentInk : T.card,
    fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: enabled ? T.shadowSm : "none", transition: "background .2s, color .2s",
  });

  const subByStep = {
    choose:  `Choisissez le compte ${isGoogle ? "Google" : "Microsoft"} à brancher.`,
    consent: "MEGGA souhaite accéder à votre compte.",
    loading: "Connexion sécurisée en cours…",
    done:    "Compte branché avec succès.",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes smOaUp { from { transform: translateY(100%); } to { transform: none; } } @keyframes smOaStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } @keyframes smOaSpin { to { transform: rotate(360deg); } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderRadius: "28px 28px 0 0",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.25)", padding: "10px 20px 32px",
        animation: "smOaUp .42s cubic-bezier(.2,.8,.2,1) both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair, margin: "0 auto 16px" }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: step === "done" ? T.goal : "#FFFFFF", display: "grid", placeItems: "center", boxShadow: T.shadowSm, transition: "background .25s" }}>
            {step === "done" ? <SmGlyph name="check" size={21} color="#fff" sw={2.4} /> : <Logo size={22} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>{brand}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>{subByStep[step]}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <SmGlyph name="close" size={17} color={T.muted} sw={2.2} />
          </button>
        </div>

        {/* CHOOSE — sélection du compte */}
        {step === "choose" && (
          <div style={{ animation: "smOaStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 10 }}>
            {accounts.map(a => (
              <button key={a.email} onClick={() => { setAccount(a); setStep("consent"); }} style={{
                display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 15px", borderRadius: 16,
                border: 0, cursor: "pointer", background: T.cardSubtle, fontFamily: "inherit", textAlign: "left",
              }}>
                <span style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, background: a.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 800 }}>{a.initial}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>{a.name}</span>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.email}</span>
                </span>
                <SmGlyph name="chevron-right" size={18} color={T.ghost} sw={2} />
              </button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, padding: "0 4px", fontSize: 11.5, fontWeight: 600, color: T.muted, lineHeight: 1.5 }}>
              <SmGlyph name="lock" size={13} color={T.muted} sw={1.9} /> Connexion chiffrée — MEGGA ne stocke jamais votre mot de passe.
            </div>
          </div>
        )}

        {/* CONSENT — permissions */}
        {step === "consent" && account && (
          <div style={{ animation: "smOaStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, background: T.cardSubtle, marginBottom: 16 }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, background: account.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800 }}>{account.initial}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.email}</span>
              <button onClick={() => setStep("choose")} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: T.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>Changer</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted, marginBottom: 10, padding: "0 2px" }}>Autorisations demandées</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allScopes.map(s => {
                const on = scopes.includes(s.key);
                return (
                  <button key={s.key} onClick={() => toggle(s.key)} style={{
                    display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "13px 14px", borderRadius: 14,
                    border: 0, cursor: "pointer", background: T.cardSubtle, fontFamily: "inherit", textAlign: "left",
                  }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                      <SmGlyph name={s.icon} size={17} color={T.ink} sw={1.85} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink }}>{s.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>{s.sub}</span>
                    </span>
                    <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, marginTop: 4, display: "grid", placeItems: "center", background: on ? T.accent : "transparent", boxShadow: on ? "none" : `inset 0 0 0 2px ${T.hair}`, transition: "background .15s" }}>
                      {on && <SmGlyph name="check" size={14} color={T.accentInk} sw={2.6} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={onClose} style={ghostBtn}>Annuler</button>
              <button onClick={() => scopes.length && allow()} disabled={!scopes.length} style={blackBtn(scopes.length > 0)}>Autoriser MEGGA</button>
            </div>
          </div>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div style={{ animation: "smOaStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 0 14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, border: `3px solid ${T.hair}`, borderTopColor: T.accent, animation: "smOaSpin .8s linear infinite" }} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Connexion à {brand}…</div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && account && (
          <div style={{ animation: "smOaStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 16, borderRadius: 16, background: T.cardSubtle }}>
              <span style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, background: account.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 800 }}>{account.initial}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink }}>Compte connecté</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.email} · {scopes.length} service{scopes.length > 1 ? "s" : ""} actif{scopes.length > 1 ? "s" : ""}</div>
              </div>
            </div>
            <button onClick={() => { onConnected && onConnected(account.email); onClose(); }} style={{ ...blackBtn(true), width: "100%", flex: "none", marginTop: 22 }}>Terminé</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Feuille de liaison WhatsApp Business (numéro → code → lié) ─────────
const SmWhatsAppSheet = ({ onConnected, onClose }) => {
  const T = SM_useMT();
  const [step, setStep] = React.useState("intro"); // intro · code · linking · done
  const [phone, setPhone] = React.useState("+41 79 412 88 21");
  const [code, setCode] = React.useState("");
  const WA = "#25D366";
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const codeOk = code.replace(/\D/g, "").length === 6;

  const ghostBtn = {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
    background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
  };
  const blackBtn = (enabled = true) => ({
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? T.accent : T.ghost, color: enabled ? T.accentInk : T.card,
    fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: enabled ? T.shadowSm : "none", transition: "background .2s, color .2s",
  });

  const subByStep = {
    intro:   "",
    code:    "Saisissez le code à 6 chiffres reçu sur WhatsApp.",
    linking: "Vérification en cours…",
    done:    "Numéro lié avec succès.",
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes smWaUp { from { transform: translateY(100%); } to { transform: none; } } @keyframes smWaStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } @keyframes smWaSpin { to { transform: rotate(360deg); } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderRadius: "28px 28px 0 0",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.25)", padding: "10px 20px 32px",
        animation: "smWaUp .42s cubic-bezier(.2,.8,.2,1) both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair, margin: "0 auto 16px" }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: step === "done" ? T.goal : `${WA}1A`, display: "grid", placeItems: "center", transition: "background .25s" }}>
            {step === "done" ? <SmGlyph name="check" size={21} color="#fff" sw={2.4} /> : <img src="assets/whatsapp.svg" alt="" width="22" height="22" style={{ width: 22, height: 22, display: "block" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>WhatsApp Business</h2>
            {subByStep[step] && <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>{subByStep[step]}</p>}
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <SmGlyph name="close" size={17} color={T.muted} sw={2.2} />
          </button>
        </div>

        {/* INTRO — numéro */}
        {step === "intro" && (
          <div style={{ animation: "smWaStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 16 }}>
            <SmInput label="Numéro WhatsApp Business" type="tel" value={phone} onChange={setPhone} placeholder="+41 79 000 00 00" />
            <div style={{ position: "relative", overflow: "hidden", padding: "17px 18px", borderRadius: 18, background: T.card, boxShadow: T.shadow }}>
              <div style={{ position: "absolute", top: -45, right: -35, width: 150, height: 150, borderRadius: 999, background: `radial-gradient(circle, ${T.accent}0F, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ width: 38, height: 38, borderRadius: 999, flexShrink: 0, background: T.accent, display: "grid", placeItems: "center", boxShadow: `0 6px 16px ${T.accent}40` }}>
                  <SmGlyph name="sparkle" size={18} color={T.accentInk} sw={1.9} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink }}>Copilot MEGGA</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: 0.2, marginTop: 1 }}>Actif dans WhatsApp</div>
                </div>
                <SmStatus tone="ok">Inclus</SmStatus>
              </div>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 15 }}>
                {[
                  { icon: "message", t: "Répond et relance vos clients" },
                  { icon: "users", t: "Qualifie les nouveaux contacts" },
                  { icon: "calendar", t: "Planifie les visites" },
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <SmGlyph name={f.icon} size={19} color={T.ink} sw={1.8} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1, color: T.inkSoft }}>{f.t}</span>
                    <SmGlyph name="check" size={15} color={T.goal} sw={2.6} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
              <button onClick={onClose} style={ghostBtn}>Annuler</button>
              <button onClick={() => phoneOk && setStep("code")} disabled={!phoneOk} style={blackBtn(phoneOk)}>
                Envoyer le code <SmGlyph name="arrow-right" size={16} color={phoneOk ? T.accentInk : T.card} sw={2.2} />
              </button>
            </div>
          </div>
        )}

        {/* CODE — saisie du code à 6 chiffres */}
        {step === "code" && (
          <div style={{ animation: "smWaStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 14, background: T.cardSubtle }}>
              <SmGlyph name="phone" size={17} color={T.ink} sw={1.85} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{phone}</span>
              <button onClick={() => setStep("intro")} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: T.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>Modifier</button>
            </div>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••"
              style={{ width: "100%", height: 60, textAlign: "center", border: 0, outline: "none", borderRadius: 14, background: T.cardSubtle, boxShadow: `inset 0 0 0 1px ${T.hair}`, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 28, fontWeight: 700, letterSpacing: 10, color: T.ink }} />
            <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: T.muted }}>
              Pas reçu ? <button onClick={() => setCode("")} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: T.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>Renvoyer le code</button>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
              <button onClick={() => setStep("intro")} style={ghostBtn}>Retour</button>
              <button onClick={() => { if (codeOk) { setStep("linking"); setTimeout(() => setStep("done"), 1200); } }} disabled={!codeOk} style={blackBtn(codeOk)}>
                Vérifier <SmGlyph name="check" size={16} color={codeOk ? T.accentInk : T.card} sw={2.3} />
              </button>
            </div>
          </div>
        )}

        {/* LINKING */}
        {step === "linking" && (
          <div style={{ animation: "smWaStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "24px 0 14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, border: `3px solid ${T.hair}`, borderTopColor: WA, animation: "smWaSpin .8s linear infinite" }} />
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Liaison de {phone}…</div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div style={{ animation: "smWaStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 16, borderRadius: 16, background: T.cardSubtle }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${WA}1A`, display: "grid", placeItems: "center" }}>
                <img src="assets/whatsapp.svg" alt="" width="22" height="22" style={{ width: 22, height: 22, display: "block" }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink }}>Numéro lié</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>{phone} · messagerie active</div>
              </div>
            </div>
            <button onClick={() => { onConnected && onConnected(); onClose(); }} style={{ ...blackBtn(true), width: "100%", flex: "none", marginTop: 22 }}>Terminé</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  4 · INTÉGRATIONS
// ═══════════════════════════════════════════════════════════════════════
const SettingsSectionIntegrations = ({ onBack }) => {
  const T = SM_useMT();
  const [conn, setConn] = React.useState({ google: true, microsoft: false, docusign: true, whatsapp: false });
  const [oauthFor, setOauthFor] = React.useState(null);
  const [waOpen, setWaOpen] = React.useState(false);
  const SVC = [
    { id: "google", logo: <SM_GoogleG size={21} />, title: "Google Workspace", sub: "Agenda & contacts" },
    { id: "microsoft", logo: <SM_MsLogo size={20} />, title: "Microsoft 365", sub: "Outlook & calendrier" },
    { id: "docusign", icon: "edit", title: "DocuSign", sub: "Signature électronique" },
    { id: "whatsapp", img: "assets/whatsapp.svg", title: "WhatsApp Business", sub: "Messagerie clients" },
  ];
  return (
   <React.Fragment>
    <SmSection title="Intégrations" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SmCard pad={0}>
          <div style={{ padding: "8px 2px 2px" }}>
            {SVC.map((sv, i) => {
              const on = conn[sv.id];
              return (
                <SmRow key={sv.id} icon={sv.icon} img={sv.img} logo={sv.logo} title={sv.title} sub={sv.sub} last={i === SVC.length - 1}
                  right={
                    <button onClick={() => {
                      if (on) { setConn(p => ({ ...p, [sv.id]: false })); return; }
                      if (sv.id === "google" || sv.id === "microsoft") { setOauthFor(sv); return; }
                      if (sv.id === "whatsapp") { setWaOpen(true); return; }
                      setConn(p => ({ ...p, [sv.id]: true }));
                    }} style={{
                      height: 34, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: -0.1,
                      background: on ? T.goal : T.accent, color: on ? "#FFFFFF" : T.accentInk, display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                    }}>
                      {on ? "Connecté" : "Connecter"}
                    </button>
                  } />
              );
            })}
          </div>
        </SmCard>
      </div>
    </SmSection>
    {oauthFor && <SmOAuthSheet service={oauthFor} onConnected={() => setConn(p => ({ ...p, [oauthFor.id]: true }))} onClose={() => setOauthFor(null)} />}
    {waOpen && <SmWhatsAppSheet onConnected={() => setConn(p => ({ ...p, whatsapp: true }))} onClose={() => setWaOpen(false)} />}
   </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  5 · FACTURATION
// ═══════════════════════════════════════════════════════════════════════
// ─── Marque de carte bancaire (chip mono, sans logo tiers) ──────────────
const SmCardBrand = ({ brand = "VISA" }) => (
  <div style={{
    width: 46, height: 32, borderRadius: 8, flexShrink: 0,
    background: "linear-gradient(135deg,#15171C,#33373F)",
    display: "grid", placeItems: "center",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.10)",
  }}>
    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, color: "#fff", fontStyle: "italic" }}>{brand}</span>
  </div>
);

const SettingsSectionFacturation = ({ onBack }) => {
  const T = SM_useMT();
  const price = "49";

  return (
    <SmSection title="Facturation" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── HÉRO — abonnement courant (dégradé sombre signature) ── */}
        <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#0B0C0E 0%,#1F2937 100%)", borderRadius: 22, padding: 22, color: "#fff", boxShadow: T.shadow }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 120% at 84% 0%, rgba(255,255,255,0.10) 0%, transparent 58%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Abonnement</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 9 }}>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>Pro</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>CHF {price} / mois</span>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "16px 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SmGlyph name="clock" size={16} color="rgba(255,255,255,0.55)" sw={2} />
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.62)" }}>Prochain prélèvement</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>1 juil. · CHF {price}</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button style={{ flex: 1, height: 46, borderRadius: 999, border: 0, cursor: "pointer", background: "#fff", color: "#0B0C0E", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
                <SmGlyph name="external" size={15} color="#0B0C0E" sw={2} />Gérer dans Stripe
              </button>
            </div>
          </div>
        </div>

        {/* ── MOYEN DE PAIEMENT ── */}
        <div>
          <SmLabel>Moyen de paiement</SmLabel>
          <div style={{ background: T.card, borderRadius: 18, boxShadow: T.shadowSm, overflow: "hidden" }}>
            <button style={{ width: "100%", textAlign: "left", border: 0, cursor: "pointer", background: "transparent", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 13, padding: "14px 16px" }}>
              <SmCardBrand brand="VISA" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink, fontVariantNumeric: "tabular-nums" }}>···· ···· ···· 4242</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Expire 08/27 · Gabriel Lévy</div>
              </div>
              <SmGlyph name="chevron-right" size={18} color={T.ghost} sw={2.2} />
            </button>
          </div>
        </div>

      </div>
    </SmSection>
  );
};

// ─── QR factice déterministe (motif stable) ─────────────────────────────
const Sm2FA_QR = ({ size = 156 }) => {
  const N = 21, cell = size / N;
  const cells = [];
  const isFinder = (r, c) => {
    const inBox = (br, bc) => r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0);
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (isFinder(r, c)) continue;
    if (rnd() > 0.52) cells.push(<rect key={r + "-" + c} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0B0C0E" />);
  }
  const Finder = ({ x, y }) => (
    <g transform={`translate(${x * cell} ${y * cell})`}>
      <rect width={cell * 7} height={cell * 7} fill="#0B0C0E" />
      <rect x={cell} y={cell} width={cell * 5} height={cell * 5} fill="#fff" />
      <rect x={cell * 2} y={cell * 2} width={cell * 3} height={cell * 3} fill="#0B0C0E" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <rect width={size} height={size} fill="#fff" />
      {cells}
      <Finder x={0} y={0} /><Finder x={N - 7} y={0} /><Finder x={0} y={N - 7} />
    </svg>
  );
};

// ─── Saisie code 6 cases avec auto-focus ────────────────────────────────
const Sm2FA_Code = ({ value, onChange }) => {
  const T = SM_useMT();
  const refs = React.useRef([]);
  const set = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[i] = d;
    const joined = next.join("").slice(0, 6);
    onChange(joined);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i} ref={el => refs.current[i] = el} value={value[i] || ""}
          onChange={e => set(i, e.target.value)} onKeyDown={e => onKey(i, e)}
          inputMode="numeric" maxLength={1} autoFocus={i === 0}
          style={{
            width: 46, height: 56, textAlign: "center", fontFamily: "inherit",
            fontSize: 24, fontWeight: 800, color: T.ink, background: T.cardSubtle,
            border: 0, borderRadius: 13, outline: "none",
            boxShadow: `inset 0 0 0 2px ${value[i] ? T.accent : T.hair}`,
            transition: "box-shadow .15s",
          }} />
      ))}
    </div>
  );
};

// ─── Feuille modale de configuration 2FA (scan → verify → done) ─────────
const Sm2FASheet = ({ onClose, onActivated }) => {
  const T = SM_useMT();
  const [step, setStep] = React.useState("scan"); // scan · verify · done
  const [code, setCode] = React.useState("");
  const SECRET = "MEGG A4F2 9KZ1 7QXP";
  const valid = code.length === 6;

  const ghostBtn = {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
    background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
  };
  const blackBtn = (enabled = true) => ({
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? T.accent : T.ghost, color: enabled ? T.accentInk : (T.card),
    fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: enabled ? T.shadowSm : "none", transition: "background .2s, color .2s",
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes sm2faUp { from { transform: translateY(100%); } to { transform: none; } } @keyframes sm2faStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderRadius: "28px 28px 0 0",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.25)", padding: "10px 20px 32px",
        animation: "sm2faUp .42s cubic-bezier(.2,.8,.2,1) both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair, margin: "0 auto 16px" }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: step === "done" ? T.goal : T.cardSubtle, display: "grid", placeItems: "center", transition: "background .25s" }}>
            <SmGlyph name={step === "done" ? "check" : "shield"} size={21} color={step === "done" ? "#fff" : T.ink} sw={1.9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Double authentification</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45 }}>
              {step === "scan" && "Étape 1 sur 2 — scannez le QR code dans votre application."}
              {step === "verify" && "Étape 2 sur 2 — saisissez le code à 6 chiffres."}
              {step === "done" && "Votre compte est protégé."}
            </p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <SmGlyph name="close" size={17} color={T.muted} sw={2.2} />
          </button>
        </div>

        {/* SCAN */}
        {step === "scan" && (
          <div style={{ animation: "sm2faStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ padding: 14, background: "#fff", borderRadius: 20, boxShadow: "0 8px 24px rgba(15,23,42,0.12), inset 0 0 0 1px rgba(15,23,42,0.06)" }}>
                <Sm2FA_QR size={156} />
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: T.muted, marginBottom: 7 }}>Saisie manuelle</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderRadius: 13, background: T.cardSubtle }}>
                <span style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14.5, fontWeight: 700, letterSpacing: 1, color: T.ink }}>{SECRET}</span>
                <SmGlyph name="copy" size={16} color={T.muted} sw={1.9} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <button onClick={onClose} style={ghostBtn}>Annuler</button>
              <button onClick={() => setStep("verify")} style={blackBtn(true)}>
                J'ai scanné <SmGlyph name="arrow-right" size={16} color={T.accentInk} sw={2.2} />
              </button>
            </div>
          </div>
        )}

        {/* VERIFY */}
        {step === "verify" && (
          <div style={{ animation: "sm2faStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <Sm2FA_Code value={code} onChange={setCode} />
            <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 12, fontWeight: 600, color: T.muted, lineHeight: 1.5 }}>
              Le code change toutes les 30 secondes. Saisissez celui affiché actuellement.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <button onClick={() => { setCode(""); setStep("scan"); }} style={ghostBtn}>Retour</button>
              <button onClick={() => { if (valid) setStep("done"); }} disabled={!valid} style={blackBtn(valid)}>
                Vérifier <SmGlyph name="check" size={16} color={valid ? T.accentInk : T.card} sw={2.3} />
              </button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div style={{ animation: "sm2faStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 16px", borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <SmGlyph name="shield" size={20} color={T.ink} sw={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink }}>Application d'authentification</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Configurée à l'instant · facteur principal</div>
              </div>
            </div>
            <button onClick={() => { onActivated(); onClose(); }} style={{ ...blackBtn(true), width: "100%", flex: "none", marginTop: 22 }}>Terminé</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Force d'un mot de passe (0–4) ──────────────────────────────────────
const smPwdScore = (s) => {
  if (!s) return 0;
  let n = 0;
  if (s.length >= 8) n++;
  if (s.length >= 12) n++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (/[^A-Za-z0-9]/.test(s)) n++;
  return Math.min(n, 4);
};

// ─── Champ mot de passe avec œil ────────────────────────────────────────
const SmPwdField = ({ label, value, onChange, placeholder, autoFocus, tone, onEnter }) => {
  const T = SM_useMT();
  const [show, setShow] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  const ring = tone || (focus ? T.accent : null);
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      {label && <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: T.muted, marginBottom: 7 }}>{label}</div>}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, height: 46, padding: "0 6px 0 14px", borderRadius: 13,
        background: T.cardSubtle, boxShadow: ring ? `0 0 0 2px ${ring}` : `inset 0 0 0 1px ${T.hair}`, transition: "box-shadow .18s ease",
      }}>
        <input type={show ? "text" : "password"} value={value || ""} placeholder={placeholder || "••••••••••••"} autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
          style={{ flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14.5, fontWeight: 600, color: T.ink }} />
        <button type="button" onClick={() => setShow(v => !v)} style={{ width: 34, height: 34, borderRadius: 999, border: 0, cursor: "pointer", background: "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <SmGlyph name={show ? "eye" : "lock"} size={16} color={T.muted} sw={1.9} />
        </button>
      </div>
    </label>
  );
};

// ─── Jauge de robustesse ────────────────────────────────────────────────
const SmPwdMeter = ({ s }) => {
  const T = SM_useMT();
  const labels = ["Trop court", "Faible", "Correct", "Robuste", "Excellent"];
  const fg = s >= 3 ? T.goal : (s >= 2 ? "#C45A00" : "#E0533F");
  return (
    <div>
      <div style={{ display: "flex", gap: 5 }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i < s ? fg : T.hair, transition: "background .2s" }} />)}
      </div>
      <div style={{ marginTop: 7, fontSize: 11.5, fontWeight: 700, color: fg }}>{labels[s]}</div>
    </div>
  );
};

// ─── Feuille modale — Mot de passe (modifier · oublié) ──────────────────
const SmPasswordSheet = ({ onClose, onChanged }) => {
  const T = SM_useMT();
  // mode "change" : edit → done ; mode "forgot" : ask → sent → reset → done
  const [mode, setMode] = React.useState("change");
  const [step, setStep] = React.useState("edit");
  const [cur, setCur] = React.useState("");
  const [nw, setNw] = React.useState("");
  const [cf, setCf] = React.useState("");
  const [email, setEmail] = React.useState("gregory@megga.ch");
  const [busy, setBusy] = React.useState(false);

  const s = smPwdScore(nw);
  const match = nw.length > 0 && nw === cf;
  const ko = cf.length > 0 && nw !== cf;
  const canChange = cur.length > 0 && s >= 2 && match;
  const canReset = s >= 2 && match;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const run = (next) => { setBusy(true); setTimeout(() => { setBusy(false); setStep(next); }, 650); };

  const headers = {
    edit:  { title: "Mot de passe", sub: "Au moins 8 caractères, \navec chiffres et majuscules." },
    ask:   { title: "Mot de passe oublié", sub: "On vous envoie un lien sécurisé — pas besoin de l'ancien." },
    sent:  { title: "Lien envoyé", sub: "Vérifiez votre boîte mail." },
    reset: { title: "Nouveau mot de passe", sub: "Choisissez une clé robuste pour votre compte." },
    done:  { title: "C'est fait", sub: mode === "forgot" ? "Mot de passe réinitialisé." : "Mot de passe mis à jour." },
  }[step];

  const ghostBtn = {
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer",
    background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
  };
  const blackBtn = (enabled = true) => ({
    flex: 1, height: 50, borderRadius: 999, border: 0, cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? T.accent : T.ghost, color: enabled ? T.accentInk : T.card,
    fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: enabled ? T.shadowSm : "none", transition: "background .2s, color .2s",
  });
  const linkBtn = { border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.ink, textDecoration: "underline", textUnderlineOffset: 3 };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <style>{`@keyframes smPwdUp { from { transform: translateY(100%); } to { transform: none; } } @keyframes smPwdStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{
        position: "relative", background: T.card, borderRadius: "28px 28px 0 0",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.25)", padding: "10px 20px 32px",
        animation: "smPwdUp .42s cubic-bezier(.2,.8,.2,1) both", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: T.hair, margin: "0 auto 16px" }} />

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: step === "done" ? T.goal : T.cardSubtle, display: "grid", placeItems: "center", transition: "background .25s" }}>
            <SmGlyph name={step === "done" ? "check" : (step === "sent" ? "mail" : "lock")} size={20} color={step === "done" ? "#fff" : T.ink} sw={1.9} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>{headers.title}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: T.muted, lineHeight: 1.45, whiteSpace: "pre-line" }}>{headers.sub}</p>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <SmGlyph name="close" size={17} color={T.muted} sw={2.2} />
          </button>
        </div>

        {/* EDIT — changer en connaissant l'actuel */}
        {step === "edit" && (
          <div style={{ animation: "smPwdStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <SmPwdField label="Mot de passe actuel" value={cur} onChange={setCur} />
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button onClick={() => { setMode("forgot"); setStep("ask"); }} style={linkBtn}>J'ai oublié mon mot de passe</button>
              </div>
            </div>
            <div>
              <SmPwdField label="Nouveau mot de passe" value={nw} onChange={setNw} placeholder="Nouvelle clé" />
              {nw && <div style={{ marginTop: 11 }}><SmPwdMeter s={s} /></div>}
            </div>
            <div>
              <SmPwdField label="Confirmer le nouveau mot de passe" value={cf} onChange={setCf} placeholder="Répétez la clé" tone={ko ? "#E0533F" : (match ? T.goal : null)} onEnter={() => canChange && run("done")} />
              {(match || ko) && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 11.5, fontWeight: 700, color: match ? T.goal : "#E0533F" }}>
                  <SmGlyph name={match ? "check" : "close"} size={13} color={match ? T.goal : "#E0533F"} sw={2.4} />
                  {match ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={onClose} style={ghostBtn}>Annuler</button>
              <button onClick={() => canChange && run("done")} disabled={!canChange || busy} style={blackBtn(canChange && !busy)}>
                {busy ? "…" : <>Mettre à jour <SmGlyph name="check" size={16} color={canChange ? T.accentInk : T.card} sw={2.3} /></>}
              </button>
            </div>
          </div>
        )}

        {/* ASK — saisie de l'email */}
        {step === "ask" && (
          <div style={{ animation: "smPwdStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 16 }}>
            <SmInput label="Adresse e-mail" type="email" value={email} onChange={setEmail} placeholder="vous@agence.ch" />
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 13, borderRadius: 13, background: T.cardSubtle }}>
              <SmGlyph name="info" size={15} color={T.muted} sw={2} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, lineHeight: 1.5 }}>Le lien est valable 30 minutes et ne peut servir qu'une fois.</div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
              <button onClick={() => { setMode("change"); setStep("edit"); }} style={ghostBtn}>Retour</button>
              <button onClick={() => emailOk && run("sent")} disabled={!emailOk || busy} style={blackBtn(emailOk && !busy)}>
                {busy ? "…" : <>Envoyer le lien <SmGlyph name="arrow-right" size={16} color={emailOk ? T.accentInk : T.card} sw={2.2} /></>}
              </button>
            </div>
          </div>
        )}

        {/* SENT — confirmation d'envoi */}
        {step === "sent" && (
          <div style={{ animation: "smPwdStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 16, borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <SmGlyph name="clock" size={20} color={T.ink} sw={1.9} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Lien envoyé · expire dans 30 min</div>
              </div>
            </div>
            <div style={{ marginTop: 16, textAlign: "center", fontSize: 11.5, fontWeight: 600, color: T.muted }}>
              Pas reçu ? <button onClick={() => setStep("reset")} style={linkBtn}>Simuler le clic sur le lien (démo)</button>
            </div>
            <button onClick={onClose} style={{ ...blackBtn(true), width: "100%", flex: "none", marginTop: 22 }}>Fermer</button>
          </div>
        )}

        {/* RESET — nouveau mot de passe depuis le lien */}
        {step === "reset" && (
          <div style={{ animation: "smPwdStep .35s cubic-bezier(.2,.8,.2,1) both", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <SmPwdField label="Nouveau mot de passe" value={nw} onChange={setNw} placeholder="Nouvelle clé" />
              {nw && <div style={{ marginTop: 11 }}><SmPwdMeter s={s} /></div>}
            </div>
            <div>
              <SmPwdField label="Confirmer le mot de passe" value={cf} onChange={setCf} placeholder="Répétez la clé" tone={ko ? "#E0533F" : (match ? T.goal : null)} onEnter={() => canReset && run("done")} />
              {(match || ko) && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 11.5, fontWeight: 700, color: match ? T.goal : "#E0533F" }}>
                  <SmGlyph name={match ? "check" : "close"} size={13} color={match ? T.goal : "#E0533F"} sw={2.4} />
                  {match ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                </div>
              )}
            </div>
            <button onClick={() => canReset && run("done")} disabled={!canReset || busy} style={{ ...blackBtn(canReset && !busy), width: "100%", flex: "none", marginTop: 8 }}>
              {busy ? "…" : <>Réinitialiser le mot de passe <SmGlyph name="check" size={16} color={canReset ? T.accentInk : T.card} sw={2.3} /></>}
            </button>
          </div>
        )}

        {/* DONE — succès */}
        {step === "done" && (
          <div style={{ animation: "smPwdStep .35s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 16, borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <SmGlyph name="shield" size={20} color={T.ink} sw={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, color: T.ink }}>{mode === "forgot" ? "Mot de passe réinitialisé" : "Mot de passe mis à jour"}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2 }}>Vos autres sessions ont été déconnectées.</div>
              </div>
            </div>
            <button onClick={() => { onChanged && onChanged(); onClose(); }} style={{ ...blackBtn(true), width: "100%", flex: "none", marginTop: 22 }}>Terminé</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  6 · SÉCURITÉ
// ═══════════════════════════════════════════════════════════════════════
const SettingsSectionSecurite = ({ onBack }) => {
  const T = SM_useMT();
  const [twoFA, setTwoFA] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [pwdSheet, setPwdSheet] = React.useState(false);
  const [pwdAt, setPwdAt] = React.useState("Modifié il y a 3 mois");
  const score = twoFA ? 100 : 78;
  const SESS = [
    { id: 1, icon: "smartphone", title: "iPhone 15 Pro", sub: "Genève · maintenant", current: true },
    { id: 2, icon: "laptop", title: "MacBook Pro", sub: "Genève · il y a 2 h" },
  ];
  const toggle2FA = (v) => {
    if (v) setSheet(true);   // activation passe par la feuille de configuration
    else setTwoFA(false);    // désactivation immédiate
  };
  return (
   <React.Fragment>
    <SmSection title="Sécurité" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SmCard pad={22}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <SmRing value={score} size={76} sw={8} showLabel={false} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: T.muted }}>Niveau de sécurité</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: T.ink, lineHeight: 1 }}>{twoFA ? "Excellent" : "Bon"}</div>
              <div style={{ display: "inline-flex" }}>
                <SmStatus tone={twoFA ? "ok" : "warn"}>{twoFA ? "Compte protégé" : "1 action recommandée"}</SmStatus>
              </div>
            </div>
          </div>
        </SmCard>

        <SmCard pad={0}>
          <div style={{ padding: "8px 2px 2px" }}>
            <SmRow icon="shield" title="Double authentification" sub={twoFA ? "Activée" : "Recommandée"} right={<SmToggle on={twoFA} onChange={toggle2FA} />} />
            <SmRow icon="lock" title="Mot de passe" sub={pwdAt} right={<SmGlyph name="chevron-right" size={18} color={T.ghost} sw={2} />} onClick={() => setPwdSheet(true)} last />
          </div>
        </SmCard>

        <div>
          <SmLabel>Appareils & sessions</SmLabel>
          <SmCard pad={0}>
            <div style={{ padding: "8px 2px 2px" }}>
              {SESS.map((se, i) => (
                <SmRow key={se.id} icon={se.icon} title={se.title} sub={se.sub} last={i === SESS.length - 1}
                  right={se.current ? <SmStatus tone="ok">Cet appareil</SmStatus> : <span style={{ fontSize: 12.5, fontWeight: 800, color: "#E0533F" }}>Déconnecter</span>} />
              ))}
            </div>
          </SmCard>
        </div>
      </div>
    </SmSection>
    {sheet && <Sm2FASheet onClose={() => setSheet(false)} onActivated={() => setTwoFA(true)} />}
    {pwdSheet && <SmPasswordSheet onClose={() => setPwdSheet(false)} onChanged={() => setPwdAt("Modifié à l'instant")} />}
   </React.Fragment>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  7 · PRÉFÉRENCES
// ═══════════════════════════════════════════════════════════════════════
const SettingsSectionPreferences = ({ onBack, dark, setDark, lang, setLang }) => {
  const T = SM_useMT();
  const [currency, setCurrency] = React.useState("chf");
  const [density, setDensity] = React.useState("comfort");
  const [assist, setAssist] = React.useState({ spell: true, autosave: true });
  const row = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
  return (
    <SmSection title="Préférences" onBack={onBack}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SmCard title="Région & langue" pad={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={row}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Langue</span>
              <SmSegment value={lang} onChange={setLang} options={[{ id: "fr", label: "FR" }, { id: "de", label: "DE" }, { id: "en", label: "EN" }]} />
            </div>
            <div style={{ height: 1, background: T.hair }} />
            <div style={row}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Devise</span>
              <SmSegment value={currency} onChange={setCurrency} options={[{ id: "chf", label: "CHF" }, { id: "eur", label: "EUR" }]} />
            </div>
          </div>
        </SmCard>

        <SmCard title="Apparence" pad={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={row}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Thème</span>
              <SmSegment value={dark ? "dark" : "light"} onChange={v => setDark(v === "dark")} options={[{ id: "light", label: "Clair", icon: "sun" }, { id: "dark", label: "Sombre", icon: "moon" }]} />
            </div>
            <div style={{ height: 1, background: T.hair }} />
            <div style={row}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Densité</span>
              <SmSegment value={density} onChange={setDensity} options={[{ id: "comfort", label: "Confort" }, { id: "compact", label: "Compact" }]} />
            </div>
          </div>
        </SmCard>

        <SmCard pad={0}>
          <div style={{ padding: "8px 2px 2px" }}>
            <SmRow icon="check-circle" title="Vérification orthographique" right={<SmToggle on={assist.spell} onChange={v => setAssist(p => ({ ...p, spell: v }))} />} />
            <SmRow icon="save" title="Sauvegarde automatique" right={<SmToggle on={assist.autosave} onChange={v => setAssist(p => ({ ...p, autosave: v }))} />} last />
          </div>
        </SmCard>
      </div>
    </SmSection>
  );
};

Object.assign(window, {
  SmGlyph, SmHeader, SmCard, SmLabel, SmInput, SmTextarea, SmToggle, SmSegment, SmRow, SmBlackBtn, SmStatus, SmRing, SmSection,
  SM_PROFILE_DEFAULT, SM_PROFILE_FIELDS, smProfileCompletion,
  SettingsSectionProfil, SettingsSectionAgence, SettingsSectionNotifications, SettingsSectionIntegrations,
  SettingsSectionFacturation, SettingsSectionSecurite, SettingsSectionPreferences,
  SM_GoogleG, SM_MsLogo,
});
