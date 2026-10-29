<?php
// Gemeinsame Funktionen für Bestellungen, die Online-Zahlung mit Stripe und das Rheinland Bestellsystem (Tablet im Laden).
// Preise, Liefergebiete, Öffnungszeiten und Rabatte kommen aus den Daten der Website
// (data/menu.json, data/liefergebiete.json, data/angebote.json) – nie aus dem Browser.
declare(strict_types=1);

const BASIS = __DIR__ . '/..';
const ERLAUBTE_HOSTS = ['neusser-doner-pizza.de', 'www.neusser-doner-pizza.de', 'localhost', '127.0.0.1'];
const NICHTSSAGEND = '/^(ohne Wunsch|normal|normale |ohne extra|als Single)/i';   // wie in assets/js/menu.js

function geheim(): array
{
    // wird beim Hochladen aus den GitHub-Secrets erzeugt (siehe .github/workflows/united-domains.yml)
    $datei = __DIR__ . '/geheim.php';
    return is_file($datei) ? (array) require $datei : [];
}

function antwort(array $daten, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lade_json(string $pfad): array
{
    return json_decode((string) file_get_contents(BASIS . '/' . $pfad), true, 512, JSON_THROW_ON_ERROR);
}

// gleich wie slug() in tools/build_pages.py
function slug(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    return trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}

function cent(float $euro): int
{
    return (int) round($euro * 100);
}

function euro(float $n): string
{
    return number_format($n, 2, ',', '.') . ' €';
}

function seite(): string
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    if (!in_array($host, ERLAUBTE_HOSTS, true)) {
        $host = 'neusser-doner-pizza.de';
    }
    $schema = in_array($host, ['localhost', '127.0.0.1'], true) ? 'http' : 'https';
    $port = in_array($host, ['localhost', '127.0.0.1'], true) && isset($_SERVER['SERVER_PORT']) ? ':' . $_SERVER['SERVER_PORT'] : '';
    return $schema . '://' . $host . $port . '/';
}

// ---------- Zeit in Neuss ----------
function jetzt(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone('Europe/Berlin'));
}

function minuten(string $hhmm): int
{
    [$h, $m] = array_map('intval', explode(':', $hhmm));
    return $h * 60 + $m;
}

/** heutiges Zeitfenster [von, bis] in Minuten oder null */
function fenster(array $angebote, string $art, DateTimeImmutable $n): ?array
{
    if (in_array($n->format('Y-m-d'), $angebote['geschlossen'] ?? [], true)) {
        return null;
    }
    $zeiten = $art === 'lieferung' ? ($angebote['lieferzeiten'] ?? []) : ($angebote['oeffnungszeiten'] ?? []);
    $z = $zeiten[$n->format('N')] ?? null;
    return $z ? [minuten($z[0]), minuten($z[1])] : null;
}

// ---------- Warenkorb nachrechnen ----------
function speisekarte(): array
{
    $menu = lade_json('data/menu.json');
    $karte = [];
    foreach ($menu['kategorien'] as $kat) {
        foreach ($kat['artikel'] as $a) {
            if (($a['aktiv'] ?? true) === false) {
                continue;
            }
            $karte[slug($kat['kategorie']) . '--' . slug($a['name'])] = [
                'name' => $a['name'],
                'preis' => $a['preis'] ?? null,
                'preise' => $a['preise'] ?? null,
                'optionen' => array_merge($kat['optionen'] ?? [], $a['optionen'] ?? []),
            ];
        }
    }
    return $karte;
}

function rabatt(array $angebote, float $zw, DateTimeImmutable $n): ?array
{
    $best = null;
    $tag = (int) $n->format('N');
    $min = (int) $n->format('G') * 60 + (int) $n->format('i');
    foreach ($angebote['angebote'] ?? [] as $a) {
        if (($a['typ'] ?? '') !== 'rabatt' || empty($a['aktiv']) || empty($a['prozent'])) continue;
        if (!empty($a['gueltigBis']) && $n->format('Y-m-d') > $a['gueltigBis']) continue;
        if (!empty($a['tage']) && !in_array($tag, $a['tage'], true)) continue;
        if (!empty($a['von']) && $min < minuten($a['von'])) continue;
        if (!empty($a['bis']) && $min >= minuten($a['bis'])) continue;
        if (!empty($a['mindestwert']) && $zw < $a['mindestwert']) continue;
        $betrag = round($zw * $a['prozent'] / 100, 2);
        if (!$best || $betrag > $best['betrag']) {
            $best = ['titel' => $a['prozent'] . ' % ' . ($a['titel'] ?? 'Rabatt'), 'betrag' => $betrag];
        }
    }
    return $best;
}

/**
 * Prüft die Bestellung und rechnet alle Beträge selbst aus.
 * Wirft InvalidArgumentException mit einer Meldung für den Kunden.
 */
function bestellung_pruefen(array $d, ?DateTimeImmutable $n = null): array
{
    $n = $n ?? jetzt();
    $angebote = lade_json('data/angebote.json');
    $gebiete = lade_json('data/liefergebiete.json');
    $karte = speisekarte();
    $fehler = fn (string $m) => throw new InvalidArgumentException($m);

    $art = $d['art'] ?? '';
    if (!in_array($art, ['lieferung', 'abholung'], true)) $fehler('Bitte Lieferung oder Abholung wählen.');
    $name = trim((string) ($d['name'] ?? ''));
    $tel = trim((string) ($d['telefon'] ?? ''));
    if (mb_strlen($name) < 2 || mb_strlen($name) > 80) $fehler('Bitte den Namen angeben.');
    if (!preg_match('~^[0-9 +()/-]{6,25}$~', $tel)) $fehler('Bitte eine gültige Telefonnummer angeben.');
    $email = trim((string) ($d['email'] ?? ''));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $fehler('Die E-Mail-Adresse stimmt nicht.');

    $zone = null;
    if ($art === 'lieferung') {
        foreach ($gebiete['zonen'] as $z) {
            if ($z['plz'] === ($d['plz'] ?? '')) $zone = $z;
        }
        if (!$zone) $fehler('In diese Postleitzahl liefern wir leider nicht.');
        if (mb_strlen(trim((string) ($d['strasse'] ?? ''))) < 3 || trim((string) ($d['hausnr'] ?? '')) === '') {
            $fehler('Bitte Straße und Hausnummer angeben.');
        }
    }

    // Öffnungs- und Lieferzeiten
    $f = fenster($angebote, $art, $n);
    $jetztMin = (int) $n->format('G') * 60 + (int) $n->format('i');
    $zeit = (string) ($d['zeit'] ?? '');
    if (!$f || $jetztMin >= $f[1]) $fehler('Heute nehmen wir dafür keine Bestellungen mehr an.');
    if ($zeit === 'schnellstmöglich') {
        if ($jetztMin < $f[0]) $fehler('Wir haben noch geschlossen – bitte eine Uhrzeit wählen.');
    } elseif (preg_match('/^\d{2}:\d{2}$/', $zeit)) {
        $zm = minuten($zeit);
        if ($zm < $f[0] || $zm > $f[1] || $zm < $jetztMin + 10) $fehler('Diese Uhrzeit ist nicht mehr möglich.');
    } else {
        $fehler('Bitte eine Zeit wählen.');
    }

    // Positionen: Preise aus der Speisekarte, nicht aus dem Browser
    $pos = $d['positionen'] ?? [];
    if (!is_array($pos) || count($pos) < 1 || count($pos) > 60) $fehler('Der Warenkorb ist leer.');
    $zeilen = [];
    $zw = 0.0;
    foreach ($pos as $p) {
        $art_ = $karte[(string) ($p['id'] ?? '')] ?? null;
        if (!$art_) $fehler('Ein Gericht gibt es nicht mehr. Bitte den Warenkorb neu füllen.');
        $menge = (int) ($p['menge'] ?? 0);
        if ($menge < 1 || $menge > 50) $fehler('Ungültige Menge.');
        $groesse = (string) ($p['groesse'] ?? '');
        if ($art_['preise']) {
            if (!isset($art_['preise'][$groesse])) $fehler('Bitte bei ' . $art_['name'] . ' die Größe neu wählen.');
            $stueck = (float) $art_['preise'][$groesse];
        } else {
            $stueck = (float) $art_['preis'];
            $groesse = '';
        }
        $namen = [];
        $proGruppe = [];
        $wahl = $p['wahl'] ?? null;
        if (!is_array($wahl)) $fehler('Bitte ' . $art_['name'] . ' neu in den Warenkorb legen.');
        foreach ($wahl as $w) {
            [$gi, $ci] = [(int) ($w[0] ?? -1), (int) ($w[1] ?? -1)];
            $g = $art_['optionen'][$gi] ?? null;
            $c = $g['auswahl'][$ci] ?? null;
            if (!$c) $fehler('Bitte ' . $art_['name'] . ' neu in den Warenkorb legen.');
            $proGruppe[$gi] = ($proGruppe[$gi] ?? 0) + 1;
            if (empty($g['mehrfach']) && $proGruppe[$gi] > 1) $fehler('Bitte ' . $art_['name'] . ' neu in den Warenkorb legen.');
            $stueck += (float) $c['aufpreis'];
            if (!preg_match(NICHTSSAGEND, $c['name'])) $namen[] = $c['name'];
        }
        $stueck = round($stueck, 2);
        $notiz = mb_substr(trim((string) ($p['notiz'] ?? '')), 0, 120);
        $zw += $stueck * $menge;
        $zeilen[] = ['name' => $art_['name'], 'groesse' => $groesse, 'optionen' => $namen, 'notiz' => $notiz,
                     'menge' => $menge, 'stueck' => $stueck];
    }
    $zw = round($zw, 2);
    $liefer = $zone ? (float) $zone['gebuehr'] : 0.0;
    if ($zone && $zw < $zone['min']) $fehler('Mindestbestellwert ' . euro((float) $zone['min']) . ' nicht erreicht.');
    $r = rabatt($angebote, $zw, $n);
    $gesamt = round($zw - ($r['betrag'] ?? 0) + $liefer, 2);

    return [
        'art' => $art, 'name' => $name, 'telefon' => $tel, 'email' => $email,
        'firma' => mb_substr(trim((string) ($d['firma'] ?? '')), 0, 80),
        'strasse' => mb_substr(trim((string) ($d['strasse'] ?? '')), 0, 80),
        'hausnr' => mb_substr(trim((string) ($d['hausnr'] ?? '')), 0, 10),
        'plz' => $zone['plz'] ?? '', 'ort' => $zone['ort'] ?? '',
        'etage' => mb_substr(trim((string) ($d['etage'] ?? '')), 0, 20),
        'zeit' => $zeit, 'bemerkung' => mb_substr(trim((string) ($d['bemerkung'] ?? '')), 0, 450),
        'positionen' => $zeilen, 'zwischensumme' => $zw, 'rabatt' => $r, 'liefergebuehr' => $liefer, 'gesamt' => $gesamt,
    ];
}

function zeile_text(array $z): string
{
    $det = array_values(array_filter(array_merge([$z['groesse']], $z['optionen'])));
    return $z['menge'] . '× ' . $z['name'] . ($det ? ' (' . implode(', ', $det) . ')' : '')
        . ($z['notiz'] !== '' ? ' – Wunsch: ' . $z['notiz'] : '');
}

// ---------- Stripe ----------
function stripe(string $methode, string $pfad, array $daten = []): array
{
    $key = (string) (geheim()['stripe_secret'] ?? '');
    if ($key === '') {
        throw new RuntimeException('Online-Zahlung ist noch nicht eingerichtet.');
    }
    $url = 'https://api.stripe.com/v1/' . $pfad;
    if ($methode === 'GET' && $daten) {
        $url .= '?' . http_build_query($daten);
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $key . ':',
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => ['Stripe-Version: 2024-06-20'],
    ]);
    if ($methode === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($daten));
    }
    $roh = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $fehler = curl_error($ch);
    curl_close($ch);
    if ($roh === false) {
        throw new RuntimeException('Stripe nicht erreichbar: ' . $fehler);
    }
    $j = json_decode((string) $roh, true) ?: [];
    if ($code >= 400) {
        throw new RuntimeException($j['error']['message'] ?? ('Stripe-Fehler ' . $code));
    }
    return $j;
}

// ---------- Bezahlte Bestellungen ablegen und melden ----------
/** Ordner für Bestellungen (nicht im Web abrufbar, wird beim Hochladen nicht überschrieben) */
function ordner(): string
{
    $o = __DIR__ . '/bestellungen';
    if (!is_dir($o)) {
        mkdir($o, 0750, true);
    }
    if (!is_file($o . '/.htaccess')) {
        file_put_contents($o . '/.htaccess', "Require all denied\n");
    }
    return $o;
}

function nr_ok(string $nr): bool
{
    return (bool) preg_match('/^W\d{6}-\d{4}-[A-F0-9]{4}$/', $nr);
}

function bestellung_text(array $b, array $s = []): string
{
    $online = ($b['zahlung'] ?? 'online') === 'online';
    $z = [];
    $z[] = 'NEUE BESTELLUNG Nr. ' . $b['nr'] . ' – ' . strtoupper($b['art']) . ' – '
        . ($online ? 'BEREITS BEZAHLT' : (($b['zahlung'] ?? '') === 'karte' ? 'KARTE BEI ÜBERGABE' : 'BAR KASSIEREN'));
    $z[] = 'Zeit: ' . $b['zeit'];
    $z[] = '';
    foreach ($b['positionen'] as $p) {
        $z[] = zeile_text($p) . ' – ' . euro($p['stueck'] * $p['menge']);
    }
    $z[] = '';
    $z[] = 'Zwischensumme: ' . euro($b['zwischensumme']);
    if (!empty($b['rabatt'])) $z[] = $b['rabatt']['titel'] . ': −' . euro($b['rabatt']['betrag']);
    if ($b['art'] === 'lieferung') $z[] = 'Liefergebühr: ' . ($b['liefergebuehr'] ? euro($b['liefergebuehr']) : 'gratis');
    if ($online) {
        $z[] = 'GESAMT: ' . euro($b['gesamt']) . ' – online bezahlt: ' . euro(($s['amount_total'] ?? 0) / 100);
        if (cent($b['gesamt']) !== (int) ($s['amount_total'] ?? 0)) {
            $z[] = '!!! ACHTUNG: Bezahlter Betrag weicht ab – bitte im Stripe-Dashboard prüfen !!!';
        }
    } else {
        $z[] = 'GESAMT: ' . euro($b['gesamt']) . ' – ' . (($b['zahlung'] ?? '') === 'karte' ? 'mit Karte bei Übergabe' : 'bar bei Übergabe');
    }
    $z[] = '';
    $z[] = $b['name'] . ', Tel. ' . $b['telefon'] . ($b['email'] !== '' ? ', ' . $b['email'] : '');
    if ($b['art'] === 'lieferung') {
        if ($b['firma'] !== '') $z[] = $b['firma'];
        $z[] = $b['strasse'] . ' ' . $b['hausnr'] . ', ' . $b['plz'] . ' ' . $b['ort'] . ($b['etage'] !== '' ? ', ' . $b['etage'] : '');
    } else {
        $z[] = 'Abholung im Laden';
    }
    if ($b['bemerkung'] !== '') $z[] = 'Bemerkung: ' . $b['bemerkung'];
    if ($online) {
        $z[] = '';
        $z[] = 'Stripe-Zahlung: ' . ($s['payment_intent'] ?? $s['id'] ?? '');
    }
    return implode("\n", $z);
}

/**
 * Bezahlte Checkout-Session verbuchen: Bestellung speichern und per E-Mail an den Laden schicken.
 * Wird vom Webhook und von der Danke-Seite aufgerufen – passiert aber nur einmal pro Bestellung.
 */
function verarbeiten(array $s): ?array
{
    $nr = (string) ($s['metadata']['nr'] ?? '');
    if (!nr_ok($nr) || ($s['payment_status'] ?? '') !== 'paid') {
        return null;
    }
    $o = ordner();
    $lock = fopen($o . '/.sperre', 'c');
    flock($lock, LOCK_EX);
    try {
        $fertig = $o . '/' . $nr . '.json';
        if (is_file($fertig)) {
            return json_decode((string) file_get_contents($fertig), true);
        }
        $offen = $o . '/offen-' . $nr . '.json';
        $b = is_file($offen) ? json_decode((string) file_get_contents($offen), true) : null;
        if (!$b) {
            // Notfall: Datei fehlt – Kurzfassung aus den Stripe-Metadaten
            $m = $s['metadata'];
            $b = ['nr' => $nr, 'art' => $m['art'] ?? '', 'zeit' => $m['zeit'] ?? '', 'name' => $m['name'] ?? '',
                  'telefon' => $m['telefon'] ?? '', 'email' => '', 'firma' => '', 'strasse' => $m['adresse'] ?? '', 'hausnr' => '',
                  'plz' => '', 'ort' => '', 'etage' => '', 'bemerkung' => $m['bemerkung'] ?? '',
                  'positionen' => [], 'zwischensumme' => 0, 'rabatt' => null, 'liefergebuehr' => 0,
                  'gesamt' => ($s['amount_total'] ?? 0) / 100, 'notiz' => 'Positionen siehe Stripe-Dashboard: ' . ($m['positionen'] ?? '')];
        }
        $b['zahlung'] = 'online';
        $b['bezahlt'] = ['session' => $s['id'] ?? '', 'payment_intent' => $s['payment_intent'] ?? '',
                         'betrag' => ($s['amount_total'] ?? 0) / 100, 'zeit' => jetzt()->format('c')];
        $b = speichern($b);
        if (is_file($offen)) {
            unlink($offen);
        }
        melden($b, $s);
        return $b;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Neue Bestellung ablegen (Status „neu“, noch nicht gedruckt) */
function speichern(array $b): array
{
    $b += ['eingang' => jetzt()->format('c')];
    $b['status'] = $b['status'] ?? 'neu';
    $b['gedruckt'] = $b['gedruckt'] ?? false;
    file_put_contents(ordner() . '/' . $b['nr'] . '.json', json_encode($b, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    return $b;
}

function neue_nr(DateTimeImmutable $n): string
{
    return 'W' . $n->format('ymd-Hi') . '-' . strtoupper(bin2hex(random_bytes(2)));
}

/** E-Mail an den Laden (Sicherheit, falls das Tablet aus ist) */
function melden(array $b, array $s = []): void
{
    $an = (string) (geheim()['shop_email'] ?? '');
    if ($an === '') {
        return;
    }
    $online = ($b['zahlung'] ?? '') === 'online';
    $text = bestellung_text($b, $s) . (isset($b['notiz']) ? "\n" . $b['notiz'] : '');
    $betreff = 'Bestellung ' . $b['nr'] . ' – ' . ($b['art'] === 'lieferung' ? 'Lieferung' : 'Abholung') . ' ' . $b['zeit']
        . ' – ' . euro((float) $b['gesamt']) . ($online ? ' bezahlt' : ' bei Übergabe');
    $kopf = "From: Neusser Döner & Pizza <bestellung@neusser-doner-pizza.de>\r\n"
        . ($b['email'] !== '' ? 'Reply-To: ' . $b['email'] . "\r\n" : '')
        . "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
    if (!mail($an, mb_encode_mimeheader($betreff, 'UTF-8'), $text, $kopf)) {
        error_log('Bestellung ' . $b['nr'] . ': E-Mail konnte nicht gesendet werden');
    }
}

// ---------- Rheinland Bestellsystem (Tablet im Laden) ----------
const MONITOR_HERZSCHLAG = 90;   // Sekunden: so lange gilt das Tablet nach der letzten Abfrage als „an“

/** Ist das Tablet im Laden gerade an? Dann gehen auch Bar- und Kartenbestellungen direkt dorthin. */
function system_an(): bool
{
    $f = __DIR__ . '/bestellungen/.herzschlag';
    return is_file($f) && filemtime($f) > time() - MONITOR_HERZSCHLAG;
}

function monitor_schluessel(): string
{
    $pw = (string) (geheim()['monitor_passwort'] ?? '');
    return $pw === '' ? '' : hash('sha256', 'rheinland-bestellsystem|' . $pw);
}

/** Anmeldung fürs Tablet: „Ablauf.Signatur“, 60 Tage gültig; neues Passwort macht alte Anmeldungen ungültig */
function monitor_token(): string
{
    $bis = (string) (time() + 60 * 86400);
    return $bis . '.' . hash_hmac('sha256', $bis, monitor_schluessel());
}

function monitor_pruefen(): void
{
    $k = monitor_schluessel();
    // eigener Kopf statt „Authorization“, den manche Apache-Einstellungen nicht an PHP weitergeben
    $t = (string) ($_SERVER['HTTP_X_TOKEN'] ?? '');
    [$bis, $sig] = array_pad(explode('.', $t, 2), 2, '');
    if ($k === '' || !ctype_digit($bis) || (int) $bis < time() || !hash_equals(hash_hmac('sha256', $bis, $k), $sig)) {
        antwort(['fehler' => 'Bitte neu anmelden.'], 401);
    }
}
