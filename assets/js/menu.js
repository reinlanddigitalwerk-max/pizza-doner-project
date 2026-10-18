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

// Suche: Name, Kategorie, Nummer oder Zutat. Leere Kategorien werden ausgeblendet.
(function () {
  var input = document.getElementById('menu-search');
  if (!input) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat'));
  var empty = document.querySelector('.search-empty');
  var count = document.querySelector('.search-count');

  function norm(s) {
    return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  }
  cards.forEach(function (c) { c._s = norm(c.dataset.search || ''); });

  function run() {
    var words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    var hits = 0;
    cards.forEach(function (c) {
      var ok = words.every(function (w) { return c._s.indexOf(w) !== -1; });
      c.hidden = !ok;
      if (ok) hits++;
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('.card:not([hidden])');
    });
    empty.hidden = hits !== 0;
    count.textContent = words.length && hits ? hits + (hits === 1 ? ' Treffer' : ' Treffer') : '';
  }

  input.addEventListener('input', run);
})();

// Detailfenster: Klick auf eine Karte zeigt großes Foto, Zutaten, Allergene und Preise.
(function () {
  var dialog = document.querySelector('.dish-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var img = dialog.querySelector('.dish-dialog__img');
  var title = dialog.querySelector('#dish-dialog-title');
  var content = dialog.querySelector('.dish-dialog__content');

  function open(card) {
    var thumb = card.querySelector('img.card__img');
    img.hidden = !thumb;
    if (thumb) { img.src = thumb.dataset.large || thumb.src; img.alt = ''; }
    title.innerHTML = card.querySelector('.card__name').innerHTML;
    content.innerHTML = '';
    ['.chips', '.card__info', '.card__more', '.card__foot', '.card__opts'].forEach(function (sel) {
      var el = card.querySelector(sel);
      if (!el) return;
      var copy = el.cloneNode(true);
      copy.hidden = false;
      content.appendChild(copy);
    });
    dialog.showModal();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.card__open'), function (b) {
    b.addEventListener('click', function () { open(b.closest('.card')); });
  });
  dialog.querySelector('.dish-dialog__close').addEventListener('click', function () { dialog.close(); });
  // Klick neben das Fenster schließt es
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
})();
