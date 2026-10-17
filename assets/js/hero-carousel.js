// Header-Karussell: 4 Gerichte im Kreis. Alle 3 Sekunden rückt jedes Gericht
// eine Position weiter: vorne (groß) → links → hinten → rechts → vorne.
(function () {
  var root = document.querySelector('.carousel');
  if (!root) return;

  var dishes = Array.prototype.slice.call(root.querySelectorAll('.dish'));
  var caption = root.querySelector('.carousel__name');
  var interval = parseInt(root.dataset.interval, 10) || 3000;
  var count = dishes.length;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timer = null;
  var paused = false;

  function pos(dish) { return parseInt(dish.dataset.pos, 10); }

  function render() {
    dishes.forEach(function (dish) {
      var front = pos(dish) === 0;
      dish.setAttribute('aria-label', dish.dataset.name + (front ? ' (ausgewählt)' : ' anzeigen'));
      dish.setAttribute('aria-current', front ? 'true' : 'false');
      if (front && caption) caption.textContent = dish.dataset.name;
    });
  }

  function shift(steps) {
    dishes.forEach(function (dish) {
      dish.dataset.pos = String((pos(dish) + steps) % count);
    });
    render();
  }

  function start() {
    if (reduceMotion || timer) return;
    timer = setInterval(function () { if (!paused) shift(1); }, interval);
  }

  function restart() {
    clearInterval(timer);
    timer = null;
    start();
  }

  // Klick auf ein kleines Gericht holt es nach vorne.
  dishes.forEach(function (dish) {
    dish.addEventListener('click', function () {
      var p = pos(dish);
      if (p === 0) return;
      shift(count - p);
      restart();
    });
  });

  root.addEventListener('mouseenter', function () { paused = true; });
  root.addEventListener('mouseleave', function () { paused = false; });
  root.addEventListener('focusin', function () { paused = true; });
  root.addEventListener('focusout', function () { paused = false; });
  document.addEventListener('visibilitychange', function () { paused = document.hidden; });

  render();
  start();
})();

// Angebote-Leiste: Liste so oft kopieren, dass das Laufband ohne Lücke durchläuft.
(function () {
  var track = document.querySelector('.offers__track');
  if (!track) return;
  var list = track.querySelector('.offers__list');

  function fill() {
    while (track.children.length > 1) track.removeChild(track.lastChild);
    while (track.scrollWidth < window.innerWidth) {
      track.appendChild(cloneList());
    }
    var setSize = track.children.length;
    for (var i = 0; i < setSize; i++) {
      track.appendChild(cloneList());
    }
  }

  function cloneList() {
    var copy = list.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    return copy;
  }

  fill();
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fill, 200);
  });
})();
