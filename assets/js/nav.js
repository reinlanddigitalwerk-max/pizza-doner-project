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

// Kontakt-Spieß: Antippen klappt WhatsApp, Instagram, Facebook und Telefon auf
(function () {
  var box = document.querySelector('.spiess');
  if (!box) return;
  var knopf = box.querySelector('.spiess__btn');
  // Links ohne Adresse (z. B. Instagram, solange keiner eingetragen ist) ausblenden
  box.querySelectorAll('.spiess__link').forEach(function (a) {
    if (!a.getAttribute('href')) a.parentNode.hidden = true;
  });
  function setze(offen) {
    box.classList.toggle('is-open', offen);
    knopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
  }
  knopf.addEventListener('click', function () { setze(!box.classList.contains('is-open')); });
  document.addEventListener('click', function (e) { if (!box.contains(e.target)) setze(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box.classList.contains('is-open')) { setze(false); knopf.focus(); }
  });
})();

// App installieren: Service Worker anmelden, Knopf zeigen, wenn der Browser es anbietet
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* z. B. in der Vorschau nicht erlaubt */ });
  }
  var knoepfe = document.querySelectorAll('[data-install]');
  if (!knoepfe.length) return;
  var installiert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (installiert) return;

  var angebot = null;
  function zeigen(an) { knoepfe.forEach(function (k) { k.hidden = !an; }); }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    angebot = e;
    zeigen(true);
  });
  window.addEventListener('appinstalled', function () { zeigen(false); });

  // iPhone/iPad: kein Installieren-Dialog, darum kurze Anleitung
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var anleitung = document.querySelector('.ios-install');
  if (ios && anleitung) zeigen(true);

  knoepfe.forEach(function (k) {
    k.addEventListener('click', function () {
      if (angebot) {
        angebot.prompt();
        angebot.userChoice.then(function () { angebot = null; zeigen(false); });
      } else if (ios && anleitung) {
        anleitung.showModal();
      }
    });
  });
})();
