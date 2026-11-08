<?php
// Nimmt CSP-Meldungen der Browser an (Content-Security-Policy-Report-Only in .htaccess) und schreibt sie
// kurz in api/bestellungen/.csp.log – so sehen wir, ob die Regeln etwas blockieren würden, bevor wir sie scharf schalten.
declare(strict_types=1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(['fehler' => 'Nicht erlaubt.'], 405);
}
bremse('csp', 60, 3600);
$r = json_decode((string) file_get_contents('php://input', false, null, 0, 8000), true);
$r = $r['csp-report'] ?? $r[0]['body'] ?? null;
if (is_array($r)) {
    $f = ordner() . '/.csp.log';
    if (!is_file($f) || filesize($f) < 1_000_000) {
        $teile = array_map(fn ($k) => mb_substr(preg_replace('/\s+/', ' ', (string) ($r[$k] ?? '')), 0, 200),
            ['document-uri', 'effective-directive', 'violated-directive', 'blocked-uri', 'documentURL', 'effectiveDirective', 'blockedURL']);
        file_put_contents($f, jetzt()->format('Y-m-d H:i:s') . "\t" . implode("\t", array_filter($teile)) . "\n", FILE_APPEND | LOCK_EX);
    }
}
http_response_code(204);
