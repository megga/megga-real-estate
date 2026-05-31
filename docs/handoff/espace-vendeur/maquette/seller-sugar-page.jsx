// MEGGA — Page vendeur « Votre vente »
// Vue ordinateur (canvas 1440, conteneur ~1160). Lecture seule, lien personnel.
// Grammaire Sugar Pure : cards blanches flottantes, ombres douces, accent NOIR,
// titres en capitalize, nombres tabular-nums, CHF avec apostrophe suisse.
// Cards pensées pour reflow en une colonne (mobile à venir).

// ─── Icônes line (stroke, jamais d'emoji) ─────────────────────────────
const SvIcon = ({ name, size = 20, stroke = "currentColor", sw = 1.7, fill = "none" }) => {
  const p = {
    whatsapp: <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.45 1.32-1.99 1.36-.53.04-.54.42-3.4-.71-2.86-1.13-4.62-4.06-4.76-4.25-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.96-2.31.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.07.92 2.22.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.45.51-.15.14-.3.29-.13.57.17.28.77 1.27 1.65 2.06 1.13 1.01 2.09 1.32 2.37 1.46.28.14.45.12.61-.07.16-.19.71-.83.9-1.11.19-.28.37-.23.62-.14.25.09 1.61.76 1.89.9.28.14.46.21.53.32.07.11.07.65-.18 1.34Z" fill={stroke} stroke="none" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    check: <path d="m5 13 4 4 10-12" />,
    x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
    arrowUpDown: <><path d="M7 4v16" /><path d="m3 8 4-4 4 4" /><path d="M17 20V4" /><path d="m21 16-4 4-4-4" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
    sparkle: <path d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3Z" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    chevronLeft: <path d="m15 5-7 7 7 7" />,
    chevronRight: <path d="m9 5 7 7-7 7" />
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {p[name] || null}
    </svg>);

};

// ─── Avatar initiales (cercle coloré, style CRM) ──────────────────
const SvAvatarCircle = ({ name, size = 84, photo }) => {
  const initials = String(name || "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0, overflow: "hidden",
      background: "linear-gradient(135deg, #2A6FDB 0%, #0E7490 100%)",
      display: "grid", placeItems: "center"
    }}>
      {photo ?
      <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> :
      <span style={{ color: "#fff", fontWeight: 700, fontSize: Math.round(size * 0.4), letterSpacing: 0.3, lineHeight: 1 }}>{initials}</span>
      }
    </div>);

};

// ─── 0. Barre d'en-tête ───────────────────────────────────────────────
const SvHeader = ({ agent, onAgentClick, onSettingsClick }) => {
  const SP = window.SELLER_SP;
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 24, marginBottom: 36
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <img src="assets/megga-logo.svg" alt="MEGGA"
        style={{ height: 22, width: "auto", display: "block",
          filter: SP === window.SELLER_SP_DARK ? "invert(1) brightness(1.6)" : "none" }} />
        <span style={{
          fontSize: 15, fontWeight: 500, color: SP.muted, letterSpacing: -0.2
        }}></span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onSettingsClick} aria-label="Paramètres" style={{
          width: 44, height: 44, borderRadius: 999, border: 0, flexShrink: 0,
          background: SP.card, boxShadow: SP.shadowSm, cursor: "pointer",
          display: "grid", placeItems: "center", color: SP.inkSoft,
          transition: "box-shadow .2s ease, transform .2s ease"
        }}
        onMouseEnter={(e) => {e.currentTarget.style.boxShadow = SP.shadow;e.currentTarget.style.transform = "translateY(-1px)";}}
        onMouseLeave={(e) => {e.currentTarget.style.boxShadow = SP.shadowSm;e.currentTarget.style.transform = "translateY(0)";}}>
          <SvIcon name="settings" size={19} stroke={SP.inkSoft} sw={1.7} />
        </button>

        <button onClick={onAgentClick} style={{
          display: "flex", alignItems: "center", gap: 11,
          padding: "7px 7px 7px 16px", borderRadius: 999, border: 0,
          background: SP.card, boxShadow: SP.shadowSm,
          fontFamily: "inherit", cursor: "pointer",
          transition: "box-shadow .2s ease, transform .2s ease"
        }}
        onMouseEnter={(e) => {e.currentTarget.style.boxShadow = SP.shadow;e.currentTarget.style.transform = "translateY(-1px)";}}
        onMouseLeave={(e) => {e.currentTarget.style.boxShadow = SP.shadowSm;e.currentTarget.style.transform = "translateY(0)";}}>
          
          <span style={{ fontSize: 13, fontWeight: 600, color: SP.inkSoft, whiteSpace: "nowrap" }}>Votre agent</span>
          <SvAvatarCircle name={agent.name} size={32} photo={agent.photo} />
        </button>
      </div>
    </header>);

};

// ─── 0b. Sélecteur de bien (multi-annonces) ──────────────────────────
const SvPropertySwitcher = ({ properties, active, onSelect }) => {
  const SP = window.SELLER_SP;
  if (!properties || properties.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
      {properties.map((p, i) => {
        const on = i === active;
        return (
          <button key={p.id} onClick={() => onSelect(i)} style={{
            display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
            padding: "9px 16px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit",
            background: on ? SP.accent : SP.card, color: on ? SP.onAccent : SP.inkSoft,
            fontSize: 13.5, fontWeight: 600, letterSpacing: -0.1,
            boxShadow: on ? SP.shadowSm : `inset 0 0 0 1.5px ${SP.line}`,
            transition: "all .18s ease"
          }}
          onMouseEnter={(e) => {if (!on) e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${SP.lineStrong}`;}}
          onMouseLeave={(e) => {if (!on) e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${SP.line}`;}}>
            {p.label}
          </button>);

      })}
    </div>);

};

// ─── 1. Carte BIEN — horizontale ──────────────────────────────────────
const SvPropertyCard = ({ property, delay, onOpenGallery }) => {
  const SP = window.SELLER_SP;
  return (
    <div className="sg-enter sv-propcard" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 26, boxShadow: SP.shadow,
      padding: 14, marginBottom: 22,
      display: "grid", gridTemplateColumns: "minmax(0, 42%) 1fr", gap: 28
    }}>
      {/* Galerie photos */}
      <div style={{ display: "grid", gridTemplateRows: "1fr 78px", gap: 8, minWidth: 0 }}>
        <div style={{ position: "relative", minHeight: 240 }}>
          <image-slot id={`photo-${property.id}-main`} shape="rounded" radius="16"
          style={{ width: "100%", height: "100%", minHeight: 240 }}
          placeholder="Photo principale"></image-slot>
          <button onClick={() => onOpenGallery && onOpenGallery(property)} style={{
            position: "absolute", right: 12, bottom: 12, zIndex: 2,
            display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
            padding: "8px 14px", borderRadius: 999, border: 0, fontFamily: "inherit",
            background: "rgba(11,12,14,0.62)", color: "#fff", backdropFilter: "blur(6px)",
            fontSize: 13, fontWeight: 700, letterSpacing: -0.1, whiteSpace: "nowrap"
          }}>
            <SvIcon name="grid" size={15} stroke="#fff" sw={1.8} />
            Voir les photos
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, minWidth: 0 }}>
          <image-slot id={`photo-${property.id}-2`} shape="rounded" radius="12"
          style={{ width: "100%", height: 78 }} placeholder="Photo 2"></image-slot>
          <image-slot id={`photo-${property.id}-3`} shape="rounded" radius="12"
          style={{ width: "100%", height: 78 }} placeholder="Photo 3"></image-slot>
          <div style={{ position: "relative", minWidth: 0 }}>
            <image-slot id={`photo-${property.id}-4`} shape="rounded" radius="12"
            style={{ width: "100%", height: 78 }} placeholder=""></image-slot>
            <button className="photo-more" onClick={() => onOpenGallery && onOpenGallery(property)} style={{
              position: "absolute", inset: 0, borderRadius: 12, border: 0, cursor: "pointer",
              fontFamily: "inherit", display: "grid", placeItems: "center",
              background: "rgba(11,12,14,0.42)", color: "#fff",
              fontSize: 14, fontWeight: 700, letterSpacing: -0.2
            }}>+5</button>
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="sv-propinfo" style={{ padding: "18px 22px 18px 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 style={{
          margin: "0 0 10px", fontSize: 27, fontWeight: 700,
          color: SP.ink, letterSpacing: -0.6, lineHeight: 1.18
        }}>{property.title}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 7, color: SP.muted, marginBottom: 18 }}>
          <SvIcon name="pin" size={16} stroke={SP.muted} sw={1.6} />
          <span style={{ fontSize: 14, fontWeight: 500, color: SP.inkSoft }}>
            {property.address} · {property.city} · {property.canton}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 22 }}>
          {property.attrs.map((a, i) =>
          <React.Fragment key={a}>
              {i > 0 && <span style={{ width: 4, height: 4, borderRadius: 999, background: SP.ghost, margin: "0 12px" }} />}
              <span className="sg-tnum" style={{ fontSize: 14, fontWeight: 600, color: SP.inkSoft, whiteSpace: "nowrap" }}>{a}</span>
            </React.Fragment>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <span className="sg-tnum" style={{
            fontSize: 34, fontWeight: 700, color: SP.ink, letterSpacing: -1, lineHeight: 1,
            whiteSpace: "nowrap"
          }}>{window.sellerFmtCHF(property.price)}</span>
        </div>

        <div className="sg-tnum" style={{ fontSize: 13, fontWeight: 500, color: SP.muted }}>
          En ligne depuis {property.daysOnline} jours
        </div>
      </div>
    </div>);

};

// ─── 2. Carte OÙ ON EN EST — arc maître segmenté (A2) ─────────────────
const SELLER_STEP_COLORS = ["#1E5BC6", "#0891B2", "#0E9F6E", "#C45A00", "#A0521E", "#059669"];

// Prochaine étape + délai estimé selon l'étape courante
const SELLER_NEXT = {
  0: { eta: "Sous 3–5 jours", hint: "Photos et annonce en préparation." },
  1: { eta: "Cette semaine", hint: "Les premières demandes de visite arrivent." },
  2: { eta: "1 à 2 semaines", hint: "Les visites qualifiées mènent aux premières offres." },
  3: { eta: "Quelques jours", hint: "Votre agent analyse chaque offre reçue." },
  4: { eta: "Sous 48 heures", hint: "Votre agent défend votre prix." },
  5: null
};

const SvJourneyCard = ({ steps, current, sentence, delay }) => {
  const SP = window.SELLER_SP;
  const [hovered, setHovered] = React.useState(null);
  const next = SELLER_NEXT[current];
  const nextIdx = current + 1;
  const nextName = nextIdx < steps.length ? steps[nextIdx] : null;
  const R = 150,cx = 180,cy = 172;
  const L = Math.PI * R;
  const n = steps.length;
  const segL = L / n - 10;
  const remaining = Math.max(0, n - 1 - current);
  const colorAt = (i) => SELLER_STEP_COLORS[i % SELLER_STEP_COLORS.length];
  const arcPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  return (
    <div className="sg-enter sv-journey" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 26, boxShadow: SP.shadow,
      padding: "32px 38px 34px", marginBottom: 28
    }}>
      <h2 style={{
        margin: "0 0 24px", fontSize: 19, fontWeight: 700,
        color: SP.ink, letterSpacing: -0.3
      }}>Où en est votre vente</h2>

      <div className="sv-journeyrow" style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
        {/* Arc segmenté coloré */}
        <div className="sv-arc" style={{ position: "relative", width: 360, height: 200, flexShrink: 0 }}>
          <svg width="360" height="200" viewBox="0 0 360 200">
            <path d={arcPath} fill="none" stroke={SP.hairline} strokeWidth="15" strokeLinecap="round" />
            {steps.map((s, i) => {
              const done = i <= current;
              return (
                <path key={`seg-${i}`} d={arcPath} fill="none"
                stroke={done ? colorAt(i) : SP.hairline} strokeWidth="15" strokeLinecap="round"
                strokeDasharray={`${segL} ${L}`} strokeDashoffset={-(i * (L / n) + 5)}
                opacity={done ? 1 : 0.4} />);

            })}
            {steps.map((s, i) => {
              const a = Math.PI - i / (n - 1) * Math.PI;
              const x = cx + R * Math.cos(a),y = cy - R * Math.sin(a);
              const done = i < current,active = i === current,hl = i === hovered;
              const col = colorAt(i);
              return (
                <g key={`nd-${i}`} style={{ transition: "opacity .2s" }}>
                  {hl && <circle cx={x} cy={y} r="15" fill={col} opacity="0.16" />}
                  {active ?
                  <>
                    <circle cx={x} cy={y} r={hl ? 12 : 11} fill={SP.card} stroke={col} strokeWidth="3" />
                    <circle cx={x} cy={y} r="4" fill={col} />
                  </> :
                  <circle cx={x} cy={y} r={hl ? 7 : 5}
                  fill={done || hl ? col : SP.card} stroke={done || hl ? col : SP.ghost} strokeWidth="2" />
                  }
                </g>);

            })}
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: SP.ink, letterSpacing: -1, lineHeight: 1 }}>
              {steps[current]}
            </div>
            <div className="sg-tnum" style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginTop: 6 }}>
              Étape {current + 1}/{n} · reste {remaining} étape{remaining > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Liste des étapes */}
        <div style={{ flex: "0 0 auto", minWidth: 210, display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((s, i) => {
            const done = i < current,active = i === current,hl = i === hovered;
            return (
              <div key={s}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 12, cursor: "default",
                padding: active ? "10px 14px" : "4px 2px", borderRadius: 12,
                background: active ? SP.cardSubtle : hl ? SP.cardSubtle : "transparent",
                transition: "background .15s ease"
              }}>
                <span style={{
                  width: 9, height: 9, borderRadius: 999, flexShrink: 0,
                  background: done || active || hl ? colorAt(i) : SP.ghost, opacity: done || active || hl ? 1 : 0.5,
                  transition: "all .15s ease"
                }} />
                <span style={{
                  fontSize: 14.5, fontWeight: active ? 700 : 600,
                  color: active ? SP.ink : done ? SP.inkSoft : SP.ghost, whiteSpace: "nowrap"
                }}>{s}</span>
                {active &&
                <span style={{
                  marginLeft: "auto", fontSize: 11, fontWeight: 700, color: colorAt(i),
                  textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap"
                }}>en cours</span>
                }
              </div>);

          })}
        </div>

        {/* Encart Prochaine étape — comble l'espace à droite */}
        <div style={{
          flex: 1, minWidth: 220, alignSelf: "stretch",
          background: SP.cardSubtle, borderRadius: 18,
          padding: "22px 24px", display: "flex", flexDirection: "column", justifyContent: "center"
        }}>
          {nextName ?
          <>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: SP.muted
            }}>Prochaine étape</span>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: colorAt(nextIdx), flexShrink: 0 }} />
              <span style={{ fontSize: 22, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, lineHeight: 1.1 }}>
                {nextName}
              </span>
            </div>
            {next &&
            <span style={{
              alignSelf: "flex-start", marginTop: 14,
              padding: "5px 12px", borderRadius: 999,
              background: SP.card, boxShadow: SP.shadowSm,
              fontSize: 12.5, fontWeight: 700, color: colorAt(nextIdx), whiteSpace: "nowrap"
            }}>{next.eta}</span>
            }
            {next &&
            <p style={{
              margin: "14px 0 0", fontSize: 13.5, fontWeight: 500,
              color: SP.inkSoft, lineHeight: 1.5
            }}>{next.hint}</p>
            }
          </> :
          <>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: SP.muted
            }}>Félicitations</span>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 12 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                background: "#059669", display: "grid", placeItems: "center"
              }}>
                <SvIcon name="check" size={17} stroke="#fff" sw={2.4} />
              </span>
              <span style={{ fontSize: 22, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, lineHeight: 1.1 }}>
                Vente finalisée
              </span>
            </div>
            <p style={{
              margin: "14px 0 0", fontSize: 13.5, fontWeight: 500,
              color: SP.inkSoft, lineHeight: 1.5
            }}>Votre bien est vendu. Votre agent reste disponible pour l'après-vente.</p>
          </>
          }
        </div>
      </div>

      {/* Phrase contextuelle */}
      <div style={{
        marginTop: 28, padding: "16px 20px", borderRadius: 16,
        background: SP.cardSubtle,
        display: "flex", alignItems: "center", gap: 12
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: colorAt(current), flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.5 }}>
          {sentence}
        </span>
      </div>
    </div>);

};

// ─── 3a. Trois jauges donut (style « Pipeline du jour » CRM) ──────────
const SvDonut = ({ value, total, color, track, label, sub }) => {
  const SP = window.SELLER_SP;
  const r = 60;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const off = c * (1 - pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} stroke={track} strokeWidth="14" fill="none" />
          <circle cx="70" cy="70" r={r} stroke={color} strokeWidth="14" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset .65s cubic-bezier(.2,.8,.2,1)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div className="sg-tnum" style={{
              fontSize: 30, fontWeight: 800, color: SP.ink, letterSpacing: -0.6, lineHeight: 1
            }}>{value}</div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SP.muted,
              textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4
            }}>{label}</div>
          </div>
        </div>
      </div>
      {sub && <span style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, textAlign: "center", whiteSpace: "nowrap" }}>{sub}</span>}
    </div>);

};

const SvStatsRow = ({ stats, delay }) => {
  const SP = window.SELLER_SP;
  const dark = SP === window.SELLER_SP_DARK;
  const items = [
  { value: stats.visits.value, total: 12, color: "#0E9F6E", track: dark ? "#10332A" : "#E1F5EC", label: "Visites", sub: stats.visits.sub },
  { value: stats.offers, total: 3, color: "#C45A00", track: dark ? "#3A2614" : "#F8EBDC", label: "Offres", sub: "objectif 3" },
  { value: stats.days, total: 45, color: "#1E5BC6", track: dark ? "#15243F" : "#E8EFFE", label: "Jours", sub: "médiane GE · 45 j" }];

  return (
    <div className="sg-enter sv-stats" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 24, boxShadow: SP.shadow,
      padding: "30px 26px 26px", marginBottom: 22,
      display: "flex", justifyContent: "space-around", alignItems: "flex-start", gap: 12
    }}>
      {items.map((it) => <SvDonut key={it.label} {...it} />)}
    </div>);

};


// ─── 3b. Carte OFFRES ─────────────────────────────────────────────────
const SvOfferStatus = ({ status }) => {
  const SP = window.SELLER_SP;
  // Statuts forts → pilule pleine premium. Neutre → pilule douce.
  const map = {
    pending: { label: "En attente", strong: false },
    counter: { label: "Contre-offre", strong: true, bg: "#C45A00" },
    accepted: { label: "Acceptée", strong: true, bg: "#059669" }
  };
  const m = map[status] || map.pending;
  if (!m.strong) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
        padding: "5px 12px", borderRadius: 999, background: SP.cardSubtle,
        fontSize: 12, fontWeight: 600, color: SP.muted
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SP.muted }} />
        {m.label}
      </span>);

  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
      padding: "5px 13px", borderRadius: 999, background: m.bg, color: "#fff",
      fontSize: 12, fontWeight: 600,
      boxShadow: "0 4px 12px rgba(11,12,14,0.14)"
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.85)" }} />
      {m.label}
    </span>);

};

const SvOffersCard = ({ offers, askingPrice, onRespond, delay }) => {
  const SP = window.SELLER_SP;
  const empty = !offers || offers.length === 0;
  return (
    <div className="sg-enter" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 24, boxShadow: SP.shadow,
      padding: "26px 28px", marginBottom: 22
    }}>
      <h2 style={{
        margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: SP.ink, letterSpacing: -0.3
      }}>Offres</h2>

      {empty ?
      <div style={{
        padding: "26px 20px", textAlign: "center"
      }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: SP.inkSoft, lineHeight: 1.5, marginBottom: 4 }}>
            Pas encore d'offre — c'est normal à ce stade.
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: SP.muted, lineHeight: 1.5 }}>
            Les visites font leur travail.
          </div>
        </div> :

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {offers.map((o, i) => {
          const actionable = o.status === "pending";
          return (
            <div key={i} style={{
              padding: "16px 18px", borderRadius: 16, background: SP.cardSubtle
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", rowGap: 8 }}>
                  <span className="sg-tnum" style={{
                  fontSize: 19, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, flex: "0 0 auto"
                }}>{window.sellerFmtCHF(o.amount)}</span>
                  <SvOfferStatus status={o.status} />
                  <span className="sg-tnum" style={{
                  marginLeft: "auto", fontSize: 13, fontWeight: 500, color: SP.muted, whiteSpace: "nowrap"
                }}>{o.date}</span>
                </div>
                {actionable &&
              <button onClick={() => onRespond && onRespond(o)} style={{
                marginTop: 14, width: "100%", height: 44, borderRadius: 999, border: 0,
                cursor: "pointer", fontFamily: "inherit",
                background: SP.accent, color: SP.onAccent, fontSize: 13.5, fontWeight: 700,
                boxShadow: "0 4px 12px rgba(11,12,14,0.16)",
                transition: "all .18s ease"
              }}
              onMouseEnter={(e) => {e.currentTarget.style.background = SP.accentHover;e.currentTarget.style.transform = "translateY(-1px)";e.currentTarget.style.boxShadow = "0 10px 24px rgba(11,12,14,0.22)";}}
              onMouseLeave={(e) => {e.currentTarget.style.background = SP.accent;e.currentTarget.style.transform = "translateY(0)";e.currentTarget.style.boxShadow = "0 4px 12px rgba(11,12,14,0.16)";}}>
                    Répondre à l'offre
                  </button>
              }
              </div>);

        })}
        </div>
      }
    </div>);

};

// ─── 3c. Carte ACTIVITÉ RÉCENTE ───────────────────────────────────────
const sellerEventColor = (text) => {
  const t = (text || "").toLowerCase();
  if (/contre-offre|offre/.test(t)) return "#C45A00"; // orange — Offres
  if (/visite/.test(t)) return "#0E9F6E"; // vert — Visites
  if (/en ligne|publié|photo/.test(t)) return "#0891B2"; // cyan — Mise en ligne
  if (/mandat|signé|compromis/.test(t)) return "#1E5BC6"; // bleu — Mandat
  return "#0891B2";
};

const SvActivityCard = ({ events, delay }) => {
  const SP = window.SELLER_SP;
  return (
    <div className="sg-enter" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 24, boxShadow: SP.shadow,
      padding: "26px 28px"
    }}>
      <h2 style={{
        margin: "0 0 22px", fontSize: 18, fontWeight: 700, color: SP.ink, letterSpacing: -0.3
      }}>Dernières nouvelles</h2>

      <div style={{ position: "relative" }}>
        {/* Trait vertical de la timeline */}
        <div style={{
          position: "absolute", left: 5, top: 6, bottom: 6, width: 2,
          background: SP.hairline, borderRadius: 999
        }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {events.map((e, i) => {
            const col = sellerEventColor(e.text);
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 18, position: "relative" }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 999, flexShrink: 0, marginTop: 3,
                  background: col,
                  boxShadow: i === 0 ?
                  `0 0 0 4px ${SP.cardSubtle}` :
                  `0 0 0 4px ${SP.card}`,
                  opacity: i === 0 ? 1 : 0.85,
                  position: "relative", zIndex: 1
                }} />
                <span style={{ fontSize: 14.5, fontWeight: i === 0 ? 600 : 500, color: SP.inkSoft, lineHeight: 1.4, flex: 1 }}>
                  {e.text}
                </span>
                <span className="sg-tnum" style={{
                  fontSize: 12.5, fontWeight: 500, color: SP.muted, whiteSpace: "nowrap", marginTop: 1
                }}>{e.when}</span>
              </div>);

          })}
        </div>
      </div>
    </div>);

};

// ─── 3d. Carte AGENT ──────────────────────────────────────────────────
const SvSecondaryBtn = ({ icon, label, href }) => {
  const SP = window.SELLER_SP;
  const [hover, setHover] = React.useState(false);
  return (
    <a href={href || "#"} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    style={{
      flex: 1, height: 44, borderRadius: 999, textDecoration: "none",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: hover ? SP.cardSubtle : SP.card,
      boxShadow: hover ? `inset 0 0 0 1.5px ${SP.lineStrong}` : `inset 0 0 0 1.5px ${SP.line}`,
      color: SP.inkSoft, fontSize: 13.5, fontWeight: 600,
      transition: "all .18s ease"
    }}>
      {icon}
      {label}
    </a>);

};

const SvAgentCard = ({ agent, anchorRef, delay }) => {
  const SP = window.SELLER_SP;
  const [hover, setHover] = React.useState(false);
  return (
    <div ref={anchorRef} className="sg-enter" style={{
      animationDelay: `${delay}ms`,
      background: SP.card, borderRadius: 24, boxShadow: SP.shadow,
      padding: "30px 26px 26px", marginBottom: 18,
      display: "flex", flexDirection: "column", alignItems: "center"
    }}>
      <SvAvatarCircle name={agent.name} size={84} photo={agent.photo} />

      <div style={{ fontSize: 19, fontWeight: 700, color: SP.ink, letterSpacing: -0.3, marginTop: 16 }}>
        {agent.name}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: SP.muted, marginTop: 3, marginBottom: 22 }}>
        {agent.role}
      </div>

      {/* CTA principal WhatsApp */}
      <a href={agent.whatsapp || "#"}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", height: 50, borderRadius: 999, textDecoration: "none",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: hover ? "rgb(43, 44, 49)" : "rgb(31, 32, 36)", color: "#fff",
        fontSize: 14.5, fontWeight: 700, letterSpacing: 0.1,
        boxShadow: hover ? "0 12px 30px rgba(11,12,14,0.25)" : "0 6px 16px rgba(11,12,14,0.18)",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        transition: "all .18s ease"
      }}>
        <SvIcon name="whatsapp" size={20} stroke="#fff" />
        Écrire sur WhatsApp
      </a>

      {/* Secondaires */}
      <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 12 }}>
        <SvSecondaryBtn icon={<SvIcon name="phone" size={16} stroke={SP.inkSoft} />} label="Appeler" href={agent.phone} />
        <SvSecondaryBtn icon={<SvIcon name="mail" size={16} stroke={SP.inkSoft} />} label="Email" href={agent.email} />
      </div>
    </div>);

};

// ─── 3e. Carte « Prochaine étape » ────────────────────────────────────
const SvNextStepCard = ({ text, delay }) => {
  const SP = window.SELLER_SP;
  return (
    <div className="sg-enter" style={{
      animationDelay: `${delay}ms`,
      background: SP.cardSubtle, borderRadius: 22, boxShadow: SP.shadowSm,
      padding: "22px 24px"
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, marginBottom: 12
      }}>
        <SvIcon name="sparkle" size={16} stroke={SP.ink} fill={SP.ink} sw={0} />
        <span style={{
          fontSize: 11.5, fontWeight: 700, color: SP.muted,
          letterSpacing: 1, textTransform: "uppercase"
        }}>Prochaine étape</span>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.5 }}>
        {text}
      </p>
    </div>);

};

// ─── Pied ─────────────────────────────────────────────────────────────
const SvFooter = () => null;

window.SvHeader = SvHeader;
window.SvPropertySwitcher = SvPropertySwitcher;
window.SvPropertyCard = SvPropertyCard;
window.SvJourneyCard = SvJourneyCard;
window.SvStatsRow = SvStatsRow;
window.SvOffersCard = SvOffersCard;
window.SvActivityCard = SvActivityCard;
window.SvAgentCard = SvAgentCard;
window.SvNextStepCard = SvNextStepCard;
window.SvFooter = SvFooter;
window.SvIcon = SvIcon;

// ─── Lightbox galerie photos ──────────────────────────────────────────
// Récupère les images réellement déposées dans les image-slots d'un bien.
const sellerCollectPhotos = (propertyId) => {
  const ids = [
  `photo-${propertyId}-main`,
  `photo-${propertyId}-2`,
  `photo-${propertyId}-3`,
  `photo-${propertyId}-4`];

  const out = [];
  ids.forEach((id) => {
    const slot = document.getElementById(id);
    if (!slot || !slot.hasAttribute("data-filled")) return;
    const img = slot.shadowRoot && slot.shadowRoot.querySelector("img");
    const src = img && img.getAttribute("src");
    if (src) out.push(src);
  });
  return out;
};

const SvGalleryLightbox = ({ property, onClose }) => {
  const SP = window.SELLER_SP;
  const photos = React.useMemo(() => sellerCollectPhotos(property.id), [property.id]);
  const [idx, setIdx] = React.useState(0);
  const n = photos.length;
  const go = React.useCallback((d) => setIdx((i) => (i + d + n) % Math.max(1, n)), [n]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();else
      if (e.key === "ArrowLeft") go(-1);else
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {window.removeEventListener("keydown", onKey);document.body.style.overflow = "";};
  }, [go, onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(8,9,12,0.92)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
      animation: "sgFadeUp .25s ease both"
    }}>
      {/* Barre haute */}
      <div onClick={(e) => e.stopPropagation()} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", flexShrink: 0
      }}>
        <div style={{ color: "rgba(255,255,255,0.95)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{property.title}</div>
          {n > 0 &&
          <div className="sg-tnum" style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            {idx + 1} / {n}
          </div>
          }
        </div>
        <button onClick={onClose} aria-label="Fermer" style={{
          width: 44, height: 44, borderRadius: 999, border: 0, cursor: "pointer",
          background: "rgba(255,255,255,0.12)", color: "#fff",
          display: "grid", placeItems: "center"
        }}>
          <SvIcon name="x" size={20} stroke="#fff" sw={1.8} />
        </button>
      </div>

      {/* Scène */}
      <div onClick={(e) => e.stopPropagation()} style={{
        flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", padding: "0 24px"
      }}>
        {n === 0 ?
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)" }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 999, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>
            <SvIcon name="grid" size={24} stroke="rgba(255,255,255,0.7)" sw={1.6} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune photo pour le moment</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
            Les photos de votre bien apparaîtront ici.
          </div>
        </div> :
        <>
          {n > 1 &&
          <button onClick={() => go(-1)} aria-label="Précédente" style={{
            position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: 999, border: 0, cursor: "pointer",
            background: "rgba(255,255,255,0.12)", color: "#fff", display: "grid", placeItems: "center"
          }}>
            <SvIcon name="chevronLeft" size={22} stroke="#fff" sw={1.8} />
          </button>
          }
          <img src={photos[idx]} alt={`Photo ${idx + 1}`} style={{
            maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
            borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,0.5)"
          }} />
          {n > 1 &&
          <button onClick={() => go(1)} aria-label="Suivante" style={{
            position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
            width: 48, height: 48, borderRadius: 999, border: 0, cursor: "pointer",
            background: "rgba(255,255,255,0.12)", color: "#fff", display: "grid", placeItems: "center"
          }}>
            <SvIcon name="chevronRight" size={22} stroke="#fff" sw={1.8} />
          </button>
          }
        </>
        }
      </div>

      {/* Miniatures */}
      {n > 1 &&
      <div onClick={(e) => e.stopPropagation()} style={{
        display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
        padding: "20px 24px 28px", flexShrink: 0
      }}>
        {photos.map((src, i) =>
        <button key={i} onClick={() => setIdx(i)} style={{
          width: 72, height: 54, borderRadius: 10, border: 0, cursor: "pointer", padding: 0,
          overflow: "hidden", opacity: i === idx ? 1 : 0.5,
          outline: i === idx ? "2px solid #fff" : "none", outlineOffset: 2,
          transition: "opacity .15s ease"
        }}>
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </button>
        )}
      </div>
      }
    </div>);

};

window.SvGalleryLightbox = SvGalleryLightbox;