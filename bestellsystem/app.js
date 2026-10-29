// Rheinland Bestellsystem – Bestellungen vom Server holen, klingeln, Bon drucken, Status setzen.
(function () {
  var API = '../api/monitor.php';
  var TOKEN = 'rdw-token';
  var EINST = 'rdw-einstellungen';
  var ABFRAGE_MS = 4000;
  var $ = function (s) { return document.querySelector(s); };

  var cfg = laden(EINST, { ip: '192.168.178.82', autodruck: true, kopien: 1, ton: true, https: true });
  var token = laden(TOKEN, '');
  var bestellungen = [];
  var bekannt = null;             // Nummern, die schon einmal da waren (erst nach der ersten Abfrage gefüllt)
  var reiter = 'neu';
  var druckt = false;
  var druckFehler = {};           // nr → Zeitpunkt des letzten Fehlversuchs
  var abfrage = null;

  function laden(k, std) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? std : (typeof std === 'object' ? Object.assign({}, std, v) : v); }
    catch (e) { return std; }
  }
  function merken(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function euro(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }
  function uhr(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  var meldungUhr;
  function melden(text, fehler) {
    var m = $('[data-meldung]');
    m.textContent = text;
    m.className = 'meldung' + (fehler ? ' meldung--fehler' : '');
    m.hidden = false;
    clearTimeout(meldungUhr);
    meldungUhr = setTimeout(function () { m.hidden = true; }, fehler ? 7000 : 3500);
  }

  // ---------- Server ----------
  function api(methode, daten) {
    return fetch(API, {
      method: methode,
      cache: 'no-store',
      headers: Object.assign({ 'X-Token': token }, daten ? { 'Content-Type': 'application/json' } : {}),
      body: daten ? JSON.stringify(daten) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && !(daten && daten.aktion === 'anmelden')) { abmelden(); throw new Error(j.fehler || 'Bitte neu anmelden.'); }
        if (!r.ok) throw new Error(j.fehler || 'Fehler ' + r.status);
        return j;
      });
    });
  }

  // ---------- Ansichten ----------
  function zeigen(welche) {
    $('[data-anmelden]').hidden = welche !== 'anmelden';
    $('[data-start]').hidden = welche !== 'start';
    $('[data-app]').hidden = welche === 'anmelden';
  }

  $('[data-login]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, knopf = f.querySelector('button');
    knopf.disabled = true;
    $('[data-login-fehler]').textContent = '';
    api('POST', { aktion: 'anmelden', passwort: f.passwort.value }).then(function (j) {
      token = j.token;
      merken(TOKEN, token);
      f.reset();
      zeigen('start');
    }).catch(function (err) {
      $('[data-login-fehler]').textContent = err.message;
    }).then(function () { knopf.disabled = false; });
  });

  function abmelden() {
    token = '';
    try { localStorage.removeItem(TOKEN); } catch (e) { /* egal */ }
    clearTimeout(abfrage);
    if ($('[data-einstellungen]').open) $('[data-einstellungen]').close();
    zeigen('anmelden');
  }

  // Start: Ton freischalten, Bildschirm anlassen, Vollbild
  var wachhalter = null;
  function wachHalten() {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (w) { wachhalter = w; }).catch(function () { /* egal */ });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !wachhalter) wachHalten(); });

  $('[data-starten]').addEventListener('click', function () {
    tonBereit();
    wachHalten();
    if (document.documentElement.requestFullscreen && !window.matchMedia('(display-mode: standalone)').matches) {
      document.documentElement.requestFullscreen().catch(function () { /* egal */ });
    }
    zeigen('app');
    holen();
    druckerPruefen();
  });

  // ---------- Ton ----------
  var audio = null;
  function tonBereit() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { audio = null; }
  }
  function klingeln() {
    if (!cfg.ton || !audio) return;
    var t = audio.currentTime;
    [[880, 0], [1175, .18], [1568, .36], [880, .9], [1175, 1.08], [1568, 1.26]].forEach(function (n) {
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'triangle';
      o.frequency.value = n[0];
      g.gain.setValueAtTime(0, t + n[1]);
      g.gain.linearRampToValueAtTime(.5, t + n[1] + .02);
      g.gain.exponentialRampToValueAtTime(.001, t + n[1] + .5);
      o.connect(g).connect(audio.destination);
      o.start(t + n[1]);
      o.stop(t + n[1] + .55);
    });
  }
  // Klingelt alle 15 Sekunden weiter, solange eine Bestellung nicht angenommen ist
  setInterval(function () {
    if (bestellungen.some(function (b) { return b.status === 'neu'; })) klingeln();
  }, 15000);

  // ---------- Abfrage ----------
  function holen() {
    clearTimeout(abfrage);
    api('GET').then(function (j) {
      lampe('server', true);
      bestellungen = j.bestellungen || [];
      var neue = bestellungen.filter(function (b) { return bekannt && !bekannt[b.nr]; });
      bekannt = bekannt || {};
      bestellungen.forEach(function (b) { bekannt[b.nr] = true; });
      if (neue.length) {
        klingeln();
        reiterWaehlen('neu');
        melden(neue.length === 1 ? 'Neue Bestellung ' + kurz(neue[0]) + '!' : neue.length + ' neue Bestellungen!');
      }
      zeichnen();
      automatischDrucken();
    }).catch(function (err) {
      lampe('server', false);
      if (token) hinweis('Keine Verbindung zum Server – Internet prüfen. (' + err.message + ')');
    }).then(function () {
      if (token) abfrage = setTimeout(holen, ABFRAGE_MS);
    });
  }

  function lampe(welche, ok) {
    var el = $('[data-lampe-' + welche + ']');
    el.classList.toggle('ist-ok', ok);
    el.classList.toggle('ist-aus', !ok);
    if (welche === 'server' && ok) hinweis('');
  }
  function hinweis(text) {
    var h = $('[data-hinweis]');
    h.textContent = text;
    h.hidden = !text;
  }

  // ---------- Darstellung ----------
  var GRUPPE = { neu: 'neu', angenommen: 'arbeit', fertig: 'fertig', unterwegs: 'fertig', erledigt: 'erledigt', storniert: 'erledigt' };
  function kurz(b) { return '#' + b.nr.slice(-4); }

  function reiterWaehlen(r) {
    reiter = r;
    document.querySelectorAll('[data-reiter]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.reiter === r)); });
    zeichnen();
  }
  document.querySelectorAll('[data-reiter]').forEach(function (b) {
    b.addEventListener('click', function () { reiterWaehlen(b.dataset.reiter); });
  });

  function knoepfe(b) {
    var k = [];
    var drucken = '<button class="knopf knopf--zweit" type="button" data-aktion="drucken">🖨 Bon</button>';
    if (b.status === 'neu') {
      k.push('<button class="knopf knopf--orange knopf--haupt" type="button" data-status="angenommen">Annehmen</button>', drucken,
        '<button class="knopf knopf--gefahr" type="button" data-status="storniert">Ablehnen</button>');
    } else if (b.status === 'angenommen') {
      k.push('<button class="knopf knopf--haupt" type="button" data-status="fertig">Fertig</button>', drucken);
    } else if (b.status === 'fertig') {
      k.push(b.art === 'lieferung'
        ? '<button class="knopf knopf--haupt" type="button" data-status="unterwegs">Fahrer ist unterwegs</button>'
        : '<button class="knopf knopf--gruen knopf--haupt" type="button" data-status="erledigt">Abgeholt</button>', drucken);
    } else if (b.status === 'unterwegs') {
      k.push('<button class="knopf knopf--gruen knopf--haupt" type="button" data-status="erledigt">Zugestellt</button>', drucken);
    } else {
      k.push(drucken, '<button class="knopf knopf--leise" type="button" data-status="angenommen">Wieder öffnen</button>');
    }
    return k.join('');
  }

  var STAND = { neu: 'Neu', angenommen: 'In Arbeit', fertig: 'Fertig', unterwegs: 'Unterwegs', erledigt: 'Erledigt', storniert: 'Abgelehnt' };

  function karte(b) {
    var zeitText = b.zeit === 'schnellstmöglich' ? 'Sofort' : b.zeit + ' Uhr';
    var bald = b.zeit !== 'schnellstmöglich' && (function () {
      var p = b.zeit.split(':'), d = new Date(); d.setHours(+p[0], +p[1], 0, 0);
      return d - Date.now() < 30 * 60000;
    })();
    var posten = (b.positionen || []).map(function (p) {
      return '<li><div class="posten__zeile"><span>' + p.menge + '×</span><span>' + esc(p.name) + (p.groesse ? ' <small>(' + esc(p.groesse) + ')</small>' : '') +
        '</span><span>' + euro(p.stueck * p.menge) + '</span></div>' +
        (p.optionen && p.optionen.length ? '<div class="posten__extra">' + esc(p.optionen.join(', ')) + '</div>' : '') +
        (p.notiz ? '<div class="posten__notiz">» ' + esc(p.notiz) + '</div>' : '') + '</li>';
    }).join('');
    var adresse = b.art === 'lieferung' ? b.strasse + ' ' + b.hausnr + ', ' + b.plz + ' ' + b.ort : '';
    var zahlung = b.zahlung === 'online' ? ['online', 'Bezahlt ✓'] : b.zahlung === 'karte' ? ['karte', 'Karte bei Übergabe'] : ['bar', 'Bar kassieren'];
    return '<article class="karte' + (b.status === 'neu' ? ' karte--neu' : '') + '" data-nr="' + esc(b.nr) + '">' +
      '<header class="karte__kopf"><span class="art art--' + b.art + '">' + (b.art === 'lieferung' ? 'LIEFERUNG' : 'ABHOLUNG') + '</span>' +
      '<span class="karte__nr">' + kurz(b) + '</span>' +
      '<div class="karte__zeit' + (bald ? ' karte__zeit--bald' : '') + '"><strong>' + esc(zeitText) + '</strong><span>bestellt ' + uhr(b.eingang) + '</span></div></header>' +
      '<ul class="posten">' + posten + '</ul>' +
      (b.bemerkung ? '<p class="bemerkung">💬 ' + esc(b.bemerkung) + '</p>' : '') +
      '<div class="kunde"><strong>' + esc(b.name) + '</strong>' +
      '<a href="tel:' + esc(b.telefon.replace(/[^0-9+]/g, '')) + '">📞 ' + esc(b.telefon) + '</a>' +
      (adresse ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresse) + '" target="_blank" rel="noopener">📍 ' + esc(adresse) +
        (b.etage ? ' · ' + esc(b.etage) : '') + '</a>' : '') +
      (b.firma ? '<span>' + esc(b.firma) + '</span>' : '') + '</div>' +
      '<div class="summe"><span class="summe__betrag">' + euro(b.gesamt) + '</span><span class="zahlung zahlung--' + zahlung[0] + '">' + zahlung[1] + '</span></div>' +
      '<footer class="karte__fuss">' + knoepfe(b) + '</footer>' +
      '<p class="karte__stand">' + STAND[b.status] + (b.gedruckt ? ' · Bon gedruckt ' + uhr(b.gedruckt) : ' · Bon noch nicht gedruckt') + '</p>' +
      '</article>';
  }

  function zeichnen() {
    var zahl = { neu: 0, arbeit: 0, fertig: 0, erledigt: 0 };
    bestellungen.forEach(function (b) { zahl[GRUPPE[b.status]]++; });
    Object.keys(zahl).forEach(function (k) { $('[data-zahl="' + k + '"]').textContent = zahl[k]; });
    $('[data-reiter="neu"]').classList.toggle('hat-neue', zahl.neu > 0);

    var liste = bestellungen.filter(function (b) { return GRUPPE[b.status] === reiter; });
    // offene nach gewünschter Zeit, erledigte neueste zuerst
    if (reiter !== 'erledigt') {
      liste.sort(function (a, b) {
        var za = a.zeit === 'schnellstmöglich' ? uhr(a.eingang) : a.zeit, zb = b.zeit === 'schnellstmöglich' ? uhr(b.eingang) : b.zeit;
        return za < zb ? -1 : za > zb ? 1 : 0;
      });
    }
    $('[data-liste]').innerHTML = liste.length ? liste.map(karte).join('') : '<p class="leer"><strong>' +
      { neu: 'Keine neuen Bestellungen', arbeit: 'Nichts in Arbeit', fertig: 'Nichts fertig', erledigt: 'Heute noch nichts erledigt' }[reiter] +
      '</strong>Neue Bestellungen erscheinen hier automatisch – mit Klingeln und Bon.</p>';
  }

  $('[data-liste]').addEventListener('click', function (e) {
    var k = e.target.closest('button');
    var art = e.target.closest('[data-nr]');
    if (!k || !art) return;
    var b = bestellungen.find(function (x) { return x.nr === art.dataset.nr; });
    if (!b) return;
    if (k.dataset.aktion === 'drucken') { druckeBon(b, true); return; }
    var neu = k.dataset.status;
    if (neu === 'storniert' && !confirm('Bestellung ' + kurz(b) + ' wirklich ablehnen?' +
      (b.zahlung === 'online' ? '\n\nSie ist schon bezahlt – bitte im Stripe-Dashboard erstatten.' : '') + '\n\nBitte den Kunden anrufen: ' + b.telefon)) return;
    k.disabled = true;
    api('POST', { aktion: 'status', nr: b.nr, status: neu }).then(function () {
      b.status = neu;
      zeichnen();
    }).catch(function (err) { melden(err.message, true); k.disabled = false; });
  });

  // ---------- Drucken ----------
  function druckeBon(b, vonHand) {
    if (druckt) { if (vonHand) melden('Drucker ist beschäftigt – gleich noch einmal.'); return Promise.resolve(); }
    druckt = true;
    return Bon.drucken(b, cfg).then(function () {
      lampe('drucker', true);
      delete druckFehler[b.nr];
      b.gedruckt = new Date().toISOString();
      zeichnen();
      return api('POST', { aktion: 'gedruckt', nr: b.nr }).catch(function () { /* nächste Abfrage */ });
    }).catch(function (err) {
      lampe('drucker', false);
      druckFehler[b.nr] = Date.now();
      melden('Bon ' + kurz(b) + ' nicht gedruckt: ' + err.message, true);
    }).then(function () { druckt = false; });
  }

  function automatischDrucken() {
    if (!cfg.autodruck || druckt) return;
    var offen = bestellungen.filter(function (b) {
      return !b.gedruckt && b.status !== 'storniert' && b.status !== 'erledigt' && (!druckFehler[b.nr] || Date.now() - druckFehler[b.nr] > 20000);
    }).sort(function (a, b) { return a.eingang < b.eingang ? -1 : 1; });
    if (offen.length) druckeBon(offen[0]).then(automatischDrucken);
  }

  function druckerPruefen() {
    if (!cfg.ip) { lampe('drucker', false); return; }
    Bon.pruefen(cfg).then(function () { lampe('drucker', true); }, function () { lampe('drucker', false); });
  }
  setInterval(function () { if (token && !druckt) druckerPruefen(); }, 60000);

  // ---------- Einstellungen ----------
  var dlg = $('[data-einstellungen]');
  var form = dlg.querySelector('form');
  $('[data-einstellungen-oeffnen]').addEventListener('click', function () {
    form.ip.value = cfg.ip;
    form.autodruck.checked = cfg.autodruck;
    form.kopien.value = String(cfg.kopien);
    form.ton.checked = cfg.ton;
    form.https.checked = cfg.https;
    $('[data-druck-meldung]').textContent = '';
    dlg.showModal();
  });
  function uebernehmen() {
    cfg = { ip: form.ip.value.trim(), autodruck: form.autodruck.checked, kopien: +form.kopien.value, ton: form.ton.checked, https: form.https.checked };
    merken(EINST, cfg);
  }
  form.addEventListener('change', uebernehmen);
  dlg.addEventListener('close', function () { uebernehmen(); druckerPruefen(); automatischDrucken(); });
  $('[data-freischalten]').addEventListener('click', function () {
    uebernehmen();
    window.open((cfg.https ? 'https' : 'http') + '://' + cfg.ip + '/', '_blank');
  });
  $('[data-testdruck]').addEventListener('click', function () {
    uebernehmen();
    var m = $('[data-druck-meldung]');
    m.textContent = 'Druckt …';
    Bon.test(cfg).then(function () { m.textContent = '✓ Testbon gedruckt.'; lampe('drucker', true); },
      function (err) { m.textContent = '✗ ' + err.message; lampe('drucker', false); });
  });
  $('[data-abmelden]').addEventListener('click', abmelden);

  // ---------- Uhr ----------
  function tick() { $('[data-uhr]').textContent = uhr(new Date().toISOString()); }
  tick();
  setInterval(tick, 10000);

  zeigen(token ? 'start' : 'anmelden');
})();
