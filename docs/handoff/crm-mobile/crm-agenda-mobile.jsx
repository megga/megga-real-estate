// MEGGA CRM — Responsive · Écran « Agenda » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). La vue jour du calendrier desktop
// se replie en : sélecteur de semaine + héros « prochain RDV » + timeline
// verticale tactile + feuille de détail. Cast 100 % fidèle au reste du
// prototype (crm-data.jsx) — Marie, Élodie, Pierre, Antoine, Julien.
// Atomes partagés via window.* (crm-mobile-today.jsx) : MTCtx, MIcon, MAv,
// MEGGAWordmark, MT_LIGHT/DARK, MT_PHOTO. Icônes riches via window.MEIcon.

const AG_useMT = () => React.useContext(window.MTCtx);

// ─── « Maintenant » simulé : Dimanche 14 juin, 09:52 (cohérent avec Aujourd'hui) ──
const AG_NOW_MIN = 9 * 60 + 52;
const agMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const agFmtDur = (min) => min >= 60 ? (min % 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${Math.floor(min / 60)} h`) : `${min} min`;
const agEnd = (start, dur) => { const t = agMin(start) + dur; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

// ─── Types d'événements — couleurs fonctionnelles MEGGA (pastilles only) ──
const AG_TYPES = {
  appel:   { label: "Appel",        icon: "phone",     light: "#3A3D44", dark: "#B5B7C4" },
  relance: { label: "Relance",      icon: "refresh",   light: "#3A3D44", dark: "#B5B7C4" },
  visite:  { label: "Visite",       icon: "home",      light: "#0E7490", dark: "#5FBFD4" },
  kyc:     { label: "KYC",          icon: "shield",    light: "#0E7490", dark: "#5FBFD4" },
  mandat:  { label: "Mandat",       icon: "edit",      light: "#1E5BC6", dark: "#7FA8EE" },
  offre:   { label: "Offre",        icon: "banknote",  light: "#B4570A", dark: "#F0B27A" },
  publish: { label: "Publication",  icon: "upload",    light: "#0B0C0E", dark: "#ECEDF3" },
};
const agTone = (type, T) => (AG_TYPES[type] || AG_TYPES.appel)[T.mode === "dark" ? "dark" : "light"];

// ─── Jours de la semaine (strip) — Dim 14 juin = aujourd'hui ──────────────
const AG_DAYS = [
  { off: -3, dow: "Jeu", d: 11 },
  { off: -2, dow: "Ven", d: 12 },
  { off: -1, dow: "Sam", d: 13 },
  { off: 0,  dow: "Dim", d: 14 },
  { off: 1,  dow: "Lun", d: 15 },
  { off: 2,  dow: "Mar", d: 16 },
  { off: 3,  dow: "Mer", d: 17 },
];
const AG_MONTH = "juin";
const AG_DOW_FULL = { Jeu: "Jeudi", Ven: "Vendredi", Sam: "Samedi", Dim: "Dimanche", Lun: "Lundi", Mar: "Mardi", Mer: "Mercredi" };

// ─── Événements (offset jour, heure, durée, type, contact, bien) ──────────
const P = window.MT_PHOTO || {};
const AG_EVENTS = [
  // ── Samedi 13 (hier) ──
  { id: "s1", off: -1, start: "11:00", dur: 45, type: "visite", title: "Visite — Champel",
    contact: { name: "Élodie Schmidt", role: "Acheteuse", warm: 92, phone: "+41 79 808 12 24" },
    property: { title: "3 pièces standing Champel", addr: "Av. de Champel 42, Genève", price: "CHF 780'000", photo: P.champel }, status: "done" },
  { id: "s2", off: -1, start: "15:00", dur: 60, type: "mandat", title: "Signature mandat — Aebischer",
    contact: { name: "Julien Aebischer", role: "Vendeur" }, location: "Étude Reymond, Rue du Rhône 14", status: "done" },

  // ── Dimanche 14 (aujourd'hui) — 6 RDV, fidèles à l'écran Aujourd'hui ──
  { id: "t1", off: 0, start: "09:30", dur: 15, type: "relance", title: "Relance Pierre Vionnet",
    contact: { name: "Pierre Vionnet", role: "Acheteur", warm: 71, phone: "+41 78 211 04 91" },
    note: "Lui pousser 3 nouveaux matchs trouvés cette nuit.", status: "done" },
  { id: "t2", off: 0, start: "10:00", dur: 15, type: "appel", title: "Appel Marie Bertrand",
    contact: { name: "Marie Bertrand", role: "Acheteuse", warm: 84, phone: "+41 79 412 88 02" },
    note: "Relance à chaud — suite visite Carouge d'hier. Confirmer son intérêt avant de pousser l'offre." },
  { id: "t3", off: 0, start: "11:00", dur: 30, type: "kyc", title: "KYC Élodie Schmidt",
    contact: { name: "Élodie Schmidt", role: "Acheteuse", warm: 92, phone: "+41 79 808 12 24" },
    note: "Vérification d'identité requise avant de déposer l'offre. Pièce d'identité + justificatif d'adresse." },
  { id: "t4", off: 0, start: "11:30", dur: 45, type: "mandat", title: "Mandat — Julien Aebischer",
    contact: { name: "Julien Aebischer", role: "Vendeur" }, location: "MEGGA Genève, Rue du Rhône 65",
    note: "Mandat exclusif prêt — relire les clauses de commission avant signature." },
  { id: "t5", off: 0, start: "14:00", dur: 45, type: "visite", title: "Visite Carouge",
    contact: { name: "Marie Bertrand", role: "Acheteuse", warm: 84, phone: "+41 79 412 88 02" },
    property: { title: "5 pièces familial Carouge", addr: "Rue Ancienne 6, Carouge", price: "CHF 1'100'000", photo: P.carouge },
    location: "Rue Ancienne 6, 1227 Carouge",
    note: "2ᵉ visite. Prévoir devis cuisine + comparables quartier." },
  { id: "t6", off: 0, start: "16:00", dur: 30, type: "offre", title: "Suivi offre Cologny",
    contact: { name: "Antoine Picard", role: "Acheteur", warm: 78, phone: "+41 76 414 22 18" },
    property: { title: "Villa contemporaine Cologny", addr: "Ch. du Levant 8, Cologny", price: "CHF 3'850'000", photo: P.cologny },
    note: "Réponse du vendeur attendue. Relancer avant expiration de l'offre.", risk: true },

  // ── Lundi 15 (demain) ──
  { id: "m1", off: 1, start: "09:00", dur: 0, type: "publish", title: "Publication — Pâquis",
    property: { title: "3 pièces meublé Pâquis", addr: "Rue de Berne 22, Genève", price: "CHF 3'200/mois" },
    note: "Publication automatique sur MEGGA + portails partenaires." },
  { id: "m2", off: 1, start: "10:30", dur: 45, type: "visite", title: "Visite — Eaux-Vives",
    contact: { name: "Camille Rougier", role: "Acheteuse", warm: 55, phone: "+41 78 332 99 11" },
    property: { title: "4 pièces lumineux Eaux-Vives", addr: "Rue du Lac 15, Genève", price: "CHF 850'000", photo: P.eauxvives },
    location: "Rue du Lac 15, 1207 Genève" },
  { id: "m3", off: 1, start: "16:30", dur: 60, type: "mandat", title: "Estimation — Carouge",
    contact: { name: "Catherine Loreau", role: "Vendeuse" }, location: "Rue Ancienne 22, 1227 Carouge",
    note: "Première estimation succession. Prévoir tablette + comparables." },

  // ── Mardi 16 ──
  { id: "w1", off: 2, start: "11:00", dur: 90, type: "visite", title: "Visite groupe — Cologny",
    property: { title: "Villa contemporaine Cologny", addr: "Ch. du Levant 8, Cologny", price: "CHF 3'850'000", photo: P.cologny },
    note: "Journée portes ouvertes — 4 acheteurs inscrits." },
  { id: "w2", off: 2, start: "15:00", dur: 30, type: "relance", title: "Relance Linda Okafor",
    contact: { name: "Linda Okafor", role: "Lead", warm: 32 }, note: "Premier contact — lead salon SIMI 2026." },

  // ── Mercredi 17 ──
  { id: "x1", off: 3, start: "10:00", dur: 60, type: "mandat", title: "Signature notaire — Eaux-Vives",
    contact: { name: "Jean-Marc Aebischer", role: "Vendeur" }, location: "Étude Reymond, Rue du Rhône 14" },
];

const agDayEvents = (off) => AG_EVENTS.filter((e) => e.off === off).sort((a, b) => agMin(a.start) - agMin(b.start));

// ═══════════════════════════════════════════════════════════════════════
//  SÉLECTEUR DE SEMAINE — strip horizontal de jours
// ═══════════════════════════════════════════════════════════════════════
const AgWeekStrip = ({ selOff, onSelect }) => {
  const T = AG_useMT();
  return (
    <div className="agScroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -18px", padding: "4px 18px 8px" }}>
      {AG_DAYS.map((day) => {
        const on = day.off === selOff;
        const isToday = day.off === 0;
        const count = agDayEvents(day.off).length;
        return (
          <button key={day.off} onClick={() => onSelect(day.off)} style={{
            flexShrink: 0, width: 50, height: 70, borderRadius: 16, border: 0, cursor: "pointer", fontFamily: "inherit",
            background: on ? T.accent : T.card, boxShadow: on ? T.shadow : T.shadowSm,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "background .2s ease",
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: on ? T.accentInk : T.muted }}>{day.dow}</span>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.5, color: on ? T.accentInk : (isToday ? T.ink : T.inkSoft), fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{day.d}</span>
            <span style={{ display: "flex", gap: 3, height: 5, alignItems: "center" }}>
              {count > 0
                ? Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: 999, background: on ? T.accentInk : T.ghost, opacity: on ? 0.9 : 1 }} />
                  ))
                : null}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  HÉROS — prochain RDV (ou premier RDV d'un autre jour)
// ═══════════════════════════════════════════════════════════════════════
const AgNextHero = ({ event, isToday, onOpen }) => {
  const T = AG_useMT();
  if (!event) return null;
  const startM = agMin(event.start);
  const endM = startM + event.dur;
  const inProgress = isToday && startM <= AG_NOW_MIN && endM > AG_NOW_MIN;
  const diff = startM - AG_NOW_MIN;
  const headline = !isToday ? "Premier RDV" : inProgress ? "En cours" : diff <= 0 ? "Dernier RDV" : diff <= 60 ? `Dans ${diff} min` : `À ${event.start}`;
  const tp = AG_TYPES[event.type];

  return (
    <button onClick={onOpen} style={{
      width: "100%", textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
      marginTop: 16, background: T.relanceBg, color: T.relanceInk, borderRadius: 22, padding: 20,
      boxShadow: T.shadow, display: "flex", alignItems: "stretch", gap: 16,
    }}>
      <div style={{ flexShrink: 0, minWidth: 92, padding: "13px 14px", borderRadius: 16, background: "rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{event.start}</div>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{event.dur ? agEnd(event.start, event.dur) : "—"}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.12 }}>{event.title}</div>
        {event.contact && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.relanceInk }}>{event.contact.name}</div>
          </div>
        )}
        {!event.contact && event.location && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: T.relanceMuted, marginTop: 12 }}>
            <window.MEIcon name="location" size={13} color={T.relanceMuted} strokeWidth={1.8} />{event.location}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, alignSelf: "center", width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,0.1)", display: "grid", placeItems: "center" }}>
        <window.MEIcon name="chevron-right" size={18} color={T.relanceInk} strokeWidth={2} />
      </div>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  TIMELINE — rail horaire + cartes événements (liste tactile)
// ═══════════════════════════════════════════════════════════════════════
const AgEventRow = ({ event, isToday, showNow, onOpen }) => {
  const T = AG_useMT();
  const tp = AG_TYPES[event.type];
  const tone = agTone(event.type, T);
  const startM = agMin(event.start);
  const past = event.status === "done" || (isToday && startM + event.dur <= AG_NOW_MIN);
  const photo = event.property && event.property.photo;

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      {/* rail horaire */}
      <div style={{ width: 46, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: past ? T.ghost : T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2 }}>{event.start}</div>
      </div>
      {/* carte */}
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, textAlign: "left", border: 0, cursor: "pointer", fontFamily: "inherit",
        background: T.card, borderRadius: 18, boxShadow: T.shadowSm, padding: 13, marginBottom: 14,
        display: "flex", alignItems: "center", gap: 13, opacity: past ? 0.62 : 1,
        boxShadow: `${T.shadowSm}${T.mode === "dark" ? `, inset 0 0 0 1px ${T.cardBorder}` : ""}`,
      }}>
        {photo
          ? <div style={{ width: 50, height: 50, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: T.cardSubtle }}>
              <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          : <div style={{ width: 50, height: 50, borderRadius: 13, flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
              <window.MEIcon name={tp.icon} size={21} color={tone} strokeWidth={1.9} />
            </div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: tone }}>{tp.label}</span>
            {event.dur > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ghost, fontVariantNumeric: "tabular-nums" }}>· {agFmtDur(event.dur)}</span>}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, color: past ? T.muted : T.ink, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: event.status === "done" ? "line-through" : "none", textDecorationColor: T.ghost }}>{event.title}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {event.contact ? event.contact.name : (event.location || (event.property && event.property.addr) || "—")}
          </div>
        </div>
        {event.status === "done"
          ? <window.MEIcon name="check-circle" size={20} color={T.ghost} />
          : event.risk
            ? <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, color: "#fff", background: T.mode === "dark" ? "#B0344E" : "#8E1F3D", padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>À risque</span>
            : <window.MEIcon name="chevron-right" size={18} color={T.ghost} strokeWidth={2} />}
      </button>
    </div>
  );
};

const AgNowDivider = () => {
  const T = AG_useMT();
  const nowStr = `${String(Math.floor(AG_NOW_MIN / 60)).padStart(2, "0")}:${String(AG_NOW_MIN % 60).padStart(2, "0")}`;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "0 0 14px" }}>
      <div style={{ width: 46, flexShrink: 0, textAlign: "center", fontSize: 10.5, fontWeight: 800, color: "#E54D38", fontVariantNumeric: "tabular-nums" }}>{nowStr}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: "#E54D38", flexShrink: 0, boxShadow: "0 0 0 4px rgba(229,77,56,0.16)" }} />
        <span style={{ flex: 1, height: 2, background: "#E54D38", borderRadius: 999 }} />
      </div>
    </div>
  );
};

const AgTimeline = ({ events, isToday, onOpen }) => {
  const T = AG_useMT();
  if (!events.length) {
    return (
      <div style={{ marginTop: 22, padding: "44px 24px", textAlign: "center", background: T.card, borderRadius: 18, boxShadow: T.shadowSm, border: `1px solid ${T.cardBorder}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: T.cardSubtle, display: "grid", placeItems: "center", margin: "0 auto" }}>
          <window.MEIcon name="calendar" size={24} color={T.muted} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.4, color: T.ink, marginTop: 14 }}>Journée libre</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 5, maxWidth: 240, marginInline: "auto", lineHeight: 1.45 }}>Bloquez du temps pour vos acheteurs chauds ou avancez sur le pipeline.</div>
      </div>
    );
  }
  // index d'insertion du séparateur "maintenant"
  let nowIdx = -1;
  if (isToday) {
    nowIdx = events.findIndex((e) => agMin(e.start) > AG_NOW_MIN);
    if (nowIdx === -1) nowIdx = events.length;
  }
  return (
    <div style={{ marginTop: 22 }}>
      {events.map((e, i) => (
        <React.Fragment key={e.id}>
          {isToday && i === nowIdx && <AgNowDivider />}
          <AgEventRow event={e} isToday={isToday} onOpen={() => onOpen(e)} />
        </React.Fragment>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  FEUILLE DE DÉTAIL — bottom sheet
// ═══════════════════════════════════════════════════════════════════════
const AgDetailSheet = ({ event, onClose, onToast, onToggleDone, onDelete }) => {
  const T = AG_useMT();
  const Me = window.MEIcon;
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [resched, setResched] = React.useState(false);
  const [rsOff, setRsOff] = React.useState(event.off != null ? event.off : 0);
  const [rsTime, setRsTime] = React.useState(event.start);
  const tp = AG_TYPES[event.type];
  const tone = agTone(event.type, T);
  const done = event.status === "done";

  const act = (msg) => { onToast(msg); onClose(); };
  const AG_RS_SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "18:30"];
  const rsDay = AG_DAYS.find((d) => d.off === rsOff) || AG_DAYS.find((d) => d.off === 0);
  const rsDayLabel = rsOff === 0 ? "Aujourd'hui" : rsOff === 1 ? "Demain" : `${AG_DOW_FULL[rsDay.dow]} ${rsDay.d}`;
  const confirmResched = () => act(`Replanifié · ${rsDayLabel} à ${rsTime}`);

  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end",
      background: T.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.34)", backdropFilter: "blur(6px)", animation: "agScrim .28s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.canvas, borderRadius: "26px 26px 0 0", maxHeight: "88%", display: "flex", flexDirection: "column",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.28)", animation: "agSheet .36s cubic-bezier(.2,.8,.2,1) both", overflow: "hidden" }}>
        {/* poignée + close */}
        <div style={{ flexShrink: 0, paddingTop: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ width: 40, height: 5, borderRadius: 999, background: T.ghost, opacity: 0.5 }} />
        </div>
        <div className="agScroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px" }}>
          {resched ? (
            <div style={{ animation: "agSheet .3s cubic-bezier(.2,.8,.2,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 4 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Me name="clock" size={22} color={T.ink} strokeWidth={1.9} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted }}>Replanifier</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, margin: "20px 0 10px" }}>Jour</div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {AG_DAYS.map((d) => {
                  const on = d.off === rsOff;
                  const lab = d.off === 0 ? "Auj." : d.dow;
                  return (
                    <button key={d.off} onClick={() => setRsOff(d.off)} style={{ flexShrink: 0, width: 56, padding: "10px 0", borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit",
                      background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>{lab}</span>
                      <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums" }}>{d.d}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, margin: "22px 0 10px" }}>Heure</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {AG_RS_SLOTS.map((s) => {
                  const on = s === rsTime;
                  return (
                    <button key={s} onClick={() => setRsTime(s)} style={{ height: 46, borderRadius: 12, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, fontVariantNumeric: "tabular-nums",
                      background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft }}>{s}</button>
                  );
                })}
              </div>
              <div style={{ marginTop: 18, padding: "13px 15px", borderRadius: 14, background: T.cardSubtle, display: "flex", alignItems: "center", gap: 10 }}>
                <Me name="calendar" size={17} color={T.ink} strokeWidth={1.9} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{rsDayLabel} · {rsTime}{event.dur > 0 ? ` – ${agEnd(rsTime, event.dur)}` : ""}</span>
              </div>
            </div>
          ) : (<>
          {/* type + temps */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: T.cardSubtle, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Me name={tp.icon} size={22} color={tone} strokeWidth={1.9} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: tone }}>{tp.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.inkSoft, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {event.dur > 0 ? `${event.start} – ${agEnd(event.start, event.dur)} · ${agFmtDur(event.dur)}` : `${event.start} · publication`}
              </div>
            </div>
          </div>
          <h2 style={{ margin: "16px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: -0.7, color: T.ink, lineHeight: 1.1 }}>{event.title}</h2>

          {/* bien lié */}
          {event.property && (
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 13, padding: 12, borderRadius: 16, background: T.card, boxShadow: T.shadowSm, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ width: 58, height: 58, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
                {event.property.photo
                  ? <img src={event.property.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : <Me name="home" size={24} color={T.ghost} strokeWidth={1.8} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.property.title}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.property.addr}</div>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{event.property.price}</div>
            </div>
          )}

          {/* lieu */}
          {event.location && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 16, background: T.card, boxShadow: T.shadowSm, border: `1px solid ${T.cardBorder}` }}>
              <Me name="location" size={18} color={T.inkSoft} strokeWidth={1.85} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{event.location}</div>
              <button onClick={() => act("Itinéraire ouvert")} style={{ flexShrink: 0, height: 34, padding: "0 13px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, background: T.cardSubtle, color: T.ink }}>Y aller</button>
            </div>
          )}

          {/* contact */}
          {event.contact && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: T.card, boxShadow: T.shadowSm, border: `1px solid ${T.cardBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <window.MAv bg={tone} ink="#fff" size={44}>{event.contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</window.MAv>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.ink }}>{event.contact.name}</div>
                </div>
              </div>
              {event.contact.phone && (
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  <button onClick={() => act(`Appel · ${event.contact.name}`)} style={{ height: 44, borderRadius: 12, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, background: T.cardSubtle, color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Me name="phone" size={16} color={T.ink} strokeWidth={1.9} />Appeler
                  </button>
                  <button onClick={() => act(`Message · ${event.contact.name}`)} style={{ height: 44, borderRadius: 12, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, background: T.cardSubtle, color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Me name="message" size={16} color={T.ink} strokeWidth={1.9} />Message
                  </button>
                </div>
              )}
            </div>
          )}

          {/* note */}
          {event.note && (
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, marginBottom: 7 }}>Note</div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: T.inkSoft, lineHeight: 1.6, textWrap: "pretty" }}>{event.note}</p>
            </div>
          )}
          </>)}
        </div>

        {/* footer actions */}
        {resched ? (
          <div style={{ flexShrink: 0, padding: "12px 20px 30px", display: "flex", gap: 10 }}>
            <button onClick={() => setResched(false)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.cardSubtle, color: T.ink }}>Annuler</button>
            <button onClick={confirmResched} style={{ flex: 1.4, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.accent, color: T.accentInk, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Me name="check" size={18} color={T.accentInk} strokeWidth={2.2} />Confirmer
            </button>
          </div>
        ) : confirmDel ? (
          <div style={{ flexShrink: 0, padding: "12px 20px 30px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, textAlign: "center", marginBottom: 12 }}>Supprimer ce rendez-vous&nbsp;?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(false)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.cardSubtle, color: T.ink }}>Annuler</button>
              <button onClick={() => onDelete && onDelete(event)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.mode === "dark" ? "#E0738C" : "#8E1F3D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Me name="trash" size={17} color="#fff" strokeWidth={2} />Supprimer
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flexShrink: 0, padding: "12px 20px 30px", display: "flex", gap: 10 }}>
            <button onClick={() => setConfirmDel(true)} aria-label="Supprimer" style={{ flexShrink: 0, width: 50, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center" }}>
              <Me name="trash" size={19} color={T.mode === "dark" ? "#E0738C" : "#8E1F3D"} strokeWidth={1.9} />
            </button>
            <button onClick={() => setResched(true)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.cardSubtle, color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Me name="clock" size={18} color={T.ink} strokeWidth={1.9} />Replanifier
            </button>
            <button onClick={() => { if (onToggleDone) onToggleDone(event); act(done ? `Rouvert · ${event.title}` : `Terminé · ${event.title}`); }} style={{ flex: 1.2, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: done ? T.cardSubtle : T.accent, color: done ? T.muted : T.accentInk, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Me name="check" size={18} color={done ? T.muted : T.accentInk} strokeWidth={2.2} />{done ? "Terminé" : "Marquer fait"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  NOUVEL ÉVÉNEMENT — feuille de création
// ═══════════════════════════════════════════════════════════════════════
const AG_NEW_TYPES = ["appel", "relance", "visite", "kyc", "mandat", "offre"];
const AG_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "16:00", "16:30", "17:00"];
const AG_DURS = [15, 30, 45, 60, 90];
const AG_CONTACTS = ["Marie Bertrand", "Élodie Schmidt", "Pierre Vionnet", "Antoine Picard", "Julien Aebischer", "Camille Rougier"];

const AgNewEventSheet = ({ selOff, onClose, onCreate }) => {
  const T = AG_useMT();
  const Me = window.MEIcon;
  const [type, setType] = React.useState("appel");
  const [title, setTitle] = React.useState("");
  const [start, setStart] = React.useState("10:00");
  const [dur, setDur] = React.useState(30);
  const [contact, setContact] = React.useState("");
  const tone = agTone(type, T);
  const day = AG_DAYS.find((d) => d.off === selOff);
  const dayLabel = selOff === 0 ? "Aujourd'hui" : `${AG_DOW_FULL[day.dow]} ${day.d} ${AG_MONTH}`;
  const tp = AG_TYPES[type];
  const finalTitle = (title.trim() || tp.label) + (contact ? ` — ${contact.split(" ")[0]}` : "");
  const canSave = true;

  const fieldLabel = (txt) => (
    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: T.muted, margin: "18px 0 9px" }}>{txt}</div>
  );
  const chip = (active, onClick, children, key) => (
    <button key={key} onClick={onClick} style={{
      flexShrink: 0, height: 38, padding: "0 15px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
      fontSize: 13, fontWeight: 700, letterSpacing: -0.1, whiteSpace: "nowrap", border: 0,
      background: active ? T.accent : T.card, color: active ? T.accentInk : T.inkSoft,
      boxShadow: active ? "none" : T.shadowSm, display: "inline-flex", alignItems: "center", gap: 7, transition: "background .15s ease",
    }}>{children}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end",
      background: T.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.34)", backdropFilter: "blur(6px)", animation: "agScrim .28s ease both" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.canvas, borderRadius: "26px 26px 0 0", maxHeight: "92%", display: "flex", flexDirection: "column",
        boxShadow: "0 -20px 60px rgba(15,23,42,0.28)", animation: "agSheet .36s cubic-bezier(.2,.8,.2,1) both", overflow: "hidden" }}>
        <div style={{ flexShrink: 0, paddingTop: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ width: 40, height: 5, borderRadius: 999, background: T.ghost, opacity: 0.5 }} />
        </div>
        <div className="agScroll" style={{ flex: 1, overflowY: "auto", padding: "14px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.7, color: T.ink }}>Nouvel événement</h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: T.cardSubtle, fontSize: 12, fontWeight: 700, color: T.inkSoft }}>
              <Me name="calendar" size={14} color={T.muted} strokeWidth={1.9} />{dayLabel}
            </span>
          </div>

          {fieldLabel("Type")}
          <div className="agScroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px" }}>
            {AG_NEW_TYPES.map((ty) => chip(type === ty, () => setType(ty),
              <><Me name={AG_TYPES[ty].icon} size={15} color={type === ty ? T.accentInk : agTone(ty, T)} strokeWidth={1.9} />{AG_TYPES[ty].label}</>, ty))}
          </div>

          {fieldLabel("Titre")}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${tp.label}…`} style={{
            width: "100%", height: 50, padding: "0 16px", borderRadius: 14, border: 0, outline: "none", fontFamily: "inherit",
            fontSize: 15.5, fontWeight: 700, letterSpacing: -0.2, color: T.ink, background: T.card, boxShadow: T.shadowSm,
          }} />

          {fieldLabel("Contact")}
          <div className="agScroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px" }}>
            {AG_CONTACTS.map((c) => chip(contact === c, () => setContact(contact === c ? "" : c),
              c.split(" ")[0], c))}
          </div>

          {fieldLabel("Heure")}
          <div className="agScroll" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px" }}>
            {AG_SLOTS.map((s) => chip(start === s, () => setStart(s),
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{s}</span>, s))}
          </div>

          {fieldLabel("Durée")}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AG_DURS.map((d) => chip(dur === d, () => setDur(d), agFmtDur(d), d))}
          </div>

          {/* aperçu */}
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, background: T.cardSubtle }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: T.card, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: T.shadowSm }}>
              <Me name={tp.icon} size={21} color={tone} strokeWidth={1.9} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.3, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{finalTitle}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{start} – {agEnd(start, dur)} · {agFmtDur(dur)}</div>
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: "12px 20px 30px", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.cardSubtle, color: T.ink }}>Annuler</button>
          <button disabled={!canSave} onClick={() => onCreate({ type, start, dur, title: finalTitle, contact, off: selOff })} style={{ flex: 1.4, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: T.accent, color: T.accentInk, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Me name="check" size={18} color={T.accentInk} strokeWidth={2.2} />Ajouter
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  CHROME — header + tab bar
// ═══════════════════════════════════════════════════════════════════════
const AgHeader = ({ onAdd, onOpenSearch, onToday, onExport }) => {
  const T = AG_useMT();
  const [menu, setMenu] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);
  const ITEMS = [
    { id: "new",      label: "Nouvel événement",   icon: "plus" },
    { id: "today",    label: "Aller à aujourd'hui", icon: "cal" },
    { id: "export",   label: "Exporter l'agenda",   icon: "download" },
  ];
  const onPick = (id) => { setMenu(false); if (id === "new") onAdd && onAdd(); else if (id === "today") onToday && onToday(); else if (id === "export") onExport && onExport(); };
  return (
    <header style={{ paddingTop: 54, paddingLeft: 20, paddingRight: 20, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <window.MEGGAWordmark color={T.ink} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onOpenSearch} aria-label="Recherche & MEGGA AI" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}><window.MIcon name="search" size={18} sw={2} color={T.ink} /></button>
        <div ref={wrapRef} style={{ position: "relative" }}>
          <button onClick={() => setMenu((m) => !m)} aria-label="Plus d'options" style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${T.cardBorder}`, cursor: "pointer", background: menu ? T.ink : T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={menu ? (T.card || "#fff") : T.ink}><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </button>
          {menu && (
            <div style={{ position: "absolute", top: 46, right: 0, width: 220, background: T.card, borderRadius: 16, boxShadow: T.shadowLg || "0 24px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)", padding: 6, zIndex: 40, animation: "agRise .18s cubic-bezier(.2,.8,.2,1) both" }}>
              {ITEMS.map((it) => (
                <button key={it.id} onClick={() => onPick(it.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", borderRadius: 11, textAlign: "left" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.cardSubtle || "#F7F8FA")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <window.MIcon name={it.icon} size={18} sw={1.9} color={it.danger ? "#C4332E" : T.ink} />
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: it.danger ? "#C4332E" : T.ink }}>{it.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const AG_TABS = [
  { id: "today", label: "Aujourd'hui", icon: "home" },
  { id: "pipeline", label: "Pipeline", icon: "trend" },
  { id: "matching", label: "Matching", icon: "spark" },
  { id: "agenda", label: "Agenda", icon: "cal" },
  { id: "more", label: "Plus", icon: "menu" },
];
const AgTabBar = () => {
  const T = AG_useMT();
  return (
    <nav style={{ flexShrink: 0, background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})`, paddingTop: 8, paddingBottom: 26, paddingLeft: 6, paddingRight: 6, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {AG_TABS.map((tb) => {
        const on = tb.id === "agenda";
        return (
          <button key={tb.id} style={{ flex: 1, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 0" }}>
            <window.MIcon name={tb.icon} size={22} sw={on ? 2.2 : 1.9} color={on ? T.ink : T.ghost} />
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, letterSpacing: -0.1, color: on ? T.ink : T.muted, whiteSpace: "nowrap" }}>{tb.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN
// ═══════════════════════════════════════════════════════════════════════
const MobileAgendaScreen = ({ dark = false, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const [selOff, setSelOff] = React.useState(0);
  const [detail, setDetail] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [extra, setExtra] = React.useState([]);
  const [deletedIds, setDeletedIds] = React.useState([]);
  const [toast, setToast] = React.useState(null);
  const [toastDanger, setToastDanger] = React.useState(false);
  const pushToast = (msg, danger = false) => { setToast(msg); setToastDanger(danger); window.clearTimeout(pushToast._t); pushToast._t = window.setTimeout(() => setToast(null), 1900); };

  React.useEffect(() => {
    if (window.__agendaOpenCreate) { window.__agendaOpenCreate = false; setCreating(true); }
  }, []);

  const isToday = selOff === 0;
  const events = React.useMemo(() => {
    const base = agDayEvents(selOff).filter((e) => !deletedIds.includes(e.id));
    const mine = extra.filter((e) => e.off === selOff && !deletedIds.includes(e.id));
    return [...base, ...mine].sort((a, b) => agMin(a.start) - agMin(b.start));
  }, [selOff, extra, deletedIds]);

  const handleDelete = (event) => {
    setDeletedIds((prev) => [...prev, event.id]);
    setExtra((prev) => prev.filter((e) => e.id !== event.id));
    setDetail(null);
    pushToast("Rendez-vous supprimé", true);
  };

  const handleCreate = (draft) => {
    setExtra((prev) => [...prev, { ...draft, id: "new-" + Date.now(), contact: draft.contact ? { name: draft.contact, role: "Acheteur" } : null }]);
    setCreating(false);
    pushToast("Événement ajouté");
  };
  const day = AG_DAYS.find((d) => d.off === selOff);
  const nextEvent = isToday ? (events.find((e) => agMin(e.start) + e.dur > AG_NOW_MIN) || events[events.length - 1]) : events[0];

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, overflow: "hidden" }}>
        <style>{`
          @keyframes agScrim { from { opacity:0 } to { opacity:1 } }
          @keyframes agSheet { from { opacity:0; transform: translateY(40px) } to { opacity:1; transform: translateY(0) } }
          @keyframes agToast { from { opacity:0; transform: translate(-50%, 8px) } to { opacity:1; transform: translate(-50%, 0) } }
          .agScroll::-webkit-scrollbar { width:0; height:0 }
        `}</style>

        <AgHeader onAdd={() => setCreating(true)} onOpenSearch={() => setSearchOpen(true)} onToday={() => { setSelOff(0); pushToast("Aujourd'hui · dimanche 14 juin"); }} onExport={() => pushToast("Agenda exporté · .ics")} />

        <main className="agScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "2px 18px 24px", WebkitOverflowScrolling: "touch" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: "uppercase", color: T.muted }}>{AG_MONTH} 2026</div>
          <h1 style={{ margin: "5px 0 14px", fontSize: 28, fontWeight: 800, letterSpacing: -1, color: T.ink, lineHeight: 1.05 }}>Agenda</h1>

          <AgWeekStrip selOff={selOff} onSelect={setSelOff} />
          <AgNextHero event={nextEvent} isToday={isToday} onOpen={() => nextEvent && setDetail(nextEvent)} />
          <AgTimeline events={events} isToday={isToday} onOpen={setDetail} />
        </main>

        <AgTabBar />

        {detail && <AgDetailSheet event={detail} onClose={() => setDetail(null)} onToast={pushToast} onDelete={handleDelete} />}
        {creating && <AgNewEventSheet selOff={selOff} onClose={() => setCreating(false)} onCreate={handleCreate} />}

        {toast && (
          <div style={{ position: "absolute", left: "50%", bottom: 92, transform: "translateX(-50%)", zIndex: 80,
            padding: "11px 18px", borderRadius: 999, background: "rgba(11,12,14,0.94)", color: "#fff", fontSize: 13, fontWeight: 700,
            border: toastDanger ? "1.5px solid #E0738C" : "0",
            whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(0,0,0,0.3)", animation: "agToast .26s cubic-bezier(.2,.8,.2,1) both" }}>
            {toast}
          </div>
        )}
        {searchOpen && window.MTCommand && <window.MTCommand dark={dark} onGo={onGo} onClose={() => setSearchOpen(false)} />}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileAgendaScreen = MobileAgendaScreen;
Object.assign(window, { AG_EVENTS, AG_DAYS, AG_TYPES, agDayEvents, agMin, agEnd, agFmtDur, agTone, AG_NOW_MIN, AG_MONTH, AG_DOW_FULL });
// Chrome réutilisable pour les variantes de timeline (ex. time-blocking)
Object.assign(window, { AgHeader, AgTabBar, AgWeekStrip, AgNextHero, AgDetailSheet, AgNewEventSheet, AG_useMT });
