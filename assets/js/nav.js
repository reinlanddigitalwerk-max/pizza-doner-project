// Klappmenü für Handy und Tablet
(function () {
  var bar = document.querySelector('.topbar');
  var knopf = bar && bar.querySelector('.menu-toggle');
  if (!knopf) return;

  function setze(offen) {
    bar.classList.toggle('is-menu-open', offen);
    knopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
  }

  knopf.addEventListener('click', function () {
    setze(knopf.getAttribute('aria-expanded') !== 'true');
  });
  bar.querySelectorAll('.topbar__menu a').forEach(function (a) {
    a.addEventListener('click', function () { setze(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && bar.classList.contains('is-menu-open')) {
      setze(false);
      knopf.focus();
    }
  });
  document.addEventListener('click', function (e) {
    if (!bar.contains(e.target)) setze(false);
  });
  window.matchMedia('(min-width: 1021px)').addEventListener('change', function (m) {
    if (m.matches) setze(false);
  });
})();

// Abschnitte und Karten sanft einblenden, sobald sie ins Bild kommen
document.addEventListener('DOMContentLoaded', function () {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ziele = document.querySelectorAll('.section-head, .info-tile, .offer-card, .cat-cell, .cta-band__inner, .info-card, .ticker');
  if (!ziele.length) return;
  document.documentElement.classList.add('js-reveal');
  var io = new IntersectionObserver(function (eintraege) {
    eintraege.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  ziele.forEach(function (el) {
    var nr = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = (nr % 4) * 70 + 'ms';
    el.classList.add('reveal');
    io.observe(el);
  });
});


// App installieren: Service Worker anmelden; Knöpfe und Pizza-Handy starten die Installation.
// Chrome, Edge, Samsung Internet und Opera zeigen sofort den Installieren-Dialog. Safari und Firefox
// erlauben das keiner Website – dort erklärt ein kurzer Hinweis, passend zum Browser, die zwei Handgriffe.
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* z. B. in der Vorschau nicht erlaubt */ });
  }
  var installiert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (installiert) return;

  var knoepfe = document.querySelectorAll('[data-install]');      // Menü und Footer
  var promo = document.querySelector('[data-install-promo]');      // Pizza-Handy, immer sichtbar
  var hilfe = document.querySelector('.app-hinweis');
  var ua = navigator.userAgent;
  var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var angebot = null;

  var TEILEN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  var PLUS = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function schritte(liste) { return '<ol>' + liste.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>'; }

  // Welcher Browser? Danach richtet sich der Hinweis.
  function anleitung() {
    if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|Snapchat|Line\//i.test(ua) || (/Android/i.test(ua) && /; wv\)/.test(ua))) {
      return { text: '<p>Du bist gerade in einer App (z. B. Instagram oder Facebook). Dort kann man nichts installieren.</p>' +
        schritte(['Oben auf <b>⋯</b> oder <b>⋮</b> tippen', '<b>„Im Browser öffnen“</b> wählen', 'Dort noch einmal auf <b>„Unsere App laden“</b> tippen']) };
    }
    if (ios && /CriOS|EdgiOS/i.test(ua)) {
      return { text: schritte(['Oben in der Adressleiste auf ' + TEILEN + ' <b>Teilen</b> tippen', '<b>„Zum Home-Bildschirm“</b> ' + PLUS + ' wählen', 'Auf <b>Hinzufügen</b> tippen']) };
    }
    if (ios && /FxiOS/i.test(ua)) {
      return { text: schritte(['Unten auf das Menü <b>≡</b> tippen', '<b>Teilen</b> ' + TEILEN + ' wählen', '<b>„Zum Home-Bildschirm“</b> ' + PLUS + ' wählen']) };
    }
    if (ios) {
      var ipad = /ipad/i.test(ua) || navigator.maxTouchPoints > 1 && !/iphone/i.test(ua);
      return { unten: !ipad, text: schritte([(ipad ? 'Oben rechts' : 'Unten in der Leiste') + ' auf ' + TEILEN + ' <b>Teilen</b> tippen',
        'Nach unten wischen und <b>„Zum Home-Bildschirm“</b> ' + PLUS + ' wählen', 'Oben rechts auf <b>Hinzufügen</b> tippen']) };
    }
    if (/Android/i.test(ua) && /Firefox/i.test(ua)) {
      return { text: schritte(['Oben rechts auf das Menü <b>⋮</b> tippen', '<b>„Installieren“</b> wählen', 'Bestätigen – fertig']) };
    }
    if (/SamsungBrowser/i.test(ua)) {
      return { text: schritte(['Unten auf das Menü <b>≡</b> tippen', '<b>„Seite hinzufügen zu“</b> → <b>„Startbildschirm“</b>', 'Auf <b>Hinzufügen</b> tippen']) };
    }
    if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua)) {
      return { text: schritte(['Oben im Menü auf <b>Ablage</b> klicken', '<b>„Zum Dock hinzufügen …“</b> wählen', 'Auf <b>Hinzufügen</b> klicken']) };
    }
    if (/Firefox/i.test(ua)) {
      return { text: '<p>Firefox kann Websites leider nicht als App installieren. Öffne die Seite in <b>Chrome</b> oder <b>Edge</b> – dort geht es mit einem Klick. Oder lege dir ein Lesezeichen an (<b>Strg + D</b>).</p>' };
    }
    return { text: schritte(['Rechts in der Adressleiste auf das Installieren-Symbol ' + PLUS + ' klicken – oder im Menü <b>⋮</b> <b>„App installieren“</b> wählen', 'Mit <b>Installieren</b> bestätigen']) };
  }

  function zeigen(an) { knoepfe.forEach(function (k) { k.hidden = !an; }); }
  if (promo) promo.hidden = false;
  if (ios) zeigen(true);

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    angebot = e;
    zeigen(true);
  });
  window.addEventListener('appinstalled', function () {
    zeigen(false);
    if (promo) promo.hidden = true;
  });

  function installieren() {
    if (angebot) {
      angebot.prompt();
      angebot.userChoice.then(function (w) {
        angebot = null;
        if (w.outcome === 'accepted' && promo) promo.hidden = true;
      });
      return;
    }
    if (!hilfe) return;
    var a = anleitung();
    hilfe.querySelector('[data-hilfe]').innerHTML = a.text;
    hilfe.classList.toggle('app-hinweis--unten', !!a.unten);
    hilfe.showModal();
  }
  knoepfe.forEach(function (k) { k.addEventListener('click', installieren); });
  if (promo) promo.addEventListener('click', installieren);
})();
