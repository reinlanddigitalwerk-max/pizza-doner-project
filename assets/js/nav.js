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
