// Speisekarte: aktive Kategorie in der Leiste markieren und sichtbar halten.
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll('.cat-nav a'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var bar = document.querySelector('.cat-nav__inner');
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

  function activate(id) {
    links.forEach(function (a) { a.classList.toggle('is-active', a === byId[id]); });
    var a = byId[id];
    if (!a || !bar) return;
    var ar = a.getBoundingClientRect();
    var br = bar.getBoundingClientRect();
    // nur scrollen, wenn der Chip nicht ganz sichtbar ist
    if (ar.left < br.left + 16 || ar.right > br.right - 16) {
      bar.scrollTo({ left: bar.scrollLeft + ar.left - br.left - 16, behavior: 'smooth' });
    }
  }

  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) activate(e.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });

  Object.keys(byId).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el);
  });
})();
