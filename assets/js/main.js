var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var DATA = window.NEUSSER || { angebote: [], oeffnungszeiten: {} };
var TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ---------- Hilfsfunktionen: Zeit in Neuss, Öffnungszeiten, Angebotsregeln ----------

function berlinNow() {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', weekday: 'short', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  var p = {};
  parts.forEach(function (x) { p[x.type] = x.value; });
  return {
    tag: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1,
    minuten: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10),
    datum: p.year + '-' + p.month + '-' + p.day
  };
}

function minuten(hhmm) {
  var t = hhmm.split(':');
  return parseInt(t[0], 10) * 60 + parseInt(t[1], 10);
}

function euro(n) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

function euroKurz(n) {
  return (n % 1 ? n.toFixed(2).replace('.', ',') : String(n)) + ' €';
}

function tageText(tage) {
  if (!tage || !tage.length) return '';
  var s = tage.slice().sort();
  var fortlaufend = s.every(function (t, i) { return i === 0 || t === s[i - 1] + 1; });
  if (fortlaufend && s.length > 2) return TAGE[s[0] - 1] + '–' + TAGE[s[s.length - 1] - 1];
  return s.map(function (t) { return TAGE[t - 1]; }).join(', ');
}

function istGeoeffnet(now) {
  if ((DATA.geschlossen || []).indexOf(now.datum) !== -1) return false;
  var z = DATA.oeffnungszeiten[now.tag];
  return !!z && now.minuten >= minuten(z[0]) && now.minuten < minuten(z[1]);
}

function giltJetzt(a, now) {
  if (!a.aktiv) return false;
  if (a.gueltigBis && now.datum > a.gueltigBis) return false;
  if (a.tage && a.tage.length && a.tage.indexOf(now.tag) === -1) return false;
  if (a.von && now.minuten < minuten(a.von)) return false;
  if (a.bis && now.minuten >= minuten(a.bis)) return false;
  return istGeoeffnet(now);
}

function bedingungen(a) {
  var b = [];
  if (a.mindestwert) b.push('ab ' + euroKurz(a.mindestwert) + ' Bestellwert');
  if (a.tage && a.tage.length) b.push('nur ' + tageText(a.tage));
  if (a.von || a.bis) b.push((a.von || '') + '–' + (a.bis || '') + ' Uhr');
  if (a.gueltigBis) {
    var d = a.gueltigBis.split('-');
    b.push('bis ' + d[2] + '.' + d[1] + '.' + d[0]);
  }
  return b;
}

function badge(a) {
  if (a.typ === 'rabatt') return '−' + a.prozent + ' %';
  if (a.typ === 'menue') return a.preisAb != null ? '+ ' + euro(a.preisAb) : euro(a.preis);
  if (a.typ === 'lieferung') return 'Gratis Lieferung';
  if (a.typ === 'stempelkarte') return 'Stempelkarte';
  return 'Angebot';
}

function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

var NOW = berlinNow();
var ANGEBOTE = (DATA.angebote || []).filter(function (a) { return a.aktiv; });

// ---------- Öffnungsstatus ----------
(function () {
  var out = document.querySelector('[data-open-state]');
  if (!out) return;
  var z = DATA.oeffnungszeiten[NOW.tag];
  var text;
  if (istGeoeffnet(NOW)) {
    var l = (DATA.lieferzeiten || {})[NOW.tag];
    var liefert = l && NOW.minuten >= minuten(l[0]) && NOW.minuten < minuten(l[1]);
    text = '<strong>Jetzt geöffnet</strong> bis ' + z[1] + ' Uhr' + (l ? (liefert ? ' · Lieferung bis ' + l[1] + ' Uhr' : (NOW.minuten < minuten(l[0]) ? ' · Lieferung ab ' + l[0] + ' Uhr' : ' · nur Abholung')) : '');
  }
  else if (!z) text = '<strong>Heute Ruhetag</strong>';
  else if (NOW.minuten < minuten(z[0])) text = '<strong>Öffnet heute</strong> um ' + z[0] + ' Uhr';
  else if ((DATA.geschlossen || []).indexOf(NOW.datum) !== -1) text = '<strong>Heute geschlossen</strong>';
  else text = '<strong>Geschlossen</strong> – öffnet morgen wieder';
  out.innerHTML = text;
  out.classList.toggle('is-open', istGeoeffnet(NOW));
})();

// ---------- Angebote-Insel ----------
// Öffnet sich beim Laden wie die Dynamic Island. Danach tauchen Feuer, Pizza und Cola
// nacheinander aus der unteren Kante rechts auf, und die Angebote wechseln.
(function () {
  var island = document.querySelector('.island');
  if (!island) return;
  var box = island.querySelector('.island__slides');

  // Jetzt gültige Angebote zuerst; wenn heute keins gilt, alle aktiven zeigen
  var jetzt = ANGEBOTE.filter(function (a) { return giltJetzt(a, NOW); });
  var liste = jetzt.length ? jetzt : ANGEBOTE;
  if (liste.length) {
    box.innerHTML = '';
    liste.forEach(function (a, i) {
      var titel = esc(a.titel);
      var art = a.bild ? '<img class="slide__art' + (a.typ === 'rabatt' ? ' slide__art--pct' : '') +
        '" src="' + esc(a.bild) + '" alt="' + (a.typ === 'rabatt' ? a.prozent + ' %' : '') + '">' : '';
      if (a.typ === 'menue') titel += ' <em>' + (a.preisAb != null ? 'ab +' + euro(a.preisAb) : euro(a.preis)) + '</em>';
      if (a.typ === 'lieferung') titel += ' <em>bis 2&nbsp;km</em>';
      if (a.typ === 'rabatt' && !a.bild) titel = '<em>' + a.prozent + ' %</em> ' + titel;
      var sub = [a.text].concat(bedingungen(a)).filter(Boolean).join(' · ');
      var s = el('div', 'slide' + (i === 0 ? ' is-active' : ''),
        art + '<p class="slide__text"><strong>' + titel + '</strong><span>' + esc(sub) + '</span></p>');
      box.appendChild(s);
    });
  }

  var slides = Array.prototype.slice.call(box.querySelectorAll('.slide'));
  var interval = parseInt(island.dataset.interval, 10) || 5000;
  var current = 0;
  var hovering = false;

  function pop() {
    island.classList.remove('is-popped');
    void island.offsetWidth; // Icons wieder von unten starten lassen
    island.classList.add('is-popped');
  }

  function show(next) {
    var prev = slides[current];
    prev.classList.remove('is-active');
    prev.classList.add('is-leaving');
    setTimeout(function () { prev.classList.remove('is-leaving'); }, 500);
    current = next;
    slides[current].classList.add('is-active');
    island.classList.remove('is-bump');
    void island.offsetWidth;
    island.classList.add('is-bump');
    pop();
  }

  if (reduceMotion) {
    island.classList.add('is-open', 'is-popped');
    return;
  }

  setTimeout(function () { island.classList.add('is-open'); }, 450);
  setTimeout(pop, 1250);

  if (slides.length > 1) {
    setInterval(function () {
      if (hovering || document.hidden) return;
      show((current + 1) % slides.length);
    }, interval);
  }

  island.addEventListener('mouseenter', function () { hovering = true; });
  island.addEventListener('mouseleave', function () { hovering = false; });
  island.addEventListener('focus', function () { hovering = true; });
  island.addEventListener('blur', function () { hovering = false; });
})();

// ---------- Angebotskarten mit Filter ----------
(function () {
  var grid = document.querySelector('.offer-grid');
  if (!grid) return;
  var filterBar = document.querySelector('.offer-filters');

  ANGEBOTE.forEach(function (a) {
    var now = giltJetzt(a, NOW);
    var conds = bedingungen(a);
    var status;
    if (now) status = '<span class="status status--now">Jetzt gültig</span>';
    else if (conds.length) status = '<span class="status">Gültig: ' + esc(conds.filter(function (c) { return !/Bestellwert/.test(c); }).join(', ') || 'zu den Öffnungszeiten') + '</span>';
    else status = '<span class="status">Gültig zu den Öffnungszeiten</span>';

    var card = el('article', 'offer-card offer-card--' + a.typ);
    card.dataset.typ = a.typ;
    card.innerHTML =
      '<div class="offer-card__media">' +
        (a.bild ? '<img src="' + esc(a.bild) + '" alt="" loading="lazy">' : '') +
        '<span class="badge badge--' + a.typ + '">' + badge(a) + '</span>' +
      '</div>' +
      '<div class="offer-card__body">' +
        '<h3>' + esc(a.typ === 'rabatt' ? a.prozent + ' % ' + a.titel : a.titel) + '</h3>' +
        '<p>' + esc(a.text || '') + '</p>' +
        (conds.length ? '<ul class="conds">' + conds.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="offer-card__foot">' + status +
          '<a class="btn btn--primary btn--small" href="bestellen.html">Bestellen</a>' +
        '</div>' +
      '</div>';
    grid.appendChild(card);
  });

  // Filter nur für Typen anzeigen, die es gibt
  if (filterBar) {
    var typen = {};
    ANGEBOTE.forEach(function (a) { typen[a.typ] = true; });
    Array.prototype.forEach.call(filterBar.querySelectorAll('[data-filter]'), function (b) {
      var f = b.dataset.filter;
      if (f !== 'alle' && !typen[f]) b.hidden = true;
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(filterBar.querySelectorAll('[data-filter]'), function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        Array.prototype.forEach.call(grid.children, function (c) {
          c.hidden = f !== 'alle' && c.dataset.typ !== f;
        });
      });
    });
  }
})();

// ---------- Header-Karussell ----------
// 4 Gerichte im Kreis. Alle 3 Sekunden rückt jedes Gericht eine Position weiter:
// vorne (groß) → links → hinten → rechts → vorne.
(function () {
  var root = document.querySelector('.carousel');
  if (!root) return;

  var dishes = Array.prototype.slice.call(root.querySelectorAll('.dish'));
  var nameEl = root.querySelector('.carousel__name');
  var priceEl = root.querySelector('.carousel__price');
  var interval = parseInt(root.dataset.interval, 10) || 3000;
  var count = dishes.length;
  var timer = null;
  var paused = false;

  function pos(dish) { return parseInt(dish.dataset.pos, 10); }

  function render() {
    dishes.forEach(function (dish) {
      var front = pos(dish) === 0;
      dish.setAttribute('aria-label', dish.dataset.name + (front ? ' (ausgewählt)' : ' anzeigen'));
      dish.setAttribute('aria-current', front ? 'true' : 'false');
      if (front) {
        if (nameEl) nameEl.textContent = dish.dataset.name;
        if (priceEl) priceEl.textContent = dish.dataset.price || '';
      }
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
    timer = setInterval(function () { if (!paused && !document.hidden) shift(1); }, interval);
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

  render();
  start();
})();
