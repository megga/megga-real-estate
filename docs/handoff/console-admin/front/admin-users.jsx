// MEGGA CRM — Console admin · UTILISATEURS
// ─────────────────────────────────────────────────────────────────────
// Portées de `AdminUsersPage` + `UserDrawer` du repo. La page « Clients
// finaux » (leads, messages storefront, table KYC nominative) est SUPPRIMÉE
// (juillet 2026) : parcourir les clients des agences n'est pas l'affaire de
// la plateforme. Reste : le tunnel agrégé en Vue d'ensemble + la recherche
// ciblée d'un lien KYC dans Support (`admin-support.jsx`).
// Recalages du projet : accent noir unique, aucune animation de survol,
// pilules pleines, surfaces flottantes OPAQUES en gris neutre (#17181A),
// suppression = modale d'avertissement + CTA rouge foncé + saisie de l'e-mail.
//
// UTILISATEURS = concept A « le registre nu » (juillet 2026), même grammaire
// que la page Agences :
//   • outils (chips + recherche) posés À MÊME le fond du bento,
//     table nue — plus aucune card imbriquée ;
//   • la colonne E-mail (214 px) disparaît — l'e-mail reste cherchable
//     et visible dans la fiche du compte ;
//   • « Inscription » devient « Dernière activité » — jamais connecté et
//     dormant > 30 j se signalent en couleur ;
//   • le rôle est du TEXTE ; seul le super-admin porte une pilule noire ;
//   • ligne d'anomalies en chips filtrantes (emprunt au concept C) ;
//   • pager 9/page remplacé par 20 lignes + « voir les N autres » ;
//   • tri par agence puis par rôle — l'ordre de l'organigramme.
(function () {
  const { AdmCard, AdmPill, AdmGhostBtn, AdmSolidBtn, AdmIcon, AdmAvatar, AdmChip, AdmSearch, AdmPager,
          AdmTh, AdmTd, AdmEmpty, AdmStat, AdmGroupTitle, AdmCircleBtn, AdmModal, AdmConfirm, AdmDrawer,
          AdmLabel, admTones, admFieldStyle, admFloatSurf, ADM_R } = window;

  const USX_SHOW = 20;
  const USX_EV_SHOW = 5, USX_EV_MORE = 10;
  const USX_ROLES = [
    { id: "", label: "Tous" },
    { id: "super_admin", label: "Super-admin" },
    { id: "admin", label: "Admin agence" },
    { id: "manager", label: "Manager" },
    { id: "agent", label: "Agent" },
    { id: "assistant", label: "Assistant" },
  ];
  const USX_ROLE_LABEL = USX_ROLES.reduce((m, r) => (r.id ? Object.assign(m, { [r.id]: r.label }) : m), {});
  const USX_RANK = { super_admin: 0, admin: 1, manager: 2, agent: 3, assistant: 4 };
  const USX_ROLE_CAP = {
    super_admin: "Toute la plateforme, la vue en tant que et la console. Suppression refusée côté serveur.",
    admin: "Invite les membres, voit tous les dossiers de l'agence, gère l'abonnement et la vitrine.",
    manager: "Voit et réassigne les dossiers de son équipe. N'invite personne, ne touche pas à la facturation.",
    agent: "Ses propres dossiers, biens et contacts.",
    assistant: "Lecture et saisie, aucune signature ni validation KYC.",
  };
  const USX_ROLE_SHORT = {
    super_admin: "Plateforme entière, vue en tant que",
    admin: "Invite, facture, voit tous les dossiers",
    manager: "Réassigne les dossiers de l'équipe",
    agent: "Ses dossiers, biens et contacts",
    assistant: "Lecture et saisie, aucune signature",
  };
  // Ce que chaque rôle contrôle — détaillé dans le popup « i »
  const USX_ROLE_PERMS = {
    super_admin: [
      "Console MEGGA : agences, comptes, plans et facturation",
      "Feature flags, annonces in-app, journal de sécurité",
      "Ne peut pas être supprimé — allowlist anti-lockout",
    ],
    admin: [
      "Invite, retire et change le rôle des membres",
      "Voit tous les dossiers, biens et contacts de l'agence",
      "Abonnement, plan et factures",
      "Vitrine de l'agence et diffusion Immobilier.ch",
      "Valide les dossiers KYC / LBA",
    ],
    manager: [
      "Voit les dossiers de toute son équipe",
      "Réassigne un dossier à un autre agent",
      "Valide les dossiers KYC de son équipe",
      "N'invite personne, ne touche pas à la facturation",
    ],
    agent: [
      "Ses dossiers, biens, contacts et matchs",
      "Crée un bien, transmet une sélection à un acheteur",
      "Ouvre et complète un dossier KYC",
      "Ne voit pas les dossiers de ses collègues",
    ],
    assistant: [
      "Lecture des dossiers de l'agence",
      "Saisie de contacts et dépôt de documents",
      "Aucune signature, aucune validation KYC",
      "Ne modifie ni les prix ni les mandats",
    ],
  };
  const USX_DANGER = (dark) => (dark ? "#E0738C" : "#8E1F3D");

  // Anomalies : ce qui demande une action (emprunt au concept C)
  const usxFlag = (u) => (u.suspended ? "suspended" : u.never ? "never" : u.staleDays >= 30 ? "stale" : null);
  const USX_FLAGS = [
    { id: "suspended", label: "Suspendus", tone: "err" },
    { id: "never", label: "Jamais connectés", tone: "warn" },
    { id: "stale", label: "Sans activité 30 j", tone: "warn" },
  ];
  // Tri : plateforme d'abord, puis agence A→Z, puis rang de rôle
  const usxSort = (a, b) =>
    (a.agency ? 1 : 0) - (b.agency ? 1 : 0) ||
    (a.agency || "").localeCompare(b.agency || "", "fr") ||
    USX_RANK[a.role] - USX_RANK[b.role] ||
    a.name.localeCompare(b.name, "fr");
  const usxInitials = (n) => (n || "?").split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  const usxJson = (name, obj) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // ─── Fiche d'un compte — concept A « la fiche calme » ───────────────────
  // Une seule action primaire (contextuelle), le cycle de vie dans le « ⋯ »,
  // l'activité AU-DESSUS des actions, lignes nues (pas de card imbriquée),
  // rôle en radios Sugar avec la phrase de droits.
  const UsxRow = ({ label, children, first, sp, dark }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 40, borderTop: first ? undefined : (dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(15,23,42,0.05)") }}>
      <span style={{ width: 74, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
    </div>
  );

  const UsxSect = ({ label, right, sp, dark, style }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "20px 0 8px", ...style }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: sp.sub, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)" }} />
      {right}
    </div>
  );

  // Rôle : radio Sugar + « i » qui déplie ce que le niveau contrôle
  const UsxRoleOpt = ({ role, on, info, onInfo, onClick, sp, dark, surf, bg }) => (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, minHeight: 44, paddingRight: 6, borderRadius: 12,
        background: on ? surf.cardSub : "transparent",
        boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset` : "none",
      }}>
        <button onClick={onClick} className="adm-nav" style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, minHeight: 44, padding: "0 4px 0 12px",
          border: 0, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "transparent",
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center",
            background: on ? sp.ink : "transparent",
            boxShadow: on ? "none" : `0 0 0 1.5px ${dark ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.18)"} inset`,
          }}>{on && <AdmIcon name="check" size={11} color={dark ? "#0B0C0E" : "#FFFFFF"} />}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: sp.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{USX_ROLE_LABEL[role]}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onInfo(); }} aria-label={"Ce que contrôle " + USX_ROLE_LABEL[role]} aria-expanded={!!info} className="adm-nav" style={{
          width: 26, height: 26, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
          display: "grid", placeItems: "center", background: info ? sp.ink : "transparent",
        }}>
          <AdmIcon name="info" size={15} color={info ? (dark ? "#0B0C0E" : "#FFFFFF") : sp.sub} />
        </button>
      </div>
      {info && (
        <div role="dialog" style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", width: 262, zIndex: 6,
          padding: "13px 14px 14px", borderRadius: 14, background: bg || surf.card, boxShadow: sp.shadowLg || sp.shadow,
        }}>
          <p style={{ margin: "0 0 9px", fontSize: 11, fontWeight: 700, color: sp.sub }}>Ce que ce rôle contrôle</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {USX_ROLE_PERMS[role].map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: sp.sub, marginTop: 6, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 500, color: sp.soft, lineHeight: 1.45, textWrap: "pretty" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const UsxMenuItem = ({ icon, label, tone, disabled, onClick, sp }) => (
    <button onClick={disabled ? undefined : onClick} className={disabled ? undefined : "adm-nav"} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 11, height: 38, padding: "0 11px", width: "100%",
      border: 0, borderRadius: 11, background: "transparent", cursor: disabled ? "default" : "pointer",
      fontFamily: "inherit", textAlign: "left", fontSize: 12.5, fontWeight: 700,
      color: disabled ? sp.ghost || sp.sub : tone || sp.ink, opacity: disabled ? 0.6 : 1,
    }}>
      <AdmIcon name={icon} size={15} color={disabled ? sp.ghost || sp.sub : tone || sp.sub} />
      {label}
    </button>
  );

  const UsxDrawer = ({ user, onClose, onPatch, onFlash, onNavigate, sp, dark }) => {
    const T = admTones(dark), F = admFloatSurf(sp, dark);
    const [confirming, setConfirming] = React.useState(null);
    const [notice, setNotice] = React.useState(null);
    const [menu, setMenu] = React.useState(false);
    const [infoRole, setInfoRole] = React.useState(null);
    const [evShown, setEvShown] = React.useState(USX_EV_SHOW);
    const menuRef = React.useRef(null);
    const roleRef = React.useRef(null);

    React.useEffect(() => {
      if (!infoRole) return;
      const away = (e) => { if (roleRef.current && !roleRef.current.contains(e.target)) setInfoRole(null); };
      const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setInfoRole(null); } };
      document.addEventListener("mousedown", away);
      document.addEventListener("keydown", esc, true);
      return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
    }, [infoRole]);
    const protected_ = user.role === "super_admin";
    const events = window.ADMIN_USER_ACTIVITY[user.id] || window.ADMIN_USER_ACTIVITY._default;

    React.useEffect(() => {
      if (!menu) return;
      const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
      const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setMenu(false); } };
      document.addEventListener("mousedown", away);
      document.addEventListener("keydown", esc, true);
      return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc, true); };
    }, [menu]);

    const exportDsar = () => {
      usxJson("dsar-" + user.email.replace(/[^a-z0-9]+/gi, "-"), {
        export: "DSAR / nLPD art. 25", generatedAt: new Date().toISOString(),
        account: { id: user.id, name: user.name, email: user.email, phone: user.phone || null, role: user.role, agency: user.agency, createdAt: user.since },
        activity: events,
      });
      setNotice("Export DSAR généré — la demande est journalisée côté serveur.");
    };

    // Fond de la fiche : canvas S0 (#12161C en sombre)
    const paneBg = dark ? (window.crmStep ? window.crmStep("s0", "#12161C") : "#12161C") : F.card;

    // Action primaire contextuelle (emprunt au concept C)
    const cta = user.suspended
      ? { label: "Réactiver le compte", icon: "check", onClick: () => onPatch(user.id, { suspended: false }) }
      : user.never
        ? { label: "Relancer l'invitation", icon: "mail", onClick: () => setNotice("Invitation renvoyée à " + user.email + " — lien valable 7 jours.") }
        : { label: "Réinitialiser le mot de passe", icon: "key", onClick: () => setConfirming("reset") };

    return (
      <AdmDrawer sp={sp} dark={dark} onClose={onClose} label={user.name} bg={paneBg}>
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", fontVariantNumeric: "tabular-nums" }}>
          {/* En-tête aligné à gauche */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 20px 16px" }}>
            <AdmAvatar initials={usxInitials(user.name)} size={42} sp={sp} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: -0.5, color: sp.ink, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</h3>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <AdmPill sp={sp} surf={F} dark={dark} tone={user.role === "super_admin" ? "info" : "neutral"} label={USX_ROLE_LABEL[user.role]} />
                {user.suspended && <AdmPill sp={sp} surf={F} dark={dark} tone="err" label="Suspendu" />}
                {user.never && <AdmPill sp={sp} surf={F} dark={dark} tone="warn" label="Jamais connecté" />}
              </div>
            </div>
            <AdmCircleBtn icon="close" title="Fermer" onClick={onClose} sp={sp} surf={{ card: F.cardSub }} />
          </div>

          {/* Identité — lignes nues */}
          <div style={{ display: "flex", flexDirection: "column", padding: "0 20px" }}>
            <UsxRow label="E-mail" first sp={sp} dark={dark}><span title={user.email}>{user.email}</span></UsxRow>
            <UsxRow label="Téléphone" sp={sp} dark={dark}>
              {user.phone || <span style={{ color: sp.sub, fontWeight: 500 }}>non renseigné</span>}
            </UsxRow>
            <UsxRow label="Agence" sp={sp} dark={dark}>
              {user.agency || <span style={{ color: sp.sub, fontWeight: 500 }}>Plateforme MEGGA</span>}
            </UsxRow>
            <UsxRow label="Activité" sp={sp} dark={dark}>
              {user.never
                ? <span style={{ color: T.warn }}>jamais connecté — invité {user.invited}</span>
                : <span style={{ color: user.staleDays >= 30 ? T.warn : sp.ink }}>{user.last}</span>}
            </UsxRow>
            <UsxRow label="Inscrit" sp={sp} dark={dark}><span style={{ color: sp.sub, fontWeight: 500 }}>{user.since}</span></UsxRow>
          </div>

          {/* Rôle — radios Sugar */}
          <div style={{ padding: "0 20px" }}>
            <UsxSect label="Rôle" sp={sp} dark={dark}
              right={<span style={{ fontSize: 11, fontWeight: 600, color: sp.sub, whiteSpace: "nowrap" }}>Changement journalisé</span>} />
            <div ref={roleRef} style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -4px" }}>
              {USX_ROLES.filter((r) => r.id).map((r) => (
                <UsxRoleOpt key={r.id} role={r.id} on={user.role === r.id} sp={sp} dark={dark} surf={F} bg={paneBg}
                  info={infoRole === r.id} onInfo={() => setInfoRole(infoRole === r.id ? null : r.id)}
                  onClick={() => { if (user.role !== r.id) { onPatch(user.id, { role: r.id }); setInfoRole(null); setNotice("Rôle passé à « " + USX_ROLE_LABEL[r.id] + " » — action journalisée."); } }} />
              ))}
            </div>
          </div>

          {/* Consentements nLPD — le consentement suit la personne (décision juil. 2026 :
              la page Conformité n'existe pas ; CGU + confidentialité acceptées à l'inscription,
              marketing géré dans le produit — lecture seule ici). */}
          <div style={{ padding: "0 20px" }}>
            <UsxSect label="Consentements nLPD" sp={sp} dark={dark}
              right={<span style={{ fontSize: 11, fontWeight: 600, color: sp.sub, whiteSpace: "nowrap" }}>Lecture seule</span>} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <UsxRow label="CGU" first sp={sp} dark={dark}><span>v2.3 — {user.since}</span></UsxRow>
              <UsxRow label="Confidentialité" sp={sp} dark={dark}><span>v2.3 — {user.since}</span></UsxRow>
              <UsxRow label="Marketing" sp={sp} dark={dark}>
                {user.marketing === false
                  ? <span style={{ color: sp.sub, fontWeight: 500 }}>refusé</span>
                  : <span>accepté — {user.since}</span>}
              </UsxRow>
            </div>
          </div>

          {/* Activité récente — AVANT les actions */}
          <div style={{ padding: "0 20px 8px" }}>
            <UsxSect label="Activité récente" sp={sp} dark={dark}
              right={<span style={{ fontSize: 11, fontWeight: 600, color: sp.sub }}>{events.length}</span>} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.slice(0, evShown).map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "9px 0" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.ink, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: sp.ink, lineHeight: 1.4, textWrap: "pretty" }}>
                      <span style={{ fontWeight: 700 }}>{e.action}</span>
                      {e.entity && <span style={{ fontWeight: 500, color: sp.sub }}> — {e.entity}</span>}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 500, color: sp.sub }}>{e.when}</p>
                  </div>
                </div>
              ))}
            </div>
            {evShown < events.length && (
              <button onClick={() => setEvShown(evShown + USX_EV_MORE)} style={{
                display: "flex", alignItems: "center", gap: 7, marginTop: 8, padding: 0, border: 0,
                background: "transparent", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 700, color: sp.soft,
              }}>
                Voir les {events.length - evShown} plus anciennes
                <AdmIcon name="chevronR" size={13} color={sp.sub} />
              </button>
            )}
            {protected_ && <p style={{ margin: "10px 0 0", fontSize: 11.5, fontWeight: 500, color: sp.sub, lineHeight: 1.45, textWrap: "pretty" }}>Compte de l'allowlist super-admin : la suppression est refusée côté serveur (anti-lockout).</p>}
          </div>

          {/* Pied : une action primaire contextuelle + le reste dans « ⋯ » */}
          <div style={{
            marginTop: "auto", position: "sticky", bottom: 0, display: "flex", flexDirection: "column", gap: 12,
            padding: "14px 20px 18px", background: paneBg, borderTop: F.hairline,
          }}>
            {/* Confirmation de l'action qui vient d'être faite — juste au-dessus du geste */}
            {notice && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 13px", borderRadius: 12, background: F.cardSub }}>
                <AdmIcon name="check" size={15} color={T.ok} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: sp.soft, lineHeight: 1.45, textWrap: "pretty" }}>{notice}</span>
                <button onClick={() => setNotice(null)} aria-label="Fermer" style={{
                  width: 20, height: 20, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
                  background: "transparent", display: "grid", placeItems: "center", padding: 0,
                }}><AdmIcon name="close" size={12} color={sp.sub} /></button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AdmSolidBtn sp={sp} style={{ flex: 1, justifyContent: "center", height: 44 }} onClick={cta.onClick}>{cta.label}</AdmSolidBtn>
            <div style={{ position: "relative" }} ref={menuRef}>
              <button onClick={() => setMenu(!menu)} aria-label="Autres actions" aria-expanded={menu} className="adm-nav" style={{
                width: 44, height: 44, borderRadius: 999, border: 0, cursor: "pointer",
                background: menu ? F.cardSub : F.cardSub, display: "grid", placeItems: "center",
                boxShadow: menu ? `0 0 0 1.5px ${sp.ink} inset` : "none",
              }}>
                <AdmIcon name="more" size={17} color={sp.soft} />
              </button>
              {menu && (
                <div role="menu" style={{
                  position: "absolute", right: 0, bottom: 52, width: 250, padding: 7, borderRadius: 16,
                  background: paneBg, boxShadow: sp.shadowLg || sp.shadow, zIndex: 4,
                }}>
                  {(user.suspended || user.never) && (
                    <UsxMenuItem icon="key" label="Réinitialiser le mot de passe" sp={sp}
                      onClick={() => { setMenu(false); setConfirming("reset"); }} />
                  )}
                  <UsxMenuItem icon="download" label="Export DSAR (JSON)" sp={sp} onClick={() => { setMenu(false); exportDsar(); }} />
                  <div style={{ height: 1, background: dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)", margin: "5px 9px" }} />
                  <UsxMenuItem icon={user.suspended ? "check" : "ban"} label={user.suspended ? "Réactiver le compte" : "Suspendre le compte"} sp={sp}
                    onClick={() => { setMenu(false); user.suspended ? onPatch(user.id, { suspended: false }) : setConfirming("suspend"); }} />
                  <UsxMenuItem icon="trash" label="Supprimer le compte" tone={USX_DANGER(dark)} disabled={protected_} sp={sp}
                    onClick={() => { setMenu(false); setConfirming("delete"); }} />
                  {protected_ && <p style={{ margin: "2px 11px 4px", fontSize: 11, fontWeight: 500, color: sp.sub, lineHeight: 1.4, textWrap: "pretty" }}>Allowlist super-admin : refusé côté serveur (anti-lockout).</p>}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        <AdmConfirm open={confirming === "reset"} sp={sp} dark={dark} tone="info" onClose={() => setConfirming(null)}
          title="Envoyer un lien de réinitialisation ?"
          message={`Un lien valable 1 h part à ${user.email}.`}
          confirmLabel="Envoyer le lien"
          onConfirm={() => { setConfirming(null); setNotice("Lien de réinitialisation envoyé à " + user.email + " — valable 1 h."); }} />

        <AdmConfirm open={confirming === "suspend"} sp={sp} dark={dark} onClose={() => setConfirming(null)}
          title="Suspendre ce compte ?"
          message={`${user.name} sera déconnecté immédiatement et ne pourra plus se connecter. Ses dossiers, mandats et contacts restent intacts et visibles de son agence.`}
          confirmLabel="Suspendre" onConfirm={() => { onPatch(user.id, { suspended: true }); setConfirming(null); if (onFlash) onFlash({ kind: "suspended", user }); }} />

        <AdmConfirm open={confirming === "delete"} sp={sp} dark={dark} onClose={() => setConfirming(null)}
          title="Supprimer définitivement ce compte ?"
          message="Le compte est anonymisé et l'accès révoqué (nLPD art. 32). Les dossiers KYC restent conservés 10 ans au titre de la LBA, rattachés à l'agence. L'opération est irréversible."
          requireText="DELETED" requireLabel="Saisis DELETED pour confirmer"
          confirmLabel="Supprimer" onConfirm={() => { onPatch(user.id, { deleted: true }); setConfirming(null); onClose(); if (onFlash) onFlash({ kind: "deleted", user }); }} />
      </AdmDrawer>
    );
  };

  // ═══ Utilisateurs — concept A « le registre nu » ════════════════════════
  const AdminUsersSection = ({ sp, surf, dark, onNavigate }) => {
    const T = admTones(dark);
    const [rows, setRows] = React.useState(() => window.ADMIN_USERS.slice());
    const [q, setQ] = React.useState("");
    const [role, setRole] = React.useState("");
    const [flag, setFlag] = React.useState("");
    const [shown, setShown] = React.useState(USX_SHOW);
    const [openId, setOpenId] = React.useState(() => {
      const id = window.__adminUserId;
      if (id) { delete window.__adminUserId; return id; }
      return null;
    });
    const [flash, setFlash] = React.useState(null);

    React.useEffect(() => {
      if (!flash) return;
      const t = setTimeout(() => setFlash(null), 8000);
      return () => clearTimeout(t);
    }, [flash]);

    const patch = (id, next) => setRows((list) => (next.deleted ? list.filter((u) => u.id !== id) : list.map((u) => (u.id === id ? { ...u, ...next } : u))));

    const roleCount = (id) => (id ? rows.filter((u) => u.role === id).length : rows.length);
    const flagCount = (id) => rows.filter((u) => usxFlag(u) === id).length;
    const flags = USX_FLAGS.map((f) => ({ ...f, n: flagCount(f.id) })).filter((f) => f.n > 0);

    const filtered = React.useMemo(() => {
      const needle = q.trim().toLowerCase();
      return rows.filter((u) =>
        (!role || u.role === role) &&
        (!flag || usxFlag(u) === flag) &&
        (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || (u.agency || "").toLowerCase().includes(needle))
      ).sort(usxSort);
    }, [rows, q, role, flag]);

    const visible = filtered.slice(0, shown);
    const open = rows.find((u) => u.id === openId);
    const reset = () => setShown(USX_SHOW);
    const thSp = { ...sp, tableHeadBg: sp.pageBg };

    const activity = (u) => {
      if (u.never) return { text: "jamais connecté", color: T.warn, weight: 700 };
      if (u.staleDays >= 30) return { text: u.last, color: T.warn, weight: 700 };
      return { text: u.last || "—", color: sp.sub, weight: 500 };
    };

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Confirmation d'action de cycle de vie — fond opaque plein, texte blanc */}
        {flash && (() => {
          const u = flash.user, gone = flash.kind === "deleted";
          const bg = gone ? USX_DANGER(dark) : T.warn;
          return (
            <div role="status" style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "13px 14px 13px 16px",
              borderRadius: 14, background: bg, color: "#FFFFFF", boxShadow: sp.shadowSm,
            }}>
              <AdmIcon name={gone ? "check" : "ban"} size={16} color="#FFFFFF" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}>
                  {gone ? "Compte supprimé" : "Compte suspendu"} — {u.name}
                </p>
              </div>
              {!gone && (
                <button onClick={() => { patch(u.id, { suspended: false }); setFlash(null); }} style={{
                  height: 30, padding: "0 13px", borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: "#FFFFFF",
                  background: "rgba(255,255,255,0.18)",
                }}>Annuler</button>
              )}
              <button onClick={() => setFlash(null)} aria-label="Fermer" style={{
                width: 28, height: 28, borderRadius: 999, border: 0, flexShrink: 0, cursor: "pointer",
                background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center",
              }}>
                <AdmIcon name="close" size={14} color="#FFFFFF" />
              </button>
            </div>
          );
        })()}

        {/* Outils posés sur le fond — aucune card */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
            {USX_ROLES.map((r) => (
              <AdmChip key={r.id || "all"} label={r.label} count={roleCount(r.id)}
                on={role === r.id} onClick={() => { setRole(r.id); reset(); }} sp={sp} surf={surf} />
            ))}
          </div>
          <AdmSearch value={q} onChange={(v) => { setQ(v); reset(); }} placeholder="Nom, e-mail ou agence" sp={sp} surf={surf} dark={dark} width={236} />
        </div>

        {/* Anomalies : ce qui demande une action */}
        {flags.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 4px 12px" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>Demandent une action</span>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {flags.map((f) => {
                const on = flag === f.id;
                return (
                  <button key={f.id} className="adm-chip" onClick={() => { setFlag(on ? "" : f.id); reset(); }} style={{
                    display: "inline-flex", alignItems: "center", gap: 8, height: 26, padding: "0 4px", border: 0,
                    background: "transparent", cursor: "pointer", fontFamily: "inherit",
                    borderBottom: on ? `1.5px solid ${sp.ink}` : "1.5px solid transparent",
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: T[f.tone], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: on ? sp.ink : sp.soft, whiteSpace: "nowrap" }}>{f.n} {f.label.toLowerCase()}</span>
                  </button>
                );
              })}
            </div>
            {flag && (
              <button onClick={() => { setFlag(""); reset(); }} style={{
                marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit",
                fontSize: 11.5, fontWeight: 700, color: sp.sub,
              }}>Tout afficher</button>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <AdmEmpty sp={sp} icon="users" title="Aucun compte ne correspond" hint="Change de rôle ou élargis la recherche." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <AdmTh sp={thSp}>Compte</AdmTh>
                <AdmTh sp={thSp} width={208}>Agence</AdmTh>
                <AdmTh sp={thSp} width={130}>Rôle</AdmTh>
                <AdmTh sp={thSp} width={150} align="right">Dernière activité</AdmTh>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const act = activity(u);
                return (
                  <tr key={u.id} className="adm-row" role="button" tabIndex={0} aria-haspopup="dialog" aria-label={u.name}
                    onClick={() => setOpenId(u.id)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpenId(u.id); } }}
                    style={{ cursor: "pointer" }}>
                    <AdmTd sp={sp} dark={dark}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                        <AdmAvatar initials={usxInitials(u.name)} size={30} sp={sp} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: u.suspended ? sp.sub : sp.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                            {u.role === "super_admin" && <AdmPill sp={sp} surf={surf} dark={dark} tone="info" label="Super-admin" style={{ padding: "3px 9px", fontSize: 10.5 }} />}
                            {u.suspended && <AdmPill sp={sp} surf={surf} dark={dark} tone="err" label="Suspendu" style={{ padding: "3px 9px", fontSize: 10.5 }} />}
                          </div>
                        </div>
                      </div>
                    </AdmTd>
                    <AdmTd sp={sp} dark={dark}>
                      <span style={{ display: "block", maxWidth: 208, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: u.agency ? 600 : 500, color: u.agency ? sp.soft : sp.sub }}>
                        {u.agency || "Plateforme MEGGA"}
                      </span>
                    </AdmTd>
                    <AdmTd sp={sp} dark={dark} style={{ color: sp.soft, fontWeight: 600 }}>{USX_ROLE_LABEL[u.role]}</AdmTd>
                    <AdmTd sp={sp} dark={dark} numeric align="right" style={{ whiteSpace: "nowrap", color: act.color, fontWeight: act.weight }}>{act.text}</AdmTd>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}` }}>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: sp.sub }}>
            {filtered.length} compte{filtered.length > 1 ? "s" : ""} · triés par agence, puis par rôle
          </span>
          {shown < filtered.length && (
            <button onClick={() => setShown(shown + USX_SHOW)} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, border: 0, background: "transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: sp.soft,
            }}>
              Voir les {filtered.length - shown} autres
              <AdmIcon name="chevronR" size={14} color={sp.sub} />
            </button>
          )}
        </div>

        {open && <UsxDrawer user={open} sp={sp} dark={dark} onClose={() => setOpenId(null)} onPatch={patch} onFlash={setFlash} onNavigate={onNavigate} />}
      </div>
    );
  };

  Object.assign(window, { AdminUsersSection });
})();
