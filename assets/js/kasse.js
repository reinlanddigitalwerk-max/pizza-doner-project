// Kasse: Formular wie auf der alten Bestellseite, Zusammenfassung rechts.
// „Jetzt online bezahlen“ (nur wenn api/checkout.php eingerichtet ist): weiter zu Stripe, danach zurück mit ?bezahlt=…
// Bar oder Karte bei Übergabe: an das Rheinland Bestellsystem im Laden (api/bestellen.php), wenn das Tablet an ist –
// sonst als fertige WhatsApp-Nachricht an den Laden.
(function () {
  var W = window.Warenkorb;
  var SHOP = window.SHOP;
  var box = document.querySelector('[data-kasse]');
  if (!W || !box) return;

  var form = box.querySelector('form');
  var euro = W.euro;
  var MERK = 'neusser-kunde-v1';
  var mitSystem = false;   // Tablet im Laden ist an (meldet api/checkout.php)

  W.binden(box.querySelector('[data-warenkorb]'), { bearbeiten: false, modus: false, kasse: false });

  // PLZ-Auswahl aus den Liefergebieten
  form.plz.innerHTML = '<option value="">Bitte wählen</option>' + SHOP.zonen.map(function (z) {
    return '<option value="' + W.esc(z.plz) + '">' + W.esc(z.plz + (z.gebiet ? ' – ' + z.gebiet : '')) + '</option>';
  }).join('');

  // Gemerkte Daten vom letzten Mal
  try {
    var alt = JSON.parse(localStorage.getItem(MERK)) || {};
    ['name', 'telefon', 'email', 'firma', 'strasse', 'hausnr', 'etage'].forEach(function (k) { if (alt[k]) form[k].value = alt[k]; });
    if (alt.name) form.merken.checked = true;
  } catch (e) { /* nichts gemerkt */ }

  function zahlungAnzeigen() {
    var online = form.zahlung.value === 'online';
    form.querySelector('.checkout__submit').textContent = online ? 'Zahlungspflichtig bestellen'
      : mitSystem ? 'Kostenpflichtig bestellen' : 'Per WhatsApp bestellen';
    box.querySelector('[data-online-hinweis]').hidden = !online;
    box.querySelector('[data-wa-hinweis]').hidden = online || mitSystem;
  }
  zahlungAnzeigen();

  // Online-Zahlung nur anbieten, wenn der Server dafür eingerichtet ist
  fetch('api/checkout.php', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
    mitSystem = !!j.system;
    if (j.aktiv) {
      box.querySelector('[data-online]').hidden = false;
      form.zahlung.value = 'online';
    }
    zahlungAnzeigen();
  }).catch(function () { /* kein PHP (z. B. GitHub Pages) – dann eben bar oder Karte bei Übergabe */ });

  function aktualisieren() {
    var s = W.get();
    form.art.value = s.modus;
    form.plz.value = s.plz;
    var z = W.zone();
    form.ort.value = z ? z.ort : '';
    box.querySelectorAll('[data-nur="lieferung"]').forEach(function (el) { el.hidden = s.modus !== 'lieferung'; });
    box.querySelector('[data-art-hinweis]').textContent = s.modus === 'lieferung'
      ? 'Wir liefern in ca. ' + SHOP.lieferungMin + ' Minuten.'
      : 'Abholung in der Further Straße 46, 41462 Neuss – fertig in ca. ' + SHOP.abholungMin + ' Minuten.';
    box.querySelector('[data-zeit-label]').textContent = (s.modus === 'lieferung' ? 'Liefertermin' : 'Abholzeit') + ' *';

    var alteZeit = form.zeit.value;
    var zeiten = W.zeiten(s.modus);
    form.zeit.innerHTML = zeiten.map(function (z) { return '<option value="' + z.wert + '">' + z.text + '</option>'; }).join('');
    if (zeiten.some(function (z) { return z.wert === alteZeit; })) form.zeit.value = alteZeit;

    var zu = box.querySelector('[data-geschlossen]');
    zu.hidden = zeiten.length > 0;
    zu.textContent = (s.modus === 'lieferung' ? 'Heute ist keine Lieferung mehr möglich. Lieferung wieder ' : 'Heute ist keine Abholung mehr möglich. Wieder geöffnet ') + W.oeffnungText(s.modus) + '.';

  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'art') W.modus(e.target.value);
    if (e.target.name === 'plz') W.plz(e.target.value);
    if (e.target.name === 'zahlung') zahlungAnzeigen();
  });
  W.on(aktualisieren);
  aktualisieren();

  function fehler(html) {
    var el = form.querySelector('.co-error');
    el.innerHTML = html;
    el.hidden = !html;
    if (html) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function pruefen() {
    var s = W.get();
    var sm = W.summen();
    var fehlt = [];
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    function pflicht(name, ok) {
      if (!ok) { fehlt.push(name); form[name].setAttribute('aria-invalid', 'true'); }
    }
    pflicht('name', form.name.value.trim().length >= 2);
    pflicht('telefon', /^[0-9 +()\/-]{6,25}$/.test(form.telefon.value.trim()));
    if (form.email.value.trim()) pflicht('email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.value.trim()));
    if (s.modus === 'lieferung') {
      pflicht('strasse', form.strasse.value.trim().length >= 3);
      pflicht('hausnr', form.hausnr.value.trim().length >= 1);
      pflicht('plz', !!W.zone());
    }
    pflicht('zeit', !!form.zeit.value);
    if (!sm.anzahl) return 'Dein Warenkorb ist leer. <a href="speisekarte.html">Zur Speisekarte</a>';
    if (sm.grund === 'min') return 'Noch ' + euro(sm.fehlt) + ' bis zum Mindestbestellwert. <a href="speisekarte.html">Noch etwas aussuchen</a>';
    if (sm.grund === 'zu') return 'Gerade nehmen wir keine Bestellungen an.';
    if (fehlt.length) return 'Bitte die rot markierten Felder ausfüllen.';
    if (!form.datenschutz.checked) return 'Bitte der Datenschutzerklärung zustimmen.';
    return '';
  }

  function daten() {
    var s = W.get();
    var sm = W.summen();
    var lief = s.modus === 'lieferung';
    return {
      art: s.modus,
      name: form.name.value.trim(),
      telefon: form.telefon.value.trim(),
      email: form.email.value.trim() || null,
      firma: lief ? form.firma.value.trim() || null : null,
      strasse: lief ? form.strasse.value.trim() : null,
      hausnr: lief ? form.hausnr.value.trim() : null,
      plz: lief ? s.plz : null,
      ort: lief ? form.ort.value : null,
      etage: lief ? form.etage.value || null : null,
      zeit: form.zeit.value,
      zahlung: form.zahlung.value,
      bemerkung: form.bemerkung.value.trim() || null,
      positionen: s.pos.map(function (p) {
        return { id: p.id, name: p.name, groesse: p.groesse || null, optionen: p.optionen || [], wahl: p.wahl || null, notiz: p.notiz || null, menge: p.menge, preis: p.preis };
      }),
      zwischensumme: sm.zw,
      rabatt: sm.rabatt ? sm.rabatt.betrag : 0,
      liefergebuehr: sm.liefer,
      gesamt: sm.gesamt
    };
  }

  function whatsappText(d) {
    var z = [];
    z.push('*Neue Bestellung – ' + (d.art === 'lieferung' ? 'LIEFERUNG' : 'ABHOLUNG') + '*');
    z.push('Zeit: ' + d.zeit);
    z.push('');
    d.positionen.forEach(function (p) {
      var det = [p.groesse].concat(p.optionen).filter(Boolean).join(', ');
      z.push(p.menge + '× ' + p.name + (det ? ' (' + det + ')' : '') + ' – ' + euro(p.preis * p.menge));
      if (p.notiz) z.push('   Wunsch: ' + p.notiz);
    });
    z.push('');
    z.push('Zwischensumme: ' + euro(d.zwischensumme));
    if (d.rabatt) z.push('Rabatt: −' + euro(d.rabatt));
    if (d.art === 'lieferung') z.push('Liefergebühr: ' + (d.liefergebuehr ? euro(d.liefergebuehr) : 'gratis'));
    z.push('*Gesamt: ' + euro(d.gesamt) + '* (' + (d.zahlung === 'bar' ? 'bar' : 'mit Karte') + ')');
    z.push('');
    z.push(d.name + ', Tel. ' + d.telefon);
    if (d.art === 'lieferung') {
      if (d.firma) z.push(d.firma);
      z.push(d.strasse + ' ' + d.hausnr + ', ' + d.plz + ' ' + d.ort + (d.etage ? ', ' + d.etage : ''));
    }
    if (d.bemerkung) z.push('Bemerkung: ' + d.bemerkung);
    return z.join('\n');
  }

  function merken() {
    try {
      if (form.merken.checked) {
        var m = {};
        ['name', 'telefon', 'email', 'firma', 'strasse', 'hausnr', 'etage'].forEach(function (k) { m[k] = form[k].value.trim(); });
        localStorage.setItem(MERK, JSON.stringify(m));
      } else {
        localStorage.removeItem(MERK);
      }
    } catch (e) { /* egal */ }
  }

  function fertig(titel, text) {
    box.hidden = true;
    var f = document.querySelector('[data-fertig]');
    f.querySelector('[data-fertig-titel]').textContent = titel;
    f.querySelector('[data-fertig-text]').innerHTML = text;
    f.hidden = false;
    window.scrollTo({ top: 0 });
  }

  // Zurück von der Bezahlseite
  var such = new URLSearchParams(location.search);
  if (such.get('abgebrochen')) {
    history.replaceState(null, '', location.pathname);
    fehler('Die Zahlung wurde abgebrochen – es wurde nichts abgebucht. Du kannst es noch einmal versuchen oder bei Übergabe bezahlen.');
  }
  var sitzung = such.get('bezahlt');
  if (sitzung) {
    box.hidden = true;
    var versuche = 0;
    (function nachsehen() {
      fetch('api/status.php?id=' + encodeURIComponent(sitzung), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.bezahlt) {
            if (++versuche < 6) return setTimeout(nachsehen, 2500);
            throw new Error('offen');
          }
          W.leeren();
          history.replaceState(null, '', location.pathname);
          fertig('Danke, bezahlt!', 'Deine Bestellung <strong>#' + W.esc(j.nr.slice(-4)) + '</strong> über <strong>' + euro(j.betrag) + '</strong> ist bezahlt und bei uns angekommen. ' +
            (j.art === 'lieferung' ? 'Wir liefern ' : 'Abholbereit ') + (j.zeit === 'schnellstmöglich'
              ? 'in ca. ' + (j.art === 'lieferung' ? SHOP.lieferungMin : SHOP.abholungMin) + ' Minuten.'
              : 'um ' + W.esc(j.zeit) + ' Uhr.') +
            ' Bei Fragen: <a href="tel:' + SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
        })
        .catch(function () {
          fertig('Zahlung wird noch geprüft', 'Wir konnten die Zahlung noch nicht bestätigen. Wenn Geld abgebucht wurde, ist die Bestellung bei uns – ' +
            'sonst ruf uns bitte kurz an: <a href="tel:' + SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
        });
    })();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = pruefen();
    fehler(f);
    if (f) return;
    var d = daten();
    merken();
    var knopf = form.querySelector('.checkout__submit');

    if (d.zahlung === 'online') {
      knopf.disabled = true;
      knopf.textContent = 'Bezahlseite wird geöffnet …';
      fetch('api/checkout.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.url) throw new Error(j.fehler || 'Fehler'); return j; }); })
        .then(function (j) { window.location.href = j.url; })
        .catch(function (err) {
          knopf.disabled = false;
          zahlungAnzeigen();
          fehler(W.esc(err.message) + ' Bei Fragen: <a href="tel:' + SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
        });
      return;
    }

    if (!mitSystem) {
      window.open('https://wa.me/' + SHOP.whatsapp + '?text=' + encodeURIComponent(whatsappText(d)), '_blank', 'noopener');
      fertig('Fast geschafft!', 'WhatsApp ist mit deiner Bestellung geöffnet. Bitte tippe dort auf <strong>Senden</strong> – erst dann ist sie bei uns. ' +
        'Kein WhatsApp? Ruf uns an: <a href="tel:' + SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
      return;
    }

    knopf.disabled = true;
    knopf.textContent = 'Wird gesendet …';
    fetch('api/bestellen.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) {
        return r.json().then(function (j) { if (!r.ok || !j.nr) throw new Error(j.fehler || 'Fehler'); return j; });
      }).then(function (j) {
      W.leeren();
      fertig('Danke, ' + d.name.split(' ')[0] + '!', 'Deine Bestellung <strong>#' + W.esc(j.nr.slice(-4)) + '</strong> über <strong>' + euro(j.gesamt) +
        '</strong> ist bei uns angekommen. ' +
        (d.art === 'lieferung' ? 'Wir liefern ' : 'Abholbereit ') + (d.zeit === 'schnellstmöglich'
          ? 'in ca. ' + (d.art === 'lieferung' ? SHOP.lieferungMin : SHOP.abholungMin) + ' Minuten.'
          : 'um ' + d.zeit + ' Uhr.') +
        ' Bei Fragen: <a href="tel:' + SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
    }).catch(function (err) {
      knopf.disabled = false;
      zahlungAnzeigen();
      fehler(W.esc(err.message) + ' Bitte noch einmal versuchen oder anrufen: <a href="tel:' +
        SHOP.telefonLink + '">' + SHOP.telefon + '</a>.');
    });
  });
})();
