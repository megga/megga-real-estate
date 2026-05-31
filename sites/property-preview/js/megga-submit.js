// "Publier une annonce" (submit-property.html) → CRM.
// The Webflow demo form posts nowhere (static export). This script:
//   1. Localises the form to FR + Swiss units (m², CHF).
//   2. Replaces the demo <select> values with real marketplace types.
//   3. Injects a "Délai de vente" select (→ seller_leads.motivation).
//   4. Intercepts submit and POSTs to /api/seller-lead (the worker INSERTs a
//      seller_lead; a DB trigger raises the agent notification).
// The lead lands in the CRM "Biens" inbox (status='new', unassigned) and pings
// the agent notification bell in realtime.
(function () {
  var FORM_ID = 'wf-form-Submit-Property-Form';

  function $(s, r) { return (r || document).querySelector(s); }
  function byId(id) { return document.getElementById(id); }
  function group(el) { var w = el.closest('.input-wrapper'); return w ? w.parentElement : el.parentElement; }
  function setLabel(id, text) { var el = byId(id); if (!el) return; var g = group(el); var l = g && g.querySelector('label'); if (l) l.textContent = text; }
  function setPlaceholder(id, text) { var el = byId(id); if (el) el.setAttribute('placeholder', text); }
  function optional(id) { var el = byId(id); if (el) el.removeAttribute('required'); }

  // Walk text nodes / leaf elements and swap exact demo strings to FR.
  function replaceText(map) {
    var els = document.querySelectorAll('h1, h2, .display-2, .display-4, .display-8, .display-10, .badge .display-1, .checkbox-text, label, p, .inside-input-button, input[type="submit"]');
    Array.prototype.forEach.call(els, function (el) {
      if (el.tagName === 'INPUT') { if (map[el.value]) el.value = map[el.value]; return; }
      if (el.children.length) {
        // leaf-ish: only touch if a single text child
        if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
          var t = el.textContent.trim();
          if (map[t]) el.textContent = map[t];
        }
        return;
      }
      var s = el.textContent.trim();
      if (map[s]) el.textContent = map[s];
    });
  }

  function localise() {
    // Field labels (by id — robust against duplicate `for` attrs in the export).
    setLabel('name', 'Nom complet'); setPlaceholder('name', 'Nom complet');
    setLabel('email', 'Adresse e-mail'); setPlaceholder('email', 'exemple@email.ch');
    setLabel('phone', 'Téléphone'); setPlaceholder('phone', '+41 22 123 45 67');
    setLabel('listing-title', "Titre de l'annonce"); setPlaceholder('listing-title', 'ex. Appartement lumineux au centre');
    setLabel('property-type', 'Type de bien');
    setLabel('listing-type', 'Transaction');
    setLabel('location', 'Ville'); setPlaceholder('location', 'ex. Genève');
    setLabel('address', 'Adresse'); setPlaceholder('address', 'ex. Rue du Rhône 12');
    setLabel('listing-price', 'Prix (CHF)'); setPlaceholder('listing-price', "ex. 1'200'000");
    setLabel('bedrooms', 'Chambres'); setPlaceholder('bedrooms', 'ex. 3');
    setLabel('bathrooms', 'Salles de bain'); setPlaceholder('bathrooms', 'ex. 2');
    setLabel('barking-lots', 'Places de parking'); setPlaceholder('barking-lots', 'ex. 1');
    setLabel('construction-sqtf', 'Surface habitable (m²)'); setPlaceholder('construction-sqtf', 'ex. 120');
    setLabel('land-sqtf', 'Surface du terrain (m²)'); setPlaceholder('land-sqtf', 'ex. 400');
    setLabel('listing-short-description', 'Description courte'); setPlaceholder('listing-short-description', "Jusqu'à 240 caractères.");
    setLabel('listing-long-description', 'Description détaillée'); setPlaceholder('listing-long-description', "Jusqu'à 4000 caractères.");
    setLabel('listing-images', 'Photos (lien)'); setPlaceholder('listing-images', 'ex. lien Google Drive / Dropbox');

    // Only contact + core identity required; the rest is optional for a lead.
    ['phone', 'listing-price', 'bedrooms', 'bathrooms', 'barking-lots', 'construction-sqtf',
      'land-sqtf', 'listing-short-description', 'listing-long-description', 'listing-images'].forEach(optional);

    replaceText({
      'Post a free property': 'Publier une annonce',
      'Post a property for sale': 'Publiez un bien à vendre',
      'or rent': 'ou à louer',
      'Post a property for sale or rent': 'Publiez un bien à vendre ou à louer',
      '1. Client information': '1. Vos coordonnées',
      '2. Property information': '2. Informations sur le bien',
      'Property amenities': 'Équipements',
      'Listing images': "Photos de l'annonce",
      'Submit for approval': 'Envoyer pour validation',
      'Thank you': 'Merci !',
      'Garden': 'Jardin', 'Security cameras': 'Caméras de sécurité', 'Laundry': 'Buanderie',
      'Pool': 'Piscine', 'Garage': 'Garage', 'Jacuzzi': 'Jacuzzi', 'Elevator': 'Ascenseur',
      'Dish washer': 'Lave-vaisselle', 'Internet': 'Internet',
    });

    // Intro paragraph (Lorem) → a real sentence.
    Array.prototype.forEach.call(document.querySelectorAll('p'), function (p) {
      if (/^Lorem ipsum/i.test(p.textContent.trim())) {
        if (/listing images|images de/i.test(p.textContent)) return; // handled below
        p.textContent = 'Confiez-nous votre bien : notre équipe vous recontacte pour estimer, préparer et publier votre annonce.';
      }
      if (/Google Drive or Imgur/i.test(p.textContent)) {
        p.textContent = 'Partagez un lien (Google Drive, Dropbox…) vers vos photos.';
      }
    });

    // Footer "Post a free/paid property" cards (text split across a <span>, so
    // the exact-match pass above skips them).
    Array.prototype.forEach.call(document.querySelectorAll('.post-card-footer .display-5'), function (el) {
      var t = el.textContent.trim();
      if (/free property/i.test(t)) el.textContent = 'Publier une annonce gratuite';
      else if (/paid property/i.test(t)) el.textContent = 'Publier une annonce premium';
    });

    // Success message body → FR.
    var done = $('.w-form-done .text-titles div div') || $('.w-form-done .display-8');
    var doneBody = $('.w-form-done .mg-top-extra-small div div div');
    if (doneBody) doneBody.innerHTML = 'Nous avons bien reçu votre annonce. Un conseiller MEGGA vous recontacte rapidement.';
    void done;
  }

  // Replace the demo option values (First/Second/…) with canonical ones.
  function fixSelects() {
    var type = byId('property-type');
    if (type) {
      type.innerHTML = '';
      [['', 'Sélectionner'], ['apartment', 'Appartement'], ['house', 'Maison'], ['villa', 'Villa'],
        ['commercial', 'Commercial'], ['office', 'Bureau'], ['parking', 'Parking'],
        ['storage', 'Dépôt / box'], ['land', 'Terrain']].forEach(function (o) {
        var opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1]; type.appendChild(opt);
      });
    }
    var tx = byId('listing-type');
    if (tx) {
      tx.innerHTML = '';
      [['', 'Sélectionner'], ['buy', 'Vente'], ['rent', 'Location']].forEach(function (o) {
        var opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1]; tx.appendChild(opt);
      });
    }
  }

  // Inject a "Délai de vente" select (→ motivation) by cloning the styled
  // listing-type group so it matches the design system exactly.
  function injectMotivation() {
    if (byId('sale-timeline')) return;
    var tx = byId('listing-type');
    var nameField = byId('name');
    if (!tx || !nameField) return;
    var srcGroup = group(tx);
    var grid = nameField.closest('.submit-grid');
    if (!srcGroup || !grid) return;
    var clone = srcGroup.cloneNode(true);
    var sel = clone.querySelector('select');
    var lbl = clone.querySelector('label');
    if (!sel) return;
    sel.id = 'sale-timeline';
    sel.name = 'Sale-Timeline';
    sel.removeAttribute('required');
    sel.innerHTML = '';
    [['', 'Sélectionner'], ['immediate', 'Dès que possible'], ['3months', "D'ici 3 mois"],
      ['6months', "D'ici 6 mois"], ['exploring', 'Je me renseigne']].forEach(function (o) {
      var opt = document.createElement('option'); opt.value = o[0]; opt.textContent = o[1]; sel.appendChild(opt);
    });
    if (lbl) lbl.textContent = 'Délai de vente';
    grid.appendChild(clone);
  }

  function val(id) { var el = byId(id); return el ? String(el.value || '').trim() : ''; }
  function checked(id) { var el = byId(id); return !!(el && el.checked); }
  function digits(v) { var n = Number(String(v).replace(/[^\d]/g, '')); return isFinite(n) && n > 0 ? n : null; }
  function decimal(v) { var n = parseFloat(String(v).replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : null; }

  function buildBody() {
    var amenities = [];
    [['garden', 'Jardin'], ['security-cameras', 'Caméras de sécurité'], ['laundry', 'Buanderie'],
      ['pool', 'Piscine'], ['garage', 'Garage'], ['jacuzzi', 'Jacuzzi'], ['elevator', 'Ascenseur'],
      ['dish-washer', 'Lave-vaisselle'], ['internet', 'Internet']].forEach(function (p) {
      if (checked(p[0])) amenities.push(p[1]);
    });
    var typeSel = byId('property-type');
    var txSel = byId('listing-type');
    return {
      contact_name: val('name'),
      contact_email: val('email'),
      contact_phone: val('phone'),
      motivation: val('sale-timeline') || null,
      property_data: {
        title: val('listing-title'),
        type: typeSel ? typeSel.value : '',
        transaction_type: txSel ? txSel.value : '',
        city: val('location'),
        address: val('address'),
        canton: '',
        postalCode: '',
        price: digits(val('listing-price')),
        bedrooms: val('bedrooms'),
        bathrooms: val('bathrooms'),
        parking: val('barking-lots'),
        surface: decimal(val('construction-sqtf')),
        landSurface: decimal(val('land-sqtf')),
        description: val('listing-long-description') || val('listing-short-description'),
        amenities: amenities,
        imagesLink: val('listing-images'),
      },
    };
  }

  function showState(form, ok, errMsg) {
    var wrap = form.parentElement;
    var done = wrap && wrap.querySelector('.w-form-done');
    var fail = wrap && wrap.querySelector('.w-form-fail');
    if (ok) {
      form.style.display = 'none';
      if (done) { done.style.display = 'block'; done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else {
      if (fail) {
        var msg = fail.querySelector('div');
        if (msg) msg.textContent = 'Un problème est survenu' + (errMsg ? ' (' + errMsg + ')' : '') + '. Réessayez.';
        fail.style.display = 'block';
      }
    }
  }

  function handleSubmit(form) {
    var btn = form.querySelector('input[type="submit"], button[type="submit"]');
    var original = btn ? btn.value : '';
    if (btn) { btn.value = 'Envoi…'; btn.disabled = true; }
    var fail = form.parentElement && form.parentElement.querySelector('.w-form-fail');
    if (fail) fail.style.display = 'none';

    fetch('/api/seller-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody()),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }).catch(function () { return { ok: r.ok, j: null }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) { showState(form, true); }
        else { showState(form, false, res.j && res.j.error); if (btn) { btn.value = original; btn.disabled = false; } }
      })
      .catch(function (e) {
        showState(form, false, 'réseau');
        if (btn) { btn.value = original; btn.disabled = false; }
      });
  }

  function run() {
    if (!byId(FORM_ID)) return;
    fixSelects();
    injectMotivation();
    localise();

    // Capture-phase interception kills Webflow's dead AJAX submit handler
    // (it would otherwise post to webflow.com and show the error state).
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
