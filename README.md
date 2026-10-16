# Tagesanker

Tagesanker ist eine deutschsprachige, reizarm gestaltete Tagesplan-App. Sie speichert Aufgaben und Punkte lokal im Browser und kann als PWA installiert werden.

## Funktionen

- Tagesaufgaben mit optionaler Uhrzeit und flexible Aufgaben ohne feste Zeit
- 10 Punkte für jeden erstmalig erledigten Schritt; kein Streak- oder Strafsystem
- kurze Tipps, situationsbezogene Rückmeldungen und ein freiwilliger Check-in
- Zwei-Minuten-Starttimer für den Einstieg in eine Aufgabe
- lokale Speicherung und Offline-App-Shell über den Service Worker
- optionale Erinnerung nach 30 Minuten, solange die Seite geöffnet bleibt

## Start

Für Installation und Offline-Betrieb muss die App über HTTPS bereitgestellt werden, weil Browser Service Worker in `file://`-Seiten nicht zulassen. Auf Android öffnest du die HTTPS-Adresse in Chrome und wählst „App installieren“ oder „Zum Startbildschirm hinzufügen“. Auf dem iPhone öffnest du sie in Safari, tippst auf „Teilen“ und wählst „Zum Home-Bildschirm“.

Für einen lokalen Test im Projektordner kannst du `python -m http.server 8000` starten und anschließend `http://localhost:8000` öffnen. Diese lokale Adresse funktioniert nur auf diesem Computer; für die Installation auf dem Handy braucht die App eine HTTPS-Adresse.

## Kostenlos veröffentlichen

Das Projekt enthält einen GitHub-Actions-Workflow unter `.github/workflows/pages.yml`. Für die Veröffentlichung brauchst du ein kostenloses GitHub-Konto und ein öffentliches Repository, zum Beispiel `tagesanker`:

1. Erstelle auf GitHub ein öffentliches Repository namens `tagesanker`.
2. Lade die Dateien dieses Ordners in den Hauptbranch `main` hoch.
3. Öffne im Repository **Settings → Pages** und wähle **GitHub Actions** als Quelle.
4. Nach dem nächsten Push veröffentlicht der Workflow die App unter `https://DEIN-NAME.github.io/tagesanker/`.

Der App-Code ist in diesem Fall öffentlich einsehbar. Aufgaben, Punkte und Erinnerungszeiten werden nicht mitveröffentlicht; sie bleiben im Browser des jeweiligen Geräts.

Aufgaben und Punkte werden in IndexedDB und zusätzlich als Rückfallkopie im Browser gespeichert. Die App bittet den Browser, diesen Speicher vor automatischer Bereinigung zu schützen; die Entscheidung hängt vom Gerät und Browser ab. Die 30-Minuten-Erinnerung wird gespeichert und beim nächsten Öffnen nachgeholt. Zuverlässige Hintergrund-Push-Mitteilungen und geräteübergreifende Synchronisierung sind in diesem lokalen Startstand nicht enthalten und erfordern einen Push-/Cloud-Dienst.

Alle Aufgaben und Punktestände bleiben auf dem jeweiligen Gerät im Browser-Speicher. Löschen der Browserdaten kann sie entfernen. Die Nutzung auf Handy und Computer erzeugt getrennte Datenbestände, bis eine Cloud-Synchronisierung eingerichtet wird.