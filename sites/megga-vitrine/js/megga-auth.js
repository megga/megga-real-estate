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
  /**
   * Cible du lien de réinitialisation, dans la langue de la demande.
   *
   * Elle vivait sur app.megga.ch (ancienne coquille auth du CRM). Rapatriée ici :
   * cet écran ne renvoyait de toute façon PAS vers le dashboard mais vers
   * megga.ch/login une fois le mot de passe changé — le détour par l'app ne
   * servait donc qu'à traverser un second domaine dans une autre peau.
   *
   * Les slugs sont ceux du générateur (scripts/_shared/vitrine-i18n.mjs, PAGES)
   * et du gate (_worker.js, SLUGS_PAR_LANGUE) : une demande faite sur
   * /de/anmelden renvoie sur /de/neues-passwort, pas sur la page française.
   *
   * ⚠ Chaque valeur doit figurer TELLE QUELLE dans l'allowlist Supabase
   * (Auth → URL Configuration → Redirect URLs), qu'aucun déploiement ne met à
   * jour : en ajouter une ici sans l'inscrire là-bas ne casse rien de visible —
   * Supabase ignore la cible et renvoie sur la Site URL, donc le lien reçu par
   * e-mail n'atterrit nulle part d'utile.
   */
  var RESET_REDIRECT_PAR_LANGUE = {
    fr: 'https://megga.ch/reset-password',
    de: 'https://megga.ch/de/neues-passwort',
    en: 'https://megga.ch/en/reset-password',
    it: 'https://megga.ch/it/nuova-password',
  };

  // Cloudflare Turnstile — Supabase exige un token captcha sur chaque appel auth
  // (signin / signup / reset). Site key publique (même projet que l'app).
  var TURNSTILE_SITE_KEY = '0x4AAAAAADT4gba9sDd8Uo4Y';
  var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var turnstileWidgetId = null;
  // Délai machine. Porté à 2 min dès qu'un challenge visible démarre : c'est
  // alors un humain qui répond, pas le réseau.
  var CAPTCHA_TIMEOUT_MS = 20000;
  var CAPTCHA_INTERACTIVE_TIMEOUT_MS = 120000;

  /**
   * Messages de l'auth, par langue.
   *
   * ⚠ Ce fichier est servi TEL QUEL aux pages traduites : le générateur i18n
   * ignore le contenu des <script>. Sans cette table, une inscription ratée sur
   * /de/registrieren répondait en français, sur une page par ailleurs entièrement
   * allemande. La langue est lue dans `<html lang>`, que le build a posé.
   */
  var T = {
    fr: {
      captchaFail: "Vérification de sécurité impossible. Réessayez.",
      captchaInteractive: "Confirmez que vous n’êtes pas un robot.",
      serviceFail: "Connexion impossible. Réessayez.",
      existingAccount: "Un compte existe déjà avec cet e-mail.",
      consent: "Acceptez les conditions pour continuer.",
      patientez: "Patientez…",
      loginRequis: "E-mail et mot de passe requis.",
      emailRequis: "Indiquez votre e-mail.",
      signupRequis: "Nom, e-mail et mot de passe requis.",
      motDePasseCourt: "Le mot de passe doit faire au moins 8 caractères.",
      lienExpire: "Lien expiré. Demandez-en un nouveau depuis la page de connexion.",
      motsDePasseDifferents: "Les deux mots de passe ne correspondent pas.",
      identifiantsInvalides: "E-mail ou mot de passe incorrect.",
      emailNonConfirme: "E-mail pas encore confirmé. Cliquez sur le lien reçu.",
      tropDeTentatives: "Trop de tentatives. Réessayez dans quelques minutes.",
      lienPerime: "Lien expiré. Demandez-en un nouveau depuis la connexion.",
      memeMotDePasse: "Ce mot de passe est déjà le vôtre. Choisissez-en un autre.",
      motDePasseFaible: "Mot de passe trop simple. Allongez-le et mélangez lettres et chiffres.",
      serviceIndisponible: "Service d’authentification indisponible. Réessayez.",
      erreur: "Une erreur est survenue.",
    },
    de: {
      captchaFail: "Sicherheitsprüfung nicht möglich. Versuchen Sie es erneut.",
      captchaInteractive: "Bestätigen Sie, dass Sie kein Roboter sind.",
      serviceFail: "Verbindung nicht möglich. Versuchen Sie es erneut.",
      existingAccount: "Mit dieser E-Mail-Adresse besteht bereits ein Konto.",
      consent: "Akzeptieren Sie die Bedingungen, um fortzufahren.",
      patientez: "Einen Moment…",
      loginRequis: "E-Mail und Passwort erforderlich.",
      emailRequis: "Geben Sie Ihre E-Mail-Adresse an.",
      signupRequis: "Name, E-Mail und Passwort erforderlich.",
      motDePasseCourt: "Das Passwort muss mindestens 8 Zeichen lang sein.",
      lienExpire: "Link abgelaufen. Fordern Sie auf der Anmeldeseite einen neuen an.",
      motsDePasseDifferents: "Die beiden Passwörter stimmen nicht überein.",
      identifiantsInvalides: "E-Mail oder Passwort ist falsch.",
      emailNonConfirme: "E-Mail noch nicht bestätigt. Klicken Sie auf den erhaltenen Link.",
      tropDeTentatives: "Zu viele Versuche. Versuchen Sie es in einigen Minuten erneut.",
      lienPerime: "Link abgelaufen. Fordern Sie über die Anmeldung einen neuen an.",
      memeMotDePasse: "Dieses Passwort ist bereits Ihres. Wählen Sie ein anderes.",
      motDePasseFaible: "Passwort zu einfach. Verlängern Sie es und mischen Sie Buchstaben und Zahlen.",
      serviceIndisponible: "Authentifizierungsdienst nicht verfügbar. Versuchen Sie es erneut.",
      erreur: "Es ist ein Fehler aufgetreten.",
    },
    en: {
      captchaFail: "Security check failed. Try again.",
      captchaInteractive: "Confirm that you are not a robot.",
      serviceFail: "Connection failed. Try again.",
      existingAccount: "An account already exists with this email address.",
      consent: "Accept the terms to continue.",
      patientez: "One moment…",
      loginRequis: "Email and password required.",
      emailRequis: "Enter your email address.",
      signupRequis: "Name, email and password required.",
      motDePasseCourt: "The password must be at least 8 characters long.",
      lienExpire: "Link expired. Request a new one from the sign-in page.",
      motsDePasseDifferents: "The two passwords do not match.",
      identifiantsInvalides: "Incorrect email or password.",
      emailNonConfirme: "Email not confirmed yet. Click the link you received.",
      tropDeTentatives: "Too many attempts. Try again in a few minutes.",
      lienPerime: "Link expired. Request a new one from the sign-in page.",
      memeMotDePasse: "This password is already yours. Choose a different one.",
      motDePasseFaible: "Password too simple. Make it longer and mix letters and numbers.",
      serviceIndisponible: "Authentication service unavailable. Please try again.",
      erreur: "An error occurred.",
    },
    it: {
      captchaFail: "Verifica di sicurezza non riuscita. Riprovi.",
      captchaInteractive: "Confermi di non essere un robot.",
      serviceFail: "Connessione non riuscita. Riprovi.",
      existingAccount: "Esiste già un account con questa e-mail.",
      consent: "Accetti le condizioni per continuare.",
      patientez: "Un istante…",
      loginRequis: "E-mail e password obbligatorie.",
      emailRequis: "Indichi il suo indirizzo e-mail.",
      signupRequis: "Nome, e-mail e password obbligatori.",
      motDePasseCourt: "La password deve contenere almeno 8 caratteri.",
      lienExpire: "Link scaduto. Ne richieda uno nuovo dalla pagina di accesso.",
      motsDePasseDifferents: "Le due password non corrispondono.",
      identifiantsInvalides: "E-mail o password errati.",
      emailNonConfirme: "E-mail non ancora confermata. Clicchi sul link ricevuto.",
      tropDeTentatives: "Troppi tentativi. Riprovi tra qualche minuto.",
      lienPerime: "Link scaduto. Ne richieda uno nuovo dalla pagina di accesso.",
      memeMotDePasse: "Questa password è già la sua. Ne scelga un'altra.",
      motDePasseFaible: "Password troppo semplice. La allunghi e mescoli lettere e numeri.",
      serviceIndisponible: "Servizio di autenticazione non disponibile. Riprovi.",
      erreur: "Si è verificato un errore.",
    },
  };

  /**
   * `?lang=` à accrocher aux URLs du CRM.
   *
   * megga.ch et app.megga.ch ont des stockages cloisonnés : sans ce paramètre,
   * un agent qui lisait la vitrine en allemand atterrissait dans un CRM en
   * français — ou en anglais si un vieux réglage traînait. Le CRM le grave chez
   * lui (src/i18n/index.ts, seedLanguageFromUrl).
   *
   * ⚠ Sert aussi aux redirections que Supabase valide (`redirectTo` d'un
   * signInWithOAuth, `emailRedirectTo` d'un signUp) : l'allowlist porte depuis
   * le 31 juil. 2026 l'entrée `https://app.megga.ch/auth/callback*`.
   */
  function langueQuery() { return '?lang=' + langue(); }

  /** Page « nouveau mot de passe » de la langue courante. */
  function resetRedirect() {
    return RESET_REDIRECT_PAR_LANGUE[langue()] || RESET_REDIRECT_PAR_LANGUE.fr;
  }

  /** Langue de la page, posée par le build dans `<html lang>`. */
  function langue() {
    var l = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2).toLowerCase();
    return T[l] ? l : 'fr';
  }
  /** Message dans la langue de la page. */
  function m(cle) { return T[langue()][cle] || T.fr[cle]; }


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
   * Case « J'accepte les conditions… » de signup.html, ou `null` ailleurs.
   *
   * ⚠ Surtout PAS par son id : le template Webflow a nommé `checkbox-3` la
   * première case de chaque page, et sur login.html c'est « Rester connecté ».
   * Chercher par id ferait dépendre la connexion Google d'une case « rester
   * connecté » décochée. On passe donc par la ligne de consentement, qui
   * n'existe que sur signup.html.
   */
  function consentCheckbox() { return $('.megga-signup__consent input[type="checkbox"]'); }

  // Champ mot de passe de la page de connexion, re-typé au besoin.
  //
  // `login.html` porte désormais un vrai `type="password"`, mais il a longtemps
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

  // Filet de sécurité : un bloc affiché hors de l'écran donne un bouton qui
  // paraît mort. Le message d'erreur vit désormais au-dessus du bouton d'envoi
  // (cf. `.megga-form-error`), donc ce déplacement ne sert plus qu'aux cas
  // limites — petite fenêtre, page déjà défilée, bloc de confirmation long.
  //
  // Défilement INSTANTANÉ, pas `smooth` : une animation de défilement qui part
  // pendant que l'utilisateur fait tourner sa molette se dispute la page avec
  // lui, et donne exactement la sensation d'un écran qui refuse de bouger.
  function amenerDansLaVue(el) {
    var box = el.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= (window.innerHeight || 0)) return;
    try { el.scrollIntoView({ block: 'center' }); }
    catch (e) { el.scrollIntoView(); } // options non supportées (vieux Safari)
  }

  // Affiche un message dans le bloc .w-form-fail de la page (Webflow).
  function showError(form, msg) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) {
      var d = fail.querySelector('div'); if (d) d.textContent = msg;
      fail.style.display = 'block';
      amenerDansLaVue(fail);
    } else {
      alert(msg);
    }
  }
  function clearError(form) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) fail.style.display = 'none';
  }

  /**
   * Bascule un formulaire sur le bloc de confirmation écrit dans la page.
   *
   * Le bloc est affiché TEL QUEL — sa carte, son icône, son titre, son
   * paragraphe. L'inscription y injectait naguère sa propre phrase par
   * `textContent` sur le premier `<div>` du bloc, c'est-à-dire sur la carte
   * entière : icône et titre étaient effacés au passage et il ne restait qu'une
   * ligne de texte au milieu de la page. Le texte de la page est en outre déjà
   * traduit par le générateur, ce qu'une phrase injectée d'ici ne serait pas.
   *
   * Les éléments marqués `data-megga-hide-on-done` disparaissent avec le
   * formulaire : le titre de la page annonce une action à faire (« Créez votre
   * compte »), il n'a plus lieu d'être une fois la chose faite.
   *
   * Renvoie false si la page n'a pas de bloc de confirmation — à l'appelant de
   * décider de la suite plutôt que de laisser un écran vide.
   */
  function showDone(form) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var done = wrap && wrap.querySelector('.w-form-done');
    if (!done) return false;
    clearError(form);
    form.style.display = 'none';
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-megga-hide-on-done]'),
      function (el) { el.style.display = 'none'; },
    );
    done.style.display = 'block';
    amenerDansLaVue(done);
    return true;
  }

  function showCaptchaPrompt(form) { showError(form, m('captchaInteractive')); }
  // N'accuse la vérification que si le rejet vient bien d'elle : un réseau coupé
  // pendant l'appel Supabase n'est pas un problème de captcha.
  function failFrom(form, err) {
    showError(form, err && err.captcha ? m('captchaFail') : m('serviceFail'));
  }
  function setBusy(form, busy, original) {
    var btn = form.querySelector('input[type="submit"], button[type="submit"]');
    if (!btn) return original;
    if (busy) { var o = btn.value || btn.textContent; btn.dataset.orig = o; if ('value' in btn) btn.value = m('patientez'); else btn.textContent = m('patientez'); btn.disabled = true; return o; }
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
      window.location.href = CRM_URL + langueQuery();
      return;
    }
    var frag = [
      'access_token=' + encodeURIComponent(session.access_token),
      'refresh_token=' + encodeURIComponent(session.refresh_token),
      'expires_in=' + (session.expires_in || 3600),
      'token_type=' + (session.token_type || 'bearer'),
    ].join('&');
    window.location.href = AUTH_REDIRECT + langueQuery() + '#' + frag;
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
        // n'existe que sur signup.html — login.html n'est pas concerné.
        var consentement = consentCheckbox();
        if (consentement && !consentement.checked) {
          var hote = btn.closest('form');
          if (hote) return showError(hote, m('consent'));
        }
        client.auth.signInWithOAuth({
          provider: provider,
          options: { redirectTo: AUTH_REDIRECT + langueQuery() },
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
        if (!email || !pwd) return showError(loginForm, m('loginRequis'));
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
        // Repère par ATTRIBUT, pas par libellé : « oubli » ne reconnaissait que
        // la page française, et sur /de/anmelden, /en/login et /it/accedi le
        // lien gardait son href — un agent qui avait perdu son mot de passe
        // atterrissait sur le formulaire de contact. Le test sur le texte reste
        // en repli, dans les quatre langues, pour une page servie d'un cache
        // antérieur à l'attribut.
        if (!a.hasAttribute('data-megga-reset')
            && !/oubli|vergessen|forgot|dimenticat/i.test(a.textContent)) return;
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
        if (!email) return showError(resetForm, m('emailRequis'));
        setBusy(resetForm, true);
        getCaptchaToken(resetForm, function () { showCaptchaPrompt(resetForm); }).then(function (captchaToken) {
          clearError(resetForm);
          return client.auth.resetPasswordForEmail(email, {
            redirectTo: resetRedirect(),
            captchaToken: captchaToken,
          });
        }).then(function (res) {
          setBusy(resetForm, false);
          if (res && res.error) return showError(resetForm, traduire(res.error.message));
          // Supabase ne révèle jamais si l'adresse est connue (anti-énumération) :
          // le message reste donc conditionnel — affirmer « e-mail envoyé »
          // serait faux une fois sur deux.
          showDone(resetForm);
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
        caseConsentement.addEventListener('invalid', function () { showError(signupForm, m('consent')); });
      }
      signupForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(signupForm);
        var name = (byId('Name') && byId('Name').value || '').trim();
        var email = (byId('Email') && byId('Email').value || '').trim();
        var pwd = (byId('Password') && byId('Password').value) || '';
        var agency = (byId('Phone') && byId('Phone').value || '').trim(); // 4e champ = "Nom de votre agence"
        var consentement = consentCheckbox();
        if (!name || !email || !pwd) return showError(signupForm, m('signupRequis'));
        if (pwd.length < 8) return showError(signupForm, m('motDePasseCourt'));
        // Le `required` du HTML porte déjà le blocage natif ; ce test le double
        // côté script parce que la page et ce fichier sont mis en cache
        // séparément — un HTML servi depuis un cache d'avant l'attribut
        // laisserait passer l'inscription sans consentement.
        if (consentement && !consentement.checked) return showError(signupForm, m('consent'));
        setBusy(signupForm, true);
        getCaptchaToken(signupForm, function () { showCaptchaPrompt(signupForm); }).then(function (captchaToken) {
          clearError(signupForm);
          return client.auth.signUp({
            email: email,
            password: pwd,
            options: {
              // Le lien de confirmation ouvre le CRM dans la langue de la page
              // d'inscription — c'est le trajet exact où l'agent tombait sur un
              // CRM en anglais après avoir tout lu en français.
              emailRedirectTo: AUTH_REDIRECT + langueQuery(),
              captchaToken: captchaToken,
              // role:'agent' — cohérence avec le signup interne de l'app
              // (AuthBentoApp). Sans ça, le trigger handle_new_user retombe sur
              // 'buyer' et l'inscrit vitrine part dans le mauvais parcours.
              //
              // legal_consent : la case obligatoire ci-dessus, vérifiée juste
              // avant. Le trigger en fait une preuve datée dans user_consents
              // (migration 20260731210000) avec LA VERSION QU'IL CONNAÎT — sans
              // elle, le CRM redemandait la même acceptation à la première
              // session, trente secondes plus tard. On déclare que l'agent a
              // accepté, jamais ce qu'il aurait accepté.
              data: {
                full_name: name,
                agency_name: agency,
                role: 'agent',
                legal_consent: true,
                // La langue de la PAGE d'inscription devient la langue de
                // correspondance : le trigger handle_new_user la pose sur
                // profiles.language (migration 20260815250000). Sans elle, un
                // inscrit germanophone recevait tous ses courriels en francais —
                // y compris ceux qu'aucun clic ne declenche, comme le rappel J-1,
                // qui n'a aucune requete d'ou lire une langue.
                language: langue(),
              },
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
          // Vrai nouveau compte → l'écran de confirmation de la page prend la
          // main. Il porte déjà la consigne, dans la langue de la page ;
          // rien à injecter ici. Sans ce bloc, on enchaîne sur le CRM.
          if (!showDone(signupForm)) goToCrm(res.data && res.data.session);
        }).catch(function (err) { setBusy(signupForm, false); failFrom(signupForm, err); });
      }, true);
    }

    // ── NOUVEAU MOT DE PASSE (reset-password.html) ─────────────────────
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
        showError(newPwdForm, m('lienExpire'));
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
        if (a.length < 8) return showError(newPwdForm, m('motDePasseCourt'));
        if (a !== b) return showError(newPwdForm, m('motsDePasseDifferents'));
        setBusy(newPwdForm, true);
        // updateUser est un endpoint AUTHENTIFIÉ : aucun captcha ici,
        // contrairement à /recover et /token qui sont gatés au niveau du projet.
        client.auth.updateUser({ password: a }).then(function (res) {
          setBusy(newPwdForm, false);
          if (res && res.error) return showError(newPwdForm, traduire(res.error.message));
          showDone(newPwdForm);
          // La session de récupération a fait son office : on la referme pour ne
          // pas laisser traîner un jeton sur le domaine vitrine. L'agent se
          // reconnecte avec son nouveau mot de passe.
          client.auth.signOut()['catch'](function () { /* sans conséquence */ });
        }).catch(function (err) { setBusy(newPwdForm, false); failFrom(newPwdForm, err); });
      }, true);
    }
  }

  // Compte déjà existant : on NE crée rien, on oriente vers la connexion.
  function showExistingAccount(form) { showError(form, m('existingAccount')); }
  function looksExistingAccount(msg) {
    var brut = (msg || '').toLowerCase();
    return brut.indexOf('already') >= 0 || brut.indexOf('exists') >= 0 || brut.indexOf('registered') >= 0;
  }
  function showExistingOrError(form, msg) {
    if (looksExistingAccount(msg)) return showExistingAccount(form);
    return showError(form, traduire(msg));
  }

  // Messages d'erreur Supabase courants → FR.
  // ⚠ Le texte examiné s'appelle `brut`, PAS `m` : `m(clé)` est la fonction qui
  // rend les messages traduits, et une variable locale du même nom la masquait —
  // chaque branche levait alors « m is not a function ». L'exception remontait
  // au .catch() du formulaire, qui accuse le réseau : un mot de passe faux
  // s'affichait « Connexion impossible ». (Corrigé le 31 juil. 2026.)
  function traduire(msg) {
    var brut = (msg || '').toLowerCase();
    if (brut.indexOf('invalid login') >= 0) return m('identifiantsInvalides');
    if (brut.indexOf('email not confirmed') >= 0) return m('emailNonConfirme');
    if (looksExistingAccount(brut)) return m('existingAccount');
    if (brut.indexOf('rate limit') >= 0) return m('tropDeTentatives');
    // Le jeton du lien de réinitialisation a expiré ou a déjà servi entre
    // l'ouverture de la page et l'envoi du formulaire.
    if (brut.indexOf('session missing') >= 0 || brut.indexOf('session_not_found') >= 0 || brut.indexOf('session from session_id') >= 0) {
      return m('lienPerime');
    }
    if (brut.indexOf('should be different from the old password') >= 0 || brut.indexOf('same_password') >= 0) {
      return m('memeMotDePasse');
    }
    if (brut.indexOf('password should be at least') >= 0 || brut.indexOf('weak_password') >= 0) {
      return m('motDePasseFaible');
    }
    return msg || m('erreur');
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
      if (f) f.addEventListener('submit', function (e) { e.preventDefault(); showError(f, m('serviceIndisponible')); }, true);
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
