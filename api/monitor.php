<?php
// Rheinland Bestellsystem – Schnittstelle für das Tablet im Laden (/bestellsystem/).
//   POST {"aktion":"anmelden","passwort":"…"}            → {"token": "…"}
//   GET  (Kopf X-Token)                                   → {"bestellungen": [...], "jetzt": "…"}   (zählt als Herzschlag)
//   GET  ?tag=JJJJ-MM-TT  oder  ?monat=JJJJ-MM            → {"bestellungen": [...]}   (Archiv)
//   POST {"aktion":"status","nr":"…","status":"…"}       → {"ok": true}
//   POST {"aktion":"gedruckt","nr":"…"}                  → {"ok": true}
//   POST {"aktion":"pause","minuten":15|30|45|60|0|null} → {"pause": {...}|null}   (0 = bis wieder geöffnet, null = öffnen)
//   POST {"aktion":"handbon","bon":{…}}                  → {"bon": {...}}   (Bon von Hand, eigene Liste im Archiv)
declare(strict_types=1);
require __DIR__ . '/lib.php';

const STATUS = ['neu', 'angenommen', 'fertig', 'unterwegs', 'erledigt', 'storniert'];

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$d = $methode === 'POST' ? (json_decode((string) file_get_contents('php://input', false, null, 0, 40000), true) ?: []) : [];

if (($d['aktion'] ?? '') === 'anmelden') {
    $pw = (string) (geheim()['monitor_passwort'] ?? '');
    if ($pw === '') {
        antwort(['fehler' => 'Das Bestellsystem ist noch nicht eingerichtet (Passwort fehlt).'], 503);
    }
    bremse('anmelden', 8, 900, false);
    if (!hash_equals($pw, trim((string) ($d['passwort'] ?? '')))) {
        sleep(2);   // Raten bremsen
        bremse('anmelden', 8, 900);
        sicherheit('anmelden-falsch');
        // viele Fehlversuche in der letzten Stunde (egal von wo) → E-Mail an den Laden
        $log = ordner() . '/.sicherheit.log';
        clearstatcache();
        $grenze = jetzt()->modify('-1 hour')->format('Y-m-d H:i:s');
        $falsch = 0;
        foreach (explode("\n", (string) file_get_contents($log, false, null, max(0, filesize($log) - 20000))) as $z) {
            if (str_contains($z, "\tanmelden-falsch\t") && substr($z, 0, 19) >= $grenze) $falsch++;
        }
        if ($falsch >= 10) {
            warnen('Anmeldung', "Am Bestellsystem (Tablet-Seite) gab es in der letzten Stunde $falsch falsche Passwort-Versuche.\n"
                . "Wenn das nicht ihr wart: Passwort in GitHub (Secret MONITOR_PASSWORT) ändern und neu hochladen lassen.");
        }
        antwort(['fehler' => 'Falsches Passwort.'], 401);
    }
    sicherheit('anmelden-ok');
    antwort(['token' => monitor_token()]);
}

monitor_pruefen();
$o = ordner();

if ($methode === 'GET' && (isset($_GET['tag']) || isset($_GET['monat']))) {
    // Archiv: alle Bestellungen eines Tages (JJJJ-MM-TT) oder Monats (JJJJ-MM) – die Nummer beginnt mit dem Datum
    $tag = (string) ($_GET['tag'] ?? '');
    $monat = (string) ($_GET['monat'] ?? '');
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $tag, $m)) {
        $muster = substr($m[1], 2) . $m[2] . $m[3] . '-*.json';
    } elseif (preg_match('/^(\d{4})-(\d{2})$/', $monat, $m)) {
        $muster = substr($m[1], 2) . $m[2] . '??-*.json';
    } else {
        antwort(['fehler' => 'Ungültiges Datum.'], 400);
    }
    // W… = Bestellungen von der Website, H… = Bons von Hand (eigene Liste)
    $lesen = function (string $praefix) use ($o, $muster): array {
        $liste = [];
        foreach (glob($o . '/' . $praefix . $muster) ?: [] as $f) {
            $b = json_decode((string) file_get_contents($f), true);
            if (!$b) continue;
            unset($b['stripe_session'], $b['bezahlt']['session']);
            $liste[] = $b;
        }
        usort($liste, fn ($a, $b) => strcmp($a['eingang'], $b['eingang']));
        return $liste;
    };
    antwort(['bestellungen' => $lesen('W'), 'handbons' => $lesen('H')]);
}

if ($methode === 'GET') {
    touch($o . '/.herzschlag');
    // Bestellungen der letzten 36 Stunden, neueste zuerst
    $grenze = time() - 36 * 3600;
    $liste = [];
    foreach (glob($o . '/W*.json') ?: [] as $f) {
        if (filemtime($f) < $grenze) continue;
        $b = json_decode((string) file_get_contents($f), true);
        if (!$b || strtotime($b['eingang'] ?? '') < $grenze) continue;
        unset($b['stripe_session'], $b['bezahlt']['session']);
        $liste[] = $b;
    }
    usort($liste, fn ($a, $b) => strcmp($b['eingang'], $a['eingang']));
    antwort(['bestellungen' => $liste, 'jetzt' => jetzt()->format('c'), 'pause' => pause_status()]);
}

if (($d['aktion'] ?? '') === 'pause') {
    $min = $d['minuten'] ?? null;
    if ($min !== null && !in_array($min, [0, 15, 30, 45, 60, 90, 120], true)) {
        antwort(['fehler' => 'Ungültige Dauer.'], 422);
    }
    $p = pause_setzen($min);
    sicherheit($p ? 'pause-an' : 'pause-aus', $min === null ? '' : (string) $min);
    antwort(['pause' => $p]);
}

if (($d['aktion'] ?? '') === 'handbon') {
    // Bon von Hand (Telefon / Gast im Laden): Preise tippt der Inhaber selbst – Summen und MwSt. rechnet trotzdem der Server.
    bremse('handbon', 300, 3600);
    $h = $d['bon'] ?? null;
    $text = fn ($v, int $max) => mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v)), 0, $max);
    $kaputt = fn () => antwort(['fehler' => 'Bon unvollständig – bitte prüfen.'], 422);
    if (!is_array($h)) $kaputt();
    $art = (string) ($h['art'] ?? '');
    $zahlung = (string) ($h['zahlung'] ?? '');
    if (!in_array($art, ['abholung', 'lieferung', 'vorort'], true) || !in_array($zahlung, ['bar', 'karte'], true)) $kaputt();
    $pos = $h['positionen'] ?? null;
    if (!is_array($pos) || count($pos) < 1 || count($pos) > 60) $kaputt();
    $zeilen = [];
    $zw = 0.0;
    $b19 = 0.0;
    foreach ($pos as $p) {
        if (!is_array($p)) $kaputt();
        $name = $text($p['name'] ?? '', 60);
        $menge = (int) ($p['menge'] ?? 0);
        $stueck = round((float) ($p['stueck'] ?? -1), 2);
        $a19 = min(1.0, max(0.0, (float) ($p['anteil19'] ?? 0)));
        if ($name === '' || $menge < 1 || $menge > 50 || $stueck < 0 || $stueck > 999) $kaputt();
        $zw += $stueck * $menge;
        $b19 += $stueck * $menge * $a19;
        $zeilen[] = ['name' => $name, 'groesse' => $text($p['groesse'] ?? '', 20), 'optionen' => [], 'notiz' => '',
                     'menge' => $menge, 'stueck' => $stueck, 'anteil19' => round($a19, 4),
                     'mwst' => $a19 <= 0 ? 7 : ($a19 >= 1 ? 19 : 'gemischt')];
    }
    $zw = round($zw, 2);
    $liefer = $art === 'lieferung' ? round(min(50.0, max(0.0, (float) ($h['liefergebuehr'] ?? 0))), 2) : 0.0;
    $gesamt = round($zw + $liefer, 2);
    $n = jetzt();
    do {
        $hnr = 'H' . $n->format('ymd-Hi') . '-' . strtoupper(bin2hex(random_bytes(2)));
    } while (is_file($o . '/' . $hnr . '.json'));
    $plz = $text($h['plz'] ?? '', 5);
    $b = ['nr' => $hnr, 'hand' => true, 'art' => $art, 'zahlung' => $zahlung, 'status' => 'erledigt',
          'eingang' => $n->format('c'), 'zeit' => 'schnellstmöglich',
          'name' => $text($h['name'] ?? '', 80), 'telefon' => $text($h['telefon'] ?? '', 25), 'email' => '', 'firma' => '', 'etage' => '',
          'strasse' => $art === 'lieferung' ? $text($h['strasse'] ?? '', 90) : '', 'hausnr' => '',
          'plz' => $art === 'lieferung' && preg_match('/^\d{5}$/', $plz) ? $plz : '',
          'ort' => $art === 'lieferung' ? $text($h['ort'] ?? '', 60) : '',
          'bemerkung' => $text($h['bemerkung'] ?? '', 200),
          'positionen' => $zeilen, 'zwischensumme' => $zw, 'rabatt' => null, 'liefergebuehr' => $liefer, 'gesamt' => $gesamt,
          'mwst' => mwst_aufteilen($gesamt, $zw, $b19)];
    $fh = fopen($o . '/' . $hnr . '.json', 'x');      // nie eine vorhandene Datei überschreiben
    if (!$fh) antwort(['fehler' => 'Bon konnte nicht gespeichert werden.'], 500);
    fwrite($fh, json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fclose($fh);
    antwort(['bon' => $b]);
}

$nr = (string) ($d['nr'] ?? '');
$f = $o . '/' . $nr . '.json';
if (!nr_ok($nr) || !is_file($f)) {
    antwort(['fehler' => 'Bestellung nicht gefunden.'], 404);
}
$lock = fopen($o . '/.sperre', 'c');
flock($lock, LOCK_EX);
$b = json_decode((string) file_get_contents($f), true);
switch ($d['aktion'] ?? '') {
    case 'status':
        if (!in_array($d['status'] ?? '', STATUS, true)) {
            antwort(['fehler' => 'Unbekannter Status.'], 422);
        }
        $b['status'] = $d['status'];
        $b['verlauf'][] = [$d['status'], jetzt()->format('c')];
        break;
    case 'gedruckt':
        $b['gedruckt'] = jetzt()->format('c');
        break;
    default:
        antwort(['fehler' => 'Unbekannte Aktion.'], 400);
}
file_put_contents($f, json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
flock($lock, LOCK_UN);
antwort(['ok' => true]);
