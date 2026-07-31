// MEGGA CRM — Console admin · KIT (grammaire Sugar Pure)
// ─────────────────────────────────────────────────────────────────────
// Atomes partagés par les sections de la Console MEGGA. Portés du kit `adminKit`
// du repo (megga-real-estate, src/components/admin/kit) mais recalés sur les
// règles du projet :
//   • accent UNIQUE = noir #0B0C0E (le violet de la console repo est supprimé) ;
//   • bento séparé par l'OMBRE, jamais par une bordure décorative ;
//   • AUCUNE animation de survol (fond instantané au plus) ;
//   • pilules de statut à fond plein + texte blanc ;
//   • 4 rayons seulement : frame 26 · card 18 · row 14 · pill 999 ;
//   • densité aérée : lignes 52px, chiffres tabulaires.
(function () {
  const ADM_R = { frame: 26, card: 18, row: 14, pill: 999 };
  const ADM_RAIL = 300;

  // Couleurs fonctionnelles MEGGA (données métier uniquement, jamais en accent UI)
  const admTones = (dark) => ({
    ok:   dark ? "#12A574" : "#059669",
    warn: dark ? "#E08A2E" : "#C45A00",
    err:  dark ? "#F26B65" : "#DC2626",
    info: dark ? "#4C86E8" : "#1E5BC6",
    cyan: dark ? "#22B8CF" : "#0891B2",
    danger: dark ? "#E0738C" : "#8E1F3D", // destructif (modales d'avertissement)
  });

  // Surfaces : blanc pur en clair, verre subtil en sombre (galSurfaces si dispo)
  const admSurf = (sp, dark) => (window.galSurfaces ? window.galSurfaces(sp, dark) : {
    card: dark ? "rgba(255,255,255,0.05)" : "#FFFFFF",
    cardSub: dark ? "rgba(255,255,255,0.04)" : "#F4F6F9",
    hairline: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(15,23,42,0.05)",
    shadow: dark ? "0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)"
                 : "0 1px 2px rgba(15,23,42,.04), 0 12px 34px -14px rgba(40,55,90,.20)",
  });

  const admCHF = (n) => (window.crmFmtCHF ? window.crmFmtCHF(n) : "CHF " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "'"));
  const admNum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "'");

  // ─── Icônes (SVG stroke 1.7, même facture que les Réglages) ───────────
  const ADM_PATHS = {
    dashboard: <><rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></>,
    broadcast: <><circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 16.5a6.4 6.4 0 0 0 0-9"/><path d="M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 19.4a10.4 10.4 0 0 0 0-14.8"/></>,
    building: <><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/><path d="M9 8h.01M15 8h.01"/></>,
    users: <><circle cx="9" cy="8" r="3.4"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M15.5 20c.4-2 1.5-3 3-3s2.6 1 3 3"/></>,
    userCheck: <><circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.7-3.6 3.2-5.3 6.5-5.3"/><path d="m15 16.5 2 2 4-4"/></>,
    store: <><path d="M3 9.5 5 4h14l2 5.5"/><path d="M4 9.5h16V20H4z"/><path d="M9 20v-5h6v5"/></>,
    card: <><rect x="2.5" y="6" width="19" height="12.5" rx="2.5"/><path d="M2.5 10.5h19M6 15h4"/></>,
    activity: <><path d="M3 12h4l2.5-6 4 13L16 12h5"/></>,
    shield: <><path d="M12 3l7.5 3v6c0 4.6-3.1 8-7.5 9-4.4-1-7.5-4.4-7.5-9V6Z"/><path d="m9 12 2 2 4-4"/></>,
    seal: <><path d="M12 3l2.2 1.7 2.7-.4 1 2.5 2.4 1.3-.5 2.7L21 13l-1.2 2.2.5 2.7-2.4 1.3-1 2.5-2.7-.4L12 22.8l-2.2-1.7-2.7.4-1-2.5L3.7 17.7l.5-2.7L3 13l1.2-2.2-.5-2.7 2.4-1.3 1-2.5 2.7.4Z"/><path d="m9.2 12.4 2 2 3.6-3.8"/></>,
    megaphone: <><path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l7 4V6.5L8 10.5H5.5A1.5 1.5 0 0 0 4 12Z"/><path d="M18.5 9.5a4 4 0 0 1 0 5"/></>,
    bolt: <><path d="M13.5 3 5.5 13.5h5L10 21l8.5-10.5h-5Z"/></>,
    star: <><path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 10l5.9-.9Z"/></>,
    sparkle: <><path d="M12 3.5c1.4 4.2 2.8 5.6 7 7-4.2 1.4-5.6 2.8-7 7-1.4-4.2-2.8-5.6-7-7 4.2-1.4 5.6-2.8 7-7Z"/></>,
    alert: <><path d="M12 4.5 21 20H3Z"/><path d="M12 10v4M12 17h.01"/></>,
    check: <><path d="m5 13 4 4 10-12"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/></>,
    coins: <><ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/><path d="M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></>,
    plug: <><path d="M9 2.5v6M15 2.5v6"/><path d="M5.5 8.5h13v3a6.5 6.5 0 0 1-13 0Z"/><path d="M12 18v3.5"/></>,
    download: <><path d="M12 4v11M7.5 11l4.5 4.5L16.5 11"/><path d="M4.5 19.5h15"/></>,
    external: <><path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v5.5H4.5V6H10"/></>,
    arrowLeft: <><path d="M19 12H5M11 6l-6 6 6 6"/></>,
    chevronR: <><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></>,
    up: <><path d="M12 19V5M6 11l6-6 6 6"/></>,
    home: <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></>,
    pipeline: <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V15a3 3 0 0 0 3 3h6.5"/></>,
    mail: <><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></>,
    trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7"/><path d="M6.5 7l1 12.5h9L17.5 7"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>,
    key: <><circle cx="8" cy="14" r="4"/><path d="m11 11 8.5-8.5M16 6l2.5 2.5M13.5 8.5 16 11"/></>,
    ban: <><circle cx="12" cy="12" r="8.5"/><path d="m6 18 12-12"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
    more: <><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="2.6"/></>,
    info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/></>,
    phone: <><path d="M6.5 3.5h3l1.5 4-2 1.5a10.5 10.5 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/></>,
    chevronL: <><path d="M14.5 5.5 8 12l6.5 6.5"/></>,
    message: <><path d="M20.5 12.5c0 4-3.8 7-8.5 7a10 10 0 0 1-2.7-.4L4.5 21l1.2-3.6a6.6 6.6 0 0 1-2.2-4.9c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z"/></>,
  };

  const AdmIcon = ({ name, size = 17, color = "currentColor", sw = 1.7, style }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block", ...style }}>
      {ADM_PATHS[name] || ADM_PATHS.dashboard}
    </svg>
  );

  // ─── Bento ────────────────────────────────────────────────────────────
  const AdmCard = ({ children, padding = 20, radius = ADM_R.card, sp, surf, style, onClick, className }) => (
    <div className={className} onClick={onClick} style={{
      background: surf.card, borderRadius: radius, border: surf.hairline,
      boxShadow: surf.shadow, padding, minWidth: 0, cursor: onClick ? "pointer" : undefined, ...style,
    }}>{children}</div>
  );

  const AdmDivider = ({ dark, margin = "0" }) => (
    <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)", margin }} />
  );

  // Titre de groupe : pastille de ton + libellé noir franc
  const AdmGroupTitle = ({ label, tone, right, sp, dark, level = 2, padding = "14px 12px 10px" }) => {
    const T = admTones(dark);
    const H = "h" + level;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding }}>
        {tone && <span style={{ width: 8, height: 8, borderRadius: ADM_R.pill, background: T[tone] || sp.sub, flexShrink: 0 }} />}
        {React.createElement(H, { style: { margin: 0, fontSize: 12.5, fontWeight: 800, letterSpacing: 0.1, color: sp.ink } }, label)}
        {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{right}</div>}
      </div>
    );
  };

  // Pilule de statut — fond plein + texte blanc (neutre = encre sur cardSub)
  const AdmPill = ({ label, tone = "neutral", icon, sp, surf, dark, style }) => {
    if (!label && !icon) return null;
    const T = admTones(dark);
    const neutral = tone === "neutral";
    const bg = neutral ? surf.cardSub : (T[tone] || sp.ink);
    const ink = neutral ? sp.soft : "#FFFFFF";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: icon ? "5px 12px 5px 9px" : "5px 12px", borderRadius: ADM_R.pill,
        background: bg, color: ink, fontSize: 11.5, fontWeight: 700, letterSpacing: -0.1,
        whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums", ...style,
      }}>
        {icon && <AdmIcon name={icon} size={13} color={ink} />}
        {label}
      </span>
    );
  };

  // Boutons — accent noir unique, aucune animation de survol
  const AdmGhostBtn = ({ children, onClick, icon, disabled, title, sp, surf, style }) => (
    <button className="adm-ghost" onClick={onClick} disabled={disabled} title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 15px",
      borderRadius: ADM_R.pill, border: 0, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
      whiteSpace: "nowrap", color: sp.ink, background: surf.card, boxShadow: sp.shadowSm, ...style,
    }}>
      {icon && <AdmIcon name={icon} size={15} color={sp.ink} />}
      {children}
    </button>
  );

  const AdmSolidBtn = ({ children, onClick, icon, disabled, title, sp, style, tone }) => {
    const bg = tone || sp.accent || sp.ink;
    const ink = sp.accentInk || (sp.dark ? "#0B0C0E" : "#FFFFFF");
    return (
      <button className="adm-solid" onClick={onClick} disabled={disabled} title={title} style={{
        display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 18px",
        borderRadius: ADM_R.pill, border: 0, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
        whiteSpace: "nowrap", color: tone ? "#FFFFFF" : ink, background: bg, ...style,
      }}>
        {icon && <AdmIcon name={icon} size={15} color={tone ? "#FFFFFF" : ink} />}
        {children}
      </button>
    );
  };

  const AdmSwitch = ({ on, onClick, label, disabled, sp, dark }) => (
    <button onClick={onClick} role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} style={{
      width: 44, height: 26, borderRadius: ADM_R.pill, border: 0, padding: 0, flexShrink: 0,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      background: on ? (sp.accent || sp.ink) : (dark ? "rgba(255,255,255,0.16)" : "#D5DAE2"),
      position: "relative",
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: ADM_R.pill,
        background: dark && on ? "#0B0C0E" : "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        transition: "left .22s cubic-bezier(.2,.8,.2,1)",
      }} />
    </button>
  );

  // Avatar à initiales — fond encre uni
  const AdmAvatar = ({ initials, size = 34, sp }) => (
    <div style={{
      width: size, height: size, borderRadius: ADM_R.pill, flexShrink: 0,
      background: sp.accent || sp.ink, color: sp.accentInk || (sp.dark ? "#0B0C0E" : "#FFFFFF"),
      display: "grid", placeItems: "center", fontSize: Math.round(size * 0.36), fontWeight: 700, letterSpacing: -0.4,
    }}>{initials}</div>
  );

  // KPI
  const AdmStat = ({ label, value, icon, tone, hint, trend, sp, surf, dark }) => {
    const T = admTones(dark);
    return (
      <AdmCard sp={sp} surf={surf} padding="16px 18px">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <AdmIcon name={icon} size={15} color={tone ? T[tone] : sp.sub} />}
          <div style={{ fontSize: 12, fontWeight: 600, color: sp.sub, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, color: sp.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          {trend != null && trend !== 0 && (
            <span style={{ fontSize: 11.5, fontWeight: 700, flexShrink: 0, fontVariantNumeric: "tabular-nums", color: trend > 0 ? T.ok : T.err }}>
              {trend > 0 ? "+" : ""}{trend}{hint ? " " + hint : ""}
            </span>
          )}
          {trend == null && hint && <span style={{ fontSize: 11.5, color: sp.sub }}>{hint}</span>}
        </div>
      </AdmCard>
    );
  };

  // Ligne dense (52px) — fond de repos inline, survol instantané via .adm-row
  const AdmRow = ({ children, sp, surf, onClick, style }) => (
    <div className="adm-row" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, minWidth: 0, minHeight: 52,
      padding: "0 14px", borderRadius: ADM_R.row, background: surf.cardSub,
      cursor: onClick ? "pointer" : undefined, ...style,
    }}>{children}</div>
  );

  const AdmEmpty = ({ icon, title, hint, action, sp }) => (
    <div style={{ display: "grid", placeItems: "center", gap: 10, padding: "48px 20px", textAlign: "center" }}>
      {icon && <AdmIcon name={icon} size={26} color={sp.sub} />}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink, letterSpacing: -0.2 }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: sp.sub, maxWidth: 380, lineHeight: 1.5 }}>{hint}</div>}
      {action}
    </div>
  );

  // Tableau — casse normale, jamais d'uppercase
  const AdmTh = ({ children, align = "left", width, sp }) => (
    <th style={{
      textAlign: align, width, padding: "10px 14px", whiteSpace: "nowrap",
      fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub,
      background: sp.tableHeadBg || "transparent", position: "sticky", top: 0, zIndex: 1,
    }}>{children}</th>
  );

  const AdmTd = ({ children, align = "left", numeric, sp, dark, style }) => (
    <td style={{
      textAlign: align, padding: "13px 14px", fontSize: 12.5, color: sp.ink,
      borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"}`,
      fontVariantNumeric: numeric ? "tabular-nums" : undefined, ...style,
    }}>{children}</td>
  );

  // Chips de filtre (grammaire InbFilt) — sélection = ring noir, pas de fond bleu
  const AdmChip = ({ label, count, on, onClick, sp, surf }) => (
    <button className="adm-chip" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px",
      borderRadius: ADM_R.pill, border: 0, cursor: "pointer", fontFamily: "inherit",
      fontSize: 12, fontWeight: 700, color: sp.ink,
      background: on ? surf.card : "transparent",
      boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset` : "none",
    }}>
      {label}
      {count != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </button>
  );

  // Sparkline monochrome (aire + trait) — pour le MRR
  const AdmSparkline = ({ points = [], width = 260, height = 44, color, fill }) => {
    if (!points.length) return null;
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const step = width / (points.length - 1 || 1);
    const xy = points.map((v, i) => [i * step, height - ((v - min) / span) * (height - 6) - 3]);
    const line = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = line + ` L${width} ${height} L0 ${height} Z`;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
        <path d={area} fill={fill} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Jauge de progression fine (onboarding, complétion)
  const AdmMeter = ({ value, max = 100, width = 120, color, track }) => (
    <div style={{ width, height: 6, borderRadius: 999, background: track, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, height: "100%", borderRadius: 999, background: color }} />
    </div>
  );

  // ─── Champs (Sugar : pas de bordure, surface creuse + filet intérieur) ─
  const admFieldStyle = (sp, surf, dark, h = 38) => ({
    width: "100%", height: h, padding: "0 12px", borderRadius: ADM_R.row, border: 0,
    background: surf.cardSub, color: sp.ink, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    outline: "none", boxShadow: `0 0 0 1.5px ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)"} inset`,
  });

  const AdmLabel = ({ children, sp, style }) => (
    <span style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: sp.sub, ...style }}>{children}</span>
  );

  const AdmSearch = ({ value, onChange, placeholder, sp, surf, dark, width = 250 }) => (
    <div style={{ position: "relative", width, flexShrink: 0 }}>
      <span style={{ position: "absolute", left: 11, top: 0, bottom: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
        <AdmIcon name="search" size={15} color={sp.sub} />
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        style={{ ...admFieldStyle(sp, surf, dark, 36), paddingLeft: 34 }} />
    </div>
  );

  const AdmCircleBtn = ({ icon, onClick, disabled, title, sp, surf, size = 30 }) => (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={title} style={{
      width: size, height: size, borderRadius: ADM_R.pill, border: 0, display: "grid", placeItems: "center",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
      background: surf.card, boxShadow: sp.shadowSm, flexShrink: 0,
    }}>
      <AdmIcon name={icon} size={15} color={sp.ink} />
    </button>
  );

  const AdmPager = ({ page, totalPages, total, perPage, onPage, sp, surf }) => {
    if (!total) return null;
    const from = (page - 1) * perPage + 1, to = Math.min(total, page * perPage);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: surf.hairline }}>
        <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: "tabular-nums" }}>{from}–{to} sur {total}</span>
        {totalPages > 1 && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
            <AdmCircleBtn icon="chevronL" title="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)} sp={sp} surf={surf} />
            <span style={{ fontSize: 12, fontWeight: 700, color: sp.ink, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "center" }}>{page}/{totalPages}</span>
            <AdmCircleBtn icon="chevronR" title="Page suivante" disabled={page >= totalPages} onClick={() => onPage(page + 1)} sp={sp} surf={surf} />
          </div>
        )}
      </div>
    );
  };

  // ─── Surfaces flottantes : OPAQUES, gris neutre en sombre (#17181A) ────
  const admFloatSurf = (sp, dark) => ({
    card: dark ? crmStep("s4", "#17181A") : "#FFFFFF",
    cardSub: dark ? crmStep("s3", "#1E1F21") : "#F4F6F9",
    hairline: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(15,23,42,0.05)",
    shadow: dark ? "0 1px 2px rgba(0,0,0,.5)" : "0 1px 2px rgba(15,23,42,.04)",
  });

  const ADM_MODAL_SHADOW = "0 40px 100px rgba(15,23,42,0.30), 0 8px 24px rgba(15,23,42,0.16)";

  // Surfaces flottantes rendues en PORTAIL, dans le CADRE de la console
  // (`[data-adm-frame]`) : le voile et la modale ne couvrent que le pager, jamais
  // la nav ni le rail. Replis : cadre du simulateur (tablette/mobile), puis body.
  // Le portail évite aussi l'ancêtre animé (admFadeUp garde un transform →
  // containing block → overlay clippé + flou faux).
  const admPortalHost = () => (typeof document === "undefined" ? null
    : document.querySelector("[data-adm-frame]") || document.querySelector("[data-device-frame]") || document.body);
  const admPortal = (node, host) => (host && window.ReactDOM ? window.ReactDOM.createPortal(node, host) : node);

  const AdmOverlay = ({ onClose, dark }) => (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: dark ? "rgba(0,0,4,.66)" : "rgba(14,20,26,.34)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
    }} />
  );

  // Surfaces flottantes de la console : canvas S0 (#12161C en sombre) — la
  // séparation vient de l'ombre, jamais d'un palier plus clair.
  const admPaneBg = (sp, dark) => (dark
    ? (window.crmStep ? window.crmStep("s0", "#12161C") : "#12161C")
    : admFloatSurf(sp, dark).card);

  const AdmModal = ({ title, subtitle, children, footer, onClose, sp, dark, width = 520 }) => {
    const F = admFloatSurf(sp, dark);
    const host = React.useMemo(admPortalHost, []);
    React.useEffect(() => {
      const k = (e) => { if (e.key === "Escape" && onClose) onClose(); };
      document.addEventListener("keydown", k);
      return () => document.removeEventListener("keydown", k);
    }, [onClose]);
    return admPortal(
      <div style={{ position: host === document.body ? "fixed" : "absolute", inset: 0, zIndex: 260, display: "grid", placeItems: "center", padding: 24 }}>
        <AdmOverlay onClose={onClose} dark={dark} />
        <div role="dialog" aria-modal="true" aria-label={title} className="adm-scroll" style={{
          position: "relative", width, maxWidth: "100%", maxHeight: "84vh", overflowY: "auto",
          background: admPaneBg(sp, dark), borderRadius: 28, boxShadow: ADM_MODAL_SHADOW, padding: "26px 26px 22px",
          animation: "admFadeUp .3s cubic-bezier(.2,.8,.2,1) both",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: -0.5, color: sp.ink, lineHeight: 1.2 }}>{title}</h3>
              {subtitle && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: sp.sub, lineHeight: 1.45 }}>{subtitle}</p>}
            </div>
            <AdmCircleBtn icon="close" title="Fermer" onClick={onClose} sp={sp} surf={{ card: F.cardSub }} />
          </div>
          {children}
          {footer && <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>{footer}</div>}
        </div>
      </div>, host
    );
  };

  // Confirmation d'action destructive : CTA rouge foncé opaque, saisie exigée
  const AdmConfirm = ({ open, title, message, confirmLabel, requireText, requireLabel, onConfirm, onClose, sp, dark, tone = "danger" }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark);
    const [typed, setTyped] = React.useState("");
    React.useEffect(() => { if (!open) setTyped(""); }, [open]);
    if (!open) return null;
    const ready = !requireText || typed.trim().toLowerCase() === String(requireText).toLowerCase();
    return (
      <AdmModal title={title} onClose={onClose} sp={sp} dark={dark} width={470}
        footer={<>
          <AdmGhostBtn sp={sp} surf={{ card: F.cardSub }} onClick={onClose}>Annuler</AdmGhostBtn>
          <AdmSolidBtn sp={sp} tone={T[tone] || T.danger} disabled={!ready} onClick={ready ? onConfirm : undefined}>{confirmLabel}</AdmSolidBtn>
        </>}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: sp.soft, textWrap: "pretty" }}>{message}</p>
        {requireText && (
          <div style={{ marginTop: 16 }}>
            <AdmLabel sp={sp}>{requireLabel || "Confirmer en saisissant la valeur exacte"}</AdmLabel>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={requireText} autoFocus
              style={admFieldStyle(sp, F, dark)} />
          </div>
        )}
      </AdmModal>
    );
  };

  const AdmDrawer = ({ children, onClose, sp, dark, width = 384, label, bg }) => {
    React.useEffect(() => {
      const k = (e) => { if (e.key === "Escape" && onClose) onClose(); };
      document.addEventListener("keydown", k);
      return () => document.removeEventListener("keydown", k);
    }, [onClose]);
    const F = admFloatSurf(sp, dark);
    const host = React.useMemo(admPortalHost, []);
    return admPortal(
      <div style={{ position: host === document.body ? "fixed" : "absolute", inset: 0, zIndex: 250, display: "flex", justifyContent: "flex-end" }}>
        <AdmOverlay onClose={onClose} dark={dark} />
        <div role="dialog" aria-modal="true" aria-label={label} className="adm-scroll" style={{
          position: "relative", width, maxWidth: "100%", height: "100%", overflowY: "auto",
          background: bg || admPaneBg(sp, dark), boxShadow: ADM_MODAL_SHADOW,
          animation: "admSlideIn .3s cubic-bezier(.2,.8,.2,1) both",
        }}>{children}</div>
      </div>, host
    );
  };

  Object.assign(window, {
    ADM_R, ADM_RAIL, admTones, admSurf, admCHF, admNum, admFieldStyle, admFloatSurf, admPaneBg, admPortal, admPortalHost,
    AdmIcon, AdmCard, AdmDivider, AdmGroupTitle, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmCircleBtn,
    AdmSwitch, AdmAvatar, AdmStat, AdmRow, AdmEmpty, AdmTh, AdmTd, AdmChip, AdmSparkline, AdmMeter,
    AdmSearch, AdmLabel, AdmPager, AdmModal, AdmConfirm, AdmDrawer, AdmOverlay,
  });
})();
