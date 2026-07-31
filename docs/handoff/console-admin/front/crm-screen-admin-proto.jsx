// MEGGA CRM — Écran « Console MEGGA » (console super-admin intégrée au pager)
// ─────────────────────────────────────────────────────────────────────
// Reprend LE SHELL de l'écran Paramètres (`crm-screen-settings-proto.jsx`) :
//   • cadre pager r=26 sur sp.pageBg, rail de 300px À L'INTÉRIEUR du cadre,
//   • rail = titre 31/800/-1.1 + pilule noire de contexte + nav groupée,
//   • bento de droite = la section active (setFadeUp .32s).
// Le violet de la console du repo est SUPPRIMÉ : accent noir unique (règle
// Sugar Pure) ; le repère « tu es dans la plateforme » est la pilule noire
// « Admin MEGGA » sous le titre. Aucune animation de survol.
// Périmètre lot 1 : coquille complète (14 entrées) + Vue d'ensemble.
(function () {
  const { AdmIcon, AdmCard, AdmPill, AdmGhostBtn, ADM_R, admSurf } = window;

  // ─── Sections (audit : 17 pages repo → 14 entrées, 5 groupes) ──────────
  const ADM_SECTIONS = [
    { id: "overview",   label: "Vue d'ensemble", icon: "dashboard", group: "pilotage", built: true },
    { id: "live",       label: "Live",           icon: "broadcast", group: "pilotage", built: true },

    { id: "agencies",   label: "Agences",        icon: "building",  group: "clients", built: true },
    { id: "users",      label: "Utilisateurs",   icon: "users",     group: "clients", built: true,
      spec: ["Table : nom · email · agence · rôle · inscription · statut", "Drawer : changement de rôle, activité récente", "Voir en tant que — LECTURE SEULE (Supabase n'a pas d'API d'impersonation : service_role cadré sur le user_id, bandeau permanent, audit admin_log_view_as)", "Export DSAR JSON", "Suspendre / réactiver / reset mot de passe", "Supprimer le compte — modale d'avertissement Sugar, CTA rouge foncé opaque, saisie de l'email exact (nLPD art. 32, KYC conservés 10 ans)"] },

    { id: "diffusion",  label: "Diffusion",      icon: "external",  group: "contenu", built: true,
      spec: ["Deux régimes du même tableau : file d'annonces ≤ 40 signaux, file de CAUSES au-delà (action en lot)", "Signaux : refus du portail (champ manquant, média, aucune photo) · en ligne à tort (mandat absent ou échu, doublon inter-agences, bien vendu, prix/m² aberrant)", "Poste de contrôle plein cadre : laisser en ligne · retirer avec motif · demander une correction (L / R au clavier)", "Correction à la source : rendre un champ obligatoire dans le CRM ferme la cause définitivement", "Hors périmètre : qualité éditoriale, justesse du prix, leads vendeurs, messages storefront, C2PA"] },

    { id: "plans",      label: "Plans & abonnements", icon: "card", group: "revenus", built: true },

    { id: "monitoring", label: "Monitoring",     icon: "activity",  group: "ops", built: true },
    { id: "security",   label: "Sécurité",       icon: "shield",    group: "ops", built: true,
      spec: ["Table : horodatage · sévérité · action · acteur · entité · metadata", "KPI événements critiques · avertissements · total", "Recherche par acteur, filtre par action", "Export PDF avec hash-chain"] },
    { id: "communication", label: "Communications", icon: "megaphone", group: "produit", built: true },
    { id: "nps",        label: "Satisfaction",   icon: "star",      group: "produit", soon: true },
    { id: "copilot",    label: "Copilote IA",    icon: "sparkle",   group: "produit", built: true },
  ];

  const ADM_GROUPS = [
    { id: "pilotage", label: "Pilotage" },
    { id: "clients",  label: "Clients" },
    { id: "contenu",  label: "Contenu" },
    { id: "revenus",  label: "Revenus" },
    { id: "ops",      label: "Exploitation" },
    { id: "produit",  label: "Produit" },
  ];

  // ─── Entrée de nav (grammaire des Réglages : r=14, ring noir 1.5 inset) ─
  const AdmNavItem = ({ s, active, onClick, sp, surf }) => {
    const on = s.id === active;
    return (
      <button onClick={onClick} className="adm-nav" style={{
        display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: ADM_R.row,
        cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", border: 0,
        background: on ? surf.card : "transparent",
        boxShadow: on ? `0 0 0 1.5px ${sp.ink} inset, ${surf.shadow}` : "none",
      }}>
        <span style={{ width: 24, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <AdmIcon name={s.icon} size={17} color={on ? sp.ink : sp.sub} />
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: sp.ink }}>{s.label}</span>
      </button>
    );
  };

  // ─── Section pas encore construite : un état sobre, pas une fausse page ─
  const AdmSectionSoon = ({ sp, dark }) => (
    <div style={{ display: "grid", placeItems: "center", gap: 8, padding: "90px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: sp.ink }}>Bientôt disponible</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: sp.sub }}>Cet écran n'est pas encore construit.</div>
    </div>
  );

  // ─── Placeholder de section : la spec réelle, pas du remplissage ───────
  const AdmSectionPlaceholder = ({ s, sp, surf, dark }) => (
    <AdmCard sp={sp} surf={surf} padding="26px 28px">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <AdmPill sp={sp} surf={surf} dark={dark} label="À construire" />
        <span style={{ fontSize: 12, color: sp.sub }}>Portée depuis la console admin du repo — cf. AUDIT_ADMIN_CONSOLE.md</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {(s.spec || []).map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: sp.sub, marginTop: 7, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.5, color: sp.soft, textWrap: "pretty" }}>{line}</span>
          </div>
        ))}
      </div>
    </AdmCard>
  );

  // ═══════════════════════════════════════════════════════════════════════
  const CRMScreenAdminProto = (props) => {
    const { t, dark, darkTone, setDark, onNavigate, onCmd, screen = "admin", aiOpen = false } = props;

    if (!window.SugarTopNav || !window.crmSugarPalette) return null;

    const sp = window.crmSugarPalette(t, dark, darkTone);
    sp.dark = dark;
    const surf = admSurf(sp, dark);

    const [active, setActive] = React.useState(() => {
      const s = window.__adminSection;
      if (s) { delete window.__adminSection; return s; }
      return "overview";
    });
    const scrollRef = React.useRef(null);
    const [navTick, setNavTick] = React.useState(0);
    React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [active, navTick]);

    const sec = ADM_SECTIONS.find((s) => s.id === active) || ADM_SECTIONS[0];
    const groups = ADM_GROUPS
      .map((g) => ({ g, items: ADM_SECTIONS.filter((s) => s.group === g.id) }))
      .filter((x) => x.items.length > 0);

    const renderSection = () => {
      if (active === "overview" && window.AdminOverviewSection) {
        return <window.AdminOverviewSection sp={sp} surf={surf} dark={dark} onGo={setActive} />;
      }
      if (active === "live" && window.AdminLiveSection) {
        return <window.AdminLiveSection sp={sp} surf={surf} dark={dark} />;
      }
      if (active === "agencies" && window.AdminAgenciesSection) {
        return <window.AdminAgenciesSection key={"agencies" + navTick} sp={sp} surf={surf} dark={dark} onGo={setActive} />;
      }
      if (active === "users" && window.AdminUsersSection) {
        return <window.AdminUsersSection sp={sp} surf={surf} dark={dark} onNavigate={onNavigate} />;
      }
      if (active === "diffusion" && window.AdminDiffusionSection) {
        return <window.AdminDiffusionSection sp={sp} surf={surf} dark={dark} onGo={onNavigate} />;
      }
      if (active === "plans" && window.AdminPlansSection) {
        return <window.AdminPlansSection sp={sp} surf={surf} dark={dark} onGo={setActive} />;
      }
      if (active === "monitoring" && window.AdminMonitoringSection) {
        return <window.AdminMonitoringSection sp={sp} surf={surf} dark={dark} />;
      }
      if (active === "security" && window.AdminSecuritySection) {
        return <window.AdminSecuritySection sp={sp} surf={surf} dark={dark} />;
      }
      if (active === "communication" && window.AdminCommunicationsSection) {
        return <window.AdminCommunicationsSection sp={sp} surf={surf} dark={dark} />;
      }
      if (active === "copilot" && window.AdminCopilotSection) {
        return <window.AdminCopilotSection sp={sp} surf={surf} dark={dark} onGo={setActive} />;
      }
      if (sec.soon) return <AdmSectionSoon sp={sp} dark={dark} />;
      return <AdmSectionPlaceholder s={sec} sp={sp} surf={surf} dark={dark} />;
    };

    return (
      <div data-screen-label="20 Console MEGGA" style={{
        position: "relative", background: sp.pageBg, height: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column", fontFamily: "Inter Tight, system-ui, sans-serif",
        color: sp.ink, fontVariantNumeric: "tabular-nums",
      }}>
        <style>{`
          .adm-nav, .adm-chip, .adm-ghost, .adm-solid { outline: none !important; -webkit-tap-highlight-color: transparent; }
          .adm-nav:hover, .adm-chip:hover { background: ${dark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.035)"}; }
          .adm-row:hover { background: ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.05)"}; }
          .adm-scroll::-webkit-scrollbar { width: 9px; }
          .adm-scroll::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.14)"}; border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
          .adm-nav input, .adm-scroll input, .adm-scroll select { font-family: inherit; }
          .adm-scroll input::placeholder { color: ${sp.ghost || sp.sub}; opacity: 1; }
          a { color: ${sp.ink}; } a:hover { color: ${sp.ink}; }
          @keyframes admFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
          @keyframes admSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
        `}</style>

        <window.SugarTopNav active={screen} t={t} sp={sp} dark={dark} onNavigate={onNavigate} onCmd={onCmd} aiOpen={aiOpen} />

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <window.SugarIconRail active={screen} onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: "100%", paddingRight: 24, paddingBottom: 22 }}>
            <div data-adm-frame="" style={{
              position: "relative", height: "100%", borderRadius: ADM_R.frame, overflow: "hidden",
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
              display: "grid", gridTemplateColumns: "300px 1fr",
            }}>
              {/* RAIL — titre, repère de contexte, nav groupée, retour CRM */}
              <aside className="adm-scroll" style={{ padding: "30px 24px 18px", display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
                <h1 style={{ margin: 0, fontSize: 31, fontWeight: 800, letterSpacing: -1.1, color: sp.ink, lineHeight: 1 }}>Console</h1>
                <div style={{ marginTop: 11, marginBottom: 20 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", height: 24, padding: "0 12px", borderRadius: 999,
                    background: sp.accent || sp.ink, color: sp.accentInk || (dark ? "#0B0C0E" : "#FFFFFF"),
                    fontSize: 11, fontWeight: 800, letterSpacing: -0.1,
                  }}>Admin MEGGA</span>
                </div>

                <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {groups.map(({ g, items }) => (
                    <React.Fragment key={g.id}>
                      <div style={{ padding: "14px 12px 6px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: sp.sub, userSelect: "none" }}>{g.label}</span>
                      </div>
                      {items.map((s) => (
                        <AdmNavItem key={s.id} s={s} active={active} onClick={() => { setActive(s.id); if (s.id === active) setNavTick((n) => n + 1); }} sp={sp} surf={surf} />
                      ))}
                    </React.Fragment>
                  ))}
                </nav>

              </aside>

              {/* BENTO — la section active */}
              <div ref={scrollRef} className="adm-scroll" style={{ minHeight: 0, overflowY: "auto", padding: "28px 34px 40px 12px" }}>
                <div key={active} style={{ maxWidth: 1180, margin: "0 auto", animation: "admFadeUp .32s cubic-bezier(.2,.8,.2,1) both" }}>
                  <header style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: sp.ink, lineHeight: 1.15 }}>{sec.label}</h2>
                      {sec.subtitle && <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 500, color: sp.sub, lineHeight: 1.45 }}>{sec.subtitle}</p>}
                    </div>
                  </header>
                  {renderSection()}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  };

  Object.assign(window, { CRMScreenAdminProto, ADM_SECTIONS, ADM_GROUPS });
})();
