// Câblage de l'auth de la vitrine sur Supabase (même projet que l'app).
//
// La vitrine est statique (pas de build) → on charge le SDK Supabase depuis le
// CDN, puis on intercepte les formulaires Sign-In / Sign-Up + les boutons OAuth
// Google / Microsoft. Succès → redirection vers le CRM (app.megga.ch/dashboard).
//
// IMPORTANT : on réutilise l'URL + la clé ANON publique du projet (sécurité par
// RLS, pas par obscurité — c'est la même clé que l'app expose déjà côté client).
(function () {
  var SUPABASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw';
  var CRM_URL = 'https://app.megga.ch/dashboard';
  var AUTH_REDIRECT = 'https://app.megga.ch/auth/callback'; // l'app gère le retour OAuth/email
  // Cible du lien de réinitialisation.
  //
  // ⚠ Cette URL doit figurer dans Supabase → Authentication → URL Configuration
  // → Redirect URLs. Sans quoi Supabase l'ignore et renvoie sur la Site URL :
  // le lien du mail n'atterrit alors nulle part d'utile.
  //
  // Elle vivait sur app.megga.ch (ancienne coquille auth du CRM). Rapatriée ici :
  // cet écran ne renvoyait de toute façon PAS vers le dashboard mais vers
  // megga.ch/login une fois le mot de passe changé — le détour par l'app ne
  // servait donc qu'à traverser un second domaine dans une autre peau.
  // ⚠ Reste l'ancienne URL ANGLAISE alors que la page s'appelle désormais
  // nouveau-mot-de-passe.html : cette valeur doit figurer telle quelle dans
  // l'allowlist Supabase (Auth → URL Configuration), qu'un déploiement ne met
  // pas à jour. Le worker 301 vers la page française et le navigateur
  // ré-attache le fragment (jetons) à la cible. Pour la passer en français :
  // ajouter la nouvelle URL à l'allowlist D'ABORD, puis changer ici.
  var RESET_REDIRECT = 'https://megga.ch/reset-password.html';

  // Cloudflare Turnstile — Supabase exige un token captcha sur chaque appel auth
  // (signin / signup / reset). Site key publique (même projet que l'app).
  var TURNSTILE_SITE_KEY = '0x4AAAAAADT4gba9sDd8Uo4Y';
  var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var turnstileWidgetId = null;
  // Délai machine. Porté à 2 min dès qu'un challenge visible démarre : c'est
  // alors un humain qui répond, pas le réseau.
  var CAPTCHA_TIMEOUT_MS = 20000;
  var CAPTCHA_INTERACTIVE_TIMEOUT_MS = 120000;

  // Messages réutilisés. Le message « compte existant » oriente vers la
  // connexion ET vers Google : un compte OAuth-only n'a pas de mot de passe,
  // donc « e-mail déjà pris » sans cette précision laisse l'utilisateur bloqué.
  var CAPTCHA_FAIL_MSG = 'La vérification de sécurité n’a pas abouti. Réessayez dans un instant ; si cela se reproduit, écrivez-nous à hello@megga.ch.';
  var CAPTCHA_INTERACTIVE_MSG = 'Confirmez que vous n’êtes pas un robot pour continuer.';
  var SERVICE_FAIL_MSG = 'Connexion au service impossible. Vérifiez votre connexion, puis réessayez.';
  var EXISTING_ACCOUNT_MSG = 'Un compte existe déjà avec cet e-mail. Connectez-vous via « Se connecter » — et si vous vous êtes inscrit avec Google, utilisez « Continuer avec Google » (dans ce cas, aucun mot de passe n’a été défini).';
  var CONSENT_MSG = 'Cochez la case pour accepter les conditions générales et la politique de confidentialité.';

  var scriptPromises = {};

  function loadScript(src, test) {
    if (scriptPromises[src]) return scriptPromises[src];
    var p = new Promise(function (resolve, reject) {
      if (test && test()) return resolve();
      var s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      // `onload` ne garantit pas que le global soit déjà posé (Turnstile
      // s'enregistre de façon asynchrone) : on sonde avant de rendre la main,
      // sinon une soumission rapide part alors que window.turnstile est absent.
      s.onload = function () {
        if (!test) return resolve();
        var tries = 40;
        (function wait() {
          if (test()) return resolve();
          if (--tries <= 0) return reject(new Error('script sans API: ' + src));
          setTimeout(wait, 50);
        })();
      };
      s.onerror = function () { reject(new Error('script indisponible: ' + src)); };
      document.head.appendChild(s);
    });
    // Un échec ne doit pas condamner la page : on autorise un nouvel essai.
    scriptPromises[src] = p;
    p['catch'](function () { delete scriptPromises[src]; });
    return p;
  }

  function loadSdk() {
    // SDK auto-hébergé (pas de CDN tiers — robustesse + 0 dépendance externe).
    return loadScript('/js/supabase.min.js',
      function () { return window.supabase && window.supabase.createClient; });
  }

  // Marque les rejets issus du captcha, pour que le .catch() des formulaires
  // n'accuse pas la vérification quand c'est le réseau ou Supabase qui a lâché.
  function captchaError(msg) { var e = new Error(msg); e.captcha = true; return e; }

  // Conteneur du widget, placé DANS le formulaire juste avant le bouton d'envoi.
  // Invisible tant que Turnstile n'exige rien (appearance:'interaction-only') ;
  // mais si un challenge apparaît, il apparaît là où l'utilisateur peut le
  // résoudre. L'ancien conteneur en position:absolute;left:-9999px rendait ce
  // cas insoluble : personne ne pouvait répondre, donc aucun callback.
  // UN conteneur PAR formulaire (classe, pas id : la page en compte plusieurs).
  // Le chercher globalement rendait le défi insoluble dès qu'un second
  // formulaire entrait en jeu : le widget du modal « mot de passe oublié » se
  // serait monté dans le formulaire de connexion, donc SOUS le voile du modal,
  // hors de portée du clic — et le token n'arrivait jamais.
  function ensureTurnstileContainer(form) {
    var scope = form || document.body;
    var box = scope.querySelector('.megga-turnstile');
    if (box && box.parentNode) return box;
    box = document.createElement('div');
    box.className = 'megga-turnstile';
    // grid-column : les formulaires Webflow sont des grilles — sans ça le widget
    // occuperait une seule cellule et décalerait la mise en page.
    box.style.cssText = 'display:flex;justify-content:center;grid-column:1/-1';
    var btn = scope.querySelector('input[type="submit"], button[type="submit"]');
    if (btn && btn.parentNode) btn.parentNode.insertBefore(box, btn);
    else scope.appendChild(box);
    return box;
  }

  // Renvoie un token frais par tentative.
  //
  // Turnstile fige ses callbacks à l'appel de render() : reset() ne les
  // ré-enregistre PAS. Réutiliser le widget laissait donc vivantes les callbacks
  // de la 1re tentative, dont le garde `done` avalait le token de toutes les
  // suivantes — d'où l'échec systématique au bout du délai dès la 2e soumission
  // d'une même page (« mot de passe faux, je réessaie » tombait pile dedans).
  // On repart d'un widget neuf : aucun état ne survit d'un appel à l'autre.
  function getCaptchaToken(form, onInteractive) {
    return loadScript(TURNSTILE_SRC, function () { return !!window.turnstile; })
      .then(function () {
        return new Promise(function (resolve, reject) {
          if (!window.turnstile) return reject(captchaError('turnstile indisponible'));

          var box = ensureTurnstileContainer(form);
          var done = false;
          var timer = null;

          // Sortie unique : garantit l'annulation du timer sur TOUS les chemins.
          function settle(fn, arg) {
            if (done) return;
            done = true;
            if (timer) { clearTimeout(timer); timer = null; }
            fn(arg);
          }
          function arm(ms) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { settle(reject, captchaError('captcha timeout')); }, ms);
          }

          if (turnstileWidgetId !== null) {
            try { window.turnstile.remove(turnstileWidgetId); } catch (e) { /* déjà détruit */ }
            turnstileWidgetId = null;
          }

          arm(CAPTCHA_TIMEOUT_MS);
          try {
            turnstileWidgetId = window.turnstile.render(box, {
              sitekey: TURNSTILE_SITE_KEY,
              execution: 'execute',
              appearance: 'interaction-only',
              callback: function (token) { settle(resolve, token); },
              'error-callback': function () { settle(reject, captchaError('captcha erreur')); },
              'timeout-callback': function () { settle(reject, captchaError('captcha expire')); },
              'expired-callback': function () { settle(reject, captchaError('captcha expire')); },
              // Un challenge visible démarre : c'est un humain qui agit. On lui
              // laisse le temps et on le prévient, sinon le bouton attend sans
              // que rien n'explique pourquoi.
              'before-interactive-callback': function () {
                box.style.margin = '12px 0';
                arm(CAPTCHA_INTERACTIVE_TIMEOUT_MS);
                if (onInteractive) { try { onInteractive(); } catch (e) { /* */ } }
              },
            });
          } catch (e) {
            return settle(reject, captchaError('captcha non rendu'));
          }
          // render() renvoie undefined quand il refuse de monter le widget :
          // sans ce test l'id resterait empoisonné pour toute la session.
          if (turnstileWidgetId === null || turnstileWidgetId === undefined) {
            return settle(reject, captchaError('captcha non rendu'));
          }
          try { window.turnstile.execute(turnstileWidgetId); }
          catch (e) { settle(reject, captchaError('captcha non lancé')); }
        });
      }, function () {
        return Promise.reject(captchaError('turnstile indisponible'));
      });
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function byId(id) { return document.getElementById(id); }

  /**
   * Case « J'accepte les conditions… » de inscription.html, ou `null` ailleurs.
   *
   * ⚠ Surtout PAS par son id : le template Webflow a nommé `checkbox-3` la
   * première case de chaque page, et sur connexion.html c'est « Rester connecté ».
   * Chercher par id ferait dépendre la connexion Google d'une case « rester
   * connecté » décochée. On passe donc par la ligne de consentement, qui
   * n'existe que sur inscription.html.
   */
  function consentCheckbox() { return $('.megga-signup__consent input[type="checkbox"]'); }

  // Champ mot de passe de la page de connexion, re-typé au besoin.
  //
  // `connexion.html` porte désormais un vrai `type="password"`, mais il a longtemps
  // été un `type="tel"` (id/name `Phone`, héritage du template Webflow) : un
  // navigateur qui sert cette version depuis SON cache afficherait le mot de
  // passe en clair à la frappe. On garde donc le rattrapage, idempotent sur le
  // HTML corrigé.
  //
  // L'ordre a changé le 31 juil. 2026 : les placeholders ont été retirés des
  // formulaires, donc la recherche par placeholder ne rend plus rien sur le
  // HTML courant. Elle reste en second — une page encore en cache la porte,
  // elle, et c'est précisément celle qu'il faut rattraper.
  function loginPasswordField(form) {
    var el = byId('Password')
      || form.querySelector('input[placeholder*="mot de passe" i]')
      || byId('Phone');
    if (!el) return null;
    if (el.type !== 'password') el.type = 'password';
    el.setAttribute('autocomplete', 'current-password');
    return el;
  }

  // Durcissement AVANT tout appel réseau.
  //
  // Ces corrections vivaient dans `wire()`, donc derrière `loadSdk()` : entre la
  // peinture de la page et l'arrivée du SDK, le mot de passe restait lisible, et
  // si le SDK ne venait jamais il le restait pour de bon (le `.catch()` de
  // `run()` ne retypait rien). Les liens OAuth sont neutralisés ici pour la même
  // raison : sur une page en cache ils pointent encore sur google.com, et un clic
  // avant l'attache des écouteurs quittait le site.
  function hardenAuthFields() {
    var form = byId('wf-form-Sign-In-Form');
    if (!form) return;
    loginPasswordField(form);
    var email = byId('Email');
    if (email) email.setAttribute('autocomplete', 'username');
    Array.prototype.forEach.call(
      document.querySelectorAll('a.app-button[href], .secondary-button.app-button[href]'),
      function (a) {
        if (/google|microsoft/i.test(a.textContent || '')) a.setAttribute('href', '#');
      },
    );
  }

  // Affiche un message dans le bloc .w-form-fail / .w-form-done de la page (Webflow).
  //
  // Webflow place ce bloc APRÈS le formulaire entier — donc sous les boutons
  // OAuth et le lien « Se connecter ». Sur inscription.html il tombe hors de l'écran :
  // affiché seul, il donne un bouton qui paraît mort. On l'amène dans le champ
  // de vision quand il n'y est pas.
  function showError(form, msg) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) {
      var d = fail.querySelector('div'); if (d) d.textContent = msg;
      fail.style.display = 'block';
      var box = fail.getBoundingClientRect();
      if (box.top < 0 || box.bottom > (window.innerHeight || 0)) {
        try { fail.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (e) { fail.scrollIntoView(); } // options non supportées (vieux Safari)
      }
    } else {
      alert(msg);
    }
  }
  function clearError(form) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) fail.style.display = 'none';
  }
  function showCaptchaPrompt(form) { showError(form, CAPTCHA_INTERACTIVE_MSG); }
  // N'accuse la vérification que si le rejet vient bien d'elle : un réseau coupé
  // pendant l'appel Supabase n'est pas un problème de captcha.
  function failFrom(form, err) {
    showError(form, err && err.captcha ? CAPTCHA_FAIL_MSG : SERVICE_FAIL_MSG);
  }
  function setBusy(form, busy, original) {
    var btn = form.querySelector('input[type="submit"], button[type="submit"]');
    if (!btn) return original;
    if (busy) { var o = btn.value || btn.textContent; btn.dataset.orig = o; if ('value' in btn) btn.value = 'Patientez…'; else btn.textContent = 'Patientez…'; btn.disabled = true; return o; }
    if ('value' in btn) btn.value = btn.dataset.orig || original; else btn.textContent = btn.dataset.orig || original;
    btn.disabled = false;
  }

  // ── Handoff de session vers le CRM (app.megga.ch) ──────────────────
  //
  // La connexion vit sur megga.ch, le CRM sur app.megga.ch : DEUX ORIGINES,
  // donc deux localStorage cloisonnés. Une redirection nue vers le CRM y arrive
  // SANS session (elle est restée sur megga.ch) → le CRM ne voit personne et
  // renvoie au login → boucle infinie (bug confirmé le 19.07.2026 : login OK,
  // 3× /token 200, mais l'agent tourne en rond).
  //
  // On transmet donc les jetons dans le FRAGMENT d'URL vers /auth/callback :
  // le fragment n'est jamais envoyé au serveur (aucune fuite en logs), et le
  // client Supabase du CRM le consomme à son initialisation (detectSessionInUrl),
  // posant la session dans le storage de app.megga.ch AVANT de router vers le
  // dashboard. C'est exactement le mécanisme du retour OAuth, qui fonctionne.
  function goToCrm(session) {
    if (!session || !session.access_token || !session.refresh_token) {
      // Pas de session exploitable : redirection nue plutôt qu'un écran vide —
      // le CRM renverra proprement au login.
      window.location.href = CRM_URL;
      return;
    }
    var frag = [
      'access_token=' + encodeURIComponent(session.access_token),
      'refresh_token=' + encodeURIComponent(session.refresh_token),
      'expires_in=' + (session.expires_in || 3600),
      'token_type=' + (session.token_type || 'bearer'),
    ].join('&');
    window.location.href = AUTH_REDIRECT + '#' + frag;
  }

  function wire(client) {
    // ── OAuth Google / Microsoft (boutons .secondary-button.app-button) ──
    Array.prototype.forEach.call(document.querySelectorAll('a.app-button, .secondary-button.app-button'), function (btn) {
      var label = (btn.textContent || '').toLowerCase();
      var provider = label.indexOf('google') >= 0 ? 'google' : (label.indexOf('microsoft') >= 0 ? 'azure' : null);
      if (!provider) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        // La case de consentement gouverne AUSSI ces boutons. Ils créent un
        // compte sans passer par le formulaire : sans ce test, « Continuer avec
        // Google » ouvrait la seule porte d'inscription sans consentement, et
        // l'obligation posée sur le formulaire n'aurait été qu'un décor. La case
        // n'existe que sur inscription.html — connexion.html n'est pas concerné.
        var consentement = consentCheckbox();
        if (consentement && !consentement.checked) {
          var hote = btn.closest('form');
          if (hote) return showError(hote, CONSENT_MSG);
        }
        client.auth.signInWithOAuth({
          provider: provider,
          options: { redirectTo: AUTH_REDIRECT },
        });
      });
    });

    // ── LOGIN (Sign-In) : email + password ──
    var loginForm = byId('wf-form-Sign-In-Form');
    if (loginForm) {
      var emailEl = byId('Email');
      // Déjà durci par hardenAuthFields() au tout début ; on relit la référence.
      var pwdEl = loginPasswordField(loginForm);

      loginForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(loginForm);
        var email = (emailEl && emailEl.value || '').trim();
        var pwd = (pwdEl && pwdEl.value) || '';
        if (!email || !pwd) return showError(loginForm, 'E-mail et mot de passe requis.');
        setBusy(loginForm, true);
        getCaptchaToken(loginForm, function () { showCaptchaPrompt(loginForm); }).then(function (captchaToken) {
          clearError(loginForm);
          return client.auth.signInWithPassword({ email: email, password: pwd, options: { captchaToken: captchaToken } });
        }).then(function (res) {
          if (res.error) { setBusy(loginForm, false); return showError(loginForm, traduire(res.error.message)); }
          goToCrm(res.data && res.data.session);
        }).catch(function (err) { setBusy(loginForm, false); failFrom(loginForm, err); });
      }, true);

      // « Mot de passe oublié ? » → ouvre le modal (l'envoi se fait dedans).
      //
      // Avant : le lien déclenchait l'envoi depuis le formulaire de connexion,
      // ce qui obligeait à saisir son e-mail PUIS à recliquer sur le lien, et la
      // confirmation s'affichait dans le bloc de succès du formulaire de
      // connexion. Le modal donne un endroit à soi à cette demande.
      Array.prototype.forEach.call(loginForm.querySelectorAll('a'), function (a) {
        if (!/oubli/i.test(a.textContent)) return;
        a.setAttribute('href', '#');
        a.addEventListener('click', function (e) { e.preventDefault(); openReset(); });
      });
    }

    // ── MODAL « MOT DE PASSE OUBLIÉ » ──────────────────────────────────
    var resetModal = byId('megga-reset-modal');
    var resetForm = byId('megga-reset-form');
    var resetEmail = byId('megga-reset-email');
    var resetDone = resetModal && resetModal.querySelector('.w-form-done');
    var focusBeforeModal = null;

    function openReset() {
      if (!resetModal) return;
      focusBeforeModal = document.activeElement;
      // Remet le dialogue à zéro : sans ça, une 2e demande dans la même page
      // rouvrirait sur l'écran de confirmation, formulaire toujours masqué.
      if (resetForm) { resetForm.style.display = ''; clearError(resetForm); }
      if (resetDone) resetDone.style.display = 'none';
      // Reprend l'e-mail déjà saisi côté connexion, s'il y en a un.
      var typed = (byId('Email') && byId('Email').value || '').trim();
      if (resetEmail && typed) resetEmail.value = typed;
      resetModal.hidden = false;
      document.body.classList.add('megga-modal-open');
      if (resetEmail) resetEmail.focus();
    }

    function closeReset() {
      if (!resetModal || resetModal.hidden) return;
      resetModal.hidden = true;
      document.body.classList.remove('megga-modal-open');
      if (focusBeforeModal && focusBeforeModal.focus) focusBeforeModal.focus();
    }

    if (resetModal) {
      Array.prototype.forEach.call(resetModal.querySelectorAll('[data-megga-close]'), function (el) {
        el.addEventListener('click', function (e) { e.preventDefault(); closeReset(); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) closeReset();
      });
    }

    if (resetForm) {
      resetForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(resetForm);
        var email = (resetEmail && resetEmail.value || '').trim();
        if (!email) return showError(resetForm, 'Indiquez votre e-mail.');
        setBusy(resetForm, true);
        getCaptchaToken(resetForm, function () { showCaptchaPrompt(resetForm); }).then(function (captchaToken) {
          clearError(resetForm);
          return client.auth.resetPasswordForEmail(email, {
            redirectTo: RESET_REDIRECT,
            captchaToken: captchaToken,
          });
        }).then(function (res) {
          setBusy(resetForm, false);
          if (res && res.error) return showError(resetForm, traduire(res.error.message));
          // Supabase ne révèle jamais si l'adresse est connue (anti-énumération) :
          // le message reste donc conditionnel — affirmer « e-mail envoyé »
          // serait faux une fois sur deux.
          resetForm.style.display = 'none';
          if (resetDone) resetDone.style.display = 'block';
        }).catch(function (err) { setBusy(resetForm, false); failFrom(resetForm, err); });
      }, true);
    }

    // ── SIGNUP (Sign-Up) : nom + email + password (+ agence) ──
    var signupForm = byId('wf-form-Sign-Up-Form');
    if (signupForm) {
      // Message dans la page quand le consentement manque.
      //
      // La validation native bloque l'envoi mais ancre sa bulle sur l'`input`
      // de la case, invisible (opacity 0) sous la case dessinée de Webflow : ce
      // que le navigateur affiche là n'est ni garanti ni identique d'un moteur à
      // l'autre. Sans ce relais, le bouton principal aurait pu rester sans
      // réaction visible. `invalid` est émis avant la bulle, sur la case elle-même.
      var caseConsentement = consentCheckbox();
      if (caseConsentement) {
        caseConsentement.addEventListener('invalid', function () { showError(signupForm, CONSENT_MSG); });
      }
      signupForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(signupForm);
        var name = (byId('Name') && byId('Name').value || '').trim();
        var email = (byId('Email') && byId('Email').value || '').trim();
        var pwd = (byId('Password') && byId('Password').value) || '';
        var agency = (byId('Phone') && byId('Phone').value || '').trim(); // 4e champ = "Nom de votre agence"
        var consentement = consentCheckbox();
        if (!name || !email || !pwd) return showError(signupForm, 'Nom, e-mail et mot de passe requis.');
        if (pwd.length < 8) return showError(signupForm, 'Le mot de passe doit faire au moins 8 caractères.');
        // Le `required` du HTML porte déjà le blocage natif ; ce test le double
        // côté script parce que la page et ce fichier sont mis en cache
        // séparément — un HTML servi depuis un cache d'avant l'attribut
        // laisserait passer l'inscription sans consentement.
        if (consentement && !consentement.checked) return showError(signupForm, CONSENT_MSG);
        setBusy(signupForm, true);
        getCaptchaToken(signupForm, function () { showCaptchaPrompt(signupForm); }).then(function (captchaToken) {
          clearError(signupForm);
          return client.auth.signUp({
            email: email,
            password: pwd,
            options: {
              emailRedirectTo: AUTH_REDIRECT,
              captchaToken: captchaToken,
              // role:'agent' — cohérence avec le signup interne de l'app
              // (AuthBentoApp). Sans ça, le trigger handle_new_user retombe sur
              // 'buyer' et l'inscrit vitrine part dans le mauvais parcours.
              data: { full_name: name, agency_name: agency, role: 'agent' },
            },
          });
        }).then(function (res) {
          if (res.error) {
            setBusy(signupForm, false);
            return showExistingOrError(signupForm, res.error.message);
          }
          // Protection anti-énumération de Supabase : un e-mail DÉJÀ enregistré
          // renvoie un « faux succès » (res.error null) avec identities:[] et
          // n'envoie AUCUN e-mail de confirmation. Sans ce test, on afficherait
          // « Vérifiez vos e-mails » pour un message qui n'arrivera jamais — le
          // scénario exact où l'utilisateur croit s'inscrire et reste bloqué.
          var u = res.data && res.data.user;
          if (u && Array.isArray(u.identities) && u.identities.length === 0) {
            setBusy(signupForm, false);
            return showExistingAccount(signupForm);
          }
          // Vrai nouveau compte → confirmation e-mail.
          var wrap = signupForm.closest('.w-form') || signupForm.parentElement;
          var done = wrap.querySelector('.w-form-done');
          signupForm.style.display = 'none';
          if (done) { done.style.display = 'block'; var d = done.querySelector('div'); if (d) d.textContent = 'Compte créé ! Vérifiez votre e-mail pour confirmer, puis connectez-vous.'; }
          else { goToCrm(res.data && res.data.session); }
        }).catch(function (err) { setBusy(signupForm, false); failFrom(signupForm, err); });
      }, true);
    }

    // ── NOUVEAU MOT DE PASSE (nouveau-mot-de-passe.html) ─────────────────────
    //
    // Cible du lien reçu par e-mail. Le lien passe par /auth/v1/verify, qui
    // renvoie ici avec les jetons dans le FRAGMENT d'URL (flux implicite — le
    // client est créé sans flowType, donc pas de PKCE). Le SDK les consomme à
    // l'initialisation : au moment où l'on interroge getSession(), la session
    // de récupération est posée.
    var newPwdForm = byId('wf-form-New-Password-Form');
    if (newPwdForm) {
      var pwd1 = byId('New-Password');
      var pwd2 = byId('Confirm-Password');

      // Pas de session = lien périmé, déjà consommé, ou page ouverte à la main.
      // On le dit au lieu de laisser saisir un mot de passe qui serait refusé.
      function refuserLienMort() {
        newPwdForm.style.display = 'none';
        showError(newPwdForm, 'Lien expiré. Demandez-en un nouveau depuis la page de connexion.');
      }

      client.auth.getSession().then(function (res) {
        if (res && res.data && res.data.session) return;
        // Le SDK peut poser la session juste après (lecture du fragment) : on
        // laisse une fenêtre courte avant de conclure que le lien est mort.
        var tranche = false;
        client.auth.onAuthStateChange(function (_event, session) {
          if (tranche || !session) return;
          tranche = true;
        });
        setTimeout(function () {
          if (tranche) return;
          tranche = true;
          refuserLienMort();
        }, 1500);
      }).catch(function () { refuserLienMort(); });

      newPwdForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(newPwdForm);
        var a = (pwd1 && pwd1.value) || '';
        var b = (pwd2 && pwd2.value) || '';
        if (a.length < 8) return showError(newPwdForm, 'Le mot de passe doit faire au moins 8 caractères.');
        if (a !== b) return showError(newPwdForm, 'Les deux mots de passe ne correspondent pas.');
        setBusy(newPwdForm, true);
        // updateUser est un endpoint AUTHENTIFIÉ : aucun captcha ici,
        // contrairement à /recover et /token qui sont gatés au niveau du projet.
        client.auth.updateUser({ password: a }).then(function (res) {
          setBusy(newPwdForm, false);
          if (res && res.error) return showError(newPwdForm, traduire(res.error.message));
          var wrap = newPwdForm.closest('.w-form') || newPwdForm.parentElement;
          var done = wrap && wrap.querySelector('.w-form-done');
          newPwdForm.style.display = 'none';
          if (done) done.style.display = 'block';
          // La session de récupération a fait son office : on la referme pour ne
          // pas laisser traîner un jeton sur le domaine vitrine. L'agent se
          // reconnecte avec son nouveau mot de passe.
          client.auth.signOut()['catch'](function () { /* sans conséquence */ });
        }).catch(function (err) { setBusy(newPwdForm, false); failFrom(newPwdForm, err); });
      }, true);
    }
  }

  // Compte déjà existant : on NE crée rien, on oriente vers la connexion.
  function showExistingAccount(form) { showError(form, EXISTING_ACCOUNT_MSG); }
  function looksExistingAccount(msg) {
    var m = (msg || '').toLowerCase();
    return m.indexOf('already') >= 0 || m.indexOf('exists') >= 0 || m.indexOf('registered') >= 0;
  }
  function showExistingOrError(form, msg) {
    if (looksExistingAccount(msg)) return showExistingAccount(form);
    return showError(form, traduire(msg));
  }

  // Messages d'erreur Supabase courants → FR.
  function traduire(msg) {
    var m = (msg || '').toLowerCase();
    if (m.indexOf('invalid login') >= 0) return 'E-mail ou mot de passe incorrect. Si vous vous êtes inscrit avec Google, utilisez « Continuer avec Google ».';
    if (m.indexOf('email not confirmed') >= 0) return 'E-mail pas encore confirmé. Vérifiez votre boîte de réception (pensez aux spams).';
    if (looksExistingAccount(m)) return EXISTING_ACCOUNT_MSG;
    if (m.indexOf('rate limit') >= 0) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    // Le jeton du lien de réinitialisation a expiré ou a déjà servi entre
    // l'ouverture de la page et l'envoi du formulaire.
    if (m.indexOf('session missing') >= 0 || m.indexOf('session_not_found') >= 0 || m.indexOf('session from session_id') >= 0) {
      return 'Votre lien de réinitialisation a expiré. Retournez à la page de connexion pour en demander un nouveau.';
    }
    if (m.indexOf('should be different from the old password') >= 0 || m.indexOf('same_password') >= 0) {
      return 'Ce mot de passe est déjà le vôtre. Choisissez-en un autre.';
    }
    if (m.indexOf('password should be at least') >= 0 || m.indexOf('weak_password') >= 0) {
      return 'Mot de passe trop court ou trop simple. Allongez-le et mélangez lettres, chiffres et symboles.';
    }
    return msg || 'Une erreur est survenue.';
  }

  function run() {
    if (!byId('wf-form-Sign-In-Form') && !byId('wf-form-Sign-Up-Form') && !byId('wf-form-New-Password-Form')) return;
    // Avant le réseau : un SDK lent ou absent ne doit pas laisser le mot de
    // passe lisible ni les liens OAuth pointer hors du site.
    hardenAuthFields();
    loadSdk().then(function () {
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      wire(client);
    }).catch(function () {
      // SDK indisponible : on ne casse pas la page, on prévient au submit.
      var f = byId('wf-form-Sign-In-Form') || byId('wf-form-Sign-Up-Form') || byId('wf-form-New-Password-Form');
      if (f) f.addEventListener('submit', function (e) { e.preventDefault(); showError(f, 'Service d’authentification indisponible. Réessayez.'); }, true);
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
