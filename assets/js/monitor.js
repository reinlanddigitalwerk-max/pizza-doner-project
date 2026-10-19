// Bestell-Monitor im Laden: Anmelden, neue Bestellungen live mit Ton, Status ändern, Bon drucken.
(function () {
  var CFG = window.BESTELL_CONFIG || {};
  var root = document.querySelector('[data-monitor]');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };

  if (!CFG.supabaseUrl || !CFG.supabaseKey || !window.supabase) {
    $('[data-hinweis]').hidden = false;
    return;
  }
  var db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  var liste = [];
  var tonAn = false;
  var klingel = null;

  function euro(n) { return Number(n).toFixed(2).replace('.', ',') + ' €'; }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function zeit(iso) { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }); }

  // Ton: drei kurze Töne, alle 6 Sekunden, solange eine Bestellung „neu“ ist
  var audio = null;
  function piep() {
    if (!tonAn) return;
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    [0, .25, .5].forEach(function (t) {
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.type = 'square';
      g.gain.setValueAtTime(.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.3, audio.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t + .2);
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .22);
    });
  }
  function klingeln() {
    var offen = liste.some(function (b) { return b.status === 'neu'; });
    document.title = (offen ? '🔔 NEU – ' : '') + 'Bestellungen';
    root.classList.toggle('has-new', offen);
    if (offen && !klingel) { piep(); klingel = setInterval(piep, 6000); }
    if (!offen && klingel) { clearInterval(klingel); klingel = null; }
  }

  function karte(b) {
    var pos = (b.positionen || []).map(function (p) {
      var det = [p.groesse].concat(p.optionen || []).filter(Boolean).join(', ');
      return '<li><b>' + p.menge + '×</b> ' + esc(p.name) + (det ? ' <small>' + esc(det) + '</small>' : '') +
        (p.notiz ? '<em>„' + esc(p.notiz) + '“</em>' : '') + '<span>' + euro(p.preis * p.menge) + '</span></li>';
    }).join('');
    var adr = b.art === 'lieferung'
      ? esc([b.firma, (b.strasse || '') + ' ' + (b.hausnr || ''), (b.plz || '') + ' ' + (b.ort || ''), b.etage].filter(function (x) { return x && x.trim(); }).join(' · '))
      : 'Abholung im Laden';
    var knoepfe = {
      neu: '<button data-status="angenommen" class="m-btn m-btn--go">Annehmen</button><button data-status="storniert" class="m-btn">Ablehnen</button>',
      angenommen: '<button data-status="fertig" class="m-btn m-btn--go">' + (b.art === 'lieferung' ? 'Unterwegs / fertig' : 'Abgeholt / fertig') + '</button><button data-status="storniert" class="m-btn">Storno</button>',
      fertig: '', storniert: ''
    }[b.status];
    return '<article class="order order--' + b.status + '" data-id="' + b.id + '">' +
      '<header><strong>Nr. ' + b.nr + '</strong><span class="tag tag--' + b.art + '">' + (b.art === 'lieferung' ? 'Lieferung' : 'Abholung') + '</span>' +
      '<span class="order__time">' + zeit(b.erstellt) + ' · ' + esc(b.zeit === 'schnellstmöglich' ? 'sofort' : 'für ' + b.zeit) + '</span></header>' +
      '<p class="order__who"><b>' + esc(b.name) + '</b> · <a href="tel:' + esc(b.telefon) + '">' + esc(b.telefon) + '</a></p>' +
      '<p class="order__adr">' + adr + '</p>' +
      (b.bemerkung ? '<p class="order__note">' + esc(b.bemerkung) + '</p>' : '') +
      '<ul class="order__pos">' + pos + '</ul>' +
      '<p class="order__sum">' + (Number(b.rabatt) ? 'Rabatt −' + euro(b.rabatt) + ' · ' : '') +
      (b.art === 'lieferung' ? 'Lieferung ' + euro(b.liefergebuehr) + ' · ' : '') +
      '<b>' + euro(b.gesamt) + '</b> ' + (b.zahlung === 'bar' ? 'bar' : 'Karte') + '</p>' +
      '<footer>' + knoepfe + '<button data-druck class="m-btn">Bon drucken</button><span class="order__status">' + b.status + '</span></footer></article>';
  }

  function zeichnen() {
    var filter = $('[data-filter]').value;
    var sicht = liste.filter(function (b) { return filter === 'alle' || (filter === 'offen' ? (b.status === 'neu' || b.status === 'angenommen') : b.status === filter); });
    $('[data-liste]').innerHTML = sicht.length ? sicht.map(karte).join('') : '<p class="m-empty">Keine Bestellungen.</p>';
    klingeln();
  }

  function laden() {
    var seit = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    return db.from('bestellungen').select('*').gte('erstellt', seit).order('erstellt', { ascending: false }).then(function (r) {
      if (r.error) { $('[data-fehler]').textContent = r.error.message; return; }
      liste = r.data;
      zeichnen();
    });
  }

  function live() {
    db.channel('bestellungen').on('postgres_changes', { event: '*', schema: 'public', table: 'bestellungen' }, function (e) {
      var b = e.new;
      var i = liste.findIndex(function (x) { return x.id === b.id; });
      if (i === -1) liste.unshift(b); else liste[i] = b;
      zeichnen();
    }).subscribe();
    // Falls die Verbindung einmal abreißt: jede Minute neu laden
    setInterval(laden, 60000);
  }

  function drucken(b) {
    var bon = document.querySelector('[data-bon]');
    bon.innerHTML = '<h1>Neusser Döner &amp; Pizza</h1><p>Nr. ' + b.nr + ' · ' + zeit(b.erstellt) + '</p><h2>' +
      (b.art === 'lieferung' ? 'LIEFERUNG' : 'ABHOLUNG') + ' · ' + esc(b.zeit) + '</h2>' +
      '<p>' + esc(b.name) + '<br>' + esc(b.telefon) + (b.art === 'lieferung' ? '<br>' + esc((b.firma ? b.firma + ', ' : '') + b.strasse + ' ' + b.hausnr) +
      '<br>' + esc(b.plz + ' ' + b.ort) + (b.etage ? '<br>' + esc(b.etage) : '') : '') + '</p>' +
      (b.bemerkung ? '<p><b>Bemerkung:</b> ' + esc(b.bemerkung) + '</p>' : '') +
      '<table>' + (b.positionen || []).map(function (p) {
        var det = [p.groesse].concat(p.optionen || []).filter(Boolean).join(', ');
        return '<tr><td>' + p.menge + '×</td><td>' + esc(p.name) + (det ? '<br><small>' + esc(det) + '</small>' : '') +
          (p.notiz ? '<br><small>„' + esc(p.notiz) + '“</small>' : '') + '</td><td>' + euro(p.preis * p.menge) + '</td></tr>';
      }).join('') + '</table>' +
      '<p>Zwischensumme ' + euro(b.zwischensumme) + (Number(b.rabatt) ? '<br>Rabatt −' + euro(b.rabatt) : '') +
      (b.art === 'lieferung' ? '<br>Lieferung ' + euro(b.liefergebuehr) : '') + '</p><h2>Gesamt ' + euro(b.gesamt) + ' (' + (b.zahlung === 'bar' ? 'bar' : 'Karte') + ')</h2>';
    window.print();
  }

  $('[data-liste]').addEventListener('click', function (e) {
    var art = e.target.closest('.order');
    if (!art) return;
    var b = liste.find(function (x) { return x.id === art.dataset.id; });
    var s = e.target.closest('[data-status]');
    if (s) {
      if (s.dataset.status === 'storniert' && !confirm('Bestellung Nr. ' + b.nr + ' wirklich ablehnen/stornieren?')) return;
      db.from('bestellungen').update({ status: s.dataset.status }).eq('id', b.id).then(function (r) {
        if (r.error) alert(r.error.message);
        else { b.status = s.dataset.status; zeichnen(); if (s.dataset.status === 'angenommen' && $('[data-autodruck]').checked) drucken(b); }
      });
    }
    if (e.target.closest('[data-druck]')) drucken(b);
  });
  $('[data-filter]').addEventListener('change', zeichnen);
  $('[data-ton]').addEventListener('click', function () {
    tonAn = !tonAn;
    this.setAttribute('aria-pressed', tonAn);
    this.textContent = tonAn ? '🔔 Ton an' : '🔕 Ton aus – hier tippen';
    if (tonAn) { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); piep(); }
  });

  function start(session) {
    $('[data-login]').hidden = !!session;
    $('[data-board]').hidden = !session;
    if (session) { laden().then(live); }
  }
  $('[data-login]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    $('[data-fehler]').textContent = '';
    db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.passwort.value }).then(function (r) {
      if (r.error) $('[data-fehler]').textContent = 'Anmeldung fehlgeschlagen: ' + r.error.message;
      else start(r.data.session);
    });
  });
  $('[data-abmelden]').addEventListener('click', function () { db.auth.signOut().then(function () { location.reload(); }); });
  db.auth.getSession().then(function (r) { start(r.data.session); });
})();
