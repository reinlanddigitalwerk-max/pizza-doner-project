// Rheinland Bestellsystem – Bon zeichnen und auf dem Epson-Bondrucker ausgeben.
// Der Bon wird als Bild (576 Punkte = 72 mm, 80-mm-Papier) gezeichnet und per ePOS-Print an den Drucker im WLAN geschickt.
// Zwei Fassungen: „laden“ für Küche und Fahrer (groß, mit allem) und „kunde“ als Bestellbeleg für den Kunden.
// So klappen Umlaute, große Schrift und das Logo ohne Zeichensatz-Probleme.
(function () {
  var BREITE = 576;
  var RAND = 6;
  var SCHRIFT = 'Roboto, "Segoe UI", Arial, sans-serif';

  // Steuerkennzeichen wie auf dem Kassenbon; Angaben aus data/shop.json
  var KENNZ = { 7: 'A', 19: 'B', gemischt: 'A/B' };
  var STEUER = 'St.-Nr. 122/5398/0299 · USt-IdNr. DE455208316';
  function euro(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }
  function uhr(iso) { var d = new Date(iso); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function datum(iso) { var d = new Date(iso); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }

  var logo = new Image();
  logo.src = '../assets/img/logo.webp';

  // ---------- Zeichnen ----------
  function zeichnen(b, art) {
    var kunde = art === 'kunde';
    var c = document.createElement('canvas');
    c.width = BREITE;
    c.height = 4000;
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, BREITE, c.height);
    x.fillStyle = '#000';
    x.textBaseline = 'top';
    var y = 0;

    function schrift(px, fett) { x.font = (fett ? '700 ' : '400 ') + px + 'px ' + SCHRIFT; }
    function umbrechen(text, max) {
      var zeilen = [], z = '';
      String(text).split(/\s+/).forEach(function (w) {
        var t = z ? z + ' ' + w : w;
        if (x.measureText(t).width > max && z) { zeilen.push(z); z = w; } else { z = t; }
      });
      if (z) zeilen.push(z);
      return zeilen;
    }
    function zeile(text, px, fett, opt) {
      opt = opt || {};
      schrift(px, fett);
      var einzug = opt.einzug || 0;
      var rechts = opt.rechts ? x.measureText(opt.rechts).width + 14 : 0;
      umbrechen(text, BREITE - 2 * RAND - einzug - rechts).forEach(function (t, i) {
        if (opt.mitte) { x.textAlign = 'center'; x.fillText(t, BREITE / 2, y); x.textAlign = 'left'; }
        else x.fillText(t, RAND + einzug, y);
        if (i === 0 && opt.rechts) { x.textAlign = 'right'; x.fillText(opt.rechts, BREITE - RAND, y); x.textAlign = 'left'; }
        y += Math.round(px * 1.25);
      });
    }
    function tabelle(werte, px, fett) {   // 1. Spalte links, die übrigen rechtsbündig
      schrift(px, fett);
      var b4 = (BREITE - 2 * RAND) * 0.24;
      x.fillText(werte[0], RAND, y);
      x.textAlign = 'right';
      for (var i = 1; i < werte.length; i++) x.fillText(werte[i], BREITE - RAND - (werte.length - 1 - i) * b4, y);
      x.textAlign = 'left';
      y += Math.round(px * 1.3);
    }
    function balken(text, px) {          // weiße Schrift auf schwarzem Balken
      schrift(px, true);
      var h = Math.round(px * 1.5);
      x.fillRect(0, y, BREITE, h);
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.fillText(text, BREITE / 2, y + Math.round(px * .25));
      x.textAlign = 'left';
      x.fillStyle = '#000';
      y += h + 8;
    }
    function linie(dick) {
      y += 6;
      if (dick) x.fillRect(RAND, y, BREITE - 2 * RAND, 3);
      else for (var i = RAND; i < BREITE - RAND; i += 12) x.fillRect(i, y, 6, 2);
      y += 12;
    }

    // Kopf mit Logo
    if (logo.complete && logo.naturalWidth) {
      var lw = 300, lh = Math.round(logo.naturalHeight * lw / logo.naturalWidth);
      x.drawImage(logo, (BREITE - lw) / 2, y, lw, lh);
      y += lh + 4;
      var logoBis = y;
    } else {
      zeile('Neusser Döner & Pizza', 34, true, { mitte: true });
    }
    zeile('Further Straße 46 · 41462 Neuss · 02131 3166137', 20, false, { mitte: true });
    y += 8;

    var zeitText = b.zeit === 'schnellstmöglich' ? 'SCHNELLSTMÖGLICH' : 'FÜR ' + b.zeit + ' UHR';
    if (kunde) {
      balken('BESTELLBELEG', 36);
      zeile('Bestellung #' + b.nr.slice(-4), 30, true, { rechts: datum(b.eingang) });
      zeile((b.art === 'lieferung' ? 'Lieferung' : b.art === 'vorort' ? 'Im Laden' : 'Abholung') + ' · bestellt ' + uhr(b.eingang) + ' Uhr', 24, false);
      zeile(b.zeit === 'schnellstmöglich' ? 'So schnell wie möglich' : 'Gewünscht für ' + b.zeit + ' Uhr', 24, false);
    } else {
      zeile('— RESTAURANT —', 22, true, { mitte: true });
      balken(b.art === 'lieferung' ? 'LIEFERUNG' : b.art === 'vorort' ? 'IM LADEN' : 'ABHOLUNG', 44);
      zeile('Bestellung ' + b.nr.slice(-4), 30, true, { rechts: uhr(b.eingang) + ' Uhr' });
      zeile('Nr. ' + b.nr + ' · ' + datum(b.eingang), 20, false);
      y += 4;
      zeile(zeitText, 38, true, { mitte: true });
    }
    linie(true);

    // Positionen
    var gross = kunde ? 26 : 30, klein = kunde ? 22 : 24;
    (b.positionen || []).forEach(function (p) {
      var name = p.menge + '× ' + p.name + (p.groesse ? ' (' + p.groesse + ')' : '');
      var kz = b.mwst ? ' ' + (KENNZ[p.mwst] || 'A') : '';
      zeile(name, gross, true, { rechts: euro(p.stueck * p.menge) + kz });
      (p.optionen || []).forEach(function (o) { zeile('+ ' + o, klein, false, { einzug: 34 }); });
      if (p.notiz) zeile('» ' + p.notiz, klein, true, { einzug: 34 });
      y += 6;
    });
    linie();

    zeile('Zwischensumme', 24, false, { rechts: euro(b.zwischensumme) });
    if (b.rabatt) zeile(b.rabatt.titel, 24, false, { rechts: '−' + euro(b.rabatt.betrag) });
    if (b.art === 'lieferung') zeile('Liefergebühr', 24, false, { rechts: b.liefergebuehr ? euro(b.liefergebuehr) : 'gratis' });
    zeile('GESAMT', 36, true, { rechts: euro(b.gesamt) });
    if (kunde && b.mwst && b.mwst.length) {
      y += 4;
      tabelle(['Satz', 'Netto', 'MwSt.', 'Brutto'], 20, true);
      var summe = 0;
      b.mwst.forEach(function (m) {
        summe += m.steuer;
        tabelle([(m.satz === 19 ? 'B ' : 'A ') + m.satz + ' %', euro(m.netto), euro(m.steuer), euro(m.brutto)], 22, false);
      });
      zeile('Summe MwSt.', 22, true, { rechts: euro(summe) });
      zeile('A = 7 % (Speisen) · B = 19 % (Getränke)', 18, false);
    } else {
      (b.mwst || []).forEach(function (m) {
        zeile('darin ' + m.satz + ' % MwSt. (netto ' + euro(m.netto) + ')', 20, false, { rechts: euro(m.steuer) });
      });
    }
    y += 6;

    if (kunde) {
      zeile(b.zahlung === 'online' ? 'Bezahlt: online' : b.zahlung === 'karte' ? 'Zahlung: mit Karte bei Übergabe' : 'Zahlung: bar bei Übergabe', 26, true);
      y += 6;
      zeile(b.name, 26, false);
      if (b.telefon) zeile('Tel. ' + b.telefon, 24, false);
      if (b.art === 'lieferung') {
        if (b.firma) zeile(b.firma, 24, false);
        zeile((b.strasse + ' ' + b.hausnr).trim() + ', ' + (b.plz + ' ' + b.ort).trim() + (b.etage ? ' · ' + b.etage : ''), 24, false);
      }
      if (b.bemerkung) { y += 4; zeile('Bemerkung: ' + b.bemerkung, 24, true); }
      linie();
      zeile('Danke für deine Bestellung!', 30, true, { mitte: true });
      zeile('Guten Appetit · neusser-doner-pizza.de', 22, false, { mitte: true });
      y += 6;
      zeile(STEUER, 18, false, { mitte: true });
      zeile('Bestellbeleg – kein Kassenbon', 18, false, { mitte: true });
    } else {
      balken(b.zahlung === 'test' ? 'TESTDRUCK – NICHT ZUBEREITEN' : b.zahlung === 'online' ? 'BEZAHLT (ONLINE)' : b.zahlung === 'karte' ? 'KARTE – ' + euro(b.gesamt) : 'BAR KASSIEREN – ' + euro(b.gesamt), 32);
      zeile(b.name, 32, true);
      if (b.telefon) zeile('Tel. ' + b.telefon, 30, true);
      if (b.art === 'lieferung') {
        if (b.firma) zeile(b.firma, 28, false);
        zeile((b.strasse + ' ' + b.hausnr).trim(), 32, true);
        zeile((b.plz + ' ' + b.ort).trim() + (b.etage ? ' · ' + b.etage : ''), 28, false);
      }
      if (b.bemerkung) { y += 6; zeile('Bemerkung: ' + b.bemerkung, 26, true); }
      if (b.notiz) zeile(b.notiz, 22, false);
    }
    linie();
    zeile('Rheinland Bestellsystem · rheinlanddigitalwerk.de', 18, false, { mitte: true });
    y += 10;

    // auf die genutzte Höhe zuschneiden (durch 8 teilbar)
    var h = Math.ceil(y / 8) * 8;
    var fertig = document.createElement('canvas');
    fertig.width = BREITE;
    fertig.height = h;
    fertig.getContext('2d').drawImage(c, 0, 0);
    fertig.logoBis = logoBis || 0;
    return fertig;
  }

  // ---------- In Druckdaten umwandeln ----------
  // Schwarz-Weiß-Rasterbild: je Zeile 72 Bytes, höchstes Bit links, 1 = schwarz.
  // Das Logo wird gerastert (Floyd-Steinberg), Schrift nur mit Schwelle – so bleibt sie scharf.
  function raster(c, von, bis) {
    var w = c.width, h = bis - von;
    var px = c.getContext('2d').getImageData(0, von, w, h).data;
    var grau = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) grau[i] = px[i * 4] * .299 + px[i * 4 + 1] * .587 + px[i * 4 + 2] * .114;
    var bytes = new Uint8Array(w / 8 * h);
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < w; xx++) {
        var j = yy * w + xx, alt = grau[j];
        if (von + yy >= c.logoBis) {
          if (alt < 160) bytes[yy * w / 8 + (xx >> 3)] |= 0x80 >> (xx & 7);
          continue;
        }
        var neu = alt < 128 ? 0 : 255, f = alt - neu;
        if (neu === 0) bytes[yy * w / 8 + (xx >> 3)] |= 0x80 >> (xx & 7);
        if (xx + 1 < w) grau[j + 1] += f * 7 / 16;
        if (yy + 1 < h) {
          if (xx > 0) grau[j + w - 1] += f * 3 / 16;
          grau[j + w] += f * 5 / 16;
          if (xx + 1 < w) grau[j + w + 1] += f / 16;
        }
      }
    }
    return bytes;
  }
  function base64(bytes) {
    var s = '';
    for (var k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
    return btoa(s);
  }

  function epos(bilder) {
    var alles = '';
    bilder.forEach(function (c) {
      for (var von = 0; von < c.height; von += 400) {        // in Streifen, damit der Druckerpuffer reicht
        var bis = Math.min(c.height, von + 400);
        alles += '<image width="' + c.width + '" height="' + (bis - von) + '" color="color_1" mode="mono">' + base64(raster(c, von, bis)) + '</image>';
      }
      alles += '<feed line="3"/><cut type="feed"/>';
    });
    return '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
      '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">' + alles + '</epos-print></s:Body></s:Envelope>';
  }

  // ---------- Bluetooth: dieselben Bilder als ESC/POS-Rasterdaten über Web Serial (Chrome, Drucker vorher koppeln) ----------
  var SPP = '00001101-0000-1000-8000-00805f9b34fb';   // Bluetooth „Serial Port Profile“
  function escpos(bilder) {
    var teile = [new Uint8Array([0x1B, 0x40])];      // ESC @ – Drucker zurücksetzen
    bilder.forEach(function (c) {
      var wb = c.width / 8;
      for (var von = 0; von < c.height; von += 48) {     // kleine Streifen: geht etwas verloren, trifft es nur einen Streifen
        var bis = Math.min(c.height, von + 48), h = bis - von;
        teile.push(new Uint8Array([0x1D, 0x76, 0x30, 0x00, wb & 255, wb >> 8, h & 255, h >> 8]));   // GS v 0
        teile.push(raster(c, von, bis));
      }
      teile.push(new Uint8Array([0x1B, 0x64, 0x03, 0x1D, 0x56, 0x42, 0x00]));   // 3 Zeilen vorschieben, abschneiden
    });
    return teile;
  }
  function btPort() {
    if (!('serial' in navigator)) return Promise.reject(new Error('Bluetooth-Druck geht nur in Chrome auf Android (ab Version 138). Bitte Chrome aktualisieren.'));
    return navigator.serial.getPorts().then(function (ports) {
      var p = ports.filter(function (x) { return (x.getInfo().bluetoothServiceClassId || '') === SPP; })[0] || ports[0];
      if (!p) throw new Error('Kein Bluetooth-Drucker gewählt. Einstellungen → „Bluetooth-Drucker wählen“.');
      return p;
    });
  }
  function btSenden(teile) {
    var port, schreiber;
    return btPort().then(function (p) {
      port = p;
      return port.open({ baudRate: 115200 }).catch(function (e) {
        if (!(port.readable || port.writable)) throw e;     // schon offen → weiter
      });
    }).then(function () {
      schreiber = port.writable.getWriter();
      // Bluetooth ist langsamer als der Drucker-Puffer erwartet („receive buffer full“): kleine Stücke mit kurzer Pause
      var STUECK = 256, PAUSE = 18;
      var warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var kette = Promise.resolve();
      teile.forEach(function (t) {
        for (var i = 0; i < t.length; i += STUECK) {
          (function (stueck) {
            kette = kette.then(function () { return schreiber.ready; })
              .then(function () { return schreiber.write(stueck); })
              .then(function () { return warte(PAUSE); });
          })(t.subarray(i, i + STUECK));
        }
      });
      return kette.then(function () { return warte(400); });   // Rest im Funk-Puffer ankommen lassen, dann schließen
    }).then(function () {
      return schreiber.close();
    }).then(function () {
      return port.close();
    }, function (err) {
      try { if (schreiber) schreiber.releaseLock(); } catch (e) { /* egal */ }
      if (port) port.close().catch(function () {});
      throw new Error('Bluetooth-Drucker nicht erreichbar: ' + (err && err.message ? err.message : err) +
        '. Ist der Drucker an, mit dem Tablet gekoppelt und nicht mit einem anderen Gerät verbunden?');
    });
  }

  var FEHLER = {
    EPTR_COVER_OPEN: 'Deckel vom Drucker ist offen.',
    EPTR_REC_EMPTY: 'Kein Papier im Drucker.',
    EPTR_CUTTER: 'Problem mit dem Papierschneider.',
    EPTR_MECHANICAL: 'Mechanischer Fehler im Drucker.',
    EPTR_AUTOMATICAL: 'Drucker meldet einen Fehler – kurz aus- und einschalten.',
    EX_TIMEOUT: 'Drucker antwortet nicht rechtzeitig.',
    DeviceNotFound: 'Drucker nicht gefunden.',
    SchemaError: 'Druckdaten fehlerhaft.'
  };

  function senden(xml, cfg) {
    var url = (cfg.https === false ? 'http' : 'https') + '://' + cfg.ip + '/cgi-bin/epos/service.cgi?devid=local_printer&timeout=15000';
    var abbruch = new AbortController();
    var uhrwerk = setTimeout(function () { abbruch.abort(); }, 20000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT', SOAPAction: '""' },
      body: xml,
      signal: abbruch.signal
    }).then(function (r) { return r.text(); }, function () {
      clearTimeout(uhrwerk);
      throw new Error('Drucker nicht erreichbar (' + cfg.ip + '). Prüfen: 1) Tablet im selben WLAN wie der Drucker? ' +
        '2) Einstellungen → „Drucker freischalten“ antippen und die Warnung bestätigen. ' +
        '3) Chrome fragt „Zugriff auf Geräte im lokalen Netzwerk“ → Zulassen (sonst Schloss-Symbol → Berechtigungen).');
    }).then(function (t) {
      clearTimeout(uhrwerk);
      var ok = /success="true"/.test(t);
      if (!ok) {
        var code = (t.match(/code="([^"]*)"/) || [])[1] || '';
        throw new Error(FEHLER[code] || ('Drucker meldet: ' + (code || 'unbekannter Fehler')));
      }
      return true;
    });
  }

  window.Bon = {
    zeichnen: zeichnen,
    // arten: ['laden', 'kunde'] – Standard nach Einstellung (nur Kunden-Bon, nur Restaurant oder beide)
    drucken: function (b, cfg, arten) {
      arten = arten || ({ laden: ['laden'], kunde: ['kunde'] }[cfg.belege] || ['laden', 'kunde']);
      var bilder = arten.map(function (a) { return zeichnen(b, a); });
      return cfg.verbindung === 'bluetooth' ? btSenden(escpos(bilder)) : senden(epos(bilder), cfg);
    },
    // Bluetooth-Drucker einmal auswählen (nur gekoppelte Geräte; braucht einen Fingertipp)
    bluetoothWaehlen: function () {
      if (!('serial' in navigator)) return Promise.reject(new Error('Bluetooth-Druck geht nur in Chrome auf Android (ab Version 138). Bitte Chrome aktualisieren.'));
      return navigator.serial.requestPort({ filters: [{ bluetoothServiceClassId: SPP }], allowedBluetoothServiceClassIds: [SPP] });
    },
    pruefen: function (cfg) {   // fragt nur den Status ab, druckt nichts
      if (cfg.verbindung === 'bluetooth') return btPort();
      return senden('<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
        '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"></epos-print></s:Body></s:Envelope>', cfg);
    },
    test: function (cfg) {
      var jetzt = new Date().toISOString();
      return this.drucken({
        nr: 'TEST-' + jetzt.slice(11, 16).replace(':', ''), art: 'abholung', eingang: jetzt, zeit: 'schnellstmöglich',
        positionen: [{ name: 'Testdruck', groesse: '', optionen: ['Umlaute: ä ö ü ß Ä Ö Ü', 'Döner · Größe Ø30cm'], notiz: '', menge: 1, stueck: 0 }],
        zwischensumme: 0, gesamt: 0, liefergebuehr: 0, rabatt: null, zahlung: 'test',
        name: 'Rheinland Bestellsystem', telefon: '–', bemerkung: 'Wenn du das lesen kannst, ist der Drucker richtig eingerichtet.'
      }, cfg, ['laden']);
    }
  };
})();
