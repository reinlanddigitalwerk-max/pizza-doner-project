# Neusser Döner & Pizza – Website und Rheinland Bestellsystem

Statische Seiten (gebaut mit `python3 tools/build_pages.py`) plus PHP auf dem Webspace von United Domains (`api/`).
Jeder Push auf `claude/peaceful-einstein-qj0d00` oder `main` geht **sofort live** (`.github/workflows/united-domains.yml`).

## Sicherheitsregeln

1. Keine Schlüssel, Passwörter oder Tokens in Code, Git oder Chat. Sie stehen nur in GitHub Secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHOP_EMAIL`, `MONITOR_PASSWORT`, `FTP_*`) und werden beim
   Upload nach `api/geheim.php` geschrieben (in `.gitignore`, per `.htaccess` gesperrt).
2. Preise, Zeiten, Liefergebiete und Rabatte rechnet immer der Server nach (`api/lib.php`) – nie dem Browser glauben.
3. Kundentext (Name, Adresse, Bemerkung, Wünsche) nur mit `esc()` bzw. `textContent` in HTML schreiben, nie roh per `innerHTML`.
4. Bestellungen in `api/bestellungen/` nie löschen oder überschreiben; der Ordner ist vom Upload ausgeschlossen und im Web gesperrt.
   Für Tests eine Kopie der Seite mit `php -S` im Scratchpad benutzen, nie echte Bestellungen auf der Live-Seite anlegen.
5. Vor jedem Push: `php -l api/*.php`, Seiten neu bauen, Kasse und Bestellsystem lokal durchspielen (Stripe und Drucker gemockt).
6. Neue Endpunkte in `api/`: Herkunft prüfen, Eingaben begrenzen, `bremse()` gegen Massenaufrufe, Fehler ohne interne Details.
7. Nichts Sensibles ins Protokoll: `sicherheit()` speichert nur Ereignis, Zeit und gekürzte IP.
8. Zusammenfassungen für den Inhaber auf Arabisch (syrischer Dialekt), kurz und ohne unnötige Fachwörter.
