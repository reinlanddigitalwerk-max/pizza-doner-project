// Warenkorb für Speisekarte und Kasse.
// Speichert im Browser (localStorage), rechnet Zwischensumme, Rabatt, Liefergebühr und
// Mindestbestellwert und zeichnet den Warenkorb in jedes Element mit [data-warenkorb].
window.Warenkorb = (function () {
  var KEY = 'neusser-warenkorb-v1';
  var SHOP = window.SHOP || { zonen: [], mindestbestellwert: 0 };
  var DATA = window.NEUSSER || { oeffnungszeiten: {}, lieferzeiten: {}, angebote: [] };
  var TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  var hoerer = [];
  var s = lesen();

  function lesen() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* privater Modus */ }
    d = d || {};
    return {
      modus: d.modus === 'abholung' ? 'abholung' : 'lieferung',
      plz: typeof d.plz === 'string' ? d.plz : '',
      pos: Array.isArray(d.pos) ? d.pos.filter(function (p) { return p && p.name && p.menge > 0; }) : []
    };
  }
  function speichern() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* egal */ }
    hoerer.forEach(function (f) { f(); });
  }

  // ---------- Hilfen ----------
  function euro(n) { return n.toFixed(2).replace('.', ',') + ' €'; }
  function rund(n) { return Math.round(n * 100) / 100; }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function minuten(hhmm) { var t = hhmm.split(':'); return +t[0] * 60 + +t[1]; }
  function uhr(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  function jetzt() {
    var p = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', weekday: 'short', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return {
      tag: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1,
      min: (+p.hour % 24) * 60 + +p.minute,
      datum: p.year + '-' + p.month + '-' + p.day
    };
  }

  // Zeitfenster für heute: [von, bis] in Minuten oder null
  function fenster(modus, n) {
    n = n || jetzt();
    if ((DATA.geschlossen || []).indexOf(n.datum) !== -1) return null;
    var z = (modus === 'lieferung' ? DATA.lieferzeiten : DATA.oeffnungszeiten) || {};
    z = z[n.tag];
    return z ? [minuten(z[0]), minuten(z[1])] : null;
  }

  // Wählbare Zeiten: „schnellstmöglich“, wenn jetzt offen, plus 15-Minuten-Schritte bis Schluss
  function zeiten(modus) {
    var n = jetzt();
    var f = fenster(modus, n);
    if (!f) return [];
    var vorlauf = modus === 'lieferung' ? (SHOP.lieferungMin || 35) : (SHOP.abholungMin || 15);
    var ende = modus === 'lieferung' ? f[1] : f[1] - 15;
    var out = [];
    if (n.min >= f[0] && n.min < ende) out.push({ wert: 'schnellstmöglich', text: 'Schnellstmöglich (ca. ' + vorlauf + ' Min.)' });
    var start = Math.max(n.min + vorlauf, f[0] + vorlauf);
    start = Math.ceil(start / 15) * 15;
    for (var m = start; m <= ende; m += 15) out.push({ wert: uhr(m), text: 'für ' + uhr(m) + ' Uhr' });
    return out;
  }

  function oeffnungText(modus) {
    var z = (modus === 'lieferung' ? DATA.lieferzeiten : DATA.oeffnungszeiten) || {};
    var n = jetzt();
    for (var i = 1; i <= 7; i++) {
      var tag = (n.tag - 1 + i) % 7 + 1;
      if (z[tag]) return (i === 1 ? 'morgen' : TAGE[tag - 1]) + ' ab ' + z[tag][0] + ' Uhr';
    }
    return '';
  }

  // Aktive Rabatte aus offers-data.js (Typ „rabatt“) – gleiche Regeln wie auf der Startseite
  function rabatt(zw) {
    var n = jetzt();
    var best = null;
    (DATA.angebote || []).forEach(function (a) {
      if (a.typ !== 'rabatt' || !a.aktiv || !a.prozent) return;
      if (a.gueltigBis && n.datum > a.gueltigBis) return;
      if (a.tage && a.tage.length && a.tage.indexOf(n.tag) === -1) return;
      if (a.von && n.min < minuten(a.von)) return;
      if (a.bis && n.min >= minuten(a.bis)) return;
      if (a.mindestwert && zw < a.mindestwert) return;
      var betrag = rund(zw * a.prozent / 100);
      if (!best || betrag > best.betrag) best = { titel: a.prozent + ' % ' + (a.titel || 'Rabatt'), betrag: betrag };
    });
    return best;
  }

  function zone() {
    for (var i = 0; i < SHOP.zonen.length; i++) if (SHOP.zonen[i].plz === s.plz) return SHOP.zonen[i];
    return null;
  }

  function summen() {
    var zw = rund(s.pos.reduce(function (t, p) { return t + p.preis * p.menge; }, 0));
    var r = rabatt(zw);
    var z = zone();
    var liefer = s.modus === 'lieferung' && z ? z.gebuehr : 0;
    var min = s.modus === 'lieferung' ? (z ? z.min : SHOP.mindestbestellwert) : 0;
    var fehlt = rund(Math.max(0, min - zw));
    var anzahl = s.pos.reduce(function (t, p) { return t + p.menge; }, 0);
    var offen = zeiten(s.modus).length > 0;
    var grund = '';
    if (!anzahl) grund = 'leer';
    else if (s.modus === 'lieferung' && !z) grund = 'plz';
    else if (fehlt > 0) grund = 'min';
    else if (!offen) grund = 'zu';
    return {
      zw: zw, rabatt: r, liefer: liefer, gesamt: rund(zw - (r ? r.betrag : 0) + liefer),
      min: min, fehlt: fehlt, anzahl: anzahl, zone: z, offen: offen, bereit: !grund, grund: grund
    };
  }

  // ---------- Ändern ----------
  function schluessel(p) { return [p.id, p.groesse || '', JSON.stringify(p.wahl || p.optionen || []), p.notiz || ''].join('#'); }

  function hinzu(p) {
    var k = schluessel(p);
    for (var i = 0; i < s.pos.length; i++) {
      if (schluessel(s.pos[i]) === k) { s.pos[i].menge = Math.min(50, s.pos[i].menge + p.menge); speichern(); return; }
    }
    s.pos.push(p);
    speichern();
  }
  function menge(i, d) {
    if (!s.pos[i]) return;
    s.pos[i].menge += d;
    if (s.pos[i].menge <= 0) s.pos.splice(i, 1);
    else if (s.pos[i].menge > 50) s.pos[i].menge = 50;
    speichern();
  }
  function modus(m) { s.modus = m === 'abholung' ? 'abholung' : 'lieferung'; speichern(); }
  function plz(v) { s.plz = v; speichern(); }
  function leeren() { s.pos = []; speichern(); }

  // ---------- Zeichnen ----------
  function zonenOptionen() {
    return '<option value="">Postleitzahl wählen …</option>' + SHOP.zonen.map(function (z) {
      return '<option value="' + esc(z.plz) + '"' + (z.plz === s.plz ? ' selected' : '') + '>' +
        esc(z.plz + ' ' + z.ort + (z.gebiet ? ' – ' + z.gebiet : '')) + ' · ' +
        (z.gebuehr ? euro(z.gebuehr) : 'gratis') + '</option>';
    }).join('');
  }

  function zeichne(root, opt) {
    var sm = summen();
    var html = '<div class="basket__head"><h2>Warenkorb</h2>' +
      (sm.anzahl && opt.bearbeiten ? '<button type="button" class="basket__clear" data-leeren>Leeren</button>' : '') +
      (opt.schliessen ? '<button type="button" class="basket__close" data-schliessen aria-label="Warenkorb schließen">×</button>' : '') +
      '</div>';

    if (opt.modus) {
      html += '<div class="mode" role="group" aria-label="Lieferart">' +
        '<button type="button" data-modus="lieferung" aria-pressed="' + (s.modus === 'lieferung') + '">Lieferung</button>' +
        '<button type="button" data-modus="abholung" aria-pressed="' + (s.modus === 'abholung') + '">Abholung</button></div>';
      if (s.modus === 'lieferung') {
        html += '<label class="basket__plz"><span>Wohin liefern wir?</span><select data-plz>' + zonenOptionen() + '</select></label>' +
          '<p class="basket__hint">Postleitzahl nicht dabei? Ruf uns an: <a href="tel:' + esc(SHOP.telefonLink) + '">' + esc(SHOP.telefon) + '</a></p>';
      } else {
        html += '<p class="basket__hint">Abholung in der Further Straße 46 – fertig in ca. ' + (SHOP.abholungMin || 15) + ' Minuten.</p>';
      }
    }

    if (!sm.anzahl) {
      html += '<div class="basket__empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>' +
        '<p><strong>Noch leer</strong>Wähle leckere Gerichte aus der Speisekarte und lege sie hier ab.</p></div>';
    } else {
      html += '<ul class="basket__list">' + s.pos.map(function (p, i) {
        var det = [p.groesse].concat(p.optionen || []).filter(Boolean).join(', ');
        return '<li class="line">' +
          (opt.bearbeiten
            ? '<div class="qty"><button type="button" data-minus="' + i + '" aria-label="Eins weniger">−</button><span>' + p.menge + '</span><button type="button" data-plus="' + i + '" aria-label="Eins mehr">+</button></div>'
            : '<span class="line__qty">' + p.menge + '×</span>') +
          '<div class="line__text"><strong>' + esc(p.name) + '</strong>' +
          (det ? '<small>' + esc(det) + '</small>' : '') +
          (p.notiz ? '<small>„' + esc(p.notiz) + '“</small>' : '') + '</div>' +
          '<span class="line__price">' + euro(p.preis * p.menge) + '</span></li>';
      }).join('') + '</ul>';

      html += '<dl class="sums"><div><dt>Zwischensumme</dt><dd>' + euro(sm.zw) + '</dd></div>' +
        (sm.rabatt ? '<div class="sums__rabatt"><dt>' + esc(sm.rabatt.titel) + '</dt><dd>−' + euro(sm.rabatt.betrag) + '</dd></div>' : '') +
        (s.modus === 'lieferung' ? '<div><dt>Liefergebühr</dt><dd>' + (sm.zone ? (sm.liefer ? euro(sm.liefer) : 'gratis') : '–') + '</dd></div>' : '') +
        '<div class="sums__total"><dt>Gesamt</dt><dd>' + euro(sm.gesamt) + '</dd></div></dl>';

      if (s.modus === 'lieferung' && sm.fehlt > 0) {
        var pct = Math.min(100, Math.round(sm.zw / sm.min * 100));
        html += '<div class="minbar"><div class="minbar__track"><span style="width:' + pct + '%"></span></div>' +
          '<p>Noch <strong>' + euro(sm.fehlt) + '</strong> bis zum Mindestbestellwert von ' + euro(sm.min) + '.</p></div>';
      }
    }

    if (opt.kasse) {
      var label = { leer: 'Zur Kasse', plz: 'Erst Postleitzahl wählen', min: 'Mindestbestellwert nicht erreicht', zu: 'Gerade geschlossen' }[sm.grund] ||
        'Zur Kasse · ' + euro(sm.gesamt);
      html += sm.bereit
        ? '<a class="btn btn--primary basket__go" href="kasse.html">' + label + '</a>'
        : '<button class="btn btn--primary basket__go" type="button" disabled>' + label + '</button>';
      if (sm.grund === 'zu') html += '<p class="basket__hint basket__hint--center">' + (s.modus === 'lieferung' ? 'Lieferung' : 'Abholung') + ' wieder ' + esc(oeffnungText(s.modus)) + '.</p>';
    }
    root.innerHTML = html;
  }

  function binden(root, opt) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.plus) menge(+b.dataset.plus, 1);
      else if (b.dataset.minus) menge(+b.dataset.minus, -1);
      else if (b.dataset.modus) modus(b.dataset.modus);
      else if (b.hasAttribute('data-leeren')) leeren();
    });
    root.addEventListener('change', function (e) {
      if (e.target.matches('[data-plz]')) plz(e.target.value);
    });
    var los = function () { zeichne(root, opt); };
    hoerer.push(los);
    los();
  }

  // Andere Tabs: Warenkorb gleich halten
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    s = lesen();
    hoerer.forEach(function (f) { f(); });
  });

  return {
    get: function () { return s; },
    summen: summen, hinzu: hinzu, menge: menge, modus: modus, plz: plz, leeren: leeren,
    zone: zone, zeiten: zeiten, oeffnungText: oeffnungText, binden: binden,
    on: function (f) { hoerer.push(f); }, euro: euro, esc: esc
  };
})();
