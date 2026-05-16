// MEGGA CRM — Wizard "Créer un bien" — REFONTE Sugar v2
// Direction artistique : Sugar CRM pure conformité.
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres 40px/5%, coins 24px, AUCUNE bordure
// — Accent unique = NOIR PUR (pas de bleu, pas de violet, pas de gradient)
// — Typo : noir #000 franc, jamais de gris pour les titres
// — Beaucoup d'air, peu d'éléments, hiérarchie par l'ombre et l'espace

// ─── PALETTE Sugar ────────────────────────────────────────────────────
const SugarV2 = {
  // Fond — radial doux du clair vers bleu-gris pâle
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",

  // Surfaces
  card: "#FFFFFF",
  cardSubtle: "#F7F8FA",        // pour zones imbriquées
  rail: "#FFFFFF",              // rail icon
  railHover: "#F0F2F6",

  // Accent unique
  black: "#0B0C0E",             // noir Sugar (légèrement adouci)
  blackHover: "#1F2024",

  // Texte
  ink: "#0B0C0E",               // titres, h1, h2 — NOIR FRANC
  inkSoft: "#3A3D44",           // texte courant
  muted: "#7A8088",             // labels secondaires
  ghost: "#B5BAC2",             // placeholder, désactivé

  // Ombres signature Sugar
  shadowSm: "0 4px 16px rgba(15, 23, 42, 0.04)",
  shadow:   "0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)",
  shadowLg: "0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)",
  shadowHover: "0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)",

  // États (utilitaires uniquement, jamais décoratifs)
  ok:   "#10B981",
  warn: "#F59E0B",
  err:  "#EF4444",

  // Avatars / pastilles d'équipe (Sugar adopte du fluo)
  pop1: "#3B82F6",
  pop2: "#EF4444",
  pop3: "#FBBF24",
  pop4: "#10B981",
};

// ─── PRIMITIVES ───────────────────────────────────────────────────────

// Bouton circulaire gris (style Sugar topbar)
const SgCircleBtn = ({ icon, onClick, size = 44, badge, title }) => (
  <button onClick={onClick} title={title} style={{
    width: size, height: size, borderRadius: 999, border: 0,
    background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
    cursor: "pointer", display:"grid", placeItems:"center",
    position:"relative", transition:"all .18s ease",
    boxShadow: SugarV2.shadowSm,
  }}
  onMouseEnter={e => { e.currentTarget.style.background = SugarV2.card; e.currentTarget.style.boxShadow = SugarV2.shadow; }}
  onMouseLeave={e => { e.currentTarget.style.background = SugarV2.cardSubtle; e.currentTarget.style.boxShadow = SugarV2.shadowSm; }}
  >
    {icon}
    {badge && <span style={{
      position:"absolute", top: 8, right: 8,
      width: 8, height: 8, borderRadius: 999, background: SugarV2.err,
      boxShadow: `0 0 0 2px ${SugarV2.cardSubtle}`,
    }} />}
  </button>
);

// Pilule noire (CTA principal)
const SgBlackPill = ({ children, onClick, disabled, icon, size = "lg" }) => {
  const [hover, setHover] = React.useState(false);
  const h = size === "lg" ? 50 : 40;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === "lg" ? "0 28px" : "0 20px",
        borderRadius: 999, border: 0,
        background: disabled ? SugarV2.ghost : (hover ? SugarV2.blackHover : SugarV2.black),
        color: "#fff",
        fontFamily:"inherit", fontSize: size === "lg" ? 14.5 : 13, fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? "not-allowed" : "pointer",
        display:"inline-flex", alignItems:"center", gap: 10,
        boxShadow: disabled ? "none" : (hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)"),
        transition:"all .18s ease",
        transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
      }}>
      {children}
      {icon}
    </button>
  );
};

// Pilule fantôme
const SgGhostPill = ({ children, onClick, icon }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 50, padding:"0 24px", borderRadius: 999,
        border: 0, background: hover ? SugarV2.card : "transparent",
        color: SugarV2.inkSoft, fontFamily:"inherit",
        fontSize: 14, fontWeight: 600, cursor:"pointer",
        display:"inline-flex", alignItems:"center", gap: 8,
        boxShadow: hover ? SugarV2.shadow : "none",
        transition:"all .18s ease",
      }}>
      {icon}
      {children}
    </button>
  );
};

// Stepper Sugar — 8 cercles connectés
const SgStepper = ({ steps, current, onJump }) => (
  <div style={{ display:"flex", alignItems:"center", gap: 0 }}>
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      const reachable = i <= current;
      return (
        <React.Fragment key={s.id}>
          <button onClick={() => reachable && onJump?.(i)} title={s.label}
            style={{
              width: 32, height: 32, borderRadius: 999, border: 0,
              background: active ? SugarV2.black : (done ? SugarV2.inkSoft : SugarV2.card),
              color: (active || done) ? "#fff" : SugarV2.muted,
              fontFamily:"inherit", fontSize: 12, fontWeight: 700,
              cursor: reachable ? "pointer" : "default",
              display:"grid", placeItems:"center",
              boxShadow: active
                ? "0 6px 16px rgba(11,12,14,0.25), 0 0 0 4px rgba(11,12,14,0.06)"
                : (done ? SugarV2.shadowSm : SugarV2.shadowSm),
              transition:"all .2s ease",
              flexShrink: 0,
            }}>
            {done ? "✓" : i + 1}
          </button>
          {i < steps.length - 1 && (
            <div style={{
              width: 28, height: 2, flexShrink: 0,
              background: i < current ? SugarV2.inkSoft : "rgba(11,12,14,0.08)",
              transition:"background .3s ease",
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// Carte porte (Step 0) — Sugar spec : blanche, ombre, pas de bordure
const SgGateCard = ({ icon, title, sub, onClick, recommended, disabled, accent = "default" }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position:"relative",
        width:"100%", height: "100%",
        padding: "32px 28px 28px",
        background: SugarV2.card,
        border: 0, borderRadius: 28,
        textAlign:"left", fontFamily:"inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: hover ? SugarV2.shadowHover : SugarV2.shadow,
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        transition:"all .25s cubic-bezier(.2,.8,.2,1)",
        display:"flex", flexDirection:"column", gap: 14,
      }}>
      {recommended && (
        <span style={{
          position:"absolute", top: 18, right: 18,
          padding:"5px 11px", borderRadius: 999,
          background: SugarV2.black, color:"#fff",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          textTransform:"uppercase",
        }}>Recommandé</span>
      )}

      {/* Icône — cercle gris clair, contenu en noir pur */}
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: SugarV2.cardSubtle, color: SugarV2.black,
        display:"grid", placeItems:"center",
        flexShrink: 0,
      }}>{icon}</div>

      <div>
        <h3 style={{
          margin:"0 0 6px", fontSize: 19, fontWeight: 700,
          color: SugarV2.ink, letterSpacing:-0.3, lineHeight: 1.25,
        }}>{title}</h3>
        <p style={{
          margin: 0, fontSize: 13.5, color: SugarV2.inkSoft,
          fontWeight: 500, lineHeight: 1.55,
        }}>{sub}</p>
      </div>

      {/* Flèche d'invitation, apparaît en hover */}
      <div style={{
        marginTop:"auto", paddingTop: 10,
        display:"flex", alignItems:"center", gap: 8,
        color: hover ? SugarV2.black : SugarV2.muted,
        fontSize: 13, fontWeight: 600,
        transition:"color .2s",
      }}>
        Choisir
        <span style={{
          display:"inline-flex", transform: hover ? "translateX(4px)" : "translateX(0)",
          transition:"transform .25s ease",
        }}>→</span>
      </div>
    </button>
  );
};

// Icônes minimales pour le wizard (style Sugar — line, simples)
const SgIcon = ({ name, size = 22, stroke = "currentColor", sw = 1.6 }) => {
  const p = {
    upload:   <><path d="M12 16V4M12 4l-5 5M12 4l5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></>,
    inbox:    <><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M3 13l3-7a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l3 7"/><path d="M3 13h5l1 2h6l1-2h5"/></>,
    edit:     <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></>,
    arrowL:   <><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>,
    arrowR:   <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
    close:    <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell:     <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    moon:     <><path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z"/></>,
    check:    <><path d="m5 13 4 4 10-12"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>
  );
};

// ─── STEP 0 — DÉMARRAGE (refonte Sugar pure) ──────────────────────────

// Card "Reprendre une soumission" — liste cliquable interne
const SgSubmissionsCard = ({ subs, data, set }) => {
  const SP = SugarV2;
  const [hover, setHover] = React.useState(null);
  const allContacts = window.CRM_CONTACTS || [];

  if (subs.length === 0) {
    return (
      <div style={{
        background: SP.card, borderRadius: 28, padding: 28,
        boxShadow: SP.shadow, opacity: 0.55, cursor:"not-allowed",
        flex: 1, display:"flex", flexDirection:"column", gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: SP.cardSubtle,
          display:"grid", placeItems:"center",
        }}>
          <SgIcon name="inbox" size={26} stroke={SP.muted} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: SP.muted, letterSpacing:-0.3 }}>
          Aucune soumission
        </div>
        <div style={{ fontSize: 13, color: SP.muted, fontWeight: 500, lineHeight: 1.5 }}>
          Aucun particulier n'a soumis de bien pour le moment.
        </div>
      </div>
    );
  }

  const selectSubmission = (sub) => {
    // Auto-câbler le propriétaire
    let ownerId = null;
    let newContact = null;
    if (sub.contactId) {
      ownerId = sub.contactId;
    } else if (sub.contactDraft) {
      // Créer un contact à la volée
      const id = `c-from-${sub.id}`;
      newContact = {
        id, type:"seller",
        ...sub.contactDraft,
        kyc: { status:"none" }, status:"qualified",
        avatarBg: sub.accent || "#0041D9",
      };
      ownerId = id;
    }
    set({
      source: "submission",
      fromSubmissionId: sub.id,
      ownerContactId: ownerId,
      _newContact: newContact,
      // pré-remplir aussi quelques champs du bien
      type: sub.type, transaction: sub.transaction,
      addr: sub.addr, canton: sub.canton,
      area: sub.area, rooms: sub.rooms, bedrooms: sub.beds, bathrooms: sub.baths,
      year: sub.year, energy: sub.energy,
      features: sub.features, description: sub.desc,
      price: sub.askingPrice,
    });
  };

  const isSelected = data.source === "submission";

  return (
    <div style={{
      background: isSelected ? SP.black : SP.card, color: isSelected ? "#fff" : SP.ink,
      borderRadius: 28, padding: 22,
      boxShadow: isSelected
        ? "0 24px 60px rgba(11,12,14,0.30), 0 4px 16px rgba(11,12,14,0.15)"
        : SP.shadow,
      flex: 1, display:"flex", flexDirection:"column", gap: 14,
      transition:"all .25s cubic-bezier(.2,.8,.2,1)",
      transform: isSelected ? "translateY(-3px)" : "translateY(0)",
    }}>
      {/* Header de la card */}
      <div style={{ display:"flex", alignItems:"flex-start", gap: 14, padding:"6px 6px 0" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: isSelected ? "rgba(255,255,255,0.10)" : SP.cardSubtle,
          display:"grid", placeItems:"center", flexShrink: 0,
        }}>
          <SgIcon name="inbox" size={26} stroke={isSelected ? "#fff" : SP.black} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing:-0.3, marginBottom: 2 }}>
            Reprendre une soumission
          </div>
          <div style={{
            fontSize: 12.5, fontWeight: 500, lineHeight: 1.45,
            color: isSelected ? "rgba(255,255,255,0.7)" : SP.inkSoft,
          }}>
            {subs.length} particuliers ont soumis leur bien. Sélectionnez-en un pour pré-remplir.
          </div>
        </div>
      </div>

      {/* Liste des soumissions */}
      <div style={{ display:"flex", flexDirection:"column", gap: 6, marginTop: 4 }}>
        {subs.map((sub) => {
          const sel = data.fromSubmissionId === sub.id;
          const contact = sub.contactId ? allContacts.find(c => c.id === sub.contactId) : null;
          const name = contact
            ? `${contact.firstName} ${contact.lastName}`
            : sub.contactDraft
              ? `${sub.contactDraft.firstName} ${sub.contactDraft.lastName}`
              : "Vendeur inconnu";
          const initials = name.split(" ").filter(Boolean).map(p => p[0]).join("").substring(0, 2).toUpperCase();

          return (
            <button key={sub.id}
              onClick={(e) => { e.stopPropagation(); selectSubmission(sub); }}
              onMouseEnter={() => setHover(sub.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                display:"flex", alignItems:"center", gap: 12,
                padding: "12px 14px", borderRadius: 14, border: 0,
                background: sel
                  ? (isSelected ? "rgba(255,255,255,0.16)" : SP.black)
                  : (hover === sub.id
                      ? (isSelected ? "rgba(255,255,255,0.08)" : SP.cardSubtle)
                      : (isSelected ? "rgba(255,255,255,0.04)" : "transparent")),
                color: sel
                  ? (isSelected ? "#fff" : "#fff")
                  : (isSelected ? "#fff" : SP.ink),
                fontFamily:"inherit", textAlign:"left", cursor:"pointer",
                transition:"all .18s ease",
              }}>
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: sub.accent || "#0041D9",
                color:"#fff", display:"grid", placeItems:"center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing:-0.2,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom: 1 }}>
                  {name}
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: sel
                    ? (isSelected ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.75)")
                    : (isSelected ? "rgba(255,255,255,0.55)" : SP.muted),
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>
                  {sub.title}
                </div>
              </div>
              {sel && (
                <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#fff" : "#fff" }}>✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SgStepStart = ({ data, set }) => {
  const subs = window.CRM_SUBMISSIONS || [];
  const subsCount = subs.length;

  return (
    <div style={{
      maxWidth: 1100, margin:"0 auto",
      animation:"sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
    }}>
      {/* Header de page */}
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform:"uppercase", marginBottom: 14,
        }}>Étape 1 sur 8 · Démarrer</div>
        <h1 style={{
          margin:"0 0 14px", fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing:-0.8, lineHeight: 1.1,
        }}>
          Comment souhaitez-vous créer ce bien&nbsp;?
        </h1>
        <p style={{
          margin: 0, fontSize: 15, color: SugarV2.inkSoft,
          fontWeight: 500, lineHeight: 1.55,
        }}>
          Trois manières d'aller vite. Le contenu sera ensuite affiné étape par étape.
        </p>
      </div>

      {/* 3 portes — asymétriques : la recommandée à gauche prend plus d'espace */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1.15fr 1fr 1.4fr",
        gap: 22,
      }}>
        <div onMouseEnter={() => {}} style={{ display:"flex" }}>
          <SgGateCard
            recommended
            icon={<SgIcon name="edit" size={26} stroke={SugarV2.black} />}
            title="Saisir manuellement"
            sub="Vous remplissez chaque section. Idéal quand vous connaissez le bien et avez les éléments en main."
            onClick={() => set({ source: "manual", fromSubmissionId: null, ownerContactId: null })} />
        </div>
        <div style={{ display:"flex" }}>
          <SgGateCard
            icon={<SgIcon name="upload" size={26} stroke={SugarV2.black} />}
            title="Importer un mandat"
            sub="PDF de mandat. MEGGA AI extrait les infos pour pré-remplir."
            onClick={() => set({ source: "import", fromSubmissionId: null, ownerContactId: null })} />
        </div>
        <div style={{ display:"flex" }}>
          <SgSubmissionsCard subs={subs} data={data} set={set} />
        </div>
      </div>

      {/* Note discrète en bas */}
      <div style={{
        marginTop: 56, padding: "20px 24px",
        background: "transparent",
        display:"flex", alignItems:"center", gap: 14,
        color: SugarV2.muted, fontSize: 13, fontWeight: 500,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: SugarV2.cardSubtle,
          display:"grid", placeItems:"center", flexShrink: 0,
        }}>
          <SgIcon name="check" size={16} stroke={SugarV2.inkSoft} />
        </div>
        <div>
          <div style={{ color: SugarV2.ink, fontWeight: 600, marginBottom: 2 }}>
            Brouillon sauvegardé automatiquement
          </div>
          Vous pouvez fermer le wizard à tout moment, vos données restent.
        </div>
      </div>
    </div>
  );
};

// ─── SHELL (Sugar v2) ─────────────────────────────────────────────────
const SG_STEPS = [
  { id:"start",    label:"Démarrer" },
  { id:"mandate",  label:"Vendeur" },
  { id:"address",  label:"Adresse" },
  { id:"specs",    label:"Caractéristiques" },
  { id:"photos",   label:"Photos" },
  { id:"desc",     label:"Description" },
  { id:"options",  label:"Options" },
  { id:"publish",  label:"Publication" },
];

const CRMWizardSugarV2 = ({ onClose }) => {
  const [step, setStep] = React.useState(0);
  const [subStep, setSubStep] = React.useState(0); // pour step 1 (Vendeur 0 / Mandat 1)
  const [published, setPublished] = React.useState(false);
  const [data, setDataRaw] = React.useState(window.WZ_EMPTY || {
    source: null, fromSubmissionId: null, importUrl: "", importFile: null,
    ownerContactId: null, mandate: { type: "exclusive", duration: 6, commission: 3.5, signed: false, fees: "owner" },
    addr: "", canton: "Vaud", postCode: "", country: "Suisse",
    type: "appartement", area: null, rooms: null, bedrooms: null, bathrooms: null,
    year: null, energy: null, features: [],
    photos: [], description: "", aiAssist: false,
    transaction: "vente", price: null, rent: null, charges: null,
    options: { virtualStagingUser: false, virtualStagingAgent: [], featured: false, videoTour: false },
    visibility: "public", publishMode: "now",
  });
  const set = (patch) => setDataRaw(prev => ({ ...prev, ...patch }));

  const canNext = (() => {
    if (step === 0) {
      if (!data.source) return false;
      if (data.source === "submission" && !data.fromSubmissionId) return false;
      // Pour "import", on saute directement au step 1b (Mandat) avec dropzone
      return true;
    }
    if (step === 1 && subStep === 0) {
      // Vendeur : il faut un contact lié
      return !!data.ownerContactId;
    }
    if (step === 1 && subStep === 1) {
      return !!(data.mandate && data.mandate.type);
    }
    return true;
  })();

  const next = () => {
    // Court-circuit : depuis le step 0 avec source="import", on saute direct au step Mandat
    if (step === 0 && data.source === "import") {
      setStep(1); setSubStep(1);
      return;
    }
    // Court-circuit : depuis une soumission avec owner déjà câblé, on saute aussi à Mandat
    if (step === 0 && data.source === "submission" && data.ownerContactId) {
      setStep(1); setSubStep(1);
      return;
    }
    if (step === 1 && subStep === 0) { setSubStep(1); return; }
    setSubStep(0);
    setStep(s => Math.min(s + 1, SG_STEPS.length - 1));
  };
  const prev = () => {
    if (step === 1 && subStep === 1) {
      // Si on est arrivé via import OU soumission, on retourne au step 0
      if (data.source === "import" || data.source === "submission") {
        setStep(0); setSubStep(0); return;
      }
      setSubStep(0); return;
    }
    setSubStep(0);
    setStep(s => Math.max(s - 1, 0));
  };

  // Label en haut (avec sous-étape pour Vendeur)
  const headerLabel = published
    ? "Publication"
    : (step === 1)
    ? (subStep === 0 ? "Vendeur" : "Mandat")
    : SG_STEPS[step].label;

  return (
    <div style={{
      position:"fixed", inset: 0, zIndex: 9000,
      background: SugarV2.bgGradient,
      fontFamily:"Manrope, system-ui, sans-serif", color: SugarV2.ink,
      display:"flex", flexDirection:"column",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sgScaleIn {
          from { opacity: 0; transform: scale(.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── TOP BAR — Sugar style : minimal, blanc transparent, cercles tactiles ── */}
      <header style={{
        flexShrink: 0,
        padding: "20px 32px",
        display:"flex", alignItems:"center", gap: 18,
        position:"relative", zIndex: 10,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: 16, flexShrink: 0 }}>
          <img src="assets/megga-logo.svg" alt="MEGGA"
            style={{ height: 38, width:"auto", display:"block", flexShrink: 0 }} />
          <div style={{
            width: 1, height: 28, background:"rgba(11,12,14,0.10)",
          }} />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform:"uppercase",
            }}>Nouveau bien</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: SugarV2.ink, letterSpacing:-0.3,
            }}>{headerLabel}</div>
          </div>
        </div>

        {/* Stepper centré (caché après publication) */}
        <div style={{ flex: 1, display:"flex", justifyContent:"center" }}>
          {!published && <SgStepper steps={SG_STEPS} current={step} onJump={setStep} />}
        </div>

        {/* Bouton Fermer (à droite) */}
        <SgCircleBtn
          icon={<SgIcon name="close" size={18} stroke={SugarV2.ink} />}
          onClick={onClose}
          title="Fermer"
        />
      </header>

      {/* ── BODY ── */}
      <main key={(published ? "success" : step + "-" + subStep)} style={{
        flex: 1, overflowY:"auto",
        padding: published ? "32px 32px 80px" : "40px 32px 140px",
        position:"relative", zIndex: 5,
      }}>
        {published ? (
          <window.SgStepSuccess data={data} onClose={onClose} onBackToCRM={onClose} />
        ) : (
          <>
            {step === 0 && <SgStepStart data={data} set={set} />}
            {step === 1 && subStep === 0 && <window.SgStepVendor data={data} set={set} />}
            {step === 1 && subStep === 1 && <window.SgStepMandate data={data} set={set} />}
            {step === 2 && <window.SgStepAddress data={data} set={set} />}
            {step === 3 && <window.SgStepSpecs data={data} set={set} />}
            {step === 4 && <window.SgStepPhotos data={data} set={set} />}
            {step === 5 && <window.SgStepPriceDesc data={data} set={set} />}
            {step === 6 && <window.SgStepOptions data={data} set={set} />}
            {step === 7 && <window.SgStepPublish data={data} set={set} onClose={onClose} />}
          </>
        )}
      </main>

      {/* ── FOOTER ACTIONS (caché après publication) ── */}
      {!published && <footer style={{
        position:"absolute", bottom: 0, left: 0, right: 0,
        padding:"24px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        gap: 16, zIndex: 20,
        background: "linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)",
        pointerEvents:"none",
      }}>
        <div style={{ pointerEvents:"auto", display:"flex", alignItems:"center", gap: 12 }}>
          {step > 0 && (
            <SgGhostPill onClick={prev}
              icon={<SgIcon name="arrowL" size={16} stroke={SugarV2.inkSoft} />}>
              Précédent
            </SgGhostPill>
          )}
        </div>

        <div style={{ pointerEvents:"auto", display:"flex", alignItems:"center", gap: 16 }}>
          <span style={{ fontSize: 13, color: SugarV2.muted, fontWeight: 500 }}>
            {step + 1} / {SG_STEPS.length}
          </span>
          {step < SG_STEPS.length - 1 ? (
            <SgBlackPill onClick={next} disabled={!canNext}
              icon={<SgIcon name="arrowR" size={16} stroke="#fff" />}>
              Continuer
            </SgBlackPill>
          ) : (
            <SgBlackPill onClick={() => setPublished(true)}>
              {data.publishMode === "schedule" ? "Programmer la publication"
                : data.publishMode === "draft" ? "Enregistrer en brouillon"
                : "Publier sur MEGGA"}
            </SgBlackPill>
          )}
        </div>
      </footer>}
    </div>
  );
};

// Exports
window.CRMWizardSugarV2 = CRMWizardSugarV2;
window.SugarV2Palette = SugarV2;
