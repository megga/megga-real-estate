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

  // Cloudflare Turnstile — Supabase exige un token captcha sur chaque appel auth
  // (signin / signup / reset). Site key publique (même projet que l'app).
  var TURNSTILE_SITE_KEY = '0x4AAAAAAADT4gba9sDd8Uo4Y';
  var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var turnstileWidgetId = null;

  function loadScript(src, test) {
    return new Promise(function (resolve, reject) {
      if (test && test()) return resolve();
      var s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadSdk() {
    return loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
      function () { return window.supabase && window.supabase.createClient; });
  }

  // Conteneur du widget Turnstile. Le widget « MEGGA Auth » est en mode INVISIBLE
  // (pas de friction visuelle) → conteneur caché + size:'invisible' + execute().
  function ensureTurnstileContainer() {
    var c = document.getElementById('megga-turnstile');
    if (!c) {
      c = document.createElement('div');
      c.id = 'megga-turnstile';
      c.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
      document.body.appendChild(c);
    }
    return c;
  }

  // Renvoie un token frais à chaque appel (Turnstile invalide le token après
  // usage → reset + execute pour chaque tentative). Mode invisible.
  function getCaptchaToken() {
    return loadScript(TURNSTILE_SRC, function () { return window.turnstile; })
      .then(function () {
        return new Promise(function (resolve, reject) {
          if (!window.turnstile) return reject(new Error('turnstile indisponible'));
          var done = false;
          var to = setTimeout(function () { if (!done) { done = true; reject(new Error('captcha timeout')); } }, 30000);
          var opts = {
            sitekey: TURNSTILE_SITE_KEY,
            size: 'invisible',
            callback: function (token) { if (done) return; done = true; clearTimeout(to); resolve(token); },
            'error-callback': function () { if (done) return; done = true; clearTimeout(to); reject(new Error('captcha erreur')); },
            'expired-callback': function () { try { window.turnstile.reset(turnstileWidgetId); } catch (e) { /* */ } },
          };
          if (turnstileWidgetId === null) {
            turnstileWidgetId = window.turnstile.render(ensureTurnstileContainer(), opts);
          } else {
            try { window.turnstile.reset(turnstileWidgetId); } catch (e) { /* */ }
          }
          try { window.turnstile.execute(turnstileWidgetId); } catch (e) { /* render() déclenche déjà execute en invisible */ }
        });
      });
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function byId(id) { return document.getElementById(id); }

  // Affiche un message dans le bloc .w-form-fail / .w-form-done de la page (Webflow).
  function showError(form, msg) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) {
      var d = fail.querySelector('div'); if (d) d.textContent = msg;
      fail.style.display = 'block';
    } else {
      alert(msg);
    }
  }
  function clearError(form) {
    var wrap = form.closest('.w-form') || form.parentElement;
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (fail) fail.style.display = 'none';
  }
  function setBusy(form, busy, original) {
    var btn = form.querySelector('input[type="submit"], button[type="submit"]');
    if (!btn) return original;
    if (busy) { var o = btn.value || btn.textContent; btn.dataset.orig = o; if ('value' in btn) btn.value = 'Patientez…'; else btn.textContent = 'Patientez…'; btn.disabled = true; return o; }
    if ('value' in btn) btn.value = btn.dataset.orig || original; else btn.textContent = btn.dataset.orig || original;
    btn.disabled = false;
  }

  function wire(client) {
    // ── OAuth Google / Microsoft (boutons .secondary-button.app-button) ──
    Array.prototype.forEach.call(document.querySelectorAll('a.app-button, .secondary-button.app-button'), function (btn) {
      var label = (btn.textContent || '').toLowerCase();
      var provider = label.indexOf('google') >= 0 ? 'google' : (label.indexOf('microsoft') >= 0 ? 'azure' : null);
      if (!provider) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
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
      // Le champ "mot de passe" du login est mal typé dans le template
      // (type=tel, id=Phone, placeholder "Votre mot de passe"). On le corrige.
      var pwdEl = loginForm.querySelector('input[placeholder*="mot de passe" i]') || byId('Phone');
      if (pwdEl) { pwdEl.type = 'password'; pwdEl.setAttribute('autocomplete', 'current-password'); }
      if (emailEl) emailEl.setAttribute('autocomplete', 'username');

      loginForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(loginForm);
        var email = (emailEl && emailEl.value || '').trim();
        var pwd = (pwdEl && pwdEl.value) || '';
        if (!email || !pwd) return showError(loginForm, 'E-mail et mot de passe requis.');
        setBusy(loginForm, true);
        getCaptchaToken().then(function (captchaToken) {
          return client.auth.signInWithPassword({ email: email, password: pwd, options: { captchaToken: captchaToken } });
        }).then(function (res) {
          if (res.error) { setBusy(loginForm, false); return showError(loginForm, traduire(res.error.message)); }
          window.location.href = CRM_URL;
        }).catch(function () { setBusy(loginForm, false); showError(loginForm, 'Vérification anti-robot impossible. Réessayez.'); });
      }, true);

      // "Mot de passe oublié ?" → reset par email
      Array.prototype.forEach.call(loginForm.querySelectorAll('a'), function (a) {
        if (!/oubli/i.test(a.textContent)) return;
        a.setAttribute('href', '#');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var email = (byId('Email') && byId('Email').value || '').trim();
          if (!email) return showError(loginForm, 'Saisissez d’abord votre e-mail, puis recliquez sur « Mot de passe oublié ? ».');
          getCaptchaToken().then(function (captchaToken) {
            return client.auth.resetPasswordForEmail(email, { redirectTo: 'https://app.megga.ch/auth/forgot-password/reset', captchaToken: captchaToken });
          }).then(function () {
            clearError(loginForm);
            var done = (loginForm.closest('.w-form') || loginForm.parentElement).querySelector('.w-form-done');
            if (done) { done.style.display = 'block'; var d = done.querySelector('div'); if (d) d.textContent = 'E-mail de réinitialisation envoyé.'; }
            else alert('E-mail de réinitialisation envoyé.');
          }).catch(function () { showError(loginForm, 'Vérification anti-robot impossible. Réessayez.'); });
        });
      });
    }

    // ── SIGNUP (Sign-Up) : nom + email + password (+ agence) ──
    var signupForm = byId('wf-form-Sign-Up-Form');
    if (signupForm) {
      signupForm.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopPropagation(); clearError(signupForm);
        var name = (byId('Name') && byId('Name').value || '').trim();
        var email = (byId('Email') && byId('Email').value || '').trim();
        var pwd = (byId('Password') && byId('Password').value) || '';
        var agency = (byId('Phone') && byId('Phone').value || '').trim(); // 4e champ = "Nom de votre agence"
        if (!name || !email || !pwd) return showError(signupForm, 'Nom, e-mail et mot de passe requis.');
        if (pwd.length < 8) return showError(signupForm, 'Le mot de passe doit faire au moins 8 caractères.');
        setBusy(signupForm, true);
        getCaptchaToken().then(function (captchaToken) {
          return client.auth.signUp({
            email: email,
            password: pwd,
            options: {
              emailRedirectTo: AUTH_REDIRECT,
              captchaToken: captchaToken,
              data: { full_name: name, agency_name: agency },
            },
          });
        }).then(function (res) {
          if (res.error) { setBusy(signupForm, false); return showError(signupForm, traduire(res.error.message)); }
          // Supabase exige souvent une confirmation e-mail → message + CTA.
          var wrap = signupForm.closest('.w-form') || signupForm.parentElement;
          var done = wrap.querySelector('.w-form-done');
          signupForm.style.display = 'none';
          if (done) { done.style.display = 'block'; var d = done.querySelector('div'); if (d) d.textContent = 'Compte créé ! Vérifiez votre e-mail pour confirmer, puis connectez-vous.'; }
          else { window.location.href = CRM_URL; }
        }).catch(function () { setBusy(signupForm, false); showError(signupForm, 'Vérification anti-robot impossible. Réessayez.'); });
      }, true);
    }
  }

  // Messages d'erreur Supabase courants → FR.
  function traduire(msg) {
    var m = (msg || '').toLowerCase();
    if (m.indexOf('invalid login') >= 0) return 'E-mail ou mot de passe incorrect.';
    if (m.indexOf('email not confirmed') >= 0) return 'E-mail pas encore confirmé. Vérifiez votre boîte de réception.';
    if (m.indexOf('already registered') >= 0 || m.indexOf('already exists') >= 0) return 'Un compte existe déjà avec cet e-mail.';
    if (m.indexOf('rate limit') >= 0) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    return msg || 'Une erreur est survenue.';
  }

  function run() {
    if (!byId('wf-form-Sign-In-Form') && !byId('wf-form-Sign-Up-Form')) return;
    loadSdk().then(function () {
      var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      wire(client);
    }).catch(function () {
      // SDK indisponible : on ne casse pas la page, on prévient au submit.
      var f = byId('wf-form-Sign-In-Form') || byId('wf-form-Sign-Up-Form');
      if (f) f.addEventListener('submit', function (e) { e.preventDefault(); showError(f, 'Service d’authentification indisponible. Réessayez.'); }, true);
    });
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
