// MEGGA CRM — Wizard "Nouveau dossier KYC" — Sugar Pure 3 étapes
// Direction artistique : copie conforme de crm-wizard-sugar-v2.jsx (Step 0).
// — 3 étapes : Démarrer / Contact / Niveau de vigilance
// — Surfaces blanches, accent noir #0B0C0E, ombres douces, AUCUNE bordure décorative
// — Stepper minimal 3 cercles connectés
//
// Prérequis : window.SugarV2Palette, window.CRM_CONTACTS, window.KYC_DOSSIERS

const KwSP = window.SugarV2Palette || {
  bg: "#EDEFF3",
  bgGradient: "radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)",
  card: "#FFFFFF", cardSubtle: "#F7F8FA",
  black: "#0B0C0E", blackHover: "#1F2024",
  ink: "#0B0C0E", inkSoft: "#3A3D44", muted: "#7A8088", ghost: "#B5BAC2",
  shadowSm: "0 4px 16px rgba(15,23,42,0.04)",
  shadow:   "0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)",
  shadowLg: "0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
  shadowHover: "0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)",
};

// ─── Icônes ────────────────────────────────────────────────────────────
const KwIcon = ({ name, size = 22, stroke = "currentColor", sw = 1.6 }) => {
  const p = {
    user:     <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    upload:   <><path d="M12 20V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    send:     <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    arrowL:   <><path d="M19 12H5M12 19l-7-7 7-7"/></>,
    arrowR:   <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    close:    <><path d="M18 6 6 18M6 6l12 12"/></>,
    search:   <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    check:    <><path d="m5 13 4 4 10-12"/></>,
    shield:   <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/></>,
    shieldStar: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m9 11 2 2 4-4"/></>,
    sparkle:  <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>
  );
};

// ─── Primitives Sugar Pure (préfixées Kw) ──────────────────────────────
const KwBlackPill = ({ children, onClick, disabled, icon, size = "lg" }) => {
  const [hover, setHover] = React.useState(false);
  const h = size === "lg" ? 50 : 40;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: h, padding: size === "lg" ? "0 28px" : "0 20px", borderRadius: 999, border: 0,
        background: disabled ? KwSP.ghost : (hover ? KwSP.blackHover : KwSP.black),
        color: "#fff", fontFamily: "inherit", fontSize: size === "lg" ? 14.5 : 13,
        fontWeight: 600, letterSpacing: 0.1, cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", gap: 10, whiteSpace: "nowrap",
        boxShadow: disabled ? "none" : (hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)"),
        transform: hover && !disabled ? "translateY(-1px)" : "translateY(0)",
        transition: "all .18s ease",
      }}>{children}{icon}</button>
  );
};

const KwGhostPill = ({ children, onClick, icon }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 50, padding: "0 24px", borderRadius: 999, border: 0,
        background: hover ? KwSP.card : "transparent",
        color: KwSP.inkSoft, fontFamily: "inherit",
        fontSize: 14, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        boxShadow: hover ? KwSP.shadow : "none",
        transition: "all .18s ease",
      }}>{icon}{children}</button>
  );
};

const KwCircleBtn = ({ icon, onClick, size = 44, title }) => (
  <button onClick={onClick} title={title} style={{
    width: size, height: size, borderRadius: 999, border: 0,
    background: KwSP.cardSubtle, color: KwSP.inkSoft, cursor: "pointer",
    display: "grid", placeItems: "center", boxShadow: KwSP.shadowSm,
    transition: "all .18s ease",
  }}
    onMouseEnter={e => { e.currentTarget.style.background = KwSP.card; e.currentTarget.style.boxShadow = KwSP.shadow; }}
    onMouseLeave={e => { e.currentTarget.style.background = KwSP.cardSubtle; e.currentTarget.style.boxShadow = KwSP.shadowSm; }}>
    {icon}
  </button>
);

// Stepper 3 cercles (calque de SgStepper du wizard v2)
const KwStepper = ({ steps, current, onJump }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
    {steps.map((s, i) => {
      const done = i < current;
      const active = i === current;
      const reachable = i <= current;
      return (
        <React.Fragment key={s.id}>
          <button onClick={() => reachable && onJump?.(i)} title={s.label}
            style={{
              width: 32, height: 32, borderRadius: 999, border: 0,
              background: active ? KwSP.black : (done ? KwSP.inkSoft : KwSP.card),
              color: (active || done) ? "#fff" : KwSP.muted,
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              cursor: reachable ? "pointer" : "default",
              display: "grid", placeItems: "center",
              boxShadow: active
                ? "0 6px 16px rgba(11,12,14,0.25), 0 0 0 4px rgba(11,12,14,0.06)"
                : KwSP.shadowSm,
              transition: "all .2s ease", flexShrink: 0,
            }}>
            {done ? "✓" : i + 1}
          </button>
          {i < steps.length - 1 && (
            <div style={{
              width: 36, height: 2, flexShrink: 0,
              background: i < current ? KwSP.inkSoft : "rgba(11,12,14,0.08)",
              transition: "background .3s ease",
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Carte porte (gate) — identique à SgGateCard du wizard v2 ──────────
const KwGateCard = ({ icon, title, sub, onClick, recommended, selected, disabled }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        width: "100%", height: "100%",
        padding: "32px 28px 28px",
        background: selected ? KwSP.black : KwSP.card,
        color: selected ? "#fff" : KwSP.ink,
        border: 0, borderRadius: 28,
        textAlign: "left", fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: selected
          ? "0 24px 60px rgba(11,12,14,0.30), 0 4px 16px rgba(11,12,14,0.15)"
          : (hover ? KwSP.shadowHover : KwSP.shadow),
        transform: (selected || hover) ? "translateY(-3px)" : "translateY(0)",
        transition: "all .25s cubic-bezier(.2,.8,.2,1)",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
      {recommended && (
        <span style={{
          position: "absolute", top: 18, right: 18,
          padding: "5px 11px", borderRadius: 999,
          background: selected ? "#fff" : KwSP.black,
          color: selected ? KwSP.ink : "#fff",
          fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
        }}>Recommandé</span>
      )}
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: selected ? "rgba(255,255,255,0.10)" : KwSP.cardSubtle,
        color: selected ? "#fff" : KwSP.black,
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>{icon}</div>
      <div>
        <h3 style={{
          margin: "0 0 6px", fontSize: 19, fontWeight: 700,
          color: selected ? "#fff" : KwSP.ink, letterSpacing: -0.3, lineHeight: 1.25,
        }}>{title}</h3>
        <p style={{
          margin: 0, fontSize: 13.5,
          color: selected ? "rgba(255,255,255,0.75)" : KwSP.inkSoft,
          fontWeight: 500, lineHeight: 1.55,
        }}>{sub}</p>
      </div>
      <div style={{
        marginTop: "auto", paddingTop: 10,
        display: "flex", alignItems: "center", gap: 8,
        color: selected ? "#fff" : (hover ? KwSP.black : KwSP.muted),
        fontSize: 13, fontWeight: 600,
        transition: "color .2s",
      }}>
        {selected ? "Sélectionné" : "Choisir"}
        <span style={{
          display: "inline-flex",
          transform: (hover || selected) ? "translateX(4px)" : "translateX(0)",
          transition: "transform .25s ease",
        }}>{selected ? "✓" : "→"}</span>
      </div>
    </button>
  );
};

// ─── STEP 0 — Démarrer ────────────────────────────────────────────────
const KwStepStart = ({ data, set }) => (
  <div style={{
    maxWidth: 1100, margin: "0 auto",
    animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
  }}>
    <div style={{ marginBottom: 48, maxWidth: 720 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: KwSP.muted,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
      }}>Étape 1 sur 3 · Démarrer</div>
      <h1 style={{
        margin: "0 0 14px", fontSize: 38, fontWeight: 700,
        color: KwSP.ink, letterSpacing: -0.8, lineHeight: 1.1,
      }}>Comment voulez-vous ouvrir ce dossier&nbsp;?</h1>
      <p style={{
        margin: 0, fontSize: 15, color: KwSP.inkSoft, fontWeight: 500, lineHeight: 1.55,
      }}>
        Trois chemins pour respecter l'obligation LBA. Le plus rapide reste de lier le dossier à un contact déjà connu de votre CRM.
      </p>
    </div>

    <div style={{
      display: "grid", gridTemplateColumns: "1.15fr 1fr 1fr", gap: 22,
    }}>
      <KwGateCard recommended
        selected={data.source === "existing"}
        icon={<KwIcon name="user" size={26} stroke={data.source === "existing" ? "#fff" : KwSP.black} />}
        title="Lier à un contact existant"
        sub="Le plus courant : vous sélectionnez un acheteur, vendeur ou locataire déjà présent dans le CRM."
        onClick={() => set({ source: "existing" })} />
      <KwGateCard
        selected={data.source === "import"}
        icon={<KwIcon name="upload" size={26} stroke={data.source === "import" ? "#fff" : KwSP.black} />}
        title="Importer un dossier externe"
        sub="PDF Persona, ComplyAdvantage, ou rapport agence partenaire. MEGGA AI parse les checks."
        onClick={() => set({ source: "import" })} />
      <KwGateCard
        selected={data.source === "magic"}
        icon={<KwIcon name="send" size={26} stroke={data.source === "magic" ? "#fff" : KwSP.black} />}
        title="Demander les pièces"
        sub="Lien magique envoyé au contact pour qu'il dépose lui-même ses justificatifs en toute sécurité."
        onClick={() => set({ source: "magic" })} />
    </div>

    <div style={{
      marginTop: 56, padding: "20px 24px",
      display: "flex", alignItems: "center", gap: 14,
      color: KwSP.muted, fontSize: 13, fontWeight: 500,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999, background: KwSP.cardSubtle,
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <KwIcon name="shield" size={16} stroke={KwSP.inkSoft} />
      </div>
      <div>
        <div style={{ color: KwSP.ink, fontWeight: 600, marginBottom: 2 }}>
          Cinq contrôles obligatoires
        </div>
        Identité · domicile · PEP · sanctions · source des fonds (LBA art. 3-7).
      </div>
    </div>
  </div>
);

// ─── STEP 1 — Contact picker ──────────────────────────────────────────
const KwStepContact = ({ data, set }) => {
  const contacts = window.CRM_CONTACTS || [];
  const existing = window.KYC_DOSSIERS || [];
  const [query, setQuery] = React.useState("");

  const filtered = contacts.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (c.firstName + " " + c.lastName + " " + c.email).toLowerCase().includes(q);
  });

  return (
    <div style={{
      maxWidth: 900, margin: "0 auto",
      animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
    }}>
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: KwSP.muted,
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
        }}>Étape 2 sur 3 · Contact</div>
        <h1 style={{
          margin: "0 0 14px", fontSize: 38, fontWeight: 700,
          color: KwSP.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>Pour quel contact&nbsp;?</h1>
        <p style={{
          margin: 0, fontSize: 15, color: KwSP.inkSoft, fontWeight: 500, lineHeight: 1.55,
        }}>
          Les contacts qui ont déjà un dossier KYC en cours apparaissent grisés — vous pouvez les rouvrir depuis la liste principale.
        </p>
      </div>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 22px", height: 56, background: KwSP.card,
        borderRadius: 999, marginBottom: 18,
        boxShadow: KwSP.shadow,
      }}>
        <KwIcon name="search" size={18} stroke={KwSP.muted} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un contact, un e-mail…"
          style={{
            flex: 1, border: 0, outline: "none", background: "transparent",
            fontFamily: "inherit", fontSize: 15, fontWeight: 500, color: KwSP.ink,
          }} />
      </div>

      {/* List */}
      <div style={{
        background: KwSP.card, borderRadius: 22, padding: 12,
        boxShadow: KwSP.shadow, maxHeight: 460, overflowY: "auto",
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: "40px 20px", textAlign: "center",
            color: KwSP.muted, fontSize: 13, fontWeight: 500,
          }}>Aucun contact ne correspond à cette recherche.</div>
        ) : (
          filtered.map(c => {
            const has = existing.find(k => k.contactId === c.id && k.status !== "none");
            const selected = data.contactId === c.id;
            const typeLabel = { buyer: "Acheteur", seller: "Vendeur", tenant: "Locataire", landlord: "Propriétaire", mixed: "Mixte" }[c.type] || c.type;

            return (
              <button key={c.id}
                onClick={() => set({ contactId: c.id })}
                disabled={!!has}
                style={{
                  display: "grid", gridTemplateColumns: "44px 1fr auto auto",
                  gap: 14, alignItems: "center", width: "100%",
                  padding: "12px 14px", borderRadius: 14, border: 0,
                  background: selected ? KwSP.black : "transparent",
                  color: selected ? "#fff" : KwSP.ink,
                  fontFamily: "inherit", textAlign: "left",
                  cursor: has ? "not-allowed" : "pointer",
                  opacity: has ? 0.55 : 1,
                  marginBottom: 4,
                  transition: "background .15s ease",
                }}
                onMouseEnter={e => {
                  if (has || selected) return;
                  e.currentTarget.style.background = KwSP.cardSubtle;
                }}
                onMouseLeave={e => {
                  if (has || selected) return;
                  e.currentTarget.style.background = "transparent";
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 999,
                  background: c.avatarBg || KwSP.black, color: "#fff",
                  display: "grid", placeItems: "center",
                  fontSize: 13, fontWeight: 700,
                }}>{(c.firstName[0] + c.lastName[0]).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, marginBottom: 2 }}>
                    {c.firstName} {c.lastName}
                  </div>
                  <div style={{
                    fontSize: 11.5, fontWeight: 500,
                    color: selected ? "rgba(255,255,255,0.7)" : KwSP.muted,
                  }}>
                    {typeLabel} · {c.email}
                  </div>
                </div>
                <span style={{
                  padding: "4px 10px", borderRadius: 999,
                  background: selected ? "rgba(255,255,255,0.10)" : KwSP.cardSubtle,
                  color: selected ? "#fff" : KwSP.inkSoft,
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
                }}>{c.type === "buyer" ? "Acheteur" : c.type === "seller" ? "Vendeur" : "Loc."}</span>
                {has ? (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, color: KwSP.muted,
                    padding: "4px 10px", borderRadius: 999,
                    background: KwSP.cardSubtle, letterSpacing: 0.2, whiteSpace: "nowrap",
                  }}>Dossier existant</span>
                ) : selected ? (
                  <span style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: "rgba(255,255,255,0.18)",
                    display: "grid", placeItems: "center",
                  }}>
                    <KwIcon name="check" size={14} stroke="#fff" sw={2.2} />
                  </span>
                ) : (
                  <span style={{ width: 28 }} />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── STEP 2 — Vigilance ───────────────────────────────────────────────
const KwStepVigilance = ({ data, set }) => (
  <div style={{
    maxWidth: 900, margin: "0 auto",
    animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
  }}>
    <div style={{ marginBottom: 36, maxWidth: 720 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: KwSP.muted,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
      }}>Étape 3 sur 3 · Vigilance</div>
      <h1 style={{
        margin: "0 0 14px", fontSize: 38, fontWeight: 700,
        color: KwSP.ink, letterSpacing: -0.8, lineHeight: 1.1,
      }}>Quel niveau de vigilance&nbsp;?</h1>
      <p style={{
        margin: 0, fontSize: 15, color: KwSP.inkSoft, fontWeight: 500, lineHeight: 1.55,
      }}>
        La vigilance renforcée est requise pour les transactions supérieures à CHF 100'000, les contacts PEP et les opérations internationales.
      </p>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
      <KwGateCard
        selected={data.vigilance === "standard"}
        icon={<KwIcon name="shield" size={26} stroke={data.vigilance === "standard" ? "#fff" : KwSP.black} />}
        title="Vigilance standard"
        sub="Cinq contrôles classiques · LBA art. 3-4. Suffit pour la majorité des transactions résidentielles courantes."
        onClick={() => set({ vigilance: "standard", riskLevel: "low" })} />
      <KwGateCard recommended={data._smartReco === "renforced"}
        selected={data.vigilance === "renforced"}
        icon={<KwIcon name="shieldStar" size={26} stroke={data.vigilance === "renforced" ? "#fff" : KwSP.black} />}
        title="Vigilance renforcée"
        sub="Contrôles approfondis sur l'origine des fonds, bénéficiaires effectifs et arrière-plan économique · LBA art. 6."
        onClick={() => set({ vigilance: "renforced", riskLevel: "medium" })} />
    </div>

    {data.contactId && (() => {
      const c = (window.CRM_CONTACTS || []).find(x => x.id === data.contactId);
      if (!c) return null;
      return (
        <div style={{
          marginTop: 32, padding: "20px 24px",
          background: KwSP.card, borderRadius: 22, boxShadow: KwSP.shadow,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 999, background: KwSP.cardSubtle,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <KwIcon name="sparkle" size={16} stroke={KwSP.inkSoft} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: KwSP.ink, fontWeight: 700, fontSize: 13.5, marginBottom: 2 }}>
              MEGGA AI recommande : <span style={{ color: KwSP.black }}>vigilance standard</span>
            </div>
            <div style={{ fontSize: 12, color: KwSP.muted, fontWeight: 500, lineHeight: 1.5 }}>
              {c.firstName} {c.lastName} · {c.type === "buyer" ? "acheteur" : c.type === "seller" ? "vendeur" : "locataire"} · profil sans indicateur de risque détecté.
            </div>
          </div>
        </div>
      );
    })()}
  </div>
);

// ─── STEP SUCCESS ─────────────────────────────────────────────────────
const KwStepSuccess = ({ data, onOpen, onClose }) => {
  const c = (window.CRM_CONTACTS || []).find(x => x.id === data.contactId);
  return (
    <div style={{
      maxWidth: 720, margin: "60px auto 0", textAlign: "center",
      animation: "sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both",
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 999, background: KwSP.black,
        display: "grid", placeItems: "center", margin: "0 auto 28px",
        boxShadow: "0 16px 40px rgba(11,12,14,0.25)",
      }}>
        <KwIcon name="check" size={36} stroke="#fff" sw={2.2} />
      </div>
      <div style={{
        fontSize: 12, fontWeight: 600, color: KwSP.muted,
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12,
      }}>Dossier ouvert</div>
      <h1 style={{
        margin: "0 0 14px", fontSize: 36, fontWeight: 700,
        color: KwSP.ink, letterSpacing: -0.7, lineHeight: 1.1,
      }}>{c ? `${c.firstName} ${c.lastName}` : "Dossier KYC"}</h1>
      <p style={{
        margin: "0 0 36px", fontSize: 15, color: KwSP.inkSoft, fontWeight: 500,
        lineHeight: 1.55, maxWidth: 520, marginLeft: "auto", marginRight: "auto",
      }}>
        Cinq contrôles sont en attente. Démarrez par téléverser les pièces d'identité ou envoyez la demande de pièces au contact.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <KwGhostPill onClick={onClose}>Fermer</KwGhostPill>
        <KwBlackPill onClick={onOpen}
          icon={<KwIcon name="arrowR" size={16} stroke="#fff" />}>
          Ouvrir le dossier
        </KwBlackPill>
      </div>
    </div>
  );
};

// ─── WIZARD SHELL ─────────────────────────────────────────────────────
const KW_STEPS = [
  { id: "start",     label: "Démarrer" },
  { id: "contact",   label: "Contact" },
  { id: "vigilance", label: "Vigilance" },
];

const CRMKycWizard = ({ onClose, onCreated, initialContactId }) => {
  const preset = !!initialContactId;
  const [step, setStep] = React.useState(preset ? 2 : 0);
  const [done, setDone] = React.useState(false);
  const [createdId, setCreatedId] = React.useState(null);
  const [data, setDataRaw] = React.useState({
    source: preset ? "existing" : null,
    contactId: initialContactId || null,
    vigilance: null,
    riskLevel: "low",
    _smartReco: "standard",
  });
  const set = (patch) => setDataRaw(p => ({ ...p, ...patch }));

  const canNext = (() => {
    if (step === 0) return !!data.source;
    if (step === 1) return !!data.contactId;
    if (step === 2) return !!data.vigilance;
    return true;
  })();

  const finish = () => {
    // Si un dossier "none" placeholder existe déjà pour ce contact, on le remplace
    if (window.KYC_DOSSIERS) {
      const idx = window.KYC_DOSSIERS.findIndex(k => k.contactId === data.contactId && k.status === "none");
      if (idx >= 0) window.KYC_DOSSIERS.splice(idx, 1);
    }
    const id = "kyc-new-" + Date.now();
    const newDossier = {
      id, contactId: data.contactId, agentId: "agt-1",
      status: "none", riskLevel: data.riskLevel || "low",
      vigilance: data.vigilance,
      createdAt: new Date().toISOString(), verifiedAt: null, expiresAt: null,
      checks: {
        id:        { status: "pending", at: null, by: null, note: "À téléverser" },
        address:   { status: "pending", at: null, by: null, note: "À téléverser" },
        pep:       { status: "pending", at: null, by: null, note: "Screening automatique à lancer" },
        sanctions: { status: "pending", at: null, by: null, note: "Screening automatique à lancer" },
        funds:     { status: data.vigilance === "renforced" ? "pending" : "pending", at: null, by: null,
          note: data.vigilance === "renforced" ? "Vigilance renforcée — attestation détaillée requise" : "À demander si transaction > CHF 100'000" },
      },
      documents: [],
    };
    if (window.KYC_DOSSIERS) {
      window.KYC_DOSSIERS.unshift(newDossier);
    }
    setCreatedId(id);
    setDone(true);
  };

  const next = () => {
    if (step === 2) { finish(); return; }
    setStep(s => Math.min(s + 1, KW_STEPS.length - 1));
  };
  const prev = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: KwSP.bgGradient,
      fontFamily: "Manrope, system-ui, sans-serif", color: KwSP.ink,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style>{`
        @keyframes sgFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        flexShrink: 0, padding: "20px 32px",
        display: "flex", alignItems: "center", gap: 18,
        position: "relative", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <img src="assets/megga-logo.svg" alt="MEGGA"
            style={{ height: 38, width: "auto", display: "block", flexShrink: 0 }}
            onError={e => { e.currentTarget.style.display = "none"; }} />
          <div style={{ width: 1, height: 28, background: "rgba(11,12,14,0.10)" }} />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: KwSP.muted,
              letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
            }}>Nouveau dossier KYC</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: KwSP.ink, letterSpacing: -0.3,
            }}>{done ? "Confirmation" : KW_STEPS[step].label}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {!done && <KwStepper steps={KW_STEPS} current={step} onJump={setStep} />}
        </div>

        <KwCircleBtn
          icon={<KwIcon name="close" size={18} stroke={KwSP.ink} />}
          onClick={onClose} title="Fermer" />
      </header>

      {/* BODY */}
      <main key={done ? "success" : step} style={{
        flex: 1, overflowY: "auto",
        padding: done ? "32px 32px 80px" : "40px 32px 140px",
      }}>
        {done ? (
          <KwStepSuccess data={data}
            onOpen={() => { onCreated && onCreated(createdId); onClose(); }}
            onClose={onClose} />
        ) : (
          <>
            {step === 0 && <KwStepStart data={data} set={set} />}
            {step === 1 && <KwStepContact data={data} set={set} />}
            {step === 2 && <KwStepVigilance data={data} set={set} />}
          </>
        )}
      </main>

      {/* FOOTER */}
      {!done && (
        <footer style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "24px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, zIndex: 20,
          background: "linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)",
          pointerEvents: "none",
        }}>
          <div style={{ pointerEvents: "auto" }}>
            {step > 0 && (
              <KwGhostPill onClick={prev}
                icon={<KwIcon name="arrowL" size={16} stroke={KwSP.inkSoft} />}>
                Précédent
              </KwGhostPill>
            )}
          </div>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, color: KwSP.muted, fontWeight: 500 }}>
              {step + 1} / {KW_STEPS.length}
            </span>
            <KwBlackPill onClick={next} disabled={!canNext}
              icon={<KwIcon name="arrowR" size={16} stroke="#fff" />}>
              {step === KW_STEPS.length - 1 ? "Ouvrir le dossier" : "Continuer"}
            </KwBlackPill>
          </div>
        </footer>
      )}
    </div>
  );
};

window.CRMKycWizard = CRMKycWizard;
