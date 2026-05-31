// Contact form (contact-v1.html) → CRM.
// The Webflow demo form posts nowhere (static export). This script:
//   1. Localises the form to FR (+ fixes the mislabeled message field).
//   2. Injects a required privacy-consent checkbox (RLS requires
//      consent_privacy=true; also nLPD-compliant).
//   3. Intercepts submit and POSTs to /api/contact-message → contact_messages.
// A DB trigger then raises the agent notification bell. Super-admins also read
// the message in the back-office (contact_messages, RLS super_admin).
(function () {
  var FORM_ID = 'wf-form-Contact-V1-Form';

  function byId(id) { return document.getElementById(id); }
  function group(el) { var w = el.closest('.input-wrapper'); return w ? w.parentElement : el.parentElement; }
  function setLabel(id, text) { var el = byId(id); if (!el) return; var g = group(el); var l = g && g.querySelector('label'); if (l) l.textContent = text; }
  function setPlaceholder(id, text) { var el = byId(id); if (el) el.setAttribute('placeholder', text); }
  function optional(id) { var el = byId(id); if (el) el.removeAttribute('required'); }
  function val(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function checked(id) { var el = byId(id); return !!(el && el.checked); }

  function localise() {
    setLabel('name', 'Nom complet'); setPlaceholder('name', 'Nom complet');
    setLabel('email', 'Adresse e-mail'); setPlaceholder('email', 'exemple@email.ch');
    setLabel('phone', 'Téléphone (facultatif)'); setPlaceholder('phone', '+41 22 123 45 67');
    setLabel('subject', 'Sujet (facultatif)'); setPlaceholder('subject', 'ex. Demande d’estimation');
    // The demo mislabels the message field "Listing short description".
    setLabel('message', 'Votre message'); setPlaceholder('message', 'Comment pouvons-nous vous aider ? (10 caractères min.)');
    var msg = byId('message');
    if (msg) { msg.setAttribute('minlength', '10'); msg.setAttribute('maxlength', '5000'); }

    optional('phone'); optional('subject');

    // Submit button + generic English strings.
    Array.prototype.forEach.call(document.querySelectorAll('input[type="submit"]'), function (b) {
      if (/send|submit|envoyer/i.test(b.value)) b.value = 'Envoyer le message';
    });

    // Success message → FR.
    var form = byId(FORM_ID);
    var wrap = form && form.parentElement;
    var done = wrap && wrap.querySelector('.w-form-done');
    if (done) {
      var h = done.querySelector('.display-8, h3, .display-4');
      if (h) h.textContent = 'Merci !';
      var body = done.querySelector('p, .text-titles div div, .mg-top-extra-small div');
      if (body) body.textContent = 'Votre message a bien été envoyé. Nous vous répondrons rapidement.';
    }
  }

  // Inject a required privacy-consent checkbox just before the submit button.
  function injectConsent() {
    if (byId('consent')) return;
    var form = byId(FORM_ID);
    if (!form) return;
    var submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
    var anchor = submitBtn ? (submitBtn.closest('.buttons-row, .mg-top-medium, .mg-top-small') || submitBtn.parentElement) : null;
    if (!anchor) return;
    var label = document.createElement('label');
    label.style.cssText = 'display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:14px;line-height:1.45;margin-bottom:16px;color:inherit';
    var box = document.createElement('input');
    box.type = 'checkbox'; box.id = 'consent'; box.required = true;
    box.style.cssText = 'margin-top:3px;flex:none;width:16px;height:16px;cursor:pointer';
    var span = document.createElement('span');
    span.textContent = 'J’accepte que mes données soient traitées pour répondre à ma demande, conformément à la politique de confidentialité.';
    label.appendChild(box); label.appendChild(span);
    anchor.parentNode.insertBefore(label, anchor);
  }

  function buildBody() {
    return {
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      subject: val('subject'),
      message: val('message'),
      consent: checked('consent'),
    };
  }

  function showState(form, ok, errMsg) {
    var wrap = form.parentElement;
    var done = wrap && wrap.querySelector('.w-form-done');
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (ok) {
      form.style.display = 'none';
      if (done) { done.style.display = 'block'; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else if (fail) {
      var m = fail.querySelector('div');
      if (m) m.textContent = 'Un problème est survenu' + (errMsg ? ' (' + errMsg + ')' : '') + '. Réessayez.';
      fail.style.display = 'block';
    }
  }

  function handleSubmit(form) {
    var btn = form.querySelector('input[type="submit"], button[type="submit"]');
    var original = btn ? btn.value : '';
    if (btn) { btn.value = 'Envoi…'; btn.disabled = true; }
    var fail = form.parentElement && form.parentElement.querySelector('.w-form-fail');
    if (fail) fail.style.display = 'none';

    fetch('/api/contact-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody()),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }).catch(function () { return { ok: r.ok, j: null }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) { showState(form, true); }
        else { showState(form, false, res.j && res.j.error); if (btn) { btn.value = original; btn.disabled = false; } }
      })
      .catch(function () {
        showState(form, false, 'réseau');
        if (btn) { btn.value = original; btn.disabled = false; }
      });
  }

  // The right-hand "Reach us directly" column is entirely demo (Lorem copy, a
  // fake email box, social block) → remove it and centre the form. Also de-Lorem
  // the hero subtitle + localise the heading.
  function localisePage() {
    Array.prototype.forEach.call(document.querySelectorAll('h1'), function (h) {
      if (/contact us/i.test(h.textContent)) h.textContent = 'Contactez-nous';
    });
    var heroP = Array.prototype.filter.call(document.querySelectorAll('p'), function (p) {
      return /^Lorem ipsum/i.test(p.textContent.trim());
    })[0];
    if (heroP) heroP.textContent = 'Une question ? Écrivez-nous — notre équipe vous répond rapidement.';

    // Drop the whole demo info column (every grid child that isn't the form).
    var grid = document.querySelector('.contact-grid-v1');
    if (grid) {
      Array.prototype.forEach.call(grid.children, function (col) {
        if (!col.querySelector('#' + FORM_ID)) col.style.display = 'none';
      });
      grid.style.gridTemplateColumns = '1fr';
      grid.style.maxWidth = '720px';
      grid.style.margin = '0 auto';
    }
  }

  function run() {
    if (!byId(FORM_ID)) return;
    localise();
    injectConsent();
    localisePage();

    // Capture-phase interception kills Webflow's dead AJAX submit handler.
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.id !== FORM_ID) return;
      e.preventDefault();
      e.stopPropagation();
      handleSubmit(form);
    }, true);
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
})();
