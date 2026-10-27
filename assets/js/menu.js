// Kategorie-Leiste: mit der Maus greifen und ziehen (mit Schwung), Mausrad schiebt waagrecht,
// alles gleitet weich. Die aktive Kategorie wird markiert und in Sicht gehalten.
(function () {
  var bar = document.querySelector('.cat-nav__inner');
  if (!bar) return;
  var ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ziel = null, raf = 0, zuletztBenutzt = 0;

  function max() { return bar.scrollWidth - bar.clientWidth; }
  function begrenzen(x) { return Math.max(0, Math.min(max(), x)); }
  function raender() {
    bar.classList.toggle('is-start', bar.scrollLeft <= 2);
    bar.classList.toggle('is-ende', bar.scrollLeft >= max() - 2);
  }
  function gleiten() {
    var d = ziel - bar.scrollLeft;
    if (Math.abs(d) < .5) { bar.scrollLeft = ziel; ziel = null; raender(); return; }
    bar.scrollLeft += d * .16;
    raf = requestAnimationFrame(gleiten);
  }
  function gleitenNach(x) {
    ziel = begrenzen(x);
    if (ruhig) { bar.scrollLeft = ziel; ziel = null; raender(); return; }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(gleiten);
  }

  // Ziehen mit der Maus (Finger scrollen ohnehin nativ und flüssig)
  var unten = false, gezogen = false, startX = 0, startLinks = 0, letztX = 0, letztT = 0, tempo = 0;
  bar.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    unten = true; gezogen = false;
    startX = letztX = e.clientX; startLinks = bar.scrollLeft; letztT = performance.now(); tempo = 0;
    cancelAnimationFrame(raf); ziel = null;
  });
  window.addEventListener('pointermove', function (e) {
    if (!unten) return;
    var dx = e.clientX - startX;
    if (!gezogen && Math.abs(dx) > 5) { gezogen = true; bar.classList.add('is-drag'); }
    if (!gezogen) return;
    bar.scrollLeft = begrenzen(startLinks - dx);
    var jetzt = performance.now();
    tempo = (e.clientX - letztX) / Math.max(1, jetzt - letztT);   // Pixel pro ms
    letztX = e.clientX; letztT = jetzt;
    zuletztBenutzt = jetzt;
    raender();
  });
  window.addEventListener('pointerup', function () {
    if (!unten) return;
    unten = false;
    bar.classList.remove('is-drag');
    if (gezogen && Math.abs(tempo) > .05) gleitenNach(bar.scrollLeft - tempo * 320);   // Schwung
  });
  // Nach dem Ziehen keinen Klick auf einen Chip auslösen
  bar.addEventListener('click', function (e) {
    if (gezogen) { e.preventDefault(); e.stopPropagation(); gezogen = false; }
  }, true);
  bar.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // Mausrad: senkrecht drehen schiebt die Leiste waagrecht, solange sie noch Platz hat
  bar.addEventListener('wheel', function (e) {
    var dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!dy || max() <= 0) return;
    var basis = ziel === null ? bar.scrollLeft : ziel;
    if ((dy < 0 && basis <= 0) || (dy > 0 && basis >= max())) return;   // am Rand: Seite scrollt weiter
    e.preventDefault();
    zuletztBenutzt = performance.now();
    gleitenNach(basis + dy * (e.deltaMode === 1 ? 30 : 1.2));
  }, { passive: false });

  bar.addEventListener('scroll', raender, { passive: true });
  window.addEventListener('resize', raender);
  raender();

  // Aktive Kategorie markieren und den Chip sanft ins Bild holen
  var links = Array.prototype.slice.call(bar.querySelectorAll('a'));
  if (!('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  function activate(id) {
    links.forEach(function (a) { a.classList.toggle('is-active', a === byId[id]); });
    var a = byId[id];
    if (!a || unten || performance.now() - zuletztBenutzt < 1200) return;   // nicht gegen den Nutzer schieben
    var ar = a.getBoundingClientRect();
    var br = bar.getBoundingClientRect();
    if (ar.left < br.left + 24 || ar.right > br.right - 24) gleitenNach(bar.scrollLeft + ar.left - br.left - 24);
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
  var cards = Array.prototype.slice.call(document.querySelectorAll('.meal'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.cat'));
  var empty = document.querySelector('.search-empty');
  var count = document.querySelector('.search-count');

  function norm(s) {
    return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  }
  cards.forEach(function (c) { c._s = norm(c.dataset.search || ''); });

  // Filter-Knöpfe (Vegetarisch, Scharf, Bis 8 €) wirken zusammen mit der Suche
  var filter = {};
  var PRUEF = {
    veg: function (c) { return c.hasAttribute('data-veg'); },
    scharf: function (c) { return c.hasAttribute('data-scharf'); },
    preis: function (c) { return parseFloat(c.dataset.preis) <= 8; }
  };
  document.querySelectorAll('.filters [data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      var an = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', an);
      if (an) filter[b.dataset.filter] = PRUEF[b.dataset.filter]; else delete filter[b.dataset.filter];
      run();
    });
  });

  function run() {
    var words = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    var aktiv = Object.keys(filter);
    var hits = 0;
    cards.forEach(function (c) {
      var ok = words.every(function (w) { return c._s.indexOf(w) !== -1; }) &&
        aktiv.every(function (k) { return filter[k](c); });
      c.hidden = !ok;
      if (ok) hits++;
    });
    sections.forEach(function (s) {
      s.hidden = !s.querySelector('.meal:not([hidden])');
    });
    empty.hidden = hits !== 0;
    count.textContent = (words.length || aktiv.length) && hits ? hits + (hits === 1 ? ' Gericht' : ' Gerichte') : '';
    document.querySelector('.legend').hidden = !!(words.length || aktiv.length);
  }

  input.addEventListener('input', run);
})();

// Bestellen: Gericht antippen → Fenster mit Größe, Extras, Wunsch und Menge → Warenkorb.
(function () {
  var W = window.Warenkorb;
  var datenEl = document.getElementById('menu-daten');
  var dialog = document.querySelector('.item-dialog');
  if (!W || !datenEl || !dialog) return;
  var DATEN = JSON.parse(datenEl.textContent);
  var euro = W.euro, esc = W.esc;

  // Warenkorb rechts bzw. als Blatt auf dem Handy
  var basket = document.querySelector('.basket');
  var root = basket.querySelector('[data-warenkorb]');
  W.binden(root, { bearbeiten: true, modus: true, kasse: true, schliessen: true });

  var bar = document.querySelector('.basket-bar');
  function leiste() {
    var sm = W.summen();
    bar.hidden = !sm.anzahl;
    bar.querySelector('[data-anzahl]').textContent = sm.anzahl;
    bar.querySelector('[data-summe]').textContent = euro(sm.gesamt);
  }
  W.on(leiste);
  leiste();
  function blatt(offen) {
    basket.classList.toggle('is-open', offen);
    document.body.classList.toggle('sheet-open', offen);
    bar.setAttribute('aria-expanded', offen ? 'true' : 'false');
  }
  bar.addEventListener('click', function () { blatt(true); });
  root.addEventListener('click', function (e) { if (e.target.closest('[data-schliessen]')) blatt(false); });
  basket.addEventListener('click', function (e) { if (e.target === basket) blatt(false); });

  var toast = document.querySelector('.toast');
  var toastZeit;
  function melden(text) {
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.add('is-on');
    clearTimeout(toastZeit);
    toastZeit = setTimeout(function () { toast.classList.remove('is-on'); setTimeout(function () { toast.hidden = true; }, 300); }, 2200);
  }

  function preisVon(d) { return d.preise ? d.preise[0][1] : d.preis; }

  function oeffnen(id) {
    var d = DATEN[id];
    if (!d) return;
    var html = '<form method="dialog" class="item">' +
      (d.bild ? '<img class="item__img" src="' + esc(d.bild) + '" alt="">' : '') +
      '<button class="item__close" value="zu" aria-label="Schließen">×</button>' +
      '<div class="item__body">' +
      '<h2 id="item-dialog-title">' + esc(d.name) + '</h2>' +
      (d.text ? '<p class="item__desc">' + esc(d.text) + '</p>' : '') +
      (d.basis ? '<p class="item__basis">Immer dabei: ' + esc(d.basis) + '</p>' : '') +
      ((d.allergene || d.zusatz) ? '<details class="item__info"><summary>Allergene &amp; Zusatzstoffe</summary>' +
        (d.allergene ? '<p><b>Allergene:</b> ' + esc(d.allergene) + '</p>' : '') +
        (d.zusatz ? '<p><b>Zusatzstoffe:</b> ' + esc(d.zusatz) + '</p>' : '') + '</details>' : '');

    if (d.preise) {
      html += '<fieldset class="grp"><legend>Größe wählen <em>Pflicht</em></legend>' + d.preise.map(function (g, i) {
        return '<label class="choice"><input type="radio" name="groesse" value="' + i + '"' + (i ? '' : ' checked') + '>' +
          '<span>' + esc(g[0]) + '</span><b>' + euro(g[1]) + '</b></label>';
      }).join('') + '</fieldset>';
    }
    (d.optionen || []).forEach(function (g, gi) {
      var typ = g.mehrfach ? 'checkbox' : 'radio';
      html += '<fieldset class="grp"><legend>' + esc(g.titel) + (g.mehrfach ? ' <em>mehrere möglich</em>' : '') + '</legend>' +
        g.auswahl.map(function (c, ci) {
          return '<label class="choice"><input type="' + typ + '" name="o' + gi + '" value="' + ci + '"' +
            (!g.mehrfach && ci === 0 ? ' checked' : '') + '><span>' + esc(c.name) + '</span>' +
            (c.aufpreis ? '<b>+' + euro(c.aufpreis) + '</b>' : '') + '</label>';
        }).join('') + '</fieldset>';
    });
    html += '<label class="grp grp--note"><span>Wunsch an die Küche (optional)</span>' +
      '<textarea name="notiz" rows="2" maxlength="120" placeholder="z. B. gut durch, wenig Sauce"></textarea></label>' +
      '</div><div class="item__foot">' +
      '<div class="qty qty--big"><button type="button" data-q="-1" aria-label="Eins weniger">−</button><span data-menge>1</span><button type="button" data-q="1" aria-label="Eins mehr">+</button></div>' +
      '<button class="btn btn--primary item__add" value="ok">In den Warenkorb · <span data-preis></span></button></div></form>';
    dialog.innerHTML = html;

    var form = dialog.querySelector('form');
    var mengeEl = form.querySelector('[data-menge]');
    var n = 1;

    function auswahl() {
      var groesse = '', basis = preisVon(d), extra = 0, opts = [], wahl = [];
      if (d.preise) {
        var g = d.preise[+form.querySelector('input[name="groesse"]:checked').value];
        groesse = g[0]; basis = g[1];
      }
      (d.optionen || []).forEach(function (g, gi) {
        form.querySelectorAll('input[name="o' + gi + '"]:checked').forEach(function (inp) {
          var c = g.auswahl[+inp.value];
          extra += c.aufpreis;
          wahl.push([gi, +inp.value]);   // für die Preisprüfung auf dem Server
          // Nichtssagendes wie „ohne Wunsch“ oder „normal“ nicht auf den Bon schreiben
          if (!/^(ohne Wunsch|normal|normale |ohne extra|als Single)/i.test(c.name)) opts.push(c.name);
        });
      });
      return { groesse: groesse, stueck: Math.round((basis + extra) * 100) / 100, opts: opts, wahl: wahl };
    }
    function preis() {
      form.querySelector('[data-preis]').textContent = euro(auswahl().stueck * n);
    }
    form.addEventListener('change', preis);
    form.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]');
      if (!q) return;
      n = Math.max(1, Math.min(50, n + +q.dataset.q));
      mengeEl.textContent = n;
      preis();
    });
    form.addEventListener('submit', function (e) {
      var wer = e.submitter && e.submitter.value;
      if (wer !== 'ok') return;
      var a = auswahl();
      W.hinzu({
        id: id, name: d.name, groesse: a.groesse, optionen: a.opts, wahl: a.wahl,
        notiz: form.notiz.value.trim().slice(0, 120), preis: a.stueck, menge: n
      });
      melden(n + '× ' + d.name + ' im Warenkorb');
    });
    preis();
    dialog.showModal();
  }

  document.querySelectorAll('.meal').forEach(function (li) {
    li.addEventListener('click', function () { oeffnen(li.dataset.id); });
  });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
})();
