// MEGGA CRM — Pipeline screen, "Sugar" visual style
// Theme-aware: utilise crmSugarPalette(t, dark, tone) pour le dark mode.

const CRM_STAGE_PROBS = {
  "new-lead": 5, "to-qualify": 15, "searching": 30,
  "visit-scheduled": 45, "visit-done": 60, "interest-confirmed": 75,
  "offer": 85, "signed": 100, "lost": 0,
};

const SugarStageColumn = ({ stage, deals, t, sp, dark, onOpenDeal, draggingId, dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onDragEnd }) => {
  const s = CRM_STAGES[stage];
  const stageVal = deals.reduce((x,d) => x + (d.value || 0), 0);
  const avatars = deals.slice(0, 3).map(d => crmContactById(d.contactId));

  return (
    <div
      onDragOver={e => { e.preventDefault(); onDragOver && onDragOver(); }}
      onDrop={e => { e.preventDefault(); onDrop && onDrop(); }}
      onDragLeave={onDragLeave}
      style={{
        flex: "0 0 240px",
        display:"flex", flexDirection:"column", gap: 10,
        position:"relative",
        transition: "transform .15s",
      }}>
      {/* Column header — floating frame */}
      <div style={{
        background: dragOver && draggingId
            ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,65,217,.06)")
            : sp.frameBg,
        border: dragOver && draggingId
            ? `1.5px solid ${s.color}`
            : `1px solid ${sp.frameBorder}`,
        borderRadius: 18, padding:"12px 14px",
        boxShadow: sp.shadow,
        backdropFilter:"blur(6px)",
        display:"flex", alignItems:"center", gap: 10,
      }}>
        <span style={{
          width: 9, height: 9, borderRadius: 999, background: s.color, flexShrink:0,
          boxShadow:`0 0 0 3px ${s.color}1F`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing:-0.2 }}>{s.label}</div>
          <div style={{ fontSize: 10.5, color: sp.sub, marginTop: 1, fontVariantNumeric:"tabular-nums" }}>
            {deals.length} deal{deals.length > 1 ? "s" : ""} {stageVal > 0 && `· CHF ${(stageVal/1e6).toFixed(2)}M`}
          </div>
        </div>
        <div style={{ display:"flex" }}>
          {avatars.map((c, i) => (
            <div key={c.id} style={{
              width: 24, height: 24, borderRadius: 999,
              background: c.avatarBg || "#0041D9", color:"#fff",
              fontSize: 9, fontWeight: 700,
              display:"grid", placeItems:"center",
              border:`2px solid ${sp.avatarBorder}`, marginLeft: i === 0 ? 0 : -8,
              boxShadow:"0 1px 3px rgba(0,0,0,.2)",
            }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
          ))}
        </div>
        <button style={{
          width: 26, height: 26, borderRadius: 999, border: 0, background: sp.cardBg,
          boxShadow: sp.shadowSm,
          display:"grid", placeItems:"center", cursor:"pointer",
        }}>
          <CRMIcon name="plus" size={11} stroke={sp.soft} />
        </button>
      </div>

      {/* Cards */}
      {deals.length === 0 && (
        <div style={{
          padding:"32px 12px", textAlign:"center", fontSize:11.5, color: dragOver && draggingId ? s.color : sp.sub,
          border: dragOver && draggingId ? `1.5px dashed ${s.color}` : `1px dashed ${sp.cardBorder}`,
          borderRadius: 16, background: dragOver && draggingId ? s.color + "08" : sp.frameBg,
          transition: "all .15s",
        }}>{ dragOver && draggingId ? `Déposer ici → ${s.label}` : "Glisser un deal ici"}</div>
      )}
      {deals.map((d, i) => <SugarDealCard key={d.id} deal={d} sp={sp} dark={dark}
        focused={i === 0 && stage === "offer"}
        onClick={() => onOpenDeal && onOpenDeal(d.id)}
        isDragging={draggingId === d.id}
        onDragStart={() => onDragStart && onDragStart(d.id)}
        onDragEnd={onDragEnd}
      />)}
    </div>
  );
};

const SugarDealCard = ({ deal, focused, sp, onClick, dark, isDragging, onDragStart, onDragEnd }) => {
  const c = crmContactById(deal.contactId);
  const b = deal.bienId ? crmBienById(deal.bienId) : null;
  const riskColor = deal.risk === "at-risk" ? "#F59E0B" : deal.risk === "stalled" ? "#E53935" : null;
  const stage = CRM_STAGES[deal.stage];
  const ink = focused ? sp.focusInk : sp.ink;
  const sub = focused ? "rgba(255,255,255,.65)" : sp.sub;
  const surface = focused ? sp.focusSurface : sp.cardSubBg;
  const [hover, setHover] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart && onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={!isDragging ? onClick : undefined}
      style={{
        background: focused ? sp.focusBg : (hover ? sp.cardBg : (dark ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.55)")),
        border: focused ? 0 : `1px solid ${sp.cardBorder}`,
        borderRadius: 18,
        padding: "14px 14px 12px",
        boxShadow: isDragging ? "none" : (focused ? sp.focusShadow : (hover ? sp.shadow : sp.shadowSm)),
        cursor: isDragging ? "grabbing" : "grab",
        position:"relative",
        opacity: isDragging ? 0.38 : 1,
        transition:"opacity .15s, transform .15s, box-shadow .15s, background .15s",
        transform: isDragging ? "scale(.97)" : "none",
        userSelect: "none",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onMouseEnter={e => { if (!isDragging) { setHover(true); e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=focused?sp.focusShadow:sp.shadow; } }}
      onMouseLeave={e => { setHover(false); setMenuOpen(false); e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=focused?sp.focusShadow:sp.shadowSm; }}>
      {(hover || menuOpen) && (
        <SugarCardQuickActions sp={sp} focused={focused} contact={c} menuOpen={menuOpen} setMenuOpen={setMenuOpen} dark={dark} />
      )}
      <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999,
          background: c.avatarBg || "#0041D9", color:"#fff",
          fontSize: 11, fontWeight: 700,
          display:"grid", placeItems:"center",
          border:`2px solid ${sp.avatarBorder}`, boxShadow:"0 2px 4px rgba(0,0,0,.18)",
          flexShrink: 0,
        }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: ink, lineHeight: 1.2,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {c.firstName} {c.lastName}
          </div>
          <div style={{ fontSize: 10.5, color: sub, marginTop: 1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {b ? b.title : "Recherche active"}
          </div>
        </div>
        {riskColor && !focused && !hover && !menuOpen && (
          <span style={{
            width: 18, height: 18, borderRadius: 999,
            background: riskColor + "1F", color: riskColor,
            display:"grid", placeItems:"center", flexShrink: 0,
          }}>
            <CRMIcon name="risk" size={10} stroke={riskColor} />
          </span>
        )}
        {focused && (
          <CRMIcon name="check" size={13} stroke={sp.focusInk} />
        )}
      </div>

      <div style={{
        marginTop: 12,
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div>
          <div style={{
            fontSize: 17, fontWeight: 800, color: ink, letterSpacing: -0.4,
            fontVariantNumeric:"tabular-nums",
          }}>{deal.value ? crmFmtCHF(deal.value) : "—"}</div>
          <div style={{ fontSize: 10.5, color: sub, fontWeight: 600, marginTop: 1 }}>
            {deal.probability}% · {stage.label}
          </div>
        </div>
        <SugarMiniRing value={deal.probability} color={focused ? sp.focusInk : stage.color} bg={focused ? "rgba(255,255,255,.12)" : sp.cardSubBg} ink={ink} />
      </div>

      {deal.nextAction && (
        <div style={{
          marginTop: 12,
          padding:"8px 10px", borderRadius: 12,
          background: surface,
          display:"flex", alignItems:"center", gap: 8,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 999,
            background: focused ? "rgba(255,255,255,.18)" : sp.cardBg,
            display:"grid", placeItems:"center", flexShrink: 0,
          }}>
            <CRMIcon
              name={deal.nextAction.kind === "call" ? "phone" : deal.nextAction.kind === "visit" ? "home" : deal.nextAction.kind === "kyc" ? "kyc" : deal.nextAction.kind === "match" ? "spark" : "flag"}
              size={10}
              stroke={focused ? sp.focusInk : sp.soft} />
          </div>
          <span style={{
            flex: 1, fontSize: 11, fontWeight: 600, color: ink,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>{deal.nextAction.note}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: sub, fontVariantNumeric:"tabular-nums",
          }}>{deal.nextAction.dueAt.slice(5,10).split("-").reverse().join("/")}</span>
        </div>
      )}
    </div>
  );
};

const SugarCardQuickActions = ({ sp, focused, contact, menuOpen, setMenuOpen, dark }) => {
  const stop = e => { e.stopPropagation(); };
  const btnBg = focused ? "rgba(255,255,255,.16)" : sp.cardBg;
  const btnFg = focused ? sp.focusInk : sp.ink;
  const btnBorder = focused ? "rgba(255,255,255,.18)" : sp.cardBorder;
  const btn = (extra = {}) => ({
    width: 26, height: 26, borderRadius: 999, border: `1px solid ${btnBorder}`,
    background: btnBg, color: btnFg, cursor: "pointer", fontFamily: "inherit",
    display: "grid", placeItems: "center", boxShadow: focused ? "none" : sp.shadowSm,
    transition: "transform .12s, background .12s",
    ...extra,
  });
  return (
    <div onClick={stop} style={{
      position: "absolute", top: 8, right: 8, display: "flex", gap: 4, zIndex: 5,
      animation: "qaFade .14s ease-out",
    }}>
      <style>{`@keyframes qaFade { from { opacity: 0; transform: translateY(-2px) } to { opacity: 1; transform: none } }`}</style>
      <button title={contact.phone ? `Appeler ${contact.phone}` : "Appeler"}
        onClick={e => { stop(e); alert(`Appel ${contact.firstName} ${contact.lastName} — ${contact.phone || "numéro non renseigné"}`); }}
        style={btn()}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "none"}>
        <CRMIcon name="phone" size={11} stroke={btnFg} />
      </button>
      <button title="Planifier une visite"
        onClick={e => { stop(e); alert(`Planifier une visite avec ${contact.firstName}`); }}
        style={btn()}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
        onMouseLeave={e => e.currentTarget.style.transform = "none"}>
        <CRMIcon name="home" size={11} stroke={btnFg} />
      </button>
      <div style={{ position: "relative" }}>
        <button title="Plus d'options"
          onClick={e => { stop(e); setMenuOpen(o => !o); }}
          style={btn(menuOpen ? { background: sp.ink, color: sp.pageBg, borderColor: sp.ink } : {})}
          onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.transform = "none"; }}>
          <span style={{ fontSize: 14, lineHeight: 0, fontWeight: 800, letterSpacing: 0, transform: "translateY(-3px)", color: menuOpen ? sp.pageBg : btnFg }}>···</span>
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", top: 32, right: 0, minWidth: 180,
            background: dark ? "rgba(28,36,30,.92)" : "rgba(255,255,255,.95)", border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
            boxShadow: "0 10px 30px -10px rgba(14,20,16,.20), 0 2px 6px rgba(14,20,16,.06)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            padding: 6, zIndex: 10, animation: "qaFade .14s ease-out",
          }}>
            <SugarMenuItem sp={sp} icon="contacts" label="Réassigner" onClick={() => { setMenuOpen(false); alert("Réassigner le deal à un autre agent"); }} />
            <SugarMenuItem sp={sp} icon="docs" label="Archiver" onClick={() => { setMenuOpen(false); alert("Archiver ce deal"); }} />
            <SugarMenuItem sp={sp} icon="risk" label="Marquer perdu" tone="danger" onClick={() => { setMenuOpen(false); alert("Marquer ce deal comme perdu — choisir un motif"); }} />
          </div>
        )}
      </div>
    </div>
  );
};

const SugarMenuItem = ({ sp, icon, label, tone, onClick }) => {
  const danger = tone === "danger";
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 10, border: 0,
        background: hov ? (danger ? "#FDECEA" : sp.cardSubBg) : "transparent",
        color: danger ? "#A11C16" : sp.ink, cursor: "pointer", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 600,
        textAlign: "left",
      }}>
      <CRMIcon name={icon} size={12} stroke={danger ? "#A11C16" : sp.soft} />
      {label}
    </button>
  );
};

const SugarMiniRing = ({ value, color, bg, ink, size = 36 }) => {
  const r = (size / 2) - 4;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <div style={{ position:"relative", width: size, height: size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth="3" fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div style={{
        position:"absolute", inset: 0, display:"grid", placeItems:"center",
        fontSize: 9.5, fontWeight: 800, color: ink || "#0E1410",
        fontVariantNumeric:"tabular-nums",
      }}>{value}</div>
    </div>
  );
};

const SugarKpiTile = ({ label, value, sub, accent, sp, dark }) => (
  <div style={{
    background: dark ? "transparent" : "rgba(255,255,255,.55)",
    border:`1px solid ${sp.cardBorder}`,
    borderRadius: 20, padding:"16px 18px",
    boxShadow: dark ? "none" : sp.shadowSm,
    backdropFilter: dark ? "none" : "blur(6px)",
    WebkitBackdropFilter: dark ? "none" : "blur(6px)",
    flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform:"uppercase" }}>{label}</div>
    <div style={{
      fontSize: 26, fontWeight: 800, color: accent || sp.ink,
      letterSpacing: -0.6, marginTop: 6, fontVariantNumeric:"tabular-nums",
    }}>{value}</div>
    {sub && <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
  </div>
);

const SugarSegmentedView = ({ value, onChange, sp }) => (
  <div style={{
    display:"flex", padding: 4, background: sp.cardBg,
    border:`1px solid ${sp.cardBorder}`, borderRadius: 999,
    boxShadow: sp.shadowSm,
  }}>
    {[
      { k:"kanban",   label:"Kanban" },
      { k:"list",     label:"Liste" },
      { k:"timeline", label:"Timeline" },
    ].map(v => (
      <button key={v.k} onClick={() => onChange && onChange(v.k)} style={{
        padding:"9px 18px", borderRadius: 999, border: 0, cursor:"pointer",
        background: value === v.k ? sp.ink : "transparent",
        color: value === v.k ? sp.pageBg : sp.soft,
        fontWeight: value === v.k ? 700 : 500, fontSize: 13,
        fontFamily:"inherit",
        boxShadow: value === v.k ? sp.focusShadow : "none",
      }}>{v.label}</button>
    ))}
  </div>
);

// ─── Verrou KYC bloquant — bannière en haut du pipeline ────────────────
// Architecture §5.5 : un deal ne peut pas passer en "intérêt confirmé"
// si le contact n'a pas un KYC vérifié. Cette bannière compte les deals
// bloqués + propose d'ouvrir l'écran KYC en un clic.
const SugarPipelineKycLock = ({ sp, dark, deals, onOpenKyc }) => {
  const blocking = (deals || []).filter(d => {
    const c = crmContactById(d.contactId);
    if (!c) return false;
    const k = window.kycByContactId ? window.kycByContactId(d.contactId) : null;
    const verified = k && k.status === "verified";
    // Au-delà de visit-done, un dossier KYC validé est requis
    const sensitive = ["visit-done", "interest-confirmed", "offer", "signed"].includes(d.stage);
    return sensitive && !verified;
  });
  if (blocking.length === 0) return null;

  const sampleNames = blocking.slice(0, 3)
    .map(d => crmContactById(d.contactId))
    .filter(Boolean)
    .map(c => `${c.firstName} ${c.lastName}`);

  return (
    <div style={{
      background: "#0B0C0E", color: "#fff",
      borderRadius: 22, padding: "18px 22px", marginBottom: 18,
      boxShadow: "0 12px 32px rgba(11,12,14,0.18)",
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 18, alignItems: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: "rgba(255,255,255,0.10)", display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="9" rx="2"/>
          <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, marginBottom: 3 }}>
          {blocking.length} deal{blocking.length > 1 ? "s" : ""} bloqué{blocking.length > 1 ? "s" : ""} par la conformité KYC · LBA
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
          {sampleNames.length > 0 && (
            <>{sampleNames.join(", ")}{blocking.length > sampleNames.length && ` +${blocking.length - sampleNames.length}`} · </>
          )}
          ne pourront pas passer en <em>Intérêt confirmé</em> tant que leur dossier n'est pas validé.
        </div>
      </div>
      <button onClick={onOpenKyc} style={{
        height: 38, padding: "0 18px", borderRadius: 999, border: 0,
        background: "#fff", color: "#0B0C0E", fontFamily: "inherit",
        fontSize: 13, fontWeight: 700, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 9, whiteSpace: "nowrap",
        boxShadow: "0 6px 16px rgba(0,0,0,0.20)",
      }}>
        Voir les dossiers
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B0C0E"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
};

const CRMScreenPipelineSugar = ({ t, view = "kanban", onView, dark, darkTone, setDark, onNavigate, onCmd }) => {
  const sp = crmSugarPalette(t, dark, darkTone);
  const stages = CRM_STAGE_ORDER;
  const [newDealOpen, setNewDealOpen] = React.useState(false);
  const [newDealPrefill, setNewDealPrefill] = React.useState(null);
  const [openDealId, setOpenDealId] = React.useState(null);

  // ─── Drag & drop state ────────────────────────────────────────────
  const [localDeals, setLocalDeals] = React.useState(CRM_DEALS);
  const [draggingId, setDraggingId] = React.useState(null);
  const [dragOverStage, setDragOverStage] = React.useState(null);
  const [kycBlockStage, setKycBlockStage] = React.useState(null); // stage bloqué par KYC

  const handleDragStart = (dealId) => setDraggingId(dealId);
  const handleDragEnd = () => { setDraggingId(null); setDragOverStage(null); };
  const handleDragOver = (stage) => setDragOverStage(stage);
  const handleDrop = (targetStage) => {
    if (!draggingId) return;
    const deal = localDeals.find(d => d.id === draggingId);
    if (!deal || deal.stage === targetStage) { handleDragEnd(); return; }
    // Garde-fou KYC : interest-confirmed, offer, signed
    const kycRequired = ["interest-confirmed", "offer", "signed"].includes(targetStage);
    const contact = crmContactById(deal.contactId);
    if (kycRequired && contact?.kyc?.status !== "verified") {
      setKycBlockStage(targetStage);
      setTimeout(() => setKycBlockStage(null), 3000);
      handleDragEnd(); return;
    }
    setLocalDeals(prev => prev.map(d =>
      d.id === draggingId
        ? { ...d, stage: targetStage, probability: CRM_STAGE_PROBS[targetStage] || d.probability }
        : d
    ));
    handleDragEnd();
  };

  // ─── Filter state ─────────────────────────────────────────
  const [search, setSearch] = React.useState("");
  const [filterStages, setFilterStages] = React.useState([]); // [] = toutes
  const [filterRisk, setFilterRisk] = React.useState("all"); // all | healthy | at-risk | stalled
  const [filterPeriod, setFilterPeriod] = React.useState(30); // jours

  const filteredDeals = React.useMemo(() => {
    return localDeals.filter(d => {
      const c = crmContactById(d.contactId);
      const b = d.bienId ? crmBienById(d.bienId) : null;
      if (search) {
        const q = search.toLowerCase();
        const inContact = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
        const inBien = b ? b.title.toLowerCase().includes(q) || b.addr.toLowerCase().includes(q) : false;
        const inNote = d.nextAction?.note?.toLowerCase().includes(q);
        if (!inContact && !inBien && !inNote) return false;
      }
      if (filterStages.length > 0 && !filterStages.includes(d.stage)) return false;
      if (filterRisk !== "all" && d.risk !== filterRisk) return false;
      if (filterPeriod !== 0) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - filterPeriod);
        if (new Date(d.updatedAt) < cutoff) return false;
      }
      return true;
    });
  }, [search, filterStages, filterRisk, filterPeriod, localDeals]);

  const filteredByStage = (stage) => filteredDeals.filter(d => d.stage === stage);
  const activeFilters = (filterStages.length > 0 ? 1 : 0) + (filterRisk !== "all" ? 1 : 0) + (filterPeriod !== 30 ? 1 : 0);
  const resetFilters = () => { setFilterStages([]); setFilterRisk("all"); setFilterPeriod(30); setSearch(""); };

  const totalValue = localDeals.reduce((s,d) => s + (d.value || 0), 0);
  const atRisk = localDeals.filter(d => d.risk !== "healthy").length;

  return (
    <div style={{
      background: sp.pageBg, minHeight:"100vh",
      fontFamily:"Manrope, system-ui, sans-serif", color: sp.ink,
    }}>
      <SugarTopNav active="pipeline" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />
      <div style={{ display:"flex" }}>
        <SugarIconRail active="pipeline" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <main style={{ flex: 1, padding:"32px 40px 80px 0", minWidth: 0 }}>
          <div style={{ display:"flex", alignItems:"flex-end", gap: 16, marginBottom: 28 }}>
            <h1 style={{
              margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: sp.ink,
              lineHeight: 1,
            }}>Pipeline</h1>
            <span style={{
              fontSize: 13, color: sp.sub, fontWeight: 500, marginBottom: 6,
            }}>{filteredDeals.length} deal{filteredDeals.length > 1 ? "s" : ""} · {stages.length} étapes{activeFilters > 0 ? ` · ${activeFilters} filtre${activeFilters > 1 ? "s" : ""}` : ""}</span>
            <div style={{ flex: 1 }} />
            <SugarSegmentedView sp={sp} value={view} onChange={onView} />
            <button onClick={() => { setNewDealPrefill(null); setNewDealOpen(true); }} style={{
              height: 44, padding:"0 22px", borderRadius: 999, border: 0,
              background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 14,
              fontFamily:"inherit", cursor:"pointer",
              boxShadow: sp.focusShadow,
              display:"flex", alignItems:"center", gap: 8,
            }}>
              <CRMIcon name="plus" size={14} stroke={sp.pageBg} />
              Nouveau deal
            </button>
          </div>

          {/* Verrou KYC — bannière persistante au-dessus des KPI */}
          <SugarPipelineKycLock sp={sp} dark={dark} deals={localDeals} onOpenKyc={() => onNavigate && onNavigate("kyc")} />

          <div style={{ display:"flex", gap: 14, marginBottom: 22 }}>
            <SugarKpiTile sp={sp} dark={dark} label="Pipeline actif" value={CRM_DEALS.length} sub="6 deals · 7 étapes couvertes" />
            <SugarKpiTile sp={sp} dark={dark} label="Valeur totale"  value={`CHF ${(totalValue/1e6).toFixed(2)}M`} sub="+ CHF 1.1M ce mois" accent={t.primary} />
            <SugarKpiTile sp={sp} dark={dark} label="À risque"       value={atRisk} sub="Pierre Vionnet · Linda Okafor" accent="#F59E0B" />
            <SugarKpiTile sp={sp} dark={dark} label="Conversion"     value="18%" sub="vs 14% le mois dernier" accent="#0E9F6E" />
          </div>

          <div style={{ display:"flex", gap: 8, alignItems:"center", marginBottom: 18 }}>
            <div style={{
              flex: 1, height: 44, padding:"0 16px",
              background: sp.cardBg, border:`1px solid ${sp.cardBorder}`,
              borderRadius: 999, boxShadow: sp.shadowSm,
              display:"flex", alignItems:"center", gap: 10,
            }}>
              <CRMIcon name="search" size={14} stroke={sp.sub} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher contact, bien, note…"
                style={{ flex: 1, background:"transparent", border: 0, outline:"none", color: sp.ink, fontSize: 13, fontFamily:"inherit" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background:"none", border:0, cursor:"pointer", color: sp.sub, fontFamily:"inherit", fontSize: 16 }}>×</button>
              )}
            </div>
            <SugarFilterPill sp={sp} label="Étape" value={filterStages.length === 0 ? "Toutes" : filterStages.length === 1 ? CRM_STAGES[filterStages[0]].label : `${filterStages.length} étapes`} active={filterStages.length > 0}>
              <SugarStageFilter sp={sp} value={filterStages} onChange={setFilterStages} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} label="Risque" value={filterRisk === "all" ? "Tous" : filterRisk === "healthy" ? "Sain" : filterRisk === "at-risk" ? "À risque" : "Bloqué"} active={filterRisk !== "all"}>
              <SugarRiskFilter sp={sp} value={filterRisk} onChange={setFilterRisk} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} label="Période" value={filterPeriod === 0 ? "Tous" : `${filterPeriod}j`} active={filterPeriod !== 30}>
              <SugarPeriodFilter sp={sp} value={filterPeriod} onChange={setFilterPeriod} />
            </SugarFilterPill>
            {activeFilters > 0 && (
              <button onClick={resetFilters} style={{
                height: 44, padding:"0 14px", borderRadius: 999, border: 0, cursor:"pointer",
                background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 12,
                fontFamily:"inherit", boxShadow: sp.focusShadow,
              }}>Réinitialiser</button>
            )}
          </div>

          {kycBlockStage && (
            <div style={{
              position:"fixed", bottom: 32, left:"50%", transform:"translateX(-50%)",
              background:"#0E1410", color:"#fff", padding:"14px 22px", borderRadius: 14,
              fontSize: 13, fontWeight: 700, zIndex: 200,
              display:"flex", alignItems:"center", gap: 12,
              boxShadow:"0 8px 32px rgba(0,0,0,.35)",
              animation:"ndDrawer .2s ease-out",
            }}>
              <CRMIcon name="kyc" size={16} stroke="#F59E0B" />
              KYC requis pour passer en « {CRM_STAGES[kycBlockStage]?.label} ». Vérifiez le contact d'abord.
            </div>
          )}
          {view === "kanban" && (
            <div style={{
              display:"flex", gap: 14, overflowX:"auto", paddingBottom: 24,
            }}>
              {stages.map(stage => (
                <SugarStageColumn
                  key={stage} stage={stage}
                  deals={filteredByStage(stage)}
                  t={t} sp={sp} dark={dark}
                  onOpenDeal={setOpenDealId}
                  draggingId={draggingId}
                  dragOver={dragOverStage === stage}
                  onDragOver={() => handleDragOver(stage)}
                  onDrop={() => handleDrop(stage)}
                  onDragLeave={() => dragOverStage === stage && setDragOverStage(null)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {view === "list" && <SugarPipelineList sp={sp} deals={filteredDeals} onOpenDeal={setOpenDealId} />}
          {view === "timeline" && <SugarPipelineTimeline sp={sp} />}
        </main>
      </div>
      <NewDealDrawer
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        sp={sp} t={t} dark={dark}
        prefill={newDealPrefill}
      />
      <DealDetailDrawer
        open={!!openDealId}
        onClose={() => setOpenDealId(null)}
        dealId={openDealId}
        sp={sp} t={t} dark={dark}
      />
    </div>
  );
};

const SugarFilterPill = ({ sp, label, value, active, children }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        height: 44, padding:"0 16px", borderRadius: 999, border: 0,
        background: active ? sp.ink : sp.cardBg,
        boxShadow: sp.shadowSm,
        display:"flex", alignItems:"center", gap: 8, cursor:"pointer", fontFamily:"inherit",
      }}>
        <span style={{ fontSize: 11, color: active ? "rgba(255,255,255,.65)" : sp.sub, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12.5, color: active ? sp.pageBg : sp.ink, fontWeight: 700 }}>{value}</span>
        <CRMIcon name="chevronD" size={11} stroke={active ? "rgba(255,255,255,.65)" : sp.sub} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: "rgba(255,255,255,.96)", border: `1px solid ${sp.cardBorder}`,
          borderRadius: 16, boxShadow: "0 10px 30px -10px rgba(14,20,16,.18), 0 2px 8px rgba(14,20,16,.06)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          padding: 10, zIndex: 50, minWidth: 220,
          animation: "sfPop .16s cubic-bezier(.2,.7,.2,1)",
        }}>
          <style>{`@keyframes sfPop { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:none } }`}</style>
          {children}
          <div style={{ borderTop: `1px solid ${sp.cardBorder}`, marginTop: 8, paddingTop: 8 }}>
            <button onClick={() => setOpen(false)} style={{
              width: "100%", padding: "8px 0", borderRadius: 10, border: 0, cursor: "pointer",
              background: sp.ink, color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
            }}>Appliquer</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Stage filter ─────────────────────────────────────────────────
const SugarStageFilter = ({ sp, value, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, padding: "0 4px" }}>Étapes</div>
    {CRM_STAGE_ORDER.map(s => {
      const info = CRM_STAGES[s];
      const sel = value.includes(s);
      return (
        <button key={s} onClick={() => onChange(sel ? value.filter(x => x !== s) : [...value, s])} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 8px",
          borderRadius: 10, border: 0, cursor: "pointer", fontFamily: "inherit",
          background: sel ? "#F0F4FF" : "transparent",
          textAlign: "left",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? "#0041D9" : "#CDD3DB"}`,
            background: sel ? "#0041D9" : "transparent", display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            {sel && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>}
          </span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: info.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: "#0E1410" }}>{info.label}</span>
        </button>
      );
    })}
    {value.length > 0 && (
      <button onClick={() => onChange([])} style={{
        marginTop: 4, padding: "5px 8px", borderRadius: 8, border: 0, cursor: "pointer",
        background: "transparent", color: "#7A8079", fontSize: 11, fontWeight: 600, fontFamily: "inherit", textAlign: "left",
      }}>Tout déselectionner</button>
    )}
  </div>
);

// ─── Risk filter ──────────────────────────────────────────────────
const SugarRiskFilter = ({ sp, value, onChange }) => {
  const opts = [
    { k: "all",      label: "Tous",      dot: sp.sub },
    { k: "healthy",  label: "Sain",      dot: "#0E9F6E" },
    { k: "at-risk",  label: "À risque",  dot: "#F59E0B" },
    { k: "stalled",  label: "Bloqué",    dot: "#E53935" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, padding: "0 4px" }}>Risque</div>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 8px",
          borderRadius: 10, border: 0, cursor: "pointer", fontFamily: "inherit",
          background: value === o.k ? "#F0F4FF" : "transparent", textAlign: "left",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999, border: `2px solid ${value === o.k ? "#0041D9" : "#CDD3DB"}`,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: "#0041D9" }} />}
          </span>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: o.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: value === o.k ? 700 : 500, color: "#0E1410" }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── Period filter ────────────────────────────────────────────────
const SugarPeriodFilter = ({ sp, value, onChange }) => {
  const opts = [
    { k: 7,   label: "7 derniers jours" },
    { k: 30,  label: "30 derniers jours" },
    { k: 60,  label: "60 derniers jours" },
    { k: 90,  label: "90 derniers jours" },
    { k: 0,   label: "Tous" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4, padding: "0 4px" }}>Période</div>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 8px",
          borderRadius: 10, border: 0, cursor: "pointer", fontFamily: "inherit",
          background: value === o.k ? "#F0F4FF" : "transparent", textAlign: "left",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999, border: `2px solid ${value === o.k ? "#0041D9" : "#CDD3DB"}`,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            {value === o.k && <span style={{ width: 6, height: 6, borderRadius: 999, background: "#0041D9" }} />}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: value === o.k ? 700 : 500, color: "#0E1410" }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
};

const SugarPipelineList = ({ sp, deals, onOpenDeal }) => {
  const list = deals || CRM_DEALS;
  return (
  <div style={{
    background: sp.cardBg, border:`1px solid ${sp.cardBorder}`,
    borderRadius: 22, overflow:"hidden",
    boxShadow: sp.shadow,
  }}>
    <div style={{
      display:"grid", gridTemplateColumns:"40px 2fr 1.4fr 1.2fr 0.8fr 1.4fr 100px",
      padding:"14px 18px", background: sp.tableHeadBg,
      borderBottom:`1px solid ${sp.cardBorder}`,
      fontSize: 10.5, fontWeight: 700, color: sp.sub,
      letterSpacing: 0.4, textTransform:"uppercase",
    }}>
      <span></span>
      <span>Deal / Contact</span>
      <span>Bien</span>
      <span>Étape</span>
      <span>Valeur</span>
      <span>Prochaine action</span>
      <span style={{ textAlign:"right" }}>Statut</span>
    </div>
    {list.map((deal, i) => {
      const c = crmContactById(deal.contactId);
      const b = deal.bienId ? crmBienById(deal.bienId) : null;
      const stage = CRM_STAGES[deal.stage];
      const riskColor = deal.risk === "at-risk" ? "#F59E0B" : deal.risk === "stalled" ? "#E53935" : "#0E9F6E";
      const riskLabel = deal.risk === "at-risk" ? "À risque" : deal.risk === "stalled" ? "Bloqué" : "Sain";
      const riskBg    = deal.risk === "at-risk" ? "#FEF3DB" : deal.risk === "stalled" ? "#FDECEA" : "#E1F5EC";
      return (
        <div key={deal.id} onClick={() => onOpenDeal && onOpenDeal(deal.id)} style={{
          display:"grid", gridTemplateColumns:"40px 2fr 1.4fr 1.2fr 0.8fr 1.4fr 100px",
          padding:"14px 18px", alignItems:"center",
          borderBottom: i < list.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
          fontSize: 13, cursor:"pointer",
          transition:"background .12s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = sp.cardSubBg}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: c.avatarBg || "#0041D9", color:"#fff",
            fontSize: 11, fontWeight: 700, display:"grid", placeItems:"center",
          }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: sp.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.firstName} {c.lastName}</div>
            <div style={{ fontSize: 11, color: sp.sub, marginTop: 1 }}>{c.email}</div>
          </div>
          <div style={{ fontSize: 12.5, color: sp.soft, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {b ? b.title : <span style={{ color: sp.sub, fontStyle:"italic" }}>Recherche active</span>}
          </div>
          <span style={{
            display:"inline-flex", alignItems:"center", gap: 6,
            padding:"4px 12px", borderRadius: 999, background: sp.cardSubBg,
            fontSize: 11.5, color: sp.soft, fontWeight: 600, width:"fit-content",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: stage.color }} />
            {stage.label}
          </span>
          <span style={{ fontWeight: 800, color: sp.ink, fontVariantNumeric:"tabular-nums" }}>
            {deal.value ? crmFmtCHF(deal.value) : "—"}
          </span>
          <div style={{ display:"flex", alignItems:"center", gap: 8, minWidth: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, background: sp.cardSubBg,
              display:"grid", placeItems:"center", flexShrink: 0,
            }}>
              <CRMIcon
                name={deal.nextAction.kind === "call" ? "phone" : deal.nextAction.kind === "visit" ? "home" : deal.nextAction.kind === "kyc" ? "kyc" : deal.nextAction.kind === "match" ? "spark" : "flag"}
                size={10} stroke={sp.soft} />
            </div>
            <span style={{ fontSize: 12, color: sp.soft, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {deal.nextAction.note}
            </span>
          </div>
          <span style={{
            justifySelf:"end",
            padding:"3px 10px", borderRadius: 999,
            background: riskBg, color: riskColor,
            fontSize: 10.5, fontWeight: 700,
          }}>{riskLabel}</span>
        </div>
      );
    })}
    {list.length === 0 && (
      <div style={{ padding: "40px 24px", textAlign: "center", color: sp.sub, fontSize: 13 }}>
        Aucun deal ne correspond aux filtres actifs.
      </div>
    )}
  </div>
  );
};

const SugarPipelineTimeline = ({ sp }) => {
  const days = ["1 mai","2 mai","3 mai","4 mai","5 mai","6 mai","7 mai","8 mai","9 mai","10 mai"];
  return (
    <div style={{
      background: sp.cardBg, border:`1px solid ${sp.cardBorder}`,
      borderRadius: 22, overflow:"hidden",
      boxShadow: sp.shadow,
    }}>
      <div style={{ display:"flex", borderBottom:`1px solid ${sp.cardBorder}`, background: sp.tableHeadBg }}>
        <div style={{ width: 240, padding:"14px 18px", borderRight:`1px solid ${sp.cardBorder}`,
          fontSize: 10.5, fontWeight: 700, color: sp.sub, letterSpacing: 0.4, textTransform:"uppercase" }}>Deal</div>
        <div style={{ flex: 1, display:"grid", gridTemplateColumns:`repeat(${days.length}, 1fr)` }}>
          {days.map((d, i) => (
            <div key={i} style={{ padding:"14px 0", textAlign:"center",
              borderRight: i < days.length-1 ? `1px solid ${sp.cardBorder}` : 0,
              fontSize: 11, color: sp.sub, fontWeight: 600 }}>{d}</div>
          ))}
        </div>
      </div>
      {CRM_DEALS.map((deal, i) => {
        const c = crmContactById(deal.contactId);
        const start = (i * 2) % 5;
        const span = ((i % 3) + 2);
        const stage = CRM_STAGES[deal.stage];
        return (
          <div key={deal.id} style={{ display:"flex", borderBottom: i < CRM_DEALS.length - 1 ? `1px solid ${sp.cardBorder}` : 0 }}>
            <div style={{ width: 240, padding:"14px 18px", borderRight:`1px solid ${sp.cardBorder}`,
              display:"flex", alignItems:"center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: c.avatarBg || "#0041D9", color:"#fff",
                fontSize: 10, fontWeight: 700, display:"grid", placeItems:"center", flexShrink: 0,
              }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.firstName} {c.lastName}</div>
                <div style={{ fontSize: 10.5, color: sp.sub }}>{deal.value ? crmFmtCHF(deal.value) : "—"}</div>
              </div>
            </div>
            <div style={{ flex: 1, position:"relative", display:"grid", gridTemplateColumns:`repeat(${days.length}, 1fr)`, height: 64 }}>
              {days.map((d, j) => (
                <div key={j} style={{ borderRight: j < days.length-1 ? `1px solid ${sp.cardBorder}` : 0 }} />
              ))}
              <div style={{
                position:"absolute", top: 14, left: `${(start/days.length)*100}%`,
                width: `${(span/days.length)*100}%`, height: 36,
                background: stage.color + "1A", borderLeft:`3px solid ${stage.color}`,
                borderRadius: 12, padding:"7px 12px", fontSize: 11.5, fontWeight: 700, color: sp.ink,
                display:"flex", alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                boxShadow: sp.shadowSm,
              }}>{stage.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

window.CRMScreenPipelineSugar = CRMScreenPipelineSugar;
