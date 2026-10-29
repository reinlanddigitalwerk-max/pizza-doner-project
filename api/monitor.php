<?php
// Rheinland Bestellsystem – Schnittstelle für das Tablet im Laden (/bestellsystem/).
//   POST {"aktion":"anmelden","passwort":"…"}            → {"token": "…"}
//   GET  (Kopf X-Token)                                   → {"bestellungen": [...], "jetzt": "…"}   (zählt als Herzschlag)
//   POST {"aktion":"status","nr":"…","status":"…"}       → {"ok": true}
//   POST {"aktion":"gedruckt","nr":"…"}                  → {"ok": true}
declare(strict_types=1);
require __DIR__ . '/lib.php';

const STATUS = ['neu', 'angenommen', 'fertig', 'unterwegs', 'erledigt', 'storniert'];

$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$d = $methode === 'POST' ? (json_decode((string) file_get_contents('php://input', false, null, 0, 10000), true) ?: []) : [];

if (($d['aktion'] ?? '') === 'anmelden') {
    $pw = (string) (geheim()['monitor_passwort'] ?? '');
    if ($pw === '') {
        antwort(['fehler' => 'Das Bestellsystem ist noch nicht eingerichtet (Passwort fehlt).'], 503);
    }
    if (!hash_equals($pw, trim((string) ($d['passwort'] ?? '')))) {
        sleep(2);   // Raten bremsen
        antwort(['fehler' => 'Falsches Passwort.'], 401);
    }
    antwort(['token' => monitor_token()]);
}

monitor_pruefen();
$o = ordner();

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
    antwort(['bestellungen' => $liste, 'jetzt' => jetzt()->format('c')]);
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
