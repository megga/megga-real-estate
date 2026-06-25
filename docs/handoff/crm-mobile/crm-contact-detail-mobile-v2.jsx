// MEGGA CRM — Fiche contact MOBILE · v2 « B+C » (Sugar Pure)
// Direction validée : onglets segmentés (Aperçu · Activité · Biens · Docs)
// + prochaine action en tête + barre d'actions fixe + drill-in des sections
// lourdes (Activité, Critères, Documents, KYC).
// Réutilise window.* : MTCtx, MT_LIGHT/DARK, MT_STAGE, MEIcon, MAv,
//   CRM_CONTACTS, CRM_BIENS, CRM_DEALS, CRM_STAGES.
// KYC = rappel doux NON-bloquant (CLAUDE.md).

const Cv2_useMT = () => React.useContext(window.MTCtx);
const CvIcon = ({ name, size = 18, color = "currentColor", sw = 1.7 }) =>
  window.MEIcon ? <window.MEIcon name={name} size={size} color={color} strokeWidth={sw} /> : null;

const cvFmtCHF = (n) => n == null ? "—" : "CHF " + (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'"));
const cvFmtDate = (iso) => new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "long" });

// ─── Primitives ──────────────────────────────────────────────────────────
const CvCard = ({ title, eyebrow, action, children, pad = 18, style }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: pad, ...style }}>
      {(title || action || eyebrow) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: children ? 14 : 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {eyebrow && <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</div>}
            {title && <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
};

const CvPill = ({ children }) => {
  const T = Cv2_useMT();
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{children}</span>;
};

const CvStatusPill = ({ label, color }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: color, color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{label}</span>
);

// Bouton « voir tout → » d'une section résumée
const CvSeeAll = ({ children, onClick }) => {
  const T = Cv2_useMT();
  return (
    <button onClick={onClick} style={{ height: 32, padding: "0 6px 0 12px", borderRadius: 999, border: 0, cursor: "pointer", background: "transparent", color: T.muted, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
      {children}<CvIcon name="chevron-right" size={15} color={T.muted} sw={2} />
    </button>
  );
};

const CvCircle = ({ icon, onClick, title, size = 34 }) => {
  const T = Cv2_useMT();
  return <button onClick={onClick} title={title} style={{ width: size, height: size, borderRadius: 999, border: 0, background: T.cardSubtle, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</button>;
};

// ─── Badge vérifié KYC (sceau bleu officiel — identique à Matching mobile) ─
// Sceau festonné, coche détourée en négatif (evenodd) → ressort en blanc sur tout fond.
const CV_SEAL_D = "M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z";
const CvVerifiedBadge = ({ size = 18, seal = "#0041D9", check = "#FFFFFF" }) => (
  <svg width={size} height={size} viewBox="0 0 19 19" style={{ flexShrink: 0, display: "block" }} aria-label="Vérifié">
    <circle cx="9.5" cy="9.5" r="5.6" fill={check} />
    <path d={CV_SEAL_D} fill={seal} fillRule="evenodd" clipRule="evenodd" />
  </svg>
);

// ─── HERO (identité + coordonnées, toujours visible) ─────────────────────
const CvHero = ({ contact, editing, draft, onField }) => {
  const T = Cv2_useMT();
  const typeLabel = { buyer: "Acheteur", seller: "Vendeur", tenant: "Locataire", landlord: "Propriétaire", mixed: "Mixte" }[contact.type] || contact.type;
  const statusLabel = { lead: "Lead", qualified: "Qualifié", active: "Actif", archived: "Archivé" }[contact.status] || contact.status;
  const sourceLabel = { website: "Site web", referral: "Recommandation", csv: "Import CSV", call: "Appel entrant", "walk-in": "Visite agence", AI: "Extraction IA", vcard: "vCard" }[contact.source] || contact.source;
  const ville = (contact.criteria && (contact.criteria.cities || [])[0]) || (contact.criteria && (contact.criteria.cantons || [])[0]) || "Genève";

  return (
    <div style={{ background: T.card, borderRadius: 24, boxShadow: T.shadowLg, padding: 20, animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={60}>{(contact.firstName[0] + contact.lastName[0]).toUpperCase()}</window.MAv>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <div style={{ display: "flex", gap: 7 }}>
              <input className="cvEdIn" value={draft.firstName} onChange={e => onField("firstName", e.target.value)} placeholder="Prénom" style={{ background: T.cardSubtle, borderRadius: 10, padding: "9px 11px", fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }} />
              <input className="cvEdIn" value={draft.lastName} onChange={e => onField("lastName", e.target.value)} placeholder="Nom" style={{ background: T.cardSubtle, borderRadius: 10, padding: "9px 11px", fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }} />
            </div>
          ) : (
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: T.ink, letterSpacing: -0.6, lineHeight: 1.05, display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ minWidth: 0, flexShrink: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{contact.firstName} {contact.lastName}</span>
              {contact.kyc && contact.kyc.status === "verified" && <CvVerifiedBadge size={18} />}
            </h1>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        <CvPill>{sourceLabel}</CvPill>
        <CvPill>{ville}</CvPill>
        {(contact.tags || []).slice(0, 1).map(tg => <CvPill key={tg}>{tg}</CvPill>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        {[{ label: "Téléphone", k: "phone", value: contact.phone, num: true }, { label: "E-mail", k: "email", value: contact.email }].map(it => (
          <div key={it.label} style={{ padding: "11px 13px", borderRadius: 14, background: T.cardSubtle, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>{it.label}</div>
            {editing ? (
              <input className="cvEdIn" value={draft[it.k]} onChange={e => onField(it.k, e.target.value)} inputMode={it.num ? "tel" : "email"} style={{ background: "transparent", padding: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, fontVariantNumeric: it.num ? "tabular-nums" : "normal" }} />
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: it.num ? "tabular-nums" : "normal" }}>{it.value}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PROCHAINE ACTION : méta partagée (carte + écran Traiter) ─────────────
const CV_KIND_META = {
  call: { label: "Appel de relance", icon: "phone", cta: "Faire l'appel", treatToast: "Appel passé", verb: "l'appel" },
  email: { label: "E-mail de suivi", icon: "mail", cta: "Écrire l'e-mail", treatToast: "E-mail envoyé", verb: "l'e-mail" },
  visit: { label: "Visite à organiser", icon: "calendar", cta: "Planifier", treatToast: "Visite planifiée", verb: "la visite" },
  kyc: { label: "Vérification KYC", icon: "shield", cta: "Ouvrir le KYC", treatToast: "KYC démarré", verb: "le KYC" },
};
const cvNextActionMeta = (deal) => {
  const na = deal && deal.nextAction;
  const kindMeta = CV_KIND_META[na ? na.kind : "call"] || { label: "Prochaine action", icon: "bolt", cta: "Traiter", treatToast: "Action traitée", verb: "l'action" };
  const note = (na && na.note) || "Recueillir l'intérêt après la visite Carouge.";
  const due = na && na.dueAt ? new Date(na.dueAt) : null;
  const dueLabel = due ? `${due.toLocaleDateString("fr-CH", { weekday: "short", day: "2-digit", month: "short" })} · ${due.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}` : "À planifier";
  return { na, kindMeta, note, due, dueLabel };
};

// ─── PROCHAINE ACTION (carte noire immersive, priorité) ──────────────────
const CvNextAction = ({ contact, deal, onTreat }) => {
  const T = Cv2_useMT();
  const { kindMeta, note } = cvNextActionMeta(deal);

  return (
    <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 22, padding: "18px 18px 16px", boxShadow: T.shadow, color: T.relanceInk, animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) .04s both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: T.relanceMuted }}>
          <CvIcon name="bolt" size={14} color={T.relanceMuted} sw={2} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>Prochaine action</span>
        </div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4, marginTop: 12 }}>{kindMeta.label}</div>
      <div style={{ fontSize: 12.5, color: T.relanceMuted, fontWeight: 600, marginTop: 4, lineHeight: 1.45 }}>{note}</div>
      <div style={{ display: "flex", gap: 9, marginTop: 15 }}>
        <button onClick={onTreat} style={{ flex: 1, height: 46, borderRadius: 999, border: 0, cursor: "pointer", background: T.ctaBg, color: T.ctaInk, fontFamily: "inherit", fontSize: 14, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
          <CvIcon name={kindMeta.icon} size={17} color={T.ctaInk} sw={2} />{kindMeta.cta}
        </button>
        <button onClick={onTreat} title="Replanifier" style={{ width: 46, height: 46, borderRadius: 999, flexShrink: 0, cursor: "pointer", border: `1px solid ${T.relanceBorder === "transparent" ? "rgba(255,255,255,.18)" : T.relanceBorder}`, background: "transparent", color: T.relanceInk, display: "grid", placeItems: "center" }}>
          <CvIcon name="calendar" size={18} color={T.relanceInk} sw={1.9} />
        </button>
      </div>
    </div>
  );
};

// ─── ÉCRAN « TRAITER » (adapté du Mode focus PC · une décision à la fois) ──
const CvTreatScreen = ({ contact, deal, onBack }) => {
  const T = Cv2_useMT();
  const { kindMeta, note, dueLabel } = cvNextActionMeta(deal);
  const [status, setStatus] = React.useState(null); // null | "done" | "later"
  const initials = (contact.firstName[0] + contact.lastName[0]).toUpperCase();

  // Étapes contextuelles selon le type d'action (remplacent les quick-actions PC)
  const steps = ({
    call: ["Ouvrir la pré-qualification critères", "Confirmer l'intérêt sur Carouge (b-103)", "Noter le compte-rendu dans l'activité"],
    email: ["Reprendre les 3 biens proposés", "Personnaliser l'objet et l'accroche", "Joindre le bon de visite signé"],
    visit: ["Proposer 2 créneaux cette semaine", "Confirmer l'adresse du bien", "Envoyer le bon de visite à signer"],
    kyc: ["Collecter pièce d'identité", "Vérifier l'origine des fonds", "Rappel doux — non bloquant"],
  }[deal && deal.nextAction ? deal.nextAction.kind : "call"]) || ["Préparer le contexte", "Réaliser l'action", "Consigner le résultat"];

  const treat = (s) => setStatus(s);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 24, background: T.canvas, display: "flex", flexDirection: "column", animation: "cv2Slide .32s cubic-bezier(.2,.8,.2,1) both" }}>
      <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <CvIcon name={status ? "arrow-left" : "close"} size={19} color={T.ink} sw={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>Mode focus · une décision</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Traiter l'action</div>
        </div>
      </header>

      <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 24px" }}>
        {status ? (
          <CvTreatComplete T={T} status={status} kindMeta={kindMeta} contact={contact} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Carte focus immersive — la décision à prendre maintenant */}
            <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 24, padding: 20, color: T.relanceInk, boxShadow: T.shadowLg, animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: "rgba(255,255,255,0.16)", color: T.relanceInk, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase" }}>{kindMeta.cta}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.relanceMuted }}>· {dueLabel}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 16 }}>
                <window.MAv bg={contact.avatarBg || T.accent} ink="#fff" size={48}>{initials}</window.MAv>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.2 }}>{kindMeta.label}</div>
                  <div style={{ fontSize: 13, color: T.relanceMuted, fontWeight: 600, marginTop: 5, lineHeight: 1.45 }}>{note}</div>
                </div>
              </div>
            </div>

            {/* MEGGA AI — suggestion contextuelle */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 16px", borderRadius: 16, background: T.cardSubtle }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", boxShadow: T.shadowSm }}>
                <CvIcon name="sparkle" size={15} color="#7C63F0" sw={1.8} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 }}>MEGGA AI</div>
                <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 600, lineHeight: 1.5 }}>3 biens ressortent pour ses critères (score moyen 78). Carouge (b-103) est le plus aligné — propose-le en priorité et cale une 2e visite.</div>
              </div>
            </div>

            {/* Check-list — étapes pour mener l'action */}
            <CvCard title={`Pour réaliser ${kindMeta.verb}`} eyebrow="Check-list">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, background: T.cardSubtle }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: T.card, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 800, color: T.ink, boxShadow: T.shadowSm, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: -0.1, lineHeight: 1.35 }}>{s}</div>
                  </div>
                ))}
              </div>
            </CvCard>
          </div>
        )}
      </main>

      {/* Barre de décision fixe — Marquer comme traité / Reporter */}
      {!status && (
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
          <button onClick={() => treat("later")} style={{ height: 50, padding: "0 20px", borderRadius: 999, border: 0, cursor: "pointer", background: T.cardSubtle, color: T.inkSoft, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <CvIcon name="calendar" size={16} color={T.ink} sw={1.9} />Reporter
          </button>
          <button onClick={() => treat("done")} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
            <CvIcon name="check" size={18} color={T.accentInk} sw={2.4} />Marquer comme traité
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Écran de fin du Mode focus mobile ───────────────────────────────────
const CvTreatComplete = ({ T, status, kindMeta, contact }) => {
  const done = status === "done";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "36px 18px 24px", animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ width: 76, height: 76, borderRadius: 999, background: done ? T.relanceBg : T.cardSubtle, display: "grid", placeItems: "center", boxShadow: done ? T.shadowLg : T.shadowSm, marginBottom: 22 }}>
        <CvIcon name={done ? "check" : "calendar"} size={32} color={done ? T.relanceInk : T.ink} sw={2.4} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: -0.6 }}>{done ? "C'est traité." : "Reporté à demain."}</div>
      <div style={{ fontSize: 13.5, color: T.muted, fontWeight: 600, lineHeight: 1.55, marginTop: 10, maxWidth: 280 }}>
        {done
          ? `${kindMeta.treatToast} — ${contact.firstName} ${contact.lastName}. L'activité a été consignée dans la timeline.`
          : `${kindMeta.label} replanifiée pour ${contact.firstName}. Elle réapparaîtra demain en tête de la fiche.`}
      </div>
    </div>
  );
};

// ─── SEGMENTED (sticky) ──────────────────────────────────────────────────
const CV_TABS = [{ id: "apercu", label: "Aperçu" }, { id: "activite", label: "Activité" }, { id: "biens", label: "Matching" }, { id: "docs", label: "Docs" }];
const CvSegmented = ({ tab, setTab, showBiens }) => {
  const T = Cv2_useMT();
  const tabs = CV_TABS.filter(t => t.id !== "biens" || showBiens);
  return (
    <div style={{ flexShrink: 0, zIndex: 6, padding: "10px 16px 12px", background: "transparent" }}>
      <div style={{ display: "flex", gap: 7 }}>
        {tabs.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 38, border: 0, cursor: "pointer", borderRadius: 999, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2, color: on ? T.accentInk : T.inkSoft, background: on ? T.accent : T.card, boxShadow: on ? (T.mode === "dark" ? T.shadowSm : "0 6px 16px rgba(11,12,14,0.20)") : T.shadowSm, transition: "all .2s ease" }}>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Timeline (partagée : onglet Activité + drill) ───────────────────────
const CV_TIMELINE = [
  { at: "2026-05-15T15:32:00", by: "system", cat: "MEGGA AI", tone: "#1E5BC6", title: "3 nouveaux biens proposés", detail: "b-103, b-101, b-102 — score moyen 78/100." },
  { at: "2026-05-12T10:15:00", by: "agt-1", cat: "Appel", tone: "#0891B2", title: "Appel sortant · 12 min", detail: "Pré-qualification critères. Insiste sur balcon et ascenseur." },
  { at: "2026-05-08T17:00:00", by: "agt-1", cat: "Document", tone: "#059669", title: "Bon de visite signé", detail: "Carouge 5p · 2 mai 2026 · signature électronique acheteur." },
  { at: "2026-05-02T14:30:00", by: "agt-1", cat: "Visite", tone: "#C45A00", title: "Visite physique · Carouge", detail: "Rue Ancienne 6 — feedback positif sur volumes, réserves sur cuisine." },
  { at: "2026-04-22T11:00:00", by: "agt-1", cat: "E-mail", tone: "#7A8088", title: "Proposition de 3 biens", detail: "Marie ouvre 2/3, clique sur Carouge (b-103) deux fois." },
  { at: "2026-04-02T09:00:00", by: "agt-1", cat: "Création", tone: "#7A8088", title: "Contact créé", detail: "Source : formulaire site web · transmis à Gregory." },
];
const CvTimelineList = ({ items }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((ev, i) => (
        <div key={i} style={{ background: T.cardSubtle, borderRadius: 16, padding: "13px 15px", animation: `cv2Up .45s cubic-bezier(.2,.8,.2,1) ${(i * 0.03).toFixed(2)}s both` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: ev.tone === "#7A8088" ? T.muted : ev.tone, color: "#fff", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{ev.cat}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{cvFmtDate(ev.at)}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{ev.title}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.5, marginTop: 3 }}>{ev.detail}</div>
        </div>
      ))}
    </div>
  );
};

// ─── Biens proposés (onglet Biens) ───────────────────────────────────────
const CV_BIEN_STATUS = {
  sent: { label: "Envoyé", tone: "#7A8088" }, viewed: { label: "Vu", tone: "#0891B2" },
  liked: { label: "Favori", tone: "#059669" }, visited: { label: "Visité", tone: "#1E5BC6" },
  rejected: { label: "Refusé", tone: "#EF4444" }, "to-send": { label: "À envoyer", tone: "#C45A00" },
};
// ─── Biens proposés = résultats du matching IA ───────────────────────────
// Réutilise la carte exacte de l'écran Matching mobile (window.MmMatchCard)
// pour une cohérence visuelle 1:1. Même contexte de thème (window.MTCtx).
const CvBiensList = ({ matches, onOpenBien }) => {
  const T = Cv2_useMT();
  const allMatches = window.CRM_MATCHES || [];
  const MatchCard = window.MmMatchCard;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {matches.map(({ bien, score, status }, i) => {
        const md = allMatches.find(m => m.bienId === bien.id) || {};
        const m = { bien, score, status, reasons: md.reasons || [] };
        if (MatchCard) {
          return (
            <div key={bien.id} style={{ animation: `cv2Up .45s cubic-bezier(.2,.8,.2,1) ${(i * 0.04).toFixed(2)}s both` }}>
              <MatchCard m={m} i={i} hideActions onOpen={onOpenBien ? () => onOpenBien({ bien, score, status, reasons: m.reasons }) : undefined} />
            </div>
          );
        }
        // Fallback minimal si le module Matching n'est pas chargé
        const sm = CV_BIEN_STATUS[status] || CV_BIEN_STATUS.sent;
        return (
          <div key={bien.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: 12, borderRadius: 16, background: T.cardSubtle }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</div>
              <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 3 }}>{cvFmtCHF(bien.price)} · {bien.area} m² · {bien.rooms} p.</div>
            </div>
            <CvStatusPill label={sm.label} color={sm.tone} />
          </div>
        );
      })}
    </div>
  );
};

// ─── FICHE ANNONCE (mobile) — ouverte au clic sur un bien du matching ─────
const CV_ENERGY_TONE = { A: "#059669", B: "#059669", C: "#65A30D", D: "#C45A00", E: "#C45A00", F: "#DC2626", G: "#DC2626" };
const cvBienPrice = (b) => b.price ? cvFmtCHF(b.price) : (b.rent ? `${cvFmtCHF(b.rent)}/mois` : "—");

const CvBienSheet = ({ item, onBack }) => {
  const T = Cv2_useMT();
  const { bien, score, status, reasons = [] } = item;
  const [showGallery, setShowGallery] = React.useState(false);
  const photos = window.mmBienPhotos ? window.mmBienPhotos(bien) : [(window.MM_PHOTO || {})[bien.id]].filter(Boolean);
  const cover = photos[0];
  const sm = CV_BIEN_STATUS[status] || CV_BIEN_STATUS.sent;
  const pos = reasons.filter(r => !/[−-]\s*\d/.test(r)).map(r => r.replace(/[+−-]\s*\d+/g, "").trim());

  const specs = [
    { label: "Surface", value: `${bien.area} m²`, icon: "ruler" },
    { label: "Pièces", value: `${bien.rooms}`, icon: "home" },
    bien.beds != null ? { label: "Chambres", value: `${bien.beds}`, icon: "bed" } : null,
    bien.baths != null ? { label: "Salles d'eau", value: `${bien.baths}`, icon: "bath" } : null,
    bien.year ? { label: "Année", value: `${bien.year}`, icon: "calendar" } : null,
    bien.energy ? { label: "Énergie", value: bien.energy, icon: "bolt", tone: CV_ENERGY_TONE[bien.energy] } : null,
  ].filter(Boolean);
  const stats = bien.stats || {};

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 22, background: T.canvas, display: "flex", flexDirection: "column", animation: "cv2Slide .32s cubic-bezier(.2,.8,.2,1) both" }}>
      <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <CvIcon name="arrow-left" size={19} color={T.ink} sw={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>Annonce · {bien.ref}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.title}</div>
        </div>
      </header>

      <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Cover → galerie */}
        <button onClick={() => photos.length && setShowGallery(true)} style={{ position: "relative", height: 220, borderRadius: 20, overflow: "hidden", border: 0, padding: 0, cursor: photos.length ? "pointer" : "default", background: T.cardSubtle, boxShadow: T.shadow }}>
          {cover
            ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}><CvIcon name="home" size={34} color={T.ghost} sw={1.6} /></div>}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,12,14,0.3) 0%, rgba(11,12,14,0) 32%, rgba(11,12,14,0) 60%, rgba(11,12,14,0.5) 100%)" }} />
          <span style={{ position: "absolute", top: 12, left: 12, display: "inline-flex", alignItems: "center", height: 26, padding: "0 11px", borderRadius: 999, background: "rgba(11,12,14,0.5)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 11, fontWeight: 800 }}>{sm.label}</span>
          {bien.photoCount > 0 && (
            <span style={{ position: "absolute", right: 12, bottom: 12, display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 12px", borderRadius: 999, background: "rgba(11,12,14,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 12, fontWeight: 800 }}>
              <CvIcon name="camera" size={14} color="#fff" sw={1.9} />{bien.photoCount} photos
            </span>
          )}
        </button>

        {/* Prix + score */}
        <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 25, fontWeight: 800, color: T.ink, letterSpacing: -0.8, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{cvBienPrice(bien)}</div>
              {bien.charges != null && <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginTop: 5 }}>+ {cvFmtCHF(bien.charges)} de charges{bien.rent ? "/mois" : ""}</div>}
            </div>
            {score != null && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: T.relanceBg, color: T.relanceInk, display: "grid", placeItems: "center", fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums", boxShadow: T.shadowSm }}>{score}</div>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>Match</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 12.5, color: T.muted, fontWeight: 600 }}>
            <CvIcon name="location" size={15} color={T.muted} sw={1.7} />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bien.addr}</span>
          </div>
        </div>

        {/* Specs */}
        <CvCard title="Caractéristiques">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {specs.map(s => (
              <div key={s.label} style={{ background: T.cardSubtle, borderRadius: 14, padding: "13px 11px", display: "flex", flexDirection: "column", gap: 8 }}>
                <CvIcon name={s.icon} size={17} color={s.tone || T.inkSoft} sw={1.7} />
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: s.tone || T.ink, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </CvCard>

        {/* Pourquoi ce match */}
        {pos.length > 0 && (
          <CvCard title="Pourquoi ce match" eyebrow="Matching IA">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {pos.map((r, k) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 12px", borderRadius: 999, background: T.cardSubtle, color: T.inkSoft, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: T.ink, fontWeight: 800 }}>+</span>{r}
                </span>
              ))}
            </div>
          </CvCard>
        )}

        {/* Atouts */}
        {(bien.features || []).length > 0 && (
          <CvCard title="Atouts du bien">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {bien.features.map(f => (
                <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 12.5, fontWeight: 700 }}>
                  <CvIcon name="check" size={14} color={T.ink} sw={2.2} />{f}
                </span>
              ))}
            </div>
          </CvCard>
        )}

        {/* Description */}
        {bien.desc && (
          <CvCard title="Description">
            <div style={{ fontSize: 13.5, color: T.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>{bien.desc}</div>
          </CvCard>
        )}

        {/* Diffusion */}
        {(bien.publishedTo || []).length > 0 && (
          <CvCard title="Diffusion" eyebrow={`${bien.visibility === "public" ? "En ligne" : "Privé"}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {bien.publishedTo.map(p => (
                <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px", borderRadius: 999, background: T.cardSubtle, color: T.ink, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "#059669" }} />{p}
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[{ k: "views", l: "Vues" }, { k: "favorites", l: "Favoris" }, { k: "visitRequests", l: "Visites" }].map(s => (
                <div key={s.k} style={{ background: T.cardSubtle, borderRadius: 14, padding: "12px 11px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", letterSpacing: -0.4 }}>{stats[s.k] != null ? stats[s.k] : "—"}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 0.4, textTransform: "uppercase", marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </CvCard>
        )}
      </main>

      {/* CTA fixe */}
      <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
        <button onClick={() => photos.length && setShowGallery(true)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
          <CvIcon name="camera" size={18} color={T.accentInk} sw={1.9} />Voir les {bien.photoCount || photos.length} photos
        </button>
      </div>

      {showGallery && window.MmGallery && <window.MmGallery photos={photos} start={0} title={bien.title} onClose={() => setShowGallery(false)} />}
    </div>
  );
};

// ─── Critères (résumé + détail) ──────────────────────────────────────────
const cvCriteriaItems = (criteria) => [
  { label: "Transaction", value: criteria.transaction === "vente" ? "Achat" : "Location", icon: "refresh" },
  { label: "Types", value: (criteria.types || []).join(", ") || "—", icon: "home" },
  { label: "Cantons", value: (criteria.cantons || []).join(", ") || "—", icon: "location" },
  { label: "Villes", value: (criteria.cities || []).join(", ") || "—", icon: "target" },
  { label: "Budget", value: criteria.budgetMin || criteria.budgetMax ? `${cvFmtCHF(criteria.budgetMin)} – ${cvFmtCHF(criteria.budgetMax)}` : "—", icon: "credit-card" },
  { label: "Surface", value: criteria.areaMin ? `dès ${criteria.areaMin} m²` : "—", icon: "ruler" },
  { label: "Pièces", value: criteria.roomsMin ? `dès ${criteria.roomsMin}` : "—", icon: "bed" },
];
const CvCriteriaGrid = ({ criteria }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {cvCriteriaItems(criteria).map(it => (
        <div key={it.label} style={{ background: T.cardSubtle, borderRadius: 14, padding: "12px 13px", display: "flex", alignItems: "flex-start", gap: 11, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: T.card, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CvIcon name={it.icon} size={14} color={T.inkSoft} sw={1.7} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>{it.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, lineHeight: 1.3 }}>{it.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const CvCriteriaGridGlass = ({ criteria }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
    {cvCriteriaItems(criteria).map(it => (
      <div key={it.label} style={{ background: "rgba(255,255,255,0.10)", borderRadius: 16, padding: "15px 15px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, backdropFilter: "blur(4px)" }}>
        <CvIcon name={it.icon} size={22} color="rgba(255,255,255,0.92)" sw={1.7} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{it.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: -0.1, lineHeight: 1.3 }}>{it.value}</div>
        </div>
      </div>
    ))}
  </div>
);

// ─── KYC (doux, non bloquant) ────────────────────────────────────────────
const cvKycMeta = (k, T) => ({
  verified: { label: "Vérifié", sub: "Conforme", tone: "#059669", verified: true },
  pending: { label: "En cours", sub: "Optionnel", tone: "#C45A00", verified: false },
  none: { label: "À démarrer", sub: "Optionnel", tone: T.muted, verified: false },
}[k.status] || { label: "À démarrer", sub: "Optionnel", tone: T.muted, verified: false });

const CvKycInline = ({ contact, onOpen }) => {
  const T = Cv2_useMT();
  const k = contact.kyc || { status: "none" };
  const m = cvKycMeta(k, T);
  const bandBg = m.verified ? "#059669" : T.ink;
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, overflow: "hidden", animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase" }}>Conformité KYC</span>
      </div>
      <div style={{ background: bandBg, padding: "17px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 2.6 4.6 5.4v6.1c0 5 3.4 8.1 7.4 9.5 4-1.4 7.4-4.5 7.4-9.5V5.4L12 2.6Z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m8.6 12 2.4 2.4 4.6-4.9" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: -0.2 }}>{m.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{m.verified ? "Dossier conforme" : "Dossier LBA"}</div>
        </div>
        {m.verified
          ? <CvIcon name="check" size={20} color="#fff" sw={2.6} />
          : <button onClick={onOpen} style={{ flexShrink: 0, height: 32, padding: "0 16px", borderRadius: 999, border: 0, cursor: "pointer", background: "#fff", color: T.ink, fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: -0.1 }}>Vérifier</button>}
      </div>
    </div>
  );
};

// ─── Documents ───────────────────────────────────────────────────────────
const CV_DOCS = [
  { name: "Bon de visite Carouge.pdf", type: "Bon de visite", date: "08 mai", size: "1,2 Mo", tone: "#0891B2" },
  { name: "Mandat de recherche acheteur.pdf", type: "Mandat", date: "12 avril", size: "840 Ko", tone: "#1E5BC6" },
  { name: "Pré-qualification financière UBS.pdf", type: "Financier", date: "04 avril", size: "2,1 Mo", tone: "#C45A00" },
];

// Bandeau immersif noir — synthèse du dossier + CTA Téléverser
const CvDocsHeader = ({ docs, onUpload }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ background: T.card, borderRadius: 22, padding: "19px 19px 17px", color: T.ink, boxShadow: T.shadow, animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: T.ink }}>Documents</div>
        </div>
        <button onClick={onUpload} style={{ flexShrink: 0, height: 40, padding: "0 18px", borderRadius: 999, border: 0, cursor: "pointer", background: T.ctaBg, color: T.ctaInk, fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center" }}>
          Téléverser
        </button>
      </div>
    </div>
  );
};

const CvDocsList = ({ docs }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {docs.map((d, i) => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: 14, borderRadius: 18, background: T.card, boxShadow: T.shadow, animation: `cv2Up .45s cubic-bezier(.2,.8,.2,1) ${(i * 0.04).toFixed(2)}s both` }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: `${d.tone}14`, display: "grid", placeItems: "center" }}>
            <CvIcon name="file" size={20} color={d.tone} sw={1.7} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
              <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px", borderRadius: 999, background: d.tone, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.1, whiteSpace: "nowrap" }}>{d.type}</span>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{d.size} · {d.date}</span>
            </div>
          </div>
          <CvCircle size={34} icon={<CvIcon name="download" size={15} color={T.inkSoft} sw={1.8} />} />
        </div>
      ))}
    </div>
  );
};

// ─── TÉLÉVERSER UN DOCUMENT (écran plein · Sugar Pure) ───────────────────
const CV_DOC_TYPES = [
  { id: "mandat", label: "Mandat" },
  { id: "visite", label: "Bon de visite" },
  { id: "identite", label: "Pièce d'identité" },
  { id: "financier", label: "Financier" },
  { id: "compromis", label: "Compromis" },
  { id: "autre", label: "Autre" },
];
const CV_UP_SOURCES = [
  { id: "camera", icon: "camera", label: "Photo", sub: "Scanner", mime: "image/jpeg", ext: "jpg", base: "Scan", multi: false },
  { id: "gallery", icon: "gallery", label: "Galerie", sub: "Multi-sélection", mime: "image/png", ext: "png", base: "Image", multi: true },
  { id: "files", icon: "copy", label: "Fichiers", sub: "Multi-sélection", mime: "application/pdf", ext: "pdf", base: "Document", multi: true },
];
let cvUpSeq = 0;

const CvUploadFileRow = ({ file, T, onRemove }) => {
  const done = file.progress >= 100;
  const isImg = file.ext !== "pdf";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", borderRadius: 14, background: T.cardSubtle, animation: "cv2Up .4s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: done ? T.relanceBg : T.card, display: "grid", placeItems: "center", boxShadow: done ? "none" : T.shadowSm, transition: "background .3s ease" }}>
        <CvIcon name={done ? "check" : (isImg ? "gallery" : "file")} size={done ? 19 : 17} color={done ? T.relanceInk : T.inkSoft} sw={done ? 2.4 : 1.7} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
        {done ? (
          <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 600, marginTop: 2 }}>{file.size} · Prêt</div>
        ) : (
          <div style={{ marginTop: 7, height: 5, borderRadius: 999, background: T.card, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${file.progress}%`, borderRadius: 999, background: T.accent, transition: "width .25s linear" }} />
          </div>
        )}
      </div>
      <button onClick={() => onRemove(file.id)} style={{ width: 30, height: 30, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: T.shadowSm }}>
        <CvIcon name={done ? "trash" : "close"} size={14} color={T.muted} sw={1.9} />
      </button>
    </div>
  );
};

const CvUploadScreen = ({ contact, onBack }) => {
  const T = Cv2_useMT();
  const [files, setFiles] = React.useState([]);
  const [docType, setDocType] = React.useState(null);
  const [phase, setPhase] = React.useState("pick"); // pick | done
  const timers = React.useRef({});
  React.useEffect(() => () => Object.values(timers.current).forEach(clearInterval), []);

  const addOne = (src, idx) => {
    cvUpSeq += 1;
    const id = "f" + cvUpSeq;
    const n = idx;
    const sizeKb = 180 + Math.floor(Math.random() * 2600);
    const file = {
      id, ext: src.ext,
      name: `${src.base} ${contact.lastName} ${n}.${src.ext}`,
      size: sizeKb > 1024 ? (sizeKb / 1024).toFixed(1).replace(".", ",") + " Mo" : sizeKb + " Ko",
      progress: 0,
    };
    setFiles(prev => [...prev, file]);
    timers.current[id] = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.id !== id) return f;
        const next = Math.min(100, f.progress + (12 + Math.random() * 16));
        if (next >= 100) { clearInterval(timers.current[id]); delete timers.current[id]; }
        return { ...f, progress: next };
      }));
    }, 180);
  };
  const addFile = (src) => {
    const existing = files.filter(f => f.ext === src.ext).length;
    // Galerie / Fichiers → multi-sélection (2–3 pièces) ; Photo → une à la fois
    const count = src.multi ? 2 + Math.floor(Math.random() * 2) : 1;
    for (let i = 0; i < count; i++) {
      setTimeout(() => addOne(src, existing + i + 1), i * 120);
    }
  };
  const removeFile = (id) => {
    if (timers.current[id]) { clearInterval(timers.current[id]); delete timers.current[id]; }
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const allDone = files.length > 0 && files.every(f => f.progress >= 100);
  const canSubmit = allDone && docType;

  if (phase === "done") {
    const tLabel = (CV_DOC_TYPES.find(d => d.id === docType) || {}).label || "Document";
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 26, background: T.canvas, display: "flex", flexDirection: "column", animation: "cv2Slide .32s cubic-bezier(.2,.8,.2,1) both" }}>
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CvIcon name="arrow-left" size={19} color={T.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>Documents</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Téléversement</div>
          </div>
        </header>
        <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "36px 18px 24px", animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ width: 76, height: 76, borderRadius: 999, background: T.relanceBg, display: "grid", placeItems: "center", boxShadow: T.shadowLg, marginBottom: 22 }}>
              <CvIcon name="check" size={32} color={T.relanceInk} sw={2.4} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: -0.6 }}>{files.length === 1 ? "Document ajouté." : `${files.length} documents ajoutés.`}</div>
            <div style={{ fontSize: 13.5, color: T.muted, fontWeight: 600, lineHeight: 1.55, marginTop: 10, maxWidth: 290 }}>
              Classé sous « {tLabel} » dans la fiche de {contact.firstName} {contact.lastName}. Date d'ajout consignée.
            </div>
          </div>
        </main>
        <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
          <button onClick={onBack} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: T.accent, color: T.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2 }}>Retour aux documents</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 26, background: T.canvas, display: "flex", flexDirection: "column", animation: "cv2Slide .32s cubic-bezier(.2,.8,.2,1) both" }}>
      <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <CvIcon name="close" size={19} color={T.ink} sw={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3 }}>Téléverser un document</div>
        </div>
      </header>

      <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 24px", display: "flex", flexDirection: "column", justifyContent: files.length === 0 ? "center" : "flex-start", gap: 12 }}>
        {/* Zone d'ajout */}
        {files.length === 0 ? (
          /* Empty state — bloc noir immersif (signature Sugar) */
          <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 28, padding: "34px 22px 22px", color: T.relanceInk, boxShadow: T.shadowLg, animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(255,255,255,0.12)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                <CvIcon name="upload" size={26} color={T.relanceInk} sw={1.8} />
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5 }}>Ajouter une pièce</div>
              <div style={{ fontSize: 12.5, color: T.relanceMuted, fontWeight: 600, marginTop: 6, lineHeight: 1.5, maxWidth: 240, marginLeft: "auto", marginRight: "auto" }}>Scannez, importez depuis la galerie ou choisissez un fichier</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginTop: 24 }}>
              {CV_UP_SOURCES.map(src => (
                <button key={src.id} onClick={() => addFile(src)} className="cvUpTile" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11, padding: "18px 8px", borderRadius: 18, border: 0, cursor: "pointer", background: "rgba(255,255,255,0.07)", fontFamily: "inherit", transition: "background .2s ease" }}>
                  <CvIcon name={src.icon} size={22} color={T.relanceInk} sw={1.6} />
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.relanceInk, letterSpacing: -0.2 }}>{src.label}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Ajouter d'autres pièces — carte compacte */
          <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: 14, animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
              {CV_UP_SOURCES.map(src => (
                <button key={src.id} onClick={() => addFile(src)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 8px", borderRadius: 14, border: 0, cursor: "pointer", background: T.cardSubtle, fontFamily: "inherit" }}>
                  <CvIcon name={src.icon} size={16} color={T.ink} sw={1.7} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.ink, letterSpacing: -0.2 }}>{src.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fichiers en cours / ajoutés */}
        {files.length > 0 && (
          <CvCard title="Pièces sélectionnées" eyebrow={`${files.length} fichier${files.length > 1 ? "s" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map(f => <CvUploadFileRow key={f.id} file={f} T={T} onRemove={removeFile} />)}
            </div>
          </CvCard>
        )}

        {/* Type de document */}
        {files.length > 0 && (
          <CvCard title="Type de document" eyebrow="Classement">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CV_DOC_TYPES.map(dt => {
                const on = dt.id === docType;
                return (
                  <button key={dt.id} onClick={() => setDocType(dt.id)} style={{ height: 38, padding: "0 16px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: -0.1, background: on ? T.accent : T.cardSubtle, color: on ? T.accentInk : T.inkSoft, boxShadow: on ? "0 0 0 2px " + T.accent + " inset" : "none", transition: "background .2s ease" }}>
                    {dt.label}
                  </button>
                );
              })}
            </div>
          </CvCard>
        )}
      </main>

      <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: T.tabBg, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: `inset 0 1px 0 ${T.hair}, 0 -8px 24px rgba(15,23,42,${T.mode === "dark" ? 0.3 : 0.05})` }}>
        <button onClick={() => canSubmit && setPhase("done")} disabled={!canSubmit} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: canSubmit ? "pointer" : "default", background: canSubmit ? T.accent : T.cardSubtle, color: canSubmit ? T.accentInk : T.ghost, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, transition: "background .2s ease, color .2s ease" }}>
          <CvIcon name="upload" size={17} color={canSubmit ? T.accentInk : T.ghost} sw={2} />
          {files.length === 0 ? "Sélectionnez une pièce"
            : !allDone ? "Chargement…"
            : !docType ? "Choisissez un type"
            : `Téléverser ${files.length} document${files.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
};

// ─── Deal mini (Aperçu) ──────────────────────────────────────────────────
const cvBienPhoto = (bien) => {
  if (!bien) return null;
  const P = window.MT_PHOTO || {};
  const norm = `${bien.title || ""} ${bien.addr || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  if (norm.includes("carouge")) return P.carouge;
  if (norm.includes("champel")) return P.champel;
  if (norm.includes("cologny")) return P.cologny;
  if (norm.includes("eauxvives")) return P.eauxvives;
  return null;
};

const CvDealMini = ({ deals, biens, onOpenDeal }) => {
  const T = Cv2_useMT();
  if (!deals.length) return null;
  return (
    <CvCard title={deals.length > 1 ? `${deals.length} deals en cours` : "Deal en cours"} style={{ animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map(d => {
          const bien = d.bienId ? biens.find(b => b.id === d.bienId) : null;
          const stage = (window.CRM_STAGES || {})[d.stage] || { label: d.stage, color: T.muted };
          const photo = cvBienPhoto(bien);
          return (
            <div key={d.id} style={{ position: "relative", minHeight: 168, borderRadius: 16, overflow: "hidden", background: T.cardSubtle, boxShadow: T.shadowSm }}>
              {photo
                ? <img src={photo} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><CvIcon name={bien ? "home" : "search"} size={34} color={T.ghost} sw={1.6} /></div>}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,9,12,0.34) 0%, rgba(8,9,12,0) 32%, rgba(8,9,12,0.18) 52%, rgba(8,9,12,0.88) 100%)" }} />

              {/* haut : étape */}
              <div style={{ position: "absolute", top: 11, left: 11, right: 11, display: "flex", alignItems: "center", gap: 7 }}>
                <CvStatusPill label={stage.label} color={stage.color} />
              </div>

              {/* bas : bien + valeur en surimpression */}
              <div style={{ position: "absolute", left: 14, right: 14, bottom: 13 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: -0.1, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>{bien ? bien.title : "Recherche active"}</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: "#fff", letterSpacing: -0.5, fontVariantNumeric: "tabular-nums", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{cvFmtCHF(d.value)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </CvCard>
  );
};

// ─── Matching IA — surface signature au dégradé MEGGA ────────────────────
const CV_MEGGA_GRAD = "radial-gradient(100% 88% at 13% 110%, #7C63F0 0%, rgba(124,99,240,0) 58%), radial-gradient(96% 88% at 88% 114%, #C44FB8 0%, rgba(196,79,184,0) 58%), radial-gradient(145% 110% at 50% 124%, #9A6AD9 0%, rgba(154,106,217,0) 64%), linear-gradient(180deg, #07060B 0%, #0C091A 42%, #170E2A 100%)";
const CvGlassChip = ({ children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,0.13)", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1, whiteSpace: "nowrap", backdropFilter: "blur(4px)" }}>{children}</span>
);
const CvCriteriaGradient = ({ criteria: c, matchCount, bestScore, onSeeAll }) => {
  const chips = [
    c.transaction === "vente" ? "Achat" : "Location",
    (c.cantons || []).join(", ") || null,
    (c.budgetMin || c.budgetMax) ? `${cvFmtCHF(c.budgetMin)} – ${cvFmtCHF(c.budgetMax)}` : null,
    c.roomsMin ? `dès ${c.roomsMin} p.` : null,
    c.areaMin ? `dès ${c.areaMin} m²` : null,
  ].filter(Boolean);
  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", padding: 19, color: "#fff", background: CV_MEGGA_GRAD, boxShadow: "0 12px 36px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.05)", animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) .04s both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>Matching IA</span>
        </div>
      </div>
      <h3 style={{ margin: "14px 0 0", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.4 }}>Critères de recherche</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        {chips.map(ch => <CvGlassChip key={ch}>{ch}</CvGlassChip>)}
      </div>
      {(c.mustHave || []).length > 0 && (
        <div style={{ marginTop: 13 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8 }}>Indispensable</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{c.mustHave.map(m => <CvGlassChip key={m}>{m}</CvGlassChip>)}</div>
        </div>
      )}
      <button onClick={onSeeAll} style={{ width: "100%", marginTop: 16, height: 44, borderRadius: 999, border: 0, cursor: "pointer", background: "#fff", color: "#0B0C0E", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        Affiner dans Matching <CvIcon name="arrow-right" size={16} color="#0B0C0E" sw={2} />
      </button>
    </div>
  );
};

// ─── Critères ÉDITABLES (mode édition) ───────────────────────────────────
const CvCritField = ({ label, value, onChange, suffix, num, placeholder }) => {
  const T = Cv2_useMT();
  return (
    <div style={{ background: T.cardSubtle, borderRadius: 14, padding: "11px 13px", minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: T.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <input
          className="cvEdIn"
          value={value == null ? "" : value}
          placeholder={placeholder || "—"}
          inputMode={num ? "numeric" : "text"}
          onChange={e => onChange(num ? (e.target.value.replace(/[^\d]/g, "") === "" ? null : parseInt(e.target.value.replace(/[^\d]/g, ""), 10)) : e.target.value)}
          style={{ flex: 1, minWidth: 0, background: "transparent", padding: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1, fontVariantNumeric: num ? "tabular-nums" : "normal" }}
        />
        {suffix && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: T.muted }}>{suffix}</span>}
      </div>
    </div>
  );
};
const CvCriteriaEdit = ({ criteria, onField }) => {
  const T = Cv2_useMT();
  const c = criteria || {};
  const joinArr = (a) => (a || []).join(", ");
  const splitArr = (s) => s.split(",").map(x => x.trim()).filter(Boolean);
  return (
    <div style={{ background: T.card, borderRadius: 22, boxShadow: T.shadow, padding: 18, animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 13 }}>Critères de recherche</div>
      {/* Transaction segmenté */}
      <div style={{ display: "flex", gap: 6, padding: 4, background: T.cardSubtle, borderRadius: 999, marginBottom: 10 }}>
        {[{ k: "vente", lab: "Achat" }, { k: "location", lab: "Location" }].map(o => {
          const on = (c.transaction || "vente") === o.k;
          return (
            <button key={o.k} onClick={() => onField("transaction", o.k)} style={{ flex: 1, height: 34, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, letterSpacing: -0.1, background: on ? T.ink : "transparent", color: on ? "#fff" : T.inkSoft }}>{o.lab}</button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <CvCritField label="Budget min" value={c.budgetMin} num suffix="CHF" onChange={v => onField("budgetMin", v)} />
        <CvCritField label="Budget max" value={c.budgetMax} num suffix="CHF" onChange={v => onField("budgetMax", v)} />
        <CvCritField label="Surface min" value={c.areaMin} num suffix="m²" onChange={v => onField("areaMin", v)} />
        <CvCritField label="Pièces min" value={c.roomsMin} num suffix="pces" onChange={v => onField("roomsMin", v)} />
        <div style={{ gridColumn: "1 / -1" }}>
          <CvCritField label="Types" value={joinArr(c.types)} placeholder="Appartement, Villa…" onChange={v => onField("types", splitArr(v))} />
        </div>
        <CvCritField label="Cantons" value={joinArr(c.cantons)} placeholder="GE, VD…" onChange={v => onField("cantons", splitArr(v))} />
        <CvCritField label="Villes" value={joinArr(c.cities)} placeholder="Genève…" onChange={v => onField("cities", splitArr(v))} />
        <div style={{ gridColumn: "1 / -1" }}>
          <CvCritField label="Indispensable" value={joinArr(c.mustHave)} placeholder="Balcon, Parking…" onChange={v => onField("mustHave", splitArr(v))} />
        </div>
      </div>
    </div>
  );
};

// ─── Onglet APERÇU (résumés + drill-in) ──────────────────────────────────
const CvOverview = ({ contact, deals, biens, setDrill, onOpenDeal, onGo }) => {
  const T = Cv2_useMT();
  const c = contact.criteria;
  const ms = (window.CRM_MATCHES || []).filter(m => m.contactId === contact.id);
  const bestScore = ms.length ? Math.max(...ms.map(m => m.score)) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CvDealMini deals={deals} biens={biens} onOpenDeal={onOpenDeal} />

      {c && (
        <CvCriteriaGradient criteria={c} matchCount={ms.length} bestScore={bestScore} onSeeAll={() => (onGo ? onGo("matching") : setDrill("criteria"))} />
      )}
    </div>
  );
};

// ─── DRILL-IN (écran plein dédié) ────────────────────────────────────────
const CvDrillScreen = ({ which, contact, onBack }) => {
  const T = Cv2_useMT();
  const titles = { activity: "Activité complète", criteria: "Critères de recherche", kyc: "Conformité KYC", docs: "Documents" };
  const subs = { activity: "Timeline unifiée · MEGGA AI", criteria: "Matching IA", kyc: "", docs: `${CV_DOCS.length} pièces` };
  const k = contact.kyc || { status: "none" };
  const m = cvKycMeta(k, T);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: T.canvas, display: "flex", flexDirection: "column", animation: "cv2Slide .32s cubic-bezier(.2,.8,.2,1) both" }}>
      <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", gap: 12, background: "transparent" }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: T.card, boxShadow: T.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <CvIcon name="arrow-left" size={19} color={T.ink} sw={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {subs[which] && <div style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{subs[which]}</div>}
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titles[which]}</div>
        </div>
      </header>
      <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px 36px", display: "flex", flexDirection: "column", justifyContent: which === "kyc" ? "center" : "flex-start" }}>
        <div style={{ background: which === "criteria" ? CV_MEGGA_GRAD : which === "kyc" ? "transparent" : T.card, borderRadius: 22, boxShadow: which === "criteria" ? "0 18px 42px rgba(60,22,96,0.32)" : which === "kyc" ? "none" : T.shadow, padding: which === "kyc" ? 0 : 18, overflow: "hidden" }}>
          {which === "activity" && <CvTimelineList items={CV_TIMELINE} />}
          {which === "criteria" && contact.criteria && (
            <>
              <CvCriteriaGridGlass criteria={contact.criteria} />
              {(contact.criteria.mustHave || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 9 }}>Indispensable</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{contact.criteria.mustHave.map(mm => <CvGlassChip key={mm}>{mm}</CvGlassChip>)}</div>
                </div>
              )}
            </>
          )}
          {which === "docs" && <CvDocsList docs={CV_DOCS} />}
          {which === "kyc" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Héro immersif noir */}
              <div style={{ background: T.relanceBg, border: `1px solid ${T.relanceBorder}`, borderRadius: 26, padding: "34px 22px 24px", color: T.relanceInk, boxShadow: T.shadowLg, textAlign: "center", animation: "cv2Up .5s cubic-bezier(.2,.8,.2,1) both" }}>
                <div style={{ display: "grid", placeItems: "center", margin: "0 auto" }}>
                  <CvIcon name={m.verified ? "check" : "shield"} size={48} color={m.verified ? "#34D399" : T.relanceInk} sw={m.verified ? 2.2 : 1.6} />
                </div>
                <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.6, marginTop: 18 }}>{m.label}</div>
                <div style={{ fontSize: 13, color: T.relanceMuted, fontWeight: 600, marginTop: 7 }}>{m.sub}</div>
                {!m.verified && (
                  <button style={{ width: "100%", marginTop: 26, height: 48, borderRadius: 999, border: 0, cursor: "pointer", background: T.ctaBg, color: T.ctaInk, fontFamily: "inherit", fontSize: 14, fontWeight: 800, letterSpacing: -0.2 }}>
                    Démarrer la vérification
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ─── Barre d'actions fixe ────────────────────────────────────────────────
const CvActionBar = () => {
  const T = Cv2_useMT();
  const acts = [
    { t: "Appeler", icon: "phone", cta: true }, { t: "E-mail", icon: "mail" },
    { t: "Message", icon: "message" }, { t: "Planifier", icon: "calendar" },
  ];
  return (
    <div style={{ flexShrink: 0, display: "flex", gap: 9, padding: "11px 16px 30px", background: "transparent" }}>
      {acts.map(a => (
        <button key={a.t} style={{ flex: a.cta ? 1.4 : 1, height: 50, borderRadius: 16, border: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: a.cta ? T.accent : T.cardSubtle, color: a.cta ? T.accentInk : T.inkSoft }}>
          <CvIcon name={a.icon} size={19} color={a.cta ? T.accentInk : T.ink} sw={1.9} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: -0.1 }}>{a.t}</span>
        </button>
      ))}
    </div>
  );
};

// ─── ÉCRAN ───────────────────────────────────────────────────────────────
const MobileContactScreenV2 = ({ dark = false, contactId: cidProp, initialTab = "apercu", onBack, onGo }) => {
  const T = dark ? { ...window.MT_DARK, stage: window.MT_STAGE.dark } : { ...window.MT_LIGHT, stage: window.MT_STAGE.light };
  const stageBg = dark ? "#121315" : "#D7DDE5";
  const Tx = { ...T, stage: stageBg, canvas: dark ? T.canvas : "radial-gradient(ellipse 130% 100% at 50% 40%, #DAE0E8 0%, #DDE2EA 55%, #DDE2EA 100%)" };
  const contacts = window.CRM_CONTACTS || [];
  const [internalId, setInternalId] = React.useState("c-001");
  const contactId = cidProp || internalId;
  const [tab, setTab] = React.useState(initialTab);
  const [drill, setDrill] = React.useState(null);
  const [treating, setTreating] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [bienSheet, setBienSheet] = React.useState(null);
  const [overrides, setOverrides] = React.useState({});
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [kycWarn, setKycWarn] = React.useState(false);
  const [kycInvalidate, setKycInvalidate] = React.useState(false);
  React.useEffect(() => { setTab(initialTab); setDrill(null); setEditing(false); setTreating(false); setUploading(false); setBienSheet(null); setKycWarn(false); setKycInvalidate(false); }, [cidProp, initialTab]);
  const baseContact = contacts.find(c => c.id === contactId) || contacts[0];
  if (!baseContact) return null;
  const contact = { ...baseContact, ...(overrides[contactId] || {}) };

  const startEdit = () => { setDraft({ firstName: contact.firstName, lastName: contact.lastName, phone: contact.phone, email: contact.email, criteria: { ...(contact.criteria || {}) } }); setEditing(true); };
  const saveEdit = () => {
    setOverrides(o => ({ ...o, [contactId]: { ...(o[contactId] || {}), ...draft, ...(kycInvalidate ? { kyc: { ...(contact.kyc || {}), status: "pending" } } : {}) } }));
    setEditing(false);
    if (kycInvalidate) setKycInvalidate(false);
  };
  const cancelEdit = () => { setEditing(false); setKycInvalidate(false); };
  const requestEdit = () => {
    if (contact.kyc && contact.kyc.status === "verified") { setKycWarn(true); return; }
    startEdit();
  };
  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setCriteria = (k, v) => setDraft(d => ({ ...d, criteria: { ...(d.criteria || {}), [k]: v } }));

  const deals = (window.CRM_DEALS || []).filter(d => d.contactId === contact.id);
  const primaryDeal = deals[0];
  const biensAll = window.CRM_BIENS || [];
  const matches = contact.type === "buyer" ? [
    { bien: biensAll.find(b => b.id === "b-103"), score: 94, status: "visited" },
    { bien: biensAll.find(b => b.id === "b-101"), score: 78, status: "viewed" },
    { bien: biensAll.find(b => b.id === "b-102"), score: 72, status: "sent" },
  ].filter(m => m.bien) : [];
  const showBiens = matches.length > 0;
  const others = contacts.filter(c => c.id !== contact.id).slice(0, 5);
  const effTab = (tab === "biens" && !showBiens) ? "apercu" : tab;

  const pickContact = (id) => { setInternalId(id); setTab("apercu"); setDrill(null); };

  return (
    <window.MTCtx.Provider value={Tx}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: Tx.canvas, fontFamily: "Manrope, system-ui, sans-serif", color: Tx.ink, position: "relative", "--cvink": Tx.ink }}>
        <style>{`@keyframes cv2Up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes cv2Slide{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}.cv2Scroll::-webkit-scrollbar{display:none}.cv2Scroll{scrollbar-width:none}.cvEdIn{border:0;outline:0;font-family:inherit;width:100%}.cvEdIn:focus{box-shadow:inset 0 0 0 2px var(--cvink)}.cvUpTile:active{background:rgba(255,255,255,0.16)!important}.cvDealRow:active{transform:scale(.985)}`}</style>

        {/* Header */}
        <header style={{ flexShrink: 0, paddingTop: 56, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", position: "relative", zIndex: 8 }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: Tx.card, boxShadow: Tx.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CvIcon name="arrow-left" size={19} color={Tx.ink} sw={2} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }} />
          <button onClick={editing ? cancelEdit : requestEdit} style={{ width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", background: editing ? Tx.cardSubtle : Tx.card, boxShadow: Tx.shadowSm, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <CvIcon name={editing ? "close" : "edit"} size={editing ? 19 : 17} color={Tx.ink} sw={1.9} />
          </button>
        </header>

        {/* Corps */}
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}><CvHero contact={contact} editing={editing} draft={draft} onField={setField} /></div>
        <CvSegmented tab={effTab} setTab={setTab} showBiens={showBiens} />
        <main className="cv2Scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div key={effTab}>
            {effTab === "apercu" && <CvOverview contact={contact} deals={deals} biens={biensAll} setDrill={setDrill} onGo={onGo} />}
            {effTab === "activite" && <CvCard title="Activité" eyebrow="Timeline unifiée" style={{ animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}><CvTimelineList items={CV_TIMELINE} /></CvCard>}
            {effTab === "biens" && showBiens && <CvCard title="Biens proposés" action={<CvSeeAll>Proposer</CvSeeAll>} style={{ animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}><CvBiensList matches={matches} onOpenBien={(item) => setBienSheet(item)} /></CvCard>}
            {effTab === "docs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "cv2Up .45s cubic-bezier(.2,.8,.2,1) both" }}>
                <CvDocsHeader docs={CV_DOCS} onUpload={() => setUploading(true)} />
                <CvDocsList docs={CV_DOCS} />
              </div>
            )}
          </div>
        </main>

        {editing ? (
          <div style={{ flexShrink: 0, display: "flex", gap: 10, padding: "11px 16px 30px", background: "transparent" }}>
            <button onClick={cancelEdit} style={{ height: 50, padding: "0 22px", borderRadius: 999, border: 0, cursor: "pointer", background: Tx.cardSubtle, color: Tx.inkSoft, fontFamily: "inherit", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>Annuler</button>
            <button onClick={saveEdit} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", background: Tx.accent, color: Tx.accentInk, fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
              Enregistrer
            </button>
          </div>
        ) : (
          <CvActionBar />
        )}

        {uploading && <CvUploadScreen contact={contact} onBack={() => setUploading(false)} />}
        {drill && <CvDrillScreen which={drill} contact={contact} onBack={() => setDrill(null)} />}
        {bienSheet && (window.MmBienSheet
          ? <window.MmBienSheet m={bienSheet} onBack={() => setBienSheet(null)} />
          : <CvBienSheet item={bienSheet} onBack={() => setBienSheet(null)} />)}

        {kycWarn && (
          <div onClick={() => setKycWarn(false)} style={{ position: "absolute", inset: 0, zIndex: 90, display: "flex", flexDirection: "column", justifyContent: "flex-end",
            background: Tx.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.34)", backdropFilter: "blur(6px)", animation: "cv2Up .28s ease both" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ margin: "0 10px calc(94px + env(safe-area-inset-bottom))", background: Tx.card, borderRadius: 28, boxShadow: Tx.shadowLg, overflow: "hidden",
              padding: "26px 22px 20px", animation: "cv2Up .4s cubic-bezier(.2,.8,.2,1) both" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: Tx.mode === "dark" ? "rgba(224,115,140,0.16)" : "#FBEAEF", display: "grid", placeItems: "center" }}>
                <CvIcon name="shield" size={26} color={Tx.mode === "dark" ? "#E0738C" : "#8E1F3D"} sw={1.9} />
              </div>
              <h3 style={{ margin: "18px 0 0", fontSize: 20, fontWeight: 800, color: Tx.ink, letterSpacing: -0.5 }}>Modifier un contact vérifié&nbsp;?</h3>
              <p style={{ margin: "9px 0 0", fontSize: 13.5, fontWeight: 500, color: Tx.inkSoft, lineHeight: 1.55, textWrap: "pretty" }}>
                Ce contact a un <b style={{ fontWeight: 700, color: Tx.ink }}>KYC vérifié</b>. Modifier son identité <b style={{ fontWeight: 700, color: Tx.ink }}>invalide la vérification</b> — toute la procédure LBA devra être recommencée depuis le début.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button onClick={() => setKycWarn(false)} style={{ flex: 1, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: Tx.cardSubtle, color: Tx.ink }}>Annuler</button>
                <button onClick={() => { setKycWarn(false); setKycInvalidate(true); startEdit(); }} style={{ flex: 1.3, height: 50, borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, background: Tx.mode === "dark" ? "#E0738C" : "#8E1F3D", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  Modifier
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </window.MTCtx.Provider>
  );
};

window.MobileContactScreenV2 = MobileContactScreenV2;

// Export des primitives pour réutilisation tablette (même contexte exact)
Object.assign(window, {
  CvHero, CvSegmented, CvOverview, CvDealMini, CvCriteriaGradient,
  CvTimelineList, CV_TIMELINE, CvCard, CvDocsHeader, CvDocsList, CV_DOCS,
  CvKycInline, CvActionBar, CvIcon, CvSeeAll, CvBiensList, CvStatusPill,
  CvUploadScreen, CvDrillScreen,
  CvPill, CvVerifiedBadge, cvFmtCHF, cvBienPhoto, Cv2_useMT, CV_TABS,
});
