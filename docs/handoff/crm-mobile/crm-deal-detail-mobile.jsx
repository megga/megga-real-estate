// MEGGA CRM — Responsive · Écran « Détail deal » MOBILE (375–402)
// Sugar Pure, theme-aware (clair + sombre). Portée fidèle du desktop
// (crm-screen-deal-detail-sugar.jsx) repensée pour le pouce :
//   Header retour pipeline · Hero (montant + proba + stage stepper 8 cercles)
//   · Prochaine action en focus noir · Parties (acheteur + bien) ·
//   Onglets Négociation / Activité / Documents · CTA fixe « Avancer ».
// Réutilise window.* : MTCtx, MT_LIGHT/DARK, MT_STAGE, MEIcon, MAv,
//   CRM_DEALS/CONTACTS/BIENS/ACTIVITY, crmOfferChain, MT_PHOTO.
// KYC = rappel doux NON-bloquant (CLAUDE.md) — jamais de bannière « bloqué ».

const Dm_useMT = () => React.useContext(window.MTCtx);
const DmIcon = ({ name, size = 18, color = "currentColor", sw = 1.7 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

const dmFmtCHF = (n) =>
  n == null ? "—" : "CHF " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
const dmDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const dmDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short" }) : "—";

// ─── Pipeline : 8 étapes (libellés + couleur fonctionnelle MEGGA) ────────
const DM_STAGE_ORDER = [
  "new-lead", "to-qualify", "searching", "visit-scheduled",
  "visit-done", "interest-confirmed", "offer", "signed",
];
const DM_STAGES = {
  "new-lead":           { label: "Lead",        short: "Lead",     color: "#1E5BC6" },
  "to-qualify":         { label: "Qualifier",   short: "Qualif.",  color: "#1E5BC6" },
  "searching":          { label: "Recherche",   short: "Match",    color: "#0891B2" },
  "visit-scheduled":    { label: "Visite prév.", short: "Visite",  color: "#0891B2" },
  "visit-done":         { label: "Visite faite", short: "Visitée", color: "#0E7490" },
  "interest-confirmed": { label: "Intérêt",     short: "Intérêt",  color: "#C45A00" },
  "offer":              { label: "Offre",        short: "Offre",   color: "#C45A00" },
  "signed":             { label: "Signé",        short: "Signé",   color: "#059669" },
};

// ─── Carte (surface blanche Sugar) ───────────────────────────────────────
const DmCard = ({ children, pad = 18, style }) => {
  const T = Dm_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: pad, ...style }}>
      {children}
    </div>
  );
};
const DmEyebrow = ({ children, style }) => {
  const T = Dm_useMT();
  return <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase", ...style }}>{children}</div>;
};
// Pilule de statut/type : fond plein couleur fonctionnelle + texte BLANC (CLAUDE.md)
const DmStatusPill = ({ label, color }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: color, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{label}</span>
);
// Pilule neutre (méta : proba, conditions…)
const DmMetaPill = ({ icon, children }) => {
  const T = Dm_useMT();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: T.cardSubtle, color: T.inkSoft, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      {icon && <DmIcon name={icon} size={12} color={T.inkSoft} sw={1.9} />}{children}
    </span>
  );
};
const DmCircle = ({ icon, onClick, title, size = 38 }) => {
  const T = Dm_useMT();
  return <button onClick={onClick} title={title} style={{ width: size, height: size, borderRadius: 999, border: 0, background: T.cardSubtle, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</button>;
};

// ─── STAGE BAR (Concept A — barre segmentée, compacte, sans scroll) ──────
const DmStageBar = ({ current }) => {
  const T = Dm_useMT();
  const idx = DM_STAGE_ORDER.indexOf(current);
  const cur = DM_STAGES[current] || { label: current };
  const next = idx < DM_STAGE_ORDER.length - 1 ? DM_STAGES[DM_STAGE_ORDER[idx + 1]] : null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, letterSpacing: -0.4 }}>{cur.label}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        {DM_STAGE_ORDER.map((s, i) => (
          <div key={s} style={{ flex: 1, height: i === idx ? 10 : 8, borderRadius: 999, background: i <= idx ? T.ink : T.cardSubtle, boxShadow: i === idx ? `0 0 0 3px ${T.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(11,12,14,0.10)"}` : "none", alignSelf: "center", transition: "all .25s ease" }} />
        ))}
      </div>
      {next && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, fontSize: 12, fontWeight: 700, color: T.muted }}>
          <DmIcon name="arrow-right" size={14} color={T.muted} sw={2} />
          <span>Prochaine étape · <span style={{ color: T.ink }}>{next.label}</span></span>
        </div>
      )}
    </div>
  );
};

// ─── Anneau de probabilité (compact, monochrome Sugar) ──────────────────
const DmProbRing = ({ pct, size = 58, stroke = 6 }) => {
  const T = Dm_useMT();
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.hair} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.ink} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
    </div>
  );
};

// ─── Badge vérifié (sceau bleu officiel — identique à Matching / Contacts) ─
// Affiché dès que l'identité OU le KYC du contact est confirmé.
const DM_SEAL_D = "M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z";
const DmVerifiedBadge = ({ size = 20, seal = "#0041D9", check = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 19 19" style={{ flexShrink: 0, display: "block" }} aria-label="Vérifié">
    <circle cx="9.5" cy="9.5" r="5.6" fill={check} />
    <path d={DM_SEAL_D} fill={seal} fillRule="evenodd" clipRule="evenodd" />
  </svg>
);

// ─── HERO — en-tête immersif photo + zone donnée blanche (responsive) ────
const DmHero = ({ deal, contact, bien, lastOffer, photo }) => {
  const T = Dm_useMT();
  const stage = DM_STAGES[deal.stage] || { label: deal.stage, color: T.muted };
  const riskLabel = deal.risk === "at-risk" ? "À surveiller" : deal.risk === "stalled" ? "Bloqué" : "Sain";
  const riskColor = deal.risk === "at-risk" ? "#C45A00" : deal.risk === "stalled" ? "#DC2626" : "#059669";
  const kyc = (contact && contact.kyc && contact.kyc.status) || "none";
  const kycVerified = kyc === "verified";
  return (
    <DmCard pad={0} style={{ overflow: "hidden", flexShrink: 0, animation: "dmUp .5s cubic-bezier(.2,.8,.2,1)" }}>
      {/* Bandeau identité photo */}
      <div style={{ position: "relative", minHeight: 184, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 16 }}>
        {photo
          ? <img src={photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ position: "absolute", inset: 0, background: `linear-gradient(140deg, ${stage.color} 0%, #0B0C0E 120%)` }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,9,12,0.52) 0%, rgba(8,9,12,0.08) 32%, rgba(8,9,12,0.30) 60%, rgba(8,9,12,0.86) 100%)" }} />

        {/* Haut : étape + référence */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: "auto" }}>
          <DmStatusPill label={stage.label} color={stage.color} />
        </div>

        {/* Bas : identité */}
        <div style={{ position: "relative", marginTop: 14 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -0.6, lineHeight: 1.08, textShadow: "0 1px 10px rgba(0,0,0,0.45)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>{contact ? `${contact.firstName} ${contact.lastName}` : "Acheteur"}</span>
            {(kycVerified || (contact && contact.identityVerified)) && <DmVerifiedBadge size={21} />}
          </h1>
          {bien && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.86)", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              <DmIcon name="location" size={13} color="rgba(255,255,255,0.86)" sw={1.8} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Zone donnée blanche */}
      <div style={{ padding: "18px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <DmEyebrow>Montant du deal</DmEyebrow>
            <div style={{ fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: -1, lineHeight: 1.05, marginTop: 5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dmFmtCHF(deal.value)}</div>
            {lastOffer && lastOffer.amount !== deal.value && (
              <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 5 }}>Dernière offre · {dmFmtCHF(lastOffer.amount)}</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.hair}` }}>
          <DmStageBar current={deal.stage} />
        </div>
      </div>
    </DmCard>
  );
};

// ─── PROCHAINE ACTION (carte noire immersive) ────────────────────────────
const DM_ACTION_META = {
  call:  { label: "Appel de relance",     icon: "phone",    cta: "Faire l'appel" },
  email: { label: "E-mail de suivi",      icon: "mail",     cta: "Écrire l'e-mail" },
  visit: { label: "Visite à organiser",   icon: "calendar", cta: "Planifier" },
  kyc:   { label: "Vérification KYC",      icon: "shield",   cta: "Ouvrir le KYC" },
  match: { label: "Envoyer des matchs",   icon: "sparkle",  cta: "Voir le matching" },
  offer: { label: "Suivi de l'offre",     icon: "banknote", cta: "Relancer le vendeur" },
};
const DmNextAction = ({ deal, onTreat }) => {
  const T = Dm_useMT();
  const na = deal.nextAction || {};
  const meta = DM_ACTION_META[na.kind] || { label: "Prochaine action", icon: "bolt", cta: "Traiter" };
  return (
    <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 22, padding: "18px 18px 16px", boxShadow: T.shadow, color: T.relanceInk, animation: "dmUp .5s cubic-bezier(.2,.8,.2,1) .04s both" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.relanceMuted }}>
        <DmIcon name="bolt" size={13} color={T.relanceMuted} sw={2} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Prochaine action</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, marginTop: 12 }}>{meta.label}</div>
      <div style={{ fontSize: 12.5, color: T.relanceMuted, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{na.note || "À planifier."}</div>
      {na.dueAt && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, color: T.relanceMuted, fontSize: 11.5, fontWeight: 700 }}>
          <DmIcon name="calendar" size={13} color={T.relanceMuted} sw={1.9} />Échéance · {dmDate(na.dueAt)}
        </div>
      )}
      <div style={{ display: "flex", marginTop: 15 }}>
        <button onClick={onTreat} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, cursor: "pointer", background: T.ctaBg, color: T.ctaInk, fontFamily: "inherit", fontSize: 14, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
          <DmIcon name={meta.icon} size={17} color={T.ctaInk} sw={2} />{meta.cta}
        </button>
      </div>
    </div>
  );
};

// ─── PARTIES (acheteur + bien) ───────────────────────────────────────────
const DmBuyerCard = ({ contact, onOpen }) => {
  const T = Dm_useMT();
  const initials = (contact.firstName[0] + contact.lastName[0]).toUpperCase();
  const cap = contact.criteria && contact.criteria.budgetMax;
  return (
    <DmCard pad={18} style={{ animation: "dmUp .5s cubic-bezier(.2,.8,.2,1) .06s both" }}>
      <DmEyebrow>Acheteur</DmEyebrow>
      <button onClick={onOpen} className="dmPress" style={{ width: "100%", textAlign: "left", marginTop: 12, padding: 14, background: T.cardSubtle, border: 0, borderRadius: 16, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 13 }}>
        <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={46}>{initials}</window.MAv>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.firstName} {contact.lastName}</span>
            {((contact.kyc && contact.kyc.status === "verified") || contact.identityVerified) && <DmVerifiedBadge size={17} />}
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 2 }}>Voir la fiche complète</div>
        </div>
        <DmIcon name="chevron-right" size={18} color={T.muted} sw={2} />
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <DmCircle size={42} title="Appeler" icon={<DmIcon name="phone" size={16} color={T.ink} sw={1.8} />} />
        <DmCircle size={42} title="E-mail" icon={<DmIcon name="mail" size={16} color={T.ink} sw={1.8} />} />
        <DmCircle size={42} title="Message" icon={<DmIcon name="message" size={16} color={T.ink} sw={1.8} />} />
        {cap && (
          <div style={{ flex: "1 1 120px", padding: "8px 14px", borderRadius: 14, background: T.cardSubtle, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 120 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>Capacité</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dmFmtCHF(cap)}</div>
          </div>
        )}
      </div>
    </DmCard>
  );
};

const DmBienCard = ({ bien, photo, onOpen }) => {
  const T = Dm_useMT();
  return (
    <DmCard pad={18} style={{ animation: "dmUp .5s cubic-bezier(.2,.8,.2,1) .08s both" }}>
      <DmEyebrow>Bien</DmEyebrow>
      <button onClick={onOpen} className="dmPress" style={{ width: "100%", textAlign: "left", marginTop: 12, border: 0, borderRadius: 16, overflow: "hidden", cursor: "pointer", fontFamily: "inherit", background: T.cardSubtle, padding: 0 }}>
        <div style={{ position: "relative", height: 132 }}>
          {photo
            ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><DmIcon name="home" size={30} color={T.ghost} sw={1.6} /></div>}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,9,12,0) 40%, rgba(8,9,12,0.7) 100%)" }} />
          <span style={{ position: "absolute", left: 11, bottom: 10, display: "inline-flex", alignItems: "center", gap: 6, height: 25, padding: "0 10px", borderRadius: 999, background: "rgba(8,9,12,0.5)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 11, fontWeight: 800 }}>
            <DmIcon name="camera" size={12} color="#fff" sw={1.9} />{bien.photoCount} photos
          </span>
        </div>
        <div style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 11.5, color: T.muted, fontWeight: 600 }}>
            <DmIcon name="location" size={13} color={T.muted} sw={1.7} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.addr}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 11 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums" }}>{dmFmtCHF(bien.transaction === "location" ? bien.rent : bien.price)}</div>
            <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{bien.area} m² · {bien.rooms} pièces</div>
          </div>
        </div>
      </button>
    </DmCard>
  );
};

// ─── SEGMENTED ───────────────────────────────────────────────────────────
const DM_TABS = [{ id: "apercu", label: "Aperçu" }, { id: "nego", label: "Négociation" }, { id: "activite", label: "Activité" }, { id: "docs", label: "Documents" }];
const DmSegmented = ({ tab, setTab, negoCount }) => {
  const T = Dm_useMT();
  return (
    <div style={{ display: "flex", gap: 5, width: "100%", justifyContent: "space-between" }}>
      {DM_TABS.map(t => {
        const on = t.id === tab;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: "0 0 auto", height: 40, padding: "0 13px", border: 0, cursor: "pointer", borderRadius: 999, fontFamily: "inherit", fontSize: 11.5, fontWeight: 800, letterSpacing: -0.3, color: on ? T.accentInk : T.inkSoft, background: on ? T.accent : T.card, boxShadow: on ? (T.mode === "dark" ? T.shadowSm : "0 6px 16px rgba(11,12,14,0.20)") : T.shadowSm, transition: "all .2s ease", display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

// ─── NÉGOCIATION : carte offre / contre-offre ────────────────────────────
const DmOfferCard = ({ offer, isCurrent, isCounter, i }) => {
  const T = Dm_useMT();
  const cond = offer.conditions || {};
  const condPills = [];
  if (cond.financing && cond.financing.active) condPills.push({ icon: "shield", label: `Financement ${cond.financing.days}j` });
  if (cond.sale && cond.sale.active) condPills.push({ icon: "home", label: "Vente d'un bien" });
  if (cond.diagnostic && cond.diagnostic.active) condPills.push({ icon: "file", label: "Expertise" });
  if (cond.occupancy && cond.occupancy.active) condPills.push({ icon: "calendar", label: "Libération" });
  return (
    <div style={{ position: "relative", paddingLeft: isCounter ? 22 : 0, animation: `dmUp .45s cubic-bezier(.2,.8,.2,1) ${(i * 0.05).toFixed(2)}s both` }}>
      {isCounter && <div style={{ position: "absolute", left: 8, top: -16, height: 30, width: 2, background: T.hair }} />}
      {isCounter && <div style={{ position: "absolute", left: 8, top: 14, width: 12, height: 2, background: T.hair }} />}
      <div style={{ background: isCurrent ? T.card : T.cardSubtle, borderRadius: 18, padding: 16, boxShadow: isCurrent ? `0 0 0 2px ${T.ink} inset, ${T.shadowSm}` : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, background: isCounter ? T.cardSubtle : T.ink, display: "grid", placeItems: "center", boxShadow: isCounter ? T.shadowSm : "none" }}>
            <DmIcon name={isCounter ? "refresh" : "arrow-up"} size={15} color={isCounter ? T.ink : (T.mode === "dark" ? "#0B0C0E" : "#fff")} sw={2} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>{isCounter ? "Contre-offre · vendeur" : "Offre · acheteur"}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{offer.byLabel}</div>
          </div>
          {isCurrent && <DmStatusPill label="En cours" color={T.ink} />}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: -0.6, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{dmFmtCHF(offer.amount)}</div>
          {offer.deposit && <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>+ {dmFmtCHF(offer.deposit)} acompte</div>}
        </div>
        {condPills.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 13 }}>
            {condPills.map((c, k) => <DmMetaPill key={k} icon={c.icon}>{c.label}</DmMetaPill>)}
          </div>
        )}
        {cond.other && (
          <div style={{ marginTop: 13, padding: "10px 13px", borderRadius: 12, background: isCurrent ? T.cardSubtle : T.card, fontSize: 12, color: T.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{cond.other}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 13, flexWrap: "wrap" }}>
          {offer.expiresAt && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, fontWeight: 700 }}>
              <DmIcon name="clock" size={12} color={T.muted} sw={1.9} />Expire {dmDateTime(offer.expiresAt)}
            </span>
          )}
          {offer.attachments && offer.attachments.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, fontWeight: 700 }}>
              <DmIcon name="file" size={12} color={T.muted} sw={1.9} />{offer.attachments.length} pièce{offer.attachments.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── NÉGOCIATION · bento blanc (concept A2) ──────────────────────────────
const dmTime = (iso) => iso ? new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }) : "—";
const dmCondPills = (cond) => {
  const p = [];
  if (cond.financing && cond.financing.active) p.push({ icon: "shield", label: `Financement ${cond.financing.days}j` });
  if (cond.sale && cond.sale.active) p.push({ icon: "home", label: "Vente d'un bien" });
  if (cond.diagnostic && cond.diagnostic.active) p.push({ icon: "file", label: "Expertise" });
  if (cond.occupancy && cond.occupancy.active) p.push({ icon: "calendar", label: "Libération" });
  return p;
};
// Pastille statut noire (theme-safe)
const DmBlackPill = ({ children }) => {
  const T = Dm_useMT();
  const ink = T.mode === "dark" ? "#0B0C0E" : "#fff";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 999, background: T.ink, color: ink, fontSize: 10.5, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
};
// Tuile-stat compacte (triptyque)
const DmStatTile = ({ label, value, sub }) => {
  const T = Dm_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 18, boxShadow: T.shadowSm, padding: 14, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, letterSpacing: -0.5, marginTop: 8, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, marginTop: 3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
};
// Rappel d'une offre antérieure (tuile slim)
const DmOfferRecap = ({ offer, bien, tour }) => {
  const T = Dm_useMT();
  const isCounter = offer.kind === "counter";
  const fullPrice = bien && bien.price && offer.amount === bien.price;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 16px", borderRadius: 18, background: T.card, boxShadow: T.shadowSm, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1) .06s both" }}>
      <span style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
        <DmIcon name={isCounter ? "refresh" : "arrow-up"} size={15} color={T.inkSoft} sw={2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>{isCounter ? "Contre-offre · vendeur" : "Offre · acheteur"}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: T.ink, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>{dmFmtCHF(offer.amount)}</span>
        </div>
      </div>
      {tour != null && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ghost }}>Tour {tour}</span>}
    </div>
  );
};

const DmNegotiation = ({ offers, bien, lastOffer, onCounter }) => {
  const T = Dm_useMT();
  if (!offers.length) {
    return (
      <DmCard pad={22} style={{ textAlign: "center", animation: "dmUp .45s cubic-bezier(.2,.8,.2,1)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: T.cardSubtle, display: "grid", placeItems: "center", margin: "4px auto 14px" }}>
          <DmIcon name="banknote" size={24} color={T.muted} sw={1.7} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Aucune offre déposée</div>
        <div style={{ fontSize: 12.5, color: T.muted, fontWeight: 600, marginTop: 6, lineHeight: 1.5, maxWidth: 240, marginInline: "auto" }}>Quand l'acheteur sera prêt, saisissez son offre formelle pour suivre la négociation ici.</div>
        <button onClick={onCounter} style={{ marginTop: 16, height: 44, padding: "0 22px", borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <DmIcon name="plus" size={15} color={T.accentInk} sw={2.4} />Saisir une offre
        </button>
      </DmCard>
    );
  }

  // Tour courant = dernière offre (héros bento) ; antérieures = rappels slim.
  const current = offers[offers.length - 1];
  const isCounter = current.kind === "counter";
  const priors = offers.slice(0, -1).reverse();
  const prev = offers.length >= 2 ? offers[offers.length - 2] : null;
  const refBase = prev ? prev.amount : (bien && bien.price) || null;
  const spread = refBase != null ? current.amount - refBase : null;
  const pct = (spread != null && refBase) ? (spread / refBase) * 100 : null;
  const refLabel = prev ? (prev.kind === "counter" ? "la contre-offre" : "l'offre acheteur") : "le prix affiché";
  const sign = spread > 0 ? "+" : spread < 0 ? "\u2212" : "";
  const condPills = dmCondPills(current.conditions || {});
  const other = (current.conditions || {}).other;
  const depPct = current.deposit ? Math.round((current.deposit / current.amount) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Héros — tour courant */}
      <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: 20, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: T.cardSubtle, display: "grid", placeItems: "center" }}>
              <DmIcon name={isCounter ? "refresh" : "arrow-up"} size={13} color={T.inkSoft} sw={2} />
            </span>
            <span style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isCounter ? "Contre-offre · vendeur" : "Offre · acheteur"}</span>
          </div>
          {current.status === "pending" && <DmBlackPill>En attente</DmBlackPill>}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: T.ink, letterSpacing: -1.3, lineHeight: 1, marginTop: 16, fontVariantNumeric: "tabular-nums" }}>{dmFmtCHF(current.amount)}</div>
        {spread != null && spread !== 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>
            <DmIcon name={spread > 0 ? "arrow-up" : "arrow-down"} size={13} color={T.inkSoft} sw={2.2} />{dmFmtCHF(Math.abs(spread))} {spread > 0 ? "au-dessus de" : "en dessous de"} {refLabel}
          </div>
        )}
        {(condPills.length > 0 || other) && (
          <React.Fragment>
            {condPills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 15 }}>
                {condPills.map((c, k) => <DmMetaPill key={k} icon={c.icon}>{c.label}</DmMetaPill>)}
              </div>
            )}
            {other && (
              <div style={{ marginTop: 12, padding: "10px 13px", borderRadius: 12, background: T.cardSubtle, fontSize: 12, color: T.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>{other}</div>
            )}
          </React.Fragment>
        )}
      </div>

      {/* Triptyque de stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <DmStatTile
          label="Écart"
          value={pct != null ? (spread === 0 ? "0 %" : sign + Math.abs(pct).toFixed(1).replace(".", ",") + " %") : "—"}
          sub={spread != null ? (spread === 0 ? "Plein prix" : sign + "CHF " + Math.abs(Math.round(spread / 1000)) + "k") : null}
        />
        <DmStatTile
          label="Acompte"
          value={current.deposit ? "CHF " + Math.round(current.deposit / 1000) + "k" : "—"}
          sub={depPct != null ? depPct + " %" : null}
        />
        <DmStatTile
          label="Expire le"
          value={current.expiresAt ? dmDate(current.expiresAt) : "—"}
          sub={current.expiresAt ? dmTime(current.expiresAt) : null}
        />
      </div>

      {/* Offres antérieures */}
      {priors.map((o) => {
        const tour = offers.indexOf(o) + 1;
        return <DmOfferRecap key={o.id} offer={o} bien={bien} tour={tour} />;
      })}

      {/* MEGGA AI */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 15px", borderRadius: 16, background: T.card, boxShadow: T.shadowSm, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1) .12s both" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: T.ink, display: "grid", placeItems: "center" }}>
          <DmIcon name="sparkle" size={15} color={T.mode === "dark" ? "#0B0C0E" : "#fff"} sw={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 }}>MEGGA AI · analyse</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, lineHeight: 1.5 }}>
            {pct != null && spread !== 0 ? `Le tour courant se place ${sign}${Math.abs(pct).toFixed(1).replace(".", ",")} % par rapport à ${refLabel}. ` : ""}Position raisonnable au regard des comparables du quartier — la contre-offre est cohérente.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ACTIVITÉ (timeline fusionnée) ───────────────────────────────────────
const DmTimeline = ({ items }) => {
  const T = Dm_useMT();
  return (
    <DmCard pad={18} style={{ animation: "dmUp .45s cubic-bezier(.2,.8,.2,1)" }}>
      <DmEyebrow>Timeline du deal</DmEyebrow>
      <div style={{ position: "relative", paddingLeft: 20, marginTop: 16 }}>
        <div style={{ position: "absolute", left: 6, top: 4, bottom: 4, width: 2, background: T.cardSubtle, borderRadius: 999 }} />
        {items.map((e, i) => {
          const big = e.kind === "offer" || e.kind === "counter";
          return (
            <div key={i} style={{ position: "relative", marginBottom: i === items.length - 1 ? 0 : 18 }}>
              <span style={{ position: "absolute", left: -20, top: 3, width: 13, height: 13, borderRadius: 999, background: big ? T.ink : T.cardSubtle, border: `3px solid ${T.card}`, boxShadow: T.shadowSm }} />
              <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, marginBottom: 3, fontVariantNumeric: "tabular-nums" }}>{dmDateTime(e.at)}</div>
              <div style={{ fontSize: 13, color: T.ink, fontWeight: 700, lineHeight: 1.45 }}>
                {e.label}
                {e.detail && <span style={{ marginLeft: 8, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>· {e.detail}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </DmCard>
  );
};

// ─── MODAL « AJOUTER UN DOCUMENT » (Sugar pur, theme-aware) ──────────────
const DM_DOC_TYPES = ["Offre", "Bon de visite", "KYC", "Compromis", "Acte", "Diagnostic", "Autre"];
const dmFmtSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " Mo";
};
const DmDocImportModal = ({ onClose, onAdd }) => {
  const T = Dm_useMT();
  const fileRef = React.useRef(null);
  const [file, setFile] = React.useState(null);     // { name, size }
  const [type, setType] = React.useState("Offre");
  const [name, setName] = React.useState("");
  const [drag, setDrag] = React.useState(false);
  const [nameFocus, setNameFocus] = React.useState(false);
  const ink = T.mode === "dark" ? "#0B0C0E" : "#fff";

  const takeFile = (f) => {
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };
  const onPick = (e) => takeFile(e.target.files && e.target.files[0]);
  const onDrop = (e) => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files && e.dataTransfer.files[0]); };

  const ready = !!(file || name.trim());
  const submit = () => {
    if (!ready) return;
    onAdd({
      name: (name.trim() || (file && file.name) || `Document ${type}`),
      status: "added",
      meta: file ? `${type} · ${dmFmtSize(file.size)}` : `${type} · ajouté`,
    });
    onClose();
  };

  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 24,
      background: T.mode === "dark" ? "rgba(4,5,7,0.62)" : "rgba(12,16,22,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: "dmScrim .22s ease both" }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, maxHeight: "100%", overflowY: "auto", background: T.card, borderRadius: 28, boxShadow: T.shadowLg, padding: 24, animation: "dmPop .42s cubic-bezier(.2,.8,.2,1) both" }}>
        <style>{`@keyframes dmScrim{from{opacity:0}to{opacity:1}}@keyframes dmPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}`}</style>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: -0.5 }}>Ajouter un document</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer", background: T.cardSubtle, display: "grid", placeItems: "center" }}>
            <DmIcon name="close" size={17} color={T.inkSoft} sw={2} />
          </button>
        </div>

        {/* Dropzone / fichier choisi */}
        <input ref={fileRef} type="file" onChange={onPick} style={{ display: "none" }} />
        {!file ? (
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            style={{ width: "100%", marginTop: 18, padding: "30px 18px", borderRadius: 18, cursor: "pointer", textAlign: "center",
              background: drag ? (T.mode === "dark" ? "rgba(255,255,255,0.06)" : "#F0F2F6") : T.cardSubtle,
              border: 0, boxShadow: drag ? `0 0 0 2px ${T.ink} inset` : "none", transition: "all .16s ease", fontFamily: "inherit" }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: T.card, display: "grid", placeItems: "center", margin: "0 auto 14px", boxShadow: T.shadowSm }}>
              <DmIcon name="upload" size={22} color={T.ink} sw={1.9} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>Glissez un fichier ici</div>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginTop: 4 }}>ou cliquez pour parcourir · PDF, JPG, PNG</div>
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: "13px 14px", borderRadius: 16, background: T.cardSubtle }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
              <DmIcon name="file" size={19} color={T.inkSoft} sw={1.7} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginTop: 2 }}>{dmFmtSize(file.size)}</div>
            </div>
            <button onClick={() => setFile(null)} title="Retirer" style={{ width: 32, height: 32, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer", background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
              <DmIcon name="trash" size={15} color={T.muted} sw={1.9} />
            </button>
          </div>
        )}

        {/* Type */}
        <DmEyebrow style={{ marginTop: 20, marginBottom: 10 }}>Type de document</DmEyebrow>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DM_DOC_TYPES.map((t) => {
            const on = t === type;
            return (
              <button key={t} onClick={() => setType(t)} style={{ height: 36, padding: "0 15px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: -0.1, transition: "all .15s ease",
                background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft, boxShadow: on ? T.shadowSm : "none" }}>{t}</button>
            );
          })}
        </div>

        {/* Nom */}
        <DmEyebrow style={{ marginTop: 20, marginBottom: 10 }}>Nom du document</DmEyebrow>
        <input value={name} onChange={(e) => setName(e.target.value)} onFocus={() => setNameFocus(true)} onBlur={() => setNameFocus(false)}
          placeholder="ex. Offre formelle — Dubois"
          style={{ width: "100%", height: 46, padding: "0 15px", borderRadius: 12, background: T.cardSubtle, border: 0, outline: "none", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: T.ink, boxShadow: nameFocus ? `0 0 0 2px ${T.ink} inset` : "none", transition: "box-shadow .15s ease", boxSizing: "border-box" }} />

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={onClose} style={{ height: 46, padding: "0 20px", borderRadius: 999, border: 0, cursor: "pointer", background: "transparent", color: T.muted, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700 }}>Annuler</button>
          <button onClick={submit} disabled={!ready} style={{ height: 46, padding: "0 22px", borderRadius: 999, border: 0, cursor: ready ? "pointer" : "not-allowed", background: ready ? T.accent : T.ghost, color: ready ? T.accentInk : (T.mode === "dark" ? "#0B0C0E" : "#fff"), fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8, transition: "all .15s ease" }}>
            <DmIcon name="plus" size={15} color={ready ? T.accentInk : (T.mode === "dark" ? "#0B0C0E" : "#fff")} sw={2.4} />Ajouter au deal
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── DOCUMENTS + NOTES ───────────────────────────────────────────────────
const DmDocs = ({ deal, offers, kycVerified }) => {
  const T = Dm_useMT();
  const stageIdx = DM_STAGE_ORDER.indexOf(deal.stage);
  const baseDocs = [];
  if (offers.length > 0) baseDocs.push({ name: `Offre formelle — ${offers[0].byLabel}`, status: "signed", meta: "4 pages" });
  if (offers.length > 1) baseDocs.push({ name: `Contre-offre — ${offers[1].byLabel}`, status: "pending", meta: "3 pages" });
  if (stageIdx >= 4) baseDocs.push({ name: "Bon de visite signé", status: "signed", meta: "2 pages" });
  if (stageIdx >= 5 && kycVerified) baseDocs.push({ name: "KYC acheteur — dossier complet", status: "signed", meta: "6 pages" });
  if (stageIdx >= 6) baseDocs.push({ name: "Compromis de vente", status: "missing", meta: "À générer" });
  if (stageIdx === 7) baseDocs.push({ name: "Acte authentique", status: "missing", meta: "À générer" });
  const [extraDocs, setExtraDocs] = React.useState([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const docs = [...extraDocs, ...baseDocs];
  const tone = { signed: { l: "Signé", c: "#059669" }, pending: { l: "En attente", c: "#C45A00" }, missing: { l: "À générer", c: T.muted }, added: { l: "Ajouté", c: "#1E5BC6" } };

  const [notes, setNotes] = React.useState("Acheteur très motivé, a déjà visité 2 fois. Aime la vue. Sensible au délai — préfère signer avant les vacances. Famille 4 enfants, l'aîné rentre au Collège en septembre.");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(notes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1)" }}>
      <DmCard pad={18}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <DmEyebrow>Documents du deal</DmEyebrow>
          <button onClick={() => setImportOpen(true)} style={{ height: 32, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <DmIcon name="plus" size={12} color={T.ink} sw={2.4} />Nouveau
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
          {docs.map((d, i) => {
            const tn = tone[d.status];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14, background: T.cardSubtle }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                  <DmIcon name="file" size={17} color={T.inkSoft} sw={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10.5, color: T.muted, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: tn.c }} />{tn.l} · {d.meta}
                  </div>
                </div>
                <DmIcon name="chevron-right" size={16} color={T.ghost} sw={2} />
              </div>
            );
          })}
        </div>
      </DmCard>

      {/* Notes privées */}
      <DmCard pad={18}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <DmEyebrow>Notes</DmEyebrow>
          {!editing && (
            <button onClick={() => { setDraft(notes); setEditing(true); }} style={{ height: 32, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <DmIcon name="edit" size={12} color={T.ink} sw={1.9} />Modifier
            </button>
          )}
        </div>
        {editing ? (
          <div style={{ marginTop: 12 }}>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={5} autoFocus className="dmTextarea" style={{ width: "100%", padding: 13, borderRadius: 14, background: T.cardSubtle, border: 0, fontFamily: "inherit", fontSize: 13, color: T.ink, lineHeight: 1.6, resize: "none", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={() => setEditing(false)} style={{ height: 38, padding: "0 16px", borderRadius: 999, border: 0, cursor: "pointer", background: "transparent", color: T.muted, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700 }}>Annuler</button>
              <button onClick={() => { setNotes(draft); setEditing(false); }} style={{ height: 38, padding: "0 18px", borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800 }}>Enregistrer</button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: 13, borderRadius: 14, background: T.cardSubtle, fontSize: 13, color: T.inkSoft, fontWeight: 500, lineHeight: 1.65 }}>{notes}</div>
        )}
      </DmCard>

      {importOpen && <DmDocImportModal onClose={() => setImportOpen(false)} onAdd={(d) => setExtraDocs((prev) => [d, ...prev])} />}
    </div>
  );
};

// ─── FOCUS « TRAITER » (sous-écran plein) ────────────────────────────────
const DmTreatScreen = ({ deal, contact, onBack, isTablet = false }) => {
  const T = Dm_useMT();
  const na = deal.nextAction || {};
  const meta = DM_ACTION_META[na.kind] || { label: "Prochaine action", icon: "bolt", cta: "Traiter" };
  const [status, setStatus] = React.useState(null);
  const initials = contact ? (contact.firstName[0] + contact.lastName[0]).toUpperCase() : "?";
  const steps = ({
    offer: ["Vérifier l'écart avec le prix demandé", "Préparer l'argumentaire vendeur", "Fixer un délai de réponse clair"],
    call:  ["Reprendre le contexte du deal", "Passer l'appel de relance", "Consigner le compte-rendu"],
    kyc:   ["Collecter la pièce d'identité", "Vérifier l'origine des fonds", "Rappel doux — non bloquant"],
    visit: ["Proposer 2 créneaux", "Confirmer l'adresse du bien", "Envoyer le bon de visite"],
  }[na.kind]) || ["Préparer le contexte", "Réaliser l'action", "Consigner le résultat"];

  // Sur tablette : on contraint la largeur et on passe en bento 2 colonnes
  const COL = isTablet ? 880 : 9999;
  const center = (extra) => ({ width: "100%", maxWidth: COL, marginLeft: "auto", marginRight: "auto", ...extra });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 24, background: T.canvas, display: "flex", flexDirection: "column", animation: "dmSlide .32s cubic-bezier(.2,.8,.2,1)" }}>
      <header style={{ flexShrink: 0, paddingTop: isTablet ? 26 : 56, paddingLeft: isTablet ? 32 : 16, paddingRight: isTablet ? 32 : 16, paddingBottom: 12 }}>
        <div style={center({ display: "flex", alignItems: "center", gap: 12 })}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <DmIcon name={status ? "arrow-left" : "close"} size={19} color={T.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: isTablet ? 18 : 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Traiter l'action</div>
          </div>
        </div>
      </header>
      <main className="dmScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isTablet ? "16px 32px 28px" : "14px 16px 24px" }}>
        {status ? (
          <div style={center({ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: isTablet ? "64px 18px" : "36px 18px", animation: "dmUp .5s cubic-bezier(.2,.8,.2,1)" })}>
            <div style={{ width: 76, height: 76, borderRadius: 999, background: status === "done" ? T.relanceBg : T.cardSubtle, display: "grid", placeItems: "center", boxShadow: status === "done" ? T.shadowLg : T.shadowSm, marginBottom: 22 }}>
              <DmIcon name={status === "done" ? "check" : "calendar"} size={32} color={status === "done" ? T.relanceInk : T.ink} sw={2.4} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: -0.6 }}>{status === "done" ? "C'est traité." : "Reporté à demain."}</div>
            <div style={{ fontSize: 13.5, color: T.muted, fontWeight: 600, lineHeight: 1.55, marginTop: 10, maxWidth: 280 }}>
              {status === "done" ? "Action consignée dans la timeline du deal." : `${meta.label} replanifiée. Elle réapparaîtra demain en tête du deal.`}
            </div>
          </div>
        ) : (
          <div style={center({ display: isTablet ? "grid" : "flex", flexDirection: "column", gridTemplateColumns: isTablet ? "1.05fr 0.95fr" : undefined, alignItems: isTablet ? "start" : undefined, gap: isTablet ? 16 : 12 })}>
            <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 24, padding: isTablet ? 24 : 20, color: T.relanceInk, boxShadow: T.shadowLg, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.16)", color: T.relanceInk, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>{meta.cta}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.relanceMuted }}>· {dmDateTime(na.dueAt)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 16 }}>
                <window.MAv bg={(contact && contact.avatarBg) || T.accent} ink="#fff" size={48}>{initials}</window.MAv>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isTablet ? 22 : 20, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.2 }}>{meta.label}</div>
                  <div style={{ fontSize: 13, color: T.relanceMuted, fontWeight: 600, marginTop: 5, lineHeight: 1.45 }}>{na.note}</div>
                </div>
              </div>
            </div>
            <DmCard pad={isTablet ? 22 : 18}>
              <DmEyebrow>Check-list</DmEyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, background: T.cardSubtle }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 800, color: T.ink, boxShadow: T.shadowSm, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: -0.1, lineHeight: 1.35 }}>{s}</div>
                  </div>
                ))}
              </div>
            </DmCard>
          </div>
        )}
      </main>
      {!status && (
        <div style={{ flexShrink: 0, padding: isTablet ? "12px 32px 24px" : "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
          <div style={center({ display: "flex", gap: 10, justifyContent: isTablet ? "flex-end" : "stretch" })}>
            <button onClick={() => setStatus("later")} style={{ height: 50, padding: "0 20px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <DmIcon name="calendar" size={16} color={T.ink} sw={1.9} />Reporter
            </button>
            <button onClick={() => setStatus("done")} style={{ flex: isTablet ? "0 0 auto" : 1, height: 50, padding: isTablet ? "0 28px" : 0, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
              <DmIcon name="check" size={18} color={T.accentInk} sw={2.4} />Marquer comme traité
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CONTRE-OFFRE (sous-écran plein, formulaire Sugar) ───────────────────
const DmCounterScreen = ({ deal, bien, lastOffer, onBack }) => {
  const T = Dm_useMT();
  const base = lastOffer ? lastOffer.amount : (bien ? bien.price : deal.value);
  const [amount, setAmount] = React.useState(base);
  const [conds, setConds] = React.useState({ financing: true, diagnostic: false, occupancy: false });
  const [delay, setDelay] = React.useState(5);
  const [done, setDone] = React.useState(false);
  const condDefs = [
    { id: "financing", label: "Sous réserve de financement", icon: "shield" },
    { id: "diagnostic", label: "Expertise indépendante", icon: "file" },
    { id: "occupancy", label: "Délai de libération", icon: "calendar" },
  ];
  const setAmt = (delta) => setAmount(a => Math.max(0, a + delta));

  if (done) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 26, background: T.canvas, display: "flex", flexDirection: "column", animation: "dmSlide .32s cubic-bezier(.2,.8,.2,1)" }}>
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <DmIcon name="arrow-left" size={19} color={T.ink} sw={2} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Contre-offre</div>
        </header>
        <main className="dmScroll" style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 18px", animation: "dmUp .5s cubic-bezier(.2,.8,.2,1)" }}>
            <div style={{ width: 76, height: 76, borderRadius: 999, background: T.relanceBg, display: "grid", placeItems: "center", boxShadow: T.shadowLg, marginBottom: 22 }}>
              <DmIcon name="check" size={32} color={T.relanceInk} sw={2.4} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: -0.6 }}>Contre-offre envoyée.</div>
            <div style={{ fontSize: 13.5, color: T.muted, fontWeight: 600, lineHeight: 1.55, marginTop: 10, maxWidth: 280 }}>
              {dmFmtCHF(amount)} proposés au vendeur. L'acheteur a {delay} jours pour répondre. Ajoutée à la négociation.
            </div>
          </div>
        </main>
        <div style={{ flexShrink: 0, display: "flex", padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
          <button onClick={onBack} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800 }}>Retour au deal</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 26, background: T.canvas, display: "flex", flexDirection: "column", animation: "dmSlide .32s cubic-bezier(.2,.8,.2,1)" }}>
      <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <DmIcon name="close" size={19} color={T.ink} sw={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{lastOffer ? "Répondre au vendeur" : "Nouvelle offre"}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>{lastOffer ? "Contre-offre" : "Saisir une offre"}</div>
        </div>
      </header>
      <main className="dmScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Montant — carte noire */}
        <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 24, padding: "22px 20px", color: T.relanceInk, boxShadow: T.shadowLg, animation: "dmUp .45s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.relanceMuted, letterSpacing: 1, textTransform: "uppercase" }}>Montant proposé</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.2, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{dmFmtCHF(amount)}</div>
          {lastOffer && <div style={{ fontSize: 12, color: T.relanceMuted, fontWeight: 600, marginTop: 6 }}>Dernière offre · {dmFmtCHF(lastOffer.amount)}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {[-50000, -10000, 10000, 50000].map(d => (
              <button key={d} onClick={() => setAmt(d)} style={{ flex: 1, minWidth: 64, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: "rgba(255,255,255,0.10)", color: T.relanceInk, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                {d > 0 ? "+" : "−"}{Math.abs(d) / 1000}k
              </button>
            ))}
          </div>
        </div>
        {/* Conditions */}
        <DmCard pad={18}>
          <DmEyebrow>Conditions suspensives</DmEyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {condDefs.map(c => {
              const on = conds[c.id];
              return (
                <button key={c.id} onClick={() => setConds(s => ({ ...s, [c.id]: !s[c.id] }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: T.cardSubtle, boxShadow: on ? `0 0 0 2px ${T.ink} inset` : "none", transition: "box-shadow .15s ease" }}>
                  <DmIcon name={c.icon} size={17} color={T.inkSoft} sw={1.8} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.1 }}>{c.label}</span>
                  <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: on ? T.ink : "transparent", boxShadow: on ? "none" : `inset 0 0 0 2px ${T.ghost}`, display: "grid", placeItems: "center" }}>
                    {on && <DmIcon name="check" size={13} color={T.mode === "dark" ? "#0B0C0E" : "#fff"} sw={2.6} />}
                  </span>
                </button>
              );
            })}
          </div>
        </DmCard>
        {/* Délai */}
        <DmCard pad={18}>
          <DmEyebrow>Délai d'expiration</DmEyebrow>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[3, 5, 7, 10].map(d => {
              const on = d === delay;
              return (
                <button key={d} onClick={() => setDelay(d)} style={{ flex: 1, height: 46, borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft, transition: "all .15s ease" }}>
                  {d}j
                </button>
              );
            })}
          </div>
        </DmCard>
      </main>
      <div style={{ flexShrink: 0, display: "flex", padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
        <button onClick={() => setDone(true)} style={{ flex: 1, height: 52, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          <DmIcon name="send" size={17} color={T.accentInk} sw={2} />{lastOffer ? "Envoyer la contre-offre" : "Déposer l'offre"} · {dmFmtCHF(amount)}
        </button>
      </div>
    </div>
  );
};

// ─── TOAST ───────────────────────────────────────────────────────────────
const DmToast = ({ text }) => {
  const T = Dm_useMT();
  if (!text) return null;
  return (
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 104, zIndex: 30, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 18px", borderRadius: 999, background: T.relanceBg, color: T.relanceInk, boxShadow: T.shadowLg, fontSize: 13, fontWeight: 700, animation: "dmToast .3s cubic-bezier(.2,.8,.2,1)" }}>
        <DmIcon name="check-circle" size={17} color="#34C796" />{text}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
//  ÉCRAN DÉTAIL DEAL MOBILE
// ═══════════════════════════════════════════════════════════════════════
// ─── Menu d'actions du deal (popover ancré sous le bouton •••) — concept A ──
const DmActionMenu = ({ onClose, onAction, paused, lost }) => {
  const T = Dm_useMT();
  const danger = T.mode === "dark" ? "#E0738C" : "#8E1F3D";
  const actions = [
    { id: "edit",   icon: "edit",     label: "Modifier le deal" },
    { id: "stage",  icon: "flag",     label: "Changer d'étape" },
    { id: "pdf",    icon: "download", label: "Exporter en PDF" },
    { id: "contact",icon: "user",     label: "Voir le contact" },
    { id: "pause",  icon: paused ? "refresh" : "pause", label: paused ? "Reprendre le deal" : "Mettre en pause" },
  ];
  const Row = ({ icon, label, destructive, last, onClick }) => (
    <button onClick={onClick} className="dmPress" style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "12px 15px", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderBottom: last ? "none" : `1px solid ${T.hair}` }}>
      <DmIcon name={icon} size={18} color={destructive ? danger : T.inkSoft} sw={1.85} />
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, color: destructive ? danger : T.ink }}>{label}</span>
    </button>
  );
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 14 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(11,12,14,0.32)", animation: "dmFade .18s ease both" }} />
      <div style={{ position: "absolute", top: 100, right: 16, width: 238, background: T.card, borderRadius: 18, boxShadow: T.mode === "dark" ? "0 24px 60px rgba(0,0,0,0.5)" : "0 24px 60px rgba(15,23,42,0.22), 0 4px 14px rgba(15,23,42,0.10)", overflow: "hidden", animation: "dmMenu .22s cubic-bezier(.2,.9,.3,1.2) both", transformOrigin: "top right" }}>
        {actions.map(a => <Row key={a.id} icon={a.icon} label={a.label} onClick={() => onAction(a.id)} />)}
        {lost
          ? <Row icon="refresh" label="Rouvrir le deal" last onClick={() => onAction("reopen")} />
          : <Row icon="close-circle" label="Marquer comme perdu" destructive last onClick={() => onAction("lost")} />}
      </div>
    </div>
  );
};

// ─── Bottom sheet générique (Sugar Pure) ────────────────────────────────
const DmBottomSheet = ({ title, subtitle, onClose, children }) => {
  const T = Dm_useMT();
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 22, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(11,12,14,0.40)", animation: "dmFade .2s ease both" }} />
      <div style={{ position: "relative", background: T.card, borderRadius: "26px 26px 0 0", boxShadow: T.mode === "dark" ? "0 -20px 60px rgba(0,0,0,0.5)" : "0 -20px 60px rgba(15,23,42,0.18)", paddingBottom: 30, animation: "dmUpSheet .32s cubic-bezier(.2,.8,.2,1) both", maxHeight: "82%", display: "flex", flexDirection: "column" }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: T.ghost, margin: "10px auto 6px", flexShrink: 0 }} />
        {title && (
          <div style={{ padding: "6px 20px 12px", flexShrink: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: -0.4 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 3 }}>{subtitle}</div>}
          </div>
        )}
        <div className="dmScroll" style={{ overflowY: "auto", padding: "0 16px" }}>{children}</div>
      </div>
    </div>
  );
};

// ─── Sheet · Changer d'étape ─────────────────────────────────────────────
const DmStageSheet = ({ current, onPick, onClose }) => {
  const T = Dm_useMT();
  const curIdx = DM_STAGE_ORDER.indexOf(current);
  return (
    <DmBottomSheet title="Changer d'étape" subtitle="Déplacer ce deal dans le pipeline" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingBottom: 6 }}>
        {DM_STAGE_ORDER.map((s, i) => {
          const st = DM_STAGES[s];
          const on = s === current;
          const done = i < curIdx;
          return (
            <button key={s} onClick={() => onPick(s)} className="dmPress" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: on ? T.cardSubtle : "transparent", boxShadow: on ? `0 0 0 2px ${T.ink} inset` : "none" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: st.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: on ? 800 : 700, color: done ? T.muted : T.ink, letterSpacing: -0.2 }}>{st.label}</span>
              {on && <DmIcon name="check" size={17} color={T.ink} sw={2.4} />}
              {done && <DmIcon name="check" size={15} color={T.ghost} sw={2} />}
            </button>
          );
        })}
      </div>
    </DmBottomSheet>
  );
};

// ─── Sheet · Partager le dossier ─────────────────────────────────────────
const DM_SHARE_OPTS = [
  { id: "link",  icon: "link",     label: "Copier le lien sécurisé", hint: "Valide 7 jours · lecture seule" },
  { id: "email", icon: "mail",     label: "Envoyer par e-mail",      hint: "Au client ou à un collègue" },
  { id: "agent", icon: "users",    label: "Partager à un agent",     hint: "Membre de votre agence" },
  { id: "print", icon: "download", label: "Télécharger le dossier",  hint: "PDF complet du deal" },
];
const DmShareSheet = ({ onClose, onPick }) => {
  const T = Dm_useMT();
  return (
    <DmBottomSheet title="Partager le dossier" subtitle="Antoine Picard · choisissez un canal" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 6 }}>
        {DM_SHARE_OPTS.map(o => (
          <button key={o.id} onClick={() => onPick(o.id)} className="dmPress" style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", borderRadius: 16, border: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: T.cardSubtle }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <DmIcon name={o.icon} size={18} color={T.ink} sw={1.85} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{o.label}</span>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 1 }}>{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </DmBottomSheet>
  );
};

// ─── Sheet · Voir le contact ─────────────────────────────────────────────
const DmContactSheet = ({ contact, onClose, onToast }) => {
  const T = Dm_useMT();
  if (!contact) return null;
  const initials = `${(contact.firstName || "")[0] || ""}${(contact.lastName || "")[0] || ""}`.toUpperCase();
  const rows = [
    { icon: "phone", label: contact.phone || "+41 79 000 00 00", act: "Appeler" },
    { icon: "mail",  label: contact.email || "antoine.picard@email.ch", act: "Écrire" },
  ];
  return (
    <DmBottomSheet onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "2px 4px 16px" }}>
        <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={52}>{initials}</window.MAv>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: -0.4 }}>{contact.firstName} {contact.lastName}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.muted, marginTop: 2 }}>Acheteur · dossier lié à ce deal</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8 }}>
        {rows.map(r => (
          <div key={r.icon} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: T.cardSubtle }}>
            <DmIcon name={r.icon} size={17} color={T.inkSoft} sw={1.85} />
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
            <button onClick={() => onToast(`${r.act} · ${contact.firstName}`)} className="dmPress" style={{ height: 32, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800 }}>{r.act}</button>
          </div>
        ))}
      </div>
    </DmBottomSheet>
  );
};

// ─── Sheet · Modifier le deal (montant) ──────────────────────────────────
const DmEditSheet = ({ value, onSave, onClose }) => {
  const T = Dm_useMT();
  const [amount, setAmount] = React.useState(value || 0);
  return (
    <DmBottomSheet title="Modifier le deal" subtitle="Ajuster le montant du deal" onClose={onClose}>
      <div style={{ background: T.ink, borderRadius: 18, padding: "18px 18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 1, textTransform: "uppercase" }}>Montant du deal</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.65)" }}>CHF</span>
          <input
            inputMode="numeric"
            value={amount ? amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019") : ""}
            onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ""), 10); setAmount(isNaN(n) ? 0 : n); }}
            placeholder="0"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, outline: "none", color: "#fff", fontFamily: "inherit", fontSize: 30, fontWeight: 800, letterSpacing: -1, fontVariantNumeric: "tabular-nums", padding: 0 }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>
          {amount === (value || 0)
            ? "Aucune modification"
            : `${amount > (value || 0) ? "+" : "\u2212"}${dmFmtCHF(Math.abs(amount - (value || 0)))} vs ${dmFmtCHF(value || 0)}`}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[-100000, -25000, 25000, 100000].map(d => (
            <button key={d} onClick={() => setAmount(a => Math.max(0, a + d))} className="dmPress" style={{ flex: 1, minWidth: 64, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: "rgba(255,255,255,0.10)", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {d > 0 ? "+" : "−"}{Math.abs(d) / 1000}k
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => onSave(amount)} className="dmPress" style={{ width: "100%", height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Enregistrer</button>
    </DmBottomSheet>
  );
};

const MobileDealDetailScreen = ({ dark = false, dealId: didProp, onBack }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const deals = window.CRM_DEALS || [];
  const baseDeal = deals.find(d => d.id === (didProp || "d-5")) || deals.find(d => d.id === "d-5") || deals[0];

  const [stageOverride, setStageOverride] = React.useState(null);
  const [tab, setTab] = React.useState("apercu");
  const [treating, setTreating] = React.useState(false);
  const [counter, setCounter] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [sheet, setSheet] = React.useState(null); // 'stage' | 'share' | 'contact' | 'edit'
  const [paused, setPaused] = React.useState(false);
  const [lost, setLost] = React.useState(false);
  const [valueOverride, setValueOverride] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const toastRef = React.useRef(null);
  const showToast = (txt) => { setToast(txt); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(null), 2400); };

  if (!baseDeal) return null;
  const deal = { ...baseDeal, ...(stageOverride ? { stage: stageOverride } : {}), ...(valueOverride != null ? { value: valueOverride } : {}) };

  const handleMenuAction = (id) => {
    setMenuOpen(false);
    if (id === "stage") { setSheet("stage"); return; }
    if (id === "share") { setSheet("share"); return; }
    if (id === "contact") { setSheet("contact"); return; }
    if (id === "edit") { setSheet("edit"); return; }
    if (id === "pdf") { showToast("Génération du PDF…"); setTimeout(() => showToast("PDF prêt · dossier-deal.pdf"), 1300); return; }
    if (id === "pause") { setPaused(p => { const np = !p; showToast(np ? "Deal mis en pause" : "Deal réactivé"); return np; }); return; }
    if (id === "lost") { setLost(true); showToast("Deal marqué comme perdu"); return; }
    if (id === "reopen") { setLost(false); showToast("Deal rouvert"); return; }
  };
  const contact = (window.CRM_CONTACTS || []).find(c => c.id === deal.contactId);
  const bien = deal.bienId ? (window.CRM_BIENS || []).find(b => b.id === deal.bienId) : null;
  const offers = (window.crmOfferChain ? window.crmOfferChain(deal.id) : []) || [];
  const lastOffer = offers[offers.length - 1];
  const kycVerified = !!(contact && contact.kyc && contact.kyc.status === "verified");

  // photo du bien (réutilise MT_PHOTO via heuristique adresse)
  const bienPhoto = React.useMemo(() => {
    if (!bien) return null;
    const P = window.MT_PHOTO || {};
    const norm = `${bien.title || ""} ${bien.addr || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes("carouge")) return P.carouge;
    if (norm.includes("champel")) return P.champel;
    if (norm.includes("cologny")) return P.cologny;
    if (norm.includes("eaux")) return P.eauxvives;
    return P.cologny;
  }, [bien]);

  // Timeline fusionnée (offres + activité du contact)
  const activity = React.useMemo(() => {
    const items = [];
    offers.forEach(o => items.push({ at: o.createdAt, kind: o.kind === "counter" ? "counter" : "offer", label: o.kind === "counter" ? `Contre-offre · ${o.byLabel}` : `Offre · ${o.byLabel}`, detail: dmFmtCHF(o.amount) }));
    (window.CRM_ACTIVITY || []).forEach(a => { if (a.contactId === deal.contactId) items.push({ at: a.at, kind: a.kind, label: a.text }); });
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    return items.slice(0, 9);
  }, [deal.contactId, offers]);

  const stageIdx = DM_STAGE_ORDER.indexOf(deal.stage);
  const canAdvance = stageIdx < DM_STAGE_ORDER.length - 1;
  const advance = () => {
    if (!canAdvance) return;
    const next = DM_STAGE_ORDER[stageIdx + 1];
    setStageOverride(next);
    showToast(`Étape avancée · ${DM_STAGES[next].label}`);
  };

  return (
    <window.MTCtx.Provider value={T}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: T.ink, position: "relative" }}>
        <style>{`@keyframes dmUp{from{transform:translateY(12px)}to{transform:none}}@keyframes dmSlide{from{transform:translateX(16px)}to{transform:none}}@keyframes dmToast{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes dmFade{from{opacity:0}to{opacity:1}}@keyframes dmMenu{from{transform:scale(.92) translateY(-6px)}to{transform:none}}@keyframes dmUpSheet{from{transform:translateY(100%)}to{transform:none}}.dmScroll::-webkit-scrollbar,.dmStepScroll::-webkit-scrollbar{display:none}.dmScroll,.dmStepScroll{scrollbar-width:none}.dmPress:active{transform:scale(.985)}.dmTextarea:focus{box-shadow:inset 0 0 0 2px ${T.ink}}`}</style>

        {/* Header */}
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 8 }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <DmIcon name="arrow-left" size={19} color={T.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}></div>
          <button onClick={() => setMenuOpen(v => !v)} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: menuOpen ? T.accent : T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0, transition: "background .2s ease" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill={menuOpen ? T.accentInk : T.ink} aria-hidden="true">
              <circle cx="4" cy="10" r="1.6" />
              <circle cx="10" cy="10" r="1.6" />
              <circle cx="16" cy="10" r="1.6" />
            </svg>
          </button>
        </header>

        {/* Onglets — barre fixe, 4 boutons immobiles sous le header (sans fond) */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "8px 16px 10px", background: "transparent" }}>
          <DmSegmented tab={tab} setTab={setTab} negoCount={offers.length} />
        </div>

        {/* Corps */}
        <main className="dmScroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <DmHero deal={deal} contact={contact} bien={bien} lastOffer={lastOffer} photo={bienPhoto} />
          <div key={tab} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "apercu" && <React.Fragment>
          {(lost || paused) && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 16, background: T.card, boxShadow: T.shadowSm, animation: "dmUp .4s cubic-bezier(.2,.8,.2,1)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", background: lost ? (T.mode === "dark" ? "rgba(224,115,140,0.16)" : "rgba(142,31,61,0.10)") : T.cardSubtle }}>
                <DmIcon name={lost ? "close-circle" : "pause"} size={17} color={lost ? (T.mode === "dark" ? "#E0738C" : "#8E1F3D") : T.inkSoft} sw={1.9} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{lost ? "Deal marqué comme perdu" : "Deal en pause"}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: T.muted, marginTop: 1 }}>{lost ? "Plus aucune relance programmée." : "Les relances sont suspendues."}</div>
              </div>
              <button onClick={() => lost ? handleMenuAction("reopen") : handleMenuAction("pause")} className="dmPress" style={{ height: 34, padding: "0 14px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{lost ? "Rouvrir" : "Reprendre"}</button>
            </div>
          )}
          <DmNextAction deal={deal} onTreat={() => setTreating(true)} />
          <DmBuyerCard contact={contact} onOpen={() => showToast("Ouverture de la fiche contact")} />
          {bien && <DmBienCard bien={bien} photo={bienPhoto} onOpen={() => showToast("Ouverture de la fiche bien")} />}
          </React.Fragment>}
            {tab === "nego" && <DmNegotiation offers={offers} bien={bien} lastOffer={lastOffer} onCounter={() => setCounter(true)} />}
            {tab === "activite" && <DmTimeline items={activity} />}
            {tab === "docs" && <DmDocs deal={deal} offers={offers} kycVerified={kycVerified} />}
          </div>
        </main>

        {/* CTA fixe */}
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
          {deal.stage !== "signed" && !lost && (
            <button onClick={() => setCounter(true)} style={{ height: 52, padding: "0 18px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <DmIcon name={lastOffer ? "refresh" : "plus"} size={16} color={T.ink} sw={2} />{lastOffer ? "Contre-offre" : "Offre"}
            </button>
          )}
          {lost ? (
            <button onClick={() => handleMenuAction("reopen")} style={{ flex: 1, height: 52, borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap" }}>
              <DmIcon name="refresh" size={18} color={T.ink} sw={2.2} />Rouvrir le deal
            </button>
          ) : (
            <button onClick={advance} disabled={!canAdvance} style={{ flex: 1, height: 52, borderRadius: 999, border: 0, cursor: canAdvance ? "pointer" : "default", background: canAdvance ? T.accent : T.cardSubtle, color: canAdvance ? T.accentInk : T.ghost, fontFamily: "inherit", fontSize: 15, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap" }}>
              {canAdvance ? <>Suivant</> : <><DmIcon name="check-circle" size={18} color={T.ghost} />Deal signé</>}
            </button>
          )}
        </div>

        <DmToast text={toast} />
        {menuOpen && <DmActionMenu paused={paused} lost={lost} onClose={() => setMenuOpen(false)} onAction={handleMenuAction} />}
        {sheet === "stage" && <DmStageSheet current={deal.stage} onClose={() => setSheet(null)} onPick={(s) => { setStageOverride(s); setSheet(null); showToast(`Étape · ${DM_STAGES[s].label}`); }} />}
        {sheet === "share" && <DmShareSheet onClose={() => setSheet(null)} onPick={(id) => { setSheet(null); showToast(id === "link" ? "Lien copié dans le presse-papier" : "Dossier partagé"); }} />}
        {sheet === "contact" && <DmContactSheet contact={contact} onClose={() => setSheet(null)} onToast={showToast} />}
        {sheet === "edit" && <DmEditSheet value={deal.value} onClose={() => setSheet(null)} onSave={(v) => { setValueOverride(v); setSheet(null); showToast("Montant mis à jour"); }} />}
        {treating && <DmTreatScreen deal={deal} contact={contact} onBack={() => setTreating(false)} />}
        {counter && <DmCounterScreen deal={deal} bien={bien} lastOffer={lastOffer} onBack={() => setCounter(false)} />}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileDealDetailScreen = MobileDealDetailScreen;
Object.assign(window, {
  DmIcon, DmCard, DM_STAGES, DM_STAGE_ORDER, dmFmtCHF, dmDate, dmDateTime,
  DmHero, DmNextAction, DmBuyerCard, DmBienCard, DmEyebrow, DmVerifiedBadge,
  DmNegotiation, DmTimeline, DmDocs, DmTreatScreen, DmCounterScreen, DmToast,
  DmStatusPill,
});
