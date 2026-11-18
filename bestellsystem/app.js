// Rheinland Bestellsystem – Bestellungen vom Server holen, klingeln, Bons drucken, Status setzen, Archiv.
(function () {
  var API = '../api/monitor.php';
  var TOKEN = 'rdw-token';
  var EINST = 'rdw-einstellungen';
  var ABFRAGE_MS = 4000;
  var $ = function (s) { return document.querySelector(s); };

  var DRUCKER_IP = '192.168.2.61';  // laut Netzwerk-Ausdruck des Bondruckers im Laden
  var cfg = laden(EINST, { verbindung: 'wlan', ip: DRUCKER_IP, autodruck: true, belege: 'kunde', nachDruck: 'archiv', ton: true, https: true });
  // Inhaber möchte nur noch einen Bon (den Kunden-Bon): alte Einstellung „beide“ einmalig umstellen
  if (!cfg.einBon) { if (cfg.belege === 'beide') cfg.belege = 'kunde'; cfg.einBon = true; merken(EINST, cfg); }
  // alte Standard-Adresse auf dem Tablet gespeichert → einmalig auf die neue umstellen
  if (cfg.ip === '192.168.178.82') { cfg.ip = DRUCKER_IP; merken(EINST, cfg); }
  var token = laden(TOKEN, '');
  var bestellungen = [];
  var bekannt = null;             // Nummern, die schon einmal da waren (erst nach der ersten Abfrage gefüllt)
  var reiter = 'neu';
  var druckt = false;
  var druckFehler = {};           // nr → Zeitpunkt des letzten Fehlversuchs
  var ankunft = {};               // nr → wann die Bestellung hier zuerst als „neu“ auftauchte (fürs Erinnerungs-Klingeln)
  var ERINNERN_MS = 2 * 60000;    // so lange wird an eine nicht angenommene Bestellung erinnert
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
  function api(methode, daten, abfrageText) {
    return fetch(API + (abfrageText || ''), {
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
    setTimeout(tageSichern, 1000);
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
  // Erinnert alle 20 Sekunden an neue, noch nicht angenommene Bestellungen – höchstens 2 Minuten lang
  setInterval(function () {
    var jetzt = Date.now();
    if (bestellungen.some(function (b) { return b.status === 'neu' && jetzt - (ankunft[b.nr] || 0) < ERINNERN_MS; })) klingeln();
  }, 20000);

  function tonZeigen() {
    var k = $('[data-ton-schalter]');
    k.textContent = cfg.ton ? '🔔' : '🔕';
    k.setAttribute('aria-pressed', String(cfg.ton));
  }
  $('[data-ton-schalter]').addEventListener('click', function () {
    cfg.ton = !cfg.ton;
    merken(EINST, cfg);
    tonZeigen();
    if (cfg.ton) { tonBereit(); klingeln(); }
    melden(cfg.ton ? 'Ton an' : 'Ton aus');
  });
  tonZeigen();

  // ---------- Abfrage ----------
  function holen() {
    clearTimeout(abfrage);
    api('GET').then(function (j) {
      lampe('server', true);
      bestellungen = j.bestellungen || [];
      var neue = bestellungen.filter(function (b) { return bekannt && !bekannt[b.nr]; });
      bekannt = bekannt || {};
      bestellungen.forEach(function (b) {
        bekannt[b.nr] = true;
        if (b.status === 'neu' && !ankunft[b.nr]) ankunft[b.nr] = Date.now();
      });
      if (neue.length) {
        klingeln();
        if (reiter !== 'archiv') reiterWaehlen('neu');
        melden(neue.length === 1 ? 'Neue Bestellung ' + kurz(neue[0]) + '!' : neue.length + ' neue Bestellungen!');
      }
      pauseZeigen(j.pause);
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
    $('[data-liste]').hidden = r === 'archiv';
    $('[data-archiv]').hidden = r !== 'archiv';
    if (r === 'archiv') archivLaden(); else zeichnen();
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
    if (reiter === 'archiv') return;
    var zahl = { neu: 0, arbeit: 0, fertig: 0, erledigt: 0 };
    bestellungen.forEach(function (b) { zahl[GRUPPE[b.status]]++; });
    delete zahl.erledigt;   // Erledigtes steht nur im Archiv
    Object.keys(zahl).forEach(function (k) { $('[data-zahl="' + k + '"]').textContent = zahl[k]; });
    $('[data-reiter="neu"]').classList.toggle('hat-neue', zahl.neu > 0);

    var liste = bestellungen.filter(function (b) { return GRUPPE[b.status] === reiter; });
    // nach gewünschter Zeit
    liste.sort(function (a, b) {
      var za = a.zeit === 'schnellstmöglich' ? uhr(a.eingang) : a.zeit, zb = b.zeit === 'schnellstmöglich' ? uhr(b.eingang) : b.zeit;
      return za < zb ? -1 : za > zb ? 1 : 0;
    });
    $('[data-liste]').innerHTML = liste.length ? liste.map(karte).join('') : '<p class="leer"><strong>' +
      { neu: 'Alles gedruckt ✓', arbeit: 'Nichts in Arbeit', fertig: 'Nichts fertig' }[reiter] +
      '</strong>Neue Bestellungen erscheinen hier – mit Klingeln und Bon. Gedruckte findest du im 🗂 Archiv.</p>';
  }

  $('[data-liste]').addEventListener('click', function (e) {
    var k = e.target.closest('button');
    var art = e.target.closest('[data-nr]');
    if (!art) return;
    var b = bestellungen.find(function (x) { return x.nr === art.dataset.nr; });
    if (!b) return;
    if (!k) { if (e.target.closest('.karte__kopf')) belegZeigen(b); return; }
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
      // Nach dem Druck: direkt ins Archiv (erledigt) oder in „In Arbeit“ – je nach Einstellung
      var weiter = b.status === 'neu' ? { archiv: 'erledigt', annehmen: 'angenommen' }[cfg.nachDruck] : null;
      if (weiter) b.status = weiter;
      zeichnen();
      if (weiter) melden('Bon ' + kurz(b) + ' gedruckt' + (weiter === 'erledigt' ? ' – im Archiv.' : '.'));
      return api('POST', { aktion: 'gedruckt', nr: b.nr }).then(function () {
        if (weiter) return api('POST', { aktion: 'status', nr: b.nr, status: weiter });
      }).catch(function () { /* nächste Abfrage */ });
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
    if (cfg.verbindung !== 'bluetooth' && !cfg.ip) { lampe('drucker', false); return; }
    Bon.pruefen(cfg).then(function () { lampe('drucker', true); }, function () { lampe('drucker', false); });
  }
  setInterval(function () { if (token && !druckt) druckerPruefen(); }, 60000);

  // ---------- Einstellungen ----------
  var dlg = $('[data-einstellungen]');
  var form = dlg.querySelector('form');
  $('[data-einstellungen-oeffnen]').addEventListener('click', function () {
    form.verbindung.value = cfg.verbindung || 'wlan';
    verbindungZeigen();
    form.ip.value = cfg.ip;
    form.autodruck.checked = cfg.autodruck;
    form.belege.value = cfg.belege;
    form.nachDruck.value = cfg.nachDruck;
    form.ton.checked = cfg.ton;
    form.https.checked = cfg.https;
    $('[data-druck-meldung]').textContent = '';
    dlg.showModal();
  });
  function uebernehmen() {
    cfg = { verbindung: form.verbindung.value === 'bluetooth' ? 'bluetooth' : 'wlan', ip: form.ip.value.trim(),
      autodruck: form.autodruck.checked, belege: form.belege.value, nachDruck: form.nachDruck.value,
      ton: form.ton.checked, https: form.https.checked, einBon: true };
    verbindungZeigen();
    merken(EINST, cfg);
    tonZeigen();
  }
  function verbindungZeigen() {
    var bt = form.verbindung.value === 'bluetooth';
    dlg.querySelectorAll('[data-nur-wlan]').forEach(function (e) { e.hidden = bt; });
    dlg.querySelectorAll('[data-nur-bt]').forEach(function (e) { e.hidden = !bt; });
  }
  $('[data-bt-waehlen]').addEventListener('click', function () {
    var m = $('[data-druck-meldung]');
    Bon.bluetoothWaehlen().then(function () {
      m.textContent = '✓ Bluetooth-Drucker gewählt. Jetzt „Testdruck“ antippen.';
      druckerPruefen();
    }, function (err) {
      m.textContent = err && err.name === 'NotFoundError' ? 'Kein Drucker gewählt. Ist er in den Android-Einstellungen gekoppelt?' : '✗ ' + (err && err.message || err);
    });
  });
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

  // ---------- Archiv ----------
  var archivListe = [];
  var handListe = [];             // Bons von Hand (Telefon / Gast im Laden) – eigene Liste
  function isoTag(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var tagFeld = $('[data-tag]');
  tagFeld.value = isoTag(new Date());
  tagFeld.max = tagFeld.value;

  function zaehlt(b) { return b.status !== 'storniert'; }
  function archivLaden() {
    var tag = tagFeld.value;
    $('[data-tabelle]').innerHTML = '<p class="leer">Lädt …</p>';
    api('GET', null, '?tag=' + tag).then(function (j) {
      if (tagFeld.value !== tag) return;
      archivListe = j.bestellungen || [];
      handListe = j.handbons || [];
      archivZeichnen();
    }).catch(function (err) { $('[data-tabelle]').innerHTML = '<p class="leer">' + esc(err.message) + '</p>'; });
  }
  function summe(liste, f) { return liste.filter(zaehlt).filter(f || function () { return true; }).reduce(function (t, b) { return t + b.gesamt; }, 0); }
  function archivZeichnen() {
    var l = archivListe;
    var gueltig = l.filter(zaehlt);
    $('[data-summen]').innerHTML = [
      ['kachel--haupt', 'Umsatz', euro(summe(l))],
      ['', 'Bestellungen', gueltig.length + (l.length > gueltig.length ? ' <small>(+' + (l.length - gueltig.length) + ' abgelehnt)</small>' : '')],
      ['', 'Bar', euro(summe(l, function (b) { return b.zahlung === 'bar'; }))],
      ['', 'Karte', euro(summe(l, function (b) { return b.zahlung === 'karte'; }))],
      ['', 'Online bezahlt', euro(summe(l, function (b) { return b.zahlung === 'online'; }))],
      ['', 'Lieferung / Abholung', gueltig.filter(function (b) { return b.art === 'lieferung'; }).length + ' / ' + gueltig.filter(function (b) { return b.art !== 'lieferung'; }).length]
    ].map(function (k) { return '<div class="kachel ' + k[0] + '"><span>' + k[1] + '</span><strong>' + k[2] + '</strong></div>'; }).join('');
    var ZAHLUNG = { online: ['online', 'Online'], bar: ['bar', 'Bar'], karte: ['karte', 'Karte'] };
    $('[data-tabelle]').innerHTML = l.length ? l.map(function (b) {
      var z = ZAHLUNG[b.zahlung] || ZAHLUNG.bar;
      return '<button class="zeile' + (b.status === 'storniert' ? ' zeile--storniert' : '') + '" type="button" data-archiv-nr="' + esc(b.nr) + '">' +
        '<span class="zeile__zeit">' + uhr(b.eingang) + '</span><span class="zeile__nr">' + kurz(b) + '</span>' +
        '<span class="zeile__name">' + esc(b.name) + ' <small>· ' + (b.art === 'lieferung' ? 'Lieferung' : 'Abholung') + ' · ' + STAND[b.status] + '</small></span>' +
        '<span class="zahlung zahlung--' + z[0] + '">' + z[1] + '</span><span class="zeile__betrag">' + euro(b.gesamt) + '</span></button>';
    }).join('') : '<p class="leer"><strong>Keine Bestellungen an diesem Tag</strong></p>';
    var ARTEN = { lieferung: 'Lieferung', abholung: 'Abholung', vorort: 'Im Laden' };
    $('[data-hand]').innerHTML = handListe.length
      ? '<h3 class="archiv__titel">✍ Bons von Hand <small>' + handListe.length + ' · ' + euro(summe(handListe)) + '</small></h3>' +
        handListe.map(function (b) {
          var z = ZAHLUNG[b.zahlung] || ZAHLUNG.bar;
          return '<button class="zeile" type="button" data-hand-nr="' + esc(b.nr) + '">' +
            '<span class="zeile__zeit">' + uhr(b.eingang) + '</span><span class="zeile__nr">' + kurz(b) + '</span>' +
            '<span class="zeile__name">' + esc(b.name || '–') + ' <small>· ' + (ARTEN[b.art] || '') + ' · ' + b.positionen.length + ' Posten</small></span>' +
            '<span class="zahlung zahlung--' + z[0] + '">' + z[1] + '</span><span class="zeile__betrag">' + euro(b.gesamt) + '</span></button>';
        }).join('')
      : '';
  }
  $('[data-hand]').addEventListener('click', function (e) {
    var z = e.target.closest('[data-hand-nr]');
    var b = z && handListe.find(function (x) { return x.nr === z.dataset.handNr; });
    if (b) belegZeigen(b);
  });
  $('[data-tabelle]').addEventListener('click', function (e) {
    var z = e.target.closest('[data-archiv-nr]');
    var b = z && archivListe.find(function (x) { return x.nr === z.dataset.archivNr; });
    if (b) belegZeigen(b);
  });
  tagFeld.addEventListener('change', archivLaden);
  document.querySelectorAll('[data-tag-schritt]').forEach(function (k) {
    k.addEventListener('click', function () {
      var d = new Date(tagFeld.value + 'T12:00:00');
      d.setDate(d.getDate() + +k.dataset.tagSchritt);
      if (isoTag(d) > tagFeld.max) return;
      tagFeld.value = isoTag(d);
      archivLaden();
    });
  });
  $('[data-heute]').addEventListener('click', function () { tagFeld.value = tagFeld.max = isoTag(new Date()); archivLaden(); });

  // ---------- Tabellen für die Buchhaltung (Excel öffnet die Dateien direkt) ----------
  function csvText(bestellungen, handbons) {
    var zahl = function (n) { return (Math.round((n || 0) * 100) / 100).toFixed(2).replace('.', ','); };
    // ältere Bestellungen (vor der MwSt.-Aufteilung) bleiben in diesen Spalten leer
    var mwstSpalten = function (b, satz) {
      if (!b.mwst) return ['', '', ''];
      var m = b.mwst.filter(function (x) { return x.satz === satz; })[0] || { brutto: 0, netto: 0, steuer: 0 };
      return [zahl(m.brutto), zahl(m.netto), zahl(m.steuer)];
    };
    // Kundentext darf in Excel keine Formel werden (= + - @ am Anfang)
    var feld = function (v) {
      v = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    var ARTEN = { lieferung: 'Lieferung', abholung: 'Abholung', vorort: 'Im Laden' };
    var zeilen = [['Datum', 'Uhrzeit', 'Nr', 'Quelle', 'Art', 'Status', 'Zahlung', 'Name', 'Telefon', 'Adresse', 'Zwischensumme', 'Rabatt', 'Liefergebühr', 'Gesamt',
      'Brutto 7 %', 'Netto 7 %', 'MwSt 7 %', 'Brutto 19 %', 'Netto 19 %', 'MwSt 19 %', 'Positionen']];
    (bestellungen || []).map(function (b) { return [b, 'Website']; })
      .concat((handbons || []).map(function (b) { return [b, 'Von Hand']; }))
      .sort(function (x, y) { return x[0].eingang < y[0].eingang ? -1 : 1; })
      .forEach(function (e) {
        var b = e[0], d = new Date(b.eingang);
        zeilen.push([d.toLocaleDateString('de-DE'), uhr(b.eingang), b.nr, e[1], ARTEN[b.art] || '', b.hand ? 'Von Hand' : STAND[b.status],
          { online: 'Online', bar: 'Bar', karte: 'Karte' }[b.zahlung] || '', b.name, b.telefon,
          b.art === 'lieferung' ? (b.strasse + ' ' + b.hausnr).trim() + ', ' + (b.plz + ' ' + b.ort).trim() : '',
          zahl(b.zwischensumme), zahl(b.rabatt ? b.rabatt.betrag : 0), zahl(b.liefergebuehr), zahl(b.gesamt)]
          .concat(mwstSpalten(b, 7), mwstSpalten(b, 19), [
          (b.positionen || []).map(function (p) { return p.menge + 'x ' + p.name + (p.groesse ? ' (' + p.groesse + ')' : ''); }).join(', ')]));
      });
    return '﻿' + zeilen.map(function (z) { return z.map(feld).join(';'); }).join('\r\n');
  }
  function dateiSpeichern(text, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }
  $('[data-csv]').addEventListener('click', function () {
    var monat = tagFeld.value.slice(0, 7);
    api('GET', null, '?monat=' + monat).then(function (j) {
      dateiSpeichern(csvText(j.bestellungen, j.handbons), 'Bestellungen-' + monat + '.csv');
      melden((j.bestellungen || []).length + ' Bestellungen und ' + (j.handbons || []).length + ' Bons von Hand aus ' + monat + ' gespeichert.');
    }).catch(function (err) { melden(err.message, true); });
  });

  // ---------- Tagessicherung: jeden Tag eine Datei auf dem Tablet (Ordner „Downloads“) ----------
  // Läuft beim Antippen von „Start“ und sonst einmal nach Mitternacht; holt verpasste Tage nach (bis 7 Tage zurück).
  var GESICHERT = 'rdw-gesichert';
  var sichertGerade = false;
  function tagSichern(tag, auchLeer) {
    return api('GET', null, '?tag=' + tag).then(function (j) {
      var n = (j.bestellungen || []).length + (j.handbons || []).length;
      if (n || auchLeer) dateiSpeichern(csvText(j.bestellungen, j.handbons), 'Neusser-Tagessicherung-' + tag + '.csv');
      return n;
    });
  }
  function tageSichern() {
    if (sichertGerade || !token) return;
    var heute = new Date(), gestern = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - 1);
    var bis = isoTag(gestern), zuletzt = laden(GESICHERT, '');
    if (!zuletzt) zuletzt = isoTag(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - 2));   // erstes Mal: nur gestern
    if (zuletzt >= bis) return;
    var tage = [];
    for (var i = 7; i >= 1; i--) {
      var t = isoTag(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - i));
      if (t > zuletzt) tage.push(t);
    }
    sichertGerade = true;
    var anzahl = 0;
    tage.reduce(function (kette, t) {
      return kette.then(function () { return tagSichern(t, false); }).then(function (n) { anzahl += n; merken(GESICHERT, t); });
    }, Promise.resolve()).then(function () {
      if (anzahl) melden('Tagessicherung gespeichert (Ordner „Downloads“): ' + anzahl + ' Bestellungen/Bons.');
    }).catch(function () { /* nächster Versuch beim nächsten Start */ }).then(function () { sichertGerade = false; });
  }
  setInterval(tageSichern, 15 * 60000);
  $('[data-tag-sichern]').addEventListener('click', function () {
    var tag = tagFeld.value;
    tagSichern(tag, true).then(function (n) { melden('Tag ' + tag + ' gespeichert (' + n + ' Einträge, Ordner „Downloads“).'); },
      function (err) { melden(err.message, true); });
  });

  // ---------- Beleg ansehen und nachdrucken ----------
  var belegDlg = $('[data-beleg]');
  var belegBestellung = null;
  function belegZeigen(b) {
    belegBestellung = b;
    var box = $('[data-beleg-bild]');
    box.innerHTML = '';
    box.appendChild(Bon.zeichnen(b, 'kunde'));
    belegDlg.showModal();
  }
  document.querySelectorAll('[data-beleg-druck]').forEach(function (k) {
    k.addEventListener('click', function () {
      var b = belegBestellung;
      if (!b || druckt) return;
      druckt = true;
      Bon.drucken(b, cfg, [k.dataset.belegDruck]).then(function () { lampe('drucker', true); melden('Bon ' + kurz(b) + ' gedruckt.'); },
        function (err) { lampe('drucker', false); melden(err.message, true); }).then(function () { druckt = false; });
    });
  });
  $('[data-beleg-zu]').addEventListener('click', function () { belegDlg.close(); });

  // ---------- Pause: Website nimmt keine Bestellungen an ----------
  var pauseDlg = $('[data-pause-dlg]');
  function pauseZeigen(p) {
    var leiste = $('[data-pausiert]');
    leiste.hidden = !p;
    $('[data-pause-oeffnen]').hidden = !!p;
    if (p) {
      $('[data-pause-text]').textContent = p.offen ? 'bis du wieder öffnest' : 'bis ' + uhr(new Date(p.bis * 1000).toISOString()) + ' Uhr – danach automatisch wieder offen';
    }
  }
  function pauseSetzen(minuten, knopf) {
    if (knopf) knopf.disabled = true;
    return api('POST', { aktion: 'pause', minuten: minuten }).then(function (j) {
      pauseZeigen(j.pause);
      melden(j.pause ? 'Online-Bestellungen pausiert.' : 'Wieder geöffnet – Bestellungen kommen wieder an.');
    }).catch(function (err) { melden(err.message, true); })
      .then(function () { if (knopf) knopf.disabled = false; });
  }
  $('[data-pause-oeffnen]').addEventListener('click', function () { pauseDlg.showModal(); });
  pauseDlg.querySelectorAll('[data-pause-min]').forEach(function (k) {
    k.addEventListener('click', function () {
      pauseSetzen(+k.dataset.pauseMin, k).then(function () { if (pauseDlg.open) pauseDlg.close(); });
    });
  });
  $('[data-pause-ende]').addEventListener('click', function (e) { pauseSetzen(null, e.currentTarget); });


  // ---------- Neuer Bon von Hand (Telefon / Gast im Laden): nur drucken, nicht speichern ----------
  // Steuer wie auf dem Server (api/lib.php): Speisen 7 %, Getränke 19 %, Menüs nach Einzelpreisen aufgeteilt.
  var neuDlg = $('[data-neubon]');
  var neuForm = $('[data-neubon-form]');
  var neuArtikel = [];            // aus data/menu.json: { name, kat, preis, preise, anteil19 }
  var neuZeilen = [];             // { name, groesse, menge, stueck, anteil19 }
  function zahlLesen(v) { var n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; }
  function anteil19(auf) {
    if (!auf) return 0;
    var g = +auf.getraenk || 0, sp = +auf.speisen || 0;
    return g > 0 && g + sp > 0 ? g / (g + sp) : 0;
  }
  function mwstAufteilen(gesamt, zw, b19) {
    var f19 = zw > 0 ? Math.min(1, Math.max(0, b19 / zw)) : 0;
    var r = function (n) { return Math.round(n * 100) / 100; };
    var teil19 = r(gesamt * f19), teile = { 7: r(gesamt - teil19), 19: teil19 }, aus = [];
    [7, 19].forEach(function (satz) {
      var brutto = teile[satz];
      if (brutto <= 0) return;
      var steuer = r(brutto * satz / (100 + satz));
      aus.push({ satz: satz, brutto: brutto, netto: r(brutto - steuer), steuer: steuer });
    });
    return aus;
  }
  function neuSpeisekarte() {
    if (neuArtikel.length) return Promise.resolve();
    return fetch('../data/menu.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Speisekarte nicht geladen.');
      return r.json();
    }).then(function (m) {
      var sel = $('[data-neubon-artikel]');
      sel.innerHTML = '';
      (m.kategorien || []).forEach(function (k) {
        var gruppe = document.createElement('optgroup');
        gruppe.label = k.kategorie;
        (k.artikel || []).forEach(function (a) {
          if (a.aktiv === false || (a.preis == null && !a.preise)) return;
          var o = document.createElement('option');
          o.value = String(neuArtikel.length);
          o.textContent = a.name + (a.preis != null ? ' – ' + euro(a.preis) : '');
          gruppe.appendChild(o);
          neuArtikel.push({ name: a.name, preis: a.preis, preise: a.preise || null,
            anteil19: +k.mwst === 19 ? 1 : anteil19(a.mwst_aufteilung) });
        });
        if (gruppe.children.length) sel.appendChild(gruppe);
      });
      neuGroessen();
    });
  }
  function neuGroessen() {
    var a = neuArtikel[+$('[data-neubon-artikel]').value];
    var g = $('[data-neubon-groesse]');
    g.innerHTML = '';
    g.hidden = !(a && a.preise);
    if (a && a.preise) Object.keys(a.preise).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = k + ' – ' + euro(a.preise[k]);
      g.appendChild(o);
    });
  }
  function neuSummen() {
    var zw = 0, b19 = 0;
    neuZeilen.forEach(function (z) { zw += z.stueck * z.menge; b19 += z.stueck * z.menge * z.anteil19; });
    zw = Math.round(zw * 100) / 100;
    var liefer = neuForm.art.value === 'lieferung' ? (zahlLesen(neuForm.liefer.value) || 0) : 0;
    var gesamt = Math.round((zw + liefer) * 100) / 100;
    return { zw: zw, liefer: liefer, gesamt: gesamt, mwst: mwstAufteilen(gesamt, zw, b19) };
  }
  function neuZeigen() {
    var liste = $('[data-neubon-liste]');
    liste.innerHTML = neuZeilen.map(function (z, i) {
      var satz = z.anteil19 >= 1 ? 'B 19 %' : z.anteil19 > 0 ? 'A/B' : 'A 7 %';
      return '<div class="neubon__zeile"><b>' + z.menge + '×</b><span>' + esc(z.name) + (z.groesse ? ' (' + esc(z.groesse) + ')' : '') +
        '<small>' + satz + '</small></span>' +
        '<input inputmode="decimal" value="' + z.stueck.toFixed(2).replace('.', ',') + '" data-neubon-preis="' + i + '" aria-label="Preis pro Stück">' +
        '<button class="knopf knopf--gefahr" type="button" data-neubon-weg="' + i + '" aria-label="Entfernen">✕</button></div>';
    }).join('');
    var s = neuSummen();
    $('[data-neubon-summe]').textContent = neuZeilen.length
      ? 'Gesamt ' + euro(s.gesamt) + ' · ' + s.mwst.map(function (m) { return m.satz + ' % MwSt. ' + euro(m.steuer); }).join(' · ')
      : 'Noch keine Posten.';
  }
  function neuBestellung() {
    if (!neuZeilen.length) throw new Error('Bitte erst ein Gericht hinzufügen.');
    var s = neuSummen(), jetzt = new Date();
    var f = neuForm, ort = f.ort.value.trim(), plz = (ort.match(/^\d{5}/) || [''])[0];
    return {
      nr: 'HAND-' + ('0' + jetzt.getHours()).slice(-2) + ('0' + jetzt.getMinutes()).slice(-2),
      art: f.art.value, eingang: jetzt.toISOString(), zeit: 'schnellstmöglich', zahlung: f.zahlung.value,
      name: f.name.value.trim(), telefon: f.telefon.value.trim(), email: '', firma: '', etage: '',
      strasse: f.art.value === 'lieferung' ? f.strasse.value.trim() : '', hausnr: '',
      plz: f.art.value === 'lieferung' ? plz : '', ort: f.art.value === 'lieferung' ? ort.replace(/^\d{5}\s*/, '') : '',
      bemerkung: f.bemerkung.value.trim(),
      positionen: neuZeilen.map(function (z) {
        return { name: z.name, groesse: z.groesse || '', optionen: [], notiz: '', menge: z.menge, stueck: z.stueck,
          mwst: z.anteil19 >= 1 ? 19 : z.anteil19 > 0 ? 'gemischt' : 7 };
      }),
      zwischensumme: s.zw, rabatt: null, liefergebuehr: s.liefer, gesamt: s.gesamt, mwst: s.mwst
    };
  }
  function neuMeldung(text, fehler) {
    var m = $('[data-neubon-meldung]');
    m.textContent = text;
    m.style.color = fehler ? 'var(--rot)' : '';
  }

  $('[data-neubon-oeffnen]').addEventListener('click', function () {
    neuMeldung('');
    neuDlg.showModal();
    neuSpeisekarte().then(neuZeigen).catch(function (err) { neuMeldung(err.message, true); });
  });
  $('[data-neubon-zu]').addEventListener('click', function () { neuDlg.close(); });
  $('[data-neubon-leeren]').addEventListener('click', function () {
    neuZeilen = [];
    ['name', 'telefon', 'strasse', 'bemerkung', 'freiName', 'freiPreis'].forEach(function (n) { neuForm[n].value = ''; });
    neuForm.liefer.value = '0,00';
    neuMeldung('');
    neuZeigen();
  });
  neuForm.addEventListener('submit', function (e) { e.preventDefault(); });
  neuForm.art.addEventListener('change', function () {
    $('[data-nur-lieferung]').hidden = neuForm.art.value !== 'lieferung';
    neuZeigen();
  });
  neuForm.liefer.addEventListener('input', neuZeigen);
  $('[data-neubon-artikel]').addEventListener('change', neuGroessen);
  $('[data-neubon-dazu]').addEventListener('click', function () {
    var a = neuArtikel[+$('[data-neubon-artikel]').value];
    if (!a) return;
    var groesse = a.preise ? $('[data-neubon-groesse]').value : '';
    var preis = a.preise ? +a.preise[groesse] : +a.preis;
    var menge = Math.min(50, Math.max(1, parseInt(neuForm.menge.value, 10) || 1));
    neuZeilen.push({ name: a.name, groesse: groesse, menge: menge, stueck: Math.round(preis * 100) / 100, anteil19: a.anteil19 });
    neuForm.menge.value = 1;
    neuMeldung('');
    neuZeigen();
  });
  $('[data-neubon-frei]').addEventListener('click', function () {
    var name = neuForm.freiName.value.trim(), preis = zahlLesen(neuForm.freiPreis.value);
    if (!name || !(preis >= 0) || preis > 999) { neuMeldung('Bitte Bezeichnung und Preis eingeben.', true); return; }
    neuZeilen.push({ name: name, groesse: '', menge: 1, stueck: preis, anteil19: neuForm.freiSatz.value === '19' ? 1 : 0 });
    neuForm.freiName.value = neuForm.freiPreis.value = '';
    neuMeldung('');
    neuZeigen();
  });
  $('[data-neubon-liste]').addEventListener('click', function (e) {
    var k = e.target.closest('[data-neubon-weg]');
    if (!k) return;
    neuZeilen.splice(+k.dataset.neubonWeg, 1);
    neuZeigen();
  });
  $('[data-neubon-liste]').addEventListener('change', function (e) {
    var f = e.target.closest('[data-neubon-preis]');
    if (!f) return;
    var p = zahlLesen(f.value);
    if (p >= 0 && p <= 999) neuZeilen[+f.dataset.neubonPreis].stueck = p;
    neuZeigen();
  });
  $('[data-neubon-ansehen]').addEventListener('click', function () {
    try { var b = neuBestellung(); } catch (err) { neuMeldung(err.message, true); return; }
    neuDlg.close();
    belegZeigen(b);
  });
  // Speichern: einmal je Zusammenstellung – nochmal drucken legt keinen zweiten Bon an
  var neuGespeichert = null;      // { schluessel, bon }
  function neuDaten() {
    var f = neuForm, ort = f.ort.value.trim();
    return {
      art: f.art.value, zahlung: f.zahlung.value, name: f.name.value.trim(), telefon: f.telefon.value.trim(),
      strasse: f.strasse.value.trim(), plz: (ort.match(/^\d{5}/) || [''])[0], ort: ort.replace(/^\d{5}\s*/, ''),
      bemerkung: f.bemerkung.value.trim(), liefergebuehr: zahlLesen(f.liefer.value) || 0,
      positionen: neuZeilen.map(function (z) { return { name: z.name, groesse: z.groesse || '', menge: z.menge, stueck: z.stueck, anteil19: z.anteil19 }; })
    };
  }
  function neuSpeichern() {
    neuBestellung();                // prüft, ob überhaupt etwas drin ist
    var daten = neuDaten(), schluessel = JSON.stringify(daten);
    if (neuGespeichert && neuGespeichert.schluessel === schluessel) return Promise.resolve({ bon: neuGespeichert.bon, gespeichert: true });
    return api('POST', { aktion: 'handbon', bon: daten }).then(function (j) {
      neuGespeichert = { schluessel: schluessel, bon: j.bon };
      return { bon: j.bon, gespeichert: true };
    }, function (err) {
      return { bon: neuBestellung(), gespeichert: false, fehler: err.message };
    });
  }
  document.querySelectorAll('[data-neubon-druck]').forEach(function (k) {
    k.addEventListener('click', function () {
      try { neuBestellung(); } catch (err) { neuMeldung(err.message, true); return; }
      if (druckt) { neuMeldung('Drucker ist gerade beschäftigt – gleich noch einmal.', true); return; }
      var arten = k.dataset.neubonDruck === 'beide' ? ['laden', 'kunde'] : [k.dataset.neubonDruck];
      druckt = true;
      neuMeldung('Wird gespeichert und gedruckt …');
      neuSpeichern().then(function (e) {
        var hinweis = e.gespeichert ? ' Im Archiv unter „Bons von Hand“.' : ' Achtung: nicht gespeichert (' + e.fehler + ').';
        return Bon.drucken(e.bon, cfg, arten).then(function () {
          lampe('drucker', true);
          neuMeldung('Gedruckt.' + hinweis, !e.gespeichert);
          melden('Bon ' + kurz(e.bon) + ' gedruckt.');
        }, function (err) {
          lampe('drucker', false);
          neuMeldung(err.message + (e.gespeichert ? ' (Bon ist gespeichert – im Archiv nachdrucken.)' : ''), true);
        });
      }).then(function () { druckt = false; });
    });
  });

  // ---------- Uhr ----------
  function tick() { $('[data-uhr]').textContent = uhr(new Date().toISOString()); }
  tick();
  setInterval(tick, 10000);

  zeigen(token ? 'start' : 'anmelden');
})();
